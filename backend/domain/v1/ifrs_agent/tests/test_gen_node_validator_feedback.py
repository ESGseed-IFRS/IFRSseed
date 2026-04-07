"""
gen_node: validator 피드백이 프롬프트에 포함되는지 검증.
"""
from __future__ import annotations

from backend.domain.v1.ifrs_agent.spokes.agents.gen_node.prompts import build_user_prompt


def _minimal_gen_input() -> dict:
    return {
        "category": "테스트",
        "report_year": 2024,
        "ref_2024": {"body_text": "참조 본문 " * 50, "page_number": 1},
    }


def test_build_user_prompt_without_feedback_has_no_validator_section():
    p = build_user_prompt(_minimal_gen_input(), validator_feedback=None)
    assert "이전 검증 피드백" not in p


def test_build_user_prompt_includes_validator_feedback():
    p = build_user_prompt(
        _minimal_gen_input(),
        validator_feedback=[
            "수치 A가 본문에 없습니다.",
            "그린워싱 표현을 줄이세요.",
        ],
    )
    assert "이전 검증 피드백" in p
    assert "수치 A가 본문에 없습니다." in p
    assert "그린워싱 표현을 줄이세요." in p
