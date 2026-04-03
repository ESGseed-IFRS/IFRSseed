"""DP 매핑 보조: 리프 판별, 검증규칙 평탄화, 문단/조항 축 토큰 추출."""

from __future__ import annotations

import re
from typing import Any, Iterable

# ESRS 절·항, IRO, MDR, IFRS Sx 등 공시 축 후보
_PARA_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bE\d+-\d+(?:-\d+)?(?:-[a-z][a-z0-9-]*)?\b", re.I),
    re.compile(r"\bIRO-\d+\b", re.I),
    re.compile(r"\bMDR-[APT](?:-\d+)?[a-z0-9-]*\b", re.I),
    re.compile(r"\bSBM-\d+(?:-[0-9a-z]+)*\b", re.I),
    re.compile(r"\bS\d+-\d+(?:-[a-z0-9]+)*\b", re.I),
    re.compile(r"\bGRI\d+(?:-\d+)*[a-z-]*\b", re.I),
    re.compile(
        r"(?:para|paras|paragraph)s?\s*[.:]?\s*([\d\s,–\-~]+)",
        re.I,
    ),
)


def is_leaf_dp(dp: Any) -> bool:
    """`child_dps`가 비어 있으면 리프(원자) DP로 본다."""
    children = getattr(dp, "child_dps", None)
    if children is None:
        return True
    if isinstance(children, (list, tuple)):
        return len(children) == 0
    return False


def flatten_validation_rules_for_display(vr: Any, *, max_strings: int = 24, max_len: int = 500) -> list[str]:
    """JSONB `validation_rules`를 LLM/증거용 짧은 문자열 리스트로 평탄화한다."""
    out: list[str] = []
    if vr is None:
        return out
    if isinstance(vr, str):
        s = vr.strip()
        return [s[:max_len]] if s else []
    if isinstance(vr, list):
        for item in vr:
            if isinstance(item, str) and item.strip():
                out.append(item.strip()[:max_len])
            if len(out) >= max_strings:
                break
        return out
    if isinstance(vr, dict):
        for key, val in vr.items():
            if key in ("key_terms", "related_concepts", "required_actions", "verification_checks", "cross_references"):
                continue
            if isinstance(val, str) and val.strip():
                out.append(f"{key}: {val.strip()}"[:max_len])
            elif isinstance(val, bool | int | float):
                out.append(f"{key}: {val}"[:max_len])
            elif isinstance(val, list) and val:
                preview = ", ".join(str(x) for x in val[:5] if x is not None)
                if preview:
                    out.append(f"{key}: {preview}"[:max_len])
            if len(out) >= max_strings:
                break
        return out
    s = str(vr).strip()
    return [s[:max_len]] if s else []


def _extract_tokens_from_text(text: str) -> set[str]:
    if not text or not text.strip():
        return set()
    raw = text.strip()
    found: set[str] = set()
    for pat in _PARA_PATTERNS:
        for m in pat.finditer(raw):
            g = m.group(1) if m.lastindex else m.group(0)
            if not g:
                continue
            g = g.strip()
            if not g:
                continue
            if m.lastindex:
                for part in re.split(r"[\s,;]+", g):
                    p = part.strip("–-~.")
                    if p and any(ch.isdigit() for ch in p):
                        found.add(p.lower())
            else:
                found.add(g.lower())
    return found


def paragraph_axis_tokens_from_rulebook_validation_rules(vr: Any) -> set[str]:
    """룰북 `validation_rules` dict의 paragraph_reference 등에서 축 토큰을 추출한다."""
    if not isinstance(vr, dict):
        return set()
    chunks: list[str] = []
    pr = vr.get("paragraph_reference")
    if pr:
        chunks.append(str(pr))
    cr = vr.get("cross_references")
    if isinstance(cr, Iterable) and not isinstance(cr, (str, bytes)):
        chunks.extend(str(x) for x in cr)
    return _extract_tokens_from_text(" ".join(chunks))


def paragraph_axis_tokens_for_dp(dp: Any, rulebook_vr: dict[str, Any] | None = None) -> set[str]:
    """DP 본문 필드 + (선택) 연결 룰북 문단 참조에서 축 토큰을 합친다."""
    parts: list[str] = []
    for attr in ("dp_code", "dp_id", "name_en", "name_ko", "description"):
        v = getattr(dp, attr, None)
        if v:
            parts.append(str(v))
    base = _extract_tokens_from_text(" ".join(parts))
    if rulebook_vr:
        base |= paragraph_axis_tokens_from_rulebook_validation_rules(rulebook_vr)
    return base


def paragraph_axis_overlap_penalty(
    source_tokens: set[str],
    target_tokens: set[str],
) -> tuple[bool, bool]:
    """( 겹침 있음, 둘 다 비비어인데 교집합 없음 — 불일치 신호 )"""
    if not source_tokens or not target_tokens:
        return False, False
    inter = source_tokens & target_tokens
    return (len(inter) > 0, len(inter) == 0)
