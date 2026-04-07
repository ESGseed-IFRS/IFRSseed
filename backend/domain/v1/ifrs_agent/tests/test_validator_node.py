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
    r = run_rules("", {}, {}, ValidationMode.CREATE)
    assert r.errors


def test_run_rules_too_short():
    r = run_rules("짧음", {}, {}, ValidationMode.CREATE)
    assert r.errors


def test_run_rules_ok_minimal_create():
    text = "x" * 85
    r = run_rules(text, {}, {}, ValidationMode.CREATE)
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
