"""`external_company_data` 멱등 upsert — 키: (anchor_company_id, source_url)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from loguru import logger

try:
    from ifrs_agent.database.base import get_session
except ImportError:
    from backend.domain.v1.ifrs_agent.database.base import get_session

from sqlalchemy.orm import Session

from backend.domain.v1.data_integration.models.bases.external_company_data import ExternalCompanyData


class ExternalCompanyDataRepository:
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

    def upsert_by_anchor_and_url(
        self,
        anchor_company_id: str | uuid.UUID,
        source_url: str,
        fields: Dict[str, Any],
    ) -> Dict[str, Any]:
        db = self._sess()
        try:
            aid = (
                uuid.UUID(str(anchor_company_id))
                if not isinstance(anchor_company_id, uuid.UUID)
                else anchor_company_id
            )
            row = (
                db.query(ExternalCompanyData)
                .filter(
                    ExternalCompanyData.anchor_company_id == aid,
                    ExternalCompanyData.source_url == source_url,
                )
                .order_by(ExternalCompanyData.updated_at.desc())
                .first()
            )
            now = datetime.now(timezone.utc)
            if row is None:
                row = ExternalCompanyData(anchor_company_id=aid, source_url=source_url)
                db.add(row)
                mode: Literal["insert", "update"] = "insert"
            else:
                mode = "update"

            for key, val in fields.items():
                if key == "id":
                    continue
                if hasattr(row, key):
                    setattr(row, key, val)
            row.updated_at = now
            db.commit()
            db.refresh(row)
            return {"status": "success", "mode": mode, "id": str(row.id)}
        except Exception as e:
            logger.exception("external_company_data upsert 실패")
            db.rollback()
            return {"status": "error", "message": str(e), "mode": None}
        finally:
            self._close_if_owned(db)
