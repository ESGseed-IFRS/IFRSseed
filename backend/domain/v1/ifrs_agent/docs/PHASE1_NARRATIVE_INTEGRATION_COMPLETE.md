# Phase 1: 정성 DP 처리 파이프라인 정합 완료

**완료일**: 2026-04-05  
**목적**: 오케스트레이터 → c_rag → gen_node까지 정성 DP 데이터 흐름 연결

---

## 구현 완료 요약

### ✅ 1. gen_node payload에 narrative_data 추가

**파일**: `hub/orchestrator/orchestrator.py`

**변경 위치**:
- `_generation_validation_loop` (draft 모드)
- `_refine_existing_report` (refine 모드)
- validator_node payload

**효과**: gen_node가 `narrative_data`를 받아 정성 DP 서술 처리 가능.

---

### ✅ 2. c_rag에서 narrative_query 반영

**파일**: `spokes/agents/c_rag/agent.py`

**변경 내용**:
```python
async def collect(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Args:
        narrative_query: str (선택)  # 정성 DP용 키워드 검색
    """
    narrative_query = payload.get("narrative_query")
    
    # _query_sr_body에 전달
    body_data = await self._query_sr_body(
        company_id, category, year, narrative_query=narrative_query
    )

async def _query_sr_body(..., narrative_query: Optional[str] = None):
    # narrative_query 우선, 없으면 category
    search_text = narrative_query if narrative_query else category
    
    # 벡터 검색 + LLM 재선택에 search_text 사용
```

**효과**:
- 정성 DP일 때 DP description으로 SR 본문 검색.
- 기존 category 기반 검색도 하위 호환 유지.

---

### ✅ 3. narrative_data 구조와 스텁/문서 정합

**파일**: `spokes/agents/stubs.py`

**변경 내용**:
```python
async def gen_node_stub(payload: Dict[str, Any]) -> Dict[str, Any]:
    narrative_data = payload.get("narrative_data", {})
    
    # c_rag 형태: {"2024": {...}, "2023": {...}}
    year_2024 = narrative_data.get("2024", {})
    year_2023 = narrative_data.get("2023", {})
    
    body_text = year_2024.get("sr_body") or year_2023.get("sr_body") or ""
    if body_text:
        text_parts.append(f"[정성 DP 서술] {body_text[:200]}...")
```

**효과**: `narrative_data`가 c_rag 반환 형태(`{"2024": {...}}`)와 일치.

---

### ✅ 4. pytest 통합 테스트 추가

**파일**: `tests/test_orchestrator_dp_routing_integration.py`

**10개 시나리오**:
1. 정량 DP 라우팅 체크
2. 정성 DP (UCM) 라우팅 체크
3. 정성 DP (data_points) 라우팅 체크
4. _parallel_collect (정량 DP)
5. _parallel_collect (정성 DP)
6. gen_node (fact_data)
7. gen_node (narrative_data)
8. gen_node (suitability_warning)
9. E2E (정량 DP)
10. E2E (정성 DP)

**실행**:
```bash
pytest backend/domain/v1/ifrs_agent/tests/test_orchestrator_dp_routing_integration.py -v
```

---

## 전체 데이터 흐름

### 정량 DP (예: Scope 1 배출량)

```
사용자 요청: dp_id="ESRS2-E1-6", category="기후변화"

오케스트레이터:
  _check_dp_type_for_routing → is_quantitative=True
  
  _parallel_collect:
    c_rag → ref_data (SR 본문·이미지)
    dp_rag → fact_data (value, unit, company_profile, suitability_warning)
    aggregation_node → agg_data
  
  _generation_validation_loop:
    gen_node.generate(ref_data, fact_data, narrative_data={}, agg_data)
      → fact_data.value 사용
      → "Scope 1 배출량: 473.9674 tCO2e"
    
    validator_node.validate(generated_text, fact_data, narrative_data)
      → is_valid=True
```

### 정성 DP (예: 인센티브 여부·방법)

```
사용자 요청: dp_id="UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i", category="거버넌스"

오케스트레이터:
  _check_dp_type_for_routing
    → UCM description에 "여부·방법" 감지
    → is_quantitative=False
  
  _parallel_collect:
    c_rag (첫 번째) → ref_data (category="거버넌스")
    narrative_task (c_rag 두 번째) → narrative_data
      → narrative_query="인센티브 제도에 기후 고려 반영 여부·방법"
      → SR 본문 벡터 검색
      → {"2024": {"sr_body": "당사는 임원 보수에...", "page_number": 12}}
    dp_rag 생략 → fact_data={}
    aggregation_node → agg_data
  
  _generation_validation_loop:
    gen_node.generate(ref_data, fact_data={}, narrative_data, agg_data)
      → narrative_data["2024"]["sr_body"] 사용
      → "[정성 DP 서술] 당사는 임원 보수에..."
    
    validator_node.validate(generated_text, fact_data={}, narrative_data)
      → is_valid=True
```

---

## 파일 변경 요약 (Phase 1 정합)

| 파일 | 변경 내용 |
|------|----------|
| `orchestrator/orchestrator.py` | gen_node/validator payload에 `narrative_data` 추가 (3곳) |
| `c_rag/agent.py` | `narrative_query` 파라미터 처리 (collect, _query_sr_body) |
| `stubs.py` | gen_node_stub이 c_rag 형태 `narrative_data` 처리 |
| `tests/test_orchestrator_dp_routing_integration.py` | **신규**, 10개 시나리오 |
| `tests/__init__.py`, `tests/README.md` | **신규**, 테스트 가이드 |
| `docs/INTEGRATION_TEST_SCENARIOS.md` | pytest 실행 방법 업데이트 |
| `docs/IMPLEMENTATION_SUMMARY_2026_04_05.md` | §8 Phase 1 정합 절 추가 |
| `docs/NEW_CHAT_CONTEXT.md` | §6, §7 업데이트 |

---

## 다음 단계

### 즉시

- [ ] 실 DB 환경에서 pytest 실행
- [ ] 시나리오 실패 케이스 디버깅

### 단기

- [ ] gen_node 실구현 (Gemini 프롬프트)
- [ ] aggregation_node 실구현
- [ ] validator_node 실구현

### 중기

- [ ] 정성 DP 전용 폼 (`qualitative_dp_responses`)
- [ ] 정책 문서 벡터 DB

### 장기

- [ ] narrative_rag 에이전트 (SR·폼·문서 통합)

---

**최종 수정**: 2026-04-05  
**상태**: Phase 1 정합 완료 ✅
