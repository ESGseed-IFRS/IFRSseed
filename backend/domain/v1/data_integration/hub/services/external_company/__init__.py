from __future__ import annotations

from typing import Any

from backend.domain.v1.data_integration.models.states import IngestResult, ParsedNewsItem

from .sds_news_constants import get_sds_news_list_url
from .sds_news_ingest_service import SdsNewsIngestService
from .sds_news_parse import parse_news_feed_json, parse_news_index_html

# 하위 호환: 예전 이름
parse_news_index = parse_news_index_html

__all__ = [
    "get_sds_news_list_url",
    "SdsNewsIngestOrchestrator",
    "SdsNewsIngestService",
    "run_sds_news_ingest",
    "ParsedNewsItem",
    "IngestResult",
    "parse_news_feed_json",
    "parse_news_index_html",
    "parse_news_index",
]


def __getattr__(name: str) -> Any:
    """오케스트레이터는 hub/orchestrator에 두되, 순환 import를 피하기 위해 지연 로드."""
    if name == "run_sds_news_ingest":
        from backend.domain.v1.data_integration.hub.orchestrator.sds_news_ingest_orchestrator import (
            run_sds_news_ingest as fn,
        )

        return fn
    if name == "SdsNewsIngestOrchestrator":
        from backend.domain.v1.data_integration.hub.orchestrator.sds_news_ingest_orchestrator import (
            SdsNewsIngestOrchestrator as cls,
        )

        return cls
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
