"""ESG 데이터 도구용 MCP 서버 — stdio(기본)로 IDE/클라이언트에서 subprocess 실행."""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from backend.domain.v1.esg_data.spokes.infra.esg_ucm_tool_handlers import (
    handle_create_unified_column_mapping,
    handle_run_ucm_mapping_pipeline,
    handle_run_ucm_nearest_pipeline,
    handle_run_ucm_workflow,
    handle_validate_ucm_mappings,
)

mcp = FastMCP("esg-data-tools")


@mcp.tool()
async def create_unified_column_mapping(
    source_standard: str,
    target_standard: str,
    vector_threshold: float = 0.70,
    structural_threshold: float = 0.50,
    final_threshold: float = 0.75,
    batch_size: int = 40,
    dry_run: bool = False,
) -> dict:
    """데이터 포인트를 기반으로 통합 컬럼 매핑 레코드를 생성한다."""
    return handle_create_unified_column_mapping(
        source_standard=source_standard,
        target_standard=target_standard,
        vector_threshold=vector_threshold,
        structural_threshold=structural_threshold,
        final_threshold=final_threshold,
        batch_size=batch_size,
        dry_run=dry_run,
    )


@mcp.tool()
async def validate_ucm_mappings() -> dict:
    """통합 컬럼 매핑 정합성을 검증한다."""
    return handle_validate_ucm_mappings()


@mcp.tool()
async def run_ucm_workflow(
    source_standard: str,
    target_standard: str,
    vector_threshold: float = 0.70,
    structural_threshold: float = 0.50,
    final_threshold: float = 0.75,
    batch_size: int = 40,
    dry_run: bool = False,
    run_quality_check: bool = True,
    force_validate_only: bool = False,
) -> dict:
    """3단계 UCM 워크플로(생성→검증→품질 요약)를 실행한다."""
    return handle_run_ucm_workflow(
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


@mcp.tool()
async def run_ucm_mapping_pipeline(
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
) -> dict:
    """2단계 파이프라인(임베딩→규칙→LLM→정책→payload→upsert) 실행."""
    return handle_run_ucm_mapping_pipeline(
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


@mcp.tool()
async def run_ucm_nearest_pipeline(
    batch_size: int = 40,
    dry_run: bool = True,
    top_k: int = 5,
    vector_threshold: float = 0.70,
    structural_threshold: float = 0.50,
    final_threshold: float = 0.75,
    use_llm_in_mapping_service: bool = False,
    llm_model: str = "gpt-5-mini",
) -> dict:
    """기준서 입력 없이: 다른 기준서만 최근접 후보로 2단계 파이프라인 수행."""
    return handle_run_ucm_nearest_pipeline(
        batch_size=batch_size,
        dry_run=dry_run,
        top_k=top_k,
        vector_threshold=vector_threshold,
        structural_threshold=structural_threshold,
        final_threshold=final_threshold,
        use_llm_in_mapping_service=use_llm_in_mapping_service,
        llm_model=llm_model,
    )


if __name__ == "__main__":
    mcp.run()
