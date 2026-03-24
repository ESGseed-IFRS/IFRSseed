"""SDS_ESG_DATA CSV → 스테이징 테이블 적재 서비스 (CSV 파싱 포함)"""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Dict, List

from loguru import logger

from ..repositories.staging_repository import StagingRepository


def _parse_csv_to_items(csv_path: Path, encoding: str | None = None) -> List[Dict[str, Any]]:
    """
    CSV 파일을 읽어 헤더를 키로 하는 dict 리스트로 반환.
    encoding이 None이면 utf-8, 실패 시 cp949 시도.
    """
    encodings = [encoding] if encoding else ["utf-8", "cp949", "utf-8-sig"]
    for enc in encodings:
        try:
            with open(csv_path, "r", encoding=enc, newline="") as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                logger.debug(f"[CSV] parsed {csv_path.name}: encoding={enc}, rows={len(rows)}")
                return rows
        except UnicodeDecodeError:
            logger.debug(f"[CSV] UnicodeDecodeError with {enc} for {csv_path.name}, try next")
            continue
        except Exception as e:
            logger.warning(f"[CSV] read failed {csv_path}: {e}")
            return []
    logger.warning(f"[CSV] encoding failed for {csv_path}")
    return []


def _csv_file_to_raw_data(csv_path: Path, encoding: str | None = None) -> Dict[str, Any]:
    """
    CSV 1파일 → 스테이징 raw_data 형식.
    {"items": [...], "source_file": "파일명"} (문서 ETL raw_data->'items' 호환)
    """
    items = _parse_csv_to_items(csv_path, encoding=encoding)
    return {
        "items": items,
        "source_file": csv_path.name,
    }


SYSTEM_FOLDER_MAP = {
    "ems": "EMS",
    "erp": "ERP",
    "ehs": "EHS",
    "plm": "PLM",
    "srm": "SRM",
    "hr": "HR",
}


class StagingIngestionService:
    """한 시스템 폴더 내 CSV들을 파싱해 해당 스테이징 테이블에 저장"""

    def __init__(self, repository: StagingRepository | None = None):
        self.repo = repository or StagingRepository()

    def ingest_system(
        self,
        base_path: Path | str,
        company_id: str,
        system: str,
    ) -> Dict[str, Any]:
        """
        base_path 아래 {system} 폴더(예: EMS, ERP)의 모든 CSV를 파싱해 staging_{system}_data에 저장.
        Returns: {"success": bool, "system": str, "rows_imported": int, "files_processed": int, "error": str | None}
        """
        base_path = Path(base_path)
        folder_name = SYSTEM_FOLDER_MAP.get(system)
        if not folder_name:
            return {"success": False, "system": system, "rows_imported": 0, "files_processed": 0, "error": f"Unknown system: {system}"}
        system_dir = base_path / folder_name
        if not system_dir.is_dir():
            return {"success": False, "system": system, "rows_imported": 0, "files_processed": 0, "error": f"Directory not found: {system_dir}"}

        csv_files = sorted(system_dir.glob("*.csv"))
        if not csv_files:
            logger.warning(f"[Staging] No CSV files in {system_dir}")
            return {"success": True, "system": system, "rows_imported": 0, "files_processed": 0, "error": None}

        logger.info(f"[Staging] ingest_system: system={system}, base_path={base_path}, company_id={company_id}, files={len(csv_files)}")
        rows_imported = 0
        for csv_path in csv_files:
            try:
                raw_data = _csv_file_to_raw_data(csv_path)
                num_items = len(raw_data.get("items") or [])
                if not raw_data.get("items"):
                    logger.warning(f"[Staging] Empty or unreadable CSV (items=0): {csv_path}")
                    continue
                logger.debug(f"[Staging] saving {csv_path.name} -> staging_{system}_data, items={num_items}")
                pk = self.repo.save(
                    system=system,
                    company_id=company_id,
                    raw_data=raw_data,
                    source_file_name=csv_path.name,
                    import_status="completed",
                )
                if pk is not None:
                    rows_imported += 1
                    logger.debug(f"[Staging] saved id={pk} for {csv_path.name}")
                else:
                    logger.warning(f"[Staging] repo.save returned None for {csv_path.name} (DB insert failed)")
            except Exception as e:
                logger.error(f"[Staging] Ingest failed {csv_path}: {e}", exc_info=True)
                self.repo.save(
                    system=system,
                    company_id=company_id,
                    raw_data={"items": [], "source_file": csv_path.name},
                    source_file_name=csv_path.name,
                    import_status="failed",
                    error_message=str(e),
                )

        logger.info(f"[Staging] ingest_system done: system={system}, rows_imported={rows_imported}, files_processed={len(csv_files)}")
        return {
            "success": True,
            "system": system,
            "rows_imported": rows_imported,
            "files_processed": len(csv_files),
            "error": None,
        }
