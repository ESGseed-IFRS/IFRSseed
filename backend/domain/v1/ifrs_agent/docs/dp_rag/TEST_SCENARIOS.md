# DP RAG 테스트 시나리오

## 개요

`dp_rag` 에이전트의 통합 테스트 시나리오입니다. 실제 DB 연동 전에 코드 레벨에서 검증할 수 있는 항목들을 정리했습니다.

---

## 1. 단위 테스트

### 1.1 Whitelist 검증

**테스트 파일**: `backend/domain/v1/ifrs_agent/spokes/agents/dp_rag/allowlist.py`

```python
from backend.domain.v1.ifrs_agent.spokes.agents.dp_rag.allowlist import (
    get_allowlist_for_category,
    validate_selection
)

# 테스트 1: 카테고리별 컬럼 필터링
social_cols = get_allowlist_for_category("S")
assert len(social_cols) > 0
assert social_cols[0]["table"] == "social_data"

# 테스트 2: 유효한 선택 검증
assert validate_selection("social_data", "total_employees", "workforce") == True
assert validate_selection("environmental_data", "total_energy_consumption", None) == True

# 테스트 3: 무효한 선택 검증
assert validate_selection("fake_table", "fake_column", None) == False
assert validate_selection("social_data", "fake_column", "workforce") == False
```

### 1.2 캐시 기능

**테스트 파일**: `backend/domain/v1/ifrs_agent/spokes/agents/dp_rag/cache.py`

```python
from backend.domain.v1.ifrs_agent.spokes.agents.dp_rag.cache import get_cache

cache = get_cache()

# 테스트 1: 캐시 저장 및 조회
cache.set("S1-1", "social_data", "total_employees", "workforce", confidence=0.9, verified=True)
result = cache.get("S1-1")
assert result is not None
assert result["table"] == "social_data"
assert result["column"] == "total_employees"

# 테스트 2: 파일 캐시 로드
cache.clear_memory()
result = cache.get("S1-1")  # 파일에서 로드되어야 함
assert result is not None if "S1-1" in dp_mapping_cache.json

# 테스트 3: 캐시 무효화
cache.invalidate("S1-1")
result = cache.get("S1-1")
assert result is None
```

---

## 2. 통합 테스트

### 2.0 `company_info` 조회 (`query_company_info`)

**전제**: `company_info`에 해당 `company_id` 행이 있음.

```python
import asyncio
from backend.domain.shared.tool.ifrs_agent.database.dp_query import query_company_info

async def test_query_company_info():
    row = await query_company_info({"company_id": "<uuid>"})
    assert row is None or "company_name_ko" in row
    assert "phone" not in row  # 연락처는 스펙상 미포함
    assert "email" not in row

asyncio.run(test_query_company_info())
```

**dp_rag**: `collect` 응답에 `company_profile` 키가 항상 있어야 하며, DB에 행이 없으면 `null`일 수 있음.

### 2.1 DP 메타데이터 조회

**전제조건**: `data_points` 테이블에 테스트 데이터 존재

```python
import asyncio
from backend.domain.shared.tool.ifrs_agent.database.dp_query import query_dp_metadata

async def test_query_dp_metadata():
    result = await query_dp_metadata({"dp_id": "S1-1"})
    
    assert result is not None
    assert result.get("dp_id") == "S1-1"
    assert "description" in result
    assert "topic" in result
    assert "sub_topic" in result

asyncio.run(test_query_dp_metadata())
```

### 2.2 UCM 조회

**전제조건**: `unified_column_mappings` 테이블에 테스트 데이터 존재

```python
from backend.domain.shared.tool.ifrs_agent.database.dp_query import query_ucm_by_dp

async def test_query_ucm_by_dp():
    result = await query_ucm_by_dp({"dp_id": "S1-1"})
    
    # S1-1이 UCM에 있는 경우
    if result:
        assert "ucm_id" in result
        assert "column_name" in result
        assert "validation_rules" in result
    
    # S1-1이 unmapped인 경우 (폴백 테스트는 agent.py에서)
    else:
        print("S1-1은 UCM에 없음 → unmapped_data_points 폴백 필요")

asyncio.run(test_query_ucm_by_dp())
```

### 2.3 실데이터 조회

**전제조건**: `social_data`, `environmental_data`, `governance_data` 테이블에 테스트 데이터 존재

```python
from backend.domain.shared.tool.ifrs_agent.database.dp_query import query_dp_real_data

async def test_query_dp_real_data():
    # 테스트 1: social_data (data_type 필요)
    result = await query_dp_real_data({
        "table": "social_data",
        "column": "total_employees",
        "data_type": "workforce",
        "company_id": "c12345",
        "year": 2025
    })
    
    assert "value" in result or "error" in result
    
    # 테스트 2: environmental_data (data_type 불필요)
    result = await query_dp_real_data({
        "table": "environmental_data",
        "column": "total_energy_consumption",
        "company_id": "c12345",
        "year": 2025
    })
    
    assert "value" in result or "error" in result

asyncio.run(test_query_dp_real_data())
```

---

## 3. End-to-End 테스트

### 3.1 dp_rag 에이전트 직접 호출

```python
from backend.domain.v1.ifrs_agent.hub.bootstrap import get_infra

async def test_dp_rag_agent():
    infra = get_infra()
    
    payload = {
        "company_id": "c12345",
        "dp_id": "S1-1",
        "year": 2025,
        "runtime_config": {
            "gemini_api_key": "YOUR_KEY"  # .env에서 자동 로드됨
        }
    }
    
    result = await infra.call_agent("dp_rag", "collect", payload)
    
    print("DP RAG 결과:")
    print(f"  dp_id: {result.get('dp_id')}")
    print(f"  value: {result.get('value')}")
    print(f"  unit: {result.get('unit')}")
    print(f"  confidence: {result.get('confidence')}")
    print(f"  warnings: {result.get('warnings')}")
    print(f"  error: {result.get('error')}")

asyncio.run(test_dp_rag_agent())
```

### 3.2 전체 워크플로우 (create report)

**API 요청**:

```bash
curl -X POST "http://localhost:8000/api/v1/ifrs-agent/reports/create" \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "c12345",
    "category": "직원 역량개발",
    "dp_id": "S1-1"
  }'
```

**기대 응답**:

```json
{
  "workflow_id": "...",
  "status": "success",
  "generated_text": "...",
  "references": {
    "sr_data": {
      "2024": {...},
      "2023": {...}
    },
    "fact_data": {
      "dp_id": "S1-1",
      "value": 1500,
      "unit": "명",
      "source": {
        "table": "social_data",
        "column": "total_employees",
        "data_type": "workforce"
      },
      "confidence": 0.95,
      "is_outdated": false,
      "validation_passed": true
    }
  }
}
```

---

## 4. 에러 시나리오 테스트

### 4.1 DP가 존재하지 않는 경우

```python
payload = {
    "company_id": "c12345",
    "dp_id": "INVALID_DP",
    "year": 2025
}

result = await infra.call_agent("dp_rag", "collect", payload)
assert "error" in result
assert "not found" in result["error"].lower()
```

### 4.2 LLM API 키가 없는 경우

```python
# .env에서 GEMINI_API_KEY 제거 또는 빈 문자열
payload = {
    "company_id": "c12345",
    "dp_id": "S1-1",
    "year": 2025
}

result = await infra.call_agent("dp_rag", "collect", payload)
# 폴백: 캐시만 사용 또는 에러
assert result.get("confidence", 0) <= 0.7 or "error" in result
```

### 4.3 LLM이 잘못된 매핑 반환

```python
# allowlist에 없는 table/column을 LLM이 반환한 경우
# → validate_selection에서 False → 에러 반환

result = await infra.call_agent("dp_rag", "collect", payload)
assert "error" in result or result.get("confidence", 0) < 0.8
```

### 4.4 실데이터가 없는 경우

```python
# table/column 매핑은 성공했으나, 해당 company_id/year 데이터가 없음
result = await infra.call_agent("dp_rag", "collect", payload)
assert result.get("value") is None
assert "not found" in result.get("warnings", [])
```

---

## 5. 성능 테스트

### 5.1 캐시 히트율

```python
import time

# 10개의 DP에 대해 반복 조회
dp_ids = [f"S1-{i}" for i in range(1, 11)]

start = time.time()
for dp_id in dp_ids:
    await infra.call_agent("dp_rag", "collect", {"company_id": "c12345", "dp_id": dp_id, "year": 2025})
first_run = time.time() - start

# 캐시에서 재조회
start = time.time()
for dp_id in dp_ids:
    await infra.call_agent("dp_rag", "collect", {"company_id": "c12345", "dp_id": dp_id, "year": 2025})
second_run = time.time() - start

print(f"First run: {first_run:.2f}s")
print(f"Second run (cached): {second_run:.2f}s")
print(f"Speedup: {first_run / second_run:.2f}x")
```

### 5.2 병렬 수집 시간

```python
# c_rag + dp_rag + aggregation_node 병렬 실행 시간 측정
start = time.time()
result = await orchestrator._parallel_collect({
    "company_id": "c12345",
    "category": "직원 역량개발",
    "dp_id": "S1-1"
})
elapsed = time.time() - start

print(f"Parallel collection time: {elapsed:.2f}s")
print(f"c_rag result: {bool(result['ref_data'])}")
print(f"dp_rag result: {bool(result['fact_data'])}")
print(f"agg_data result: {bool(result['agg_data'])}")
```

---

## 6. 체크리스트

### Phase 3 완료 확인

- [x] orchestrator.py에서 dp_rag 호출 추가 (`dp_id` 있을 때만)
- [x] workflow.py에서 fact_data references에 병합
- [x] router.py에서 API 응답에 fact_data 포함
- [x] bootstrap.py에서 dp_rag 에이전트 등록 확인
- [x] bootstrap.py에서 dp_query 툴들 등록 확인

### Phase 4 대기 사항

- [ ] 실제 DB 데이터로 end-to-end 테스트
- [ ] Gemini API 실제 호출 테스트
- [ ] 캐시 파일 동작 확인
- [ ] 매핑 실패 시 폴백 동작 확인
- [ ] aggregation_node 실제 구현
- [ ] gen_node / validator_node 스텁 → 실제 구현

---

## 참고

- **주요 파일**:
  - `backend/domain/v1/ifrs_agent/spokes/agents/dp_rag/agent.py`
  - `backend/domain/v1/ifrs_agent/hub/orchestrator/orchestrator.py`
  - `backend/domain/shared/tool/ifrs_agent/database/dp_query.py`
  
- **문서**:
  - `backend/domain/v1/ifrs_agent/docs/dp_rag/dp_rag.md`
  - `backend/domain/v1/ifrs_agent/docs/dp_rag/IMPLEMENTATION_STATUS.md`
