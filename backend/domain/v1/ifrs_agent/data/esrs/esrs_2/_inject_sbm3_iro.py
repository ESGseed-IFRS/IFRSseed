"""One-off: inject SBM-3, SEC-5, IRO-1 datapoints into datapoint.json and extend rulebook."""
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent


def dp(
    dp_id: str,
    code: str,
    name_ko: str,
    name_en: str,
    description: str,
    parent: str,
    children: list | None = None,
    dr: str = "필수",
    topic: str = "전략",
    subtopic: str | None = None,
    val: list | None = None,
) -> dict:
    sub = subtopic or ("SBM-3" if dp_id.startswith("ESRS2-SBM-3") else "IRO-1")
    if dp_id.startswith("ESRS2-SEC-5"):
        topic, sub = "IRO 관리", "ESRS 2"
    return {
        "dp_id": dp_id,
        "dp_code": code,
        "name_ko": name_ko,
        "name_en": name_en,
        "description": description,
        "standard": "ESRS",
        "category": "G",
        "topic": topic,
        "subtopic": sub,
        "dp_type": "narrative",
        "unit": None,
        "equivalent_dps": [],
        "parent_indicator": parent,
        "child_dps": children or [],
        "financial_linkages": [],
        "financial_impact_type": None,
        "disclosure_requirement": dr,
        "reporting_frequency": "연간",
        "validation_rules": val or ["원문 문단·항목에 대응하는 서술·교차참조가 있는지 확인"],
        "value_range": None,
    }


SBM3_CHILDREN = [
    "ESRS2-SBM-3-46",
    "ESRS2-SBM-3-47",
    "ESRS2-SBM-3-48-a",
    "ESRS2-SBM-3-48-b",
    "ESRS2-SBM-3-48-c-i",
    "ESRS2-SBM-3-48-c-ii",
    "ESRS2-SBM-3-48-c-iii",
    "ESRS2-SBM-3-48-c-iv",
    "ESRS2-SBM-3-48-d-i",
    "ESRS2-SBM-3-48-d-ii",
    "ESRS2-SBM-3-48-e-i",
    "ESRS2-SBM-3-48-e-ii",
    "ESRS2-SBM-3-48-f",
    "ESRS2-SBM-3-48-g",
    "ESRS2-SBM-3-48-h",
    "ESRS2-SBM-3-49",
]

IRO1_CHILDREN = [
    "ESRS2-IRO-1-50-a",
    "ESRS2-IRO-1-50-b",
    "ESRS2-IRO-1-51",
    "ESRS2-IRO-1-52",
    "ESRS2-IRO-1-53-a",
    "ESRS2-IRO-1-53-b-i",
    "ESRS2-IRO-1-53-b-ii",
    "ESRS2-IRO-1-53-b-iii",
    "ESRS2-IRO-1-53-b-iv",
    "ESRS2-IRO-1-53-c-i",
    "ESRS2-IRO-1-53-c-ii",
    "ESRS2-IRO-1-53-c-iii",
    "ESRS2-IRO-1-53-d",
    "ESRS2-IRO-1-53-e",
    "ESRS2-IRO-1-53-f",
    "ESRS2-IRO-1-53-g",
    "ESRS2-IRO-1-53-h",
]

SBM3_LEAVES = [
    dp(
        "ESRS2-SBM-3-46",
        "ESRS_2_SBM_3_46_DISCLOSE_IRO_INTERACTION",
        "SBM-3 문단 46: 중대 IRO와 전략·모델 상호작용 공개",
        "SBM-3 para 46: Disclose material IROs and interaction with strategy and model",
        "기업은 중대한 영향, 위험 및 기회와 이들이 전략 및 비즈니스 모델과 상호작용하는 방식을 공개해야 합니다.",
        "ESRS2-SBM-3",
        val=["중대 IRO 목록·상호작용 서술이 있는지 확인"],
    ),
    dp(
        "ESRS2-SBM-3-47",
        "ESRS_2_SBM_3_47_OBJECTIVE",
        "SBM-3 문단 47: 공시 목적",
        "SBM-3 para 47: Objective",
        "중대 IRO가 전략·비즈니스 모델 변화와 어떻게 연결되는지 이해를 제공합니다. 주제별 ESRS의 경영 정보 및 정책·조치·목표 최소 공시 적용을 전제로 한 설명을 포함합니다.",
        "ESRS2-SBM-3",
        val=["목적·주제별 ESRS 연계가 드러나는지 확인"],
    ),
    dp(
        "ESRS2-SBM-3-48-a",
        "ESRS_2_SBM_3_48_A_MATERIAL_IRO_SUMMARY",
        "SBM-3 문단 48-(a): 중대성 평가에서의 중대 IRO 개요",
        "SBM-3 para 48 (a): Brief description of material IROs from assessment",
        "중대성 평가에서 도출된 중대 IRO에 대한 간략한 설명을 공개합니다(IRO-1 참조). 자체 운영·상류·하류 가치 사슬 등 집중 위치를 포함합니다.",
        "ESRS2-SBM-3",
        val=["IRO-1·중대성 평가와 대응·집중 위치(운영/가치사슬) 식별 가능 여부"],
    ),
    dp(
        "ESRS2-SBM-3-48-b",
        "ESRS_2_SBM_3_48_B_EFFECTS_RESPONSES",
        "SBM-3 문단 48-(b): IRO의 현행·예상 영향과 대응",
        "SBM-3 para 48 (b): Current/anticipated effects and responses",
        "중대 IRO가 비즈니스 모델·가치 사슬·전략·의사결정에 미치는 현재 및 예상 효과, 대응 및 계획(전략·모델 변경 포함)을 공개합니다.",
        "ESRS2-SBM-3",
        val=["효과·의사결정·대응·계획의 인과 연결이 있는지 확인"],
    ),
    dp(
        "ESRS2-SBM-3-48-c-i",
        "ESRS_2_SBM_3_48_C_I_IMPACT_ON_PEOPLE_ENV",
        "SBM-3 문단 48-(c)-i: 부정·긍정 영향이 사람·환경에 미치는 방식",
        "SBM-3 para 48 (c) i: How impacts affect people or environment",
        "중대 영향과 관련하여 부정적·긍정적 영향이 사람 또는 환경에 미치는 방식(잠재 영향 포함)을 설명합니다.",
        "ESRS2-SBM-3",
    ),
    dp(
        "ESRS2-SBM-3-48-c-ii",
        "ESRS_2_SBM_3_48_C_II_LINK_STRATEGY_MODEL",
        "SBM-3 문단 48-(c)-ii: 영향의 전략·모델 연원",
        "SBM-3 para 48 (c) ii: Whether/how impacts connect to strategy and model",
        "영향이 전략 및 비즈니스 모델에서 비롯되거나 이와 연결되는지 여부 및 방식을 공개합니다.",
        "ESRS2-SBM-3",
    ),
    dp(
        "ESRS2-SBM-3-48-c-iii",
        "ESRS_2_SBM_3_48_C_III_TIME_HORIZONS_IMPACTS",
        "SBM-3 문단 48-(c)-iii: 영향의 합리적 예상 시간 범위",
        "SBM-3 para 48 (c) iii: Time horizons for impacts",
        "영향에 대한 합리적으로 예상되는 시간 범위를 공개합니다.",
        "ESRS2-SBM-3",
    ),
    dp(
        "ESRS2-SBM-3-48-c-iv",
        "ESRS_2_SBM_3_48_C_IV_INVOLVEMENT_RELATIONSHIPS",
        "SBM-3 문단 48-(c)-iv: 활동·사업 관계 통한 관여",
        "SBM-3 para 48 (c) iv: Involvement through activities or business relationships",
        "기업이 활동 또는 사업 관계를 통해 관여하는지, 관계의 성격을 공개합니다.",
        "ESRS2-SBM-3",
    ),
    dp(
        "ESRS2-SBM-3-48-d-i",
        "ESRS_2_SBM_3_48_D_I_CURRENT_FINANCIAL_EFFECTS",
        "SBM-3 문단 48-(d) 첫째: 재무상태·성과·현금흐름 현재 재무효과",
        "SBM-3 para 48 (d) first bullet: Current financial effects",
        "중대 위험 및 기회와 관련하여 재무상태·성과·현금흐름에 대한 현재 재무적 영향을 공개합니다.",
        "ESRS2-SBM-3",
    ),
    dp(
        "ESRS2-SBM-3-48-d-ii",
        "ESRS_2_SBM_3_48_D_II_CARRYING_AMOUNT_ADJUSTMENT_RISK",
        "SBM-3 문단 48-(d) 둘째: 장부금액 조정 위험",
        "SBM-3 para 48 (d) second bullet: Risk of material adjustment to carrying amounts",
        "다음 연간 보고 기간 내 자산·부채 장부금액의 중대 조정 위험을 공개합니다.",
        "ESRS2-SBM-3",
    ),
    dp(
        "ESRS2-SBM-3-48-e-i",
        "ESRS_2_SBM_3_48_E_I_ANTICIPATED_FINANCIAL_HORIZONS",
        "SBM-3 문단 48-(e) 본문·i: 단·중·장기 예상 재무영향·전략 전망",
        "SBM-3 para 48 (e) intro/i: Anticipated financial effects over horizons; IRO 관리 전략 전망",
        "단기·중기·장기 관점에서 재무상태·성과·현금흐름에 대한 예상 재무적 영향을 공개합니다. IRO 관리 전략에 따른 변화 전망을 포함합니다.",
        "ESRS2-SBM-3",
    ),
    dp(
        "ESRS2-SBM-3-48-e-ii",
        "ESRS_2_SBM_3_48_E_II_FUNDING_SOURCES",
        "SBM-3 문단 48-(e)-ii: 조달 계획·비계약적 계획 포함",
        "SBM-3 para 48 (e) ii: Investment/disposal and funding plans",
        "전략 이행을 위한 투자·처분 계획(CapEx, 인수·매각 등, 비계약적 계획 포함) 및 계획된 자금 조달 출처를 공개합니다.",
        "ESRS2-SBM-3",
    ),
    dp(
        "ESRS2-SBM-3-48-f",
        "ESRS_2_SBM_3_48_F_RESILIENCE",
        "SBM-3 문단 48-(f): 전략·모델의 회복탄력성",
        "SBM-3 para 48 (f): Resilience of strategy and model",
        "전략·비즈니스 모델이 중대 영향·위험을 다루고 기회를 활용할 역량에 대한 회복탄력성 정보를 공개합니다(질적 필수, 해당 시 양적). 분석 방법, ESRS 1 제6장 시간 범위, 양적 정보는 단일 금액 또는 범위로 제시 가능함을 반영합니다.",
        "ESRS2-SBM-3",
        val=["질적 회복탄력성 필수·해당 시 양적·방법·시간범위가 추적 가능한지"],
    ),
    dp(
        "ESRS2-SBM-3-48-g",
        "ESRS_2_SBM_3_48_G_CHANGES_VS_PRIOR",
        "SBM-3 문단 48-(g): 전기 대비 중대 IRO 변화",
        "SBM-3 para 48 (g): Changes in material IROs vs prior period",
        "이전 보고 기간 대비 중대 영향, 위험 및 기회의 변화를 공개합니다.",
        "ESRS2-SBM-3",
    ),
    dp(
        "ESRS2-SBM-3-48-h",
        "ESRS_2_SBM_3_48_H_ESRS_SPECIFICATION",
        "SBM-3 문단 48-(h): ESRS 공시 대상 IRO 명세",
        "SBM-3 para 48 (h): Specification of IROs covered by ESRS",
        "ESRS 공시 요건으로 다루는 영향·위험·기회를 명시합니다(기업별 추가 공시와 구분).",
        "ESRS2-SBM-3",
    ),
    dp(
        "ESRS2-SBM-3-49",
        "ESRS_2_SBM_3_49_PLACEMENT_CROSS_REF",
        "SBM-3 문단 49: 서술 제공 위치·주제별 공시 연계",
        "SBM-3 para 49: Placement with topical disclosures and statement in ESRS 2 chapter",
        "문단 46 관련 설명 정보를 주제별 ESRS 공시와 함께 제공할 수 있으나, ESRS 2 해당 장에 따라 작성된 공시와 함께 중대 IRO에 대한 진술(statement)을 제시해야 합니다.",
        "ESRS2-SBM-3",
        val=["교차 배치 시 ESRS 2 장 진술·주제별 공시 연결이 유지되는지 확인"],
    ),
]

SBM3_PARENT = dp(
    "ESRS2-SBM-3",
    "ESRS_2_SBM_3_IRO_STRATEGY_MODEL",
    "공개 요건 SBM-3: 중대 IRO와 전략·비즈니스 모델의 상호작용",
    "Disclosure Requirement SBM-3 – Material IROs and interaction with strategy and business model",
    "문단 46~49: 중대 IRO와 전략·모델 상호작용, 문단 48(a)~(h) 및 49 위치·연계를 하위 DP로 둡니다.",
    "ESRS2-SEC-4",
    SBM3_CHILDREN,
    subtopic="SBM-3",
    val=["SBM-3 문단 46~49가 상호 모순 없이 충족되는지 확인"],
)

IRO_LEAVES = [
    dp(
        "ESRS2-IRO-1-50-a",
        "ESRS_2_IRO_1_50_A_PROCESS_IDENTIFY",
        "IRO-1 장 서문 문단 50-(a): 중대 IRO 식별 과정 이해",
        "Para 50 (a): Understanding process to identify material IROs",
        "본 장 공시가 가능하게 하는 이해 — (a) 중대한 영향, 위험 및 기회를 식별하는 과정.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
    ),
    dp(
        "ESRS2-IRO-1-50-b",
        "ESRS_2_IRO_1_50_B_INFO_IN_STATEMENT",
        "IRO-1 장 서문 문단 50-(b): 중대성 평가 결과 보고서 포함 정보",
        "Para 50 (b): Information in sustainability statement from materiality assessment",
        "(b) 중대성 평가 결과 기업이 지속가능성 보고서에 포함시킨 정보에 대한 이해.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
    ),
    dp(
        "ESRS2-IRO-1-51",
        "ESRS_2_IRO_1_51_DISCLOSE_PROCESS",
        "IRO-1 문단 51: 식별·중대성 평가 절차 공개",
        "IRO-1 para 51: Disclose process",
        "기업은 영향·위험·기회를 식별하고 중대한 사항을 평가하는 절차를 공개해야 합니다.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
    ),
    dp(
        "ESRS2-IRO-1-52",
        "ESRS_2_IRO_1_52_OBJECTIVE",
        "IRO-1 문단 52: 공시 목적(이중 중대성·ESRS 1 제3장)",
        "IRO-1 para 52: Objective",
        "지속가능성 성명서 공개 내용 결정의 기초가 되는 중대 IRO 식별·중대성 평가 과정을 이해하도록 합니다(이중 중대성, ESRS 1 제3장 및 적용 요건 참조).",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
        val=["ESRS 1 제3장·이중 중대성과 서술이 정합하는지 확인"],
    ),
    dp(
        "ESRS2-IRO-1-53-a",
        "ESRS_2_IRO_1_53_A_METHODOLOGIES_ASSUMPTIONS",
        "IRO-1 문단 53-(a): 방법론 및 가정",
        "IRO-1 para 53 (a): Methodologies and assumptions",
        "설명된 절차에 적용된 방법론 및 가정에 대한 설명을 공개합니다.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
    ),
    dp(
        "ESRS2-IRO-1-53-b-i",
        "ESRS_2_IRO_1_53_B_I_HEIGHTENED_RISK_FOCUS",
        "IRO-1 문단 53-(b)-i: 고위험 활동·관계·지역 초점",
        "IRO-1 para 53 (b) i: Heightened risk factors",
        "특정 활동, 사업 관계, 지역 또는 기타 요인에 초점을 맞춰 부정적 영향 위험이 높아지는 경우를 고려하는지 및 방법을 설명합니다.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
    ),
    dp(
        "ESRS2-IRO-1-53-b-ii",
        "ESRS_2_IRO_1_53_B_II_INVOLVEMENT_OWN_OPS_RELATIONS",
        "IRO-1 문단 53-(b)-ii: 자체 운영·사업 관계 통한 관여 영향",
        "IRO-1 para 53 (b) ii: Impacts through own operations and relationships",
        "자체 운영 또는 사업 관계로 관여하는 영향을 고려하는지 설명합니다.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
    ),
    dp(
        "ESRS2-IRO-1-53-b-iii",
        "ESRS_2_IRO_1_53_B_III_STAKEHOLDER_EXPERT_CONSULT",
        "IRO-1 문단 53-(b)-iii: 영향받는 이해관계자·전문가 협의",
        "IRO-1 para 53 (b) iii: Consultation with affected stakeholders and experts",
        "영향받을 수 있는 이해관계자 및 외부 전문가 협의를 포함하여 영향 이해 여부·방식을 설명합니다.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
    ),
    dp(
        "ESRS2-IRO-1-53-b-iv",
        "ESRS_2_IRO_1_53_B_IV_PRIORITISATION_IMPACT_MATERIALITY",
        "IRO-1 문단 53-(b)-iv: 영향 우선순위 및 보고 목적 중대 사안 결정",
        "IRO-1 para 53 (b) iv: Prioritisation per ESRS 1 Sec 3.4",
        "부정적 영향은 상대적 심각성·발생가능성, 긍정적 영향은 규모·범위·가능성에 따라 우선순위하며(ESRS 1 제3.4조), 정성·정량 기준 등으로 보고 목적상 중대 지속가능성 사안을 결정하는지 설명합니다.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
        val=["ESRS 1 제3.4조 영향 중대성 기준과 서술이 대응하는지 확인"],
    ),
    dp(
        "ESRS2-IRO-1-53-c-i",
        "ESRS_2_IRO_1_53_C_I_RO_DEPENDENCY_LINK",
        "IRO-1 문단 53-(c)-i: 의존성·영향 연계 위험·기회",
        "IRO-1 para 53 (c) i: Risks and opportunities linked to impacts and dependencies",
        "영향 및 의존성과의 연관성을 고려한 방식과 그로부터 발생할 수 있는 위험 및 기회를 포함합니다.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
    ),
    dp(
        "ESRS2-IRO-1-53-c-ii",
        "ESRS_2_IRO_1_53_C_II_ASSESS_MAGNITUDE_NATURE",
        "IRO-1 문단 53-(c)-ii: 위험·기회 평가 방법(재무적 중대성)",
        "IRO-1 para 53 (c) ii: Assessment methods (ESRS 1 Sec 3.3)",
        "식별된 위험·기회의 가능성·규모·성격 평가 방법(ESRS 1 제3.3조 재무적 중대성 정성·정량 기준 등)을 설명합니다.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
    ),
    dp(
        "ESRS2-IRO-1-53-c-iii",
        "ESRS_2_IRO_1_53_C_III_RISK_PRIORITISATION",
        "IRO-1 문단 53-(c)-iii: 지속가능성 위험 우선순위·도구",
        "IRO-1 para 53 (c) iii: Prioritisation vs other risks",
        "지속가능성 관련 위험을 다른 유형 위험과 비교하여 우선순위하는 방식(평가 도구 포함)을 설명합니다.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
    ),
    dp(
        "ESRS2-IRO-1-53-d",
        "ESRS_2_IRO_1_53_D_DECISION_INTERNAL_CONTROL",
        "IRO-1 문단 53-(d): 의사결정·내부 통제",
        "IRO-1 para 53 (d): Decision-making and internal controls",
        "의사 결정 과정 및 관련 내부 통제 절차에 대해 설명합니다.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
    ),
    dp(
        "ESRS2-IRO-1-53-e",
        "ESRS_2_IRO_1_53_E_INTEGRATION_OVERALL_RISK_MGMT",
        "IRO-1 문단 53-(e): 전사 위험관리와의 통합",
        "IRO-1 para 53 (e): Integration into overall risk management",
        "영향·위험 식별·평가·관리가 전반 위험관리에 어느 정도·어떻게 통합되며, 위험 프로필·관리 평가에 어떻게 활용되는지 설명합니다.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
    ),
    dp(
        "ESRS2-IRO-1-53-f",
        "ESRS_2_IRO_1_53_F_OPPORTUNITY_INTEGRATION",
        "IRO-1 문단 53-(f): 기회 관리 통합(해당 시)",
        "IRO-1 para 53 (f): Integration of opportunity management",
        "해당되는 경우 기회 식별·평가·관리가 전반 관리 프로세스에 통합되는 범위와 방법을 설명합니다.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
        dr="조건부",
    ),
    dp(
        "ESRS2-IRO-1-53-g",
        "ESRS_2_IRO_1_53_G_INPUT_PARAMETERS",
        "IRO-1 문단 53-(g): 입력 매개변수",
        "IRO-1 para 53 (g): Input parameters",
        "데이터 출처, 운영 범위, 가정 세부 등 사용하는 입력 매개변수를 공개합니다.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
    ),
    dp(
        "ESRS2-IRO-1-53-h",
        "ESRS_2_IRO_1_53_H_PROCESS_CHANGES",
        "IRO-1 문단 53-(h): 절차 변경·최종 수정·향후 개정",
        "IRO-1 para 53 (h): Changes to process and future revisions",
        "전기 대비 프로세스 변경 여부·방식, 마지막 수정 시점, 중대성 평가의 향후 개정 예정일을 공개합니다.",
        "ESRS2-IRO-1",
        topic="IRO 관리",
        subtopic="IRO-1",
    ),
]

IRO_PARENT = dp(
    "ESRS2-IRO-1",
    "ESRS_2_IRO_1_MATERIALITY_PROCESS",
    "공개 요건 IRO-1: 중대 IRO 식별·평가 절차 설명",
    "Disclosure Requirement IRO-1 – Process to identify and assess material IROs",
    "문단 50(장 목적)·51·52·53(a)~(h)를 하위 DP로 둡니다.",
    "ESRS2-SEC-5",
    IRO1_CHILDREN,
    topic="IRO 관리",
    subtopic="IRO-1",
    val=["IRO-1 전 항목이 중대성 평가 서술과 대응하는지 확인"],
)

SEC5 = {
    "dp_id": "ESRS2-SEC-5",
    "dp_code": "ESRS_2_SEC_5_IRO_MANAGEMENT",
    "name_ko": "4. 영향, 위험 및 기회 관리",
    "name_en": "ESRS 2 – Section 4 Impact, risk and opportunity management",
    "description": "중대성 평가 절차 등 IRO 관련 일반 공시 절입니다. 본 시드는 IRO-1(문단 50~53)을 포함합니다.",
    "standard": "ESRS",
    "category": "G",
    "topic": "IRO 관리",
    "subtopic": "ESRS 2",
    "dp_type": "narrative",
    "unit": None,
    "equivalent_dps": [],
    "parent_indicator": "ESRS2",
    "child_dps": ["ESRS2-IRO-1"],
    "financial_linkages": [],
    "financial_impact_type": None,
    "disclosure_requirement": "필수",
    "reporting_frequency": "연간",
    "validation_rules": ["IRO-1 하위 항목이 SBM-3·토피컬 ESRS와 정합되는지 확인"],
    "value_range": None,
}


def main():
    path = BASE / "datapoint.json"
    data = json.load(open(path, encoding="utf-8"))
    dps = data["data_points"]
    ids = {x["dp_id"] for x in dps}
    for nid in ["ESRS2-SBM-3", "ESRS2-SEC-5", "ESRS2-IRO-1"]:
        if nid in ids:
            raise SystemExit(f"already exists: {nid}")

    for x in dps:
        if x["dp_id"] == "ESRS2":
            x["child_dps"].append("ESRS2-SEC-5")
            d = x["description"]
            if "SBM-3" not in d:
                x["description"] = d + " 전략 SBM-3(문단 46~49), 제4장 IRO-1(문단 50~53)을 포함합니다."
            vr = x.get("validation_rules") or []
            if vr:
                s = vr[0]
                if "SEC-5" not in s:
                    s = s.replace("SEC-4(SBM-1~3)", "SEC-4(SBM-1~3)·SEC-5(IRO-1)").replace(
                        "SEC-4(SBM-1·2)", "SEC-4(SBM-1~3)·SEC-5(IRO-1)"
                    )
                    if "SEC-5" not in s:
                        s += "·SEC-5(IRO-1)"
                vr[0] = s
                x["validation_rules"] = vr
        if x["dp_id"] == "ESRS2-SEC-4":
            x["child_dps"].append("ESRS2-SBM-3")
            x["name_ko"] = "3. 전략 — SBM-1·SBM-2·SBM-3"
            x["name_en"] = "ESRS 2 – Section 3 Strategy (SBM-1–3)"
            x["description"] = (
                "전략 장에서 SBM-1, SBM-2, SBM-3(중대 IRO와 전략·모델 상호작용)을 둡니다. "
                "문단 37 목적은 ESRS2-GOV-5-37*에 있습니다."
            )
            x["validation_rules"].append("SBM-3(문단 46~49) 충족 여부 점검")

    idx_sbm1 = next(i for i, x in enumerate(dps) if x["dp_id"] == "ESRS2-SBM-1")
    insert_block = [SEC5, IRO_PARENT] + IRO_LEAVES
    dps[idx_sbm1:idx_sbm1] = insert_block

    idx_gov1 = next(i for i, x in enumerate(dps) if x["dp_id"] == "ESRS2-GOV-1")
    insert_sbm3 = [SBM3_PARENT] + SBM3_LEAVES
    dps[idx_gov1:idx_gov1] = insert_sbm3

    json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=4)
    print("datapoint.json:", len(dps), "points")


def rb(
    rid: str,
    dpid: str,
    section_name: str,
    pref: str,
    cid: str,
    dr: str = "필수",
    cross: list | None = None,
    kt: list | None = None,
):
    return {
        "rulebook_id": rid,
        "standard_id": "ESRS2",
        "primary_dp_id": dpid,
        "section_name": section_name,
        "section_content": f"{pref}. datapoint.json description 참고.",
        "validation_rules": {
            "section_type": "disclosure_requirement",
            "paragraph_reference": pref,
            "key_terms": kt or ["ESRS 2", "IRO", "materiality"],
            "required_actions": [
                {
                    "action": f"disclose_{cid.lower()}",
                    "description": section_name,
                    "mandatory": True,
                }
            ],
            "verification_checks": [
                {
                    "check_id": cid,
                    "description": section_name,
                    "expected": cid.lower() + "_traceable",
                }
            ],
            "cross_references": cross or [],
        },
        "related_dp_ids": [dpid],
        "rulebook_title": rid.replace("RULE_ESRS2_", "").replace("_", " "),
        "disclosure_requirement": dr,
        "version": "1.0",
        "is_active": True,
        "is_primary": False,
        "effective_date": "2024-01-01",
        "mapping_notes": None,
        "conflicts_with": [],
    }


def inject_rulebooks():
    path = BASE / "rulebook.json"
    data = json.load(open(path, encoding="utf-8"))
    rbs = data["rulebooks"]
    have = {r["rulebook_id"] for r in rbs}

    new_rules = [
        rb(
            "RULE_ESRS2_SEC_5",
            "ESRS2-SEC-5",
            "제4장 IRO 관리 절",
            "ESRS 2 – Section 4 IRO management",
            "ESRS2_SEC5",
            kt=["IRO-1", "materiality assessment"],
            cross=["ESRS2-IRO-1"],
        ),
        rb(
            "RULE_ESRS2_SBM_3",
            "ESRS2-SBM-3",
            "SBM-3 총괄(문단 46~49)",
            "ESRS 2 – SBM-3 paras 46–49",
            "ESRS2_SBM3_ROOT",
            kt=["SBM-3", "material IRO", "strategy"],
            cross=["IRO-1", "ESRS2-SBM-3-48-a"],
        ),
        rb("RULE_ESRS2_SBM_3_46", "ESRS2-SBM-3-46", "SBM-3 문단 46", "ESRS 2 – SBM-3 para 46", "ESRS2_SBM3_46"),
        rb("RULE_ESRS2_SBM_3_47", "ESRS2-SBM-3-47", "SBM-3 문단 47 목적", "ESRS 2 – SBM-3 para 47", "ESRS2_SBM3_47"),
        rb("RULE_ESRS2_SBM_3_48_A", "ESRS2-SBM-3-48-a", "SBM-3 48(a) 중대 IRO 개요", "ESRS 2 – SBM-3 para 48(a)", "ESRS2_SBM3_48A", cross=["IRO-1"]),
        rb("RULE_ESRS2_SBM_3_48_B", "ESRS2-SBM-3-48-b", "SBM-3 48(b) 영향·대응", "ESRS 2 – SBM-3 para 48(b)", "ESRS2_SBM3_48B"),
        rb("RULE_ESRS2_SBM_3_48_CI", "ESRS2-SBM-3-48-c-i", "SBM-3 48(c)(i)", "ESRS 2 – SBM-3 para 48(c)(i)", "ESRS2_SBM3_48CI"),
        rb("RULE_ESRS2_SBM_3_48_CII", "ESRS2-SBM-3-48-c-ii", "SBM-3 48(c)(ii)", "ESRS 2 – SBM-3 para 48(c)(ii)", "ESRS2_SBM3_48CII"),
        rb("RULE_ESRS2_SBM_3_48_CIII", "ESRS2-SBM-3-48-c-iii", "SBM-3 48(c)(iii)", "ESRS 2 – SBM-3 para 48(c)(iii)", "ESRS2_SBM3_48CIII"),
        rb("RULE_ESRS2_SBM_3_48_CIV", "ESRS2-SBM-3-48-c-iv", "SBM-3 48(c)(iv)", "ESRS 2 – SBM-3 para 48(c)(iv)", "ESRS2_SBM3_48CIV"),
        rb("RULE_ESRS2_SBM_3_48_DI", "ESRS2-SBM-3-48-d-i", "SBM-3 48(d) 현재 재무효과", "ESRS 2 – SBM-3 para 48(d) first", "ESRS2_SBM3_48DI", kt=["financial effects"]),
        rb("RULE_ESRS2_SBM_3_48_DII", "ESRS2-SBM-3-48-d-ii", "SBM-3 48(d) 장부금액 조정 위험", "ESRS 2 – SBM-3 para 48(d) second", "ESRS2_SBM3_48DII"),
        rb("RULE_ESRS2_SBM_3_48_EI", "ESRS2-SBM-3-48-e-i", "SBM-3 48(e) 예상 재무·시간범위", "ESRS 2 – SBM-3 para 48(e) intro/i", "ESRS2_SBM3_48EI"),
        rb("RULE_ESRS2_SBM_3_48_EII", "ESRS2-SBM-3-48-e-ii", "SBM-3 48(e)(ii) 투자·조달", "ESRS 2 – SBM-3 para 48(e)(ii)", "ESRS2_SBM3_48EII"),
        rb("RULE_ESRS2_SBM_3_48_F", "ESRS2-SBM-3-48-f", "SBM-3 48(f) 회복탄력성", "ESRS 2 – SBM-3 para 48(f)", "ESRS2_SBM3_48F", kt=["resilience", "ESRS 1 Ch.6"]),
        rb("RULE_ESRS2_SBM_3_48_G", "ESRS2-SBM-3-48-g", "SBM-3 48(g) 전기 대비 변화", "ESRS 2 – SBM-3 para 48(g)", "ESRS2_SBM3_48G"),
        rb("RULE_ESRS2_SBM_3_48_H", "ESRS2-SBM-3-48-h", "SBM-3 48(h) ESRS IRO 명세", "ESRS 2 – SBM-3 para 48(h)", "ESRS2_SBM3_48H"),
        rb("RULE_ESRS2_SBM_3_49", "ESRS2-SBM-3-49", "SBM-3 문단 49 배치", "ESRS 2 – SBM-3 para 49", "ESRS2_SBM3_49", cross=["Topical ESRS"]),
        rb(
            "RULE_ESRS2_IRO_1",
            "ESRS2-IRO-1",
            "IRO-1 총괄(문단 50~53)",
            "ESRS 2 – IRO-1 paras 50–53",
            "ESRS2_IRO1_ROOT",
            kt=["IRO-1", "double materiality"],
            cross=["ESRS 1 Ch.3"],
        ),
        rb("RULE_ESRS2_IRO_1_50_A", "ESRS2-IRO-1-50-a", "IRO-1 50(a) 식별 과정", "ESRS 2 – para 50(a)", "ESRS2_IRO1_50A"),
        rb("RULE_ESRS2_IRO_1_50_B", "ESRS2-IRO-1-50-b", "IRO-1 50(b) 보고서 포함 정보", "ESRS 2 – para 50(b)", "ESRS2_IRO1_50B"),
        rb("RULE_ESRS2_IRO_1_51", "ESRS2-IRO-1-51", "IRO-1 문단 51", "ESRS 2 – IRO-1 para 51", "ESRS2_IRO1_51"),
        rb("RULE_ESRS2_IRO_1_52", "ESRS2-IRO-1-52", "IRO-1 문단 52 목적", "ESRS 2 – IRO-1 para 52", "ESRS2_IRO1_52", cross=["ESRS 1 Ch.3"]),
        rb("RULE_ESRS2_IRO_1_53_A", "ESRS2-IRO-1-53-a", "IRO-1 53(a) 방법론·가정", "ESRS 2 – IRO-1 para 53(a)", "ESRS2_IRO1_53A"),
        rb("RULE_ESRS2_IRO_1_53_BI", "ESRS2-IRO-1-53-b-i", "IRO-1 53(b)(i)", "ESRS 2 – IRO-1 para 53(b)(i)", "ESRS2_IRO1_53BI"),
        rb("RULE_ESRS2_IRO_1_53_BII", "ESRS2-IRO-1-53-b-ii", "IRO-1 53(b)(ii)", "ESRS 2 – IRO-1 para 53(b)(ii)", "ESRS2_IRO1_53BII"),
        rb("RULE_ESRS2_IRO_1_53_BIII", "ESRS2-IRO-1-53-b-iii", "IRO-1 53(b)(iii)", "ESRS 2 – IRO-1 para 53(b)(iii)", "ESRS2_IRO1_53BIII"),
        rb("RULE_ESRS2_IRO_1_53_BIV", "ESRS2-IRO-1-53-b-iv", "IRO-1 53(b)(iv) 우선순위", "ESRS 2 – IRO-1 para 53(b)(iv)", "ESRS2_IRO1_53BIV", cross=["ESRS 1 Sec 3.4"]),
        rb("RULE_ESRS2_IRO_1_53_CI", "ESRS2-IRO-1-53-c-i", "IRO-1 53(c)(i) RO·의존성", "ESRS 2 – IRO-1 para 53(c)(i)", "ESRS2_IRO1_53CI"),
        rb("RULE_ESRS2_IRO_1_53_CII", "ESRS2-IRO-1-53-c-ii", "IRO-1 53(c)(ii) 평가 방법", "ESRS 2 – IRO-1 para 53(c)(ii)", "ESRS2_IRO1_53CII", cross=["ESRS 1 Sec 3.3"]),
        rb("RULE_ESRS2_IRO_1_53_CIII", "ESRS2-IRO-1-53-c-iii", "IRO-1 53(c)(iii) 위험 우선순위", "ESRS 2 – IRO-1 para 53(c)(iii)", "ESRS2_IRO1_53CIII"),
        rb("RULE_ESRS2_IRO_1_53_D", "ESRS2-IRO-1-53-d", "IRO-1 53(d) 의사결정·통제", "ESRS 2 – IRO-1 para 53(d)", "ESRS2_IRO1_53D"),
        rb("RULE_ESRS2_IRO_1_53_E", "ESRS2-IRO-1-53-e", "IRO-1 53(e) 전사 위험 통합", "ESRS 2 – IRO-1 para 53(e)", "ESRS2_IRO1_53E"),
        rb("RULE_ESRS2_IRO_1_53_F", "ESRS2-IRO-1-53-f", "IRO-1 53(f) 기회 통합", "ESRS 2 – IRO-1 para 53(f)", "ESRS2_IRO1_53F", dr="조건부"),
        rb("RULE_ESRS2_IRO_1_53_G", "ESRS2-IRO-1-53-g", "IRO-1 53(g) 입력 매개변수", "ESRS 2 – IRO-1 para 53(g)", "ESRS2_IRO1_53G"),
        rb("RULE_ESRS2_IRO_1_53_H", "ESRS2-IRO-1-53-h", "IRO-1 53(h) 절차 변경", "ESRS 2 – IRO-1 para 53(h)", "ESRS2_IRO1_53H"),
    ]

    for r in new_rules:
        if r["rulebook_id"] in have:
            raise SystemExit(f"rulebook exists: {r['rulebook_id']}")

    rbs.extend(new_rules)

    new_dp = (
        ["ESRS2-SEC-5", "ESRS2-SBM-3", "ESRS2-IRO-1"]
        + SBM3_CHILDREN
        + IRO1_CHILDREN
    )
    for top in rbs:
        if top["rulebook_id"] == "RULE_ESRS2_SBM_3":
            top["related_dp_ids"] = SBM3_CHILDREN.copy()
        if top["rulebook_id"] == "RULE_ESRS2_IRO_1":
            top["related_dp_ids"] = IRO1_CHILDREN.copy()
        if top["rulebook_id"] == "RULE_ESRS2":
            rel = top["related_dp_ids"]
            for x in new_dp:
                if x not in rel:
                    rel.append(x)
            top["related_dp_ids"] = rel
        if top["rulebook_id"] == "RULE_ESRS2_SEC_4":
            rel = top["related_dp_ids"]
            for x in ["ESRS2-SBM-3", "ESRS2-SEC-5", "ESRS2-IRO-1"]:
                if x not in rel:
                    rel.append(x)
            top["related_dp_ids"] = rel
            sc = top.get("section_content", "")
            if "SBM-3" not in sc:
                top["section_content"] = sc + " SBM-3 (paras 46–49) 및 제4장 IRO-1과 연계."

    json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=4)
    print("rulebook.json: +", len(new_rules), "rules")


def main_rb():
    inject_rulebooks()


if __name__ == "__main__":
    main()
    main_rb()
