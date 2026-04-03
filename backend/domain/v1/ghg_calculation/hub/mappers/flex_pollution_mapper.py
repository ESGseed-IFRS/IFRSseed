"""오염물질 매퍼 파이프라인 스켈레톤."""
from __future__ import annotations

from typing import Any

from backend.domain.v1.ghg_calculation.models.states import PollutionRowVo

def map_pollution_items(
    items: list[dict[str, Any]],
    year: str,
    import_status: str | None,
) -> list[PollutionRowVo]:
    _ = (items, year, import_status)
    return []
