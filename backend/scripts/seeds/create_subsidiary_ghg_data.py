"""삼성SDS 실제 사업장 및 자회사 기반 GHG 더미 데이터 생성

참고:
- SDS_ESG_DATA/README.md
- MDG_SITE_MASTER.csv (사업장 정보)
- GHG_SCOPE12_SUMMARY.csv (2024 Scope1: 184,807 / Scope2: 179,480 tCO2e)
- GHG_SCOPE3_DETAIL.csv (2024 총 2,992,478 tCO2e)
"""

import csv
import uuid
from pathlib import Path
from datetime import datetime

# 지주사: 삼성SDS 주식회사 (9개 사업장)
# 실제 배출량: Scope1 184,807 / Scope2 179,480 / Scope3 2,992,478 tCO2e

# 자회사 5개 (100% 지분)
SUBSIDIARIES_100 = [
    {
        "id": "SUB-001",
        "name": "오픈핸즈 주식회사",
        "type": "subsidiary",
        "business": "모바일 솔루션",
        "employees": 85,
        "scope1": 45,
        "scope2": 850,
        "scope3": 3200,
        "sites": [{"code": "SITE-OH01", "name": "오픈핸즈 본사", "type": "오피스"}]
    },
    {
        "id": "SUB-002",
        "name": "엠로 주식회사",
        "type": "subsidiary",
        "business": "물류 IT 솔루션",
        "employees": 120,
        "scope1": 180,
        "scope2": 1250,
        "scope3": 4800,
        "sites": [{"code": "SITE-ML01", "name": "엠로 본사", "type": "오피스"}]
    },
    {
        "id": "SUB-003",
        "name": "멀티캠퍼스 주식회사",
        "type": "subsidiary",
        "business": "IT 교육",
        "employees": 320,
        "scope1": 420,
        "scope2": 3850,
        "scope3": 8900,
        "sites": [
            {"code": "SITE-MC01", "name": "멀티캠퍼스 역삼", "type": "교육센터"},
            {"code": "SITE-MC02", "name": "멀티캠퍼스 선릉", "type": "교육센터"}
        ]
    },
    {
        "id": "SUB-004",
        "name": "에스코어 주식회사",
        "type": "subsidiary",
        "business": "클라우드 MSP",
        "employees": 450,
        "scope1": 320,
        "scope2": 4200,
        "scope3": 12500,
        "sites": [{"code": "SITE-SC01", "name": "에스코어 판교", "type": "오피스"}]
    },
    {
        "id": "SUB-005",
        "name": "시큐아이 주식회사",
        "type": "subsidiary",
        "business": "정보보안",
        "employees": 180,
        "scope1": 95,
        "scope2": 1680,
        "scope3": 5200,
        "sites": [{"code": "SITE-SI01", "name": "시큐아이 서울", "type": "오피스"}]
    }
]

# 자회사 (부분 지분)
SUBSIDIARIES_PARTIAL = [
    {
        "id": "SUB-006",
        "name": "미라콤아이앤씨 주식회사",
        "type": "affiliate",
        "business": "네트워크 통합",
        "equity_ratio": 51.0,
        "employees": 280,
        "scope1": 220,
        "scope2": 2850,
        "scope3": 9100,
        "sites": [{"code": "SITE-MI01", "name": "미라콤 서울", "type": "오피스"}]
    }
]

ALL_SUBSIDIARIES = SUBSIDIARIES_100 + SUBSIDIARIES_PARTIAL

# 지주사 삼성SDS (9개 사업장)
HOLDING_COMPANY = {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "삼성에스디에스 주식회사",
    "type": "holding",
    "scope1": 184807,  # 실제 값
    "scope2": 179480,  # 실제 값 (시장기반)
    "scope3": 2992478,  # 실제 값
    "sites": [
        {"code": "SITE-DC01", "name": "수원 데이터센터", "type": "DC", "capacity_kw": 20000, "pue": 1.18},
        {"code": "SITE-DC02", "name": "동탄 데이터센터", "type": "DC", "capacity_kw": 18000, "pue": 1.15},
        {"code": "SITE-DC03", "name": "상암 데이터센터", "type": "DC", "capacity_kw": 12000, "pue": 1.22},
        {"code": "SITE-DC04", "name": "춘천 데이터센터", "type": "DC", "capacity_kw": 15000, "pue": 1.16},
        {"code": "SITE-DC05", "name": "구미 데이터센터", "type": "DC", "capacity_kw": 10000, "pue": 1.20},
        {"code": "SITE-CA01", "name": "서울 R&D 캠퍼스", "type": "R&D", "capacity_kw": 0, "pue": 0},
        {"code": "SITE-CA02", "name": "판교 IT캠퍼스", "type": "캠퍼스", "capacity_kw": 0, "pue": 0},
        {"code": "SITE-CA03", "name": "판교 물류캠퍼스", "type": "캠퍼스", "capacity_kw": 0, "pue": 0},
        {"code": "SITE-OF01", "name": "잠실 본사", "type": "오피스", "capacity_kw": 0, "pue": 0}
    ]
}


def generate_holding_company_data(base_dir: Path):
    """지주사(삼성SDS) 데이터 생성"""
    company_dir = base_dir / "holding_삼성에스디에스"
    company_dir.mkdir(parents=True, exist_ok=True)
    
    ems_dir = company_dir / "EMS"
    ems_dir.mkdir(exist_ok=True)
    
    # 1. EMS_ENERGY_USAGE.csv
    energy_file = ems_dir / "EMS_ENERGY_USAGE.csv"
    with open(energy_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'site_code', 'site_name', 'company_id', 'company_name',
            'year', 'month', 'energy_type', 'consumption_kwh',
            'emission_factor', 'emission_tco2e'
        ])
        
        # 사업장별 에너지 비중 (DC가 주요 배출원)
        site_weights = {
            'SITE-DC01': 0.30,  # 수원 (최대 규모)
            'SITE-DC02': 0.25,  # 동탄
            'SITE-DC03': 0.15,  # 상암
            'SITE-DC04': 0.18,  # 춘천
            'SITE-DC05': 0.08,  # 구미
            'SITE-CA01': 0.01,  # R&D 캠퍼스
            'SITE-CA02': 0.01,
            'SITE-CA03': 0.01,
            'SITE-OF01': 0.01
        }
        
        # 연간 전력 소비량 (Scope 2의 역산)
        # 179,480 tCO2e / 0.4157 kgCO2/kWh = 431,708,000 kWh
        total_annual_kwh = 431708000
        
        for site in HOLDING_COMPANY['sites']:
            site_code = site['code']
            site_name = site['name']
            weight = site_weights.get(site_code, 0.01)
            site_annual_kwh = total_annual_kwh * weight
            
            for month in range(1, 13):
                # 월별 변동 (여름철 냉방 부하 반영)
                month_factor = 1.2 if month in [7, 8] else (0.9 if month in [3, 4, 10, 11] else 1.0)
                monthly_kwh = site_annual_kwh / 12 * month_factor
                emission = monthly_kwh * 0.4157 / 1000  # tCO2e
                
                writer.writerow([
                    site_code, site_name,
                    HOLDING_COMPANY['id'], HOLDING_COMPANY['name'],
                    2024, month, '전력', monthly_kwh,
                    0.4157, round(emission, 2)
                ])
    
    # 2. GHG_SCOPE12_SUMMARY.csv
    scope12_file = ems_dir / "GHG_SCOPE12_SUMMARY.csv"
    with open(scope12_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'company_id', 'company_name', 'year', 'scope', 'basis',
            'co2_tco2e', 'ch4_tco2e', 'n2o_tco2e', 'total_tco2e',
            'intensity_tco2e_per_bil_krw', 'verification_status'
        ])
        
        # Scope 1 (실제 값)
        writer.writerow([
            HOLDING_COMPANY['id'], HOLDING_COMPANY['name'],
            2024, 'scope1', 'location_based',
            HOLDING_COMPANY['scope1'], 0, 0, HOLDING_COMPANY['scope1'],
            round(HOLDING_COMPANY['scope1'] / 13828.232, 4),  # 매출액 기준
            '제3자 검증 완료 (DNV)'
        ])
        
        # Scope 2 Market-based (실제 값)
        writer.writerow([
            HOLDING_COMPANY['id'], HOLDING_COMPANY['name'],
            2024, 'scope2', 'market_based',
            HOLDING_COMPANY['scope2'], 0, 0, HOLDING_COMPANY['scope2'],
            round(HOLDING_COMPANY['scope2'] / 13828.232, 4),
            '제3자 검증 완료 (DNV)'
        ])
        
        # Scope 2 Location-based
        scope2_loc = int(HOLDING_COMPANY['scope2'] * 1.05)
        writer.writerow([
            HOLDING_COMPANY['id'], HOLDING_COMPANY['name'],
            2024, 'scope2', 'location_based',
            scope2_loc, 0, 0, scope2_loc,
            round(scope2_loc / 13828.232, 4),
            '제3자 검증 완료 (DNV)'
        ])
    
    # 3. GHG_SCOPE3_DETAIL.csv (실제 카테고리 기반)
    scope3_file = ems_dir / "GHG_SCOPE3_DETAIL.csv"
    with open(scope3_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'company_id', 'company_name', 'year', 'quarter',
            'scope3_category', 'subcategory', 'ghg_emission_tco2e',
            'calculation_method', 'data_quality', 'notes'
        ])
        
        # 실제 Scope 3 카테고리별 배출량 (2,992,478 tCO2e 총합)
        scope3_categories = {
            'Cat.1 구매상품·서비스': 1133001,  # 실제 값
            'Cat.2 자본재': 195662,
            'Cat.3 연료·에너지': 15791,
            'Cat.4 업스트림 운송': 1594973,  # 최대 비중
            'Cat.5 폐기물': 1599,
            'Cat.6 출장': 6585,
            'Cat.7 통근': 13992,
            'Cat.8 임차자산': 15821,
            'Cat.9 다운스트림 운송': 207,
            'Cat.11 제품사용': 1259,
            'Cat.15 투자': 15588
        }
        
        for quarter in range(1, 5):
            for cat, annual_emission in scope3_categories.items():
                quarterly_emission = annual_emission / 4
                
                writer.writerow([
                    HOLDING_COMPANY['id'], HOLDING_COMPANY['name'],
                    2024, quarter, cat, '',
                    round(quarterly_emission, 2),
                    'spend_based', 'medium',
                    f'{HOLDING_COMPANY["name"]} {cat} 분기별 배출량'
                ])
    
    print(f"[OK] {HOLDING_COMPANY['name']} 데이터 생성 완료: {company_dir}")


def generate_subsidiary_data(sub: dict, base_dir: Path):
    """자회사 데이터 생성"""
    company_dir = base_dir / f"subsidiary_{sub['name']}"
    company_dir.mkdir(parents=True, exist_ok=True)
    
    ems_dir = company_dir / "EMS"
    ems_dir.mkdir(exist_ok=True)
    
    # 1. EMS_ENERGY_USAGE.csv
    energy_file = ems_dir / "EMS_ENERGY_USAGE.csv"
    with open(energy_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'site_code', 'site_name', 'company_id', 'company_name',
            'year', 'month', 'energy_type', 'consumption_kwh',
            'emission_factor', 'emission_tco2e'
        ])
        
        # Scope 2에서 전력 소비량 역산
        annual_kwh = sub['scope2'] * 1000 / 0.4157
        
        for site in sub['sites']:
            monthly_kwh = annual_kwh / len(sub['sites']) / 12
            
            for month in range(1, 13):
                month_factor = 1.1 if month in [7, 8] else 0.95
                kwh = monthly_kwh * month_factor
                emission = kwh * 0.4157 / 1000
                
                writer.writerow([
                    site['code'], site['name'], sub['id'], sub['name'],
                    2024, month, '전력', kwh,
                    0.4157, round(emission, 2)
                ])
    
    # 2. GHG_SCOPE12_SUMMARY.csv
    scope12_file = ems_dir / "GHG_SCOPE12_SUMMARY.csv"
    with open(scope12_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'company_id', 'company_name', 'year', 'scope', 'basis',
            'co2_tco2e', 'ch4_tco2e', 'n2o_tco2e', 'total_tco2e',
            'intensity_tco2e_per_bil_krw', 'verification_status'
        ])
        
        writer.writerow([
            sub['id'], sub['name'], 2024, 'scope1', 'location_based',
            sub['scope1'], 0, 0, sub['scope1'],
            0, '자가 검증'
        ])
        
        writer.writerow([
            sub['id'], sub['name'], 2024, 'scope2', 'market_based',
            sub['scope2'], 0, 0, sub['scope2'],
            0, '자가 검증'
        ])
    
    # 3. GHG_SCOPE3_DETAIL.csv
    scope3_file = ems_dir / "GHG_SCOPE3_DETAIL.csv"
    with open(scope3_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'company_id', 'company_name', 'year', 'quarter',
            'scope3_category', 'subcategory', 'ghg_emission_tco2e',
            'calculation_method', 'data_quality', 'notes'
        ])
        
        # 간단한 Scope 3 구성
        scope3_cats = {
            'Cat.1 구매상품·서비스': 0.45,
            'Cat.4 업스트림 운송': 0.25,
            'Cat.6 출장': 0.10,
            'Cat.7 통근': 0.10,
            'Cat.15 투자': 0.10
        }
        
        for quarter in range(1, 5):
            for cat, ratio in scope3_cats.items():
                emission = sub['scope3'] * ratio / 4
                
                writer.writerow([
                    sub['id'], sub['name'], 2024, quarter,
                    cat, '', round(emission, 2),
                    'spend_based', 'low',
                    f'{sub["name"]} {cat}'
                ])
    
    print(f"[OK] {sub['name']} 데이터 생성 완료: {company_dir}")


def create_companies_csv(base_dir: Path):
    """회사 목록 CSV 생성"""
    companies_file = base_dir / "companies_seed.csv"
    with open(companies_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'id', 'company_name', 'group_entity_type', 'parent_company_id',
            'equity_ratio', 'employees', 'business_type', 'company_login_id'
        ])
        
        # 지주사
        writer.writerow([
            HOLDING_COMPANY['id'],
            HOLDING_COMPANY['name'],
            'holding',
            '',
            100.0,
            26401,  # 실제 임직원 수
            'IT 서비스',
            'co_sds'
        ])
        
        # 자회사
        for sub in ALL_SUBSIDIARIES:
            equity = sub.get('equity_ratio', 100.0)
            writer.writerow([
                sub['id'],
                sub['name'],
                sub['type'],
                HOLDING_COMPANY['id'],
                equity,
                sub['employees'],
                sub['business'],
                f"co_{sub['name'][:4]}"
            ])
    
    print(f"[OK] 회사 목록 CSV 생성 완료: {companies_file}")


def create_site_master(base_dir: Path):
    """MDG_SITE_MASTER.csv 생성"""
    mdg_dir = base_dir / "MDG"
    mdg_dir.mkdir(exist_ok=True)
    
    site_file = mdg_dir / "MDG_SITE_MASTER.csv"
    with open(site_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'site_code', 'site_name', 'site_type', 'company_id', 'company_name',
            'pue_target', 'it_capacity_kw', 'address'
        ])
        
        # 지주사 사업장
        for site in HOLDING_COMPANY['sites']:
            pue = site.get('pue', '')
            capacity = site.get('capacity_kw', '')
            
            writer.writerow([
                site['code'], site['name'], site['type'],
                HOLDING_COMPANY['id'], HOLDING_COMPANY['name'],
                pue if pue else '', capacity if capacity else '',
                f"{site['name']} 주소"
            ])
        
        # 자회사 사업장
        for sub in ALL_SUBSIDIARIES:
            for site in sub['sites']:
                writer.writerow([
                    site['code'], site['name'], site['type'],
                    sub['id'], sub['name'],
                    '', '', f"{site['name']} 주소"
                ])
    
    print(f"[OK] 사업장 마스터 데이터 생성 완료: {site_file}")


if __name__ == "__main__":
    base_dir = Path(__file__).parent.parent.parent / "SDS_ESG_DATA_REAL"
    base_dir.mkdir(exist_ok=True)
    
    print("=" * 70)
    print("삼성SDS 실제 사업장 기반 GHG 더미 데이터 생성")
    print("=" * 70)
    
    # 지주사 데이터 생성
    generate_holding_company_data(base_dir)
    
    # 자회사 데이터 생성
    for sub in ALL_SUBSIDIARIES:
        generate_subsidiary_data(sub, base_dir)
    
    # 통합 마스터 데이터
    create_site_master(base_dir)
    create_companies_csv(base_dir)
    
    print("\n" + "=" * 70)
    print("[OK] 전체 데이터 생성 완료!")
    print("=" * 70)
    print(f"[DIR] 출력 디렉토리: {base_dir.absolute()}")
    print(f"\n[DATA] 생성된 데이터:")
    print(f"  - {HOLDING_COMPANY['name']} (holding): {HOLDING_COMPANY['scope1'] + HOLDING_COMPANY['scope2'] + HOLDING_COMPANY['scope3']:,} tCO2e")
    
    for sub in ALL_SUBSIDIARIES:
        total = sub['scope1'] + sub['scope2'] + sub['scope3']
        print(f"  - {sub['name']} ({sub['type']}): {total:,} tCO2e")
    
    group_total = (HOLDING_COMPANY['scope1'] + HOLDING_COMPANY['scope2'] + HOLDING_COMPANY['scope3'] +
                   sum(s['scope1'] + s['scope2'] + s['scope3'] for s in ALL_SUBSIDIARIES))
    
    print(f"\n[GROUP] 그룹 전체: {group_total:,} tCO2e")
    print(f"\n참고: 삼성SDS 실제 배출량 (2024)")
    print(f"  Scope 1: {HOLDING_COMPANY['scope1']:,} tCO2e")
    print(f"  Scope 2: {HOLDING_COMPANY['scope2']:,} tCO2e (Market-based)")
    print(f"  Scope 3: {HOLDING_COMPANY['scope3']:,} tCO2e")
    print(f"  합계: {HOLDING_COMPANY['scope1'] + HOLDING_COMPANY['scope2'] + HOLDING_COMPANY['scope3']:,} tCO2e")
