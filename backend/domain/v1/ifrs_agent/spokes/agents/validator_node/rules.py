"""
validator_node 규칙 기반 검증 (무 LLM).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple

from .payload import ValidationMode


@dataclass
class RuleResult:
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class RuleSignals:
    """규칙 단계에서 결정 가능한 차원 점수(0–100) 및 메모."""

    dimension_scores: Dict[str, int] = field(default_factory=dict)
    dimension_notes_ko: Dict[str, str] = field(default_factory=dict)
    rule_summary_ko: str = ""

    @classmethod
    def baseline(cls) -> RuleSignals:
        """LLM 차원은 병합 단계에서 채움."""
        return cls(
            dimension_scores={
                "format_completeness": 100,
                "numeric_presence": 100,
                "dp_availability": 100,
            },
            dimension_notes_ko={
                "format_completeness": "검사 전",
                "numeric_presence": "검사 전",
                "dp_availability": "검사 전",
            },
        )


def rule_non_empty_text(text: str) -> List[str]:
    if not text or not text.strip():
        return [
            "생성 문단이 비어 있습니다. 제공된 데이터에 맞는 본문을 작성하세요.",
        ]
    return []


def rule_min_length(text: str, min_chars: int) -> List[str]:
    if len(text.strip()) < min_chars:
        return [
            f"문단이 너무 짧습니다(최소 약 {min_chars}자 권장). 맥락·수치·근거를 보강해 다시 작성하세요.",
        ]
    return []


def rule_fact_dp_warnings(fact_data_by_dp: Dict[str, Any]) -> List[str]:
    """DP 조회 실패는 본문 오류가 아니라 경고로만 전달 (재시도 남발 방지)."""
    out: List[str] = []
    if not isinstance(fact_data_by_dp, dict):
        return out
    for dp_id, fact in fact_data_by_dp.items():
        if not isinstance(fact, dict):
            continue
        err = fact.get("error")
        if err:
            out.append(
                f"DP {dp_id} 데이터 조회에 실패했습니다. 해당 수치를 인용하지 마세요. ({err})"
            )
    return out


def _label_for_fact(dp_id: str, fact: Dict[str, Any]) -> str:
    """fact에서 표시용 레이블 추출 (dp_metadata 우선, 없으면 ucm)."""
    meta = fact.get("dp_metadata") or {}
    if isinstance(meta, dict):
        name = meta.get("name_ko") or meta.get("name")
        if name:
            return str(name)
    
    # UCM 정보 확인
    ucm = fact.get("ucm") or {}
    if isinstance(ucm, dict):
        ucm_name = ucm.get("column_name_ko")
        if ucm_name:
            return str(ucm_name)
    
    return str(dp_id)


def _numeric_value(fact: Dict[str, Any]) -> Tuple[bool, float]:
    """fact에서 수치 추출 (latest_value 우선, 없으면 supplementary_real_data 첫 값)."""
    v = fact.get("value")
    if v is None:
        # supplementary_real_data에서 첫 번째 값 시도
        supp = fact.get("supplementary_real_data")
        if isinstance(supp, list) and len(supp) > 0:
            first = supp[0]
            if isinstance(first, dict):
                v = first.get("value")
    
    if v is None:
        return False, 0.0
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return True, float(v)
    if isinstance(v, str):
        s = v.replace(",", "").strip()
        try:
            return True, float(s)
        except ValueError:
            return False, 0.0
    return False, 0.0


def _formats_for_number(n: float) -> List[str]:
    forms: List[str] = []
    if abs(n - round(n)) < 1e-9:
        i = int(round(n))
        forms.append(str(i))
        if i >= 1000:
            forms.append(f"{i:,}")
    else:
        s = f"{n:.6f}".rstrip("0").rstrip(".")
        forms.append(s)
    return list(dict.fromkeys(forms))


def _any_format_in_text(text: str, forms: List[str]) -> bool:
    for f in forms:
        if f and f in text:
            return True
    norm = re.sub(r"[\s,]", "", text)
    for f in forms:
        f2 = re.sub(r",", "", f)
        if f2 and f2 in norm:
            return True
    return False


def rule_numeric_consistency_light(
    text: str,
    fact_data: Dict[str, Any],
    fact_data_by_dp: Dict[str, Any],
    min_text_for_check: int = 120,
) -> List[str]:
    """
    정량 value가 팩트에 있는데 본문 어디에도 등장하지 않으면 경고 1건(오탐 완화: 전부 누락일 때만).
    """
    errs: List[str] = []
    if len(text.strip()) < min_text_for_check:
        return errs

    candidates: List[Tuple[str, float]] = []
    for bucket in (fact_data,):
        if isinstance(bucket, dict) and bucket.get("error"):
            continue
        if isinstance(bucket, dict):
            ok, num = _numeric_value(bucket)
            if ok:
                candidates.append((_label_for_fact("representative", bucket), num))

    if isinstance(fact_data_by_dp, dict):
        for dp_id, fact in fact_data_by_dp.items():
            if not isinstance(fact, dict) or fact.get("error"):
                continue
            ok, num = _numeric_value(fact)
            if ok:
                candidates.append((_label_for_fact(str(dp_id), fact), num))

    if len(candidates) < 1:
        return errs

    found_any = False
    missing_labels: List[str] = []
    for label, num in candidates:
        forms = _formats_for_number(num)
        if _any_format_in_text(text, forms):
            found_any = True
        else:
            missing_labels.append(f"{label}={num}")

    if not found_any and missing_labels:
        snippet = ", ".join(missing_labels[:5])
        suffix = " 등" if len(missing_labels) > 5 else ""
        errs.append(
            f"제공된 데이터의 수치({snippet}{suffix})가 본문에 반영되지 않았습니다. "
            "지표 수치를 본문에 명시하세요."
        )
    return errs


def run_rules(
    text: str,
    fact_data: Dict[str, Any],
    fact_data_by_dp: Dict[str, Any],
    mode: ValidationMode,
) -> Tuple[RuleResult, RuleSignals]:
    out = RuleResult()
    sig = RuleSignals.baseline()
    min_chars = 80 if mode == ValidationMode.CREATE else 40

    out.errors.extend(rule_non_empty_text(text))
    if out.errors:
        sig.dimension_scores["format_completeness"] = 0
        sig.dimension_notes_ko["format_completeness"] = "본문이 비어 있음"
        sig.rule_summary_ko = "형식: 비어 있음"
        return out, sig

    out.errors.extend(rule_min_length(text, min_chars=min_chars))
    if out.errors:
        sig.dimension_scores["format_completeness"] = 0
        sig.dimension_notes_ko["format_completeness"] = f"최소 길이({min_chars}자) 미달"
        sig.rule_summary_ko = "형식: 길이 부족"
        return out, sig

    sig.dimension_notes_ko["format_completeness"] = "비어 있지 않고 최소 길이 충족"
    sig.rule_summary_ko = "형식 요건 충족"

    dp_warns = rule_fact_dp_warnings(fact_data_by_dp or {})
    out.warnings.extend(dp_warns)
    if dp_warns:
        sig.dimension_scores["dp_availability"] = 85
        sig.dimension_notes_ko["dp_availability"] = (
            "일부 DP 데이터 조회 실패 — 해당 수치 인용 주의"
        )
    else:
        sig.dimension_scores["dp_availability"] = 100
        sig.dimension_notes_ko["dp_availability"] = "DP 조회 경고 없음"

    # Refine은 짧은 수정이 많아 수치 전체 미반영 검사는 생략
    if mode == ValidationMode.CREATE:
        num_errs = rule_numeric_consistency_light(
            text,
            fact_data if isinstance(fact_data, dict) else {},
            fact_data_by_dp if isinstance(fact_data_by_dp, dict) else {},
        )
        out.errors.extend(num_errs)
        if num_errs:
            sig.dimension_scores["numeric_presence"] = 0
            sig.dimension_notes_ko["numeric_presence"] = (
                "제공된 수치가 본문에 반영되지 않음"
            )
            sig.rule_summary_ko = (
                sig.rule_summary_ko + "; 수치 최소 반영 미충족"
            ).strip("; ")
        else:
            sig.dimension_notes_ko["numeric_presence"] = (
                "제공 수치가 본문에 최소 1회 이상 반영됨(create)"
            )
    else:
        sig.dimension_notes_ko["numeric_presence"] = (
            "refine 모드: 수치 전체 반영 검사 생략"
        )

    return out, sig


def format_supplementary_rows_compact(
    supplementary_real_data: Any,
    *,
    max_rows: int = 15,
    value_max_chars: int = 96,
) -> List[str]:
    """
    gen_node 프롬프트의 보조 실데이터와 동일한 출처를 검증 LLM에 넘기기 위한 한 줄 요약.
    각 줄: `  · table.column: 값 [단위]`
    """
    lines: List[str] = []
    if not isinstance(supplementary_real_data, list) or not supplementary_real_data:
        return lines
    shown = 0
    for row in supplementary_real_data:
        if shown >= max_rows:
            break
        if not isinstance(row, dict):
            continue
        tbl = str(row.get("table") or "").strip()
        col = str(row.get("column") or "").strip()
        loc = f"{tbl}.{col}".strip(".") or f"row_{shown + 1}"
        if row.get("error"):
            lines.append(f"  · {loc}: (조회 실패 — {row.get('error')})")
            shown += 1
            continue
        val = row.get("value")
        if isinstance(val, (dict, list)):
            try:
                vs = json.dumps(val, ensure_ascii=False, default=str)
            except TypeError:
                vs = str(val)
        elif val is None:
            vs = "null"
        else:
            vs = str(val)
        if len(vs) > value_max_chars:
            vs = vs[:value_max_chars] + "…"
        u = row.get("unit")
        if isinstance(u, str) and u.strip():
            vs = f"{vs} {u.strip()}"
        lines.append(f"  · {loc}: {vs}")
        shown += 1
    remainder = len(supplementary_real_data) - shown
    if remainder > 0:
        lines.append(f"  · … 외 {remainder}건")
    return lines


def summarize_facts_for_llm(
    fact_data: Dict[str, Any],
    fact_data_by_dp: Dict[str, Any],
    max_repr_chars: int = 2000,
    max_facts_summary_chars: int = 14_000,
) -> Tuple[str, str]:
    """(facts_summary lines, representative_fact string)"""
    lines: List[str] = []
    if isinstance(fact_data_by_dp, dict):
        for dp_id, fact in fact_data_by_dp.items():
            if not isinstance(fact, dict):
                continue
            meta = fact.get("dp_metadata") or {}
            name_ko = meta.get("name_ko", "") if isinstance(meta, dict) else ""
            
            # latest_value 우선, 없으면 supplementary_real_data 첫 값 사용
            val = fact.get("value")
            if val is None:
                supp = fact.get("supplementary_real_data")
                if isinstance(supp, list) and len(supp) > 0:
                    first = supp[0]
                    if isinstance(first, dict):
                        val = first.get("value")
            
            unit = fact.get("unit") or ""
            err = fact.get("error")
            err_s = f" error={err}" if err else ""
            
            # supplementary_real_data 정보 추가
            supp_info = ""
            supp = fact.get("supplementary_real_data")
            if isinstance(supp, list) and len(supp) > 0:
                supp_count = len(supp)
                supp_info = f" (supplementary: {supp_count}건)"
            
            lines.append(
                f"- dp_id={dp_id} name_ko={name_ko!r} value={val!r} unit={unit!r}{supp_info}{err_s}"
            )
            # 보조 실데이터 행별 수치 (gen_node와 동일 출처 — 검증 오탐 방지)
            if isinstance(supp, list) and len(supp) > 0:
                lines.extend(format_supplementary_rows_compact(supp))
    facts_summary = "\n".join(lines) if lines else "(없음)"
    if len(facts_summary) > max_facts_summary_chars:
        facts_summary = facts_summary[:max_facts_summary_chars] + "\n…(truncated)"
    try:
        repr_s = json.dumps(fact_data, ensure_ascii=False, default=str)
    except TypeError:
        repr_s = str(fact_data)
    if len(repr_s) > max_repr_chars:
        repr_s = repr_s[:max_repr_chars] + "…(truncated)"
    return facts_summary, repr_s
