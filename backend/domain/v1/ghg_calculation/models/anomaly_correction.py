"""이상치 보정 이력 테이블 ORM."""
from __future__ import annotations

import uuid
from sqlalchemy import Column, Text, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP

from backend.core.db import Base


class AnomalyCorrection(Base):
    """이상치 보정 이력.
    
    원본 데이터 보존 및 보정 이력 추적을 위한 감사 테이블.
    """
    __tablename__ = "anomaly_corrections"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # 이상치 정보
    rule_code = Column(Text, nullable=False)  # MOM_RATIO, YOY_PCT 등
    severity = Column(Text, nullable=True)    # high, medium, low
    
    # 위치 정보
    staging_system = Column(Text, nullable=False)  # ems, erp, ehs 등
    staging_id = Column(UUID(as_uuid=True), nullable=True)
    facility = Column(Text, nullable=True)
    metric = Column(Text, nullable=True)      # 에너지 타입, 폐기물 타입 등
    year_month = Column(Text, nullable=True)  # YYYYMM 형식
    
    # 보정 데이터
    original_value = Column(Float, nullable=False)
    corrected_value = Column(Float, nullable=False)
    unit = Column(Text, nullable=True)
    
    # 보정 사유 및 컨텍스트
    reason = Column(Text, nullable=False)
    anomaly_context = Column(JSONB, nullable=True)  # 원본 이상치 context
    
    # 메타데이터
    corrected_by = Column(UUID(as_uuid=True), nullable=True)  # 보정 작업자 user_id
    corrected_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    
    # 감사 추적
    approved_by = Column(UUID(as_uuid=True), nullable=True)   # 승인자 (선택)
    approved_at = Column(TIMESTAMP(timezone=True), nullable=True)
    status = Column(Text, default="applied", nullable=False)  # applied, reverted, pending_approval
    
    # 보정 전후 비교 메타데이터 (검증 결과)
    validation_result = Column(JSONB, nullable=True)
