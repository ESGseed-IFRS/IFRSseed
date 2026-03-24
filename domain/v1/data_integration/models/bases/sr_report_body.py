"""sr_report_body 테이블 모델 (페이지별 본문)"""
from __future__ import annotations

import uuid
from sqlalchemy import Column, Text, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP

try:
    from ifrs_agent.database.base import Base
except ImportError:
    from backend.domain.v1.ifrs_agent.database.base import Base


class SrReportBody(Base):
    """sr_report_body (페이지별 본문 텍스트)"""
    __tablename__ = "sr_report_body"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("historical_sr_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    is_index_page = Column(Boolean, server_default="false", nullable=True)
    content_text = Column(Text, nullable=False)
    content_type = Column(Text, nullable=True)
    paragraphs = Column(JSONB, nullable=True)
    # 보고서 인쇄 목차(Contents) 상의 계층: 예) ["ESG PERFORMANCE","ENVIRONMENTAL","기후변화 대응"]
    toc_path = Column(JSONB, nullable=True)
    embedding_id = Column(Text, nullable=True)
    embedding_status = Column(Text, server_default="pending", nullable=True)
    parsed_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
