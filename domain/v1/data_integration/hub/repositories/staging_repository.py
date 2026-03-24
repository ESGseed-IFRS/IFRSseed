"""스테이징 테이블 6개 저장/조회"""
from __future__ import annotations

import uuid
from typing import Any, Dict, List, Literal, Optional

from loguru import logger

try:
    from ifrs_agent.database.base import get_session
except ImportError:
    from backend.domain.v1.ifrs_agent.database.base import get_session

from backend.domain.v1.data_integration.models.bases import STAGING_MODEL_MAP

StagingSystem = Literal["ems", "erp", "ehs", "plm", "srm", "hr"]


class StagingRepository:
    """staging_*_data 6개 테이블 공통 저장"""

    def __init__(self, db_session=None):
        self._session = db_session
        self._owns_session = db_session is None

    def _get_session(self):
        if self._session is not None:
            return self._session
        return get_session()

    def save(
        self,
        system: StagingSystem,
        company_id: str | uuid.UUID,
        raw_data: Dict[str, Any],
        source_file_name: Optional[str] = None,
        import_status: str = "completed",
        error_message: Optional[str] = None,
    ) -> Optional[uuid.UUID]:
        """
        해당 시스템 스테이징 테이블에 1건 저장.
        raw_data는 {"items": [...], "source_file": "..."} 형태 권장 (문서 ETL과 호환).
        """
        if system not in STAGING_MODEL_MAP:
            logger.error(f"[StagingRepo] Unknown staging system: {system}")
            return None
        session = self._get_session()
        try:
            if isinstance(company_id, str):
                company_id = uuid.UUID(company_id)
            model_class = STAGING_MODEL_MAP[system]
            num_items = len(raw_data.get("items", [])) if isinstance(raw_data, dict) else 0
            logger.debug(f"[StagingRepo] save: system={system}, company_id={company_id}, file={source_file_name}, items={num_items}")
            entity = model_class(
                company_id=company_id,
                source_file_name=source_file_name,
                raw_data=raw_data,
                import_status=import_status,
                error_message=error_message,
            )
            session.add(entity)
            session.commit()
            session.refresh(entity)
            logger.info(f"[StagingRepo] staging_{system}_data 저장: id={entity.id}, file={source_file_name}")
            return entity.id
        except Exception as e:
            session.rollback()
            logger.error(f"[StagingRepo] staging_{system}_data 저장 실패: {e}")
            logger.exception("스테이징 저장 예외 상세")
            return None
        finally:
            if self._owns_session and session is not None:
                session.close()

    def save_batch(
        self,
        system: StagingSystem,
        company_id: str | uuid.UUID,
        rows: List[Dict[str, Any]],
        source_file_names: Optional[List[str]] = None,
    ) -> int:
        """
        같은 시스템에 여러 건 저장 (파일 1개당 1 row).
        rows: [{"items": [...], "source_file": "a.csv"}, ...] 또는 [{"items": [...]}, ...]
        source_file_names: 각 row에 대응하는 파일명 (선택)
        Returns: 성공 건수
        """
        count = 0
        for i, raw_data in enumerate(rows):
            name = (source_file_names[i] if source_file_names and i < len(source_file_names) else None) or (
                raw_data.get("source_file") if isinstance(raw_data, dict) else None
            )
            if self.save(system, company_id, raw_data, source_file_name=name) is not None:
                count += 1
        return count
