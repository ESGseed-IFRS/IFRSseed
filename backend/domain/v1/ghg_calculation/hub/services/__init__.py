"""서비스 모듈 — 패키지 import 시 DB 의존 모듈은 로드하지 않습니다."""

__all__ = [
    "GhgRawSyncValidationService",
    "RawDataInquiryService",
    "GhgDataQualityService",
    "GhgEmissionFactorValidationService",
    "GhgIntensityAnomalyService",
    "GhgBoundaryConsistencyService",
    "EmissionFactorService",
    "EmissionFactorServiceV2",
    "GhgCalculationEngine",
]


def __getattr__(name: str):
    if name == "RawDataInquiryService":
        from .raw_data_inquiry_service import RawDataInquiryService

        return RawDataInquiryService
    if name == "GhgRawSyncValidationService":
        from .ghg_raw_sync_validation_service import GhgRawSyncValidationService

        return GhgRawSyncValidationService
    if name == "GhgDataQualityService":
        from .ghg_data_quality_service import GhgDataQualityService

        return GhgDataQualityService
    if name == "GhgEmissionFactorValidationService":
        from .ghg_emission_factor_validation_service import GhgEmissionFactorValidationService

        return GhgEmissionFactorValidationService
    if name == "GhgIntensityAnomalyService":
        from .ghg_intensity_anomaly_service import GhgIntensityAnomalyService

        return GhgIntensityAnomalyService
    if name == "GhgBoundaryConsistencyService":
        from .ghg_boundary_consistency_service import GhgBoundaryConsistencyService

        return GhgBoundaryConsistencyService
    if name == "EmissionFactorService":
        from .emission_factor_service import EmissionFactorService

        return EmissionFactorService
    if name == "EmissionFactorServiceV2":
        from .emission_factor_service_v2 import EmissionFactorServiceV2

        return EmissionFactorServiceV2
    if name == "GhgCalculationEngine":
        from .ghg_calculation_engine import GhgCalculationEngine

        return GhgCalculationEngine
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
