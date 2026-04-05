"""
미구현 에이전트용 임시 스텁 (개발·c_rag 단독 검증용).

실제 gen_node / validator_node 구현 후 bootstrap에서 교체한다.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger("ifrs_agent.agents.stubs")


def _nested_dict(d: Dict[str, Any], key: str) -> Dict[str, Any]:
    """dict.get(key, {})는 키가 있고 값이 None이면 None을 돌려줌 — 스텁 안전용."""
    v = d.get(key)
    return v if isinstance(v, dict) else {}


async def gen_node_stub(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    개선된 스텁 — fact_data (정량/정성 통합) 처리.
    
    실제 gen_node 구현 시 참고용 로직 포함.
    """
    fact_data = payload.get("fact_data") or {}
    ref_data = payload.get("ref_data") or {}
    
    # fact_data가 None이거나 빈 dict일 수 있음 (에러 발생 시)
    if not isinstance(fact_data, dict):
        fact_data = {}
    if not isinstance(ref_data, dict):
        ref_data = {}
    
    dp_meta = _nested_dict(fact_data, "dp_metadata")
    ucm = _nested_dict(fact_data, "ucm")
    rulebook = _nested_dict(fact_data, "rulebook")

    # 간단한 텍스트 생성 (실제는 LLM 호출)
    text_parts = []
    
    if fact_data and fact_data.get("value") is not None:
        # 정량 DP: 실데이터 있음
        value = fact_data.get("value")
        unit = fact_data.get("unit") or ""
        dp_name = dp_meta.get("name_ko") or ucm.get("column_name_ko") or "지표"
        
        text_parts.append(f"{dp_name}: {value} {unit}")
        
        suitability_warning = fact_data.get("suitability_warning")
        if suitability_warning:
            logger.warning("gen_node: suitability_warning 감지 — %s", suitability_warning)
            text_parts.append(f"(주의: {suitability_warning})")
    
    elif fact_data and (dp_meta or ucm or rulebook):
        # 정성·UCM-only 등: description / rulebook 기반 (dp_metadata가 None이어도 ucm 가능)
        dp_name = dp_meta.get("name_ko") or ucm.get("column_name_ko") or "정성 지표"
        description = (dp_meta.get("description") or ucm.get("column_description") or "")
        rulebook_content = rulebook.get("rulebook_content") or ""
        
        text_parts.append(f"[정성 DP] {dp_name}")
        if description:
            text_parts.append(f"요구사항: {description[:100]}...")
        if rulebook_content:
            text_parts.append(f"기준: {rulebook_content[:100]}...")
    
    else:
        # DP 없음 → SR 본문만
        if ref_data:
            text_parts.append("[SR 본문 참고 문단 생성 예정]")
        else:
            text_parts.append("[데이터 부족]")
    
    generated_text = " ".join(text_parts) if text_parts else ""
    
    logger.warning("gen_node: stub — 간단 텍스트 반환 (실제 구현 전): %s", generated_text[:100])
    return {"text": generated_text}


async def validator_node_stub(payload: Dict[str, Any]) -> Dict[str, Any]:
    """항상 통과. 재시도 루프 종료용."""
    _ = payload
    logger.warning("validator_node: stub — is_valid=True (실제 구현 전)")
    return {"is_valid": True, "errors": []}
