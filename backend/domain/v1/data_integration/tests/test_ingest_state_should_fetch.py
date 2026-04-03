"""ingest_state ETag 이중 HEAD 비교 로직."""

from __future__ import annotations

from unittest.mock import MagicMock

from backend.domain.v1.data_integration.hub.repositories.ingest_state_repository import (
    IngestStateRepository,
    etags_equivalent,
    normalize_http_etag,
)


def test_should_fetch_news_txt_etag_match() -> None:
    repo = IngestStateRepository(MagicMock())
    prev = MagicMock(last_etag='"feed1"', last_list_source="news_txt")
    repo.get_by_task_key = MagicMock(return_value=prev)
    need, reason = repo.should_fetch_with_heads("sds_news_list", '"idx"', '"feed1"')
    assert need is False
    assert "동일" in reason


def test_should_fetch_html_etag_match() -> None:
    repo = IngestStateRepository(MagicMock())
    prev = MagicMock(last_etag='"idx1"', last_list_source="html")
    repo.get_by_task_key = MagicMock(return_value=prev)
    need, reason = repo.should_fetch_with_heads("sds_news_list", '"idx1"', '"feed1"')
    assert need is False


def test_should_fetch_legacy_matches_index() -> None:
    repo = IngestStateRepository(MagicMock())
    prev = MagicMock(last_etag='"idx1"', last_list_source=None)
    repo.get_by_task_key = MagicMock(return_value=prev)
    need, _ = repo.should_fetch_with_heads("sds_news_list", '"idx1"', '"other"')
    assert need is False


def test_should_fetch_no_prev() -> None:
    repo = IngestStateRepository(MagicMock())
    repo.get_by_task_key = MagicMock(return_value=None)
    need, reason = repo.should_fetch_with_heads("sds_news_list", '"a"', '"b"')
    assert need is True
    assert "첫" in reason


def test_legacy_weak_head_matches_strong_stored_news_txt() -> None:
    """GET 저장 '"opaque"' vs HEAD W/"opaque" — 로그에서 본 케이스."""
    repo = IngestStateRepository(MagicMock())
    prev = MagicMock(
        last_etag='"60a1676-117bd8-64e82d30fb180"',
        last_list_source=None,
    )
    repo.get_by_task_key = MagicMock(return_value=prev)
    need, reason = repo.should_fetch_with_heads(
        "sds_news_list",
        '"61d3382-13202-64e82d30fb180"',
        'W/"60a1676-117bd8-64e82d30fb180"',
    )
    assert need is False
    assert "news_txt" in reason


def test_normalize_http_etag_weak_and_quotes() -> None:
    assert normalize_http_etag('W/"abc"') == "abc"
    assert normalize_http_etag('"abc"') == "abc"
    assert etags_equivalent('W/"60a1676-x"', '"60a1676-x"')
