"""GHG Calculation API 라우터."""
from __future__ import annotations

from fastapi import APIRouter

from .raw_data_router import raw_data_router
from .scope_calculation_router import scope_calculation_router

router = APIRouter(prefix="/ghg-calculation", tags=["GHG Calculation"])
router.include_router(raw_data_router)
router.include_router(scope_calculation_router)
