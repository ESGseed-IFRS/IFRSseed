"""
SR 본문 컨텍스트 조회: toc_path, subtitle 기반 SR 본문 검색

aggregation_node에서 전년도 SR 본문을 조회하여
데이터 소스 유형을 판단하는 데 사용합니다.
"""
import logging
from typing import Any, Dict, List, Optional

from backend.domain.shared.tool.ifrs_agent.database.asyncpg_connect import connect_ifrs_asyncpg

logger = logging.getLogger("ifrs_agent.tools.sr_body_context_query")


async def query_sr_body_by_context(
    company_id: str,
    year: int,
    toc_path: List[str],
    subtitle: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    toc_path + subtitle 기준으로 SR 본문 조회.
    
    검색 전략:
    1. toc_path 정확 매칭 + subtitle 매칭 (있으면)
    2. toc_path 부분 매칭 (마지막 2개 요소)
    3. toc_path 첫 번째 요소만 매칭
    
    Args:
        company_id: 회사 UUID
        year: 보고 연도
        toc_path: 목차 경로 배열 (예: ["ESG PERFORMANCE", "GOVERNANCE", "기후변화 거버넌스"])
        subtitle: 부제목 (선택)
    
    Returns:
        {
            "id": UUID,
            "report_id": UUID,
            "page_number": int,
            "content_text": str,
            "toc_path": List[str],
            "subtitle": str,
            "content_embedding": List[float],
            "parsed_at": datetime
        }
        또는 None (결과 없음)
    """
    if not company_id or not year or not toc_path:
        logger.warning("query_sr_body_by_context: 필수 파라미터 누락")
        return None
    
    try:
        conn = await connect_ifrs_asyncpg()
        
        # 1단계: toc_path 정확 매칭 + subtitle 매칭
        if subtitle:
            exact_query = """
                SELECT 
                    b.id,
                    b.report_id,
                    b.page_number,
                    b.content_text,
                    b.toc_path,
                    b.subtitle,
                    b.content_embedding,
                    b.parsed_at
                FROM sr_report_body b
                JOIN historical_sr_reports r ON b.report_id = r.id
                WHERE r.company_id = $1::uuid
                  AND r.report_year = $2
                  AND b.toc_path = $3
                  AND b.subtitle ILIKE $4
                ORDER BY b.page_number
                LIMIT 1
            """
            row = await conn.fetchrow(
                exact_query,
                company_id,
                year,
                toc_path,
                f"%{subtitle}%"
            )
            if row:
                await conn.close()
                return dict(row)
        
        # 2단계: toc_path 정확 매칭 (subtitle 없이)
        exact_toc_query = """
            SELECT 
                b.id,
                b.report_id,
                b.page_number,
                b.content_text,
                b.toc_path,
                b.subtitle,
                b.content_embedding,
                b.parsed_at
            FROM sr_report_body b
            JOIN historical_sr_reports r ON b.report_id = r.id
            WHERE r.company_id = $1::uuid
              AND r.report_year = $2
              AND b.toc_path = $3
            ORDER BY b.page_number
            LIMIT 1
        """
        row = await conn.fetchrow(exact_toc_query, company_id, year, toc_path)
        if row:
            await conn.close()
            return dict(row)
        
        # 3단계: toc_path 부분 매칭 (마지막 2개 요소)
        if len(toc_path) >= 2:
            partial_toc = toc_path[-2:]
            partial_query = """
                SELECT 
                    b.id,
                    b.report_id,
                    b.page_number,
                    b.content_text,
                    b.toc_path,
                    b.subtitle,
                    b.content_embedding,
                    b.parsed_at
                FROM sr_report_body b
                JOIN historical_sr_reports r ON b.report_id = r.id
                WHERE r.company_id = $1::uuid
                  AND r.report_year = $2
                  AND b.toc_path @> $3::jsonb
                ORDER BY b.page_number
                LIMIT 1
            """
            row = await conn.fetchrow(partial_query, company_id, year, partial_toc)
            if row:
                await conn.close()
                return dict(row)
        
        # 4단계: toc_path 첫 번째 요소만 매칭
        if len(toc_path) >= 1:
            first_toc = [toc_path[0]]
            first_query = """
                SELECT 
                    b.id,
                    b.report_id,
                    b.page_number,
                    b.content_text,
                    b.toc_path,
                    b.subtitle,
                    b.content_embedding,
                    b.parsed_at
                FROM sr_report_body b
                JOIN historical_sr_reports r ON b.report_id = r.id
                WHERE r.company_id = $1::uuid
                  AND r.report_year = $2
                  AND b.toc_path @> $3::jsonb
                ORDER BY b.page_number
                LIMIT 1
            """
            row = await conn.fetchrow(first_query, company_id, year, first_toc)
            if row:
                await conn.close()
                return dict(row)
        
        await conn.close()
        logger.info(
            "query_sr_body_by_context: 결과 없음 (company_id=%s, year=%s, toc_path=%s)",
            company_id, year, toc_path
        )
        return None
    
    except Exception as e:
        logger.error(
            "query_sr_body_by_context failed: %s",
            e,
            exc_info=True
        )
        return None


async def query_sr_body_by_page(params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    페이지 번호로 SR 본문 조회 (Infra 툴 — params dict).

    Args:
        params: company_id (str), year (int), page_number (int)

    Returns:
        {
            "body": str (content_text),
            "page_number": int,
            "report_id": str,
            "subtitle": ...,
            "toc_path": ...,
            ... 기타 컬럼
        }
        또는 None
    """
    company_id = params.get("company_id")
    year = params.get("year")
    page_number = params.get("page_number")
    if company_id is None or year is None or page_number is None:
        logger.warning("query_sr_body_by_page: 필수 파라미터 누락")
        return None
    try:
        y = int(year)
        pn = int(page_number)
    except (TypeError, ValueError):
        logger.warning("query_sr_body_by_page: year/page_number 정수 변환 실패")
        return None

    try:
        conn = await connect_ifrs_asyncpg()

        query = """
            SELECT 
                b.id,
                b.report_id,
                b.page_number,
                b.content_text,
                b.toc_path,
                b.subtitle,
                b.content_embedding,
                b.parsed_at
            FROM sr_report_body b
            JOIN historical_sr_reports r ON b.report_id = r.id
            WHERE r.company_id = $1::uuid
              AND r.report_year = $2
              AND b.page_number = $3
            LIMIT 1
        """
        row = await conn.fetchrow(query, company_id, y, pn)
        await conn.close()

        if not row:
            return None

        d = dict(row)
        rid = d.get("report_id")
        if rid is not None and hasattr(rid, "hex"):
            d["report_id"] = str(rid)
        # c_rag 벡터 결과와 동일하게 body 키 제공
        if "content_text" in d:
            d["body"] = d["content_text"]
        return d

    except Exception as e:
        logger.error("query_sr_body_by_page failed: %s", e, exc_info=True)
        return None
