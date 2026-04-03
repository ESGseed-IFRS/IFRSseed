"""`IngestState` Repository — 변경 감지 상태 CRUD."""
from __future__ import annotations

import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import lru_cache
from typing import Generator

from sqlalchemy.orm import Session

from backend.domain.v1.data_integration.models.bases.ingest_state import IngestState


def normalize_http_etag(raw: str | None) -> str | None:
    """
    Weak(`W/"..."`)·따옴표만 다른 동일 opaque-tag 를 같은 값으로 본다.

    GET은 `"hash"` 만, HEAD는 `W/"hash"` 만 주는 경우가 있어 문자열 == 비교만 하면
    레거시 `last_list_source` NULL 행에서 매번 should_fetch=True 가 된다.
    """
    if not raw:
        return None
    t = raw.strip()
    if not t:
        return None
    if len(t) >= 2 and t.upper().startswith("W/"):
        t = t[2:].strip()
    if len(t) >= 2 and t[0] == '"' and t[-1] == '"':
        t = t[1:-1].strip()
    return t or None


def etags_equivalent(a: str | None, b: str | None) -> bool:
    na, nb = normalize_http_etag(a), normalize_http_etag(b)
    return bool(na and nb and na == nb)


class IngestStateRepository:
    """IngestState 테이블 접근 레포지토리."""

    def __init__(self, session: Session):
        self.session = session

    def get_by_task_key(self, task_key: str) -> IngestState | None:
        """task_key로 상태 조회."""
        return self.session.query(IngestState).filter(IngestState.task_key == task_key).first()

    def should_fetch(self, task_key: str, current_etag: str | None) -> bool:
        """
        단일 ETag(예: index HEAD만) 비교. SDS 뉴스는 `should_fetch_with_heads` 사용 권장.
        """
        prev = self.get_by_task_key(task_key)
        if prev is None:
            return True
        if etags_equivalent(current_etag, prev.last_etag):
            return False
        return True

    def should_fetch_with_heads(
        self,
        task_key: str,
        etag_index_html: str | None,
        etag_news_txt: str | None,
    ) -> tuple[bool, str]:
        """
        index.html·news.txt 각각의 HEAD ETag와 DB의 last_etag·last_list_source를 맞춰 비교.

        Returns:
            (fetch 필요 여부, 로그용 짧은 사유)
        """
        prev = self.get_by_task_key(task_key)
        if prev is None:
            return True, "첫_실행_행_없음"

        src = (prev.last_list_source or "").strip().lower()
        if src == "news_txt":
            cur = etag_news_txt
            label = "news_txt"
        elif src == "html":
            cur = etag_index_html
            label = "index_html"
        else:
            # 마이그레이션 전 행: 두 HEAD 중 저장된 etag과 일치하면 스킵
            if etag_index_html and etags_equivalent(prev.last_etag, etag_index_html):
                return False, "레거시_index_html_ETag_일치"
            if etag_news_txt and etags_equivalent(prev.last_etag, etag_news_txt):
                return False, "레거시_news_txt_ETag_일치"
            return True, "레거시_소스미상_HEAD와_저장etag_불일치"

        if not cur:
            return True, f"{label}_HEAD_ETag_없음"
        if prev.last_etag and etags_equivalent(prev.last_etag, cur):
            return False, f"{label}_ETag_동일"
        return True, f"{label}_ETag_변경_또는_불일치"

    def save_state(
        self,
        task_key: str,
        etag: str | None = None,
        modified: str | None = None,
        content_hash: str | None = None,
        batch_id: uuid.UUID | None = None,
        list_source: str | None = None,
    ) -> IngestState:
        """
        수집 완료 후 상태 갱신 (upsert).

        Args:
            task_key: 태스크 식별자 (예: "sds_news_list")
            etag: HTTP ETag 헤더
            modified: Last-Modified 헤더
            content_hash: (옵) 응답 body SHA-256
            batch_id: 이번 실행 배치 ID
        """
        now = datetime.now(timezone.utc)
        row = self.get_by_task_key(task_key)

        if row:
            # UPDATE
            row.last_etag = etag
            row.last_modified = modified
            row.last_content_hash = content_hash
            row.last_fetch_at = now
            row.last_ingest_batch_id = batch_id
            row.updated_at = now
            if list_source is not None:
                row.last_list_source = list_source
        else:
            # INSERT
            row = IngestState(
                task_key=task_key,
                last_etag=etag,
                last_list_source=list_source,
                last_modified=modified,
                last_content_hash=content_hash,
                last_fetch_at=now,
                last_ingest_batch_id=batch_id,
            )
            self.session.add(row)

        self.session.commit()
        self.session.refresh(row)
        return row


@lru_cache(maxsize=1)
def _ingest_state_engine():
    """ingest_state 전용 엔진 (장시간 크롤과 세션을 공유하지 않음)."""
    from sqlalchemy import create_engine

    from backend.core.config.settings import get_settings

    url = (get_settings().database_url or "").strip()
    if not url:
        return None
    # Neon/LB idle disconnect 대비: pool_recycle를 일반 idle 타임아웃(예: 300s)보다 짧게
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=280,
        pool_size=2,
        max_overflow=2,
    )


@contextmanager
def ingest_state_repository_context() -> Generator[IngestStateRepository | None, None, None]:
    """
    짧게 열었다 닫는 세션으로 `ingest_state` 접근.

    SDS 뉴스 ingest는 HTTP 크롤이 수십 분 걸릴 수 있어, 같은 Session을
    크롤 전체에 붙잡으면 Neon 등에서 SSL 연결이 끊긴 뒤 마지막 save에서 터질 수 있다.
    """
    eng = _ingest_state_engine()
    if eng is None:
        yield None
        return
    from sqlalchemy.orm import sessionmaker

    SessionLocal = sessionmaker(bind=eng, expire_on_commit=False)
    session = SessionLocal()
    try:
        yield IngestStateRepository(session)
    finally:
        session.close()
