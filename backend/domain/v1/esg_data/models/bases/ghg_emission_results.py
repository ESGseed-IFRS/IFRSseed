"""GHG 산정 결과 ORM — `ghg_emission_results` (Alembic 029)."""

from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from backend.core.db import Base


class GhgEmissionResults(Base):
    __tablename__ = "ghg_emission_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    period_year = Column(Integer, nullable=False)
    period_month = Column(Integer, nullable=True)

    scope1_total_tco2e = Column(Numeric(18, 4), nullable=True)
    scope1_fixed_combustion_tco2e = Column(Numeric(18, 4), nullable=True)
    scope1_mobile_combustion_tco2e = Column(Numeric(18, 4), nullable=True)
    scope1_fugitive_tco2e = Column(Numeric(18, 4), nullable=True)
    scope1_incineration_tco2e = Column(Numeric(18, 4), nullable=True)
    scope2_location_tco2e = Column(Numeric(18, 4), nullable=True)
    scope2_market_tco2e = Column(Numeric(18, 4), nullable=True)
    scope2_renewable_tco2e = Column(Numeric(18, 4), nullable=True)
    scope3_total_tco2e = Column(Numeric(18, 4), nullable=True)
    scope3_category_1_tco2e = Column(Numeric(18, 4), nullable=True)
    scope3_category_4_tco2e = Column(Numeric(18, 4), nullable=True)
    scope3_category_6_tco2e = Column(Numeric(18, 4), nullable=True)
    scope3_category_7_tco2e = Column(Numeric(18, 4), nullable=True)
    scope3_category_9_tco2e = Column(Numeric(18, 4), nullable=True)
    scope3_category_11_tco2e = Column(Numeric(18, 4), nullable=True)
    scope3_category_12_tco2e = Column(Numeric(18, 4), nullable=True)
    total_tco2e = Column(Numeric(18, 4), nullable=True)

    applied_framework = Column(Text, nullable=True)
    calculation_version = Column(Text, nullable=True)
    data_quality_score = Column(Numeric(5, 2), nullable=True)
    data_quality_level = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    calculation_basis = Column(Text, nullable=False, server_default="location")
    monthly_scope_breakdown = Column(JSONB, nullable=True)
    scope_line_items = Column(JSONB, nullable=True)
    emission_factor_bundle_version = Column(Text, nullable=True)
    verification_status = Column(Text, nullable=True, server_default="draft")
