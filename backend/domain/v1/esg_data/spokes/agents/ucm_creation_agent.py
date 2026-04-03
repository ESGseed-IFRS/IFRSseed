"""UCM 생성 에이전트(2단계) — 정책 훅 및 §2-3 LLM 보정 연동."""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from backend.domain.v1.esg_data.spokes.infra.ucm_pipeline_contracts import (
    DecisionResult,
    EmbeddingCandidateItem,
    LLMRefinementResult,
    RuleCandidateResult,
    UCMWorkflowCreateResult,
)
from backend.domain.v1.esg_data.spokes.agents import ucm_policy
from backend.domain.v1.esg_data.hub.services.ucm_mapping_service import UCMMappingService
from backend.domain.v1.esg_data.spokes.infra.esg_ucm_tool_runtime import DirectEsgToolRuntime


class UCMCreationAgent:
    """UCM 생성/추천, 정책 단계, 경계 구간 LLM 재평가(스텁)."""

    def __init__(
        self,
        mapping_service: UCMMappingService | None = None,
        tool_runtime: DirectEsgToolRuntime | None = None,
    ) -> None:
        self.mapping_service = mapping_service or UCMMappingService()
        self._tool_runtime = tool_runtime or DirectEsgToolRuntime(mapping_service=self.mapping_service)

    def llm_refinement(self, context: Dict[str, Any]) -> LLMRefinementResult:
        """§2-3: 경계 구간에서 LLM(gpt-5-mini) 보정 점수 계산."""
        model = str(context.get("model") or "gpt-5-mini")
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            return {
                "status": "skipped",
                "notes": f"OPENAI_API_KEY not set ({model})",
                "llm_used": False,
            }

        try:
            from openai import OpenAI
        except ImportError:
            return {
                "status": "error",
                "notes": "openai package is required (pip install openai)",
                "llm_used": False,
            }

        client = OpenAI(api_key=api_key)
        payload = {
            "source_dp_id": context.get("source_dp_id"),
            "target_dp_id": context.get("target_dp_id"),
            "source_snapshot": context.get("source_snapshot", {}),
            "target_snapshot": context.get("target_snapshot", {}),
            "candidate": context.get("candidate", {}),
            "rule_row": context.get("rule_row", {}),
            "validation_rules": context.get("validation_rules", []),
            "source_datapoint_validation_rules": context.get("source_datapoint_validation_rules", []),
            "target_datapoint_validation_rules": context.get("target_datapoint_validation_rules", []),
            "paragraph_axis": context.get("paragraph_axis", {}),
            "tentative_decision": context.get("tentative_decision"),
        }
        system_prompt = (
            "You are a strict ESG mapping judge for unified-column mapping. "
            "Judge semantic intent alignment first using source/target description, topic, subtopic, and names. "
            "Compare action, object, unit, frequency/time horizon, and disclosure intent. "
            "Use paragraph_axis (extracted disclosure refs) and datapoint validation rule strings when present. "
            "If semantic intent is clearly different, output reject and keep refinement_score low (<=0.35). "
            "If strongly aligned and rule evidence is consistent, output accept with high score. "
            "Return ONLY JSON with keys: refinement_score (0~1 float), "
            "llm_decision (accept|review|reject), llm_reason_codes (string array), notes (short string). "
            "Use validation_rules explicitly when judging consistency."
        )
        user_prompt = (
            "Refine mapping confidence for a cross-standard datapoint pair.\n"
            "Prioritize semantic intent alignment over lexical overlap.\n"
            f"Input:\n{json.dumps(payload, ensure_ascii=False)}"
        )
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            choice = resp.choices[0] if resp.choices else None
            raw_text = (choice.message.content or "").strip() if choice and choice.message else ""
            data = json.loads(raw_text)
            score = float(data.get("refinement_score"))
            score = max(0.0, min(1.0, score))
            notes = str(data.get("notes") or "")
            llm_decision = str(data.get("llm_decision") or "").strip().lower()
            if llm_decision not in {"accept", "review", "reject"}:
                llm_decision = ""
            llm_reason_codes_raw = data.get("llm_reason_codes") or []
            llm_reason_codes = (
                [str(x).strip() for x in llm_reason_codes_raw if str(x).strip()]
                if isinstance(llm_reason_codes_raw, list)
                else []
            )
            return {
                "status": "success",
                "refinement_score": round(score, 4),
                "notes": notes,
                "llm_decision": llm_decision or None,
                "llm_reason_codes": llm_reason_codes,
                "llm_used": True,
            }
        except Exception as e:
            logger.warning("UCM llm_refinement failed: {}", e)
            return {
                "status": "error",
                "notes": f"llm refinement failed ({model}): {e}",
                "llm_used": False,
            }

    def llm_refinement_batch(
        self,
        contexts: List[Dict[str, Any]],
        *,
        model: str = "gpt-5-mini",
    ) -> List[LLMRefinementResult]:
        """마이크로배치로 LLM 보정 점수를 계산한다(입력 순서 보장)."""
        if not contexts:
            return []
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            return [
                {"status": "skipped", "notes": f"OPENAI_API_KEY not set ({model})", "llm_used": False}
                for _ in contexts
            ]
        try:
            from openai import OpenAI
        except ImportError:
            return [
                {"status": "error", "notes": "openai package is required (pip install openai)", "llm_used": False}
                for _ in contexts
            ]

        payload_items: List[Dict[str, Any]] = []
        for i, ctx in enumerate(contexts):
            payload_items.append(
                {
                    "idx": i,
                    "source_dp_id": ctx.get("source_dp_id"),
                    "target_dp_id": ctx.get("target_dp_id"),
                    "source_snapshot": ctx.get("source_snapshot", {}),
                    "target_snapshot": ctx.get("target_snapshot", {}),
                    "candidate": ctx.get("candidate", {}),
                    "rule_row": ctx.get("rule_row", {}),
                    "validation_rules": ctx.get("validation_rules", []),
                    "source_datapoint_validation_rules": ctx.get("source_datapoint_validation_rules", []),
                    "target_datapoint_validation_rules": ctx.get("target_datapoint_validation_rules", []),
                    "paragraph_axis": ctx.get("paragraph_axis", {}),
                    "tentative_decision": ctx.get("tentative_decision"),
                }
            )

        system_prompt = (
            "You are a strict ESG mapping judge for unified-column mapping. "
            "For each item, judge semantic intent alignment first using description/topic/subtopic/name. "
            "Compare action, object, unit, frequency/time horizon, and disclosure intent. "
            "Use paragraph_axis and datapoint validation rule strings when present. "
            "If semantic intent differs, output reject and keep refinement_score low (<=0.35). "
            "If strongly aligned and rule evidence is consistent, output accept with high score. "
            "Return ONLY JSON object with key 'results'. "
            "'results' must be an array of objects with keys: "
            "idx (int), refinement_score (0~1 float), "
            "llm_decision (accept|review|reject), llm_reason_codes (string array), notes (short string)."
        )
        user_prompt = (
            "Batch-refine mapping confidence for cross-standard datapoint pairs. "
            "Use validation_rules explicitly and prioritize semantic intent alignment over lexical overlap.\n"
            f"Input:\n{json.dumps(payload_items, ensure_ascii=False)}"
        )
        try:
            client = OpenAI(api_key=api_key)
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            choice = resp.choices[0] if resp.choices else None
            raw_text = (choice.message.content or "").strip() if choice and choice.message else ""
            parsed = json.loads(raw_text)
            result_items = parsed.get("results", []) if isinstance(parsed, dict) else []
            by_idx: Dict[int, LLMRefinementResult] = {}
            if isinstance(result_items, list):
                for row in result_items:
                    if not isinstance(row, dict):
                        continue
                    try:
                        idx = int(row.get("idx"))
                    except Exception:
                        continue
                    if idx < 0 or idx >= len(contexts):
                        continue
                    score = float(row.get("refinement_score"))
                    score = max(0.0, min(1.0, score))
                    llm_decision = str(row.get("llm_decision") or "").strip().lower()
                    if llm_decision not in {"accept", "review", "reject"}:
                        llm_decision = ""
                    llm_reason_codes_raw = row.get("llm_reason_codes") or []
                    llm_reason_codes = (
                        [str(x).strip() for x in llm_reason_codes_raw if str(x).strip()]
                        if isinstance(llm_reason_codes_raw, list)
                        else []
                    )
                    by_idx[idx] = {
                        "status": "success",
                        "refinement_score": round(score, 4),
                        "notes": str(row.get("notes") or ""),
                        "llm_decision": llm_decision or None,
                        "llm_reason_codes": llm_reason_codes,
                        "llm_used": True,
                    }
            out: List[LLMRefinementResult] = []
            for i, ctx in enumerate(contexts):
                if i in by_idx:
                    out.append(by_idx[i])
                else:
                    out.append(self.llm_refinement({**ctx, "model": model}))
            return out
        except Exception as e:
            logger.warning("UCM llm_refinement_batch failed: {}", e)
            return [self.llm_refinement({**ctx, "model": model}) for ctx in contexts]

    def policy_pick_best(
        self,
        candidates: List[EmbeddingCandidateItem],
        per_rule: List[RuleCandidateResult],
    ) -> Optional[Tuple[EmbeddingCandidateItem, RuleCandidateResult]]:
        return ucm_policy.pick_best_candidate_pair(candidates, per_rule)

    def policy_finalize_decision(
        self,
        *,
        source_dp_id: str,
        candidate: EmbeddingCandidateItem,
        rule_row: RuleCandidateResult,
        llm_result: LLMRefinementResult | None,
        policy_version: str = "ucm_pipeline_v1",
    ) -> DecisionResult:
        return ucm_policy.decide_mapping_pair(
            source_dp_id=source_dp_id,
            candidate=candidate,
            rule_row=rule_row,
            llm_result=llm_result,
            policy_version=policy_version,
        )

    def create_mappings(
        self,
        source_standard: str,
        target_standard: str,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        batch_size: int = 40,
        dry_run: bool = False,
    ) -> UCMWorkflowCreateResult:
        """레거시 equivalent_dps 배치 매핑 — MCP 툴 `create_unified_column_mapping`과 동일 경로."""
        return self._tool_runtime.call_tool(
            "create_unified_column_mapping",
            {
                "source_standard": source_standard,
                "target_standard": target_standard,
                "vector_threshold": vector_threshold,
                "structural_threshold": structural_threshold,
                "final_threshold": final_threshold,
                "batch_size": batch_size,
                "dry_run": dry_run,
            },
        )

    async def acreate_mappings(
        self,
        source_standard: str,
        target_standard: str,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        batch_size: int = 40,
        dry_run: bool = False,
    ) -> UCMWorkflowCreateResult:
        """인프로세스 핸들러(`DirectEsgToolRuntime`)를 스레드에서 호출한다."""
        args = {
            "source_standard": source_standard,
            "target_standard": target_standard,
            "vector_threshold": vector_threshold,
            "structural_threshold": structural_threshold,
            "final_threshold": final_threshold,
            "batch_size": batch_size,
            "dry_run": dry_run,
        }
        return await asyncio.to_thread(
            lambda: self._tool_runtime.call_tool("create_unified_column_mapping", args),
        )

    def suggest_mappings(
        self,
        source_standard: str,
        target_standard: str,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        limit: int = 100,
    ) -> Dict[str, Any]:  # 배치 후보: 항목 스키마 가변
        """저장 없이 후보만."""
        return self.mapping_service.suggest_mappings(
            source_standard=source_standard,
            target_standard=target_standard,
            vector_threshold=vector_threshold,
            structural_threshold=structural_threshold,
            final_threshold=final_threshold,
            limit=limit,
        )
