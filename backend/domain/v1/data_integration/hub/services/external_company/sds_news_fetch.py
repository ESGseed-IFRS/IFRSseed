"""삼성SDS 언론보도 HTML·JSON 피드 HTTP fetch (3단계 크롤 지원)."""

from __future__ import annotations

import time
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx

from .sds_news_constants import get_sds_news_txt_path, get_sds_news_user_agent


def _origin_from_list_url(list_page_url: str) -> str:
    p = urlparse(list_page_url)
    if not p.scheme or not p.netloc:
        return "https://www.samsungsds.com"
    return f"{p.scheme}://{p.netloc}"


def news_feed_url(list_page_url: str) -> str:
    base = _origin_from_list_url(list_page_url)
    return urljoin(base + "/", get_sds_news_txt_path().lstrip("/"))


def _client(timeout_s: float) -> httpx.Client:
    return httpx.Client(
        follow_redirects=True,
        timeout=timeout_s,
        headers={"User-Agent": get_sds_news_user_agent(), "Accept": "*/*"},
    )


def _get_with_retries(
    client: httpx.Client,
    url: str,
    *,
    max_retries: int = 3,
) -> httpx.Response:
    last_exc: Exception | None = None
    for attempt in range(max_retries):
        try:
            r = client.get(url)
            if r.status_code in (429, 503) and attempt < max_retries - 1:
                time.sleep(2**attempt)
                continue
            r.raise_for_status()
            return r
        except httpx.HTTPError as e:
            last_exc = e
            if attempt < max_retries - 1 and getattr(e, "response", None) is not None:
                code = e.response.status_code if e.response else 0
                if code in (429, 503):
                    time.sleep(2**attempt)
                    continue
            raise
    assert last_exc is not None
    raise last_exc


def fetch_list_page_head(url: str, *, timeout_s: float = 10.0) -> dict[str, str]:
    """**HEAD 요청으로 ETag/Last-Modified만 확인** (변경 감지용)."""
    with _client(timeout_s) as client:
        r = client.head(url)
        r.raise_for_status()
    headers = {
        k: v
        for k, v in {
            "etag": r.headers.get("etag") or "",
            "last-modified": r.headers.get("last-modified") or "",
        }.items()
        if v
    }
    return headers


def fetch_list_page(url: str, *, timeout_s: float = 30.0) -> tuple[str, dict[str, str]]:
    """**1단계: 목록 HTML GET** (+ ETag/Last-Modified)."""
    with _client(timeout_s) as client:
        r = _get_with_retries(client, url)
    headers = {
        k: v
        for k, v in {
            "etag": r.headers.get("etag") or "",
            "last-modified": r.headers.get("last-modified") or "",
        }.items()
        if v
    }
    r.encoding = r.encoding or "utf-8"
    return r.text, headers


def fetch_news_feed_json(
    list_page_url: str,
    *,
    timeout_s: float = 60.0,
) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """**폴백: `news.txt` JSON 배열 GET**."""
    feed = news_feed_url(list_page_url)
    with _client(timeout_s) as client:
        r = _get_with_retries(client, feed)
    r.encoding = r.encoding or "utf-8"
    data = r.json()
    if not isinstance(data, list):
        raise ValueError("news.txt root must be a JSON array")
    headers = {
        k: v
        for k, v in {
            "etag": r.headers.get("etag") or "",
            "last-modified": r.headers.get("last-modified") or "",
        }.items()
        if v
    }
    return data, headers


def fetch_sds_detail(url: str, *, timeout_s: float = 30.0) -> str:
    """**2단계: 1차 상세 페이지 HTML GET** (`/kr/news/xxx.html`)."""
    with _client(timeout_s) as client:
        r = _get_with_retries(client, url)
    r.encoding = r.encoding or "utf-8"
    return r.text


def fetch_external_article(url: str, *, timeout_s: float = 30.0) -> str:
    """**3단계: 외부 언론사 기사 HTML GET**."""
    with _client(timeout_s) as client:
        r = _get_with_retries(client, url)
    r.encoding = r.encoding or "utf-8"
    return r.text


def fetch_url_text(url: str, *, timeout_s: float = 30.0) -> str:
    """범용 GET (하위 호환용)."""
    with _client(timeout_s) as client:
        r = _get_with_retries(client, url)
    r.encoding = r.encoding or "utf-8"
    return r.text

