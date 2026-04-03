"""스테이징 raw_data.items[] → social_data 지표 추출 (순수 함수)."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

_YEAR_KEYS = (
    "period_year",
    "year",
    "fiscal_year",
    "report_year",
    "accounting_year",
    "yr",
    "base_year",
)


def _norm_key(k: Any) -> str:
    return str(k).strip().lower().replace(" ", "_")


def _as_map(item: Any) -> Mapping[str, Any]:
    if isinstance(item, Mapping):
        return item
    return {}


def extract_year_from_item(item: Any) -> Optional[int]:
    m = _as_map(item)
    for k, v in m.items():
        nk = _norm_key(k)
        if nk in _YEAR_KEYS and v not in (None, ""):
            try:
                return int(float(str(v).strip()))
            except (TypeError, ValueError):
                continue
    return None


def filter_items_for_period(
    items: Sequence[Any],
    period_year: int,
    *,
    include_if_year_missing: bool = True,
) -> List[Mapping[str, Any]]:
    """연도가 맞는 행만 사용. include_if_year_missing이면 연도 컬럼이 없는 행은 대상 연도로 간주."""
    out: List[Mapping[str, Any]] = []
    for raw in items:
        item = _as_map(raw)
        y = extract_year_from_item(item)
        if y is None:
            if include_if_year_missing:
                out.append(item)
        elif y == period_year:
            out.append(item)
    return out


def _pick_number(item: Mapping[str, Any], keys: Iterable[str]) -> Optional[Decimal]:
    for key in keys:
        for ik, iv in item.items():
            if _norm_key(ik) == _norm_key(key) and iv not in (None, ""):
                try:
                    return Decimal(str(iv).replace(",", ""))
                except Exception:
                    continue
    return None


def _pick_int(item: Mapping[str, Any], keys: Iterable[str]) -> Optional[int]:
    n = _pick_number(item, keys)
    if n is None:
        return None
    try:
        return int(n)
    except Exception:
        return None


def _sum_int(items: List[Mapping[str, Any]], keys: Sequence[str]) -> Optional[int]:
    total = 0
    found = False
    for item in items:
        v = _pick_int(item, keys)
        if v is not None:
            found = True
            total += v
    return total if found else None


def _avg_decimal(items: List[Mapping[str, Any]], keys: Sequence[str]) -> Optional[Decimal]:
    vals: List[Decimal] = []
    for item in items:
        v = _pick_number(item, keys)
        if v is not None:
            vals.append(v)
    if not vals:
        return None
    return sum(vals) / Decimal(len(vals))


def _sum_decimal(items: List[Mapping[str, Any]], keys: Sequence[str]) -> Optional[Decimal]:
    total = Decimal(0)
    found = False
    for item in items:
        v = _pick_number(item, keys)
        if v is not None:
            found = True
            total += v
    return total if found else None


def _pick_str_field(item: Mapping[str, Any], keys: Iterable[str]) -> Optional[str]:
    want = {_norm_key(k) for k in keys}
    for ik, iv in item.items():
        if _norm_key(ik) in want and iv not in (None, ""):
            return str(iv).strip()
    return None


def _pick_quarter(item: Mapping[str, Any]) -> Optional[int]:
    for ik, iv in item.items():
        if _norm_key(ik) != "quarter" or iv in (None, ""):
            continue
        try:
            return int(float(str(iv).strip()))
        except (TypeError, ValueError):
            continue
    return None


def filter_items_latest_quarter_mixed(items: List[Mapping[str, Any]]) -> List[Mapping[str, Any]]:
    """행에 quarter가 있으면 해당 연도 스냅샷으로 간주해 최대 분기만 유지. quarter 없는 행은 그대로 둠."""
    if not items:
        return items
    quarters: List[int] = []
    for item in items:
        q = _pick_quarter(item)
        if q is not None:
            quarters.append(q)
    if not quarters:
        return items
    qmax = max(quarters)
    return [it for it in items if _pick_quarter(it) is None or _pick_quarter(it) == qmax]


_HEADCOUNT_KEYS = (
    "headcount",
    "total_headcount",
    "employee_count",
    "employees",
    "emp_count",
)


def _rows_diversity_whole_employees(items: List[Mapping[str, Any]]) -> List[Mapping[str, Any]]:
    """diversity_category에 전체임직원이 포함된 행(국내·해외 등)."""
    rows: List[Mapping[str, Any]] = []
    for item in items:
        cat = _pick_str_field(item, ("diversity_category",))
        if not cat:
            continue
        if "전체임직원" not in cat.replace(" ", ""):
            continue
        rows.append(item)
    return rows


def _average_age_from_diversity_buckets(items: List[Mapping[str, Any]]) -> Optional[Decimal]:
    """
    SDS HR_DIVERSITY_DETAIL: 전체임직원 행의 age_u30·age_30s·age_40s·age_50plus 로 가중 평균 연령.
    구간 중심: 30세미만 25, 30대 35, 40대 45, 50세이상 55.
    """
    rows = _rows_diversity_whole_employees(items)
    if not rows:
        return None
    u30 = t30 = t40 = t50 = 0
    for item in rows:
        u30 += _pick_int(item, ("age_u30", "age_under_30")) or 0
        t30 += _pick_int(item, ("age_30s", "age_30_39")) or 0
        t40 += _pick_int(item, ("age_40s", "age_40_49")) or 0
        t50 += _pick_int(item, ("age_50plus", "age_50_plus", "age_50s")) or 0
    total = u30 + t30 + t40 + t50
    if total <= 0:
        return None
    s = Decimal(u30 * 25 + t30 * 35 + t40 * 45 + t50 * 55)
    return (s / Decimal(total)).quantize(Decimal("0.01"))


def _weighted_turnover_rate_pct(items: List[Mapping[str, Any]]) -> Optional[Decimal]:
    """SDS HR_EMPLOYEE_MOVEMENT: turnover_rate_pct를 headcount_base 가중 평균(최신 분기 스냅샷)."""
    sliced = filter_items_latest_quarter_mixed(items)
    num = Decimal(0)
    den = Decimal(0)
    rates_only: List[Decimal] = []
    for item in sliced:
        rate = _pick_number(item, ("turnover_rate_pct", "turnover_rate", "turnover_pct"))
        if rate is None:
            continue
        base = _pick_number(item, ("headcount_base", "headcount", "employee_base"))
        if base is not None and base > 0:
            num += rate * base
            den += base
        else:
            rates_only.append(rate)
    if den > 0:
        return (num / den).quantize(Decimal("0.01"))
    if rates_only:
        return (sum(rates_only) / Decimal(len(rates_only))).quantize(Decimal("0.01"))
    return None


def _hr_safety_training_hours_sum(items: List[Mapping[str, Any]]) -> Decimal:
    """HR_TRAINING: training_category에 '안전' 포함 시 total_training_hours 합산."""
    total = Decimal(0)
    for item in items:
        cat = _pick_str_field(item, ("training_category", "category"))
        if not cat or "안전" not in cat:
            continue
        v = _pick_number(item, ("total_training_hours", "training_hours", "hours"))
        if v is not None:
            total += v
    return total


def _ehs_safety_training_hours_sum(items: List[Mapping[str, Any]]) -> Decimal:
    """EHS_SAFETY_TRAINING: site_code가 있는 행만 total_hours 합산(HR total_training_hours와 구분)."""
    total = Decimal(0)
    for item in items:
        if _pick_str_field(item, ("site_code",)) is None:
            continue
        v = _pick_number(item, ("total_hours",))
        if v is not None:
            total += v
    return total


def _aggregate_safety_training_hours(items: List[Mapping[str, Any]]) -> Optional[Decimal]:
    """EHS site별 total_hours + HR 안전보건 교육 + 명시 safety_training_hours 컬럼."""
    base = filter_items_latest_quarter_mixed(items)
    total = _ehs_safety_training_hours_sum(base) + _hr_safety_training_hours_sum(base)
    explicit = _sum_decimal(base, ("safety_training_hours", "safety_hours"))
    if explicit is not None:
        total += explicit
    if total == 0:
        return None
    return total


def _workforce_from_diversity_whole(items: List[Mapping[str, Any]]) -> Optional[Dict[str, int]]:
    """SDS HR_DIVERSITY_DETAIL: diversity_category == 전체임직원 인 행만 합산(국내+해외)."""
    rows = _rows_diversity_whole_employees(items)
    if not rows:
        return None
    total = _sum_int(rows, ("total_count", "total_employees", "headcount"))
    male = _sum_int(rows, ("male_count", "male_employees", "m_count"))
    female = _sum_int(rows, ("female_count", "female_employees", "f_count"))
    if total is None and male is None and female is None:
        return None
    out: Dict[str, int] = {}
    if total is not None:
        out["total_employees"] = total
    if male is not None:
        out["male_employees"] = male
    if female is not None:
        out["female_employees"] = female
    return out


def _disabled_from_diversity(items: List[Mapping[str, Any]]) -> Optional[int]:
    for item in items:
        cat = _pick_str_field(item, ("diversity_category",))
        if cat and "장애인" in cat:
            v = _pick_int(item, ("total_count", "disabled_employees", "disabled_count"))
            if v is not None:
                return v
    return None


def _gender_bucket(g: str) -> Optional[str]:
    ng = g.replace(" ", "").lower()
    if ng in ("남성", "남", "남자", "male", "m"):
        return "m"
    if ng in ("여성", "여", "여자", "female", "f"):
        return "f"
    return None


def _workforce_from_headcount_slices(items: List[Mapping[str, Any]]) -> Optional[Dict[str, int]]:
    """SDS HR_EMPLOYEE_HEADCOUNT: 분기 중복 제거 후 headcount 합산, gender 또는 행 단위 male/female 컬럼."""
    hc_rows = [it for it in items if _pick_int(it, _HEADCOUNT_KEYS) is not None]
    if not hc_rows:
        return None
    hc_rows = filter_items_latest_quarter_mixed(hc_rows)
    total, male, female = 0, 0, 0
    found = False
    for item in hc_rows:
        hc = _pick_int(item, _HEADCOUNT_KEYS)
        if hc is None:
            continue
        found = True
        mc = _pick_int(item, ("male_count", "male_employees", "m_count"))
        fc = _pick_int(item, ("female_count", "female_employees", "f_count"))
        if mc is not None or fc is not None:
            total += hc
            male += mc or 0
            female += fc or 0
            continue
        g = _pick_str_field(item, ("gender", "sex"))
        if g:
            b = _gender_bucket(g)
            total += hc
            if b == "m":
                male += hc
            elif b == "f":
                female += hc
            else:
                pass
        else:
            total += hc
    if not found:
        return None
    return {"total_employees": total, "male_employees": male, "female_employees": female}


def aggregate_workforce(items: List[Mapping[str, Any]]) -> Dict[str, Any]:
    if not items:
        return {}
    out: Dict[str, Any] = {}

    div = _workforce_from_diversity_whole(items)
    if div is not None:
        out.update({k: v for k, v in div.items() if v is not None})
    elif not any(_pick_int(it, ("total_employees",)) is not None for it in items):
        hc = _workforce_from_headcount_slices(items)
        if hc is not None:
            out["total_employees"] = hc.get("total_employees")
            if (hc.get("male_employees") or 0) > 0:
                out["male_employees"] = hc["male_employees"]
            if (hc.get("female_employees") or 0) > 0:
                out["female_employees"] = hc["female_employees"]
        if out.get("total_employees") is None:
            out["total_employees"] = _sum_int(
                items,
                ("total_employees", "headcount", "total_headcount", "employee_count", "employees", "emp_count"),
            )
        if out.get("male_employees") is None:
            out["male_employees"] = _sum_int(items, ("male_employees", "male_count", "m_count", "men"))
        if out.get("female_employees") is None:
            out["female_employees"] = _sum_int(items, ("female_employees", "female_count", "f_count", "women"))
    else:
        out["total_employees"] = _sum_int(
            items,
            ("total_employees", "headcount", "total_headcount", "employee_count", "employees", "emp_count"),
        )
        out["male_employees"] = _sum_int(items, ("male_employees", "male_count", "m_count", "men"))
        out["female_employees"] = _sum_int(items, ("female_employees", "female_count", "f_count", "women"))

    dis = _disabled_from_diversity(items)
    if dis is not None:
        out["disabled_employees"] = dis
    else:
        out["disabled_employees"] = _sum_int(
            items, ("disabled_employees", "disability_employees", "disabled_count")
        )

    for_avg = filter_items_latest_quarter_mixed(items)
    out["average_age"] = _avg_decimal(for_avg, ("average_age", "avg_age", "mean_age"))
    if out.get("average_age") is None:
        out["average_age"] = _average_age_from_diversity_buckets(items)

    out["turnover_rate"] = _weighted_turnover_rate_pct(items)
    if out.get("turnover_rate") is None:
        out["turnover_rate"] = _avg_decimal(for_avg, ("turnover_rate", "attrition_rate", "turnover_pct"))
    return out


def aggregate_safety(items: List[Mapping[str, Any]]) -> Dict[str, Any]:
    if not items:
        return {}
    base = filter_items_latest_quarter_mixed(items)
    training = _aggregate_safety_training_hours(items)
    return {
        "total_incidents": _sum_int(
            base,
            (
                "total_incidents",
                "incidents",
                "recordable_incidents",
                "injury_cases",
                "recordable_injury_count",
            ),
        ),
        "fatal_incidents": _sum_int(
            base, ("fatal_incidents", "fatalities", "death_cases", "fatality_count")
        ),
        "lost_time_injury_rate": _avg_decimal(base, ("lost_time_injury_rate", "ltifr", "ltif", "ltir")),
        "total_recordable_injury_rate": _avg_decimal(
            base, ("total_recordable_injury_rate", "trir", "recordable_rate")
        ),
        "safety_training_hours": training,
    }


def _is_srm_esg_criterion_row(item: Mapping[str, Any]) -> bool:
    code = _pick_str_field(item, ("supplier_code",))
    if not code:
        return False
    return bool(_pick_str_field(item, ("criterion_code", "criterion_name")))


def _supplier_purchase_amount_from_rows(rows: List[Mapping[str, Any]]) -> Optional[Decimal]:
    total = Decimal(0)
    found = False
    other_keys = (
        "supplier_purchase_amount",
        "purchase_amount",
        "total_purchase",
        "purchase_krw",
        "spend_amount",
    )
    for item in rows:
        m = _pick_number(item, ("purchase_amount_m",))
        if m is not None:
            found = True
            total += m * Decimal(1_000_000)
            continue
        v = _pick_number(item, other_keys)
        if v is not None:
            found = True
            total += v
    return total if found else None


def aggregate_supply_chain(items: List[Mapping[str, Any]]) -> Dict[str, Any]:
    if not items:
        return {}
    pq = filter_items_latest_quarter_mixed(items)
    esg_rows = [it for it in pq if _is_srm_esg_criterion_row(it)]
    pur_rows = [it for it in pq if not _is_srm_esg_criterion_row(it)]

    total_suppliers: Optional[int] = None
    supplier_purchase_amount: Optional[Decimal] = None
    esg_evaluated_suppliers: Optional[int] = None

    if pur_rows:
        total_suppliers = _sum_int(
            pur_rows, ("total_suppliers", "supplier_count", "suppliers", "num_suppliers")
        )
        supplier_purchase_amount = _supplier_purchase_amount_from_rows(pur_rows)

    if esg_rows:
        codes = {_pick_str_field(it, ("supplier_code",)) for it in esg_rows}
        codes.discard(None)
        audited = {
            _pick_str_field(it, ("supplier_code",))
            for it in esg_rows
            if str(_pick_str_field(it, ("audited_yn",)) or "").strip().upper() == "Y"
        }
        audited.discard(None)
        if audited:
            esg_evaluated_suppliers = len(audited)
        spend_by: Dict[str, Decimal] = {}
        for it in esg_rows:
            sc = _pick_str_field(it, ("supplier_code",))
            sk = _pick_number(it, ("spend_krw",))
            if not sc or sk is None:
                continue
            prev = spend_by.get(sc)
            if prev is None or sk > prev:
                spend_by[sc] = sk
        if total_suppliers is None and codes:
            total_suppliers = len(codes)
        if supplier_purchase_amount is None and spend_by:
            supplier_purchase_amount = sum(spend_by.values(), start=Decimal(0))

    if total_suppliers is None:
        total_suppliers = _sum_int(
            pq, ("total_suppliers", "supplier_count", "suppliers", "num_suppliers")
        )
    if supplier_purchase_amount is None:
        supplier_purchase_amount = _supplier_purchase_amount_from_rows(pq)
        if supplier_purchase_amount is None:
            supplier_purchase_amount = _sum_decimal(
                pq,
                (
                    "supplier_purchase_amount",
                    "purchase_amount",
                    "total_purchase",
                    "purchase_krw",
                    "spend_amount",
                    "spend_krw",
                ),
            )
    if esg_evaluated_suppliers is None:
        esg_evaluated_suppliers = _sum_int(
            pq,
            (
                "esg_evaluated_suppliers",
                "esg_suppliers",
                "evaluated_suppliers",
                "supplier_esg_count",
            ),
        )

    return {
        "total_suppliers": total_suppliers,
        "supplier_purchase_amount": supplier_purchase_amount,
        "esg_evaluated_suppliers": esg_evaluated_suppliers,
    }


def aggregate_community(items: List[Mapping[str, Any]]) -> Dict[str, Any]:
    if not items:
        return {}
    # 연도는 상위에서 필터됨. 사회공헌은 분기별 행 합산이 연간 규모에 맞는 경우가 많아 분기 슬라이스 제한을 두지 않음.
    return {
        "social_contribution_cost": _sum_decimal(
            items,
            (
                "social_contribution_cost",
                "contribution_cost",
                "csr_cost",
                "donation_amount",
                "investment_krw",
                "investment_amount",
                "program_cost_krw",
            ),
        ),
        "volunteer_hours": _sum_decimal(items, ("volunteer_hours", "volunteering_hours", "v_hours")),
    }


def flatten_staging_items(raw_rows: Sequence[Any]) -> List[Mapping[str, Any]]:
    """스테이징 ORM 행들의 raw_data에서 items 평탄화."""
    out: List[Mapping[str, Any]] = []
    for row in raw_rows:
        rd = getattr(row, "raw_data", None) or {}
        if not isinstance(rd, dict):
            continue
        items = rd.get("items") or []
        if isinstance(items, list):
            for it in items:
                out.append(_as_map(it))
    return out
