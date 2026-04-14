"""
gen_node data_provenance 후처리: SR 참조 본문(ref_2024/ref_2023)에서
used_in_sentences가 본문의 몇 번째 문장·어느 문자 구간에 해당하는지 채움.
"""
from __future__ import annotations

import copy
import logging
import re
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("ifrs_agent.provenance_ref_align")

# fuzzy 매칭 최소 유사도 (한글 개행·띄어쓰기 차이 허용)
_FUZZY_RATIO_MIN = 0.72


def _normalize_ws(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def split_body_sentence_spans(text: str) -> List[Tuple[int, int, str]]:
    """
    본문을 문장 단위로 나누고 (start, end, sentence) 스팬을 반환.
    end는 배타(파이썬 슬라이스와 동일하게 text[start:end]).
    """
    if not text or not text.strip():
        return []
    spans: List[Tuple[int, int, str]] = []
    parts = re.split(r"(?<=[.!?。．])\s+", text.strip())
    search_from = 0
    for part in parts:
        p = part.strip()
        if len(p) < 2:
            continue
        idx = text.find(p, search_from)
        if idx < 0:
            idx = text.find(p)
        if idx < 0:
            continue
        start = idx
        end = idx + len(p)
        spans.append((start, end, text[start:end]))
        search_from = end
    if not spans and text.strip():
        spans.append((0, len(text), text.strip()))
    return spans


def _best_span_for_used_sentence(
    used: str,
    spans: List[Tuple[int, int, str]],
) -> Optional[Tuple[int, int, int, str]]:
    """
    used 문장과 가장 잘 맞는 참조 문장 스팬.
    반환: (sentence_index_0based, char_start, char_end, match_quality)
    """
    if not used or not spans:
        return None
    nu = _normalize_ws(used)
    if len(nu) < 4:
        return None

    # 1) 정규화 후 부분 일치
    for i, (s, e, raw) in enumerate(spans):
        nr = _normalize_ws(raw)
        if nu in nr or nr in nu:
            return (i, s, e, "normalized_contains")

    # 2) 원문 부분 문자열
    if used.strip() in "".join(spans[j][2] for j in range(len(spans))):
        for i, (s, e, raw) in enumerate(spans):
            if used.strip() in raw or raw in used.strip():
                return (i, s, e, "substring")

    # 3) 유사도
    best_i = -1
    best_ratio = 0.0
    best_span: Optional[Tuple[int, int]] = None
    for i, (s, e, raw) in enumerate(spans):
        nr = _normalize_ws(raw)
        ratio = SequenceMatcher(None, nu, nr).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_i = i
            best_span = (s, e)
    if best_span and best_ratio >= _FUZZY_RATIO_MIN:
        return (best_i, best_span[0], best_span[1], f"fuzzy_{best_ratio:.2f}")

    return None


def _pick_ref_body(
    gen_input: Dict[str, Any],
    year_hint: Any,
) -> Tuple[str, str]:
    """(ref_key, body_text) — year_hint로 연도 블록 선택, 없으면 비어 있지 않은 쪽."""
    y: Optional[int] = None
    try:
        if year_hint is not None:
            y = int(year_hint)
    except (TypeError, ValueError):
        y = None

    def body_for(key: str) -> str:
        block = gen_input.get(key) or {}
        if not isinstance(block, dict):
            return ""
        return str(block.get("body_text") or "").strip()

    order: List[str] = []
    if y == 2023:
        order = ["ref_2023", "ref_2024"]
    elif y == 2024:
        order = ["ref_2024", "ref_2023"]
    else:
        order = ["ref_2024", "ref_2023"]

    for key in order:
        b = body_for(key)
        if b:
            return key, b
    return order[0], ""


def enrich_qualitative_sr_reference_spans(
    data_provenance: Dict[str, Any],
    gen_input: Dict[str, Any],
) -> Dict[str, Any]:
    """
    qualitative_sources 중 sr_reference 항목에 대해
    source_details에 sr_reference_anchors, reference_location_ko 추가.
    """
    qual = data_provenance.get("qualitative_sources")
    if not isinstance(qual, list):
        return data_provenance

    for item in qual:
        if not isinstance(item, dict):
            continue
        st = str(item.get("source_type") or "").lower()
        if st != "sr_reference":
            continue

        details = item.get("source_details")
        if not isinstance(details, dict):
            details = {}
            item["source_details"] = details

        year_hint = details.get("year")
        ref_key, body = _pick_ref_body(gen_input, year_hint)
        if not body:
            logger.debug(
                "provenance_ref_align: no ref body for sr_reference (ref_key=%s)",
                ref_key,
            )
            continue

        spans = split_body_sentence_spans(body)
        page = details.get("page_number")
        used_list = item.get("used_in_sentences")
        if not isinstance(used_list, list):
            used_list = []

        anchors: List[Dict[str, Any]] = []
        summary_lines: List[str] = []

        for used in used_list:
            if not isinstance(used, str) or not used.strip():
                continue
            hit = _best_span_for_used_sentence(used, spans)
            if not hit:
                anchors.append(
                    {
                        "used_sentence_preview": used[:120] + ("…" if len(used) > 120 else ""),
                        "ref_sentence_index": None,
                        "ref_char_start": None,
                        "ref_char_end": None,
                        "match_quality": "unmatched",
                        "ref_block": ref_key,
                    }
                )
                summary_lines.append(
                    "· 인용 문장: 참조 본문에서 동일 문장을 자동 매칭하지 못했습니다 (표현 차이 가능)."
                )
                continue

            idx0, c0, c1, quality = hit
            idx1 = idx0 + 1
            pg = page if page is not None else "—"
            anchors.append(
                {
                    "used_sentence_preview": used[:200] + ("…" if len(used) > 200 else ""),
                    "ref_sentence_index_1based": idx1,
                    "ref_char_start": c0,
                    "ref_char_end": c1,
                    "match_quality": quality,
                    "ref_block": ref_key,
                    "ref_sentence_excerpt": body[c0: min(c1, c0 + 200)],
                }
            )
            summary_lines.append(
                f"· {pg}페이지 참조 본문({ref_key}) {idx1}번째 문장 "
                f"(문자 위치 {c0}–{c1}, 매칭: {quality})"
            )

        if anchors:
            details["sr_reference_anchors"] = anchors
            details["reference_location_ko"] = "\n".join(summary_lines)

    return data_provenance


def enrich_data_provenance_with_sr_spans(
    data_provenance: Optional[Dict[str, Any]],
    gen_input: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """gen_node 응답 provenance를 복사한 뒤 SR 참조 앵커를 채움."""
    if not isinstance(data_provenance, dict):
        return data_provenance
    if not isinstance(gen_input, dict) or not gen_input:
        return data_provenance

    try:
        out = copy.deepcopy(data_provenance)
        return enrich_qualitative_sr_reference_spans(out, gen_input)
    except Exception as e:
        logger.warning("provenance_ref_align failed (skip): %s", e, exc_info=True)
        return data_provenance
