"""raw 페이지별 텍스트 → sr_report_body 행 리스트 변환 (도메인 매핑)."""
from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from loguru import logger

from .sr_body_enrichment import enrich_body_row
from .sr_body_metadata_embedding import enrich_bodies_with_toc_subtitle_embeddings

# 한글 음절 (가-힣)
_RE_HANGUL = re.compile(r"[\uac00-\ud7a3]")
# 본문으로 보이는 문장 종결(긴 부제목/제목 구분)
# 부제목이 아닌 본문 문장(짧아도 제외)
_RE_BODY_SENTENCE_END = re.compile(
    r"(습니다|습니다\.|니다|니다\.|합니다|합니다\.|예요|이에요|어요|죠)\s*\.\s*$"
)
# 본문 첫문장 흔한 패턴: "OO은/는 " (주어 + 조사)
_RE_TOPIC_MARKER_OPEN = re.compile(r"^[\w가-힣.\-]{2,40}(?:은|는)\s")


def _sr_body_toc_debug_enabled() -> bool:
    """SR_BODY_TOC_DEBUG=1/true/yes/on 일 때 제목 추출 진단 로그 출력."""
    return os.getenv("SR_BODY_TOC_DEBUG", "").strip().lower() in ("1", "true", "yes", "on")


_RE_MD_HEADING = re.compile(r"^\s*#+\s*")
_RE_BULLET = re.compile(r"^[\s]*[-*•]\s+")
_RE_LEADING_NUMBERING = re.compile(r"^\s*\d+(?:\.\d+)*\s*[.)]\s*")
_RE_ONLY_SYMBOLS_OR_DIGITS = re.compile(r"^[\d\W_]+$")

_HEADING_STOPWORDS = (
    "samsung sds",
    "sustainability report",
    "contents",
    "interactive",
    "페이지로이동",
    "목차페이지로이동",
    "이전페이지로이동",
    "다음페이지로이동",
    "관련웹페이지로이동",
    "출력",
)


def _normalize_index_set(index_page_numbers: Optional[List[Any]]) -> Set[int]:
    s: Set[int] = set()
    for x in index_page_numbers or []:
        try:
            s.add(int(x))
        except (TypeError, ValueError):
            continue
    return s


def _normalize_heading_candidate(raw: str) -> str:
    s = (raw or "").strip()
    s = _RE_MD_HEADING.sub("", s)
    s = _RE_BULLET.sub("", s)
    s = _RE_LEADING_NUMBERING.sub("", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _is_heading_candidate(s: str) -> bool:
    if not s:
        return False
    if len(s) < 2 or len(s) > 40:
        return False
    if _RE_ONLY_SYMBOLS_OR_DIGITS.fullmatch(s):
        return False
    low = s.lower()
    if any(w in low for w in _HEADING_STOPWORDS):
        return False
    if "|" in s or s.startswith("<!--") or s.endswith("-->"):
        return False
    if s.endswith((".", "?", "!", "다.", "니다.")):
        return False
    return True


def _contains_hangul(s: str) -> bool:
    return bool(_RE_HANGUL.search(s or ""))


def _is_korean_heading(cand: str) -> bool:
    """목차용 제목: 제목 휴리스틱을 통과하고 한글 음절이 최소 1자 포함."""
    return bool(cand) and _is_heading_candidate(cand) and _contains_hangul(cand)


def _is_subtitle_candidate(sub: str, title: str) -> bool:
    """제목 다음 줄 부제: 한글 포함, 길이·스톱워드·긴 본문 문장 제외."""
    if not sub or sub == title:
        return False
    if len(sub) < 4 or len(sub) > 100:
        return False
    if not _contains_hangul(sub):
        return False
    if _RE_ONLY_SYMBOLS_OR_DIGITS.fullmatch(sub):
        return False
    low = sub.lower()
    if any(w in low for w in _HEADING_STOPWORDS):
        return False
    if "|" in sub or sub.startswith("<!--") or sub.endswith("-->"):
        return False
    if _RE_BODY_SENTENCE_END.search(sub):
        return False
    if _RE_TOPIC_MARKER_OPEN.match(sub):
        return False
    return True


def extract_title_and_subtitle_ko(content_text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    페이지 상단에서 한글 제목 1개와 그 직후 부제목(선택)을 추출.

    제목(toc_path): 기존 제목 휴리스틱 + 한글 음절 필수.
    부제목: 제목 다음 비어 있지 않은 줄 중 부제 휴리스틱에 맞는 첫 줄.
    """
    if not (content_text or "").strip():
        return None, None

    lines = [ln.strip() for ln in (content_text or "").splitlines()]
    title_idx: Optional[int] = None
    title: Optional[str] = None
    for i, raw in enumerate(lines[:25]):
        cand = _normalize_heading_candidate(raw)
        if _is_korean_heading(cand):
            title_idx = i
            title = cand
            break

    if title_idx is None or not title:
        return None, None

    subtitle: Optional[str] = None
    for raw in lines[title_idx + 1 : 25]:
        if not raw.strip():
            continue
        sub = _normalize_heading_candidate(raw)
        if _is_subtitle_candidate(sub, title):
            subtitle = sub
            break

    return title, subtitle


def extract_page_heading(content_text: str) -> Optional[str]:
    """페이지 본문 상단에서 한글 제목 후보 1개를 추출 (toc_path 1단계용)."""
    t, _ = extract_title_and_subtitle_ko(content_text)
    return t


def apply_toc_paths_to_bodies(
    bodies: List[Dict[str, Any]],
    body_by_page: Dict[Any, str],
    index_page_numbers: Optional[List[int]],
    *,
    use_llm_toc_align: Optional[bool] = None,
    openai_api_key: Optional[str] = None,
    llm_model: Optional[str] = None,
) -> None:
    """bodies 리스트를 제자리에서 갱신: toc_path=[한글 페이지 제목], subtitle=부제목."""
    _ = (use_llm_toc_align, openai_api_key, llm_model)
    index_set: set[int] = set()
    for x in index_page_numbers or []:
        try:
            index_set.add(int(x))
        except (TypeError, ValueError):
            continue

    for b in bodies:
        pn = int(b["page_number"])
        if b.get("is_index_page") or pn in index_set:
            b["toc_path"] = None
            b["subtitle"] = None
            continue
        page_text = (body_by_page.get(pn) or body_by_page.get(str(pn)) or "")
        heading, subtitle = extract_title_and_subtitle_ko(page_text)
        b["toc_path"] = [heading] if heading else None
        b["subtitle"] = subtitle

    if _sr_body_toc_debug_enabled():
        content_rows = [b for b in bodies if int(b["page_number"]) not in index_set and not b.get("is_index_page")]
        n_content = len(content_rows)
        n_filled = sum(1 for b in content_rows if b.get("toc_path"))
        logger.info(
            "[SR_BODY_TOC] 제목기반 진단 | content_pages={} toc_path_filled={} toc_path_null={}",
            n_content,
            n_filled,
            n_content - n_filled,
        )


def map_body_pages_to_sr_report_body(
    body_by_page: Dict[Any, str],
    report_id: str,
    index_page_numbers: Optional[List[int]] = None,
    *,
    use_llm_toc_align: Optional[bool] = None,
    openai_api_key: Optional[str] = None,
    llm_model: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """페이지별 텍스트를 sr_report_body 테이블 행 형태로 매핑."""
    _ = report_id
    index_set = _normalize_index_set(index_page_numbers)
    bodies: List[Dict[str, Any]] = []

    def _page_key(k: Any) -> int:
        if isinstance(k, int):
            return k
        try:
            return int(k)
        except (TypeError, ValueError):
            return 0

    sorted_pages = sorted(body_by_page.keys(), key=_page_key)
    for page_number in sorted_pages:
        pn = _page_key(page_number)
        content_text = body_by_page.get(page_number) or body_by_page.get(pn) or ""
        extra = enrich_body_row(content_text)
        bodies.append({
            "page_number": pn,
            "content_text": content_text,
            "is_index_page": pn in index_set,
            "content_type": extra["content_type"],
            "paragraphs": extra["paragraphs"],
            "toc_path": None,
            "subtitle": None,
        })
    apply_toc_paths_to_bodies(
        bodies,
        body_by_page,
        index_page_numbers,
        use_llm_toc_align=use_llm_toc_align,
        openai_api_key=openai_api_key,
        llm_model=llm_model,
    )
    enrich_bodies_with_toc_subtitle_embeddings(bodies)
    return bodies

