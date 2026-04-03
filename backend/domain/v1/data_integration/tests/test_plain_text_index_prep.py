"""평문 다단 인덱스 전처리·dp_id OCR 정규화 단위 테스트."""
from __future__ import annotations

import unittest

from backend.domain.shared.tool.sr_report.index.preprocessing.sr_index_plain_text import (
    build_llm_index_context_prefix,
    build_right_column_plaintext_supplement,
    gri_standards_index_context_prefix,
    markdown_implies_gri_standards_index,
    normalize_dp_id_ocr_confusables,
    normalize_gri_prefixed_dp_id,
    prepare_index_page_markdown_for_llm,
)


class TestPlainTextIndexPrep(unittest.TestCase):
    def test_pipe_table_unchanged(self):
        md = """| Code | Page |
| --- | --- |
| GRI-2-1 | 10 |
| GRI-2-2 | 11 |
"""
        out = prepare_index_page_markdown_for_llm(md)
        self.assertEqual(out.strip(), md.strip())
        self.assertNotIn("0001|", out)

    def test_plain_text_gets_line_numbers(self):
        md = """GRI Standards Index
            2-1            조직 세부 정보                    7, 8
            2-2            목록                               2
"""
        out = prepare_index_page_markdown_for_llm(md)
        self.assertIn("[형식 힌트]", out)
        self.assertRegex(out, r"0001\|")
        self.assertIn("GRI Standards Index", out)

    def test_normalize_cyrillic_confusables_in_dp_id(self):
        # Cyrillic В, Р, О vs Latin B, P, O
        self.assertEqual(normalize_dp_id_ocr_confusables("ВР-1"), "BP-1")
        self.assertEqual(normalize_dp_id_ocr_confusables("GОВ-1"), "GOB-1")

    def test_gri_page_detected_over_nav_esrs(self):
        md = """INTRODUCTION ESRS Index
GRI Standards Index
            2-1  조직  7
"""
        self.assertTrue(markdown_implies_gri_standards_index(md))
        self.assertIn("gri", build_llm_index_context_prefix(md).lower())
        self.assertIn("GRI-", gri_standards_index_context_prefix())

    def test_esrs_standalone_title_over_multi_index_nav(self):
        """상단 한 줄에 GRI/SASB/IFRS/ESRS가 같이 있어도 본문 ESRS Index가 우선."""
        md = """ESG Data ... GRI Standards Index  SASB Index  IFRS Index  ESRS Index  ...
ESRS Index

GOV-1  일반 공시  12
"""
        prefix = build_llm_index_context_prefix(md)
        self.assertIn("esrs", prefix.lower())
        # GRI 전용 접두(이 페이지는 GRI Standards Index로 보임)가 선택되지 않았는지
        self.assertNotIn("GRI Standards Index**(또는 GRI 공시 목차)로 보입니다", prefix)

    def test_ifrs_standalone_title_over_nav(self):
        md = """... GRI Standards Index SASB Index IFRS Index ESRS Index ...
IFRS Index

IFRS S1 Index
"""
        self.assertIn("ifrs", build_llm_index_context_prefix(md).lower())

    def test_sasb_standalone_title_over_nav(self):
        md = """... GRI Standards Index SASB Index IFRS Index ESRS Index ...
SASB Index
"""
        self.assertIn("sasb", build_llm_index_context_prefix(md).lower())

    def test_nav_only_gri_without_table_rows_returns_empty_prefix(self):
        """네비에만 GRI 문자열이 있고 본문 표 행이 없으면 GRI 맥락을 강제하지 않음."""
        md = "ESG Data ... GRI Standards Index  SASB Index  IFRS Index  ESRS Index  ..."
        self.assertEqual(build_llm_index_context_prefix(md), "")

    def test_nav_plus_gri_numeric_rows_still_gri(self):
        md = """ESG Data ... GRI Standards Index  SASB Index  IFRS Index  ESRS Index  ...
2-1            조직 세부 정보                    7, 8
"""
        self.assertIn("gri", build_llm_index_context_prefix(md).lower())

    def test_right_column_supplement_extracts_second_block(self):
        """다단 긴 줄에서 오른쪽 열 추정 블록이 생성되는지."""
        md = """GRI Standards Index
            2-1            왼쪽지표명                    7, 8                    GRΙ 3: Material     3-1            오른쪽지표                           19
            2-2            왼쪽둘                                           2                    302-1          에너지소비                           131
            2-3            왼쪽셋                                           2                    302-3          에너지집약도                         131
            2-4            왼쪽넷                                      131, 137                    205-3          부패사례                           115
            2-5            왼쪽다섯                                    156~157                    305-1          스코프1                           131
            2-6            왼쪽여섯                                    9~14                      305-2          스코프2                           131
"""
        prepared = prepare_index_page_markdown_for_llm(md)
        sup = build_right_column_plaintext_supplement(prepared)
        self.assertIsNotNone(sup)
        self.assertIn("302-3", sup)
        self.assertIn("205-3", sup)
        self.assertIn("오른쪽 열로 추정", sup)

    def test_normalize_gri_prefix_for_numeric_code(self):
        self.assertEqual(normalize_gri_prefixed_dp_id("gri", "2-12"), "GRI-2-12")
        self.assertEqual(normalize_gri_prefixed_dp_id("gri", "GRI-2-1"), "GRI-2-1")
        self.assertEqual(normalize_gri_prefixed_dp_id("esrs", "2-12"), "2-12")
        self.assertEqual(
            normalize_gri_prefixed_dp_id("gri", "TC-SI-130a.1"),
            "TC-SI-130a.1",
        )


if __name__ == "__main__":
    unittest.main()
