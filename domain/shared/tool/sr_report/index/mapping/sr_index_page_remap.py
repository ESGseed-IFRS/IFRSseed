"""인덱스 전용 소형 PDF 페이지 번호 → 원본 PDF 페이지 번호 변환.

SRIndexAgent가 인덱스 페이지만 잘라 파서에 넘길 때, 표 셀에 상대(1~N) 또는 절대(원본) 번호가
섞여 올 수 있어 병합 후 원본 좌표로 통일한다.
"""
from __future__ import annotations

from typing import List, Optional


def remap_slice_pages_to_original(
    page_numbers: List[int],
    chosen_pages: List[int],
    total_pages: Optional[int] = None,
) -> List[int]:
    """소 PDF에서 파싱된 ``page_numbers`` 를 원본 PDF 페이지로 맞춘다.

    - 셀에 **소 PDF 기준 1~N** 이 적힌 경우: ``chosen_pages[p-1]`` 로 변환.
    - 셀에 **원본 절대 페이지**가 적힌 경우: ``chosen_pages`` 에 포함되면 그대로 유지.
    - **인덱스 표**는 Page 열이 인덱스 페이지(143)가 아니라 **본문 페이지**(31, 78 등)를 가리키는 경우가 많음.
      이때 슬라이스가 한 페이지뿐이면 숫자가 ``chosen_pages`` 에 없어 전부 버려지므로,
      ``total_pages`` 가 주어지면 ``1 <= p <= total_pages`` 인 값은 **그대로 유지**한다.
    """
    if not chosen_pages:
        return [p for p in page_numbers if isinstance(p, int)]
    n = len(chosen_pages)
    page_set = set(chosen_pages)
    out: List[int] = []
    for p in page_numbers:
        if not isinstance(p, int):
            continue
        if p in page_set:
            out.append(p)
        elif 1 <= p <= n:
            out.append(chosen_pages[p - 1])
        elif (
            total_pages is not None
            and total_pages >= 1
            and 1 <= p <= total_pages
        ):
            out.append(p)
    return sorted(set(out))


def remap_index_page_number_to_original(
    index_page_number: Optional[int],
    chosen_pages: List[int],
    total_pages: Optional[int] = None,
) -> Optional[int]:
    """``index_page_number``(소 PDF 기준 또는 절대)를 원본 PDF 페이지로 맞춘다."""
    if index_page_number is None or not chosen_pages:
        return index_page_number
    if not isinstance(index_page_number, int):
        return index_page_number
    page_set = set(chosen_pages)
    if index_page_number in page_set:
        return index_page_number
    n = len(chosen_pages)
    if 1 <= index_page_number <= n:
        return chosen_pages[index_page_number - 1]
    if (
        total_pages is not None
        and total_pages >= 1
        and 1 <= index_page_number <= total_pages
    ):
        return index_page_number
    return index_page_number
