"""Raw Data 조회 유스케이스 오케스트레이션."""
from __future__ import annotations

from backend.domain.v1.ghg_calculation.hub.services.raw_data_inquiry_service import RawDataInquiryService
from backend.domain.v1.ghg_calculation.models.states import RawDataInquiryRequestDto, RawDataInquiryResponseDto


class RawDataInquiryOrchestrator:
    def __init__(self, service: RawDataInquiryService | None = None):
        self._service = service or RawDataInquiryService()

    def inquire_raw_data(self, req: RawDataInquiryRequestDto) -> RawDataInquiryResponseDto:
        return self._service.inquire(req)
