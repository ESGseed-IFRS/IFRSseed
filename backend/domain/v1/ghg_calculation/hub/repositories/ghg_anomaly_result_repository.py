"""회사별 최신 GHG 시계열 이상치 스캔 결과 저장."""
from __future__ import annotations

import json
import uuid
from typing import Any

from loguru import logger
from sqlalchemy import text

from backend.core.db import get_session


class GhgAnomalyResultRepository:
    def upsert_latest(self, company_id: str | uuid.UUID, payload: dict[str, Any]) -> None:
        if isinstance(company_id, str):
            company_id = uuid.UUID(company_id)
        session = get_session()
        try:
            session.execute(
                text(
                    """
                    INSERT INTO ghg_anomaly_scan_results (company_id, payload, updated_at)
                    VALUES (:company_id, CAST(:payload AS jsonb), NOW())
                    ON CONFLICT (company_id) DO UPDATE SET
                      payload = EXCLUDED.payload,
                      updated_at = EXCLUDED.updated_at
                    """
                ),
                {
                    "company_id": str(company_id),
                    "payload": json.dumps(payload),
                },
            )
            session.commit()
        except Exception:
            session.rollback()
            logger.exception("[GhgAnomalyResultRepo] upsert_latest failed company_id={}", company_id)
            raise
        finally:
            session.close()

    def get_latest_payload(self, company_id: str | uuid.UUID) -> dict[str, Any] | None:
        if isinstance(company_id, str):
            company_id = uuid.UUID(company_id)
        session = get_session()
        try:
            row = session.execute(
                text(
                    "SELECT payload FROM ghg_anomaly_scan_results WHERE company_id = :cid"
                ),
                {"cid": str(company_id)},
            ).scalar_one_or_none()
            if row is None:
                return None
            if isinstance(row, dict):
                return row
            if isinstance(row, str):
                return json.loads(row)
            if isinstance(row, (bytes, bytearray)):
                return json.loads(row.decode("utf-8"))
            logger.warning("[GhgAnomalyResultRepo] unexpected payload type={}", type(row))
            return None
        finally:
            session.close()
