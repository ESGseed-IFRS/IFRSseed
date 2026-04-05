"""
관련성 분석기: 전년도 SR 본문 분석 및 관련성 임베딩 생성

aggregation_node에서 DP와 관련된 데이터만 가져오기 위한
관련성 분석 및 검색 쿼리 생성을 담당합니다.
"""
import logging
from typing import Any, Dict, List, Optional

from backend.domain.shared.tool.ifrs_agent.database.sr_body_context_query import (
    query_sr_body_by_context,
)
from backend.domain.shared.tool.ifrs_agent.database.embedding_tool import embed_text
from backend.domain.v1.ifrs_agent.spokes.agents.aggregation_node.pattern_detector import (
    detect_data_source_patterns,
    determine_source_type,
)

logger = logging.getLogger("ifrs_agent.aggregation_node.relevance_analyzer")


async def analyze_prior_year_body(
    company_id: str,
    dp_id: Optional[str],
    year: int,
    toc_path: List[str],
    subtitle: Optional[str] = None
) -> Dict[str, Any]:
    """
    전년도 SR 본문을 분석하여 데이터 소스 유형 판단.
    
    Args:
        company_id: 회사 UUID
        dp_id: DP ID (UCM 또는 원본)
        year: 현재 보고 연도
        toc_path: 목차 경로
        subtitle: 부제목 (선택)
    
    Returns:
        {
            "source_type": "external_only" | "subsidiary_only" | "both" | "skip",
            "prior_body_text": str | None,
            "detected_patterns": {
                "has_news_citation": bool,
                "has_subsidiary_mention": bool,
                "news_pattern_count": int,
                "subsidiary_pattern_count": int,
                "news_score": float,
                "subsidiary_score": float,
                "confidence": float,
                "matched_news_patterns": List[str],
                "matched_subsidiary_patterns": List[str]
            }
        }
    """
    prior_year = year - 1
    
    logger.info(
        "analyze_prior_year_body: company_id=%s, year=%s, prior_year=%s, toc_path=%s",
        company_id, year, prior_year, toc_path
    )
    
    # 1. 전년도 SR 본문 조회
    prior_body = await query_sr_body_by_context(
        company_id=company_id,
        year=prior_year,
        toc_path=toc_path,
        subtitle=subtitle
    )
    
    if not prior_body or not prior_body.get("content_text"):
        logger.info("analyze_prior_year_body: 전년도 SR 본문 없음 → skip")
        return {
            "source_type": "skip",
            "prior_body_text": None,
            "detected_patterns": {
                "has_news_citation": False,
                "has_subsidiary_mention": False,
                "news_pattern_count": 0,
                "subsidiary_pattern_count": 0,
                "news_score": 0.0,
                "subsidiary_score": 0.0,
                "confidence": 0.0,
                "matched_news_patterns": [],
                "matched_subsidiary_patterns": []
            }
        }
    
    # 2. 패턴 분석
    body_text = prior_body["content_text"]
    patterns = detect_data_source_patterns(body_text)
    
    # 3. 소스 유형 결정
    source_type = determine_source_type(patterns)
    
    logger.info(
        "analyze_prior_year_body: source_type=%s, confidence=%.2f, "
        "news_count=%d, subsidiary_count=%d",
        source_type,
        patterns["confidence"],
        patterns["news_pattern_count"],
        patterns["subsidiary_pattern_count"]
    )
    
    return {
        "source_type": source_type,
        "prior_body_text": body_text,
        "detected_patterns": patterns
    }


async def build_relevance_query_embedding(
    dp_metadata: Dict[str, Any],
    sr_context: Dict[str, Any]
) -> List[float]:
    """
    DP 메타데이터와 SR 컨텍스트를 결합한 검색용 임베딩 생성.
    
    Args:
        dp_metadata: {
            "unified_column_id": str,
            "column_name_ko": str,
            "column_description": str,
            "column_topic": str,
            "column_subtopic": str
        }
        sr_context: {
            "toc_path": List[str],
            "subtitle": str
        }
    
    Returns:
        1024차원 임베딩 벡터
    """
    query_parts = []
    
    # DP 메타데이터
    if dp_metadata.get("column_name_ko"):
        query_parts.append(dp_metadata["column_name_ko"])
    
    if dp_metadata.get("column_description"):
        # 설명에서 핵심 부분만 추출 (처음 200자)
        desc = dp_metadata["column_description"][:200]
        query_parts.append(desc)
    
    if dp_metadata.get("column_topic"):
        query_parts.append(dp_metadata["column_topic"])
    
    if dp_metadata.get("column_subtopic"):
        query_parts.append(dp_metadata["column_subtopic"])
    
    # SR 컨텍스트
    if sr_context.get("toc_path"):
        toc_str = " > ".join(sr_context["toc_path"])
        query_parts.append(toc_str)
    
    if sr_context.get("subtitle"):
        query_parts.append(sr_context["subtitle"])
    
    # 결합
    query_text = " | ".join(query_parts)
    
    logger.info(
        "build_relevance_query_embedding: query_text (length=%d)",
        len(query_text)
    )
    logger.debug("build_relevance_query_embedding: query_text=%s", query_text)
    
    # 임베딩 생성
    embedding = await embed_text({"text": query_text})
    
    return embedding


def build_relevance_query_text(
    dp_metadata: Dict[str, Any],
    sr_context: Dict[str, Any]
) -> str:
    """
    DP 메타데이터와 SR 컨텍스트를 결합한 검색 쿼리 텍스트 생성.
    
    임베딩 생성 전에 쿼리 텍스트만 필요한 경우 사용.
    
    Args:
        dp_metadata: DP 메타데이터
        sr_context: SR 컨텍스트
    
    Returns:
        결합된 쿼리 텍스트
    """
    query_parts = []
    
    if dp_metadata.get("column_name_ko"):
        query_parts.append(dp_metadata["column_name_ko"])
    
    if dp_metadata.get("column_description"):
        desc = dp_metadata["column_description"][:200]
        query_parts.append(desc)
    
    if dp_metadata.get("column_topic"):
        query_parts.append(dp_metadata["column_topic"])
    
    if dp_metadata.get("column_subtopic"):
        query_parts.append(dp_metadata["column_subtopic"])
    
    if sr_context.get("toc_path"):
        toc_str = " > ".join(sr_context["toc_path"])
        query_parts.append(toc_str)
    
    if sr_context.get("subtitle"):
        query_parts.append(sr_context["subtitle"])
    
    return " | ".join(query_parts)
