"""
Gen Node 프롬프트 템플릿 및 구성 함수
"""
from typing import Any, Dict, List, Optional
import logging

logger = logging.getLogger("ifrs_agent.gen_node.prompts")


SYSTEM_PROMPT = """당신은 IFRS S1/S2, GRI, ESRS 기준서에 정통한 지속가능성 보고서(SR) 작성 전문가입니다.

## 역할
- 기업의 ESG 데이터를 기반으로 전문적이고 정확한 SR 보고서 문단을 작성합니다.
- 전년·전전년 SR **참조 본문**은 **형식(절 구성·소제목)·맥락·문체·톤**을 유지하는 **템플릿**으로 삼고, **인명·수치·구성·주소 등 팩트**는 반드시 아래에 주어진 **최신 데이터**(회사 정보, DP 값, 보조 실데이터, rulebook 요구)로 **갱신**하여 작성합니다.

## 작성 원칙
1. **정확성**: 제공된 데이터만 사용하며, 추측하거나 과장하지 않습니다.
2. **일관성(문체) vs 갱신(팩트)**: 전년·전전년 SR 참조본에서 **문단 흐름·표현 스타일·정보 범위**를 따르되, 그 안에 들어가는 **구체적 사실·숫자·직함·인명**은 참조본을 그대로 베끼지 말고 **최신 데이터 소스**로 바꿉니다. 참조본과 최신 데이터가 다르면 **항상 최신 데이터**가 맞습니다.
3. **명확성**: 전문 용어를 사용하되, 이해하기 쉽게 작성합니다.
4. **객관성**: 그린워싱을 피하고, 사실에 기반한 서술을 합니다.
5. **기준서 준수**: IFRS/GRI/ESRS 요구사항을 반영합니다.

## 금지 사항
- 제공되지 않은 데이터를 임의로 생성하지 마세요.
- "예상", "추정", "약" 등 모호한 표현을 피하세요.
- 과장된 긍정적 표현(그린워싱)을 사용하지 마세요.
- 전년도 보고서의 문체를 크게 벗어나지 마세요.

## 출력 형식
- 한국어로 작성합니다.
- 문단 형식으로 작성하되, 필요시 소제목을 포함할 수 있습니다.
- 수치는 단위와 함께 명확히 표기합니다.
- 표나 목록이 필요한 경우 마크다운 형식을 사용합니다.
"""


def build_user_prompt(
    gen_input: Dict[str, Any],
    validator_feedback: Optional[List[Any]] = None,
) -> str:
    """
    gen_input을 기반으로 사용자 프롬프트 구성

    Args:
        gen_input: Phase 2 필터링된 입력 데이터
        validator_feedback: Phase 3 재시도 시 validator_node가 반환한 errors 목록(있으면 반영 지시)

    Returns:
        완성된 사용자 프롬프트
    """
    sections = []

    # 1. 작성 요청
    sections.append(_build_task_section(gen_input))

    # 2. 참조 데이터 (전년도, 전전년도 SR 본문)
    ref_section = _build_reference_section(gen_input)
    if ref_section:
        sections.append(ref_section)

    # 3. 최신 데이터 (DP 값, 회사 정보 등)
    data_section = _build_latest_data_section(gen_input)
    if data_section:
        sections.append(data_section)

    # 4. 기준서 요구사항 (rulebook, UCM)
    req_section = _build_requirements_section(gen_input)
    if req_section:
        sections.append(req_section)

    # 5. 계열사/외부 데이터
    agg_section = _build_aggregation_section(gen_input)
    if agg_section:
        sections.append(agg_section)

    # 6. 이전 검증 피드백 (validator 재시도 루프)
    fb_section = _build_validator_feedback_section(validator_feedback)
    if fb_section:
        sections.append(fb_section)

    # 7. 작성 지시
    sections.append(_build_instruction_section(gen_input))

    return "\n\n".join(sections)


def _build_validator_feedback_section(feedback: Optional[List[Any]]) -> str:
    """validator_node `errors` → 재작성 지시 섹션."""
    if not feedback:
        return ""
    items: List[str] = []
    for x in feedback:
        s = str(x).strip()
        if s:
            items.append(s[:2000])
    if not items:
        return ""
    items = items[:20]
    lines = [
        "# 이전 검증 피드백 (validator)",
        "",
        "아래 지적을 **반드시 반영**하여 문단을 수정·보완하세요. 동일한 오류를 반복하지 마세요.",
        "",
    ]
    for i, it in enumerate(items, 1):
        lines.append(f"{i}. {it}")
    return "\n".join(lines)


def _build_task_section(gen_input: Dict[str, Any]) -> str:
    """작성 요청 섹션"""
    category = gen_input.get("category", "")
    year = gen_input.get("report_year", 2025)
    
    return f"""# 작성 요청

**카테고리**: {category}
**보고 연도**: {year}년

위 카테고리에 대한 {year}년 SR 보고서 문단을 작성해주세요."""


def _build_reference_section(gen_input: Dict[str, Any]) -> str:
    """전년도/전전년도 SR 본문 제공"""
    parts = [
        "# 참조 데이터 (전년·전전년 SR 본문)",
        "**용도**: 문체·절 구성·서술 맥락·용어 습관을 맞추기 위한 참고입니다. "
        "본문 속 인명·수치·이사 구성 등 **팩트는 이 텍스트를 그대로 쓰지 말고**, "
        "아래 **최신 데이터**(회사 정보·DP·보조 실데이터)로 반영하세요.",
    ]
    
    ref_2024 = gen_input.get("ref_2024") or {}
    ref_2023 = gen_input.get("ref_2023") or {}
    
    has_content = False
    
    # 2024년 본문
    if ref_2024.get("body_text"):
        has_content = True
        body = ref_2024["body_text"]
        
        # 너무 길면 앞부분만 (LLM 컨텍스트 고려)
        if len(body) > 3000:
            body = body[:3000] + "\n\n... (이하 생략)"
        
        parts.append(f"""
## 2024년 보고서 (페이지 {ref_2024.get('page_number', 'N/A')})

{body}
""")
        
        # 이미지 정보
        images = ref_2024.get("images", [])
        if images:
            parts.append("\n### 2024년 사용된 이미지")
            for idx, img in enumerate(images[:5], 1):  # 최대 5개
                img_type = img.get("image_type", "unknown")
                caption = img.get("caption", "N/A")
                parts.append(f"{idx}. {img_type}: {caption}")
    
    # 2023년 본문
    if ref_2023.get("body_text"):
        has_content = True
        body = ref_2023["body_text"]
        
        # 2023은 더 짧게
        if len(body) > 2000:
            body = body[:2000] + "\n\n... (이하 생략)"
        
        parts.append(f"""
## 2023년 보고서 (페이지 {ref_2023.get('page_number', 'N/A')})

{body}
""")
    
    return "\n".join(parts) if has_content else ""


def _build_latest_data_section(gen_input: Dict[str, Any]) -> str:
    """최신 DP 값 및 회사 정보 (다중 DP 지원)"""
    # Phase 1: dp_data_list 우선, 없으면 레거시 dp_data
    dp_data_list = gen_input.get("dp_data_list") or []
    if not dp_data_list:
        legacy_dp = gen_input.get("dp_data")
        if legacy_dp:
            dp_data_list = [legacy_dp]
    
    if not dp_data_list:
        return ""
    
    parts = ["# 최신 데이터 (업데이트 필요)"]
    
    # 다중 DP 루프
    for idx, dp_data in enumerate(dp_data_list, 1):
        if not dp_data:
            continue
        
        # DP 기본 정보
        dp_id = dp_data.get("dp_id")
        dp_name = dp_data.get("dp_name_ko") or dp_id
        dp_type = dp_data.get("dp_type", "unknown")
        
        if len(dp_data_list) > 1:
            parts.append(f"\n## Data Point {idx}: {dp_name}")
        else:
            parts.append(f"\n## Data Point: {dp_name}")
        
        if dp_id:
            parts.append(f"- **DP ID**: {dp_id}")
            parts.append(f"- **유형**: {dp_type}")
        
        # 정량 DP: 최신 값
        latest_value = dp_data.get("latest_value")
        if latest_value is not None:
            unit = dp_data.get("unit", "")
            year = dp_data.get("year", "N/A")
            parts.append(f"- **{year}년 값**: {latest_value} {unit}")
            
            # 적합성 경고
            warning = dp_data.get("suitability_warning")
            if warning:
                parts.append(f"\n⚠️ **주의**: {warning}")
        
        # 정성 DP: 설명
        description = dp_data.get("description")
        if description and dp_type in ("narrative", "qualitative"):
            parts.append(f"\n**요구사항**: {description}")

        # narrative 보조 실데이터 (dp_rag: social/environmental/governance)
        supp = dp_data.get("supplementary_real_data")
        if supp and isinstance(supp, list) and len(supp) > 0:
            parts.append(
                "\n### 보조 실데이터 (DB, 서술형 공시 작성 참고용)\n"
                "아래 수치는 rulebook·DP 맥락에 맞게 자동 선별되었습니다. "
                "전년·전전년 SR 참조본의 숫자와 다르면 **이쪽(최신 DB)** 을 따르고, "
                "참조본은 문체·구조만 유지합니다. 보조 지표는 문맥에 맞을 때만 인용합니다."
            )
            for supp_idx, row in enumerate(supp, 1):
                if not isinstance(row, dict):
                    continue
                tbl = row.get("table", "")
                col = row.get("column", "")
                dt = row.get("data_type")
                val = row.get("value")
                why = row.get("rationale") or ""
                loc = f"{tbl}.{col}" + (f" ({dt})" if dt else "")
                if row.get("error"):
                    parts.append(f"{supp_idx}. {loc}: 조회 실패 — {row.get('error')}")
                else:
                    parts.append(f"{supp_idx}. {loc}: {val} — {why}")
    
    # 회사 프로필 (include_company_profile=true) — DB company_info 현행값
    # 첫 번째 DP에만 포함 (중복 방지)
    if dp_data_list:
        profile = dp_data_list[0].get("company_profile")
        if profile:
            parts.append(
                "\n## 회사 정보 (최신 팩트 소스 — 인명·구성·주소·상장 등은 참조 SR보다 여기 기준)"
            )

            def _line(label: str, val: Any) -> None:
                if val is not None and val != "":
                    parts.append(f"- **{label}**: {val}")

            def _json_snip(val: Any, max_len: int = 600) -> str:
                if val is None or val == "":
                    return ""
                s = val if isinstance(val, str) else str(val)
                if len(s) > max_len:
                    return s[:max_len] + "…"
                return s

            _line("회사명(국문)", profile.get("company_name_ko"))
            _line("회사명(영문)", profile.get("company_name_en"))
            _line("사업자등록번호", profile.get("business_registration_number"))
            _line("대표이사", profile.get("representative_name"))
            _line("산업", profile.get("industry"))
            _line("웹사이트", profile.get("website"))
            mission = profile.get("mission")
            if mission:
                parts.append(f"- **미션**: {mission}")
            vision = profile.get("vision")
            if vision:
                parts.append(f"- **비전**: {vision}")

            eg = _json_snip(profile.get("esg_goals"))
            if eg:
                parts.append(f"- **ESG 목표(JSON)**: {eg}")
            _line("탄소중립 목표연도", profile.get("carbon_neutral_target_year"))
            _line("전체 임직원 수", profile.get("total_employees"))
            ms = _json_snip(profile.get("major_shareholders"))
            if ms:
                parts.append(f"- **주요 주주(JSON)**: {ms}")
            st = _json_snip(profile.get("stakeholders"))
            if st:
                parts.append(f"- **이해관계자(JSON)**: {st}")

            parts.append("\n### 지배구조·경영진")
            _line("이사회 의장", profile.get("board_chairman_name"))
            _line("이사회 구성원 수", profile.get("board_total_members"))
            _line("사외이사 수", profile.get("board_independent_members"))
            _line("여성 이사 수", profile.get("board_female_members"))
            _line("감사위원회 위원장", profile.get("audit_committee_chairman"))
            if profile.get("esg_committee_exists") is not None:
                parts.append(
                    f"- **ESG위원회 존재**: {profile.get('esg_committee_exists')}"
                )
            _line("ESG위원회 위원장", profile.get("esg_committee_chairman"))
            _line("CFO", profile.get("cfo_name"))
            _line("CSO", profile.get("cso_name"))

            parts.append("\n### 본점·상장")
            _line("본사 주소", profile.get("headquarters_address"))
            _line("본사 도시", profile.get("headquarters_city"))
            _line("결산일", profile.get("fiscal_year_end"))
            _line("종목코드", profile.get("stock_code"))
            _line("상장시장", profile.get("listing_market"))
            _line("매출액(원)", profile.get("total_revenue_krw"))
            _line("총자산(원)", profile.get("total_assets_krw"))

            parts.append("\n### 인력")
            _line("여성 임직원 수", profile.get("female_employees"))
            _line("여성 임직원 비율(%)", profile.get("female_ratio_percent"))
            _line("정규직 수", profile.get("permanent_employees"))
            _line("계약직 수", profile.get("contract_employees"))

            parts.append("\n### 지속가능경영 공시 체계")
            _line("지속가능경영보고서 발간", profile.get("sustainability_report_published"))
            _line("지속가능경영보고서 기준연도", profile.get("sustainability_report_year"))
            _line("GRI 기준 버전", profile.get("gri_standards_version"))
            if profile.get("tcfd_aligned") is not None:
                parts.append(f"- **TCFD 정렬**: {profile.get('tcfd_aligned')}")
            if profile.get("cdp_participant") is not None:
                parts.append(f"- **CDP 참여**: {profile.get('cdp_participant')}")
            if profile.get("iso14001_certified") is not None:
                parts.append(f"- **ISO14001**: {profile.get('iso14001_certified')}")
            if profile.get("iso45001_certified") is not None:
                parts.append(f"- **ISO45001**: {profile.get('iso45001_certified')}")
            if profile.get("submitted_to_final_report") is not None:
                parts.append(
                    f"- **최종 보고서 제출 여부**: {profile.get('submitted_to_final_report')}"
                )

    return "\n".join(parts) if len(parts) > 1 else ""


def _build_requirements_section(gen_input: Dict[str, Any]) -> str:
    """rulebook, UCM 검증 규칙 등 (다중 DP 지원)"""
    dp_data_list = gen_input.get("dp_data_list") or []
    if not dp_data_list:
        legacy_dp = gen_input.get("dp_data")
        if legacy_dp:
            dp_data_list = [legacy_dp]
    
    if not dp_data_list:
        return ""
    
    parts = []
    
    # 각 DP별 rulebook/ucm 처리
    for idx, dp_data in enumerate(dp_data_list, 1):
        if not dp_data:
            continue
        
        dp_id = dp_data.get("dp_id", f"DP{idx}")
        
        # Rulebook (정성 DP 필수)
        rulebook = dp_data.get("rulebook")
        if rulebook and rulebook.get("rulebook_content"):
            if not parts:
                parts.append("# 기준서 요구사항")
            
            title = rulebook.get("rulebook_title", "Rulebook")
            if len(dp_data_list) > 1:
                parts.append(f"\n## {title} (DP: {dp_id})")
            else:
                parts.append(f"\n## {title}")
            parts.append(f"\n{rulebook['rulebook_content']}")
            
            # 핵심 용어
            key_terms = rulebook.get("key_terms")
            if key_terms and isinstance(key_terms, list):
                parts.append("\n**핵심 용어**: " + ", ".join(key_terms))
        
        # UCM 검증 규칙
        ucm = dp_data.get("ucm")
        if ucm and ucm.get("validation_rules"):
            if not parts:
                parts.append("# 검증 규칙")
            
            if len(dp_data_list) > 1:
                parts.append(f"\n## UCM 검증 (DP: {dp_id})")
            else:
                parts.append(f"\n## UCM 검증")
            parts.append(f"- **컬럼**: {ucm.get('column_name_ko', 'N/A')}")
            parts.append(f"- **규칙**: {ucm['validation_rules']}")
    
    return "\n".join(parts) if parts else ""


def _build_aggregation_section(gen_input: Dict[str, Any]) -> str:
    """subsidiary_data, external_company_data"""
    agg_data = gen_input.get("agg_data") or {}
    if not agg_data:
        return ""
    
    parts = ["# 추가 참고 데이터"]
    has_content = False
    
    # 2024년 계열사 데이터
    data_2024 = agg_data.get("2024") or {}
    subsidiary = data_2024.get("subsidiary_data", [])
    
    if subsidiary:
        has_content = True
        parts.append("\n## 계열사/사업장 상세 (2024년)")
        
        for idx, sub in enumerate(subsidiary[:3], 1):  # 최대 3개
            facility_name = sub.get("facility_name", "N/A")
            parts.append(f"\n### {idx}. {facility_name}")
            
            description = sub.get("description")
            if description:
                if len(description) > 200:
                    description = description[:200] + "..."
                parts.append(description)
            
            quant = sub.get("quantitative_data")
            if quant:
                parts.append(f"**정량 데이터**: {quant}")
    
    # 외부 보도
    external = data_2024.get("external_company_data", [])
    if external:
        has_content = True
        parts.append("\n## 언론 보도/뉴스 (2024년)")
        
        for idx, ext in enumerate(external[:2], 1):  # 최대 2개
            title = ext.get("title", "N/A")
            parts.append(f"\n{idx}. **{title}**")
            
            body_text = ext.get("body_text")
            if body_text:
                if len(body_text) > 150:
                    body_text = body_text[:150] + "..."
                parts.append(f"   {body_text}")
    
    return "\n".join(parts) if has_content else ""


def _build_instruction_section(gen_input: Dict[str, Any]) -> str:
    """최종 작성 지시"""
    category = gen_input.get("category", "")
    year = gen_input.get("report_year", 2025)
    
    dp_data = gen_input.get("dp_data") or {}
    dp_type = dp_data.get("dp_type", "quantitative")
    
    instruction = f"""# 작성 지시

**{year}년 "{category}"** SR 문단을 작성하세요.

- **전년·전전년 참조 SR**: 형식·맥락·문체를 맞추는 용도입니다.
- **회사 정보·DP·보조 실데이터·rulebook**: 보고 **연도에 맞는 팩트**를 넣는 용도입니다. 참조 SR과 수치·인명이 다르면 **최신 쪽**을 사용합니다.

## 작성 가이드
"""
    
    if dp_type in ("narrative", "qualitative"):
        instruction += """
- **정성 DP**: 기준서 요구사항(rulebook)을 충족하는 서술형 답변을 작성하세요.
- 회사의 정책, 절차, 접근 방식을 구체적으로 설명하세요.
- 가능한 경우 사례나 예시를 포함하세요.
"""
    else:
        instruction += """
- **정량 DP**: 최신 수치 데이터를 명확히 표기하세요.
- 전년도 대비 변화가 있다면 언급하세요.
- 수치의 의미와 맥락을 설명하세요.
"""
    
    instruction += """
- 참조 SR의 **문체·절 구조·서술 리듬**은 유지하되, **데이터·인명·수치**는 최신 소스로 바꾼 버전으로 쓰세요.
- 제공된 데이터만 사용하고, 추측하지 마세요.
- 표나 목록이 필요한 경우 마크다운 형식을 사용하세요.
- 그린워싱을 피하고 객관적으로 작성하세요.

**출력**: 완성된 문단만 반환하세요 (메타 설명 없이).
"""
    
    return instruction
