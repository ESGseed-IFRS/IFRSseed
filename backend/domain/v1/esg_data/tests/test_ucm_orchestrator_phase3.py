from backend.domain.v1.esg_data.hub.orchestrator.ucm_orchestrator import UCMOrchestrator
from backend.domain.v1.esg_data.hub.routing.agent_router import AgentRouter


class _StubCreationAgent:
    def create_mappings(self, **_kwargs):
        return {"status": "success", "stats": {"processed": 1}}


def test_agent_router_routes_to_validation() -> None:
    router = AgentRouter()
    routed = router.route({"route": "validation_agent"})
    assert routed == "validation_agent"


def test_phase3_workflow_fallback_success() -> None:
    summarize_called = 0

    def summarize_fn(**_kwargs):
        nonlocal summarize_called
        summarize_called += 1
        return {"status": "success", "issues_count": 0, "issues": []}

    orchestrator = UCMOrchestrator(
        creation_agent=_StubCreationAgent(),  # type: ignore[arg-type]
        validate_step=lambda: {
            "status": "success",
            "metrics": {"missing_dp_references_in_ucm": 0},
        },
        summarize_workflow_quality=summarize_fn,  # type: ignore[arg-type]
    )
    result = orchestrator.run_ucm_workflow(
        source_standard="GRI",
        target_standard="ESRS",
        dry_run=True,
        run_quality_check=True,
    )

    assert result["status"] == "success"
    assert "create_result" in result
    assert "validation_result" in result
    assert "quality_result" in result
    assert "workflow" in result
    assert "langgraph" in result["workflow"]
    assert summarize_called == 0  # missing=0이면 품질 단계 자동 생략


def test_phase3_workflow_force_validate_only() -> None:
    summarize_called = 0

    def summarize_fn(**_kwargs):
        nonlocal summarize_called
        summarize_called += 1
        return {"status": "success", "issues_count": 0, "issues": []}

    orchestrator = UCMOrchestrator(
        creation_agent=_StubCreationAgent(),  # type: ignore[arg-type]
        validate_step=lambda: {
            "status": "success",
            "metrics": {"missing_dp_references_in_ucm": 0},
        },
        summarize_workflow_quality=summarize_fn,  # type: ignore[arg-type]
    )
    result = orchestrator.run_ucm_workflow(
        source_standard="GRI",
        target_standard="ESRS",
        force_validate_only=True,
    )
    assert result["workflow"]["routed_to"] == "validation_agent"
    assert result.get("create_result") is None
