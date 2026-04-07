"""
에이전트·툴 등록 및 초기화

전역 InfraLayer 인스턴스 생성 및 에이전트·툴 레지스트리 초기화
"""
import logging
from typing import Dict, Any

from backend.core.config.settings import get_settings
from backend.domain.v1.ifrs_agent.spokes.infra import InfraLayer
from backend.domain.v1.ifrs_agent.spokes.agents.c_rag import make_c_rag_handler
from backend.domain.v1.ifrs_agent.spokes.agents.dp_rag import make_dp_rag_handler
from backend.domain.v1.ifrs_agent.spokes.agents.aggregation_node import make_aggregation_node_handler
from backend.domain.v1.ifrs_agent.spokes.agents.gen_node import make_gen_node_handler
from backend.domain.v1.ifrs_agent.spokes.agents.validator_node import make_validator_node_handler

logger = logging.getLogger("ifrs_agent.bootstrap")


def create_infra_layer() -> InfraLayer:
    """
    InfraLayer 인스턴스 생성 및 에이전트·툴 등록
    
    Returns:
        InfraLayer: 초기화된 인프라 레이어
    """
    s = get_settings()
    infra = InfraLayer(
        default_timeout=s.ifrs_infra_timeout_sec,
        max_retries=s.max_retries,
    )

    # 툴 먼저 등록 (에이전트가 즉시 call_tool 할 수 있음)
    register_tools(infra)
    register_agents(infra)
    
    logger.info("InfraLayer initialized successfully")
    
    return infra


def register_agents(infra: InfraLayer) -> None:
    """
    모든 에이전트를 레지스트리에 등록
    
    Args:
        infra: InfraLayer 인스턴스
    """
    # C_RAG 에이전트 등록 (툴 레지스트리가 붙은 동일 InfraLayer 주입)
    infra.agent_registry.register("c_rag", make_c_rag_handler(infra))
    
    # DP_RAG 에이전트 등록
    infra.agent_registry.register("dp_rag", make_dp_rag_handler(infra))
    
    # AGGREGATION_NODE 에이전트 등록
    infra.agent_registry.register("aggregation_node", make_aggregation_node_handler(infra))

    # Gen Node (실제 구현)
    infra.agent_registry.register("gen_node", make_gen_node_handler(infra))
    
    # Validator Node (규칙 + 선택 Gemini)
    infra.agent_registry.register("validator_node", make_validator_node_handler(infra))
    
    logger.info(f"Agents registered: {infra.agent_registry.list_agents()}")


def register_tools(infra: InfraLayer) -> None:
    """
    모든 툴을 레지스트리에 등록
    
    Args:
        infra: InfraLayer 인스턴스
    """
    from backend.domain.shared.tool.ifrs_agent.database.sr_body_query import (
        query_sr_body_exact,
        query_sr_body_vector
    )
    from backend.domain.shared.tool.ifrs_agent.database.sr_images_query import query_sr_images
    from backend.domain.shared.tool.ifrs_agent.database.embedding_tool import embed_text
    from backend.domain.shared.tool.ifrs_agent.database.dp_query import (
        query_dp_data,
        query_dp_metadata,
        query_ucm_by_dp,
        query_ucm_direct,
        query_rulebook,
        query_rulebook_by_primary_dp_id,
        query_unmapped_dp,
        query_dp_real_data,
        query_company_info,
    )
    from backend.domain.shared.tool.ifrs_agent.database.aggregation_query import (
        query_subsidiary_data,
        query_external_company_data,
        query_external_by_prompt,
    )
    from backend.domain.shared.tool.ifrs_agent.database.aggregation_relevance import (
        query_subsidiary_data_relevant,
        query_external_data_relevant,
    )
    from backend.domain.shared.tool.ifrs_agent.database.sr_body_context_query import (
        query_sr_body_by_context,
        query_sr_body_by_page,
    )
    
    # SR 본문 검색 툴
    infra.tool_registry.register("query_sr_body_exact", query_sr_body_exact)
    infra.tool_registry.register("query_sr_body_vector", query_sr_body_vector)
    infra.tool_registry.register("query_sr_body_by_context", query_sr_body_by_context)
    infra.tool_registry.register("query_sr_body_by_page", query_sr_body_by_page)
    
    # SR 이미지 검색 툴
    infra.tool_registry.register("query_sr_images", query_sr_images)
    
    # 임베딩 툴
    infra.tool_registry.register("embed_text", embed_text)
    
    # DP 관련 툴
    infra.tool_registry.register("query_dp_data", query_dp_data)  # deprecated
    infra.tool_registry.register("query_dp_metadata", query_dp_metadata)
    infra.tool_registry.register("query_ucm_by_dp", query_ucm_by_dp)
    infra.tool_registry.register("query_ucm_direct", query_ucm_direct)  # UCM ID로 직접 조회
    infra.tool_registry.register("query_rulebook", query_rulebook)
    infra.tool_registry.register(
        "query_rulebook_by_primary_dp_id", query_rulebook_by_primary_dp_id
    )
    infra.tool_registry.register("query_unmapped_dp", query_unmapped_dp)
    infra.tool_registry.register("query_dp_real_data", query_dp_real_data)
    infra.tool_registry.register("query_company_info", query_company_info)

    # 계열사·외부 기업 툴 (레거시)
    infra.tool_registry.register("query_subsidiary_data", query_subsidiary_data)
    infra.tool_registry.register("query_external_company_data", query_external_company_data)
    
    # 계열사·외부 기업 툴 (프롬프트 기반 - 신규)
    infra.tool_registry.register("query_external_by_prompt", query_external_by_prompt)
    
    # 계열사·외부 기업 툴 (관련성 기반 - 사용 안 함)
    infra.tool_registry.register("query_subsidiary_data_relevant", query_subsidiary_data_relevant)
    infra.tool_registry.register("query_external_data_relevant", query_external_data_relevant)
    
    logger.info(f"Tools registered: {infra.tool_registry.list_tools()}")


# 전역 인프라 인스턴스 (싱글톤)
_global_infra: InfraLayer = None


def get_infra() -> InfraLayer:
    """
    전역 InfraLayer 인스턴스 반환
    
    Returns:
        InfraLayer: 싱글톤 인프라 레이어
    """
    global _global_infra
    
    if _global_infra is None:
        _global_infra = create_infra_layer()
    
    return _global_infra
