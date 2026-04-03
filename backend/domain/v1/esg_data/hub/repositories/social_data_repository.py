"""social_data 영속화 — 자연키 (company_id, data_type, period_year) upsert."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from loguru import logger
from sqlalchemy.orm import Session

from backend.core.db import get_session
from backend.domain.v1.esg_data.models.bases.social_data import SocialData

_METRIC_KEYS = (
    "total_employees",
    "male_employees",
    "female_employees",
    "disabled_employees",
    "average_age",
    "turnover_rate",
    "total_incidents",
    "fatal_incidents",
    "lost_time_injury_rate",
    "total_recordable_injury_rate",
    "safety_training_hours",
    "total_suppliers",
    "supplier_purchase_amount",
    "esg_evaluated_suppliers",
    "social_contribution_cost",
    "volunteer_hours",
)


class SocialDataRepository:
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

    def list_by_company_year(
        self,
        company_id: str | uuid.UUID,
        period_year: int,
    ) -> List[SocialData]:
        db = self._sess()
        try:
            cid = uuid.UUID(str(company_id)) if not isinstance(company_id, uuid.UUID) else company_id
            rows = (
                db.query(SocialData)
                .filter(SocialData.company_id == cid, SocialData.period_year == period_year)
                .all()
            )
            if self._owns_session:
                for r in rows:
                    db.expunge(r)
            return rows
        finally:
            self._close_if_owned(db)

    def upsert(
        self,
        company_id: str | uuid.UUID,
        data_type: str,
        period_year: int,
        metrics: Dict[str, Any],
        *,
        status: str = "draft",
    ) -> Dict[str, Any]:
        """metrics: METRIC_KEYS 부분집합. 값이 None이면 해당 컬럼을 NULL로 설정."""
        db = self._sess()
        try:
            cid = uuid.UUID(str(company_id)) if not isinstance(company_id, uuid.UUID) else company_id
            row = (
                db.query(SocialData)
                .filter(
                    SocialData.company_id == cid,
                    SocialData.data_type == data_type,
                    SocialData.period_year == period_year,
                )
                .first()
            )
            now = datetime.now(timezone.utc)
            if row is None:
                row = SocialData(
                    company_id=cid,
                    data_type=data_type,
                    period_year=period_year,
                    status=status,
                )
                db.add(row)
                mode = "create"
            else:
                mode = "update"
            for key in _METRIC_KEYS:
                if key in metrics:
                    setattr(row, key, metrics[key])
            row.status = status
            row.updated_at = now
            db.commit()
            db.refresh(row)
            return {"status": "success", "mode": mode, "id": str(row.id), "data_type": data_type}
        except Exception as e:
            logger.exception("social_data upsert 실패")
            db.rollback()
            return {"status": "error", "message": str(e), "data_type": data_type}
        finally:
            self._close_if_owned(db)
