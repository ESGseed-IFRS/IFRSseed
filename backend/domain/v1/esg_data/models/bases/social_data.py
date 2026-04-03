"""통합 사회 데이터 ORM — 테이블 `social_data` (Alembic 019)."""

from __future__ import annotations

import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    Integer,
    Numeric,
    Text,
    TIMESTAMP,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from backend.core.db import Base


class SocialData(Base):
    """사회 지표 통합 (인력, 안전보건, 협력회사, 사회공헌)."""

    __tablename__ = "social_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # DB에는 FK(companies.id)가 있을 수 있으나, companies ORM이 이 Base 메타데이터에 없어
    # ForeignKey()를 선언하면 flush 시 NoReferencedTableError가 난다.
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    data_type = Column(Text, nullable=False)
    period_year = Column(Integer, nullable=False)

    total_employees = Column(Integer, nullable=True)
    male_employees = Column(Integer, nullable=True)
    female_employees = Column(Integer, nullable=True)
    disabled_employees = Column(Integer, nullable=True)
    average_age = Column(Numeric(5, 2), nullable=True)
    turnover_rate = Column(Numeric(5, 2), nullable=True)

    total_incidents = Column(Integer, nullable=True)
    fatal_incidents = Column(Integer, nullable=True)
    lost_time_injury_rate = Column(Numeric(5, 2), nullable=True)
    total_recordable_injury_rate = Column(Numeric(5, 2), nullable=True)
    safety_training_hours = Column(Numeric(10, 2), nullable=True)

    total_suppliers = Column(Integer, nullable=True)
    supplier_purchase_amount = Column(Numeric(18, 2), nullable=True)
    esg_evaluated_suppliers = Column(Integer, nullable=True)

    social_contribution_cost = Column(Numeric(18, 2), nullable=True)
    volunteer_hours = Column(Numeric(10, 2), nullable=True)

    status = Column(Text, server_default="draft", nullable=True)
    approved_by = Column(Text, nullable=True)
    approved_at = Column(TIMESTAMP(timezone=True), nullable=True)
    final_approved_at = Column(TIMESTAMP(timezone=True), nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "data_type IN ('workforce', 'safety', 'supply_chain', 'community')",
            name="chk_social_data_type",
        ),
    )
