# IFRS 에이전트 통합 테스트 시나리오

**작성일**: 2026-04-05  
**목적**: 실 DB + Gemini 환경에서 전체 워크플로우 검증

---

## 1. 테스트 환경 설정

### 1.1 필수 구성

- **DB**: PostgreSQL (Alembic 마이그레이션 적용 완료)
  - `data_points`, `unified_column_mappings`, `rulebooks`
  - `environmental_data`, `social_data`, `governance_data`, `company_info`
  - `sr_report_body`, `sr_report_images`
  - `subsidiary_data_contributions`, `external_company_data`
  
- **API 키**:
  - `GEMINI_API_KEY`: dp_rag LLM 매핑, gen_node, validator_node
  - `OPENAI_API_KEY`: c_rag 후보 재선택 (선택적)

- **시드 데이터**:
  - `backend/scripts/seeds/governance_data_dummy.json` 적재
  - `backend/scripts/seeds/subsidiary_data_contributions_dummy.json` 적재
  - SR 본문·이미지 샘플 (최소 2024, 2023 연도)

### 1.2 환경 변수 (`.env`)

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/ifrs_agent
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key  # 선택적
SDS_NEWS_EMBED=false  # 테스트 시 임베딩 생략 가능
```

---

## 2. 테스트 시나리오

### 시나리오 1: 정량 DP (Scope 1 배출량)

**목적**: dp_rag 정량 경로 + gen_node 수치 문단 생성

**입력**:
```json
{
  "action": "create",
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "category": "기후변화",
  "dp_id": "ESRS2-E1-6"
}
```

**예상 흐름**:
1. `_check_dp_type_for_routing` → `dp_type=quantitative` → `dp_rag` 호출
2. `dp_rag`:
   - `query_dp_metadata` → DP 메타 조회
   - `query_ucm_by_dp` → UCM 조회
   - LLM 매핑 → `environmental_data.scope1_total_tco2e`
   - `query_dp_real_data` → 실데이터 조회
   - `query_company_info` → 회사 프로필
   - `_check_quantitative_suitability` → `suitability_warning=None`
3. `c_rag`: SR 본문·이미지 (2024, 2023)
4. `aggregation_node`: 계열사·외부 데이터 (스텁이면 빈 dict)
5. `gen_node`: `fact_data.value` + `unit` → "Scope 1 배출량: 473.9674 tCO2e"
6. `validator_node`: 통과 (스텁)

**검증 포인트**:
- `fact_data.value` != null
- `fact_data.suitability_warning` == null
- `fact_data.company_profile.company_name_ko` == "삼성에스디에스 주식회사"
- `generated_text`에 수치 포함

---

### 시나리오 2: 정성 DP (인센티브 여부·방법)

**목적**: 정성 DP → c_rag 라우팅 + narrative_data 처리

**입력**:
```json
{
  "action": "create",
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "category": "거버넌스",
  "dp_id": "UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i"
}
```

**예상 흐름**:
1. `_check_dp_type_for_routing`:
   - UCM 조회 → `column_description`에 "여부·방법" 감지
   - `is_quantitative=False`
2. `narrative_task` (c_rag 호출):
   - `narrative_query="인센티브 제도에 기후 고려 반영 여부·방법"`
   - SR 본문 벡터 검색 → 관련 문단 반환
3. `dp_rag` 생략 → `fact_data={}`
4. `gen_node`:
   - `narrative_data.body_text` 있음 → 서술 위주 문단
   - "[정성 DP 서술] 당사는 임원 보수에 기후 목표 달성률을 반영..."

**검증 포인트**:
- `fact_data == {}`
- `narrative_data.body_text` != ""
- `generated_text`에 서술 포함 (수치 없음)

---

### 시나리오 3: 정량 DP + 정성 신호 (suitability_warning)

**목적**: dp_rag 내부 적합성 경고 발생

**입력**:
```json
{
  "action": "create",
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "category": "사회",
  "dp_id": "SOME_QUAL_DP_WITH_QUANTITATIVE_TYPE"
}
```

**전제**: `dp_type=quantitative`이지만 rulebook에 "설명하시오" 포함

**예상 흐름**:
1. `_check_dp_type_for_routing` → `is_quantitative=True` → `dp_rag` 호출
2. `dp_rag`:
   - `_check_quantitative_suitability` → rulebook에 "설명" 감지
   - `suitability_warning="Rulebook suggests narrative disclosure"`
3. `gen_node`:
   - `fact_data.value` 있지만 `suitability_warning` 감지
   - 로그: "suitability_warning 감지 — ..."
   - 생성 텍스트에 경고 포함 가능

**검증 포인트**:
- `fact_data.value` != null
- `fact_data.suitability_warning` != null
- 로그에 경고 메시지

---

### 시나리오 4: DP 없음 (category만)

**목적**: dp_id 없이 category만으로 문단 생성

**입력**:
```json
{
  "action": "create",
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "category": "직원 역량개발"
}
```

**예상 흐름**:
1. `dp_id` 없음 → `dp_rag`, `narrative_task` 모두 생략
2. `c_rag`: category 기반 SR 본문·이미지
3. `gen_node`: `ref_data`만으로 문단 생성

**검증 포인트**:
- `fact_data == {}`
- `narrative_data == {}`
- `generated_text`에 SR 본문 참고 문구

---

### 시나리오 5: 사용자 수정 (refine)

**목적**: 경로 3 (refine) 검증

**입력**:
```json
{
  "action": "refine",
  "report_id": "uuid-123",
  "page_number": 1,
  "user_instruction": "수치를 더 강조해주세요"
}
```

**예상 흐름**:
1. `_refine_existing_report` 호출
2. 기존 페이지 로드 (DB 또는 캐시)
3. `gen_node` (refine_mode) → 사용자 지시 반영
4. `validator_node` (선택적)

**검증 포인트**:
- `metadata.mode == "refine"`
- `generated_text`에 수정 반영

---

## 3. 실행 방법

### 3.1 단위 테스트

```bash
# DP 라우팅 통합 테스트 (구현 완료 ✅)
pytest backend/domain/v1/ifrs_agent/tests/test_orchestrator_dp_routing_integration.py -v

# 특정 시나리오만
pytest backend/domain/v1/ifrs_agent/tests/test_orchestrator_dp_routing_integration.py::test_quantitative_dp_routing -v
```

### 3.2 E2E 테스트 (실 DB + API)

```bash
# FastAPI 서버 실행
cd backend
python main.py

# Postman / curl
curl -X POST http://localhost:8000/api/v1/ifrs-agent/reports/create \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "550e8400-e29b-41d4-a716-446655440001",
    "category": "기후변화",
    "dp_id": "ESRS2-E1-6"
  }'
```

### 3.3 로그 확인

```bash
# 오케스트레이터 로그
grep "orchestrator:" backend/logs/app.log

# dp_rag 로그
grep "dp_rag:" backend/logs/app.log

# gen_node 로그
grep "gen_node:" backend/logs/app.log
```

---

## 4. 체크리스트

### 4.1 사전 준비

- [ ] DB 마이그레이션 적용 (`alembic upgrade head`)
- [ ] 시드 데이터 적재 (`governance_data`, `subsidiary_data_contributions`)
- [ ] SR 본문·이미지 샘플 적재 (2024, 2023)
- [ ] `.env` 파일에 API 키 설정
- [ ] `bootstrap.py`에서 에이전트·툴 등록 확인

### 4.2 테스트 실행

- [ ] 시나리오 1 (정량 DP) 통과
- [ ] 시나리오 2 (정성 DP) 통과
- [ ] 시나리오 3 (suitability_warning) 통과
- [ ] 시나리오 4 (DP 없음) 통과
- [ ] 시나리오 5 (refine) 통과

### 4.3 결과 검증

- [ ] `fact_data` / `narrative_data` 구조 확인
- [ ] `suitability_warning` 필드 확인
- [ ] `company_profile` 포함 확인
- [ ] `generated_text` 품질 확인
- [ ] 로그에 에러 없음

---

## 5. 알려진 제한사항

1. **aggregation_node 스텁**: 계열사·외부 데이터는 빈 dict 반환 (실구현 필요).
2. **gen_node 스텁**: 간단한 텍스트만 생성 (실제 LLM 프롬프트 필요).
3. **validator_node 스텁**: 항상 통과 (실제 검증 로직 필요).
4. ~~**c_rag narrative_query**: c_rag가 이 파라미터를 처리하도록 수정 필요 (현재는 무시 가능).~~ ✅ **구현 완료** (2026-04-05)

---

## 6. 다음 단계

1. **실 DB 테스트 실행** → 시나리오 1~5 검증.
2. **gen_node 실구현** → Gemini 프롬프트 + `suitability_warning` 활용.
3. **aggregation_node 실구현** → 계열사·외부 데이터 조회.
4. **validator_node 실구현** → 룰 기반 또는 LLM 검증.

---

**최종 수정**: 2026-04-05
