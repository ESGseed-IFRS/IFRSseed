"""GHG Calculation API 진입점 (기본 포트 9004).

- `/ghg-calculation/*` — Raw Data 조회 등
- `/data-integration/staging/*` — CSV 스테이징 업로드(프론트 `NEXT_PUBLIC_API_BASE`와 동일 포트)

통합 백엔드(ESG 등 전부)는 `backend/api/v1/main.py`(기본 9001).

실행 예:
  python -m backend.api.v1.ghg_calculation.main
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# 프로젝트 루트 (ifrsseedr_re) — .../backend/api/v1/ghg_calculation/main.py 기준 5단계 상위
_project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

try:
    from dotenv import load_dotenv

    load_dotenv(_project_root / ".env")
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.v1.data_integration.routes import router as data_integration_router
from backend.api.v1.ghg_calculation.routes import router as ghg_calculation_router

app = FastAPI(
    title="GHG Calculation API",
    description="활동자료·Raw Data 조회 등 GHG 산정 관련 API",
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

app.include_router(ghg_calculation_router)
app.include_router(data_integration_router)


def run(host: str = "0.0.0.0", port: int | None = None) -> None:
    """ASGI 앱을 uvicorn으로 실행합니다."""
    import uvicorn

    if port is None:
        port = int(
            os.getenv("PORT", os.getenv("GHG_CALCULATION_PORT", "9004")),
        )
    reload = os.getenv("GHG_CALCULATION_RELOAD", os.getenv("BACKEND_API_RELOAD", "")).lower() in (
        "1",
        "true",
        "yes",
    )
    uvicorn.run(app, host=host, port=port, reload=reload)


if __name__ == "__main__":
    run()
