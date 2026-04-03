"""스테이징 raw_data 조회 저장소."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, Sequence

try:
    from ifrs_agent.database.base import get_session
except ImportError:
    from backend.domain.v1.ifrs_agent.database.base import get_session

from backend.domain.v1.ghg_calculation.models.bases import STAGING_MODEL_MAP


@dataclass
class StagingRawRowSnapshot:
    staging_system: str
    staging_id: uuid.UUID
    source_file_name: str | None
    ghg_raw_category: str | None
    raw_data: dict[str, Any]
    import_status: str | None


class StagingRawRepository:
    def __init__(self, db_session=None):
        self._session = db_session
        self._owns_session = db_session is None

    def _get_session(self):
        if self._session is not None:
            return self._session
        return get_session()

    def list_by_company_and_systems(
        self,
        company_id: uuid.UUID,
        systems: Sequence[str],
    ) -> list[StagingRawRowSnapshot]:
        session = self._get_session()
        out: list[StagingRawRowSnapshot] = []
        try:
            for sys in systems:
                model = STAGING_MODEL_MAP.get(sys)
                if model is None:
                    continue
                rows = (
                    session.query(model)
                    .filter(model.company_id == company_id)
                    .order_by(model.imported_at.desc())
                    .all()
                )
                for row in rows:
                    rd = row.raw_data if isinstance(row.raw_data, dict) else {}
                    out.append(
                        StagingRawRowSnapshot(
                            staging_system=sys,
                            staging_id=row.id,
                            source_file_name=row.source_file_name,
                            ghg_raw_category=getattr(row, "ghg_raw_category", None),
                            raw_data=rd,
                            import_status=row.import_status,
                        )
                    )
            return out
        finally:
            if self._owns_session and session is not None:
                session.close()
