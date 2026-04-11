"""backend/scripts/seeds/ucm.json → PostgreSQL unified_column_mappings 일회 적재.

스키마: 009(unified_column_mappings), 010(primary_standard·mapped_dp_ids 확장 등),
020(standard_metadata JSONB). JSON에만 있는 extraction_keywords 는 DB 전용 컬럼이 없으므로
standard_metadata JSON 안에 extraction_keywords 키로 합쳐 저장한다.

사전 조건: DATABASE_URL, Alembic 마이그레이션 적용됨. primary_rulebook_id 는 JSON에 없어 NULL.

실행 예:
    python backend/scripts/seeds/load_ucm_from_json.py
    python backend/scripts/seeds/load_ucm_from_json.py --dry-run
    python backend/scripts/seeds/load_ucm_from_json.py --json-path path/to/other.json
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import Json, execute_batch

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent.parent

for candidate in (REPO_ROOT / ".env", SCRIPT_DIR.parent.parent / ".env"):
    if candidate.exists():
        load_dotenv(candidate)
        break

logger = logging.getLogger(__name__)

DEFAULT_JSON = SCRIPT_DIR / "ucm.json"

INSERT_SQL = """
INSERT INTO unified_column_mappings (
    unified_column_id,
    column_name_ko,
    column_name_en,
    column_description,
    column_category,
    column_topic,
    column_subtopic,
    mapped_dp_ids,
    column_type,
    unit,
    validation_rules,
    disclosure_requirement,
    reporting_frequency,
    primary_standard,
    applicable_standards,
    mapping_confidence,
    mapping_notes,
    standard_metadata,
    is_active
) VALUES (
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s::unified_column_type_enum,
    %s,
    %s,
    %s::disclosure_requirement_enum,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    TRUE
)
ON CONFLICT (unified_column_id) DO UPDATE SET
    column_name_ko = EXCLUDED.column_name_ko,
    column_name_en = EXCLUDED.column_name_en,
    column_description = EXCLUDED.column_description,
    column_category = EXCLUDED.column_category,
    column_topic = EXCLUDED.column_topic,
    column_subtopic = EXCLUDED.column_subtopic,
    mapped_dp_ids = EXCLUDED.mapped_dp_ids,
    column_type = EXCLUDED.column_type,
    unit = EXCLUDED.unit,
    validation_rules = EXCLUDED.validation_rules,
    disclosure_requirement = EXCLUDED.disclosure_requirement,
    reporting_frequency = EXCLUDED.reporting_frequency,
    primary_standard = EXCLUDED.primary_standard,
    applicable_standards = EXCLUDED.applicable_standards,
    mapping_confidence = EXCLUDED.mapping_confidence,
    mapping_notes = EXCLUDED.mapping_notes,
    standard_metadata = EXCLUDED.standard_metadata,
    is_active = EXCLUDED.is_active,
    updated_at = now()
"""


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(message)s",
        datefmt="%H:%M:%S",
    )


def _connect():
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise SystemExit("DATABASE_URL 이 비어 있습니다. .env 또는 환경 변수를 설정하세요.")
    return psycopg2.connect(url)


def _build_standard_metadata(row: dict[str, Any]) -> dict[str, Any] | None:
    base = row.get("standard_metadata")
    if base is not None and not isinstance(base, dict):
        raise ValueError(f"{row.get('unified_column_id')}: standard_metadata 는 객체여야 합니다.")
    merged: dict[str, Any] = dict(base) if base else {}
    kw = row.get("extraction_keywords")
    if kw is not None:
        if not isinstance(kw, list):
            raise ValueError(f"{row.get('unified_column_id')}: extraction_keywords 는 배열이어야 합니다.")
        merged["extraction_keywords"] = kw
    return merged if merged else None


def row_to_tuple(row: dict[str, Any]) -> tuple[Any, ...]:
    uid = row.get("unified_column_id")
    if not uid:
        raise ValueError("unified_column_id 가 없습니다.")

    required = (
        "column_name_ko",
        "column_name_en",
        "column_category",
        "mapped_dp_ids",
        "column_type",
    )
    for k in required:
        if k not in row or row[k] is None:
            raise ValueError(f"{uid}: 필수 필드 누락 또는 null: {k}")

    mdp = row["mapped_dp_ids"]
    if not isinstance(mdp, list) or not mdp:
        raise ValueError(f"{uid}: mapped_dp_ids 는 비어 있지 않은 문자열 배열이어야 합니다.")

    vr = row.get("validation_rules")
    if vr is not None and not isinstance(vr, dict):
        raise ValueError(f"{uid}: validation_rules 는 객체여야 합니다.")

    meta = _build_standard_metadata(row)

    return (
        uid,
        row["column_name_ko"],
        row["column_name_en"],
        row.get("column_description"),
        row["column_category"],
        row.get("column_topic"),
        row.get("column_subtopic"),
        mdp,
        row["column_type"],
        row.get("unit"),
        Json(vr if vr is not None else {}),
        row.get("disclosure_requirement"),
        row.get("reporting_frequency"),
        row.get("primary_standard"),
        row.get("applicable_standards"),
        row.get("mapping_confidence"),
        row.get("mapping_notes"),
        Json(meta) if meta is not None else None,
    )


def load_rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"JSON 없음: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("JSON 최상위는 객체 배열이어야 합니다.")
    return data


def main() -> int:
    _configure_logging()
    p = argparse.ArgumentParser(description="ucm.json → unified_column_mappings 적재")
    p.add_argument(
        "--json-path",
        type=Path,
        default=DEFAULT_JSON,
        help=f"기본: {DEFAULT_JSON}",
    )
    p.add_argument("--dry-run", action="store_true", help="JSON 파싱·행 변환만 검증")
    args = p.parse_args()
    path = args.json_path.resolve()
    rows = load_rows(path)
    try:
        batch = [row_to_tuple(r) for r in rows]
    except ValueError as e:
        logger.error("%s", e)
        return 1
    logger.info("JSON %s 행 수: %s", path.name, len(batch))

    if args.dry_run:
        logger.info("dry-run: DB 쓰기 생략")
        return 0

    conn = _connect()
    try:
        with conn:
            with conn.cursor() as cur:
                execute_batch(cur, INSERT_SQL, batch, page_size=50)
        logger.info("적재 완료: %s 행 (ON CONFLICT 시 갱신, unified_embedding·created_at 유지)", len(batch))
    except psycopg2.Error:
        logger.exception("DB 오류")
        return 1
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
