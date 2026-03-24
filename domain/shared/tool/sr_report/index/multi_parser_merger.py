"""다중 파서 결과 병합·검증·품질 게이트.

설계 원칙 (§2-4, §3-2 개선안):
- LLM은 "차이 해석·애매한 병합"만 담당
- 스키마·필수값·병합 우선순위·근거·보류 규칙은 코드로 고정
- 공통 실패·정렬·할루시네이션을 별도 처리
- 동일 dp_id가 여러 행(GRI 3-3 등)이면 (dp_id, index_page_number, row_sequence)로 구분
- Docling은 표 구조·행 단위 추출에 유리, LlamaParse+LLM은 MD 기반 보강·누락 채움에 활용
"""
from __future__ import annotations

import unicodedata
import uuid
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

from loguru import logger


# 필수 필드 정의 (캐논 스키마)
REQUIRED_FIELDS = {"index_type", "dp_id", "page_numbers"}
OPTIONAL_FIELDS = {
    "index_page_number",
    "dp_name",
    "section_title",
    "remarks",
    "parsing_method",
    "confidence_score",
    "report_id",
    "row_sequence",
    "index_entry_id",
    "material_topic",
}

# 관측성: 병합 메타·출처 필드는 필드 비교에서 제외
_SKIP_OBSERVABILITY_KEYS = frozenset(
    {
        "merge_source",
        "parsing_method",
        "index_entry_id",
    }
)


def _is_empty_value(val: Any) -> bool:
    """None·빈 문자열·빈 리스트·빈 dict 를 비어 있음으로 간주."""
    if val is None:
        return True
    if isinstance(val, str) and val.strip() == "":
        return True
    if isinstance(val, (list, dict)) and len(val) == 0:
        return True
    return False


def split_markdown_index_chunks(
    text: str, max_chars: int = 8000, overlap: int = 400
) -> List[str]:
    """
    긴 인덱스 페이지 마크다운을 LLM 호출 단위로 나눕니다.

    map_page_markdown_to_sr_report_index 등에서 재사용합니다.
    """
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    chunks: List[str] = []
    step = max(1, max_chars - overlap)
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start += step
    return chunks


def has_nonempty_page_markdown(result: Dict[str, Any]) -> bool:
    """LlamaParse 결과에 비어 있지 않은 page_markdown 조각이 있는지."""
    pm = result.get("page_markdown") or {}
    if not isinstance(pm, dict):
        return False
    for v in pm.values():
        if v is not None and str(v).strip():
            return True
    return False


def merge_row_key(item: Dict[str, Any]) -> Tuple[Any, ...]:
    """
    병합·교차 파서 매칭용 키 (행 단위).

    동일 dp_id가 여러 번 나오면 (index_page_number, row_sequence)로 구분합니다.
    """
    dp = (item.get("dp_id") or "").strip()
    ipn = item.get("index_page_number")
    try:
        ipn_i = int(ipn) if ipn is not None else -1
    except (TypeError, ValueError):
        ipn_i = -1
    rs = item.get("row_sequence")
    try:
        rs_i = int(rs) if rs is not None else 0
    except (TypeError, ValueError):
        rs_i = 0
    return (dp, ipn_i, rs_i)


def ensure_merge_row_keys(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    같은 dp_id 반복 행에 row_sequence·index_entry_id를 부여합니다.

    그룹: (dp_id, index_page_number) 내에서 입력 순서대로 0..n-1.
    """
    if not items:
        return []
    out = [dict(x) for x in items]
    by_group: Dict[Tuple[str, int], List[int]] = defaultdict(list)
    for i, row in enumerate(out):
        dp = (row.get("dp_id") or "").strip()
        ipn = row.get("index_page_number")
        try:
            ipn_i = int(ipn) if ipn is not None else -1
        except (TypeError, ValueError):
            ipn_i = -1
        by_group[(dp, ipn_i)].append(i)
    # 안정적 순서: 그룹 키 정렬 후 각 그룹 내 원본 인덱스 순
    for (_dp, _ipn), idxs in sorted(by_group.items(), key=lambda t: (t[0][0], t[0][1])):
        for seq, idx in enumerate(idxs):
            row = out[idx]
            if row.get("row_sequence") is None:
                row["row_sequence"] = seq
            if not row.get("index_entry_id"):
                row["index_entry_id"] = str(uuid.uuid4())
    return out


def values_equal_for_metrics(val1: Any, val2: Any) -> bool:
    """두 값이 동일한지 검사 (리스트는 정렬 후 비교)."""
    if isinstance(val1, list) and isinstance(val2, list):
        try:
            return sorted(val1) == sorted(val2)
        except TypeError:
            return val1 == val2
    return val1 == val2


def compute_cross_parser_field_metrics(
    docling_items: List[Dict[str, Any]],
    llama_items: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    동일 행(merge_row_key)에 대해 docling vs llamaparse 필드별 합의·불일치 집계.

    Returns:
        field_metrics, overall(가중 합의율 등), dp_counts
    """
    docling_items = ensure_merge_row_keys(docling_items)
    llama_items = ensure_merge_row_keys(llama_items)
    doc_by = {merge_row_key(i): i for i in docling_items if i.get("dp_id")}
    llama_by = {merge_row_key(i): i for i in llama_items if i.get("dp_id")}
    common = set(doc_by) & set(llama_by)
    doc_only_rows = len(set(doc_by) - set(llama_by))
    llama_only_rows = len(set(llama_by) - set(doc_by))
    all_keys = set(doc_by) | set(llama_by)

    union_fields: Set[str] = set()
    for mk in common:
        union_fields |= set(doc_by[mk].keys()) | set(llama_by[mk].keys())
    union_fields -= _SKIP_OBSERVABILITY_KEYS
    for k in list(union_fields):
        if k.endswith("_source"):
            union_fields.discard(k)

    field_raw: Dict[str, Dict[str, int]] = {}
    for field in union_fields:
        field_raw[field] = {
            "comparable": 0,
            "agree": 0,
            "disagree": 0,
            "doc_only": 0,
            "llama_only": 0,
            "both_null": 0,
        }

    for mk in sorted(common):
        d_row = doc_by[mk]
        l_row = llama_by[mk]
        for field in union_fields:
            dv = d_row.get(field)
            lv = l_row.get(field)
            ed = _is_empty_value(dv)
            el = _is_empty_value(lv)
            fr = field_raw[field]
            if ed and el:
                fr["both_null"] += 1
            elif ed and not el:
                fr["llama_only"] += 1
            elif not ed and el:
                fr["doc_only"] += 1
            else:
                fr["comparable"] += 1
                if values_equal_for_metrics(dv, lv):
                    fr["agree"] += 1
                else:
                    fr["disagree"] += 1

    fields_out: Dict[str, Any] = {}
    sum_agree = 0
    sum_comparable = 0
    sum_disagree = 0
    for field, cnt in sorted(field_raw.items()):
        c = cnt["comparable"]
        a = cnt["agree"]
        d = cnt["disagree"]
        ar = (a / c) if c else None
        dr = (d / c) if c else None
        fields_out[field] = {
            **cnt,
            "agreement_rate": ar,
            "disagreement_rate": dr,
        }
        sum_agree += a
        sum_comparable += c
        sum_disagree += d

    weighted_agreement = (sum_agree / sum_comparable) if sum_comparable else None
    weighted_disagreement = (sum_disagree / sum_comparable) if sum_comparable else None

    return {
        "field_metrics": fields_out,
        "overall": {
            "weighted_agreement_rate": weighted_agreement,
            "weighted_disagreement_rate": weighted_disagreement,
            "total_comparable_field_pairs": sum_comparable,
            "total_agree_pairs": sum_agree,
            "total_disagree_pairs": sum_disagree,
        },
        "dp_counts": {
            "both_parsers": len(common),
            "docling_only_rows": doc_only_rows,
            "llamaparse_only_rows": llama_only_rows,
            "total_union_dp_ids": len(all_keys),
        },
    }


def build_observability_payload(
    *,
    merge_strategy: str,
    docling_items: Optional[List[Dict[str, Any]]] = None,
    llama_items: Optional[List[Dict[str, Any]]] = None,
    conflicts: Optional[List[Dict[str, Any]]] = None,
    needs_review: Optional[List[Dict[str, Any]]] = None,
    row_count: int = 0,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    병합 경로별 관측성 페이로드 (로그·API·에이전트 상태용).

    - merged: 필드별 합의율·불일치율·dp 단위 카운트
    - 단일 파서 / 실패: cross_parser 비교 생략
    """
    conflicts = conflicts or []
    needs_review = needs_review or []
    docling_items = docling_items or []
    llama_items = llama_items or []

    base: Dict[str, Any] = {
        "version": 1,
        "merge_strategy": merge_strategy,
        "needs_review_count": len(needs_review),
        "conflict_dp_count": len(conflicts),
        "conflict_field_entries": sum(
            len(c.get("fields") or {}) for c in conflicts if isinstance(c, dict)
        ),
        "merged_row_count": row_count,
    }
    if extra:
        base.update(extra)

    if merge_strategy == "merged" and docling_items and llama_items:
        cross = compute_cross_parser_field_metrics(docling_items, llama_items)
        base["cross_parser"] = "computed"
        base["field_metrics"] = cross["field_metrics"]
        base["overall"] = cross["overall"]
        base["dp_counts"] = cross["dp_counts"]
    else:
        base["cross_parser"] = "not_applicable"
        base["field_metrics"] = {}
        base["overall"] = {
            "weighted_agreement_rate": None,
            "weighted_disagreement_rate": None,
            "total_comparable_field_pairs": 0,
            "note": "한쪽만 통과·실패·병합 데이터 없음 시 교차 파서 필드 비교 없음",
        }
        base["dp_counts"] = {
            "both_parsers": 0,
            "docling_only_rows": 0,
            "llamaparse_only_rows": 0,
            "total_union_dp_ids": row_count,
        }

    return base


class ParsingQualityGate:
    """파싱 결과 품질 게이트."""

    @staticmethod
    def check_quality(
        result: Dict[str, Any],
        parser_name: str,
        min_rows: int = 1,
    ) -> Tuple[bool, str]:
        """
        파싱 결과가 품질 기준을 통과하는지 검사.

        Returns:
            (통과 여부, 실패 사유)
        """
        if result.get("error"):
            return False, f"{parser_name}: error={result['error']}"

        sr_index = result.get("sr_report_index") or []

        # LlamaParse: page_markdown만 있고 sr_report_index가 비어 있어도 통과
        # (병합 전 LLM이 마크다운→sr_report_index 매핑으로 채움)
        if parser_name == "llamaparse" and len(sr_index) < min_rows:
            if has_nonempty_page_markdown(result):
                return True, ""

        if len(sr_index) < min_rows:
            return False, f"{parser_name}: 행 수 부족({len(sr_index)}건 < {min_rows}건)"

        required_fill_count = 0
        for item in sr_index:
            has_all = all(item.get(f) for f in REQUIRED_FIELDS)
            if has_all:
                required_fill_count += 1

        fill_rate = required_fill_count / len(sr_index) if sr_index else 0
        if fill_rate < 0.5:
            return False, f"{parser_name}: 필수 필드 채움률 {fill_rate:.1%} < 50%"

        return True, ""


class MultiParserMerger:
    """다중 파서 결과 병합."""

    def __init__(self, total_pages: Optional[int] = None):
        self.total_pages = total_pages

    def merge_results(
        self,
        docling_result: Dict[str, Any],
        llamaparse_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Docling과 LlamaParse 결과를 병합.

        전략:
        1. 품질 게이트: 둘 다 통과 → 병합, 한쪽만 통과 → 그쪽 사용, 둘 다 실패 → 오류
        2. dp_id 단위로 정렬·매칭
        3. 한쪽만 값 있음 → 후보값(근거 있으면 채택, 없으면 needs_review)
        4. 둘 다 있고 동일 → 채택
        5. 둘 다 있고 상이 → conflict 플래그 + 우선순위 규칙
        6. 둘 다 없음 → unknown

        Returns:
            {
                "sr_report_index": [...],  # 병합된 결과
                "merge_strategy": "docling_only" | "llamaparse_only" | "merged",
                "conflicts": [...],  # 불일치 항목 목록
                "needs_review": [...],  # 검토 필요 항목
                "quality_report": {...}
            }
        """
        gate = ParsingQualityGate()

        docling_ok, docling_reason = gate.check_quality(docling_result, "docling")
        llama_ok, llama_reason = gate.check_quality(llamaparse_result, "llamaparse")

        # 마크다운으로만 게이트 통과했는데 행이 없으면 llamaparse 단독 사용 불가
        if llama_ok and not docling_ok:
            llama_rows = llamaparse_result.get("sr_report_index") or []
            if len(llama_rows) < 1 and has_nonempty_page_markdown(llamaparse_result):
                llama_ok = False
                llama_reason = (
                    "llamaparse: sr_report_index 행 없음(마크다운만 있음, LLM 매핑 필요)"
                )

        logger.info(
            "[MultiParserMerger] 품질 게이트: docling={}, llamaparse={}",
            "통과" if docling_ok else f"실패({docling_reason})",
            "통과" if llama_ok else f"실패({llama_reason})",
        )

        if not docling_ok and not llama_ok:
            obs = build_observability_payload(
                merge_strategy="both_failed",
                conflicts=[],
                needs_review=[],
                row_count=0,
                extra={
                    "quality_gate_docling": docling_reason,
                    "quality_gate_llamaparse": llama_reason,
                },
            )
            logger.info(
                "[MultiParserMerger] 관측성 merge_strategy={}, needs_review={}, conflict_dp={}",
                obs.get("merge_strategy"),
                obs.get("needs_review_count"),
                obs.get("conflict_dp_count"),
            )
            return {
                "sr_report_index": [],
                "merge_strategy": "both_failed",
                "conflicts": [],
                "needs_review": [],
                "quality_report": {
                    "docling": docling_reason,
                    "llamaparse": llama_reason,
                },
                "error": f"모든 파서 실패: docling={docling_reason}, llamaparse={llama_reason}",
                "observability": obs,
            }

        if docling_ok and not llama_ok:
            logger.info("[MultiParserMerger] docling만 통과, docling 결과 사용")
            rows = ensure_merge_row_keys(docling_result.get("sr_report_index", []))
            obs = build_observability_payload(
                merge_strategy="docling_only",
                row_count=len(rows),
                extra={"single_parser": "docling", "quality_gate_llamaparse": llama_reason},
            )
            logger.info(
                "[MultiParserMerger] 관측성 merge_strategy={}, rows={}, cross_parser={}",
                obs.get("merge_strategy"),
                obs.get("merged_row_count"),
                obs.get("cross_parser"),
            )
            return {
                "sr_report_index": rows,
                "merge_strategy": "docling_only",
                "conflicts": [],
                "needs_review": [],
                "quality_report": {
                    "docling": "통과",
                    "llamaparse": llama_reason,
                },
                "parsing_method": "docling",
                "observability": obs,
            }

        if llama_ok and not docling_ok:
            logger.info("[MultiParserMerger] llamaparse만 통과, llamaparse 결과 사용")
            rows = ensure_merge_row_keys(llamaparse_result.get("sr_report_index", []))
            obs = build_observability_payload(
                merge_strategy="llamaparse_only",
                row_count=len(rows),
                extra={"single_parser": "llamaparse", "quality_gate_docling": docling_reason},
            )
            logger.info(
                "[MultiParserMerger] 관측성 merge_strategy={}, rows={}, cross_parser={}",
                obs.get("merge_strategy"),
                obs.get("merged_row_count"),
                obs.get("cross_parser"),
            )
            return {
                "sr_report_index": rows,
                "merge_strategy": "llamaparse_only",
                "conflicts": [],
                "needs_review": [],
                "quality_report": {
                    "docling": docling_reason,
                    "llamaparse": "통과",
                },
                "parsing_method": "llamaparse",
                "observability": obs,
            }

        logger.info("[MultiParserMerger] 둘 다 통과, 병합 시작")
        return self._merge_both_passed(docling_result, llamaparse_result)

    def _merge_both_passed(
        self,
        docling_result: Dict[str, Any],
        llamaparse_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """둘 다 통과했을 때 실제 병합 (행 단위 복합 키)."""
        docling_items = ensure_merge_row_keys(docling_result.get("sr_report_index", []))
        llama_items = ensure_merge_row_keys(llamaparse_result.get("sr_report_index", []))

        docling_by_key = {
            merge_row_key(item): item for item in docling_items if item.get("dp_id")
        }
        llama_by_key = {
            merge_row_key(item): item for item in llama_items if item.get("dp_id")
        }

        all_keys = set(docling_by_key.keys()) | set(llama_by_key.keys())

        merged_items: List[Dict[str, Any]] = []
        conflicts: List[Dict[str, Any]] = []
        needs_review: List[Dict[str, Any]] = []

        for mk in sorted(all_keys):
            doc_item = docling_by_key.get(mk)
            llama_item = llama_by_key.get(mk)
            dp_id = str(mk[0]) if mk else ""

            merged_item, conflict_info, review_info = self._merge_single_item(
                dp_id, doc_item, llama_item, merge_key=mk
            )

            if merged_item:
                merged_items.append(merged_item)
            if conflict_info:
                conflicts.append(conflict_info)
            if review_info:
                needs_review.append(review_info)

        logger.info(
            "[MultiParserMerger] 병합 완료: total={}건, conflicts={}건, needs_review={}건",
            len(merged_items),
            len(conflicts),
            len(needs_review),
        )

        obs = build_observability_payload(
            merge_strategy="merged",
            docling_items=docling_items,
            llama_items=llama_items,
            conflicts=conflicts,
            needs_review=needs_review,
            row_count=len(merged_items),
        )
        ov = obs.get("overall") or {}
        wag = ov.get("weighted_agreement_rate")
        wdr = ov.get("weighted_disagreement_rate")
        logger.info(
            "[MultiParserMerger] 관측성 weighted_agreement={} weighted_disagreement={} "
            "comparable_pairs={} needs_review={} conflict_dp={} conflict_fields={}",
            f"{wag:.4f}" if wag is not None else "n/a",
            f"{wdr:.4f}" if wdr is not None else "n/a",
            ov.get("total_comparable_field_pairs"),
            obs.get("needs_review_count"),
            obs.get("conflict_dp_count"),
            obs.get("conflict_field_entries"),
        )

        return {
            "sr_report_index": merged_items,
            "merge_strategy": "merged",
            "conflicts": conflicts,
            "needs_review": needs_review,
            "quality_report": {
                "docling": "통과",
                "llamaparse": "통과",
                "merged_count": len(merged_items),
                "conflict_count": len(conflicts),
                "review_count": len(needs_review),
            },
            "parsing_method": "merged",
            "observability": obs,
        }

    def _merge_single_item(
        self,
        dp_id: str,
        doc_item: Optional[Dict[str, Any]],
        llama_item: Optional[Dict[str, Any]],
        merge_key: Optional[Tuple[Any, ...]] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        단일 행(복합 키)에 대한 병합.

        Returns:
            (merged_item, conflict_info, review_info)
        """
        if doc_item and not llama_item:
            return (
                {**doc_item, "merge_source": "docling_only"},
                None,
                {
                    "dp_id": dp_id,
                    "merge_key": merge_key,
                    "reason": "llamaparse 누락",
                    "source": "docling",
                },
            )

        if llama_item and not doc_item:
            return (
                {**llama_item, "merge_source": "llamaparse_only"},
                None,
                {
                    "dp_id": dp_id,
                    "merge_key": merge_key,
                    "reason": "docling 누락",
                    "source": "llamaparse",
                },
            )

        if not doc_item and not llama_item:
            return None, None, None

        merged = {"dp_id": dp_id}
        conflict_info: Dict[str, Any] = {
            "dp_id": dp_id,
            "merge_key": merge_key,
            "fields": {},
        }
        has_conflict = False

        # 파서별로 별도 생성된 UUID·메타는 충돌로 보지 않음
        _merge_skip_fields = {"merge_source", "index_entry_id"}
        all_fields = (
            set(doc_item.keys()) | set(llama_item.keys())
        ) - _merge_skip_fields

        for field in all_fields:
            doc_val = doc_item.get(field)
            llama_val = llama_item.get(field)

            if doc_val is None and llama_val is None:
                merged[field] = None
                continue

            if doc_val is None:
                merged[field] = llama_val
                merged[f"{field}_source"] = "llamaparse"
                continue

            if llama_val is None:
                merged[field] = doc_val
                merged[f"{field}_source"] = "docling"
                continue

            if self._values_equal(doc_val, llama_val):
                merged[field] = doc_val
                merged[f"{field}_source"] = "both"
                continue

            has_conflict = True
            conflict_info["fields"][field] = {
                "docling": doc_val,
                "llamaparse": llama_val,
            }

            chosen_val = self._resolve_conflict(field, doc_val, llama_val)
            merged[field] = chosen_val
            merged[f"{field}_source"] = "conflict_resolved"

        merged["merge_source"] = "merged"
        merged["index_entry_id"] = (
            doc_item.get("index_entry_id")
            or llama_item.get("index_entry_id")
            or str(uuid.uuid4())
        )

        if self.total_pages:
            merged = self._validate_page_numbers(merged, self.total_pages)

        return (
            merged,
            conflict_info if has_conflict else None,
            None,
        )

    def _values_equal(self, val1: Any, val2: Any) -> bool:
        """두 값이 동일한지 검사 (리스트·튜플 정렬·문자열 NFC 정규화)."""
        if isinstance(val1, str) and isinstance(val2, str):
            return unicodedata.normalize("NFC", val1) == unicodedata.normalize(
                "NFC", val2
            )
        if isinstance(val1, (list, tuple)) and isinstance(val2, (list, tuple)):
            try:
                return sorted(val1) == sorted(val2)
            except TypeError:
                return val1 == val2
        return val1 == val2

    def _resolve_conflict(self, field: str, doc_val: Any, llama_val: Any) -> Any:
        """
        필드 불일치 시 우선순위 규칙.

        규칙:
        - page_numbers: 합집합 (중복 제거·정렬)
        - index_type, dp_id: docling 우선 (구조화가 더 안정적)
        - 나머지: 더 긴 값 선택 (정보량 기준)
        """
        if field == "page_numbers":
            if isinstance(doc_val, (list, tuple)) and isinstance(
                llama_val, (list, tuple)
            ):
                return sorted(set(list(doc_val) + list(llama_val)))
            return (
                doc_val if isinstance(doc_val, (list, tuple)) else llama_val
            )

        if field in {"index_type", "dp_id"}:
            return doc_val

        doc_len = len(str(doc_val or ""))
        llama_len = len(str(llama_val or ""))
        return doc_val if doc_len >= llama_len else llama_val

    def _validate_page_numbers(
        self, item: Dict[str, Any], total_pages: int
    ) -> Dict[str, Any]:
        """page_numbers가 total_pages를 초과하는지 검증·필터링."""
        pns = item.get("page_numbers")
        if isinstance(pns, list) and pns:
            valid_pns = [p for p in pns if isinstance(p, int) and 1 <= p <= total_pages]
            if len(valid_pns) < len(pns):
                logger.warning(
                    "[MultiParserMerger] dp_id={}: page_numbers 일부 제거 ({}→{})",
                    item.get("dp_id"),
                    pns,
                    valid_pns,
                )
                item["page_numbers"] = valid_pns
                item["page_validation_applied"] = True
        return item


def merge_parser_results(
    docling_result: Dict[str, Any],
    llamaparse_result: Dict[str, Any],
    total_pages: Optional[int] = None,
) -> Dict[str, Any]:
    """
    다중 파서 결과 병합 (외부 API).

    Args:
        docling_result: parse_index_with_docling 반환값
        llamaparse_result: parse_index_with_llamaparse 반환값
        total_pages: 페이지 검증용 (선택)

    Returns:
        병합 결과 (sr_report_index, merge_strategy, conflicts, needs_review, quality_report,
        observability: 필드별 합의율·불일치율·보류·충돌 카운트 등)
    """
    merger = MultiParserMerger(total_pages=total_pages)
    return merger.merge_results(docling_result, llamaparse_result)
