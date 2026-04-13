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

# grep: SUBSIDIARY_QUERY_TRACE — related_dp_ids ∩ dp_ids 분기 확인용
_SUBSIDIARY_TRACE = "[SUBSIDIARY_QUERY_TRACE]"


def _subsidiary_trace(msg: str, **fields: Any) -> None:
    if not fields:
        logger.info("%s %s", _SUBSIDIARY_TRACE, msg)
        return
    tail = " ".join(f"{k}={v!r}" for k, v in fields.items())
    logger.info("%s %s | %s", _SUBSIDIARY_TRACE, msg, tail)


async def query_subsidiary_data(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    subsidiary_data_contributions 테이블에서 계열사/자회사 데이터 조회.

    회사 구분: subsidiary 조회는 **report_year(및 DP/카테고리)** 만 필터에 사용한다.
    company_id는 호환·로깅용으로 받을 수 있으나 SQL WHERE에는 넣지 않는다.
    
    검색 전략 (DP 우선 → 카테고리 폴백):
    1. DP 직접 매칭: dp_ids가 related_dp_ids와 교차하면 최우선
    2. UCM 경유 매칭: dp_ids 중 UCM이면 mapped_dp_ids 조회 후 교차
    3. 카테고리 정확 매칭
    4. 카테고리 벡터 유사도
    
    Args:
        params: {
            "company_id": str (UUID, 선택·로깅용),
            "year": int,
            "category": str,
            "dp_ids": List[str] (선택, 우선 검색용),
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
    company_id = params.get("company_id")  # 로깅용; subsidiary WHERE에는 미사용
    year = params["year"]
    category = params["category"]
    dp_ids = params.get("dp_ids", [])
    legacy_dp_id = params.get("dp_id")
    limit = params.get("limit", 5)

    if legacy_dp_id and not dp_ids:
        logger.warning(
            "%s params에 dp_id=%r만 있고 dp_ids가 비어 있음 — "
            "related_dp_ids 교차 검색(Step1)은 실행되지 않습니다. "
            "aggregation_node 레거시 경로면 dp_ids로 넘기도록 수정하세요.",
            _SUBSIDIARY_TRACE,
            legacy_dp_id,
        )
    
    logger.info(
        "query_subsidiary_data: company_id=%s, year=%s, category=%s, dp_ids=%s",
        company_id, year, category, dp_ids,
    )
    _subsidiary_trace(
        "시작",
        company_id=company_id,
        year=year,
        category=category,
        dp_ids=list(dp_ids) if dp_ids else [],
        limit=limit,
    )
    
    try:
        conn = await connect_ifrs_asyncpg()
        
        # Step 1: DP 기반 우선 검색 (dp_ids가 있을 때만)
        if dp_ids:
            # UCM과 일반 DP 분류
            ucm_ids = [dp for dp in dp_ids if dp.startswith("UCM_")]
            direct_dp_ids = [dp for dp in dp_ids if not dp.startswith("UCM_")]
            
            logger.info(
                "🔍 [AGG_DEBUG] query_subsidiary_data DP 우선 검색 시작"
            )
            logger.info(
                "🔍 [AGG_DEBUG] - 입력 dp_ids: %s", dp_ids
            )
            logger.info(
                "🔍 [AGG_DEBUG] - UCM: %d개 (%s)", 
                len(ucm_ids), ucm_ids
            )
            logger.info(
                "🔍 [AGG_DEBUG] - 일반 DP: %d개 (%s)", 
                len(direct_dp_ids), direct_dp_ids
            )
            
            # UCM의 mapped_dp_ids 배치 조회
            expanded_dp_ids = list(direct_dp_ids)
            if ucm_ids:
                try:
                    ucm_query = """
                        SELECT unified_column_id, mapped_dp_ids
                        FROM unified_column_mappings
                        WHERE unified_column_id = ANY($1::text[])
                    """
                    ucm_rows = await conn.fetch(ucm_query, ucm_ids)
                    
                    logger.info(
                        "🔍 [AGG_DEBUG] UCM 조회 결과: %d건", len(ucm_rows)
                    )
                    
                    for ucm_row in ucm_rows:
                        ucm_id = ucm_row.get("unified_column_id")
                        mapped = ucm_row.get("mapped_dp_ids") or []
                        logger.info(
                            "🔍 [AGG_DEBUG] - %s → mapped_dp_ids: %s", 
                            ucm_id, mapped
                        )
                        expanded_dp_ids.extend(mapped)
                    
                    logger.info(
                        "🔍 [AGG_DEBUG] UCM 전개 후 총 DP: %d개 (%s)",
                        len(expanded_dp_ids), expanded_dp_ids
                    )
                except Exception as e:
                    logger.warning("query_subsidiary_data: UCM 조회 실패, 일반 DP만 사용: %s", e)
            
            # related_dp_ids 교차 검색 (PostgreSQL 배열 연산)
            if expanded_dp_ids:
                _subsidiary_trace(
                    "Step1 SQL 실행: related_dp_ids && expanded_dp_ids",
                    expanded_dp_ids=expanded_dp_ids,
                    sql_op="&&",
                )
                logger.info(
                    "🔍 [AGG_DEBUG] subsidiary_data_contributions 조회 시작 (교차 검색)"
                )
                logger.info(
                    "🔍 [AGG_DEBUG] - 검색할 DP 목록: %s", expanded_dp_ids
                )
                
                dp_match_query = """
                    SELECT 
                        subsidiary_name,
                        facility_name,
                        description,
                        quantitative_data,
                        category,
                        report_year,
                        related_dp_ids,
                        data_source,
                        (SELECT COUNT(*)::int FROM unnest(related_dp_ids) AS dp 
                         WHERE dp = ANY($2::text[])) AS match_count
                    FROM subsidiary_data_contributions
                    WHERE report_year = $1
                      AND related_dp_ids && $2::text[]
                """
                dp_match_query += f" ORDER BY match_count DESC, report_year DESC LIMIT {limit}"
                
                rows = await conn.fetch(dp_match_query, year, expanded_dp_ids)
                
                logger.info(
                    "🔍 [AGG_DEBUG] DP 매칭 결과: %d건", len(rows)
                )
                
                for idx, row in enumerate(rows):
                    logger.info(
                        "🔍 [AGG_DEBUG] - [%d] subsidiary=%s, facility=%s, category=%s, "
                        "related_dp_ids=%s, match_count=%s",
                        idx + 1,
                        row.get("subsidiary_name"),
                        row.get("facility_name"),
                        row.get("category"),
                        row.get("related_dp_ids"),
                        row.get("match_count")
                    )
                
                if rows:
                    await conn.close()
                    result = [dict(row) for row in rows]
                    for item in result:
                        item.pop("match_count", None)
                    logger.info("query_subsidiary_data: DP 매칭 %d건", len(result))
                    _subsidiary_trace(
                        "종료 branch=dp_related_intersection (related_dp_ids ∩ expanded_dp_ids)",
                        rows=len(result),
                        year=year,
                        facilities=[r.get("facility_name") for r in result[:3]],
                        related_dp_ids_per_row=[r.get("related_dp_ids") for r in result[:3]],
                    )
                    return result
                
                logger.info("🔍 [AGG_DEBUG] DP 매칭 결과 없음, 카테고리 폴백으로 진행")
                logger.info("query_subsidiary_data: DP 매칭 결과 없음, 카테고리 폴백")
                _subsidiary_trace(
                    "Step1 결과 0건 → Step2 카테고리 정확 매칭으로 폴백",
                    expanded_dp_ids=expanded_dp_ids,
                    reason="related_dp_ids와 교집합 없음 또는 테이블에 해당 연도 데이터 없음",
                )
            else:
                _subsidiary_trace(
                    "Step1 건너뜀: expanded_dp_ids 비어 있음 (UCM 매핑 없음·직접 DP 없음)",
                    input_dp_ids=dp_ids,
                    ucm_only=not direct_dp_ids and bool(ucm_ids),
                )
        
        # Step 2: 카테고리 정확 매칭
        if not dp_ids:
            _subsidiary_trace(
                "Step2 진입: dp_ids 없음 — 처음부터 카테고리 정확 매칭",
                category=category,
            )
        else:
            _subsidiary_trace(
                "Step2 진입: Step1 이후 폴백 — 카테고리 정확 매칭 (DP 교차 미충족)",
                category=category,
                dp_ids=list(dp_ids),
            )
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
            WHERE report_year = $1
              AND category = $2
        """
        exact_query += f" ORDER BY report_year DESC LIMIT {limit}"
        rows = await conn.fetch(exact_query, year, category)
        
        if rows:
            await conn.close()
            result = [dict(row) for row in rows]
            logger.info("query_subsidiary_data: 카테고리 정확 매칭 %d건", len(result))
            _subsidiary_trace(
                "종료 branch=category_exact (DP 필터 미적용)",
                rows=len(result),
                year=year,
                category=category,
            )
            return result
        
        # Step 3: 카테고리 벡터 유사도 검색
        _subsidiary_trace(
            "Step3 진입: 카테고리 벡터 유사도 (DP 필터 미적용)",
            category=category,
        )
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
                (category_embedding <-> $2::vector) as similarity
            FROM subsidiary_data_contributions
            WHERE report_year = $1
              AND category_embedding IS NOT NULL
        """
        
        vector_query += f"""
            ORDER BY similarity
            LIMIT {limit}
        """

        rows = await conn.fetch(vector_query, year, category_embedding)
        
        if rows:
            await conn.close()
            result = [dict(row) for row in rows]
            for item in result:
                item.pop("similarity", None)
            logger.info("query_subsidiary_data: 카테고리 벡터 검색 %d건", len(result))
            _subsidiary_trace(
                "종료 branch=category_vector (DP 필터 미적용)",
                rows=len(result),
                year=year,
                category=category,
            )
            return result
        
        # Step 4: 폴백 — category·company 없이 report_year 만으로 조회
        _subsidiary_trace(
            "Step4 진입: report_year 만 (company·category·DP 필터 미적용)",
            year=year,
        )
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
            WHERE report_year = $1
        """
        fallback_query += f" ORDER BY report_year DESC LIMIT {limit}"
        rows = await conn.fetch(fallback_query, year)
        
        await conn.close()
        
        result = [dict(row) for row in rows]
        logger.info("query_subsidiary_data: 폴백 (category 무시) %d건", len(result))
        _subsidiary_trace(
            "종료 branch=year_only (company·DP·category 필터 미적용)",
            rows=len(result),
            year=year,
        )
        return result
    
    except Exception as e:
        logger.error("query_subsidiary_data failed: %s", e, exc_info=True)
        _subsidiary_trace("오류로 빈 목록 반환", error=str(e))
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
