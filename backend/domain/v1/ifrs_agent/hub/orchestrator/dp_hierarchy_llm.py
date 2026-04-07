"""
Phase 1.5: DP 적합성 판단 — Gemini LLM (구조화 JSON)

description·validation_rules·사용자 의도(category·prompt·search_intent·content_focus)를
종합하여 각 DP가 gen_node에 전달하기 적합한지 판단하고, 사용자용 한국어 사유를 생성한다.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("ifrs_agent.orchestrator.dp_hierarchy_llm")


def _truncate(s: Optional[str], max_len: int) -> str:
    """문자열을 max_len으로 자르고, 넘으면 '...' 붙임."""
    if not s:
        return ""
    s = str(s).strip()
    return s if len(s) <= max_len else s[: max_len - 3] + "..."


def build_phase15_prompt(
    fact_data_by_dp: Dict[str, Dict[str, Any]],
    user_context: Dict[str, str],
) -> str:
    """
    Phase 1.5 LLM 프롬프트 생성.
    
    Args:
        fact_data_by_dp: {dp_id: fact_data}
        user_context: {"category", "prompt", "search_intent", "content_focus"}
    
    Returns:
        프롬프트 문자열
    """
    dp_rows: List[Dict[str, Any]] = []
    for dp_id, fact_data in (fact_data_by_dp or {}).items():
        if not fact_data or fact_data.get("error"):
            continue
        if dp_id.upper().startswith("UCM"):
            continue
        
        dm = fact_data.get("dp_metadata") or {}
        vr = dm.get("validation_rules")
        if isinstance(vr, (dict, list)):
            vr_s = json.dumps(vr, ensure_ascii=False)
        else:
            vr_s = str(vr or "")
        
        dp_rows.append({
            "dp_id": dp_id,
            "name_ko": dm.get("name_ko", ""),
            "name_en": dm.get("name_en", ""),
            "description": _truncate(dm.get("description"), 1000),
            "dp_type": dm.get("dp_type", ""),
            "topic": dm.get("topic", ""),
            "subtopic": dm.get("subtopic", ""),
            "category": dm.get("category", ""),
            "child_dps": list(dm.get("child_dps") or []),
            "parent_indicator": dm.get("parent_indicator"),
            "validation_rules": _truncate(vr_s, 800),
        })
    
    if not dp_rows:
        return ""
    
    user_json = json.dumps(
        {
            "category": user_context.get("category", ""),
            "prompt": user_context.get("prompt", ""),
            "search_intent": user_context.get("search_intent", ""),
            "content_focus": user_context.get("content_focus", ""),
        },
        ensure_ascii=False,
        indent=2,
    )
    
    dp_json = json.dumps(dp_rows, ensure_ascii=False, indent=2)
    
    return f"""당신은 IFRS/ESRS 지속가능성 보고서 생성 파이프라인의 **DP(Data Point) 선택 적합성 검토자**입니다.

## 역할
사용자가 선택한 DP가 **문단 생성(gen_node)에 전달하기 적합한지** 판단하고, 부적합하면 **사용자에게 보여줄 한국어 사유**를 생성합니다.

## 사용자 요청 맥락
{user_json}

## 검토 대상 DP 메타데이터
{dp_json}

## 판단 기준

### 1. 계층 구조 (child_dps)
- **child_dps가 비어 있지 않으면** 보통 "상위(비-leaf) DP"입니다.
- 상위 DP는 **하위 DP를 선택해야** 구체적인 공시 항목이 됩니다.
- 예외: 사용자가 **총괄 수준 요약**을 원하면 상위 DP도 적합할 수 있음

### 2. description·validation_rules 분석
- **"하위 DP로 둡니다"**, **"하위 문단·항목 공시"**, **"문단 XX(a)~(f)"** 같은 표현 → 하위 선택 필요
- **"총괄"**, **"루트"**, **"개요"** 성격 → 하위 선택 필요
- validation_rules에 **"하위 ... 정합"** 같은 검증 규칙 → 하위 선택 필요

### 3. 사용자 의도와 DP 주제 일치
- 사용자 **category·prompt·search_intent·content_focus**와 DP의 **topic·subtopic·category** 비교
- 예시:
  - 사용자: "학술연수" / DP: "거버넌스·IRO 관리" → **주제 불일치** → 다른 DP 추천
  - 사용자: "재생에너지" / DP: "E1: 기후변화 > 에너지" → **적합 가능**
  - 사용자: "협력회사 ESG" / DP: "S2: 가치사슬 근로자" → **적합 가능**

### 4. DP 유형 (dp_type)
- **narrative/qualitative**: 서술형 → child_dps가 있어도 총괄 설명이 필요한 경우 있음 

## 출력 형식 (JSON만, 다른 텍스트 없이)

각 검토 대상 DP에 대해 **정확히 하나**의 판단을 반환하세요.

스키마:
{{
  "decisions": [
    {{
      "dp_id": "문자열",
      "needs_user_selection": true 또는 false,
      "reason_ko": "사용자에게 보여줄 한국어 1-2문장 (왜 하위 선택이 필요한지 또는 왜 진행 가능한지)",
      "rationale": "내부용 영어 근거 (짧게)",
      "suggested_action": "reselect_child_dp" 또는 "search_different_dp" 또는 "proceed" (선택)
    }}
  ]
}}

- **needs_user_selection=true**: 이 DP로는 gen_node에 전달하기 부적합 → 사용자가 하위 DP 또는 다른 DP 선택 필요
- **needs_user_selection=false**: 이 DP로 문단 생성 진행 가능
- **reason_ko**: 사용자가 이해할 수 있는 맥락 있는 설명 (기준서·주제 불일치·계층 구조 등)
- **모든** 입력 DP에 대해 decisions에 항목 포함

판단하세요."""


async def classify_dp_suitability_with_gemini(
    client: Any,
    model_id: str,
    fact_data_by_dp: Dict[str, Dict[str, Any]],
    user_context: Dict[str, str],
) -> Optional[List[Dict[str, Any]]]:
    """
    Gemini에 DP 적합성 판단 요청 (구조화 JSON).
    
    Args:
        client: google.genai.Client
        model_id: 모델 ID (예: "gemini-2.5-pro", "gemini-3.1-pro")
        fact_data_by_dp: {dp_id: fact_data}
        user_context: {"category", "prompt", "search_intent", "content_focus"}
    
    Returns:
        decisions 리스트 또는 None (실패 시 호출부에서 규칙 폴백)
    """
    prompt = build_phase15_prompt(fact_data_by_dp, user_context)
    if not prompt:
        return []
    
    try:
        response = client.models.generate_content(
            model=model_id,
            contents=prompt,
            config={
                "temperature": 0.0,  # 결정성 최대화
                "response_mime_type": "application/json",
            },
        )
        raw = getattr(response, "text", None) or ""
        if not str(raw).strip():
            raise ValueError("empty Gemini response")
        
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise ValueError(f"expected JSON object, got {type(parsed).__name__}")
        
        decisions = parsed.get("decisions")
        if not isinstance(decisions, list):
            raise ValueError("decisions must be a list")
        
        validated: List[Dict[str, Any]] = []
        for d in decisions:
            if not isinstance(d, dict):
                continue
            did = d.get("dp_id")
            if not did:
                continue
            validated.append({
                "dp_id": str(did),
                "needs_user_selection": bool(d.get("needs_user_selection")),
                "reason_ko": str(d.get("reason_ko") or "").strip(),
                "rationale": str(d.get("rationale") or "").strip(),
                "suggested_action": str(d.get("suggested_action") or "").strip(),
            })
        
        logger.info("Phase 1.5 LLM: %d decision(s) returned", len(validated))
        return validated
        
    except Exception as e:
        logger.warning("Phase 1.5 Gemini classification failed: %s", e, exc_info=True)
        return None
