"""Data Integration API Router

HTTP 요청을 받아 Domain 서비스로 전달합니다.
Domain은 HTTP를 모르고, 순수 비즈니스 로직만 처리합니다.
"""
from fastapi import APIRouter

from .sr_agent_router import sr_agent_router
from .staging_router import staging_router


router = APIRouter(prefix="/data-integration", tags=["Data Integration"])

# SR Agent 엔드포인트: /data-integration/sr-agent/...
router.include_router(sr_agent_router)
# 스테이징 수집: /data-integration/staging/ingest
router.include_router(staging_router)
