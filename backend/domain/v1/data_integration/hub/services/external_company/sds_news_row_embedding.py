"""SDS 뉴스 `external_company_data` 행에 title·body_text BGE-M3 임베딩 채우기.

- `category_embedding`: 제목(`title`) 임베딩. 제목이 비면 `category` 텍스트를 사용.
- `body_embedding`: `body_text` 임베딩(긴 본문은 잘라냄).

환경 변수 (설정 필드와 동일):
  SDS_NEWS_EMBED — 기본 활성. 0/false/no/off 이면 비활성(모델 로드·연산 생략).
  SDS_NEWS_EMBED_BATCH_SIZE — 배치 크기(기본 16).
  SDS_NEWS_EMBED_BODY_MAX_CHARS — 본문 최대 문자 수(기본 12000).
"""

from __future__ import annotations

from typing import Any

from loguru import logger

from backend.core.config.settings import get_settings


def _title_embedding_text(row: dict[str, Any]) -> str | None:
    t = (row.get("title") or "").strip()
    if t:
        return t
    c = (row.get("category") or "").strip()
    return c or None


def _body_embedding_text(row: dict[str, Any], max_chars: int) -> str | None:
    b = (row.get("body_text") or "").strip()
    if not b:
        return None
    if len(b) <= max_chars:
        return b
    return b[:max_chars]


def enrich_external_company_rows_with_embeddings(rows: list[dict[str, Any]]) -> None:
    """
    rows를 제자리에서 갱신: `category_embedding`(제목·카테고리), `body_embedding`(본문).

    비활성(Settings.sds_news_embed=False)이거나 행이 없으면 noop. 실패 시 로그만 남기고 스킵.
    """
    if not rows or not get_settings().sds_news_embed:
        return

    batch_size = max(1, get_settings().sds_news_embed_batch_size)
    body_max = max(256, get_settings().sds_news_embed_body_max_chars)

    title_pending: list[tuple[int, str]] = []
    body_pending: list[tuple[int, str]] = []

    for i, row in enumerate(rows):
        tt = _title_embedding_text(row)
        if tt:
            title_pending.append((i, tt))
        bt = _body_embedding_text(row, body_max)
        if bt:
            body_pending.append((i, bt))

    if not title_pending and not body_pending:
        return

    try:
        from backend.domain.shared.tool.sr_report.images.sr_image_caption_embedding import (
            EmbeddingService,
        )

        svc = EmbeddingService()

        for off in range(0, len(title_pending), batch_size):
            chunk = title_pending[off : off + batch_size]
            texts = [t for _, t in chunk]
            emb = svc.generate_embeddings(texts, normalize=True)
            if emb is None or len(emb) != len(chunk):
                logger.warning(
                    "[SDS_NEWS_EMBED] title 배치 크기 불일치: {} 벡터 / {} 텍스트",
                    0 if emb is None else len(emb),
                    len(chunk),
                )
                continue
            for j, (row_idx, _) in enumerate(chunk):
                rows[row_idx]["category_embedding"] = emb[j].tolist()

        for off in range(0, len(body_pending), batch_size):
            chunk = body_pending[off : off + batch_size]
            texts = [t for _, t in chunk]
            emb = svc.generate_embeddings(texts, normalize=True)
            if emb is None or len(emb) != len(chunk):
                logger.warning(
                    "[SDS_NEWS_EMBED] body 배치 크기 불일치: {} 벡터 / {} 텍스트",
                    0 if emb is None else len(emb),
                    len(chunk),
                )
                continue
            for j, (row_idx, _) in enumerate(chunk):
                rows[row_idx]["body_embedding"] = emb[j].tolist()

        logger.debug(
            "[SDS_NEWS_EMBED] 완료: title {}건, body {}건",
            len(title_pending),
            len(body_pending),
        )
    except Exception as e:
        logger.warning("[SDS_NEWS_EMBED] 임베딩 생략(실패): {}", e)
