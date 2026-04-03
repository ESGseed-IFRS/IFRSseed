"""SR Orchestrator - SR 보고서 워크플로우 조율자

LangGraph StateGraph 실행. 노드 간 상태 전달: models.langgraph.SRWorkflowState
- fetch_and_parse → save_metadata → save_index → save_body → save_images → END
- fetch_and_parse: SRAgent (MCP 검색·다운로드)
- save_*: 메타/인덱스/본문/이미지 각각 파싱 후 DB 저장 (상태로 report_id, index_page_numbers 전달)
"""
from typing import Dict, Any, Optional
from loguru import logger

from ..routing.agent_router import AgentRouter
from ...models.langgraph import SRWorkflowState
from .sr_workflow import get_sr_graph


class SROrchestrator:
    """
    SR 보고서 다운로드 워크플로우 Orchestrator
    
    역할:
    1. 워크플로우 단계 판단
    2. Routing에 명령 전달
    3. 결과 수집 및 반환
    
    실제 실행은 하지 않습니다.
    """
    
    def __init__(self):
        self.router = AgentRouter()
    
    async def execute(
        self,
        company: str,
        year: int,
        company_id: Optional[str] = None,
        save_to_db: bool = True,
        only_step: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        SR 보고서 워크플로우 실행

        워크플로우:
        1. SR Agent 호출 (검색 → 다운로드/bytes)
        2. save_metadata → (only_step에 따라) save_index / save_body / save_images

        Args:
            company: 회사명
            year: 연도
            company_id: companies.id (선택)
            save_to_db: True면 파싱 및 DB 저장 수행
            only_step: "metadata" | "index" | "body" | "images" 이면 해당 단계만 실행 후 종료

        Returns:
            {
                "success": bool,
                "message": str,
                "report_id": str,
                "index_saved_count": int,
                "sr_report_index": list,
                "parsing_result": dict,
                ...
            }
        """
        logger.info(
            f"[Orchestrator] SR 워크플로우 시작 (LangGraph): company={company}, year={year}, only_step={only_step}"
        )

        try:
            graph = get_sr_graph()
        except ImportError as e:
            logger.warning(f"[Orchestrator] LangGraph 미사용, 기존 순차 호출로 진행: {e}")
            return await self._execute_legacy(company, year, company_id, save_to_db)

        initial_state: SRWorkflowState = {
            "company": company,
            "year": year,
            "company_id": company_id,
            "save_to_db": save_to_db,
            "only_step": only_step,
        }

        final_state = await graph.ainvoke(initial_state)

        out = {
            "success": final_state.get("success", False),
            "message": final_state.get("message", ""),
            "report_id": final_state.get("report_id"),
            "parsing_result": final_state.get("parsing_result"),
        }
        if final_state.get("index_saved_count") is not None:
            out["index_saved_count"] = final_state["index_saved_count"]
        if final_state.get("sr_report_index") is not None:
            out["sr_report_index"] = final_state["sr_report_index"]
        return out

    async def _execute_legacy(
        self,
        company: str,
        year: int,
        company_id: Optional[str],
        save_to_db: bool,
    ) -> Dict[str, Any]:
        """LangGraph 미사용 시 기존 순차 실행 (Router로 sr_agent → sr_save_agent)."""
        # 1. sr_agent 호출 (검색·다운로드)
        result = await self.router.route_to(
            agent_name="sr_agent",
            company=company,
            year=year,
            company_id=company_id,
        )

        if not result.get("success"):
            return result

        pdf_bytes = result.get("pdf_bytes")
        if not pdf_bytes:
            return result

        # 2. save_to_db면 sr_save_agent 호출, 아니면 파싱만 해서 parsing_result 반환
        if save_to_db:
            try:
                save_result = await self.router.route_to(
                    agent_name="sr_save_agent",
                    pdf_bytes=pdf_bytes,
                    company=company,
                    year=year,
                    company_id=company_id,
                )
                if save_result.get("success"):
                    result["report_id"] = save_result.get("report_id")
                else:
                    logger.warning(f"[Orchestrator] 저장 실패: {save_result.get('message')}")
            except Exception as e:
                logger.error(f"[Orchestrator] 저장 실행 실패: {e}")
        else:
            # DB 저장 없이 메타+인덱스만 파싱 (extract 확인용)
            from ...models.states import SRParsingResult
            from backend.domain.shared.tool.parsing.pdf_metadata import parse_sr_report_metadata
            from backend.domain.shared.tool.sr_report_tools import parse_sr_report_index
            pr = SRParsingResult()
            meta = parse_sr_report_metadata(pdf_bytes, result["company"], result["year"], company_id)
            if "error" in meta:
                pr.error = meta["error"]
                result["parsing_result"] = pr.to_dict()
                return result
            pr.historical_sr_reports = meta.get("historical_sr_reports")
            report_id = pr.historical_sr_reports["id"]
            index_page_numbers = pr.historical_sr_reports.get("index_page_numbers") or []
            if index_page_numbers:
                idx_res = parse_sr_report_index(pdf_bytes, report_id, index_page_numbers)
                if "error" not in idx_res:
                    pr.sr_report_index = idx_res.get("sr_report_index", [])
            out = pr.to_dict()
            out.pop("sr_report_body", None)
            out.pop("sr_report_images", None)
            result["parsing_result"] = out

        return result
