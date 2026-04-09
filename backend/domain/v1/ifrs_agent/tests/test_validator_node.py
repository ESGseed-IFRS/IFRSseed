"""
validator_node 단위 테스트 (규칙 레이어 중심).
"""
from __future__ import annotations

import asyncio

import pytest

from backend.domain.v1.ifrs_agent.spokes.agents.validator_node.payload import (
    ValidationMode,
    resolve_validation_mode,
)
from backend.domain.v1.ifrs_agent.spokes.agents.validator_node.rules import (
    rule_non_empty_text,
    run_rules,
)


def test_resolve_validation_mode_refine_by_empty_fdb():
    assert resolve_validation_mode({"fact_data_by_dp": {}}) == ValidationMode.REFINE


def test_resolve_validation_mode_create():
    assert (
        resolve_validation_mode({"fact_data_by_dp": {"dp1": {"value": 1}}})
        == ValidationMode.CREATE
    )


def test_rule_non_empty():
    assert len(rule_non_empty_text("")) == 1
    assert rule_non_empty_text("내용") == []


def test_run_rules_empty_text():
    r, sig = run_rules("", {}, {}, ValidationMode.CREATE)
    assert r.errors
    assert sig.dimension_scores.get("format_completeness") == 0


def test_run_rules_too_short():
    r, sig = run_rules("짧음", {}, {}, ValidationMode.CREATE)
    assert r.errors
    assert sig.dimension_scores.get("format_completeness") == 0


def test_run_rules_ok_minimal_create():
    text = "x" * 85
    r, _sig = run_rules(text, {}, {}, ValidationMode.CREATE)
    assert not r.errors


def test_validator_agent_no_llm_key():
    from backend.domain.v1.ifrs_agent.spokes.agents.validator_node.agent import (
        ValidatorNodeAgent,
    )

    agent = ValidatorNodeAgent(None)
    # fact_data_by_dp 비어 있으면 refine 모드 — 수치 일치 규칙 생략, LLM 키 없음
    payload = {
        "generated_text": "x" * 85,
        "category": "테스트",
        "fact_data": {},
        "fact_data_by_dp": {},
        "runtime_config": {},
    }
    out = asyncio.run(agent.validate(payload))
    assert out["is_valid"] is True
    assert out["errors"] == []
    assert out.get("schema_version") == "validator_ui_v1"
    assert "accuracy" in out
    assert out["accuracy"]["overall"]["score"] >= 60


def test_validator_ui_extended_disabled():
    from backend.domain.v1.ifrs_agent.spokes.agents.validator_node.agent import (
        ValidatorNodeAgent,
    )

    agent = ValidatorNodeAgent(None)
    payload = {
        "generated_text": "x" * 85,
        "category": "테스트",
        "fact_data": {},
        "fact_data_by_dp": {},
        "runtime_config": {"validator_ui_extended": False},
    }
    out = asyncio.run(agent.validate(payload))
    assert out["is_valid"] is True
    assert "schema_version" not in out
    assert "accuracy" not in out


def test_accuracy_merge_policy_invalid():
    from backend.domain.v1.ifrs_agent.spokes.agents.validator_node.accuracy_merge import (
        build_accuracy_payload,
    )

    acc = build_accuracy_payload(
        rule_scores={
            "format_completeness": 0,
            "numeric_presence": 100,
            "dp_availability": 100,
        },
        rule_notes={
            "format_completeness": "x",
            "numeric_presence": "x",
            "dp_availability": "x",
        },
        llm_dims=None,
        llm_skipped=True,
        is_valid=False,
    )
    assert acc["overall"]["score"] <= 59


def test_extract_first_balanced_json_object_respects_strings():
    from backend.domain.v1.ifrs_agent.spokes.agents.validator_node.llm_validate import (
        extract_first_balanced_json_object,
    )

    raw = '설명\n{"a": "brace } in string", "b": 1}\ntrailing'
    blob = extract_first_balanced_json_object(raw)
    assert blob is not None
    assert '"brace } in string"' in blob
    import json

    assert json.loads(blob)["b"] == 1


def test_parse_validator_json_trailing_comma_recovery():
    from backend.domain.v1.ifrs_agent.spokes.agents.validator_node.llm_validate import (
        parse_validator_json,
    )

    s = '{"is_valid": true, "errors": [],}'
    data = parse_validator_json(s)
    assert data["is_valid"] is True


def test_parse_validator_json_strips_fences_and_prefix():
    from backend.domain.v1.ifrs_agent.spokes.agents.validator_node.llm_validate import (
        parse_validator_json,
    )

    s = 'Here:\n```json\n{"is_valid": false, "errors": ["x"]}\n```'
    data = parse_validator_json(s)
    assert data["is_valid"] is False


def test_system_prompt_contains_valid_json_examples():
    from backend.domain.v1.ifrs_agent.spokes.agents.validator_node import prompts

    assert '"is_valid": true' in prompts.SYSTEM_PROMPT
    assert "true 또는 false" not in prompts.SYSTEM_PROMPT
    assert "0-100 정수" not in prompts.SYSTEM_PROMPT
