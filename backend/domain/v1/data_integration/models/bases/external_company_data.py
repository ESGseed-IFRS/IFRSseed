"""`external_company_data` ORM (Alembic 037) — data_integration 도메인."""

from __future__ import annotations

import uuid

from sqlalchemy import Column, Date, Integer, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.sql import func

from backend.domain.v1.esg_data.models.bases._embedding import vector_column

try:
    from ifrs_agent.database.base import Base
except ImportError:
    from backend.domain.v1.ifrs_agent.database.base import Base


class ExternalCompanyData(Base):
    __tablename__ = "external_company_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    anchor_company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    external_org_name = Column(Text, nullable=True)
    source_type = Column(Text, nullable=False)
    source_url = Column(Text, nullable=True)
    report_year = Column(Integer, nullable=True)
    as_of_date = Column(Date, nullable=True)
    category = Column(Text, nullable=True)
    category_embedding = Column(vector_column(1024), nullable=True)
    title = Column(Text, nullable=True)
    body_text = Column(Text, nullable=True)
    body_embedding = Column(vector_column(1024), nullable=True)
    structured_payload = Column(JSONB, nullable=True)
    related_dp_ids = Column(ARRAY(Text), nullable=True)
    fetched_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    ingest_batch_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
