"""멀티캠퍼스 주식회사 전체 ESG 데이터 생성"""

import csv
from pathlib import Path

COMPANY = {
    "id": "SUB-003",
    "name": "멀티캠퍼스 주식회사",
    "type": "subsidiary",
    "business": "IT 교육",
    "employees": 320,
    "parent_id": "550e8400-e29b-41d4-a716-446655440000",
    "parent_name": "삼성에스디에스 주식회사",
    "sites": [
        {
            "code": "SITE-MC01",
            "name": "멀티캠퍼스 역삼",
            "type": "교육센터",
            "address": "서울시 강남구 역삼동",
            "floor_area_m2": 2800,
            "employees": 180
        },
        {
            "code": "SITE-MC02",
            "name": "멀티캠퍼스 선릉",
            "type": "교육센터",
            "address": "서울시 강남구 선릉로",
            "floor_area_m2": 1500,
            "employees": 140
        }
    ]
}


def create_ems_data(base_dir: Path):
    """EMS - 환경관리시스템 데이터"""
    ems_dir = base_dir / "EMS"
    ems_dir.mkdir(exist_ok=True)
    
    # 1. EMS_ENERGY_USAGE.csv
    with open(ems_dir / "EMS_ENERGY_USAGE.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'record_id', 'site_code', 'site_name', 'site_type', 'year', 'month',
            'energy_type', 'energy_source', 'usage_amount', 'usage_unit',
            'renewable_kwh', 'renewable_ratio', 'pue_monthly', 'it_load_kw',
            'cooling_power_kwh', 'cost_krw', 'meter_id', 'data_quality',
            'source_system', 'synced_at', 'created_at', 'updated_at', 'updated_by',
            'non_renewable_kwh', 'grid_emission_factor_market',
            'grid_emission_factor_location', 'energy_supplier_id',
            'rec_purchased_kwh', 'ppa_kwh', 'ghg_market_tco2e', 'ghg_location_tco2e',
            'consumption_kwh', 'facility', 'ghg_raw_category'  # GHG 산정 필수 필드
        ])
        
        # 역삼: 180명, 2800m² → 월 252,000 kWh
        # 선릉: 140명, 1500m² → 월 135,000 kWh
        site_monthly_kwh = {
            'SITE-MC01': 252000,
            'SITE-MC02': 135000
        }
        
        for site in COMPANY['sites']:
            base_kwh = site_monthly_kwh[site['code']]
            
            for month in range(1, 13):
                record_id = f"EMS-MC-{site['code'][-2:]}-2024-{month:04d}"
                # 여름철/겨울철 냉난방 부하
                if month in [7, 8]:
                    month_factor = 1.25  # 냉방
                elif month in [1, 2, 12]:
                    month_factor = 1.15  # 난방
                elif month in [3, 4, 10, 11]:
                    month_factor = 0.90
                else:
                    month_factor = 1.0
                
                monthly_kwh = base_kwh * month_factor
                emission_market = monthly_kwh * 0.4596 / 1000
                emission_location = monthly_kwh * 0.4596 / 1000
                cost = int(monthly_kwh * 115)
                
                writer.writerow([
                    record_id, site['code'], site['name'], site['type'], 2024, month,
                    '전력', '한국전력(KEPCO)', monthly_kwh, 'kWh',
                    0, 0.0, '', '', '',
                    cost, f"MTR-{site['code']}-EL-{month:02d}", 'M1',
                    'EMS', f'2024-{month:02d}-05 07:30:00',
                    f'2024-{month:02d}-05 09:00:00', f'2024-{month:02d}-10 10:00:00', 'user_001',
                    monthly_kwh, 0.4596, 0.4596, 'SUP-EN-001',
                    0, 0, round(emission_market, 4), round(emission_location, 4),
                    monthly_kwh, site['name'], 'energy'  # GHG 산정 엔진이 인식할 필드
                ])
    
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
        
        # 교육센터: 분기당 약 5톤 (2개 센터 합계)
        waste_types = [
            ('일반폐기물', '생활폐기물', '종이류', 2.5, 2.3, 0.2, 0, 92.0, 'N'),
            ('일반폐기물', '생활폐기물', '플라스틱', 1.2, 0.95, 0.25, 0, 79.2, 'N'),
            ('일반폐기물', '생활폐기물', '음식물', 1.0, 0.88, 0, 0.12, 88.0, 'N'),
            ('지정폐기물', '전자폐기물', 'IT장비', 0.3, 0.28, 0, 0.02, 93.3, 'Y'),
        ]
        
        for site in COMPANY['sites']:
            for quarter in range(1, 5):
                for idx, (wtype, cat, subcat, gen, rec, land, incin, rec_rate, haz) in enumerate(waste_types):
                    record_id = f"WASTE-MC-{site['code'][-2:]}-2024-Q{quarter}-{idx+1:03d}"
                    contractor = '삼성환경' if haz == 'Y' else '서울환경'
                    # 역삼/선릉 비율: 65:35
                    ratio = 0.65 if site['code'] == 'SITE-MC01' else 0.35
                    cost = int(gen * ratio * 500000)
                    
                    writer.writerow([
                        record_id, site['code'], site['name'], 2024, quarter,
                        wtype, cat, subcat, gen * ratio, rec * ratio, land * ratio, incin * ratio,
                        rec_rate, haz, '재활용' if rec > 0 else '매립', contractor, cost, 'M2',
                        'EMS', f'2024-{quarter*3:02d}-05 07:30:00',
                        f'2024-{quarter*3:02d}-05 09:00:00', f'2024-{quarter*3:02d}-10 10:00:00', 'user_001'
                    ])
    
    # 3. ENV_WATER_DETAIL.csv
    with open(ems_dir / "ENV_WATER_DETAIL.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'record_id', 'site_code', 'site_name', 'year', 'quarter',
            'water_intake_source', 'water_intake_ton', 'water_discharge_destination',
            'water_discharge_ton', 'water_reuse_ton', 'water_consumption_ton',
            'wue_l_kwh', 'cooling_tower_makeup_ton', 'cooling_tower_blowdown_ton',
            'water_stress_area_yn', 'cost_krw', 'data_quality', 'source_system',
            'synced_at', 'created_at', 'updated_at', 'updated_by'
        ])
        
        for site in COMPANY['sites']:
            # 역삼: 650톤/분기, 선릉: 350톤/분기
            base_intake = 650 if site['code'] == 'SITE-MC01' else 350
            
            for quarter in range(1, 5):
                record_id = f"WATER-MC-{site['code'][-2:]}-2024-Q{quarter}"
                intake = base_intake + quarter * 20
                discharge = intake * 0.88
                reuse = 0
                consumption = intake - discharge
                
                writer.writerow([
                    record_id, site['code'], site['name'], 2024, quarter,
                    '상수도', intake, '하수도', discharge, reuse, consumption,
                    '', '', '', 'N', int(intake * 850), 'M2', 'EMS',
                    f'2024-{quarter*3:02d}-05 07:30:00',
                    f'2024-{quarter*3:02d}-05 09:00:00', f'2024-{quarter*3:02d}-10 10:00:00', 'user_001'
                ])
    
    print(f"[OK] EMS 데이터 생성 완료")


def create_erp_data(base_dir: Path):
    """ERP - 전사자원관리 데이터"""
    erp_dir = base_dir / "ERP"
    erp_dir.mkdir(exist_ok=True)
    
    # 1. ERP_FINANCIAL_SUMMARY.csv
    with open(erp_dir / "ERP_FINANCIAL_SUMMARY.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'record_id', 'year', 'quarter', 'basis', 'revenue_m', 'operating_profit_m',
            'net_profit_m', 'total_assets_m', 'total_liabilities_m', 'total_equity_m',
            'rd_cost_m', 'rd_revenue_ratio_pct', 'esg_investment_m', 'env_investment_m',
            'safety_investment_m', 'tax_paid_m', 'local_procurement_ratio_pct',
            'donation_m', 'mutualgrowth_fund_m', 'employee_compensation_m',
            'supplier_purchase_m', 'source_system', 'synced_at', 'created_at',
            'updated_at', 'updated_by'
        ])
        
        # 멀티캠퍼스: 연매출 약 1,500억원 규모 (IT 교육 시장)
        base_revenue = 37500  # 분기당 375억
        
        for quarter in range(1, 5):
            record_id = f"FIN-MC-2024-Q{quarter}"
            revenue = base_revenue + quarter * 200
            operating_profit = int(revenue * 0.12)
            net_profit = int(revenue * 0.09)
            
            writer.writerow([
                record_id, 2024, quarter, '별도', revenue, operating_profit, net_profit,
                85000, 45000, 40000,  # 자산, 부채, 자본
                int(revenue * 0.08), 8.0,  # R&D (교육 콘텐츠 개발)
                int(revenue * 0.015), int(revenue * 0.005), int(revenue * 0.003),
                int(revenue * 0.18), 92.0,
                50, 0,
                int(revenue * 0.42),  # 인건비 (강사비 포함)
                int(revenue * 0.15),
                'ERP', f'2024-{quarter*3:02d}-10 07:00:00',
                f'2024-{quarter*3:02d}-10 09:00:00', f'2024-{quarter*3:02d}-15 10:00:00', 'user_fin'
            ])
    
    # 2. ERP_TAX_DETAIL.csv
    with open(erp_dir / "ERP_TAX_DETAIL.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'record_id', 'year', 'quarter', 'country', 'country_code', 'region',
            'pretax_profit_m', 'tax_base_m', 'effective_tax_rate_pct', 'tax_paid_m',
            'tax_payable_m', 'deferred_tax_asset_m', 'deferred_tax_liability_m',
            'income_tax_expense_m', 'notes', 'source_system', 'synced_at',
            'created_at', 'updated_at', 'updated_by'
        ])
        
        for quarter in range(1, 5):
            record_id = f"TAX-MC-2024-Q{quarter}"
            pretax = 10125 + quarter * 100
            tax_paid = int(pretax * 0.22)
            
            writer.writerow([
                record_id, 2024, quarter, '대한민국', 'KR', '국내',
                pretax, pretax, 22.0, tax_paid, tax_paid, 0, 0, tax_paid,
                '멀티캠퍼스 법인세', 'ERP', f'2024-{quarter*3:02d}-10 07:00:00',
                f'2024-{quarter*3:02d}-10 09:00:00', f'2024-{quarter*3:02d}-15 10:00:00', 'user_fin'
            ])
    
    print(f"[OK] ERP 데이터 생성 완료")


def create_hr_data(base_dir: Path):
    """HR - 인사 데이터"""
    hr_dir = base_dir / "HR"
    hr_dir.mkdir(exist_ok=True)
    
    # 1. HR_EMPLOYEE_HEADCOUNT.csv
    with open(hr_dir / "HR_EMPLOYEE_HEADCOUNT.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'record_id', 'year', 'quarter', 'region', 'country', 'employment_type',
            'gender', 'age_group', 'job_level', 'headcount', 'contract_type',
            'full_time_yn', 'disability_yn', 'data_quality', 'source_system',
            'synced_at', 'created_at', 'updated_at', 'updated_by'
        ])
        
        # 멀티캠퍼스: 320명 (정규직 250, 계약직 70 - 강사)
        emp_data = [
            ('국내', 'KR', '정규직', '남성', '30-39', '사원', 60, '무기계약', 'Y', 'N'),
            ('국내', 'KR', '정규직', '남성', '30-39', '대리', 40, '무기계약', 'Y', 'N'),
            ('국내', 'KR', '정규직', '남성', '40-49', '과장', 35, '무기계약', 'Y', 'N'),
            ('국내', 'KR', '정규직', '남성', '40-49', '차장', 20, '무기계약', 'Y', 'N'),
            ('국내', 'KR', '정규직', '남성', '50-59', '부장', 15, '무기계약', 'Y', 'N'),
            ('국내', 'KR', '정규직', '여성', '30-39', '사원', 35, '무기계약', 'Y', 'N'),
            ('국내', 'KR', '정규직', '여성', '30-39', '대리', 25, '무기계약', 'Y', 'N'),
            ('국내', 'KR', '정규직', '여성', '40-49', '과장', 20, '무기계약', 'Y', 'N'),
            ('국내', 'KR', '계약직', '남성', '30-49', '강사', 45, '1년계약', 'Y', 'N'),
            ('국내', 'KR', '계약직', '여성', '30-49', '강사', 25, '1년계약', 'Y', 'N'),
        ]
        
        for quarter in range(1, 5):
            for idx, (region, country, emp_type, gender, age, level, cnt, contract, full, dis) in enumerate(emp_data):
                record_id = f"HC-MC-2024-Q{quarter}-{idx+1:03d}"
                
                writer.writerow([
                    record_id, 2024, quarter, region, country, emp_type, gender, age, level,
                    cnt, contract, full, dis, 'M1', 'HR',
                    f'2024-{quarter*3:02d}-05 07:30:00',
                    f'2024-{quarter*3:02d}-05 09:00:00', f'2024-{quarter*3:02d}-10 10:00:00', 'user_hr'
                ])
    
    # 2. HR_TRAINING.csv
    with open(hr_dir / "HR_TRAINING.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'record_id', 'year', 'quarter', 'training_category', 'training_name',
            'participant_count', 'completion_count', 'completion_rate_pct',
            'training_hours_per_person', 'total_training_hours', 'training_cost_krw',
            'mandatory_yn', 'online_offline', 'training_provider', 'data_quality',
            'source_system', 'synced_at', 'created_at', 'updated_at', 'updated_by'
        ])
        
        training_types = [
            ('기술교육', '강사 역량 강화', 70, 68, 97.1, 24, '온오프혼합', '외부전문기관'),
            ('직무교육', '교육 콘텐츠 개발', 120, 115, 95.8, 16, '온라인', '내부'),
            ('법정교육', '정보보호', 320, 320, 100.0, 4, '온라인', '내부'),
            ('법정교육', '성희롱예방', 320, 320, 100.0, 1, '온라인', '내부'),
            ('법정교육', '안전교육', 320, 318, 99.4, 2, '온라인', '내부'),
        ]
        
        for quarter in range(1, 5):
            for idx, (cat, name, part, comp, rate, hours, mode, provider) in enumerate(training_types):
                record_id = f"TR-MC-2024-Q{quarter}-{idx+1:03d}"
                total_hours = part * hours
                cost = total_hours * 55000
                mandatory = 'Y' if cat == '법정교육' else 'N'
                
                writer.writerow([
                    record_id, 2024, quarter, cat, name, part, comp, rate, hours,
                    total_hours, cost, mandatory, mode, provider, 'M1', 'HR',
                    f'2024-{quarter*3:02d}-05 07:30:00',
                    f'2024-{quarter*3:02d}-05 09:00:00', f'2024-{quarter*3:02d}-10 10:00:00', 'user_hr'
                ])
    
    print(f"[OK] HR 데이터 생성 완료")


def create_ehs_data(base_dir: Path):
    """EHS - 안전보건환경 데이터"""
    ehs_dir = base_dir / "EHS"
    ehs_dir.mkdir(exist_ok=True)
    
    # 1. EHS_SAFETY_KPI.csv
    with open(ehs_dir / "EHS_SAFETY_KPI.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'record_id', 'site_code', 'site_name', 'year', 'quarter', 'worker_type',
            'total_workers', 'total_work_hours', 'fatality_count', 'ltir_count',
            'rwr_count', 'first_aid_count', 'near_miss_count', 'trir', 'ltir',
            'severity_rate', 'lost_days', 'recordable_rate', 'data_quality',
            'source_system', 'synced_at', 'created_at', 'updated_at', 'updated_by'
        ])
        
        for site in COMPANY['sites']:
            workers = site['employees']
            
            for quarter in range(1, 5):
                record_id = f"SAFETY-MC-{site['code'][-2:]}-2024-Q{quarter}"
                # 교육센터: 안전사고 거의 없음
                writer.writerow([
                    record_id, site['code'], site['name'], 2024, quarter, '정규직',
                    workers, workers * 520, 0, 0, 0, 2, 3,
                    0, 0, 0, 0, 0, 'M1', 'EHS',
                    f'2024-{quarter*3:02d}-05 07:30:00',
                    f'2024-{quarter*3:02d}-05 09:00:00', f'2024-{quarter*3:02d}-10 10:00:00', 'user_ehs'
                ])
    
    print(f"[OK] EHS 데이터 생성 완료")


def create_mdg_data(base_dir: Path):
    """MDG - 마스터 데이터"""
    mdg_dir = base_dir / "MDG"
    mdg_dir.mkdir(exist_ok=True)
    
    # 1. MDG_SITE_MASTER.csv
    with open(mdg_dir / "MDG_SITE_MASTER.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'site_code', 'site_name', 'site_type', 'address', 'country', 'region',
            'floor_area_m2', 'ownership_type', 'operational_control', 'equity_ratio',
            'boundary_scope', 'dc_it_capacity_kw', 'pue_target', 'start_date',
            'active_yn', 'last_synced_at', 'created_at', 'updated_at', 'updated_by'
        ])
        
        for site in COMPANY['sites']:
            writer.writerow([
                site['code'], site['name'], site['type'], site['address'], 'KR', '국내',
                site['floor_area_m2'], '임차', 'Y', 100.0, '포함', '', '', '2010-06-01',
                'Y', '2024-01-01 06:00:00', '2024-01-01 09:00:00',
                '2024-01-15 09:00:00', 'admin_001'
            ])
    
    print(f"[OK] MDG 데이터 생성 완료")


if __name__ == "__main__":
    base_dir = Path(__file__).parent.parent.parent / "SDS_ESG_DATA_REAL" / f"subsidiary_{COMPANY['name']}"
    
    print("=" * 70)
    print(f"{COMPANY['name']} ESG 데이터 생성")
    print("=" * 70)
    
    create_ems_data(base_dir)
    create_erp_data(base_dir)
    create_hr_data(base_dir)
    create_ehs_data(base_dir)
    create_mdg_data(base_dir)
    
    print("\n" + "=" * 70)
    print("[OK] 전체 데이터 생성 완료!")
    print("=" * 70)
    print(f"[DIR] 출력 디렉토리: {base_dir.absolute()}")
    print(f"\n생성된 파일:")
    print(f"  EMS: 3개 파일")
    print(f"  ERP: 2개 파일")
    print(f"  HR: 2개 파일")
    print(f"  EHS: 1개 파일 (2개 사업장)")
    print(f"  MDG: 1개 파일 (2개 사업장)")
    print(f"\n회사 정보:")
    print(f"  이름: {COMPANY['name']}")
    print(f"  임직원: {COMPANY['employees']}명")
    print(f"  사업장: {len(COMPANY['sites'])}개")
    print(f"  예상 Scope 2: ~3,850 tCO2e")
