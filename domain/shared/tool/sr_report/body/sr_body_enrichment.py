"""페이지 본문에 대한 paragraphs·content_type 휴리스틱 생성 (DB 저장 전 enrich)."""
from __future__ import annotations

import re
from typing import Any, Dict, List


def split_content_into_paragraphs(
    content_text: str,
    *,
    min_len: int = 1,
) -> List[Dict[str, Any]]:
    """
    content_text를 \n\n(빈 줄) 기준으로 문단 분할.
    start_char/end_char는 원문 content_text 기준 오프셋(스트립된 본문 구간).
    """
    text = content_text or ""
    if not text.strip():
        return []

    segments = text.split("\n\n")
    paragraphs: List[Dict[str, Any]] = []
    search_pos = 0
    order = 0

    for seg in segments:
        if seg == "":
            search_pos = min(search_pos + 2, len(text))
            continue
        actual_start = text.find(seg, search_pos)
        if actual_start < 0:
            actual_start = search_pos
        stripped = seg.strip()
        if len(stripped) < min_len:
            search_pos = actual_start + len(seg)
            continue
        rel = seg.find(stripped)
        if rel < 0:
            rel = 0
        abs_start = actual_start + rel
        abs_end = abs_start + len(stripped)
        order += 1
        paragraphs.append(
            {
                "order": order,
                "text": stripped,
                "start_char": abs_start,
                "end_char": abs_end,
            }
        )
        search_pos = actual_start + len(seg)

    return paragraphs


_MD_TABLE_SEP = re.compile(r"^\s*\|?[\s\-:|]+\|", re.MULTILINE)
_PIPE_ROW = re.compile(r"\|")


def classify_body_content_type(content_text: str) -> str:
    """휴리스틱으로 페이지 콘텐츠 유형 추정."""
    t = (content_text or "").strip()
    if not t:
        return "narrative"

    lines = [ln.strip() for ln in t.split("\n") if ln.strip()]
    pipe_lines = sum(1 for ln in lines if _PIPE_ROW.search(ln) and ln.count("|") >= 2)
    has_md_sep = _MD_TABLE_SEP.search(t) is not None
    table_like = pipe_lines >= 2 or (pipe_lines >= 1 and has_md_sep)

    n = max(len(t), 1)
    digit_count = sum(1 for c in t if c.isdigit())
    digit_ratio = digit_count / n
    has_percent = bool(re.search(r"\d+[.,]?\d*\s*%", t))
    has_many_numbers = digit_ratio >= 0.12 or has_percent

    if table_like and has_many_numbers:
        return "mixed"
    if table_like:
        return "table"
    if digit_ratio >= 0.22 or (has_percent and digit_ratio >= 0.08):
        return "quantitative"
    if has_many_numbers and pipe_lines == 1:
        return "mixed"
    return "narrative"


def enrich_body_row(content_text: str) -> Dict[str, Any]:
    """단일 페이지용 content_type + paragraphs."""
    ctype = classify_body_content_type(content_text)
    paras = split_content_into_paragraphs(content_text, min_len=1)
    return {"content_type": ctype, "paragraphs": paras if paras else None}

