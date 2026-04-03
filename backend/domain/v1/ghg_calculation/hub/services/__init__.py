"""서비스 모듈 — 패키지 import 시 DB 의존 모듈은 로드하지 않습니다."""

__all__ = ["GhgRawSyncValidationService", "RawDataInquiryService"]


def __getattr__(name: str):
    if name == "RawDataInquiryService":
        from .raw_data_inquiry_service import RawDataInquiryService

        return RawDataInquiryService
    if name == "GhgRawSyncValidationService":
        from .ghg_raw_sync_validation_service import GhgRawSyncValidationService

        return GhgRawSyncValidationService
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
