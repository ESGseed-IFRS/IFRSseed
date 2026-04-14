"""
validator_node LLM 프롬프트 (JSON 출력 강제).

스키마 예시는 반드시 **파서가 통과하는 유효 JSON**이어야 함(의사 JSON 금지).
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .payload import ValidationMode
from .rules import format_supplementary_rows_compact, summarize_facts_for_llm

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

## 중요: 데이터 검증 규칙
- 각 DP의 `value`가 null이더라도, `(supplementary: N건)` 표시가 있으면 **해당 DP는 유효한 데이터를 가지고 있습니다**.
- supplementary_real_data는 정량 데이터의 보조 출처로, latest_value가 없어도 실제 값이 존재합니다.
- **각 DP는 고유한 지표**입니다. UCM_scope1_001은 Scope 1, UCM_scope2_002는 Scope 2를 나타냅니다.
- DP별로 제공된 값을 혼동하지 마세요. 예: Scope 1의 946.38과 Scope 2의 176,873.74는 서로 다른 지표입니다.
- **「DP별 요약」**에서 각 DP 헤더 줄 아래에 `· table.column: 값` 형태로 이어지는 줄은 **보조 실데이터(supplementary_real_data)** 입니다. gen_node 생성 시와 **동일한 DB 출처**이므로, 여기에 있는 수치·문구는 **제공된 facts**로 간주합니다.
- 사용자 메시지에 **「생성 단계 참조·집계 요약」**이 있으면, 그 안의 **dp_data_list**·SR 참조 본문(ref_2024/ref_2023)·agg_data(계열사·외부 스냅샷)에 나온 수치·시설명·감축 실적도 **제공된 데이터**입니다. "DP별 요약" 첫 줄에만 없다고 해서 미제공으로 단정하지 마세요.

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


def _format_dp_data_list_for_validator(
    gen_input: Dict[str, Any],
    *,
    max_section_chars: int = 7_000,
    supp_max_rows_per_dp: int = 20,
) -> str:
    """
    gen_node에 전달된 dp_data_list를 검증 LLM에 동일하게 노출.
    (latest_value·unit·보조 실데이터 table.column=값)
    """
    dp_list = gen_input.get("dp_data_list")
    if not dp_list:
        legacy = gen_input.get("dp_data")
        if isinstance(legacy, dict) and legacy:
            dp_list = [legacy]
        else:
            return ""

    chunks: List[str] = []
    for idx, dp_data in enumerate(dp_list, 1):
        if not isinstance(dp_data, dict):
            continue
        dp_id = dp_data.get("dp_id") or f"idx_{idx}"
        name = dp_data.get("dp_name_ko") or dp_id
        lv = dp_data.get("latest_value")
        unit = dp_data.get("unit") or ""
        year = dp_data.get("year", "N/A")
        block_lines = [
            f"#### DP {idx}: {name} (`{dp_id}`)",
            f"- {year}년 값(latest_value): {lv!r} {unit}".strip(),
        ]
        supp = dp_data.get("supplementary_real_data")
        if isinstance(supp, list) and supp:
            block_lines.append("- 보조 실데이터 (DB, gen_node와 동일):")
            block_lines.extend(
                format_supplementary_rows_compact(
                    supp, max_rows=supp_max_rows_per_dp, value_max_chars=96
                )
            )
        chunks.append("\n".join(block_lines))

    section = "### dp_data_list (생성 단계 gen_input — 보조 실데이터 포함)\n\n" + "\n\n".join(
        chunks
    )
    if len(section) > max_section_chars:
        section = section[:max_section_chars] + "\n…(truncated)"
    return section


def format_generation_context_for_validator(
    gen_input: Optional[Dict[str, Any]],
    *,
    max_total_chars: int = 22_000,
    ref_body_cap: int = 6_000,
    agg_cap: int = 8_000,
) -> str:
    """
    gen_node에 넘어갔던 ref SR 본문·dp_data_list·agg_data를 검증 LLM이 동일하게 볼 수 있게 직렬화.
    (DP 팩트만으로는 SR 표/계열사 수치·보조 environmental/social 컬럼이 누락되어 오탐이 난다.)
    """
    if not gen_input or not isinstance(gen_input, dict):
        return "(전달 없음 — DP 팩트·대표 fact만 검증 기준으로 사용)"

    parts: List[str] = []
    for year_key in ("ref_2024", "ref_2023"):
        block = gen_input.get(year_key)
        if not isinstance(block, dict):
            continue
        page = block.get("page_number")
        body = block.get("body_text") or ""
        if isinstance(body, str) and body.strip():
            if len(body) > ref_body_cap:
                body = body[:ref_body_cap] + "\n…(truncated)"
            parts.append(f"### {year_key} (page_number={page})\n{body}")

    dp_section = _format_dp_data_list_for_validator(gen_input)
    if dp_section.strip():
        parts.append(dp_section)

    agg = gen_input.get("agg_data")
    if agg is not None and agg != {}:
        try:
            agg_s = json.dumps(agg, ensure_ascii=False, default=str)
        except TypeError:
            agg_s = str(agg)
        if len(agg_s) > agg_cap:
            agg_s = agg_s[:agg_cap] + "\n…(truncated)"
        parts.append(f"### agg_data (subsidiary / external snapshot)\n{agg_s}")

    out = "\n\n".join(parts) if parts else "(참조·집계 본문 없음)"
    if len(out) > max_total_chars:
        out = out[:max_total_chars] + "\n…(truncated)"
    return out


def build_user_prompt(
    category: str,
    generated_text: str,
    fact_data: Dict[str, Any],
    fact_data_by_dp: Dict[str, Any],
    mode: ValidationMode,
    gen_input: Optional[Dict[str, Any]] = None,
) -> str:
    body = generated_text
    if len(body) > MAX_GENERATED_TEXT_CHARS:
        body = body[:MAX_GENERATED_TEXT_CHARS] + "\n\n…(truncated)"

    facts_summary, representative_fact = summarize_facts_for_llm(
        fact_data if isinstance(fact_data, dict) else {},
        fact_data_by_dp if isinstance(fact_data_by_dp, dict) else {},
    )

    gen_ctx = format_generation_context_for_validator(gen_input)

    return (
        f"## 검증 모드\n{mode.value}\n\n"
        f"## 카테고리(주제)\n{category or '(없음)'}\n\n"
        f"## DP별 요약\n{facts_summary}\n\n"
        f"## 대표 fact_data (JSON)\n{representative_fact}\n\n"
        f"## 생성 단계 참조·DP·집계 요약 (gen_node와 동일 출처 — 여기 수치도 허용)\n{gen_ctx}\n\n"
        f"## 생성 문단\n{body}\n\n"
        "위 생성 문단을 검증하고, 지시한 형식의 유효한 JSON만 출력하세요."
    )


def build_combined_prompt(
    category: str,
    generated_text: str,
    fact_data: Dict[str, Any],
    fact_data_by_dp: Dict[str, Any],
    mode: ValidationMode,
    gen_input: Optional[Dict[str, Any]] = None,
) -> str:
    return f"{SYSTEM_PROMPT}\n\n{build_user_prompt(category, generated_text, fact_data, fact_data_by_dp, mode, gen_input)}"
