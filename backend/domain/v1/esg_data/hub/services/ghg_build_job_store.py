"""GHG 스테이징 빌드 비동기 작업 상태 (프로세스 메모리, 단일 인스턴스용)."""

from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class GhgBuildJobStore:
    """job_id → {status, created_at, started_at, finished_at, result, error}."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: Dict[str, Dict[str, Any]] = {}

    def create(self) -> str:
        job_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        with self._lock:
            self._jobs[job_id] = {
                "status": "queued",
                "created_at": now.isoformat(),
                "started_at": None,
                "finished_at": None,
                "result": None,
                "error": None,
            }
        return job_id

    def mark_running(self, job_id: str) -> None:
        with self._lock:
            j = self._jobs.get(job_id)
            if not j:
                return
            j["status"] = "running"
            j["started_at"] = datetime.now(timezone.utc).isoformat()

    def complete(self, job_id: str, result: Dict[str, Any]) -> None:
        with self._lock:
            j = self._jobs.get(job_id)
            if not j:
                return
            j["status"] = "completed"
            j["finished_at"] = datetime.now(timezone.utc).isoformat()
            j["result"] = result
            j["error"] = None

    def fail(self, job_id: str, message: str) -> None:
        with self._lock:
            j = self._jobs.get(job_id)
            if not j:
                return
            j["status"] = "failed"
            j["finished_at"] = datetime.now(timezone.utc).isoformat()
            j["error"] = message
            j["result"] = None

    def get(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            j = self._jobs.get(job_id)
            return dict(j) if j else None


ghg_build_job_store = GhgBuildJobStore()
