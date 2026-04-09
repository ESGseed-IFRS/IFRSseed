"""
validator_node 페이로드 정규화·모드 판별.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict


class ValidationMode(str, Enum):
    CREATE = "create"
    REFINE = "refine"


def normalize_generated_text(raw: Any) -> str:
    if raw is None:
        return ""
    s = str(raw).strip()
    return s


def resolve_validation_mode(payload: Dict[str, Any]) -> ValidationMode:
    if payload.get("mode") == "refine":
        return ValidationMode.REFINE
    fdb = payload.get("fact_data_by_dp")
    if not fdb or not isinstance(fdb, dict) or len(fdb) == 0:
        return ValidationMode.REFINE
    return ValidationMode.CREATE


def is_validator_ui_extended(payload: Dict[str, Any]) -> bool:
    """
    정확도·구조화 피드백 확장 응답(schema_version, accuracy, …) 활성화 여부.
    runtime_config.validator_ui_extended 가 있으면 우선, 없으면 환경변수 VALIDATOR_UI_EXTENDED (기본 on).
    """
    rc = payload.get("runtime_config")
    if isinstance(rc, dict) and "validator_ui_extended" in rc:
        return bool(rc["validator_ui_extended"])
    import os

    v = (os.environ.get("VALIDATOR_UI_EXTENDED") or "1").strip().lower()
    return v not in ("0", "false", "no", "off")
