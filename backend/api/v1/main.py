"""Backend API 진입점 — backend/api 라우터를 한 포트에서 실행합니다."""
from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
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

# --- Shared/Auth
from backend.api.shared.auth.router import router as auth_router

# --- Data Integration
from backend.api.v1.data_integration.routes import router as data_integration_router

# --- ESG Data
from backend.api.v1.esg_data.routes import router as esg_data_router

# --- GHG Calculation
from backend.api.v1.ghg_calculation.routes import router as ghg_calculation_router

# --- IFRS Agent
from backend.api.v1.ifrs_agent.router import router as ifrs_agent_router


def _configure_ifrs_agent_logging() -> None:
    """
    Uvicorn 기본 루트가 WARNING이면 ifrs_agent.* 의 INFO(예: SUBSIDIARY_QUERY_TRACE)가 콘솔에 안 보인다.
    환경변수 IFRS_AGENT_LOG_LEVEL=INFO|DEBUG|WARNING 으로 조절 (기본 INFO).
    """
    raw = (os.getenv("IFRS_AGENT_LOG_LEVEL") or "INFO").upper()
    level = getattr(logging, raw, logging.INFO)
    logging.getLogger("ifrs_agent").setLevel(level)


@asynccontextmanager
async def _app_lifespan(app: FastAPI):
    _configure_ifrs_agent_logging()
    yield


app = FastAPI(
    title="Backend API",
    description="통합 Backend API (Data Integration 등)",
    version="0.1.0",
    lifespan=_app_lifespan,
)

_cors = os.getenv("FRONT_URL", "http://localhost:3000,http://127.0.0.1:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Chrome PNA: localhost↔localhost 등 사전 요청에 Access-Control-Request-Private-Network 가 오면 허용
    allow_private_network=True,
)

# Shared/Auth
app.include_router(auth_router)

# Data Integration / ESG Data / GHG Calculation / IFRS Agent
app.include_router(data_integration_router)
app.include_router(esg_data_router)
app.include_router(ghg_calculation_router)
app.include_router(ifrs_agent_router)


def run(host: str = "0.0.0.0", port: int = 9001) -> None:
    """ASGI 앱을 실행합니다."""
    import uvicorn
    reload = os.getenv("BACKEND_API_RELOAD", "").lower() in ("1", "true", "yes")
    uvicorn.run(app, host=host, port=port, reload=reload)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "9001"))
    run(port=port)
