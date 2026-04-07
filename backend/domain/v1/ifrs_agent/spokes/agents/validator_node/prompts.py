"""
validator_node LLM 프롬프트 (JSON 출력 강제).
"""
from __future__ import annotations

from typing import Any, Dict

from .payload import ValidationMode
from .rules import summarize_facts_for_llm

MAX_GENERATED_TEXT_CHARS = 12_000


SYSTEM_PROMPT = """당신은 지속가능성 보고서(SR) 문단 검증자입니다.

## 임무
- 생성 문단이 제공된 사실 데이터(facts)와 모순되지 않는지, 그린워싱·과장이 없는지 판단합니다.
- 출력은 **JSON 한 덩어리만** 출력합니다. 마크다운 코드펜스(```)는 사용하지 마세요.

## 출력 스키마 (필수)
{
  "is_valid": true 또는 false,
  "errors": [ "한국어로 구체적 수정 요청 — 재작성 시 반영 가능한 문장" ],
  "rationale_ko": "한 줄 요약"
}

- 통과 시: is_valid=true, errors=[]
- 실패 시: is_valid=false, errors에 1개 이상(최대 5개) 구체 지시
"""


def build_user_prompt(
    category: str,
    generated_text: str,
    fact_data: Dict[str, Any],
    fact_data_by_dp: Dict[str, Any],
    mode: ValidationMode,
) -> str:
    body = generated_text
    if len(body) > MAX_GENERATED_TEXT_CHARS:
        body = body[:MAX_GENERATED_TEXT_CHARS] + "\n\n…(truncated)"

    facts_summary, representative_fact = summarize_facts_for_llm(
        fact_data if isinstance(fact_data, dict) else {},
        fact_data_by_dp if isinstance(fact_data_by_dp, dict) else {},
    )

    return (
        f"## 검증 모드\n{mode.value}\n\n"
        f"## 카테고리(주제)\n{category or '(없음)'}\n\n"
        f"## DP별 요약\n{facts_summary}\n\n"
        f"## 대표 fact_data (JSON)\n{representative_fact}\n\n"
        f"## 생성 문단\n{body}\n\n"
        "위 생성 문단을 검증하고, 지시한 JSON만 출력하세요."
    )


def build_combined_prompt(
    category: str,
    generated_text: str,
    fact_data: Dict[str, Any],
    fact_data_by_dp: Dict[str, Any],
    mode: ValidationMode,
) -> str:
    return f"{SYSTEM_PROMPT}\n\n{build_user_prompt(category, generated_text, fact_data, fact_data_by_dp, mode)}"
