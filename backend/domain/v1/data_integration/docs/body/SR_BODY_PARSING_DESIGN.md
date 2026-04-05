# SR 본문(`sr_report_body`) 파싱·저장 설계 및 구현 가이드

## 문서 개요

**목적**: SR 보고서 PDF를 페이지별로 파싱하여 `sr_report_body` 테이블에 저장하는 전체 플로우를 설계·구현합니다.  
**기반**: 기존 `sr_report_index` 파이프라인(Docling/LlamaParse + 에이전트 + MCP 도구)의 구조를 참고하되, **본문은 "페이지 단위 텍스트 추출"**이 핵심입니다.  
**관련**: 이미지 파이프라인은 [`SR_IMAGES_PARSING_DESIGN.md`](../images/SR_IMAGES_PARSING_DESIGN.md)를 참고하세요.

---

## 1. 배경 및 목표

### 1.1 현재 상태

- ✅ **인덱스 파이프라인**: `SRIndexAgent`(MCP 툴로 파싱·검증·보정) → 행 목록 반환 → **`sr_workflow` 등 오케스트레이터가 `save_sr_report_index_batch`로 DB 저장**(B안)
- ✅ **본문 매핑·저장 도구**: `map_body_pages_to_sr_report_body`, `save_sr_report_body_batch` 준비됨
- ✅ **본문 파싱·에이전트**: `body_parser`(Docling→LlamaParse→PyMuPDF) + `SRBodyAgent` + MCP `parse_body_pages_tool` + API `extract-and-save/body-agentic`

### 1.2 목표

1. **PDF → 페이지별 텍스트** 추출 (Docling→LlamaParse→PyMuPDF 폴백, `body_parser.parse_body_pages`)
2. **결정적 실행 (`SRBodyAgent`, LLM 없음)**: `total_pages` 기준 **전 페이지 `1..N`을 한 번에** 파싱·매핑·저장 — MCP 툴과 동일 단계를 코드에서 직접 호출(`asyncio.to_thread`)
3. **`sr_report_body` 저장**: `report_id` + `page_number` 단위로 `content_text`, `is_index_page` 등 저장
4. **인덱스와 연결**: `sr_report_index.page_numbers` ↔ `sr_report_body.page_number` JOIN으로 DP → 본문 문단 검색 가능

### 1.3 제약 조건

- **페이지 단위 추출**: 표·레이아웃 구조보다 **평문 텍스트** 우선
- **인덱스 페이지 포함 여부**: 기본은 **전체 페이지 저장, `is_index_page` 플래그로 구분**
- **문단·유형·임베딩**: 초기 구현에서는 **선택 사항** (`content_type`, `paragraphs` = `None`)

---

## 2. 데이터 스키마 (`sr_report_body`)

### 2.1 테이블 구조

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | UUID | ✅ | PK |
| `report_id` | UUID | ✅ | FK → `historical_sr_reports.id` |
| **`page_number`** | INT | ✅ | 페이지 번호 (1-based) |
| **`content_text`** | TEXT | ✅ | 페이지 전체 본문 텍스트 |
| **`is_index_page`** | BOOL | ✅ | 인덱스 페이지 여부 (기본: False) |
| `content_type` | TEXT | ❌ | `narrative` / `quantitative` / `table` / `mixed` (초기 `None`) |
| `paragraphs` | JSONB | ❌ | 문단 배열 `[{"order", "text", "start_char", "end_char"}]` (초기 `None`) |
| `embedding_id` | TEXT | ❌ | 벡터 DB 문서 ID (후속 임베딩 단계) |
| `embedding_status` | TEXT | ✅ | `pending` (기본값) |
| `parsed_at` | TIMESTAMPTZ | ✅ | 파싱 시각 |

**유일성 제약**: `(report_id, page_number)` UNIQUE

### 2.2 인덱스와의 관계

```sql
-- DP 선택 시 해당 페이지 본문 검색 (RAG Node)
SELECT 
    b.content_text,
    b.paragraphs,
    i.dp_name
FROM sr_report_index i
JOIN sr_report_body b 
    ON b.report_id = i.report_id 
    AND b.page_number = ANY(i.page_numbers)
WHERE i.dp_id = 'GRI-305-1'
  AND i.report_id = :report_id;
```

---

## 3. 아키텍처 설계

### 3.1 전체 플로우

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: 메타데이터 준비                                     │
└─────────────────────────────────────────────────────────────┘
        ↓
[1] get_pdf_metadata_tool(report_id)
    → total_pages, index_page_numbers 확보

┌─────────────────────────────────────────────────────────────┐
│ Phase 2: 페이지별 텍스트 추출                                │
└─────────────────────────────────────────────────────────────┘
        ↓
[2] parse_body_pages_tool(pdf_bytes_b64, pages)
    - pages: [1, 2, ..., total_pages] (전체)
    - 파서: Docling 우선 → 실패 시 LlamaParse 폴백
    - 반환: body_by_page = {1: "텍스트...", 2: "...", ...}

┌─────────────────────────────────────────────────────────────┐
│ Phase 3: 도메인 매핑                                          │
└─────────────────────────────────────────────────────────────┘
        ↓
[3] map_body_pages_to_sr_report_body_tool(
        body_by_page, 
        report_id, 
        index_page_numbers
    )
    → bodies: [
        {
            "page_number": 1,
            "content_text": "...",
            "is_index_page": False,
            "content_type": None,
            "paragraphs": None
        },
        ...
    ]

┌─────────────────────────────────────────────────────────────┐
│ Phase 4: 배치 저장                                            │
└─────────────────────────────────────────────────────────────┘
        ↓
[4] save_sr_report_body_batch_tool(report_id, bodies)
    → DB INSERT (배치)
    → {"success": true, "saved_count": 157, "errors": []}
```

### 3.2 에이전트 구조 (`SRBodyAgent`)

**역할**: **LLM 없이** 본문 저장까지 결정적으로 완수 (대용량 PDF에서 대화 컨텍스트 초과 방지)  
**파이프라인**: `get_pdf_metadata` → `parse_body_pages` → `map_body_pages_to_sr_report_body` → `save_sr_report_body_batch` (동기 함수를 `asyncio.to_thread`로 호출)  
**참고**: MCP 툴과 동일 로직이며, `toc_path`는 매핑 단계에서 **페이지 상단 제목 기반**으로 생성합니다.

---

## 4. 도구(MCP Tool) 설계

### 4.1 `get_pdf_metadata_tool`

**용도**: 페이지 범위·인덱스 페이지 확보

```python
@tool
def get_pdf_metadata(report_id: str) -> Dict[str, Any]:
    """
    historical_sr_reports 테이블에서 메타데이터 조회
    
    Returns:
        {
            "total_pages": 157,
            "index_page_numbers": [146, 147, 148, 149, 150, 151, 152, 153],
            "report_name": "지속가능경영보고서 2024",
            "report_year": 2024
        }
    """
```

### 4.2 `parse_body_pages_tool`

**용도**: PDF → 페이지별 텍스트 추출

```python
@tool
def parse_body_pages(
    pdf_bytes_b64: str,
    pages: List[int]
) -> Dict[str, Any]:
    """
    지정 페이지의 본문 텍스트를 추출합니다.
    
    Args:
        pdf_bytes_b64: PDF 바이너리 (base64)
        pages: 추출 대상 페이지 번호 리스트 (예: [1, 2, ..., 157])
    
    Returns:
        성공: {
            "body_by_page": {
                1: "페이지 1 전체 텍스트...",
                2: "페이지 2 전체 텍스트...",
                ...
            }
        }
        실패: {
            "error": "...",
            "body_by_page": {}
        }
    
    파싱 전략:
        1) Docling 시도 (빠름, 로컬)
        2) Docling 실패 시 → LlamaParse 폴백 (느림, API)
    """
```

**구현 방향**:
- Docling: `parse_pdf_to_markdown` 또는 `export_to_markdown()` → 페이지별 텍스트 추출
- LlamaParse: `parse_with_llamaparse_tool`의 `page_markdown` 부분 재사용

### 4.3 `map_body_pages_to_sr_report_body_tool`

**용도**: Raw 페이지 텍스트 → 테이블 행 형태 변환

```python
@tool
def map_body_pages_to_sr_report_body(
    body_by_page: Dict[Any, str],
    report_id: str,
    index_page_numbers: Optional[List[int]] = None
) -> List[Dict[str, Any]]:
    """
    페이지별 텍스트를 sr_report_body 테이블 행으로 매핑
    
    Args:
        body_by_page: {page_number: content_text}
        report_id: UUID 문자열 (매핑 결과에는 포함 안 함, 저장 시 전달)
        index_page_numbers: 인덱스 페이지 번호 리스트
    
    Returns:
        [
            {
                "page_number": 1,
                "content_text": "...",
                "is_index_page": False,
                "content_type": None,
                "paragraphs": None
            },
            ...
        ]
    """
```

**현재 구현**: `backend/domain/shared/tool/sr_report/mapping/sr_body_mapping.py` — 이미 완성됨

### 4.4 `save_sr_report_body_batch_tool`

**용도**: 배치 DB 저장

```python
@tool
def save_sr_report_body_batch(
    report_id: str,
    bodies: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    sr_report_body 테이블에 배치 저장
    
    Args:
        report_id: UUID 문자열
        bodies: map_body_pages_to_sr_report_body 반환값 전체
    
    Returns:
        {
            "success": True,
            "saved_count": 157,
            "errors": []
        }
    """
```

**현재 구현**: `backend/domain/shared/tool/sr_report/save/sr_save_tools.py` — 이미 완성됨

---

## 5. (참고) 가설적 LLM 에이전트용 시스템 프롬프트 초안

> **현재 구현과의 차이**: **`SRBodyAgent`는 LLM을 사용하지 않는다** (§3.2). 아래 블록은 향후 MCP·툴 루프 기반 **대화형 본문 에이전트**를 쓸 때를 대비한 초안이며, 운영 경로는 `get_pdf_metadata` → `parse_body_pages`(전 페이지) → `map_*` → `save_sr_report_body_batch` 결정적 호출이 맞다.

```markdown
당신은 SR 보고서 **본문**을 페이지별로 추출해 sr_report_body 테이블에 저장하는 전문 에이전트입니다.
도구를 **능동적으로** 조합해, 한 번 얻은 결과(total_pages, body_by_page, bodies)를 다음 도구 인자로 재사용하며 효율적으로 진행하세요.

---

## sr_report_body 테이블

| 컬럼 | 설명 |
|------|------|
| report_id | historical_sr_reports.id (도구 호출 시 전달) |
| page_number | 페이지 번호 (1-based) |
| content_text | 해당 페이지 본문 텍스트 |
| is_index_page | 인덱스 페이지 여부 (index_page_numbers에 있으면 True) |
| content_type | 선택 (narrative / quantitative / table / mixed) |
| paragraphs | 선택 (문단 JSON) |

---

## 목표

PDF 전체 페이지의 본문 텍스트를 추출하고, 위 스키마에 맞게 sr_report_body에 배치 저장합니다.

## 권장 플로우 (자율 판단)

1. **get_pdf_metadata_tool(report_id)** → total_pages, index_page_numbers 확인
2. **parse_body_pages_tool(pdf_bytes_b64, pages)**  
   - pages: 1부터 total_pages까지 전체 또는 본문만 (인덱스 제외 여부는 판단)  
   - 반환 body_by_page를 다음 단계에 **그대로** 전달
3. **map_body_pages_to_sr_report_body_tool(body_by_page, report_id, index_page_numbers)**  
   - 저장용 행 리스트(bodies) 반환 → **전체**를 save에 전달
4. **save_sr_report_body_batch_tool(report_id, bodies)**  
   - bodies 생략 금지. map 결과 전체를 반드시 전달

## 제약

- 한 번에 하나의 도구만 호출
- 최대 50회 툴 호출
- save_sr_report_body_batch_tool 호출 시 report_id와 **bodies**(map_body_pages_to_sr_report_body_tool 반환값 전체)를 반드시 함께 전달
```

---

## 6. 구현 단계

### 6.1 Phase 1 — `parse_body_pages_tool` 구현

**파일**: `backend/domain/shared/tool/parsing/body_parser.py` (신규)

**구현 방향**:

```python
"""페이지별 본문 텍스트 추출 (Docling 우선 → LlamaParse 폴백)."""
from __future__ import annotations

import base64
from typing import Any, Dict, List

from loguru import logger


def parse_body_pages_with_docling(
    pdf_bytes: bytes,
    pages: List[int]
) -> Dict[int, str]:
    """
    Docling으로 페이지별 텍스트 추출
    
    Returns:
        {page_number: content_text}
    """
    from backend.domain.shared.tool.parsing.docling import parse_pdf_to_markdown
    
    try:
        result = parse_pdf_to_markdown(
            pdf_path_or_bytes=pdf_bytes,
            pages=pages
        )
        
        if result.get("docling_failed"):
            return {}
        
        # page_markdown 또는 markdown 필드에서 페이지별 추출
        page_markdown = result.get("page_markdown", {})
        if not page_markdown:
            # 전체 markdown이면 페이지 분할 로직 필요
            full_md = result.get("markdown", "")
            # TODO: 페이지 구분자로 분할 (Docling 출력 형식 확인 필요)
            return {}
        
        return {int(k): str(v) for k, v in page_markdown.items()}
    except Exception as e:
        logger.error(f"[BodyParser] Docling 실패: {e}")
        return {}


def parse_body_pages_with_llamaparse(
    pdf_bytes: bytes,
    pages: List[int]
) -> Dict[int, str]:
    """
    LlamaParse로 페이지별 텍스트 추출
    
    Returns:
        {page_number: content_text}
    """
    from backend.domain.shared.tool.parsing.llamaparse import parse_with_llamaparse
    
    try:
        result = parse_with_llamaparse(
            pdf_path_or_bytes=pdf_bytes,
            pages=pages,
            parsing_instruction="페이지별 본문 텍스트를 추출하세요. 표는 markdown 형식으로 변환합니다."
        )
        
        page_markdown = result.get("page_markdown", {})
        return {int(k): str(v) for k, v in page_markdown.items()}
    except Exception as e:
        logger.error(f"[BodyParser] LlamaParse 실패: {e}")
        return {}


def parse_body_pages(
    pdf_bytes_b64: str,
    pages: List[int]
) -> Dict[str, Any]:
    """
    페이지별 본문 텍스트 추출 (Docling → LlamaParse 폴백)
    
    Returns:
        {"body_by_page": {1: "text", ...}}
        또는 {"error": "...", "body_by_page": {}}
    """
    try:
        pdf_bytes = base64.b64decode(pdf_bytes_b64)
    except Exception as e:
        return {
            "error": f"PDF base64 디코딩 실패: {e}",
            "body_by_page": {}
        }
    
    # 1) Docling 시도
    logger.info(f"[BodyParser] Docling 시도 (pages={len(pages)})")
    body_by_page = parse_body_pages_with_docling(pdf_bytes, pages)
    
    if body_by_page:
        logger.info(f"[BodyParser] Docling 성공: {len(body_by_page)}페이지")
        return {"body_by_page": body_by_page}
    
    # 2) LlamaParse 폴백
    logger.info(f"[BodyParser] LlamaParse 폴백 시도")
    body_by_page = parse_body_pages_with_llamaparse(pdf_bytes, pages)
    
    if body_by_page:
        logger.info(f"[BodyParser] LlamaParse 성공: {len(body_by_page)}페이지")
        return {"body_by_page": body_by_page}
    
    # 3) 모두 실패
    return {
        "error": "Docling, LlamaParse 모두 실패",
        "body_by_page": {}
    }
```

### 6.2 Phase 2 — MCP 도구 등록

**파일**: `backend/domain/v1/data_integration/spokes/infra/sr_body_tools_server.py`

**구현**:

```python
"""SR 본문 전용 MCP 도구 서버."""
from mcp.server.models import Tool
from typing import Any

from backend.domain.shared.tool.parsing.body_parser import parse_body_pages
from backend.domain.shared.tool.sr_report.mapping import map_body_pages_to_sr_report_body
from backend.domain.shared.tool.sr_report.save.sr_save_tools import (
    save_sr_report_body_batch,
    get_pdf_metadata
)


def get_body_tools() -> list[Tool]:
    """본문 관련 도구 목록 반환"""
    return [
        Tool(
            name="get_pdf_metadata_tool",
            description="historical_sr_reports 테이블에서 메타데이터 조회",
            inputSchema={
                "type": "object",
                "properties": {
                    "report_id": {"type": "string", "description": "UUID 문자열"}
                },
                "required": ["report_id"]
            }
        ),
        Tool(
            name="parse_body_pages_tool",
            description="PDF에서 페이지별 본문 텍스트 추출 (Docling → LlamaParse 폴백)",
            inputSchema={
                "type": "object",
                "properties": {
                    "pdf_bytes_b64": {"type": "string"},
                    "pages": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "추출 대상 페이지 번호 리스트"
                    }
                },
                "required": ["pdf_bytes_b64", "pages"]
            }
        ),
        Tool(
            name="map_body_pages_to_sr_report_body_tool",
            description="페이지별 텍스트를 sr_report_body 테이블 행으로 매핑",
            inputSchema={
                "type": "object",
                "properties": {
                    "body_by_page": {"type": "object"},
                    "report_id": {"type": "string"},
                    "index_page_numbers": {
                        "type": "array",
                        "items": {"type": "integer"}
                    }
                },
                "required": ["body_by_page", "report_id"]
            }
        ),
        Tool(
            name="save_sr_report_body_batch_tool",
            description="sr_report_body 테이블에 배치 저장",
            inputSchema={
                "type": "object",
                "properties": {
                    "report_id": {"type": "string"},
                    "bodies": {
                        "type": "array",
                        "items": {"type": "object"}
                    }
                },
                "required": ["report_id", "bodies"]
            }
        )
    ]


async def call_body_tool(tool_name: str, arguments: dict) -> Any:
    """도구 실행"""
    if tool_name == "get_pdf_metadata_tool":
        return get_pdf_metadata(**arguments)
    elif tool_name == "parse_body_pages_tool":
        return parse_body_pages(**arguments)
    elif tool_name == "map_body_pages_to_sr_report_body_tool":
        return map_body_pages_to_sr_report_body(**arguments)
    elif tool_name == "save_sr_report_body_batch_tool":
        return save_sr_report_body_batch(**arguments)
    else:
        raise ValueError(f"Unknown tool: {tool_name}")
```

### 6.3 Phase 3 — `SRBodyAgent` 강화

**파일**: `backend/domain/v1/data_integration/spokes/agents/sr_body_agent.py` (이미 존재)

**개선 사항**:
- `_prepare_tool_args`에서 `pdf_bytes_b64` 자동 주입 확인
- `last_body_by_page`, `last_bodies` 상태 관리 확인
- 에러 핸들링 강화

### 6.4 Phase 4 — API 엔드포인트

**파일**: `backend/domain/v1/data_integration/hub/routing/agent_router.py`

**추가**:

```python
@router.post("/sr-agent/extract-and-save/body")
async def extract_and_save_body(request: SRBodyRequest):
    """
    SR 보고서 본문을 파싱하여 sr_report_body에 저장
    
    Request:
        {
            "report_id": "uuid",
            "pdf_bytes_b64": "base64..." (선택, report_id로 조회 가능하면 생략)
        }
    
    Response:
        {
            "success": true,
            "message": "본문 157페이지 저장 완료",
            "saved_count": 157,
            "errors": []
        }
    """
    agent = SRBodyAgent()
    result = await agent.execute(
        report_id=request.report_id,
        pdf_bytes_b64=request.pdf_bytes_b64
    )
    return result
```

---

## 7. 테스트 전략

### 7.1 단위 테스트

**파일**: `backend/domain/v1/data_integration/tests/test_body_parser.py`

```python
"""본문 파서 단위 테스트."""
import pytest
from backend.domain.shared.tool.parsing.body_parser import parse_body_pages
import base64

def test_parse_body_pages_with_docling(sample_pdf_bytes):
    """Docling으로 본문 추출"""
    pdf_b64 = base64.b64encode(sample_pdf_bytes).decode()
    result = parse_body_pages(pdf_b64, pages=[1, 2, 3])
    
    assert "body_by_page" in result
    assert 1 in result["body_by_page"]
    assert len(result["body_by_page"][1]) > 100

def test_map_body_pages_to_sr_report_body():
    """매핑 로직 테스트"""
    from backend.domain.shared.tool.sr_report.mapping import map_body_pages_to_sr_report_body
    
    body_by_page = {
        1: "페이지 1 본문",
        146: "GRI Standards Index...",
        147: "인덱스 계속..."
    }
    
    bodies = map_body_pages_to_sr_report_body(
        body_by_page=body_by_page,
        report_id="test-uuid",
        index_page_numbers=[146, 147]
    )
    
    assert len(bodies) == 3
    assert bodies[0]["page_number"] == 1
    assert bodies[0]["is_index_page"] == False
    assert bodies[1]["page_number"] == 146
    assert bodies[1]["is_index_page"] == True
```

### 7.2 통합 테스트

**파일**: `backend/domain/v1/data_integration/tests/test_sr_body_agent_integration.py`

```python
"""SRBodyAgent 통합 테스트."""
import pytest
from backend.domain.v1.data_integration.spokes.agents.sr_body_agent import SRBodyAgent

@pytest.mark.asyncio
async def test_body_agent_full_flow(test_report_id, test_pdf_bytes):
    """에이전트 전체 플로우 테스트"""
    agent = SRBodyAgent()
    result = await agent.execute(
        report_id=test_report_id,
        pdf_bytes_b64=base64.b64encode(test_pdf_bytes).decode()
    )
    
    assert result["success"] == True
    assert result["saved_count"] > 0
    assert len(result["errors"]) == 0
```

---

## 8. 실행 예시

### 8.1 CLI 실행

```bash
# 본문 파싱 및 저장
curl -X POST http://localhost:8000/data-integration/sr-agent/extract-and-save/body \
  -H "Content-Type: application/json" \
  -d '{
    "report_id": "4c3d8102-ac25-45cc-badf-d7c7021e2dee"
  }'
```

### 8.2 Python SDK

```python
from backend.domain.v1.data_integration.spokes.agents.sr_body_agent import SRBodyAgent

agent = SRBodyAgent()
result = await agent.execute(
    report_id="4c3d8102-ac25-45cc-badf-d7c7021e2dee"
)

print(f"✅ 본문 저장: {result['saved_count']}페이지")
# ✅ 본문 저장: 157페이지
```

---

## 9. 모니터링 및 로깅

### 9.1 주요 로그 포인트

```python
# 1) Docling 시도
logger.info("[BodyParser] Docling 시도 (pages={len})")

# 2) LlamaParse 폴백
logger.warning("[BodyParser] Docling 실패 → LlamaParse 폴백")

# 3) 페이지 수집 완료
logger.info("[BodyParser] 페이지 추출 완료: {count}페이지")

# 4) 배치 저장 완료
logger.info("[SRBodyAgent] sr_report_body 저장: {saved_count}건")
```

### 9.2 에러 처리

| 에러 | 처리 |
|------|------|
| PDF 디코딩 실패 | 즉시 반환, `error` 포함 |
| Docling + LlamaParse 모두 실패 | `body_by_page` 빈 dict 반환 |
| 매핑 실패 | `bodies` 빈 리스트 반환 |
| DB 저장 실패 | `errors` 배열에 페이지별 오류 기록 |

---

## 10. 후속 개선 사항 (Phase 2)

### 10.1 문단 분할 (`paragraphs`)

**도구**: `split_into_paragraphs_tool`

```python
def split_into_paragraphs(content_text: str) -> List[Dict]:
    """
    텍스트를 문단으로 분할
    
    Returns:
        [
            {
                "order": 1,
                "text": "첫 번째 문단...",
                "start_char": 0,
                "end_char": 120
            },
            ...
        ]
    
    분할 규칙:
        - 빈 줄(\n\n)로 문단 구분
        - 최소 길이 50자
        - 제목·헤더 제외
    """
```

### 10.2 콘텐츠 타입 분류 (`content_type`)

**도구**: `classify_content_type_tool`

```python
def classify_content_type(content_text: str) -> str:
    """
    페이지 콘텐츠 타입 분류 (LLM 또는 규칙)
    
    Returns:
        "narrative" | "quantitative" | "table" | "mixed"
    
    분류 규칙:
        - 숫자·표가 많으면 → "quantitative"
        - 마크다운 표(|) 존재 → "table"
        - 텍스트 위주 → "narrative"
        - 혼합 → "mixed"
    """
```

### 10.3 임베딩 생성

**도구**: `generate_body_embeddings_tool`

```python
def generate_body_embeddings(report_id: str):
    """
    sr_report_body의 content_text를 벡터 DB에 임베딩
    
    Process:
        1) report_id의 모든 본문 행 조회
        2) content_text → 임베딩 생성 (BGE-M3)
        3) 벡터 DB 저장
        4) embedding_id, embedding_status 업데이트
    """
```

---

## 11. 참고 문서

- `HISTORICAL_REPORT_PARSING.md` — 본문·인덱스 분리 개념
- `DATA_ONTOLOGY.md` — 온톨로지·DP·통합 컬럼
- [`AGENTIC_INDEX_DESIGN.md`](../index/AGENTIC_INDEX_DESIGN.md) — 인덱스 에이전트 구조 (본문 에이전트 참고용)
- `sr_body_agent.py` — 현재 본문 에이전트 구현
- `sr_body_mapping.py` — 매핑 로직 (완성)
- `sr_save_tools.py` — 저장 도구 (완성)

---

## 12. 구현 체크리스트

### Phase 1 — 핵심 파싱 (필수)
- [x] `parse_body_pages_with_docling` 구현 (`body_parser.py`)
- [x] `parse_body_pages_with_llamaparse` 구현 (`body_parser.py`)
- [x] `parse_body_pages` 통합 함수 (`body_parser.py`, PyMuPDF 최종 폴백 포함)
- [x] MCP 도구 연결 (`sr_body_tools_server.py`, `mcp_client.py` in-process)
- [x] `SRBodyAgent` 인자 주입 (기존 `sr_body_agent.py` 유지)
- [x] API 엔드포인트 (`sr_agent_router.py`: `extract-and-save/body-agentic`)

### Phase 2 — 테스트 (필수)
- [x] `test_body_parser.py` 단위 테스트
- [ ] `test_sr_body_agent_integration.py` 통합 테스트
- [ ] 실제 SR PDF로 E2E 테스트

### Phase 3 — 품질 개선 (선택)
- [ ] 문단 분할 로직 (`split_into_paragraphs`)
- [ ] 콘텐츠 타입 분류 (`classify_content_type`)
- [ ] 임베딩 생성 배치 잡 (`generate_body_embeddings`)

---

## 13. 마무리

**현재 상태**: 매핑·저장 도구 완성 + **`backend/domain/shared/tool/parsing/body_parser.py`**(Docling→LlamaParse→PyMuPDF) + MCP(`parse_body_pages_tool`) + **`POST /data-integration/sr-agent/extract-and-save/body-agentic`**  
**다음 단계**: 실제 SR PDF 기준 E2E·부하(대용량 페이지) 튜닝  
**예상 소요**: 파싱 도구 1일 + 테스트 1일 = **총 2일** (핵심 구현 반영됨)

인덱스 파이프라인과 같이 **동일한 툴·스키마 패턴**을 따르되, **본문은 현재 구현에서 LLM 없이 결정적 파이프라인**으로 두어 대용량 PDF에서 컨텍스트 비용을 피한다 (§3.2). §5 초안은 선택적 LLM 경로용이다.
