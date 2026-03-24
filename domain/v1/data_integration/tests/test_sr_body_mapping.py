"""sr_body_mapping: 페이지 제목 기반 toc_path 할당."""
from __future__ import annotations

from backend.domain.shared.tool.sr_report.body import map_body_pages_to_sr_report_body
from backend.domain.shared.tool.sr_report.body.sr_body_mapping import (
    extract_page_heading,
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
    assert by_pn[3]["toc_path"] == ["회사소개"]
