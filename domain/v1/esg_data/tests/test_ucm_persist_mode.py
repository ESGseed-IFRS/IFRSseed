"""정책 파이프라인 persist_mode 응답 필드."""

from __future__ import annotations

from unittest.mock import MagicMock

from backend.domain.v1.esg_data.hub.orchestrator import ucm_orchestrator as mod
from backend.domain.v1.esg_data.hub.orchestrator.ucm_orchestrator import UCMOrchestrator


def test_policy_pipeline_includes_persist_mode_empty_batch(monkeypatch) -> None:
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.limit.return_value.all.return_value = []
    mock_db.close = MagicMock()
    monkeypatch.setattr(mod, "get_session", lambda: mock_db)

    orch = UCMOrchestrator()
    out = orch.run_ucm_policy_pipeline(
        "GRI",
        "ESRS",
        batch_size=1,
        dry_run=True,
        persist_mode="batch_end",
    )
    assert out.get("persist_mode") == "batch_end"
    assert out.get("pipeline") == "ucm_policy_v1"
    stats = out.get("stats", {})
    assert "upsert_merge_update" in stats


def test_nearest_pipeline_includes_persist_mode_empty_batch(monkeypatch) -> None:
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.limit.return_value.all.return_value = []
    mock_db.close = MagicMock()
    monkeypatch.setattr(mod, "get_session", lambda: mock_db)

    orch = UCMOrchestrator()
    out = orch.run_ucm_nearest_pipeline(batch_size=1, dry_run=True, persist_mode="batch_end")
    assert out.get("persist_mode") == "batch_end"
    assert out.get("pipeline") == "ucm_nearest_v1"
    stats = out.get("stats", {})
    assert "upsert_merge_update" in stats
