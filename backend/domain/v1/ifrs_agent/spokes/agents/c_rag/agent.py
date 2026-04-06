"""
C_RAG 에이전트

카테고리 기반 SR 참조 데이터 수집 노드
"""
from __future__ import annotations

import json
import logging
import re
from decimal import Decimal
from typing import Any, Dict, List, Optional

from backend.domain.v1.ifrs_agent.models.runtime_config import AgentRuntimeConfig
from backend.domain.v1.ifrs_agent.hub.orchestrator.prompt_interpretation import (
    ref_pages_for_direct_mode,
)

logger = logging.getLogger("ifrs_agent.c_rag")

_VECTOR_TOP_K = 4


def _toc_path_str(toc: Any) -> str:
    if toc is None:
        return ""
    if isinstance(toc, (dict, list)):
        try:
            return json.dumps(toc, ensure_ascii=False)
        except (TypeError, ValueError):
            return str(toc)
    return str(toc)


def _similarity_float(x: Any) -> float:
    if x is None:
        return 0.0
    if isinstance(x, Decimal):
        return float(x)
    return float(x)


def _parse_chosen_index(text: str, n: int) -> Optional[int]:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\s*```\s*$", "", t)
    try:
        obj = json.loads(t)
        if isinstance(obj, dict) and "chosen_index" in obj:
            i = int(obj["chosen_index"])
            if 0 <= i < n:
                return i
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    m = re.search(r'"chosen_index"\s*:\s*(\d+)', text)
    if m:
        i = int(m.group(1))
        if 0 <= i < n:
            return i
    return None


class CRagAgent:
    """
    C_RAG 에이전트

    카테고리 기반으로 전년/전전년도 SR 보고서 본문 + 이미지를 검색·추출
    """

    def __init__(self, infra):
        """
        Args:
            infra: InfraLayer 인스턴스
        """
        from backend.domain.v1.ifrs_agent.spokes.infra import InfraLayer

        self.infra: InfraLayer = infra
        self.runtime_config: Optional[AgentRuntimeConfig] = None

        logger.info("CRagAgent initialized (DB 툴은 infra 경유; LLM은 오케스트레이터에서 설정)")

    async def collect(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        카테고리 기반 SR 참조 데이터 수집

        Args:
            payload: {
                "company_id": str,
                "category": str,
                "years": List[int],  # [2024, 2023]
                "search_intent": str (optional, Phase 0),
                "content_focus": str (optional, Phase 0),
                "ref_pages": {"2024": int|None, "2023": int|None} (optional, 다이렉트 페이지),
                "runtime_config": AgentRuntimeConfig  # 오케스트레이터가 주입 (선택)
            }

        Returns:
            {
                "2024": {
                    "sr_body": str,
                    "sr_images": List[dict],
                    "page_number": int,
                    "report_id": str
                },
                "2023": { ... }
            }
        """
        company_id = payload["company_id"]
        category = payload["category"]
        years = payload["years"]
        raw_rc = payload.get("runtime_config")
        self.runtime_config = raw_rc if isinstance(raw_rc, dict) else None

        if self.runtime_config:
            logger.info(
                "c_rag.collect: runtime_config keys=%s (값은 로그에 미포함)",
                sorted(self.runtime_config.keys()),
            )

        search_intent = (payload.get("search_intent") or "").strip()
        content_focus = (payload.get("content_focus") or "").strip()
        ref_pages_raw = payload.get("ref_pages")
        direct_pages = ref_pages_for_direct_mode(ref_pages_raw or {})

        logger.info(
            "c_rag.collect started: category=%s, years=%s direct_pages=%s",
            category,
            years,
            direct_pages,
        )

        result = {}
        for year in years:
            try:
                yk = str(year)
                if direct_pages and yk in direct_pages:
                    body_data = await self._query_sr_body_by_page(
                        company_id, year, direct_pages[yk]
                    )
                else:
                    body_data = await self._query_sr_body(
                        company_id,
                        category,
                        year,
                        search_intent=search_intent,
                        content_focus=content_focus,
                    )

                images = await self._query_sr_images(
                    report_id=body_data["report_id"],
                    page_number=body_data["page_number"],
                )

                result[str(year)] = {
                    "sr_body": body_data["body"],
                    "sr_images": images,
                    "page_number": body_data["page_number"],
                    "report_id": body_data["report_id"],
                }

                logger.info(
                    "c_rag.collect year=%s success: page=%s, images=%s",
                    year,
                    body_data["page_number"],
                    len(images),
                )

            except Exception as e:
                logger.error("c_rag.collect year=%s failed: %s", year, e, exc_info=True)
                result[str(year)] = {
                    "sr_body": "",
                    "sr_images": [],
                    "page_number": None,
                    "report_id": None,
                    "error": str(e),
                }

        return result

    async def _query_sr_body_by_page(
        self,
        company_id: str,
        year: int,
        page_number: int,
    ) -> Dict[str, Any]:
        """지정 페이지 SR 본문 (벡터 검색 생략)."""
        row = await self.infra.call_tool(
            "query_sr_body_by_page",
            {
                "company_id": company_id,
                "year": year,
                "page_number": page_number,
            },
        )
        if not row:
            raise ValueError(
                f"No SR body for company_id={company_id} year={year} page={page_number}"
            )
        body = row.get("body") or row.get("content_text") or ""
        rid = row.get("report_id")
        if rid is not None and hasattr(rid, "hex"):
            rid = str(rid)
        return {
            "body": body,
            "page_number": row.get("page_number", page_number),
            "report_id": rid,
        }

    async def _llm_pick_body_candidate(
        self,
        category: str,
        candidates: List[Dict[str, Any]],
        content_focus: str = "",
    ) -> int:
        n = len(candidates)
        if n == 0:
            raise ValueError("no candidates")
        if n == 1:
            return 0

        rc = self.runtime_config or {}
        api_key = (rc.get("openai_api_key") or "").strip()
        model = (rc.get("c_rag_llm_model") or "gpt-5-mini").strip()
        if not api_key:
            logger.warning("c_rag: OPENAI_API_KEY 비어 있음 — LLM 생략, 벡터 1순위(인덱스 0) 사용")
            return 0

        blocks: List[str] = []
        for i, row in enumerate(candidates):
            body_prev = (row.get("body") or "")[:450]
            sim = _similarity_float(row.get("similarity"))
            sub = (row.get("subtitle") or "")[:500]
            toc = _toc_path_str(row.get("toc_path"))[:1200]
            blocks.append(
                f"[{i}] page_number={row.get('page_number')} similarity={sim:.4f}\n"
                f"subtitle: {sub}\n"
                f"toc_path: {toc}\n"
                f"body_preview: {body_prev}\n"
            )

        focus_line = ""
        if (content_focus or "").strip():
            focus_line = (
                f"\n사용자가 초안에서 특히 다루고 싶은 내용: «{content_focus.strip()}»\n"
                "이 초점과 본문 미리보기가 가장 잘 맞는 후보를 우선하세요.\n"
            )
        user_msg = (
            f"사용자가 찾는 주제(카테고리): «{category}»"
            f"{focus_line}\n"
            "아래는 동일 연도 SR 보고서 본문 후보입니다. 인덱스는 0부터 시작합니다.\n"
            "주제와 **가장 잘 맞는 단 하나**의 후보만 고르세요.\n\n"
            + "\n---\n".join(blocks)
        )
        sys_msg = (
            "You are a precise selector. Output a single JSON object only, no markdown. "
            f'Format: {{"chosen_index": <integer>}}. chosen_index must satisfy 0 <= chosen_index < {n}.'
        )

        try:
            from openai import AsyncOpenAI
        except ImportError as e:
            logger.warning("c_rag: openai 패키지 없음 — 인덱스 0 사용: %s", e)
            return 0

        client = AsyncOpenAI(api_key=api_key)
        # gpt-5-mini 등: temperature는 기본값(1)만 허용 — 임의 값 전달 시 400
        try:
            completion = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": sys_msg},
                    {"role": "user", "content": user_msg},
                ],
                response_format={"type": "json_object"},
            )
        except Exception as e:
            logger.warning("c_rag: LLM json_object 호출 실패, 일반 모드 재시도: %s", e)
            completion = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": sys_msg},
                    {"role": "user", "content": user_msg},
                ],
            )

        text = (completion.choices[0].message.content or "").strip()
        idx = _parse_chosen_index(text, n)
        if idx is None:
            logger.warning("c_rag: LLM 응답 파싱 실패 — 앞부분: %s", text[:240])
            return 0
        logger.info("c_rag: LLM chosen_index=%s (후보 수=%s)", idx, n)
        return idx

    async def _query_sr_body(
        self,
        company_id: str,
        category: str,
        year: int,
        search_intent: str = "",
        content_focus: str = "",
    ) -> Dict[str, Any]:
        """
        SR 본문: 카테고리(+ Phase 0 search_intent) 임베딩으로 유사 상위 N건을 뽑은 뒤,
        LLM이 subtitle·toc_path·본문 미리보기로 최종 1건 선택.

        Returns:
            {"body", "page_number", "report_id"}
        """
        search_text = f"{category} {search_intent}".strip() or category

        embed_params: Dict[str, Any] = {"text": search_text}
        if self.runtime_config and self.runtime_config.get("embedding_model"):
            embed_params["embedding_model"] = self.runtime_config["embedding_model"]

        embedding = await self.infra.call_tool("embed_text", embed_params)

        vector_rows = await self.infra.call_tool(
            "query_sr_body_vector",
            {
                "company_id": company_id,
                "embedding": embedding,
                "year": year,
                "top_k": _VECTOR_TOP_K,
            },
        )

        if not vector_rows:
            raise ValueError(f"No SR body found for category={category}, year={year}")

        idx = await self._llm_pick_body_candidate(
            category, vector_rows, content_focus=content_focus
        )
        chosen = vector_rows[idx]

        return {
            "body": chosen["body"],
            "page_number": chosen["page_number"],
            "report_id": chosen["report_id"],
        }

    async def _query_sr_images(self, report_id: str, page_number: int) -> List[Dict[str, Any]]:
        """
        SR 이미지 검색: 선택된 페이지의 이미지 메타데이터 추출

        Returns:
            query_sr_images 툴과 동일 필드 (id, image_index, image_url, caption,
            caption_confidence, image_type, image_width, image_height,
            placement_bboxes, extracted_at)
        """
        images = await self.infra.call_tool(
            "query_sr_images",
            {
                "report_id": report_id,
                "page_number": page_number,
            },
        )
        return list(images or [])


def make_c_rag_handler(infra):
    """
    InfraLayer에 바인딩된 c_rag 핸들러 팩토리.

    bootstrap에서 `register("c_rag", make_c_rag_handler(infra))` 로 등록한다.
    """

    async def _handler(payload: Dict[str, Any]) -> Dict[str, Any]:
        agent = CRagAgent(infra)
        return await agent.collect(payload)

    return _handler
