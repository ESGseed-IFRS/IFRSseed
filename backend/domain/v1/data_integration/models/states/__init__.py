"""States - DTO/VO for data integration flows"""

from .sds_news_state import IngestResult, ParsedNewsItem
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
    "ParsedNewsItem",
    "IngestResult",
]
