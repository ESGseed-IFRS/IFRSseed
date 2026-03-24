"""추출된 이미지 메타 → sr_report_images 배치 저장용 dict 리스트."""
from __future__ import annotations

from typing import Any, Dict, List


def map_extracted_images_to_sr_report_rows(
    report_id: str,
    images_by_page: Dict[int, List[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    """
    extract_report_images 의 images_by_page 를 DB 저장용 행으로 변환합니다.

    Args:
        report_id: historical_sr_reports.id (문자열)
        images_by_page: { page_number: [ { path, width, height, size_bytes, image_index }, ... ] }

    Returns:
        save_sr_report_images_batch 에 넘길 dict 리스트.
    """
    _ = report_id  # 행 본문에는 포함하지 않음 (저장 시 FK로 전달)
    rows: List[Dict[str, Any]] = []
    for page_number in sorted(images_by_page.keys()):
        for item in images_by_page[page_number]:
            rows.append({
                "page_number": int(page_number),
                "image_index": int(item.get("image_index", 0)),
                "image_file_path": str(item["path"]),
                "image_file_size": item.get("size_bytes"),
                "image_width": item.get("width"),
                "image_height": item.get("height"),
                "image_type": item.get("image_type"),
                "caption_text": item.get("caption_text"),
                "caption_confidence": item.get("caption_confidence"),
                "extracted_data": item.get("extracted_data"),
            })
    return rows
