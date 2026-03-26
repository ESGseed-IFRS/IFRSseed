"""ESG 데이터 UCM 오케스트레이터(레거시 배치, 정책 파이프라인, LangGraph 워크플로)."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any, Dict, List, Literal

from loguru import logger

from backend.domain.v1.esg_data.spokes.agents.ucm_creation_agent import UCMCreationAgent
from backend.domain.v1.esg_data.spokes.agents import ucm_policy
from backend.domain.v1.esg_data.hub.repositories import UCMRepository
from backend.domain.v1.esg_data.hub.routing.agent_router import AgentRouter
from backend.domain.v1.esg_data.models.langgraph import UCMWorkflowState
from backend.domain.v1.esg_data.models.bases import DataPoint
from backend.domain.v1.esg_data.hub.services.ucm_mapping_service import UCMMappingService
from backend.domain.v1.esg_data.spokes.infra.esg_ucm_tool_runtime import DirectEsgToolRuntime
from backend.domain.v1.esg_data.spokes.infra.ucm_pipeline_contracts import (
    UCMQualityIssue,
    UCMWorkflowCreateResult,
    UCMWorkflowQualityResult,
    UCMWorkflowValidationResult,
)
from backend.domain.shared.tool.UnifiedColumnMapping import (
    EmbeddingCandidateTool,
    RuleValidationTool,
    SchemaMappingTool,
)
from backend.core.db import get_session

try:
    from langgraph.graph import END, StateGraph

    LANGGRAPH_AVAILABLE = True
except ImportError:
    END = None
    StateGraph = None
    LANGGRAPH_AVAILABLE = False


def _primary_rulebook_id_for_dp(db: Any, source_dp_id: str) -> str | None:
    from backend.domain.v1.esg_data.models.bases import Rulebook

    rb = (
        db.query(Rulebook)
        .filter(Rulebook.is_active.is_(True), Rulebook.primary_dp_id == source_dp_id)
        .first()
    )
    if rb and len(rb.rulebook_id) <= 50:
        return rb.rulebook_id
    return None


def _summarize_workflow_quality(
    *,
    create_result: UCMWorkflowCreateResult | None = None,
    validation_result: UCMWorkflowValidationResult | None = None,
) -> UCMWorkflowQualityResult:
    """생성·검증 결과 dict로부터 품질 이슈 요약(순수 후처리)."""
    issues: List[UCMQualityIssue] = []

    if create_result and create_result.get("status") == "error":
        issues.append(
            {"type": "create_error", "message": str(create_result.get("message", ""))}
        )
    if validation_result and validation_result.get("status") == "error":
        issues.append(
            {"type": "validation_error", "message": str(validation_result.get("message", ""))}
        )

    if validation_result and validation_result.get("status") == "success":
        metrics = validation_result.get("metrics", {})
        missing = int(metrics.get("missing_dp_references_in_ucm", 0) or 0)
        if missing > 0:
            issues.append(
                {
                    "type": "missing_dp_references",
                    "count": missing,
                    "message": "일부 UCM이 존재하지 않는 data_point를 참조합니다.",
                }
            )

    return {
        "status": "success",
        "issues_count": len(issues),
        "issues": issues,
    }


class UCMOrchestrator:
    """UCM 흐름을 조율한다: 레거시 equivalent_dps 배치, 정책 파이프라인, 3단계 워크플로."""

    def __init__(
        self,
        creation_agent: UCMCreationAgent | None = None,
        router: AgentRouter | None = None,
        mapping_service: UCMMappingService | None = None,
        repository: UCMRepository | None = None,
        *,
        validate_step: Callable[[], UCMWorkflowValidationResult] | None = None,
        avalidate_step: Callable[[], Awaitable[UCMWorkflowValidationResult]] | None = None,
        summarize_workflow_quality: Callable[..., UCMWorkflowQualityResult] | None = None,
        validation_tool_runtime: DirectEsgToolRuntime | None = None,
    ) -> None:
        self.repository = repository or UCMRepository()
        self.mapping_service = mapping_service or UCMMappingService(self.repository)
        self._validation_tool_runtime = validation_tool_runtime or DirectEsgToolRuntime(
            mapping_service=self.mapping_service,
        )
        self._validate_step_fn = validate_step
        self._avalidate_step_fn = avalidate_step
        self._summarize_quality_fn = summarize_workflow_quality
        self.creation_agent = creation_agent or UCMCreationAgent(self.mapping_service)
        self.router = router or AgentRouter()

    def run_validation_step(self) -> UCMWorkflowValidationResult:
        """MCP 툴 `validate_ucm_mappings`와 동일 계약(인프로세스 핸들러 직결)."""
        if self._validate_step_fn is not None:
            return self._validate_step_fn()
        return self._validation_tool_runtime.call_tool("validate_ucm_mappings", {})

    async def arun_validation_step(self) -> UCMWorkflowValidationResult:
        """인프로세스 `validate_ucm_mappings` 툴을 스레드에서 호출한다."""
        if self._avalidate_step_fn is not None:
            return await self._avalidate_step_fn()
        if self._validate_step_fn is not None:
            return await asyncio.to_thread(self._validate_step_fn)

        return await asyncio.to_thread(
            lambda: self._validation_tool_runtime.call_tool("validate_ucm_mappings", {}),
        )

    def _summarize_quality(
        self,
        *,
        create_result: UCMWorkflowCreateResult | None = None,
        validation_result: UCMWorkflowValidationResult | None = None,
    ) -> UCMWorkflowQualityResult:
        if self._summarize_quality_fn is not None:
            return self._summarize_quality_fn(
                create_result=create_result,
                validation_result=validation_result,
            )
        return _summarize_workflow_quality(
            create_result=create_result,
            validation_result=validation_result,
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
    ) -> Dict[str, Any]:
        """레거시 배치 매핑(equivalent_dps)을 실행한다."""
        return self.creation_agent.create_mappings(
            source_standard=source_standard,
            target_standard=target_standard,
            vector_threshold=vector_threshold,
            structural_threshold=structural_threshold,
            final_threshold=final_threshold,
            batch_size=batch_size,
            dry_run=dry_run,
        )

    def suggest_mappings(
        self,
        source_standard: str,
        target_standard: str,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """저장 없이 드라이런 형태로 매핑 후보만 제안한다."""
        return self.creation_agent.suggest_mappings(
            source_standard=source_standard,
            target_standard=target_standard,
            vector_threshold=vector_threshold,
            structural_threshold=structural_threshold,
            final_threshold=final_threshold,
            limit=limit,
        )

    def validate_mapping_health(self) -> Dict[str, Any]:
        """UCM과 data_points 간 정합성·헬스 지표를 반환한다."""
        return self.mapping_service.validate_mappings()

    def run_ucm_policy_pipeline(
        self,
        source_standard: str,
        target_standard: str,
        *,
        batch_size: int = 40,
        dry_run: bool = True,
        top_k: int = 5,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        use_llm_in_mapping_service: bool = False,
        llm_model: str = "gpt-5-mini",
        persist_mode: Literal["per_item", "batch_end"] = "per_item",
    ) -> Dict[str, Any]:
        """§2 파이프라인: 임베딩 → 규칙 검증 → (선택) LLM → 정책 → 페이로드 → upsert.

        persist_mode: ``per_item``은 건마다 upsert, ``batch_end``는 루프 종료 후 일괄 upsert.
        """
        embedding_tool = EmbeddingCandidateTool()
        rule_tool = RuleValidationTool()
        schema_tool = SchemaMappingTool()

        stats: Dict[str, int] = {
            "processed": 0,
            "accept": 0,
            "review": 0,
            "reject": 0,
            "upsert_ok": 0,
            "upsert_error": 0,
            "upsert_create": 0,
            "upsert_update": 0,
            "upsert_merge_update": 0,
            "errors": 0,
        }
        items: List[Dict[str, Any]] = []
        db = None
        try:
            db = get_session()
            source_rows = (
                db.query(DataPoint)
                .filter(
                    DataPoint.standard == source_standard,
                    DataPoint.is_active.is_(True),
                )
                .limit(batch_size)
                .all()
            )

            for source in source_rows:
                stats["processed"] += 1
                src_id = source.dp_id

                emb = embedding_tool.run(
                    db,
                    self.mapping_service,
                    source_dp_id=src_id,
                    target_standard=target_standard,
                    top_k=top_k,
                    vector_threshold=vector_threshold,
                    structural_threshold=structural_threshold,
                    final_threshold=final_threshold,
                )
                if emb["status"] != "success" or not emb["candidates"]:
                    stats["reject"] += 1
                    stats["errors"] += 1
                    items.append(
                        {
                            "source_dp_id": src_id,
                            "status": "error",
                            "message": emb.get("message", "no candidates"),
                        }
                    )
                    continue

                rv = rule_tool.run(
                    db,
                    self.mapping_service,
                    source_dp_id=src_id,
                    candidates=emb["candidates"],
                )
                if rv["status"] != "success" or not rv["per_candidate"]:
                    stats["reject"] += 1
                    stats["errors"] += 1
                    items.append(
                        {
                            "source_dp_id": src_id,
                            "status": "error",
                            "message": rv.get("message", "rule validation failed"),
                        }
                    )
                    continue

                best = self.creation_agent.policy_pick_best(emb["candidates"], rv["per_candidate"])
                if best is None:
                    decision = {"decision": "reject", "confidence": 0.0, "reason_codes": ["no_valid_pair"]}
                    stats["reject"] += 1
                    items.append({"source_dp_id": src_id, "decision": decision})
                    continue

                candidate, rule_row = best
                tentative = ucm_policy.tentative_decision_from_scores(
                    ucm_policy.compute_final_score(
                        float(candidate["hybrid_score"]),
                        float(rule_row["rule_score"]),
                        float(rule_row["structure_score"]),
                        float(rule_row["requirement_score"]),
                        ucm_policy.compute_penalty(rule_row["violations"]),
                    ),
                    any(v["severity"] == "critical" for v in rule_row["violations"]),
                )
                llm_result = None
                if use_llm_in_mapping_service and ucm_policy.should_call_llm(
                    float(candidate["hybrid_score"]),
                    bool(rule_row["rule_pass"]),
                    tentative,
                ):
                    rule_evidence = rule_row.get("rule_evidence", {})
                    validation_rules = (
                        rule_evidence.get("validation_rules", []) if isinstance(rule_evidence, dict) else []
                    )
                    llm_result = self.creation_agent.llm_refinement(
                        {
                            "source_dp_id": src_id,
                            "target_dp_id": candidate["target_dp_id"],
                            "candidate": candidate,
                            "rule_row": rule_row,
                            "validation_rules": validation_rules,
                            "tentative_decision": tentative,
                            "model": llm_model,
                        }
                    )

                decision = self.creation_agent.policy_finalize_decision(
                    source_dp_id=src_id,
                    candidate=candidate,
                    rule_row=rule_row,
                    llm_result=llm_result,
                    policy_version="ucm_pipeline_v1",
                )
                decision_label = decision["decision"]
                stats[decision_label] += 1

                target = (
                    db.query(DataPoint)
                    .filter(
                        DataPoint.dp_id == candidate["target_dp_id"],
                        DataPoint.is_active.is_(True),
                    )
                    .first()
                )
                if target is None:
                    stats["errors"] += 1
                    items.append(
                        {
                            "source_dp_id": src_id,
                            "decision": decision,
                            "status": "error",
                            "message": "target dp not found",
                        }
                    )
                    continue

                payload_result = schema_tool.build_payload(
                    source_dp=source,
                    target_dp=target,
                    decision=decision,
                    primary_rulebook_id=_primary_rulebook_id_for_dp(db, src_id),
                )

                upsert_result: Dict[str, Any] | None = None
                batch_payload: Dict[str, Any] | None = None
                if payload_result["status"] == "success":
                    if dry_run:
                        upsert_result = {"status": "skipped", "message": "dry_run"}
                    elif persist_mode == "per_item":
                        upsert_result = self.mapping_service.upsert_ucm_from_payload(payload_result["payload"])
                        if upsert_result.get("status") == "success":
                            stats["upsert_ok"] += 1
                            mode = str(upsert_result.get("mode") or "")
                            if mode == "create":
                                stats["upsert_create"] += 1
                            elif mode == "update":
                                stats["upsert_update"] += 1
                            elif mode == "merge_update":
                                stats["upsert_merge_update"] += 1
                        else:
                            stats["upsert_error"] += 1
                            stats["errors"] += 1
                    else:
                        batch_payload = payload_result["payload"]
                        upsert_result = {"status": "pending", "message": "batch_end"}
                else:
                    stats["errors"] += 1

                row: Dict[str, Any] = {
                    "source_dp_id": src_id,
                    "target_dp_id": candidate["target_dp_id"],
                    "decision": decision,
                    "llm_model": llm_model if llm_result else None,
                    "llm_result": llm_result,
                    "payload_result": payload_result,
                    "upsert_result": upsert_result,
                }
                if batch_payload is not None:
                    row["_batch_payload"] = batch_payload
                items.append(row)

            if persist_mode == "batch_end" and not dry_run:
                for it in items:
                    pl = it.pop("_batch_payload", None)
                    if pl is None:
                        continue
                    upsert_result = self.mapping_service.upsert_ucm_from_payload(pl)
                    it["upsert_result"] = upsert_result
                    if upsert_result.get("status") == "success":
                        stats["upsert_ok"] += 1
                        mode = str(upsert_result.get("mode") or "")
                        if mode == "create":
                            stats["upsert_create"] += 1
                        elif mode == "update":
                            stats["upsert_update"] += 1
                        elif mode == "merge_update":
                            stats["upsert_merge_update"] += 1
                    else:
                        stats["upsert_error"] += 1
                        stats["errors"] += 1

            return {
                "status": "success",
                "pipeline": "ucm_policy_v1",
                "dry_run": dry_run,
                "persist_mode": persist_mode,
                "source_standard": source_standard,
                "target_standard": target_standard,
                "stats": stats,
                "items": items,
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "pipeline": "ucm_policy_v1",
                "dry_run": dry_run,
                "persist_mode": persist_mode,
                "source_standard": source_standard,
                "target_standard": target_standard,
                "stats": stats,
                "items": items,
            }
        finally:
            if db is not None:
                db.close()

    def run_ucm_nearest_pipeline(
        self,
        *,
        batch_size: int = 40,
        dry_run: bool = True,
        top_k: int = 5,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        use_llm_in_mapping_service: bool = False,
        llm_model: str = "gpt-5-mini",
        persist_mode: Literal["per_item", "batch_end"] = "per_item",
    ) -> Dict[str, Any]:
        """기준서 입력 없이: 각 DP에 대해 다른 기준서 DP 최근접 후보로 §2 파이프라인 수행."""
        embedding_tool = EmbeddingCandidateTool()
        rule_tool = RuleValidationTool()
        schema_tool = SchemaMappingTool()

        stats: Dict[str, int] = {
            "processed": 0,
            "accept": 0,
            "review": 0,
            "reject": 0,
            "upsert_ok": 0,
            "upsert_error": 0,
            "upsert_create": 0,
            "upsert_update": 0,
            "upsert_merge_update": 0,
            "errors": 0,
        }
        items: List[Dict[str, Any]] = []
        db = None
        try:
            db = get_session()
            sources = db.query(DataPoint).filter(DataPoint.is_active.is_(True)).limit(batch_size).all()
            for source in sources:
                stats["processed"] += 1
                src_id = source.dp_id

                emb = embedding_tool.run(
                    db,
                    self.mapping_service,
                    source_dp_id=src_id,
                    target_standard=None,
                    top_k=top_k,
                    vector_threshold=vector_threshold,
                    structural_threshold=structural_threshold,
                    final_threshold=final_threshold,
                )
                if emb["status"] != "success" or not emb["candidates"]:
                    stats["reject"] += 1
                    stats["errors"] += 1
                    items.append({"source_dp_id": src_id, "status": "error", "message": "no candidates"})
                    continue

                rv = rule_tool.run(
                    db,
                    self.mapping_service,
                    source_dp_id=src_id,
                    candidates=emb["candidates"],
                )
                if rv["status"] != "success" or not rv["per_candidate"]:
                    stats["reject"] += 1
                    stats["errors"] += 1
                    items.append({"source_dp_id": src_id, "status": "error", "message": rv.get("message")})
                    continue

                best = self.creation_agent.policy_pick_best(emb["candidates"], rv["per_candidate"])
                if best is None:
                    stats["reject"] += 1
                    items.append({"source_dp_id": src_id, "status": "error", "message": "no valid pair"})
                    continue

                candidate, rule_row = best
                tentative = ucm_policy.tentative_decision_from_scores(
                    ucm_policy.compute_final_score(
                        float(candidate["hybrid_score"]),
                        float(rule_row["rule_score"]),
                        float(rule_row["structure_score"]),
                        float(rule_row["requirement_score"]),
                        ucm_policy.compute_penalty(rule_row["violations"]),
                    ),
                    any(v["severity"] == "critical" for v in rule_row["violations"]),
                )
                llm_result = None
                if use_llm_in_mapping_service and ucm_policy.should_call_llm(
                    float(candidate["hybrid_score"]),
                    bool(rule_row["rule_pass"]),
                    tentative,
                ):
                    rule_evidence = rule_row.get("rule_evidence", {})
                    validation_rules = (
                        rule_evidence.get("validation_rules", []) if isinstance(rule_evidence, dict) else []
                    )
                    llm_result = self.creation_agent.llm_refinement(
                        {
                            "source_dp_id": src_id,
                            "target_dp_id": candidate["target_dp_id"],
                            "candidate": candidate,
                            "rule_row": rule_row,
                            "validation_rules": validation_rules,
                            "tentative_decision": tentative,
                            "model": llm_model,
                        }
                    )

                decision = self.creation_agent.policy_finalize_decision(
                    source_dp_id=src_id,
                    candidate=candidate,
                    rule_row=rule_row,
                    llm_result=llm_result,
                    policy_version="ucm_pipeline_v1",
                )
                stats[decision["decision"]] += 1

                target = (
                    db.query(DataPoint)
                    .filter(DataPoint.dp_id == candidate["target_dp_id"], DataPoint.is_active.is_(True))
                    .first()
                )
                if not target:
                    stats["errors"] += 1
                    items.append({"source_dp_id": src_id, "status": "error", "message": "target dp not found"})
                    continue

                payload_result = schema_tool.build_payload(
                    source_dp=source,
                    target_dp=target,
                    decision=decision,
                    primary_rulebook_id=_primary_rulebook_id_for_dp(db, src_id),
                )
                upsert_result: Dict[str, Any] | None = None
                batch_payload: Dict[str, Any] | None = None
                if payload_result["status"] == "success":
                    if dry_run:
                        upsert_result = {"status": "skipped", "message": "dry_run"}
                    elif persist_mode == "per_item":
                        upsert_result = self.mapping_service.upsert_ucm_from_payload(payload_result["payload"])
                        if upsert_result.get("status") == "success":
                            stats["upsert_ok"] += 1
                            mode = str(upsert_result.get("mode") or "")
                            if mode == "create":
                                stats["upsert_create"] += 1
                            elif mode == "update":
                                stats["upsert_update"] += 1
                            elif mode == "merge_update":
                                stats["upsert_merge_update"] += 1
                        else:
                            stats["upsert_error"] += 1
                            stats["errors"] += 1
                    else:
                        batch_payload = payload_result["payload"]
                        upsert_result = {"status": "pending", "message": "batch_end"}
                else:
                    stats["errors"] += 1

                row_n: Dict[str, Any] = {
                    "source_dp_id": src_id,
                    "target_dp_id": candidate["target_dp_id"],
                    "source_standard": source.standard,
                    "target_standard": target.standard,
                    "decision": decision,
                    "llm_model": llm_model if llm_result else None,
                    "llm_result": llm_result,
                    "payload_result": payload_result,
                    "upsert_result": upsert_result,
                }
                if batch_payload is not None:
                    row_n["_batch_payload"] = batch_payload
                items.append(row_n)

            if persist_mode == "batch_end" and not dry_run:
                for it in items:
                    pl = it.pop("_batch_payload", None)
                    if pl is None:
                        continue
                    upsert_result = self.mapping_service.upsert_ucm_from_payload(pl)
                    it["upsert_result"] = upsert_result
                    if upsert_result.get("status") == "success":
                        stats["upsert_ok"] += 1
                        mode = str(upsert_result.get("mode") or "")
                        if mode == "create":
                            stats["upsert_create"] += 1
                        elif mode == "update":
                            stats["upsert_update"] += 1
                        elif mode == "merge_update":
                            stats["upsert_merge_update"] += 1
                    else:
                        stats["upsert_error"] += 1
                        stats["errors"] += 1

            return {
                "status": "success",
                "pipeline": "ucm_nearest_v1",
                "dry_run": dry_run,
                "persist_mode": persist_mode,
                "stats": stats,
                "items": items,
            }
        except Exception as e:
            return {
                "status": "error",
                "pipeline": "ucm_nearest_v1",
                "message": str(e),
                "persist_mode": persist_mode,
                "stats": stats,
                "items": items,
            }
        finally:
            if db is not None:
                db.close()

    # ---------- 3단계 워크플로 ----------
    def run_ucm_workflow(
        self,
        source_standard: str,
        target_standard: str,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        batch_size: int = 40,
        dry_run: bool = False,
        run_quality_check: bool = True,
        force_validate_only: bool = False,
    ) -> Dict[str, Any]:
        """3단계 워크플로: 레거시 생성 → 검증 → (조건부) 품질 요약."""
        initial: UCMWorkflowState = {
            "source_standard": source_standard,
            "target_standard": target_standard,
            "vector_threshold": vector_threshold,
            "structural_threshold": structural_threshold,
            "final_threshold": final_threshold,
            "batch_size": batch_size,
            "dry_run": dry_run,
            "run_quality_check": run_quality_check,
            "force_validate_only": force_validate_only,
            "route": "creation_agent",
            "issues": [],
            "success": False,
            "message": "",
        }
        if LANGGRAPH_AVAILABLE:
            return self._run_workflow_with_langgraph(initial)
        return self._run_workflow_fallback(initial)

    def _run_workflow_fallback(self, state: UCMWorkflowState) -> Dict[str, Any]:
        """LangGraph 미설치 시 순차 실행용 폴백 워크플로."""
        routed = self.router.route(state)
        if routed == "creation_agent":
            state["create_result"] = self.creation_agent.create_mappings(
                source_standard=state["source_standard"],
                target_standard=state["target_standard"],
                vector_threshold=state["vector_threshold"],
                structural_threshold=state["structural_threshold"],
                final_threshold=state["final_threshold"],
                batch_size=state["batch_size"],
                dry_run=state["dry_run"],
            )
            state["route"] = "validation_agent"

        state["validation_result"] = self.run_validation_step()
        if self._should_run_quality(state):
            state["quality_result"] = self._summarize_quality(
                create_result=state.get("create_result"),
                validation_result=state.get("validation_result"),
            )
            state["issues"] = state["quality_result"].get("issues", [])
        state["success"] = (
            state.get("create_result", {}).get("status") == "success"
            and state.get("validation_result", {}).get("status") == "success"
        )
        state["message"] = "completed" if state["success"] else "completed_with_issues"
        return {
            "status": "success" if state["success"] else "partial",
            "workflow": {
                "langgraph": False,
                "routed_to": routed,
            },
            "create_result": state.get("create_result"),
            "validation_result": state.get("validation_result"),
            "quality_result": state.get("quality_result"),
            "issues": state.get("issues", []),
            "message": state.get("message", ""),
        }

    def _should_run_quality(self, state: UCMWorkflowState) -> bool:
        if not state.get("run_quality_check", True):
            return False
        vr = state.get("validation_result", {})
        if vr.get("status") != "success":
            return True
        metrics = vr.get("metrics", {}) if isinstance(vr, dict) else {}
        missing = int(metrics.get("missing_dp_references_in_ucm", 0) or 0)
        # 검증 실패이거나 UCM에 누락된 DP 참조가 있으면 품질 단계 실행
        return missing > 0

    def _run_workflow_with_langgraph(self, initial: UCMWorkflowState) -> Dict[str, Any]:
        """LangGraph StateGraph로 그래프를 실행한다."""

        def route_node(state: UCMWorkflowState) -> Dict[str, Any]:
            return {"route": self.router.route(state)}

        def create_node(state: UCMWorkflowState) -> Dict[str, Any]:
            result = self.creation_agent.create_mappings(
                source_standard=state["source_standard"],
                target_standard=state["target_standard"],
                vector_threshold=state["vector_threshold"],
                structural_threshold=state["structural_threshold"],
                final_threshold=state["final_threshold"],
                batch_size=state["batch_size"],
                dry_run=state["dry_run"],
            )
            return {"create_result": result}

        def validate_node(_state: UCMWorkflowState) -> Dict[str, Any]:
            return {"validation_result": self.run_validation_step()}

        def quality_node(state: UCMWorkflowState) -> Dict[str, Any]:
            result = self._summarize_quality(
                create_result=state.get("create_result"),
                validation_result=state.get("validation_result"),
            )
            return {"quality_result": result, "issues": result.get("issues", [])}

        def final_node(state: UCMWorkflowState) -> Dict[str, Any]:
            success = (
                state.get("create_result", {}).get("status") == "success"
                and state.get("validation_result", {}).get("status") == "success"
            )
            msg = "completed" if success else "completed_with_issues"
            return {"success": success, "message": msg}

        def route_decision(state: UCMWorkflowState) -> str:
            return state.get("route", "creation_agent")

        def quality_decision(state: UCMWorkflowState) -> str:
            return "quality" if self._should_run_quality(state) else "finalize"

        workflow = StateGraph(UCMWorkflowState)
        workflow.add_node("route", route_node)
        workflow.add_node("create", create_node)
        workflow.add_node("validate", validate_node)
        workflow.add_node("quality", quality_node)
        workflow.add_node("finalize", final_node)
        workflow.set_entry_point("route")
        workflow.add_conditional_edges(
            "route",
            route_decision,
            {"creation_agent": "create", "validation_agent": "validate"},
        )
        workflow.add_edge("create", "validate")
        workflow.add_conditional_edges(
            "validate",
            quality_decision,
            {"quality": "quality", "finalize": "finalize"},
        )
        workflow.add_edge("quality", "finalize")
        workflow.add_edge("finalize", END)
        app = workflow.compile()
        result = app.invoke(initial)
        return self._format_langgraph_workflow_result(result)

    def _format_langgraph_workflow_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "status": "success" if result.get("success") else "partial",
            "workflow": {
                "langgraph": True,
                "routed_to": result.get("route"),
            },
            "create_result": result.get("create_result"),
            "validation_result": result.get("validation_result"),
            "quality_result": result.get("quality_result"),
            "issues": result.get("issues", []),
            "message": result.get("message", ""),
        }

    async def _run_workflow_with_langgraph_async(self, initial: UCMWorkflowState) -> Dict[str, Any]:
        """LangGraph `ainvoke` + 비동기 노드(create/validate/MCP 비동기 경로)."""

        def route_node(state: UCMWorkflowState) -> Dict[str, Any]:
            return {"route": self.router.route(state)}

        async def create_node(state: UCMWorkflowState) -> Dict[str, Any]:
            ca = self.creation_agent
            if hasattr(ca, "acreate_mappings"):
                result = await ca.acreate_mappings(
                    source_standard=state["source_standard"],
                    target_standard=state["target_standard"],
                    vector_threshold=state["vector_threshold"],
                    structural_threshold=state["structural_threshold"],
                    final_threshold=state["final_threshold"],
                    batch_size=state["batch_size"],
                    dry_run=state["dry_run"],
                )
            else:
                result = await asyncio.to_thread(
                    lambda: ca.create_mappings(
                        source_standard=state["source_standard"],
                        target_standard=state["target_standard"],
                        vector_threshold=state["vector_threshold"],
                        structural_threshold=state["structural_threshold"],
                        final_threshold=state["final_threshold"],
                        batch_size=state["batch_size"],
                        dry_run=state["dry_run"],
                    ),
                )
            return {"create_result": result}

        async def validate_node(_state: UCMWorkflowState) -> Dict[str, Any]:
            vr = await self.arun_validation_step()
            return {"validation_result": vr}

        async def quality_node(state: UCMWorkflowState) -> Dict[str, Any]:
            result = await asyncio.to_thread(
                lambda: self._summarize_quality(
                    create_result=state.get("create_result"),
                    validation_result=state.get("validation_result"),
                ),
            )
            return {"quality_result": result, "issues": result.get("issues", [])}

        def final_node(state: UCMWorkflowState) -> Dict[str, Any]:
            success = (
                state.get("create_result", {}).get("status") == "success"
                and state.get("validation_result", {}).get("status") == "success"
            )
            msg = "completed" if success else "completed_with_issues"
            return {"success": success, "message": msg}

        def route_decision(state: UCMWorkflowState) -> str:
            return state.get("route", "creation_agent")

        def quality_decision(state: UCMWorkflowState) -> str:
            return "quality" if self._should_run_quality(state) else "finalize"

        workflow = StateGraph(UCMWorkflowState)
        workflow.add_node("route", route_node)
        workflow.add_node("create", create_node)
        workflow.add_node("validate", validate_node)
        workflow.add_node("quality", quality_node)
        workflow.add_node("finalize", final_node)
        workflow.set_entry_point("route")
        workflow.add_conditional_edges(
            "route",
            route_decision,
            {"creation_agent": "create", "validation_agent": "validate"},
        )
        workflow.add_edge("create", "validate")
        workflow.add_conditional_edges(
            "validate",
            quality_decision,
            {"quality": "quality", "finalize": "finalize"},
        )
        workflow.add_edge("quality", "finalize")
        workflow.add_edge("finalize", END)
        app = workflow.compile()
        result = await app.ainvoke(initial)
        return self._format_langgraph_workflow_result(result)

    async def create_mappings_async(
        self,
        source_standard: str,
        target_standard: str,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        batch_size: int = 40,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        return await self.creation_agent.acreate_mappings(
            source_standard=source_standard,
            target_standard=target_standard,
            vector_threshold=vector_threshold,
            structural_threshold=structural_threshold,
            final_threshold=final_threshold,
            batch_size=batch_size,
            dry_run=dry_run,
        )

    async def suggest_mappings_async(
        self,
        source_standard: str,
        target_standard: str,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        limit: int = 100,
    ) -> Dict[str, Any]:
        return await asyncio.to_thread(
            lambda: self.suggest_mappings(
                source_standard=source_standard,
                target_standard=target_standard,
                vector_threshold=vector_threshold,
                structural_threshold=structural_threshold,
                final_threshold=final_threshold,
                limit=limit,
            ),
        )

    async def validate_mapping_health_async(self) -> Dict[str, Any]:
        return await asyncio.to_thread(self.validate_mapping_health)

    async def run_ucm_policy_pipeline_async(
        self,
        source_standard: str,
        target_standard: str,
        *,
        batch_size: int = 40,
        dry_run: bool = True,
        top_k: int = 5,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        use_llm_in_mapping_service: bool = False,
        llm_model: str = "gpt-5-mini",
        persist_mode: Literal["per_item", "batch_end"] = "per_item",
    ) -> Dict[str, Any]:
        return await asyncio.to_thread(
            lambda: self.run_ucm_policy_pipeline(
                source_standard,
                target_standard,
                batch_size=batch_size,
                dry_run=dry_run,
                top_k=top_k,
                vector_threshold=vector_threshold,
                structural_threshold=structural_threshold,
                final_threshold=final_threshold,
                use_llm_in_mapping_service=use_llm_in_mapping_service,
                llm_model=llm_model,
                persist_mode=persist_mode,
            ),
        )

    async def run_ucm_nearest_pipeline_async(
        self,
        *,
        batch_size: int = 40,
        dry_run: bool = True,
        top_k: int = 5,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        use_llm_in_mapping_service: bool = False,
        llm_model: str = "gpt-5-mini",
        persist_mode: Literal["per_item", "batch_end"] = "per_item",
    ) -> Dict[str, Any]:
        return await asyncio.to_thread(
            lambda: self.run_ucm_nearest_pipeline(
                batch_size=batch_size,
                dry_run=dry_run,
                top_k=top_k,
                vector_threshold=vector_threshold,
                structural_threshold=structural_threshold,
                final_threshold=final_threshold,
                use_llm_in_mapping_service=use_llm_in_mapping_service,
                llm_model=llm_model,
                persist_mode=persist_mode,
            ),
        )

    async def _run_workflow_fallback_async(self, state: UCMWorkflowState) -> Dict[str, Any]:
        routed = self.router.route(state)
        if routed == "creation_agent":
            ca = self.creation_agent
            if hasattr(ca, "acreate_mappings"):
                state["create_result"] = await ca.acreate_mappings(
                    source_standard=state["source_standard"],
                    target_standard=state["target_standard"],
                    vector_threshold=state["vector_threshold"],
                    structural_threshold=state["structural_threshold"],
                    final_threshold=state["final_threshold"],
                    batch_size=state["batch_size"],
                    dry_run=state["dry_run"],
                )
            else:
                state["create_result"] = await asyncio.to_thread(
                    lambda: ca.create_mappings(
                        source_standard=state["source_standard"],
                        target_standard=state["target_standard"],
                        vector_threshold=state["vector_threshold"],
                        structural_threshold=state["structural_threshold"],
                        final_threshold=state["final_threshold"],
                        batch_size=state["batch_size"],
                        dry_run=state["dry_run"],
                    ),
                )
            state["route"] = "validation_agent"

        state["validation_result"] = await self.arun_validation_step()

        if self._should_run_quality(state):
            state["quality_result"] = await asyncio.to_thread(
                lambda: self._summarize_quality(
                    create_result=state.get("create_result"),
                    validation_result=state.get("validation_result"),
                ),
            )
            state["issues"] = state["quality_result"].get("issues", [])
        state["success"] = (
            state.get("create_result", {}).get("status") == "success"
            and state.get("validation_result", {}).get("status") == "success"
        )
        state["message"] = "completed" if state["success"] else "completed_with_issues"
        return {
            "status": "success" if state["success"] else "partial",
            "workflow": {
                "langgraph": False,
                "routed_to": routed,
            },
            "create_result": state.get("create_result"),
            "validation_result": state.get("validation_result"),
            "quality_result": state.get("quality_result"),
            "issues": state.get("issues", []),
            "message": state.get("message", ""),
        }

    async def run_ucm_workflow_async(
        self,
        source_standard: str,
        target_standard: str,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        batch_size: int = 40,
        dry_run: bool = False,
        run_quality_check: bool = True,
        force_validate_only: bool = False,
    ) -> Dict[str, Any]:
        initial: UCMWorkflowState = {
            "source_standard": source_standard,
            "target_standard": target_standard,
            "vector_threshold": vector_threshold,
            "structural_threshold": structural_threshold,
            "final_threshold": final_threshold,
            "batch_size": batch_size,
            "dry_run": dry_run,
            "run_quality_check": run_quality_check,
            "force_validate_only": force_validate_only,
            "route": "creation_agent",
            "issues": [],
            "success": False,
            "message": "",
        }
        if LANGGRAPH_AVAILABLE:
            try:
                return await self._run_workflow_with_langgraph_async(initial)
            except AttributeError:
                logger.debug("LangGraph ainvoke 미지원, 동기 invoke 스레드 폴백")
            except Exception as e:
                logger.warning("LangGraph 비동기 워크플로 실패, 동기 invoke 스레드 폴백: {}", e)
            return await asyncio.to_thread(self._run_workflow_with_langgraph, initial)
        return await self._run_workflow_fallback_async(initial)


