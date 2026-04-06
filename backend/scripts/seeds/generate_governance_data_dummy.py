"""governance_data 더미 JSON/SQL 생성 (Alembic 019 + 041, companies.json 정합).

data_type: board | compliance | ethics | risk — 각 행은 해당 도메인 컬럼만 채우고 나머지는 NULL.
board 행: SR용 의장·대표·사외이사 수·위원장 성명 (Alembic 041 컬럼).
회사별·연도별 수치는 결정적(재현 가능) 변형을 줍니다.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

COMPANIES_JSON = (
    Path(__file__).resolve().parents[2]
    / "domain/v1/ifrs_agent/data/login/companies.json"
)
OUT_JSON = Path(__file__).with_name("governance_data_dummy.json")
OUT_SQL = Path(__file__).with_name("governance_data_dummy.sql")

DATA_TYPES = ("board", "compliance", "ethics", "risk")
YEARS = (2023, 2024, 2025)

_CHAIRS = ("황성우", "송해영", "김의장", "이독립", "박지배", "최이사")
_CEOS = ("홍길동", "박대표", "최경영", "정대표", "강대표")
_AUDIT_CHAIRS = ("김감사", "정감사", "오감사", "윤감사")
_ESG_CHAIRS = ("이지속", "한ESG", "박지속", "최ESG")


def _seed(company_id: str, year: int, dtype: str) -> int:
    h = hashlib.sha256(f"{company_id}|{year}|{dtype}".encode()).hexdigest()
    return int(h[:8], 16)


def row_uuid(seq: int) -> str:
    return f"e1e0d0c0-b0a1-4002-8003-{seq:012x}"


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def load_companies() -> list[dict]:
    data = json.loads(COMPANIES_JSON.read_text(encoding="utf-8"))
    data.sort(key=lambda c: c["id"])
    return data


def build_row(
    seq: int,
    company_id: str,
    company_name_ko: str,
    year: int,
    dtype: str,
) -> dict:
    s = _seed(company_id, year, dtype)
    base = {
        "id": row_uuid(seq),
        "company_id": company_id,
        "company_name_ko": company_name_ko,
        "data_type": dtype,
        "period_year": year,
        "board_chairman_name": None,
        "ceo_name": None,
        "independent_board_members": None,
        "audit_committee_chairman": None,
        "esg_committee_chairman": None,
        "total_board_members": None,
        "female_board_members": None,
        "board_meetings": None,
        "board_attendance_rate": None,
        "board_compensation": None,
        "corruption_cases": None,
        "corruption_reports": None,
        "legal_sanctions": None,
        "security_incidents": None,
        "data_breaches": None,
        "security_fines": None,
        "status": "final_approved" if s % 3 == 0 else "approved",
        "approved_by": "esg-demo-approver",
        "approved_at": f"{year}-06-30T15:00:00+09:00",
        "final_approved_at": f"{year}-12-20T10:00:00+09:00"
        if s % 3 == 0
        else None,
    }

    if dtype == "board":
        total = 7 + (s % 6)
        female = min(2 + (s % 4), max(total - 1, 0))
        meetings = 4 + (s % 8)
        rate = round(92.0 + (s % 80) / 10, 2)
        comp = float(800_000_000 + (s % 500) * 1_000_000)
        inside_floor = 2 + (s % 3)
        independent = max(1, min(total - 1, total - inside_floor))
        base.update(
            {
                "board_chairman_name": _CHAIRS[s % len(_CHAIRS)],
                "ceo_name": _CEOS[(s // 3) % len(_CEOS)],
                "independent_board_members": independent,
                "audit_committee_chairman": _AUDIT_CHAIRS[(s // 2) % len(_AUDIT_CHAIRS)],
                "esg_committee_chairman": _ESG_CHAIRS[(s // 5) % len(_ESG_CHAIRS)],
                "total_board_members": total,
                "female_board_members": female,
                "board_meetings": meetings,
                "board_attendance_rate": rate,
                "board_compensation": comp,
            }
        )
    elif dtype == "compliance":
        base.update(
            {
                "corruption_cases": s % 3,
                "corruption_reports": 5 + (s % 40),
                "legal_sanctions": s % 2,
            }
        )
    elif dtype == "ethics":
        base.update(
            {
                "corruption_cases": s % 2,
                "corruption_reports": 12 + (s % 55),
                "legal_sanctions": 0,
            }
        )
    else:  # risk
        base.update(
            {
                "security_incidents": s % 5,
                "data_breaches": s % 2,
                "security_fines": float((s % 2) * 500_000),
            }
        )

    return base


def build_rows() -> list[dict]:
    companies = load_companies()
    rows: list[dict] = []
    seq = 0
    for c in companies:
        cid = c["id"]
        name = c["company_name_ko"]
        for year in YEARS:
            for dtype in DATA_TYPES:
                seq += 1
                rows.append(build_row(seq, cid, name, year, dtype))
    return rows


def sql_value(r: dict) -> str:
    def n(v):
        if v is None:
            return "NULL"
        if isinstance(v, float):
            return str(v)
        if isinstance(v, int):
            return str(v)
        raise TypeError(v)

    def ts(v: str | None):
        if v is None:
            return "NULL"
        return f"'{sql_escape(v)}'::timestamptz"

    def txt(v):
        if v is None or v == "":
            return "NULL"
        return f"'{sql_escape(str(v))}'"

    return (
        "(\n"
        f"    '{r['id']}'::uuid,\n"
        f"    '{r['company_id']}'::uuid,\n"
        f"    '{sql_escape(r['data_type'])}',\n"
        f"    {r['period_year']},\n"
        f"    {txt(r.get('board_chairman_name'))},\n"
        f"    {txt(r.get('ceo_name'))},\n"
        f"    {n(r.get('independent_board_members'))},\n"
        f"    {txt(r.get('audit_committee_chairman'))},\n"
        f"    {txt(r.get('esg_committee_chairman'))},\n"
        f"    {n(r['total_board_members'])},\n"
        f"    {n(r['female_board_members'])},\n"
        f"    {n(r['board_meetings'])},\n"
        f"    {n(r['board_attendance_rate']) if r['board_attendance_rate'] is not None else 'NULL'},\n"
        f"    {n(r['board_compensation']) if r['board_compensation'] is not None else 'NULL'},\n"
        f"    {n(r['corruption_cases'])},\n"
        f"    {n(r['corruption_reports'])},\n"
        f"    {n(r['legal_sanctions'])},\n"
        f"    {n(r['security_incidents'])},\n"
        f"    {n(r['data_breaches'])},\n"
        f"    {n(r['security_fines']) if r['security_fines'] is not None else 'NULL'},\n"
        f"    '{sql_escape(r['status'])}',\n"
        f"    '{sql_escape(r['approved_by'])}',\n"
        f"    {ts(r['approved_at'])},\n"
        f"    {ts(r['final_approved_at'])}\n"
        ")"
    )


def write_sql(rows: list[dict]) -> None:
    n = len(rows)
    lines = [
        "-- 더미 데이터: governance_data (Alembic 019 + 041 컬럼)",
        "-- data_type: board | compliance | ethics | risk",
        "-- company_id: data/login/companies.json 전 법인(지주·자회사·계열)",
        '-- 적용: 마이그레이션 041 반영 후 psql "$DATABASE_URL" -f backend/scripts/seeds/governance_data_dummy.sql',
        "-- 재생성: python backend/scripts/seeds/generate_governance_data_dummy.py",
        "",
        "BEGIN;",
        "",
        "INSERT INTO governance_data (",
        "    id,",
        "    company_id,",
        "    data_type,",
        "    period_year,",
        "    board_chairman_name,",
        "    ceo_name,",
        "    independent_board_members,",
        "    audit_committee_chairman,",
        "    esg_committee_chairman,",
        "    total_board_members,",
        "    female_board_members,",
        "    board_meetings,",
        "    board_attendance_rate,",
        "    board_compensation,",
        "    corruption_cases,",
        "    corruption_reports,",
        "    legal_sanctions,",
        "    security_incidents,",
        "    data_breaches,",
        "    security_fines,",
        "    status,",
        "    approved_by,",
        "    approved_at,",
        "    final_approved_at",
        ") VALUES",
    ]
    lines.append(",\n".join(sql_value(r) for r in rows) + ";")
    lines.append("")
    lines.append("COMMIT;")
    OUT_SQL.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    rows = build_rows()
    # JSON: 감사 추적용 company_name_ko 유지 (DB 비컬럼)
    OUT_JSON.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    write_sql(rows)
    print(f"Wrote {len(rows)} rows -> {OUT_JSON.name}, {OUT_SQL.name}")


if __name__ == "__main__":
    main()
