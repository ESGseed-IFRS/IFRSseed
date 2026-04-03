"""에너지 조달업체 매퍼 파이프라인 스켈레톤."""
from __future__ import annotations

from typing import Any

from backend.domain.v1.ghg_calculation.models.states import EnergyProviderRowVo

def map_energy_provider_items(
    items: list[dict[str, Any]],
    year: str,
    import_status: str | None,
) -> list[EnergyProviderRowVo]:
    _ = (items, year, import_status)
    return []
