"""IFRS Agent API 진입점 (기본 포트 9005).

- `/ifrs-agent/*` — IFRS 지속가능성 보고서 생성 워크플로우 API

통합 백엔드(ESG 등 전부)는 `backend/api/v1/main.py`(기본 9001).

실행 예:
  python -m backend.api.v1.ifrs_agent.main
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# 프로젝트 루트 (ifrsseedr_re) — .../backend/api/v1/ifrs_agent/main.py 기준 5단계 상위
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

from backend.api.v1.ifrs_agent.router import router as ifrs_agent_router

app = FastAPI(
    title="IFRS Agent API",
    description="IFRS 지속가능성 보고서 생성 워크플로우 API",
    version="0.1.0",
)

_cors = os.getenv("FRONT_URL", "http://localhost:3000,http://127.0.0.1:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_private_network=True,
)

app.include_router(ifrs_agent_router)


def run(host: str = "0.0.0.0", port: int | None = None) -> None:
    """ASGI 앱을 uvicorn으로 실행합니다."""
    import uvicorn

    if port is None:
        port = int(
            os.getenv("PORT", os.getenv("IFRS_AGENT_PORT", "9005")),
        )
    reload = os.getenv("IFRS_AGENT_RELOAD", os.getenv("BACKEND_API_RELOAD", "")).lower() in (
        "1",
        "true",
        "yes",
    )
    uvicorn.run(app, host=host, port=port, reload=reload)


if __name__ == "__main__":
    run()
