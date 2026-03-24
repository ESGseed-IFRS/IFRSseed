"""LlamaParse 기반 인덱스 페이지 마크다운 추출.

페이지별 스레드로 파싱해 Event loop 충돌 방지.

LlamaParse 옵션은 환경변수·프리셋으로 조절합니다.
  - LLAMA_PARSE_PRESET: 미설정·빈 값이면 기본 **index**. agentic / lvm / none
  - index 프리셋은 기본 **마크다운 표**(output_tables_as_HTML=False)로 두어 인덱스 매핑 파이프라인과 맞춤. HTML 표가 필요하면 LLAMA_PARSE_OUTPUT_TABLES_AS_HTML=1
  - LLAMA_PARSE_* : 프리셋 이후에 덮어씀
설치된 llama-parse 버전에 없는 인자는 자동으로 제외됩니다(구버전 호환).
"""
from __future__ import annotations

import inspect
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from loguru import logger

from .pdf_pages import extract_pages_to_pdf


def _env_truthy(name: str) -> Optional[bool]:
    """환경변수가 비어 있으면 None, 설정되면 True/False."""
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return None
    if raw in ("1", "true", "yes", "y", "on"):
        return True
    if raw in ("0", "false", "no", "n", "off"):
        return False
    return None


def _env_strip(name: str) -> Optional[str]:
    v = os.getenv(name, "").strip()
    return v or None


def _env_int(name: str) -> Optional[int]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        logger.warning("[LlamaParse] %s 정수가 아님, 무시: %r", name, raw)
        return None


# 프리셋: (설명, LlamaParse에 넘길 kwargs). 개별 LLAMA_PARSE_* 가 이후에 덮어씀.
# 비활성화 키워드: 이중 하나면 아래 index/agentic/lvm 프리셋을 적용하지 않음
_LLAMA_PARSE_PRESET_DISABLED = frozenset({"none", "off", "false", "0"})

_LLAMA_PARSE_PRESETS: Dict[str, Dict[str, Any]] = {
    # SR 목차 인덱스: 마크다운 표 유지(HTML 끔) + 긴 표·대각선 노이즈 완화 — 매핑 LLM/파서가 MD 표에 맞춰져 있음
    "index": {
        "output_tables_as_HTML": False,
        "adaptive_long_table": True,
        "skip_diagonal_text": True,
    },
    # 에이전트 모드 + 고해상도 OCR (비용·지연 ↑)
    "agentic": {
        "parse_mode": "parse_page_with_agent",
        "high_res_ocr": True,
        "output_tables_as_HTML": True,
        "adaptive_long_table": True,
    },
    # 시각적 복잡 문서(LVM)
    "lvm": {
        "parse_mode": "parse_page_with_lvm",
        "high_res_ocr": True,
        "output_tables_as_HTML": True,
    },
}


# 환경변수 → LlamaParse 필드명 (llama_cloud_services LlamaParse 모델 기준)
_ENV_BOOL_FIELDS = {
    "LLAMA_PARSE_ADAPTIVE_LONG_TABLE": "adaptive_long_table",
    "LLAMA_PARSE_AGGRESSIVE_TABLE_EXTRACTION": "aggressive_table_extraction",
    "LLAMA_PARSE_AUTO_MODE": "auto_mode",
    "LLAMA_PARSE_CONTINUOUS_MODE": "continuous_mode",
    "LLAMA_PARSE_DISABLE_OCR": "disable_ocr",
    "LLAMA_PARSE_DISABLE_IMAGE_EXTRACTION": "disable_image_extraction",
    "LLAMA_PARSE_DO_NOT_UNROLL_COLUMNS": "do_not_unroll_columns",
    "LLAMA_PARSE_EXTRACT_LAYOUT": "extract_layout",
    "LLAMA_PARSE_FAST_MODE": "fast_mode",
    "LLAMA_PARSE_HIGH_RES_OCR": "high_res_ocr",
    "LLAMA_PARSE_HIDE_HEADERS": "hide_headers",
    "LLAMA_PARSE_HIDE_FOOTERS": "hide_footers",
    "LLAMA_PARSE_MERGE_TABLES_ACROSS_PAGES": "merge_tables_across_pages_in_markdown",
    "LLAMA_PARSE_OUTLINED_TABLE_EXTRACTION": "outlined_table_extraction",
    "LLAMA_PARSE_OUTPUT_TABLES_AS_HTML": "output_tables_as_HTML",
    "LLAMA_PARSE_PREMIUM_MODE": "premium_mode",
    "LLAMA_PARSE_PRESERVE_LAYOUT_ACROSS_PAGES": "preserve_layout_alignment_across_pages",
    "LLAMA_PARSE_PRESERVE_VERY_SMALL_TEXT": "preserve_very_small_text",
    "LLAMA_PARSE_SKIP_DIAGONAL_TEXT": "skip_diagonal_text",
    "LLAMA_PARSE_VERBOSE": "verbose",
    "LLAMA_PARSE_SHOW_PROGRESS": "show_progress",
    "LLAMA_PARSE_SPLIT_BY_PAGE": "split_by_page",
}

_ENV_STR_FIELDS = {
    "LLAMA_PARSE_BASE_URL": "base_url",
    "LLAMA_PARSE_LANGUAGE": "language",
    "LLAMA_PARSE_ORGANIZATION_ID": "organization_id",
    "LLAMA_PARSE_PROJECT_ID": "project_id",
    "LLAMA_PARSE_PARSE_MODE": "parse_mode",
    "LLAMA_PARSE_PRESET": "_preset",  # 내부 처리
    "LLAMA_PARSE_TIER": "tier",
    "LLAMA_PARSE_VERSION": "version",
    "LLAMA_PARSE_TARGET_PAGES": "target_pages",
    "LLAMA_PARSE_PAGE_SEPARATOR": "page_separator",
    "LLAMA_PARSE_PAGE_PREFIX": "page_prefix",
    "LLAMA_PARSE_PAGE_SUFFIX": "page_suffix",
    "LLAMA_PARSE_BOUNDING_BOX": "bounding_box",
    "LLAMA_PARSE_VENDOR_MULTIMODAL_MODEL_NAME": "vendor_multimodal_model_name",
    "LLAMA_PARSE_MODEL": "model",
}

_ENV_INT_FIELDS = {
    "LLAMA_PARSE_NUM_WORKERS": "num_workers",
    "LLAMA_PARSE_MAX_TIMEOUT": "max_timeout",
    "LLAMA_PARSE_CHECK_INTERVAL": "check_interval",
}


def _merge_llama_parse_kwargs(api_key: str) -> Dict[str, Any]:
    """LLAMA_PARSE_* 환경변수와 프리셋을 반영한 LlamaParse 생성 인자."""
    kwargs: Dict[str, Any] = {
        "api_key": api_key,
        "result_type": "markdown",
        "verbose": False,
        "show_progress": False,
    }

    raw_preset = _env_strip("LLAMA_PARSE_PRESET")
    if raw_preset is None or raw_preset == "":
        preset_name = "index"
    else:
        preset_name = raw_preset.strip().lower()

    if preset_name not in _LLAMA_PARSE_PRESET_DISABLED:
        if preset_name == "index":
            kwargs.update(_LLAMA_PARSE_PRESETS["index"])
        elif preset_name == "agentic":
            kwargs.update(_LLAMA_PARSE_PRESETS["agentic"])
        elif preset_name == "lvm":
            kwargs.update(_LLAMA_PARSE_PRESETS["lvm"])
        else:
            logger.warning(
                "[LlamaParse] 알 수 없는 LLAMA_PARSE_PRESET=%r — 지원: %s",
                preset_name,
                ", ".join(sorted(_LLAMA_PARSE_PRESETS.keys())),
            )

    for env_name, field in _ENV_BOOL_FIELDS.items():
        val = _env_truthy(env_name)
        if val is not None:
            kwargs[field] = val

    for env_name, field in _ENV_STR_FIELDS.items():
        if field == "_preset":
            continue
        val = _env_strip(env_name)
        if val is not None:
            kwargs[field] = val

    for env_name, field in _ENV_INT_FIELDS.items():
        val = _env_int(env_name)
        if val is not None:
            kwargs[field] = val

    return kwargs


def _safe_kwargs_for_log(kwargs: Dict[str, Any]) -> Dict[str, Any]:
    """로그용: api_key 마스킹."""
    out: Dict[str, Any] = {}
    for k, v in kwargs.items():
        if k == "api_key":
            out[k] = "***" if v else ""
        elif isinstance(v, str) and len(v) > 120:
            out[k] = v[:120] + "…"
        else:
            out[k] = v
    return out


def _filter_kwargs_for_llama_parse(LlamaParse: Any, kwargs: Dict[str, Any]) -> Dict[str, Any]:
    """설치된 SDK에 존재하는 인자만 전달."""
    try:
        sig = inspect.signature(LlamaParse.__init__)
        params = set(sig.parameters.keys()) - {"self"}
    except (TypeError, ValueError):
        return kwargs
    filtered = {k: v for k, v in kwargs.items() if k in params}
    dropped = set(kwargs) - set(filtered)
    if dropped:
        logger.debug("[LlamaParse] 이 SDK 버전에서 무시된 인자: %s", sorted(dropped))
    return filtered


def _parse_single_page_markdown(
    pdf_path: Union[str, Path],
    page_num: int,
    parser_kwargs: Dict[str, Any],
) -> Tuple[int, Optional[str]]:
    """
    단일 페이지를 LlamaParse로 파싱. 스레드당 한 번만 호출되어 Event loop 충돌을 피함.
    Returns:
        (page_num, full_md) 또는 (page_num, None)
    """
    temp_pdf: Optional[Path] = None
    try:
        from llama_parse import LlamaParse
    except ImportError:
        logger.warning("[LlamaParse] llama-parse 미설치")
        return (page_num, None)
    try:
        temp_pdf = extract_pages_to_pdf(pdf_path, [page_num])
        if not temp_pdf or not temp_pdf.exists():
            logger.warning(f"[LlamaParse] 페이지 {page_num} 추출 실패")
            return (page_num, None)
        logger.info(f"[LlamaParse] 페이지 {page_num} 파싱 중...")
        kw = _filter_kwargs_for_llama_parse(LlamaParse, dict(parser_kwargs))
        parser = LlamaParse(**kw)
        documents = parser.load_data(str(temp_pdf))
        if not documents:
            logger.warning(f"[LlamaParse] 페이지 {page_num}: 문서 반환 없음")
            return (page_num, None)
        full_md = "\n\n".join(getattr(d, "text", "") or "" for d in documents)
        logger.info(f"[LlamaParse] 페이지 {page_num}: 완료 ({len(full_md)} chars)")
        return (page_num, full_md)
    except Exception as e:
        logger.warning(f"[LlamaParse] 페이지 {page_num} 파싱 오류: {e}")
        return (page_num, None)
    finally:
        if temp_pdf and temp_pdf.exists():
            try:
                os.unlink(temp_pdf)
            except Exception:
                pass


def extract_index_pages_as_markdown(
    pdf_path: Union[str, Path],
    pages_to_parse: List[int],
) -> Tuple[Dict[int, str], Optional[str]]:
    """
    PDF의 지정된 페이지들을 LlamaParse로 파싱하여 마크다운으로 반환.
    페이지마다 별도 스레드에서 파싱해 Event loop is closed 오류를 방지.
    Returns:
        (page_markdown_dict, error_message). 성공 시 (dict, None), 실패 시 ({}, "확인 가능한 오류 메시지").
    """
    api_key = os.getenv("LLAMA_CLOUD_API_KEY", "").strip()
    if not api_key:
        msg = "LLAMA_CLOUD_API_KEY 환경변수가 없습니다. Llama Cloud API 키를 설정하세요."
        logger.warning("[LlamaParse] %s", msg)
        return ({}, msg)
    if not pages_to_parse:
        msg = "pages_to_parse가 비어 있습니다."
        logger.warning("[LlamaParse] %s", msg)
        return ({}, msg)
    try:
        from llama_parse import LlamaParse  # noqa: F401
    except ImportError:
        msg = "llama-parse 패키지가 설치되지 않았습니다. pip install llama-parse"
        logger.warning("[LlamaParse] %s", msg)
        return ({}, msg)
    parser_kwargs = _merge_llama_parse_kwargs(api_key)
    logger.info(
        "[LlamaParse] 마크다운 추출 시작: %s개 페이지 (페이지별 스레드) 옵션=%s",
        len(pages_to_parse),
        _safe_kwargs_for_log(parser_kwargs),
    )
    result: Dict[int, str] = {}
    pdf_path_str = str(Path(pdf_path))
    max_workers = min(len(pages_to_parse), 8)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(_parse_single_page_markdown, pdf_path_str, p, parser_kwargs): p
            for p in pages_to_parse
        }
        for future in as_completed(futures):
            page_num, full_md = future.result()
            if full_md is not None:
                result[page_num] = full_md
    logger.info(f"[LlamaParse] 마크다운 추출 완료: {len(result)}개 페이지")
    if not result:
        msg = "모든 페이지 파싱 실패. API 키·할당량·네트워크 및 PDF 유효성을 확인하세요."
        logger.warning("[LlamaParse] %s", msg)
        return ({}, msg)
    return (result, None)


# 순수 파싱 API 이름 (에이전트/설계 문서와 통일)
parse_pages_to_markdown = extract_index_pages_as_markdown


def extract_index_pages_as_markdown_from_bytes(
    pdf_bytes: bytes,
    pages_to_parse: List[int],
) -> Tuple[Dict[int, str], Optional[str]]:
    """
    PDF bytes로부터 지정 페이지를 LlamaParse로 파싱해 마크다운 반환.
    임시 파일에 쓰고 extract_index_pages_as_markdown 호출.
    Returns:
        (page_markdown_dict, error_message). 성공 시 (dict, None), 실패 시 ({}, "확인 가능한 오류 메시지").
    """
    if not pdf_bytes or not pages_to_parse:
        msg = "pdf_bytes 또는 pages_to_parse가 비어 있습니다."
        logger.warning("[LlamaParse] %s", msg)
        return ({}, msg)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    try:
        tmp.write(pdf_bytes)
        tmp.close()
        return extract_index_pages_as_markdown(Path(tmp.name), pages_to_parse)
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass


parse_pages_to_markdown_from_bytes = extract_index_pages_as_markdown_from_bytes
