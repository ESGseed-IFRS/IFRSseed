"""Data Integration API Router

HTTP 요청을 받아 Domain 서비스로 전달합니다.
Domain은 HTTP를 모르고, 순수 비즈니스 로직만 처리합니다.
"""
from fastapi import APIRouter

from .external_company_router import external_company_router
from .sr_agent_router import sr_agent_router
from .staging_router import staging_router
from .subsidiary_router import subsidiary_router


router = APIRouter(prefix="/data-integration", tags=["Data Integration"])

# SR Agent 엔드포인트: /data-integration/sr-agent/...
router.include_router(sr_agent_router)
# 스테이징 수집: /data-integration/staging/ingest
router.include_router(staging_router)
# 외부 기업 스냅샷: /data-integration/external-company/sds-news/ingest
router.include_router(external_company_router)
# 계열사 데이터 제출: /data-integration/subsidiary/submit
router.include_router(subsidiary_router)
