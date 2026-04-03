# Hub-and-Spoke 아키텍처

SR 보고서 검색·다운로드 에이전트를 Hub-Spoke 패턴으로 재구성했습니다.

## 구조

```
backend/domain/v1/data_integration/
│
├── hub/                              # 중앙 허브
│   ├── orchestrator/                 # 워크플로우 판단 및 제어
│   │   └── sr_orchestrator.py        # SR 워크플로우 조율자
│   │
│   └── routing/                      # Agent 호출 중재자
│       └── agent_router.py           # Agent 선택 및 라우팅
│
├── spokes/                           # 실행 주체들
│   ├── agents/                       # 에이전트 구현체
│   │   └── sr_agent.py               # SR 에이전트 (LLM + Tool 실행)
│   │
│   └── infra/                        # 인프라 레이어
│       ├── mcp_client.py             # MCP 연결 및 Tool 로드
│       # PDF 파싱: backend.domain.shared.tool.sr_report_tools (PDFParser, 4종 툴)
│       └── tool_utils.py             # Tool 결과 처리 유틸
│
└── service/                          # (SR Agent는 API가 Orchestrator 직접 호출)
```

## 요청 플로우

```
API Router
    │
    ▼
Hub/Orchestrator (판단)
    │ "SR Agent를 실행해야겠다"
    ▼
Hub/Routing (중재)
    │ "SR Agent 호출"
    ▼
Spokes/Agent (실행)
    ├── Infra/MCP Client (Tool 연결)
    ├── Infra/Tool Utils (결과 처리)
    └── Infra/PDF Parser (파싱)
    │
    ▼
결과 반환 (역순)
```

## 각 레이어 역할

### 1. Hub/Orchestrator
- **역할**: 워크플로우 전체 흐름 제어
- **책임**: 
  - 어떤 Agent를 실행할지 판단
  - 워크플로우 단계 관리
  - 결과 수집
- **하지 않는 것**: 직접 실행, Tool 호출, MCP 연결

### 2. Hub/Routing
- **역할**: Agent 호출 중재자
- **책임**:
  - Agent 레지스트리 관리
  - 적절한 Agent 선택 및 호출
  - Agent 실행 결과 전달
- **하지 않는 것**: 판단, 실행

### 3. Spokes/Agent
- **역할**: 실제 에이전트 로직 실행
- **책임**:
  - LLM 호출
  - Tool 실행 루프
  - 결과 취합
- **의존**: Infra 레이어 (MCP, Parser, Utils)

### 4. Spokes/Infra
- **역할**: 인프라 계층
- **책임**:
  - MCP 서버 연결
  - Tool 로드 및 관리
  - PDF 파싱
  - 검색 결과 후처리
- **하지 않는 것**: 비즈니스 로직

## 사용 방법

### API Router에서 호출

```python
# backend/api/v1/data_integration/sr_agent_router.py
from backend.domain.v1.data_integration.hub.orchestrator.sr_orchestrator import SROrchestrator

@router.get("/sr-agent/download")
async def download_sr_report(company: str, year: int):
    orchestrator = SROrchestrator()
    result = await orchestrator.execute(company=company, year=year)
    return result
```

### 직접 Orchestrator 호출

```python
from backend.domain.v1.data_integration.hub.orchestrator import SROrchestrator

orchestrator = SROrchestrator()
result = await orchestrator.execute(company="skhynix", year=2024)
```

## 확장 방법

### 새로운 Agent 추가

1. **Agent 구현**: `spokes/agents/new_agent.py`
2. **Routing 등록**: `hub/routing/agent_router.py`에 추가
3. **Orchestrator 판단**: 필요 시 `hub/orchestrator/`에 새로운 Orchestrator 생성

### 예시: GHG Agent 추가

```python
# spokes/agents/ghg_agent.py
class GHGAgent:
    async def execute(self, company_id: str):
        # GHG 계산 로직
        pass

# hub/routing/agent_router.py
self._agents["ghg_agent"] = GHGAgent()

# hub/orchestrator/ghg_orchestrator.py
class GHGOrchestrator:
    async def execute(self, company_id: str):
        return await self.router.route_to("ghg_agent", company_id=company_id)
```

## 장점

| 항목 | 설명 |
|------|------|
| **관심사 분리** | 판단(Orchestrator) / 중재(Routing) / 실행(Agent) / 인프라(Infra) |
| **테스트 용이** | 각 레이어 독립 테스트 가능 |
| **확장성** | 새로운 Agent 추가 시 Routing만 수정 |
| **재사용성** | Infra 레이어는 다른 Agent에서도 사용 가능 |
| **명확한 흐름** | 요청 플로우가 명확하게 정의됨 |

## 기존 코드와 비교

| 항목 | 기존 (SRAgentService) | 새 구조 (Hub-Spoke) |
|------|----------------------|-------------------|
| 코드 길이 | 614줄 한 파일 | 여러 파일로 분산 |
| 책임 | 모든 로직이 한 클래스에 | 레이어별로 분리 |
| 테스트 | Service 전체를 테스트 | 레이어별 단위 테스트 |
| 확장 | Service 수정 필요 | Agent 추가만 하면 됨 |
| 의존성 | 강한 결합 | 느슨한 결합 (인터페이스) |

## 마이그레이션 (완료)

기존 `sr_agent_service.py` 및 `hub/orchestrator/sr_agent_router.py`는 제거되었고,
모든 진입점이 API Router → Orchestrator → Agent 경로를 사용합니다.

- **API 레이어**: `backend.api.v1.data_integration.sr_agent_router`에서 `SROrchestrator` 직접 호출
- **Standalone main**: `data_integration.main` → 동일 `sr_agent_router` 사용
