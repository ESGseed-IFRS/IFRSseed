"""social_staging_extract 순수 함수 테스트."""

from __future__ import annotations

from decimal import Decimal

from backend.domain.v1.esg_data.hub.services.social_staging_extract import (
    aggregate_community,
    aggregate_safety,
    aggregate_supply_chain,
    aggregate_workforce,
    filter_items_for_period,
)


def test_filter_items_for_period_strict_year():
    items = [
        {"period_year": 2024, "headcount": 10},
        {"year": 2023, "headcount": 5},
        {"headcount": 99},
    ]
    got = filter_items_for_period(items, 2024, include_if_year_missing=False)
    assert len(got) == 1
    assert got[0]["headcount"] == 10


def test_filter_items_for_period_includes_missing_year():
    items = [{"headcount": 7}]
    got = filter_items_for_period(items, 2024, include_if_year_missing=True)
    assert len(got) == 1


def test_aggregate_workforce_sums():
    items = [
        {"total_employees": 100, "male_employees": 60, "female_employees": 40},
        {"headcount": 50, "male_count": 30, "female_count": 20},
    ]
    m = aggregate_workforce(items)
    assert m["total_employees"] == 150
    assert m["male_employees"] == 90
    assert m["female_employees"] == 60


def test_aggregate_supply_chain():
    items = [
        {"supplier_count": 10, "purchase_amount": 1000},
        {"total_suppliers": 5, "spend_amount": 500},
    ]
    m = aggregate_supply_chain(items)
    assert m["total_suppliers"] == 15
    assert m["supplier_purchase_amount"] is not None
    assert float(m["supplier_purchase_amount"]) == 1500


def test_aggregate_workforce_sds_diversity_whole_only():
    """HR_DIVERSITY_DETAIL: 전체임직원(국내+해외)만 합산 — 관리자 행은 제외."""
    items = [
        {
            "year": 2024,
            "diversity_category": "관리자",
            "total_count": 8450,
            "male_count": 6220,
            "female_count": 2230,
        },
        {
            "year": 2024,
            "diversity_category": "전체임직원",
            "sub_category": "국내",
            "total_count": 20150,
            "male_count": 14407,
            "female_count": 5743,
        },
        {
            "year": 2024,
            "diversity_category": "전체임직원",
            "sub_category": "해외",
            "total_count": 6251,
            "male_count": 3500,
            "female_count": 2751,
        },
    ]
    m = aggregate_workforce(items)
    assert m["total_employees"] == 20150 + 6251
    assert m["male_employees"] == 14407 + 3500
    assert m["female_employees"] == 5743 + 2751


def test_aggregate_workforce_headcount_latest_quarter_korean_gender():
    """HR_EMPLOYEE_HEADCOUNT: 동일 연도 최대 분기만 합산, 한글 gender 반영."""
    items = [
        {"year": 2024, "quarter": 1, "headcount": 100, "gender": "남성"},
        {"year": 2024, "quarter": 1, "headcount": 50, "gender": "여성"},
        {"year": 2024, "quarter": 4, "headcount": 120, "gender": "남성"},
        {"year": 2024, "quarter": 4, "headcount": 60, "gender": "여성"},
    ]
    m = aggregate_workforce(items)
    assert m["total_employees"] == 180
    assert m["male_employees"] == 120
    assert m["female_employees"] == 60


def test_aggregate_supply_chain_purchase_amount_m_sds():
    """SRM_SUPPLIER_PURCHASE: purchase_amount_m(백만원) → 원화 환산 합산."""
    items = [
        {"year": 2024, "quarter": 4, "supplier_count": 10, "purchase_amount_m": 1.5},
        {"year": 2024, "quarter": 4, "supplier_count": 5, "purchase_amount_m": 2},
    ]
    m = aggregate_supply_chain(items)
    assert m["total_suppliers"] == 15
    assert float(m["supplier_purchase_amount"]) == 3_500_000


def test_aggregate_workforce_diversity_age_buckets_and_turnover():
    """전체임직원 연령대 가중 평균 + HR_EMPLOYEE_MOVEMENT 이직률 가중 평균."""
    items = [
        {
            "year": 2024,
            "diversity_category": "전체임직원",
            "sub_category": "국내",
            "total_count": 20150,
            "age_u30": 2418,
            "age_30s": 7657,
            "age_40s": 6448,
            "age_50plus": 3627,
        },
        {
            "year": 2024,
            "diversity_category": "전체임직원",
            "sub_category": "해외",
            "total_count": 6251,
            "age_u30": 1875,
            "age_30s": 2625,
            "age_40s": 1563,
            "age_50plus": 188,
        },
        {
            "year": 2024,
            "quarter": 4,
            "turnover_rate_pct": 1.5,
            "headcount_base": 1000,
        },
        {
            "year": 2024,
            "quarter": 4,
            "turnover_rate_pct": 2.5,
            "headcount_base": 3000,
        },
    ]
    m = aggregate_workforce(items)
    assert m["average_age"] is not None
    assert abs(float(m["average_age"]) - 39.30) < 0.05
    # (1.5*1000 + 2.5*3000) / 4000 = 2.25
    assert m["turnover_rate"] == Decimal("2.25")


def test_aggregate_safety_ehs_and_hr_training_hours():
    items = [
        {"year": 2024, "quarter": 4, "site_code": "SITE-A", "total_hours": 1000},
        {"year": 2024, "quarter": 4, "training_category": "안전보건", "total_training_hours": 500},
        {"year": 2024, "quarter": 4, "recordable_injury_count": 0, "trir": 0},
    ]
    m = aggregate_safety(items)
    assert m["safety_training_hours"] is not None
    assert float(m["safety_training_hours"]) == 1500


def test_aggregate_community_erp_investment_krw():
    items = [
        {"year": 2024, "investment_krw": 1_000_000, "volunteer_hours": 10},
        {"year": 2024, "volunteer_hours": 5},
    ]
    m = aggregate_community(items)
    assert float(m["social_contribution_cost"]) == 1_000_000
    assert float(m["volunteer_hours"]) == 15
