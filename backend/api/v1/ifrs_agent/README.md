# IFRS Agent API 구현 완료

**최종 업데이트**: 2026-04-04

---

## API 구조

### 1. 개별 API 서버 (개발·테스트용)

**경로**: `backend/api/v1/ifrs_agent/main.py`  
**포트**: 9005 (기본값, `IFRS_AGENT_PORT` 환경변수로 변경 가능)

```bash
# 실행
python -m backend.api.v1.ifrs_agent.main
```

**특징**:
- IFRS Agent 라우터만 포함
- CORS 설정 포함
- 개발 시 독립적으로 실행 가능

---

### 2. 통합 백엔드 API (프로덕션용)

**경로**: `backend/api/v1/main.py`  
**포트**: 9001 (기본값)

```bash
# 실행
python -m backend.api.v1.main
```

**포함된 라우터**:
- `/data-integration/*` - Data Integration
- `/esg-data/*` - ESG Data
- `/ghg-calculation/*` - GHG Calculation
- **`/ifrs-agent/*`** - IFRS Agent (신규 추가)

---

## API 엔드포인트

### 1. 헬스체크

```http
GET /ifrs-agent/health
```

**응답**:
```json
{
  "status": "ok",
  "agents": ["c_rag", "dp_rag", "aggregation_node", "gen_node", "validator_node"],
  "tools": ["query_sr_body_exact", "query_sr_body_vector", "embed_text", ...]
}
```

---

### 2. SR 초안 생성

```http
POST /ifrs-agent/reports/create
Content-Type: application/json

{
  "company_id": "company_1",
  "category": "재생에너지",
  "dp_id": "UCM_ESRS2_BP_2_17_e__IFRS1_51_a",
  "max_retries": 3
}
```

**응답**:
```json
{
  "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "success",
  "generated_text": "당사는 재생에너지 투자를 전년 대비 25% 확대하여...",
  "validation": {
    "is_valid": true,
    "errors": [],
    "warnings": []
  },
  "references": {
    "sr_pages": {
      "2024": {
        "sr_body": "...",
        "sr_images": [...],
        "page_number": 42,
        "report_id": "report_123"
      },
      "2023": { ... }
    },
    "fact_data": { ... },
    "agg_data": { ... }
  },
  "metadata": {
    "attempts": 1,
    "max_retries": 3,
    "mode": "draft",
    "created_at": "2026-04-04T12:00:00",
    "updated_at": "2026-04-04T12:00:05"
  },
  "error": null
}
```

**상태 코드**:
- `200 OK`: 성공
- `500 Internal Server Error`: 워크플로우 실행 실패

---

### 3. SR 수정

```http
POST /ifrs-agent/reports/refine
Content-Type: application/json

{
  "report_id": "report_123",
  "page_number": 42,
  "user_instruction": "재무 연결성을 더 명시적으로 작성해주세요"
}
```

**응답**:
```json
{
  "workflow_id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "success",
  "generated_text": "당사는 재생에너지 투자를 전년 대비 25% 확대하여, 공급망 리스크 관리 비용을 15% 절감...",
  "validation": {
    "is_valid": true,
    "errors": [],
    "warnings": []
  },
  "references": {},
  "metadata": {
    "mode": "refine",
    "previous_text": "당사는 재생에너지 투자를 전년 대비 25% 확대하여...",
    "warnings": [],
    "created_at": "2026-04-04T12:05:00",
    "updated_at": "2026-04-04T12:05:03"
  },
  "error": null
}
```

---

### 4. 워크플로우 상태 조회

```http
GET /ifrs-agent/workflows/{workflow_id}/status
```

**응답** (TODO: DB 통합 필요):
```json
{
  "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "success",
  "created_at": "2026-04-04T12:00:00",
  "updated_at": "2026-04-04T12:00:05",
  "attempt": 0,
  "max_retries": 3
}
```

**현재 상태**: `501 Not Implemented` (DB 통합 후 구현)

---

### 5. 에이전트 목록

```http
GET /ifrs-agent/agents
```

**응답**:
```json
{
  "agents": ["c_rag", "dp_rag", "aggregation_node", "gen_node", "validator_node"]
}
```

---

### 6. 툴 목록

```http
GET /ifrs-agent/tools
```

**응답**:
```json
{
  "tools": [
    "query_sr_body_exact",
    "query_sr_body_vector",
    "query_sr_images",
    "embed_text",
    "query_dp_data",
    "query_subsidiary_data",
    "query_external_company_data"
  ]
}
```

---

## 디렉토리 구조

```
backend/
├── api/
│   └── v1/
│       ├── main.py                      # 통합 백엔드 (포트 9001)
│       ├── data_integration/
│       ├── esg_data/
│       ├── ghg_calculation/
│       └── ifrs_agent/                  # IFRS Agent API
│           ├── __init__.py
│           ├── main.py                  # 개별 API 서버 (포트 9005)
│           └── router.py                # 라우터 (엔드포인트 정의)
└── domain/
    └── v1/
        └── ifrs_agent/
            ├── hub/
            │   ├── orchestrator/        # 오케스트레이터
            │   └── bootstrap.py         # 인프라 초기화
            ├── spokes/
            │   ├── infra/               # 인프라 레이어
            │   └── agents/              # 에이전트 (c_rag 등)
            └── models/
                └── langgraph/           # 상태 및 워크플로우
```

---

## 주요 변경 사항

### 1. `backend/domain/v1/ifrs_agent/hub/main.py` 제거

- 기존: 도메인 레이어에 메인 진입점 존재 (비표준)
- 변경: API 레이어로 이동 → `backend/api/v1/ifrs_agent/main.py`

### 2. API 라우터 구조 통일

- 기존 패턴 (`ghg_calculation`, `esg_data`, `data_integration`) 준수
- 개별 API 서버 (`main.py`) + 라우터 (`router.py`) 분리
- 통합 백엔드 (`backend/api/v1/main.py`)에 자동 포함

### 3. FastAPI 표준 패턴 적용

- Request/Response Models (Pydantic)
- HTTPException 에러 처리
- Logging 통합
- CORS 설정

---

## 실행 방법

### 1. 개별 API 서버 (개발)

```bash
# 기본 포트 9005
python -m backend.api.v1.ifrs_agent.main

# 포트 변경
PORT=8080 python -m backend.api.v1.ifrs_agent.main

# 자동 리로드 활성화
IFRS_AGENT_RELOAD=true python -m backend.api.v1.ifrs_agent.main
```

### 2. 통합 백엔드 (프로덕션)

```bash
# 기본 포트 9001 (모든 라우터 포함)
python -m backend.api.v1.main

# 포트 변경
PORT=8000 python -m backend.api.v1.main
```

### 3. 환경 변수

**.env 파일**:
```bash
# IFRS Agent API
IFRS_AGENT_PORT=9005
IFRS_AGENT_RELOAD=true

# CORS
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# 통합 백엔드
PORT=9001
BACKEND_API_RELOAD=true
```

---

## TODO (다음 구현 단계)

### 1. 나머지 에이전트 구현
- [ ] `dp_rag` (DP 기반 팩트 데이터 수집)
- [ ] `aggregation_node` (계열사·외부 기업 데이터 집계)
- [ ] `gen_node` (IFRS 문체 문단 생성)
- [ ] `validator_node` (검증 및 품질 관리)

### 2. 툴 구현
- [ ] DB 쿼리 툴 (PostgreSQL)
- [ ] 임베딩 툴 (BGE-M3)
- [ ] 벡터 검색 툴 (pgvector)

### 3. DB 통합
- [ ] 워크플로우 상태 저장 (PostgreSQL)
- [ ] 워크플로우 상태 조회 API 구현
- [ ] 생성된 SR 저장 (sr_generated_reports 테이블)

### 4. 테스트
- [ ] API 통합 테스트
- [ ] 워크플로우 E2E 테스트
- [ ] 에러 케이스 테스트

---

**작성**: AI Assistant  
**일자**: 2026-04-04
