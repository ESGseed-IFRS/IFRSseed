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
