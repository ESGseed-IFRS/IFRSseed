```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Orchestrator (Phase 제어)                             │
│                                                                         │
│  Phase 0: 프롬프트 해석 (Gemini 2.5 pro)                                │
│    ↓ search_intent, content_focus, needs_external_data, keywords        │
│                                                                         │
│  Phase 1: 병렬 데이터 수집 (asyncio.gather)                               │
│    ├─→ c_rag: SR 본문 + 이미지 (벡터 검색 → LLM 재선택)                     │
│    ├─→ dp_rag: 최신 DP 값 (LLM 물리 위치 결정 → 템플릿 쿼리)                 │
│    └─→ aggregation_node: 계열사·외부 데이터 (조건부 실행)              │
│                                                                         │
│  Phase 1.5: DP 계층 검증 (멀티 DP 전용)                                 │
│    ↓ 부모-자식 DP 일관성 체크                                           │
│                                                                         │
│  Phase 2: 데이터 선택 및 필터링 (Gemini 2.5 Flash, JSON mode)          │
│    ↓ company_profile, dp_metadata, ucm, rulebook 등 선택               │
│                                                                         │
│  Phase 3: 생성-검증 루프 (최대 3회)                                     │
│    ├─→ gen_node: 문단 생성 (Gemini 2.5 pro)                                │
│    ├─→ validator_node: 품질 검증 (규칙 + Gemini 2.5 pro)             │
│    └─→ 재시도 (validator 피드백 → gen_node)                            │
│                                                                         │
│  Phase 4: 최종 결과 통합                                                │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│      c_rag           │  │      dp_rag          │  │  aggregation_node    │
│                      │  │                      │  │                      │
│ 데이터 소스:           │  │ 데이터 소스:           │  │ 데이터 소스:          │
│ • sr_report_body     │  │ • data_points        │  │ • subsidiary_data_   │
│ • sr_report_images   │  │ • unified_column_    │  │   contributions      │
│ • historical_sr_     │  │   mappings           │  │ • external_company_  │
│   reports            │  │ • social_data        │  │   data               │
│                      │  │ • environmental_data │  │                      │
│ 검색 방식:             │  │ • governance_data    │  │ 검색 방식:            │
│ 1. 벡터 유사도         │  │ • company_info       │  │ A. Subsidiary        │
│    (BGE-M3, top_k=4) │  │                      │  │    • category_       │
│ 2. LLM 재선택        │  │ 검색 방식:           │  │      embedding         │
│    (OpenAI Chat)     │  │ 1. DP ID 정확 매칭   │  │    • 정확 매칭 →       │
│ 3. 페이지 직접 지정    │  │ 2. 화이트리스트 생성 │  │      벡터 유사도       │
│    (ref_pages 있을 때│  │    (column_category) │  │    • 임계값: 0.5     │
│     벡터·LLM 생략)   │  │ 3. LLM 물리 위치     │  │                      │
│                      │  │    결정 (Gemini)     │  │ B. External (조건부) │
│ 출력:                │  │ 4. 템플릿 쿼리 실행  │  │    • body_embedding     │
│ • SR 본문 (연도별)     │  │ 5. 정량 적합성 체크    │  │    • 프롬프트 기반     │
│ • 이미지 메타          │  │                      │  │    • 키워드 부스팅     │
│   (최대 5개)           │  │ 출력:                │  │                      │
│ • page_number        │  │ • 최신 DP 값          │  │ 출력:                 │
│ • report_id          │  │ • suitability_warning│  │ • 사업장별 상세        │
│                      │  │ • is_outdated        │  │ • 언론보도 스냅샷      │
│                      │  │ • source             │  │   (연도별 묶음)       │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────────┐
                    │     Phase 2: 데이터 선택 및 필터링      │
                    │                                         │
                    │  LLM 프롬프트:                          │
                    │  • 카테고리, DP 명칭, DP 유형           │
                    │  • SR 본문 미리보기 (500자)             │
                    │  • 사용 가능한 데이터 목록              │
                    │                                         │
                    │  LLM 출력 (JSON):                       │
                    │  {                                      │
                    │    "include_company_profile": true,     │
                    │    "include_dp_metadata": true,         │
                    │    "include_ucm": false,                │
                    │    "include_rulebook": true,            │
                    │    "include_subsidiary_data": false,    │
                    │    "include_external_data": false,      │
                    │    "rationale": "선택 이유"             │
                    │  }                                      │
                    └──────────────┬──────────────────────────┘
                                   │
                        ┌──────────▼──────────────┐
                        │      gen_node           │
                        │                         │
                        │ 입력 (gen_input):       │
                        │ • ref_2024 / ref_2023   │
                        │   (SR 본문 + 이미지)    │
                        │ • fact_data (최신 DP)   │
                        │ • agg_data (계열사·외부)│
                        │ • Phase 2 선택 데이터   │
                        │ • validator_feedback    │
                        │   (재시도 시)           │
                        │                         │
                        │ 프롬프트 구조 (4 Block):│
                        │ 1. 페르소나             │
                        │ 2. 참조 데이터 (2년치)  │
                        │ 3. DP 데이터            │
                        │ 4. 생성 지시            │
                        │                         │
                        │ 출력:                   │
                        │ • generated_text        │
                        │ • recommended_images    │
                        │ • references            │
                        │ • rationale             │
                        └──────────┬──────────────┘
                                   │
                        ┌──────────▼──────────────┐
                        │   validator_node        │
                        │                         │
                        │ 검증 파이프라인:          │
                        │ 1. 규칙 기반 검증         │
                        │    • DP 수치 체크        │
                        │      (정규표현식)        │
                        │    • 금지 키워드         │
                        │      (그린워싱)          │
                        │    • 길이 체크           │
                        │      (100~1000자)       │
                        │                         │
                        │ 2. LLM 기반 검증         │
                        │    (Gemini 2.5 Flash)   │
                        │    • DP 규칙 준수        │
                        │    • 형식 일관성         │
                        │    • 논리적 일관성        │
                        │                         │
                        │ 출력:                    │
                        │ • is_valid (bool)       │
                        │ • errors (list, 한국어)  │
                        │ • warnings (선택적)      │
                        └─────────────────────────┘
                                   │
                                   ▼
                        ┌─────────────────────────┐
                        │  Phase 3: 재시도 판단     │
                        │                         │
                        │  if is_valid:           │
                        │    → Phase 4 (종료)      │
                        │  else:                  │
                        │    → gen_node (재시도)   │
                        │       with feedback     │
                        │                         │
                        │  최대 3회 시도            │
                        └─────────────────────────┘
```



프론트에서 
{
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "category": "기후변화 대응 온실가스 배출량 관리",
  "prompt": "",
  "dp_ids": ["ESRSE1-E1-6-44-a","ESRSE1-E1-6-44-b","ESRSE1-E1-6-44-c","ESRSE1-E1-6-51","ESRSE1-E1-6-45-c","ESRS2-MDR-A-68-a","ESRS2-BP-2-10-b","GRI305-1-a","IFRS2-29-a-i-1","GRI305-2-a","IFRS2-29-a-i-2","GRI305-3-a","IFRS2-29-a-i-3","GRI305-3-d","IFRS2-29-a-vi-1","IFRS2-29-a-iii-1"],
  "ref_pages": {},
  "max_retries": 3
} 로 요청을 보내면 제일먼저 orchestrator가 받고 받은값을 각각 dp_rag(dp_ids) , c_rag(category) , agg_node(category , prompt)에게 전달 
 

