"""ESG Data API 전용 진입점 — `/esg-data/*` 라우터만 9003 포트에서 실행합니다."""
from __future__ import annotations

import os
import sys
from pathlib import Path

# 프로젝트 루트를 path에 추가 (.env 및 backend 패키지 사용)
_project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

try:
    from dotenv import load_dotenv

    load_dotenv(_project_root / ".env")
except ImportError:
    pass

from fastapi import FastAPI

from backend.api.v1.esg_data.routes import router as esg_data_router

app = FastAPI(
    title="ESG Data API",
    description="UCM 및 ESG Data 전용 API",
    version="0.1.0",
)

app.include_router(esg_data_router)


def run(host: str = "0.0.0.0", port: int = 9003) -> None:
    """ASGI 앱을 실행합니다."""
    import uvicorn

    reload = os.getenv("ESG_DATA_API_RELOAD", "").lower() in ("1", "true", "yes")
    uvicorn.run(app, host=host, port=port, reload=reload)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "9003"))
    run(port=port)
