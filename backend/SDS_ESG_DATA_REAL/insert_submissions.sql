-- 계열사 데이터 제출 이력 (발표 시연용)

-- 1. 오픈핸즈: 승인 완료 (시연용 - 이미 승인된 상태)
INSERT INTO subsidiary_data_submissions (
    id, subsidiary_company_id, holding_company_id,
    submission_year, submission_quarter, submission_date,
    scope_1_submitted, scope_2_submitted, scope_3_submitted,
    status, reviewed_by, reviewed_at, rejection_reason,
    staging_row_count, total_emission_tco2e,
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'SUB-001',
    '550e8400-e29b-41d4-a716-446655440000',
    2024,
    NULL,
    '2024-03-12 14:30:00',
    false,
    true,
    true,
    'approved',
    NULL,  -- 실제 시연 시 reviewer user_id로 변경
    '2024-03-13 09:15:00',
    NULL,
    12,
    4175.4,
    '2024-03-12 14:30:00',
    '2024-03-13 09:15:00'
);

-- 2. 멀티캠퍼스: 제출 대기 (시연용 - 승인할 대상)
INSERT INTO subsidiary_data_submissions (
    id, subsidiary_company_id, holding_company_id,
    submission_year, submission_quarter, submission_date,
    scope_1_submitted, scope_2_submitted, scope_3_submitted,
    status, reviewed_by, reviewed_at, rejection_reason,
    staging_row_count, total_emission_tco2e,
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'SUB-003',
    '550e8400-e29b-41d4-a716-446655440000',
    2024,
    NULL,
    '2024-03-20 16:45:00',
    false,
    true,
    true,
    'submitted',
    NULL,
    NULL,
    NULL,
    48,
    12249.0,
    '2024-03-20 16:45:00',
    '2024-03-20 16:45:00'
);

-- 3. 오픈핸즈: 2023년 승인 완료 (과거 이력)
INSERT INTO subsidiary_data_submissions (
    id, subsidiary_company_id, holding_company_id,
    submission_year, submission_quarter, submission_date,
    scope_1_submitted, scope_2_submitted, scope_3_submitted,
    status, reviewed_by, reviewed_at, rejection_reason,
    staging_row_count, total_emission_tco2e,
    created_at, updated_at
) VALUES (
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
