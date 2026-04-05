"""
aggregation_node용 계열사·외부 기업 데이터 조회 툴

- query_subsidiary_data: subsidiary_data_contributions 검색 (정확 매칭 → 벡터)
- query_external_company_data: external_company_data 검색 (카테고리 + 벡터)
"""
import logging
from typing import Any, Dict, List, Optional

from backend.domain.shared.tool.ifrs_agent.database.asyncpg_connect import connect_ifrs_asyncpg
from backend.domain.shared.tool.ifrs_agent.database.embedding_tool import embed_text
from backend.domain.shared.tool.ifrs_agent.database.sr_body_query import (
    _embedding_to_pgvector_literal,
)

logger = logging.getLogger("ifrs_agent.tools.aggregation_query")


async def query_subsidiary_data(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    subsidiary_data_contributions 테이블에서 계열사/자회사 데이터 조회.
    
    검색 전략:
    1. 정확 매칭: category 문자열 일치
    2. 벡터 유사도: category_embedding 코사인 유사도 (정확 매칭 실패 시)
    3. DP 필터: related_dp_ids 교차 (선택적)
    
    Args:
        params: {
            "company_id": str (UUID),
            "year": int,
            "category": str,
            "dp_id": str (선택),
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
            "data_source": str
        }
    """
    company_id = params["company_id"]
    year = params["year"]
    category = params["category"]
    dp_id = params.get("dp_id")
    # UCM ID는 related_dp_ids에 직접 저장되지 않아 필터 적용 시 0건이 된다.
    # (예: UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i)
    if isinstance(dp_id, str) and dp_id.upper().startswith("UCM_"):
        dp_id = None
    limit = params.get("limit", 5)
    
    logger.info(
        "query_subsidiary_data: company_id=%s, year=%s, category=%s, dp_id=%s",
        company_id, year, category, dp_id
    )
    
    try:
        conn = await connect_ifrs_asyncpg()
        
        # 1단계: 정확 매칭 시도
        exact_query = """
            SELECT 
                subsidiary_name,
                facility_name,
                description,
                quantitative_data,
                category,
                report_year,
                related_dp_ids,
                data_source
            FROM subsidiary_data_contributions
            WHERE company_id = $1::uuid
              AND report_year = $2
              AND category = $3
        """
        
        # DP 필터 추가 (선택적)
        if dp_id:
            exact_query += " AND $4::text = ANY(related_dp_ids)"
            exact_query += f" ORDER BY report_year DESC LIMIT {limit}"
            rows = await conn.fetch(exact_query, company_id, year, category, dp_id)
        else:
            exact_query += f" ORDER BY report_year DESC LIMIT {limit}"
            rows = await conn.fetch(exact_query, company_id, year, category)
        
        if rows:
            await conn.close()
            result = [dict(row) for row in rows]
            logger.info("query_subsidiary_data: 정확 매칭 %d건", len(result))
            return result
        
        # 2단계: 벡터 유사도 검색 (정확 매칭 실패 시)
        # category_embedding이 NULL이 아닌 행만 대상
        emb_list = await embed_text({"text": category})
        category_embedding = _embedding_to_pgvector_literal(emb_list)
        
        vector_query = """
            SELECT 
                subsidiary_name,
                facility_name,
                description,
                quantitative_data,
                category,
                report_year,
                related_dp_ids,
                data_source,
                (category_embedding <-> $3::vector) as similarity
            FROM subsidiary_data_contributions
            WHERE company_id = $1::uuid
              AND report_year = $2
              AND category_embedding IS NOT NULL
        """
        
        if dp_id:
            vector_query += " AND $4::text = ANY(related_dp_ids)"
        
        vector_query += f"""
            ORDER BY similarity
            LIMIT {limit}
        """

        if dp_id:
            rows = await conn.fetch(vector_query, company_id, year, category_embedding, dp_id)
        else:
            rows = await conn.fetch(vector_query, company_id, year, category_embedding)
        
        if rows:
            await conn.close()
            result = [dict(row) for row in rows]
            for item in result:
                item.pop("similarity", None)
            logger.info("query_subsidiary_data: 벡터 검색 %d건", len(result))
            return result
        
        # 3단계: 폴백 — category 필터 없이 company_id + year만으로 조회
        fallback_query = """
            SELECT 
                subsidiary_name,
                facility_name,
                description,
                quantitative_data,
                category,
                report_year,
                related_dp_ids,
                data_source
            FROM subsidiary_data_contributions
            WHERE company_id = $1::uuid
              AND report_year = $2
        """
        if dp_id:
            fallback_query += " AND $3::text = ANY(related_dp_ids)"
            fallback_query += f" ORDER BY report_year DESC LIMIT {limit}"
            rows = await conn.fetch(fallback_query, company_id, year, dp_id)
        else:
            fallback_query += f" ORDER BY report_year DESC LIMIT {limit}"
            rows = await conn.fetch(fallback_query, company_id, year)
        
        await conn.close()
        
        result = [dict(row) for row in rows]
        logger.info("query_subsidiary_data: 폴백 (category 무시) %d건", len(result))
        return result
    
    except Exception as e:
        logger.error("query_subsidiary_data failed: %s", e, exc_info=True)
        return []


async def query_external_company_data(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    external_company_data 테이블에서 외부 기업 데이터 조회.
    
    검색 전략:
    1. 기본 필터: anchor_company_id, report_year, source_type
    2. 벡터 유사도: content_embedding 코사인 유사도 (title + body_text)
    3. DP 필터: related_dp_ids 교차 (선택적)
    
    Args:
        params: {
            "company_id": str (UUID),
            "year": int,
            "category": str,
            "dp_id": str (선택),
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
            "related_dp_ids": list
        }
    """
    company_id = params["company_id"]
    year = params["year"]
    category = params["category"]
    dp_id = params.get("dp_id")
    if isinstance(dp_id, str) and dp_id.upper().startswith("UCM_"):
        dp_id = None
    limit = params.get("limit", 3)
    
    logger.info(
        "query_external_company_data: company_id=%s, year=%s, category=%s, dp_id=%s",
        company_id, year, category, dp_id
    )
    
    try:
        conn = await connect_ifrs_asyncpg()
        
        emb_list = await embed_text({"text": category})
        category_embedding = _embedding_to_pgvector_literal(emb_list)
        
        # 벡터 유사도 검색 (body_embedding)
        # $3: category_embedding (vector)
        # $4: dp_id (text, 선택적)
        query = """
            SELECT 
                title,
                body_text,
                source_url,
                source_type,
                fetched_at,
                report_year,
                related_dp_ids,
                (body_embedding <-> $3::vector) as similarity
            FROM external_company_data
            WHERE anchor_company_id = $1::uuid
              AND report_year = $2
              AND source_type IN ('press', 'news')
              AND body_embedding IS NOT NULL
        """
        
        # DP 필터 추가 (선택적)
        if dp_id:
            query += " AND $4::text = ANY(related_dp_ids)"
        
        query += f"""
            ORDER BY similarity
            LIMIT {limit}
        """

        if dp_id:
            rows = await conn.fetch(query, company_id, year, category_embedding, dp_id)
        else:
            rows = await conn.fetch(query, company_id, year, category_embedding)
        
        if rows:
            await conn.close()
            result = [dict(row) for row in rows]
            for item in result:
                item.pop("similarity", None)
            logger.info("query_external_company_data: 벡터 검색 %d건", len(result))
            return result
        
        # 폴백: category 필터 없이 company_id + year만으로 조회
        fallback_query = """
            SELECT 
                title,
                body_text,
                source_url,
                source_type,
                fetched_at,
                report_year,
                related_dp_ids
            FROM external_company_data
            WHERE anchor_company_id = $1::uuid
              AND report_year = $2
              AND source_type IN ('press', 'news')
        """
        if dp_id:
            fallback_query += " AND $3::text = ANY(related_dp_ids)"
            fallback_query += f" ORDER BY fetched_at DESC LIMIT {limit}"
            rows = await conn.fetch(fallback_query, company_id, year, dp_id)
        else:
            fallback_query += f" ORDER BY fetched_at DESC LIMIT {limit}"
            rows = await conn.fetch(fallback_query, company_id, year)
        
        await conn.close()
        
        result = [dict(row) for row in rows]
        logger.info("query_external_company_data: 폴백 (category 무시) %d건", len(result))
        return result
    
    except Exception as e:
        logger.error("query_external_company_data failed: %s", e, exc_info=True)
        return []
