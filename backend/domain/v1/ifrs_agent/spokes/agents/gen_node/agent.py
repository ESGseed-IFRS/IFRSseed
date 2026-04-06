"""
Gen Node Agent - SR 보고서 문단 생성

Phase 2에서 필터링된 데이터(gen_input)를 받아 IFRS/GRI/ESRS 스타일의 SR 문단 생성.
LLM은 Google Gemini만 사용한다. 기본 모델은 **gemini-2.5-pro**이며
`runtime_config.gen_node_model` / 환경변수 `GEN_NODE_MODEL`로 변경 가능하다.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, Optional, Tuple

from .prompts import SYSTEM_PROMPT, build_user_prompt
from .utils import (
    DEFAULT_MAX_PROMPT_TOKENS,
    postprocess_generated_text,
    resolve_gen_input_from_payload,
    truncate_if_needed,
    validate_generated_text,
)

logger = logging.getLogger("ifrs_agent.gen_node")

# gen_node 기본 모델 (payload.runtime_config.gen_node_model이 있으면 그쪽이 우선)
GEMINI_MODEL_ID = "gemini-2.5-pro"


def _extract_gemini_text(response: Any) -> str:
    """
    google.genai GenerateContentResponse에서 본문 추출.
    일부 응답에서 .text가 비어 있으면 candidates[].content.parts를 사용한다.
    """
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


def _log_gemini_blocks(response: Any) -> None:
    pf = getattr(response, "prompt_feedback", None)
    if pf is None:
        return
    br = getattr(pf, "block_reason", None)
    if br:
        logger.warning("Gemini prompt_feedback.block_reason=%s", br)


def _log_gemini_empty_response(response: Any) -> None:
    """Thinking 모델은 max_output_tokens가 낮으면 추론에 한도를 다 쓰고 text가 비는 경우가 있다."""
    cands = getattr(response, "candidates", None) or []
    for i, c in enumerate(cands):
        logger.warning(
            "Gemini candidate[%s] finish_reason=%s finish_message=%s",
            i,
            getattr(c, "finish_reason", None),
            getattr(c, "finish_message", None),
        )
    um = getattr(response, "usage_metadata", None)
    if um is not None:
        logger.warning(
            "Gemini usage_metadata: prompt_token_count=%s candidates_token_count=%s "
            "thoughts_token_count=%s total_token_count=%s",
            getattr(um, "prompt_token_count", None),
            getattr(um, "candidates_token_count", None),
            getattr(um, "thoughts_token_count", None),
            getattr(um, "total_token_count", None),
        )


def validate_gen_input(gen_input: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    gen_input 유효성 검증

    Args:
        gen_input: Phase 2 필터링된 입력 데이터

    Returns:
        (is_valid, error_message)
    """
    if not gen_input.get("category"):
        return False, "category is required"

    if not gen_input.get("report_year"):
        return False, "report_year is required"

    ref_2024 = gen_input.get("ref_2024") or {}
    ref_2023 = gen_input.get("ref_2023") or {}

    has_ref_2024 = bool(ref_2024.get("body_text"))
    has_ref_2023 = bool(ref_2023.get("body_text"))

    if not has_ref_2024 and not has_ref_2023:
        return False, "At least one reference year (2024 or 2023) must have body_text"

    return True, None


async def generate_text_gemini(
    gen_input: Dict[str, Any],
    gemini_api_key: str,
    model: str = GEMINI_MODEL_ID,
    timeout: int = 120,
) -> Dict[str, Any]:
    """Gemini로 SR 문단 생성 (`model` 인자로 모델 ID 지정)."""
    try:
        from google import genai
    except ImportError:
        raise ImportError("google-genai package is required. Install with: pip install google-genai")

    start_time = time.time()

    client = genai.Client(api_key=gemini_api_key)

    system_prompt = SYSTEM_PROMPT
    user_prompt = build_user_prompt(gen_input)

    user_prompt, was_truncated = truncate_if_needed(
        user_prompt, max_tokens=DEFAULT_MAX_PROMPT_TOKENS
    )
    prompt_length = len(user_prompt)

    if was_truncated:
        logger.warning("User prompt was truncated due to length")

    combined_prompt = f"{system_prompt}\n\n{user_prompt}"

    try:
        # max_output_tokens를 낮게 두면 2.5 Pro 등 thinking 모델이 추론 토큰만 소비하고
        # visible 텍스트가 비어 finish_reason=MAX_TOKENS로 끝날 수 있음 (google-genai #811).
        response = await asyncio.wait_for(
            asyncio.to_thread(
                client.models.generate_content,
                model=model,
                contents=combined_prompt,
                config={
                    "temperature": 0.3,
                    "max_output_tokens": 32768,
                },
            ),
            timeout=timeout,
        )

        elapsed_ms = int((time.time() - start_time) * 1000)

        _log_gemini_blocks(response)
        text = _extract_gemini_text(response)
        if not text:
            _log_gemini_empty_response(response)
            logger.warning(
                "Gemini returned empty text (model=%s). If finish_reason=MAX_TOKENS and "
                "thoughts_token_count is high, raise max_output_tokens or use GEN_NODE_MODEL=gemini-2.5-flash.",
                model,
            )

        return {
            "text": text,
            "model": model,
            "tokens": 0,
            "finish_reason": "stop",
            "generation_time_ms": elapsed_ms,
            "prompt_length": prompt_length,
        }

    except asyncio.TimeoutError:
        logger.error("Gemini API timeout after %ss", timeout)
        raise TimeoutError(f"LLM generation timeout after {timeout}s")
    except Exception as e:
        logger.error("Error in generate_text_gemini: %s", e)
        raise


class GenNodeAgent:
    """Phase 2 필터링 데이터 → SR 문단 (Gemini, 기본 gemini-2.5-pro)."""

    def __init__(self, infra: Any):
        self.infra = infra

    async def generate(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            gen_input = resolve_gen_input_from_payload(payload)
            is_valid, error_msg = validate_gen_input(gen_input)

            if not is_valid:
                logger.error("Invalid gen_input: %s", error_msg)
                return {"error": f"Input validation failed: {error_msg}"}

            runtime_config = payload.get("runtime_config") or {}
            gemini_api_key = (runtime_config.get("gemini_api_key") or "").strip()

            if not gemini_api_key:
                return {
                    "error": "gemini_api_key is required in runtime_config (gen_node uses Gemini only)",
                }

            model = (runtime_config.get("gen_node_model") or "").strip() or GEMINI_MODEL_ID
            logger.info("gen_node LLM: model=%s", model)

            max_retries = 2
            last_error = None

            for attempt in range(max_retries + 1):
                try:
                    result = await generate_text_gemini(
                        gen_input=gen_input,
                        gemini_api_key=gemini_api_key,
                        model=model,
                    )

                    result["text"] = postprocess_generated_text(result["text"])

                    is_valid_text, validation_error = validate_generated_text(result["text"])
                    if not is_valid_text:
                        logger.warning("Generated text validation failed: %s", validation_error)
                        if attempt < max_retries:
                            logger.info(
                                "Retrying generation (attempt %s/%s)",
                                attempt + 2,
                                max_retries + 1,
                            )
                            await asyncio.sleep(1)
                            continue
                        return {"error": f"Generated text validation failed: {validation_error}"}

                    warnings = []
                    dp_data = gen_input.get("dp_data") or {}
                    if dp_data.get("suitability_warning"):
                        warnings.append("suitability_warning detected in dp_data")

                    metadata = {
                        "model": result.get("model"),
                        "tokens": result.get("tokens", 0),
                        "finish_reason": result.get("finish_reason"),
                        "generation_time_ms": result.get("generation_time_ms", 0),
                        "prompt_length": result.get("prompt_length", 0),
                    }

                    return {
                        "text": result["text"],
                        "metadata": metadata,
                        "warnings": warnings,
                    }

                except (TimeoutError, Exception) as e:
                    last_error = str(e)
                    logger.warning(
                        "LLM generation error (attempt %s/%s): %s",
                        attempt + 1,
                        max_retries + 1,
                        e,
                    )
                    if attempt < max_retries:
                        await asyncio.sleep(1)
                        continue

            return {
                "error": f"LLM generation failed after {max_retries + 1} attempts: {last_error}",
            }

        except Exception as e:
            logger.error("Unexpected error in gen_node: %s", e, exc_info=True)
            return {"error": f"Internal error: {str(e)}"}


def make_gen_node_handler(infra: Any):
    agent = GenNodeAgent(infra)

    async def handler(payload: Dict[str, Any]) -> Dict[str, Any]:
        return await agent.generate(payload)

    return handler
