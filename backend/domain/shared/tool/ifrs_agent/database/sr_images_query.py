"""
SR 보고서 이미지 검색 툴

선택된 페이지의 이미지 메타데이터 추출 (캡션, 타입, 크기, 배치 좌표, 시각)
"""
from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List
from uuid import UUID

from backend.domain.shared.tool.ifrs_agent.database.asyncpg_connect import connect_ifrs_asyncpg

logger = logging.getLogger("ifrs_agent.tools.sr_images_query")


def _jsonable_image_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """asyncpg Record → JSON 응답용 (UUID, datetime, Decimal, JSONB)."""
    out: Dict[str, Any] = {}
    for k, v in row.items():
        if v is None:
            out[k] = None
        elif isinstance(v, UUID):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, Decimal):
            out[k] = float(v)
        elif isinstance(v, (dict, list)):
            out[k] = v
        else:
            out[k] = v
    return out


async def query_sr_images(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    SR 이미지 메타데이터 검색

    Args:
        params: report_id, page_number

    Returns:
        각 원소: image_url, caption, image_type, image_width, image_height,
        placement_bboxes, extracted_at, image_index, id, caption_confidence
    """
    report_id = params["report_id"]
    page_number = params["page_number"]

    logger.info("query_sr_images: report_id=%s, page_number=%s", report_id, page_number)

    try:
        conn = await connect_ifrs_asyncpg()

        query = """
            SELECT
                id,
                image_index,
                ('sr-image:' || id::text) AS image_url,
                COALESCE(caption_text, '') AS caption,
                caption_confidence,
                image_type,
                image_width,
                image_height,
                placement_bboxes,
                extracted_at
            FROM sr_report_images
            WHERE report_id = $1::uuid
              AND page_number = $2
            ORDER BY image_index NULLS LAST, id
        """

        rows = await conn.fetch(query, report_id, page_number)

        await conn.close()

        return [_jsonable_image_row(dict(row)) for row in rows]

    except Exception as e:
        logger.error("query_sr_images failed: %s", e, exc_info=True)
        raise


async def query_sr_images_by_ids(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    ✨ 신규: SR 이미지를 ID 배열로 직접 조회
    
    Args:
        params: image_ids (List[str]) - sr_report_images.id 배열 (UUID)
    
    Returns:
        각 원소: image_url, caption, image_type, image_width, image_height,
        placement_bboxes, extracted_at, image_index, id, caption_confidence
        (image_ids 순서대로 정렬)
    """
    image_ids = params.get("image_ids", [])
    
    if not image_ids:
        logger.info("query_sr_images_by_ids: empty image_ids — returning []")
        return []
    
    logger.info(f"query_sr_images_by_ids: image_ids={image_ids} (count={len(image_ids)})")
    
    try:
        conn = await connect_ifrs_asyncpg()
        
        # IN 절로 여러 ID 조회
        query = """
            SELECT
                id,
                image_index,
                ('sr-image:' || id::text) AS image_url,
                COALESCE(caption_text, '') AS caption,
                caption_confidence,
                image_type,
                image_width,
                image_height,
                placement_bboxes,
                extracted_at,
                report_id,
                page_number
            FROM sr_report_images
            WHERE id = ANY($1::uuid[])
        """
        
        rows = await conn.fetch(query, image_ids)
        await conn.close()
        
        # 입력 순서대로 정렬 (image_ids의 인덱스 순)
        id_to_row = {str(row["id"]): dict(row) for row in rows}
        sorted_rows = []
        for img_id in image_ids:
            if img_id in id_to_row:
                sorted_rows.append(id_to_row[img_id])
        
        logger.info(f"query_sr_images_by_ids: found {len(sorted_rows)}/{len(image_ids)} images")
        
        return [_jsonable_image_row(row) for row in sorted_rows]
        
    except Exception as e:
        logger.error(f"query_sr_images_by_ids failed: {e}", exc_info=True)
        raise
