"""SRBodyAgent - 본문 전용 에이전트 (결정적 파이프라인).

LLM을 사용하지 않고 다음 순서만 실행합니다.
  get_pdf_metadata → parse_body_pages → map_body_pages_to_sr_report_body → save_sr_report_body_batch

도구 호출 결과를 LLM 대화에 넣지 않아 대용량 PDF(수백 페이지)에서도 컨텍스트 한도 초과가 나지 않습니다.
"""
from __future__ import annotations

import asyncio
import base64
import traceback
from typing import Any, Dict, List, Optional, TypedDict

from loguru import logger

from backend.domain.shared.tool.parsing.body_parser import parse_body_pages
from backend.domain.shared.tool.sr_report.index.sr_index_agent_tools import get_pdf_metadata
from backend.domain.shared.tool.sr_report.body import map_body_pages_to_sr_report_body
from backend.domain.shared.tool.sr_report.save.sr_save_tools import save_sr_report_body_batch


class BodyAgentState(TypedDict, total=False):
    """본문 에이전트 실행 상태."""
    report_id: str
    success: bool
    message: str
    saved_count: int
    sr_report_body: List[Dict[str, Any]]
    errors: List[Dict[str, Any]]


class SRBodyAgent:
    """SR 본문 저장 전용 에이전트. 결정적 파이프라인만 사용 (LLM 없음)."""

    def __init__(self, *_args: Any, **_kwargs: Any) -> None:
        """이전 버전과의 호환을 위해 임의 인자는 무시합니다."""
        if _args or _kwargs:
            logger.debug(
                "[SRBodyAgent] 결정적 모드: 사용하지 않는 인자 무시 args={} kwargs={}",
                _args,
                list(_kwargs.keys()),
            )

    async def execute(
        self,
        pdf_bytes: bytes,
        report_id: str,
        index_page_numbers: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        PDF 본문을 파싱·매핑·저장합니다. LLM 없이 동기 함수들을 스레드에서 호출합니다.
        """
        logger.info("[SRBodyAgent] execute(결정적): report_id={}", report_id)
        errors: List[Dict[str, Any]] = []
        pdf_bytes_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

        try:
            meta = await asyncio.to_thread(get_pdf_metadata, report_id)
        except Exception as e:
            tb = traceback.format_exc()
            logger.exception("[SRBodyAgent] get_pdf_metadata 실패")
            return {
                "success": False,
                "message": f"메타데이터 조회 실패: {e}",
                "saved_count": 0,
                "sr_report_body": [],
                "errors": [{"stage": "get_pdf_metadata", "error": str(e), "traceback": tb}],
            }

        if isinstance(meta, dict) and meta.get("error"):
            err = str(meta["error"])
            return {
                "success": False,
                "message": f"메타데이터 오류: {err}",
                "saved_count": 0,
                "sr_report_body": [],
                "errors": [{"stage": "get_pdf_metadata", "error": err}],
            }

        total_pages = meta.get("total_pages")
        try:
            total_pages = int(total_pages) if total_pages is not None else 0
        except (TypeError, ValueError):
            total_pages = 0

        if total_pages <= 0:
            return {
                "success": False,
                "message": "total_pages가 유효하지 않습니다.",
                "saved_count": 0,
                "sr_report_body": [],
                "errors": [{"stage": "get_pdf_metadata", "error": "invalid total_pages"}],
            }

        idx_meta = meta.get("index_page_numbers")
        if idx_meta is not None:
            resolved_index: List[int] = [int(x) for x in idx_meta]
        elif index_page_numbers:
            resolved_index = [int(x) for x in index_page_numbers]
        else:
            resolved_index = []

        pages = list(range(1, total_pages + 1))

        try:
            parse_result = await asyncio.to_thread(parse_body_pages, pdf_bytes_b64, pages)
        except Exception as e:
            tb = traceback.format_exc()
            logger.exception("[SRBodyAgent] parse_body_pages 실패")
            return {
                "success": False,
                "message": f"본문 파싱 실패: {e}",
                "saved_count": 0,
                "sr_report_body": [],
                "errors": [{"stage": "parse_body_pages", "error": str(e), "traceback": tb}],
            }

        if not isinstance(parse_result, dict):
            return {
                "success": False,
                "message": "파싱 결과 형식이 올바르지 않습니다.",
                "saved_count": 0,
                "sr_report_body": [],
                "errors": [{"stage": "parse_body_pages", "error": "unexpected result type"}],
            }

        if parse_result.get("error"):
            return {
                "success": False,
                "message": f"본문 파싱 오류: {parse_result.get('error')}",
                "saved_count": 0,
                "sr_report_body": [],
                "errors": [{"stage": "parse_body_pages", "error": parse_result.get("error")}],
            }

        body_by_page = parse_result.get("body_by_page") or {}
        if not body_by_page:
            return {
                "success": False,
                "message": "추출된 본문 페이지가 없습니다.",
                "saved_count": 0,
                "sr_report_body": [],
                "errors": [{"stage": "parse_body_pages", "error": "empty body_by_page"}],
            }

        try:
            bodies = await asyncio.to_thread(
                map_body_pages_to_sr_report_body,
                body_by_page,
                report_id,
                resolved_index,
            )
        except Exception as e:
            tb = traceback.format_exc()
            logger.exception("[SRBodyAgent] map_body_pages_to_sr_report_body 실패")
            return {
                "success": False,
                "message": f"본문 매핑 실패: {e}",
                "saved_count": 0,
                "sr_report_body": [],
                "errors": [{"stage": "map_body_pages_to_sr_report_body", "error": str(e), "traceback": tb}],
            }

        if not bodies:
            return {
                "success": False,
                "message": "매핑된 본문 행이 없습니다.",
                "saved_count": 0,
                "sr_report_body": [],
                "errors": [{"stage": "map_body_pages_to_sr_report_body", "error": "empty bodies"}],
            }

        try:
            save_result = await asyncio.to_thread(save_sr_report_body_batch, report_id, bodies)
        except Exception as e:
            tb = traceback.format_exc()
            logger.exception("[SRBodyAgent] save_sr_report_body_batch 실패")
            return {
                "success": False,
                "message": f"DB 저장 실패: {e}",
                "saved_count": 0,
                "sr_report_body": [],
                "errors": [{"stage": "save_sr_report_body_batch", "error": str(e), "traceback": tb}],
            }

        if not isinstance(save_result, dict):
            return {
                "success": False,
                "message": "저장 결과 형식이 올바르지 않습니다.",
                "saved_count": 0,
                "sr_report_body": [],
                "errors": [{"stage": "save_sr_report_body_batch", "error": "unexpected result"}],
            }

        saved_count = int(save_result.get("saved_count", 0))
        if not save_result.get("success"):
            err_list = save_result.get("errors") or []
            errors.append({"stage": "save_sr_report_body_batch", "errors": err_list})
            return {
                "success": False,
                "message": f"저장 실패(일부 행 오류 가능): {save_result}",
                "saved_count": saved_count,
                "sr_report_body": [],
                "errors": errors if errors else None,
            }

        per_row_errs = save_result.get("errors") or []
        if per_row_errs:
            errors.append({"stage": "save_sr_report_body_batch", "row_errors": per_row_errs})

        msg = f"본문 {saved_count}건 저장 완료 (결정적 파이프라인)"
        return {
            "success": saved_count > 0,
            "message": msg,
            "saved_count": saved_count,
            "sr_report_body": [],
            "errors": errors if errors else None,
        }
