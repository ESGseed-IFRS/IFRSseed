"""
dp_rag 에이전트

Data Point 기반 실데이터 값 조회 노드
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from backend.domain.v1.ifrs_agent.models.runtime_config import AgentRuntimeConfig
from backend.domain.v1.ifrs_agent.spokes.agents.dp_rag.allowlist import (
    get_allowlist_for_category,
    resolve_esg_category,
    validate_selection,
)
from backend.domain.v1.ifrs_agent.spokes.agents.dp_rag.cache import get_cache

logger = logging.getLogger("ifrs_agent.dp_rag")

# Google AI generateContent 모델 ID (설정: DP_RAG_GEMINI_MODEL / runtime_config.dp_rag_gemini_model)
_DEFAULT_DP_RAG_GEMINI_MODEL = "gemini-2.5-flash"

# narrative DP 보조 실데이터: LLM이 고르는 컬럼 수 상한
_MAX_NARRATIVE_SUPPLEMENTS = 3

# UCM 정성적 키워드 (UCM 전용 DP에서 dp_meta=None일 때 정성 판단용)
_UCM_QUALITATIVE_KEYWORDS = [
    "여부", "방법", "설명", "기술", "공개", "보고", "정책", "절차",
    "프로세스", "체계", "구조", "조직", "거버넌스", "전략", "계획",
    "목표", "이니셔티브", "프로그램", "활동", "조치", "대응", "관리",
    "평가", "검토", "분석", "식별", "파악", "고려", "반영", "통합",
    "whether", "how", "describe", "disclose", "report", "policy",
    "procedure", "process", "structure", "governance", "strategy"
]


def _narrative_supplement_category_hints(category: str) -> str:
    """
    narrative 보조 지표 LLM 선정 시 E/S/G별로 느슨한 키워드 연상(예: 부패=이해상충)을 줄이기 위한 정책 문구.
    """
    if category == "G":
        return """Governance (G) — selection policy:
- PRIORITIZE fields that DIRECTLY match the disclosure: board composition, chair/oversight, independence, meetings, attendance, committee leadership, names where relevant.
- STRONGLY PREFER data_type "board". Include BOTH: (1) numeric — total_board_members, female_board_members, independent_board_members, board_meetings, board_attendance_rate, board_compensation; (2) text/name — board_chairman_name, ceo_name, audit_committee_chairman, esg_committee_chairman when the rulebook or DP asks who chairs the board, who is CEO, or committee chair identity (SR·공시 스냅샷).
- Pick "compliance" or "ethics" (corruption_cases, corruption_reports, legal_sanctions) ONLY if the rulebook or DP text explicitly mentions anti-corruption, ethics violations, whistleblowing, or legal sanctions — NOT as a vague proxy for conflict-of-interest management.
- Pick "risk" (security_incidents, data_breaches, security_fines) ONLY if the disclosure explicitly concerns cybersecurity or information-security governance."""

    if category == "S":
        return """Social (S) — selection policy:
- Match data_type to the DP/rulebook theme: "workforce" for employment, diversity, equity; "safety" for occupational health and safety; "supply_chain" for suppliers and value-chain ESG; "community" for social contribution and volunteering.
- PRIORITIZE columns that the rulebook or DP would reasonably need as numeric support; avoid unrelated sub-themes (e.g. do not pick community metrics for a pure workforce disclosure, or vice versa).
- Prefer at most one metric per sub-theme unless the rulebook clearly requires multiple angles."""

    if category == "E":
        return """Environmental (E) — selection policy:
- PRIORITIZE columns that DIRECTLY match the disclosure: GHG/scope columns for climate; energy columns for energy; water_* for water; waste_* for waste.
- Air-quality columns (nox_emission, sox_emission, voc_emission, dust_emission) ONLY if the rulebook or DP concerns air emissions or those pollutants specifically.
- Do not mix unrelated pillars (e.g. waste metrics alone for a pure GHG-focused disclosure) unless the rulebook spans multiple environmental topics."""

    return ""


def _parse_supplements_response(text: str) -> List[Dict[str, Any]]:
    """LLM JSON — supplements 배열만 추출."""
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\s*```\s*$", "", t)
    try:
        obj = json.loads(t)
        if isinstance(obj, dict) and "supplements" in obj:
            sup = obj["supplements"]
            if isinstance(sup, list):
                return [
                    x
                    for x in sup
                    if isinstance(x, dict)
                    and x.get("table")
                    and x.get("column")
                ]
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    return []


def _parse_llm_response(text: str) -> Optional[Dict[str, Any]]:
    """LLM JSON 응답 파싱."""
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\s*```\s*$", "", t)
    try:
        obj = json.loads(t)
        if isinstance(obj, dict) and "table" in obj and "column" in obj:
            return obj
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    return None


def _resolve_unit(
    dp_meta: Optional[Dict[str, Any]],
    ucm_info: Optional[Dict[str, Any]],
) -> Optional[Any]:
    """UCM 전용 경로(dp_meta=None)에서도 unit을 ucm_info에서 가져온다."""
    if dp_meta and dp_meta.get("unit") is not None:
        return dp_meta.get("unit")
    if ucm_info and ucm_info.get("unit") is not None:
        return ucm_info.get("unit")
    return None


def _dp_metadata_for_response(
    dp_meta: Optional[Dict[str, Any]],
    *,
    dp_type: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    query_dp_metadata 전체 행을 그대로 노출하지 않고, API·gen_node에 필요한 필드만 전달.
    child_dps / parent_indicator / unit / validation_rules 포함 (Phase 1.5·검증용).
    """
    if not dp_meta:
        return None
    resolved_type = dp_type if dp_type is not None else dp_meta.get("dp_type")
    return {
        "name_ko": dp_meta.get("name_ko"),
        "name_en": dp_meta.get("name_en"),
        "description": dp_meta.get("description"),
        "topic": dp_meta.get("topic"),
        "subtopic": dp_meta.get("subtopic"),
        "category": dp_meta.get("category"),
        "dp_type": resolved_type,
        "unit": dp_meta.get("unit"),
        "validation_rules": dp_meta.get("validation_rules"),
        "child_dps": dp_meta.get("child_dps"),
        "parent_indicator": dp_meta.get("parent_indicator"),
    }


def _resolve_validation_rules(
    dp_meta: Optional[Dict[str, Any]],
    ucm_info: Optional[Dict[str, Any]],
) -> Optional[Any]:
    """validation_rules: DP 우선, 없으면 UCM."""
    if dp_meta and dp_meta.get("validation_rules"):
        return dp_meta.get("validation_rules")
    if ucm_info and ucm_info.get("validation_rules"):
        return ucm_info.get("validation_rules")
    return None


def _ucm_qualitative_keyword_hits(ucm_info: Optional[Dict[str, Any]]) -> int:
    """
    UCM의 column_description과 column_name_ko에서 정성적 키워드 출현 횟수 반환.
    
    UCM 전용 DP (dp_meta=None)에서 정성/정량 판단에 사용.
    """
    if not ucm_info:
        return 0
    
    text = ""
    if ucm_info.get("column_description"):
        text += ucm_info.get("column_description", "")
    if ucm_info.get("column_name_ko"):
        text += " " + ucm_info.get("column_name_ko", "")
    if ucm_info.get("column_name_en"):
        text += " " + ucm_info.get("column_name_en", "")
    
    text_lower = text.lower()
    hits = sum(1 for kw in _UCM_QUALITATIVE_KEYWORDS if kw in text_lower)
    return hits


def _ucm_for_response(ucm_info: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """fact_data / API용 UCM 요약 (primary_rulebook·충돌·standard_metadata 포함)."""
    if not ucm_info:
        return None
    return {
        "unified_column_id": ucm_info.get("unified_column_id"),
        "column_name_ko": ucm_info.get("column_name_ko"),
        "column_name_en": ucm_info.get("column_name_en"),
        "column_category": ucm_info.get("column_category"),
        "column_topic": ucm_info.get("column_topic"),
        "column_subtopic": ucm_info.get("column_subtopic"),
        "column_description": ucm_info.get("column_description"),
        "validation_rules": ucm_info.get("validation_rules"),
        "disclosure_requirement": ucm_info.get("disclosure_requirement"),
        "financial_linkages": ucm_info.get("financial_linkages"),
        "mapped_dp_ids": ucm_info.get("mapped_dp_ids"),
        "primary_rulebook_id": ucm_info.get("primary_rulebook_id"),
        "rulebook_conflicts": ucm_info.get("rulebook_conflicts"),
        "standard_metadata": ucm_info.get("standard_metadata"),
    }


class DpRagAgent:
    """
    dp_rag 에이전트
    
    DP ID → 물리 테이블·컬럼 결정(LLM) → 실데이터 조회
    """

    def __init__(self, infra):
        """
        Args:
            infra: InfraLayer 인스턴스
        """
        from backend.domain.v1.ifrs_agent.spokes.infra import InfraLayer

        self.infra: InfraLayer = infra
        self.runtime_config: Optional[AgentRuntimeConfig] = None
        self.cache = get_cache()

        logger.info("DpRagAgent initialized (LLM: Gemini 2.5 Flash, Cache enabled)")

    async def collect(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        DP 기반 실데이터 수집
        
        Args:
            payload: {
                "company_id": str,
                "dp_id": str,
                "year": int,  # 실데이터 조회 연도 (오케스트레이터 기본 2024)
                "runtime_config": AgentRuntimeConfig (선택)
            }
        
        Returns:
            {
                "dp_id": str,
                "value": Any,
                "unit": str,
                "year": int,
                "company_profile": dict | None,  # company_info, DP와 무관
                "table": str,
                "column": str,
                "data_type": str?,
                "is_outdated": bool,
                "confidence": float,
                "suitability_warning": str | None,  # 제안 A: 정량 적합성 경고
                "error": str?
            }
        """
        company_id = payload["company_id"]
        dp_id = payload["dp_id"]
        year = payload["year"]
        raw_rc = payload.get("runtime_config")
        self.runtime_config = raw_rc if isinstance(raw_rc, dict) else None

        if self.runtime_config:
            logger.info(
                "dp_rag.collect: runtime_config keys=%s",
                sorted(self.runtime_config.keys()),
            )

        logger.info("dp_rag.collect started: dp_id=%s, year=%s", dp_id, year)

        company_profile = await self._query_company_info(company_id)

        try:
            # 1. dp_id prefix로 조회 테이블 결정
            is_ucm = dp_id.upper().startswith("UCM")
            
            dp_meta = None
            ucm_info = None
            
            if is_ucm:
                # UCM 테이블에서 직접 조회 (unified_column_id로)
                logger.info("dp_rag: UCM prefix detected, querying unified_column_mappings directly")
                ucm_info = await self._query_ucm_direct(dp_id)
                if not ucm_info:
                    return {
                        "dp_id": dp_id,
                        "value": None,
                        "unit": None,
                        "year": year,
                        "company_profile": company_profile,
                        "dp_metadata": None,
                        "ucm": None,
                        "rulebook": None,
                        "source": None,
                        "is_outdated": False,
                        "confidence": 0.0,
                        "validation_passed": False,
                        "validation_error": None,
                        "suitability_warning": None,
                        "error": f"UCM not found: {dp_id}",
                    }
            else:
                # data_points 테이블에서 조회
                logger.info("dp_rag: Non-UCM prefix, querying data_points")
                dp_meta = await self._query_dp_metadata(dp_id)
                if not dp_meta:
                    return {
                        "dp_id": dp_id,
                        "value": None,
                        "unit": None,
                        "year": year,
                        "company_profile": company_profile,
                        "dp_metadata": None,
                        "ucm": None,
                        "rulebook": None,
                        "source": None,
                        "is_outdated": False,
                        "confidence": 0.0,
                        "validation_passed": False,
                        "validation_error": None,
                        "suitability_warning": None,
                        "error": f"DP not found in data_points: {dp_id}",
                    }
                
                # DP가 있으면 UCM도 조회 시도 (mapped_dp_ids로)
                ucm_info = await self._query_ucm_by_dp(dp_id)

            # UCM primary_rulebook_id → rulebook; 없으면 rulebooks.primary_dp_id = dp_id fallback
            rulebook_payload = await self._resolve_rulebook(dp_id, ucm_info)

            # 제안 A: rulebook·UCM 기반 정량 적합성 체크 (보조 안전장치)
            suitability_warning = self._check_quantitative_suitability(
                dp_id, dp_meta, ucm_info, rulebook_payload
            )

            # 2. DP 유형 체크 — 정성 DP는 실데이터 조회 생략
            dp_type = (dp_meta.get("dp_type") if dp_meta else None) or "quantitative"
            is_qualitative = dp_type in ("qualitative", "narrative", "binary")
            
            # UCM 전용 DP (dp_meta=None)의 경우: UCM 정성적 키워드 체크
            if not dp_meta and ucm_info:
                qualitative_hits = _ucm_qualitative_keyword_hits(ucm_info)
                if qualitative_hits >= 2:  # 2개 이상 키워드 발견 시 정성으로 판단
                    is_qualitative = True
                    dp_type = "narrative"
                    logger.info(
                        "dp_rag: UCM-only DP %s has %d qualitative keywords — treating as narrative",
                        dp_id, qualitative_hits
                    )
            
            if is_qualitative:
                # 정성 DP: 단일 DP value는 없음. rulebook·DP 맥락으로 보조 실데이터(선택) 조회
                logger.info("dp_rag: Qualitative DP detected (dp_type=%s), skipping primary real data query", dp_type)
                result: Dict[str, Any] = {
                    "dp_id": dp_id,
                    "value": None,
                    "unit": _resolve_unit(dp_meta, ucm_info),
                    "year": year,
                    "company_profile": company_profile,
                    "dp_metadata": _dp_metadata_for_response(dp_meta, dp_type=dp_type),
                    "ucm": _ucm_for_response(ucm_info),
                    "rulebook": rulebook_payload,
                    "source": None,
                    "table": None,
                    "column": None,
                    "data_type": None,
                    "is_outdated": False,
                    "confidence": 1.0,
                    "validation_passed": True,
                    "validation_error": None,
                    "suitability_warning": suitability_warning if suitability_warning else None,
                    "error": None,
                }
                supplementary = await self._fetch_narrative_supplementary_real_data(
                    company_id,
                    year,
                    dp_id,
                    dp_meta,
                    ucm_info,
                    rulebook_payload,
                )
                if supplementary:
                    result["supplementary_real_data"] = supplementary
                return result
            
            # 정량 DP: 물리 위치 결정 (캐시 → LLM)
            mapping = await self._resolve_physical_location(dp_id, dp_meta, ucm_info)
            if not mapping or not mapping.get("table"):
                return {
                    "dp_id": dp_id,
                    "value": None,
                    "unit": _resolve_unit(dp_meta, ucm_info),
                    "year": year,
                    "company_profile": company_profile,
                    "dp_metadata": _dp_metadata_for_response(dp_meta),
                    "ucm": _ucm_for_response(ucm_info),
                    "rulebook": rulebook_payload,
                    "source": None,
                    "table": None,
                    "column": None,
                    "data_type": None,
                    "is_outdated": False,
                    "confidence": 0.0,
                    "validation_passed": False,
                    "validation_error": None,
                    "suitability_warning": suitability_warning,
                    "error": "No valid column mapping found",
                }
            
            # Confidence 임계값 체크
            confidence = mapping.get("confidence", 0.0)
            if confidence < 0.5:
                logger.warning(
                    "dp_rag: Low confidence mapping (%.2f) for dp_id=%s — 검증 필요",
                    confidence,
                    dp_id,
                )

            # 3. 실데이터 조회
            data = await self._query_real_data(
                company_id,
                year,
                mapping["table"],
                mapping["column"],
                mapping.get("data_type"),
            )

            # 4. 유효성 검사
            is_outdated = self._check_outdated(data, year) if data.get("value") is not None else False
            
            # validation_rules 적용
            validation_error = self._validate_value(
                data.get("value"),
                _resolve_validation_rules(dp_meta, ucm_info),
            )
            if validation_error:
                logger.warning("dp_rag: Validation failed for dp_id=%s: %s", dp_id, validation_error)

            # suitability_warning이 있으면 로그 + 응답에 포함
            if suitability_warning:
                logger.warning("dp_rag: Suitability warning for dp_id=%s: %s", dp_id, suitability_warning)

            # 풍부한 응답 구성
            return {
                "dp_id": dp_id,
                "value": data.get("value"),
                "unit": _resolve_unit(dp_meta, ucm_info),
                "year": year,
                "company_profile": company_profile,
                "table": mapping["table"],
                "column": mapping["column"],
                "data_type": mapping.get("data_type"),
                
                # DP 메타데이터 (UCM ID만 넘긴 경우 None)
                "dp_metadata": _dp_metadata_for_response(dp_meta),
                
                # UCM 정보
                "ucm": _ucm_for_response(ucm_info),

                # Rulebook (UCM.primary_rulebook_id → rulebooks 행)
                "rulebook": rulebook_payload,
                
                # 소스 정보
                "source": {
                    "table": mapping["table"],
                    "column": mapping["column"],
                    "data_type": mapping.get("data_type"),
                },
                
                # 검증 결과
                "is_outdated": is_outdated,
                "confidence": mapping.get("confidence", 0.0),
                "validation_passed": validation_error is None,
                "validation_error": validation_error,
                
                # 제안 A: 정량 적합성 경고 (있으면)
                "suitability_warning": suitability_warning,
                
                # 에러
                "error": data.get("error"),
            }

        except Exception as e:
            logger.error("dp_rag.collect failed: %s", e, exc_info=True)
            return {
                "dp_id": dp_id,
                "value": None,
                "unit": None,
                "year": year,
                "company_profile": company_profile,
                "table": None,
                "column": None,
                "data_type": None,
                "dp_metadata": None,
                "ucm": None,
                "rulebook": None,
                "source": None,
                "is_outdated": False,
                "confidence": 0.0,
                "validation_passed": False,
                "validation_error": None,
                "suitability_warning": None,
                "error": str(e),
            }

    async def _query_company_info(self, company_id: str) -> Optional[Dict[str, Any]]:
        """DP와 무관 — `company_info` 프로필(맥락 텍스트·산업 등). 실패 시 None."""
        try:
            result = await self.infra.call_tool(
                "query_company_info",
                {"company_id": company_id},
            )
            if result is None:
                return None
            return result if isinstance(result, dict) else None
        except Exception as e:
            logger.warning("dp_rag: query_company_info failed: %s", e)
            return None

    async def _query_dp_metadata(self, dp_id: str) -> Optional[Dict[str, Any]]:
        """data_points 테이블에서 DP 메타 조회."""
        try:
            result = await self.infra.call_tool(
                "query_dp_metadata",
                {"dp_id": dp_id},
            )
            return result
        except Exception as e:
            logger.warning("query_dp_metadata failed: %s", e)
            return None

    async def _query_ucm_direct(self, ucm_id: str) -> Optional[Dict[str, Any]]:
        """
        unified_column_mappings에서 unified_column_id로 직접 조회.
        
        Args:
            ucm_id: UCM ID (예: "UCM_ESRS2_MDR_T_80_i")
        
        Returns:
            UCM 정보 dict 또는 None
        """
        try:
            result = await self.infra.call_tool(
                "query_ucm_direct",
                {"ucm_id": ucm_id},
            )
            return result
        except Exception as e:
            logger.warning("query_ucm_direct failed: %s", e)
            return None

    async def _query_ucm_by_dp(self, dp_id: str) -> Optional[Dict[str, Any]]:
        """
        unified_column_mappings에서 mapped_dp_ids로 UCM 조회.
        
        UCM에 없으면 unmapped_data_points 확인.
        """
        try:
            result = await self.infra.call_tool(
                "query_ucm_by_dp",
                {"dp_id": dp_id},
            )
            
            # UCM에 없으면 unmapped_data_points 시도
            if not result:
                logger.info("dp_rag: DP not in UCM, checking unmapped_data_points: dp_id=%s", dp_id)
                unmapped = await self.infra.call_tool(
                    "query_unmapped_dp",
                    {"dp_id": dp_id},
                )
                if unmapped:
                    logger.info("dp_rag: Found in unmapped_data_points: dp_id=%s", dp_id)
                    # unmapped → UCM 형식으로 변환 (category, unit 등)
                    result = {
                        "unified_column_id": None,
                        "column_name_ko": unmapped.get("name_ko"),
                        "column_name_en": unmapped.get("name_en"),
                        "column_category": unmapped.get("category"),
                        "unit": unmapped.get("unit"),
                        "_unmapped": True,
                    }
            
            return result
        except Exception as e:
            logger.warning("query_ucm_by_dp failed: %s", e)
            return None

    async def _resolve_rulebook(
        self,
        dp_id: str,
        ucm_info: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """
        Rulebook 로드: (1) UCM.primary_rulebook_id → rulebooks,
        (2) 없으면 rulebooks.primary_dp_id = dp_id (시드/직접 연결 fallback).
        """
        rb = await self._fetch_rulebook_for_ucm(ucm_info)
        if rb:
            return rb
        return await self._fetch_rulebook_by_primary_dp_id(dp_id)

    async def _fetch_rulebook_for_ucm(
        self, ucm_info: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        UCM.primary_rulebook_id로 rulebooks 1건 조회.
        스키마 미적용·행 없음·툴 오류 시 None (수집 플로우는 계속).
        """
        if not ucm_info:
            return None
        rid = ucm_info.get("primary_rulebook_id")
        if rid is None:
            return None
        rid_str = str(rid).strip()
        if not rid_str:
            return None
        try:
            rb = await self.infra.call_tool(
                "query_rulebook",
                {"rulebook_id": rid_str},
            )
            return rb if isinstance(rb, dict) else None
        except Exception as e:
            logger.warning("dp_rag: query_rulebook failed for id=%s: %s", rid_str, e)
            return None

    async def _fetch_rulebook_by_primary_dp_id(
        self, dp_id: str
    ) -> Optional[Dict[str, Any]]:
        """rulebooks.primary_dp_id = dp_id 로 1건 조회 (UCM에 rulebook_id가 없을 때)."""
        dpid = (dp_id or "").strip()
        if not dpid:
            return None
        try:
            rb = await self.infra.call_tool(
                "query_rulebook_by_primary_dp_id",
                {"dp_id": dpid},
            )
            if isinstance(rb, dict) and rb:
                logger.info(
                    "dp_rag: rulebook resolved via primary_dp_id=%s (rulebook_id=%s)",
                    dpid,
                    rb.get("rulebook_id"),
                )
            return rb if isinstance(rb, dict) else None
        except Exception as e:
            logger.warning(
                "dp_rag: query_rulebook_by_primary_dp_id failed for dp_id=%s: %s",
                dpid,
                e,
            )
            return None

    async def _resolve_physical_location(
        self,
        dp_id: str,
        dp_meta: Optional[Dict[str, Any]],
        ucm_info: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """
        물리 저장 위치 결정 (캐시 → LLM).
        
        Args:
            dp_id: DP ID 또는 UCM ID
            dp_meta: DP 메타데이터 (UCM인 경우 None 가능)
            ucm_info: UCM 정보 (항상 있어야 함)
        
        Returns:
            {"table", "column", "data_type"?, "confidence"}
        """
        # 1. 캐시 확인
        cached = self.cache.get(dp_id)
        if cached:
            logger.info("dp_rag: Cache hit for dp_id=%s (verified=%s)", dp_id, cached.get("verified", False))
            return cached
        
        # 2. column_category로 후보 필터
        category = ucm_info.get("column_category") if ucm_info else None
        if not category:
            # UCM 없으면 DP category로 추정
            if dp_meta:
                dp_cat = dp_meta.get("category")
                if dp_cat in ("E", "S", "G"):
                    category = dp_cat
            
            if not category:
                logger.warning("No category found for dp_id=%s", dp_id)
                return None

        allowlist = get_allowlist_for_category(category)
        if not allowlist:
            logger.warning("Empty allowlist for category=%s", category)
            return None

        # 3. LLM 호출
        mapping = await self._llm_select_column(dp_id, dp_meta, ucm_info, category, allowlist)
        if not mapping:
            return None

        # 4. 화이트리스트 검증
        if not validate_selection(
            mapping["table"],
            mapping["column"],
            mapping.get("data_type"),
        ):
            logger.warning(
                "LLM selection failed validation: table=%s, column=%s, data_type=%s",
                mapping["table"],
                mapping["column"],
                mapping.get("data_type"),
            )
            return None

        # 5. 캐시 저장 (confidence >= 0.8만 자동 캐싱)
        if mapping.get("confidence", 0.0) >= 0.8:
            self.cache.set(
                dp_id,
                mapping["table"],
                mapping["column"],
                mapping.get("data_type"),
                mapping["confidence"],
                verified=False,  # 관리자 검증 전
            )

        return mapping

    async def _llm_select_column(
        self,
        dp_id: str,
        dp_meta: Optional[Dict[str, Any]],
        ucm_info: Optional[Dict[str, Any]],
        category: str,
        allowlist: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """Gemini 2.5 Flash로 테이블·컬럼 선택."""
        rc = self.runtime_config or {}
        api_key = (rc.get("gemini_api_key") or "").strip()
        model_id = (rc.get("dp_rag_gemini_model") or "").strip() or _DEFAULT_DP_RAG_GEMINI_MODEL
        if not api_key:
            logger.warning("dp_rag: GEMINI_API_KEY 없음 — LLM 생략, 첫 후보 사용")
            if allowlist:
                first = allowlist[0]
                return {
                    "table": first["table"],
                    "column": first["column"],
                    "data_type": first.get("data_type"),
                    "confidence": 0.5,
                }
            return None

        # 프롬프트 생성
        system_msg = f"""You are a data mapping specialist. Given a Data Point or UCM and allowed table columns,
select the SINGLE best match. Output ONLY valid JSON, no markdown.

Format:
{{
  "table": "social_data" | "environmental_data" | "governance_data",
  "column": "<column_name>",
  "data_type": "<type>" or null,
  "confidence": 0.0-1.0
}}

Rules:
1. table MUST be one of: social_data, environmental_data, governance_data
2. column MUST exist in the allowlist for that table
3. If table=social_data or governance_data, data_type is REQUIRED
4. confidence: your certainty (0.0 = no match, 1.0 = perfect match)
"""

        # DP 메타 또는 UCM 정보로 프롬프트 구성
        if dp_meta:
            dp_info = f"""- dp_id: {dp_id}
- name_ko: {dp_meta.get('name_ko', '')}
- name_en: {dp_meta.get('name_en', '')}
- description: {dp_meta.get('description', '')}
- topic: {dp_meta.get('topic', '')}
- subtopic: {dp_meta.get('subtopic', '')}
- unit: {dp_meta.get('unit', '')}"""
        else:
            # UCM인 경우
            dp_info = f"""- ucm_id: {dp_id}
- column_name_ko: {ucm_info.get('column_name_ko', '')}
- column_name_en: {ucm_info.get('column_name_en', '')}
- column_description: {ucm_info.get('column_description', '')}
- column_topic: {ucm_info.get('column_topic', '')}
- column_subtopic: {ucm_info.get('column_subtopic', '')}
- unit: {ucm_info.get('unit', '')}"""

        ucm_str = ""
        if ucm_info and dp_meta:  # DP + UCM 둘 다 있는 경우만
            ucm_str = f"""
UCM Info:
- column_category: {ucm_info.get('column_category')}
- column_name_ko: {ucm_info.get('column_name_ko', '')}
- column_name_en: {ucm_info.get('column_name_en', '')}"""

        user_msg = f"""Data Point:
{dp_info}
{ucm_str}

Allowed columns (category={category}):
{json.dumps(allowlist, ensure_ascii=False, indent=2)}

Select the best match."""

        try:
            import google.generativeai as genai
        except ImportError as e:
            logger.warning("dp_rag: google-generativeai 패키지 없음: %s", e)
            if allowlist:
                first = allowlist[0]
                return {
                    "table": first["table"],
                    "column": first["column"],
                    "data_type": first.get("data_type"),
                    "confidence": 0.5,
                }
            return None

        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_id)
            
            response = model.generate_content(
                [system_msg, user_msg],
                generation_config=genai.GenerationConfig(
                    temperature=0.1,
                ),
            )
            
            text = response.text.strip()
            parsed = _parse_llm_response(text)
            
            if not parsed:
                logger.warning("dp_rag: LLM 응답 파싱 실패 — 앞부분: %s", text[:200])
                if allowlist:
                    first = allowlist[0]
                    return {
                        "table": first["table"],
                        "column": first["column"],
                        "data_type": first.get("data_type"),
                        "confidence": 0.3,
                    }
                return None
            
            logger.info(
                "dp_rag: LLM selected table=%s, column=%s, data_type=%s, confidence=%s",
                parsed.get("table"),
                parsed.get("column"),
                parsed.get("data_type"),
                parsed.get("confidence", 0.0),
            )
            
            return {
                "table": parsed["table"],
                "column": parsed["column"],
                "data_type": parsed.get("data_type"),
                "confidence": float(parsed.get("confidence", 0.0)),
            }
            
        except Exception as e:
            logger.warning("dp_rag: LLM 호출 실패: %s", e, exc_info=True)
            if allowlist:
                first = allowlist[0]
                return {
                    "table": first["table"],
                    "column": first["column"],
                    "data_type": first.get("data_type"),
                    "confidence": 0.2,
                }
            return None

    async def _query_real_data(
        self,
        company_id: str,
        year: int,
        table: str,
        column: str,
        data_type: Optional[str],
    ) -> Dict[str, Any]:
        """실데이터 조회 (템플릿 쿼리)."""
        try:
            result = await self.infra.call_tool(
                "query_dp_real_data",
                {
                    "company_id": company_id,
                    "year": year,
                    "table": table,
                    "column": column,
                    "data_type": data_type,
                },
            )
            return result or {}
        except Exception as e:
            logger.error("query_dp_real_data failed: %s", e, exc_info=True)
            return {"error": str(e)}

    def _narrative_enrichment_enabled(self) -> bool:
        rc = self.runtime_config or {}
        if "dp_rag_narrative_enrichment" in rc:
            return bool(rc["dp_rag_narrative_enrichment"])
        from backend.core.config.settings import get_settings

        return get_settings().dp_rag_narrative_enrichment

    async def _llm_select_narrative_supplements(
        self,
        dp_id: str,
        dp_meta: Optional[Dict[str, Any]],
        ucm_info: Optional[Dict[str, Any]],
        rulebook_payload: Optional[Dict[str, Any]],
        category: str,
        allowlist: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        정성 DP + rulebook을 보고 보조로 참고할 실데이터 컬럼 0~N개 선택 (수치·건수·문자 이름 등 allowlist 정의).
        화이트리스트 내 조합만 반환.
        """
        rc = self.runtime_config or {}
        api_key = (rc.get("gemini_api_key") or "").strip()
        model_id = (rc.get("dp_rag_gemini_model") or "").strip() or _DEFAULT_DP_RAG_GEMINI_MODEL
        if not api_key:
            logger.warning("dp_rag: narrative enrichment skipped — no GEMINI_API_KEY")
            return []

        rb_title = (rulebook_payload or {}).get("rulebook_title") or ""
        rb_content = (rulebook_payload or {}).get("rulebook_content") or ""
        if len(rb_content) > 4000:
            rb_content = rb_content[:4000] + "\n... (truncated)"

        if dp_meta:
            dp_info = f"""dp_id: {dp_id}
name_ko: {dp_meta.get('name_ko', '')}
name_en: {dp_meta.get('name_en', '')}
description: {dp_meta.get('description', '')}
topic: {dp_meta.get('topic', '')}
subtopic: {dp_meta.get('subtopic', '')}"""
        elif ucm_info:
            dp_info = f"""ucm_id: {dp_id}
column_name_ko: {ucm_info.get('column_name_ko', '')}
column_description: {ucm_info.get('column_description', '')}"""
        else:
            dp_info = f"dp_id: {dp_id}"

        domain_hints = _narrative_supplement_category_hints(category)

        system_msg = f"""You help select supplementary fields from an allowlisted ESG schema (numbers, counts, percentages, and — for governance — text such as person names or titles where listed in the allowlist).
The disclosure is NARRATIVE (prose); chosen values support facts in the draft and must come only from the allowlist.

Output ONLY valid JSON (no markdown code fences):
{{
  "supplements": [
    {{
      "table": "social_data" | "environmental_data" | "governance_data",
      "column": "<exact column name from allowlist>",
      "data_type": "<required for social_data and governance_data, or null for environmental_data>",
      "rationale": "one short sentence in Korean why this field helps"
    }}
  ]
}}

Rules:
1. Return 0 to {_MAX_NARRATIVE_SUPPLEMENTS} items. Empty array is valid if nothing fits.
2. Every (table, column, data_type) MUST match one row in the allowlist below.
3. category filter: {category} (E=environment, S=social, G=governance) — only pick from the allowlist for this domain.
4. Do not invent columns or tables.
5. Apply the domain-specific policy below strictly when choosing fields and writing rationale.

{domain_hints}
"""

        user_msg = f"""Disclosure context:
{dp_info}

Rulebook (GRI / reporting requirement):
Title: {rb_title}
{rb_content}

Allowed columns (category={category}):
{json.dumps(allowlist, ensure_ascii=False, indent=2)}

Select up to {_MAX_NARRATIVE_SUPPLEMENTS} supplementary fields. Follow the domain policy in the system message: prefer directly relevant columns (including governance name fields when the disclosure is about roles or identity); do not use weak proxies (e.g. corruption counts for chair/independence disclosures unless the rulebook explicitly asks). If nothing fits well, return an empty supplements array."""

        try:
            import google.generativeai as genai
        except ImportError as e:
            logger.warning("dp_rag: google-generativeai missing for narrative enrichment: %s", e)
            return []

        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_id)
            response = model.generate_content(
                [system_msg, user_msg],
                generation_config=genai.GenerationConfig(temperature=0.15),
            )
            text = response.text.strip()
            parsed = _parse_supplements_response(text)
            logger.info(
                "dp_rag: narrative supplements LLM returned %d candidate(s)",
                len(parsed),
            )
            return parsed[:_MAX_NARRATIVE_SUPPLEMENTS]
        except Exception as e:
            logger.warning("dp_rag: narrative supplements LLM failed: %s", e, exc_info=True)
            return []

    async def _fetch_narrative_supplementary_real_data(
        self,
        company_id: str,
        year: int,
        dp_id: str,
        dp_meta: Optional[Dict[str, Any]],
        ucm_info: Optional[Dict[str, Any]],
        rulebook_payload: Optional[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        if not self._narrative_enrichment_enabled():
            return []

        category = resolve_esg_category(dp_meta, ucm_info)
        if not category:
            logger.info(
                "dp_rag: narrative enrichment skipped — no E/S/G category (dp_id=%s)",
                dp_id,
            )
            return []

        allowlist = get_allowlist_for_category(category)
        if not allowlist:
            return []

        suggestions = await self._llm_select_narrative_supplements(
            dp_id,
            dp_meta,
            ucm_info,
            rulebook_payload,
            category,
            allowlist,
        )
        if not suggestions:
            return []

        out: List[Dict[str, Any]] = []
        seen: Set[Tuple[str, str, Optional[str]]] = set()

        for s in suggestions:
            table = s.get("table")
            column = s.get("column")
            data_type = s.get("data_type")
            rationale = s.get("rationale") or ""

            if table == "environmental_data":
                data_type = None

            if not validate_selection(table, column, data_type):
                logger.warning(
                    "dp_rag: supplement failed allowlist: %s %s %s",
                    table,
                    column,
                    data_type,
                )
                continue

            key = (table, column, data_type)
            if key in seen:
                continue
            seen.add(key)

            rd = await self._query_real_data(company_id, year, table, column, data_type)
            err = rd.get("error") if isinstance(rd, dict) else None
            row: Dict[str, Any] = {
                "table": table,
                "column": column,
                "data_type": data_type,
                "rationale": rationale,
                "value": rd.get("value") if isinstance(rd, dict) else None,
                "period_year": rd.get("period_year") if isinstance(rd, dict) else None,
                "status": rd.get("status") if isinstance(rd, dict) else None,
            }
            if err:
                row["error"] = err
            out.append(row)

        return out

    def _check_outdated(self, data: Dict[str, Any], current_year: int) -> bool:
        """데이터가 오래되었는지 체크 (1년 초과)."""
        period_year = data.get("period_year")
        if period_year is None:
            return False
        return current_year - period_year > 1
    
    def _check_quantitative_suitability(
        self,
        dp_id: str,
        dp_meta: Optional[Dict[str, Any]],
        ucm_info: Optional[Dict[str, Any]],
        rulebook_payload: Optional[Dict[str, Any]],
    ) -> Optional[str]:
        """
        제안 A: rulebook·UCM description 기반 정량 적합성 체크 (보조 안전장치).
        
        정성/서술형 신호가 강하면 경고 메시지 반환.
        
        Returns:
            경고 문자열 (문제 없으면 None)
        """
        # 1. dp_type이 명시적으로 qualitative/narrative/binary면 경고
        if dp_meta:
            dp_type = dp_meta.get("dp_type")
            if dp_type in ("qualitative", "narrative", "binary"):
                return f"DP type is '{dp_type}' — fact_data 수치만으로 부족할 수 있음 (서술/정책 설명 필요)"
        
        # 2. UCM description에 정성 키워드
        if ucm_info:
            desc = (ucm_info.get("column_description") or "").lower()
            name_ko = (ucm_info.get("column_name_ko") or "").lower()
            
            qualitative_keywords = [
                "여부", "방법을", "설명하", "공개하", "기술하", "서술", "정책",
                "whether", "how", "describe", "disclose", "explain"
            ]
            
            matched = [kw for kw in qualitative_keywords if kw in desc or kw in name_ko]
            if matched:
                return f"UCM description suggests qualitative/narrative (keywords: {', '.join(matched[:3])}) — 수치만으로 부족할 수 있음"
        
        # 3. rulebook content에 "설명", "공개" 등
        if rulebook_payload:
            rb_content = (rulebook_payload.get("rulebook_content") or "").lower()
            rb_title = (rulebook_payload.get("rulebook_title") or "").lower()
            
            if any(kw in rb_content or kw in rb_title for kw in ["설명", "공개", "기술", "서술"]):
                return "Rulebook suggests narrative disclosure — 수치 외 서술 필요 가능성"
        
        # 문제 없음
        return None
    
    def _validate_value(
        self,
        value: Any,
        validation_rules: Optional[Dict[str, Any]],
    ) -> Optional[str]:
        """
        validation_rules 적용 (min/max 범위 체크).
        
        Returns:
            에러 메시지 (검증 성공 시 None)
        """
        if value is None or validation_rules is None:
            return None
        
        try:
            # JSONB에서 온 경우 dict일 수 있음
            if isinstance(validation_rules, str):
                import json
                validation_rules = json.loads(validation_rules)
            
            if not isinstance(validation_rules, dict):
                return None
            
            # min 체크
            if "min" in validation_rules:
                min_val = validation_rules["min"]
                if isinstance(value, (int, float)) and value < min_val:
                    return f"Value {value} is below minimum {min_val}"
            
            # max 체크
            if "max" in validation_rules:
                max_val = validation_rules["max"]
                if isinstance(value, (int, float)) and value > max_val:
                    return f"Value {value} exceeds maximum {max_val}"
            
            # type 체크
            if "type" in validation_rules:
                expected_type = validation_rules["type"]
                if expected_type == "integer" and not isinstance(value, int):
                    return f"Expected integer, got {type(value).__name__}"
                elif expected_type == "number" and not isinstance(value, (int, float)):
                    return f"Expected number, got {type(value).__name__}"
            
            return None
            
        except Exception as e:
            logger.warning("Validation check failed: %s", e)
            return None


def make_dp_rag_handler(infra):
    """
    InfraLayer에 바인딩된 dp_rag 핸들러 팩토리.
    
    bootstrap에서 `register("dp_rag", make_dp_rag_handler(infra))` 로 등록한다.
    """

    async def _handler(payload: Dict[str, Any]) -> Dict[str, Any]:
        agent = DpRagAgent(infra)
        return await agent.collect(payload)

    return _handler
