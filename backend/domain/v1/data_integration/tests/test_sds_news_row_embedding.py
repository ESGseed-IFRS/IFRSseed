"""sds_news_row_embedding — 설정·EmbeddingService 목."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import numpy as np

from backend.domain.v1.data_integration.hub.services.external_company.sds_news_row_embedding import (
    enrich_external_company_rows_with_embeddings,
)


def _settings_mock(
    *,
    embed: bool = False,
    batch: int = 16,
    body_max: int = 12000,
) -> MagicMock:
    m = MagicMock()
    m.sds_news_embed = embed
    m.sds_news_embed_batch_size = batch
    m.sds_news_embed_body_max_chars = body_max
    return m


def test_enrich_noop_when_disabled() -> None:
    rows = [
        {
            "title": "t",
            "body_text": "b",
            "category": None,
            "category_embedding": None,
            "body_embedding": None,
        }
    ]
    with patch(
        "backend.domain.v1.data_integration.hub.services.external_company.sds_news_row_embedding.get_settings",
        return_value=_settings_mock(embed=False),
    ):
        enrich_external_company_rows_with_embeddings(rows)
    assert rows[0]["category_embedding"] is None
    assert rows[0]["body_embedding"] is None


def test_enrich_fills_category_and_body_embeddings() -> None:
    rows = [
        {
            "title": "헤드라인",
            "category": "백업",
            "body_text": "본문",
            "category_embedding": None,
            "body_embedding": None,
        }
    ]
    vec = np.ones(1024, dtype=np.float32)

    class FakeEmb:
        def generate_embeddings(self, texts: list[str], normalize: bool = True):
            return np.stack([vec for _ in texts], axis=0)

    with patch(
        "backend.domain.v1.data_integration.hub.services.external_company.sds_news_row_embedding.get_settings",
        return_value=_settings_mock(embed=True),
    ), patch(
        "backend.domain.shared.tool.sr_report.images.sr_image_caption_embedding.EmbeddingService",
        return_value=FakeEmb(),
    ):
        enrich_external_company_rows_with_embeddings(rows)

    assert rows[0]["category_embedding"] is not None
    assert len(rows[0]["category_embedding"]) == 1024
    assert rows[0]["body_embedding"] is not None
    assert len(rows[0]["body_embedding"]) == 1024


def test_title_empty_uses_category_for_category_embedding() -> None:
    rows = [
        {
            "title": "",
            "category": "분류만",
            "body_text": "",
            "category_embedding": None,
            "body_embedding": None,
        }
    ]
    captured: list[list[str]] = []

    class FakeEmb:
        def generate_embeddings(self, texts: list[str], normalize: bool = True):
            captured.append(list(texts))
            return np.zeros((len(texts), 1024), dtype=np.float32)

    with patch(
        "backend.domain.v1.data_integration.hub.services.external_company.sds_news_row_embedding.get_settings",
        return_value=_settings_mock(embed=True),
    ), patch(
        "backend.domain.shared.tool.sr_report.images.sr_image_caption_embedding.EmbeddingService",
        return_value=FakeEmb(),
    ):
        enrich_external_company_rows_with_embeddings(rows)

    assert captured and captured[0] == ["분류만"]
    assert rows[0]["category_embedding"] is not None
    assert rows[0]["body_embedding"] is None
