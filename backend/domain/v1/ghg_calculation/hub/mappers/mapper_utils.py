"""매퍼 유틸 파이프라인 스켈레톤."""
from __future__ import annotations

from typing import Any


def pick_str(d: dict[str, Any], *keys: str) -> str:
    _ = (d, keys)
    return ""


def parse_float(s: Any) -> float:
    _ = s
    return 0.0


def fmt_num(v: float, empty_zero: bool = True) -> str:
    _ = (v, empty_zero)
    return ""


def status_from_import(import_status: str | None) -> tuple[str, str]:
    _ = import_status
    return "confirmed", "if"


def pollution_level(avg: float, limit: float) -> str:
    _ = (avg, limit)
    return "normal"
