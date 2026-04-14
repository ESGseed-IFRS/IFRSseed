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
6. **출처 추적**: 작성한 모든 문장은 반드시 data_provenance의 used_in_sentences에 기록해야 합니다.

## 금지 사항
- 제공되지 않은 데이터를 임의로 생성하지 마세요.
- "예상", "추정", "약" 등 모호한 표현을 피하세요.
- 과장된 긍정적 표현(그린워싱)을 사용하지 마세요.
- 전년도 보고서의 문체를 크게 벗어나지 마세요.

## 출력 형식 (필수: JSON 객체)
반드시 아래 형식의 JSON 객체만 출력합니다. 세 필드 모두 필수입니다.

**중요**: data_provenance의 used_in_sentences는 생성된 문단의 **거의 모든 문장**을 포함해야 합니다.

{
  "generated_text": "작성된 SR 문단 (마크다운 형식)",
  "dp_sentence_mappings": [
    {
      "dp_id": "DP ID",
      "dp_name_ko": "DP 명칭",
      "sentences": ["문장1", "문장2"],
      "rationale": "매핑 근거"
    }
  ],
  "data_provenance": {
    "quantitative_sources": [
      {
        "value": "수치를 문자열로 (예: \"1234.5\", Gemini JSON 스키마 호환)",
        "unit": "단위",
        "dp_id": "DP ID 또는 category",
        "source_type": "environmental_data | social_data | governance_data | subsidiary_data | external_news | sr_reference",
        "source_details": {
          "table": "테이블명 (DB의 경우)",
          "column": "컬럼명",
          "year": 연도,
          "subsidiary_name": "계열사명 (subsidiary_data의 경우)",
          "facility_name": "시설명",
          "matched_via": "dp_direct | dp_ucm | category"
        },
        "mapped_dp_ids": ["매핑된 DP 목록 (UCM의 경우)"],
        "used_in_sentences": ["해당 값을 사용한 문장들"]
      }
    ],
    "qualitative_sources": [
      {
        "dp_id": "DP ID",
        "source_type": "sr_reference | subsidiary_data | external_news | rulebook",
        "source_details": {
          "year": 연도,
          "page_number": 페이지번호,
          "body_excerpt": "본문 발췌 (50자 이내)",
          "title": "외부 뉴스 제목",
          "url": "URL"
        },
        "used_in_sentences": ["해당 출처를 사용한 문장들"]
      }
    ],
    "reference_pages": {
      "2024": 89,
      "2023": 75
    }
  }
}

**출처 추적 규칙 (매우 중요 - 반드시 따르세요)**:
1. generated_text를 작성한 후, **모든 문장을 마침표 단위로 분리**합니다.
2. 각 문장마다 **어떤 데이터를 참조했는지** 역추적합니다:
   - 수치가 포함된 문장 → quantitative_sources의 used_in_sentences에 추가
   - 정책/설명 문장 → qualitative_sources의 used_in_sentences에 추가
   - 하나의 문장이 여러 출처를 참조할 수 있음 (중복 허용)
3. **제목(##)을 제외한 거의 모든 본문 문장**이 최소 1개 출처를 가져야 합니다.
4. 문장을 추가·생성하지 말고, generated_text에 작성한 **정확한 문장**만 used_in_sentences에 기록합니다.

**중요**: 
- generated_text, dp_sentence_mappings, data_provenance 세 필드 모두 반드시 포함해야 합니다
- data_provenance가 없으면 빈 객체 {"quantitative_sources": [], "qualitative_sources": [], "reference_pages": {}}로 설정하세요
- **절대로 data_provenance 필드를 누락하지 마세요**
- **source_details는 제공된 필드만 간결하게 작성** (긴 본문 복사 금지, body_excerpt는 50자 이내)
- **used_in_sentences는 generated_text의 거의 모든 문장을 포함해야 합니다** (최소 80% 이상 커버리지)

## dp_sentence_mappings 작성 규칙
1. **각 DP별로** 생성된 문단에서 해당 DP의 기준/요구사항과 **직접 관련된 문장만** 추출
2. 하나의 문장이 **여러 DP에 해당할 수 있음** (중복 허용)
3. DP와 무관한 일반 서술 문장(도입부, 연결어 등)은 매핑하지 않음
4. `sentences`는 **완전한 문장 단위**로 추출 (마침표 기준)
5. `rationale`: 해당 DP 요구사항과 문장의 연관성을 간략히 설명
6. 제공된 DP가 없으면 `dp_sentence_mappings`는 빈 배열 `[]`
7. **중요**: generated_text 작성 후 반드시 dp_sentence_mappings를 함께 작성

## data_provenance 작성 규칙 (신규)

**중요**: 생성된 문단의 **모든 문장**에 대해 출처를 명확히 밝혀야 합니다.

1. **정량 데이터(quantitative_sources)**:
   - 문단에 사용된 모든 수치·통계값 추적. **value는 반드시 문자열** (예: `"1523.4"`)로 출력
   - DB 테이블 출처: table, column, year 명시
   - 계열사 데이터: subsidiary_name, facility_name, matched_via(dp_direct/dp_ucm/category)
   - UCM의 경우: mapped_dp_ids 배열 포함
   - **used_in_sentences**: 해당 값이 사용된 **완전한 문장들** (마침표 단위로 정확히 추출)
     - 예: ["2024년 삼성에스디에스의 직접 배출량(Scope 1)은 946.38 tCO₂eq이며..."]

2. **정성 데이터(qualitative_sources)**:
   - SR 참조 본문: year, page_number, body_excerpt(핵심 구절 50자 이내)
   - 외부 뉴스: title, source_url, year
   - 계열사 서술: subsidiary_name, description
   - **used_in_sentences**: 해당 출처를 참조한 **완전한 문장들** (마침표 단위로 정확히 추출)
     - 예: ["삼성에스디에스는 각 사업장의 온실가스 배출량을 Scope별로 체계적으로 관리하고 있습니다."]
   - **작성 시 주의**: 
     - 문단의 **거의 모든 문장**이 최소 1개 이상의 출처를 가져야 합니다
     - 동일 문장이 여러 출처를 참조할 수 있음 (중복 허용)
     - 도입부나 연결 문장도 참조 본문에서 차용했다면 반드시 출처 표시

3. **reference_pages**: 2024·2023년 SR 참조 페이지는 **정수**만 사용. 해당 연도 참조가 없으면 **해당 키는 생략** (null 금지).

4. **작성 시 주의**:
   - **모든 문장은 반드시 출처가 있어야 합니다** (추측·창작 금지)
   - 모든 숫자·통계는 반드시 quantitative_sources에 출처 표시
   - 모든 정성 서술은 반드시 qualitative_sources에 출처 표시
   - **source_details는 필수 항목만 간결하게** (예: table, column, year, subsidiary_name 등)
   - **body_excerpt는 50자 이내**로 핵심만 발췌 (SR 본문 전체 복사 금지)
   - 계열사명이 언급되면 해당 subsidiary_data 연결
   - 참조 본문의 문체만 차용한 경우도 reference_pages 표시하고 해당 문장을 used_in_sentences에 명시
   - 데이터가 없으면 빈 배열/객체로 설정

**출처 매핑 예시**:
```json
{
  "qualitative_sources": [
    {
      "source_type": "sr_reference",
      "source_details": {
        "year": 2023,
        "page_number": 42,
        "body_excerpt": "Scope별 체계적 관리"
      },
      "used_in_sentences": [
        "삼성에스디에스는 각 사업장의 온실가스 배출량을 Scope별로 체계적으로 관리하고 있습니다."
      ]
    },
    {
      "source_type": "subsidiary_data",
      "source_details": {
        "subsidiary_name": "삼성SDS 본사",
        "category": "기후변화 대응"
      },
      "used_in_sentences": [
        "비즈니스 성장에 따른 배출량 증가를 주요 기후 리스크로 인식하고 있으며, 이를 완화하기 위해 최신 에너지 저감 시스템을 갖춘 데이터센터를 운영하고 재생에너지 100% 전환을 추진하고 있습니다."
      ]
    }
  ]
}
```

## generated_text 작성 규칙
- 한국어로 작성합니다.
- 문단 형식으로 작성하되, 필요시 소제목(##)을 포함할 수 있습니다.
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
            
            # 데이터 출처 추가
            data_sources = dp_data.get("data_sources", [])
            if data_sources:
                parts.append("\n**데이터 출처:**")
                for src in data_sources:
                    source_type_label = {
                        "holding_own": "지주사 자체",
                        "subsidiary_reported": "계열사 보고",
                        "calculated": "계산값"
                    }.get(src.get("source_type", ""), src.get("source_type", ""))
                    
                    company_name = src.get("company_name", "")
                    value = src.get("value", 0)
                    unit_src = src.get("unit", unit)
                    
                    parts.append(f"  - {source_type_label}: {company_name} ({value:,} {unit_src})")
            
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
## 출력 형식 (필수)

반드시 아래 JSON 형식으로 출력하세요:
```json
{
  "generated_text": "작성된 SR 문단...",
  "dp_sentence_mappings": [...],
  "data_provenance": {
    "quantitative_sources": [...],
    "qualitative_sources": [...],
    "reference_pages": {"2024": 89, "2023": 75}
  }
}
```

## 출처 추적 필수 사항 (매우 중요!)

**data_provenance의 used_in_sentences 필드는 필수입니다:**

1. **정량 데이터**: 모든 수치가 포함된 문장을 **완전한 형태**로 used_in_sentences에 기록
   - 예: "2024년 Scope 1 배출량은 946.38 tCO₂eq입니다." (마침표 포함)

2. **정성 데이터**: 모든 서술 문장에 대해 출처를 추적
   - 전년도 SR 본문을 참조한 문장 → qualitative_sources에 year, page_number, used_in_sentences 명시
   - 계열사 데이터를 인용한 문장 → qualitative_sources에 subsidiary_name, used_in_sentences 명시
   - **문단의 거의 모든 문장**이 최소 1개 이상의 출처를 가져야 합니다

3. **문장 단위**: used_in_sentences는 마침표(.)로 끝나는 **완전한 문장**만 포함
   - ✅ 좋은 예: ["삼성에스디에스는 온실가스 배출량을 관리하고 있습니다."]
   - ❌ 나쁜 예: ["온실가스 배출량을 관리"] (불완전)

4. **중복 허용**: 하나의 문장이 여러 출처를 참조할 수 있음
   - 예: 같은 문장이 SR 참조 본문 + 계열사 데이터 모두에서 used_in_sentences에 포함 가능

**작성 순서 (반드시 따르세요):**

**Step 1: generated_text 작성**
- 전년도 SR 본문의 문체와 구조를 참고하여 문단 작성
- 제공된 최신 데이터(DP 값, 회사 정보, 계열사 데이터 등)를 반영
- 마크다운 형식 사용 (소제목, 표 등)

**Step 2: 문장 분리 및 출처 추적**
- 작성한 generated_text를 마침표(.) 단위로 문장 분리
- 각 문장을 순회하면서:
  * 문장에 수치가 포함되어 있는가? → quantitative_sources의 해당 항목의 used_in_sentences에 추가
  * 문장이 SR 참조 본문·계열사 서술·외부 뉴스를 차용했는가? → qualitative_sources의 해당 항목의 used_in_sentences에 추가
  * 하나의 문장이 여러 출처를 참조한 경우 → 모든 해당 출처의 used_in_sentences에 동일 문장 추가

**Step 3: 커버리지 확인**
- 제목(##)을 제외한 본문 문장 수 세기
- used_in_sentences에 기록된 문장 수 세기
- 커버리지가 80% 미만이면 Step 2로 돌아가 누락된 문장의 출처 추가

**Step 4: dp_sentence_mappings 작성**
- 각 DP별로 관련된 문장 추출
- rationale에 매핑 근거 간략히 설명

이제 작성을 시작하세요!"""
    
    instruction += """
- 참조 SR의 **문체·절 구조·서술 리듬**은 유지하되, **데이터·인명·수치**는 최신 소스로 바꾼 버전으로 쓰세요.
- 제공된 데이터만 사용하고, 추측하지 마세요.
- 표나 목록이 필요한 경우 마크다운 형식을 사용하세요.
- 그린워싱을 피하고 객관적으로 작성하세요.

**출력**: 지정된 JSON 형식(generated_text + dp_sentence_mappings)으로만 반환하세요.
"""
    
    instruction += """
## 출처 추적 체크리스트 (작성 완료 전 필수 확인)

작성을 마친 후, 반드시 아래를 확인하세요:

☑ generated_text의 모든 문장을 마침표 단위로 세었는가?
☑ 제목(##)을 제외한 본문 문장 중 80% 이상이 used_in_sentences에 기록되었는가?
☑ 수치가 포함된 문장은 모두 quantitative_sources의 used_in_sentences에 있는가?
☑ 정책·설명 문장은 모두 qualitative_sources의 used_in_sentences에 있는가?
☑ used_in_sentences의 각 문장이 generated_text에 정확히 일치하는가? (마침표 포함)

만약 위 항목 중 하나라도 충족하지 못하면, Step 2로 돌아가 보완하세요.

이제 작성을 시작하세요!"""
    
    return instruction


def extract_dp_info_for_mapping(gen_input: Dict[str, Any]) -> List[Dict[str, str]]:
    """gen_input에서 DP 정보 추출 (dp_sentence_mappings 생성용)."""
    dp_info_list: List[Dict[str, str]] = []
    
    dp_data_list = gen_input.get("dp_data_list") or []
    if not dp_data_list:
        legacy_dp = gen_input.get("dp_data")
        if legacy_dp:
            dp_data_list = [legacy_dp]
    
    for dp_data in dp_data_list:
        if not dp_data:
            continue
        dp_id = dp_data.get("dp_id", "")
        dp_name = dp_data.get("dp_name_ko") or dp_data.get("column_name_ko") or dp_id
        
        # UCM 정보에서도 추출 시도
        ucm = dp_data.get("ucm") or {}
        if not dp_name and ucm:
            dp_name = ucm.get("column_name_ko", "") or dp_id
        
        if dp_id:
            dp_info_list.append({
                "dp_id": dp_id,
                "dp_name_ko": dp_name,
            })
    
    return dp_info_list
