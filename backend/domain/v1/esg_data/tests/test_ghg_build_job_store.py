"""ghg_build_job_store 단위 테스트."""

from __future__ import annotations

from backend.domain.v1.esg_data.hub.services.ghg_build_job_store import GhgBuildJobStore


def test_job_lifecycle() -> None:
    s = GhgBuildJobStore()
    jid = s.create()
    assert s.get(jid)["status"] == "queued"
    s.mark_running(jid)
    assert s.get(jid)["status"] == "running"
    s.complete(jid, {"status": "success", "inserted": 1})
    row = s.get(jid)
    assert row["status"] == "completed"
    assert row["result"]["inserted"] == 1
