"""sr_report_index 테이블 모델 (DP → 페이지 매핑)"""
from __future__ import annotations

import uuid
from sqlalchemy import Column, Text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY, NUMERIC
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP

try:
    from ifrs_agent.database.base import Base
except ImportError:
    from backend.domain.v1.ifrs_agent.database.base import Base


class SrReportIndex(Base):
    """sr_report_index (GRI/SASB/IFRS 인덱스 매핑)"""
    __tablename__ = "sr_report_index"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("historical_sr_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    index_type = Column(Text, nullable=False)
    index_page_number = Column(Integer, nullable=True)
    dp_id = Column(Text, nullable=False, index=True)
    dp_name = Column(Text, nullable=True)
    page_numbers = Column(ARRAY(Integer), nullable=False)
    section_title = Column(Text, nullable=True)
    remarks = Column(Text, nullable=True)
    parsed_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    parsing_method = Column(Text, server_default="docling", nullable=True)
    confidence_score = Column(NUMERIC(5, 2), nullable=True)
