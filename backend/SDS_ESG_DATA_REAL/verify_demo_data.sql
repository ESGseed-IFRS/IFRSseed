-- 데이터 확인 쿼리 (발표 시연 전 검증용)

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
WHERE s.submission_year >= 2023
ORDER BY s.submission_date DESC;

-- 3. 그룹 전체 Scope 2 집계
SELECT 
    '지주사' as type,
    c.company_name,
    ROUND(SUM(g.total_emission)::numeric, 2) as scope2_tco2e
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
    ROUND(SUM(g.total_emission)::numeric, 2) as scope2_tco2e
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

-- 4. 승인 대기 목록 (지주사 화면용)
SELECT 
    s.id as submission_id,
    sc.company_name as subsidiary,
    s.submission_year,
    s.submission_date,
    s.status,
    s.scope_1_submitted,
    s.scope_2_submitted,
    s.scope_3_submitted,
    s.total_emission_tco2e,
    s.staging_row_count
FROM subsidiary_data_submissions s
JOIN companies sc ON s.subsidiary_company_id = sc.id
WHERE s.holding_company_id = '550e8400-e29b-41d4-a716-446655440000'
  AND s.status = 'submitted'
  AND s.submission_year = 2024
ORDER BY s.submission_date DESC;

-- 5. 데이터 출처별 Scope 2 상세
SELECT 
    CASE 
        WHEN c.id = '550e8400-e29b-41d4-a716-446655440000' THEN 'holding_own'
        ELSE 'subsidiary_reported'
    END as source_type,
    c.company_name,
    g.site_name,
    ROUND(g.total_emission::numeric, 2) as emission_tco2e,
    'tCO2e' as unit,
    s.submission_date,
    g.verification_status
FROM ghg_emission_results g
JOIN companies c ON g.company_id = c.id
LEFT JOIN subsidiary_data_submissions s 
    ON s.subsidiary_company_id = c.id
    AND s.submission_year = g.year
    AND s.status = 'approved'
WHERE g.year = 2024
  AND g.scope = 'scope2'
  AND (
    c.id = '550e8400-e29b-41d4-a716-446655440000'
    OR (c.parent_company_id = '550e8400-e29b-41d4-a716-446655440000' AND s.id IS NOT NULL)
  )
ORDER BY source_type, c.company_name, g.site_name;
