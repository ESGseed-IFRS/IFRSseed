"""SRImagesAgent - 이미지 전용 에이전트 (결정적 파이프라인).

LLM 없이: get_pdf_metadata → extract_report_images → map_extracted_images_to_sr_report_rows
→ save_sr_report_images_batch
"""
from __future__ import annotations

import asyncio
import os
import traceback
from typing import Any, Dict, List, Optional

from loguru import logger

from backend.domain.shared.tool.parsing.image_extractor import extract_report_images
from backend.domain.shared.tool.sr_report.images import map_extracted_images_to_sr_report_rows
from backend.domain.shared.tool.sr_report.index.sr_index_agent_tools import get_pdf_metadata
from backend.domain.shared.tool.sr_report.save.sr_save_tools import save_sr_report_images_batch


def _resolve_image_output_dir(explicit: Optional[str]) -> Optional[str]:
    if explicit and str(explicit).strip():
        return str(explicit).strip()
    env = os.getenv("SR_IMAGE_OUTPUT_DIR", "").strip()
    return env or None


class SRImagesAgent:
    """SR 이미지 추출·저장. PyMuPDF 임베디드 이미지 → 파일 + sr_report_images."""

    def __init__(self, *_args: Any, **_kwargs: Any) -> None:
        if _args or _kwargs:
            logger.debug(
                "[SRImagesAgent] 미사용 인자 무시 args={} kwargs={}",
                _args,
                list(_kwargs.keys()),
            )

    async def execute(
        self,
        pdf_bytes: bytes,
        report_id: str,
        index_page_numbers: Optional[List[int]] = None,
        image_output_dir: Optional[str] = None,
        base_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        PDF에서 임베디드 이미지를 추출해 디스크에 저장하고 DB 메타를 적재합니다.

        Args:
            pdf_bytes: PDF 바이너리
            report_id: historical_sr_reports.id
            index_page_numbers: 워크플로에서 넘기면 메타 조회 결과보다 우선하지 않음(메타 우선)
            image_output_dir: 저장 루트. 없으면 환경변수 SR_IMAGE_OUTPUT_DIR 필수.
            base_name: 예약(파일명은 report_id 하위 폴더 규칙 사용).
        """
        _ = base_name
        errors: List[Dict[str, Any]] = []
        out_dir = _resolve_image_output_dir(image_output_dir)
        if not out_dir:
            return {
                "success": False,
                "message": "image_output_dir 또는 환경변수 SR_IMAGE_OUTPUT_DIR 이 필요합니다.",
                "saved_count": 0,
                "sr_report_images": [],
                "errors": [{"stage": "config", "error": "missing image output directory"}],
            }

        logger.info("[SRImagesAgent] execute: report_id={}", report_id)

        try:
            meta = await asyncio.to_thread(get_pdf_metadata, report_id)
        except Exception as e:
            tb = traceback.format_exc()
            logger.exception("[SRImagesAgent] get_pdf_metadata 실패")
            return {
                "success": False,
                "message": f"메타데이터 조회 실패: {e}",
                "saved_count": 0,
                "sr_report_images": [],
                "errors": [{"stage": "get_pdf_metadata", "error": str(e), "traceback": tb}],
            }

        if isinstance(meta, dict) and meta.get("error"):
            err = str(meta["error"])
            return {
                "success": False,
                "message": f"메타데이터 오류: {err}",
                "saved_count": 0,
                "sr_report_images": [],
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
                "sr_report_images": [],
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

        def _extract() -> Dict[str, Any]:
            return extract_report_images(
                pdf_bytes,
                pages,
                out_dir,
                report_id,
                index_page_numbers=resolved_index,
            )

        try:
            ex = await asyncio.to_thread(_extract)
        except Exception as e:
            tb = traceback.format_exc()
            logger.exception("[SRImagesAgent] extract_report_images 실패")
            return {
                "success": False,
                "message": f"이미지 추출 실패: {e}",
                "saved_count": 0,
                "sr_report_images": [],
                "errors": [{"stage": "extract_report_images", "error": str(e), "traceback": tb}],
            }

        if not ex.get("success"):
            err = ex.get("error") or "이미지 추출 실패"
            return {
                "success": False,
                "message": err,
                "saved_count": 0,
                "sr_report_images": [],
                "errors": [{"stage": "extract_report_images", "error": err}],
            }

        images_by_page = ex.get("images_by_page") or {}
        rows = map_extracted_images_to_sr_report_rows(report_id, images_by_page)

        if not rows:
            logger.info("[SRImagesAgent] 추출된 이미지 없음 (필터 후 0건). DB 기존 이미지 삭제 후 0건 저장.")
            # replace_existing 로 기존 행 정리
            try:
                save_empty = await asyncio.to_thread(
                    save_sr_report_images_batch, report_id, [], replace_existing=True
                )
            except Exception as e:
                tb = traceback.format_exc()
                return {
                    "success": False,
                    "message": f"빈 배치 저장 실패: {e}",
                    "saved_count": 0,
                    "sr_report_images": [],
                    "errors": [{"stage": "save_sr_report_images_batch", "error": str(e), "traceback": tb}],
                }
            return {
                "success": True,
                "message": "추출된 임베디드 이미지 없음(0건). 기존 메타는 초기화됨.",
                "saved_count": int(save_empty.get("saved_count", 0)),
                "sr_report_images": [],
                "errors": None,
            }

        try:
            save_result = await asyncio.to_thread(
                save_sr_report_images_batch, report_id, rows, replace_existing=True
            )
        except Exception as e:
            tb = traceback.format_exc()
            logger.exception("[SRImagesAgent] save_sr_report_images_batch 실패")
            return {
                "success": False,
                "message": f"DB 저장 실패: {e}",
                "saved_count": 0,
                "sr_report_images": [],
                "errors": [{"stage": "save_sr_report_images_batch", "error": str(e), "traceback": tb}],
            }

        saved_count = int(save_result.get("saved_count", 0))
        per_errs = save_result.get("errors") or []
        if per_errs:
            for e in per_errs:
                if isinstance(e, dict):
                    errors.append({"stage": "save_sr_report_images_batch", **e})
                else:
                    errors.append({"stage": "save_sr_report_images_batch", "error": str(e)})

        saved_rows = save_result.get("saved_rows") or []
        msg = f"이미지 {saved_count}건 저장 완료 (PyMuPDF 임베디드 추출)"
        return {
            "success": saved_count > 0,
            "message": msg,
            "saved_count": saved_count,
            "sr_report_images": saved_rows,
            "errors": errors if errors else None,
        }
