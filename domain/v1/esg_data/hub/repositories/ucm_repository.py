"""esg_data용 UCM·데이터 포인트 영속화(저장·조회) 접근 계층."""

from __future__ import annotations

from typing import Any, Dict

from loguru import logger
from sqlalchemy import text

from backend.core.db import get_session
from backend.domain.v1.esg_data.models.bases import DataPoint, UnifiedColumnMapping
from backend.domain.v1.esg_data.spokes.infra.ucm_pipeline_contracts import (
    UCMWorkflowValidationResult,
)


class UCMRepository:
    """unified_column_mappings 및 관련 데이터 포인트 검증을 담당하는 저장소."""

    def upsert_ucm_from_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        db = None
        try:
            skip = frozenset({"reason_codes", "evidence", "policy_version", "mapping_status"})
            db = get_session()
            uid = payload["unified_column_id"]
            incoming_mapped = _normalize_str_list(payload.get("mapped_dp_ids"))
            existing = (
                db.query(UnifiedColumnMapping)
                .filter(UnifiedColumnMapping.unified_column_id == uid)
                .first()
            )
            if existing is None and incoming_mapped:
                existing = (
                    db.query(UnifiedColumnMapping)
                    .filter(UnifiedColumnMapping.is_active.is_(True))
                    # ARRAY overlap: SQLAlchemy generic ARRAY comparator에는 `.overlap()`이 없을 수 있어
                    # PostgreSQL 연산자 `&&`를 직접 사용한다.
                    .filter(UnifiedColumnMapping.mapped_dp_ids.op("&&")(incoming_mapped))
                    .order_by(UnifiedColumnMapping.updated_at.desc())
                    .first()
                )
            col_names = {c.name for c in UnifiedColumnMapping.__table__.columns}
            data = {
                k: v
                for k, v in payload.items()
                if k in col_names and k != "unified_column_id" and k not in skip
            }
            if existing is not None:
                data = _merge_ucm_row_data(existing=existing, incoming=data, incoming_payload=payload)
            if existing:
                for key, value in data.items():
                    setattr(existing, key, value)
                mode = "update" if existing.unified_column_id == uid else "merge_update"
                uid = existing.unified_column_id
            else:
                row = UnifiedColumnMapping(unified_column_id=uid, **data)
                db.add(row)
                mode = "create"
            db.commit()
            return {"status": "success", "unified_column_id": uid, "mode": mode}
        except Exception as e:
            logger.exception("UCM upsert 실패")
            if db is not None:
                db.rollback()
            return {
                "status": "error",
                "message": str(e),
                "unified_column_id": payload.get("unified_column_id"),
            }
        finally:
            if db is not None:
                db.close()

    def validate_mappings(self) -> UCMWorkflowValidationResult:
        """UCM·data_points 정합성 요약 통계."""
        db = None
        try:
            db = get_session()

            total_dp = db.query(DataPoint).filter(DataPoint.is_active.is_(True)).count()
            mapped_equivalent = db.query(DataPoint).filter(
                DataPoint.is_active.is_(True),
                DataPoint.equivalent_dps.isnot(None),
            ).count()
            total_ucm = db.query(UnifiedColumnMapping).filter(
                UnifiedColumnMapping.is_active.is_(True)
            ).count()

            missing_dp_rows = db.execute(
                text(
                    """
                    SELECT COUNT(*) AS cnt
                    FROM unified_column_mappings ucm
                    LEFT JOIN LATERAL unnest(ucm.mapped_dp_ids) AS m(dp_id) ON TRUE
                    LEFT JOIN data_points dp ON dp.dp_id = m.dp_id
                    WHERE ucm.is_active = TRUE
                      AND dp.dp_id IS NULL
                    """
                )
            ).scalar() or 0

            coverage = round((mapped_equivalent / total_dp) * 100, 2) if total_dp else 0.0
            return {
                "status": "success",
                "metrics": {
                    "active_data_points": total_dp,
                    "mapped_data_points_by_equivalent_dps": mapped_equivalent,
                    "mapping_coverage_percent": coverage,
                    "active_unified_column_mappings": total_ucm,
                    "missing_dp_references_in_ucm": int(missing_dp_rows),
                },
            }
        except Exception as e:
            logger.exception("UCM 헬스체크 실패")
            return {"status": "error", "message": str(e)}
        finally:
            if db is not None:
                db.close()


_STANDARD_PRIORITY = ("ISSB", "ESRS", "GRI")


def _normalize_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in value:
        s = str(item).strip()
        if not s or s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def _standard_rank(standard: str) -> tuple[int, str]:
    upper = standard.upper()
    try:
        return (_STANDARD_PRIORITY.index(upper), upper)
    except ValueError:
        return (len(_STANDARD_PRIORITY), upper)


def _pick_anchor_standard(standard_metadata: dict[str, Any], fallback: str) -> str:
    candidates = [str(k) for k in standard_metadata.keys() if str(k).strip()]
    if not candidates:
        return fallback
    return sorted(candidates, key=_standard_rank)[0]


def _merge_standard_metadata(existing_meta: Any, incoming_meta: Any) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    if isinstance(existing_meta, dict):
        for k, v in existing_meta.items():
            key = str(k).strip()
            if key:
                merged[key] = v
    if isinstance(incoming_meta, dict):
        for k, v in incoming_meta.items():
            key = str(k).strip()
            if key:
                merged[key] = v
    return merged


def _merge_ucm_row_data(
    *, existing: UnifiedColumnMapping, incoming: dict[str, Any], incoming_payload: dict[str, Any]
) -> dict[str, Any]:
    merged = dict(incoming)
    existing_mapped = _normalize_str_list(getattr(existing, "mapped_dp_ids", None))
    incoming_mapped = _normalize_str_list(incoming.get("mapped_dp_ids"))
    merged_mapped = sorted(set(existing_mapped) | set(incoming_mapped))
    if merged_mapped:
        merged["mapped_dp_ids"] = merged_mapped

    existing_applicable = _normalize_str_list(getattr(existing, "applicable_standards", None))
    incoming_applicable = _normalize_str_list(incoming.get("applicable_standards"))
    if existing_applicable or incoming_applicable:
        merged["applicable_standards"] = sorted(set(existing_applicable) | set(incoming_applicable))

    merged_meta = _merge_standard_metadata(
        getattr(existing, "standard_metadata", None),
        incoming.get("standard_metadata"),
    )
    if merged_meta:
        merged["standard_metadata"] = merged_meta

    fallback_standard = str(
        incoming_payload.get("primary_standard")
        or incoming.get("primary_standard")
        or getattr(existing, "primary_standard", "")
        or ""
    )
    anchor_standard = _pick_anchor_standard(merged_meta, fallback_standard)
    if anchor_standard:
        merged["primary_standard"] = anchor_standard
        anchor = merged_meta.get(anchor_standard)
        if isinstance(anchor, dict):
            if anchor.get("column_name_ko"):
                merged["column_name_ko"] = anchor["column_name_ko"]
            if anchor.get("column_name_en"):
                merged["column_name_en"] = anchor["column_name_en"]
            merged["column_description"] = anchor.get("description")
            merged["column_topic"] = anchor.get("topic")
            merged["column_subtopic"] = anchor.get("subtopic")
    return merged
