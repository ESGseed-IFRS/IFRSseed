"""sr_report_body 행의 toc_path·subtitle 메타를 BGE-M3로 임베딩해 content_embedding에 반영.

환경 변수:
  SR_BODY_METADATA_EMBED — 0/false/no/off 가 아니면 수행(미설정 시 기본 활성).
  SR_BODY_EMBED_BATCH_SIZE — 배치 크기(기본 32).

임베딩 입력 문자열은 build_metadata_embedding_text 규칙(목차 ' > ', 전체 ' | ')과 동일하게
content_embedding_text에 저장됩니다.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from loguru import logger


def _metadata_embed_enabled() -> bool:
    """기본 활성. SR_BODY_METADATA_EMBED=0/false/no/off 이면 비활성."""
    raw = os.environ.get("SR_BODY_METADATA_EMBED")
    if raw is None:
        return True
    v = raw.strip().lower()
    if not v:
        return True
    return v not in ("0", "false", "no", "off")


def _embed_batch_size() -> int:
    try:
        return max(1, int(os.getenv("SR_BODY_EMBED_BATCH_SIZE", "32")))
    except ValueError:
        return 32


def build_metadata_embedding_text(
    toc_path: Optional[List[Any]],
    subtitle: Optional[str],
) -> Optional[str]:
    """
    toc_path(문자열 리스트)와 subtitle을 하나의 임베딩 입력 문자열로 합칩니다.

    규칙: 목차 세그먼트는 ' > '로 이어 붙이고, 부제가 있으면 전체는 ' | '로 구분합니다.
    둘 다 비면 None.
    """
    parts: List[str] = []
    if toc_path:
        segs = [str(x).strip() for x in toc_path if x is not None and str(x).strip()]
        if segs:
            parts.append(" > ".join(segs))
    st = (subtitle or "").strip()
    if st:
        parts.append(st)
    if not parts:
        return None
    return " | ".join(parts)


def enrich_bodies_with_toc_subtitle_embeddings(bodies: List[Dict[str, Any]]) -> None:
    """
    bodies를 제자리에서 갱신: 임베딩 가능한 행에 content_embedding, content_embedding_text, embedding_status.

    임베딩 실패 시 로그만 남기고 본문 저장은 계속 가능하도록 예외를 삼킵니다.
    """
    if not bodies or not _metadata_embed_enabled():
        return

    pending: List[tuple[int, str]] = []
    for i, b in enumerate(bodies):
        text = build_metadata_embedding_text(b.get("toc_path"), b.get("subtitle"))
        if text:
            pending.append((i, text))

    if not pending:
        return

    try:
        from backend.domain.shared.tool.sr_report.images.sr_image_caption_embedding import (
            EmbeddingService,
        )

        svc = EmbeddingService()
        batch = _embed_batch_size()
        for off in range(0, len(pending), batch):
            chunk = pending[off : off + batch]
            texts = [t for _, t in chunk]
            emb = svc.generate_embeddings(texts, normalize=True)
            if emb is None or len(emb) != len(chunk):
                logger.warning(
                    "[SR_BODY_EMBED] 배치 크기 불일치: got {} vectors for {} texts",
                    0 if emb is None else len(emb),
                    len(chunk),
                )
                continue
            for j, (row_idx, text) in enumerate(chunk):
                vec = emb[j]
                bodies[row_idx]["content_embedding"] = vec.tolist()
                bodies[row_idx]["content_embedding_text"] = text
                bodies[row_idx]["embedding_status"] = "metadata_embedded"
    except Exception as e:
        logger.warning("[SR_BODY_EMBED] 메타데이터 임베딩 생략(실패): {}", e)
