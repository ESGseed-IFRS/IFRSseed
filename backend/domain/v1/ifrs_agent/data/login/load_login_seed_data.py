"""온프레미스 로그인 데모 JSON을 PostgreSQL에 적재합니다.

대상 파일 (이 스크립트와 같은 디렉터리):
  - companies.json  → companies
  - company_info.json → company_info
  - user.json       → users

DB 스키마는 Alembic 마이그레이션(019~024) 기준 열만 채웁니다. JSON에만 있고 아직
마이그레이션에 없는 컬럼은 자동으로 생략됩니다. companies 테이블에 `name`만 있고
`company_name_ko`가 없으면 JSON의 company_name_ko를 name에 넣습니다.

users.created_by 는 다른 사용자를 참조하므로, 1차 upsert 시 NULL로 넣은 뒤
2차 UPDATE로 복원합니다.

DATABASE_URL 은 docker-compose.yaml 과 같은 폴더에 있는 .env 에서만 읽습니다.

사용법:
  cd .../ifrs_agent/data/login
  python load_login_seed_data.py
  python load_login_seed_data.py --dry-run
  python load_login_seed_data.py --dry-run --database-url postgresql://...  # DB 반영 후 실제 적재 컬럼 미리보기
  python load_login_seed_data.py --data-dir "C:/path/to/other/login"
"""

from __future__ import annotations

import argparse
import json
import os
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Tuple

from dotenv import load_dotenv
from sqlalchemy import JSON, MetaData, create_engine, inspect as sa_inspect, text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.schema import Column, Table
from sqlalchemy.sql.sqltypes import Boolean, Date, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID, insert as pg_insert

_DEFAULT_LOGIN_DIR = Path(__file__).resolve().parent


_COMPOSE_NAMES = ("docker-compose.yaml", "docker-compose.yml")


def _project_root() -> Path:
    """docker-compose.yaml / docker-compose.yml 이 있는 프로젝트 루트."""
    here = Path(__file__).resolve()
    for p in here.parents:
        if any((p / name).is_file() for name in _COMPOSE_NAMES):
            return p
    for p in here.parents:
        if (p / ".git").is_dir():
            return p
    raise RuntimeError(
        "프로젝트 루트를 찾을 수 없습니다. "
        "상위 경로 어딘가에 docker-compose.yaml 또는 docker-compose.yml 이 있어야 합니다."
    )


def _load_dotenv_from_project_root() -> None:
    load_dotenv(_project_root() / ".env")


def _parse_ts(raw: str) -> datetime:
    s = raw.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)


def _coerce_value(column: Column, raw: Any) -> Any:
    if raw is None:
        return None
    t = column.type
    if isinstance(t, PG_UUID):
        return uuid.UUID(str(raw)) if not isinstance(raw, uuid.UUID) else raw
    if isinstance(t, (JSONB, JSON)):
        if isinstance(raw, (dict, list)):
            return raw
        if isinstance(raw, str):
            return json.loads(raw)
        return raw
    if isinstance(t, Boolean):
        return bool(raw)
    if isinstance(t, Integer):
        return int(raw)
    if isinstance(t, DateTime):
        if isinstance(raw, datetime):
            return raw
        return _parse_ts(str(raw))
    if isinstance(t, Date):
        if isinstance(raw, date):
            return raw
        if isinstance(raw, datetime):
            return raw.date()
        s = str(raw)
        return date.fromisoformat(s[:10])
    if isinstance(t, (String, Text)):
        return str(raw)
    if "UUID" in type(t).__name__:
        return uuid.UUID(str(raw)) if not isinstance(raw, uuid.UUID) else raw
    if "TIMESTAMP" in type(t).__name__ or "DateTime" in type(t).__name__:
        if isinstance(raw, datetime):
            return raw
        return _parse_ts(str(raw))
    if type(t).__name__ == "DATE" or (hasattr(t, "python_type") and t.python_type is date):
        s = str(raw)
        return date.fromisoformat(s[:10])
    return raw


def _build_row(
    record: Mapping[str, Any],
    table: Table,
    *,
    company_name_fallback: bool = False,
) -> Dict[str, Any]:
    colmap = {c.name: c for c in table.columns}
    out: Dict[str, Any] = {}
    for key, val in record.items():
        if key in colmap:
            out[key] = _coerce_value(colmap[key], val)
    if company_name_fallback and "name" in colmap and "name" not in out:
        ko = record.get("company_name_ko")
        if ko is not None:
            out["name"] = _coerce_value(colmap["name"], ko)
    return out


def _reflect_table(engine: Engine, name: str) -> Table:
    md = MetaData()
    md.reflect(bind=engine, only=[name], resolve_fks=False)
    if name not in md.tables:
        raise RuntimeError(f"테이블 '{name}' 이(가) 없습니다. Alembic 마이그레이션을 먼저 적용하세요.")
    return md.tables[name]


def _upsert(
    conn: Connection,
    table: Table,
    row: Dict[str, Any],
    *,
    exclude_from_update: frozenset[str] = frozenset(),
) -> None:
    if "id" not in row:
        raise ValueError(f"{table.name} 행에 id가 필요합니다.")
    ins = pg_insert(table).values(**row)
    update_cols = {k: ins.excluded[k] for k in row if k != "id" and k not in exclude_from_update}
    stmt = ins.on_conflict_do_update(index_elements=[table.c.id], set_=update_cols)
    conn.execute(stmt)


def load_json(path: Path) -> List[Dict[str, Any]]:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError(f"{path} 는 JSON 배열이어야 합니다.")
    return data


def _sort_companies_for_fk(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """parent_company_id 가 NULL인 행을 먼저 두고, 나머지는 원래 순서 유지."""

    no_parent = [r for r in rows if r.get("parent_company_id") in (None, "")]
    with_parent = [r for r in rows if r.get("parent_company_id") not in (None, "")]
    return no_parent + with_parent


def run(
    engine: Optional[Engine],
    data_dir: Path,
    *,
    dry_run: bool,
) -> None:
    paths = {
        "companies": data_dir / "companies.json",
        "company_info": data_dir / "company_info.json",
        "users": data_dir / "user.json",
    }
    for label, p in paths.items():
        if not p.is_file():
            raise FileNotFoundError(f"{label}: 파일 없음 — {p}")

    companies_rows = load_json(paths["companies"])
    company_info_rows = load_json(paths["company_info"])
    users_rows = load_json(paths["users"])

    if dry_run and engine is None:
        n_cb = sum(1 for r in users_rows if r.get("created_by"))
        print(
            f"[dry-run, DB 미연결] companies={len(companies_rows)}, "
            f"company_info={len(company_info_rows)}, users={len(users_rows)}, "
            f"users.created_by 비NULL={n_cb}건"
        )
        if companies_rows:
            print(f"  companies JSON 키(샘플): {sorted(companies_rows[0].keys())}")
        if company_info_rows:
            print(f"  company_info JSON 키(샘플): {sorted(company_info_rows[0].keys())}")
        if users_rows:
            print(f"  users JSON 키(샘플): {sorted(users_rows[0].keys())}")
        return

    assert engine is not None
    if engine.dialect.name != "postgresql":
        raise SystemExit("이 스크립트는 PostgreSQL DATABASE_URL 만 지원합니다.")

    insp = sa_inspect(engine)
    for tbl in ("companies", "company_info", "users"):
        if not insp.has_table(tbl):
            raise RuntimeError(f"테이블 '{tbl}' 없음. 마이그레이션을 적용한 뒤 다시 실행하세요.")

    companies_t = _reflect_table(engine, "companies")
    company_info_t = _reflect_table(engine, "company_info")
    users_t = _reflect_table(engine, "users")

    prepared_companies = [
        _build_row(r, companies_t, company_name_fallback=True) for r in _sort_companies_for_fk(companies_rows)
    ]
    prepared_info = [_build_row(r, company_info_t) for r in company_info_rows]

    created_by_updates: List[Tuple[str, Optional[str]]] = []
    prepared_users: List[Dict[str, Any]] = []
    ucols = {c.name for c in users_t.columns}
    json_created_by_n = sum(1 for r in users_rows if r.get("created_by"))
    for r in users_rows:
        row = _build_row(r, users_t)
        raw_cb = r.get("created_by")
        if "created_by" in ucols and raw_cb:
            created_by_updates.append((str(r["id"]), str(raw_cb)))
            row["created_by"] = None
        prepared_users.append(row)

    if dry_run:
        cb_note = (
            f"created_by DB 복원 예정={len(created_by_updates)}건"
            if "created_by" in ucols
            else f"created_by 컬럼 없음(JSON에 값 있음={json_created_by_n}건은 스킵)"
        )
        print(
            f"[dry-run] companies={len(prepared_companies)}, "
            f"company_info={len(prepared_info)}, users={len(prepared_users)}, {cb_note}"
        )
        if prepared_companies:
            print(f"  companies 적재 컬럼(샘플): {sorted(prepared_companies[0].keys())}")
        if prepared_info:
            print(f"  company_info 적재 컬럼(샘플): {sorted(prepared_info[0].keys())}")
        if prepared_users:
            print(f"  users 적재 컬럼(샘플): {sorted(prepared_users[0].keys())}")
        return

    with engine.begin() as conn:
        for row in prepared_companies:
            _upsert(conn, companies_t, row)
        for row in prepared_info:
            _upsert(conn, company_info_t, row)
        for row in prepared_users:
            _upsert(conn, users_t, row)
        for uid, cb in created_by_updates:
            conn.execute(
                text("UPDATE users SET created_by = CAST(:cb AS uuid) WHERE id = CAST(:uid AS uuid)"),
                {"uid": uid, "cb": cb},
            )

    cb_done = f", created_by 복원 {len(created_by_updates)}건" if created_by_updates else ""
    print(
        f"적재 완료: companies {len(prepared_companies)}건, "
        f"company_info {len(prepared_info)}건, users {len(prepared_users)}건{cb_done}"
    )


def main() -> None:
    _load_dotenv_from_project_root()
    parser = argparse.ArgumentParser(description="로그인 시드 JSON → DB 적재")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=_DEFAULT_LOGIN_DIR,
        help=f"JSON 디렉터리 (기본: 스크립트와 동일 폴더 — {_DEFAULT_LOGIN_DIR})",
    )
    parser.add_argument("--dry-run", action="store_true", help="DB 쓰기 없이 건수·컬럼만 출력")
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL"),
        help="기본: docker-compose.yaml 과 같은 폴더의 .env 의 DATABASE_URL(스크립트 시작 시 로드)",
    )
    args = parser.parse_args()
    engine: Optional[Engine] = None
    if args.database_url:
        engine = create_engine(args.database_url)
    elif not args.dry_run:
        raise SystemExit("DATABASE_URL 이 없습니다. 환경 변수 또는 --database-url 로 지정하세요.")
    run(engine, args.data_dir.resolve(), dry_run=args.dry_run)


if __name__ == "__main__":
    main()
