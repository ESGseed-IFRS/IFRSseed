"""sr_body_metadata_embedding: 메타 텍스트 조합·배치 임베딩 보강."""
from __future__ import annotations

import numpy as np
import pytest

from backend.domain.shared.tool.sr_report.body.sr_body_metadata_embedding import (
    build_metadata_embedding_text,
    enrich_bodies_with_toc_subtitle_embeddings,
)


def test_build_metadata_embedding_text_toc_only() -> None:
    assert build_metadata_embedding_text(["환경", "기후"], None) == "환경 > 기후"


def test_build_metadata_embedding_text_subtitle_only() -> None:
    assert build_metadata_embedding_text(None, "  부제  ") == "부제"


def test_build_metadata_embedding_text_combined() -> None:
    assert (
        build_metadata_embedding_text(["경영"], "비전")
        == "경영 | 비전"
    )


def test_build_metadata_embedding_text_empty() -> None:
    assert build_metadata_embedding_text(None, None) is None
    assert build_metadata_embedding_text([], "") is None


def test_enrich_skips_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SR_BODY_METADATA_EMBED", "0")
    bodies = [{"toc_path": ["A"], "subtitle": "B"}]
    enrich_bodies_with_toc_subtitle_embeddings(bodies)
    assert "content_embedding" not in bodies[0]


def test_enrich_fills_when_mocked(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SR_BODY_METADATA_EMBED", "1")

    def fake_generate(self, texts, normalize=True):  # noqa: ARG001
        n = len(texts)
        return np.ones((n, 1024), dtype=np.float32)

    monkeypatch.setattr(
        "backend.domain.v1.ifrs_agent.service.embedding_service.EmbeddingService.generate_embeddings",
        fake_generate,
    )
    bodies = [
        {"page_number": 1, "toc_path": ["제목"], "subtitle": "부제"},
        {"page_number": 2, "toc_path": None, "subtitle": None},
    ]
    enrich_bodies_with_toc_subtitle_embeddings(bodies)
    assert bodies[0]["content_embedding_text"] == "제목 | 부제"
    assert len(bodies[0]["content_embedding"]) == 1024
    assert bodies[0]["embedding_status"] == "metadata_embedded"
    assert "content_embedding" not in bodies[1]
