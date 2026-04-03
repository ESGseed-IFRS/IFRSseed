"""sr_report_images 행의 caption_text를 BGE-M3로 임베딩해 image_embedding에 반영."""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from loguru import logger


def _caption_embed_enabled() -> bool:
    """기본 활성. SR_IMAGE_CAPTION_EMBED=0/false/no/off 이면 비활성."""
    raw = os.environ.get("SR_IMAGE_CAPTION_EMBED")
    if raw is None:
        return True
    v = raw.strip().lower()
    if not v:
        return True
    return v not in ("0", "false", "no", "off")


def _embed_batch_size() -> int:
    try:
        return max(1, int(os.getenv("SR_IMAGE_CAPTION_EMBED_BATCH_SIZE", "32")))
    except ValueError:
        return 32


def build_image_caption_embedding_text(caption_text: Optional[str]) -> Optional[str]:
    """임베딩 입력용 캡션 문자열. 공백만이면 None."""
    s = (caption_text or "").strip()
    return s if s else None


def enrich_image_rows_with_caption_embeddings(rows: List[Dict[str, Any]]) -> None:
    """
    rows(dict 저장용)를 제자리에서 갱신: caption_text가 있는 행에
    image_embedding, image_embedding_text, embedding_status='caption_embedded'.
    """
    if not rows or not _caption_embed_enabled():
        return

    pending: List[tuple[int, str]] = []
    for i, r in enumerate(rows):
        t = build_image_caption_embedding_text(r.get("caption_text"))
        if t:
            pending.append((i, t))

    if not pending:
        return

    try:
        from backend.domain.v1.ifrs_agent.service.embedding_service import EmbeddingService

        svc = EmbeddingService()
        batch = _embed_batch_size()
        for off in range(0, len(pending), batch):
            chunk = pending[off : off + batch]
            texts = [t for _, t in chunk]
            emb = svc.generate_embeddings(texts, normalize=True)
            if emb is None or len(emb) != len(chunk):
                logger.warning(
                    "[SR_IMAGE_CAPTION_EMBED] 배치 크기 불일치: got {} for {}",
                    0 if emb is None else len(emb),
                    len(chunk),
                )
                continue
            for j, (row_idx, text) in enumerate(chunk):
                vec = emb[j]
                rows[row_idx]["image_embedding"] = vec.tolist()
                rows[row_idx]["image_embedding_text"] = text
                rows[row_idx]["embedding_status"] = "caption_embedded"
    except Exception as e:
        logger.warning("[SR_IMAGE_CAPTION_EMBED] 캡션 임베딩 생략(실패): {}", e)


def embed_caption_on_orm_row(row: Any) -> None:
    """
    SQLAlchemy SrReportImage 인스턴스에 대해 caption_text 기준으로 벡터 필드를 채웁니다.
    VLM 보강 후 같은 세션에서 commit 전에 호출합니다.
    """
    if not _caption_embed_enabled():
        return
    text = build_image_caption_embedding_text(getattr(row, "caption_text", None))
    if not text:
        return
    try:
        from backend.domain.v1.ifrs_agent.service.embedding_service import EmbeddingService

        vec = EmbeddingService().generate_embedding(text, normalize=True)
        row.image_embedding = vec.tolist()
        row.image_embedding_text = text
        row.embedding_status = "caption_embedded"
    except Exception as e:
        logger.warning("[SR_IMAGE_CAPTION_EMBED] ORM 행 임베딩 실패 id={}: {}", getattr(row, "id", None), e)
