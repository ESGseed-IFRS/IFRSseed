"""`GhgActivityData` → JSON 직렬화 (수치는 number, UUID·날짜는 문자열)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict

from backend.domain.v1.esg_data.models.bases.ghg_activity_data import GhgActivityData


def json_encode_value(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, int):
        return val
    return val


def ghg_activity_row_to_json_dict(
    row: GhgActivityData,
    *,
    omit_nulls: bool = False,
) -> Dict[str, Any]:
    """ORM 행 → JSON 친화 dict (컬럼 전체)."""
    out: Dict[str, Any] = {}
    for col in GhgActivityData.__table__.columns:
        val = getattr(row, col.name)
        if omit_nulls and val is None:
            continue
        out[col.name] = json_encode_value(val)
    return out
