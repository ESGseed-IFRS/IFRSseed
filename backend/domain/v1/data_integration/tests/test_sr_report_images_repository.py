"""sr_report_images_repository 단위 테스트 (DB 없이 분기만)."""
from __future__ import annotations

from backend.domain.v1.data_integration.hub.repositories.sr_report_images_repository import (
    count_sr_report_images_rows,
)


def test_count_sr_report_images_rows_invalid_uuid() -> None:
    assert count_sr_report_images_rows("not-a-uuid") is None
