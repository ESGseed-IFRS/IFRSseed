"""삼성SDS 뉴스 적재 플로우용 DTO — 파싱 중간 결과·적재 결과."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal


@dataclass
class ParsedNewsItem:
    """3단계 크롤 후 파싱된 뉴스 아이템."""
    section: Literal["bThumbs", "sThumbs"]
    sds_detail_url: str                # 1차 상세 페이지 URL
    external_article_url: str | None   # 최종 외부 언론사 URL
    title: str
    body_text: str | None              # 외부 기사 본문 또는 1차 요약
    external_org_name: str | None
    category: str | None
    as_of_date: date | None
    report_year: int | None
    sds_article_id: str | None = None


@dataclass
class IngestResult:
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)
    dry_run_rows: list[dict[str, Any]] | None = None
    feed_etag: str | None = None
    feed_last_modified: str | None = None
    source: Literal["html", "news_txt", "empty", "cached"] = "empty"
    fetched_at: datetime | None = None
    unchanged: bool = False  # ETag 동일로 early return 시 True
    list_items_total: int | None = None  # 목록 파싱 직후 건수 (캡 적용 전)
    list_items_processed: int | None = None  # 캡 적용 후 실제 처리 건수

