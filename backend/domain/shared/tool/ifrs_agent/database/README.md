# DB 툴 구현 완료 및 LLM 적용

**최종 업데이트**: 2026-04-04

---

## 구현 완료 내용

### 1. DB 툴 구현 ✅

**위치**: `backend/domain/shared/tool/ifrs_agent/database/`

#### 1.1 SR 본문 검색 (`sr_body_query.py`)

```python
# 정확 매칭
async def query_sr_body_exact(params: Dict[str, Any]) -> Optional[Dict[str, Any]]

# 벡터 검색 (pgvector)
async def query_sr_body_vector(params: Dict[str, Any]) -> List[Dict[str, Any]]
```

**특징**:
- `asyncpg`로 PostgreSQL 연결
- 정확 매칭: `category_column = $1` (빠른 인덱스 검색)
- 벡터 검색: `<=>` 연산자로 코사인 유사도 (1024차원 BGE-M3)

---

#### 1.2 SR 이미지 검색 (`sr_images_query.py`)

```python
async def query_sr_images(params: Dict[str, Any]) -> List[Dict[str, Any]]
```

**특징**:
- `report_id` + `page_number`로 이미지 메타데이터 추출
- `image_order`로 정렬

---

#### 1.3 임베딩 생성 (`embedding_tool.py`)

```python
async def embed_text(params: Dict[str, Any]) -> List[float]
```

**특징**:
- BGE-M3 임베딩 (1024차원)
- **현재 더미 구현** (랜덤 벡터, 정규화됨)
- TODO: `sentence-transformers` 로드

---

#### 1.4 DP 데이터 조회 (`dp_query.py`)

```python
async def query_dp_data(params: Dict[str, Any]) -> Dict[str, Any]
```

**특징**:
- UCM 테이블에서 `dp_id` → `table_name`, `column_name` 조회
- 동적 SQL로 실제 데이터 테이블 쿼리
- `social_data`, `environmental_data` 등 범용 지원

---

### 2. MCP 툴 등록 ✅

**위치**: `backend/domain/v1/ifrs_agent/hub/bootstrap.py`

```python
def register_tools(infra: InfraLayer) -> None:
    from backend.domain.shared.tool.ifrs_agent.database.sr_body_query import (
        query_sr_body_exact,
        query_sr_body_vector
    )
    from backend.domain.shared.tool.ifrs_agent.database.sr_images_query import query_sr_images
    from backend.domain.shared.tool.ifrs_agent.database.embedding_tool import embed_text
    from backend.domain.shared.tool.ifrs_agent.database.dp_query import query_dp_data
    
    # 툴 등록
    infra.tool_registry.register("query_sr_body_exact", query_sr_body_exact)
    infra.tool_registry.register("query_sr_body_vector", query_sr_body_vector)
    infra.tool_registry.register("query_sr_images", query_sr_images)
    infra.tool_registry.register("embed_text", embed_text)
    infra.tool_registry.register("query_dp_data", query_dp_data)
```

**등록된 툴**: 5개
- `query_sr_body_exact`
- `query_sr_body_vector`
- `query_sr_images`
- `embed_text`
- `query_dp_data`

---

### 3. 공통 설정·LLM 키 (오케스트레이터만)

별도 `hub/llm.py` 없음. **`Orchestrator`**가 `backend.core.config.settings.get_settings()`로 `Settings`를 한 번 받아 `self.settings`에 보관한다.

- `self.settings.gemini_api_key` ← `.env`의 `GEMINI_API_KEY` (또는 `GOOGLE_AI_API_KEY` 폴백, `settings.py`에서 해석)
- `self.settings.openai_api_key` ← `OPENAI_API_KEY`

향후 오케스트레이터에서 Gemini·OpenAI SDK를 붙일 때 동일 `self.settings`를 사용하면 된다.

**`c_rag`**: DB·툴은 `infra`만 사용; LLM이 필요해지면 오케스트레이터가 호출하거나, 페이로드로 설정을 넘기는 방식으로 확장한다.

---

## 디렉토리 구조 업데이트

```
backend/
├── domain/
│   ├── shared/
│   │   └── tool/
│   │       └── ifrs_agent/
│   │           └── database/              # ✅ 신규 추가
│   │               ├── __init__.py
│   │               ├── sr_body_query.py
│   │               ├── sr_images_query.py
│   │               ├── embedding_tool.py
│   │               └── dp_query.py
│   └── v1/
│       └── ifrs_agent/
│           ├── hub/
│           │   ├── orchestrator/
│           │   │   ├── __init__.py
│           │   │   └── orchestrator.py   # get_settings() → self.settings ✅
│           │   └── bootstrap.py          # 툴 등록 완료 ✅
│           ├── spokes/
│           │   ├── infra/
│           │   │   ├── infra_layer.py
│           │   │   ├── agent_registry.py
│           │   │   └── tool_registry.py
│           │   └── agents/
│           │       └── c_rag/
│           │           ├── __init__.py
│           │           └── agent.py      # infra 툴만 사용
│           └── models/
│               └── langgraph/
│                   ├── state.py
│                   └── workflow.py
└── api/
    └── v1/
        └── ifrs_agent/
            ├── main.py
            └── router.py
```

---

## 환경 변수 설정

**.env 파일에 추가 필요**:

```bash
# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/ifrsseedr

# LLM API Keys
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key

# IFRS Agent API
IFRS_AGENT_PORT=9005
IFRS_AGENT_RELOAD=true
```

---

## 테스트 방법

### 1. API 서버 실행

```bash
# 개별 API 서버
python -m backend.api.v1.ifrs_agent.main

# 또는 통합 백엔드
python -m backend.api.v1.main
```

### 2. 헬스체크

```bash
curl http://localhost:9001/ifrs-agent/health
```

**예상 응답**:
```json
{
  "status": "ok",
  "agents": ["c_rag"],
  "tools": [
    "query_sr_body_exact",
    "query_sr_body_vector",
    "query_sr_images",
    "embed_text",
    "query_dp_data"
  ]
}
```

### 3. SR 초안 생성 요청

```bash
curl -X POST http://localhost:9001/ifrs-agent/reports/create \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "company_1",
    "category": "재생에너지",
    "dp_id": "UCM_ESRS2_BP_2_17_e__IFRS1_51_a",
    "max_retries": 3
  }'
```

---

## TODO (남은 작업)

### 1. 실제 API 연동
- [ ] 오케스트레이터에서 `self.settings.gemini_api_key` / `openai_api_key`로 Gemini·OpenAI SDK 연동
- [ ] API 키 검증 및 에러 처리

### 2. BGE-M3 임베딩 모델 로드
- [ ] `sentence-transformers` 설치
- [ ] `BAAI/bge-m3` 모델 다운로드
- [ ] `embed_text` 툴 실제 구현

### 3. 나머지 에이전트 구현
- [ ] `dp_rag` (DP 기반 팩트 데이터 수집)
- [ ] `aggregation_node` (계열사·외부 기업 데이터 집계)
- [ ] `gen_node` (IFRS 문체 문단 생성)
- [ ] `validator_node` (검증 및 품질 관리)

### 4. 계열사·외부 기업 툴
- [ ] `query_subsidiary_data`
- [ ] `query_external_company_data`

### 5. 테스트
- [ ] 단위 테스트 (각 툴)
- [ ] 통합 테스트 (전체 워크플로우)
- [ ] E2E 테스트 (API → DB)

---

**작성**: AI Assistant  
**일자**: 2026-04-04
