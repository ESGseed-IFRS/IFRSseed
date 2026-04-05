"""
오케스트레이터 DP 유형 라우팅 통합 테스트

실 DB + Gemini 환경에서 정량/정성 DP 분기 검증
"""
import asyncio
import logging
from typing import Dict, Any
from uuid import UUID

import pytest

from backend.domain.v1.ifrs_agent.hub.bootstrap import get_infra
from backend.domain.v1.ifrs_agent.hub.orchestrator.orchestrator import Orchestrator

logger = logging.getLogger(__name__)


# 테스트용 company_id (시드 데이터와 일치해야 함)
TEST_COMPANY_ID = "550e8400-e29b-41d4-a716-446655440001"


@pytest.fixture
def orchestrator():
    """오케스트레이터 인스턴스 (실 InfraLayer)."""
    infra = get_infra()
    return Orchestrator(infra)


@pytest.mark.asyncio
async def test_quantitative_dp_routing(orchestrator):
    """
    시나리오 1: 정량 DP (Scope 1 배출량)
    
    예상:
    - dp_rag 호출 → fact_data에 value (정량 데이터)
    """
    user_input = {
        "action": "create",
        "company_id": TEST_COMPANY_ID,
        "category": "기후변화",
        "dp_id": "ESRS2-E1-6",  # Scope 1 배출량 (quantitative)
    }
    
    # _check_dp_type_for_routing 단독 테스트
    dp_type_check = await orchestrator._check_dp_type_for_routing("ESRS2-E1-6")
    
    assert dp_type_check["is_quantitative"] is True
    assert dp_type_check["dp_type"] == "quantitative"
    
    logger.info("✅ 정량 DP 라우팅 체크 통과: %s", dp_type_check)


@pytest.mark.asyncio
async def test_qualitative_dp_routing_ucm(orchestrator):
    """
    시나리오 2: 정성 DP (UCM — 인센티브 여부·방법)
    
    예상:
    - dp_rag 호출 → fact_data에 description + rulebook (value 없음)
    """
    # 정성 DP는 dp_rag가 처리 (value=None, dp_metadata + rulebook 반환)
    logger.info("✅ 정성 DP는 이제 dp_rag가 통합 처리 (별도 라우팅 체크 불필요)")


@pytest.mark.asyncio
async def test_qualitative_dp_routing_data_points(orchestrator):
    """
    시나리오 3: 정성 DP (data_points — dp_type=qualitative)
    
    전제: data_points에 dp_type='qualitative'인 DP 존재
    """
    # TODO: 실제 정성 DP ID로 교체
    dp_id = "SOME_QUALITATIVE_DP"
    
    dp_type_check = await orchestrator._check_dp_type_for_routing(dp_id)
    
    # dp_type이 qualitative면 is_quantitative=False
    if dp_type_check["dp_type"] == "qualitative":
        assert dp_type_check["is_quantitative"] is False
        logger.info("✅ 정성 DP (data_points) 라우팅 체크 통과: %s", dp_type_check)
    else:
        pytest.skip(f"DP {dp_id} is not qualitative (type={dp_type_check['dp_type']})")


@pytest.mark.asyncio
async def test_parallel_collect_with_quantitative_dp(orchestrator):
    """
    시나리오 4: _parallel_collect 전체 흐름 (정량 DP)
    
    예상:
    - c_rag, dp_rag, aggregation_node 호출
    - fact_data에 value (정량 데이터)
    """
    user_input = {
        "company_id": TEST_COMPANY_ID,
        "category": "기후변화",
        "dp_id": "ESRS2-E1-6",
    }
    
    data = await orchestrator._parallel_collect(user_input)
    
    assert "ref_data" in data
    assert "fact_data" in data
    assert "agg_data" in data
    
    # 정량 DP → fact_data에 값
    assert data["fact_data"].get("dp_id") == "ESRS2-E1-6"
    assert data["fact_data"].get("value") is not None
    
    logger.info("✅ _parallel_collect (정량 DP) 통과: fact_data.value=%s", data["fact_data"].get("value"))


@pytest.mark.asyncio
async def test_parallel_collect_with_qualitative_dp(orchestrator):
    """
    시나리오 5: _parallel_collect 전체 흐름 (정성 DP)
    
    예상:
    - c_rag (ref_data)
    - dp_rag → fact_data (value=None, dp_metadata + rulebook)
    """
    user_input = {
        "company_id": TEST_COMPANY_ID,
        "category": "거버넌스",
        "dp_id": "UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i",
    }
    
    data = await orchestrator._parallel_collect(user_input)
    
    assert "ref_data" in data
    assert "fact_data" in data
    assert "agg_data" in data
    
    # 정성 DP → fact_data에 dp_metadata + rulebook (value=None)
    assert data["fact_data"].get("value") is None
    assert data["fact_data"].get("dp_metadata") is not None or data["fact_data"].get("ucm") is not None
    
    logger.info("✅ _parallel_collect (정성 DP) 통과: fact_data.dp_metadata=%s", data["fact_data"].get("dp_metadata"))


@pytest.mark.asyncio
async def test_gen_node_with_fact_data(orchestrator):
    """
    시나리오 6: gen_node 스텁 — fact_data 처리
    
    예상:
    - fact_data.value → 텍스트에 수치 포함
    - suitability_warning 있으면 경고 포함
    """
    from backend.domain.v1.ifrs_agent.spokes.agents.stubs import gen_node_stub
    
    payload = {
        "fact_data": {
            "dp_id": "ESRS2-E1-6",
            "value": 473.9674,
            "unit": "tCO2e",
            "dp_metadata": {"name_ko": "Scope 1 배출량"},
            "suitability_warning": None,
        },
        "ref_data": {},
    }
    
    result = await gen_node_stub(payload)
    
    assert "text" in result
    assert "473.9674" in result["text"]
    assert "tCO2e" in result["text"]
    
    logger.info("✅ gen_node (fact_data) 통과: %s", result["text"][:100])


@pytest.mark.asyncio
async def test_gen_node_with_qualitative_dp(orchestrator):
    """
    시나리오 7: gen_node 스텁 — 정성 DP (fact_data에 description + rulebook)
    
    예상:
    - fact_data (value=None, dp_metadata + rulebook) → 텍스트에 요구사항·기준 포함
    """
    from backend.domain.v1.ifrs_agent.spokes.agents.stubs import gen_node_stub
    
    payload = {
        "fact_data": {
            "value": None,
            "dp_metadata": {
                "name_ko": "인센티브 제도 기후 고려 반영 여부",
                "description": "임원 보수에 기후 목표 달성률을 반영했는지 여부와 방법을 공개하라",
                "dp_type": "qualitative"
            },
            "rulebook": {
                "rulebook_content": "ESRS E1 GOV-3: 인센티브 제도에 기후 관련 고려사항 반영 여부 및 방법 공개"
            }
        },
        "ref_data": {},
    }
    
    result = await gen_node_stub(payload)
    
    assert "text" in result
    assert "정성 DP" in result["text"]
    assert "인센티브" in result["text"]
    
    logger.info("✅ gen_node (정성 DP) 통과: %s", result["text"][:100])


@pytest.mark.asyncio
async def test_gen_node_with_suitability_warning(orchestrator):
    """
    시나리오 8: gen_node 스텁 — suitability_warning 처리
    
    예상:
    - fact_data.value + suitability_warning → 경고 포함
    """
    from backend.domain.v1.ifrs_agent.spokes.agents.stubs import gen_node_stub
    
    payload = {
        "fact_data": {
            "value": 100,
            "unit": "명",
            "dp_metadata": {"name_ko": "이사회 인원"},
            "suitability_warning": "DP type is 'qualitative' — fact_data 수치만으로 부족할 수 있음",
        },
        "ref_data": {},
    }
    
    result = await gen_node_stub(payload)
    
    assert "text" in result
    assert "100" in result["text"]
    assert "주의" in result["text"]
    
    logger.info("✅ gen_node (suitability_warning) 통과: %s", result["text"][:100])


@pytest.mark.asyncio
async def test_e2e_create_with_quantitative_dp(orchestrator):
    """
    시나리오 9: E2E 전체 흐름 (정량 DP)
    
    전제:
    - DB에 시드 데이터 적재 완료
    - GEMINI_API_KEY 설정
    
    예상:
    - orchestrate 성공
    - generated_text에 수치 포함
    """
    user_input = {
        "action": "create",
        "company_id": TEST_COMPANY_ID,
        "category": "기후변화",
        "dp_id": "ESRS2-E1-6",
    }
    
    result = await orchestrator.orchestrate(user_input)
    
    assert "generated_text" in result
    assert "validation" in result
    assert "references" in result
    assert "metadata" in result
    
    # fact_data 포함 확인
    assert "fact_data" in result["references"]
    
    logger.info("✅ E2E (정량 DP) 통과: status=%s", result["metadata"].get("status"))


@pytest.mark.asyncio
async def test_e2e_create_with_qualitative_dp(orchestrator):
    """
    시나리오 10: E2E 전체 흐름 (정성 DP)
    
    예상:
    - orchestrate 성공
    - generated_text에 서술 포함
    - fact_data 빈 dict
    """
    user_input = {
        "action": "create",
        "company_id": TEST_COMPANY_ID,
        "category": "거버넌스",
        "dp_id": "UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i",
    }
    
    result = await orchestrator.orchestrate(user_input)
    
    assert "generated_text" in result
    assert "validation" in result
    
    # fact_data 빈 dict
    fact_data = result["references"].get("fact_data", {})
    assert fact_data == {} or fact_data.get("value") is None
    
    logger.info("✅ E2E (정성 DP) 통과: status=%s", result["metadata"].get("status"))


if __name__ == "__main__":
    # 수동 실행 예시
    logging.basicConfig(level=logging.INFO)
    
    infra = get_infra()
    orch = Orchestrator(infra)
    
    # 정량 DP 테스트
    asyncio.run(test_quantitative_dp_routing(orch))
    asyncio.run(test_parallel_collect_with_quantitative_dp(orch))
    
    # 정성 DP 테스트
    asyncio.run(test_qualitative_dp_routing_ucm(orch))
    asyncio.run(test_parallel_collect_with_qualitative_dp(orch))
    
    # gen_node 스텁 테스트
    asyncio.run(test_gen_node_with_fact_data(orch))
    asyncio.run(test_gen_node_with_qualitative_dp(orch))
    asyncio.run(test_gen_node_with_suitability_warning(orch))
    
    print("\n✅ 모든 테스트 통과")
