"""스테이징 테이블 ORM (DATABASE_TABLES_STRUCTURE.md 기준 7개)"""
from __future__ import annotations

import uuid
from sqlalchemy import Column, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.types import TIMESTAMP

from backend.core.db import Base


class StagingEmsData(Base):
    """EMS: 전력·열·스팀, 에너지, 폐기물"""
    __tablename__ = "staging_ems_data"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False)
    source_file_name = Column(Text, nullable=True)
    ghg_raw_category = Column(Text, nullable=True)
    # interface | file_upload | manual (I/F, 파일 업로드, 직접 입력)
    ingest_source = Column(Text, nullable=True)
    raw_data = Column(JSONB, nullable=False)
    import_status = Column(Text, default="pending", nullable=True)
    error_message = Column(Text, nullable=True)
    imported_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(TIMESTAMP(timezone=True), nullable=True)


class StagingErpData(Base):
    """ERP: 연료·차량, 구매"""
    __tablename__ = "staging_erp_data"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False)
    source_file_name = Column(Text, nullable=True)
    ghg_raw_category = Column(Text, nullable=True)
    ingest_source = Column(Text, nullable=True)
    raw_data = Column(JSONB, nullable=False)
    import_status = Column(Text, default="pending", nullable=True)
    error_message = Column(Text, nullable=True)
    imported_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(TIMESTAMP(timezone=True), nullable=True)


class StagingEhsData(Base):
    """EHS: 냉매, 안전·보건"""
    __tablename__ = "staging_ehs_data"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False)
    source_file_name = Column(Text, nullable=True)
    ghg_raw_category = Column(Text, nullable=True)
    ingest_source = Column(Text, nullable=True)
    raw_data = Column(JSONB, nullable=False)
    import_status = Column(Text, default="pending", nullable=True)
    error_message = Column(Text, nullable=True)
    imported_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(TIMESTAMP(timezone=True), nullable=True)


class StagingPlmData(Base):
    """PLM: 제품, BOM"""
    __tablename__ = "staging_plm_data"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False)
    source_file_name = Column(Text, nullable=True)
    ghg_raw_category = Column(Text, nullable=True)
    ingest_source = Column(Text, nullable=True)
    raw_data = Column(JSONB, nullable=False)
    import_status = Column(Text, default="pending", nullable=True)
    error_message = Column(Text, nullable=True)
    imported_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(TIMESTAMP(timezone=True), nullable=True)


class StagingSrmData(Base):
    """SRM: 물류, 원료, 협력회사"""
    __tablename__ = "staging_srm_data"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False)
    source_file_name = Column(Text, nullable=True)
    ghg_raw_category = Column(Text, nullable=True)
    ingest_source = Column(Text, nullable=True)
    raw_data = Column(JSONB, nullable=False)
    import_status = Column(Text, default="pending", nullable=True)
    error_message = Column(Text, nullable=True)
    imported_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(TIMESTAMP(timezone=True), nullable=True)


class StagingHrData(Base):
    """HR: 출장·통근, 인력"""
    __tablename__ = "staging_hr_data"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False)
    source_file_name = Column(Text, nullable=True)
    ghg_raw_category = Column(Text, nullable=True)
    ingest_source = Column(Text, nullable=True)
    raw_data = Column(JSONB, nullable=False)
    import_status = Column(Text, default="pending", nullable=True)
    error_message = Column(Text, nullable=True)
    imported_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(TIMESTAMP(timezone=True), nullable=True)


class StagingMdgData(Base):
    """MDG: 마스터 데이터(사이트/공급업체/계약업체 등)"""
    __tablename__ = "staging_mdg_data"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False)
    source_file_name = Column(Text, nullable=True)
    ghg_raw_category = Column(Text, nullable=True)
    ingest_source = Column(Text, nullable=True)
    raw_data = Column(JSONB, nullable=False)
    import_status = Column(Text, default="pending", nullable=True)
    error_message = Column(Text, nullable=True)
    imported_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(TIMESTAMP(timezone=True), nullable=True)


STAGING_MODEL_MAP = {
    "ems": StagingEmsData,
    "erp": StagingErpData,
    "ehs": StagingEhsData,
    "plm": StagingPlmData,
    "srm": StagingSrmData,
    "hr": StagingHrData,
    "mdg": StagingMdgData,
}
