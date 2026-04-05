"""Backend API 진입점 — backend/api 라우터를 한 포트에서 실행합니다."""
from __future__ import annotations

import os
import sys
from pathlib import Path

# 프로젝트 루트를 path에 추가 (.env 및 backend 패키지 사용)
_project_root = Path(__file__).resolve().parent.parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

try:
    from dotenv import load_dotenv
    load_dotenv(_project_root / ".env")
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --- Data Integration (개별 라우터 → /data-integration/...)
from backend.api.v1.data_integration.external_company_router import external_company_router
from backend.api.v1.data_integration.sr_agent_router import sr_agent_router
from backend.api.v1.data_integration.staging_router import staging_router

# --- ESG Data (개별 라우터 → /esg-data/...)
from backend.api.v1.esg_data.environmental_router import environmental_router
from backend.api.v1.esg_data.ghg_router import ghg_router
from backend.api.v1.esg_data.social_router import social_router
from backend.api.v1.esg_data.ucm_router import ucm_router

# --- GHG Calculation (개별 라우터 → /ghg-calculation/...)
from backend.api.v1.ghg_calculation.raw_data_router import raw_data_router
from backend.api.v1.ghg_calculation.scope_calculation_router import scope_calculation_router

# --- IFRS Agent (개별 라우터 → /ifrs-agent/...)
from backend.api.v1.ifrs_agent.router import router as ifrs_agent_router

app = FastAPI(
    title="Backend API",
    description="통합 Backend API (Data Integration 등)",
    version="0.1.0",
)

_cors = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data Integration: sr-agent, staging, external-company
app.include_router(sr_agent_router, prefix="/data-integration")
app.include_router(staging_router, prefix="/data-integration")
app.include_router(external_company_router, prefix="/data-integration")

# ESG Data: ucm, social, ghg, environmental (기존 routes.py 등록 순서와 동일)
app.include_router(ucm_router, prefix="/esg-data")
app.include_router(social_router, prefix="/esg-data")
app.include_router(ghg_router, prefix="/esg-data")
app.include_router(environmental_router, prefix="/esg-data")

# GHG Calculation: raw-data, scope
app.include_router(raw_data_router, prefix="/ghg-calculation")
app.include_router(scope_calculation_router, prefix="/ghg-calculation")

# IFRS Agent: 워크플로우
app.include_router(ifrs_agent_router)


def run(host: str = "0.0.0.0", port: int = 9001) -> None:
    """ASGI 앱을 실행합니다."""
    import uvicorn
    reload = os.getenv("BACKEND_API_RELOAD", "").lower() in ("1", "true", "yes")
    uvicorn.run(app, host=host, port=port, reload=reload)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "9001"))
    run(port=port)
