"""Docling 기반 PDF 표 파싱 (순수 raw만 반환).

독립 모듈: parsing 패키지 내 다른 모듈(common 등)에 의존하지 않음.
표 구조만 추출. sr_report_index 등 도메인 변환은 mapping 레이어에서 수행.

의존성: docling (pip install docling). 표준 라이브러리만 추가 사용 (logging, tempfile, pathlib).
"""
from __future__ import annotations

import gc
import logging
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

try:
    from docling.document_converter import DocumentConverter
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    DOCLING_AVAILABLE = True
except ImportError:
    DOCLING_AVAILABLE = False
    DocumentConverter = None
    PdfPipelineOptions = None

logger = logging.getLogger(__name__)


def parse_pdf_to_tables(
    pdf_path_or_bytes: Union[str, bytes, Path],
    pages: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """
    Docling으로 지정 페이지의 표만 추출. 반환은 raw 표 리스트만 (report_id, sr_report_index 없음).

    Returns:
        성공: {"tables": [{"page", "header", "rows"}, ...], "table_count": N}
        실패: {"error": str, "docling_failed": True, "fallback_pages": [...], "table_count": 0}
    """
    if not DOCLING_AVAILABLE:
        return {
            "error": "Docling 패키지가 설치되지 않았습니다. pip install docling",
            "docling_failed": True,
            "fallback_pages": list(pages) if pages else [],
            "table_count": 0,
        }

    pdf_size = len(pdf_path_or_bytes) if isinstance(pdf_path_or_bytes, bytes) else 0
    input_page_count: Optional[int] = None
    if isinstance(pdf_path_or_bytes, bytes) and pdf_path_or_bytes:
        try:
            from backend.domain.shared.tool.parsing.common import open_pdf

            _vd = open_pdf(pdf_path_or_bytes)
            input_page_count = len(_vd)
            _vd.close()
            logger.info("[Docling] 입력 PDF bytes 사전 검증: %s 페이지", input_page_count)
        except Exception as ve:
            logger.warning(
                "[Docling] 입력 PDF bytes 사전 검증 실패(Docling 시도는 계속): %s",
                ve,
            )
    # Docling에 넘어온 파싱 페이지를 로그에 명시 (디버깅용)
    if pages is not None and len(pages) > 0:
        logger.info("[Docling] 파싱 대상 페이지(인자): %s", pages)
        print(f"[Docling] 파싱 대상 페이지: {pages}", file=sys.stderr, flush=True)
    else:
        logger.info("[Docling] 파싱 대상: 전체 페이지 (pages 미지정)")
        print("[Docling] 파싱 대상: 전체 페이지", file=sys.stderr, flush=True)
    print(f"[Docling:DEBUG] parse_pdf_to_tables 진입 pages={pages} pdf_size={pdf_size} bytes", file=sys.stderr, flush=True)

    # bytes 입력 시: 임시 파일은 convert·표 추출이 모두 끝난 뒤에만 삭제 (finally).
    # WinError 32(파일 사용 중) 완화: 쓰기 핸들을 완전히 닫고 fsync 후 Docling이 열도록 함.
    temp_pdf_path: Optional[str] = None

    try:
        if isinstance(pdf_path_or_bytes, bytes):
            fd, temp_pdf_path = tempfile.mkstemp(suffix=".pdf")
            os.close(fd)
            try:
                with open(temp_pdf_path, "wb") as f:
                    f.write(pdf_path_or_bytes)
                    f.flush()
                    try:
                        os.fsync(f.fileno())
                    except OSError:
                        pass
            except Exception:
                try:
                    if temp_pdf_path and os.path.exists(temp_pdf_path):
                        os.unlink(temp_pdf_path)
                except OSError:
                    pass
                raise
            pdf_path = Path(temp_pdf_path)
            if input_page_count is None:
                try:
                    from backend.domain.shared.tool.parsing.common import open_pdf

                    _vd2 = open_pdf(str(pdf_path))
                    input_page_count = len(_vd2)
                    _vd2.close()
                    logger.info("[Docling] 임시 파일 PDF 페이지 수: %s", input_page_count)
                except Exception as e:
                    logger.warning("[Docling] 임시 파일 페이지 수 확인 실패: %s", e)
            print(f"[Docling:DEBUG] 임시 파일 작성·닫기 완료 {pdf_path}", file=sys.stderr, flush=True)
        else:
            pdf_path = Path(pdf_path_or_bytes)
            try:
                from backend.domain.shared.tool.parsing.common import open_pdf

                _vd3 = open_pdf(str(pdf_path))
                input_page_count = len(_vd3)
                _vd3.close()
            except Exception:
                pass

        # 인덱스 페이지만 추출된 소형 PDF(1..N 전체가 대상)인 경우 page_range를 쓰지 않는다.
        # Docling이 page_range와 실제 페이지 수를 맞추지 못해 "Inconsistent number of pages" / invalid 가 나는 경우가 있음.
        page_range_arg: Optional[tuple] = None
        pages_filter: Optional[set] = set(pages) if pages else None
        skip_page_range_for_whole_slice = False
        if pages and input_page_count is not None:
            expected = list(range(1, input_page_count + 1))
            if sorted(set(pages)) == expected:
                skip_page_range_for_whole_slice = True
                logger.info(
                    "[Docling] 요청 페이지가 문서 전체(1~%s)와 동일 → page_range 생략하고 전체 변환",
                    input_page_count,
                )
        if pages and not skip_page_range_for_whole_slice:
            start_p = min(pages)
            end_p = max(pages)
            page_range_arg = (start_p, end_p)
            logger.info("[Docling] Docling에 넘긴 파싱 페이지: %s → page_range=(%s, %s)", pages, start_p, end_p)
            print(f"[Docling:DEBUG] page_range=({start_p}, {end_p}) converter.convert() 호출 직전", file=sys.stderr, flush=True)
        else:
            if not pages:
                logger.info("[Docling] pages 없음 → 전체 PDF 변환")
            print("[Docling:DEBUG] 전체 PDF 변환 converter.convert() 호출 직전", file=sys.stderr, flush=True)

        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_table_structure = True
        converter = DocumentConverter()
        pdf_path_for_docling = str(pdf_path.resolve())

        from docling.datamodel.base_models import ConversionStatus

        def _doc_from_result(result: Any) -> Any:
            if result is None:
                return None
            if hasattr(result, "status") and result.status == ConversionStatus.FAILURE:
                logger.warning("[Docling] Conversion FAILURE 상태")
                return None
            return getattr(result, "document", None)

        doc = None
        result: Any = None
        used_full_pdf_fallback = False
        try:
            if page_range_arg is not None:
                try:
                    result = converter.convert(
                        pdf_path_for_docling, page_range=page_range_arg
                    )
                    doc = _doc_from_result(result)
                except TypeError:
                    logger.warning("[Docling] page_range 미지원 → 전체 PDF 변환 시도")
                    result = converter.convert(pdf_path_for_docling)
                    doc = _doc_from_result(result)
                    used_full_pdf_fallback = True
                except Exception as e:
                    logger.warning(
                        "[Docling] page_range 변환 예외 → 전체 PDF 변환 재시도: %s",
                        e,
                    )
                    try:
                        result = converter.convert(pdf_path_for_docling)
                        doc = _doc_from_result(result)
                        used_full_pdf_fallback = True
                    except Exception as e2:
                        logger.warning("[Docling] 전체 PDF 변환도 실패: %s", e2)
                        doc = None
                # page_range는 성공했으나 FAILURE이거나 doc 없음 → 전체 변환 1회 (이미 전체 시도했으면 생략)
                if (
                    doc is None
                    and page_range_arg is not None
                    and not used_full_pdf_fallback
                ):
                    logger.warning(
                        "[Docling] page_range 결과 없음 → 전체 PDF 변환 재시도",
                    )
                    try:
                        result = converter.convert(pdf_path_for_docling)
                        doc = _doc_from_result(result)
                        used_full_pdf_fallback = True
                    except Exception as e:
                        logger.warning("[Docling] 전체 PDF 변환 재시도 실패: %s", e)
                        doc = None
            else:
                result = converter.convert(pdf_path_for_docling)
                doc = _doc_from_result(result)

            print("[Docling:DEBUG] converter.convert() 반환됨", file=sys.stderr, flush=True)

        except Exception as e:
            logger.warning("[Docling] 변환 중 예외 발생: %s", e)
            doc = None

        tables: List[Dict[str, Any]] = []
        table_count = 0

        tables_iter: List[Any] = []
        if doc and hasattr(doc, "tables") and doc.tables:
            tables_iter = list(doc.tables)
            if pages_filter and used_full_pdf_fallback:
                before_n = len(tables_iter)
                filtered: List[Any] = []
                for table in tables_iter:
                    tp = _get_table_page_number(table)
                    if tp is None or tp in pages_filter:
                        filtered.append(table)
                tables_iter = filtered
                logger.info(
                    "[Docling] 전체 변환 폴백 후 페이지 필터 %s 적용: 표 %s→%s개",
                    sorted(pages_filter) if pages_filter else [],
                    before_n,
                    len(tables_iter),
                )

        num_tables = len(tables_iter)
        print(f"[Docling:DEBUG] doc.tables 개수={num_tables} 표 추출 루프 진입", file=sys.stderr, flush=True)

        if tables_iter:
            for table in tables_iter:
                table_count += 1
                header, data_rows = _table_to_header_and_rows(table, doc)
                table_page = _get_table_page_number(table)

                if not header or not data_rows:
                    logger.info(f"[Docling] 표 #{table_count}: 스킵 (header 또는 data_rows 없음)")
                    continue

                tables.append({
                    "page": table_page,
                    "header": header,
                    "rows": data_rows,
                })
                logger.info(f"[Docling] 표 #{table_count}: page={table_page}, {len(header)}컬럼, {len(data_rows)}행")

        # Docling/Document 객체가 임시 PDF를 잡고 있을 수 있음 → WinError 32 완화
        try:
            del tables_iter
        except Exception:
            pass
        try:
            del doc
        except Exception:
            pass
        try:
            del result
        except Exception:
            pass
        try:
            del converter
        except Exception:
            pass
        gc.collect()

        if not tables:
            logger.warning("[Docling] 변환 결과 없음 → fallback_pages 반환 (LlamaParse 폴백용)")
            return {
                "error": "Docling 변환 결과가 없습니다.",
                "docling_failed": True,
                "fallback_pages": list(pages) if pages else [],
                "table_count": 0,
            }

        logger.info(f"[Docling] 추출 완료: {len(tables)}개 표 (raw)")
        print(f"[Docling:DEBUG] parse_pdf_to_tables 완료 tables={len(tables)}", file=sys.stderr, flush=True)
        return {
            "tables": tables,
            "table_count": table_count,
        }

    except Exception as e:
        logger.error(f"[Docling] 파싱 오류: {e}")
        return {
            "error": str(e),
            "docling_failed": True,
            "fallback_pages": list(pages) if pages else [],
            "table_count": 0,
        }
    finally:
        if temp_pdf_path and os.path.isfile(temp_pdf_path):
            last_err: Optional[OSError] = None
            for attempt in range(8):
                try:
                    os.unlink(temp_pdf_path)
                    logger.debug("[Docling] 임시 PDF 삭제: %s", temp_pdf_path)
                    last_err = None
                    break
                except OSError as e:
                    last_err = e
                    if attempt < 7:
                        time.sleep(0.08 * (attempt + 1))
            if last_err is not None:
                logger.warning(
                    "[Docling] 임시 PDF 삭제 실패(다른 프로세스가 잠금 중일 수 있음): %s — %s",
                    temp_pdf_path,
                    last_err,
                )
        gc.collect()


def _table_to_header_and_rows(table: Any, doc: Any) -> tuple:
    """Docling table에서 (header, data_rows) 2D 리스트 반환."""
    try:
        if hasattr(table, "export_to_dataframe") and doc is not None:
            df = table.export_to_dataframe(doc=doc)
            if df is not None and not df.empty:
                header = [str(c).strip() for c in df.columns]
                data_rows = [[str(cell).strip() for cell in row] for row in df.values.tolist()]
                return header, data_rows
    except Exception:
        pass

    try:
        data = getattr(table, "data", None)
        if data is not None and hasattr(data, "__len__") and len(data) >= 2:
            header = [str(cell).strip() for cell in data[0]]
            data_rows = [[str(cell).strip() for cell in row] for row in data[1:]]
            return header, data_rows
    except (TypeError, AttributeError):
        pass

    try:
        data = getattr(table, "data", None)
        if data is not None:
            rows = list(data)
            if len(rows) >= 2:
                header = [str(cell).strip() for cell in list(rows[0])]
                data_rows = [[str(cell).strip() for cell in row] for row in rows[1:]]
                return header, data_rows
    except (TypeError, AttributeError, ValueError):
        pass

    return [], []


def _get_table_page_number(table: Any) -> Optional[int]:
    """Docling 표의 prov에서 해당 표가 나온 페이지 번호 반환."""
    try:
        if hasattr(table, "prov") and table.prov and len(table.prov) > 0:
            return getattr(table.prov[0], "page_no", None)
    except Exception:
        pass
    return None
