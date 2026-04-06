"""
Phase 0: 사용자 프롬프트·참조 페이지 해석 (규칙 + 선택적 Gemini).

오케스트레이터가 c_rag / 이후 단계에 넘길 search_intent, content_focus, ref_pages 를 만든다.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, Optional

logger = logging.getLogger("ifrs_agent.orchestrator.prompt_interpretation")

_YEAR_KEYS = ("2024", "2023")


def extract_ref_pages_from_text(text: str) -> Dict[str, Optional[int]]:
    """
    자연어에서 전년(2024)·전전년(2023) 페이지 번호 추출.

    - 전년 / 전년도 → 2024 (c_rag 기본 years[0]에 해당)
    - 전전년 → 2023
    - '2024년 ... 89페이지' 형태 보조
    """
    out: Dict[str, Optional[int]] = {"2024": None, "2023": None}
    if not text or not str(text).strip():
        return out

    t = text.strip()

    def _one(pattern: str, flags: int = 0) -> Optional[int]:
        m = re.search(pattern, t, flags)
        if not m:
            return None
        try:
            return int(m.group(1))
        except (ValueError, IndexError):
            return None

    # 전년 → 2024, 전전년 → 2023
    v = _one(r"전년\s*도?\s*[:\s]*(\d{1,4})\s*페이지?")
    if v is not None:
        out["2024"] = v
    v = _one(r"전전년\s*도?\s*[:\s]*(\d{1,4})\s*페이지?")
    if v is not None:
        out["2023"] = v

    # 명시 연도
    m = re.search(r"2024\s*년?\s*[^0-9]{0,24}?(\d{1,4})\s*페이지?", t)
    if m:
        out["2024"] = int(m.group(1))
    m = re.search(r"2023\s*년?\s*[^0-9]{0,24}?(\d{1,4})\s*페이지?", t)
    if m:
        out["2023"] = int(m.group(1))

    return out


def normalize_api_ref_pages(raw: Any) -> Dict[str, Optional[int]]:
    """API/클라이언트에서 온 ref_pages 를 2024/2023 키로 정규화."""
    out: Dict[str, Optional[int]] = {"2024": None, "2023": None}
    if not raw or not isinstance(raw, dict):
        return out
    for k in _YEAR_KEYS:
        v = raw.get(k)
        if v is not None:
            try:
                out[k] = int(v)
            except (TypeError, ValueError):
                logger.warning("normalize_api_ref_pages: invalid page for %s: %r", k, v)
    return out


def merge_ref_pages(
    from_api: Optional[Dict[str, Any]],
    from_text: Dict[str, Optional[int]],
) -> Dict[str, Optional[int]]:
    """API 값이 있으면 우선, 없으면 텍스트 추출 결과."""
    base = normalize_api_ref_pages(from_api)
    for k in _YEAR_KEYS:
        if base.get(k) is None and from_text.get(k) is not None:
            base[k] = from_text[k]
    return base


def ref_pages_for_direct_mode(merged: Dict[str, Optional[int]]) -> Optional[Dict[str, int]]:
    """c_rag 다이렉트 모드: 페이지가 하나라도 있으면 {year_str: page} 만 반환."""
    out: Dict[str, int] = {}
    for k in _YEAR_KEYS:
        v = merged.get(k)
        if v is not None:
            out[k] = int(v)
    return out if out else None


def interpret_prompt_with_gemini(
    client: Any,
    model_id: str,
    category: str,
    user_prompt: str,
    ref_pages_hint: Dict[str, Optional[int]],
) -> Dict[str, Any]:
    """
    Gemini로 search_intent·content_focus·dp_validation_needed 추출.

    client: google.genai Client (models.generate_content)
    """
    hint = json.dumps(
        {k: ref_pages_hint.get(k) for k in _YEAR_KEYS},
        ensure_ascii=False,
    )
    sys_prompt = f"""당신은 지속가능경영보고서(SR) 초안 작성 도우미의 의도 분석기입니다.
사용자가 입력한 카테고리와 자유 프롬프트를 읽고 JSON만 반환하세요.

## 출력 JSON 스키마
{{
  "search_intent": "SR 본문 벡터 검색에 쓸 짧은 한국어 키워드 문구(카테고리와 합쳐 검색). 불필요하면 빈 문자열.",
  "content_focus": "사용자가 초안에서 특히 다루고 싶은 주제·요구를 한 문장 한국어로.",
  "dp_validation_needed": false
}}

- search_intent: 예) '고객 VoC 채널 처리 절차'
- content_focus: 예) '고객 VoC 채널과 처리 절차·프로세스를 설명할 것'
- dp_validation_needed: 사용자가 DP/지표 선택이 모호하다고 하면 true (기본 false)

프롬프트가 비어 있으면 search_intent는 빈 문자열, content_focus는 카테고리만 반영해도 됩니다.
"""

    user_block = f"""## 카테고리
{category}

## 사용자 프롬프트
{user_prompt or "(없음)"}

## 참조 페이지 힌트(정규식/ API 병합, 없으면 null)
{hint}
"""

    response = client.models.generate_content(
        model=model_id,
        contents=sys_prompt + "\n\n" + user_block,
        config={
            "temperature": 0.15,
            "response_mime_type": "application/json",
        },
    )
    raw = getattr(response, "text", None) or ""
    if not str(raw).strip():
        raise ValueError("empty Gemini interpretation response")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("interpretation JSON must be an object")
    return {
        "search_intent": str(data.get("search_intent", "") or "").strip(),
        "content_focus": str(data.get("content_focus", "") or "").strip(),
        "dp_validation_needed": bool(data.get("dp_validation_needed", False)),
    }


def heuristic_interpretation(category: str, user_prompt: str) -> Dict[str, Any]:
    """Gemini 없을 때 폴백."""
    p = (user_prompt or "").strip()
    return {
        "search_intent": p,
        "content_focus": p or (category or "").strip(),
        "dp_validation_needed": False,
    }
