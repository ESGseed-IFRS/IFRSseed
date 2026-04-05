"""
오케스트레이터 → 에이전트로 넘기는 런타임 설정 일부.

전체 Settings를 직렬화하지 않고, 에이전트가 필요로 하는 필드만 담는다.
API 키는 포함될 수 있으므로 로깅 시 payload 전체를 찍지 않는다.
"""
from __future__ import annotations

from typing import Any, Dict, TypedDict

from backend.core.config.settings import Settings


class AgentRuntimeConfig(TypedDict, total=False):
    """에이전트 `payload["runtime_config"]`에 실리는 설정 조각."""

    embedding_model: str
    max_retries: int
    rag_model: str
    supervisor_model: str
    c_rag_llm_model: str
    dp_rag_gemini_model: str
    openai_api_key: str
    gemini_api_key: str


def agent_runtime_config_from_settings(settings: Settings) -> AgentRuntimeConfig:
    """Orchestrator가 `self.settings`에서 에이전트용 슬라이스를 만든다."""
    return {
        "embedding_model": settings.embedding_model,
        "max_retries": settings.max_retries,
        "rag_model": settings.rag_model,
        "supervisor_model": settings.supervisor_model,
        "c_rag_llm_model": settings.c_rag_llm_model,
        "dp_rag_gemini_model": settings.dp_rag_gemini_model,
        "openai_api_key": settings.openai_api_key,
        "gemini_api_key": settings.gemini_api_key,
    }


def with_runtime_config(payload: Dict[str, Any], runtime: AgentRuntimeConfig) -> Dict[str, Any]:
    """에이전트 호출용 페이로드에 `runtime_config`를 붙인 새 dict를 반환한다."""
    return {**payload, "runtime_config": dict(runtime)}
