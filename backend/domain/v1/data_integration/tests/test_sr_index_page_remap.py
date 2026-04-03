"""sr_index_agent: 소형 PDF → 원본 PDF 페이지 재매핑 단위 테스트."""
from __future__ import annotations

import unittest

from backend.domain.shared.tool.sr_report.index.mapping.sr_index_page_remap import (
    remap_index_page_number_to_original,
    remap_slice_pages_to_original,
)


class TestRemapSlicePages(unittest.TestCase):
    def setUp(self) -> None:
        self.chosen = [138, 139, 140, 141, 142, 143]

    def test_relative_pages_in_small_pdf(self) -> None:
        self.assertEqual(
            remap_slice_pages_to_original([1, 2, 3], self.chosen),
            [138, 139, 140],
        )

    def test_absolute_pages_printed_in_table(self) -> None:
        self.assertEqual(
            remap_slice_pages_to_original([138, 139, 140, 141, 142, 143], self.chosen),
            [138, 139, 140, 141, 142, 143],
        )

    def test_old_logic_would_drop_absolute(self) -> None:
        """이전: 138 > len(chosen)=6 이라 전부 제거 → []."""
        pns = [138, 139, 140]
        out = remap_slice_pages_to_original(pns, self.chosen)
        self.assertEqual(out, [138, 139, 140])
        self.assertNotEqual(out, [])

    def test_index_page_number_relative(self) -> None:
        self.assertEqual(
            remap_index_page_number_to_original(1, self.chosen),
            138,
        )

    def test_index_page_number_absolute(self) -> None:
        self.assertEqual(
            remap_index_page_number_to_original(140, self.chosen),
            140,
        )

    def test_index_page_number_none(self) -> None:
        self.assertIsNone(remap_index_page_number_to_original(None, self.chosen))

    def test_esrs_index_body_pages_preserved_with_total_pages(self) -> None:
        """슬라이스가 인덱스 1페이지뿐이어도 본문 절대 페이지는 total_pages로 유지."""
        chosen = [143]
        out = remap_slice_pages_to_original(
            [31, 76, 78, 79],
            chosen,
            total_pages=200,
        )
        self.assertEqual(out, [31, 76, 78, 79])


if __name__ == "__main__":
    unittest.main()
