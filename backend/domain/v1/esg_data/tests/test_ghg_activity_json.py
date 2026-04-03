"""ghg_activity_json 직렬화."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from backend.domain.v1.esg_data.hub.services.ghg_activity_json import json_encode_value


def test_json_encode_decimal_float() -> None:
    assert json_encode_value(Decimal("785.1")) == 785.1


def test_json_encode_uuid_str() -> None:
    u = uuid.uuid4()
    assert json_encode_value(u) == str(u)


def test_json_encode_date_iso() -> None:
    assert json_encode_value(date(2024, 1, 5)) == "2024-01-05"
