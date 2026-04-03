"""다중 파서 병합 로직 테스트."""
import sys
import unittest
from pathlib import Path


# loguru 없을 때 스텁
try:
    from loguru import logger
except ImportError:
    class _LoggerStub:
        def info(self, *args, **kwargs): pass
        def warning(self, *args, **kwargs): pass
        def error(self, *args, **kwargs): pass
    logger = _LoggerStub()
    sys.modules["loguru"] = type(sys)("loguru")
    sys.modules["loguru"].logger = logger


def _bootstrap_direct_import():
    """shared.tool.__init__.py를 우회해 multi_parser_merger만 직접 로드."""
    repo_root = Path(__file__).resolve().parents[5]
    merger_path = (
        repo_root
        / "backend"
        / "domain"
        / "shared"
        / "tool"
        / "sr_report"
        / "index"
        / "multi_parser_merger.py"
    )
    
    if not merger_path.exists():
        raise FileNotFoundError(f"multi_parser_merger.py not found: {merger_path}")
    
    import importlib.util
    spec = importlib.util.spec_from_file_location("multi_parser_merger", merger_path)
    if not spec or not spec.loader:
        raise ImportError("Cannot load multi_parser_merger.py")
    
    merger_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(merger_module)
    return merger_module


# 모듈 직접 로드
merger_module = _bootstrap_direct_import()
merge_parser_results = merger_module.merge_parser_results
ParsingQualityGate = merger_module.ParsingQualityGate
MultiParserMerger = merger_module.MultiParserMerger
compute_cross_parser_field_metrics = merger_module.compute_cross_parser_field_metrics
build_observability_payload = merger_module.build_observability_payload
ensure_merge_row_keys = merger_module.ensure_merge_row_keys
merge_row_key = merger_module.merge_row_key
split_markdown_index_chunks = merger_module.split_markdown_index_chunks


class TestParsingQualityGate(unittest.TestCase):
    """품질 게이트 테스트."""

    def test_pass_with_valid_result(self):
        """정상 결과는 통과."""
        result = {
            "sr_report_index": [
                {"index_type": "gri", "dp_id": "GRI-2-1", "page_numbers": [10]},
                {"index_type": "gri", "dp_id": "GRI-305-1", "page_numbers": [20, 21]},
            ]
        }
        gate = ParsingQualityGate()
        passed, reason = gate.check_quality(result, "test_parser")
        self.assertTrue(passed)
        self.assertEqual(reason, "")

    def test_fail_with_error(self):
        """error 필드 있으면 실패."""
        result = {"error": "파싱 실패"}
        gate = ParsingQualityGate()
        passed, reason = gate.check_quality(result, "test_parser")
        self.assertFalse(passed)
        self.assertIn("error", reason)

    def test_fail_with_insufficient_rows(self):
        """행 수 부족 시 실패."""
        result = {"sr_report_index": []}
        gate = ParsingQualityGate()
        passed, reason = gate.check_quality(result, "test_parser", min_rows=1)
        self.assertFalse(passed)
        self.assertIn("행 수 부족", reason)

    def test_fail_with_low_fill_rate(self):
        """필수 필드 채움률 낮으면 실패."""
        result = {
            "sr_report_index": [
                {"index_type": "gri", "dp_id": "GRI-2-1", "page_numbers": [10]},
                {"index_type": "gri"},  # dp_id, page_numbers 누락
                {"index_type": "gri"},  # dp_id, page_numbers 누락
            ]
        }
        gate = ParsingQualityGate()
        passed, reason = gate.check_quality(result, "test_parser")
        self.assertFalse(passed)
        self.assertIn("채움률", reason)

    def test_llamaparse_pass_with_page_markdown_only(self):
        """LlamaParse: sr_report_index 없어도 page_markdown이 있으면 게이트 통과."""
        result = {
            "sr_report_index": [],
            "page_markdown": {1: "# Index\n| Code | Page |\n| GRI-2-1 | 10 |"},
        }
        gate = ParsingQualityGate()
        passed, reason = gate.check_quality(result, "llamaparse", min_rows=1)
        self.assertTrue(passed)
        self.assertEqual(reason, "")


class TestMultiParserMerger(unittest.TestCase):
    """병합 로직 테스트."""

    def test_docling_only_when_llama_fails(self):
        """llamaparse 실패 시 docling만 사용."""
        docling_result = {
            "sr_report_index": [
                {"index_type": "gri", "dp_id": "GRI-2-1", "page_numbers": [10]},
            ]
        }
        llama_result = {"error": "파싱 실패"}

        merged = merge_parser_results(docling_result, llama_result)
        self.assertEqual(merged["merge_strategy"], "docling_only")
        self.assertEqual(len(merged["sr_report_index"]), 1)
        self.assertEqual(merged["sr_report_index"][0]["dp_id"], "GRI-2-1")

    def test_llamaparse_only_when_docling_fails(self):
        """docling 실패 시 llamaparse만 사용."""
        docling_result = {"error": "파싱 실패"}
        llama_result = {
            "sr_report_index": [
                {"index_type": "ifrs", "dp_id": "S2-6", "page_numbers": [15]},
            ]
        }

        merged = merge_parser_results(docling_result, llama_result)
        self.assertEqual(merged["merge_strategy"], "llamaparse_only")
        self.assertEqual(len(merged["sr_report_index"]), 1)
        self.assertEqual(merged["sr_report_index"][0]["dp_id"], "S2-6")

    def test_both_failed_when_docling_fails_and_llama_only_markdown(self):
        """docling 실패 + LlamaParse는 마크다운만(행 없음)이면 단독 사용 불가 → 둘 다 실패."""
        docling_result = {"error": "docling 실패"}
        llama_result = {
            "sr_report_index": [],
            "page_markdown": {1: "| GRI-2-1 | 10 |\n"},
        }
        merged = merge_parser_results(docling_result, llama_result)
        self.assertEqual(merged["merge_strategy"], "both_failed")
        self.assertEqual(len(merged["sr_report_index"]), 0)

    def test_merge_docling_with_llama_markdown_only_empty_rows(self):
        """docling 통과 + llamaparse는 MD만(행 없음): 병합은 docling 행만 사용."""
        docling_result = {
            "sr_report_index": [
                {"index_type": "gri", "dp_id": "GRI-2-1", "page_numbers": [10]},
            ]
        }
        llama_result = {
            "sr_report_index": [],
            "page_markdown": {1: "| GRI-305-1 | 20 |\n"},
        }
        merged = merge_parser_results(docling_result, llama_result)
        self.assertEqual(merged["merge_strategy"], "merged")
        self.assertEqual(len(merged["sr_report_index"]), 1)
        self.assertEqual(merged["sr_report_index"][0]["dp_id"], "GRI-2-1")

    def test_both_failed(self):
        """둘 다 실패 시 오류."""
        docling_result = {"error": "docling 실패"}
        llama_result = {"error": "llamaparse 실패"}

        merged = merge_parser_results(docling_result, llama_result)
        self.assertEqual(merged["merge_strategy"], "both_failed")
        self.assertEqual(len(merged["sr_report_index"]), 0)
        self.assertIn("error", merged)

    def test_merge_same_dpid_identical_values(self):
        """같은 dp_id, 동일한 값 → 병합."""
        docling_result = {
            "sr_report_index": [
                {
                    "index_type": "gri",
                    "dp_id": "GRI-2-1",
                    "page_numbers": [10],
                    "dp_name": "조직 개요",
                },
            ]
        }
        llama_result = {
            "sr_report_index": [
                {
                    "index_type": "gri",
                    "dp_id": "GRI-2-1",
                    "page_numbers": [10],
                    "dp_name": "조직 개요",
                },
            ]
        }

        merged = merge_parser_results(docling_result, llama_result)
        self.assertEqual(merged["merge_strategy"], "merged")
        self.assertEqual(len(merged["sr_report_index"]), 1)
        self.assertEqual(merged["sr_report_index"][0]["dp_id"], "GRI-2-1")
        self.assertEqual(merged["sr_report_index"][0]["dp_name"], "조직 개요")
        self.assertEqual(len(merged["conflicts"]), 0)

    def test_merge_same_dpid_different_page_numbers(self):
        """같은 dp_id, 다른 page_numbers → 합집합."""
        docling_result = {
            "sr_report_index": [
                {"index_type": "gri", "dp_id": "GRI-2-1", "page_numbers": [10, 11]},
            ]
        }
        llama_result = {
            "sr_report_index": [
                {"index_type": "gri", "dp_id": "GRI-2-1", "page_numbers": [11, 12]},
            ]
        }

        merged = merge_parser_results(docling_result, llama_result)
        self.assertEqual(merged["merge_strategy"], "merged")
        self.assertEqual(len(merged["sr_report_index"]), 1)
        page_nums = merged["sr_report_index"][0]["page_numbers"]
        self.assertEqual(sorted(page_nums), [10, 11, 12])
        self.assertEqual(len(merged["conflicts"]), 1)  # page_numbers 불일치

    def test_merge_docling_only_dpid(self):
        """docling에만 있는 dp_id → needs_review."""
        docling_result = {
            "sr_report_index": [
                {"index_type": "gri", "dp_id": "GRI-2-1", "page_numbers": [10]},
            ]
        }
        llama_result = {
            "sr_report_index": [
                {"index_type": "gri", "dp_id": "GRI-305-1", "page_numbers": [20]},
            ]
        }

        merged = merge_parser_results(docling_result, llama_result)
        self.assertEqual(merged["merge_strategy"], "merged")
        self.assertEqual(len(merged["sr_report_index"]), 2)
        self.assertEqual(len(merged["needs_review"]), 2)

    def test_merge_duplicate_dp_id_two_rows_preserved(self):
        """동일 dp_id·동일 index_page_number 두 행이 병합 후에도 2건 유지."""
        docling_result = {
            "sr_report_index": [
                {
                    "index_type": "gri",
                    "dp_id": "GRI-3-3",
                    "page_numbers": [10],
                    "index_page_number": 138,
                },
                {
                    "index_type": "gri",
                    "dp_id": "GRI-3-3",
                    "page_numbers": [11],
                    "index_page_number": 138,
                },
            ]
        }
        llama_result = {
            "sr_report_index": [
                {
                    "index_type": "gri",
                    "dp_id": "GRI-3-3",
                    "page_numbers": [10],
                    "index_page_number": 138,
                },
                {
                    "index_type": "gri",
                    "dp_id": "GRI-3-3",
                    "page_numbers": [11],
                    "index_page_number": 138,
                },
            ]
        }
        merged = merge_parser_results(docling_result, llama_result)
        self.assertEqual(merged["merge_strategy"], "merged")
        self.assertEqual(len(merged["sr_report_index"]), 2)
        dp_ids = [r.get("dp_id") for r in merged["sr_report_index"]]
        self.assertEqual(dp_ids, ["GRI-3-3", "GRI-3-3"])

    def test_ensure_merge_row_keys_assigns_sequence(self):
        """동일 dp_id 연속 행에 row_sequence 부여."""
        raw = [
            {"dp_id": "X", "index_type": "gri", "page_numbers": [1], "index_page_number": 5},
            {"dp_id": "X", "index_type": "gri", "page_numbers": [2], "index_page_number": 5},
        ]
        fixed = ensure_merge_row_keys(raw)
        self.assertEqual(fixed[0]["row_sequence"], 0)
        self.assertEqual(fixed[1]["row_sequence"], 1)
        self.assertNotEqual(fixed[0]["index_entry_id"], fixed[1]["index_entry_id"])
        # 보강 전에는 동일 dp_id+페이지로 키가 겹칠 수 있음 → 보강 후 구분
        self.assertEqual(merge_row_key(fixed[0]), merge_row_key(raw[0]))  # 첫 행은 seq 0
        self.assertNotEqual(merge_row_key(fixed[0]), merge_row_key(fixed[1]))

    def test_split_markdown_chunks_long_page(self):
        """긴 마크다운은 여러 청크로 분할 (LLM 매핑용)."""
        big = "x" * 20000
        chunks = split_markdown_index_chunks(big, max_chars=8000, overlap=400)
        self.assertGreaterEqual(len(chunks), 2)
        self.assertTrue(all(len(c) <= 8000 for c in chunks))

    def test_merge_with_total_pages_validation(self):
        """total_pages 초과 페이지 제거."""
        docling_result = {
            "sr_report_index": [
                {"index_type": "gri", "dp_id": "GRI-2-1", "page_numbers": [10, 200]},
            ]
        }
        llama_result = {
            "sr_report_index": [
                {"index_type": "gri", "dp_id": "GRI-2-1", "page_numbers": [10]},
            ]
        }

        merged = merge_parser_results(docling_result, llama_result, total_pages=150)
        self.assertEqual(len(merged["sr_report_index"]), 1)
        page_nums = merged["sr_report_index"][0]["page_numbers"]
        self.assertIn(10, page_nums)
        self.assertNotIn(200, page_nums)

    def test_merge_conflict_resolution_priority(self):
        """불일치 시 우선순위 규칙 적용."""
        docling_result = {
            "sr_report_index": [
                {
                    "index_type": "gri",
                    "dp_id": "GRI-2-1",
                    "page_numbers": [10],
                    "dp_name": "짧음",
                },
            ]
        }
        llama_result = {
            "sr_report_index": [
                {
                    "index_type": "ifrs",  # 다른 index_type
                    "dp_id": "S2-1",  # 다른 dp_id
                    "page_numbers": [10],
                    "dp_name": "긴 지표명입니다 더 길어요",
                },
            ]
        }

        merged = merge_parser_results(docling_result, llama_result)
        self.assertEqual(merged["merge_strategy"], "merged")
        self.assertEqual(len(merged["sr_report_index"]), 2)  # 다른 dp_id이므로 각각


class TestObservabilityMetrics(unittest.TestCase):
    """관측성: 필드별 합의율·불일치율·보류·충돌."""

    def test_compute_cross_parser_field_metrics_agree(self):
        doc = [{"dp_id": "A", "index_type": "gri", "page_numbers": [1], "dp_name": "x"}]
        llama = [{"dp_id": "A", "index_type": "gri", "page_numbers": [1], "dp_name": "x"}]
        m = compute_cross_parser_field_metrics(doc, llama)
        self.assertEqual(m["dp_counts"]["both_parsers"], 1)
        fm = m["field_metrics"]["dp_id"]
        self.assertEqual(fm["comparable"], 1)
        self.assertEqual(fm["agree"], 1)
        self.assertEqual(fm["disagree"], 0)
        self.assertEqual(fm["agreement_rate"], 1.0)
        self.assertEqual(fm["disagreement_rate"], 0.0)
        self.assertEqual(m["overall"]["weighted_agreement_rate"], 1.0)

    def test_compute_cross_parser_field_metrics_disagree(self):
        doc = [{"dp_id": "A", "index_type": "gri", "page_numbers": [1]}]
        llama = [{"dp_id": "A", "index_type": "gri", "page_numbers": [2]}]
        m = compute_cross_parser_field_metrics(doc, llama)
        fm = m["field_metrics"]["page_numbers"]
        self.assertEqual(fm["comparable"], 1)
        self.assertEqual(fm["agree"], 0)
        self.assertEqual(fm["disagree"], 1)
        self.assertEqual(fm["agreement_rate"], 0.0)
        self.assertEqual(fm["disagreement_rate"], 1.0)

    def test_merge_includes_observability_merged(self):
        docling_result = {
            "sr_report_index": [
                {"index_type": "gri", "dp_id": "GRI-2-1", "page_numbers": [10]},
            ]
        }
        llama_result = {
            "sr_report_index": [
                {"index_type": "gri", "dp_id": "GRI-2-1", "page_numbers": [10]},
            ]
        }
        merged = merge_parser_results(docling_result, llama_result)
        obs = merged.get("observability") or {}
        self.assertEqual(obs.get("merge_strategy"), "merged")
        self.assertEqual(obs.get("cross_parser"), "computed")
        self.assertEqual(obs.get("needs_review_count"), 0)
        self.assertIn("field_metrics", obs)
        self.assertIn("overall", obs)
        self.assertIsNotNone((obs.get("overall") or {}).get("weighted_agreement_rate"))

    def test_merge_includes_observability_docling_only(self):
        docling_result = {
            "sr_report_index": [
                {"index_type": "gri", "dp_id": "GRI-2-1", "page_numbers": [10]},
            ]
        }
        llama_result = {"error": "실패"}
        merged = merge_parser_results(docling_result, llama_result)
        obs = merged.get("observability") or {}
        self.assertEqual(obs.get("merge_strategy"), "docling_only")
        self.assertEqual(obs.get("cross_parser"), "not_applicable")
        self.assertEqual(obs.get("merged_row_count"), 1)

    def test_build_observability_payload_counts(self):
        conflicts = [{"dp_id": "A", "fields": {"x": {}}}]
        needs = [{"dp_id": "B", "reason": "r"}]
        obs = build_observability_payload(
            merge_strategy="merged",
            docling_items=[{"dp_id": "A", "index_type": "gri", "page_numbers": [1]}],
            llama_items=[{"dp_id": "A", "index_type": "gri", "page_numbers": [2]}],
            conflicts=conflicts,
            needs_review=needs,
            row_count=1,
        )
        self.assertEqual(obs["conflict_dp_count"], 1)
        self.assertEqual(obs["needs_review_count"], 1)
        self.assertEqual(obs["conflict_field_entries"], 1)


if __name__ == "__main__":
    unittest.main()
