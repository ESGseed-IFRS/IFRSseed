"""
Orchestrator - IFRS 에이전트 중앙 제어

LangGraph 통합 및 워크플로우 조율
"""
import logging
import asyncio
from typing import Dict, Any

from backend.core.config.settings import get_settings
from backend.domain.v1.ifrs_agent.models.runtime_config import (
    agent_runtime_config_from_settings,
    with_runtime_config,
)

logger = logging.getLogger("ifrs_agent.orchestrator")


class Orchestrator:
    """
    오케스트레이터
    
    사용자 요청을 받아 전체 워크플로우를 조율:
    - Phase 1: 병렬 데이터 수집 (c_rag, dp_rag, aggregation_node)
    - Phase 2: 데이터 병합
    - Phase 3: 생성-검증 반복 루프
    - Phase 4: 최종 반환
    """
    
    def __init__(self, infra):
        """
        Args:
            infra: InfraLayer 인스턴스
        """
        from backend.domain.v1.ifrs_agent.spokes.infra import InfraLayer

        self.infra: InfraLayer = infra
        self.settings = get_settings()

        if not (self.settings.gemini_api_key or "").strip():
            logger.warning(
                "GEMINI_API_KEY empty — orchestrator LLM 연동 시 설정 필요 (.env / Settings)"
            )

        logger.info("Orchestrator initialized (shared Settings via get_settings())")

    def _agent_runtime(self):
        """에이전트에 넘길 Settings 슬라이스 (매 호출 시 최신 get_settings() 반영)."""
        return agent_runtime_config_from_settings(self.settings)

    def _agent_payload(self, base: Dict[str, Any]) -> Dict[str, Any]:
        """모든 infra.call_agent 페이로드에 runtime_config를 붙인다."""
        return with_runtime_config(base, self._agent_runtime())
    
    async def orchestrate(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        메인 진입점: action에 따라 분기
        
        Args:
            user_input: {
                "action": "create" | "refine",
                "company_id": str,
                "category": str,
                "dp_id": str (optional),
                "report_id": str (refine용),
                "page_number": int (refine용),
                "user_instruction": str (refine용)
            }
        
        Returns:
            Dict[str, Any]: 최종 결과
        """
        action = user_input.get("action", "create")
        
        logger.info(f"Orchestrator.orchestrate started: action={action}")
        
        if action == "create":
            return await self._create_new_report(user_input)
        elif action == "refine":
            return await self._refine_existing_report(user_input)
        else:
            raise ValueError(f"Unknown action: {action}")
    
    async def _create_new_report(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        경로 1 → 경로 2: 초안 생성 + validator 자동 루프
        
        Phase 1: 병렬 데이터 수집
        Phase 2: 병합
        Phase 3: 생성-검증 반복 루프
        Phase 4: 최종 반환
        """
        logger.info("Phase 1: Parallel data collection started")
        
        # Phase 1: 병렬 데이터 수집
        data = await self._parallel_collect(user_input)
        
        state = {
            "ref_data": data["ref_data"],
            "fact_data": data["fact_data"],
            "agg_data": data["agg_data"],
            "user_input": user_input,
            "feedback": None
        }
        
        logger.info("Phase 2: Data merging started")
        
        # Phase 2: 데이터 병합
        state = self._merge_data(state)
        
        logger.info("Phase 3: Generation-validation loop started")
        
        # Phase 3: 생성-검증 반복 루프
        state = await self._generation_validation_loop(state, max_retries=3)
        
        logger.info(f"Phase 4: Final return (status={state.get('status', 'unknown')})")
        
        # Phase 4: 최종 결과 반환
        return {
            "generated_text": state.get("generated_text", ""),
            "validation": state.get("validation", {}),
            "error": state.get("error"),
            "agg_data": state.get("agg_data", {}),
            "references": {
                "sr_pages": [
                    state["ref_data"].get("2024", {}).get("page_number"),
                    state["ref_data"].get("2023", {}).get("page_number"),
                ],
                "sr_data": state["ref_data"],
                "agg_data": state.get("agg_data", {}),
                "subsidiary_data": state.get("agg_data", {}).get("subsidiary_data", []),
                "fact_data": state["fact_data"],
            },
            "metadata": {
                "attempts": state.get("attempt", 0) + 1,
                "external_company_snapshot_used": bool(
                    state.get("agg_data", {}).get("external_company_data")
                ),
                "status": state.get("status", "failed"),
                "mode": "draft"
            }
        }
    
    async def _parallel_collect(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Phase 1: c_rag, dp_rag, aggregation_node 병렬 호출
        
        Returns:
            {
                "ref_data": c_rag 결과,
                "fact_data": dp_rag 결과,
                "agg_data": aggregation_node 결과
            }
        """
        company_id = user_input["company_id"]
        category = user_input["category"]
        years = [2024, 2023]
        heavy_timeout = get_settings().ifrs_infra_heavy_timeout_sec

        # 병렬 호출 (infra 경유) — c_rag는 연도·임베딩·LLM 병행이라 긴 타임아웃
        c_rag_task = self.infra.call_agent(
            "c_rag",
            "collect",
            self._agent_payload(
                {"company_id": company_id, "category": category, "years": years}
            ),
            timeout=heavy_timeout,
        )

        # dp_rag: DP 기반 실데이터 (보고서 기준 연도 — SR과 맞춤: 최신 공시 연도 2024)
        # user_input에 dp_id가 있을 때만 호출
        # dp_rag: DP 기반 실데이터 (정량) 또는 기준·설명 (정성)
        dp_rag_task = None
        
        if user_input.get("dp_id"):
            logger.info(
                "orchestrator: DP %s detected — routing to dp_rag (handles both quantitative and qualitative)",
                user_input["dp_id"]
            )
            dp_rag_task = self.infra.call_agent(
                "dp_rag",
                "collect",
                self._agent_payload(
                    {
                        "company_id": company_id,
                        "dp_id": user_input["dp_id"],
                        "year": 2024,
                    }
                ),
                timeout=heavy_timeout,
            )

        # aggregation_node: 계열사·외부 기업 데이터
        aggregation_task = None
        registered_agents = self.infra.agent_registry.list_agents()
        if "aggregation_node" in registered_agents:
            aggregation_payload = {
                "company_id": company_id,
                "category": category,
                "years": years
            }
            # DP가 있으면 aggregation_node에도 전달 (related_dp_ids 필터용)
            if user_input.get("dp_id"):
                aggregation_payload["dp_id"] = user_input["dp_id"]
            
            # 관련성 기반 검색을 위한 메타데이터 전달
            # (c_rag, dp_rag 완료 후 결과 사용 불가 → 병렬 실행 제약)
            # 대신 user_input에서 직접 전달 가능한 정보 사용
            if user_input.get("dp_metadata"):
                aggregation_payload["dp_metadata"] = user_input["dp_metadata"]
            if user_input.get("sr_context"):
                aggregation_payload["sr_context"] = user_input["sr_context"]
            
            aggregation_task = self.infra.call_agent(
                "aggregation_node",
                "collect",
                self._agent_payload(aggregation_payload),
                timeout=heavy_timeout,
            )
        
        # 대기 (예외 처리 포함)
        try:
            if dp_rag_task and aggregation_task:
                c_rag_result, dp_rag_result, agg_result = await asyncio.gather(
                    c_rag_task, dp_rag_task, aggregation_task,
                    return_exceptions=True
                )
            elif dp_rag_task:
                c_rag_result, dp_rag_result = await asyncio.gather(
                    c_rag_task, dp_rag_task,
                    return_exceptions=True
                )
                agg_result = {}
            elif aggregation_task:
                c_rag_result, agg_result = await asyncio.gather(
                    c_rag_task, aggregation_task,
                    return_exceptions=True
                )
                dp_rag_result = {}
            else:
                c_rag_result = await c_rag_task
                dp_rag_result = {}
                agg_result = {}
            
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
        
        except Exception as e:
            logger.error(f"Parallel collection failed: {e}", exc_info=True)
            raise
    
    async def _check_dp_type_for_routing(self, dp_id: str) -> Dict[str, Any]:
        """
        제안 B: DP 유형 선행 체크 — quantitative만 dp_rag 호출.
        
        Args:
            dp_id: DP ID 또는 UCM ID
        
        Returns:
            {
                "is_quantitative": bool,
                "dp_type": str | None,  # "quantitative", "qualitative", "narrative", "binary"
                "reason": str
            }
        """
        try:
            # 1. data_points 조회 (UCM 접두면 생략 가능)
            if dp_id.upper().startswith("UCM"):
                # UCM은 data_points에 없으므로 UCM 직접 조회
                ucm_info = await self.infra.call_tool("query_ucm_direct", {"ucm_id": dp_id})
                if not ucm_info:
                    return {
                        "is_quantitative": False,
                        "dp_type": None,
                        "reason": "UCM not found"
                    }
                
                # UCM description 키워드 기반 간단 판단
                desc = (ucm_info.get("column_description") or "").lower()
                name_ko = (ucm_info.get("column_name_ko") or "").lower()
                
                # "여부", "방법", "설명", "공개" 등 → 정성
                qualitative_keywords = ["여부", "방법을", "설명하", "공개하", "기술하"]
                if any(kw in desc or kw in name_ko for kw in qualitative_keywords):
                    return {
                        "is_quantitative": False,
                        "dp_type": "qualitative",
                        "reason": "UCM description suggests qualitative/narrative"
                    }
                
                # 기본적으로 UCM은 정량으로 가정 (보수적)
                return {
                    "is_quantitative": True,
                    "dp_type": "quantitative",
                    "reason": "UCM, no clear qualitative signal"
                }
            
            else:
                # data_points 조회
                dp_meta = await self.infra.call_tool("query_dp_metadata", {"dp_id": dp_id})
                if not dp_meta:
                    return {
                        "is_quantitative": False,
                        "dp_type": None,
                        "reason": "DP not found in data_points"
                    }
                
                dp_type = dp_meta.get("dp_type")
                
                # quantitative만 True
                if dp_type == "quantitative":
                    return {
                        "is_quantitative": True,
                        "dp_type": dp_type,
                        "reason": "dp_type=quantitative"
                    }
                else:
                    return {
                        "is_quantitative": False,
                        "dp_type": dp_type,
                        "reason": f"dp_type={dp_type} (not quantitative)"
                    }
        
        except Exception as e:
            logger.error("_check_dp_type_for_routing failed: %s", e, exc_info=True)
            # 실패 시 안전하게 정량으로 가정 (기존 동작 유지)
            return {
                "is_quantitative": True,
                "dp_type": None,
                "reason": f"Error during check: {e}"
            }
    
    def _merge_data(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Phase 2: ref_data + fact_data + agg_data 병합
        
        gen_node 입력용 통합 데이터 생성
        """
        merged = {
            "ref_data": state["ref_data"],
            "fact_data": state["fact_data"],
            "agg_data": state["agg_data"],
            "user_input": state["user_input"]
        }
        
        state["merged_data"] = merged
        return state
    
    async def _generation_validation_loop(
        self,
        state: Dict[str, Any],
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """
        Phase 3: 생성-검증 반복 루프
        
        - 최대 max_retries 회 재시도
        - validator 통과 or 소진 시 종료
        """
        for attempt in range(max_retries):
            state["attempt"] = attempt
            
            logger.info(f"Generation-validation loop: attempt={attempt+1}/{max_retries}")
            
            # gen_node 호출 (draft_mode)
            try:
                gen_result = await self.infra.call_agent(
                    "gen_node",
                    "generate",
                    self._agent_payload(
                        {
                            "ref_data": state["ref_data"],
                            "fact_data": state["fact_data"],
                            "agg_data": state["agg_data"],
                            "feedback": state.get("feedback"),
                            "mode": "draft",
                        }
                    ),
                )
                state["generated_text"] = gen_result.get("text", "")
            
            except Exception as e:
                logger.error(f"gen_node failed: {e}", exc_info=True)
                state["generated_text"] = ""
                state["validation"] = {"is_valid": False, "errors": [str(e)]}
                state["status"] = "failed"
                state["error"] = str(e)
                break
            
            # validator_node 호출
            try:
                validation = await self.infra.call_agent(
                    "validator_node",
                    "validate",
                    self._agent_payload(
                        {
                            "generated_text": state["generated_text"],
                            "fact_data": state["fact_data"],
                            "category": state["user_input"]["category"],
                        }
                    ),
                )
                state["validation"] = validation
                
                if validation.get("is_valid", False):
                    state["status"] = "success"
                    logger.info(f"Validation passed at attempt={attempt+1}")
                    break
                else:
                    # 피드백 추출 → 다음 루프에 반영
                    state["feedback"] = validation.get("errors", [])
                    state["status"] = "retry"
                    logger.info(f"Validation failed at attempt={attempt+1}, feedback={state['feedback']}")
            
            except Exception as e:
                logger.error(f"validator_node failed: {e}", exc_info=True)
                state["validation"] = {"is_valid": False, "errors": [str(e)]}
                state["status"] = "failed"
                state["error"] = str(e)
                break
        else:
            # 최대 재시도 소진
            state["status"] = "max_retries_exceeded"
            state.setdefault("validation", {})
            logger.warning(f"Max retries exceeded: max_retries={max_retries}")
        
        state.setdefault("validation", {})
        state.setdefault("status", "failed")
        return state
    
    async def _refine_existing_report(self, user_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        경로 3: 사용자 수정 요청 (refine_mode)
        
        - validator 필수 통과 아님
        - 사용자 만족도가 기준
        """
        logger.info(f"Refine mode started: report_id={user_input.get('report_id')}")
        
        # 1. 기존 페이지 로드 (TODO: DB 조회 구현)
        existing_page = self._load_from_db(
            report_id=user_input["report_id"],
            page_number=user_input["page_number"]
        )
        
        # 2. refine_mode 실행
        try:
            refined = await self.infra.call_agent(
                "gen_node",
                "generate",
                self._agent_payload(
                    {
                        "state": existing_page["state"],
                        "mode": "refine",
                        "previous_text": existing_page["generated_text"],
                        "user_instruction": user_input["user_instruction"],
                    }
                ),
            )
        except Exception as e:
            logger.error(f"gen_node (refine) failed: {e}", exc_info=True)
            return {
                "error": str(e),
                "status": "failed"
            }
        
        # 3. validator 선택적 실행 (참고용)
        try:
            validation = await self.infra.call_agent(
                "validator_node",
                "validate",
                self._agent_payload(
                    {
                        "generated_text": refined.get("text", ""),
                        "fact_data": existing_page["state"].get("fact_data", {}),
                        "category": existing_page["state"]
                        .get("user_input", {})
                        .get("category", ""),
                    }
                ),
            )
        except Exception as e:
            logger.error(f"validator_node (refine) failed: {e}", exc_info=True)
            validation = {"is_valid": False, "errors": [str(e)]}
        
        # 4. 사용자에게 결과 + 경고 반환
        return {
            "generated_text": refined.get("text", ""),
            "previous_text": existing_page["generated_text"],
            "validation": validation,
            "user_instruction": user_input["user_instruction"],
            "mode": "refine",
            "warnings": validation.get("warnings", []) if not validation.get("is_valid", False) else []
        }
    
    def _load_from_db(self, report_id: str, page_number: int) -> Dict[str, Any]:
        """
        기존 페이지 로드 (DB 조회)
        
        TODO: 실제 DB 쿼리 구현
        
        Returns:
            {
                "generated_text": str,
                "state": Dict[str, Any]  # 생성 시 사용한 상태
            }
        """
        # 임시 구현
        logger.warning("_load_from_db: Mock implementation")
        return {
            "generated_text": "",
            "state": {}
        }
