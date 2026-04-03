"""ucm_dp_mapping_signals 헬퍼 단위 테스트."""

from __future__ import annotations

from types import SimpleNamespace

from backend.domain.shared.tool.UnifiedColumnMapping.ucm_dp_mapping_signals import (
    flatten_validation_rules_for_display,
    is_leaf_dp,
    paragraph_axis_overlap_penalty,
    paragraph_axis_tokens_for_dp,
)


def test_is_leaf_dp_none_or_empty_children():
    assert is_leaf_dp(SimpleNamespace(child_dps=None)) is True
    assert is_leaf_dp(SimpleNamespace(child_dps=[])) is True
    assert is_leaf_dp(SimpleNamespace(child_dps=["x"])) is False


def test_flatten_validation_rules_list_and_dict():
    assert flatten_validation_rules_for_display(["a", "b"]) == ["a", "b"]
    d = {"section_type": "x", "key_terms": ["k"]}
    flat = flatten_validation_rules_for_display(d)
    assert any("section_type" in x for x in flat)


def test_paragraph_tokens_and_overlap():
    dp = SimpleNamespace(
        dp_id="ESRSE3-E3-4-26",
        dp_code="X",
        name_en="E3-4 water consumption",
        name_ko="물 소비",
        description="문단 26~29",
    )
    toks = paragraph_axis_tokens_for_dp(dp, None)
    assert any("e3-4" in t or "26" in t for t in toks)
    o, d = paragraph_axis_overlap_penalty({"e3-4"}, {"e3-4", "other"})
    assert o is True and d is False
    o2, d2 = paragraph_axis_overlap_penalty({"e3-4"}, {"e5-1"})
    assert o2 is False and d2 is True
