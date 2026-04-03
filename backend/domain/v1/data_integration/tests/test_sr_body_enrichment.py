"""sr_body_enrichment: 문단 분할·content_type 휴리스틱."""
from __future__ import annotations

from backend.domain.shared.tool.sr_report.body.sr_body_enrichment import (
    classify_body_content_type,
    split_content_into_paragraphs,
)
from backend.domain.shared.tool.sr_report.body import map_body_pages_to_sr_report_body


def test_split_content_into_paragraphs_offsets_match_text() -> None:
    text = "첫 문단입니다.\n\n둘째 문단."
    paras = split_content_into_paragraphs(text, min_len=1)
    assert len(paras) == 2
    for p in paras:
        assert text[p["start_char"] : p["end_char"]] == p["text"]


def test_classify_table_markdown() -> None:
    md = "| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |"
    assert classify_body_content_type(md) in ("table", "mixed")


def test_classify_narrative() -> None:
    assert classify_body_content_type("이 보고서는 지속가능경영 활동을 설명합니다.") == "narrative"


def test_map_body_pages_enriches_fields() -> None:
    bodies = map_body_pages_to_sr_report_body(
        body_by_page={1: "A\n\nB"},
        report_id="00000000-0000-0000-0000-000000000001",
        index_page_numbers=[],
    )
    assert len(bodies) == 1
    assert bodies[0]["content_type"] == "narrative"
    assert bodies[0]["paragraphs"] is not None
    assert len(bodies[0]["paragraphs"]) == 2
    assert bodies[0]["paragraphs"][0]["order"] == 1
    assert bodies[0].get("toc_path") is None
