"""ESG Data API Router."""

from fastapi import APIRouter

from .environmental_router import environmental_router
from .ghg_router import ghg_router
from .social_router import social_router
from .ucm_router import ucm_router


router = APIRouter(prefix="/esg-data", tags=["ESG Data"])
router.include_router(ucm_router)
router.include_router(social_router)
router.include_router(ghg_router)
router.include_router(environmental_router)

