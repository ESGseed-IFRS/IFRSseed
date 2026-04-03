"""`ingest_state` ORM — 크롤·변경 감지 상태 추적."""
from __future__ import annotations

import uuid
from sqlalchemy import Column, Text, VARCHAR
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP

try:
    from ifrs_agent.database.base import Base
except ImportError:
    from backend.domain.v1.ifrs_agent.database.base import Base


class IngestState(Base):
    """각 수집 태스크(SDS 뉴스 등)의 마지막 수집 상태·ETag 저장."""
    __tablename__ = "ingest_state"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_key = Column(VARCHAR(100), nullable=False, unique=True, index=True)
    last_etag = Column(Text, nullable=True)
    # 목록이 index.html 인지 news.txt JSON 인지 — ETag 비교 시 HEAD URL 선택
    last_list_source = Column(VARCHAR(20), nullable=True)
    last_modified = Column(Text, nullable=True)
    last_content_hash = Column(Text, nullable=True)
    last_fetch_at = Column(TIMESTAMP(timezone=True), nullable=True)
    last_ingest_batch_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
