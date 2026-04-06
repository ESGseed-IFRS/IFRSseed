"""governance_data_dummy.json → PostgreSQL governance_data 일회 적재.

스키마: governance_data(019) + 공시 텍스트 컬럼(041). JSON의 company_name_ko 는 감사 추적용 필드로 DB 컬럼 없음.

사전 조건: DATABASE_URL, companies 에 JSON 내 company_id 존재, 마이그레이션 041(이사회·위원회 텍스트 컬럼) 적용 권장.

실행 예:
    python backend/scripts/seeds/load_governance_data_dummy.py
    python backend/scripts/seeds/load_governance_data_dummy.py --dry-run
    python backend/scripts/seeds/load_governance_data_dummy.py --truncate
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
from psycopg2.extras import execute_batch

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent.parent

for candidate in (REPO_ROOT / ".env", SCRIPT_DIR.parent.parent / ".env"):
    if candidate.exists():
        load_dotenv(candidate)
        break

logger = logging.getLogger(__name__)

DEFAULT_JSON = SCRIPT_DIR / "governance_data_dummy.json"

INSERT_SQL = """
INSERT INTO governance_data (
    id,
    company_id,
    data_type,
    period_year,
    board_chairman_name,
    ceo_name,
    independent_board_members,
    audit_committee_chairman,
    esg_committee_chairman,
    total_board_members,
    female_board_members,
    board_meetings,
    board_attendance_rate,
    board_compensation,
    corruption_cases,
    corruption_reports,
    legal_sanctions,
    security_incidents,
    data_breaches,
    security_fines,
    status,
    approved_by,
    approved_at,
    final_approved_at
) VALUES (
    %s::uuid,
    %s::uuid,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s,
    %s
)
ON CONFLICT (id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    data_type = EXCLUDED.data_type,
    period_year = EXCLUDED.period_year,
    board_chairman_name = EXCLUDED.board_chairman_name,
    ceo_name = EXCLUDED.ceo_name,
    independent_board_members = EXCLUDED.independent_board_members,
    audit_committee_chairman = EXCLUDED.audit_committee_chairman,
    esg_committee_chairman = EXCLUDED.esg_committee_chairman,
    total_board_members = EXCLUDED.total_board_members,
    female_board_members = EXCLUDED.female_board_members,
    board_meetings = EXCLUDED.board_meetings,
    board_attendance_rate = EXCLUDED.board_attendance_rate,
    board_compensation = EXCLUDED.board_compensation,
    corruption_cases = EXCLUDED.corruption_cases,
    corruption_reports = EXCLUDED.corruption_reports,
    legal_sanctions = EXCLUDED.legal_sanctions,
    security_incidents = EXCLUDED.security_incidents,
    data_breaches = EXCLUDED.data_breaches,
    security_fines = EXCLUDED.security_fines,
    status = EXCLUDED.status,
    approved_by = EXCLUDED.approved_by,
    approved_at = EXCLUDED.approved_at,
    final_approved_at = EXCLUDED.final_approved_at,
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


def row_to_tuple(row: dict[str, Any]) -> tuple[Any, ...]:
    return (
        row["id"],
        row["company_id"],
        row["data_type"],
        int(row["period_year"]),
        row.get("board_chairman_name"),
        row.get("ceo_name"),
        row.get("independent_board_members"),
        row.get("audit_committee_chairman"),
        row.get("esg_committee_chairman"),
        row.get("total_board_members"),
        row.get("female_board_members"),
        row.get("board_meetings"),
        row.get("board_attendance_rate"),
        row.get("board_compensation"),
        row.get("corruption_cases"),
        row.get("corruption_reports"),
        row.get("legal_sanctions"),
        row.get("security_incidents"),
        row.get("data_breaches"),
        row.get("security_fines"),
        row.get("status"),
        row.get("approved_by"),
        row.get("approved_at"),
        row.get("final_approved_at"),
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
    p = argparse.ArgumentParser(description="governance_data_dummy.json DB 적재")
    p.add_argument(
        "--json-path",
        type=Path,
        default=DEFAULT_JSON,
        help=f"기본: {DEFAULT_JSON}",
    )
    p.add_argument("--dry-run", action="store_true", help="JSON 파싱·행 변환만 검증")
    p.add_argument(
        "--truncate",
        action="store_true",
        help="적재 전 governance_data 전체 삭제(TRUNCATE)",
    )
    args = p.parse_args()
    path = args.json_path.resolve()
    rows = load_rows(path)
    batch = [row_to_tuple(r) for r in rows]
    logger.info("JSON %s 행 수: %s", path.name, len(batch))

    if args.dry_run:
        logger.info("dry-run: DB 쓰기 생략")
        return 0

    conn = _connect()
    try:
        with conn:
            with conn.cursor() as cur:
                if args.truncate:
                    cur.execute("TRUNCATE TABLE governance_data")
                    logger.info("TRUNCATE governance_data 완료")
                execute_batch(cur, INSERT_SQL, batch, page_size=100)
        logger.info("적재 완료: %s 행 (ON CONFLICT 시 갱신)", len(batch))
    except psycopg2.Error as e:
        logger.exception("DB 오류: %s", e)
        return 1
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
