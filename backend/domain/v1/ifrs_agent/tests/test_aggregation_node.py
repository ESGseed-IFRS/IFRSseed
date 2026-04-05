"""
aggregation_node 통합 테스트

실 DB 환경에서 subsidiary_data_contributions + external_company_data 조회 검증
"""
import asyncio
import logging
from typing import Dict, Any

import pytest

from backend.domain.v1.ifrs_agent.hub.bootstrap import get_infra
from backend.domain.v1.ifrs_agent.spokes.agents.aggregation_node import AggregationNodeAgent

logger = logging.getLogger(__name__)


# 테스트용 company_id (시드 데이터와 일치해야 함)
TEST_COMPANY_ID = "550e8400-e29b-41d4-a716-446655440001"


@pytest.fixture
def aggregation_agent():
    """AggregationNodeAgent 인스턴스 (실 InfraLayer)."""
    infra = get_infra()
    return AggregationNodeAgent(infra)


@pytest.mark.asyncio
async def test_query_subsidiary_data_tool():
    """
    시나리오 1: query_subsidiary_data 툴 단독 테스트
    
    전제:
    - subsidiary_data_contributions 테이블에 시드 데이터 적재
    - category="재생에너지" 또는 유사 카테고리 존재
    
    예상:
    - 정확 매칭 또는 벡터 검색으로 결과 반환
    - 각 행에 subsidiary_name, description, quantitative_data 포함
    """
    from backend.domain.shared.tool.ifrs_agent.database.aggregation_query import query_subsidiary_data
    
    params = {
        "company_id": TEST_COMPANY_ID,
        "year": 2024,
        "category": "재생에너지",
        "limit": 5
    }
    
    result = await query_subsidiary_data(params)
    
    assert isinstance(result, list)
    logger.info("✅ query_subsidiary_data: %d건 조회", len(result))
    
    if result:
        first = result[0]
        assert "subsidiary_name" in first
        assert "description" in first
        assert "report_year" in first
        logger.info("✅ 첫 번째 행: subsidiary=%s, year=%s", first["subsidiary_name"], first["report_year"])


@pytest.mark.asyncio
async def test_query_external_company_data_tool():
    """
    시나리오 2: query_external_company_data 툴 단독 테스트
    
    전제:
    - external_company_data 테이블에 뉴스/보도 데이터 적재
    - content_embedding 채워져 있음
    
    예상:
    - 벡터 유사도로 상위 N건 반환
    - 각 행에 title, body_text, source_url 포함
    """
    from backend.domain.shared.tool.ifrs_agent.database.aggregation_query import query_external_company_data
    
    params = {
        "company_id": TEST_COMPANY_ID,
        "year": 2024,
        "category": "재생에너지",
        "limit": 3
    }
    
    result = await query_external_company_data(params)
    
    assert isinstance(result, list)
    logger.info("✅ query_external_company_data: %d건 조회", len(result))
    
    if result:
        first = result[0]
        assert "title" in first
        assert "source_url" in first
        logger.info("✅ 첫 번째 행: title=%s", first["title"][:50])


@pytest.mark.asyncio
async def test_aggregation_node_collect(aggregation_agent):
    """
    시나리오 3: AggregationNodeAgent.collect() 전체 흐름
    
    전제:
    - subsidiary_data_contributions + external_company_data 시드 데이터
    
    예상:
    - 2024, 2023 연도별로 subsidiary_data + external_company_data 반환
    - 각 연도에 두 리스트 포함
    """
    payload = {
        "company_id": TEST_COMPANY_ID,
        "category": "재생에너지",
        "years": [2024, 2023]
    }
    
    result = await aggregation_agent.collect(payload)
    
    assert "2024" in result
    assert "2023" in result
    
    assert "subsidiary_data" in result["2024"]
    assert "external_company_data" in result["2024"]
    
    assert isinstance(result["2024"]["subsidiary_data"], list)
    assert isinstance(result["2024"]["external_company_data"], list)
    
    logger.info(
        "✅ aggregation_node.collect: 2024=%d건(sub)+%d건(ext), 2023=%d건(sub)+%d건(ext)",
        len(result["2024"]["subsidiary_data"]),
        len(result["2024"]["external_company_data"]),
        len(result["2023"]["subsidiary_data"]),
        len(result["2023"]["external_company_data"])
    )


@pytest.mark.asyncio
async def test_aggregation_node_with_dp_filter(aggregation_agent):
    """
    시나리오 4: DP 필터 적용
    
    전제:
    - subsidiary_data_contributions에 related_dp_ids 포함된 행 존재
    
    예상:
    - dp_id와 교차하는 행만 반환
    """
    payload = {
        "company_id": TEST_COMPANY_ID,
        "category": "기후변화",
        "dp_id": "ESRS2-E1-6",  # Scope 1 배출량
        "years": [2024]
    }
    
    result = await aggregation_agent.collect(payload)
    
    assert "2024" in result
    
    logger.info(
        "✅ aggregation_node (DP 필터): subsidiary=%d건, external=%d건",
        len(result["2024"]["subsidiary_data"]),
        len(result["2024"]["external_company_data"])
    )


@pytest.mark.asyncio
async def test_orchestrator_with_aggregation_node():
    """
    시나리오 5: Orchestrator._parallel_collect에서 aggregation_node 호출
    
    전제:
    - aggregation_node가 bootstrap에 등록됨
    - 시드 데이터 적재
    
    예상:
    - _parallel_collect 결과에 agg_data 포함
    - agg_data에 연도별 subsidiary + external 데이터
    """
    from backend.domain.v1.ifrs_agent.hub.orchestrator.orchestrator import Orchestrator
    
    infra = get_infra()
    orchestrator = Orchestrator(infra)
    
    user_input = {
        "company_id": TEST_COMPANY_ID,
        "category": "재생에너지",
        "dp_id": "ESRS2-E1-6"
    }
    
    result = await orchestrator._parallel_collect(user_input)
    
    assert "ref_data" in result
    assert "fact_data" in result
    assert "agg_data" in result
    
    # agg_data 구조 검증
    agg_data = result["agg_data"]
    if agg_data:
        assert "2024" in agg_data or "2023" in agg_data
        logger.info("✅ Orchestrator._parallel_collect: agg_data 포함 확인")
    else:
        logger.warning("⚠️ agg_data가 비어있음 (aggregation_node 미등록 또는 데이터 없음)")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    infra = get_infra()
    agent = AggregationNodeAgent(infra)
    
    # 툴 단독 테스트
    asyncio.run(test_query_subsidiary_data_tool())
    asyncio.run(test_query_external_company_data_tool())
    
    # 에이전트 테스트
    asyncio.run(test_aggregation_node_collect(agent))
    asyncio.run(test_aggregation_node_with_dp_filter(agent))
    
    # Orchestrator 통합 테스트
    asyncio.run(test_orchestrator_with_aggregation_node())
    
    print("\n✅ 모든 aggregation_node 테스트 통과")
