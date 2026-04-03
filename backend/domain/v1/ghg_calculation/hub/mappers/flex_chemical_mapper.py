"""약품 매퍼 파이프라인 스켈레톤."""
from __future__ import annotations

from typing import Any

from backend.domain.v1.ghg_calculation.models.states import ChemicalRowVo

def map_chemical_items(
    items: list[dict[str, Any]],
    year: str,
    import_status: str | None,
) -> list[ChemicalRowVo]:
    _ = (items, year, import_status)
    return []
