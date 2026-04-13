"""
Gen Node Agent - SR 보고서 문단 생성

Phase 2에서 필터링된 데이터(gen_input)를 받아 IFRS/GRI/ESRS 스타일의 SR 문단 생성.
LLM은 Google Gemini만 사용한다. 기본 모델은 **gemini-3-flash-preview**이며
`runtime_config.gen_node_model` / 환경변수 `GEN_NODE_MODEL`로 변경 가능하다.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

from .prompts import SYSTEM_PROMPT, build_user_prompt
from backend.domain.v1.ifrs_agent.spokes.agents.validator_node.llm_validate import (
    extract_first_balanced_json_object,
)

from .utils import (
    DEFAULT_MAX_PROMPT_TOKENS,
    postprocess_generated_text,
    resolve_gen_input_from_payload,
    truncate_if_needed,
    validate_generated_text,
)

logger = logging.getLogger("ifrs_agent.gen_node")

# gen_node 기본 모델 (payload.runtime_config.gen_node_model이 있으면 그쪽이 우선)
GEMINI_MODEL_ID = "gemini-3-flash-preview"


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


def _normalize_validator_feedback(raw: Any) -> Optional[List[str]]:
    if raw is None:
        return None
    if not isinstance(raw, list):
        return None
    out: List[str] = []
    for x in raw:
        s = str(x).strip()
        if s:
            out.append(s)
    return out if out else None


def _try_parse_json_loose(blob: str) -> Any:
    """json.loads 후 실패 시 후행 쉼표만 완화해 재시도 (validator_node와 동일 패턴)."""
    import json
    import re

    try:
        return json.loads(blob)
    except json.JSONDecodeError:
        relaxed = re.sub(r",(\s*[\]}])", r"\1", blob)
        if relaxed != blob:
            return json.loads(relaxed)
        raise


def _parse_gen_node_json_response(raw_text: str) -> Tuple[str, List[Dict[str, Any]], Dict[str, Any]]:
    """
    gen_node JSON 응답 파싱.
    
    Returns:
        (generated_text, dp_sentence_mappings, data_provenance)
    """
    import json

    text = (raw_text or "").strip()
    if not text:
        logger.warning("gen_node: 응답 텍스트가 비어있음")
        return "", [], {}
    
    logger.warning("=" * 80)
    logger.warning("gen_node: Gemini 원본 응답 (첫 1500자)")
    logger.warning(text[:1500])
    logger.warning("=" * 80)
    
    # 마크다운 코드펜스 제거
    if text.startswith("```"):
        lines = text.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
        logger.debug("gen_node: 코드펜스 제거 후 길이=%d", len(text))
    
    # JSON 파싱 시도 (generated_text 안의 `}` 때문에 rfind가 깨지는 경우 방지)
    try:
        json_str = extract_first_balanced_json_object(text)
        if not json_str:
            start_idx = text.find("{")
            end_idx = text.rfind("}")
            if start_idx >= 0 and end_idx > start_idx:
                json_str = text[start_idx : end_idx + 1]
        if json_str:
            logger.debug("gen_node: JSON 추출 시도, 길이=%d", len(json_str))
            data = _try_parse_json_loose(json_str)
        else:
            data = None
        if isinstance(data, dict):
            generated_text = str(data.get("generated_text", "") or "").strip()
            dp_mappings_raw = data.get("dp_sentence_mappings", [])
            data_provenance_raw = data.get("data_provenance", {})
            
            logger.warning("=" * 80)
            logger.warning("gen_node: JSON 파싱 성공!")
            logger.warning(f"  - generated_text 길이: {len(generated_text)}")
            logger.warning(f"  - dp_sentence_mappings 존재: {'dp_sentence_mappings' in data}")
            logger.warning(f"  - dp_sentence_mappings 타입: {type(dp_mappings_raw).__name__}")
            logger.warning(f"  - dp_sentence_mappings 길이: {len(dp_mappings_raw) if isinstance(dp_mappings_raw, list) else 'N/A'}")
            if isinstance(dp_mappings_raw, list):
                for idx, mapping in enumerate(dp_mappings_raw):
                    if isinstance(mapping, dict):
                        logger.warning(f"  - [{idx+1}] dp_id={mapping.get('dp_id')}, sentences={len(mapping.get('sentences', []))}")
            logger.warning(f"  - data_provenance 존재: {'data_provenance' in data}")
            logger.warning(f"  - data_provenance 타입: {type(data_provenance_raw).__name__}")
            if isinstance(data_provenance_raw, dict):
                quant_count = len(data_provenance_raw.get("quantitative_sources", []))
                qual_count = len(data_provenance_raw.get("qualitative_sources", []))
                ref_pages = data_provenance_raw.get("reference_pages", {})
                logger.warning(f"  - quantitative_sources: {quant_count}건")
                logger.warning(f"  - qualitative_sources: {qual_count}건")
                logger.warning(f"  - reference_pages: {ref_pages}")
                
                # 정량 데이터 상세 (최대 5건)
                if quant_count > 0:
                    for idx, q in enumerate(data_provenance_raw.get("quantitative_sources", [])[:5]):
                        if isinstance(q, dict):
                            logger.warning(
                                f"  - [정량{idx+1}] dp_id={q.get('dp_id')}, value={q.get('value')}, "
                                f"source_type={q.get('source_type')}, sentences={len(q.get('used_in_sentences', []))}"
                            )
                
                # 정성 데이터 상세 (최대 5건)
                if qual_count > 0:
                    for idx, q in enumerate(data_provenance_raw.get("qualitative_sources", [])[:5]):
                        if isinstance(q, dict):
                            logger.warning(
                                f"  - [정성{idx+1}] dp_id={q.get('dp_id')}, "
                                f"source_type={q.get('source_type')}, sentences={len(q.get('used_in_sentences', []))}"
                            )
            logger.warning("=" * 80)
            
            # dp_sentence_mappings 정규화
            dp_mappings: List[Dict[str, Any]] = []
            if isinstance(dp_mappings_raw, list):
                for item in dp_mappings_raw:
                    if not isinstance(item, dict):
                        continue
                    dp_mappings.append({
                        "dp_id": str(item.get("dp_id", "") or ""),
                        "dp_name_ko": str(item.get("dp_name_ko", "") or ""),
                        "sentences": [str(s) for s in (item.get("sentences") or []) if s],
                        "rationale": str(item.get("rationale", "") or ""),
                    })
            
            # data_provenance 정규화
            data_provenance: Dict[str, Any] = {
                "quantitative_sources": [],
                "qualitative_sources": [],
                "reference_pages": {}
            }
            if isinstance(data_provenance_raw, dict):
                data_provenance = data_provenance_raw
            
            if generated_text:
                logger.info(
                    "gen_node JSON parsed: text_len=%d, dp_mappings=%d, provenance_keys=%s",
                    len(generated_text), len(dp_mappings), list(data_provenance.keys())
                )
                return generated_text, dp_mappings, data_provenance
            else:
                logger.warning("gen_node: JSON에 generated_text가 비어있음")
        else:
            logger.warning("gen_node: JSON 객체를 찾을 수 없음 (균형 추출·후행 fallback 모두 실패)")
    
    except json.JSONDecodeError as e:
        logger.warning("gen_node JSON parse failed: %s, 첫 200자=%s", e, text[:200])
    except Exception as e:
        logger.error("gen_node JSON extraction error: %s", e, exc_info=True)
    
    # 폴백: 원본 텍스트 그대로 반환 (JSON이 아닌 경우)
    logger.warning("gen_node: JSON 파싱 실패, 원본 텍스트 사용 (len=%d), dp_mappings=[], provenance={}", len(raw_text))
    return raw_text, [], {}


async def generate_text_gemini(
    gen_input: Dict[str, Any],
    gemini_api_key: str,
    model: str = GEMINI_MODEL_ID,
    timeout: int = 120,
    validator_feedback: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Gemini로 SR 문단 생성 (`model` 인자로 모델 ID 지정)."""
    try:
        from google import genai
    except ImportError:
        raise ImportError("google-genai package is required. Install with: pip install google-genai")

    start_time = time.time()

    client = genai.Client(api_key=gemini_api_key)

    system_prompt = SYSTEM_PROMPT
    user_prompt = build_user_prompt(gen_input, validator_feedback=validator_feedback)

    user_prompt, was_truncated = truncate_if_needed(
        user_prompt, max_tokens=DEFAULT_MAX_PROMPT_TOKENS
    )
    prompt_length = len(user_prompt)

    if was_truncated:
        logger.warning("User prompt was truncated due to length")

    combined_prompt = f"{system_prompt}\n\n{user_prompt}"

    try:
        # JSON 스키마 정의
        response_schema = {
            "type": "object",
            "properties": {
                "generated_text": {
                    "type": "string",
                    "description": "작성된 SR 문단 (마크다운 형식)"
                },
                "dp_sentence_mappings": {
                    "type": "array",
                    "description": "DP별 문장 매핑 목록",
                    "items": {
                        "type": "object",
                        "properties": {
                            "dp_id": {"type": "string"},
                            "dp_name_ko": {"type": "string"},
                            "sentences": {
                                "type": "array",
                                "items": {"type": "string"}
                            },
                            "rationale": {"type": "string"}
                        },
                        "required": ["dp_id", "dp_name_ko", "sentences", "rationale"]
                    }
                },
                "data_provenance": {
                    "type": "object",
                    "description": "데이터 출처 추적",
                    "properties": {
                        "quantitative_sources": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    # Gemini 스키마는 type 배열(유니온) 미지원 — 수치도 문자열로 표기
                                    "value": {
                                        "type": "string",
                                        "description": "정량값(숫자는 문자열로, 예: 1234.5)",
                                    },
                                    "unit": {"type": "string"},
                                    "dp_id": {"type": "string"},
                                    "source_type": {"type": "string"},
                                    "source_details": {
                                        "type": "object",
                                        "description": "출처 세부정보 (핵심 필드만 간결하게)",
                                        "properties": {
                                            "table": {"type": "string"},
                                            "column": {"type": "string"},
                                            "year": {"type": "integer"},
                                            "subsidiary_name": {"type": "string"},
                                            "facility_name": {"type": "string"},
                                            "page_number": {"type": "integer"},
                                            "matched_via": {"type": "string"},
                                            "title": {"type": "string"},
                                            "url": {"type": "string"},
                                        },
                                    },
                                    "mapped_dp_ids": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    },
                                    "used_in_sentences": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    }
                                }
                            }
                        },
                        "qualitative_sources": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "dp_id": {"type": "string"},
                                    "source_type": {"type": "string"},
                                    "source_details": {
                                        "type": "object",
                                        "description": "출처 세부정보 (핵심 필드만 간결하게)",
                                        "properties": {
                                            "year": {"type": "integer"},
                                            "page_number": {"type": "integer"},
                                            "body_excerpt": {"type": "string"},
                                            "title": {"type": "string"},
                                            "url": {"type": "string"},
                                            "subsidiary_name": {"type": "string"},
                                        },
                                    },
                                    "used_in_sentences": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    }
                                }
                            }
                        },
                        "reference_pages": {
                            "type": "object",
                            "description": "SR 참조 페이지; 해당 연도 없으면 키 생략",
                            "properties": {
                                "2024": {
                                    "type": "integer",
                                    "description": "2024년 참조 본문 페이지 번호",
                                },
                                "2023": {
                                    "type": "integer",
                                    "description": "2023년 참조 본문 페이지 번호",
                                },
                            },
                        }
                    },
                    "required": ["quantitative_sources", "qualitative_sources", "reference_pages"]
                }
            },
            "required": ["generated_text", "dp_sentence_mappings", "data_provenance"]
        }
        
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
                    "response_mime_type": "application/json",
                    "response_schema": response_schema,
                },
            ),
            timeout=timeout,
        )

        elapsed_ms = int((time.time() - start_time) * 1000)

        _log_gemini_blocks(response)
        raw_text = _extract_gemini_text(response)
        
        logger.info("gen_node: Gemini 응답 수신 (model=%s, len=%d)", model, len(raw_text or ""))
        
        if not raw_text:
            _log_gemini_empty_response(response)
            logger.warning(
                "Gemini returned empty text (model=%s). If finish_reason=MAX_TOKENS and "
                "thoughts_token_count is high, raise max_output_tokens or try another GEN_NODE_MODEL.",
                model,
            )
            return {
                "text": "",
                "dp_sentence_mappings": [],
                "data_provenance": {
                    "quantitative_sources": [],
                    "qualitative_sources": [],
                    "reference_pages": {}
                },
                "model": model,
                "tokens": 0,
                "finish_reason": "stop",
                "generation_time_ms": elapsed_ms,
                "prompt_length": prompt_length,
            }

        # JSON 응답 파싱
        generated_text, dp_sentence_mappings, data_provenance = _parse_gen_node_json_response(raw_text)

        return {
            "text": generated_text,
            "dp_sentence_mappings": dp_sentence_mappings,
            "data_provenance": data_provenance,
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
        logger.warning("=" * 80)
        logger.warning("gen_node.generate() CALLED - payload keys: %s", list(payload.keys()))
        logger.warning("=" * 80)
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

            feedback_norm = _normalize_validator_feedback(payload.get("feedback"))
            if feedback_norm:
                logger.info(
                    "gen_node: validator feedback %d건 반영 (프롬프트에 포함)",
                    len(feedback_norm),
                )

            max_retries = 2
            last_error = None

            for attempt in range(max_retries + 1):
                try:
                    result = await generate_text_gemini(
                        gen_input=gen_input,
                        gemini_api_key=gemini_api_key,
                        model=model,
                        validator_feedback=feedback_norm,
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

                    _default_prov = {
                        "quantitative_sources": [],
                        "qualitative_sources": [],
                        "reference_pages": {},
                    }
                    _prov = result.get("data_provenance")
                    if not isinstance(_prov, dict):
                        _prov = dict(_default_prov)
                    else:
                        _prov = {
                            "quantitative_sources": list(
                                _prov.get("quantitative_sources") or []
                            ),
                            "qualitative_sources": list(
                                _prov.get("qualitative_sources") or []
                            ),
                            "reference_pages": dict(_prov.get("reference_pages") or {}),
                        }

                    return {
                        "text": result["text"],
                        "dp_sentence_mappings": result.get("dp_sentence_mappings", []),
                        "data_provenance": _prov,
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
