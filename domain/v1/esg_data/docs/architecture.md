# ESG 데이터 서비스 아키텍처

## 1. 개요

`esg_data` 서비스는 **UnifiedColumnMapping 생성/관리**와 **데이터 품질 검증**을 담당하는 통합 관리 서비스입니다.

핵심 목표:
- `data_points`, `rulebooks`를 기반으로 `unified_column_mappings` 자동 생성
- 소스 데이터(`environmental_data`, `social_data` 등)를 `sr_report_unified_data`로 통합
- 매핑 정합성 및 데이터 품질 검증

---

## 2. 아키텍처 패턴

### 2.1 레이어 구조

권장 흐름: **오케스트레이터는 에이전트만 인프로세스로 조율**하고, **에이전트는 도구 실행 시 MCP 클라이언트**(`ClientSession`, `call_tool` 등)로 **MCP 서버에 등록된 `@mcp.tool`** 을 호출한다. MCP 서버의 툴 핸들러 안에서 `UCMMappingService`·공유 Tool·Repository로 **다시 인프로세스** 내려간다.

외부(IDE·원격 에이전트)는 REST 없이 **곧바로 MCP 서버**에 붙을 수도 있고, FastAPI를 타면 **API → 오케스트레이터**로 들어온 뒤 위와 동일하게 에이전트 → MCP 클라이언트 → 툴로 이어진다.

```
┌─────────────────────────────────────────────────────────┐
│  외부 클라이언트 / IDE / 원격 에이전트                      │
└────────────┬────────────────────┬───────────────────────┘
             │ MCP                 │ HTTP (REST)
             │ Streamable HTTP 등   │
┌────────────▼────────────┐   ┌────▼────────────────────────┐
│ MCP Server              │   │ API Layer (FastAPI)        │
│ esg_tools_server.py     │   │ 요청 검증·응답 포맷         │
│ (고수준 툴 직접 호출 가능) │   └────┬───────────────────────┘
└────────────┬────────────┘        │ In-process
             │                      │
             └──────────┬───────────┘
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Orchestrator (hub/orchestrator)                         │
│  - UCMOrchestrator: 단계·상태·라우팅 조율                  │
│  - LangGraph 또는 순차 폴백 (Phase 3)                    │
└────────────────┬────────────────────────────────────────┘
                 │ In-process
┌────────────────▼────────────────────────────────────────┐
│  Routing Layer (hub/routing) [선택]                      │
└────────────────┬────────────────────────────────────────┘
                 │ In-process
┌────────────────▼────────────────────────────────────────┐
│  Agent Layer (spokes/agents) + 오케스트레이터 내 단계     │
│  - UCMCreationAgent, ucm_policy(순수 정책)                 │
│  - 검증·품질 요약: UCMOrchestrator.run_validation_step /  │
│    arun_validation_step, _summarize_workflow_quality      │
└────────────────┬────────────────────────────────────────┘
                 │ MCP Client — call_tool / ClientSession
                 │ (Streamable HTTP · stdio · 인프로세스 브리지)
┌────────────────▼────────────────────────────────────────┐
│  MCP Server (동일 esg_tools_server 등)                    │
│  @mcp.tool() → UCMMappingService / 공유 Tool / Repository │
└────────────────┬────────────────────────────────────────┘
                 │ In-process (툴 핸들러 내부)
┌────────────────▼────────────────────────────────────────┐
│  Service Layer (ifrs_agent/service 재사용)               │
│  - MappingSuggestionService, EmbeddingService …          │
└────────────────┬────────────────────────────────────────┘
                 │ In-process
┌────────────────▼────────────────────────────────────────┐
│  Repository Layer (hub/repositories)                     │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  Database (PostgreSQL + pgvector)                        │
└─────────────────────────────────────────────────────────┘
```

**구현 참고**: 일부 코드 경로는 아직 오케스트레이터·서비스가 **Python 모듈을 직접 호출**한다. 문서상 목표는 위와 같이 **에이전트→MCP 클라이언트→툴**로 수렴시키는 것이다.

### 2.2 통신 방식

| 레이어 간 | 방식 | 설명 |
|----------|------|------|
| 외부 → MCP Server | **Streamable HTTP** 등 | FastMCP, `data_integration`의 MCP 패턴과 동일 |
| 외부 → API | **HTTP** | REST 진입 후 오케스트레이터로 위임 |
| API → Orchestrator | In-process | 직접 호출 |
| Orchestrator → Routing → Agent | In-process | 그래프/순서 제어만 담당 |
| **Agent → MCP Server (도구)** | **MCP 클라이언트** | `call_tool`·세션 기반; 전송은 Streamable HTTP·stdio 또는 **동일 프로세스 MCP 브리지** |
| MCP 툴 핸들러 → Service / Repository | In-process | 직렬화 없이 도메인 실행·DB 접근 |
| Service → Repository | In-process | 직접 호출 |

**장점**:
- 외부·내부 모두 **동일 MCP 툴 계약**으로 재사용 가능 (에이전트와 IDE가 같은 툴 이름·스키마 사용)
- 오케스트레이터↔에이전트는 가볍게 유지하고, I/O·부작용은 MCP 툴 경계로 모을 수 있음
- Streamable HTTP·stdio·인프로세스 브리지를 환경에 맞게 선택 가능 (`data_integration`의 `mcp_client` 전략과 동일 계열)

---

## 3. 구현 Phase

### Phase 1: 단순 파이프라인 (MVP)

**목표**: 최소 기능으로 end-to-end 동작 확인

```
API → Orchestrator(단순 함수) → Service(재사용) → Repository → DB
```

**구현 항목**:
- [ ] API Router 기본 엔드포인트
- [ ] UCMOrchestrator (단순 함수 체인)
- [ ] ifrs_agent/service 재사용 연결
- [ ] Repository 래퍼 (ifrs_agent repo 재사용)
- [ ] 기본 테스트

**생략**:
- Agent/Tool 추상화
- Routing 레이어
- LangGraph

### Phase 2: Agent/Tool 분리

**목표**: 확장 가능한 구조로 전환

```
Orchestrator → Agent → MCP Client → @mcp.tool → Service / Repository
```

**구현 항목**:
- [ ] UCMCreationAgent 추가
- [ ] UCMMappingService 구현 (MCP 툴 핸들러에서 호출)
- [ ] MCP 서버로 tool 노출 + **에이전트용 MCP 클라이언트** 래퍼
- [ ] Agent 단위 테스트

**선택**:
- LLM 판단 추가 (매핑 애매한 경우)
- Agent별 상태 관리

### Phase 3: 워크플로우 고도화

**목표**: 복잡한 조건 분기 지원

```
Orchestrator(LangGraph) → Routing → Agent pool
```

**구현 항목**:
- [ ] LangGraph StateGraph 적용
- [ ] Routing 레이어 추가
- [ ] 워크플로 단계: 생성(UCMCreationAgent·MCP 툴) → 검증(`validate_ucm_mappings` 동일 계약) → 조건부 품질 요약(오케스트레이터 헬퍼)
- [ ] 조건부 플로우 (if/else/loop)

---

## 4. 주요 컴포넌트 설계

### 4.1 MCP Server (외부·내부 에이전트 공통 도구 진입점)

**파일**: `backend/domain/v1/esg_data/spokes/infra/esg_tools_server.py`

에이전트는 이 서버에 노출된 툴을 **MCP 클라이언트로 호출**한다. 외부 클라이언트도 동일 툴을 직접 호출할 수 있다.

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("esg-data-tools")

@mcp.tool()
async def create_unified_column_mapping(
    source_standard: str,
    target_standards: list[str],
    company_id: str | None = None,
    dry_run: bool = False
) -> dict:
    """
    DataPoints로부터 UnifiedColumnMapping 생성.
    
    Args:
        source_standard: 기준 기준서 (예: 'GRI')
        target_standards: 매핑 대상 기준서 목록 (예: ['IFRS_S2', 'ESRS'])
        company_id: 회사별 필터 (선택)
        dry_run: True면 저장 없이 후보만 반환
    
    Returns:
        {
            "status": "success" | "dry_run",
            "saved_count": int,
            "candidates": [...] (dry_run=True일 때)
        }
    """
    from backend.domain.v1.esg_data.hub.orchestrator import UCMOrchestrator
    
    orchestrator = UCMOrchestrator()
    result = await orchestrator.create_ucm_from_datapoints(
        source_standard=source_standard,
        target_standards=target_standards,
        company_id=company_id,
        dry_run=dry_run
    )
    return result

@mcp.tool()
async def validate_ucm_mappings(
    company_id: str | None = None
) -> dict:
    """
    UnifiedColumnMapping 정합성 검증.
    """
    from backend.domain.v1.esg_data.hub.orchestrator import UCMOrchestrator
    
    orchestrator = UCMOrchestrator()
    result = await orchestrator.validate_ucm_mappings(company_id=company_id)
    return result
```

### 4.2 API Router

**파일**: `backend/api/v1/esg_data/router.py`

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/esg-data", tags=["esg-data"])

class CreateUCMRequest(BaseModel):
    source_standard: str
    target_standards: list[str]
    company_id: str | None = None
    dry_run: bool = False

@router.post("/ucm/create")
async def create_ucm(request: CreateUCMRequest):
    """
    UnifiedColumnMapping 생성 API.
    """
    from backend.domain.v1.esg_data.hub.orchestrator import UCMOrchestrator
    
    orchestrator = UCMOrchestrator()
    result = await orchestrator.create_ucm_from_datapoints(
        source_standard=request.source_standard,
        target_standards=request.target_standards,
        company_id=request.company_id,
        dry_run=request.dry_run
    )
    return result

@router.post("/ucm/validate")
async def validate_ucm(company_id: str | None = None):
    """
    UnifiedColumnMapping 검증 API.
    """
    from backend.domain.v1.esg_data.hub.orchestrator import UCMOrchestrator
    
    orchestrator = UCMOrchestrator()
    result = await orchestrator.validate_ucm_mappings(company_id=company_id)
    return result
```

### 4.3 Orchestrator (Phase 1)

**파일**: `backend/domain/v1/esg_data/hub/orchestrator/ucm_orchestrator.py`

```python
from typing import Optional
from backend.domain.v1.ifrs_agent.service.mapping_suggestion_service import (
    MappingSuggestionService
)
from backend.domain.v1.ifrs_agent.repository.unified_column_mapping_repository import (
    UnifiedColumnMappingRepository
)
from backend.domain.v1.ifrs_agent.repository.data_point_repository import (
    DataPointRepository
)

class UCMOrchestrator:
    """
    UnifiedColumnMapping 생성/관리 오케스트레이터.
    
    Phase 1: 단순 함수 체인
    Phase 2: Agent/Tool로 분리
    Phase 3: LangGraph 적용
    """
    
    def __init__(self):
        # 기존 서비스 재사용
        self.mapping_service = MappingSuggestionService()
        self.ucm_repo = UnifiedColumnMappingRepository()
        self.dp_repo = DataPointRepository()
    
    async def create_ucm_from_datapoints(
        self,
        source_standard: str,
        target_standards: list[str],
        company_id: Optional[str] = None,
        dry_run: bool = False
    ) -> dict:
        """
        DataPoints로부터 UnifiedColumnMapping 생성.
        
        플로우:
        1. 소스 기준서 DP 추출
        2. 타겟 기준서 DP와 유사도 매칭
        3. UCM 후보 생성
        4. (dry_run=False) DB 저장
        5. 결과 반환
        """
        # 1. 소스 DP 추출
        source_dps = await self.dp_repo.get_by_standard(source_standard)
        
        if not source_dps:
            return {
                "status": "error",
                "message": f"No DataPoints found for {source_standard}"
            }
        
        # 2. 매핑 후보 생성 (임베딩 기반 유사도)
        mappings = await self.mapping_service.suggest_mappings_batch(
            source_dps=source_dps,
            target_standards=target_standards,
            company_id=company_id
        )
        
        # 3. Dry-run 처리
        if dry_run:
            return {
                "status": "dry_run",
                "candidates": mappings,
                "count": len(mappings)
            }
        
        # 4. DB 저장
        saved = await self.ucm_repo.bulk_upsert(mappings)
        
        return {
            "status": "success",
            "saved_count": len(saved),
            "mappings": saved
        }
    
    async def validate_ucm_mappings(
        self,
        company_id: Optional[str] = None
    ) -> dict:
        """
        UnifiedColumnMapping 정합성 검증.
        
        검증 항목:
        - mapped_dp_ids의 DP 실존 여부
        - column_type vs data_type 일치
        - 중복 매핑 탐지
        - 단위 불일치
        """
        issues = []
        
        # UCM 조회
        ucms = await self.ucm_repo.get_all_active()
        
        for ucm in ucms:
            # mapped_dp_ids 검증
            for dp_id in ucm.mapped_dp_ids:
                dp = await self.dp_repo.get_by_id(dp_id)
                if not dp:
                    issues.append({
                        "type": "missing_dp",
                        "ucm_id": ucm.unified_column_id,
                        "dp_id": dp_id
                    })
        
        return {
            "status": "completed",
            "total_checked": len(ucms),
            "issues_count": len(issues),
            "issues": issues
        }
```

### 4.4 Tool Layer (Phase 2)

**파일**: `backend/domain/v1/esg_data/hub/services/ucm_mapping_service.py`

MCP `@mcp.tool` 핸들러의 본문에서 주로 호출된다. 에이전트가 MCP 클라이언트로 툴을 호출하면, 최종적으로 이 서비스·공유 Tool 모듈이 실행된다.

```python
class UCMMappingService:
    """ifrs_agent `MappingSuggestionService`·DB 세션을 감싼 퍼사드 (MCP 툴 핸들러가 인프로세스로 호출)."""

    def create_mappings(self, source_standard: str, target_standard: str, *, dry_run: bool = False) -> dict:
        """배치 자동 추천 후 (dry_run이 아니면) DB 반영."""
        ...

    def suggest_mappings(self, source_standard: str, target_standard: str, **kwargs) -> dict:
        """저장 없이 후보 목록만 반환."""
        ...

    def validate_mappings(self) -> dict:
        """UCM·DataPoint 정합성 요약 통계."""
        ...
```

### 4.5 Agent Layer (Phase 2)

**파일**: `backend/domain/v1/esg_data/spokes/agents/ucm_creation_agent.py`

권장: **정책·분기·LLM 게이트**는 에이전트에 두고, **저장·임베딩·검증 등 부작용이 큰 작업**은 MCP 클라이언트로 `create_unified_column_mapping`, `run_ucm_mapping_pipeline` 같은 툴을 호출한다 (`data_integration`의 `MCPClient` / `tool_runtime` 패턴 참고).

```python
class UCMCreationAgent:
    """
    UCM 생성 전문 Agent.
    도구 실행은 MCP 클라이언트(call_tool)로 위임하는 것을 권장한다.
    """

    def __init__(self, mcp_tool_runtime=None):
        # mcp_tool_runtime: 세션·call_tool을 감싼 런타임 (stdio / HTTP / in-process)
        self._tools = mcp_tool_runtime

    async def create_mappings(self, source_standard: str, target_standard: str, *, dry_run: bool = False) -> dict:
        """예: MCP 툴 `create_unified_column_mapping` 호출."""
        return await self._tools.call(
            "create_unified_column_mapping",
            {
                "source_standard": source_standard,
                "target_standard": target_standard,
                "dry_run": dry_run,
            },
        )
```

---

## 5. 기존 로직 재사용

### 5.1 MappingSuggestionService

**위치**: `backend/domain/v1/ifrs_agent/service/mapping_suggestion_service.py`

**재사용 방법**:
```python
# esg_data에서 직접 import
from backend.domain.v1.ifrs_agent.service.mapping_suggestion_service import (
    MappingSuggestionService
)

service = MappingSuggestionService()
result = await service.suggest_mappings_batch(...)
```

**주요 메서드**:
- `suggest_mappings_batch()`: 배치 매핑 제안
- `calculate_embedding_similarity()`: 임베딩 유사도
- `validate_mapping()`: 매핑 검증

### 5.2 auto_suggest_mappings_improved.py

**위치**: `backend/domain/v1/ifrs_agent/scripts/auto_suggest_mappings_improved.py`

**재사용 방법**:
```python
# 배치 처리 로직 참고
# Orchestrator에 통합
```

**핵심 로직**:
- 기준서별 DP 순회
- 임베딩 기반 유사도 계산
- 후보 필터링 + 저장

### 5.3 Repository

**권장**: `ifrs_agent`의 repository 직접 재사용

```python
# esg_data/hub/repositories/__init__.py

from backend.domain.v1.ifrs_agent.repository.unified_column_mapping_repository import (
    UnifiedColumnMappingRepository
)
from backend.domain.v1.ifrs_agent.repository.data_point_repository import (
    DataPointRepository
)

# 중복 방지
```

---

## 6. 디렉토리 구조

```
backend/domain/v1/esg_data/
├── docs/
│   ├── esg_data.md              # 서비스 개요
│   └── architecture.md          # 본 문서
├── api/                          # (또는 backend/api/v1/esg_data/)
│   └── router.py                # FastAPI 라우터
├── hub/
│   ├── orchestrator/
│   │   ├── __init__.py
│   │   └── ucm_orchestrator.py  # 전체 플로우 조율
│   ├── routing/                 # Phase 3에서 추가
│   │   ├── __init__.py
│   │   └── agent_router.py      # Agent 선택 로직
│   ├── repositories/            # (또는 ifrs_agent repo 재사용)
│   │   ├── __init__.py
│   │   └── ...
│   └── services/
│       ├── __init__.py
│       └── ucm_mapping_service.py  # UCM 퍼사드·툴 지원 메서드
├── spokes/
│   ├── agents/                  # Phase 2에서 추가
│   │   ├── __init__.py
│   │   ├── ucm_creation_agent.py
│   │   └── ucm_policy.py        # 정책 점수·판정(순수 함수)
│   └── infra/
│       ├── __init__.py
│       ├── esg_tools_server.py       # MCP 서버 (@mcp.tool)
│       ├── esg_ucm_tool_handlers.py  # MCP·인프로세스 공용 툴 본문
│       └── esg_ucm_tool_runtime.py   # Agent용 DirectEsgToolRuntime (call_tool)
├── models/
│   ├── bases/                   # (또는 ifrs_agent models 재사용)
│   │   └── ...
│   ├── states/                    # 레거시 placeholder
│   └── langgraph/
│       └── ucm_workflow_state.py  # Phase 3: LangGraph용
├── __init__.py
└── main.py                      # (선택) 독립 실행용
```

---

## 7. data_integration과의 비교

| 항목 | data_integration | esg_data |
|------|------------------|----------|
| **목적** | SR 보고서 본문 생성 | UCM 생성 + 데이터 품질 관리 |
| **Orchestrator** | LangGraph StateGraph | Phase 1: 단순 함수, Phase 3: LangGraph |
| **Agent** | sr_agent (LLM 중심) | ucm_creation_agent (로직 중심, LLM 선택) |
| **Tool** | sr_tools (PDF, RAG 등) | UCM MCP 툴 + UCMMappingService (툴 핸들러 내부) |
| **MCP 서버** | sr_tools_server (Streamable HTTP) | esg_tools_server (Streamable HTTP) |
| **에이전트 → 도구** | MCP 클라이언트 (`mcp_client`, `tool_runtime`) | **동일: MCP 클라이언트로 툴 호출** |
| **툴 핸들러 → DB** | In-process | In-process |
| **Service 재사용** | 자체 서비스 | ifrs_agent/service 재사용 |

**공통점**:
- MCP Streamable HTTP (외부 접근)
- 에이전트가 **MCP 클라이언트**로 툴 호출, 툴 본문은 **인프로세스** 도메인 호출
- FastMCP 사용

**차이점**:
- `esg_data`는 초기엔 더 단순 (LLM 선택적)
- `data_integration`은 대화형 Agent 중심

---

## 8. 구현 우선순위

### 8.1 필수 (Phase 1)

1. API Router 기본 엔드포인트
2. UCMOrchestrator (단순 함수 체인)
3. ifrs_agent 서비스 재사용 연결
4. 테스트 코드

### 8.2 권장 (Phase 2)

1. MCP 서버 구현
2. Tool 래퍼
3. Agent 추상화 (LLM 판단 추가)

### 8.3 선택 (Phase 3)

1. LangGraph 적용
2. Routing 레이어
3. 복수 Agent
4. 복잡한 조건 분기

---

## 9. 테스트 전략

### 9.1 단위 테스트

```python
# tests/unit/test_ucm_orchestrator.py

import pytest
from backend.domain.v1.esg_data.hub.orchestrator import UCMOrchestrator

@pytest.mark.asyncio
async def test_create_ucm_dry_run():
    orchestrator = UCMOrchestrator()
    result = await orchestrator.create_ucm_from_datapoints(
        source_standard="GRI",
        target_standards=["IFRS_S2"],
        dry_run=True
    )
    
    assert result["status"] == "dry_run"
    assert "candidates" in result
    assert result["count"] > 0

@pytest.mark.asyncio
async def test_validate_mappings():
    orchestrator = UCMOrchestrator()
    result = await orchestrator.validate_ucm_mappings()
    
    assert result["status"] == "completed"
    assert "issues_count" in result
```

### 9.2 통합 테스트

```python
# tests/integration/test_ucm_flow.py

@pytest.mark.asyncio
async def test_full_ucm_creation_flow():
    """End-to-end 플로우 테스트."""
    orchestrator = UCMOrchestrator()
    
    # 1. 생성
    result = await orchestrator.create_ucm_from_datapoints(
        source_standard="GRI",
        target_standards=["IFRS_S2"],
        dry_run=False
    )
    assert result["status"] == "success"
    
    # 2. 검증
    validation = await orchestrator.validate_ucm_mappings()
    assert validation["issues_count"] == 0
```

---

## 10. 성능 고려사항

### 10.1 지연·처리량

- **MCP 툴 핸들러 내부**: Repository·서비스 호출은 인프로세스라 **저지연**을 유지할 수 있다.
- **에이전트↔MCP 서버**: Streamable HTTP를 쓰면 네트워크 홉이 생기므로, 개발·CI에서는 **stdio 또는 인프로세스 브리지**로 같은 계약을 검증하는 방식이 `data_integration`과 같다.
- **디버깅**: 툴 경계에서 로깅·트레이싱을 걸기 좋고, 핸들러 안에서는 기존처럼 breakpoint 가능

### 10.2 병렬 처리

```python
# 배치 처리 최적화

import asyncio

async def create_ucm_for_multiple_standards(
    standards: list[str]
) -> dict:
    """여러 기준서 병렬 처리."""
    tasks = [
        orchestrator.create_ucm_from_datapoints(
            source_standard=std,
            target_standards=["IFRS_S2"]
        )
        for std in standards
    ]
    results = await asyncio.gather(*tasks)
    return {"results": results}
```

### 10.3 캐싱 전략

```python
# 임베딩 캐싱 (MappingSuggestionService 내부)
# DB에 이미 저장된 임베딩 재사용
```

---

## 11. 보안 및 권한

### 11.1 API 인증

```python
from fastapi import Depends, HTTPException
from backend.auth import get_current_user

@router.post("/ucm/create")
async def create_ucm(
    request: CreateUCMRequest,
    user = Depends(get_current_user)  # 인증 필수
):
    if not user.has_permission("esg_data.ucm.write"):
        raise HTTPException(403, "Permission denied")
    ...
```

### 11.2 회사별 격리

```python
# company_id 필터링으로 멀티테넌트 지원
result = await orchestrator.create_ucm_from_datapoints(
    source_standard="GRI",
    target_standards=["IFRS_S2"],
    company_id=user.company_id  # 사용자 회사로 제한
)
```

---

## 12. 모니터링 및 로깅

### 12.1 구조화 로깅

```python
import structlog

logger = structlog.get_logger()

async def create_ucm_from_datapoints(...):
    logger.info(
        "ucm_creation_started",
        source_standard=source_standard,
        target_standards=target_standards,
        dry_run=dry_run
    )
    
    result = ...
    
    logger.info(
        "ucm_creation_completed",
        status=result["status"],
        saved_count=result.get("saved_count", 0)
    )
    
    return result
```

### 12.2 메트릭

```python
from prometheus_client import Counter, Histogram

ucm_creation_counter = Counter(
    "esg_data_ucm_creations_total",
    "Total UCM creations",
    ["status"]
)

ucm_creation_duration = Histogram(
    "esg_data_ucm_creation_duration_seconds",
    "UCM creation duration"
)
```

---

## 13. 향후 확장 계획

### 13.1 자동 UCM 승격

```python
# unmapped_data_points → unified_column_mappings 자동 전환
# 조건:
# - mapping_status == 'reviewing'
# - mapping_confidence > 0.8
# - LLM 최종 승인
```

### 13.2 품질 점수 자동 산정

```python
# sr_report_unified_data.confidence_score 자동 계산
# 기준:
# - 소스 데이터 최신성
# - 매핑 신뢰도
# - 값 범위 준수
```

### 13.3 이상 탐지 자동화

```python
# data_quality_issues 테이블 신설
# 일간 배치로 자동 검증 + 알림
```

---

## 14. FAQ

### Q1. Agent 없이 바로 Service 호출하면 안 되나요?

**A**: Phase 1에서는 그렇게 합니다. Agent는 Phase 2부터 추가하며, 주로 LLM 판단이 필요한 경우에만 사용합니다.

### Q2. data_integration처럼 LangGraph를 처음부터 써야 하나요?

**A**: 아니요. UCM 생성은 단순 플로우라 처음엔 함수 체인으로 충분합니다. 조건 분기가 복잡해지면 Phase 3에서 적용합니다.

### Q3. MCP 서버를 꼭 만들어야 하나요?

**A**: 외부 에이전트·IDE 연동이 있으면 권장합니다. 내부만 쓰더라도 **에이전트→MCP 클라이언트→툴**로 통일하면 외부와 동일 계약으로 테스트·운영할 수 있다. REST만 쓰고 에이전트가 서비스를 직접 부르는 최소 구성도 가능하나, 문서의 권장 스택과는 다르다.

### Q4. Repository를 esg_data에 복사해야 하나요?

**A**: 아니요. `ifrs_agent`의 repository를 직접 import해서 재사용하는 것이 좋습니다.

### Q5. Streamable HTTP는 왜 필요한가요?

**A**: 실시간 진행상황(스트리밍)을 외부 클라이언트에 전달하기 위함입니다. `data_integration`과 동일한 패턴입니다.

---

## 15. 참고 자료

- [ESG 데이터 서비스 설계](./esg_data.md)
- [UCM 결정/정책 모듈 설계](./UCM_DECISION_POLICY_DESIGN.md)
- [UCM 정책 파이프라인 5단계·레거시 배치](./UCM_POLICY_PIPELINE_AND_LEGACY_BATCH.md)
- [DATABASE_TABLES_STRUCTURE.md](../../ifrs_agent/docs/DATABASE_TABLES_STRUCTURE.md)
- [DATA_ONTOLOGY.md](../../ifrs_agent/docs/DATA_ONTOLOGY.md)
- [data_integration 구조](../../data_integration/)
- [MappingSuggestionService](../../ifrs_agent/service/mapping_suggestion_service.py)

---

**작성일**: 2026-03-24 (에이전트·MCP 클라이언트 경계 반영: 2026-03-26)  
**버전**: 1.1  
**상태**: 초안
