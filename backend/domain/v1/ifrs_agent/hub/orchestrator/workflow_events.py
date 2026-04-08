"""
워크플로우 진행 이벤트 — SSE 등에 전달할 단계 로그용 Sink.

See docs/STREAMING_WORKFLOW_EVENTS.md
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, Protocol


class WorkflowEventSink(Protocol):
    async def emit(self, event: Dict[str, Any]) -> None: ...


class NoOpWorkflowEventSink:
    """테스트·비스트림 경로에서 사용."""

    async def emit(self, event: Dict[str, Any]) -> None:
        return None


class QueueWorkflowEventSink:
    """asyncio.Queue로 이벤트를 모아 SSE 제너레이터가 소비한다."""

    def __init__(self, q: asyncio.Queue, workflow_id: str) -> None:
        self._q = q
        self._workflow_id = workflow_id

    async def emit(self, event: Dict[str, Any]) -> None:
        env = {
            "v": 1,
            "workflow_id": self._workflow_id,
            "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            **event,
        }
        await self._q.put(env)
