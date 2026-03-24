"""States - DTO/VO for data integration flows"""

from .sr_parsing_state import (
    PDFBytesState,
    HistoricalSRReportsRow,
    SrReportIndexRow,
    SrReportBodyRow,
    SrReportImagesRow,
    SRParsingResult,
)

__all__ = [
    "PDFBytesState",
    "HistoricalSRReportsRow",
    "SrReportIndexRow",
    "SrReportBodyRow",
    "SrReportImagesRow",
    "SRParsingResult",
]
