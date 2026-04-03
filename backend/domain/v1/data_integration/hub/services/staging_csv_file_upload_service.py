"""브라우저 CSV 업로드 → source_system 값에 따라 staging_*_data 적재."""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from loguru import logger

from backend.domain.v1.ghg_calculation.hub.orchestrator.ghg_anomaly_orchestrator import (
    GhgAnomalyOrchestrator,
)

from ..repositories.staging_repository import StagingRepository
from .staging_ingestion_service import _detect_ghg_raw_category, parse_csv_bytes_to_items

INGEST_SOURCE_FILE_UPLOAD = "file_upload"

_ghg_anomaly_orch = GhgAnomalyOrchestrator()

SOURCE_SYSTEM_TO_STAGING: dict[str, str] = {
    "EMS": "ems",
    "ERP": "erp",
    "EHS": "ehs",
    "PLM": "plm",
    "SRM": "srm",
    "HR": "hr",
    "MDG": "mdg",
}

ALLOWED_GHG_RAW_CATEGORY = frozenset(
    {"energy", "waste", "pollution", "chemical", "energy-provider", "consignment"}
)


def _source_system_cell(row: dict[str, Any]) -> str:
    for k, v in row.items():
        kn = str(k).strip().lower().replace(" ", "_")
        if kn == "source_system":
            if v is None:
                return ""
            return str(v).strip()
    return ""


def _ghg_raw_category_cell(row: dict[str, Any]) -> str | None:
    for k, v in row.items():
        kn = str(k).strip().lower().replace(" ", "_")
        if kn == "ghg_raw_category":
            if v is None or str(v).strip() == "":
                return None
            return str(v).strip()
    return None


def _header_has_ghg_raw_category_column(items: list[dict[str, Any]]) -> bool:
    if not items:
        return False
    for k in items[0].keys():
        if str(k).strip().lower().replace(" ", "_") == "ghg_raw_category":
            return True
    return False


def _resolve_ghg_raw_category_from_csv_items(items: list[dict[str, Any]]) -> tuple[str | None, str | None]:
    """
    모든 데이터 행의 ghg_raw_category 열이 동일·비어 있지 않은지 확인.
    Returns (category, error_message). error_message가 있으면 category는 None.
    """
    distinct: set[str] = set()
    for idx, row in enumerate(items, start=2):
        cell = _ghg_raw_category_cell(row)
        if cell is None:
            return None, (
                f"행 {idx}: ghg_raw_category 값이 없습니다. "
                "양식의 ghg_raw_category 열을 모든 데이터 행에 채워 주세요."
            )
        if cell not in ALLOWED_GHG_RAW_CATEGORY:
            return None, (
                f'행 {idx}: 허용되지 않는 ghg_raw_category "{cell}". '
                "energy, waste, pollution, chemical, energy-provider, consignment 중 하나여야 합니다."
            )
        distinct.add(cell)
    if len(distinct) > 1:
        return None, (
            "파일 안의 ghg_raw_category 값이 서로 다릅니다: "
            f"{', '.join(sorted(distinct))}. 하나의 카테고리만 업로드해 주세요."
        )
    if not distinct:
        return None, "ghg_raw_category를 CSV에서 판단할 수 없습니다."
    return next(iter(distinct)), None


class StagingCsvFileUploadService:
    def __init__(self, repository: StagingRepository | None = None):
        self._repo = repository or StagingRepository()

    def ingest_uploaded_csv(
        self,
        content: bytes,
        filename: str,
        company_id: str,
    ) -> dict[str, Any]:
        items = parse_csv_bytes_to_items(content)
        if not items:
            return {
                "success": False,
                "message": "CSV를 읽을 수 없거나 데이터 행이 없습니다.",
                "inserts": [],
                "ghg_raw_category": None,
                "sync_validation": [],
            }

        if _header_has_ghg_raw_category_column(items):
            ghg_from_csv, ghg_err = _resolve_ghg_raw_category_from_csv_items(items)
            if ghg_err:
                return {
                    "success": False,
                    "message": ghg_err,
                    "inserts": [],
                    "ghg_raw_category": None,
                    "sync_validation": [],
                }
        else:
            ghg_from_csv = _detect_ghg_raw_category(filename, items)
            if not ghg_from_csv or ghg_from_csv not in ALLOWED_GHG_RAW_CATEGORY:
                return {
                    "success": False,
                    "message": (
                        "ghg_raw_category를 CSV에서 정할 수 없습니다. "
                        "다운로드한 양식 파일명을 유지하거나, 헤더가 Raw 유형을 알 수 있게 구성하거나, "
                        "선택적으로 ghg_raw_category 열을 추가하세요."
                    ),
                    "inserts": [],
                    "ghg_raw_category": None,
                    "sync_validation": [],
                }

        errors: list[str] = []
        for idx, row in enumerate(items, start=2):
            raw = _source_system_cell(row)
            if not raw:
                errors.append(f"행 {idx}: source_system 값이 없습니다.")
                continue
            if raw.upper() not in SOURCE_SYSTEM_TO_STAGING:
                errors.append(
                    f'행 {idx}: 지원하지 않는 source_system "{raw}" (EMS, ERP, EHS, PLM, SRM, HR, MDG).'
                )

        if errors:
            msg = "; ".join(errors[:5])
            if len(errors) > 5:
                msg += " …"
            return {
                "success": False,
                "message": msg,
                "inserts": [],
                "ghg_raw_category": None,
                "sync_validation": [],
            }

        by_system: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in items:
            raw = _source_system_cell(row)
            sys_key = SOURCE_SYSTEM_TO_STAGING[raw.upper()]
            by_system[sys_key].append(row)

        inserts: list[dict[str, Any]] = []
        sync_validation: list[dict[str, Any]] = []
        for sys_key in sorted(by_system.keys()):
            group = by_system[sys_key]
            raw_data: dict[str, Any] = {"items": group, "source_file": filename}
            pk = self._repo.save(
                system=sys_key,  # type: ignore[arg-type]
                company_id=company_id,
                raw_data=raw_data,
                ghg_raw_category=ghg_from_csv,
                source_file_name=filename,
                import_status="completed",
                ingest_source=INGEST_SOURCE_FILE_UPLOAD,
            )
            if pk is None:
                logger.error(f"[StagingCsvUpload] save failed system={sys_key} file={filename}")
                return {
                    "success": False,
                    "message": f"staging_{sys_key}_data 저장에 실패했습니다.",
                    "inserts": inserts,
                    "ghg_raw_category": ghg_from_csv,
                    "sync_validation": sync_validation,
                }
            findings = _ghg_anomaly_orch.validate_upload_items(
                group,
                ghg_from_csv,
                staging_system=sys_key,
                staging_id=str(pk),
            )
            sync_validation.append(
                {
                    "system": sys_key,
                    "staging_id": str(pk),
                    "findings": [f.model_dump() for f in findings],
                }
            )
            inserts.append({"system": sys_key, "staging_id": str(pk), "item_count": len(group)})

        total = sum(i["item_count"] for i in inserts)
        ts_summary: dict[str, Any] | None = None
        ts_res = _ghg_anomaly_orch.persist_default_timeseries_scan(company_id)
        if ts_res is not None:
            ts_summary = {
                "findings_count": len(ts_res.timeseries_findings),
                "series_evaluated": ts_res.series_evaluated,
            }
        return {
            "success": True,
            "message": (
                f"총 {total}행을 시스템별 스테이징 {len(inserts)}건으로 저장했습니다. "
                f"(ghg_raw_category={ghg_from_csv}, 파일 업로드)"
            ),
            "inserts": inserts,
            "ghg_raw_category": ghg_from_csv,
            "sync_validation": sync_validation,
            "timeseries_scan": ts_summary,
        }
