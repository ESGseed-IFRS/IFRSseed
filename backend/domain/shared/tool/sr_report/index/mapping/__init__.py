"""인덱스 매핑 유틸."""

from .sr_index_mapping import map_tables_to_sr_report_index
from .sr_index_page_remap import (
    remap_index_page_number_to_original,
    remap_slice_pages_to_original,
)

__all__ = [
    "map_tables_to_sr_report_index",
    "remap_index_page_number_to_original",
    "remap_slice_pages_to_original",
]
