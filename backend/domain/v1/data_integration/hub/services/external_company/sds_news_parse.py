"""삼성SDS 뉴스: HTML `#bThumbs`/`#sThumbs` 우선, `news.txt` JSON 폴백 파싱."""

from __future__ import annotations

import json
import re
from datetime import date
from typing import Any
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .sds_news_constants import (
    CAT_MEDIA_KO,
    CAT_PRESS_KO,
    PARSER_VERSION,
    SECTION_B_THUMBS,
    SECTION_S_THUMBS,
    SOURCE_TYPE_NEWS,
    SOURCE_TYPE_PRESS,
    get_sds_news_list_url,
)
from backend.domain.v1.data_integration.models.states import ParsedNewsItem

_DATE_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})")


def _parse_date(s: str | None) -> tuple[date | None, int | None]:
    if not s:
        return None, None
    m = _DATE_RE.search(s.strip())
    if not m:
        return None, None
    try:
        d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        return d, d.year
    except ValueError:
        return None, None


def _absolute_url(list_page_url: str, href: str) -> str:
    href = (href or "").strip()
    if not href:
        return ""
    if href.startswith("http://") or href.startswith("https://"):
        return href
    return urljoin(list_page_url, href)


def parse_news_index_html(html: str, *, list_page_url: str | None = None) -> list[ParsedNewsItem]:
    """
    **1단계: 목록 페이지 HTML 파싱 (우선 경로)**
    
    `#bThumbs` / `#sThumbs` 하위 `.thumb` 블록에서 1차 상세 URL 추출.
    이 함수는 제목·날짜·1차 URL만 반환하고, body_text는 None.
    """
    base_url = list_page_url or get_sds_news_list_url()
    soup = BeautifulSoup(html, "lxml")
    items: list[ParsedNewsItem] = []

    def walk_container(container_id: str, section: str) -> None:
        box = soup.select_one(f"div#{container_id}")
        if not box:
            return
        for thumb in box.find_all("div", class_=lambda c: c and "thumb" in c.split(), recursive=False):
            # bThumbs: div.thumb > a[href]
            # sThumbs: div.thumb > .thumb_title a[href], .thumb_date
            title_link = thumb.select_one(".thumb_title a[href]") or thumb.find("a", href=True)
            if not title_link:
                continue
            
            href = title_link.get("href", "")
            sds_detail_url = _absolute_url(base_url, str(href))
            if not sds_detail_url:
                continue
            
            title = title_link.get_text(" ", strip=True)
            
            # 날짜 추출
            date_el = thumb.select_one(".thumb_date")
            date_text = date_el.get_text(strip=True) if date_el else thumb.get_text(" ", strip=True)
            as_of, year = _parse_date(date_text)
            
            # 언론사명 (sThumbs만, 간단 추정)
            ext_org = None
            if section == SECTION_S_THUMBS:
                # thumb 내 첫 줄 텍스트 등에서 언론사명 찾기 (간단 버전)
                for txt_node in thumb.stripped_strings:
                    if len(txt_node) < 30 and txt_node not in title:
                        ext_org = txt_node
                        break
            
            items.append(
                ParsedNewsItem(
                    section=section,  # type: ignore[arg-type]
                    sds_detail_url=sds_detail_url,
                    external_article_url=None,  # 2단계에서 채움
                    title=title,
                    body_text=None,  # 2·3단계에서 채움
                    external_org_name=ext_org,
                    category=None,
                    as_of_date=as_of,
                    report_year=year,
                    sds_article_id=None,
                )
            )

    walk_container("bThumbs", SECTION_B_THUMBS)
    walk_container("sThumbs", SECTION_S_THUMBS)
    return items


def parse_news_feed_json(
    records: list[dict[str, Any]],
    *,
    list_page_url: str | None = None,
) -> list[ParsedNewsItem]:
    """**폴백: `news.txt` JSON 파싱** (HTML에서 아무것도 못 가져왔을 때만 사용)."""
    base_url = list_page_url or get_sds_news_list_url()
    items: list[ParsedNewsItem] = []
    for raw in records:
        cat = (raw.get("category") or "").strip()
        if cat == CAT_PRESS_KO:
            section: Any = SECTION_B_THUMBS
            ext_org = None
        elif cat == CAT_MEDIA_KO:
            section = SECTION_S_THUMBS
            ext_org = (raw.get("contact") or None) and str(raw.get("contact")).strip() or None
        else:
            continue

        detail = (raw.get("detailLink") or "").strip()
        sds_detail_url = _absolute_url(base_url, detail)
        if not sds_detail_url:
            continue

        title = (raw.get("title") or "").strip()
        content = raw.get("content")
        body_text = str(content).strip() if content is not None else None
        release = (raw.get("releaseDate") or "").strip()
        as_of, year = _parse_date(release)

        aid = raw.get("id")
        sds_id = str(aid) if aid is not None else None

        items.append(
            ParsedNewsItem(
                section=section,
                sds_detail_url=sds_detail_url,
                external_article_url=None,  # 2단계에서 채움
                title=title,
                body_text=body_text,
                external_org_name=ext_org,
                category=None,
                as_of_date=as_of,
                report_year=year,
                sds_article_id=sds_id,
            )
        )
    return items


def parse_news_feed_json_text(
    text: str,
    *,
    list_page_url: str | None = None,
) -> list[ParsedNewsItem]:
    data = json.loads(text)
    if not isinstance(data, list):
        raise ValueError("expected JSON array")
    return parse_news_feed_json(data, list_page_url=list_page_url)


def parse_sds_detail_page(html: str, base_url: str) -> tuple[str | None, str | None]:
    """
    **2단계: 1차 상세 페이지 파싱**
    
    Returns:
        (external_url, category_or_summary)
        - external_url: p.txt a[href] 외부 언론사 링크
        - category_or_summary: 카테고리 또는 요약 텍스트
    """
    soup = BeautifulSoup(html, "lxml")
    
    # 외부 링크 추출: p.txt a[href]
    external_url = None
    txt_p = soup.select_one("p.txt a[href]")
    if txt_p:
        href = txt_p.get("href", "")
        external_url = _absolute_url(base_url, str(href))
    
    # 카테고리 또는 요약
    category_or_summary = None
    h1 = soup.find("h1")
    if h1:
        # h1 다음 형제에서 텍스트 추출
        for sib in h1.next_siblings:
            if hasattr(sib, "get_text"):
                text = sib.get_text(" ", strip=True)
                if text and len(text) > 10:
                    category_or_summary = text[:500]
                    break
    
    return external_url, category_or_summary


def parse_external_article(html: str) -> str | None:
    """
    **3단계: 외부 언론사 기사 본문 파싱**
    
    범용 선택자로 본문 추출: article, #articleBody, .article_view, main 등
    """
    soup = BeautifulSoup(html, "lxml")
    
    # 우선순위 선택자
    selectors = [
        "article",
        "#articleBody",
        ".article_view",
        ".article-body",
        "main",
        ".content",
    ]
    
    for sel in selectors:
        elem = soup.select_one(sel)
        if elem:
            text = elem.get_text(" ", strip=True)
            if text and len(text) > 100:
                return text[:5000]  # 최대 5000자
    
    # 폴백: body 전체
    body = soup.find("body")
    if body:
        text = body.get_text(" ", strip=True)
        return text[:5000] if text else None
    
    return None


def item_source_type(item: ParsedNewsItem) -> str:
    return SOURCE_TYPE_PRESS if item.section == SECTION_B_THUMBS else SOURCE_TYPE_NEWS
