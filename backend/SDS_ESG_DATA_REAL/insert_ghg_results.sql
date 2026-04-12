-- GHG 산정 결과 데이터 (발표 시연용)

-- 1. 오픈핸즈 주식회사 Scope 2 (전력)
INSERT INTO ghg_emission_results (
    id, company_id, year, scope, basis,
    co2_tco2e, ch4_tco2e, n2o_tco2e, total_emission,
    site_code, site_name, calculation_method,
    emission_factor, activity_data, activity_unit,
    data_quality, verification_status, source_company_id,
    created_at, updated_at
) VALUES (
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
);

-- 2. 오픈핸즈 Scope 3 (구매/폐기물/출장)
INSERT INTO ghg_emission_results (
    id, company_id, year, scope, basis,
    co2_tco2e, ch4_tco2e, n2o_tco2e, total_emission,
    site_code, site_name, calculation_method,
    data_quality, verification_status, source_company_id,
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'SUB-001',
    2024,
    'scope3',
    'location_based',
    3800,
    0,
    0,
    3800,
    NULL,
    NULL,
    'spend_based',
    'M2',
    '자가 검증',
    'SUB-001',
    '2024-03-10 10:00:00',
    '2024-03-10 10:00:00'
);

-- 3. 멀티캠퍼스 Scope 2 (전력) - 역삼
INSERT INTO ghg_emission_results (
    id, company_id, year, scope, basis,
    co2_tco2e, ch4_tco2e, n2o_tco2e, total_emission,
    site_code, site_name, calculation_method,
    emission_factor, activity_data, activity_unit,
    data_quality, verification_status, source_company_id,
    created_at, updated_at
) VALUES (
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
);

-- 4. 멀티캠퍼스 Scope 2 (전력) - 선릉
INSERT INTO ghg_emission_results (
    id, company_id, year, scope, basis,
    co2_tco2e, ch4_tco2e, n2o_tco2e, total_emission,
    site_code, site_name, calculation_method,
    emission_factor, activity_data, activity_unit,
    data_quality, verification_status, source_company_id,
    created_at, updated_at
) VALUES (
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
);

-- 5. 멀티캠퍼스 Scope 3 (구매/폐기물/출장)
INSERT INTO ghg_emission_results (
    id, company_id, year, scope, basis,
    co2_tco2e, ch4_tco2e, n2o_tco2e, total_emission,
    calculation_method,
    data_quality, verification_status, source_company_id,
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'SUB-003',
    2024,
    'scope3',
    'location_based',
    8900,
    0,
    0,
    8900,
    'spend_based',
    'M2',
    '자가 검증',
    'SUB-003',
    '2024-03-15 10:00:00',
    '2024-03-15 10:00:00'
);
