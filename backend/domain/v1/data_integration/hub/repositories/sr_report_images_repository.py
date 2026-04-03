"""sr_report_images 조회 repository."""
from __future__ import annotations

import uuid
from typing import Optional

from loguru import logger
from sqlalchemy import func


def count_sr_report_images_rows(report_id: str) -> Optional[int]:
    """
    historical_sr_reports.id(report_id)에 해당하는 sr_report_images 행 개수.
    UUID 형식 오류·DB 오류 시 None.
    """
    try:
        rid = uuid.UUID(str(report_id).strip())
    except (ValueError, TypeError) as e:
        logger.warning("[sr_report_images_repository] report_id UUID 파싱 실패: {} ({})", report_id, e)
        return None

    try:
        from backend.domain.v1.ifrs_agent.database.base import get_session
        from backend.domain.v1.data_integration.models.bases import SrReportImage

        session = get_session()
        try:
            n = (
                session.query(func.count(SrReportImage.id))
                .filter(SrReportImage.report_id == rid)
                .scalar()
            )
            return int(n or 0)
        finally:
            session.close()
    except Exception as e:
        logger.warning("[sr_report_images_repository] sr_report_images 행 수 조회 실패: {}", e)
        return None
