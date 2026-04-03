"""SocialDataBuildService 스테이징 모킹 테스트."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import uuid

from backend.domain.v1.esg_data.hub.services.social_data_build_service import SocialDataBuildService


def _row(raw_data: dict) -> SimpleNamespace:
    return SimpleNamespace(raw_data=raw_data)


def test_build_from_staging_dry_run_aggregates():
    company_id = uuid.uuid4()
    staging = MagicMock()
    staging.list_by_company.side_effect = lambda system, cid: {
        "hr": [
            _row(
                {
                    "items": [
                        {"period_year": 2024, "total_employees": 200, "total_incidents": 2},
                    ],
                    "source_file": "hr.csv",
                }
            )
        ],
        "srm": [
            _row(
                {
                    "items": [{"period_year": 2024, "supplier_count": 12, "purchase_amount": 1_000_000}],
                    "source_file": "srm.csv",
                }
            )
        ],
        "ehs": [_row({"items": [{"period_year": 2024, "fatal_incidents": 0}], "source_file": "ehs.csv"})],
        "erp": [
            _row(
                {
                    "items": [
                        {"year": 2024, "investment_krw": 500000, "volunteer_hours": 3},
                    ],
                    "source_file": "ERP_COMMUNITY_INVEST.csv",
                }
            )
        ],
    }.get(system, [])

    social = MagicMock()
    svc = SocialDataBuildService(staging_repository=staging, social_repository=social)

    out = svc.build_from_staging(company_id, 2024, dry_run=True)

    assert out["status"] == "success"
    assert out["period_year"] == 2024
    social.upsert.assert_not_called()

    by_type = {r["data_type"]: r for r in out["results"]}
    assert "workforce" in by_type and by_type["workforce"].get("metrics", {}).get("total_employees") == 200
    assert "supply_chain" in by_type
    assert by_type["supply_chain"].get("metrics", {}).get("total_suppliers") == 12
    assert "community" in by_type
    cm = by_type["community"].get("metrics", {})
    assert cm.get("social_contribution_cost") is not None
    assert float(cm["social_contribution_cost"]) == 500000
    assert float(cm.get("volunteer_hours") or 0) == 3
