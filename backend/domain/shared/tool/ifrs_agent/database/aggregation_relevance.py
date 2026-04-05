"""
관련성 기반 aggregation 쿼리

DP 메타데이터 + SR 컨텍스트 복합 임베딩으로
의미적으로 관련된 데이터만 검색합니다.
"""
import logging
from typing import Any, Dict, List

from backend.domain.shared.tool.ifrs_agent.database.asyncpg_connect import connect_ifrs_asyncpg
from backend.domain.shared.tool.ifrs_agent.database.sr_body_query import (
    _embedding_to_pgvector_literal,
)

logger = logging.getLogger("ifrs_agent.tools.aggregation_relevance")

# 기본 유사도 임계값 (0~1, 낮을수록 엄격)
DEFAULT_SIMILARITY_THRESHOLD = 0.5


async def query_subsidiary_data_relevant(
    params: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    관련성 기반 subsidiary 데이터 검색.
    
    description_embedding과 relevance_embedding의 코사인 유사도로 검색.
    
    Args:
        params: {
            "company_id": str (UUID),
            "year": int,
            "relevance_embedding": List[float],  # 1024차원
            "similarity_threshold": float (기본 0.5),
            "limit": int (기본 5)
        }
    
    Returns:
        List of {
            "subsidiary_name": str,
            "facility_name": str,
            "description": str,
            "quantitative_data": dict,
            "category": str,
            "report_year": int,
            "related_dp_ids": list,
            "data_source": str,
            "similarity": float
        }
    """
    company_id = params["company_id"]
    year = params["year"]
    relevance_embedding = params["relevance_embedding"]
    similarity_threshold = params.get("similarity_threshold", DEFAULT_SIMILARITY_THRESHOLD)
    limit = params.get("limit", 5)
    
    logger.info(
        "query_subsidiary_data_relevant: company_id=%s, year=%s, threshold=%.2f",
        company_id, year, similarity_threshold
    )
    
    try:
        conn = await connect_ifrs_asyncpg()
        
        # 임베딩을 pgvector 리터럴로 변환
        embedding_literal = _embedding_to_pgvector_literal(relevance_embedding)
        
        # 관련성 기반 검색
        query = """
            SELECT 
                subsidiary_name,
                facility_name,
                description,
                quantitative_data,
                category,
                report_year,
                related_dp_ids,
                data_source,
                (description_embedding <-> $3::vector) as similarity
            FROM subsidiary_data_contributions
            WHERE company_id = $1::uuid
              AND report_year = $2
              AND description_embedding IS NOT NULL
              AND (description_embedding <-> $3::vector) < $4
            ORDER BY similarity
            LIMIT $5
        """
        
        rows = await conn.fetch(
            query,
            company_id,
            year,
            embedding_literal,
            similarity_threshold,
            limit
        )
        
        await conn.close()
        
        result = [dict(row) for row in rows]
        
        logger.info(
            "query_subsidiary_data_relevant: %d건 (threshold=%.2f)",
            len(result), similarity_threshold
        )
        
        return result
    
    except Exception as e:
        logger.error(
            "query_subsidiary_data_relevant failed: %s",
            e,
            exc_info=True
        )
        return []


async def query_external_data_relevant(
    params: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    관련성 기반 external 데이터 검색.
    
    category_embedding과 body_embedding 중 더 유사한 것을 선택.
    
    Args:
        params: {
            "company_id": str (UUID),
            "year": int,
            "relevance_embedding": List[float],  # 1024차원
            "similarity_threshold": float (기본 0.5),
            "limit": int (기본 3)
        }
    
    Returns:
        List of {
            "title": str,
            "body_text": str,
            "source_url": str,
            "source_type": str,
            "fetched_at": datetime,
            "report_year": int,
            "related_dp_ids": list,
            "similarity": float
        }
    """
    company_id = params["company_id"]
    year = params["year"]
    relevance_embedding = params["relevance_embedding"]
    similarity_threshold = params.get("similarity_threshold", DEFAULT_SIMILARITY_THRESHOLD)
    limit = params.get("limit", 3)
    
    logger.info(
        "query_external_data_relevant: company_id=%s, year=%s, threshold=%.2f",
        company_id, year, similarity_threshold
    )
    
    try:
        conn = await connect_ifrs_asyncpg()
        
        # 임베딩을 pgvector 리터럴로 변환
        embedding_literal = _embedding_to_pgvector_literal(relevance_embedding)
        
        # 관련성 기반 검색 (category_embedding과 body_embedding 중 더 유사한 것)
        query = """
            SELECT 
                title,
                body_text,
                source_url,
                source_type,
                fetched_at,
                report_year,
                related_dp_ids,
                LEAST(
                    COALESCE((category_embedding <-> $3::vector), 1.0),
                    COALESCE((body_embedding <-> $3::vector), 1.0)
                ) as similarity
            FROM external_company_data
            WHERE anchor_company_id = $1::uuid
              AND report_year = $2
              AND source_type IN ('press', 'news')
              AND (
                  (category_embedding IS NOT NULL AND (category_embedding <-> $3::vector) < $4)
                  OR
                  (body_embedding IS NOT NULL AND (body_embedding <-> $3::vector) < $4)
              )
            ORDER BY similarity
            LIMIT $5
        """
        
        rows = await conn.fetch(
            query,
            company_id,
            year,
            embedding_literal,
            similarity_threshold,
            limit
        )
        
        await conn.close()
        
        result = [dict(row) for row in rows]
        
        logger.info(
            "query_external_data_relevant: %d건 (threshold=%.2f)",
            len(result), similarity_threshold
        )
        
        return result
    
    except Exception as e:
        logger.error(
            "query_external_data_relevant failed: %s",
            e,
            exc_info=True
        )
        return []
