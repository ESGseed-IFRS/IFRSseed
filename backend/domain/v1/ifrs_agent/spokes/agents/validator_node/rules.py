"""
validator_node 규칙 기반 검증 (무 LLM).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple

from .payload import ValidationMode


@dataclass
class RuleResult:
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


def rule_non_empty_text(text: str) -> List[str]:
    if not text or not text.strip():
        return [
            "생성 문단이 비어 있습니다. 제공된 데이터에 맞는 본문을 작성하세요.",
        ]
    return []


def rule_min_length(text: str, min_chars: int) -> List[str]:
    if len(text.strip()) < min_chars:
        return [
            f"문단이 너무 짧습니다(최소 약 {min_chars}자 권장). 맥락·수치·근거를 보강해 다시 작성하세요.",
        ]
    return []


def rule_fact_dp_warnings(fact_data_by_dp: Dict[str, Any]) -> List[str]:
    """DP 조회 실패는 본문 오류가 아니라 경고로만 전달 (재시도 남발 방지)."""
    out: List[str] = []
    if not isinstance(fact_data_by_dp, dict):
        return out
    for dp_id, fact in fact_data_by_dp.items():
        if not isinstance(fact, dict):
            continue
        err = fact.get("error")
        if err:
            out.append(
                f"DP {dp_id} 데이터 조회에 실패했습니다. 해당 수치를 인용하지 마세요. ({err})"
            )
    return out


def _label_for_fact(dp_id: str, fact: Dict[str, Any]) -> str:
    meta = fact.get("dp_metadata") or {}
    if isinstance(meta, dict):
        name = meta.get("name_ko") or meta.get("name")
        if name:
            return str(name)
    return str(dp_id)


def _numeric_value(fact: Dict[str, Any]) -> Tuple[bool, float]:
    v = fact.get("value")
    if v is None:
        return False, 0.0
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return True, float(v)
    if isinstance(v, str):
        s = v.replace(",", "").strip()
        try:
            return True, float(s)
        except ValueError:
            return False, 0.0
    return False, 0.0


def _formats_for_number(n: float) -> List[str]:
    forms: List[str] = []
    if abs(n - round(n)) < 1e-9:
        i = int(round(n))
        forms.append(str(i))
        if i >= 1000:
            forms.append(f"{i:,}")
    else:
        s = f"{n:.6f}".rstrip("0").rstrip(".")
        forms.append(s)
    return list(dict.fromkeys(forms))


def _any_format_in_text(text: str, forms: List[str]) -> bool:
    for f in forms:
        if f and f in text:
            return True
    norm = re.sub(r"[\s,]", "", text)
    for f in forms:
        f2 = re.sub(r",", "", f)
        if f2 and f2 in norm:
            return True
    return False


def rule_numeric_consistency_light(
    text: str,
    fact_data: Dict[str, Any],
    fact_data_by_dp: Dict[str, Any],
    min_text_for_check: int = 120,
) -> List[str]:
    """
    정량 value가 팩트에 있는데 본문 어디에도 등장하지 않으면 경고 1건(오탐 완화: 전부 누락일 때만).
    """
    errs: List[str] = []
    if len(text.strip()) < min_text_for_check:
        return errs

    candidates: List[Tuple[str, float]] = []
    for bucket in (fact_data,):
        if isinstance(bucket, dict) and bucket.get("error"):
            continue
        if isinstance(bucket, dict):
            ok, num = _numeric_value(bucket)
            if ok:
                candidates.append((_label_for_fact("representative", bucket), num))

    if isinstance(fact_data_by_dp, dict):
        for dp_id, fact in fact_data_by_dp.items():
            if not isinstance(fact, dict) or fact.get("error"):
                continue
            ok, num = _numeric_value(fact)
            if ok:
                candidates.append((_label_for_fact(str(dp_id), fact), num))

    if len(candidates) < 1:
        return errs

    found_any = False
    missing_labels: List[str] = []
    for label, num in candidates:
        forms = _formats_for_number(num)
        if _any_format_in_text(text, forms):
            found_any = True
        else:
            missing_labels.append(f"{label}={num}")

    if not found_any and missing_labels:
        snippet = ", ".join(missing_labels[:5])
        suffix = " 등" if len(missing_labels) > 5 else ""
        errs.append(
            f"제공된 데이터의 수치({snippet}{suffix})가 본문에 반영되지 않았습니다. "
            "지표 수치를 본문에 명시하세요."
        )
    return errs


def run_rules(
    text: str,
    fact_data: Dict[str, Any],
    fact_data_by_dp: Dict[str, Any],
    mode: ValidationMode,
) -> RuleResult:
    out = RuleResult()
    min_chars = 80 if mode == ValidationMode.CREATE else 40

    out.errors.extend(rule_non_empty_text(text))
    if out.errors:
        return out

    out.errors.extend(rule_min_length(text, min_chars=min_chars))
    if out.errors:
        return out

    out.warnings.extend(rule_fact_dp_warnings(fact_data_by_dp or {}))

    # Refine은 짧은 수정이 많아 수치 전체 미반영 검사는 생략
    if mode == ValidationMode.CREATE:
        out.errors.extend(
            rule_numeric_consistency_light(
                text,
                fact_data if isinstance(fact_data, dict) else {},
                fact_data_by_dp if isinstance(fact_data_by_dp, dict) else {},
            )
        )

    return out


def summarize_facts_for_llm(
    fact_data: Dict[str, Any],
    fact_data_by_dp: Dict[str, Any],
    max_repr_chars: int = 2000,
) -> Tuple[str, str]:
    """(facts_summary lines, representative_fact string)"""
    lines: List[str] = []
    if isinstance(fact_data_by_dp, dict):
        for dp_id, fact in fact_data_by_dp.items():
            if not isinstance(fact, dict):
                continue
            meta = fact.get("dp_metadata") or {}
            name_ko = meta.get("name_ko", "") if isinstance(meta, dict) else ""
            val = fact.get("value")
            unit = fact.get("unit") or ""
            err = fact.get("error")
            err_s = f" error={err}" if err else ""
            lines.append(
                f"- dp_id={dp_id} name_ko={name_ko!r} value={val!r} unit={unit!r}{err_s}"
            )
    facts_summary = "\n".join(lines) if lines else "(없음)"
    try:
        repr_s = json.dumps(fact_data, ensure_ascii=False, default=str)
    except TypeError:
        repr_s = str(fact_data)
    if len(repr_s) > max_repr_chars:
        repr_s = repr_s[:max_repr_chars] + "…(truncated)"
    return facts_summary, repr_s
