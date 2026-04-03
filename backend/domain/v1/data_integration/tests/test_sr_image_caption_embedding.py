"""sr_image_caption_embedding."""
from __future__ import annotations

import numpy as np
import pytest

from backend.domain.shared.tool.sr_report.images.sr_image_caption_embedding import (
    build_image_caption_embedding_text,
    enrich_image_rows_with_caption_embeddings,
)


def test_build_caption_text() -> None:
    assert build_image_caption_embedding_text("  a  ") == "a"
    assert build_image_caption_embedding_text(None) is None
    assert build_image_caption_embedding_text("   ") is None


def test_enrich_skips_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SR_IMAGE_CAPTION_EMBED", "0")
    rows = [{"caption_text": "x"}]
    enrich_image_rows_with_caption_embeddings(rows)
    assert "image_embedding" not in rows[0]


def test_enrich_fills_when_mocked(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SR_IMAGE_CAPTION_EMBED", "1")

    def fake_generate(self, texts, normalize=True):  # noqa: ARG001
        n = len(texts)
        return np.ones((n, 1024), dtype=np.float32)

    monkeypatch.setattr(
        "backend.domain.v1.ifrs_agent.service.embedding_service.EmbeddingService.generate_embeddings",
        fake_generate,
    )
    rows = [
        {"caption_text": "차트 설명"},
        {"caption_text": ""},
    ]
    enrich_image_rows_with_caption_embeddings(rows)
    assert rows[0]["image_embedding_text"] == "차트 설명"
    assert len(rows[0]["image_embedding"]) == 1024
    assert rows[0]["embedding_status"] == "caption_embedded"
    assert "image_embedding" not in rows[1]
