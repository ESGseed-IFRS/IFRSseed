"""sr_body_mapping: 페이지 제목 기반 toc_path 할당."""
from __future__ import annotations

from backend.domain.shared.tool.sr_report.body import map_body_pages_to_sr_report_body
from backend.domain.shared.tool.sr_report.body.sr_body_mapping import (
    extract_page_heading,
    extract_title_and_subtitle_ko,
)


def test_extract_page_heading_uses_top_title_line() -> None:
    text = """
Samsung SDS Sustainability Report 2023

CEO 인사말

안녕하십니까.
"""
    assert extract_page_heading(text) == "CEO 인사말"


def test_map_body_pages_sets_toc_path_from_page_heading() -> None:
    bodies = map_body_pages_to_sr_report_body(
        body_by_page={
            1: "## Contents\n| A |",
            2: "CEO 인사말\n\n본문입니다.",
            3: "회사소개\n\n삼성SDS는 ...",
        },
        report_id="00000000-0000-0000-0000-000000000001",
        index_page_numbers=[1],
    )
    by_pn = {b["page_number"]: b for b in bodies}
    assert by_pn[1]["toc_path"] is None
    assert by_pn[1]["is_index_page"] is True
    assert by_pn[2]["toc_path"] == ["CEO 인사말"]
    assert by_pn[2].get("subtitle") is None
    assert by_pn[3]["toc_path"] == ["회사소개"]
    assert by_pn[3].get("subtitle") is None


def test_map_body_pages_sets_subtitle_after_korean_title() -> None:
    bodies = map_body_pages_to_sr_report_body(
        body_by_page={
            1: "## Contents\n| A |",
            2: "환경경영\n지속가능한 미래를 위한 노력\n\n본문 시작합니다.",
        },
        report_id="00000000-0000-0000-0000-000000000001",
        index_page_numbers=[1],
    )
    by_pn = {b["page_number"]: b for b in bodies}
    assert by_pn[2]["toc_path"] == ["환경경영"]
    assert by_pn[2]["subtitle"] == "지속가능한 미래를 위한 노력"


def test_extract_page_heading_skips_non_hangul_title() -> None:
    text = "Executive Summary\n\nWe report."
    assert extract_page_heading(text) is None


def test_extract_title_and_subtitle_skips_english_then_takes_korean() -> None:
    t, s = extract_title_and_subtitle_ko("About\n\n경영방침\n투명 경영 원칙\n\n내용")
    assert t == "경영방침"
    assert s == "투명 경영 원칙"
