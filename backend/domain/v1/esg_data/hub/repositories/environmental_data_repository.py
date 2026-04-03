"""`environmental_data` 연간 행(period_month NULL) upsert."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from loguru import logger
from sqlalchemy.orm import Session

from backend.core.db import get_session
from backend.domain.v1.esg_data.models.bases.environmental_data import EnvironmentalData

_UPDATABLE_KEYS = (
    "scope1_total_tco2e",
    "scope2_location_tco2e",
    "scope2_market_tco2e",
    "scope3_total_tco2e",
    "total_energy_consumption_mwh",
    "renewable_energy_mwh",
    "renewable_energy_ratio",
    "total_waste_generated",
    "waste_recycled",
    "waste_incinerated",
    "waste_landfilled",
    "hazardous_waste",
    "water_withdrawal",
    "water_consumption",
    "water_discharge",
    "water_recycling",
    "nox_emission",
    "sox_emission",
    "voc_emission",
    "dust_emission",
    "iso14001_certified",
    "iso14001_cert_date",
    "carbon_neutral_certified",
    "carbon_neutral_cert_date",
    "ghg_data_source",
    "ghg_calculation_version",
    "status",
)


class EnvironmentalDataRepository:
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

    def upsert_annual(
        self,
        company_id: str | uuid.UUID,
        period_year: int,
        fields: Dict[str, Any],
        *,
        status: str = "draft",
    ) -> Dict[str, Any]:
        """`period_month` NULL 연간 행. 동일 키가 여러 개면 `updated_at` 최신 1건을 갱신."""
        db = self._sess()
        try:
            cid = uuid.UUID(str(company_id)) if not isinstance(company_id, uuid.UUID) else company_id
            row = (
                db.query(EnvironmentalData)
                .filter(
                    EnvironmentalData.company_id == cid,
                    EnvironmentalData.period_year == period_year,
                    EnvironmentalData.period_month.is_(None),
                )
                .order_by(EnvironmentalData.updated_at.desc())
                .first()
            )
            now = datetime.now(timezone.utc)
            if row is None:
                row = EnvironmentalData(
                    company_id=cid,
                    period_year=period_year,
                    period_month=None,
                    status=status,
                )
                db.add(row)
                mode = "create"
            else:
                mode = "update"

            for key in _UPDATABLE_KEYS:
                if key in fields:
                    setattr(row, key, fields[key])
            if "status" not in fields:
                row.status = status
            row.updated_at = now
            db.commit()
            db.refresh(row)
            return {"status": "success", "mode": mode, "id": str(row.id)}
        except Exception as e:
            logger.exception("environmental_data upsert 실패")
            db.rollback()
            return {"status": "error", "message": str(e), "mode": None}
        finally:
            self._close_if_owned(db)
