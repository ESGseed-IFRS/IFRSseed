"""스테이징(HR/SRM/EHS/ERP) → social_data 집계·저장."""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Mapping, Optional

from loguru import logger

from backend.domain.v1.data_integration.hub.repositories.staging_repository import StagingRepository
from backend.domain.v1.esg_data.hub.repositories.social_data_repository import SocialDataRepository
from backend.domain.v1.esg_data.hub.services.social_staging_extract import (
    aggregate_community,
    aggregate_safety,
    aggregate_supply_chain,
    aggregate_workforce,
    filter_items_for_period,
)


def _collect_items_for_year(
    staging_rows: List[Any],
    period_year: int,
    *,
    include_if_year_missing: bool,
) -> List[Mapping[str, Any]]:
    acc: List[Mapping[str, Any]] = []
    for row in staging_rows:
        rd = getattr(row, "raw_data", None) or {}
        if not isinstance(rd, dict):
            continue
        items = rd.get("items") or []
        if not isinstance(items, list):
            continue
        acc.extend(
            filter_items_for_period(
                items,
                period_year,
                include_if_year_missing=include_if_year_missing,
            )
        )
    return acc


def _has_any_metric(d: Dict[str, Any]) -> bool:
    return any(v is not None for v in d.values())


class SocialDataBuildService:
    """staging_* → social_data upsert."""

    def __init__(
        self,
        staging_repository: Optional[StagingRepository] = None,
        social_repository: Optional[SocialDataRepository] = None,
    ) -> None:
        self._staging = staging_repository or StagingRepository()
        self._social = social_repository or SocialDataRepository()

    def build_from_staging(
        self,
        company_id: str | uuid.UUID,
        period_year: int,
        *,
        include_if_year_missing: bool = True,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """
        HR / SRM / EHS / ERP 스테이징에서 해당 연도 행을 모아 data_type별 social_data를 upsert.

        - workforce: HR
        - safety: HR + EHS (동일 필드 키가 있으면 합산·평균 규칙은 aggregate_*에 따름)
        - supply_chain: SRM
        - community: HR + ERP(예: ERP_COMMUNITY_INVEST → investment_krw, volunteer_hours)
        """
        cid = uuid.UUID(str(company_id)) if not isinstance(company_id, uuid.UUID) else company_id

        hr_rows = self._staging.list_by_company("hr", cid)
        srm_rows = self._staging.list_by_company("srm", cid)
        ehs_rows = self._staging.list_by_company("ehs", cid)
        erp_rows = self._staging.list_by_company("erp", cid)

        hr_items = _collect_items_for_year(hr_rows, period_year, include_if_year_missing=include_if_year_missing)
        srm_items = _collect_items_for_year(srm_rows, period_year, include_if_year_missing=include_if_year_missing)
        ehs_items = _collect_items_for_year(ehs_rows, period_year, include_if_year_missing=include_if_year_missing)
        erp_items = _collect_items_for_year(erp_rows, period_year, include_if_year_missing=include_if_year_missing)

        bundles: Dict[str, Dict[str, Any]] = {
            "workforce": aggregate_workforce(hr_items),
            "safety": aggregate_safety(hr_items + ehs_items),
            "supply_chain": aggregate_supply_chain(srm_items),
            "community": aggregate_community(hr_items + erp_items),
        }

        results: List[Dict[str, Any]] = []
        for data_type, metrics in bundles.items():
            if not _has_any_metric(metrics):
                results.append({"data_type": data_type, "skipped": True, "reason": "no_matching_metrics"})
                continue
            if dry_run:
                results.append({"data_type": data_type, "skipped": False, "dry_run": True, "metrics": metrics})
                continue
            res = self._social.upsert(
                cid,
                data_type,
                period_year,
                metrics,
                status="draft",
            )
            results.append({"data_type": data_type, **res})

        logger.info(
            "social_data build_from_staging company_id={} year={} dry_run={} hr_rows={} srm_rows={} ehs_rows={} erp_rows={}",
            cid,
            period_year,
            dry_run,
            len(hr_rows),
            len(srm_rows),
            len(ehs_rows),
            len(erp_rows),
        )

        return {
            "status": "success",
            "company_id": str(cid),
            "period_year": period_year,
            "results": results,
        }
