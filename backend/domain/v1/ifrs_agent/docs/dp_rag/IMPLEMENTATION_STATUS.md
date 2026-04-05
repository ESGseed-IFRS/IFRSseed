# dp_rag 구현 완료 (Phase 1 + Phase 2)

**구현 일자**: 2026-04-04  
**최종 업데이트**: 2026-04-05  
**상태**: Phase 1 + Phase 2 + Phase 3 완료

---

## 구현 요약

`dp_rag`는 **사용자 선택 DP의 최신 실데이터 값**을 조회하는 에이전트입니다. UCM에 물리 테이블·컬럼 정보가 없는 상황에서 **LLM 기반 매핑 + 화이트리스트**로 안전하게 구현했습니다.

---

## Phase 1: 기본 구현 ✅

### 1. GovernanceData ORM
- `backend/domain/v1/esg_data/models/bases/governance_data.py`
- Alembic 019 스키마와 정합 (board/compliance/ethics/risk)
- `__init__.py` export 추가

### 2. 화이트리스트
- `backend/domain/v1/ifrs_agent/spokes/agents/dp_rag/allowlist.py`
- `SOCIAL_DATA_COLUMNS` (data_type별: workforce/safety/supply_chain/community)
- `ENVIRONMENTAL_DATA_COLUMNS` (GHG, 에너지, 폐기물, 용수, 대기)
- `GOVERNANCE_DATA_COLUMNS` (data_type별: board/compliance/ethics/risk)
- `get_allowlist_for_category(E/S/G)` — 카테고리로 후보 필터
- `validate_selection()` — LLM 결과 화이트리스트 검증

### 3. 에이전트
- `backend/domain/v1/ifrs_agent/spokes/agents/dp_rag/agent.py`
- `DpRagAgent.collect()` — DP ID → 실데이터 파이프라인
- **Gemini 2.5 Flash** (`gemini-2.5-flash`, `google.generativeai`) — 테이블·컬럼 매핑. `.env`: `DP_RAG_GEMINI_MODEL`로 변경 가능
- 폴백: API 키 없거나 파싱 실패 시 첫 후보 사용

### 4. 툴
- `query_dp_metadata` — `data_points` 조회
- `query_ucm_by_dp` — UCM 조회 (`mapped_dp_ids`)
- `query_dp_real_data` — E/S/G 실데이터 조회 (템플릿 쿼리)
- **`query_company_info`** — `company_info` 1행 (DP 비의존, 맥락용; 전화·이메일·주소 미포함)
- 기존 `query_dp_data` → deprecated

### 5. Bootstrap
- `hub/bootstrap.py`에 에이전트·툴 등록 완료

### 6. `company_info` (2026-04-05)
- `dp_query.query_company_info` + `bootstrap` 등록
- `DpRagAgent.collect`가 매 호출 시 `company_profile` 필드로 병합 (행 없음·오류 시 `null`)

---

## Phase 3: DP 유형 라우팅 + 적합성 경고 ✅ (2026-04-05)

### 1. 오케스트레이터 선행 체크 (제안 B)
- `orchestrator._check_dp_type_for_routing(dp_id)` 메서드 추가
- `data_points.dp_type` 또는 UCM description 키워드로 정량/정성 판단
- **`dp_type=quantitative`만 `dp_rag` 호출**, 나머지는 생략 (TODO: narrative_rag로 라우팅)
- 로그: "DP is quantitative — calling dp_rag" / "NOT quantitative — skipping"

### 2. dp_rag 내부 적합성 경고 (제안 A)
- `DpRagAgent._check_quantitative_suitability()` 메서드 추가
- rulebook·UCM description에서 정성 키워드 감지 ("여부", "방법", "설명", "공개" 등)
- `dp_type`이 `qualitative` / `narrative` / `binary`면 경고
- 응답에 `suitability_warning` 필드 추가 (없으면 `null`)

### 3. 동작 흐름

```
오케스트레이터:
  dp_id 있음 → _check_dp_type_for_routing
    → quantitative: dp_rag 호출
    → 정성: 생략 (fact_data = {})

dp_rag (quantitative만 도달):
  rulebook·UCM 조회
  → _check_quantitative_suitability
    → 정성 신호 감지 시 suitability_warning 반환
  → 실데이터 조회·검증
  → 응답에 suitability_warning 포함
```

---

## Phase 2: 고도화 ✅

### 1. 캐싱
- `backend/domain/v1/ifrs_agent/spokes/agents/dp_rag/cache.py`
- **파일 캐시** (`dp_mapping_cache.json`) — 검증된 고정 매핑
- **메모리 캐시** — 런타임 LLM 결과 (confidence >= 0.8)
- 우선순위: 파일 > 메모리 > LLM

### 2. Validation Rules
- `_validate_value()` — min/max/type 체크
- `validation_rules`는 `data_points` 또는 UCM에서 가져옴
- 실패 시 `validation_error` 필드에 메시지 (값은 그대로 반환)

### 3. Unmapped Data Points
- `query_unmapped_dp` 툴 추가
- `_query_ucm_by_dp()` — UCM 없으면 자동으로 unmapped 조회
- unmapped 메타를 UCM 형식으로 변환 (`_unmapped: true` 마킹)

### 4. Confidence 임계값
- `confidence < 0.5` 경고 로그
- `confidence >= 0.8` 자동 캐싱
- 반환 객체에 `confidence` 포함

---

## 핵심 전략 정리

### LLM 기반 안전 매핑
1. **화이트리스트만 후보로 제공** — SQL 인젝션 원천 차단
2. **E/S/G로 1차 필터** — 토큰 절약, 정확도 향상
3. **검증 2단계** — LLM 출력 → 화이트리스트 재검증
4. **캐싱** — 동일 DP 재호출 시 LLM 생략

### social_data / governance_data 특수 처리
- 테이블만으로 부족 → **`data_type` 필수**
- LLM 출력에 `data_type` 포함 강제
- 템플릿 쿼리에 `AND data_type = $3`

### 폴백 체계
```
파일 캐시(verified) 
  → 메모리 캐시(LLM 결과)
    → LLM 호출
      → 파싱 실패 시 첫 후보
        → API 키 없으면 첫 후보
```

---

## 테스트 시나리오

### 1. 정상 흐름
```python
# 입력
payload = {
    "company_id": "uuid-123",
    "dp_id": "IFRS_S2_XX",
    "year": 2025,
    "runtime_config": {"gemini_api_key": "..."}
}

# 출력 (개선됨 ✨)
{
    "dp_id": "IFRS_S2_XX",
    "value": 1500,
    "unit": "명",
    "year": 2025,
    
    "dp_metadata": {
        "name_ko": "총 직원 수",
        "description": "전체 임직원 수",
        "topic": "사회",
        "subtopic": "직원 현황",
        "category": "S",
        "dp_type": "quantitative"
    },
    
    "ucm": {
        "column_name_ko": "총 직원 수",
        "column_topic": "사회",
        "column_description": "전체 임직원 수",
        "validation_rules": {"min": 0, "type": "integer"},
        "disclosure_requirement": "필수"
    },
    
    "source": {
        "table": "social_data",
        "column": "total_employees",
        "data_type": "workforce"
    },
    
    "confidence": 0.95,
    "validation_passed": true,
    "is_outdated": false,
    "validation_error": null,
    "suitability_warning": null,  // 또는 "DP type is 'qualitative' — ..."
    "company_profile": {
        "company_id": "...",
        "company_name_ko": "...",
        "mission": "...",
        "vision": "..."
    }
}
```

### 2. 캐시 히트
- 첫 호출: LLM 실행 → 메모리 캐시 저장
- 두 번째 호출: 메모리 캐시에서 즉시 반환 (LLM 생략)

### 3. Unmapped DP
- `data_points`에 있지만 UCM 없음
- `unmapped_data_points`에서 메타 조회
- LLM은 동일하게 allowlist에서 선택

### 4. 에러 케이스
- DP 없음 → `{"error": "DP not found"}`
- 데이터 없음 → `{"value": null, "error": "No data for year 2025"}`
- Validation 실패 → `{"validation_error": "Value exceeds maximum"}`

---

## ✅ Phase 3: 오케스트레이터 통합 (완료)

### 구현된 파일

1. **orchestrator.py** (`_parallel_collect` 수정)
   - `dp_id`가 있을 때만 `dp_rag` 호출 (선택적)
   - payload 형식: `{company_id, dp_id, year}`
   - `asyncio.gather`로 c_rag, dp_rag, aggregation_node 병렬 실행
   - 예외 처리: 각 에이전트 실패 시 빈 dict 반환

2. **router.py** (`_build_create_references`)
   - `fact_data` 포함하여 references 구성
   - API 응답에 dp_rag 결과 노출

### API 요청 예시

```bash
POST /api/v1/ifrs-agent/reports/create
{
  "company_id": "c12345",
  "category": "직원 역량개발",
  "dp_id": "S1-1"  // 선택적
}
```

### 응답 구조

```json
{
  "workflow_id": "...",
  "status": "success",
  "generated_text": "...",
  "references": {
    "sr_data": {...},
    "fact_data": {
      "dp_id": "S1-1",
      "value": 1234.5,
      "unit": "명",
      "source": {...},
      "confidence": 0.95
    }
  }
}
```

### 테스트 문서

- `backend/domain/v1/ifrs_agent/docs/dp_rag/TEST_SCENARIOS.md`

---

## 다음 단계 (Phase 4)

- [ ] 실제 DB·Gemini로 통합 테스트
- [ ] 관리자 UI (매핑 검증·수정)
- [ ] 성능 모니터링 (LLM 호출 빈도, 캐시 히트율)
- [ ] aggregation_node, gen_node, validator_node 실제 구현

---

**최종 수정**: 2026-04-05  

---

## 다음 단계 (Phase 4)

- [ ] 정성 DP 전용 노드 (`narrative_rag`) 또는 c_rag 통합
- [ ] gen_node에서 `suitability_warning` 활용 (수치 외 서술 요청)
- [ ] 실제 DB·Gemini로 통합 테스트
