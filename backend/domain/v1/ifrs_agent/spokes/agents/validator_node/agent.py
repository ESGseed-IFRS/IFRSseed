"""
validator_node — 규칙 + (선택) Gemini JSON 검증.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from .accuracy_merge import (
    SCHEMA_VERSION,
    build_accuracy_payload,
    normalize_feedback_items,
)
from .llm_validate import LlmValidateOutcome, run_llm_validate
from .payload import (
    is_validator_ui_extended,
    normalize_generated_text,
    resolve_validation_mode,
)
from .rules import RuleResult, RuleSignals, run_rules

logger = logging.getLogger("ifrs_agent.validator_node")


def _guess_dimension_for_rule_error(message: str) -> str:
    m = message
    if "비어" in m or "짧습니다" in m or "짧음" in m:
        return "format_completeness"
    if "수치" in m or "반영되지 않" in m or "지표" in m:
        return "numeric_presence"
    if "DP" in m and "조회" in m:
        return "dp_availability"
    return "format_completeness"


def _errors_to_rule_feedback_items(errors: List[str]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for msg in errors:
        dim = _guess_dimension_for_rule_error(msg)
        out.append(
            {
                "severity": "error",
                "dimension_id": dim,
                "issue_ko": msg,
                "suggestion_ko": "위 내용을 반영해 문단을 수정하세요.",
                "quote": None,
                "source": "rules",
            }
        )
    return out


def _merge_summary_ko(rule_summary: str, llm_line: Optional[str]) -> str:
    parts: List[str] = []
    if rule_summary.strip():
        parts.append(rule_summary.strip())
    if llm_line and str(llm_line).strip():
        parts.append(str(llm_line).strip())
    if not parts:
        return "특이 사항 없음."
    return " ".join(parts)


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
        ui_ext = is_validator_ui_extended(payload)

        logger.info(
            "validator_node: mode=%s ui_extended=%s category_preview=%s text_len=%s",
            mode.value,
            ui_ext,
            (category[:40] + "…") if len(category) > 40 else category,
            len(text),
        )

        rule_res, rule_sig = run_rules(text, fact_data, fact_data_by_dp, mode)

        llm_out: Optional[LlmValidateOutcome] = None
        if not rule_res.errors:
            runtime = payload.get("runtime_config")
            if not isinstance(runtime, dict):
                runtime = {}
            api_key = str(runtime.get("gemini_api_key") or "").strip()
            model = str(runtime.get("gen_node_model") or "").strip()

            llm_out = await run_llm_validate(
                category=category,
                generated_text=text,
                fact_data=fact_data,
                fact_data_by_dp=fact_data_by_dp,
                mode=mode,
                gemini_api_key=api_key,
                model=model,
            )

            logger.info(
                "validator_node: LLM 단계 errors=%d skipped_no_key=%s (규칙 경고=%d)",
                len(llm_out.rule_result.errors),
                llm_out.skipped_no_api_key,
                len(rule_res.warnings),
            )
        else:
            logger.info(
                "validator_node: 규칙 단계 실패 errors=%d warnings=%d — LLM 생략",
                len(rule_res.errors),
                len(rule_res.warnings),
            )

        if ui_ext:
            return _assemble_extended(rule_res, rule_sig, llm_out)

        return _finalize_compact(rule_res, llm_out)


def _finalize_compact(
    rule_res: RuleResult,
    llm_out: Optional[LlmValidateOutcome],
) -> Dict[str, Any]:
    llm_part = llm_out.rule_result if llm_out else RuleResult()
    errors: List[str] = list(rule_res.errors)
    errors.extend(llm_part.errors)
    warnings: List[str] = list(rule_res.warnings)
    warnings.extend(llm_part.warnings)
    is_valid = len(errors) == 0
    return {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
    }


def _assemble_extended(
    rule_res: RuleResult,
    rule_sig: RuleSignals,
    llm_out: Optional[LlmValidateOutcome],
) -> Dict[str, Any]:
    llm_part = llm_out.rule_result if llm_out else RuleResult()
    errors: List[str] = list(rule_res.errors)
    errors.extend(llm_part.errors)
    warnings: List[str] = list(rule_res.warnings)
    warnings.extend(llm_part.warnings)
    is_valid = len(errors) == 0

    llm_skipped = llm_out is None or (
        llm_out.skipped_no_api_key if llm_out else True
    )
    acc_llm = llm_out.accuracy_dimensions if llm_out else None

    accuracy = build_accuracy_payload(
        rule_scores=rule_sig.dimension_scores,
        rule_notes=rule_sig.dimension_notes_ko,
        llm_dims=acc_llm,
        llm_skipped=llm_skipped,
        is_valid=is_valid,
    )

    feedback_items: List[Dict[str, Any]] = []
    if rule_res.errors:
        feedback_items.extend(_errors_to_rule_feedback_items(rule_res.errors))
    if llm_out and llm_out.feedback_items:
        feedback_items.extend(normalize_feedback_items(llm_out.feedback_items))

    llm_rationale = llm_out.rationale_ko if llm_out else None
    summary_ko = _merge_summary_ko(rule_sig.rule_summary_ko, llm_rationale)

    return {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "schema_version": SCHEMA_VERSION,
        "accuracy": accuracy,
        "feedback_items": feedback_items,
        "rationale": {
            "summary_ko": summary_ko,
            "rule_summary_ko": rule_sig.rule_summary_ko,
            "llm_summary_ko": llm_rationale or "",
        },
    }


def make_validator_node_handler(infra: Any):
    agent = ValidatorNodeAgent(infra)

    async def handler(payload: Dict[str, Any]) -> Dict[str, Any]:
        return await agent.validate(payload)

    return handler
