"""삼성SDS 뉴스 JSON·HTML 파서 단위 테스트."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from backend.domain.v1.data_integration.hub.services.external_company.sds_news_ingest_service import (
    to_external_company_rows,
)
from backend.domain.v1.data_integration.hub.services.external_company.sds_news_parse import (
    item_source_type,
    parse_news_feed_json,
    parse_news_index_html,
    parse_sds_detail_page,
    parse_external_article,
)

LIST = "https://www.samsungsds.com/kr/news/index.html"


def test_parse_news_feed_json_press_and_media():
    """news.txt JSON 파싱 (폴백 경로)."""
    records = [
        {
            "id": "1",
            "category": "보도자료",
            "title": "제목A",
            "eyebrowCopy": "물류",
            "releaseDate": "2026-04-02",
            "detailLink": "/kr/news/cs-260402.html",
            "content": "요약A",
        },
        {
            "id": "2",
            "category": "언론이 본 삼성SDS",
            "title": "제목B",
            "eyebrowCopy": "삼성SDS 소식",
            "releaseDate": "2026-04-03",
            "detailLink": "/kr/news/x.html",
            "content": "요약B",
            "contact": "한국일보",
        },
    ]
    items = parse_news_feed_json(records, list_page_url=LIST)
    assert len(items) == 2
    assert items[0].section == "bThumbs"
    assert items[0].sds_detail_url == "https://www.samsungsds.com/kr/news/cs-260402.html"
    assert item_source_type(items[0]) == "press"
    assert items[1].section == "sThumbs"
    assert items[1].external_org_name == "한국일보"
    assert item_source_type(items[1]) == "news"


def test_parse_news_index_html_thumb_blocks():
    """HTML #bThumbs / #sThumbs 파싱 (우선 경로)."""
    html = """
    <div id="bThumbs" class="thumbList">
      <div class="thumb">
        <a href="/kr/news/p.html">보도 제목</a>
        <p>요약입니다</p>
        <span class="thumb_date">2026-04-01</span>
      </div>
    </div>
    <div id="sThumbs" class="thumbList">
      <div class="thumb">
        <div class="thumb_title">
          <a href="/kr/news/m.html">언론 제목</a>
        </div>
        <span class="thumb_date">2026-01-15</span>
      </div>
    </div>
    """
    items = parse_news_index_html(html, list_page_url=LIST)
    assert len(items) == 2
    assert items[0].title == "보도 제목"
    assert items[0].sds_detail_url == "https://www.samsungsds.com/kr/news/p.html"
    assert items[1].title == "언론 제목"


def test_parse_sds_detail_page():
    """1차 상세 페이지 파싱: 외부 URL 추출."""
    html = """
    <h1>제목</h1>
    <p class="txt">
      <a href="https://www.fnnews.com/news/202511241407166044">파이낸셜뉴스 바로가기</a>
    </p>
    <div>카테고리: 물류</div>
    """
    external_url, category = parse_sds_detail_page(html, LIST)
    assert external_url == "https://www.fnnews.com/news/202511241407166044"
    assert category is not None


def test_parse_external_article():
    """외부 언론사 기사 본문 파싱."""
    html = """
    <article>
      <h1>뉴스 제목</h1>
      <p>본문 내용입니다. 여기에 충분히 긴 텍스트가 있어야 합니다. 
      최소 100자 이상이면 추출됩니다.</p>
    </article>
    """
    body = parse_external_article(html)
    assert body is not None
    assert "본문 내용입니다" in body


def test_to_external_company_rows_payload():
    """DB 매핑 로직 테스트."""
    from backend.domain.v1.data_integration.models.states import ParsedNewsItem

    aid = uuid.uuid4()
    bid = uuid.uuid4()
    ft = datetime.now(timezone.utc)
    items = [
        ParsedNewsItem(
            section="bThumbs",
            sds_detail_url="https://www.samsungsds.com/kr/news/a.html",
            external_article_url="https://example.com/article",
            title="T",
            body_text="본문 텍스트",
            external_org_name=None,
            category="물류",
            as_of_date=None,
            report_year=2026,
            sds_article_id="99",
        )
    ]
    rows = to_external_company_rows(
        items,
        anchor_company_id=aid,
        ingest_batch_id=bid,
        fetched_at=ft,
        list_page_url=LIST,
    )
    assert rows[0]["source_type"] == "press"
    assert rows[0]["source_url"] == "https://example.com/article"  # 외부 URL 우선
    assert rows[0]["category"] == "물류"
    assert rows[0]["structured_payload"]["sds_article_id"] == "99"
    assert rows[0]["ingest_batch_id"] == bid
