"""sr_index_mapping: GRI 인덱스(영문 Disclosure 등) 분류·Page 열 탐지."""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

# shared.tool 패키지 __init__이 langchain을 로드할 수 있어, 단위 테스트는 모듈 파일만 직접 로드
_MAPPING_PATH = (
    Path(__file__).resolve().parents[3]
    / "shared"
    / "tool"
    / "sr_report"
    / "index"
    / "mapping"
    / "sr_index_mapping.py"
)
_spec = importlib.util.spec_from_file_location(
    "sr_index_mapping_testonly", _MAPPING_PATH
)
assert _spec and _spec.loader
M = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(M)


class TestFindPageColumnIndex(unittest.TestCase):
    def test_prefers_page_over_note(self) -> None:
        header = ["Disclosure", "Indicator", "Page", "Note"]
        self.assertEqual(M._find_page_column_index(header), 2)

    def test_exact_page(self) -> None:
        header = ["A", "page", "B"]
        self.assertEqual(M._find_page_column_index(header), 1)

    def test_korean_page(self) -> None:
        header = ["공시", "페이지", "비고"]
        self.assertEqual(M._find_page_column_index(header), 1)


class TestDetectTableIndexType(unittest.TestCase):
    def test_english_disclosure_header_with_gri_rows(self) -> None:
        header = ["Disclosure", "Indicator", "Page"]
        rows = [
            ["GRI-2-1", "x", "10"],
            ["GRI-3-3", "y", "11-12"],
        ]
        t, pfx = M._detect_table_index_type(header, 0, rows)
        self.assertEqual(t, "gri")
        self.assertEqual(pfx, "")

    def test_disclosure_without_header_keyword_gri_in_cells(self) -> None:
        """헤더가 애매해도 셀에 GRI- 가 있으면 gri."""
        header = ["ColA", "ColB"]
        rows = [["GRI-205-2", "1"]]
        t, pfx = M._detect_table_index_type(header, 0, rows)
        self.assertEqual(t, "gri")
        self.assertEqual(pfx, "")

    def test_numeric_disclosure_code(self) -> None:
        header = ["Disclosure", "Page"]
        rows = [["2-18", "100"]]
        t, pfx = M._detect_table_index_type(header, 0, rows)
        self.assertEqual(t, "gri")
        self.assertEqual(pfx, "GRI-")

    def test_esrs_kr_index_layout_and_codes(self) -> None:
        header = ["구분", "Code", "항목", "Page"]
        rows = [
            ["S", "S2-5", "항목명", "31"],
            ["S", "S2-6", "항목명2", "32"],
        ]
        t, pfx = M._detect_table_index_type(header, 1, rows)
        self.assertEqual(t, "esrs")
        self.assertEqual(pfx, "")


class TestMapTablesIntegration(unittest.TestCase):
    def test_maps_gri_english_headers(self) -> None:
        tables = [
            {
                "page": 138,
                "header": ["Disclosure", "Indicator", "Page"],
                "rows": [
                    ["GRI-2-1", "name", "7-8"],
                ],
            }
        ]
        out = M.map_tables_to_sr_report_index(tables, "report-uuid")
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["index_type"], "gri")
        self.assertEqual(out[0]["index_page_number"], 138)
        self.assertEqual(out[0]["page_numbers"], [7, 8])
        self.assertEqual(out[0]["dp_id"], "GRI-2-1")

    def test_maps_esrs_table(self) -> None:
        tables = [
            {
                "page": 143,
                "header": ["구분", "Code (ESRS)", "항목", "Page"],
                "rows": [
                    ["소비자", "S4-2", "설명", "55-57"],
                ],
            }
        ]
        out = M.map_tables_to_sr_report_index(tables, "report-uuid")
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["index_type"], "esrs")
        self.assertEqual(out[0]["dp_id"], "S4-2")
        self.assertEqual(out[0]["page_numbers"], [55, 56, 57])


if __name__ == "__main__":
    unittest.main()
