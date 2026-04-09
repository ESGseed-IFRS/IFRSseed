"""
validator_node — Gemini JSON 검증.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .payload import ValidationMode
from .prompts import build_combined_prompt
from .rules import RuleResult

logger = logging.getLogger("ifrs_agent.validator_node")

DEFAULT_MODEL = "gemini-2.5-pro"
LLM_TIMEOUT_SEC = 90


@dataclass
class LlmValidateOutcome:
    """LLM 검증 단계 결과(확장 필드 포함)."""

    rule_result: RuleResult
    rationale_ko: Optional[str] = None
    accuracy_dimensions: Optional[Dict[str, Dict[str, Any]]] = None
    feedback_items: Optional[List[Dict[str, Any]]] = None
    skipped_no_api_key: bool = False


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


def extract_first_balanced_json_object(text: str) -> Optional[str]:
    """
    첫 번째 `{`부터 중괄호 균형이 맞는 구간만 잘라낸다.
    문자열 리터럴 안의 `{` `}`는 무시한다(이스케이프된 따옴표 처리).
    greedy 정규식 `\\{[\\s\\S]*\\}` 보다 안전하다.
    """
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    in_str = False
    escape = False
    for i in range(start, len(text)):
        c = text[i]
        if escape:
            escape = False
            continue
        if in_str:
            if c == "\\":
                escape = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _try_parse_json_loose(blob: str) -> Dict[str, Any]:
    """표준 json.loads 후, 실패 시 후행 쉼표만 완화해 재시도."""
    try:
        return json.loads(blob)
    except json.JSONDecodeError:
        relaxed = re.sub(r",(\s*[\]}])", r"\1", blob)
        if relaxed != blob:
            return json.loads(relaxed)
        raise


def parse_validator_json(text: str) -> Dict[str, Any]:
    """모델 응답에서 JSON 객체 추출."""
    s = (text or "").strip()
    if not s:
        raise ValueError("empty response")
    if s.startswith("```"):
        lines = s.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        s = "\n".join(lines).strip()

    balanced = extract_first_balanced_json_object(s)
    if balanced:
        try:
            return _try_parse_json_loose(balanced)
        except json.JSONDecodeError as e:
            logger.debug("validator JSON balanced parse failed: %s", e)

    m = re.search(r"\{[\s\S]*\}", s)
    if not m:
        raise ValueError("no json object")
    return _try_parse_json_loose(m.group(0))


def _normalize_accuracy_dimensions(raw: Any) -> Optional[Dict[str, Dict[str, Any]]]:
    if not isinstance(raw, dict):
        return None
    out: Dict[str, Dict[str, Any]] = {}
    for k, v in raw.items():
        if not isinstance(k, str):
            continue
        if isinstance(v, dict):
            out[k] = dict(v)
        elif isinstance(v, (int, float)) and not isinstance(v, bool):
            out[k] = {"score": float(v), "notes_ko": ""}
    return out or None


def parse_llm_validation_json(data: Dict[str, Any]) -> LlmValidateOutcome:
    """모델 JSON → 구조화 결과."""
    errors: List[str] = []
    if not data.get("is_valid", False):
        raw = data.get("errors") or []
        if isinstance(raw, list):
            errors = [str(e) for e in raw if str(e).strip()]
        elif isinstance(raw, str) and raw.strip():
            errors = [raw.strip()]

    rationale_ko = data.get("rationale_ko")
    if isinstance(rationale_ko, str):
        rationale_ko = rationale_ko.strip() or None
    else:
        rationale_ko = None

    acc = _normalize_accuracy_dimensions(data.get("accuracy_dimensions"))

    fb_raw = data.get("feedback_items")
    fb_list: Optional[List[Dict[str, Any]]] = None
    if isinstance(fb_raw, list):
        fb_list = []
        for it in fb_raw:
            if not isinstance(it, dict):
                continue
            fb_list.append(
                {
                    "severity": str(it.get("severity") or "suggestion"),
                    "dimension_id": str(it.get("dimension_id") or ""),
                    "issue_ko": str(it.get("issue_ko") or ""),
                    "suggestion_ko": str(it.get("suggestion_ko") or ""),
                    "quote": it.get("quote"),
                    "source": str(it.get("source") or "llm"),
                }
            )

    return LlmValidateOutcome(
        rule_result=RuleResult(errors=errors, warnings=[]),
        rationale_ko=rationale_ko,
        accuracy_dimensions=acc,
        feedback_items=fb_list,
        skipped_no_api_key=False,
    )


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
) -> LlmValidateOutcome:
    if not (gemini_api_key or "").strip():
        logger.info("validator_node: gemini_api_key 없음 — LLM 검증 생략")
        return LlmValidateOutcome(
            rule_result=RuleResult(),
            skipped_no_api_key=True,
        )

    try:
        from google import genai
    except ImportError:
        logger.error("google-genai 미설치 — LLM 검증 생략")
        return LlmValidateOutcome(
            rule_result=RuleResult(
                errors=["validator LLM 검증을 사용할 수 없습니다(google-genai 패키지)."],
            ),
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
                    "temperature": 0.1,
                    "max_output_tokens": 8192,
                },
            ),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        logger.error("validator_node LLM timeout")
        return LlmValidateOutcome(
            rule_result=RuleResult(
                errors=[f"validator LLM 시간 초과({timeout}s) — 재시도해 주세요."],
            ),
        )
    except Exception as e:
        logger.error("validator_node LLM 호출 실패: %s", e, exc_info=True)
        return LlmValidateOutcome(
            rule_result=RuleResult(errors=[f"validator LLM 호출 실패: {e}"]),
        )

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
        return LlmValidateOutcome(
            rule_result=RuleResult(
                errors=["validator LLM 응답 파싱 실패 — 재시도해 주세요."],
            ),
        )

    return parse_llm_validation_json(data)
