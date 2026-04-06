"""
Data Point 기반 실데이터 조회 툴

DP 메타데이터, UCM 조회, 실데이터 조회 (화이트리스트 기반)
"""
import logging
from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from backend.domain.shared.tool.ifrs_agent.database.asyncpg_connect import connect_ifrs_asyncpg

logger = logging.getLogger("ifrs_agent.tools.dp_query")


async def query_dp_metadata(params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    data_points 테이블에서 DP 메타데이터 조회.
    
    Args:
        params: {"dp_id": str}
    
    Returns:
        {
            "dp_id": str,
            "name_ko": str,
            "name_en": str,
            "description": str,
            "topic": str,
            "subtopic": str,
            "category": str,  # 'E', 'S', 'G'
            "dp_type": str,  # 'quantitative', 'qualitative', 'narrative', 'binary'
            "unit": str,
            "validation_rules": dict,
            "child_dps": list,  # Phase 1.5: 하위 DP 목록
            "parent_indicator": str,  # Phase 1.5: 상위 DP ID
        }
    """
    dp_id = params["dp_id"]
    
    logger.info("query_dp_metadata: dp_id=%s", dp_id)
    
    try:
        conn = await connect_ifrs_asyncpg()
        
        query = """
            SELECT 
                dp_id,
                name_ko,
                name_en,
                description,
                topic,
                subtopic,
                category,
                dp_type,
                unit::text as unit,
                validation_rules,
                child_dps,
                parent_indicator
            FROM data_points
            WHERE dp_id = $1
            LIMIT 1
        """
        
        row = await conn.fetchrow(query, dp_id)
        await conn.close()
        
        if row:
            return dict(row)
        
        return None
    
    except Exception as e:
        logger.error("query_dp_metadata failed: %s", e, exc_info=True)
        raise


async def query_ucm_by_dp(params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    unified_column_mappings에서 mapped_dp_ids로 UCM 조회.
    
    Args:
        params: {"dp_id": str}
    
    Returns:
        {
            "unified_column_id": str,
            "column_name_ko": str,
            "column_name_en": str,
            "column_category": str,  # 'E', 'S', 'G'
            "column_topic": str,
            "column_subtopic": str,
            "column_description": str,
            "unit": str,
            "validation_rules": dict,
            "disclosure_requirement": str,
            "financial_linkages": list,
        }
    """
    dp_id = params["dp_id"]
    
    logger.info("query_ucm_by_dp: dp_id=%s", dp_id)
    
    try:
        conn = await connect_ifrs_asyncpg()
        
        query = """
            SELECT 
                unified_column_id,
                column_name_ko,
                column_name_en,
                column_category,
                column_topic,
                column_subtopic,
                column_description,
                unit,
                validation_rules,
                disclosure_requirement,
                financial_linkages,
                primary_rulebook_id,
                rulebook_conflicts,
                standard_metadata
            FROM unified_column_mappings
            WHERE $1 = ANY(mapped_dp_ids)
            LIMIT 1
        """
        
        row = await conn.fetchrow(query, dp_id)
        await conn.close()
        
        if row:
            return dict(row)
        
        return None
    
    except Exception as e:
        logger.error("query_ucm_by_dp failed: %s", e, exc_info=True)
        raise


async def query_ucm_direct(params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    unified_column_mappings에서 unified_column_id로 직접 조회.
    
    Args:
        params: {"ucm_id": str}
    
    Returns:
        {
            "unified_column_id": str,
            "column_name_ko": str,
            "column_name_en": str,
            "column_category": str,  # 'E', 'S', 'G'
            "column_topic": str,
            "column_subtopic": str,
            "column_description": str,
            "unit": str,
            "validation_rules": dict,
            "disclosure_requirement": str,
            "financial_linkages": list,
            "mapped_dp_ids": list,  # UCM이 매핑하는 DP들
        }
    """
    ucm_id = params["ucm_id"]
    
    logger.info("query_ucm_direct: ucm_id=%s", ucm_id)
    
    try:
        conn = await connect_ifrs_asyncpg()
        
        query = """
            SELECT 
                unified_column_id,
                column_name_ko,
                column_name_en,
                column_category,
                column_topic,
                column_subtopic,
                column_description,
                unit,
                validation_rules,
                disclosure_requirement,
                financial_linkages,
                mapped_dp_ids,
                primary_rulebook_id,
                rulebook_conflicts,
                standard_metadata
            FROM unified_column_mappings
            WHERE unified_column_id = $1
            LIMIT 1
        """
        
        row = await conn.fetchrow(query, ucm_id)
        await conn.close()
        
        if row:
            return dict(row)
        
        return None
    
    except Exception as e:
        logger.error("query_ucm_direct failed: %s", e, exc_info=True)
        raise


async def query_rulebook(params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    rulebooks 테이블에서 rulebook_id로 조회 (gen_node·문단 생성용 메타).

    Args:
        params: {"rulebook_id": str}

    Returns:
        공시 요구 본문·인용·충돌 등 JSON 직렬화 가능한 dict, 없으면 None.
    """
    rulebook_id = (params.get("rulebook_id") or "").strip()
    if not rulebook_id:
        return None

    logger.info("query_rulebook: rulebook_id=%s", rulebook_id)

    try:
        conn = await connect_ifrs_asyncpg()

        query = """
            SELECT
                rulebook_id,
                standard_id,
                section_name,
                rulebook_title,
                rulebook_content,
                paragraph_reference,
                disclosure_requirement::text AS disclosure_requirement,
                validation_rules,
                conflicts_with,
                mapping_notes,
                key_terms,
                related_concepts,
                primary_dp_id,
                related_dp_ids,
                version,
                effective_date,
                is_primary
            FROM rulebooks
            WHERE rulebook_id = $1
              AND COALESCE(is_active, true) = true
            LIMIT 1
        """

        row = await conn.fetchrow(query, rulebook_id)
        await conn.close()

        if not row:
            return None

        out = dict(row)
        ed = out.get("effective_date")
        if ed is not None and hasattr(ed, "isoformat"):
            out["effective_date"] = ed.isoformat()
        return out

    except Exception as e:
        logger.error("query_rulebook failed: %s", e, exc_info=True)
        raise


async def query_rulebook_by_primary_dp_id(
    params: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """
    rulebooks 테이블에서 primary_dp_id로 조회 (UCM에 primary_rulebook_id가 없을 때 fallback).

    동일 DP에 여러 rulebook이 있으면 is_primary 우선, 그다음 version, rulebook_id 순으로 1건 선택.

    Args:
        params: {"dp_id": str} — data_points.dp_id와 rulebooks.primary_dp_id가 일치하는 행

    Returns:
        query_rulebook과 동일 스키마의 dict, 없으면 None.
    """
    dp_id = (params.get("dp_id") or "").strip()
    if not dp_id:
        return None

    logger.info("query_rulebook_by_primary_dp_id: dp_id=%s", dp_id)

    try:
        conn = await connect_ifrs_asyncpg()

        query = """
            SELECT
                rulebook_id,
                standard_id,
                section_name,
                rulebook_title,
                rulebook_content,
                paragraph_reference,
                disclosure_requirement::text AS disclosure_requirement,
                validation_rules,
                conflicts_with,
                mapping_notes,
                key_terms,
                related_concepts,
                primary_dp_id,
                related_dp_ids,
                version,
                effective_date,
                is_primary
            FROM rulebooks
            WHERE primary_dp_id = $1
              AND COALESCE(is_active, true) = true
            ORDER BY
                is_primary DESC NULLS LAST,
                version DESC NULLS LAST,
                rulebook_id
            LIMIT 1
        """

        row = await conn.fetchrow(query, dp_id)
        await conn.close()

        if not row:
            return None

        out = dict(row)
        ed = out.get("effective_date")
        if ed is not None and hasattr(ed, "isoformat"):
            out["effective_date"] = ed.isoformat()
        return out

    except Exception as e:
        logger.error("query_rulebook_by_primary_dp_id failed: %s", e, exc_info=True)
        raise


async def query_unmapped_dp(params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    unmapped_data_points 테이블에서 미매핑 DP 조회.
    
    Args:
        params: {"dp_id": str}
    
    Returns:
        {
            "id": str,
            "dp_id": str,
            "name_ko": str,
            "name_en": str,
            "category": str,
            "unit": str,
            "validation_rules": dict,
            "mapping_status": str
        }
    """
    dp_id = params["dp_id"]
    
    logger.info("query_unmapped_dp: dp_id=%s", dp_id)
    
    try:
        conn = await connect_ifrs_asyncpg()
        
        query = """
            SELECT 
                id,
                dp_id,
                name_ko,
                name_en,
                category,
                unit,
                validation_rules,
                mapping_status
            FROM unmapped_data_points
            WHERE dp_id = $1
              AND is_active = true
            LIMIT 1
        """
        
        row = await conn.fetchrow(query, dp_id)
        await conn.close()
        
        if row:
            result = dict(row)
            if isinstance(result.get("id"), UUID):
                result["id"] = str(result["id"])
            return result
        
        return None
    
    except Exception as e:
        logger.error("query_unmapped_dp failed: %s", e, exc_info=True)
        raise


async def query_dp_real_data(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    실데이터 테이블에서 값 조회 (화이트리스트 검증된 table/column).
    
    Args:
        params: {
            "company_id": str,
            "year": int,
            "table": str,  # "social_data" | "environmental_data" | "governance_data"
            "column": str,
            "data_type": str?  # social_data/governance_data만 필요
        }
    
    Returns:
        {
            "value": Any,
            "period_year": int,
            "status": str,
            "updated_at": str,
            "error": str?
        }
    """
    company_id = params["company_id"]
    year = params["year"]
    table = params["table"]
    column = params["column"]
    data_type = params.get("data_type")
    
    logger.info(
        "query_dp_real_data: company_id=%s, year=%s, table=%s, column=%s, data_type=%s",
        company_id,
        year,
        table,
        column,
        data_type,
    )
    
    # 테이블 화이트리스트 검증
    if table not in ("social_data", "environmental_data", "governance_data"):
        return {"error": f"Invalid table: {table}"}
    
    try:
        conn = await connect_ifrs_asyncpg()
        
        # 동적 쿼리 (psycopg2.sql.Identifier 대신 문자열 검증 후 삽입)
        # column은 이미 화이트리스트 검증됨
        
        if table in ("social_data", "governance_data"):
            if not data_type:
                await conn.close()
                return {"error": f"{table} requires data_type"}
            
            query = f"""
                SELECT 
                    {column} as value,
                    period_year,
                    status,
                    updated_at
                FROM {table}
                WHERE company_id = $1::uuid
                  AND period_year = $2
                  AND data_type = $3
                ORDER BY updated_at DESC
                LIMIT 1
            """
            row = await conn.fetchrow(query, company_id, year, data_type)
        
        else:  # environmental_data
            query = f"""
                SELECT 
                    {column} as value,
                    period_year,
                    status,
                    updated_at
                FROM {table}
                WHERE company_id = $1::uuid
                  AND period_year = $2
                ORDER BY updated_at DESC
                LIMIT 1
            """
            row = await conn.fetchrow(query, company_id, year)
        
        await conn.close()
        
        if row:
            result = dict(row)
            # Decimal/UUID 등 JSON 직렬화 가능하게 변환
            if isinstance(result.get("value"), Decimal):
                result["value"] = float(result["value"])
            if isinstance(result.get("value"), UUID):
                result["value"] = str(result["value"])
            if result.get("updated_at"):
                result["updated_at"] = result["updated_at"].isoformat()
            return result
        
        return {"error": f"No data found for {table}.{column} (year={year})"}
    
    except Exception as e:
        logger.error("query_dp_real_data failed: %s", e, exc_info=True)
        return {"error": str(e)}


async def query_company_info(params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    `company_info` 1행 조회 — DP와 무관, 회사 맥락(미션·비전·산업 등)용.

    `period_year`가 없는 프로필 테이블이므로 `query_dp_real_data`와 분리한다.
    전화·이메일·등록 `address` 컬럼은 응답에 포함하지 않는다.
    공시용 `headquarters_address` / `headquarters_city` 등은 포함한다.

    Args:
        params: {"company_id": str (UUID)}

    Returns:
        JSON 직렬화 가능한 dict 또는 행 없음/오류 시 None.
    """
    company_id = params.get("company_id")
    if not company_id:
        return None

    logger.info("query_company_info: company_id=%s", company_id)

    try:
        conn = await connect_ifrs_asyncpg()

        query = """
            SELECT
                company_id::text AS company_id,
                company_name_ko,
                company_name_en,
                business_registration_number,
                representative_name,
                industry,
                website,
                mission,
                vision,
                esg_goals,
                carbon_neutral_target_year,
                total_employees,
                major_shareholders,
                stakeholders,
                submitted_to_final_report,
                board_chairman_name,
                board_total_members,
                board_independent_members,
                board_female_members,
                audit_committee_chairman,
                esg_committee_exists,
                esg_committee_chairman,
                cfo_name,
                cso_name,
                fiscal_year_end,
                stock_code,
                listing_market,
                total_revenue_krw,
                total_assets_krw,
                headquarters_address,
                headquarters_city,
                female_employees,
                female_ratio_percent,
                permanent_employees,
                contract_employees,
                sustainability_report_published,
                sustainability_report_year,
                gri_standards_version,
                tcfd_aligned,
                cdp_participant,
                iso14001_certified,
                iso45001_certified,
                updated_at
            FROM company_info
            WHERE company_id = $1::uuid
            LIMIT 1
        """

        row = await conn.fetchrow(query, company_id)
        await conn.close()

        if not row:
            return None

        out: Dict[str, Any] = dict(row)
        fr = out.get("female_ratio_percent")
        if isinstance(fr, Decimal):
            out["female_ratio_percent"] = float(fr)
        ua = out.get("updated_at")
        if ua is not None and hasattr(ua, "isoformat"):
            out["updated_at"] = ua.isoformat()
        return out

    except Exception as e:
        logger.error("query_company_info failed: %s", e, exc_info=True)
        return None


# 하위 호환 (기존 query_dp_data는 deprecated)
async def query_dp_data(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    [Deprecated] 기존 인터페이스 — 새 코드는 query_dp_metadata + query_dp_real_data 사용.
    """
    logger.warning("query_dp_data is deprecated, use query_dp_metadata + query_dp_real_data")
    
    dp_id = params["dp_id"]
    company_id = params["company_id"]
    year = params["year"]
    
    # 간단한 폴백: 메타만 조회
    dp_meta = await query_dp_metadata({"dp_id": dp_id})
    
    return {
        "dp_id": dp_id,
        "table_name": None,
        "column_name": None,
        "value": None,
        "unit": dp_meta.get("unit") if dp_meta else None,
        "year": year,
        "error": "Deprecated API — use new tools",
    }

