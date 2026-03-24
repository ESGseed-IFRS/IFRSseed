"""스테이징 수집 오케스트레이터 — SDS_ESG_DATA → 6개 스테이징 테이블"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from loguru import logger

from ..services.staging_ingestion_service import StagingIngestionService

DEFAULT_SYSTEMS = ["ems", "erp", "ehs", "plm", "srm", "hr"]


class StagingIngestionOrchestrator:
    """
    SDS_ESG_DATA 기준 경로와 company_id로 6개 시스템(EMS/ERP/EHS/PLM/SRM/HR) CSV를
    각 스테이징 테이블에 파싱·적재합니다.
    """

    def __init__(self, service: StagingIngestionService | None = None):
        self.service = service or StagingIngestionService()

    def execute(
        self,
        base_path: Path | str,
        company_id: str,
        systems: List[str] | None = None,
    ) -> Dict[str, Any]:
        """
        base_path(SDS_ESG_DATA 루트) 아래 각 시스템 폴더의 CSV를 파싱해 DB에 저장.

        Args:
            base_path: SDS_ESG_DATA 폴더 경로
            company_id: companies.id (UUID 문자열)
            systems: 처리할 시스템 목록. None이면 6개 전체.

        Returns:
            {
                "success": bool,
                "message": str,
                "results": { "ems": {"rows_imported": 1, ...}, ... },
                "total_rows_imported": int,
            }
        """
        base_path = Path(base_path)
        systems = systems or DEFAULT_SYSTEMS
        if not base_path.is_dir():
            return {
                "success": False,
                "message": f"Base path not found: {base_path}",
                "results": {},
                "total_rows_imported": 0,
            }

        logger.info(f"[StagingOrchestrator] 시작: base_path={base_path}, company_id={company_id}, systems={systems}")
        results = {}
        total_rows = 0
        for system in systems:
            if system not in DEFAULT_SYSTEMS:
                logger.warning(f"Skip unknown system: {system}")
                continue
            out = self.service.ingest_system(base_path, company_id, system)
            results[system] = out
            total_rows += out.get("rows_imported", 0)
            logger.debug(f"[StagingOrchestrator] {system}: rows_imported={out.get('rows_imported')}, files_processed={out.get('files_processed')}")

        success = all(r.get("success", False) for r in results.values())
        logger.info(f"[StagingOrchestrator] 완료: total_rows_imported={total_rows}, success={success}")
        return {
            "success": success,
            "message": f"Imported {total_rows} staging rows across {len(results)} systems",
            "results": results,
            "total_rows_imported": total_rows,
        }
