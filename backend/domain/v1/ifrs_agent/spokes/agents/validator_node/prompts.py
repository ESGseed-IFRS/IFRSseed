"""
validator_node LLM 프롬프트 (JSON 출력 강제).

스키마 예시는 반드시 **파서가 통과하는 유효 JSON**이어야 함(의사 JSON 금지).
"""
from __future__ import annotations

import json
from typing import Any, Dict

from .payload import ValidationMode
from .rules import summarize_facts_for_llm

MAX_GENERATED_TEXT_CHARS = 12_000

# 모델이 그대로 복사해도 문법 오류가 나지 않도록, 실제 json.dumps 결과만 예시로 사용
_VALIDATOR_JSON_EXAMPLE_OK = json.dumps(
    {
        "is_valid": True,
        "errors": [],
        "rationale_ko": "제공된 facts와 모순이 없고 과장 표현이 적음.",
        "accuracy_dimensions": {
            "fact_consistency": {"score": 88, "notes_ko": "수치·서술이 대체로 일치함."},
            "greenwashing_risk": {"score": 82, "notes_ko": "근거 없는 효과 주장이 많지 않음."},
        },
        "feedback_items": [],
    },
    ensure_ascii=False,
    indent=2,
)

_VALIDATOR_JSON_EXAMPLE_BAD = json.dumps(
    {
        "is_valid": False,
        "errors": ["제공된 facts에 없는 2023년 수치를 인용했습니다. 해당 문장을 삭제하세요."],
        "rationale_ko": "facts에 없는 연도 수치가 본문에 포함됨.",
        "accuracy_dimensions": {
            "fact_consistency": {"score": 35, "notes_ko": "미제공 수치 언급."},
            "greenwashing_risk": {"score": 70, "notes_ko": "과장은 제한적."},
        },
        "feedback_items": [
            {
                "severity": "error",
                "dimension_id": "fact_consistency",
                "issue_ko": "2023년 배출량이 facts에 없음.",
                "suggestion_ko": "facts에 존재하는 연도·수치만 사용하세요.",
                "quote": "2023년 배출량은 100톤이다",
                "source": "llm",
            }
        ],
    },
    ensure_ascii=False,
    indent=2,
)

SYSTEM_PROMPT = (
    """당신은 지속가능성 보고서(SR) 문단 검증자입니다.

## 임무
- 생성 문단이 제공된 사실 데이터(facts)와 모순되지 않는지, 그린워싱·과장이 없는지 판단합니다.
- 출력은 **JSON 객체 한 개**만 출력합니다. 앞뒤에 설명 문장, 마크다운, 코드펜스(```)를 붙이지 마세요.

## 출력 문법 (필수)
- `is_valid`는 JSON boolean `true` 또는 `false`만 사용합니다.
- `errors`는 문자열 배열입니다. 통과 시 반드시 `[]`.
- `rationale_ko`는 한 줄 요약 문자열.
- `accuracy_dimensions`는 객체이며, 키 `fact_consistency`, `greenwashing_risk` 각각 값은 `{"score": 정수0~100, "notes_ko": "..."}` 형태.
- `feedback_items`는 객체 배열. 각 객체 키: `severity`, `dimension_id`, `issue_ko`, `suggestion_ko`, `quote`(문자열 또는 null), `source`(보통 `"llm"`).
- 문자열 안에 큰따옴표가 필요하면 JSON 규칙대로 `\\"` 로 이스케이프하세요.

## 유효한 JSON 예시 (검증 통과 시; 키와 구조를 동일하게 맞출 것)
"""
    + _VALIDATOR_JSON_EXAMPLE_OK
    + """

## 유효한 JSON 예시 (검증 실패 시)
"""
    + _VALIDATOR_JSON_EXAMPLE_BAD
    + """

## 채점 가이드 (accuracy_dimensions)
- fact_consistency: facts와 모순 없음·누락 없이 서술하면 높은 점수. 모순·무근거 확정이면 낮게.
- greenwashing_risk: 과장·절대적 표현·근거 없는 효과 주장이 적을수록 높은 점수(리스크 낮음).

## 규칙
- 통과 시: `"is_valid": true`, `"errors": []`
- 실패 시: `"is_valid": false`, `errors`에 1개 이상(최대 5개) 구체적 수정 지시(한국어)
- 통과 시에도 `feedback_items`에 `"severity": "suggestion"`만 넣어 개선 제안 가능
"""
)


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
        "위 생성 문단을 검증하고, 지시한 형식의 유효한 JSON만 출력하세요."
    )


def build_combined_prompt(
    category: str,
    generated_text: str,
    fact_data: Dict[str, Any],
    fact_data_by_dp: Dict[str, Any],
    mode: ValidationMode,
) -> str:
    return f"{SYSTEM_PROMPT}\n\n{build_user_prompt(category, generated_text, fact_data, fact_data_by_dp, mode)}"
