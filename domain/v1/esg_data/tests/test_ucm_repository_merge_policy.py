"""UCM 저장소 병합 규칙 단위 테스트."""

from __future__ import annotations

from types import SimpleNamespace

from backend.domain.v1.esg_data.hub.repositories.ucm_repository import (
    _merge_ucm_row_data,
    _pick_anchor_standard,
)


def test_pick_anchor_standard_uses_priority_order() -> None:
    meta = {
        "GRI": {"dp_id": "gri-1"},
        "ESRS": {"dp_id": "esrs-1"},
        "ISSB": {"dp_id": "issb-1"},
    }
    assert _pick_anchor_standard(meta, fallback="GRI") == "ISSB"


def test_merge_ucm_row_data_unions_ids_and_applies_anchor_fields() -> None:
    existing = SimpleNamespace(
        mapped_dp_ids=["gri102-2", "e2-gov-1"],
        applicable_standards=["GRI", "ESRS"],
        primary_standard="GRI",
        standard_metadata={
            "GRI": {
                "dp_id": "gri102-2",
                "column_name_ko": "기존 GRI 이름",
                "column_name_en": "Existing GRI name",
                "description": "existing gri desc",
                "topic": "governance",
                "subtopic": "board",
            }
        },
    )
    incoming = {
        "mapped_dp_ids": ["s2-12", "gri102-2"],
        "applicable_standards": ["ISSB", "GRI"],
        "primary_standard": "ISSB",
        "standard_metadata": {
            "ISSB": {
                "dp_id": "s2-12",
                "column_name_ko": "ISSB 이름",
                "column_name_en": "ISSB name",
                "description": "issb desc",
                "topic": "strategy",
                "subtopic": "risk",
            }
        },
        "column_name_ko": "임시",
        "column_name_en": "temporary",
    }

    merged = _merge_ucm_row_data(existing=existing, incoming=incoming, incoming_payload=incoming)

    assert merged["mapped_dp_ids"] == ["e2-gov-1", "gri102-2", "s2-12"]
    assert merged["applicable_standards"] == ["ESRS", "GRI", "ISSB"]
    assert merged["primary_standard"] == "ISSB"
    assert merged["column_name_ko"] == "ISSB 이름"
    assert merged["column_name_en"] == "ISSB name"
    assert merged["column_description"] == "issb desc"
    assert set(merged["standard_metadata"].keys()) == {"GRI", "ISSB"}
