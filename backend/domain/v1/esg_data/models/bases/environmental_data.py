"""환경 통합 지표 ORM — `environmental_data` (Alembic 019)."""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Column, Date, Integer, Numeric, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from backend.core.db import Base


class EnvironmentalData(Base):
    __tablename__ = "environmental_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    period_year = Column(Integer, nullable=False)
    period_month = Column(Integer, nullable=True)

    scope1_total_tco2e = Column(Numeric(18, 4), nullable=True)
    scope2_location_tco2e = Column(Numeric(18, 4), nullable=True)
    scope2_market_tco2e = Column(Numeric(18, 4), nullable=True)
    scope3_total_tco2e = Column(Numeric(18, 4), nullable=True)

    total_energy_consumption_mwh = Column(Numeric(18, 4), nullable=True)
    renewable_energy_mwh = Column(Numeric(18, 4), nullable=True)
    renewable_energy_ratio = Column(Numeric(5, 2), nullable=True)

    total_waste_generated = Column(Numeric(18, 4), nullable=True)
    waste_recycled = Column(Numeric(18, 4), nullable=True)
    waste_incinerated = Column(Numeric(18, 4), nullable=True)
    waste_landfilled = Column(Numeric(18, 4), nullable=True)
    hazardous_waste = Column(Numeric(18, 4), nullable=True)

    water_withdrawal = Column(Numeric(18, 4), nullable=True)
    water_consumption = Column(Numeric(18, 4), nullable=True)
    water_discharge = Column(Numeric(18, 4), nullable=True)
    water_recycling = Column(Numeric(18, 4), nullable=True)

    nox_emission = Column(Numeric(18, 4), nullable=True)
    sox_emission = Column(Numeric(18, 4), nullable=True)
    voc_emission = Column(Numeric(18, 4), nullable=True)
    dust_emission = Column(Numeric(18, 4), nullable=True)

    iso14001_certified = Column(Boolean, nullable=True)
    iso14001_cert_date = Column(Date, nullable=True)
    carbon_neutral_certified = Column(Boolean, nullable=True)
    carbon_neutral_cert_date = Column(Date, nullable=True)

    ghg_data_source = Column(Text, nullable=True)
    ghg_calculation_version = Column(Text, nullable=True)

    status = Column(Text, server_default="draft", nullable=True)
    approved_by = Column(Text, nullable=True)
    approved_at = Column(TIMESTAMP(timezone=True), nullable=True)
    final_approved_at = Column(TIMESTAMP(timezone=True), nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
