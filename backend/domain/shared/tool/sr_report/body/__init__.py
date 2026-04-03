"""SR 본문(body) 매핑/전처리 모듈."""
from __future__ import annotations

from .sr_body_mapping import (
    extract_page_heading,
    extract_title_and_subtitle_ko,
    map_body_pages_to_sr_report_body,
)
from .sr_body_metadata_embedding import (
    build_metadata_embedding_text,
    enrich_bodies_with_toc_subtitle_embeddings,
)
from .sr_body_enrichment import (
    classify_body_content_type,
    enrich_body_row,
    split_content_into_paragraphs,
)

__all__ = [
    "map_body_pages_to_sr_report_body",
    "extract_page_heading",
    "extract_title_and_subtitle_ko",
    "build_metadata_embedding_text",
    "enrich_bodies_with_toc_subtitle_embeddings",
    "classify_body_content_type",
    "split_content_into_paragraphs",
    "enrich_body_row",
]

