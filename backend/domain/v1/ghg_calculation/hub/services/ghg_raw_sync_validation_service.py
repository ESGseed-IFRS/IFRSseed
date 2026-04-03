"""스테이징 적재 직후 단건 GHG Raw 검증 (스키마·음수·업로드 내 중복)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from backend.domain.v1.ghg_calculation.models.states import GhgAnomalyFindingVo

_SCHEMA_PATH = Path(__file__).resolve().parent.parent / "mappers" / "schema_rules.json"

def _norm_key(k: str) -> str:
    return str(k).lstrip("\ufeff").strip().lower().replace(" ", "_").replace("-", "_")


_SKIP_NEGATIVE_NORM = frozenset(
    _norm_key(k)
    for k in (
        "year",
        "연도",
        "yr",
        "month",
        "월",
        "m",
        "quarter",
        "분기",
        "q",
        "ghg_raw_category",
        "source_system",
    )
)


def _row_norm_map(row: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in row.items():
        nk = _norm_key(str(k))
        if nk not in out:
            out[nk] = v
    return out


def _cell(row: dict[str, Any], *aliases: str) -> Any:
    nm = _row_norm_map(row)
    for a in aliases:
        key = _norm_key(a)
        if key in nm and nm[key] not in (None, ""):
            return nm[key]
    return None


def _non_empty(v: Any) -> bool:
    if v is None:
        return False
    if isinstance(v, str) and not str(v).strip():
        return False
    return True


def _load_schema_rules() -> dict[str, Any]:
    with open(_SCHEMA_PATH, encoding="utf-8") as f:
        return json.load(f)


def _group_or_satisfied_flat(row: dict[str, Any], group: list[str]) -> bool:
    return any(_non_empty(_cell(row, a)) for a in group)


def _schema_passes(row: dict[str, Any], schema: dict[str, Any]) -> bool:
    for group in schema.get("requires_all") or []:
        if not group or not isinstance(group, list):
            return False
        if isinstance(group[0], list):
            return False
        if not _group_or_satisfied_flat(row, group):
            return False
    for group in schema.get("requires_any") or []:
        if not group:
            continue
        if isinstance(group[0], list):
            for sub in group:
                if not sub or not _group_or_satisfied_flat(row, sub):
                    return False
        elif not _group_or_satisfied_flat(row, group):
            return False
    return True


def _row_matches_any_schema(category: str, row: dict[str, Any], rules: dict[str, Any]) -> tuple[bool, str | None]:
    schemas = rules.get(category) or []
    if not schemas:
        return True, None
    for sch in schemas:
        if _schema_passes(row, sch):
            return True, sch.get("schema_type")
    return False, None


def _to_float(v: Any) -> float | None:
    if v in ("", None):
        return None
    s = str(v).replace(",", "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _is_probably_year_key(norm_k: str) -> bool:
    return norm_k in ("year", "연도", "yr")


def _negative_scan(
    row: dict[str, Any],
    csv_row: int,
    *,
    staging_system: str | None,
    staging_id: str | None,
) -> list[GhgAnomalyFindingVo]:
    findings: list[GhgAnomalyFindingVo] = []
    nm = _row_norm_map(row)
    for nk, v in nm.items():
        if nk in _SKIP_NEGATIVE_NORM:
            continue
        if _is_probably_year_key(nk):
            continue
        f = _to_float(v)
        if f is not None and f < 0:
            findings.append(
                GhgAnomalyFindingVo(
                    rule_code="NEGATIVE_VALUE",
                    severity="critical",
                    phase="sync",
                    message=f"음수 값: 컬럼 관련 값 {v!r}",
                    csv_row=csv_row,
                    staging_system=staging_system,
                    staging_id=staging_id,
                    context={"column_key": nk, "value": v},
                )
            )
    return findings


def _dup_key_energy(row: dict[str, Any]) -> str | None:
    fac = _cell(row, "facility", "site_name", "시설명") or ""
    y = _cell(row, "year", "연도", "yr") or ""
    m = _cell(row, "month", "월", "m") or ""
    et = (
        _cell(row, "energy_type", "에너지원", "에너지원명", "re_type", "type")
        or ""
    )
    if not (y and str(y).strip()):
        return None
    return f"e|{str(fac).strip()}|{str(y).strip()}|{str(m).strip()}|{str(et).strip()}"


def _dup_key_waste(row: dict[str, Any]) -> str | None:
    fac = _cell(row, "facility", "site_name", "시설명") or ""
    y = _cell(row, "year", "연도", "yr") or ""
    q = _cell(row, "quarter", "분기", "q") or ""
    mo = _cell(row, "month", "월", "m") or ""
    wt = _cell(row, "waste_type", "폐기물", "waste_name") or ""
    period = f"Q{q}" if _non_empty(q) else str(mo).strip()
    if not (y and str(y).strip()):
        return None
    return f"w|{str(fac).strip()}|{str(y).strip()}|{period}|{str(wt).strip()}"


def _dup_key_pollution(row: dict[str, Any]) -> str | None:
    fac = _cell(row, "facility", "site_name", "시설명") or ""
    y = _cell(row, "year", "연도", "yr") or ""
    q = _cell(row, "quarter", "분기", "q") or ""
    mo = _cell(row, "month", "월", "m") or ""
    pol = _cell(row, "pollutant", "오염물질", "substance_name", "pollutant_name") or ""
    period = f"Q{q}" if _non_empty(q) else str(mo).strip()
    if not (y and str(y).strip()):
        return None
    return f"p|{str(fac).strip()}|{str(y).strip()}|{period}|{str(pol).strip()}"


def _dup_key_chemical(row: dict[str, Any]) -> str | None:
    fac = _cell(row, "facility", "site_name", "시설명") or ""
    y = _cell(row, "year", "연도", "yr") or ""
    q = _cell(row, "quarter", "분기", "q") or ""
    mo = _cell(row, "month", "월", "m") or ""
    cn = _cell(row, "chemical_name", "chem_name", "substance_name", "material_name", "약품명") or ""
    period = f"Q{q}" if _non_empty(q) else str(mo).strip()
    if not (y and str(y).strip()):
        return None
    return f"c|{str(fac).strip()}|{str(y).strip()}|{period}|{str(cn).strip()}"


def _dup_key_provider(row: dict[str, Any]) -> str | None:
    pn = _cell(row, "provider_name", "provider", "supplier", "vendor_name", "supplier_name") or ""
    et = _cell(row, "energy_type", "energy_source", "공급유형", "에너지유형", "type", "category") or ""
    if not (pn or et):
        return None
    return f"ep|{str(pn).strip()}|{str(et).strip()}"


def _dup_key_consignment(row: dict[str, Any]) -> str | None:
    vn = _cell(row, "vendor_name", "vendor", "consignee") or ""
    permit = _cell(row, "permit_no", "permit_number", "license_no", "인허가번호", "허가번호") or ""
    y = _cell(row, "year", "연도", "yr") or ""
    q = _cell(row, "quarter", "분기", "q") or ""
    return f"co|{str(vn).strip()}|{str(permit).strip()}|{str(y).strip()}|{str(q).strip()}"


def _dup_key_for_category(category: str, row: dict[str, Any]) -> str | None:
    if category == "energy":
        return _dup_key_energy(row)
    if category == "waste":
        return _dup_key_waste(row)
    if category == "pollution":
        return _dup_key_pollution(row)
    if category == "chemical":
        return _dup_key_chemical(row)
    if category == "energy-provider":
        return _dup_key_provider(row)
    if category == "consignment":
        return _dup_key_consignment(row)
    return None


class GhgRawSyncValidationService:
    """업로드 `items`에 대한 동기 검증."""

    def __init__(self, rules: dict[str, Any] | None = None):
        self._rules = rules if rules is not None else _load_schema_rules()

    def validate_items(
        self,
        items: list[dict[str, Any]],
        ghg_raw_category: str,
        *,
        staging_system: str | None = None,
        staging_id: str | None = None,
    ) -> list[GhgAnomalyFindingVo]:
        if not items or not ghg_raw_category:
            return []

        findings: list[GhgAnomalyFindingVo] = []
        dup_counts: dict[str, list[int]] = {}

        for i, row in enumerate(items):
            csv_row = i + 2
            ok, _st = _row_matches_any_schema(ghg_raw_category, row, self._rules)
            if not ok:
                findings.append(
                    GhgAnomalyFindingVo(
                        rule_code="SCHEMA_REQUIRED",
                        severity="high",
                        phase="sync",
                        message="schema_rules.json 기준 필수 열 조합을 만족하는 행이 아닙니다.",
                        csv_row=csv_row,
                        staging_system=staging_system,
                        staging_id=staging_id,
                        context={"category": ghg_raw_category},
                    )
                )

            findings.extend(
                _negative_scan(
                    row,
                    csv_row,
                    staging_system=staging_system,
                    staging_id=staging_id,
                )
            )

            dk = _dup_key_for_category(ghg_raw_category, row)
            if dk:
                dup_counts.setdefault(dk, []).append(csv_row)

        for dk, rows in dup_counts.items():
            if len(rows) > 1:
                findings.append(
                    GhgAnomalyFindingVo(
                        rule_code="DUPLICATE_ROW",
                        severity="high",
                        phase="sync",
                        message=f"동일 키(시설·기간·항목)로 업로드 내 {len(rows)}건 중복: 행 {rows}",
                        staging_system=staging_system,
                        staging_id=staging_id,
                        context={"dedupe_key": dk, "csv_rows": rows},
                    )
                )

        return findings
