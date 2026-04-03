"""평문·고정폭 다단 인덱스용 전처리 및 dp_id OCR 정규화.

LlamaParse 등이 마크다운 파이프 표가 아닌 스페이스 정렬 텍스트를 줄 때,
LLM 매핑 전에 줄 번호를 붙이고 규칙 문자열을 프롬프트에 넣어 행·열 추론을 돕습니다.
langchain 등 무거운 의존성 없음 — 단위 테스트 가능.

위치: ``sr_report.index.preprocessing`` — 인덱스 파이프라인 전처리 레이어.
"""
from __future__ import annotations

import re
from typing import List, Optional

SR_PLAIN_TEXT_INDEX_RULES = """
## 평문·다단 레이아웃 (마크다운 파이프 표가 아닐 때)

원문이 **`|` 로 구분된 마크다운 표가 아니라**, 스페이스/탭으로 열이 맞춰진 **한 줄 다단** 형태일 수 있습니다 (GRI Standards Index 등).

- **열(가로)**: 한 줄 안에서 왼쪽부터 예를 들어  
  - **공시/지표 코드** (`2-1`, `201-2`, `GRI 302-1`, `TC-SI-130a.1`, `S2-6` …)  
  - **지표명·설명** (한글/영문 문구)  
  - **페이지** (숫자, `74`, `77`, `129~131`, `41, 54`, `105~110` 등)  
  가 **같은 줄에 나란히** 있을 수 있습니다. 시각적 빈 칸(다중 스페이스)이 열 구분입니다.
- **행(세로)**: **한 줄이 한 데이터 행**인 경우가 많습니다. 다만 지표명이 길면 **다음 줄에 이어질** 수 있으니, **인접 줄**을 합쳐 한 행으로 읽어야 할 수 있습니다.
- **헤더/메타 줄**: `Disclosure`, `Indicators`, `Page`, `비고`, `GRI Standards Index`, `Statement of Use`, 머리말 네비게이션 등은 **데이터 행이 아닙니다**.
- **중복 코드 열**: 같은 페이지에 왼쪽 블록(GRI 2-x)과 오른쪽 블록(Topic / 201-x 등)이 **두 갈래 열**로 있으면, 각각 **별도 행**으로 추출합니다.
- 줄 앞에 `NNNN|` 이 붙어 있으면 **원본 줄 번호**(추출 보조용)이며 **dp_id가 아닙니다**.

**dp_id**: 반드시 **라틴 알파벳·숫자·하이픈**으로 된 공시 코드만 사용하세요. OCR로 키릴 문자가 섞이면(예: 영문 `O` 대신 `О`) 라틴으로 바로잡으세요.

- **왼쪽·오른쪽 열 전량**: 한 줄에 왼쪽(`2-1` 등)과 오른쪽(`3-1`, `302-1` 등)이 동시에 있으면 **각 공시마다 별도 JSON 객체**로 출력하세요. 한쪽 열만 추출하지 마세요.
- **페이지 분할 줄**: 페이지 번호만 다음 줄에 이어지면(예: `64, 114,` 다음 줄 `116, 117`) **하나의 행**으로 합쳐 `page_numbers`에 넣으세요.

### 두 열(다단) 검수·자기점검
- 헤더에 `Disclosure` / `Indicators` / `Page` / `비고` 가 **좌·우로 두 벌** 있거나, 한 줄에 **큰 공백(다중 스페이스)으로 떨어진 두 개의 숫자·코드 블록**(예: 왼쪽 `2-14` … 오른쪽 `302-3`)이 보이면 **2열 인덱스**입니다.
- 이 경우 **한 열(예: 2-1~2-30)만 JSON으로 내고 끝내면 오류**입니다. 다른 열의 `3-x`, `302-x`, `205-x`, `305-x` 등 **해당 열에 보이는 모든 지표**를 **별도 JSON 객체**로 포함했는지 다시 확인하세요.
- 같은 물리적 줄에 **숫자-숫자 형태 코드**(예: `2-14`, `302-3`)가 **두 번 이상** 나오면, **각 블록을 별도 공시**로 읽고 **둘 다** 추출하세요 (한쪽만 버리지 마세요).
- 추출 후 **개수 점검**: 2열로 보이는데 출력 행 수가 한 열 분량뿐이면, **반대쪽 열을 누락**한 것일 수 있으니 마크다운을 다시 스캔하세요.
"""

# 오른쪽 열 2차 패스: 잘라 낸 줄이 이 개수 미만이면 LLM 재호출 생략
MIN_LINES_FOR_RIGHT_COLUMN_SECOND_PASS = 5

SR_INDEX_RIGHT_COLUMN_SECOND_PASS_RULES = """
## 두 번째 패스 (오른쪽 열 전용)
- 아래 마크다운은 **같은 인덱스 PDF 페이지**에서 가로 **두 열** 표를 줄 단위로 나눴을 때 **오른쪽 열에 해당하는 텍스트만** 모은 것입니다 (줄 앞 `NNNN|` 은 원본 줄 번호).
- **첫 패스**에서 왼쪽 열(예: GRI 2-1~2-30)만 추출했을 수 있습니다. 여기서는 **3-1, 3-3, 302-1, 302-3, 205-3, 305-1** 등 **오른쪽에만 나타나는 코드**를 **빠짐없이** 추출하세요.
- 왼쪽 열과 코드가 겹쳐 중복 행이 생겨도 괜찮습니다. **누락**이 더 큰 문제입니다.
"""

# 본문에 "GRI Standards Index" 표가 있으면 네비게이션의 "ESRS Index" 링크보다 우선 (index_type 혼동 방지)
_GRI_STANDARDS_INDEX_HINT = re.compile(
    r"(?i)GRI\s+Standards\s+Index|Statement\s+of\s+Use.*GRI|GRI\s+1\s+used",
)

_ESRS_BODY_HINT = re.compile(
    r"esrs\s*(index|indicator|taxonomy|표준)?|유럽\s*지속가능성\s*공시|"
    r"european\s+sustainability\s+reporting(?:\s+standards?)?",
)

# IFRS 인덱스 본문(상단 네비만 GRI인 경우 구분)
_IFRS_BODY_HINT = re.compile(
    r"(?i)IFRS\s+S[12]\s+(?:Index|공시|Disclosure)|"
    r"지속가능성\s*관련\s*재무\s*정보\s*공시|"
    r"sustainability[-\s]*related\s+financial\s+disclosures?",
)

# 줄 앞 `NNNN|` (prepare_index_page_markdown_for_llm) 제거용
_LINE_ID_PREFIX = re.compile(r"^\d{4}\|")


def _strip_line_id_prefix(line: str) -> str:
    s = line.rstrip()
    s = _LINE_ID_PREFIX.sub("", s)
    return s.strip()


def _line_is_multi_index_nav(line: str) -> bool:
    """
    상단 네비 한 줄에 GRI / SASB / IFRS / ESRS 인덱스 링크가 같이 붙은 경우.
    이때는 'GRI Standards Index' 문자열만으로 본문을 GRI로 고정하지 않는다.
    """
    ln = _strip_line_id_prefix(line).lower()
    hits = 0
    if "gri standards index" in ln:
        hits += 1
    if re.search(r"\bsasb\s+index\b", ln):
        hits += 1
    if re.search(r"\bifrs\s+index\b", ln):
        hits += 1
    if re.search(r"\besrs\s+index\b", ln):
        hits += 1
    return hits >= 2


_STANDALONE_ESRS_INDEX = re.compile(r"(?i)^ESRS\s+Index\s*$")
_STANDALONE_SASB_INDEX = re.compile(r"(?i)^SASB\s+Index\s*$")
_STANDALONE_IFRS_INDEX = re.compile(r"(?i)^IFRS\s+Index\s*$")
_STANDALONE_IFRS_S1_INDEX = re.compile(r"(?i)^IFRS\s+S1\s+Index\s*$")
_STANDALONE_IFRS_S2_INDEX = re.compile(r"(?i)^IFRS\s+S2\s+Index\s*$")
_STANDALONE_GRI_STANDARDS_INDEX = re.compile(r"(?i)^GRI\s+Standards\s+Index\s*$")


def _detect_body_primary_index(text: str) -> str | None:
    """
    본문에 단독으로 나오는 섹션 제목(한 줄)을 위에서부터 스캔한다.
    네비 한 줄에 여러 인덱스가 붙은 줄은 건너뛴다.
    반환: 'gri' | 'sasb' | 'ifrs' | 'esrs' | None
    """
    if not text or not str(text).strip():
        return None
    for raw in text.splitlines():
        line = _strip_line_id_prefix(raw)
        if not line:
            continue
        if _line_is_multi_index_nav(raw):
            continue
        if _STANDALONE_ESRS_INDEX.match(line):
            return "esrs"
        if _STANDALONE_IFRS_S1_INDEX.match(line) or _STANDALONE_IFRS_S2_INDEX.match(line):
            return "ifrs"
        if _STANDALONE_IFRS_INDEX.match(line):
            return "ifrs"
        if _STANDALONE_SASB_INDEX.match(line):
            return "sasb"
        if _STANDALONE_GRI_STANDARDS_INDEX.match(line):
            return "gri"
    return None


def _all_gri_standards_index_mentions_are_nav_only(text: str) -> bool:
    """텍스트에 'GRI Standards Index'가 있으면, 등장 줄이 모두 multi-index 네비인지."""
    if not _GRI_STANDARDS_INDEX_HINT.search(text):
        return False
    found = False
    for raw in text.splitlines():
        if not re.search(r"(?i)GRI\s+Standards\s+Index", raw):
            continue
        found = True
        if not _line_is_multi_index_nav(raw):
            return False
    return found


def _esrs_index_context_applies_outside_nav(text: str) -> bool:
    """ESRS 키워드가 **다중 인덱스 네비 줄이 아닌 본문**에 있을 때만 True."""
    if not text or not str(text).strip():
        return False
    for raw in text.splitlines():
        if _line_is_multi_index_nav(raw):
            continue
        line = _strip_line_id_prefix(raw)
        if not line:
            continue
        if markdown_implies_esrs_index_context(line):
            return True
    return False


def _looks_like_gri_numeric_index_row_block(text: str) -> bool:
    """
    GRI 인덱스 표 흔한 '2-1', '201-2' 형태가 네비가 아닌 줄에 있는지.
    (본문에 GRI 제목이 없어도 표만 있는 페이지 대비)
    """
    for raw in text.splitlines():
        if _line_is_multi_index_nav(raw):
            continue
        line = _strip_line_id_prefix(raw)
        if re.match(r"^\d+-\d+", line):
            return True
    return False


def markdown_implies_gri_standards_index(text: str) -> bool:
    """GRI Standards Index 표/섹션이 본문에 있는지 (제목·Statement of Use)."""
    if not text or not str(text).strip():
        return False
    return bool(_GRI_STANDARDS_INDEX_HINT.search(text))


def markdown_implies_esrs_index_context(text: str) -> bool:
    """마크다운에 ESRS 인덱스/표준 맥락이 드러나는지."""
    if not text or not str(text).strip():
        return False
    return bool(_ESRS_BODY_HINT.search(text))


def gri_standards_index_context_prefix() -> str:
    """LLM 청크 앞에 붙이는 GRI 인덱스 고정 맥락."""
    return (
        "[맥락 힌트] 이 페이지는 **GRI Standards Index**(또는 GRI 공시 목차)로 보입니다.\n"
        "- **index_type** 은 반드시 **gri** 입니다. (상단 네비에 'ESRS Index' 링크가 있어도 **본문 제목이 GRI이면 esrs로 두지 마세요**.)\n"
        "- **dp_id** 는 `GRI-2-1`, `GRI-302-1` 처럼 **GRI-** 접두 + 공시번호 형식을 사용하세요.\n"
        "- **이중 열**: 같은 줄의 **왼쪽 블록(예: 2-x)과 오른쪽 블록(예: 3-x, 302-x)** 은 각각 **별도 행**으로 모두 추출하세요. 누락 금지.\n\n"
    )


def esrs_index_context_prefix() -> str:
    """ESRS 전용 맥락 (GRI가 아닐 때)."""
    return (
        "[맥락 힌트] 이 페이지 마크다운은 **ESRS(유럽 지속가능성 공시 기준) 인덱스/표**로 보입니다.\n"
        "- **index_type** 은 **esrs** 를 사용하세요.\n"
        "- 표 제목·상단·표준명에 ESRS가 있으면, 코드 형식만으로 **ifrs** 로 바꾸지 마세요.\n"
        "- 상단 네비에 'GRI Standards Index' 가 있어도 **본문 제목이 ESRS Index이면 gri로 두지 마세요.**\n\n"
    )


def ifrs_index_context_prefix() -> str:
    """IFRS S1/S2 등 전용 맥락."""
    return (
        "[맥락 힌트] 이 페이지는 **IFRS 지속가능성 관련 재무 공시(IFRS S1/S2 등) 인덱스**로 보입니다.\n"
        "- **index_type** 은 **ifrs** 를 사용하세요.\n"
        "- **dp_id** 는 원문에 나온 문단·항목·공시 식별자를 따르세요.\n"
        "- 상단 네비에 'GRI Standards Index' 가 있어도 **본문이 IFRS Index이면 gri로 두지 마세요.**\n\n"
    )


def sasb_index_context_prefix() -> str:
    """SASB 인덱스 전용 맥락."""
    return (
        "[맥락 힌트] 이 페이지는 **SASB(산업별 지속가능성 회계기준) 인덱스**로 보입니다.\n"
        "- **index_type** 은 **sasb** 를 사용하세요.\n"
        "- **dp_id** 는 `TC-SI-130a.1` 등 SASB 코드 형식을 사용하세요.\n"
        "- 상단 네비에 'GRI Standards Index' 가 있어도 **본문이 SASB Index이면 gri로 두지 마세요.**\n\n"
    )


def build_llm_index_context_prefix(full_page_markdown: str) -> str:
    """
    페이지 전체 텍스트로 맥락 접두어를 고른다.

    1) 본문에 **단독 줄**로 나오는 `ESRS Index` / `IFRS Index` / `SASB Index` / `GRI Standards Index` 를
       상단 네비(한 줄에 여러 인덱스 링크)보다 **우선**한다.
    2) 그다음 ESRS 본문 키워드 힌트.
    3) GRI는 네비에만 'GRI Standards Index'가 반복되는 경우 오판하지 않고,
       본문 GRI 제목·표 행(2-1 등)이 있을 때만 GRI 맥락을 준다.
    """
    t = full_page_markdown or ""

    primary = _detect_body_primary_index(t)
    if primary == "esrs":
        return esrs_index_context_prefix()
    if primary == "ifrs":
        return ifrs_index_context_prefix()
    if primary == "sasb":
        return sasb_index_context_prefix()
    if primary == "gri":
        return gri_standards_index_context_prefix()

    if _esrs_index_context_applies_outside_nav(t):
        return esrs_index_context_prefix()
    if _IFRS_BODY_HINT.search(t):
        return ifrs_index_context_prefix()

    gri_nav_only = _all_gri_standards_index_mentions_are_nav_only(t)
    if markdown_implies_gri_standards_index(t):
        if not gri_nav_only or _looks_like_gri_numeric_index_row_block(t):
            return gri_standards_index_context_prefix()
        return ""

    if _looks_like_gri_numeric_index_row_block(t):
        return gri_standards_index_context_prefix()

    return ""


def looks_like_markdown_pipe_table(text: str) -> bool:
    """`|` 기반 마크다운 표로 보이면 True — 이때는 줄 번호 주석을 붙이지 않는다."""
    if not text or not str(text).strip():
        return False
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    pipe_lines = [ln for ln in lines if "|" in ln]
    if len(pipe_lines) < 2:
        return False
    for ln in pipe_lines:
        if re.search(r"\|\s*:?-{3,}", ln):
            return True
    return len(pipe_lines) >= 4


def _annotate_plain_text_index_lines(text: str) -> str:
    """비-파이프 평문에 줄 번호 접두어와 형식 힌트를 붙인다."""
    header = (
        "[형식 힌트] 아래는 **고정폭·스페이스 정렬 평문** 인덱스일 수 있습니다. "
        "각 줄 앞 `NNNN|` 은 원본 줄 번호이며 dp_id가 아닙니다.\n\n"
    )
    out_lines: List[str] = []
    for i, line in enumerate(text.splitlines(), start=1):
        stripped = line.rstrip()
        if not stripped.strip():
            out_lines.append("")
            continue
        out_lines.append(f"{i:04d}|{stripped}")
    return header + "\n".join(out_lines)


def prepare_index_page_markdown_for_llm(text: str) -> str:
    """
    page_markdown 한 페이지분을 LLM 인덱스 매핑 전에 가공합니다.

    - 마크다운 파이프 표면 그대로 둡니다.
    - 그 외(평문 다단)에는 줄 번호를 붙여 행 경계 추론을 돕습니다.
    """
    t = (text or "").strip()
    if not t:
        return t
    if looks_like_markdown_pipe_table(t):
        return t
    return _annotate_plain_text_index_lines(t)


def _extract_right_side_of_plaintext_line(content: str) -> Optional[str]:
    """
    고정폭 다단 한 줄에서 오른쪽 열 텍스트를 휴리스틱으로 분리.
    (큰 공백 덩어리 또는 줄 중앙 부근의 넓은 간격을 기준으로 분할)
    """
    s = content.rstrip()
    if len(s) < 35:
        return None
    mid = len(s) // 2
    lo, hi = max(0, mid - 45), min(len(s), mid + 45)
    best_end = -1
    best_len = 0
    for m in re.finditer(r" {3,}", s[lo:hi]):
        if len(m.group()) > best_len:
            best_len = len(m.group())
            best_end = lo + m.end()
    if best_end >= 0 and best_len >= 3:
        right = s[best_end:].strip()
        if len(right) >= 6 and re.search(r"\d", right):
            return right
    right = s[mid:].strip()
    if len(right) >= 6 and re.search(r"\d", right):
        return right
    return None


def build_right_column_plaintext_supplement(prepared_text: str) -> Optional[str]:
    """
    `prepare_index_page_markdown_for_llm` 결과(줄 번호 `NNNN|` 포함)에서
    오른쪽 열만 모은 보조 텍스트를 만든다. 2차 LLM 패스용.

    파이프 표 모드(줄 번호 없음)이거나 오른쪽 열로 추정되는 줄이 적으면 None.
    """
    t = prepared_text or ""
    if "[형식 힌트]" not in t:
        return None
    out_lines: List[str] = []
    kept = 0
    for raw in t.splitlines():
        m = re.match(r"^(\d{4})\|(.*)$", raw.rstrip())
        if not m:
            continue
        lid, content = m.group(1), m.group(2)
        right = _extract_right_side_of_plaintext_line(content)
        if right:
            out_lines.append(f"{lid}|{right}")
            kept += 1
    if kept < MIN_LINES_FOR_RIGHT_COLUMN_SECOND_PASS:
        return None
    header = (
        "[형식 힌트] 아래는 **동일 PDF 페이지에서 오른쪽 열로 추정된 텍스트만** 모았습니다. "
        "각 줄 앞 `NNNN|` 은 원본 줄 번호이며 dp_id가 아닙니다.\n\n"
    )
    return header + "\n".join(out_lines)


# 키릴·그리스 등 OCR 혼동 문자 → 라틴 (dp_id 짧은 코드용)
_DP_ID_CONFUSABLE_TRANSLATION = str.maketrans(
    {
        "А": "A",
        "В": "B",
        "С": "C",
        "Е": "E",
        "Н": "H",
        "І": "I",
        "Ι": "I",
        "К": "K",
        "М": "M",
        "О": "O",
        "Р": "P",
        "Т": "T",
        "Х": "X",
        "а": "a",
        "с": "c",
        "е": "e",
        "о": "o",
        "р": "p",
        "у": "y",
        "х": "x",
    }
)


def normalize_dp_id_ocr_confusables(dp_id: str) -> str:
    """dp_id에 섞인 키릴 등 동형 문자를 라틴으로 치환 (빈 문자열·비코드는 그대로)."""
    if not dp_id or not isinstance(dp_id, str):
        return dp_id
    s = dp_id.strip()
    if len(s) > 80:
        return dp_id
    return s.translate(_DP_ID_CONFUSABLE_TRANSLATION)


# GRI 인덱스에서 `2-1` 형태만 나온 경우 GRI-2-1 로 통일 (SASB/TC- 등은 건드리지 않음)
_GRI_NUMERIC_CODE = re.compile(r"^(\d+-\d+(?:-[a-zA-Z0-9]+)?(?:\.[0-9]+)?)$")


def normalize_gri_prefixed_dp_id(index_type: str, dp_id: str) -> str:
    """index_type이 gri이고 공시번호만 있으면 GRI- 접두를 붙인다."""
    if (index_type or "").strip().lower() != "gri":
        return dp_id
    if not dp_id or not isinstance(dp_id, str):
        return dp_id
    s = dp_id.strip()
    if len(s) > 80:
        return dp_id
    if s.upper().startswith("GRI-"):
        return s
    if _GRI_NUMERIC_CODE.match(s):
        return "GRI-" + s
    return s
