"""
dp_rag용 테이블·컬럼 화이트리스트

LLM이 선택 가능한 (table, column, data_type) 조합만 정의
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict


class ColumnSpec(TypedDict):
    """화이트리스트 컬럼 명세."""

    column: str
    desc: str
    unit: str


# ===== Social Data (data_type별 그룹) =====

SOCIAL_DATA_COLUMNS: Dict[str, List[ColumnSpec]] = {
    "workforce": [
        {"column": "total_employees", "desc": "전체 임직원 수", "unit": "명"},
        {"column": "male_employees", "desc": "남성 임직원 수", "unit": "명"},
        {"column": "female_employees", "desc": "여성 임직원 수", "unit": "명"},
        {"column": "disabled_employees", "desc": "장애인 임직원 수", "unit": "명"},
        {"column": "average_age", "desc": "평균 연령", "unit": "세"},
        {"column": "turnover_rate", "desc": "이직률", "unit": "%"},
    ],
    "safety": [
        {"column": "total_incidents", "desc": "총 안전사고 건수", "unit": "건"},
        {"column": "fatal_incidents", "desc": "중대재해 건수", "unit": "건"},
        {"column": "lost_time_injury_rate", "desc": "손실시간 부상률 (LTIR)", "unit": "%"},
        {"column": "total_recordable_injury_rate", "desc": "총 기록 부상률 (TRIR)", "unit": "%"},
        {"column": "safety_training_hours", "desc": "안전보건 교육시간", "unit": "시간"},
    ],
    "supply_chain": [
        {"column": "total_suppliers", "desc": "전체 협력회사 수", "unit": "개사"},
        {"column": "supplier_purchase_amount", "desc": "협력회사 구매액", "unit": "원"},
        {"column": "esg_evaluated_suppliers", "desc": "ESG 평가 협력회사 수", "unit": "개사"},
    ],
    "community": [
        {"column": "social_contribution_cost", "desc": "사회공헌 비용", "unit": "원"},
        {"column": "volunteer_hours", "desc": "봉사활동 시간", "unit": "시간"},
    ],
}

# ===== Environmental Data =====

ENVIRONMENTAL_DATA_COLUMNS: List[ColumnSpec] = [
    # GHG
    {"column": "scope1_total_tco2e", "desc": "Scope 1 GHG 배출량", "unit": "tCO2e"},
    {"column": "scope2_location_tco2e", "desc": "Scope 2 GHG (Location-based)", "unit": "tCO2e"},
    {"column": "scope2_market_tco2e", "desc": "Scope 2 GHG (Market-based)", "unit": "tCO2e"},
    {"column": "scope3_total_tco2e", "desc": "Scope 3 GHG 배출량", "unit": "tCO2e"},
    # Energy
    {"column": "total_energy_consumption_mwh", "desc": "총 에너지 소비량", "unit": "MWh"},
    {"column": "renewable_energy_mwh", "desc": "재생에너지 사용량", "unit": "MWh"},
    {"column": "renewable_energy_ratio", "desc": "재생에너지 비율", "unit": "%"},
    # Waste
    {"column": "total_waste_generated", "desc": "폐기물 발생량", "unit": "톤"},
    {"column": "waste_recycled", "desc": "재활용 폐기물", "unit": "톤"},
    {"column": "waste_incinerated", "desc": "소각 폐기물", "unit": "톤"},
    {"column": "waste_landfilled", "desc": "매립 폐기물", "unit": "톤"},
    {"column": "hazardous_waste", "desc": "유해 폐기물", "unit": "톤"},
    # Water
    {"column": "water_withdrawal", "desc": "용수 취수량", "unit": "㎥"},
    {"column": "water_consumption", "desc": "용수 소비량", "unit": "㎥"},
    {"column": "water_discharge", "desc": "용수 배출량", "unit": "㎥"},
    {"column": "water_recycling", "desc": "용수 재활용량", "unit": "㎥"},
    # Air
    {"column": "nox_emission", "desc": "NOx 배출량", "unit": "톤"},
    {"column": "sox_emission", "desc": "SOx 배출량", "unit": "톤"},
    {"column": "voc_emission", "desc": "VOC 배출량", "unit": "톤"},
    {"column": "dust_emission", "desc": "먼지 배출량", "unit": "톤"},
]

# ===== Governance Data (data_type별 그룹) =====

GOVERNANCE_DATA_COLUMNS: Dict[str, List[ColumnSpec]] = {
    "board": [
        {"column": "board_chairman_name", "desc": "이사회 의장 성명", "unit": ""},
        {"column": "ceo_name", "desc": "대표이사(경영진) 성명", "unit": ""},
        {"column": "independent_board_members", "desc": "사외이사 수", "unit": "명"},
        {"column": "audit_committee_chairman", "desc": "감사위원회 위원장 성명", "unit": ""},
        {"column": "esg_committee_chairman", "desc": "ESG위원회 위원장 성명", "unit": ""},
        {"column": "total_board_members", "desc": "이사회 구성원 수", "unit": "명"},
        {"column": "female_board_members", "desc": "여성 이사 수", "unit": "명"},
        {"column": "board_meetings", "desc": "이사회 개최 횟수", "unit": "회"},
        {"column": "board_attendance_rate", "desc": "이사회 참석률", "unit": "%"},
        {"column": "board_compensation", "desc": "이사 보수 총액", "unit": "원"},
    ],
    "compliance": [
        {"column": "corruption_cases", "desc": "부패 사건 건수", "unit": "건"},
        {"column": "corruption_reports", "desc": "부패 신고 건수", "unit": "건"},
        {"column": "legal_sanctions", "desc": "법적 제재 건수", "unit": "건"},
    ],
    "ethics": [
        {"column": "corruption_cases", "desc": "윤리 위반 건수", "unit": "건"},
        {"column": "corruption_reports", "desc": "윤리 신고 건수", "unit": "건"},
    ],
    "risk": [
        {"column": "security_incidents", "desc": "정보보안 사고 건수", "unit": "건"},
        {"column": "data_breaches", "desc": "데이터 유출 건수", "unit": "건"},
        {"column": "security_fines", "desc": "보안 관련 과징금", "unit": "원"},
    ],
}


def get_allowlist_for_category(category: str) -> List[Dict[str, Any]]:
    """
    column_category (E/S/G)에 맞는 후보만 반환.
    
    Returns:
        List of {table, column, data_type?, desc, unit}
    """
    result = []
    
    if category == "E":
        for col_spec in ENVIRONMENTAL_DATA_COLUMNS:
            result.append({
                "table": "environmental_data",
                "column": col_spec["column"],
                "data_type": None,
                "desc": col_spec["desc"],
                "unit": col_spec["unit"],
            })
    
    elif category == "S":
        for data_type, cols in SOCIAL_DATA_COLUMNS.items():
            for col_spec in cols:
                result.append({
                    "table": "social_data",
                    "column": col_spec["column"],
                    "data_type": data_type,
                    "desc": col_spec["desc"],
                    "unit": col_spec["unit"],
                })
    
    elif category == "G":
        for data_type, cols in GOVERNANCE_DATA_COLUMNS.items():
            for col_spec in cols:
                result.append({
                    "table": "governance_data",
                    "column": col_spec["column"],
                    "data_type": data_type,
                    "desc": col_spec["desc"],
                    "unit": col_spec["unit"],
                })
    
    return result


def resolve_esg_category(
    dp_meta: Optional[Dict[str, Any]],
    ucm_info: Optional[Dict[str, Any]],
) -> Optional[str]:
    """
    E/S/G allowlist 필터용 카테고리.
    UCM column_category 우선, 없으면 data_points.category.
    """
    if ucm_info:
        cat = ucm_info.get("column_category")
        if cat in ("E", "S", "G"):
            return cat
    if dp_meta:
        c = dp_meta.get("category")
        if c in ("E", "S", "G"):
            return c
    return None


def validate_selection(table: str, column: str, data_type: str | None) -> bool:
    """
    LLM이 선택한 (table, column, data_type) 조합이 화이트리스트에 있는지 검증.
    """
    if table == "environmental_data":
        return any(c["column"] == column for c in ENVIRONMENTAL_DATA_COLUMNS)
    
    elif table == "social_data":
        if data_type not in SOCIAL_DATA_COLUMNS:
            return False
        return any(c["column"] == column for c in SOCIAL_DATA_COLUMNS[data_type])
    
    elif table == "governance_data":
        if data_type not in GOVERNANCE_DATA_COLUMNS:
            return False
        return any(c["column"] == column for c in GOVERNANCE_DATA_COLUMNS[data_type])
    
    return False
