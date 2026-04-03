"""삼성SDS 언론보도 → `external_company_data` 배치 적재 (3단계 크롤 + 변경 감지)."""

from __future__ import annotations

import asyncio
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

from loguru import logger

from backend.core.config.settings import get_settings
from backend.domain.v1.data_integration.hub.repositories.external_company_data_repository import (
    ExternalCompanyDataRepository,
)
from backend.domain.v1.data_integration.hub.repositories.ingest_state_repository import (
    etags_equivalent,
    ingest_state_repository_context,
)
from backend.domain.v1.data_integration.models.states import IngestResult, ParsedNewsItem

from .sds_news_constants import PARSER_VERSION, get_sds_news_list_url
from .sds_news_row_embedding import enrich_external_company_rows_with_embeddings
from .sds_news_fetch import (
    fetch_external_article,
    fetch_list_page,
    fetch_list_page_head,
    fetch_news_feed_json,
    fetch_sds_detail,
    news_feed_url,
)
from .sds_news_parse import (
    item_source_type,
    parse_external_article,
    parse_news_feed_json,
    parse_news_index_html,
    parse_sds_detail_page,
)

TASK_KEY = "sds_news_list"


def to_external_company_rows(
    items: list[ParsedNewsItem],
    *,
    anchor_company_id: uuid.UUID,
    ingest_batch_id: uuid.UUID,
    fetched_at: datetime,
    list_page_url: str | None = None,
) -> list[dict[str, Any]]:
    """ORM upsert용 dict 리스트."""
    resolved_list = list_page_url or get_sds_news_list_url()
    rows: list[dict[str, Any]] = []
    for item in items:
        st = item_source_type(item)
        
        # source_url: 외부 URL 우선, 없으면 1차 상세 URL
        source_url = item.external_article_url or item.sds_detail_url

        payload = {
            "section": item.section,
            "list_page": resolved_list,
            "parser_version": PARSER_VERSION,
            "sds_detail_url": item.sds_detail_url,
            "external_article_url": item.external_article_url,
            "sds_article_id": item.sds_article_id,
        }
        rows.append(
            {
                "anchor_company_id": anchor_company_id,
                "source_type": st,
                "source_url": source_url,
                "external_org_name": item.external_org_name,
                "report_year": item.report_year,
                "as_of_date": item.as_of_date,
                "category": item.category,
                "title": item.title,
                "body_text": item.body_text,
                "structured_payload": payload,
                "related_dp_ids": None,
                "fetched_at": fetched_at,
                "ingest_batch_id": ingest_batch_id,
                "category_embedding": None,
                "body_embedding": None,
            }
        )
    return rows


def _enrich_item_2_and_3_steps(item: ParsedNewsItem) -> ParsedNewsItem:
    """
    **2·3단계 크롤: 1차 상세 → 외부 기사**
    
    Args:
        item: 1단계(목록)에서 생성된 ParsedNewsItem (sds_detail_url만 있음)
    
    Returns:
        external_article_url, body_text 채워진 item
    """
    try:
        # 2단계: 1차 상세 페이지
        detail_html = fetch_sds_detail(item.sds_detail_url, timeout_s=20.0)
        external_url, category_or_summary = parse_sds_detail_page(detail_html, item.sds_detail_url)
        
        item.external_article_url = external_url
        if category_or_summary and not item.category:
            item.category = category_or_summary[:200]
        
        # 3단계: 외부 언론사 기사 (있을 때만)
        if external_url:
            try:
                article_html = fetch_external_article(external_url, timeout_s=25.0)
                body = parse_external_article(article_html)
                if body:
                    item.body_text = body
            except Exception as e:
                logger.debug("외부 기사 fetch 실패: {} — {}", external_url, e)
        else:
            # 외부 링크 없으면 1차 상세 페이지가 전문일 수 있음
            body = parse_external_article(detail_html)
            if body:
                item.body_text = body
        
        time.sleep(0.3)  # 요청 간격
        
    except Exception as e:
        logger.debug("2·3단계 크롤 실패: {} — {}", item.sds_detail_url, e)
    
    return item


class SdsNewsIngestService:
    def __init__(
        self,
        *,
        list_page_url: str | None = None,
        repo: ExternalCompanyDataRepository | None = None,
    ) -> None:
        self.list_page_url = list_page_url or get_sds_news_list_url()
        self._repo = repo or ExternalCompanyDataRepository()

    def run_ingest(
        self,
        anchor_company_id: uuid.UUID,
        *,
        fetch_full_content: bool = True,  # 기본 True: 3단계 크롤
        dry_run: bool = False,
        check_etag: bool = True,  # 변경 감지 활성화
        max_items: int | None = None,
    ) -> IngestResult:
        """
        3단계 크롤 + 변경 감지 배치 ingest.
        
        Args:
            anchor_company_id: 앵커 회사 UUID
            fetch_full_content: True면 2·3단계 크롤 (외부 기사 본문), False면 1단계만
            dry_run: True면 DB 쓰기 스킵
            check_etag: True면 HEAD로 ETag 확인 → 동일 시 early return
            max_items: 이번 실행에서 처리할 목록 상한. None이면 Settings.sds_news_max_items_per_run (0=무제한)
        """
        ingest_batch_id = uuid.uuid4()
        fetched_at = datetime.now(timezone.utc)
        result = IngestResult(fetched_at=fetched_at)

        etag_index_html: str | None = None
        etag_news_txt: str | None = None
        list_source_for_state: str | None = None

        # 0단계: 변경 감지 (index·news.txt 각각 HEAD) — DB는 짧은 세션만 사용
        if check_etag and (get_settings().database_url or "").strip():
            try:
                head_idx = fetch_list_page_head(self.list_page_url, timeout_s=10.0)
                etag_index_html = (head_idx.get("etag") or "").strip() or None
                lm_idx = (head_idx.get("last-modified") or "").strip() or None
                feed_u = news_feed_url(self.list_page_url)
                lm_feed: str | None = None
                try:
                    head_feed = fetch_list_page_head(feed_u, timeout_s=10.0)
                    etag_news_txt = (head_feed.get("etag") or "").strip() or None
                    lm_feed = (head_feed.get("last-modified") or "").strip() or None
                except Exception as e_feed:
                    logger.warning("[ETag] news.txt HEAD 실패(ETag 비교는 index 위주): {} — {}", feed_u, e_feed)

                logger.info(
                    "[ETag] 목록 index HEAD url={} etag={!r} last_modified={!r}",
                    self.list_page_url,
                    etag_index_html,
                    lm_idx,
                )
                logger.info(
                    "[ETag] news.txt HEAD url={} etag={!r} last_modified={!r}",
                    feed_u,
                    etag_news_txt,
                    lm_feed,
                )

                with ingest_state_repository_context() as state_repo:
                    if state_repo is not None:
                        prev = state_repo.get_by_task_key(TASK_KEY)
                        prev_etag = prev.last_etag if prev else None
                        prev_src = prev.last_list_source if prev else None
                        logger.info(
                            "[ETag] DB task_key={} prev_last_etag={!r} prev_last_list_source={!r}",
                            TASK_KEY,
                            prev_etag,
                            prev_src,
                        )
                        need_fetch, etag_reason = state_repo.should_fetch_with_heads(
                            TASK_KEY, etag_index_html, etag_news_txt
                        )
                        logger.info("[ETag] should_fetch={} 사유={}", need_fetch, etag_reason)
                        if not need_fetch:
                            logger.info("ETag 동일, 변경 없음 (early return)")
                            result.source = "cached"
                            result.unchanged = True
                            result.feed_etag = etag_index_html or etag_news_txt
                            return result
            except Exception as e:
                logger.warning("HEAD 요청 실패, 계속 진행: {}", e)

        items: list[ParsedNewsItem] = []
        feed_headers: dict[str, str] = {}

        # 1단계: 목록 수집 (HTML 우선, news.txt 폴백)
        try:
            html, h = fetch_list_page(self.list_page_url)
            items = parse_news_index_html(html, list_page_url=self.list_page_url)
            feed_headers = h
            result.source = "html" if items else "empty"
            if items:
                list_source_for_state = "html"
        except Exception as e:
            logger.warning("HTML 목록 수집 실패, news.txt 폴백: {}", e)

        if not items:
            try:
                records, feed_headers = fetch_news_feed_json(self.list_page_url)
                items = parse_news_feed_json(records, list_page_url=self.list_page_url)
                result.source = "news_txt"
                list_source_for_state = "news_txt"
            except Exception as e2:
                logger.exception("news.txt 수집·파싱 실패: {}", e2)
                result.errors.append(str(e2))
                result.source = "empty"
                return result

        result.feed_etag = feed_headers.get("etag")
        result.feed_last_modified = feed_headers.get("last-modified")

        if list_source_for_state == "html" and etag_index_html and result.feed_etag:
            if not etags_equivalent(result.feed_etag, etag_index_html):
                logger.warning(
                    "[ETag] GET 목록 HTML의 ETag({!r})가 HEAD({!r})와 다름 — CDN/캐시 가능",
                    result.feed_etag,
                    etag_index_html,
                )
        if list_source_for_state == "news_txt" and etag_news_txt and result.feed_etag:
            if not etags_equivalent(result.feed_etag, etag_news_txt):
                logger.warning(
                    "[ETag] GET news.txt ETag({!r})가 HEAD({!r})와 다름 — CDN/캐시 가능",
                    result.feed_etag,
                    etag_news_txt,
                )

        if not items:
            result.source = "empty"
            return result

        result.list_items_total = len(items)
        cap = max_items if max_items is not None else get_settings().sds_news_max_items_per_run
        if cap > 0 and len(items) > cap:
            logger.info(
                "목록 {}건 중 이번 실행에서는 상위 {}건만 처리 (SDS_NEWS_MAX_ITEMS_PER_RUN 또는 max_items)",
                len(items),
                cap,
            )
            items = items[:cap]
        result.list_items_processed = len(items)

        # 2·3단계: 1차 상세 → 외부 기사 (병렬 처리)
        if fetch_full_content:
            concurrency = get_settings().sds_news_concurrency
            logger.info("2·3단계 크롤 시작 (병렬={}, 건수={})", concurrency, len(items))
            
            with ThreadPoolExecutor(max_workers=concurrency) as executor:
                items = list(executor.map(_enrich_item_2_and_3_steps, items))

        # DB 매핑
        rows = to_external_company_rows(
            items,
            anchor_company_id=anchor_company_id,
            ingest_batch_id=ingest_batch_id,
            fetched_at=fetched_at,
            list_page_url=self.list_page_url,
        )

        if dry_run:
            result.dry_run_rows = rows
            return result

        enrich_external_company_rows_with_embeddings(rows)

        # DB 저장
        for row in rows:
            url = row.get("source_url") or ""
            if not url:
                result.skipped += 1
                continue
            out = self._repo.upsert_by_anchor_and_url(
                anchor_company_id,
                url,
                row,
            )
            if out.get("status") != "success":
                result.errors.append(out.get("message") or "unknown")
                continue
            if out.get("mode") == "insert":
                result.inserted += 1
            elif out.get("mode") == "update":
                result.updated += 1

        # 상태 저장 (크롤 종료 직후 새 세션 — 장시간 유휴 연결 SSL 끊김 방지)
        if (get_settings().database_url or "").strip():
            try:
                with ingest_state_repository_context() as state_repo:
                    if state_repo is not None:
                        state_repo.save_state(
                            TASK_KEY,
                            etag=result.feed_etag,
                            modified=result.feed_last_modified,
                            batch_id=ingest_batch_id,
                            list_source=list_source_for_state,
                        )
            except Exception as e:
                logger.exception("ingest_state 저장 실패: {}", e)

        return result
