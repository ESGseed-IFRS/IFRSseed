-- 더미 데이터: external_company_data
-- 사전 조건: alembic 037_subs_ext_company_data 적용됨, 아래 anchor_company_id가 companies.id에 존재
-- 적용: psql "$DATABASE_URL" -f backend/scripts/seeds/external_company_data_dummy.sql

BEGIN;

-- 샘플·로컬에서 쓰던 모회사 UUID — 없으면 실제 companies.id로 바꿔서 실행
-- 550e8400-e29b-41d4-a716-446655440001
INSERT INTO external_company_data (
    anchor_company_id,
    external_org_name,
    source_type,
    source_url,
    report_year,
    as_of_date,
    category,
    category_embedding,
    title,
    body_text,
    body_embedding,
    structured_payload,
    related_dp_ids,
    ingest_batch_id
)
VALUES
(
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    '한국그린에너지솔루션 주식회사',
    'dart_disclosure',
    'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20240315001234',
    2024,
    '2024-03-15',
    '협력회사 ESG 관리',
    NULL,
    '사업보고서 (2023.12.31)',
    '온실가스 배출량 Scope2 위치기반 기준 전년 대비 8.2% 감축. 재생에너지 사용 비율 42% 달성.',
    NULL,
    '{"rcept_no": "20240315001234", "report_nm": "사업보고서", "currency": "KRW"}'::jsonb,
    ARRAY['DP-GHG-SCOPE2', 'DP-ENV-RENEWABLE']::text[],
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid
),
(
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    '동아일보',
    'news',
    'https://example-news.co.kr/articles/esg/20241201-001',
    2024,
    '2024-12-01',
    '기후 리스크',
    NULL,
    '동종 업계, TCFD 시나리오 분석 의무화 대비',
    '금융당국은 내년부터 상장사 대상 기후 스트레스 테스트 가이드라인을 시범 적용할 예정이라고 밝혔다.',
    NULL,
    '{"publisher": "동아일보", "section": "경제", "sentiment": "neutral"}'::jsonb,
    ARRAY['DP-GOV-CLIMATE-RISK']::text[],
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid
),
(
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    '글로벌서플라이체인 파트너스',
    'homepage',
    'https://www.example-gscp.com/sustainability',
    NULL,
    '2025-01-10',
    '공급망 인권',
    NULL,
    '지속가능경영 | 공급망 실사',
    '전 협력사 대상 RBA 기반 자가진단 설문을 연 1회 실시하며, 고위험 15개사는 현장 실사를 진행합니다.',
    NULL,
    '{"page_lang": "ko", "last_crawled": "2025-01-10"}'::jsonb,
    ARRAY['DP-SOCIAL-SUPPLY-CHAIN', 'DP-HR-DIVERSITY']::text[],
    'b2c3d4e5-f6a7-8901-bcde-f12345678901'::uuid
),
(
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    '환경부',
    'regulator',
    'https://www.me.go.kr/home/web/main.do',
    2024,
    '2024-06-20',
    '환경 규제',
    NULL,
    '2024년 상반기 환경법 위반 과징금 현황 보도자료',
    '대기·수질 배출 기준 위반에 대한 과징금 부과 건수는 전년 동기 대비 소폭 감소한 것으로 집계되었다.',
    NULL,
    '{"agency_code": "ME", "doc_type": "press_release"}'::jsonb,
    ARRAY['DP-ENV-COMPLIANCE']::text[],
    'b2c3d4e5-f6a7-8901-bcde-f12345678901'::uuid
),
(
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    '테크비전 반도체',
    'dart_disclosure',
    'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20240520009999',
    2023,
    '2024-05-20',
    '이사회·지배구조',
    NULL,
    '분기보고서 (2024.03.31) — 이사회 운영',
    '당분기 이사회 4회 개최, 사외이사 출석률 100%. ESG위원회 신설 안건 상정.',
    NULL,
    '{"rcept_no": "20240520009999", "period_end": "2024-03-31"}'::jsonb,
    ARRAY['DP-GOV-BOARD', 'DP-GOV-ESG-COMMITTEE']::text[],
    'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid
);

-- 선택: category_embedding 한 건만 채워 HNSW/유사도 테스트 (1024차원 더미 벡터)
UPDATE external_company_data
SET category_embedding = sub.v
FROM (
    SELECT ('[' || string_agg('0.001', ',') || ']')::vector AS v
    FROM generate_series(1, 1024)
) sub
WHERE source_url = 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20240315001234';

COMMIT;
