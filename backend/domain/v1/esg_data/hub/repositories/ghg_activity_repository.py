"""`ghg_activity_data` 영속화 — 배치 선조회 + 멱등 upsert."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from loguru import logger
from sqlalchemy import tuple_
from sqlalchemy.orm import Session

from backend.core.db import get_session
from backend.domain.v1.esg_data.models.bases.ghg_activity_data import GhgActivityData

_WRITABLE_COLUMNS = tuple(
    c.name for c in GhgActivityData.__table__.columns if c.name not in ("id", "created_at")
)

_DEFAULT_KEY_CHUNK = 500


def _apply_row_dict(entity: GhgActivityData, d: Dict[str, Any]) -> None:
    for name in _WRITABLE_COLUMNS:
        if name in d:
            setattr(entity, name, d[name])


def _norm_key_pair(src: Any, sid: Any) -> Tuple[str, str]:
    return (str(src).strip(), str(sid).strip())


def _dedupe_rows_for_company(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """동일 (source_system, source_record_id)는 입력 순서상 마지막 행만 유지."""
    by_key: Dict[Tuple[str, str], Dict[str, Any]] = {}
    no_key: List[Dict[str, Any]] = []
    for d in rows:
        sid = d.get("source_record_id")
        src = d.get("source_system")
        if sid and src:
            by_key[_norm_key_pair(src, sid)] = d
        else:
            no_key.append(d)
    return list(by_key.values()) + no_key


class GhgActivityRepository:
    def __init__(self, db_session: Optional[Session] = None) -> None:
        self._session = db_session
        self._owns_session = db_session is None

    def _sess(self) -> Session:
        if self._session is not None:
            return self._session
        return get_session()

    def _close_if_owned(self, db: Session) -> None:
        if self._owns_session and db is not None:
            db.close()

    def _load_existing_map(
        self,
        db: Session,
        company_id: uuid.UUID,
        key_pairs: Set[Tuple[str, str]],
        chunk_size: int,
    ) -> Dict[Tuple[str, str], GhgActivityData]:
        """(source_system, source_record_id) → 기존 엔티티."""
        out: Dict[Tuple[str, str], GhgActivityData] = {}
        pairs = list(key_pairs)
        for i in range(0, len(pairs), chunk_size):
            chunk = pairs[i : i + chunk_size]
            if not chunk:
                continue
            rows = (
                db.query(GhgActivityData)
                .filter(GhgActivityData.company_id == company_id)
                .filter(tuple_(GhgActivityData.source_system, GhgActivityData.source_record_id).in_(chunk))
                .all()
            )
            for row in rows:
                if row.source_system is not None and row.source_record_id is not None:
                    out[_norm_key_pair(row.source_system, row.source_record_id)] = row
        return out

    def upsert_from_dicts(
        self,
        row_dicts: List[Dict[str, Any]],
        *,
        key_lookup_chunk_size: int = _DEFAULT_KEY_CHUNK,
    ) -> Dict[str, Any]:
        """
        배치: 멱등 키(source_system+source_record_id+company)별 기존 행을 IN 청크로 선조회 후 갱신/삽입.
        """
        db = self._sess()
        inserted = 0
        updated = 0
        errors: List[str] = []
        try:
            now = datetime.now(timezone.utc)

            normalized: List[Dict[str, Any]] = []
            for raw in row_dicts:
                d = {k: v for k, v in raw.items() if k and not str(k).startswith("_")}
                cid = d.get("company_id")
                if cid is None:
                    errors.append("missing company_id")
                    continue
                if not isinstance(cid, uuid.UUID):
                    cid = uuid.UUID(str(cid))
                d["company_id"] = cid
                normalized.append(d)

            by_company: Dict[uuid.UUID, List[Dict[str, Any]]] = {}
            for d in normalized:
                by_company.setdefault(d["company_id"], []).append(d)

            for cid, rows in by_company.items():
                rows = _dedupe_rows_for_company(rows)
                key_pairs: Set[Tuple[str, str]] = set()
                for d in rows:
                    sid = d.get("source_record_id")
                    src = d.get("source_system")
                    if sid and src:
                        key_pairs.add(_norm_key_pair(src, sid))

                existing: Dict[Tuple[str, str], GhgActivityData] = {}
                if key_pairs:
                    existing = self._load_existing_map(db, cid, key_pairs, key_lookup_chunk_size)

                for d in rows:
                    sid = d.get("source_record_id")
                    src = d.get("source_system")
                    if sid and src:
                        k = _norm_key_pair(src, sid)
                        ent = existing.get(k)
                        if ent is not None:
                            _apply_row_dict(ent, d)
                            ent.updated_at = now
                            updated += 1
                        else:
                            ent = GhgActivityData(company_id=cid)
                            _apply_row_dict(ent, d)
                            ent.updated_at = now
                            db.add(ent)
                            inserted += 1
                            existing[k] = ent
                    else:
                        ent = GhgActivityData(company_id=cid)
                        _apply_row_dict(ent, d)
                        ent.updated_at = now
                        db.add(ent)
                        inserted += 1

            db.commit()
            return {
                "status": "success",
                "inserted": inserted,
                "updated": updated,
                "errors": errors,
            }
        except Exception as e:
            logger.exception("ghg_activity_data upsert 실패")
            db.rollback()
            return {"status": "error", "message": str(e), "inserted": 0, "updated": 0, "errors": errors}
        finally:
            self._close_if_owned(db)

    def list_by_company_year(
        self,
        company_id: str | uuid.UUID,
        period_year: int,
        *,
        tab_type: Optional[str] = None,
    ) -> List[GhgActivityData]:
        db = self._sess()
        try:
            cid = uuid.UUID(str(company_id)) if not isinstance(company_id, uuid.UUID) else company_id
            q = db.query(GhgActivityData).filter(
                GhgActivityData.company_id == cid,
                GhgActivityData.period_year == period_year,
            )
            if tab_type:
                q = q.filter(GhgActivityData.tab_type == tab_type)
            rows = q.order_by(GhgActivityData.tab_type, GhgActivityData.id).all()
            if self._owns_session:
                for r in rows:
                    db.expunge(r)
            return rows
        finally:
            self._close_if_owned(db)

    def export_json_dicts(
        self,
        company_id: str | uuid.UUID,
        period_year: int,
        *,
        tab_type: Optional[str] = None,
        omit_nulls: bool = False,
    ) -> List[Dict[str, Any]]:
        from backend.domain.v1.esg_data.hub.services.ghg_activity_json import ghg_activity_row_to_json_dict

        rows = self.list_by_company_year(company_id, period_year, tab_type=tab_type)
        return [ghg_activity_row_to_json_dict(r, omit_nulls=omit_nulls) for r in rows]
