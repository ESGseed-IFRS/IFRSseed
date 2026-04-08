from __future__ import annotations

import os
import sys
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 프로젝트 루트를 path에 추가 (.env 및 backend 패키지 사용)
# .../backend/api/shared/auth/main.py -> 프로젝트 루트는 parents[4]
_project_root = Path(__file__).resolve().parents[4]
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

try:
    from dotenv import load_dotenv

    load_dotenv(_project_root / ".env")
except ImportError:
    pass

from backend.api.shared.auth.router import router as auth_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)


app = FastAPI(
    title="Auth API",
    description="공통 인증 API",
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

app.include_router(auth_router)


def run(host: str = "0.0.0.0", port: int = 9006) -> None:
    """Auth API를 독립 실행합니다."""
    import uvicorn

    reload = os.getenv("BACKEND_AUTH_RELOAD", "").lower() in ("1", "true", "yes")
    uvicorn.run(app, host=host, port=port, reload=reload)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "9006"))
    run(port=port)
