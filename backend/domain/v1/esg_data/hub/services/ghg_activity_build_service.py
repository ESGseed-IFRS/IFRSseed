"""staging_* (EMS/ERP/EHS/PLM/SRM/HR) → `ghg_activity_data` 적재."""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional, Sequence

from loguru import logger

from backend.domain.v1.data_integration.hub.repositories.staging_repository import StagingRepository
from backend.domain.v1.esg_data.hub.repositories.ghg_activity_repository import GhgActivityRepository
from backend.domain.v1.esg_data.hub.services.ghg_staging_extract import map_staging_items_for_year

_DEFAULT_SYSTEMS: Sequence[str] = ("ems", "erp", "ehs", "plm", "srm", "hr")


class GhgActivityBuildService:
    """`StagingRepository`로 스테이징을 읽고 `ghg_activity_data`에 멱등 upsert."""

    def __init__(
        self,
        staging_repository: Optional[StagingRepository] = None,
        ghg_repository: Optional[GhgActivityRepository] = None,
    ) -> None:
        self._staging = staging_repository or StagingRepository()
        self._ghg = ghg_repository or GhgActivityRepository()

    def build_from_staging(
        self,
        company_id: str | uuid.UUID,
        period_year: int,
        *,
        systems: Optional[Sequence[str]] = None,
        include_mdg: bool = False,
        include_if_year_missing: bool = True,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        cid = uuid.UUID(str(company_id)) if not isinstance(company_id, uuid.UUID) else company_id
        sys_list = list(systems) if systems is not None else list(_DEFAULT_SYSTEMS)
        if include_mdg and "mdg" not in sys_list:
            sys_list.append("mdg")

        all_rows: List[Dict[str, Any]] = []
        per_system: Dict[str, Any] = {}

        for sys_key in sys_list:
            key = sys_key.strip().lower()
            if key == "mdg" and not include_mdg:
                continue
            try:
                staging_rows = self._staging.list_by_company(key, cid)
            except Exception as e:
                logger.warning("staging list 실패 system={} company_id={} err={}", key, cid, e)
                per_system[key] = {"error": str(e), "mapped": 0}
                continue

            mapped = map_staging_items_for_year(
                key,
                staging_rows,
                period_year,
                include_if_year_missing=include_if_year_missing,
            )
            per_system[key] = {"staging_rows": len(staging_rows), "mapped": len(mapped)}
            all_rows.extend(mapped)

        if dry_run:
            return {
                "status": "success",
                "company_id": str(cid),
                "period_year": period_year,
                "dry_run": True,
                "total_mapped": len(all_rows),
                "per_system": per_system,
                "sample": all_rows[:20],
            }

        res = self._ghg.upsert_from_dicts(all_rows)
        out = {
            "status": res.get("status", "error"),
            "company_id": str(cid),
            "period_year": period_year,
            "inserted": res.get("inserted", 0),
            "updated": res.get("updated", 0),
            "per_system": per_system,
            "message": res.get("message"),
            "errors": res.get("errors"),
        }
        logger.info(
            "ghg_activity build_from_staging company_id={} year={} inserted={} updated={}",
            cid,
            period_year,
            out.get("inserted"),
            out.get("updated"),
        )
        return out
