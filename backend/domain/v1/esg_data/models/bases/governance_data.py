"""통합 지배구조 데이터 ORM — 테이블 `governance_data` (Alembic 019)."""

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


class GovernanceData(Base):
    """지배구조 지표 통합 (이사회, 컴플라이언스, 윤리, 리스크)."""

    __tablename__ = "governance_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # DB에는 FK(companies.id)가 있을 수 있으나, companies ORM이 이 Base 메타데이터에 없어
    # ForeignKey()를 선언하면 flush 시 NoReferencedTableError가 난다.
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    data_type = Column(Text, nullable=False)
    period_year = Column(Integer, nullable=False)

    # Board (이사회) — 수치 + SR용 연도별 인명/사외이사 수
    board_chairman_name = Column(Text, nullable=True)
    ceo_name = Column(Text, nullable=True)
    independent_board_members = Column(Integer, nullable=True)
    audit_committee_chairman = Column(Text, nullable=True)
    esg_committee_chairman = Column(Text, nullable=True)
    total_board_members = Column(Integer, nullable=True)
    female_board_members = Column(Integer, nullable=True)
    board_meetings = Column(Integer, nullable=True)
    board_attendance_rate = Column(Numeric(5, 2), nullable=True)
    board_compensation = Column(Numeric(18, 2), nullable=True)

    # Compliance / Ethics (컴플라이언스 / 윤리)
    corruption_cases = Column(Integer, nullable=True)
    corruption_reports = Column(Integer, nullable=True)
    legal_sanctions = Column(Integer, nullable=True)

    # Risk / Security (리스크 / 정보보안)
    security_incidents = Column(Integer, nullable=True)
    data_breaches = Column(Integer, nullable=True)
    security_fines = Column(Numeric(18, 2), nullable=True)

    status = Column(Text, server_default="draft", nullable=True)
    approved_by = Column(Text, nullable=True)
    approved_at = Column(TIMESTAMP(timezone=True), nullable=True)
    final_approved_at = Column(TIMESTAMP(timezone=True), nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "data_type IN ('board', 'compliance', 'ethics', 'risk')",
            name="chk_governance_data_type",
        ),
    )
