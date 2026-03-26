"""ESG UCM MCP 툴 본문 — `esg_tools_server`와 인프로세스 `DirectEsgToolRuntime`이 공유한다."""

from __future__ import annotations

from typing import Any

from backend.domain.v1.esg_data.hub.services.ucm_mapping_service import UCMMappingService


def handle_create_unified_column_mapping(
    *,
    _mapping_service: UCMMappingService | None = None,
    source_standard: str,
    target_standard: str,
    vector_threshold: float = 0.70,
    structural_threshold: float = 0.50,
    final_threshold: float = 0.75,
    batch_size: int = 40,
    dry_run: bool = False,
) -> dict[str, Any]:
    svc = _mapping_service or UCMMappingService()
    return svc.create_mappings(
        source_standard=source_standard,
        target_standard=target_standard,
        vector_threshold=vector_threshold,
        structural_threshold=structural_threshold,
        final_threshold=final_threshold,
        batch_size=batch_size,
        dry_run=dry_run,
    )


def handle_validate_ucm_mappings(*, _mapping_service: UCMMappingService | None = None) -> dict[str, Any]:
    svc = _mapping_service or UCMMappingService()
    return svc.validate_mappings()


def handle_run_ucm_workflow(
    *,
    _mapping_service: UCMMappingService | None = None,
    source_standard: str,
    target_standard: str,
    vector_threshold: float = 0.70,
    structural_threshold: float = 0.50,
    final_threshold: float = 0.75,
    batch_size: int = 40,
    dry_run: bool = False,
    run_quality_check: bool = True,
    force_validate_only: bool = False,
) -> dict[str, Any]:
    from backend.domain.v1.esg_data.hub.orchestrator.ucm_orchestrator import UCMOrchestrator
    from backend.domain.v1.esg_data.spokes.agents.ucm_creation_agent import UCMCreationAgent
    from backend.domain.v1.esg_data.spokes.infra.esg_ucm_tool_runtime import DirectEsgToolRuntime

    ms = _mapping_service or UCMMappingService()
    repo = ms.repository
    rt = DirectEsgToolRuntime(mapping_service=ms)
    return UCMOrchestrator(
        creation_agent=UCMCreationAgent(mapping_service=ms, tool_runtime=rt),
        validation_tool_runtime=rt,
        mapping_service=ms,
        repository=repo,
    ).run_ucm_workflow(
        source_standard=source_standard,
        target_standard=target_standard,
        vector_threshold=vector_threshold,
        structural_threshold=structural_threshold,
        final_threshold=final_threshold,
        batch_size=batch_size,
        dry_run=dry_run,
        run_quality_check=run_quality_check,
        force_validate_only=force_validate_only,
    )


def handle_run_ucm_mapping_pipeline(
    *,
    source_standard: str,
    target_standard: str,
    batch_size: int = 40,
    dry_run: bool = True,
    top_k: int = 5,
    vector_threshold: float = 0.70,
    structural_threshold: float = 0.50,
    final_threshold: float = 0.75,
    use_llm_in_mapping_service: bool = False,
    llm_model: str = "gpt-5-mini",
) -> dict[str, Any]:
    from backend.domain.v1.esg_data.hub.orchestrator.ucm_orchestrator import UCMOrchestrator

    return UCMOrchestrator().run_ucm_policy_pipeline(
        source_standard=source_standard,
        target_standard=target_standard,
        batch_size=batch_size,
        dry_run=dry_run,
        top_k=top_k,
        vector_threshold=vector_threshold,
        structural_threshold=structural_threshold,
        final_threshold=final_threshold,
        use_llm_in_mapping_service=use_llm_in_mapping_service,
        llm_model=llm_model,
    )


def handle_run_ucm_nearest_pipeline(
    *,
    batch_size: int = 40,
    dry_run: bool = True,
    top_k: int = 5,
    vector_threshold: float = 0.70,
    structural_threshold: float = 0.50,
    final_threshold: float = 0.75,
    use_llm_in_mapping_service: bool = False,
    llm_model: str = "gpt-5-mini",
) -> dict[str, Any]:
    from backend.domain.v1.esg_data.hub.orchestrator.ucm_orchestrator import UCMOrchestrator

    return UCMOrchestrator().run_ucm_nearest_pipeline(
        batch_size=batch_size,
        dry_run=dry_run,
        top_k=top_k,
        vector_threshold=vector_threshold,
        structural_threshold=structural_threshold,
        final_threshold=final_threshold,
        use_llm_in_mapping_service=use_llm_in_mapping_service,
        llm_model=llm_model,
    )
