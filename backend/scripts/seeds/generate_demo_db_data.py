"""
GHG 산정 결과 및 제출 이력 더미 데이터 생성

발표 시연을 위한 핵심 데이터:
1. ghg_emission_results: 오픈핸즈, 멀티캠퍼스 산정 결과
2. subsidiary_data_submissions: 제출 이력 (승인됨, 대기중)
"""

from pathlib import Path

INSERT_GHG_RESULTS = """
-- 1. 오픈핸즈 주식회사 GHG 산정 결과
INSERT INTO ghg_emission_results (
    id, company_id, year, scope, basis,
    co2_tco2e, ch4_tco2e, n2o_tco2e, total_emission,
    site_code, site_name, calculation_method,
    emission_factor, activity_data, activity_unit,
    data_quality, verification_status, source_company_id,
    created_at, updated_at
) VALUES

-- 오픈핸즈 Scope 2 (전력)
(
    gen_random_uuid(),
    'SUB-001',
    2024,
    'scope2',
    'market_based',
    375.4,
    0,
    0,
    375.4,
    'SITE-OH01',
    '오픈핸즈 본사',
    'emission_factor',
    0.4596,
    816800,
    'kWh',
    'M1',
    '자가 검증',
    'SUB-001',
    '2024-03-10 10:00:00',
    '2024-03-10 10:00:00'
),

-- 오픈핸즈 Scope 1 (도시가스·법인차량 경유 — EMS 활동데이터 기반 요약)
(
    gen_random_uuid(),
    'SUB-001',
    2024,
    'scope1',
    'location_based',
    44.8,
    0,
    0,
    44.8,
    'SITE-OH01',
    '오픈핸즈 본사',
    'emission_factor',
    NULL,
    NULL,
    NULL,
    'M1',
    '자가 검증',
    'SUB-001',
    '2024-03-10 10:00:00',
    '2024-03-10 10:00:00'
),

-- 오픈핸즈 Scope 3 (구매/폐기물/출장)
(
    gen_random_uuid(),
    'SUB-001',
    2024,
    'scope3',
    'location_based',
    3800,
    0,
    0,
    3800,
    'SITE-OH01',
    '오픈핸즈 본사',
    'spend_based',
    NULL,
    76500,
    '백만원',
    'M2',
    '자가 검증',
    'SUB-001',
    '2024-03-10 10:00:00',
    '2024-03-10 10:00:00'
);

-- 2. 멀티캠퍼스 주식회사 GHG 산정 결과
INSERT INTO ghg_emission_results (
    id, company_id, year, scope, basis,
    co2_tco2e, ch4_tco2e, n2o_tco2e, total_emission,
    site_code, site_name, calculation_method,
    emission_factor, activity_data, activity_unit,
    data_quality, verification_status, source_company_id,
    created_at, updated_at
) VALUES

-- 멀티캠퍼스 Scope 2 (전력) - 역삼
(
    gen_random_uuid(),
    'SUB-003',
    2024,
    'scope2',
    'market_based',
    2178.4,
    0,
    0,
    2178.4,
    'SITE-MC01',
    '멀티캠퍼스 역삼',
    'emission_factor',
    0.4596,
    4738560,
    'kWh',
    'M1',
    '자가 검증',
    'SUB-003',
    '2024-03-15 10:00:00',
    '2024-03-15 10:00:00'
),

-- 멀티캠퍼스 Scope 2 (전력) - 선릉
(
    gen_random_uuid(),
    'SUB-003',
    2024,
    'scope2',
    'market_based',
    1170.6,
    0,
    0,
    1170.6,
    'SITE-MC02',
    '멀티캠퍼스 선릉',
    'emission_factor',
    0.4596,
    2547000,
    'kWh',
    'M1',
    '자가 검증',
    'SUB-003',
    '2024-03-15 10:00:00',
    '2024-03-15 10:00:00'
),

-- 멀티캠퍼스 Scope 1 (역삼 도시가스·선릉 차량 경유 — EMS 활동데이터 기반 요약)
(
    gen_random_uuid(),
    'SUB-003',
    2024,
    'scope1',
    'location_based',
    118.5,
    0,
    0,
    118.5,
    'SITE-MC01',
    '멀티캠퍼스 역삼',
    'emission_factor',
    NULL,
    NULL,
    NULL,
    'M1',
    '자가 검증',
    'SUB-003',
    '2024-03-15 10:00:00',
    '2024-03-15 10:00:00'
),

-- 멀티캠퍼스 Scope 3 (구매/폐기물/출장)
(
    gen_random_uuid(),
    'SUB-003',
    2024,
    'scope3',
    'location_based',
    8900,
    0,
    0,
    8900,
    NULL,
    NULL,
    'spend_based',
    NULL,
    226500,
    '백만원',
    'M2',
    '자가 검증',
    'SUB-003',
    '2024-03-15 10:00:00',
    '2024-03-15 10:00:00'
);
"""

INSERT_SUBMISSIONS = """
-- 계열사 데이터 제출 이력

INSERT INTO subsidiary_data_submissions (
    id, subsidiary_company_id, holding_company_id,
    submission_year, submission_quarter, submission_date,
    scope_1_submitted, scope_2_submitted, scope_3_submitted,
    status, reviewed_by, reviewed_at, rejection_reason,
    staging_row_count, total_emission_tco2e,
    created_at, updated_at
) VALUES

-- 1. 오픈핸즈: 승인 완료 (시연용)
(
    gen_random_uuid(),
    'SUB-001',
    '550e8400-e29b-41d4-a716-446655440000',
    2024,
    NULL,
    '2024-03-12 14:30:00',
    true,
    true,
    true,
    'approved',
    NULL,  -- 실제 시연 시 reviewer user_id로 변경
    '2024-03-13 09:15:00',
    NULL,
    36,
    4220.2,
    '2024-03-12 14:30:00',
    '2024-03-13 09:15:00'
),

-- 2. 멀티캠퍼스: 제출 대기 (시연용 - 승인할 대상)
(
    gen_random_uuid(),
    'SUB-003',
    '550e8400-e29b-41d4-a716-446655440000',
    2024,
    NULL,
    '2024-03-20 16:45:00',
    true,
    true,
    true,
    'submitted',
    NULL,
    NULL,
    NULL,
    48,
    12367.5,
    '2024-03-20 16:45:00',
    '2024-03-20 16:45:00'
),

-- 3. 오픈핸즈: 2023년 승인 완료 (과거 이력)
(
    gen_random_uuid(),
    'SUB-001',
    '550e8400-e29b-41d4-a716-446655440000',
    2023,
    NULL,
    '2023-03-15 10:20:00',
    false,
    true,
    true,
    'approved',
    NULL,
    '2023-03-16 11:00:00',
    NULL,
    12,
    3950.2,
    '2023-03-15 10:20:00',
    '2023-03-16 11:00:00'
);
"""

VERIFICATION_QUERIES = """
-- 데이터 확인 쿼리

-- 1. GHG 산정 결과 확인
SELECT 
    c.company_name,
    g.year,
    g.scope,
    g.site_name,
    g.total_emission,
    g.verification_status
FROM ghg_emission_results g
JOIN companies c ON g.company_id = c.id
WHERE g.company_id IN ('SUB-001', 'SUB-003')
  AND g.year = 2024
ORDER BY c.company_name, g.scope;

-- 2. 제출 이력 확인
SELECT 
    sc.company_name as subsidiary,
    hc.company_name as holding,
    s.submission_year,
    s.status,
    s.scope_2_submitted,
    s.total_emission_tco2e,
    s.submission_date,
    s.reviewed_at
FROM subsidiary_data_submissions s
JOIN companies sc ON s.subsidiary_company_id = sc.id
JOIN companies hc ON s.holding_company_id = hc.id
WHERE s.submission_year = 2024
ORDER BY s.submission_date DESC;

-- 3. 그룹 전체 Scope 2 집계
SELECT 
    '지주사' as type,
    c.company_name,
    SUM(g.total_emission) as scope2_tco2e
FROM ghg_emission_results g
JOIN companies c ON g.company_id = c.id
WHERE g.company_id = '550e8400-e29b-41d4-a716-446655440000'
  AND g.year = 2024
  AND g.scope = 'scope2'
GROUP BY c.company_name

UNION ALL

SELECT 
    '계열사 (승인됨)' as type,
    c.company_name,
    SUM(g.total_emission) as scope2_tco2e
FROM ghg_emission_results g
JOIN companies c ON g.company_id = c.id
JOIN subsidiary_data_submissions s 
    ON s.subsidiary_company_id = g.company_id
    AND s.submission_year = g.year
    AND s.status = 'approved'
WHERE g.scope = 'scope2'
  AND g.year = 2024
GROUP BY c.company_name

ORDER BY type, company_name;
"""

if __name__ == "__main__":
    print("=" * 70)
    print("GHG 산정 결과 및 제출 이력 SQL 생성")
    print("=" * 70)
    
    output_dir = Path(__file__).parent.parent.parent / "SDS_ESG_DATA_REAL"
    
    # 1. GHG 산정 결과 SQL
    ghg_sql_file = output_dir / "insert_ghg_results.sql"
    with open(ghg_sql_file, 'w', encoding='utf-8') as f:
        f.write(INSERT_GHG_RESULTS)
    print(f"[OK] GHG 산정 결과 SQL: {ghg_sql_file}")
    
    # 2. 제출 이력 SQL
    submissions_sql_file = output_dir / "insert_submissions.sql"
    with open(submissions_sql_file, 'w', encoding='utf-8') as f:
        f.write(INSERT_SUBMISSIONS)
    print(f"[OK] 제출 이력 SQL: {submissions_sql_file}")
    
    # 3. 검증 쿼리 SQL
    verify_sql_file = output_dir / "verify_demo_data.sql"
    with open(verify_sql_file, 'w', encoding='utf-8') as f:
        f.write(VERIFICATION_QUERIES)
    print(f"[OK] 검증 쿼리 SQL: {verify_sql_file}")
    
    print("\n" + "=" * 70)
    print("[OK] SQL 파일 생성 완료!")
    print("=" * 70)
    print("\n실행 방법:")
    print("1. psql 또는 pgAdmin으로 접속")
    print("2. insert_ghg_results.sql 실행")
    print("3. insert_submissions.sql 실행")
    print("4. verify_demo_data.sql로 데이터 확인")
    print("\n또는 Python으로 실행:")
    print("  python -c 'import asyncio; asyncio.run(insert_demo_data())'")
