"""
validator_node — 차원별 점수 병합 및 overall/band 계산.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

SCHEMA_VERSION = "validator_ui_v1"

# dimension_id -> weight (합 1.0)
DIMENSION_WEIGHTS: Dict[str, float] = {
    "format_completeness": 0.12,
    "numeric_presence": 0.20,
    "fact_consistency": 0.30,
    "greenwashing_risk": 0.23,
    "dp_availability": 0.15,
}

# LLM 미실행·파싱 실패 시 fact/green 기본값
LLM_NEUTRAL_SCORE = 70

FAIL_SCORE_CAP = 59
PASS_SCORE_FLOOR = 60


def map_score_to_band(score: int) -> Tuple[str, str]:
    """(band_id, label_ko)"""
    if score >= 90:
        return "excellent", "우수"
    if score >= 75:
        return "good", "양호"
    if score >= 60:
        return "fair", "보통"
    return "poor", "미흡"


def clamp_int(x: float) -> int:
    return max(0, min(100, int(round(x))))


def merge_dimension_scores(
    *,
    rule_scores: Dict[str, int],
    rule_notes: Dict[str, str],
    llm_dims: Optional[Dict[str, Dict[str, Any]]],
    llm_skipped: bool,
) -> List[Dict[str, Any]]:
    """by_dimension 배열 생성."""
    out: List[Dict[str, Any]] = []
    for dim_id, w in DIMENSION_WEIGHTS.items():
        src = "rules"
        score: int
        notes_ko = rule_notes.get(dim_id, "")

        if dim_id in ("fact_consistency", "greenwashing_risk"):
            src = "llm"
            if llm_skipped or not llm_dims:
                score = LLM_NEUTRAL_SCORE
                if not notes_ko:
                    notes_ko = (
                        "LLM 검증 생략 또는 미응답 — 참고 점수"
                        if llm_skipped
                        else "LLM 차원 미제공 — 참고 점수"
                    )
            else:
                raw = (llm_dims or {}).get(dim_id)
                if isinstance(raw, dict):
                    sv = raw.get("score")
                    try:
                        score = clamp_int(float(sv)) if sv is not None else LLM_NEUTRAL_SCORE
                    except (TypeError, ValueError):
                        score = LLM_NEUTRAL_SCORE
                    nk = raw.get("notes_ko")
                    if isinstance(nk, str) and nk.strip():
                        notes_ko = nk.strip()
                else:
                    score = LLM_NEUTRAL_SCORE
        else:
            score = int(rule_scores.get(dim_id, LLM_NEUTRAL_SCORE))

        out.append(
            {
                "id": dim_id,
                "score": score,
                "weight": w,
                "source": src,
                "notes_ko": notes_ko or "—",
            }
        )
    return out


def weighted_overall(by_dimension: List[Dict[str, Any]]) -> int:
    total = 0.0
    for row in by_dimension:
        w = float(row.get("weight") or 0)
        s = float(row.get("score") or 0)
        total += w * s
    return clamp_int(total)


def apply_valid_policy(overall_score: int, is_valid: bool) -> int:
    if not is_valid:
        return min(overall_score, FAIL_SCORE_CAP)
    return max(overall_score, PASS_SCORE_FLOOR)


def build_accuracy_payload(
    *,
    rule_scores: Dict[str, int],
    rule_notes: Dict[str, str],
    llm_dims: Optional[Dict[str, Dict[str, Any]]],
    llm_skipped: bool,
    is_valid: bool,
) -> Dict[str, Any]:
    by_dim = merge_dimension_scores(
        rule_scores=rule_scores,
        rule_notes=rule_notes,
        llm_dims=llm_dims,
        llm_skipped=llm_skipped,
    )
    raw_overall = weighted_overall(by_dim)
    overall_score = apply_valid_policy(raw_overall, is_valid)
    band_id, label_ko = map_score_to_band(overall_score)
    return {
        "overall": {
            "score": overall_score,
            "band": band_id,
            "label_ko": label_ko,
        },
        "by_dimension": by_dim,
    }


def normalize_feedback_items(
    raw: Any,
    default_source: str = "llm",
) -> List[Dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        sev = item.get("severity") or "suggestion"
        dim = item.get("dimension_id") or ""
        issue = item.get("issue_ko") or ""
        sug = item.get("suggestion_ko") or ""
        quote = item.get("quote")
        src = item.get("source") or default_source
        out.append(
            {
                "severity": str(sev),
                "dimension_id": str(dim),
                "issue_ko": str(issue),
                "suggestion_ko": str(sug),
                "quote": quote if quote is None or isinstance(quote, str) else str(quote),
                "source": str(src),
            }
        )
    return out
