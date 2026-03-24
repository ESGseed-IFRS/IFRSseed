"""SR 저장 전 LLM 검토/보정

에이전트가 준 결과값을 판단·검토한 뒤 저장 가능 여부 또는 검토된 값을 반환합니다.
그래프의 각 save 노드에서 파싱 결과를 DB에 넣기 전에 LLM이 검토·보정하거나 저장 여부를 판단합니다.
Docling 인덱스: 이상치 검사 후 해당 페이지만 LlamaParse MD로 에이전트 보정(파싱된 값만 사용).
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from langchain_openai import ChatOpenAI
from loguru import logger

from backend.domain.shared.tool.sr_report.index.multi_parser_merger import (
    ensure_merge_row_keys,
    split_markdown_index_chunks,
)


# ---------------------------------------------------------------------------
# SR 인덱스 스키마 컨텍스트 (LLM 프롬프트용 컬럼 설명)
# ---------------------------------------------------------------------------

SR_INDEX_SCHEMA_CONTEXT = """
## SR 보고서 인덱스 스키마 상세 설명

### 1. dp_id (Disclosure Point ID - 공시 식별자)
**목적**: 지속가능경영 보고서에서 각 공시 항목을 고유하게 식별하는 코드
**형식**:
  - GRI 표준: "GRI-" + 숫자 + "-" + 숫자 (예: GRI-2-1, GRI-305-1)
  - IFRS S1/S2: "S" + 숫자 + "-" + 숫자 (예: S1-1, S2-5)
  - SASB: 업종코드 + "-" + 주제코드 (예: TC-SI-130a.1)
  - ESRS(유럽): S/E/G 주제 + 번호 (예: S2-5, E1-6, G1-1), 또는 GOV-1, IRO-1, SBM-3 등
  - 기타: 보고서 자체 체계 (예: E1-1, ESG-01)
**길이**: 일반적으로 3~20자 이내
**주의사항**:
  - 표에서 "공시항목", "지표코드", "Code", "Indicator" 등의 컬럼에서 추출
  - dp_id가 비어있거나 과도하게 긴 경우(50자 이상) 이상치로 판단
  - 문장 전체가 들어가면 안 됨 (예: "온실가스 배출량 관리" → 잘못됨)

### 2. dp_name (Disclosure Point Name - 지표명/공시명)
**목적**: 해당 공시 항목이 무엇에 관한 것인지 설명하는 한글/영문 명칭
**형식**: 자연어 문장 또는 구 (제한 없음)
**예시**: "온실가스 배출량 (Scope 1, 2)", "이사회 구성 및 다양성", "Greenhouse Gas Emissions"
**주의사항**:
  - 표에서 "지표명", "항목", "내용", "Description", "Topic" 등의 컬럼에서 추출
  - dp_id와 혼동 금지: dp_name은 설명이고, dp_id는 코드
  - 너무 짧으면 이상 (예: "GRI-2-1" → 이건 dp_id지 dp_name 아님)

### 3. page_numbers (페이지 번호 배열)
**목적**: 해당 공시 내용이 보고서의 어느 페이지에 있는지 명시
**형식**: 정수 배열 [1, 2, 3, ...]
**변환 규칙**:
  - 단일 페이지: "45" → [45]
  - 범위: "10-12" → [10, 11, 12]
  - 복수: "10, 12, 15" → [10, 12, 15]
  - 혼합: "10-12, 15" → [10, 11, 12, 15]
**주의사항**:
  - 표에서 "페이지", "Page", "쪽" 등의 컬럼에서 추출
  - 빈 배열 [] 또는 보고서 전체 페이지 수를 초과하는 값은 이상치
  - 문자열이 아닌 정수 배열이어야 함

### 4. section_title (섹션 제목)
**목적**: 해당 공시가 속한 보고서 내 대분류/장 제목
**형식**: 자연어 문장 (옵션, 없으면 null)
**예시**: "환경 (Environmental)", "지배구조", "Chapter 3. Social Responsibility"
**주의사항**:
  - 표에서 "분류", "Category", "Section", "Chapter" 등의 컬럼에서 추출
  - 없으면 null로 두고, 임의로 만들지 말 것

### 5. index_page_number (인덱스 페이지 번호)
**목적**: 이 인덱스 표 자체가 보고서의 몇 페이지에 있는지
**형식**: 정수 (단일 값)
**주의사항**: 메타데이터로 알려주면 그 값을 쓰고, 마크다운 전용 매핑 시 프롬프트에 주어진 페이지 키를 사용

### 6. row_sequence (동일 dp_id 반복 구분)
**목적**: 같은 표에서 동일 코드(예: 3-3, TC-SI-130a.1)가 여러 행이면 순서로 구분
**형식**: 0부터 시작. 표 위→아래 순서대로 부여

### 7. material_topic (선택)
**목적**: Material Topic, 대분류 등 **열에 값이 있을 때만** 구분용으로 기록 (없으면 null)

### 8. index_entry_id
**목적**: 저장용 유니크 ID. **출력 생략 가능** — 시스템이 부여

### 9. index_type — ESRS vs IFRS vs 기타 (맥락 우선)
**목적**: 이 행이 어떤 공시 **체계**의 인덱스인지 구분합니다.
- **esrs**: 마크다운·표 상단에 **ESRS INDEX**, **ESRS**, **European Sustainability Reporting**, **유럽 지속가능성 공시** 등이 보이거나, 표가 **유럽 ESRS 공시 목차/인덱스**임이 분명할 때 사용합니다. **표 제목·절 헤더·표준명**을 근거로 판단하세요.
- **ifrs**: IFRS 재단 **지속가능성 공시(IFRS S1/S2 등)** 전용 인덱스이고 문맥상 **ESRS가 아님**이 분명할 때만 사용합니다. **코드에 S·E·G·숫자가 섞여 있다는 이유만으로 ifrs로 두지 마세요** (ESRS도 S2·E1 형태 코드를 씁니다).
- **gri** / **sasb**: 해당 표준이 표·제목에 명시될 때.
- **other**: 위에 해당하지 않을 때.

**중요**: 개별 코드 문자열(예: `S2-5`)만 보고 IFRS와 ESRS를 구분하지 말고, **같은 페이지 마크다운에 나타난 제목·표준명·표 헤더**를 우선하세요.
"""

from backend.domain.shared.tool.sr_report.index.preprocessing.sr_index_plain_text import (
    SR_INDEX_RIGHT_COLUMN_SECOND_PASS_RULES,
    SR_PLAIN_TEXT_INDEX_RULES,
    build_llm_index_context_prefix,
    build_right_column_plaintext_supplement,
    normalize_dp_id_ocr_confusables,
    normalize_gri_prefixed_dp_id,
    prepare_index_page_markdown_for_llm,
)

# ---------------------------------------------------------------------------
# Docling 인덱스 이상치 검사 및 LlamaParse MD 기반 에이전트 보정
# ---------------------------------------------------------------------------

def _contains_korean(text: str) -> bool:
    """문자열에 한글(완성형 음절)이 포함되어 있는지 여부."""
    if not text:
        return False
    for c in text:
        if "\uAC00" <= c <= "\uD7A3":
            return True
    return False


def detect_sr_index_anomalies(
    indices: List[Dict[str, Any]],
    total_pages: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Docling으로 파싱된 인덱스 행 중 이상치를 감지합니다.

    이상치:
    - dp_id: 비어있음, 10자 이상, 한글 포함, dp_id == dp_name, 200자 초과
    - page_numbers: 비어있음/비정상, total_pages 초과
    - index_type이 "other"인 경우 해당 행에 다른 이상이 있으면 index_type도 이상치로 포함(보정 대상)
    """
    anomalous_items: List[Dict[str, Any]] = []
    for i, row in enumerate(indices):
        bad_cols: List[str] = []
        dp_id = (row.get("dp_id") or "").strip()
        dp_name = (row.get("dp_name") or "").strip()
        page_numbers = row.get("page_numbers")
        index_type = (row.get("index_type") or "").strip().lower()

        # dp_id 이상치: 비어있음, 10자 이상(코드가 아닌 문장 가능성), 한글 포함, dp_id==dp_name, 200자 초과
        if not dp_id:
            bad_cols.append("dp_id")
        elif (
            len(dp_id) > 200
            or len(dp_id) >= 10
            or _contains_korean(dp_id)
            or (dp_name and dp_id == dp_name)
        ):
            bad_cols.append("dp_id")

        if not isinstance(page_numbers, list) or len(page_numbers) == 0:
            bad_cols.append("page_numbers")
        elif total_pages is not None:
            if any(p > total_pages or p < 1 for p in page_numbers):
                bad_cols.append("page_numbers")

        # index_type이 "other"이면 이상치 판단 강화: 다른 이상이 있을 때 index_type도 보정 대상에 포함
        if bad_cols and index_type == "other":
            bad_cols.append("index_type")

        if not bad_cols:
            continue
        anomalous_items.append({
            "row_index": i,
            "row": dict(row),
            "anomalous_columns": bad_cols,
            "index_page_number": row.get("index_page_number"),
        })
    return anomalous_items


async def correct_anomalous_index_rows_with_md(
    anomalous_items: List[Dict[str, Any]],
    page_markdown_by_page: Dict[int, str],
    report_id: str,
) -> List[Dict[str, Any]]:
    """
    이상치가 난 행에 대해, 해당 페이지의 LlamaParse 마크다운만을 사용해
    이상 컬럼 값을 보정합니다. 파싱된 값으로만 추론하며 임의 생성/수정 금지.
    
    LLM은 마크다운 전체 맥락을 확인하면서 anomalous_columns 외에도
    추가 이상치(의미 불일치, MD 부재 값, 누락된 정보 등)를 발견하면 함께 보정합니다.
    
    Returns:
        보정된 행 리스트 (anomalous_items와 동일한 순서, row_index로 원본 indices에 병합 가능).
    """
    if not anomalous_items or not page_markdown_by_page:
        return []

    llm = _get_llm(model_name="gpt-4o-mini", temperature=0)
    corrected_rows: List[Dict[str, Any]] = []

    # 페이지별로 그룹화하여 MD 한 번에 전달
    by_page: Dict[int, List[Dict]] = {}
    for item in anomalous_items:
        p = item.get("index_page_number")
        if p is not None:
            by_page.setdefault(p, []).append(item)

    for page_num, items in by_page.items():
        md = page_markdown_by_page.get(page_num) or ""
        if not md.strip():
            for item in items:
                corrected_rows.append({"row_index": item["row_index"], "row": item["row"]})
            continue

        rows_desc = []
        for item in items:
            r = item["row"]
            cols = item.get("anomalous_columns") or []
            rows_desc.append({
                "row_index": item["row_index"],
                "anomalous_columns": cols,
                "current": {k: r.get(k) for k in ["dp_id", "dp_name", "page_numbers", "section_title", "index_type"] if k in r},
            })

        prompt = f"""당신은 SR 보고서 인덱스 표의 이상치를 보정하는 에이전트입니다.
{SR_INDEX_SCHEMA_CONTEXT}

## 규칙 (필수)
- 아래 "해당 페이지 마크다운"에 **실제로 등장하는 텍스트/숫자만** 사용하세요.
- **임의로 값을 만들거나 추측하지 마세요.** 마크다운에 없으면 해당 필드는 수정하지 말고 원본 유지하세요.
- 위 스키마 설명을 참고해 각 컬럼의 목적·형식에 맞게 보정하세요.
- 보정은 **anomalous_columns에 명시된 필드를 우선 수정**하되, 마크다운 전체 맥락을 확인하면서 **추가 이상치를 발견하면 함께 보정**하세요.
- page_numbers는 마크다운에 나온 페이지 번호만 정수 배열로 넣으세요 (예: [1, 2, 3]).
- dp_id는 공시 식별자(예: GRI-2-1, S2-1)만 추출해 넣으세요.

## 추가 이상치 발견 기준 (마크다운과 비교 시)
1. **마크다운에 없는 값**: Docling 결과에 있지만 마크다운에는 존재하지 않는 dp_id, dp_name 등
2. **의미 불일치**: Docling의 dp_name과 마크다운의 실제 지표명이 다른 경우
3. **누락된 정보**: 마크다운에는 명시되어 있지만 Docling 결과에서 빠진 page_numbers, section_title 등
4. **형식 오류**: page_numbers가 배열이 아니거나, dp_id가 과도하게 긴 경우 등

## 해당 페이지 마크다운 (페이지 {page_num})
```
{md[:12000]}
```

## 이상 행 (anomalous_columns를 우선 보정하되, 추가 이상치도 발견하면 함께 수정)
{json.dumps(rows_desc, ensure_ascii=False, indent=2)}

## 출력 형식
JSON 배열 하나만 출력하세요. 각 요소는:
{{
  "row_index": int,
  "corrections": {{ "dp_id": "...", "page_numbers": [1,2], "dp_name": "...", ... }},
  "additional_anomalies_found": ["마크다운에 없는 값", "의미 불일치: ...", ...]  // 옵션, 추가 발견된 이상치 설명
}}

- corrections에는 anomalous_columns 필드 + 추가로 발견한 이상 필드를 모두 포함하세요.
- 수정할 값이 없으면 corrections를 빈 객체로 두세요.
- additional_anomalies_found는 선택사항이며, 로깅용입니다.
다른 설명 없이 JSON만 출력합니다."""

        try:
            logger.info("correct_anomalous_index_rows_with_md: 페이지 %s 보정 중", page_num)
            resp = await llm.ainvoke(prompt)
            text = resp.content.strip()
            m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
            if m:
                text = m.group(1).strip()
            out = json.loads(text)
            if not isinstance(out, list):
                out = []
            for rec in out:
                idx = rec.get("row_index")
                corr = rec.get("corrections") or {}
                additional = rec.get("additional_anomalies_found") or []
                orig_item = next((x for x in items if x["row_index"] == idx), None)
                if orig_item is None:
                    continue
                new_row = dict(orig_item["row"])
                
                # anomalous_columns 우선 적용
                for key, val in corr.items():
                    if key in orig_item.get("anomalous_columns", []):
                        new_row[key] = val
                
                # 추가 이상치가 발견된 경우 (anomalous_columns 외 필드)
                for key, val in corr.items():
                    if key not in orig_item.get("anomalous_columns", []):
                        if key in ["dp_id", "dp_name", "page_numbers", "section_title", "index_type"]:
                            new_row[key] = val
                
                if additional:
                    logger.info(f"[LLM] 행 {idx} 추가 이상치 발견: {additional}")
                
                corrected_rows.append({"row_index": idx, "row": new_row})
            logger.info("correct_anomalous_index_rows_with_md: 페이지 %s 보정 완료", page_num)
        except Exception as e:
            logger.warning(f"[LLM] 인덱스 이상치 보정 실패 (page={page_num}): {e}, 원본 유지")
            for item in items:
                corrected_rows.append({"row_index": item["row_index"], "row": item["row"]})

    return corrected_rows


def merge_corrected_index_rows(
    indices: List[Dict[str, Any]],
    corrected_rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """corrected_rows의 row_index에 따라 indices 해당 위치를 보정된 row로 교체합니다."""
    by_idx = {r["row_index"]: r["row"] for r in corrected_rows}
    out = []
    for i, row in enumerate(indices):
        if i in by_idx:
            out.append(by_idx[i])
        else:
            out.append(dict(row))
    return out


def _get_llm(model_name: str = "gpt-4o-mini", temperature: float = 0) -> ChatOpenAI:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")
    return ChatOpenAI(model=model_name, api_key=api_key, temperature=temperature)


async def review_sr_metadata_with_llm(
    meta: Dict[str, Any],
    company: str,
    year: int,
) -> Dict[str, Any]:
    """
    메타데이터를 LLM이 검토·보정합니다.
    report_name, index_page_numbers 등이 적절한지 확인하고 필요 시 수정된 dict를 반환합니다.
    """
    llm = _get_llm()
    prompt = f"""다음은 SR(지속가능경영) 보고서 메타데이터 파싱 결과입니다.
회사: {company}, 연도: {year}

현재 메타데이터 (JSON):
{json.dumps(meta, ensure_ascii=False, indent=2)}

다음 규칙으로 검토·보정하세요:
1. report_name이 보고서 성격에 맞는지 확인하고, 부적절하면 수정하세요.
2. total_pages, index_page_numbers가 비어있거나 비정상이면 그대로 두거나 빈 배열/0으로 두세요.
3. 원문에 없는 값을 만들지 마세요.
4. 반드시 JSON 객체 하나만 출력하세요. 다른 설명 없이 JSON만 출력합니다. 키는 기존과 동일하게 유지합니다."""

    try:
        resp = await llm.ainvoke(prompt)
        text = resp.content.strip()
        m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if m:
            text = m.group(1).strip()
        out = json.loads(text)
        # 필수 키 누락 시 원본으로 보완
        for k in meta:
            if k not in out or out[k] is None:
                out[k] = meta[k]
        logger.info("[LLM] 메타데이터 검토 완료")
        return out
    except Exception as e:
        logger.warning(f"[LLM] 메타데이터 검토 실패, 원본 사용: {e}")
        return meta


async def review_sr_index_rows_with_llm(
    indices: List[Dict[str, Any]],
    report_id: str,
) -> List[Dict[str, Any]]:
    """
    인덱스 행 리스트를 LLM이 검토·보정합니다.
    dp_id, index_type, dp_name, page_numbers, section_title 등 컬럼 매핑이 잘못된 경우 올바르게 재배치합니다.
    """
    if not indices:
        return indices

    llm = _get_llm()
    schema = (
        "각 항목: index_type(gri|ifrs|sasb), dp_id(공시 식별자 예: GRI-2-1), "
        "dp_name(지표명), page_numbers(페이지 번호 배열), section_title(섹션 제목). "
        "잘못된 컬럼에 들어간 값은 올바른 컬럼으로 재배치하세요. 원문에 없는 값은 만들지 마세요."
    )
    # 토큰 절약: 최대 200건만 전달하고 나머지는 그대로 붙임
    max_rows = 200
    to_review = indices[:max_rows]
    rest = indices[max_rows:]

    prompt = f"""다음은 SR 보고서 인덱스 파싱 결과입니다. report_id: {report_id}

스키마: {schema}

현재 인덱스 배열 (JSON):
{json.dumps(to_review, ensure_ascii=False, indent=2)}

위 배열을 검토·보정한 뒤, 동일한 형태의 JSON 배열 하나만 출력하세요. 다른 설명 없이 JSON 배열만 출력합니다."""

    try:
        resp = await llm.ainvoke(prompt)
        text = resp.content.strip()
        m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if m:
            text = m.group(1).strip()
        out = json.loads(text)
        if not isinstance(out, list):
            out = to_review
        logger.info(f"[LLM] 인덱스 검토 완료: {len(out)}건 (전체 {len(indices)}건)")
        return out + rest
    except Exception as e:
        logger.warning(f"[LLM] 인덱스 검토 실패, 원본 사용: {e}")
        return indices


def _normalize_mapped_sr_index_rows(
    rows: List[Dict[str, Any]],
    *,
    report_id: str,
    total_pages: Optional[int],
) -> List[Dict[str, Any]]:
    """LLM이 반환한 인덱스 행에 report_id·parsing_method·page_numbers·dp_id OCR 정규화를 보정합니다."""
    out: List[Dict[str, Any]] = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        row = dict(item)
        row["report_id"] = report_id
        row.setdefault("parsing_method", "llamaparse")
        did = row.get("dp_id")
        if isinstance(did, str) and did.strip():
            fixed = normalize_dp_id_ocr_confusables(did.strip())
            row["dp_id"] = normalize_gri_prefixed_dp_id(
                str(row.get("index_type") or ""),
                fixed,
            )
        pns = row.get("page_numbers")
        if isinstance(pns, list) and total_pages is not None:
            row["page_numbers"] = [
                p for p in pns
                if isinstance(p, int) and 1 <= p <= total_pages
            ]
        out.append(row)
    return out


async def _map_one_markdown_chunk(
    llm: ChatOpenAI,
    *,
    chunk_text: str,
    chunk_index: int,
    num_chunks: int,
    report_id: str,
    total_pages: Optional[int],
    index_page_number_hint: Optional[int],
    page_key_label: str,
    index_page_numbers_hint: str,
    supplemental_rules: str = "",
) -> List[Dict[str, Any]]:
    """단일 마크다운 조각 → 인덱스 행 배열 (내부용)."""
    ipn_line = ""
    if index_page_number_hint is not None:
        ipn_line = (
            f"\n이 조각의 인덱스 표는 PDF **{index_page_number_hint}** 페이지에 있다고 가정하고 "
            f"**index_page_number** 를 {index_page_number_hint} 로 두세요.\n"
        )

    extra = f"{supplemental_rules.strip()}\n\n" if supplemental_rules.strip() else ""

    prompt = f"""당신은 지속가능경영(SR) 보고서의 **인덱스(매핑) 표**를 마크다운에서 구조화하는 전문가입니다.
{SR_INDEX_SCHEMA_CONTEXT}
{SR_PLAIN_TEXT_INDEX_RULES}

## 규칙
{extra}- 아래 마크다운에 **실제로 등장하는** DP 코드·페이지·지표명만 추출하세요.
- **표의 한 데이터 행 = JSON 배열의 한 요소** 입니다. 서로 다른 행은 절대 합치지 마세요.
- **평문 다단**이면 한 줄 또는 인접 줄 묶음을 한 행으로 보고, 왼쪽·가운데·오른쪽 열에서 각각 코드·지표명·페이지를 추출하세요.
- **누락 최소화**: 이 조각에 보이는 인덱스 행은 **가능한 모두** 출력하세요. 왼쪽 열·오른쪽 열을 **한쪽만** 추출하지 마세요. 여러 청크로 나뉘어도 각 청크에서 보이는 행은 포함하세요(중복은 후처리 가능).
- 같은 dp_id가 여러 행이면(예: GRI 3-3 반복) 모두 별도 객체로 두고 **row_sequence** 를 표 위→아래 순으로 0,1,2… 부여하세요.
- (1)(2)(3) 서브항목이 한 셀에 묶여 있어도, 원문 표가 한 행이면 **한 레코드**로 두세요.
- 임의로 행을 만들거나 페이지를 추측하지 마세요. 이 조각에 인덱스 표가 없으면 [] 을 반환하세요.
- 각 행은 반드시 index_type, dp_id, page_numbers(정수 배열)를 포함해야 합니다.
- index_type은 gri | sasb | ifrs | esrs | other 중 하나로, **위 스키마 §9** 및 상단 **[맥락 힌트]**를 따르세요. **본문이 GRI Standards Index이면 esrs로 분류하지 마세요.**
- Topic/Material 구분 열이 있으면 **material_topic** 에 넣으세요.
{ipn_line}
- 이 조각은 해당 PDF 페이지에서 **{chunk_index + 1}/{num_chunks}** 번째입니다.

report_id: {report_id}
total_pages (참고): {total_pages}
PDF 페이지 키(소스): {page_key_label}
{index_page_numbers_hint}

## 마크다운 조각
{chunk_text}

## 출력
JSON 배열 하나만 출력합니다. 예:
[{{"index_type":"gri","dp_id":"GRI-2-1","dp_name":"…","page_numbers":[10,11],"section_title":null,"index_page_number":null,"row_sequence":0,"material_topic":null}}]
다른 설명 없이 JSON만 출력합니다."""

    try:
        resp = await llm.ainvoke(prompt)
        text = (resp.content or "").strip()
        m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if m:
            text = m.group(1).strip()
        out = json.loads(text)
        if not isinstance(out, list):
            return []
        return out
    except Exception as e:
        logger.warning("_map_one_markdown_chunk 실패: {}", e)
        return []


async def map_page_markdown_to_sr_report_index(
    page_markdown: Dict[Any, Any],
    *,
    report_id: str,
    total_pages: Optional[int] = None,
    index_page_numbers: Optional[List[int]] = None,
) -> List[Dict[str, Any]]:
    """
    LlamaParse가 준 page_markdown만 있을 때, LLM으로 인덱스 표를 sr_report_index 행 리스트로 채웁니다.

    - **페이지 키별**로 LLM 호출(긴 페이지는 청크 분할)하여 누락·토큰 한도 문제를 줄입니다.
    - 표/목차에 나온 dp_id, 페이지, 지표명 등만 사용 (마크다운에 없는 값 생성 금지)
    - 마지막에 ensure_merge_row_keys 로 동일 dp_id 행에 row_sequence·index_entry_id 보강
    """
    if not page_markdown or not isinstance(page_markdown, dict):
        return []

    def _pm_sort_key(x: Any) -> Any:
        try:
            return int(x)
        except (TypeError, ValueError):
            return str(x)

    idx_hint = ""
    if index_page_numbers:
        idx_hint = f"인덱스 페이지 후보(참고): {index_page_numbers}\n"

    llm = _get_llm(model_name="gpt-4o-mini", temperature=0)
    flat_raw: List[Dict[str, Any]] = []
    sorted_keys = sorted(page_markdown.keys(), key=_pm_sort_key)
    non_empty_pages = 0

    for page_key in sorted_keys:
        md = page_markdown.get(page_key)
        if md is None or not str(md).strip():
            continue
        non_empty_pages += 1
        text = prepare_index_page_markdown_for_llm(str(md).strip())
        chunks = split_markdown_index_chunks(text, max_chars=8000, overlap=400)
        context_prefix = build_llm_index_context_prefix(text)
        try:
            pk_int = int(page_key)
        except (TypeError, ValueError):
            pk_int = None
        page_label = str(page_key)

        for ci, chunk in enumerate(chunks):
            rows = await _map_one_markdown_chunk(
                llm,
                chunk_text=context_prefix + chunk,
                chunk_index=ci,
                num_chunks=len(chunks),
                report_id=report_id,
                total_pages=total_pages,
                index_page_number_hint=pk_int,
                page_key_label=page_label,
                index_page_numbers_hint=idx_hint,
            )
            flat_raw.extend(rows)

        # 평문 다단 2열 페이지: 오른쪽 열 추정 블록으로 두 번째 패스 (누락 완화)
        right_supp = build_right_column_plaintext_supplement(text)
        if right_supp:
            nch = len(chunks) + 1
            rows_r = await _map_one_markdown_chunk(
                llm,
                chunk_text=context_prefix + right_supp,
                chunk_index=len(chunks),
                num_chunks=nch,
                report_id=report_id,
                total_pages=total_pages,
                index_page_number_hint=pk_int,
                page_key_label=page_label,
                index_page_numbers_hint=idx_hint,
                supplemental_rules=SR_INDEX_RIGHT_COLUMN_SECOND_PASS_RULES,
            )
            flat_raw.extend(rows_r)
            logger.debug(
                "map_page_markdown: 페이지 {} 오른쪽 열 2차 패스 +{}건",
                page_label,
                len(rows_r),
            )

    normalized = _normalize_mapped_sr_index_rows(
        flat_raw, report_id=report_id, total_pages=total_pages
    )
    logger.info(
        "map_page_markdown_to_sr_report_index: 원본 {}건 → 정규화 {}건, 비어 있지 않은 페이지 {}개",
        len(flat_raw),
        len(normalized),
        non_empty_pages,
    )
    return ensure_merge_row_keys(normalized)


async def confirm_sr_body_save_with_llm(page_count: int, report_id: str) -> bool:
    """본문 저장 전 LLM이 저장 진행 여부를 판단합니다 (요약만 전달)."""
    llm = _get_llm()
    prompt = f"""SR 보고서 본문 저장 단계입니다.
report_id: {report_id}, 추출된 페이지 수: {page_count}

이 본문을 DB에 저장해도 됩니까? 답변은 반드시 한 줄로 '예' 또는 '아니오'만 출력하세요."""

    try:
        resp = await llm.ainvoke(prompt)
        text = (resp.content or "").strip().lower()
        ok = "예" in text or "yes" in text or "ok" in text or "저장" in text
        logger.info(f"[LLM] 본문 저장 판단: {'진행' if ok else '스킵'}")
        return ok
    except Exception as e:
        logger.warning(f"[LLM] 본문 저장 판단 실패, 진행: {e}")
        return True


async def confirm_sr_images_save_with_llm(image_count: int, report_id: str) -> bool:
    """이미지 저장 전 LLM이 저장 진행 여부를 판단합니다."""
    llm = _get_llm()
    prompt = f"""SR 보고서 이미지 저장 단계입니다.
report_id: {report_id}, 추출된 이미지 수: {image_count}

이 이미지 메타를 DB에 저장해도 됩니까? 답변은 반드시 한 줄로 '예' 또는 '아니오'만 출력하세요."""

    try:
        resp = await llm.ainvoke(prompt)
        text = (resp.content or "").strip().lower()
        ok = "예" in text or "yes" in text or "ok" in text or "저장" in text
        logger.info(f"[LLM] 이미지 저장 판단: {'진행' if ok else '스킵'}")
        return ok
    except Exception as e:
        logger.warning(f"[LLM] 이미지 저장 판단 실패, 진행: {e}")
        return True
