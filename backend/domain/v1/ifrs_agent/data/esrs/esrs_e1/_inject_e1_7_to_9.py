# Inject ESRS E1 paras 56–70: E1-7, E1-8, E1-9 into datapoint.json and rulebook.json.
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DP_PATH = ROOT / "datapoint.json"
RB_PATH = ROOT / "rulebook.json"

V = ["원문 문단·항목에 대응하는 서술·교차참조가 있는지 확인"]


def leaf(
    dp_id: str,
    code: str,
    ko: str,
    en: str,
    desc: str,
    parent: str,
    *,
    topic: str,
    sub: str,
    dr="필수",
    dp_type="narrative",
    unit=None,
    val=None,
):
    return {
        "dp_id": dp_id,
        "dp_code": code,
        "name_ko": ko,
        "name_en": en,
        "description": desc,
        "standard": "ESRS",
        "category": "E",
        "topic": topic,
        "subtopic": sub,
        "dp_type": dp_type,
        "unit": unit,
        "equivalent_dps": [],
        "parent_indicator": parent,
        "child_dps": [],
        "financial_linkages": [],
        "financial_impact_type": None,
        "disclosure_requirement": dr,
        "reporting_frequency": "연간",
        "validation_rules": val or list(V),
        "value_range": None,
    }


def parent_dp(dp_id, code, ko, en, desc, p, children, topic, sub, val=None):
    return {
        "dp_id": dp_id,
        "dp_code": code,
        "name_ko": ko,
        "name_en": en,
        "description": desc,
        "standard": "ESRS",
        "category": "E",
        "topic": topic,
        "subtopic": sub,
        "dp_type": "narrative",
        "unit": None,
        "equivalent_dps": [],
        "parent_indicator": p,
        "child_dps": children,
        "financial_linkages": [],
        "financial_impact_type": None,
        "disclosure_requirement": "필수",
        "reporting_frequency": "연간",
        "validation_rules": val or list(V),
        "value_range": None,
    }


def slug(dp_id: str) -> str:
    return dp_id.removeprefix("ESRSE1-").lower().replace("-", "_")


def mk_rb(dp_id: str, title: str, pref: str, dr="필수", cross=None):
    s = slug(dp_id)
    rid = "RULE_" + dp_id.replace("-", "_").upper()
    chk = "ESRSE1_" + s.upper()
    return {
        "rulebook_id": rid,
        "standard_id": "ESRSE1",
        "primary_dp_id": dp_id,
        "section_name": title,
        "section_content": f"{pref}. datapoint.json description 참고.",
        "validation_rules": {
            "section_type": "disclosure_requirement",
            "paragraph_reference": pref,
            "key_terms": ["ESRS E1", "climate change"],
            "required_actions": [
                {
                    "action": "disclose_esrse1_" + s,
                    "description": title,
                    "mandatory": True,
                }
            ],
            "verification_checks": [
                {
                    "check_id": chk,
                    "description": title,
                    "expected": "esrse1_" + s + "_traceable",
                }
            ],
            "cross_references": cross or [],
        },
        "related_dp_ids": [dp_id],
        "rulebook_title": title,
        "disclosure_requirement": dr,
        "version": "1.0",
        "is_active": True,
        "is_primary": False,
        "effective_date": "2024-01-01",
        "mapping_notes": None,
        "conflicts_with": [],
    }


def mk_parent_rb(dp_id: str, title: str, pref: str, child_ids: list[str], cross=None):
    s = slug(dp_id)
    rid = "RULE_" + dp_id.replace("-", "_").upper()
    chk = "ESRSE1_" + s.upper()
    return {
        "rulebook_id": rid,
        "standard_id": "ESRSE1",
        "primary_dp_id": dp_id,
        "section_name": title,
        "section_content": f"{pref}. 하위 문단은 datapoint.json 참고.",
        "validation_rules": {
            "section_type": "disclosure_requirement",
            "paragraph_reference": pref,
            "key_terms": ["ESRS E1", "climate change"],
            "required_actions": [
                {
                    "action": "disclose_esrse1_" + s,
                    "description": title,
                    "mandatory": True,
                }
            ],
            "verification_checks": [
                {
                    "check_id": chk,
                    "description": title,
                    "expected": "esrse1_" + s + "_traceable",
                }
            ],
            "cross_references": cross or [],
        },
        "related_dp_ids": [dp_id] + child_ids,
        "rulebook_title": title,
        "disclosure_requirement": "필수",
        "version": "1.0",
        "is_active": True,
        "is_primary": False,
        "effective_date": "2024-01-01",
        "mapping_notes": None,
        "conflicts_with": [],
    }


# —— Build datapoints ——
E1_7_CHILDREN = [
    "ESRSE1-E1-7-56-a",
    "ESRSE1-E1-7-56-b",
    "ESRSE1-E1-7-57-a",
    "ESRSE1-E1-7-57-b",
    "ESRSE1-E1-7-58-a",
    "ESRSE1-E1-7-58-b",
    "ESRSE1-E1-7-59-a",
    "ESRSE1-E1-7-59-b",
    "ESRSE1-E1-7-60",
    "ESRSE1-E1-7-61-a",
    "ESRSE1-E1-7-61-b",
    "ESRSE1-E1-7-61-c",
]

E1_8_CHILDREN = [
    "ESRSE1-E1-8-62",
    "ESRSE1-E1-8-63-a",
    "ESRSE1-E1-8-63-b",
    "ESRSE1-E1-8-63-c",
    "ESRSE1-E1-8-63-d",
]

E1_9_CHILDREN = [
    "ESRSE1-E1-9-64-a",
    "ESRSE1-E1-9-64-b",
    "ESRSE1-E1-9-64-c",
    "ESRSE1-E1-9-65-a",
    "ESRSE1-E1-9-65-b",
    "ESRSE1-E1-9-66-a",
    "ESRSE1-E1-9-66-b",
    "ESRSE1-E1-9-66-c",
    "ESRSE1-E1-9-66-d",
    "ESRSE1-E1-9-67-a",
    "ESRSE1-E1-9-67-b",
    "ESRSE1-E1-9-67-c",
    "ESRSE1-E1-9-67-d",
    "ESRSE1-E1-9-67-e",
    "ESRSE1-E1-9-68-a",
    "ESRSE1-E1-9-68-b",
    "ESRSE1-E1-9-69-a",
    "ESRSE1-E1-9-69-b",
    "ESRSE1-E1-9-70",
]

NEW_DP = [
    parent_dp(
        "ESRSE1-SEC-5",
        "ESRS_E1_SEC_5_REMOVALS_PRICING_FINANCIAL",
        "5. 제거·크레딧·내부가격·재무영향",
        "Section 5 Removals, credits, internal pricing, financial effects",
        "문단 56~70: E1-7(온실가스 제거·탄소 크레딧·순제로·중립성 주장), E1-8(내부 탄소 가격), E1-9(물리·전환 위험 및 기회의 예상 재무영향 등).",
        "ESRSE1",
        ["ESRSE1-E1-7", "ESRSE1-E1-8", "ESRSE1-E1-9"],
        "기타 공시",
        "Section 5",
        val=["E1-7~E1-9가 문단 56~70·교차참조와 정합하는지 확인"],
    ),
    parent_dp(
        "ESRSE1-E1-7",
        "ESRS_E1_E1_7_GHG_REMOVALS_CREDITS",
        "공개 요건 E1-7: 탄소 크레딧을 통한 온실가스 제거·감축 프로젝트",
        "Disclosure Requirement E1-7: GHG removals and mitigation projects via carbon credits",
        "문단 56~61: 56(a)(b) 제거·저장 및 가치사슬 외 크레딧 재무, 57 목적, 58·59 세부, 60 순제로 목표(조건부), 61 온실가스 중립 주장(조건부).",
        "ESRSE1-SEC-5",
        E1_7_CHILDREN,
        "제거·크레딧",
        "E1-7",
        val=["E1-4·문단 30·60·61 교차참조 확인"],
    ),
    leaf(
        "ESRSE1-E1-7-56-a",
        "ESRS_E1_E1_7_56_A_REMOVALS_STORAGE",
        "문단 56-(a): 자체·가치사슬 프로젝트 온실가스 제거·저장(tCO₂eq)",
        "Para 56 (a): GHG removals and storage from own ops / value chain projects",
        "자체 운영에서 개발하거나 상·하류 가치사슬에서 기여한 프로젝트로 인한 온실가스 제거 및 저장량(CO₂eq 메트릭 톤)을 공개합니다.",
        "ESRSE1-E1-7",
        topic="제거·크레딧",
        sub="E1-7",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    leaf(
        "ESRSE1-E1-7-56-b",
        "ESRS_E1_E1_7_56_B_CREDITS_OUTSIDE_VC",
        "문단 56-(b): 크레딧 구매로 자금한 가치사슬 외 감축·제거",
        "Para 56 (b): Reductions/removals outside VC financed via carbon credits",
        "탄소 크레딧 구매를 통해 가치사슬 외 완화 프로젝트로부터의 온실가스 배출 감축량 또는 제거량을 공개합니다.",
        "ESRSE1-E1-7",
        topic="제거·크레딧",
        sub="E1-7",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    leaf(
        "ESRSE1-E1-7-57-a",
        "ESRS_E1_E1_7_57_A_OBJECTIVE_REMOVALS",
        "문단 57-(a): 공시 목적—대기 중 온실가스 제거·순제로 관련 활동 이해",
        "Para 57 (a): Objective — removals, net-zero related actions (para 60)",
        "대기 중 온실가스 영구 제거 또는 적극적 제거 지원 활동(문단 60 순제로 목표 달성 잠재 조치 포함)에 대한 이해를 제공합니다.",
        "ESRSE1-E1-7",
        topic="제거·크레딧",
        sub="E1-7",
    ),
    leaf(
        "ESRSE1-E1-7-57-b",
        "ESRS_E1_E1_7_57_B_OBJECTIVE_CREDITS",
        "문단 57-(b): 공시 목적—자발적 시장 크레딧 규모·품질·중립성 주장",
        "Para 57 (b): Objective — voluntary carbon credits, neutrality claims (see 61)",
        "자발적 시장에서 구매·구매 예정인 탄소 크레딧의 규모와 품질을 이해할 수 있게 하여 잠재적 온실가스 중립성 주장을 뒷받침합니다(61항 참조).",
        "ESRSE1-E1-7",
        topic="제거·크레딧",
        sub="E1-7",
    ),
    leaf(
        "ESRSE1-E1-7-58-a",
        "ESRS_E1_E1_7_58_A_REMOVALS_DETAIL",
        "문단 58-(a): 56(a) 제거·저장 총량 세분(자체/가치사슬·활동별)",
        "Para 58 (a): Disaggregate removals by own ops vs VC, by removal activity",
        "해당 시: 제거·저장 총량(tCO₂eq)을 자체 운영·상하류 가치사슬별로 구분하고 제거 활동별로 세분하여 공개합니다.",
        "ESRSE1-E1-7",
        topic="제거·크레딧",
        sub="E1-7",
        dr="조건부",
        val=V + ["56(a) 정보 공시 시 적용"],
    ),
    leaf(
        "ESRSE1-E1-7-58-b",
        "ESRS_E1_E1_7_58_B_METHODOLOGY_REMOVALS",
        "문단 58-(b): 제거 산정 가정·방법론·프레임워크",
        "Para 58 (b): Assumptions, methodologies, frameworks for removals",
        "해당 시: 적용한 계산 가정, 방법론 및 프레임워크를 공개합니다.",
        "ESRSE1-E1-7",
        topic="제거·크레딧",
        sub="E1-7",
        dr="조건부",
    ),
    leaf(
        "ESRSE1-E1-7-59-a",
        "ESRS_E1_E1_7_59_A_CREDITS_CANCELLED",
        "문단 59-(a): 검증·보고기간 내 취소된 가치사슬 외 크레딧(tCO₂eq)",
        "Para 59 (a): Verified credits cancelled in reporting period (outside VC)",
        "해당 시: 인정 품질 기준에 따라 검증되고 보고 기간 내 취소된 가치사슬 외 탄소 크레딧 총량(tCO₂eq)을 공개합니다.",
        "ESRSE1-E1-7",
        topic="제거·크레딧",
        sub="E1-7",
        dr="조건부",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    leaf(
        "ESRSE1-E1-7-59-b",
        "ESRS_E1_E1_7_59_B_CREDITS_FUTURE",
        "문단 59-(b): 향후 취소 예정 크레딧·계약 기반 여부",
        "Para 59 (b): Future cancellation of credits, contractual basis",
        "해당 시: 가치사슬 외 향후 취소 예정 탄소 크레딧 총량(tCO₂eq) 및 기존 계약 기반 여부를 공개합니다.",
        "ESRSE1-E1-7",
        topic="제거·크레딧",
        sub="E1-7",
        dr="조건부",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    leaf(
        "ESRSE1-E1-7-60",
        "ESRS_E1_E1_7_60_NET_ZERO_EXPLANATION",
        "문단 60: 순제로 목표 공개 시 잔여 배출 중화 계획(조건부)",
        "Para 60: Net-zero target — neutralise residual emissions after ~90–95% cut",
        "E1-4에 따른 총 감축 목표 외 순제로 목표를 공개하는 경우, 범위·방법론·프레임워크와(부문 경로에 따른 정당화 가능) 약 90~95% 감축 후 잔여 배출을 자체·가치사슬 제거 등으로 어떻게 중화할지 설명합니다.",
        "ESRSE1-E1-7",
        topic="제거·크레딧",
        sub="E1-7",
        dr="조건부",
        val=V + ["순제로 목표 공개 시"],
    ),
    leaf(
        "ESRSE1-E1-7-61-a",
        "ESRS_E1_E1_7_61_A_NEUTRALITY_AND_REDUCTION_TARGETS",
        "문단 61-(a): 중립 주장과 E1-4 감축 목표 병행 여부·방법(조건부)",
        "Para 61 (a): GHG neutrality claims vs E1-4 reduction targets",
        "온실가스 중립 주장을 공개한 경우: 주장이 E1-4 감축 목표와 동반되는지 및 그 방법을 설명합니다.",
        "ESRSE1-E1-7",
        topic="제거·크레딧",
        sub="E1-7",
        dr="조건부",
        val=V + ["중립 주장 공개 시"],
    ),
    leaf(
        "ESRSE1-E1-7-61-b",
        "ESRS_E1_E1_7_61_B_CREDITS_VS_TARGETS",
        "문단 61-(b): 크레딧 의존이 감축·순제로 목표 달성을 저해하지 않는지(조건부)",
        "Para 61 (b): Credits do not impede reduction or net-zero targets",
        "중립 주장 및 탄소 크레딧 의존이 온실가스 감축 목표 또는 해당 시 순제로 목표 달성을 방해·저해하지 않는지 및 방법을 설명합니다.",
        "ESRSE1-E1-7",
        topic="제거·크레딧",
        sub="E1-7",
        dr="조건부",
    ),
    leaf(
        "ESRSE1-E1-7-61-c",
        "ESRS_E1_E1_7_61_C_CREDIT_INTEGRITY",
        "문단 61-(c): 사용 크레딧의 신뢰성·무결성·품질 기준(조건부)",
        "Para 61 (c): Credibility and integrity of credits, quality standards",
        "사용된 탄소 크레딧의 신뢰성과 무결성을 인정된 품질 기준 참조로 포함하여 설명합니다.",
        "ESRSE1-E1-7",
        topic="제거·크레딧",
        sub="E1-7",
        dr="조건부",
    ),
    parent_dp(
        "ESRSE1-E1-8",
        "ESRS_E1_E1_8_INTERNAL_CARBON_PRICING",
        "공개 요건 E1-8: 내부 탄소 가격 책정",
        "Disclosure Requirement E1-8: Internal carbon pricing",
        "문단 62: 내부 탄소 가격 제도 적용 여부 및 의사결정·정책·목표 이행 기여. 문단 63: 62항 정보에 포함할 세부(a)~(d).",
        "ESRSE1-SEC-5",
        E1_8_CHILDREN,
        "내부 탄소 가격",
        "E1-8",
    ),
    leaf(
        "ESRSE1-E1-8-62",
        "ESRS_E1_E1_8_62_ICP_USE",
        "문단 62: 내부 탄소 가격 적용 여부·의사결정·정책 연계",
        "Para 62: Whether internal carbon pricing; decision-making and targets",
        "내부 탄소 가격 책정 제도 적용 여부를 공개하고, 적용 시 의사결정 기여와 기후 정책·목표 이행 촉진을 설명합니다.",
        "ESRSE1-E1-8",
        topic="내부 탄소 가격",
        sub="E1-8",
    ),
    leaf(
        "ESRSE1-E1-8-63-a",
        "ESRS_E1_E1_8_63_A_ICP_TYPE",
        "문단 63-(a): 내부 탄소 가격 체계 유형",
        "Para 63 (a): Type of scheme (shadow price, fee, fund, etc.)",
        "그림자 가격(CapEx·R&D 등), 내부 탄소 부담금, 내부 탄소 기금 등 체계 유형을 공개합니다.",
        "ESRSE1-E1-8",
        topic="내부 탄소 가격",
        sub="E1-8",
        dr="조건부",
        val=V + ["62항 적용 시"],
    ),
    leaf(
        "ESRSE1-E1-8-63-b",
        "ESRS_E1_E1_8_63_B_SCOPE_APPLICATION",
        "문단 63-(b): 제도 적용 범위(활동·지역·법인 등)",
        "Para 63 (b): Scope of application",
        "탄소 가격 제도의 구체적 적용 범위(활동, 지역, 법인 등)를 공개합니다.",
        "ESRSE1-E1-8",
        topic="내부 탄소 가격",
        sub="E1-8",
        dr="조건부",
    ),
    leaf(
        "ESRSE1-E1-8-63-c",
        "ESRS_E1_E1_8_63_C_PRICE_ASSUMPTIONS",
        "문단 63-(c): 적용 탄소 가격·가정·출처·방법론(과학 기반 경로 연계)",
        "Para 63 (c): Price level, assumptions, sources, methodology",
        "적용 탄소 가격, 핵심 가정, 출처·타당성 근거, 필요 시 산정 방법론 및 과학 기반 가격 경로와의 연계를 공개합니다.",
        "ESRSE1-E1-8",
        topic="내부 탄소 가격",
        sub="E1-8",
        dr="조건부",
    ),
    leaf(
        "ESRSE1-E1-8-63-d",
        "ESRS_E1_E1_8_63_D_COVERED_EMISSIONS_SHARE",
        "문단 63-(d): 범위별 포괄 배출량·비중",
        "Para 63 (d): Approximate gross emissions covered per scope 1,2,3 and share",
        "제도 적용 범위별(범위 1·2·해당 시 3) 당해 연도 대략적 총 온실가스 배출(tCO₂eq) 및 각 범위별 전체 배출 대비 비중을 공개합니다.",
        "ESRSE1-E1-8",
        topic="내부 탄소 가격",
        sub="E1-8",
        dr="조건부",
        dp_type="quantitative",
        unit="tCO2eq / ratio",
    ),
    parent_dp(
        "ESRSE1-E1-9",
        "ESRS_E1_E1_9_FINANCIAL_EFFECTS_RISKS_OPPS",
        "공개 요건 E1-9: 물리·전환 위험의 예상 재무영향 및 기후 기회",
        "Disclosure Requirement E1-9: Anticipated financial effects and opportunities",
        "문단 64~70: 64(a)~(c) 공시 항목, 65 목적·SBM-3 48(d) 보완·시나리오·2021/2178, 66~67 세부, 68 재무제표 조정, 69 기회, 70 기회 정량화 면제 조건.",
        "ESRSE1-SEC-5",
        E1_9_CHILDREN,
        "재무영향",
        "E1-9",
        val=["ESRS2-SBM-3·AR 10~13·EU 2021/2178 교차참조"],
    ),
    leaf(
        "ESRSE1-E1-9-64-a",
        "ESRS_E1_E1_9_64_A_PHYSICAL_FINANCIAL",
        "문단 64-(a): 중대 물리적 위험의 예상 재무적 영향",
        "Para 64 (a): Anticipated financial effects from material physical risks",
        "중대한 물리적 위험으로부터 예상되는 재무적 영향을 공개합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-64-b",
        "ESRS_E1_E1_9_64_B_TRANSITION_FINANCIAL",
        "문단 64-(b): 중대 전환 위험의 예상 재정적 영향",
        "Para 64 (b): Anticipated financial effects from material transition risks",
        "중대한 전환 위험으로부터 예상되는 재정적 영향을 공개합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-64-c",
        "ESRS_E1_E1_9_64_C_OPPORTUNITY_POTENTIAL",
        "문단 64-(c): 중대 기후 기회로부터 이익 잠재력",
        "Para 64 (c): Potential to benefit from material climate opportunities",
        "중대한 기후 관련 기회로부터 이익을 얻을 잠재력을 공개합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-65-a",
        "ESRS_E1_E1_9_65_A_OBJECTIVE_RISKS_SCENARIO",
        "문단 65-(a): 목적—물리·전환 위험 예상 재무영향·시나리오 반영",
        "Para 65 (a): Objective — risks over S/M/L term; scenario analysis AR 10–13",
        "64항 정보는 ESRS 2 SBM-3 48(d) 현재 재무영향에 추가됩니다. 물리·전환 위험의 예상 재무영향은 단기·중기·장기 재무상태·성과·현금흐름 이해를 제공하며, AR 10~13 회복력 분석 시나리오 결과가 반영되어야 합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
        val=V + ["ESRS2-SBM-3-48-d", "시나리오 분석"],
    ),
    leaf(
        "ESRSE1-E1-9-65-b",
        "ESRS_E1_E1_9_65_B_OBJECTIVE_OPPORTUNITIES_KPI",
        "문단 65-(b): 목적—기회 추구 잠재력·2021/2178 KPI와 상호보완",
        "Para 65 (b): Objective — opportunities; complement to 2021/2178 KPIs",
        "기후 관련 중요 기회 추구의 잠재력에 대한 이해를 제공하며, 위임규정 (EU) 2021/2178 KPI와 상호보완적입니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-66-a",
        "ESRS_E1_E1_9_66_A_PHYSICAL_ASSETS_REVENUE",
        "문단 66-(a): 물리위험 자산·매출 금액·비율(급·만성, 적응 전)",
        "Para 66 (a): Assets and revenue at physical risk S/M/L, acute/chronic",
        "64(a)에 대해: 적응 전 단기·중기·장기 중대 물리위험 자산의 금액·비율을 급성·만성으로 구분하여 공개합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-66-b",
        "ESRS_E1_E1_9_66_B_PHYSICAL_ADAPTATION_COVERAGE",
        "문단 66-(b): 적응 조치로 다루는 물리위험 자산 비율",
        "Para 66 (b): Share of physical risk assets addressed by adaptation",
        "중대 물리위험 자산 중 기후 적응 조치로 다루는 비율을 공개합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-66-c",
        "ESRS_E1_E1_9_66_C_PHYSICAL_ASSET_LOCATIONS",
        "문단 66-(c): 중대 물리위험 자산의 위치",
        "Para 66 (c): Location of significant assets at material physical risk",
        "중대 물리위험에 놓인 중요 자산의 위치를 공개합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-66-d",
        "ESRS_E1_E1_9_66_D_PHYSICAL_NET_REVENUE",
        "문단 66-(d): 물리위험 노출 사업 순매출 금액·비율",
        "Para 66 (d): Net revenue from activities exposed to material physical risk",
        "단기·중기·장기 물리위험에 노출된 사업활동 순매출의 금액·비율을 공개합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-67-a",
        "ESRS_E1_E1_9_67_A_TRANSITION_ASSETS",
        "문단 67-(a): 전환위험 자산 금액·비율(완화 전, S/M/L)",
        "Para 67 (a): Assets at transition risk before mitigation",
        "64(b)에 대해: 완화 전 단기·중기·장기 중대 전환위험 자산의 금액·비율을 공개합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-67-b",
        "ESRS_E1_E1_9_67_B_TRANSITION_MITIGATION_COVERAGE",
        "문단 67-(b): 완화 조치로 다루는 전환위험 자산 비율",
        "Para 67 (b): Share of transition risk assets addressed by mitigation",
        "중대 전환위험 자산 중 기후 완화 조치로 다루는 비율을 공개합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-67-c",
        "ESRS_E1_E1_9_67_C_REAL_ESTATE_EPC",
        "문단 67-(c): 부동산 자산 에너지 효율 등급별 장부금액",
        "Para 67 (c): Carrying amount of real estate by energy efficiency class",
        "부동산 자산의 에너지 효율 등급별 장부금액을 구분하여 공개합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-67-d",
        "ESRS_E1_E1_9_67_D_TRANSITION_LIABILITIES",
        "문단 67-(d): 인식될 수 있는 부채(S/M/L)",
        "Para 67 (d): Liabilities that may be recognised S/M/L",
        "단기·중기·장기 재무제표에 인식될 수 있는 부채를 공개합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-67-e",
        "ESRS_E1_E1_9_67_E_TRANSITION_NET_REVENUE",
        "문단 67-(e): 전환위험 노출 순매출(석탄·석유·가스 관련 고객 수익 포함)",
        "Para 67 (e): Net revenue exposed to transition risk including fossil customers",
        "중대 전환위험에 노출된 사업활동 순매출 금액·비율을 공개하며, 해당 시 석탄·석유·가스 관련 활동 고객으로부터의 수익을 포함합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-68-a",
        "ESRS_E1_E1_9_68_A_RECONCILE_PHYSICAL",
        "문단 68-(a): 물리위험 자산·순매출의 재무제표 조정",
        "Para 68 (a): Reconcile physical risk assets and revenue to FS",
        "66항에 따른 중대 금액의 자산·순매출이 재무제표 항목·주석과 어떻게 조정되는지 공개합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-68-b",
        "ESRS_E1_E1_9_68_B_RECONCILE_TRANSITION",
        "문단 68-(b): 전환위험 자산·부채·순매출의 재무제표 조정",
        "Para 68 (b): Reconcile transition risk assets, liabilities, revenue to FS",
        "67항에 따른 중대 금액의 자산·부채·순매출이 재무제표 항목·주석과 어떻게 조정되는지 공개합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-69-a",
        "ESRS_E1_E1_9_69_A_OPPORTUNITY_COST_SAVINGS",
        "문단 69-(a): 완화·적응 조치에 따른 예상 비용 절감",
        "Para 69 (a): Expected cost savings from mitigation and adaptation",
        "64(c) 기회 공시에 완화·적응 조치로부터 예상 비용 절감을 고려합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-69-b",
        "ESRS_E1_E1_9_69_B_OPPORTUNITY_MARKET_REVENUE",
        "문단 69-(b): 저탄소 제품·서비스·적응 솔루션 시장·매출 잠재력",
        "Para 69 (b): Market size or revenue from low-carbon/adaptation offerings",
        "접근 가능한 저탄소 제품·서비스 또는 적응 솔루션의 잠재 시장 규모 또는 예상 순매출 변화를 고려합니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
    ),
    leaf(
        "ESRSE1-E1-9-70",
        "ESRS_E1_E1_9_70_OPPORTUNITY_QUANT_WAIVER",
        "문단 70: 기회 재무효과 정량화 면제(ESRS 1 부록 B 질적 특성)",
        "Para 70: Quantification of opportunity financial effects not required if QC fail",
        "기회로부터 재무적 효과의 정량화는 공개가 ESRS 1 부록 B 유용한 정보의 질적 특성을 충족하지 않으면 요구되지 않습니다.",
        "ESRSE1-E1-9",
        topic="재무영향",
        sub="E1-9",
        val=V + ["ESRS 1 부록 B"],
    ),
]


def main():
    data = json.loads(DP_PATH.read_text(encoding="utf-8"))
    dps = data["data_points"]
    if any(x["dp_id"] == "ESRSE1-SEC-5" for x in dps):
        print("ESRSE1-SEC-5 exists; skip")
        return

    root = next(x for x in dps if x["dp_id"] == "ESRSE1")
    root["child_dps"] = root["child_dps"] + ["ESRSE1-SEC-5"]
    root["description"] = (
        "ESRS E1(기후변화) 공시: 거버넌스·전략·IRO·정책·조치·지표·목표·제거·크레딧·내부탄소가격·재무영향 등. "
        "문단 13~70 범위를 다룹니다."
    )
    root["validation_rules"] = [
        "문단 13~19, 20~21(IRO-1), 22~29(E1-2·3), 30~55(E1-4~6), 56~70(E1-7~9)이 원문·교차참조와 일치하는지 확인"
    ]

    data["data_points"] = dps + NEW_DP
    DP_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=4), encoding="utf-8")

    rb = json.loads(RB_PATH.read_text(encoding="utf-8"))
    rbs = rb["rulebooks"]
    checks = set()
    for r in rbs:
        for vc in r.get("validation_rules", {}).get("verification_checks", []):
            checks.add(vc["check_id"])

    new_rb = []
    new_rb.append(
        mk_parent_rb(
            "ESRSE1-SEC-5",
            "Section 5 제거·크레딧·가격·재무영향",
            "ESRS E1 Section 5 paras 56–70",
            ["ESRSE1-E1-7", "ESRSE1-E1-8", "ESRSE1-E1-9"],
        )
    )
    new_rb.append(
        mk_parent_rb(
            "ESRSE1-E1-7",
            "E1-7 제거·크레딧(56–61)",
            "ESRS E1 - E1-7 paras 56–61",
            E1_7_CHILDREN,
            cross=["ESRSE1-E1-4"],
        )
    )
    new_rb.append(
        mk_parent_rb(
            "ESRSE1-E1-8",
            "E1-8 내부 탄소 가격(62–63)",
            "ESRS E1 - E1-8 paras 62–63",
            E1_8_CHILDREN,
        )
    )
    new_rb.append(
        mk_parent_rb(
            "ESRSE1-E1-9",
            "E1-9 예상 재무영향·기회(64–70)",
            "ESRS E1 - E1-9 paras 64–70",
            E1_9_CHILDREN,
            cross=["ESRS2-SBM-3"],
        )
    )

    skip_parents = {"ESRSE1-SEC-5", "ESRSE1-E1-7", "ESRSE1-E1-8", "ESRSE1-E1-9"}
    for d in NEW_DP:
        if d["dp_id"] in skip_parents:
            continue
        dr = d["disclosure_requirement"]
        cross = []
        if "E1-9-65" in d["dp_id"] or "E1-9-66" in d["dp_id"] or "E1-9-67" in d["dp_id"]:
            cross = ["ESRS2-SBM-3"]
        if d["dp_id"] == "ESRSE1-E1-9-70":
            cross = ["ESRS1"]
        r = mk_rb(
            d["dp_id"],
            d["name_ko"][:100],
            f"ESRS E1 - {d['dp_id']}",
            dr=dr,
            cross=cross if cross else None,
        )
        new_rb.append(r)

    for r in new_rb:
        cid = r["validation_rules"]["verification_checks"][0]["check_id"]
        if cid in checks:
            raise SystemExit(f"duplicate check_id: {cid}")
        checks.add(cid)

    rbs.extend(new_rb)
    top = next(x for x in rbs if x["rulebook_id"] == "RULE_ESRSE1")
    top["section_name"] = "ESRS E1 (문단 13~70)"
    top["section_content"] = "ESRS E1 기후변화 — datapoint.json과 동일 범위."
    top["validation_rules"]["paragraph_reference"] = "ESRS E1 - paras 13-70"
    top["related_dp_ids"] = [x["dp_id"] for x in data["data_points"]]

    RB_PATH.write_text(json.dumps(rb, ensure_ascii=False, indent=4), encoding="utf-8")
    print("OK +", len(NEW_DP), "datapoints,", len(new_rb), "rulebooks")


if __name__ == "__main__":
    main()
