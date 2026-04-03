"""§2-2 Rule validation tool — datapoint structure + rulebook hints."""

from __future__ import annotations

from typing import Any, List, Set

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.domain.v1.esg_data.spokes.infra.ucm_pipeline_contracts import (
    EmbeddingCandidateItem,
    RuleCandidateResult,
    RuleValidationResult,
    RuleViolation,
)
from backend.domain.shared.tool.UnifiedColumnMapping.ucm_dp_mapping_signals import (
    flatten_validation_rules_for_display,
    paragraph_axis_overlap_penalty,
    paragraph_axis_tokens_for_dp,
    paragraph_axis_tokens_from_rulebook_validation_rules,
)


def _dp_type_str(v: Any) -> str:
    if v is None:
        return ""
    return v.value if hasattr(v, "value") else str(v)


def _unit_str(v: Any) -> str | None:
    if v is None:
        return None
    return v.value if hasattr(v, "value") else str(v)


def _req_str(v: Any) -> str | None:
    if v is None:
        return None
    return v.value if hasattr(v, "value") else str(v)


def _enough_ascii(s: str) -> bool:
    t = (s or "").strip()
    if len(t) < 8:
        return False
    return sum(1 for c in t if ord(c) < 128) / max(1, len(t)) > 0.45


def _key_terms_from_validation_rules(vr: Any) -> List[str]:
    if not vr:
        return []
    if isinstance(vr, dict):
        kt = vr.get("key_terms")
        if isinstance(kt, list):
            return [str(x) for x in kt]
    return []


class RuleValidationTool:
    """Score and filter candidates using DP metadata and linked rulebooks."""

    def run(
        self,
        db: Session,
        service: Any,
        *,
        source_dp_id: str,
        candidates: List[EmbeddingCandidateItem],
    ) -> RuleValidationResult:
        from backend.domain.v1.esg_data.models.bases import DataPoint, Rulebook

        source = (
            db.query(DataPoint)
            .filter(DataPoint.dp_id == source_dp_id, DataPoint.is_active.is_(True))
            .first()
        )
        if not source:
            return {
                "status": "error",
                "source_dp_id": source_dp_id,
                "per_candidate": [],
                "message": f"source dp not found: {source_dp_id}",
            }

        primary_ids = {
            rid
            for (rid,) in db.query(Rulebook.rulebook_id)
            .filter(Rulebook.is_active.is_(True), Rulebook.primary_dp_id == source_dp_id)
            .all()
        }
        related_ids_rows = db.execute(
            text(
                """
                SELECT rulebook_id
                FROM rulebooks
                WHERE is_active = TRUE
                  AND :source_dp_id = ANY(related_dp_ids)
                """
            ),
            {"source_dp_id": source_dp_id},
        ).fetchall()
        related_ids = {row[0] for row in related_ids_rows}
        matched_rulebook_ids = primary_ids | related_ids
        if matched_rulebook_ids:
            rulebooks = (
                db.query(Rulebook)
                .filter(Rulebook.is_active.is_(True), Rulebook.rulebook_id.in_(matched_rulebook_ids))
                .all()
            )
        else:
            rulebooks = []

        related_ids: Set[str] = {source_dp_id}
        key_terms: Set[str] = set()
        for rb in rulebooks:
            if rb.related_dp_ids:
                related_ids.update(rb.related_dp_ids)
            key_terms.update(_key_terms_from_validation_rules(rb.validation_rules))
            if rb.key_terms:
                key_terms.update(str(t).lower() for t in rb.key_terms)
        validation_rules_snapshot = [
            {
                "rulebook_id": rb.rulebook_id,
                "validation_rules": rb.validation_rules or {},
                "key_terms": list(rb.key_terms or []),
            }
            for rb in rulebooks
        ]

        source_axis_tokens: Set[str] = set(paragraph_axis_tokens_for_dp(source, None))
        for rb in rulebooks:
            source_axis_tokens |= paragraph_axis_tokens_from_rulebook_validation_rules(rb.validation_rules)
        source_dp_validation = flatten_validation_rules_for_display(getattr(source, "validation_rules", None))

        per: List[RuleCandidateResult] = []
        for c in candidates:
            tid = c["target_dp_id"]
            target = (
                db.query(DataPoint)
                .filter(DataPoint.dp_id == tid, DataPoint.is_active.is_(True))
                .first()
            )
            if not target:
                per.append(
                    {
                        "target_dp_id": tid,
                        "rule_pass": False,
                        "rule_score": 0.0,
                        "structure_score": 0.0,
                        "requirement_score": 0.0,
                        "violations": [
                            {
                                "type": "missing_target_dp",
                                "severity": "critical",
                                "detail": tid,
                            }
                        ],
                    }
                )
                continue

            structural_score, match_details = service._calculate_structural_match(source, target)
            violations: List[RuleViolation] = []

            st = _dp_type_str(source.dp_type)
            tt = _dp_type_str(target.dp_type)
            if st and tt and st != tt:
                sev = "critical" if {st, tt} == {"quantitative", "narrative"} else "warning"
                violations.append(
                    {
                        "type": "data_type_mismatch",
                        "severity": sev,
                        "detail": f"{st} vs {tt}",
                    }
                )

            su, tu = _unit_str(source.unit), _unit_str(target.unit)
            if st == "quantitative" and tt == "quantitative" and su and tu and su != tu:
                compatible = service._are_units_compatible(su, tu)
                if not compatible:
                    violations.append(
                        {
                            "type": "unit_mismatch",
                            "severity": "critical",
                            "detail": f"{su} vs {tu}",
                        }
                    )

            if source.category != target.category:
                violations.append(
                    {
                        "type": "category_mismatch",
                        "severity": "warning",
                        "detail": f"{source.category} vs {target.category}",
                    }
                )

            s_topic = (source.topic or "").strip().lower()
            t_topic = (target.topic or "").strip().lower()
            s_subtopic = (source.subtopic or "").strip().lower()
            t_subtopic = (target.subtopic or "").strip().lower()
            if s_topic and t_topic and s_topic != t_topic:
                if s_subtopic and t_subtopic and s_subtopic != t_subtopic:
                    violations.append(
                        {
                            "type": "topic_subtopic_mismatch",
                            "severity": "warning",
                            "detail": f"topic: {source.topic} vs {target.topic}, subtopic: {source.subtopic} vs {target.subtopic}",
                        }
                    )

            critical = any(v["severity"] == "critical" for v in violations)
            rule_pass = not critical

            text_blob_ko = " ".join(
                filter(
                    None,
                    [
                        (source.description or ""),
                        (target.description or ""),
                        source.name_ko or "",
                        target.name_ko or "",
                    ],
                )
            ).lower()

            text_blob_en = " ".join(
                filter(
                    None,
                    [
                        source.name_en or "",
                        target.name_en or "",
                        (source.description or "") if _enough_ascii(source.description or "") else "",
                        (target.description or "") if _enough_ascii(target.description or "") else "",
                    ],
                )
            ).lower()

            overlap = 0
            if key_terms:
                overlap = sum(
                    1
                    for k in key_terms
                    if k.lower() in text_blob_ko or k.lower() in text_blob_en
                )
                term_score = min(1.0, overlap / max(3, len(key_terms) * 0.15))
            else:
                term_score = 0.5

            tgt_axis = set(paragraph_axis_tokens_for_dp(target, None))
            tgt_rb = (
                db.query(Rulebook)
                .filter(Rulebook.is_active.is_(True), Rulebook.primary_dp_id == tid)
                .first()
            )
            if tgt_rb is not None:
                tgt_axis |= paragraph_axis_tokens_from_rulebook_validation_rules(tgt_rb.validation_rules)
            axis_overlap, axis_disjoint = paragraph_axis_overlap_penalty(source_axis_tokens, tgt_axis)
            axis_evidence = {
                "source_tokens": sorted(source_axis_tokens)[:24],
                "target_tokens": sorted(tgt_axis)[:24],
                "intersection": sorted(source_axis_tokens & tgt_axis)[:24],
                "overlap": axis_overlap,
            }
            if axis_disjoint:
                violations.append(
                    {
                        "type": "paragraph_axis_mismatch",
                        "severity": "warning",
                        "detail": "추출한 문단·조항 축이 소스/타깃에서 교집합이 없음",
                    }
                )

            related_bonus = 0.15 if tid in related_ids else 0.0
            rule_score = max(0.0, min(1.0, 0.5 * term_score + 0.5 * (1.0 if rule_pass else 0.2) + related_bonus))
            if axis_overlap:
                rule_score = min(1.0, rule_score + 0.05)
            if axis_disjoint:
                rule_score *= 0.88
            if critical:
                rule_score = min(rule_score, 0.35)
            if any(v.get("type") == "topic_subtopic_mismatch" for v in violations):
                rule_score = max(0.0, min(1.0, float(rule_score) * 0.70))

            sr = _req_str(source.disclosure_requirement)
            tr = _req_str(target.disclosure_requirement)
            requirement_score = 1.0 if (sr == "필수" or tr == "필수") else 0.85

            target_dp_validation = flatten_validation_rules_for_display(getattr(target, "validation_rules", None))

            per.append(
                {
                    "target_dp_id": tid,
                    "rule_pass": rule_pass,
                    "rule_score": round(rule_score, 4),
                    "structure_score": round(float(structural_score), 4),
                    "requirement_score": round(requirement_score, 4),
                    "violations": violations,
                    "rule_evidence": {
                        "rulebook_count": len(rulebooks),
                        "key_term_overlap": overlap,
                        "structural_match_details": match_details,
                        "validation_rules": validation_rules_snapshot,
                        "source_datapoint_validation_rules": source_dp_validation,
                        "target_datapoint_validation_rules": target_dp_validation,
                        "paragraph_axis": axis_evidence,
                    },
                }
            )

        return {"status": "success", "source_dp_id": source_dp_id, "per_candidate": per}
