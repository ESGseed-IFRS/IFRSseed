"""
aggregation_node용 계열사·외부 기업 데이터 조회 툴

- query_subsidiary_data: subsidiary_data_contributions 검색 (정확 매칭 → 벡터)
- query_external_company_data: external_company_data 검색 (카테고리 + 벡터)
"""
import logging
from typing import Any, Dict, List

from backend.domain.shared.tool.ifrs_agent.database.asyncpg_connect import connect_ifrs_asyncpg
from backend.domain.shared.tool.ifrs_agent.database.embedding_tool import embed_text
from backend.domain.shared.tool.ifrs_agent.database.sr_body_query import (
    _embedding_to_pgvector_literal,
)

logger = logging.getLogger("ifrs_agent.tools.aggregation_query")


async def query_subsidiary_data(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    subsidiary_data_contributions 테이블에서 계열사/자회사 데이터 조회.
    
    검색 전략 (category_embedding 기반):
    1. 정확 매칭: category 문자열 일치
    2. 벡터 유사도: category_embedding (정확 매칭 실패 시)
    
    더미 데이터 기준으로 related_dp_ids는 검색에 사용하지 않음.
    
    Args:
        params: {
            "company_id": str (UUID),
            "year": int,
            "category": str,
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
    limit = params.get("limit", 5)
    
    logger.info(
        "query_subsidiary_data: company_id=%s, year=%s, category=%s",
        company_id, year, category,
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
        
        vector_query += f"""
            ORDER BY similarity
            LIMIT {limit}
        """

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
    2. 벡터 유사도: category 임베딩 vs body_embedding
    
    더미/일반 운영 기준으로 related_dp_ids는 검색 필터에 사용하지 않음.
    
    Args:
        params: {
            "company_id": str (UUID),
            "year": int,
            "category": str,
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
    limit = params.get("limit", 3)
    
    logger.info(
        "query_external_company_data: company_id=%s, year=%s, category=%s",
        company_id, year, category,
    )
    
    try:
        conn = await connect_ifrs_asyncpg()
        
        emb_list = await embed_text({"text": category})
        category_embedding = _embedding_to_pgvector_literal(emb_list)
        
        # 벡터 유사도 검색 (body_embedding)
        # $3: category_embedding (vector)
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
        
        query += f"""
            ORDER BY similarity
            LIMIT {limit}
        """

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
        fallback_query += f" ORDER BY fetched_at DESC LIMIT {limit}"
        rows = await conn.fetch(fallback_query, company_id, year)
        
        await conn.close()
        
        result = [dict(row) for row in rows]
        logger.info("query_external_company_data: 폴백 (category 무시) %d건", len(result))
        return result
    
    except Exception as e:
        logger.error("query_external_company_data failed: %s", e, exc_info=True)
        return []


async def query_external_by_prompt(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    프롬프트 기반 external_company_data 검색 (신규).
    
    검색 전략:
    1. (category + query_text)를 한 덩어리로 임베딩한 뒤 body_embedding과 유사도 비교
    2. keywords로 title/body_text 키워드 매칭 (보조)
    
    Args:
        params: {
            "company_id": str (UUID),
            "year": int,
            "query_text": str (프롬프트 또는 검색 쿼리),
            "category": str (선택, DP/주제 카테고리 — query_text와 함께 임베딩),
            "keywords": List[str] (선택, 키워드 부스팅용),
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
    query_text = (params.get("query_text") or "").strip()
    category = (params.get("category") or "").strip()
    keywords = params.get("keywords", [])
    limit = params.get("limit", 3)
    
    logger.info(
        "query_external_by_prompt: company_id=%s, year=%s, category=%s, query_text=%s, keywords=%s",
        company_id, year, category[:40] if category else "",
        query_text[:50] if query_text else "", keywords
    )
    
    if not query_text and not category:
        logger.warning("query_external_by_prompt: query_text와 category 모두 비어있음")
        return []
    
    try:
        conn = await connect_ifrs_asyncpg()
        
        # 카테고리 + 프롬프트를 한 문자열로 묶어 단일 임베딩 (body_embedding과 동일 공간에서 비교)
        embed_parts: List[str] = []
        if category:
            embed_parts.append(category)
        if query_text:
            embed_parts.append(query_text)
        combined_for_embed = "\n".join(embed_parts)
        emb_list = await embed_text({"text": combined_for_embed})
        query_embedding = _embedding_to_pgvector_literal(emb_list)
        
        # 벡터 검색 쿼리
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
        
        # 키워드 필터 추가 (선택적)
        if keywords:
            # SQL injection 방지를 위해 ILIKE 패턴 이스케이프
            keyword_conditions = []
            for kw in keywords:
                # 단순 문자열 포함 검사 (ILIKE는 % 와일드카드 자동 처리)
                safe_kw = str(kw).replace("'", "''")  # 작은따옴표 이스케이프
                keyword_conditions.append(
                    f"(title ILIKE '%{safe_kw}%' OR body_text ILIKE '%{safe_kw}%')"
                )
            if keyword_conditions:
                query += " AND (" + " OR ".join(keyword_conditions) + ")"
        
        query += f"""
            ORDER BY similarity
            LIMIT {limit}
        """
        
        rows = await conn.fetch(query, company_id, year, query_embedding)
        await conn.close()
        
        result = [dict(row) for row in rows]
        for item in result:
            item.pop("similarity", None)
        
        logger.info("query_external_by_prompt: %d건", len(result))
        return result
    
    except Exception as e:
        logger.error("query_external_by_prompt failed: %s", e, exc_info=True)
        return []
