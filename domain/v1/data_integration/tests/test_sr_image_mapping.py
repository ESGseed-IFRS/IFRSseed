"""sr_image_mapping 단위 테스트."""
from __future__ import annotations

from backend.domain.shared.tool.sr_report.images import map_extracted_images_to_sr_report_rows


def test_map_extracted_images_to_rows_orders_by_page() -> None:
    rid = "00000000-0000-0000-0000-000000000099"
    by_page = {
        3: [{"path": "/tmp/a.png", "width": 10, "height": 20, "size_bytes": 100, "image_index": 0}],
        1: [
            {"path": "/tmp/b.png", "width": 5, "height": 5, "size_bytes": 50, "image_index": 0},
            {"path": "/tmp/c.png", "width": 5, "height": 5, "size_bytes": 51, "image_index": 1},
        ],
    }
    rows = map_extracted_images_to_sr_report_rows(rid, by_page)
    assert len(rows) == 3
    assert rows[0]["page_number"] == 1
    assert rows[0]["image_index"] == 0
    assert rows[1]["page_number"] == 1
    assert rows[1]["image_index"] == 1
    assert rows[2]["page_number"] == 3
    assert rows[2]["image_file_path"] == "/tmp/a.png"
    assert rows[2]["image_file_size"] == 100
