"""
SR 보고서 본문 검색 툴

카테고리 기반 검색 — 스키마: sr_report_body + historical_sr_reports 조인
(본문 content_text, 벡터 content_embedding, 연·회사는 historical_sr_reports)
"""
import logging
from typing import Any, Dict, List, Optional, Sequence

from backend.domain.shared.tool.ifrs_agent.database.asyncpg_connect import connect_ifrs_asyncpg

logger = logging.getLogger("ifrs_agent.tools.sr_body_query")


def _embedding_to_pgvector_literal(embedding: Sequence[float]) -> str:
    """asyncpg는 list를 vector로 인코딩하지 않음 — pgvector 입력용 텍스트 리터럴."""
    return "[" + ",".join(str(float(x)) for x in embedding) + "]"


async def query_sr_body_exact(params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    SR 본문 검색: 회사·연도 고정 후 subtitle / toc_path 우선순위 매칭.

    1순위: (subtitle 완전일치 ∧ toc_path 에 키워드 포함) ∨ (toc_path 완전일치 ∧ subtitle 포함)
    2순위: 한 컬럼만 포함(다른 컬럼은 미포함) — XOR
    3순위: 두 컬럼 모두 포함

    동순위·동일 순위 내에서는 page_number 오름차순 첫 행.
    content_text 는 이 단계에서 제외(벡터 폴백).

    Args:
        params: company_id (str), category (str), year (int)

    Returns:
        {"body", "page_number", "report_id"} 또는 None
    """
    company_id = params["company_id"]
    category = (params.get("category") or "").strip()
    year = params["year"]

    logger.info("query_sr_body_exact: company_id=%s, category=%s, year=%s", company_id, category, year)

    if not category:
        logger.info("query_sr_body_exact: empty category — skip")
        return None

    try:
        conn = await connect_ifrs_asyncpg()

        query = """
            WITH cand AS (
                SELECT
                    b.content_text AS body,
                    b.page_number,
                    b.report_id,
                    lower(trim(COALESCE(b.subtitle, ''))) AS sub_norm,
                    lower(trim(COALESCE(b.toc_path::text, ''))) AS toc_norm,
                    lower(trim($2::text)) AS kw,
                    strpos(lower(COALESCE(b.subtitle, '')), lower(trim($2::text))) > 0 AS sub_cont,
                    strpos(lower(COALESCE(b.toc_path::text, '')), lower(trim($2::text))) > 0 AS toc_cont
                FROM sr_report_body b
                INNER JOIN historical_sr_reports r ON r.id = b.report_id
                WHERE r.company_id = $1::uuid
                  AND r.report_year = $3
            ),
            ranked AS (
                SELECT
                    body,
                    page_number,
                    report_id,
                    CASE
                        WHEN (sub_norm = kw AND toc_cont) OR (toc_norm = kw AND sub_cont) THEN 1
                        WHEN (sub_cont AND NOT toc_cont) OR (toc_cont AND NOT sub_cont) THEN 2
                        WHEN sub_cont AND toc_cont THEN 3
                        ELSE 4
                    END AS match_rank
                FROM cand
            )
            SELECT body, page_number, report_id
            FROM ranked
            WHERE match_rank <= 3
            ORDER BY match_rank, page_number
            LIMIT 1
        """

        row = await conn.fetchrow(query, company_id, category, year)

        await conn.close()

        if row:
            return dict(row)

        return None

    except Exception as e:
        logger.error("query_sr_body_exact failed: %s", e, exc_info=True)
        raise


async def query_sr_body_vector(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    SR 본문 벡터 유사도 (content_embedding, 코사인 <=>).

    Args:
        params: company_id, embedding (list[float]), year, top_k
    """
    company_id = params["company_id"]
    embedding = params["embedding"]
    year = params["year"]
    top_k = int(params.get("top_k", 1))
    top_k = max(1, min(top_k, 20))

    logger.info("query_sr_body_vector: company_id=%s, year=%s, top_k=%s", company_id, year, top_k)

    try:
        conn = await connect_ifrs_asyncpg()

        query = """
            SELECT
                b.content_text AS body,
                b.page_number,
                b.report_id,
                b.subtitle,
                b.toc_path,
                1 - (b.content_embedding <=> $2::vector) AS similarity
            FROM sr_report_body b
            INNER JOIN historical_sr_reports r ON r.id = b.report_id
            WHERE r.company_id = $1::uuid
              AND r.report_year = $3
              AND b.content_embedding IS NOT NULL
            ORDER BY b.content_embedding <=> $2::vector
            LIMIT $4
        """

        vec_lit = _embedding_to_pgvector_literal(embedding)
        rows = await conn.fetch(query, company_id, vec_lit, year, top_k)

        await conn.close()

        out: List[Dict[str, Any]] = []
        for row in rows:
            d = dict(row)
            sim = d.get("similarity")
            if sim is not None:
                d["similarity"] = float(sim)
            out.append(d)
        return out

    except Exception as e:
        logger.error("query_sr_body_vector failed: %s", e, exc_info=True)
        raise


async def query_sr_body_by_id(params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    ✨ 신규: SR 본문을 ID로 직접 조회 (검색 없음)
    
    Args:
        params: body_id (str) - sr_report_body.id (UUID)
    
    Returns:
        {
            "content_text": str,
            "page_number": int,
            "report_id": str (UUID),
            "subtitle": str,
            "toc_path": str
        }
        또는 None (ID가 없는 경우)
    """
    body_id = params["body_id"]
    
    logger.info(f"query_sr_body_by_id: body_id={body_id}")
    
    try:
        conn = await connect_ifrs_asyncpg()
        
        query = """
            SELECT
                b.content_text,
                b.page_number,
                b.report_id,
                b.subtitle,
                b.toc_path
            FROM sr_report_body b
            WHERE b.id = $1::uuid
        """
        
        row = await conn.fetchrow(query, body_id)
        await conn.close()
        
        if row:
            logger.info(f"query_sr_body_by_id: found — page_number={row['page_number']}")
            return dict(row)
        
        logger.warning(f"query_sr_body_by_id: not found — body_id={body_id}")
        return None
        
    except Exception as e:
        logger.error(f"query_sr_body_by_id failed: {e}", exc_info=True)
        raise
