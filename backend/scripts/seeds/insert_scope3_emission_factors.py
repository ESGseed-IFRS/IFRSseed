"""
Scope 3 배출계수를 DB에 삽입하는 스크립트
GHG_배출계수_마스터_v2.xlsx의 Scope3_카테고리별 시트 데이터를 emission_factors 테이블에 추가
"""
import sys
import os
from pathlib import Path
from uuid import uuid4

# 프로젝트 루트를 PYTHONPATH에 추가
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))
os.chdir(str(project_root))

from sqlalchemy import text
from backend.core.db import get_session

# Scope 3 배출계수 데이터 (SCOPE3_EMISSION_FACTORS.csv 기반)
SCOPE3_EMISSION_FACTORS = [
    # Cat.1 구매한 제품·서비스
    {
        "category": "Scope3_Cat1",
        "name": "구매한 제품·서비스 (지출기반)",
        "factor": 0.42,
        "unit": "tCO₂eq/백만원",
        "source_unit": "백만원",
        "fuel_type": "purchased_goods_spend",
        "reference": "환경부 LCI DB (제조업 평균)",
        "notes": "공급사 실측값 최우선. 지출기반계수는 오차 큼(±50%)"
    },
    {
        "category": "Scope3_Cat1",
        "name": "구매한 제품·서비스 (철강)",
        "factor": 2.1,
        "unit": "tCO₂eq/톤",
        "source_unit": "톤",
        "fuel_type": "purchased_goods_steel",
        "reference": "worldsteel / ecoinvent",
        "notes": "철강 종류(HR·CR·STS)별 계수 상이. 실측 우선"
    },
    {
        "category": "Scope3_Cat1",
        "name": "구매한 제품·서비스 (플라스틱)",
        "factor": 3.5,
        "unit": "tCO₂eq/톤",
        "source_unit": "톤",
        "fuel_type": "purchased_goods_plastic",
        "reference": "PlasticsEurope / ecoinvent",
        "notes": "수지 종류(PE·PP·PET 등)별 계수 상이"
    },
    
    # Cat.2 자본재
    {
        "category": "Scope3_Cat2",
        "name": "자본재 (설비·건물)",
        "factor": 0.38,
        "unit": "tCO₂eq/백만원",
        "source_unit": "백만원",
        "fuel_type": "capital_goods",
        "reference": "EXIOBASE (기계장비 산업)",
        "notes": "설비 취득액 회계 데이터 활용. 내용연수 배분 여부 확인"
    },
    
    # Cat.3 연료·에너지 관련
    {
        "category": "Scope3_Cat3",
        "name": "연료·에너지 관련 (WTT - LNG)",
        "factor": 6.6,
        "unit": "tCO₂eq/TJ",
        "source_unit": "TJ",
        "fuel_type": "fuel_energy_wtt_lng",
        "reference": "IEA Upstream EF / DEFRA",
        "notes": "Well-to-Tank 배출. Scope1 연소 배출과 합산하여 WTW 산출"
    },
    {
        "category": "Scope3_Cat3",
        "name": "연료·에너지 관련 (WTT - 경유)",
        "factor": 13.4,
        "unit": "tCO₂eq/TJ",
        "source_unit": "TJ",
        "fuel_type": "fuel_energy_wtt_diesel",
        "reference": "IEA Upstream EF",
        "notes": "Well-to-Tank 배출"
    },
    {
        "category": "Scope3_Cat3",
        "name": "연료·에너지 관련 (T&D Loss - 전력)",
        "factor": 0.0275,
        "unit": "tCO₂eq/MWh",
        "source_unit": "MWh",
        "fuel_type": "fuel_energy_td_elec",
        "reference": "한국전력 송배전 손실률 약 3.5%",
        "notes": "Scope2 전력계수의 약 6~8% 수준"
    },
    
    # Cat.4 업스트림 운송
    {
        "category": "Scope3_Cat4",
        "name": "업스트림 운송 (5톤 트럭)",
        "factor": 0.196,
        "unit": "kgCO₂eq/톤·km",
        "source_unit": "톤·km",
        "fuel_type": "transport_truck_5t",
        "reference": "환경부 수송 배출계수 고시",
        "notes": "운송사 물류 데이터 필요. 거리는 도로거리(직선×1.3 보정)"
    },
    {
        "category": "Scope3_Cat4",
        "name": "업스트림 운송 (15톤 트럭)",
        "factor": 0.12,
        "unit": "kgCO₂eq/톤·km",
        "source_unit": "톤·km",
        "fuel_type": "transport_truck_15t",
        "reference": "환경부 수송 배출계수 고시",
        "notes": ""
    },
    {
        "category": "Scope3_Cat4",
        "name": "업스트림 운송 (철도)",
        "factor": 0.028,
        "unit": "kgCO₂eq/톤·km",
        "source_unit": "톤·km",
        "fuel_type": "transport_rail",
        "reference": "환경부 수송 배출계수 고시",
        "notes": "전기철도 기준. 디젤 철도는 상이"
    },
    {
        "category": "Scope3_Cat4",
        "name": "업스트림 운송 (해상 - 벌크선)",
        "factor": 0.0079,
        "unit": "kgCO₂eq/톤·km",
        "source_unit": "톤·km",
        "fuel_type": "transport_ship_bulk",
        "reference": "IMO / DEFRA",
        "notes": "컨테이너선 0.016, 탱커 0.006 등 선종별 상이"
    },
    {
        "category": "Scope3_Cat4",
        "name": "업스트림 운송 (항공 - 국제)",
        "factor": 0.602,
        "unit": "kgCO₂eq/톤·km",
        "source_unit": "톤·km",
        "fuel_type": "transport_air_intl",
        "reference": "ICAO / DEFRA",
        "notes": "항공 RF 미포함값. 포함 시 ×2 가정"
    },
    
    # Cat.5 폐기물
    {
        "category": "Scope3_Cat5",
        "name": "사업장 폐기물 (매립)",
        "factor": 0.46,
        "unit": "tCO₂eq/톤",
        "source_unit": "톤",
        "fuel_type": "waste_landfill",
        "reference": "IPCC 폐기물 계수",
        "notes": "폐기물 처리 방법별 분리 필수"
    },
    {
        "category": "Scope3_Cat5",
        "name": "사업장 폐기물 (소각)",
        "factor": 0.92,
        "unit": "tCO₂eq/톤",
        "source_unit": "톤",
        "fuel_type": "waste_incineration",
        "reference": "IPCC 폐기물 계수",
        "notes": "소각 방법(열회수 여부)에 따라 상이"
    },
    {
        "category": "Scope3_Cat5",
        "name": "사업장 폐기물 (재활용)",
        "factor": 0.01,
        "unit": "tCO₂eq/톤",
        "source_unit": "톤",
        "fuel_type": "waste_recycling",
        "reference": "IPCC / ecoinvent",
        "notes": "재활용 전 운반·처리 에너지만 산정"
    },
    
    # Cat.6 출장
    {
        "category": "Scope3_Cat6",
        "name": "출장 (국내선 항공)",
        "factor": 0.255,
        "unit": "kgCO₂eq/인·km",
        "source_unit": "인·km",
        "fuel_type": "business_travel_air_domestic",
        "reference": "DEFRA 2024 출장 계수",
        "notes": "HR 출장비 정산 데이터와 연계. 좌석 등급별 계수 상이"
    },
    {
        "category": "Scope3_Cat6",
        "name": "출장 (국제선 항공 - 이코노미)",
        "factor": 0.195,
        "unit": "kgCO₂eq/인·km",
        "source_unit": "인·km",
        "fuel_type": "business_travel_air_intl_economy",
        "reference": "DEFRA 2024",
        "notes": "비즈니스 ×3, 퍼스트 ×4 가중치"
    },
    {
        "category": "Scope3_Cat6",
        "name": "출장 (KTX·철도)",
        "factor": 0.041,
        "unit": "kgCO₂eq/인·km",
        "source_unit": "인·km",
        "fuel_type": "business_travel_rail",
        "reference": "환경부 수송 배출계수",
        "notes": ""
    },
    
    # Cat.7 통근
    {
        "category": "Scope3_Cat7",
        "name": "임직원 통근 (자가용 - 가솔린)",
        "factor": 0.17,
        "unit": "kgCO₂eq/인·km",
        "source_unit": "인·km",
        "fuel_type": "commuting_car_gasoline",
        "reference": "DEFRA 2024",
        "notes": "통근 실태조사 필요. 재택근무 비율 차감"
    },
    {
        "category": "Scope3_Cat7",
        "name": "임직원 통근 (대중교통 - 버스)",
        "factor": 0.089,
        "unit": "kgCO₂eq/인·km",
        "source_unit": "인·km",
        "fuel_type": "commuting_bus",
        "reference": "환경부 수송 배출계수",
        "notes": ""
    },
    
    # Cat.15 투자 (금융업)
    {
        "category": "Scope3_Cat15",
        "name": "투자 (금융업) - 기업대출",
        "factor": 0.0,  # 개별 산정 필요
        "unit": "tCO₂eq/억원",
        "source_unit": "억원",
        "fuel_type": "investment_loan",
        "reference": "PCAF Standard + 피투자기업 공시",
        "notes": "PCAF Attribution Factor 적용. 피투자기업 배출량 공시 필요. 개별 산정 필요"
    },
]

def insert_scope3_factors():
    """Scope 3 배출계수를 DB에 삽입"""
    session = get_session()
    
    try:
        print("[INFO] Inserting Scope 3 emission factors...")
        
        # 기존 Scope 3 배출계수 삭제 (재실행 대비)
        result = session.execute(
            text("DELETE FROM emission_factors WHERE applicable_scope = 'Scope3'")
        )
        print(f"[INFO] Deleted {result.rowcount} existing Scope 3 emission factors")
        
        inserted_count = 0
        for factor_data in SCOPE3_EMISSION_FACTORS:
            factor_id = str(uuid4())
            
            # factor_code 생성 (예: KR_2024_SCOPE3_CAT1_PURCHASED_GOODS_SPEND)
            fuel_type_upper = factor_data["fuel_type"].upper()
            factor_code = f"KR_2024_{fuel_type_upper}"
            
            session.execute(
                text("""
                    INSERT INTO emission_factors (
                        id, factor_code, factor_name_ko, factor_name_en,
                        emission_factor, unit, applicable_scope, applicable_category,
                        reference_year, reference_source, reference_url,
                        effective_from, effective_to, is_active,
                        composite_factor, composite_factor_unit,
                        gwp_basis, ch4_gwp, n2o_gwp,
                        source_unit, fuel_type, version, notes,
                        created_at, updated_at
                    ) VALUES (
                        :id, :factor_code, :factor_name_ko, :factor_name_en,
                        :emission_factor, :unit, :applicable_scope, :applicable_category,
                        :reference_year, :reference_source, :reference_url,
                        :effective_from, :effective_to, :is_active,
                        :composite_factor, :composite_factor_unit,
                        :gwp_basis, :ch4_gwp, :n2o_gwp,
                        :source_unit, :fuel_type, :version, :notes,
                        NOW(), NOW()
                    )
                """),
                {
                    "id": factor_id,
                    "factor_code": factor_code,
                    "factor_name_ko": factor_data["name"],
                    "factor_name_en": factor_data["name"],  # 영문명은 추후 추가 가능
                    "emission_factor": factor_data["factor"],
                    "unit": factor_data["unit"],
                    "applicable_scope": "Scope3",
                    "applicable_category": factor_data["category"],
                    "reference_year": 2024,
                    "reference_source": factor_data["reference"],
                    "reference_url": None,
                    "effective_from": "2024-01-01",
                    "effective_to": None,
                    "is_active": True,
                    "composite_factor": factor_data["factor"],
                    "composite_factor_unit": factor_data["unit"],
                    "gwp_basis": "AR5",
                    "ch4_gwp": 28.00,
                    "n2o_gwp": 265.00,
                    "source_unit": factor_data["source_unit"],
                    "fuel_type": factor_data["fuel_type"],
                    "version": "v2.0",
                    "notes": factor_data["notes"],
                }
            )
            inserted_count += 1
        
        session.commit()
        print(f"[OK] Successfully inserted {inserted_count} Scope 3 emission factors")
        
        # 삽입된 데이터 확인
        result = session.execute(
            text("""
                SELECT applicable_category, COUNT(*) as count
                FROM emission_factors
                WHERE applicable_scope = 'Scope3'
                GROUP BY applicable_category
                ORDER BY applicable_category
            """)
        ).fetchall()
        
        print("\n[INFO] Scope 3 emission factors by category:")
        for row in result:
            print(f"  - {row[0]}: {row[1]} factors")
        
        return True
        
    except Exception as e:
        session.rollback()
        print(f"[ERROR] Failed to insert Scope 3 emission factors: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        session.close()

if __name__ == "__main__":
    success = insert_scope3_factors()
    sys.exit(0 if success else 1)
