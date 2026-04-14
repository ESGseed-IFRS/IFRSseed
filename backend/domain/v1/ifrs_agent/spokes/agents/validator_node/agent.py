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

    def _validate_provenance(
        self, data_provenance: Dict[str, Any], generated_text: str
    ) -> List[str]:
        """
        data_provenance 검증 로직
        
        - quantitative_sources: 수치 데이터 출처 검증
        - qualitative_sources: 정성 데이터 출처 검증
        - used_in_sentences: 문장이 generated_text에 실제로 존재하는지 확인
        - sentence_coverage: 본문의 모든 문장이 최소 1개 이상의 출처를 가지는지 확인
        
        Returns:
            에러 메시지 리스트
        """
        errors: List[str] = []
        
        if not data_provenance:
            logger.info("validator_node: data_provenance 없음 (생략)")
            return errors
        
        # quantitative_sources 검증
        quant_sources = data_provenance.get("quantitative_sources", [])
        if not isinstance(quant_sources, list):
            errors.append("data_provenance.quantitative_sources는 배열이어야 합니다")
        else:
            for idx, src in enumerate(quant_sources):
                if not isinstance(src, dict):
                    errors.append(f"quantitative_sources[{idx}]는 객체여야 합니다")
                    continue
                
                # 필수 필드 체크
                if "value" not in src:
                    errors.append(f"quantitative_sources[{idx}]: value 필드 누락")
                if "source_type" not in src:
                    errors.append(f"quantitative_sources[{idx}]: source_type 필드 누락")
                
                # used_in_sentences 존재 검증
                used_sentences = src.get("used_in_sentences", [])
                if isinstance(used_sentences, list):
                    for sentence in used_sentences:
                        if sentence and sentence not in generated_text:
                            logger.warning(
                                "validator_node: quantitative_sources[%d] 문장이 본문에 없음: %s...",
                                idx, sentence[:50]
                            )
        
        # qualitative_sources 검증
        qual_sources = data_provenance.get("qualitative_sources", [])
        if not isinstance(qual_sources, list):
            errors.append("data_provenance.qualitative_sources는 배열이어야 합니다")
        else:
            for idx, src in enumerate(qual_sources):
                if not isinstance(src, dict):
                    errors.append(f"qualitative_sources[{idx}]는 객체여야 합니다")
                    continue
                
                # 필수 필드 체크
                if "source_type" not in src:
                    errors.append(f"qualitative_sources[{idx}]: source_type 필드 누락")
                
                # used_in_sentences 존재 검증
                used_sentences = src.get("used_in_sentences", [])
                if isinstance(used_sentences, list):
                    for sentence in used_sentences:
                        if sentence and sentence not in generated_text:
                            logger.warning(
                                "validator_node: qualitative_sources[%d] 문장이 본문에 없음: %s...",
                                idx, sentence[:50]
                            )
        
        # reference_pages 검증
        ref_pages = data_provenance.get("reference_pages", {})
        if not isinstance(ref_pages, dict):
            errors.append("data_provenance.reference_pages는 객체여야 합니다")
        
        # 문장 커버리지 검증 (신규)
        coverage_warnings = self._check_sentence_coverage(
            generated_text, quant_sources, qual_sources
        )
        if coverage_warnings:
            logger.warning(
                "validator_node: 출처 커버리지 경고 %d건 (본문 문장 중 출처 없는 문장 있음)",
                len(coverage_warnings)
            )
            # 경고로만 처리 (에러는 아님)
            for warning in coverage_warnings[:5]:  # 최대 5개만
                logger.warning("  - %s", warning)
        
        logger.info(
            "validator_node: provenance 검증 완료 (quant=%d, qual=%d, errors=%d, coverage_warnings=%d)",
            len(quant_sources), len(qual_sources), len(errors), len(coverage_warnings)
        )
        
        return errors
    
    def _check_sentence_coverage(
        self,
        generated_text: str,
        quant_sources: List[Dict[str, Any]],
        qual_sources: List[Dict[str, Any]]
    ) -> List[str]:
        """
        본문의 모든 문장이 최소 1개 이상의 출처를 가지는지 확인
        
        Returns:
            경고 메시지 리스트 (출처 없는 문장들)
        """
        warnings = []
        
        # 본문을 문장 단위로 분리
        import re
        sentences = [s.strip() for s in re.split(r'[.!?]\s+', generated_text) if s.strip()]
        
        # 제목/소제목 제거 (## 로 시작하는 줄)
        content_sentences = [
            s for s in sentences 
            if not s.startswith('#') and len(s) > 10  # 너무 짧은 문장도 제외
        ]
        
        if not content_sentences:
            return warnings
        
        # 모든 출처의 used_in_sentences 수집
        covered_sentences = set()
        
        for src in quant_sources:
            if isinstance(src, dict):
                used = src.get("used_in_sentences", [])
                if isinstance(used, list):
                    for sentence in used:
                        if sentence:
                            covered_sentences.add(sentence.strip())
        
        for src in qual_sources:
            if isinstance(src, dict):
                used = src.get("used_in_sentences", [])
                if isinstance(used, list):
                    for sentence in used:
                        if sentence:
                            covered_sentences.add(sentence.strip())
        
        # 출처 없는 문장 찾기
        for sentence in content_sentences:
            if sentence not in covered_sentences:
                # 부분 매칭도 시도 (공백/구두점 차이 허용)
                normalized = re.sub(r'\s+', ' ', sentence)
                found = False
                for covered in covered_sentences:
                    covered_normalized = re.sub(r'\s+', ' ', covered)
                    if normalized in covered_normalized or covered_normalized in normalized:
                        found = True
                        break
                
                if not found:
                    warnings.append(f"출처 없는 문장: {sentence[:80]}...")
        
        coverage_rate = (len(content_sentences) - len(warnings)) / len(content_sentences) * 100 if content_sentences else 100
        logger.info(
            "validator_node: 문장 커버리지 %.1f%% (%d/%d 문장)",
            coverage_rate, len(content_sentences) - len(warnings), len(content_sentences)
        )
        
        return warnings

    async def validate(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        text = normalize_generated_text(payload.get("generated_text"))
        category = str(payload.get("category") or "")

        fact_data = payload.get("fact_data")
        fact_data_by_dp = payload.get("fact_data_by_dp")
        gen_input = payload.get("gen_input")
        if not isinstance(fact_data, dict):
            fact_data = {}
        if not isinstance(fact_data_by_dp, dict):
            fact_data_by_dp = {}
        if not isinstance(gen_input, dict):
            gen_input = None

        # data_provenance 추출
        data_provenance = payload.get("data_provenance")
        if not isinstance(data_provenance, dict):
            data_provenance = {}

        mode = resolve_validation_mode(payload)
        ui_ext = is_validator_ui_extended(payload)

        logger.info(
            "validator_node: mode=%s ui_extended=%s category_preview=%s text_len=%s provenance_keys=%s",
            mode.value,
            ui_ext,
            (category[:40] + "…") if len(category) > 40 else category,
            len(text),
            list(data_provenance.keys()) if data_provenance else [],
        )

        rule_res, rule_sig = run_rules(text, fact_data, fact_data_by_dp, mode)

        # data_provenance 검증
        provenance_errors = self._validate_provenance(data_provenance, text)
        if provenance_errors:
            logger.warning("validator_node: data_provenance 검증 실패: %d 건", len(provenance_errors))
            rule_res.errors.extend(provenance_errors)

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
                gen_input=gen_input,
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
