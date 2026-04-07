"""
validator_node — Gemini JSON 검증.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from typing import Any, Dict, List

from .payload import ValidationMode
from .prompts import build_combined_prompt
from .rules import RuleResult

logger = logging.getLogger("ifrs_agent.validator_node")

DEFAULT_MODEL = "gemini-2.5-pro"
LLM_TIMEOUT_SEC = 90


def _extract_gemini_text(response: Any) -> str:
    raw = getattr(response, "text", None)
    if raw is not None and str(raw).strip():
        return str(raw).strip()
    try:
        for cand in getattr(response, "candidates", None) or []:
            content = getattr(cand, "content", None)
            if not content:
                continue
            for part in getattr(content, "parts", None) or []:
                t = getattr(part, "text", None)
                if t and str(t).strip():
                    return str(t).strip()
    except Exception as e:
        logger.debug("Gemini candidate text extraction failed: %s", e)
    return ""


def parse_validator_json(text: str) -> Dict[str, Any]:
    """모델 응답에서 JSON 객체 추출."""
    s = (text or "").strip()
    if not s:
        raise ValueError("empty response")
    # ```json ... ``` 제거
    if s.startswith("```"):
        lines = s.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    m = re.search(r"\{[\s\S]*\}", s)
    if not m:
        raise ValueError("no json object")
    return json.loads(m.group(0))


def llm_result_to_rule_result(data: Dict[str, Any]) -> RuleResult:
    errors: List[str] = []
    if not data.get("is_valid", False):
        raw = data.get("errors") or []
        if isinstance(raw, list):
            errors = [str(e) for e in raw if str(e).strip()]
        elif isinstance(raw, str) and raw.strip():
            errors = [raw.strip()]
    return RuleResult(errors=errors, warnings=[])


async def run_llm_validate(
    *,
    category: str,
    generated_text: str,
    fact_data: Dict[str, Any],
    fact_data_by_dp: Dict[str, Any],
    mode: ValidationMode,
    gemini_api_key: str,
    model: str,
    timeout: int = LLM_TIMEOUT_SEC,
) -> RuleResult:
    if not (gemini_api_key or "").strip():
        logger.info("validator_node: gemini_api_key 없음 — LLM 검증 생략")
        return RuleResult()

    try:
        from google import genai
    except ImportError:
        logger.error("google-genai 미설치 — LLM 검증 생략")
        return RuleResult(
            errors=["validator LLM 검증을 사용할 수 없습니다(google-genai 패키지)."],
        )

    combined = build_combined_prompt(
        category,
        generated_text,
        fact_data,
        fact_data_by_dp,
        mode,
    )

    client = genai.Client(api_key=gemini_api_key.strip())
    model_id = (model or "").strip() or DEFAULT_MODEL
    start = time.time()

    try:
        response = await asyncio.wait_for(
            asyncio.to_thread(
                client.models.generate_content,
                model=model_id,
                contents=combined,
                config={
                    "temperature": 0.2,
                    "max_output_tokens": 4096,
                },
            ),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        logger.error("validator_node LLM timeout")
        return RuleResult(
            errors=[f"validator LLM 시간 초과({timeout}s) — 재시도해 주세요."],
        )
    except Exception as e:
        logger.error("validator_node LLM 호출 실패: %s", e, exc_info=True)
        return RuleResult(errors=[f"validator LLM 호출 실패: {e}"])

    raw_text = _extract_gemini_text(response)
    elapsed_ms = int((time.time() - start) * 1000)
    logger.info(
        "validator_node LLM ok model=%s elapsed_ms=%s preview=%s",
        model_id,
        elapsed_ms,
        (raw_text[:200] + "…") if len(raw_text) > 200 else raw_text,
    )

    try:
        data = parse_validator_json(raw_text)
    except Exception as e:
        logger.warning("validator JSON 파싱 실패: %s", e)
        return RuleResult(
            errors=["validator LLM 응답 파싱 실패 — 재시도해 주세요."],
        )

    return llm_result_to_rule_result(data)
