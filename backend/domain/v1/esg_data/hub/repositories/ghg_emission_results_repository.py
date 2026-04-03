"""`ghg_emission_results` 조회."""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.orm import Session

from backend.core.db import get_session
from backend.domain.v1.esg_data.models.bases.ghg_emission_results import GhgEmissionResults


class GhgEmissionResultsRepository:
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

    def get_annual(
        self,
        company_id: str | uuid.UUID,
        period_year: int,
        *,
        calculation_basis: str = "location",
    ) -> Optional[GhgEmissionResults]:
        db = self._sess()
        try:
            cid = uuid.UUID(str(company_id)) if not isinstance(company_id, uuid.UUID) else company_id
            basis = (calculation_basis or "location").strip().lower()
            row = (
                db.query(GhgEmissionResults)
                .filter(
                    GhgEmissionResults.company_id == cid,
                    GhgEmissionResults.period_year == period_year,
                    GhgEmissionResults.period_month.is_(None),
                    GhgEmissionResults.calculation_basis == basis,
                )
                .order_by(GhgEmissionResults.updated_at.desc())
                .first()
            )
            if row is not None and self._owns_session:
                db.expunge(row)
            return row
        finally:
            self._close_if_owned(db)
