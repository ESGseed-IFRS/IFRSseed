"""
validator_node — 규칙 + (선택) Gemini JSON 검증.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from .llm_validate import run_llm_validate
from .payload import normalize_generated_text, resolve_validation_mode
from .rules import RuleResult, run_rules

logger = logging.getLogger("ifrs_agent.validator_node")


class ValidatorNodeAgent:
    def __init__(self, infra: Any):
        self.infra = infra

    async def validate(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        text = normalize_generated_text(payload.get("generated_text"))
        category = str(payload.get("category") or "")

        fact_data = payload.get("fact_data")
        fact_data_by_dp = payload.get("fact_data_by_dp")
        if not isinstance(fact_data, dict):
            fact_data = {}
        if not isinstance(fact_data_by_dp, dict):
            fact_data_by_dp = {}

        mode = resolve_validation_mode(payload)
        logger.info(
            "validator_node: mode=%s category_preview=%s text_len=%s",
            mode.value,
            (category[:40] + "…") if len(category) > 40 else category,
            len(text),
        )

        rule_res = run_rules(text, fact_data, fact_data_by_dp, mode)

        if rule_res.errors:
            logger.info(
                "validator_node: 규칙 단계 실패 errors=%d warnings=%d",
                len(rule_res.errors),
                len(rule_res.warnings),
            )
            return _finalize(rule_res, RuleResult())

        runtime = payload.get("runtime_config")
        if not isinstance(runtime, dict):
            runtime = {}
        api_key = str(runtime.get("gemini_api_key") or "").strip()
        model = str(runtime.get("gen_node_model") or "").strip()

        llm_res = await run_llm_validate(
            category=category,
            generated_text=text,
            fact_data=fact_data,
            fact_data_by_dp=fact_data_by_dp,
            mode=mode,
            gemini_api_key=api_key,
            model=model,
        )

        logger.info(
            "validator_node: LLM 단계 errors=%d (규칙 경고 유지=%d)",
            len(llm_res.errors),
            len(rule_res.warnings),
        )

        return _finalize(rule_res, llm_res)


def _finalize(rule_res: RuleResult, llm_res: RuleResult) -> Dict[str, Any]:
    errors: List[str] = list(rule_res.errors)
    errors.extend(llm_res.errors)
    warnings: List[str] = list(rule_res.warnings)
    warnings.extend(llm_res.warnings)
    is_valid = len(errors) == 0
    return {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
    }


def make_validator_node_handler(infra: Any):
    agent = ValidatorNodeAgent(infra)

    async def handler(payload: Dict[str, Any]) -> Dict[str, Any]:
        return await agent.validate(payload)

    return handler
