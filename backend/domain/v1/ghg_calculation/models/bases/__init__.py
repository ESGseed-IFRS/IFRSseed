"""스테이징 엔티티 — 정의 원본은 data_integration."""
from backend.domain.v1.data_integration.models.bases.staging_tables import (
    STAGING_MODEL_MAP,
    StagingEhsData,
    StagingEmsData,
    StagingErpData,
    StagingHrData,
    StagingPlmData,
    StagingSrmData,
)

__all__ = [
    "STAGING_MODEL_MAP",
    "StagingEhsData",
    "StagingEmsData",
    "StagingErpData",
    "StagingHrData",
    "StagingPlmData",
    "StagingSrmData",
]
