"""
결정적 DP 매핑 테이블

자주 사용되는 DP에 대한 확정된 물리 위치 매핑 (LLM 호출 불필요)
GRI, ESRS, IFRS 표준 DP들의 명확한 매핑

컬럼명은 allowlist.py의 실제 DB 스키마에 맞춰 작성됨:
- environmental_data: scope1_total_tco2e, scope2_location_tco2e, scope3_total_tco2e
- social_data: total_employees, female_employees, etc. (data_type 필수)
- governance_data: board_chairman_name, total_board_members, etc. (data_type 필수)
"""
from typing import Dict, Optional

# 결정적 매핑: DP ID → 물리 위치
DETERMINISTIC_DP_MAPPINGS: Dict[str, Dict[str, any]] = {
    # GRI 305 (온실가스 배출)
    "GRI305-1-a": {
        "table": "environmental_data",
        "column": "scope1_total_tco2e",
        "data_type": None,
        "confidence": 1.0,
    },
    "GRI305-2-a": {
        "table": "environmental_data",
        "column": "scope2_location_tco2e",
        "data_type": None,
        "confidence": 1.0,
    },
    "GRI305-3-a": {
        "table": "environmental_data",
        "column": "scope3_total_tco2e",
        "data_type": None,
        "confidence": 1.0,
    },
    "GRI305-3-d": {
        "table": "environmental_data",
        "column": "scope3_total_tco2e",
        "data_type": None,
        "confidence": 1.0,
    },
    
    # ESRS E1 (기후변화)
    "ESRSE1-E1-6-44-a": {
        "table": "environmental_data",
        "column": "scope1_total_tco2e",
        "data_type": None,
        "confidence": 1.0,
    },
    "ESRSE1-E1-6-44-b": {
        "table": "environmental_data",
        "column": "scope2_location_tco2e",
        "data_type": None,
        "confidence": 1.0,
    },
    "ESRSE1-E1-6-44-c": {
        "table": "environmental_data",
        "column": "scope3_total_tco2e",
        "data_type": None,
        "confidence": 1.0,
    },
    
    # ESRS2 (일반 공시)
    "ESRS2-MDR-A-68-a": {
        "table": "governance_data",
        "column": "total_board_members",
        "data_type": "board",
        "confidence": 1.0,
    },
    "ESRS2-BP-2-10-b": {
        "table": "governance_data",
        "column": "board_chairman_name",
        "data_type": "board",
        "confidence": 1.0,
    },
    
    # IFRS S2 (기후 관련 공시)
    "IFRS2-29-a-i-1": {
        "table": "environmental_data",
        "column": "scope1_total_tco2e",
        "data_type": None,
        "confidence": 1.0,
    },
    "IFRS2-29-a-i-2": {
        "table": "environmental_data",
        "column": "scope2_location_tco2e",
        "data_type": None,
        "confidence": 1.0,
    },
    "IFRS2-29-a-i-3": {
        "table": "environmental_data",
        "column": "scope3_total_tco2e",
        "data_type": None,
        "confidence": 1.0,
    },
    "IFRS2-29-a-vi-1": {
        "table": "environmental_data",
        "column": "scope3_total_tco2e",
        "data_type": None,
        "confidence": 1.0,
    },
    "IFRS2-29-a-iii-1": {
        "table": "environmental_data",
        "column": "scope1_total_tco2e",  # 총 배출량은 scope1+2+3이지만 일단 scope1로
        "data_type": None,
        "confidence": 0.9,
    },
    
    # 추가 환경 지표
    "GRI302-1-a": {
        "table": "environmental_data",
        "column": "total_energy_consumption_mwh",
        "data_type": None,
        "confidence": 1.0,
    },
    "GRI302-1-e": {
        "table": "environmental_data",
        "column": "renewable_energy_ratio",
        "data_type": None,
        "confidence": 1.0,
    },
    "GRI303-3-a": {
        "table": "environmental_data",
        "column": "water_withdrawal",
        "data_type": None,
        "confidence": 1.0,
    },
    "GRI303-4-a": {
        "table": "environmental_data",
        "column": "water_discharge",
        "data_type": None,
        "confidence": 1.0,
    },
    "GRI303-5-a": {
        "table": "environmental_data",
        "column": "water_consumption",
        "data_type": None,
        "confidence": 1.0,
    },
    "GRI306-3-a": {
        "table": "environmental_data",
        "column": "total_waste_generated",
        "data_type": None,
        "confidence": 1.0,
    },
    "GRI306-4-a": {
        "table": "environmental_data",
        "column": "waste_recycled",
        "data_type": None,
        "confidence": 1.0,
    },
    "GRI306-5-a": {
        "table": "environmental_data",
        "column": "waste_landfilled",
        "data_type": None,
        "confidence": 1.0,
    },
    
    # 사회 지표 (임직원)
    "GRI2-7-a": {
        "table": "social_data",
        "column": "total_employees",
        "data_type": "workforce",
        "confidence": 1.0,
    },
    "GRI2-7-b": {
        "table": "social_data",
        "column": "total_employees",  # permanent은 별도 컬럼 없으므로 total로
        "data_type": "workforce",
        "confidence": 0.9,
    },
    "GRI405-1-a": {
        "table": "social_data",
        "column": "female_employees",
        "data_type": "workforce",
        "confidence": 1.0,
    },
    "GRI405-1-b": {
        "table": "social_data",
        "column": "female_employees",  # female_ratio는 allowlist에 없음
        "data_type": "workforce",
        "confidence": 0.9,
    },
    
    # 사회 지표 (안전보건)
    "GRI403-9-a": {
        "table": "social_data",
        "column": "total_incidents",
        "data_type": "safety",
        "confidence": 1.0,
    },
    "GRI403-9-b": {
        "table": "social_data",
        "column": "lost_time_injury_rate",
        "data_type": "safety",
        "confidence": 1.0,
    },
    
    # 거버넌스 지표
    "GRI2-9-a": {
        "table": "governance_data",
        "column": "board_chairman_name",
        "data_type": "board",
        "confidence": 1.0,
    },
    "GRI2-10-a": {
        "table": "governance_data",
        "column": "total_board_members",
        "data_type": "board",
        "confidence": 1.0,
    },
    "GRI2-10-b": {
        "table": "governance_data",
        "column": "independent_board_members",
        "data_type": "board",
        "confidence": 1.0,
    },
    "GRI405-1-d": {
        "table": "governance_data",
        "column": "female_board_members",
        "data_type": "board",
        "confidence": 1.0,
    },
}


def get_deterministic_mapping(dp_id: str) -> Optional[Dict[str, any]]:
    """
    결정적 매핑 조회 (LLM 없이 즉시 반환)
    
    Args:
        dp_id: DP ID (예: "GRI305-1-a")
    
    Returns:
        {"table", "column", "data_type", "confidence"} 또는 None
    """
    return DETERMINISTIC_DP_MAPPINGS.get(dp_id)


def has_deterministic_mapping(dp_id: str) -> bool:
    """
    결정적 매핑 존재 여부 확인
    
    Args:
        dp_id: DP ID
    
    Returns:
        bool: 매핑이 존재하면 True
    """
    return dp_id in DETERMINISTIC_DP_MAPPINGS


def get_all_deterministic_dp_ids() -> list[str]:
    """
    결정적 매핑이 있는 모든 DP ID 목록 반환
    
    Returns:
        list[str]: DP ID 목록
    """
    return list(DETERMINISTIC_DP_MAPPINGS.keys())
