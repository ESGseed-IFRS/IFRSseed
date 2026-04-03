"""스키마 감지 파이프라인 스켈레톤."""
from __future__ import annotations

from typing import Any

def detect_schema_type(category: str, items: list[dict[str, Any]]) -> tuple[str | None, set[str]]:
    _ = (category, items)
    return None, set()
