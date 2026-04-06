# Gen Node 구현 완료 요약

**작성일**: 2026-04-06  
**버전**: 1.0  
**상태**: ✅ 구현 완료

---

## 📋 구현된 파일

### 1. 핵심 파일

| 파일 | 역할 | 라인 수 |
|------|------|---------|
| `spokes/agents/gen_node/__init__.py` | 패키지 진입점 | 7 |
| `spokes/agents/gen_node/agent.py` | GenNodeAgent 클래스, LLM 호출 로직 | ~350 |
| `spokes/agents/gen_node/prompts.py` | 프롬프트 템플릿 및 구성 함수 | ~380 |
| `spokes/agents/gen_node/utils.py` | 유틸리티 (토큰 추정, 텍스트 정제) | ~120 |

### 2. 설정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `hub/bootstrap.py` | gen_node 등록 (스텁 → 실제 구현) |
| `core/config/settings.py` | `gen_node_model` 설정 추가 |
| `models/runtime_config.py` | `gen_node_model` 런타임 설정 추가 |

---

## 🎯 주요 기능

### 1. GenNodeAgent 클래스

**위치**: `spokes/agents/gen_node/agent.py`

```python
class GenNodeAgent:
    async def generate(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        SR 문단 생성 진입점
        
        Args:
            payload: {
                "gen_input": Phase 2 필터링 결과,
                "runtime_config": API 키, 모델 등
            }
        
        Returns:
            {"text": str, "metadata": dict, "warnings": list}
            or {"error": str}
        """
```

**주요 로직**:
1. 입력 검증 (`validate_gen_input`)
2. LLM 선택 (Gemini 우선, OpenAI 대안)
3. 텍스트 생성 (재시도 최대 2회)
4. 후처리 (`postprocess_generated_text`)
5. 검증 (`validate_generated_text`)

### 2. 프롬프트 구성

**위치**: `spokes/agents/gen_node/prompts.py`

**시스템 프롬프트**: IFRS/GRI/ESRS 전문가 페르소나

**사용자 프롬프트 6개 섹션**:
1. `_build_task_section`: 작성 요청 (카테고리, 연도)
2. `_build_reference_section`: 참조 데이터 (2024/2023 SR 본문)
3. `_build_latest_data_section`: 최신 데이터 (DP 값, 회사 정보)
4. `_build_requirements_section`: 기준서 요구사항 (rulebook, UCM)
5. `_build_aggregation_section`: 계열사/외부 데이터
6. `_build_instruction_section`: 작성 지시

### 3. LLM 지원

**OpenAI (기본)**:
```python
async def generate_text_openai(
    gen_input, openai_api_key, model="gpt-5-mini"
) -> Dict[str, Any]
```

**Gemini (대안)**:
```python
async def generate_text_gemini(
    gen_input, gemini_api_key, model="gemini-2.5-flash"
) -> Dict[str, Any]
```

**파라미터**:
- `temperature`: 0.3 (일관성 중시)
- `max_tokens`: 2000 (문단 길이 제한)
- `timeout`: 30초

### 4. 유틸리티 함수

**위치**: `spokes/agents/gen_node/utils.py`

| 함수 | 역할 |
|------|------|
| `estimate_token_count` | 토큰 수 추정 (한국어: 문자당 1.5 토큰) |
| `truncate_if_needed` | 프롬프트 길이 제한 (max 6000 토큰) |
| `postprocess_generated_text` | 텍스트 정제 (공백, 메타 설명 제거) |
| `validate_generated_text` | 생성 텍스트 검증 (길이 체크) |

---

## ⚙️ 설정

### 1. 환경변수

**`.env` 파일**:
```bash
# Gen Node 모델 설정 (선택적, 기본값: gemini-2.5-pro)
GEN_NODE_MODEL=gemini-2.5-pro

# API 키 (둘 중 하나 필수, Gemini 권장)
GEMINI_API_KEY=...
OPENAI_API_KEY=sk-...
```

### 2. Settings

**`backend/core/config/settings.py`**:
```python
@dataclass
class Settings:
    # ...
    gen_node_model: str = "gemini-2.5-pro"  # 신규 추가
```

**로드 로직**:
```python
gen_node_model=(
    os.getenv("GEN_NODE_MODEL") or "gemini-2.5-pro"
).strip() or "gemini-2.5-pro"
```

### 3. Runtime Config

**`backend/domain/v1/ifrs_agent/models/runtime_config.py`**:
```python
class AgentRuntimeConfig(TypedDict, total=False):
    # ...
    gen_node_model: str  # 신규 추가

def agent_runtime_config_from_settings(settings: Settings):
    return {
        # ...
        "gen_node_model": settings.gen_node_model,
    }
```

---

## 🔄 통합

### 1. Bootstrap 등록

**`backend/domain/v1/ifrs_agent/hub/bootstrap.py`**:

**변경 전**:
```python
from backend.domain.v1.ifrs_agent.spokes.agents.stubs import gen_node_stub

infra.agent_registry.register("gen_node", gen_node_stub)
```

**변경 후**:
```python
from backend.domain.v1.ifrs_agent.spokes.agents.gen_node import make_gen_node_handler

infra.agent_registry.register("gen_node", make_gen_node_handler(infra))
```

### 2. Orchestrator 호출

**기존 코드 (변경 불필요)**:
```python
# Phase 3: 생성-검증 루프
gen_result = await self.infra.call_agent(
    "gen_node",
    {
        "gen_input": state["gen_input"],  # Phase 2 필터링 결과
        "runtime_config": runtime_config
    }
)
```

---

## ✅ 검증

### 1. 구문 검증

```bash
python -m py_compile backend/domain/v1/ifrs_agent/spokes/agents/gen_node/*.py
```

**결과**: ✅ 통과

### 2. Import 테스트

```python
from backend.domain.v1.ifrs_agent.spokes.agents.gen_node import (
    GenNodeAgent,
    make_gen_node_handler
)
```

**결과**: ✅ 통과

---

## 📊 입력/출력 예시

### 입력 (payload)

```python
{
    "gen_input": {
        "category": "재생에너지",
        "report_year": 2025,
        "ref_2024": {
            "page_number": 43,
            "body_text": "삼성SDS는 데이터센터에 태양열 급탕...",
            "images": [...]
        },
        "ref_2023": {...},
        "dp_data": {
            "dp_id": "ESRS-E1-6-28-a",
            "latest_value": 1215.25,
            "unit": "MWh",
            "year": 2024,
            "dp_name_ko": "재생에너지 생산량",
            "dp_type": "quantitative"
        }
    },
    "runtime_config": {
        "gemini_api_key": "...",
        "gen_node_model": "gemini-2.5-pro"
    }
}
```

### 출력 (성공)

```python
{
    "text": "## 재생에너지 전환\n\n삼성SDS는 데이터센터에 태양열 급탕, 태양광 발전, 지열 냉/난방 시스템을 활용하고 있으며, 2024년 총 1,215.25 MWh의 재생에너지를 생산했습니다...",
    "metadata": {
        "model": "gemini-2.5-pro",
        "tokens": 1523,
        "finish_reason": "stop",
        "generation_time_ms": 2341,
        "prompt_length": 3456
    },
    "warnings": []
}
```

### 출력 (실패)

```python
{
    "error": "Input validation failed: category is required"
}
```

---

## 🚀 다음 단계

### 1. 테스트 작성

- [ ] 단위 테스트 (`test_gen_node.py`)
  - [ ] `validate_gen_input` 테스트
  - [ ] `build_user_prompt` 테스트
  - [ ] `postprocess_generated_text` 테스트
- [ ] 통합 테스트
  - [ ] 정량 DP 시나리오
  - [ ] 정성 DP 시나리오
  - [ ] 카테고리 전용 시나리오
- [ ] E2E 테스트
  - [ ] Orchestrator → gen_node 전체 플로우

### 2. 성능 최적화

- [ ] 프롬프트 길이 최적화
- [ ] 캐싱 전략 (동일 gen_input 재사용)
- [ ] 병렬 생성 (여러 카테고리 동시 처리)

### 3. 모니터링

- [ ] 생성 시간 메트릭
- [ ] 토큰 사용량 추적
- [ ] 에러율 모니터링

### 4. 문서화

- [ ] API 문서 (Swagger/OpenAPI)
- [ ] 사용 예시 추가
- [ ] 트러블슈팅 가이드

---

## 📚 참고 문서

- [GEN_NODE_IMPLEMENTATION_STRATEGY.md](./GEN_NODE_IMPLEMENTATION_STRATEGY.md) - 구현 전략
- [REVISED_WORKFLOW.md](../REVISED_WORKFLOW.md) - 전체 워크플로우
- [orchestrator/PHASE2_DATA_SELECTION.md](../orchestrator/PHASE2_DATA_SELECTION.md) - Phase 2 데이터 필터링
- [NEW_CHAT_CONTEXT.md](../NEW_CHAT_CONTEXT.md) - 프로젝트 컨텍스트

---

**최종 수정**: 2026-04-06  
**구현 상태**: ✅ 완료 (테스트 대기)
