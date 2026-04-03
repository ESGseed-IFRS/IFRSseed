"""삼성SDS 언론보도 수집 — 도메인 고정 상수.

URL·User-Agent·앵커 UUID 등 환경 기반 값은 `backend.core.config.settings.get_settings()` 에서 읽습니다.
"""

from __future__ import annotations

from backend.core.config.settings import get_settings

SECTION_B_THUMBS = "bThumbs"
SECTION_S_THUMBS = "sThumbs"

CAT_PRESS_KO = "보도자료"
CAT_MEDIA_KO = "언론이 본 삼성SDS"

SOURCE_TYPE_PRESS = "press"
SOURCE_TYPE_NEWS = "news"

PARSER_VERSION = "sds_news_v1"

# 오류 메시지·문서용 환경변수 이름 (값은 Settings.sds_anchor_company_id)
ENV_ANCHOR_COMPANY_ID = "SDS_ANCHOR_COMPANY_ID"


def get_sds_news_list_url() -> str:
    """목록 페이지 URL (`SDS_NEWS_LIST_URL`)."""
    return get_settings().sds_news_list_url


def get_sds_news_txt_path() -> str:
    """뉴스 JSON 경로 (`SDS_NEWS_TXT_PATH`, LIST와 동일 오리진 기준)."""
    return get_settings().sds_news_txt_path


def get_sds_news_user_agent() -> str:
    """HTTP User-Agent (`SDS_NEWS_USER_AGENT`)."""
    return get_settings().sds_news_user_agent
