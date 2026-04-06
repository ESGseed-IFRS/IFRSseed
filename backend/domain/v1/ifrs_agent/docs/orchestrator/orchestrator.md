# orchestrator.md

**최종 수정**: 2026-04-06  
**문서 버전**: 1.2 (in-process MCP + DP 유형 라우팅 + Phase 2 동적 데이터 선택)

---

## 1. 개요

`orchestrator`는 IFRS 지속가능성 보고서 생성 시스템의 **중앙 제어**를 담당한다. 사용자 요청(`action`)을 분석하고, 데이터 수집·생성·검증 노드를 **병렬·순차**로 호출해 **초안 생성 → 검증 루프 → 사용자 수정 → 최종 반환**까지 전체 워크플로우를 조율한다.

| 항목 | 내용 |
|------|------|
| **위치** | `backend/domain/v1/ifrs_agent/hub/orchestrator/` |
| **LLM** | Gemini 3.1 Pro (분기·재시도 판단), **Gemini 2.5 Pro (Phase 2 데이터 선택)** |
| **의존성** | `spokes/infra/` (에이전트·툴 호출 추상) |
| **외부 의존** | LangGraph (상태 관리·체크포인팅만), `google.generativeai` (Gemini) |

---

## 2. 주요 역할

### 2.1 3가지 실행 경로

| 경로 | `action` | 설명 | 종료 조건 |
|------|----------|------|-----------|
| **경로 1** | `"create"` | **Phase 1**(병렬 데이터 수집) → **Phase 2**(LLM 기반 동적 데이터 선택 및 필터링) → **Phase 3**(생성·검증 루프, 최대 3회) → **Phase 4**(최종 반환) | validator 통과 or 최대 재시도 소진 |
| **경로 2** | `"retry"` | 경로 1의 **Phase 3** 내부에서 재진입 (validator 피드백 반영) | validator 통과 or 최대 재시도 소진 |
| **경로 3** | `"refine"` | 사용자 수동 수정: 기존 페이지 로드 → gen_node(refine_mode) → validator(선택적) → 반환 | 사용자 만족 (validator는 참고용) |

---

## 3. 아키텍처 구조

### 3.1 계층 관계

```
┌─────────────────────────────────────────────────────┐
│                  Orchestrator                       │
│                  (hub/orchestrator/)                │
│  - orchestrate(user_input)                          │
│  - _create_new_report(...)                          │
│  - _refine_existing_report(...)                     │
│  - _parallel_collect(...)                           │
│  - _generation_validation_loop(...)                 │
└──────────────────┬──────────────────────────────────┘
                   │ (의존)
                   ▼
┌─────────────────────────────────────────────────────┐
│                 Infra (in-process MCP)              │
│                 (spokes/infra/)                     │
│  - call_agent(agent_name, action, payload)          │
│  - call_tool(tool_name, params)                     │
│  - 타임아웃, 로깅, 권한, 레지스트리                   │
└──────────────────┬──────────────────────────────────┘
                   │ (디스패치)
        ┌──────────┴───────────┐
        ▼                      ▼
┌─────────────┐        ┌─────────────┐
│ c_rag       │        │ dp_rag      │  ...
│ (collect)   │        │ (collect)   │
└─────────────┘        └─────────────┘
```

**핵심 원칙**:

1. **Orchestrator**는 에이전트를 **직접 import하지 않음**. 모든 호출은 `infra.call_agent(...)`로 진행.
2. **에이전트**는 오케스트레이터를 알지 못함. 응답만 `infra`에 반환.
3. **Infra**가 단일 진입점: 타임아웃·로깅·권한 관리 통일.

---

## 4. 구현 진입점

### 4.1 `orchestrate` (메인 진입점)

```python
class Orchestrator:
    def __init__(self, infra: InfraLayer):
        self.infra = infra
        self.llm = Gemini_3_1_Pro()  # 분기·재시도 판단

    async def orchestrate(self, user_input: dict) -> dict:
        """
        사용자 요청 action에 따라 분기
        - "create": 초안 생성 + validator 자동 루프
        - "refine": 사용자 수정 요청
        """
        if user_input["action"] == "create":
            return await self._create_new_report(user_input)
        elif user_input["action"] == "refine":
            return await self._refine_existing_report(user_input)
        else:
            raise ValueError(f"Unknown action: {user_input['action']}")
```

---

### 4.2 `_create_new_report` (경로 1 → 경로 2)

```python
async def _create_new_report(self, user_input: dict) -> dict:
    """
    Phase 1: 병렬 데이터 수집
    Phase 2: 병합
    Phase 3: 생성-검증 반복 루프
    Phase 4: 최종 반환
    """
    # Phase 1: 병렬 데이터 수집
    data = await self._parallel_collect(user_input)
    
    state = {
        "ref_data": data["ref_data"],
        "fact_data": data["fact_data"],
        "agg_data": data["agg_data"],
        "user_input": user_input,
        "feedback": None
    }
    
    # Phase 2: 병합 (오케스트레이터 내부 로직)
    state = self._merge_data(state)
    
    # Phase 3: 생성-검증 반복 루프
    state = await self._generation_validation_loop(state, max_retries=3)
    
    # Phase 4: 최종 결과 반환
    return {
        "generated_text": state["generated_text"],
        "validation": state["validation"],
        "references": {
            "sr_pages": [
                state["ref_data"]["2024"]["page_number"],
                state["ref_data"]["2023"]["page_number"]
            ],
            "subsidiary_data": state["ref_data"]["2024"]["subsidiary_data"],
            "fact_data": state["fact_data"]
        },
        "metadata": {
            "attempts": state.get("attempt", 0) + 1,
            "external_company_snapshot_used": bool(
                state["ref_data"].get("2024", {}).get("external_company_data")
                or state["ref_data"].get("2023", {}).get("external_company_data")
            ),
            "status": state["status"],
            "mode": "draft"
        }
    }
```

---

### 4.3 Phase 2: `_merge_and_filter_data` — LLM 기반 동적 데이터 선택 ✨ NEW

**2026-04-06 추가**: Phase 2에서 **Gemini 2.5 Pro**가 카테고리·DP·SR 본문을 분석하여 gen_node에 필요한 데이터만 선택합니다.

```python
async def _merge_and_filter_data(self, state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Phase 2: ref_data + fact_data + agg_data 병합 및 필터링
    
    LLM(Gemini 2.5 Pro)이 카테고리·DP·SR 본문을 분석하여
    gen_node에 필요한 데이터만 동적으로 선택
    """
    ref_data = state["ref_data"]
    fact_data = state["fact_data"]
    agg_data = state["agg_data"]
    user_input = state["user_input"]
    
    # 1. LLM 기반 데이터 선택
    selection = await self._select_data_for_gen(
        category=user_input.get("category", ""),
        dp_id=user_input.get("dp_id", ""),
        fact_data=fact_data,
        ref_data=ref_data
    )
    
    logger.info(f"Data selection result: {selection.get('rationale', 'N/A')}")
    
    # 2. 선택 결과에 따라 gen_node 입력 구성
    gen_input = self._build_gen_input(
        ref_data=ref_data,
        fact_data=fact_data,
        agg_data=agg_data,
        user_input=user_input,
        selection=selection
    )
    
    state["gen_input"] = gen_input
    state["data_selection"] = selection
    return state
```

**상세 문서**: `docs/orchestrator/PHASE2_DATA_SELECTION.md`

**주요 메서드**:
- `_select_data_for_gen`: LLM 프롬프트로 필요 데이터 판단
- `_rule_based_selection`: LLM 실패 시 규칙 기반 폴백
- `_build_gen_input`: 선택 결과에 따라 gen_input 구성
- `_extract_sr_essentials`: SR 데이터 핵심 필드만 추출
- `_extract_agg_essentials`: aggregation 데이터 핵심 필드만 추출

---

### 4.4 `_parallel_collect` (Phase 1) — DP 유형 라우팅 포함 ✨

```python
async def _parallel_collect(self, user_input):
    """
    c_rag, dp_rag, aggregation_node를 병렬 호출 → 결과 병합
    
    ✨ 2026-04-05: DP 유형 선행 체크 추가
    - dp_id가 있을 때 _check_dp_type_for_routing 먼저 호출
    - quantitative만 dp_rag 호출, 정성은 생략 (TODO: narrative_rag)
    """
    company_id = user_input["company_id"]
    category = user_input["category"]
    years = [2024, 2023]
    
    # c_rag: SR 본문·이미지
    c_rag_task = self.infra.call_agent(
        "c_rag", "collect",
        {"company_id": company_id, "category": category, "years": years}
    )
    
    # dp_rag: DP 유형 선행 체크 (제안 B)
    dp_rag_task = None
    if user_input.get("dp_id"):
        dp_type_check = await self._check_dp_type_for_routing(user_input["dp_id"])
        
        if dp_type_check["is_quantitative"]:
            logger.info("DP is quantitative — calling dp_rag")
            dp_rag_task = self.infra.call_agent(
                "dp_rag", "collect",
                {"company_id": company_id, "dp_id": user_input["dp_id"], "year": 2024}
            )
        else:
            logger.warning("DP is NOT quantitative — skipping dp_rag")
            # TODO: narrative_rag 또는 c_rag 통합
    
    # aggregation_node: 계열사·외부 기업 데이터
    aggregation_task = self.infra.call_agent(
        "aggregation_node", "collect",
        {"company_id": company_id, "category": category, "years": years}
    )
    
    # 대기 (예외 처리 포함)
    if dp_rag_task:
        c_rag_result, dp_rag_result, agg_result = await asyncio.gather(
            c_rag_task, dp_rag_task, aggregation_task,
            return_exceptions=True
        )
    else:
        c_rag_result, agg_result = await asyncio.gather(
            c_rag_task, aggregation_task,
            return_exceptions=True
        )
        dp_rag_result = {}
    
    # 예외 체크
    if isinstance(c_rag_result, Exception):
        logger.error("c_rag failed: %s", c_rag_result)
        c_rag_result = {}
    if isinstance(dp_rag_result, Exception):
        logger.error("dp_rag failed: %s", dp_rag_result)
        dp_rag_result = {}
    if isinstance(agg_result, Exception):
        logger.error("aggregation_node failed: %s", agg_result)
        agg_result = {}
    
    return {
        "ref_data": c_rag_result,
        "fact_data": dp_rag_result,
        "agg_data": agg_result
    }
```

#### 4.4.1 `_check_dp_type_for_routing` (제안 B)

```python
async def _check_dp_type_for_routing(self, dp_id: str) -> Dict[str, Any]:
    """
    DP 유형 선행 체크 — quantitative만 dp_rag 호출.
    
    Returns:
        {
            "is_quantitative": bool,
            "dp_type": str | None,
            "reason": str
        }
    """
    # UCM 접두
    if dp_id.upper().startswith("UCM"):
        ucm_info = await self.infra.call_tool("query_ucm_direct", {"ucm_id": dp_id})
        if not ucm_info:
            return {"is_quantitative": False, "dp_type": None, "reason": "UCM not found"}
        
        # description 키워드 체크
        desc = (ucm_info.get("column_description") or "").lower()
        qualitative_keywords = ["여부", "방법을", "설명하", "공개하"]
        if any(kw in desc for kw in qualitative_keywords):
            return {"is_quantitative": False, "dp_type": "qualitative", "reason": "UCM suggests qualitative"}
        
        return {"is_quantitative": True, "dp_type": "quantitative", "reason": "UCM, no qualitative signal"}
    
    # 일반 DP
    else:
        dp_meta = await self.infra.call_tool("query_dp_metadata", {"dp_id": dp_id})
        if not dp_meta:
            return {"is_quantitative": False, "dp_type": None, "reason": "DP not found"}
        
        dp_type = dp_meta.get("dp_type")
        if dp_type == "quantitative":
            return {"is_quantitative": True, "dp_type": dp_type, "reason": "dp_type=quantitative"}
        else:
            return {"is_quantitative": False, "dp_type": dp_type, "reason": f"dp_type={dp_type}"}
```

---

### 4.4 `_generation_validation_loop` (Phase 3)

```python
async def _generation_validation_loop(self, state, max_retries=3):
    """
    생성-검증 반복 루프
    - 최대 max_retries 회 재시도
    - validator 통과 or 소진 시 종료
    """
    for attempt in range(max_retries):
        state["attempt"] = attempt
        
        # gen_node 호출 (draft_mode)
        gen_result = await self.infra.call_agent(
            "gen_node", "generate",
            {
                "ref_data": state["ref_data"],
                "fact_data": state["fact_data"],
                "agg_data": state["agg_data"],
                "feedback": state.get("feedback"),
                "mode": "draft"
            }
        )
        state["generated_text"] = gen_result["text"]
        
        # validator_node 호출
        validation = await self.infra.call_agent(
            "validator_node", "validate",
            {
                "generated_text": state["generated_text"],
                "fact_data": state["fact_data"],
                "category": state["user_input"]["category"]
            }
        )
        state["validation"] = validation
        
        if validation["is_valid"]:
            state["status"] = "success"
            break
        else:
            # 피드백 추출 → 다음 루프에 반영
            state["feedback"] = validation["errors"]
            state["status"] = "retry"
    else:
        # 최대 재시도 소진
        state["status"] = "max_retries_exceeded"
    
    return state
```

---

### 4.5 `_refine_existing_report` (경로 3)

```python
async def _refine_existing_report(self, user_input: dict) -> dict:
    """
    사용자 수정 요청 (refine_mode)
    - validator 필수 통과 아님
    - 사용자 만족도가 기준
    """
    # 1. 기존 페이지 로드
    existing_page = self._load_from_db(
        report_id=user_input["report_id"],
        page_number=user_input["page_number"]
    )
    
    # 2. refine_mode 실행
    refined = await self.infra.call_agent(
        "gen_node", "generate",
        {
            "state": existing_page["state"],
            "mode": "refine",
            "previous_text": existing_page["generated_text"],
            "user_instruction": user_input["user_instruction"]
        }
    )
    
    # 3. validator 선택적 실행 (참고용)
    validation = await self.infra.call_agent(
        "validator_node", "validate",
        {
            "generated_text": refined["text"],
            "fact_data": existing_page["state"]["fact_data"],
            "category": existing_page["state"]["user_input"]["category"]
        }
    )
    
    # 4. 사용자에게 결과 + 경고 반환
    return {
        "generated_text": refined["text"],
        "previous_text": existing_page["generated_text"],
        "validation": validation,  # 참고용 (강제 아님)
        "user_instruction": user_input["user_instruction"],
        "mode": "refine",
        "warnings": validation["warnings"] if not validation["is_valid"] else []
    }
```

---

## 5. LangGraph 통합

### 5.1 그래프 구성

```python
from langgraph.graph import StateGraph
from typing import TypedDict

class WorkflowState(TypedDict):
    user_input: dict
    ref_data: dict
    fact_data: dict
    agg_data: dict
    generated_text: str
    validation: dict
    status: str
    attempt: int

def build_workflow():
    workflow = StateGraph(WorkflowState)
    
    # 단일 노드: orchestrator_node (핵심)
    workflow.add_node("orchestrator_node", orchestrator_run)
    
    # 진입점
    workflow.set_entry_point("orchestrator_node")
    
    # 조건부 간선 (재시도 시 자기 자신 다시 호출)
    def should_retry(state: WorkflowState) -> str:
        if state.get("status") == "retry":
            return "orchestrator_node"
        return "__end__"
    
    workflow.add_conditional_edges("orchestrator_node", should_retry, {
        "orchestrator_node": "orchestrator_node",
        "__end__": "__end__"
    })
    
    return workflow.compile()

async def orchestrator_run(state: WorkflowState) -> WorkflowState:
    """LangGraph 노드 — 오케스트레이터 진입점"""
    orchestrator = Orchestrator(infra=get_infra_instance())
    result = await orchestrator.orchestrate(state["user_input"])
    
    state["generated_text"] = result["generated_text"]
    state["validation"] = result["validation"]
    state["status"] = result["metadata"]["status"]
    state["attempt"] = result["metadata"]["attempts"]
    return state
```

**핵심**: LangGraph 그래프는 **`orchestrator_node` 하나**만 두고, 내부에서 오케스트레이터가 `infra → c_rag/dp_rag/aggregation/gen/validator` 모두를 **직접·병렬·순차 제어**한다. 상태 재시도가 필요하면 조건부 간선으로 **동일 노드**를 다시 호출한다. 이렇게 하면 **LangGraph는 상태 관리 컨테이너**에 가깝고, **에이전틱 루프는 오케스트레이터가 담당**한다.

---

## 6. 에러 처리 및 로깅

### 6.1 타임아웃·재시도

- 각 에이전트 호출 시 `infra`에서 **타임아웃**(기본 30초) 관리
- 네트워크·DB 장애 시 **지수 백오프** 재시도 (최대 3회)
- 최종 실패 시 사용자에게 상세 에러 메시지 반환

### 6.2 로깅

```python
# 오케스트레이터 내부
import logging
logger = logging.getLogger("ifrs_agent.orchestrator")

async def orchestrate(self, user_input: dict) -> dict:
    logger.info(f"Orchestrate started: action={user_input['action']}")
    try:
        # ...
    except Exception as e:
        logger.error(f"Orchestrate failed: {e}", exc_info=True)
        raise
```

- 로그는 `spokes/infra/` 레벨에서도 **중앙 집계** (요청 ID, 타임스탬프, 에이전트명, 소요 시간)
- Elasticsearch·CloudWatch 등으로 전송 (배포 환경 설정)

---

## 7. 참고 문서

- `REVISED_WORKFLOW.md` (전체 워크플로우 설계)
- `c_rag.md` (c_rag 에이전트 구현)
- `infra.md` (in-process MCP 인프라 설계)

---

**최종 수정**: 2026-04-04
