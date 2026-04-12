"""에스코어 주식회사 전체 ESG 데이터 생성
- 클라우드 서비스 기업
- 임직원: 850명
- 사업장: 1개 (판교)
"""

import csv
from pathlib import Path

COMPANY = {
    "id": "SUB-004",
    "name": "에스코어 주식회사",
    "type": "subsidiary",
    "business": "클라우드 서비스",
    "employees": 850,
    "parent_id": "550e8400-e29b-41d4-a716-446655440000",
    "parent_name": "삼성에스디에스 주식회사",
    "sites": [
        {
            "code": "SITE-SC01",
            "name": "에스코어 판교",
            "type": "오피스",
            "address": "경기도 성남시 분당구 판교로",
            "floor_area_m2": 8500,
            "employees": 850
        }
    ]
}


def create_ems_data(base_dir: Path):
    """EMS - 환경관리시스템 데이터"""
    ems_dir = base_dir / "EMS"
    ems_dir.mkdir(exist_ok=True)
    
    # 1. EMS_ENERGY_USAGE.csv는 이미 수정됨 (GHG 산정 필드 포함)
    pass
    
    # 2. ENV_WASTE_DETAIL.csv
    with open(ems_dir / "ENV_WASTE_DETAIL.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'record_id', 'site_code', 'site_name', 'year', 'quarter',
            'waste_type', 'waste_category', 'waste_subcategory',
            'generation_ton', 'recycling_ton', 'landfill_ton', 'incineration_ton',
            'recycling_rate_pct', 'hazardous_waste_yn', 'treatment_method',
            'treatment_contractor', 'treatment_cost_krw', 'data_quality',
            'source_system', 'synced_at', 'created_at', 'updated_at', 'updated_by'
        ])
        
        site = COMPANY['sites'][0]
        waste_types = [
            ('일반폐기물', '종이류', 8.5, 8.1, 0.4, 0, 95.3, 'N'),
            ('일반폐기물', '플라스틱', 4.2, 3.5, 0.7, 0, 83.3, 'N'),
            ('일반폐기물', '음식물', 12.5, 0, 0, 12.5, 0, 'N'),
            ('전자폐기물', 'IT장비', 2.8, 2.8, 0, 0, 100, 'Y'),
            ('전자폐기물', '서버부품', 1.5, 1.5, 0, 0, 100, 'Y'),
        ]
        
        for q in range(1, 5):
            for idx, (cat, subcat, gen, rec, land, inc, rec_rate, haz) in enumerate(waste_types):
                record_id = f"WST-SC-2024-Q{q}-{idx+1:03d}"
                contractor = "그린환경 주식회사" if haz == 'N' else "전문처리업체"
                cost = int(gen * 150000)
                
                writer.writerow([
                    record_id, site['code'], site['name'], 2024, q,
                    cat, subcat, '',
                    gen, rec, land, inc,
                    rec_rate, haz, '위탁처리',
                    contractor, cost, 'M1',
                    'EMS', f'2024-{q*3:02d}-20 08:00:00',
                    f'2024-{q*3:02d}-20 09:00:00', f'2024-{q*3:02d}-25 10:00:00', 'user_001'
                ])
    
    # 3. ENV_WATER_USAGE.csv
    with open(ems_dir / "ENV_WATER_USAGE.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'record_id', 'site_code', 'site_name', 'year', 'month',
            'water_source', 'intake_m3', 'discharge_m3', 'recycled_m3',
            'unit_cost_krw', 'total_cost_krw', 'data_quality',
            'source_system', 'synced_at', 'created_at', 'updated_at', 'updated_by'
        ])
        
        site = COMPANY['sites'][0]
        base_monthly_m3 = 620  # 850명 × 0.73 m³/인/월
        
        for month in range(1, 13):
            record_id = f"WTR-SC-2024-{month:04d}"
            monthly_m3 = base_monthly_m3 * (1.15 if month in [7, 8] else 1.0)
            cost = int(monthly_m3 * 850)
            
            writer.writerow([
                record_id, site['code'], site['name'], 2024, month,
                '상수도', monthly_m3, monthly_m3 * 0.95, 0,
                850, cost, 'M1',
                'EMS', f'2024-{month:02d}-05 08:00:00',
                f'2024-{month:02d}-05 09:00:00', f'2024-{month:02d}-10 10:00:00', 'user_001'
            ])


def create_erp_data(base_dir: Path):
    """ERP - 재무 데이터"""
    erp_dir = base_dir / "ERP"
    erp_dir.mkdir(exist_ok=True)
    
    # 1. FIN_REVENUE.csv
    with open(erp_dir / "FIN_REVENUE.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'record_id', 'year', 'quarter', 'month',
            'revenue_krw', 'operating_profit_krw', 'net_profit_krw',
            'revenue_growth_yoy_pct', 'profit_margin_pct',
            'data_quality', 'source_system', 'synced_at', 'created_at', 'updated_at', 'updated_by'
        ])
        
        quarterly_revenue = 42_000_000_000  # 분기당 420억원
        
        for q in range(1, 5):
            record_id = f"REV-SC-2024-Q{q}"
            operating_profit = int(quarterly_revenue * 0.18)
            net_profit = int(quarterly_revenue * 0.14)
            
            writer.writerow([
                record_id, 2024, q, None,
                quarterly_revenue, operating_profit, net_profit,
                15.2, 14.0,
                'M1', 'ERP', f'2024-{q*3:02d}-25 09:00:00',
                f'2024-{q*3:02d}-25 10:00:00', f'2024-{q*3:02d}-28 11:00:00', 'user_001'
            ])
    
    # 2. FIN_CAPEX.csv
    with open(erp_dir / "FIN_CAPEX.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'record_id', 'year', 'quarter',
            'capex_total_krw', 'capex_rd_krw', 'capex_facility_krw', 'capex_it_krw',
            'data_quality', 'source_system', 'synced_at', 'created_at', 'updated_at', 'updated_by'
        ])
        
        for q in range(1, 5):
            record_id = f"CAPEX-SC-2024-Q{q}"
            total_capex = 5_500_000_000  # 분기당 55억원
            rd_capex = int(total_capex * 0.50)
            facility_capex = int(total_capex * 0.15)
            it_capex = int(total_capex * 0.35)
            
            writer.writerow([
                record_id, 2024, q,
                total_capex, rd_capex, facility_capex, it_capex,
                'M1', 'ERP', f'2024-{q*3:02d}-25 09:00:00',
                f'2024-{q*3:02d}-25 10:00:00', f'2024-{q*3:02d}-28 11:00:00', 'user_001'
            ])


def create_hr_data(base_dir: Path):
    """HR - 인사 데이터"""
    hr_dir = base_dir / "HR"
    hr_dir.mkdir(exist_ok=True)
    
    # 1. HR_HEADCOUNT.csv
    with open(hr_dir / "HR_HEADCOUNT.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'record_id', 'site_code', 'site_name', 'year', 'month',
            'total_headcount', 'permanent', 'contract', 'male', 'female',
            'new_hire', 'resignation', 'turnover_rate_pct',
            'data_quality', 'source_system', 'synced_at', 'created_at', 'updated_at', 'updated_by'
        ])
        
        site = COMPANY['sites'][0]
        base_hc = 850
        
        for month in range(1, 13):
            record_id = f"HC-SC-2024-{month:04d}"
            total_hc = base_hc + (month // 3) * 2
            male = int(total_hc * 0.62)
            female = total_hc - male
            new_hire = 8 if month % 3 == 1 else 2
            resignation = 4 if month % 6 == 0 else 1
            
            writer.writerow([
                record_id, site['code'], site['name'], 2024, month,
                total_hc, int(total_hc * 0.90), int(total_hc * 0.10), male, female,
                new_hire, resignation, round((resignation / total_hc) * 100, 2),
                'M1', 'HR', f'2024-{month:02d}-05 08:00:00',
                f'2024-{month:02d}-05 09:00:00', f'2024-{month:02d}-10 10:00:00', 'user_001'
            ])
    
    # 2. HR_TRAINING.csv
    with open(hr_dir / "HR_TRAINING.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'record_id', 'year', 'quarter',
            'total_training_hours', 'avg_hours_per_employee', 'training_cost_krw',
            'participants', 'training_categories',
            'data_quality', 'source_system', 'synced_at', 'created_at', 'updated_at', 'updated_by'
        ])
        
        for q in range(1, 5):
            record_id = f"TRN-SC-2024-Q{q}"
            total_hours = 850 * 18  # 1인당 분기 18시간
            cost = 150_000_000  # 분기당 1.5억원
            
            writer.writerow([
                record_id, 2024, q,
                total_hours, 18, cost,
                850, '클라우드기술,보안,리더십,컴플라이언스',
                'M1', 'HR', f'2024-{q*3:02d}-25 08:00:00',
                f'2024-{q*3:02d}-25 09:00:00', f'2024-{q*3:02d}-28 10:00:00', 'user_001'
            ])


def create_ehs_data(base_dir: Path):
    """EHS - 안전보건 데이터"""
    ehs_dir = base_dir / "EHS"
    ehs_dir.mkdir(exist_ok=True)
    
    # EHS_SAFETY_KPI.csv
    with open(ehs_dir / "EHS_SAFETY_KPI.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'record_id', 'site_code', 'site_name', 'year', 'quarter',
            'total_incidents', 'lost_time_injuries', 'near_misses',
            'safety_training_hours', 'safety_investment_krw',
            'data_quality', 'source_system', 'synced_at', 'created_at', 'updated_at', 'updated_by'
        ])
        
        site = COMPANY['sites'][0]
        
        for q in range(1, 5):
            record_id = f"SAFETY-SC-2024-Q{q}"
            incidents = 2 if q == 3 else 0
            near_misses = 5 if q in [1, 4] else 3
            training_hours = 850 * 4
            investment = 28_000_000
            
            writer.writerow([
                record_id, site['code'], site['name'], 2024, q,
                incidents, 0, near_misses,
                training_hours, investment,
                'M1', 'EHS', f'2024-{q*3:02d}-25 08:00:00',
                f'2024-{q*3:02d}-25 09:00:00', f'2024-{q*3:02d}-28 10:00:00', 'user_001'
            ])


def create_mdg_data(base_dir: Path):
    """MDG - 마스터 데이터"""
    mdg_dir = base_dir / "MDG"
    mdg_dir.mkdir(exist_ok=True)
    
    # MDG_SITE_MASTER.csv
    with open(mdg_dir / "MDG_SITE_MASTER.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'site_code', 'site_name', 'site_type', 'address', 'city', 'country',
            'floor_area_m2', 'employees', 'operational_status', 'open_date',
            'data_quality', 'source_system', 'synced_at', 'created_at', 'updated_at', 'updated_by'
        ])
        
        for site in COMPANY['sites']:
            writer.writerow([
                site['code'], site['name'], site['type'], site['address'], '성남', '대한민국',
                site['floor_area_m2'], site['employees'], 'ACTIVE', '2015-06-01',
                'M1', 'MDG', '2024-01-05 08:00:00',
                '2024-01-05 09:00:00', '2024-01-10 10:00:00', 'user_001'
            ])


if __name__ == "__main__":
    base_dir = Path(__file__).parent.parent.parent / "SDS_ESG_DATA_REAL" / f"subsidiary_{COMPANY['name']}"
    base_dir.mkdir(exist_ok=True, parents=True)
    
    print("=" * 70)
    print(f"{COMPANY['name']} ESG 데이터 생성")
    print("=" * 70)
    
    create_ems_data(base_dir)
    print("[OK] EMS 데이터 생성 완료")
    
    create_erp_data(base_dir)
    print("[OK] ERP 데이터 생성 완료")
    
    create_hr_data(base_dir)
    print("[OK] HR 데이터 생성 완료")
    
    create_ehs_data(base_dir)
    print("[OK] EHS 데이터 생성 완료")
    
    create_mdg_data(base_dir)
    print("[OK] MDG 데이터 생성 완료")
    
    print()
    print("=" * 70)
    print("[OK] 전체 데이터 생성 완료!")
    print("=" * 70)
    print(f"[DIR] 저장 디렉토리: {base_dir}")
    print()
    print("데이터 구조:")
    print("  EMS: 3개 파일 (에너지, 폐기물, 물)")
    print("  ERP: 2개 파일 (재무, 설비투자)")
    print("  HR: 2개 파일 (인원, 교육)")
    print("  EHS: 1개 파일 (안전)")
    print("  MDG: 1개 파일 (사업장 마스터)")
    print()
    print("회사 정보:")
    print(f"  이름: {COMPANY['name']}")
    print(f"  임직원: {COMPANY['employees']}명")
    print(f"  사업장: {len(COMPANY['sites'])}개")
    print(f"  사업: {COMPANY['business']}")
