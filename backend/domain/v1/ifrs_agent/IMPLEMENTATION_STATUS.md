# IFRS Agent 워크플로우 구현 완료

**최종 업데이트**: 2026-04-04

---

## 📌 최신 업데이트 (2026-04-04)

### ✅ BGE-M3 임베딩 실제 구현 완료

1. **`sentence-transformers` 통합**
   - `BAAI/bge-m3` 모델 로드 (1024차원 벡터)
   - 싱글톤 캐싱으로 성능 최적화 (`@lru_cache`)
   - `normalize_embeddings=True`로 코사인 유사도 최적화

2. **구현 파일**
   - `backend/domain/shared/tool/ifrs_agent/database/embedding_tool.py`
   - `backend/domain/v1/ifrs_agent/DEPENDENCIES.md` (의존성 문서 신규 작성)

3. **의존성 설치 필요**
   ```bash
   pip install sentence-transformers
   ```

4. **최초 실행 시 자동 다운로드**
   - HuggingFace에서 BGE-M3 모델 자동 다운로드 (~2GB)
   - 이후 실행은 로컬 캐시 사용

---

## 구현된 구조

### 1. `models/langgraph/` - 상태 및 워크플로우 관리

```
models/langgraph/
├── __init__.py          # 전체 export
├── state.py             # WorkflowState, AgentResponse, OrchestratorConfig 정의
└── workflow.py          # LangGraph 빌더 및 실행 헬퍼
```

**핵심 타입**:
- `WorkflowState`: LangGraph가 관리하는 전역 상태 (user_input, ref_data, fact_data, generated_text, validation 등)
- `AgentResponse`: 에이전트 응답 표준 구조
- `OrchestratorConfig`: 오케스트레이터 설정

**워크플로우 빌더**:
- `build_workflow(infra)`: LangGraph StateGraph 생성 (단일 `orchestrator_node` + 조건부 재시도 간선)
- `run_workflow(user_input, infra)`: 워크플로우 실행 헬퍼

---

### 2. `spokes/infra/` - in-process MCP 인프라

```
spokes/infra/
├── __init__.py          # InfraLayer, AgentRegistry, ToolRegistry export
├── infra_layer.py       # 단일 진입점 (call_agent, call_tool)
├── agent_registry.py    # 에이전트 레지스트리
└── tool_registry.py     # 툴 레지스트리
```

**핵심 클래스**:
- `InfraLayer`: 모든 에이전트·툴 호출의 단일 진입점 (타임아웃·재시도·로깅 통일)
- `AgentRegistry`: 에이전트 이름 → 핸들러 함수 매핑
- `ToolRegistry`: 툴 이름 → 핸들러 함수 매핑

---

### 3. `spokes/agents/c_rag/` - C_RAG 에이전트

```
spokes/agents/c_rag/
├── __init__.py          # CRagAgent, make_c_rag_handler export
└── agent.py             # C_RAG 에이전트 구현
```

**핵심 메서드**:
- `collect(payload)`: 카테고리 기반 SR 참조 데이터 수집 (본문 + 이미지)
- `_query_sr_body()`: 정확 매칭 → 벡터 검색 폴백
- `_query_sr_images()`: 선택된 페이지의 이미지 메타데이터 추출

---

### 4. `hub/orchestrator/` - 오케스트레이터

```
hub/orchestrator/
├── __init__.py          # Orchestrator export
└── orchestrator.py      # 오케스트레이터 구현
```

**핵심 메서드**:
- `orchestrate(user_input)`: 메인 진입점 (action에 따라 분기)
- `_create_new_report()`: 경로 1 → 경로 2 (초안 생성 + validator 루프)
- `_parallel_collect()`: Phase 1 (c_rag, dp_rag, aggregation_node 병렬 호출)
- `_generation_validation_loop()`: Phase 3 (생성-검증 반복 루프, 최대 3회)
- `_refine_existing_report()`: 경로 3 (사용자 수정 요청)

---

### 5. `hub/` - 부트스트랩 및 오케스트레이터

```
hub/
├── bootstrap.py         # InfraLayer 초기화 및 에이전트·툴 등록
└── orchestrator/
    ├── __init__.py
    └── orchestrator.py  # 오케스트레이터 (공통 설정: get_settings() → self.settings)
```

**주요 함수**:
- `create_infra_layer()`: InfraLayer 생성 및 에이전트·툴 등록
- `get_infra()`: 전역 싱글톤 InfraLayer 반환
- `register_agents()`: 모든 에이전트 레지스트리에 등록
- `register_tools()`: 모든 툴 레지스트리에 등록 ✅ **구현 완료**

**LLM·API 키**: 별도 `llm.py` 없음. `Orchestrator`가 `backend.core.config.settings.get_settings()`로 `gemini_api_key`·`openai_api_key` 등을 참조 (향후 Gemini 호출 구현 시 동일 `self.settings` 사용).

---

### 6. `backend/domain/shared/tool/ifrs_agent/database/` - DB 툴 ✅ **신규 구현**

```
backend/domain/shared/tool/ifrs_agent/database/
├── __init__.py
├── sr_body_query.py         # SR 본문 검색 (정확 매칭 + 벡터)
├── sr_images_query.py       # SR 이미지 검색
├── embedding_tool.py        # BGE-M3 임베딩 생성 (sentence-transformers) ✅
└── dp_query.py              # DP 기반 실데이터 조회
```

**구현된 툴**:
- `query_sr_body_exact`: 카테고리 정확 매칭 (asyncpg)
- `query_sr_body_vector`: pgvector 코사인 유사도 검색
- `query_sr_images`: 이미지 메타데이터 조회
- `embed_text`: BGE-M3 임베딩 ✅ **실제 구현 완료** (싱글톤 캐싱)
- `query_dp_data`: UCM → 실데이터 테이블 동적 조회

---

## 디렉토리 구조 전체

```
backend/domain/v1/ifrs_agent/
├── models/
│   └── langgraph/
│       ├── __init__.py
│       ├── state.py
│       └── workflow.py
├── spokes/
│   ├── infra/
│   │   ├── __init__.py
│   │   ├── infra_layer.py
│   │   ├── agent_registry.py
│   │   └── tool_registry.py
│   └── agents/
│       ├── __init__.py
│       └── c_rag/
│           ├── __init__.py
│           └── agent.py
└── hub/
    ├── orchestrator/
    │   ├── __init__.py
    │   └── orchestrator.py
    └── bootstrap.py
```

---

## 실행 흐름

### 1. 초기화 (bootstrap)

```python
from backend.domain.v1.ifrs_agent.hub.bootstrap import get_infra

# InfraLayer 싱글톤 생성 및 에이전트·툴 등록
infra = get_infra()
```

### 2. 워크플로우 실행

```python
from backend.domain.v1.ifrs_agent.models.langgraph import run_workflow

user_input = {
    "action": "create",
    "company_id": "company_1",
    "category": "재생에너지",
    "dp_id": "UCM_ESRS2_BP_2_17_e__IFRS1_51_a"
}

final_state = await run_workflow(user_input, infra)
```

### 3. 내부 흐름

```
사용자 요청
    ↓
run_workflow
    ↓
LangGraph (orchestrator_node)
    ↓
Orchestrator.orchestrate()
    ├─ Phase 1: _parallel_collect()
    │   ├─ infra.call_agent("c_rag", ...)
    │   ├─ infra.call_agent("dp_rag", ...)
    │   └─ infra.call_agent("aggregation_node", ...)
    ├─ Phase 2: _merge_data()
    ├─ Phase 3: _generation_validation_loop()
    │   ├─ infra.call_agent("gen_node", ...)
    │   └─ infra.call_agent("validator_node", ...)
    └─ Phase 4: 최종 반환
```

---

## TODO (다음 구현 단계)

### 1. 나머지 에이전트 구현
- [ ] `dp_rag` (DP 기반 팩트 데이터 수집)
- [ ] `aggregation_node` (계열사·외부 기업 데이터 집계)
- [ ] `gen_node` (IFRS 문체 문단 생성)
- [ ] `validator_node` (검증 및 품질 관리)

### 2. ~~툴 구현~~ ✅ 완료
- [x] `query_sr_body_exact` (SR 본문 정확 매칭 검색)
- [x] `query_sr_body_vector` (SR 본문 벡터 유사도 검색)
- [x] `query_sr_images` (SR 이미지 메타데이터 추출)
- [x] `embed_text` (BGE-M3 임베딩 생성) ✅ **실제 구현 완료**
- [x] `query_dp_data` (DP 기반 실데이터 조회)
- [ ] `query_subsidiary_data` (계열사 데이터 조회)
- [ ] `query_external_company_data` (외부 기업 데이터 조회)

### 3. ~~LLM 통합~~ ✅ 완료
- [x] Settings에 `gemini_api_key`, `openai_api_key` 추가
- [x] Orchestrator에서 `get_settings()` → `self.settings` 사용
- [x] `AgentRuntimeConfig`로 에이전트에 설정 전달
- [ ] 실제 Gemini/OpenAI SDK 연동 (현재 구조만 준비됨)

### 4. DB 연결 ✅ 완료
- [x] PostgreSQL 연결 (asyncpg)
- [x] 툴 내부 DB 쿼리 구현
- [x] pgvector 벡터 검색 구현
- [x] BGE-M3 임베딩 모델 로드 ✅ **신규 완료**

### 5. 테스트
- [ ] 단위 테스트 (각 툴)
- [ ] 통합 테스트 (전체 워크플로우)
- [ ] 모의 데이터 준비

---

## 설계 원칙 준수 확인

✅ **orchestrator → infra → agent**: 모든 호출이 `infra.call_agent()` 경유  
✅ **agent → infra → tool**: 에이전트 내부 툴 호출은 `infra.call_tool()` 경유  
✅ **LangGraph 최소 관여**: 단일 노드 + 조건부 재시도 간선만 사용  
✅ **타임아웃·로깅 통일**: InfraLayer에서 중앙 집계  
✅ **의존성 단방향**: orchestrator → infra, agent → infra (순환 없음)

---

**작성**: AI Assistant  
**일자**: 2026-04-04
