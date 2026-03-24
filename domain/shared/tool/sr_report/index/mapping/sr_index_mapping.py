"""raw 표 리스트 → sr_report_index 행 리스트 변환 (도메인 매핑).

위치: ``sr_report.index.mapping`` — 인덱스 파싱·병합 파이프라인과 함께 둡니다.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


def _find_column_index(header: List[str], keywords: List[str]) -> Optional[int]:
    """헤더에서 키워드 중 하나를 포함하는 컬럼 인덱스 반환 (대소문자 무시)."""
    header_lower = [str(h).lower().strip() for h in header]
    for kw in keywords:
        k = kw.lower().strip()
        for i, col in enumerate(header_lower):
            if k in col:
                return i
    return None


def _find_page_column_index(header: List[str]) -> Optional[int]:
    """'Page' 열 인덱스. Note/footnote 열과 혼동되지 않게 우선순위를 둔다."""
    header_lower = [str(h).lower().strip() for h in header]

    def _is_note_like(col: str) -> bool:
        c = col.replace(" ", "")
        return "note" in c and "page" not in c

    # 1) 정확히 페이지 열 (영·한)
    for i, col in enumerate(header_lower):
        if col in ("page", "페이지", "pages", "p."):
            return i
    # 2) '페이지' 포함 (한글 우선)
    for i, col in enumerate(header_lower):
        if "페이지" in col and not _is_note_like(col):
            return i
    # 3) page 포함이나 note/footnote 전용 열 제외
    for i, col in enumerate(header_lower):
        if "page" not in col:
            continue
        if _is_note_like(col):
            continue
        if "footnote" in col and "page" not in col.replace("footnote", ""):
            continue
        return i
    # 4) 기존 키워드 폴백
    return _find_column_index(header, ["page", "페이지"])


def _cell_looks_like_esrs_code(raw: str) -> bool:
    """ESRS 인덱스 Code 열에 흔한 패턴 (GRI·순수 숫자코드와 구분)."""
    s = raw.strip()
    if not s or s in ("-", "—", "–"):
        return False
    if re.match(r"^[SEG]\d+-\d+", s, re.I):
        return True
    if re.match(r"^(GOV|IRO|SBM)-\d", s, re.I):
        return True
    return False


def _count_esrs_style_codes(disclosure_idx: int, data_rows: List[List[Any]], sample: int = 15) -> int:
    n = 0
    for row in data_rows[:sample]:
        if disclosure_idx < len(row) and _cell_looks_like_esrs_code(str(row[disclosure_idx])):
            n += 1
    return n


def _header_text_suggests_esrs(header: List[str]) -> bool:
    h = " ".join(str(x).lower() for x in header if x is not None)
    return "esrs" in h


def _kr_esrs_index_layout(header: List[str]) -> bool:
    """국문 ESRS INDEX 표에서 흔한 열 조합(구분 / Code / 항목 / Page)."""
    h = " ".join(str(x).lower() for x in header if x is not None)
    return "구분" in h and "code" in h and ("page" in h or "페이지" in h or "항목" in h)


def _infer_gri_from_disclosure_cells(
    disclosure_idx: int,
    data_rows: List[List[Any]],
    sample: int = 12,
) -> Optional[Tuple[str, str]]:
    """공시 열 셀 패턴으로 GRI 여부·접두사 추론 (영문 Disclosure 헤더 등 보강)."""
    for row in data_rows[:sample]:
        if disclosure_idx >= len(row):
            continue
        raw = str(row[disclosure_idx]).strip()
        if not raw or raw in ("-", "—", "–"):
            continue
        if raw.upper().startswith("GRI-"):
            return ("gri", "")
        if re.match(r"^\d+-\d+(?:-[a-z0-9]+)?$", raw, re.I):
            return ("gri", "GRI-")
    return None


def _detect_table_index_type(
    header: List[str],
    disclosure_idx: int,
    data_rows: List[List[Any]],
) -> Tuple[str, str]:
    """표 헤더·데이터로 인덱스 유형 추론. (index_type, dp_id_prefix) 반환."""
    if disclosure_idx >= len(header):
        return ("other", "")
    col_name = (header[disclosure_idx] or "").strip().lower()
    if "문단" in col_name or "paragraph" in col_name:
        for row in data_rows[:5]:
            if disclosure_idx < len(row):
                raw = str(row[disclosure_idx]).strip()
                if raw and raw.isdigit():
                    return ("ifrs", "S2-")
    # ESRS: 헤더에 esrs 문구, 또는 구분+Code+Page 형식 + ESRS 스타일 코드 다수
    if _header_text_suggests_esrs(header):
        return ("esrs", "")
    if _kr_esrs_index_layout(header) and _count_esrs_style_codes(disclosure_idx, data_rows) >= 2:
        return ("esrs", "")
    if _count_esrs_style_codes(disclosure_idx, data_rows) >= 4:
        return ("esrs", "")
    # GRI: 헤더에 code/공시/지표/disclosure 등 + 샘플 행 패턴
    # ('disclosure' 단독은 'code' 부분문자열과 매칭되지 않아 과거에 other로 떨어짐)
    header_suggests_gri = (
        "code" in col_name
        or "지표" in col_name
        or "공시" in col_name
        or "disclosure" in col_name
        or "requirement" in col_name
    )
    if header_suggests_gri:
        for row in data_rows[:5]:
            if disclosure_idx < len(row):
                raw = str(row[disclosure_idx]).strip()
                if raw.upper().startswith("GRI-"):
                    return ("gri", "")
                if re.match(r"^\d+-\d+$", raw):
                    return ("gri", "GRI-")
    inferred = _infer_gri_from_disclosure_cells(disclosure_idx, data_rows)
    if inferred is not None:
        return inferred
    return ("other", "")


def _parse_page_numbers_raw(raw: str) -> List[int]:
    """페이지 번호 문자열을 정수 리스트로 파싱. 예: '1-3, 5' -> [1,2,3,5]."""
    if not raw or not str(raw).strip():
        return []
    raw = re.sub(r"\s+", " ", str(raw).strip())
    pages: List[int] = []
    for m in re.finditer(r"(\d+)\s*[~\-]\s*(\d+)", raw):
        a, b = int(m.group(1)), int(m.group(2))
        pages.extend(range(min(a, b), max(a, b) + 1))
    rest = re.sub(r"\d+\s*[~\-]\s*\d+", " ", raw)
    for m in re.finditer(r"\d+", rest):
        n = int(m.group(0))
        if n not in pages:
            pages.append(n)
    return sorted(set(pages))


def map_tables_to_sr_report_index(
    tables: List[Dict[str, Any]],
    report_id: str,
) -> List[Dict[str, Any]]:
    """
    parse_pdf_to_tables 반환의 tables를 sr_report_index 행 리스트로 변환.
    에이전트는 파싱 툴 → 이 매핑 툴 → 저장 툴 순으로 조합해 사용.
    """
    now = datetime.now(timezone.utc).isoformat()
    rows_out: List[Dict[str, Any]] = []

    for tbl in tables:
        header = tbl.get("header") or []
        data_rows = tbl.get("rows") or []
        table_page = tbl.get("page")

        disclosure_idx = _find_column_index(
            header,
            ["disclosure", "공시", "code", "항목", "문단", "topic", "지표"],
        )
        page_idx = _find_page_column_index(header)
        if disclosure_idx is None or page_idx is None:
            continue

        index_type, dp_id_prefix = _detect_table_index_type(header, disclosure_idx, data_rows)

        indicators_idx = _find_column_index(
            header,
            ["indicators", "indicator", "지표", "항목", "topic"],
        )
        classification_idx = _find_column_index(header, ["classification", "구분"])

        for row in data_rows:
            if len(row) <= max(disclosure_idx, page_idx):
                continue
            dp_id_raw = str(row[disclosure_idx]).strip() if disclosure_idx < len(row) else ""
            page_raw = str(row[page_idx]).strip() if page_idx < len(row) else ""
            if not dp_id_raw or not page_raw:
                continue

            page_numbers = _parse_page_numbers_raw(page_raw)
            if not page_numbers:
                continue

            if index_type == "ifrs" and dp_id_prefix and dp_id_raw.isdigit():
                dp_id = dp_id_prefix + dp_id_raw
            elif index_type == "gri" and dp_id_prefix and re.match(r"^\d+-\d+$", dp_id_raw):
                dp_id = dp_id_prefix + dp_id_raw
            elif index_type == "gri" and dp_id_raw.upper().startswith("GRI-"):
                dp_id = dp_id_raw
            else:
                dp_id = dp_id_raw

            dp_name = None
            if indicators_idx is not None and indicators_idx < len(row):
                dp_name = str(row[indicators_idx]).strip() or None
            section_title = None
            if classification_idx is not None and classification_idx < len(row):
                section_title = str(row[classification_idx]).strip() or None

            rows_out.append({
                "id": str(uuid.uuid4()),
                "report_id": report_id,
                "index_type": index_type,
                "index_page_number": table_page,
                "dp_id": dp_id,
                "dp_name": dp_name,
                "page_numbers": page_numbers,
                "section_title": section_title,
                "remarks": None,
                "parsed_at": now,
                "parsing_method": "docling",
                "confidence_score": None,
            })

    return rows_out
