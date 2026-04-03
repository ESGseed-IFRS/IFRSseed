"""매퍼 선택 파이프라인 스켈레톤."""
from __future__ import annotations

from typing import Any, Callable

MapperFn = Callable[[list[dict[str, Any]], str, str | None], list[Any]]


def resolve_mapper(
    category: str,
    file_key: str,
    schema_type: str | None,
) -> MapperFn | None:
    _ = (category, file_key, schema_type)
    return None
