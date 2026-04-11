"""
holding_sr_page_mapping_sets — 회사·카탈로그별 페이지 SR 참조 ID (JSONB)

스키마는 프론트 `StoredSrMappingsPayload` 와 동일 (camelCase 키).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from backend.domain.shared.tool.ifrs_agent.database.asyncpg_connect import connect_ifrs_asyncpg

logger = logging.getLogger("ifrs_agent.tools.holding_sr_mappings_repo")


async def fetch_holding_sr_mapping_set(
    company_id: str,
    catalog_key: str = "sds_2024",
) -> Optional[Dict[str, Any]]:
    """
    Returns:
        {"version": int, "updatedAt": str ISO, "pages": {...}} or None
    """
    try:
        conn = await connect_ifrs_asyncpg()
        row = await conn.fetchrow(
            """
            SELECT schema_version, pages, updated_at
            FROM holding_sr_page_mapping_sets
            WHERE company_id = $1::uuid AND catalog_key = $2
            """,
            company_id,
            catalog_key,
        )
        await conn.close()
        if not row:
            return None
        pages = row["pages"]
        if isinstance(pages, str):
            pages = json.loads(pages)
        if not isinstance(pages, dict):
            pages = {}
        updated = row["updated_at"]
        if isinstance(updated, datetime):
            if updated.tzinfo is None:
                updated = updated.replace(tzinfo=timezone.utc)
            updated_at = updated.isoformat()
        else:
            updated_at = str(updated)
        return {
            "version": int(row["schema_version"] or 1),
            "updatedAt": updated_at,
            "pages": pages,
        }
    except Exception as e:
        logger.error("fetch_holding_sr_mapping_set failed: %s", e, exc_info=True)
        raise


async def upsert_holding_sr_mapping_set(
    company_id: str,
    catalog_key: str,
    pages: Dict[str, Any],
    schema_version: int = 1,
) -> Dict[str, Any]:
    """
    pages: Record<pageNumberStr, { srBodyIds: string[], srImageIds: string[] }>
    """
    try:
        conn = await connect_ifrs_asyncpg()
        pages_json = json.dumps(pages, ensure_ascii=False)
        await conn.execute(
            """
            INSERT INTO holding_sr_page_mapping_sets (
                company_id, catalog_key, schema_version, pages, updated_at
            )
            VALUES ($1::uuid, $2, $3, $4::jsonb, now())
            ON CONFLICT (company_id, catalog_key)
            DO UPDATE SET
                schema_version = EXCLUDED.schema_version,
                pages = EXCLUDED.pages,
                updated_at = now()
            """,
            company_id,
            catalog_key,
            schema_version,
            pages_json,
        )
        await conn.close()
        out = await fetch_holding_sr_mapping_set(company_id, catalog_key)
        return out or {"version": schema_version, "updatedAt": "", "pages": pages}
    except Exception as e:
        logger.error("upsert_holding_sr_mapping_set failed: %s", e, exc_info=True)
        raise


async def delete_holding_sr_mapping_set(
    company_id: str,
    catalog_key: str = "sds_2024",
) -> int:
    """삭제된 행 수 (0 또는 1)."""
    conn = await connect_ifrs_asyncpg()
    try:
        r = await conn.execute(
            """
            DELETE FROM holding_sr_page_mapping_sets
            WHERE company_id = $1::uuid AND catalog_key = $2
            """,
            company_id,
            catalog_key,
        )
        # asyncpg execute returns "DELETE N"
        parts = str(r).split()
        return int(parts[-1]) if parts else 0
    finally:
        await conn.close()
