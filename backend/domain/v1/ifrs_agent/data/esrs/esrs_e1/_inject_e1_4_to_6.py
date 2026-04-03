# Inject ESRS E1 paras 30–55 (E1-4, E1-5, E1-6) into datapoint.json and rulebook.json.
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DP_PATH = ROOT / "datapoint.json"
RB_PATH = ROOT / "rulebook.json"

V_STD = ["원문 문단·항목에 대응하는 서술·교차참조가 있는지 확인"]


def dp(
    dp_id: str,
    code: str,
    name_ko: str,
    name_en: str,
    description: str,
    parent: str,
    *,
    children: list | None = None,
    topic: str,
    subtopic: str,
    dp_type: str = "narrative",
    unit: str | None = None,
    dr: str = "필수",
    val: list | None = None,
):
    return {
        "dp_id": dp_id,
        "dp_code": code,
        "name_ko": name_ko,
        "name_en": name_en,
        "description": description,
        "standard": "ESRS",
        "category": "E",
        "topic": topic,
        "subtopic": subtopic,
        "dp_type": dp_type,
        "unit": unit,
        "equivalent_dps": [],
        "parent_indicator": parent,
        "child_dps": children or [],
        "financial_linkages": [],
        "financial_impact_type": None,
        "disclosure_requirement": dr,
        "reporting_frequency": "연간",
        "validation_rules": val or list(V_STD),
        "value_range": None,
    }


def rulebook_entry(
    dp_id: str,
    section_name: str,
    paragraph_reference: str,
    action: str,
    check_id: str,
    expected: str,
    description: str,
    cross_refs: list | None = None,
    dr: str = "필수",
):
    rid = "RULE_" + dp_id.replace("-", "_").upper()
    return {
        "rulebook_id": rid,
        "standard_id": "ESRSE1",
        "primary_dp_id": dp_id,
        "section_name": section_name,
        "section_content": f"{paragraph_reference}. datapoint.json description 참고.",
        "validation_rules": {
            "section_type": "disclosure_requirement",
            "paragraph_reference": paragraph_reference,
            "key_terms": ["ESRS E1", "climate change"],
            "required_actions": [
                {"action": action, "description": description, "mandatory": True}
            ],
            "verification_checks": [
                {
                    "check_id": check_id,
                    "description": description,
                    "expected": expected,
                }
            ],
            "cross_references": cross_refs or [],
        },
        "related_dp_ids": [dp_id],
        "rulebook_title": description,
        "disclosure_requirement": dr,
        "version": "1.0",
        "is_active": True,
        "is_primary": False,
        "effective_date": "2024-01-01",
        "mapping_notes": None,
        "conflicts_with": [],
    }


def rb_for_leaf(d: dict, section_name: str, pref: str, slug: str, cross=None, dr="필수"):
    """slug e.g. e1_4_30 -> check_id ESRSE1_E1_4_30"""
    check_id = "ESRSE1_" + slug.upper()
    action = "disclose_esrse1_" + slug
    expected = "esrse1_" + slug + "_traceable"
    return rulebook_entry(
        d["dp_id"],
        section_name,
        pref,
        action,
        check_id,
        expected,
        section_name,
        cross_refs=cross,
        dr=dr,
    )


NEW_DATA_POINTS = [
    dp(
        "ESRSE1-SEC-4",
        "ESRS_E1_SEC_4_METRICS_TARGETS",
        "4. 지표 및 목표",
        "Section 4 Metrics and targets",
        "문단 30~55: 공개 요건 E1-4(완화·적응 목표), E1-5(에너지 소비·구성 및 고기후영향 부문 에너지 집약도), E1-6(총 범위 1·2·3 및 총 온실가스 배출·집약도)을 포함합니다.",
        "ESRSE1",
        children=["ESRSE1-E1-4", "ESRSE1-E1-5", "ESRSE1-E1-6"],
        topic="지표·목표",
        subtopic="Section 4",
        val=["E1-4~E1-6가 문단 30~55 및 하위 항목과 정합하는지 확인"],
    ),
    # —— E1-4 ——
    dp(
        "ESRSE1-E1-4",
        "ESRS_E1_E1_4_TARGETS",
        "공개 요건 E1-4: 기후 변화 완화 및 적응 관련 목표",
        "Disclosure Requirement E1-4: Targets for mitigation and adaptation",
        "문단 30~34: 기후 관련 목표 공개(30), 공시 목적(31), ESRS 2 MDR-T 정보(32), 온실가스 감축·재생에너지·효율·적응 등 기타 목표 설정 여부·방법(33), 감축 목표 설정 시(12) MDR-T 및 34(a)~(f) 세부.",
        "ESRSE1-SEC-4",
        children=[
            "ESRSE1-E1-4-30",
            "ESRSE1-E1-4-31",
            "ESRSE1-E1-4-32",
            "ESRSE1-E1-4-33",
            "ESRSE1-E1-4-34-a",
            "ESRSE1-E1-4-34-b",
            "ESRSE1-E1-4-34-c",
            "ESRSE1-E1-4-34-d",
            "ESRSE1-E1-4-34-e",
            "ESRSE1-E1-4-34-f",
        ],
        topic="목표",
        subtopic="E1-4",
        val=["MDR-T(32)·조건부 34항이 원문 조건과 일치하는지 확인"],
    ),
    dp(
        "ESRSE1-E1-4-30",
        "ESRS_E1_E1_4_30_DISCLOSE_TARGETS",
        "문단 30: 기후 관련 목표 공개",
        "Para 30: Disclose climate-related targets",
        "기업은 설정한 기후 관련 목표를 공개합니다.",
        "ESRSE1-E1-4",
        topic="목표",
        subtopic="E1-4",
    ),
    dp(
        "ESRSE1-E1-4-31",
        "ESRS_E1_E1_4_31_OBJECTIVE",
        "문단 31: 본 공시 요건의 목적",
        "Para 31: Objective",
        "완화·적응 정책을 지원하고 중대 기후 영향·위험·기회에 대응하기 위해 설정한 목표를 이해할 수 있도록 합니다.",
        "ESRSE1-E1-4",
        topic="목표",
        subtopic="E1-4",
    ),
    dp(
        "ESRSE1-E1-4-32",
        "ESRS_E1_E1_4_32_MDR_T",
        "문단 32: ESRS 2 MDR-T 정보 포함",
        "Para 32: Include ESRS 2 MDR-T information",
        "문단 30 목표 공개에는 MDR-T 「목표를 통한 정책 및 조치의 효과 추적」에 요구되는 정보가 포함되어야 합니다.",
        "ESRSE1-E1-4",
        topic="목표",
        subtopic="E1-4",
        val=V_STD + ["ESRS 2 MDR-T 교차참조"],
    ),
    dp(
        "ESRSE1-E1-4-33",
        "ESRS_E1_E1_4_33_TARGET_TYPES",
        "문단 33: 온실가스 감축·재생에너지 등 목표 설정 여부·방법",
        "Para 33: Whether and how targets for GHG reductions, renewables, etc.",
        "온실가스 배출 감축 목표 및/또는 재생에너지, 에너지 효율, 기후 적응, 물리·전환 위험 완화 등 중대 IRO 관리 목표 설정 여부와 방법을 공개합니다.",
        "ESRSE1-E1-4",
        topic="목표",
        subtopic="E1-4",
    ),
    dp(
        "ESRSE1-E1-4-34-a",
        "ESRS_E1_E1_4_34_A_GHG_METRIC_FORM",
        "문단 34-(a): 감축 목표의 절대·강도 표시(조건부)",
        "Para 34 (a): Absolute and intensity GHG reduction targets (conditional)",
        "온실가스 배출 감축 목표는 절대값(tCO₂eq 또는 기준연도 대비 %)로 공개하고, 해당 시 강도 지표로도 공개합니다.",
        "ESRSE1-E1-4",
        topic="목표",
        subtopic="E1-4",
        dr="조건부",
        val=V_STD
        + [
            "온실가스 배출 감축 목표를 설정한 경우(각주 (12) 등)에 적용되는지 확인"
        ],
    ),
    dp(
        "ESRSE1-E1-4-34-b",
        "ESRS_E1_E1_4_34_B_SCOPE_AND_GROSS",
        "문단 34-(b): 범위 1·2·3별·통합 감축 목표·총량·크레딧 제외(조건부)",
        "Para 34 (b): Scope 1,2,3 targets; gross; no credits in target (conditional)",
        "범위 1·2·3에 대해 별도 또는 통합 감축 목표를 공개하고, 통합 시 적용 범위·비중·가스를 명시하며 인벤토리 경계와의 일관성(E1-6)·총량 목표(제거·탄소 크레딧·방지량으로 목표 달성 산정 불가)를 설명합니다.",
        "ESRSE1-E1-4",
        topic="목표",
        subtopic="E1-4",
        dr="조건부",
        val=V_STD + ["E1-6과의 정합·총량 목표 원칙"],
    ),
    dp(
        "ESRSE1-E1-4-34-c",
        "ESRS_E1_E1_4_34_C_BASE_YEAR",
        "문단 34-(c): 기준연도·기준값·갱신(조건부)",
        "Para 34 (c): Base year, baseline, updates every 5 years from 2030 (conditional)",
        "현재 기준연도·기준값을 공개하고, 2030년부터는 5년마다 기준연도를 갱신합니다. 과거 목표 달성 현황 공개는 본 표준과 정합되어야 합니다.",
        "ESRSE1-E1-4",
        topic="목표",
        subtopic="E1-4",
        dr="조건부",
    ),
    dp(
        "ESRSE1-E1-4-34-d",
        "ESRS_E1_E1_4_34_D_TARGET_YEARS",
        "문단 34-(d): 목표연도 2030·가능 시 2050·5년 주기(조건부)",
        "Para 34 (d): Target years 2030, 2050 if possible, 5-yearly from 2030 (conditional)",
        "최소 2030년 목표를 포함하고 가능하면 2050년 목표를 포함하며, 2030년 이후 5년마다 목표치를 설정합니다.",
        "ESRSE1-E1-4",
        topic="목표",
        subtopic="E1-4",
        dr="조건부",
    ),
    dp(
        "ESRSE1-E1-4-34-e",
        "ESRS_E1_E1_4_34_E_SCIENCE_15C",
        "문단 34-(e): 과학적 근거·1.5°C 정합·방법론·가정(조건부)",
        "Para 34 (e): Science-based, 1.5°C alignment, methodologies, assumptions (conditional)",
        "감축 목표가 과학적 근거·1.5°C 양립 여부, 사용 프레임워크·방법론(부문 경로·시나리오·외부 검증), 미래 전개 가정이 배출·감축에 미치는 영향을 간략히 설명합니다.",
        "ESRSE1-E1-4",
        topic="목표",
        subtopic="E1-4",
        dr="조건부",
    ),
    dp(
        "ESRSE1-E1-4-34-f",
        "ESRS_E1_E1_4_34_F_DECARB_LEVERS",
        "문단 34-(f): 탈탄소화 수단과 정량적 기여(조건부)",
        "Para 34 (f): Decarbonisation levers and quantitative contribution (conditional)",
        "감축 목표 달성에 기여할 탈탄소화 수단(효율·연료 전환·재생에너지·제품·공정 폐지·대체 등)과 전반적 정량적 기여를 기술합니다.",
        "ESRSE1-E1-4",
        topic="목표",
        subtopic="E1-4",
        dr="조건부",
    ),
    # —— E1-5 ——
    dp(
        "ESRSE1-E1-5",
        "ESRS_E1_E1_5_ENERGY",
        "공개 요건 E1-5: 에너지 소비 및 구성(및 고기후영향 부문 집약도)",
        "Disclosure Requirement E1-5: Energy consumption, mix, intensity",
        "문단 35~39: 에너지 소비·구성(MWh), 37 세분, 38 고기후영향 부문 화석연료 세분, 39 에너지 생산량. 문단 40~43: 고기후영향 부문 에너지 집약도(순매출 대비), 산출 범위·부문 명시·재무제표 연계.",
        "ESRSE1-SEC-4",
        children=[
            "ESRSE1-E1-5-35",
            "ESRSE1-E1-5-36",
            "ESRSE1-E1-5-37-a",
            "ESRSE1-E1-5-37-b",
            "ESRSE1-E1-5-37-c-i",
            "ESRSE1-E1-5-37-c-ii",
            "ESRSE1-E1-5-37-c-iii",
            "ESRSE1-E1-5-38-a",
            "ESRSE1-E1-5-38-b",
            "ESRSE1-E1-5-38-c",
            "ESRSE1-E1-5-38-d",
            "ESRSE1-E1-5-38-e",
            "ESRSE1-E1-5-39",
            "ESRSE1-E1-5-40",
            "ESRSE1-E1-5-41",
            "ESRSE1-E1-5-42",
            "ESRSE1-E1-5-43",
        ],
        topic="에너지",
        subtopic="E1-5",
        val=["MWh 단위·고기후영향 부문 38·40~43 조건이 원문과 일치하는지 확인"],
    ),
    dp(
        "ESRSE1-E1-5-35",
        "ESRS_E1_E1_5_35_ENERGY_MIX_INFO",
        "문단 35: 에너지 소비량 및 구성 정보",
        "Para 35: Energy consumption and mix",
        "기업은 에너지 소비량 및 구성에 관한 정보를 제공합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
    ),
    dp(
        "ESRSE1-E1-5-36",
        "ESRS_E1_E1_5_36_OBJECTIVE",
        "문단 36: 공시 목적",
        "Para 36: Objective",
        "총 에너지 소비, 효율 개선, 화석연료 노출, 재생에너지 비중 등에 대한 이해를 제공합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
    ),
    dp(
        "ESRSE1-E1-5-37-a",
        "ESRS_E1_E1_5_37_A_FOSSIL_MWH",
        "문단 37-(a): 화석연료 원천 총 에너지 소비(MWh)",
        "Para 37 (a): Total energy from fossil sources (MWh)",
        "자체 운영에서 화석 연료 원천의 총 에너지 소비량(MWh)을 공개합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
        dp_type="quantitative",
        unit="MWh",
    ),
    dp(
        "ESRSE1-E1-5-37-b",
        "ESRS_E1_E1_5_37_B_NUCLEAR_MWH",
        "문단 37-(b): 원자력 원천 총 에너지 소비(MWh)",
        "Para 37 (b): Total energy from nuclear (MWh)",
        "원자력 에너지 원천으로부터의 총 에너지 소비량(MWh)을 공개합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
        dp_type="quantitative",
        unit="MWh",
    ),
    dp(
        "ESRSE1-E1-5-37-c-i",
        "ESRS_E1_E1_5_37_C_I_RENEWABLE_FUELS",
        "문단 37-(c)-i: 재생 가능 연료 소비(바이오매스 등)",
        "Para 37 (c) i: Renewable fuel consumption including biomass, biogas, etc.",
        "재생 가능 원천 연료 소비량을 공개합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
        dp_type="quantitative",
        unit="MWh",
    ),
    dp(
        "ESRSE1-E1-5-37-c-ii",
        "ESRS_E1_E1_5_37_C_II_RENEWABLE_PURCHASED",
        "문단 37-(c)-ii: 재생원천 구매 전력·열·증기·냉각",
        "Para 37 (c) ii: Purchased electricity, heat, steam, cooling from renewables",
        "재생 가능 에너지원에서 구입·취득한 전력·열·증기·냉각 소비를 공개합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
        dp_type="quantitative",
        unit="MWh",
    ),
    dp(
        "ESRSE1-E1-5-37-c-iii",
        "ESRS_E1_E1_5_37_C_III_SELF_NONFUEL_RE",
        "문단 37-(c)-iii: 자체 생산 비연료 재생에너지 소비",
        "Para 37 (c) iii: Self-generated non-fuel renewable consumption",
        "자체 생산한 비연료 재생에너지 소비량을 공개합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
        dp_type="quantitative",
        unit="MWh",
    ),
    dp(
        "ESRSE1-E1-5-38-a",
        "ESRS_E1_E1_5_38_A_COAL",
        "문단 38-(a): 석탄·석탄제품 연료 소비(고기후영향 부문)",
        "Para 38 (a): Coal consumption (high climate impact sectors)",
        "고기후영향 부문 기업은 화석연료 소비를 석탄·석탄제품별로 추가 세분합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
        dr="조건부",
        dp_type="quantitative",
        unit="MWh",
        val=V_STD + ["고기후영향 부문 적용 여부"],
    ),
    dp(
        "ESRSE1-E1-5-38-b",
        "ESRS_E1_E1_5_38_B_OIL",
        "문단 38-(b): 원유·석유제품 연료 소비(고기후영향 부문)",
        "Para 38 (b): Crude oil and petroleum products (high climate impact sectors)",
        "고기후영향 부문: 원유 및 석유 제품 연료 소비를 공개합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
        dr="조건부",
        dp_type="quantitative",
        unit="MWh",
        val=V_STD + ["고기후영향 부문 적용 여부"],
    ),
    dp(
        "ESRSE1-E1-5-38-c",
        "ESRS_E1_E1_5_38_C_GAS",
        "문단 38-(c): 천연가스 연료 소비(고기후영향 부문)",
        "Para 38 (c): Natural gas (high climate impact sectors)",
        "고기후영향 부문: 천연가스 연료 소비량을 공개합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
        dr="조건부",
        dp_type="quantitative",
        unit="MWh",
        val=V_STD + ["고기후영향 부문 적용 여부"],
    ),
    dp(
        "ESRSE1-E1-5-38-d",
        "ESRS_E1_E1_5_38_D_OTHER_FOSSIL",
        "문단 38-(d): 기타 화석연료 원천 연료 소비(고기후영향 부문)",
        "Para 38 (d): Other fossil sources (high climate impact sectors)",
        "고기후영향 부문: 기타 화석연료 원천 연료 소비를 공개합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
        dr="조건부",
        dp_type="quantitative",
        unit="MWh",
        val=V_STD + ["고기후영향 부문 적용 여부"],
    ),
    dp(
        "ESRSE1-E1-5-38-e",
        "ESRS_E1_E1_5_38_E_FOSSIL_PURCHASED_ENERGY",
        "문단 38-(e): 화석원천 구매 전력·열·증기·냉각(고기후영향 부문)",
        "Para 38 (e): Purchased e/h/s/c from fossil sources (high climate impact sectors)",
        "고기후영향 부문: 화석 연료 원천에서 구매·취득한 전력·열·증기·냉각 소비를 공개합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
        dr="조건부",
        dp_type="quantitative",
        unit="MWh",
        val=V_STD + ["고기후영향 부문 적용 여부"],
    ),
    dp(
        "ESRSE1-E1-5-39",
        "ESRS_E1_E1_5_39_ENERGY_PRODUCTION",
        "문단 39: 재생·비재생 에너지 생산량(MWh)",
        "Para 39: Non-renewable and renewable energy production (MWh)",
        "해당 시 재생 불가능·재생 가능 에너지 생산량을 MWh로 별도 공개합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
        dr="조건부",
        dp_type="quantitative",
        unit="MWh",
    ),
    dp(
        "ESRSE1-E1-5-40",
        "ESRS_E1_E1_5_40_ENERGY_INTENSITY_HIGH_IMPACT",
        "문단 40: 고기후영향 부문 에너지 집약도 정보",
        "Para 40: Energy intensity for high climate impact sectors",
        "기후 영향이 큰 부문 활동과 관련된 에너지 집약도(순매출액당 총 에너지 소비) 정보를 제공합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
        dr="조건부",
        val=V_STD + ["고기후영향 부문 적용 시"],
    ),
    dp(
        "ESRSE1-E1-5-41",
        "ESRS_E1_E1_5_41_INTENSITY_SCOPE",
        "문단 41: 집약도 산출 범위(해당 부문 소비·순매출만)",
        "Para 41: Intensity based only on high-impact sector consumption and turnover",
        "문단 40 에너지 집약도는 고기후영향 부문 활동에서 발생한 총 에너지 소비와 순매출액만으로 산출합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
        dr="조건부",
    ),
    dp(
        "ESRSE1-E1-5-42",
        "ESRS_E1_E1_5_42_SPECIFY_SECTORS",
        "문단 42: 적용 고기후영향 부문 명시",
        "Para 42: Specify high climate impact sectors used",
        "에너지 집약도 산정 시 적용된 고기후영향 부문을 명시합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
        dr="조건부",
    ),
    dp(
        "ESRSE1-E1-5-43",
        "ESRS_E1_E1_5_43_TURNOVER_FS_RECONCILE",
        "문단 43: 분모 순매출의 재무제표 반영",
        "Para 43: How high-impact sector net turnover maps to financial statements",
        "고기후영향 부문 활동 순매출(집약도 분모)이 재무제표 관련 항목·주석에 어떻게 반영되었는지 공개합니다.",
        "ESRSE1-E1-5",
        topic="에너지",
        subtopic="E1-5",
        dr="조건부",
    ),
    # —— E1-6 ——
    dp(
        "ESRSE1-E1-6",
        "ESRS_E1_E1_6_GHG_EMISSIONS",
        "공개 요건 E1-6: 총 범위 1·2·3 및 총 온실가스 배출량",
        "Disclosure Requirement E1-6: Gross Scopes 1, 2, 3 and total GHG emissions",
        "문단 44~55: tCO₂eq 단위 총 배출(44), 목적(45), 경계·비교(46~47), 범위1~3·총량·집약도 세부(48~55).",
        "ESRSE1-SEC-4",
        children=[
            "ESRSE1-E1-6-44-a",
            "ESRSE1-E1-6-44-b",
            "ESRSE1-E1-6-44-c",
            "ESRSE1-E1-6-44-d",
            "ESRSE1-E1-6-45-a",
            "ESRSE1-E1-6-45-b",
            "ESRSE1-E1-6-45-c",
            "ESRSE1-E1-6-45-d",
            "ESRSE1-E1-6-46",
            "ESRSE1-E1-6-47",
            "ESRSE1-E1-6-48-a",
            "ESRSE1-E1-6-48-b",
            "ESRSE1-E1-6-49-a",
            "ESRSE1-E1-6-49-b",
            "ESRSE1-E1-6-50-a",
            "ESRSE1-E1-6-50-b",
            "ESRSE1-E1-6-51",
            "ESRSE1-E1-6-52-a",
            "ESRSE1-E1-6-52-b",
            "ESRSE1-E1-6-53",
            "ESRSE1-E1-6-54",
            "ESRSE1-E1-6-55",
        ],
        topic="온실가스 배출",
        subtopic="E1-6",
        val=["범위 1·2·3·총량·집약도가 문단 44~55와 정합하는지 확인"],
    ),
    dp(
        "ESRSE1-E1-6-44-a",
        "ESRS_E1_E1_6_44_A_SCOPE1",
        "문단 44-(a): 총 범위 1 온실가스 배출량(tCO₂eq)",
        "Para 44 (a): Gross Scope 1 GHG emissions",
        "총 범위 1 온실가스 배출량을 이산화탄소 환산 메트릭 톤(tCO₂eq)으로 공개합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    dp(
        "ESRSE1-E1-6-44-b",
        "ESRS_E1_E1_6_44_B_SCOPE2",
        "문단 44-(b): 총 범위 2 온실가스 배출량(tCO₂eq)",
        "Para 44 (b): Gross Scope 2 GHG emissions",
        "총 범위 2 온실가스 배출량을 tCO₂eq으로 공개합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    dp(
        "ESRSE1-E1-6-44-c",
        "ESRS_E1_E1_6_44_C_SCOPE3",
        "문단 44-(c): 총 범위 3 온실가스 배출량(tCO₂eq)",
        "Para 44 (c): Gross Scope 3 GHG emissions",
        "총 범위 3 온실가스 배출량을 tCO₂eq으로 공개합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    dp(
        "ESRSE1-E1-6-44-d",
        "ESRS_E1_E1_6_44_D_TOTAL_GHG",
        "문단 44-(d): 총 온실가스 배출량(tCO₂eq)",
        "Para 44 (d): Total GHG emissions",
        "총 온실가스 배출량을 tCO₂eq으로 공개합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    dp(
        "ESRSE1-E1-6-45-a",
        "ESRS_E1_E1_6_45_A_OBJECTIVE_S1",
        "문단 45-(a): 44(a) 공시 목적(직접 영향·배출권 비중)",
        "Para 45 (a): Objective for Scope 1 disclosure",
        "기후에 대한 직접 영향 및 배출권 거래제도로 규제되는 배출 비중 이해.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
    ),
    dp(
        "ESRSE1-E1-6-45-b",
        "ESRS_E1_E1_6_45_B_OBJECTIVE_S2",
        "문단 45-(b): 44(b) 공시 목적(외부 조달 에너지 간접 영향)",
        "Para 45 (b): Objective for Scope 2 disclosure",
        "외부에서 구매·취득한 에너지 사용과 관련된 간접 영향 이해.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
    ),
    dp(
        "ESRSE1-E1-6-45-c",
        "ESRS_E1_E1_6_45_C_OBJECTIVE_S3",
        "문단 45-(c): 44(c) 공시 목적(가치사슬·전환위험)",
        "Para 45 (c): Objective for Scope 3 disclosure",
        "상·하류 가치사슬 배출 이해; 범위3가 인벤토리·전환위험의 주요 요인일 수 있음.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
    ),
    dp(
        "ESRSE1-E1-6-45-d",
        "ESRS_E1_E1_6_45_D_OBJECTIVE_TOTAL",
        "문단 45-(d): 44(d) 공시 목적(전체 배출·목표·정책)",
        "Para 45 (d): Objective for total GHG disclosure",
        "자체 운영 대 가치사슬 배출의 전반적 이해; 기후 목표·EU 정책 목표 대비 진전 측정 전제.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
    ),
    dp(
        "ESRSE1-E1-6-46",
        "ESRS_E1_E1_6_46_BOUNDARY_ESRS1",
        "문단 46: 공시 경계(ESRS 1, 운영통제·관계사 등)",
        "Para 46: Boundaries per ESRS 1 paras 62–67, operational control",
        "문단 44 배출 공개 시 ESRS 1 제62~67항을 참고합니다. 관계기업·합작 등은 운영 통제 범위 내 배출을 포함합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
        val=V_STD + ["ESRS 1 경계·운영 통제 교차참조"],
    ),
    dp(
        "ESRSE1-E1-6-47",
        "ESRS_E1_E1_6_47_ORGANIZATIONAL_CHANGE",
        "문단 47: 조직·가치사슬 정의 중대 변경",
        "Para 47: Material changes affecting comparability",
        "보고 기업 및 가치사슬 정의에 중대한 변경 시 공개하고 연도별 배출 비교 가능성에 미치는 영향을 설명합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
    ),
    dp(
        "ESRSE1-E1-6-48-a",
        "ESRS_E1_E1_6_48_A_S1_TOTAL",
        "문단 48-(a): 총 범위 1 배출(tCO₂eq)",
        "Para 48 (a): Total Scope 1 in tCO₂eq",
        "총 범위 1 온실가스 배출량(CO₂eq 톤)을 포함합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    dp(
        "ESRSE1-E1-6-48-b",
        "ESRS_E1_E1_6_48_B_S1_REGULATED_SHARE",
        "문단 48-(b): 규제 배출권 거래제도 스코프1 비율",
        "Para 48 (b): Share of Scope 1 from regulated ETS",
        "규제 대상 배출권 거래 제도에 따른 범위 1 배출 비율을 공개합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
        dp_type="quantitative",
        unit="ratio",
    ),
    dp(
        "ESRSE1-E1-6-49-a",
        "ESRS_E1_E1_6_49_A_S2_LOCATION",
        "문단 49-(a): 위치기반 총 범위 2(tCO₂eq)",
        "Para 49 (a): Location-based gross Scope 2",
        "위치 기반 총 범위 2 온실가스 배출량(tCO₂eq)을 공개합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    dp(
        "ESRSE1-E1-6-49-b",
        "ESRS_E1_E1_6_49_B_S2_MARKET",
        "문단 49-(b): 시장기반 범위 2(tCO₂eq)",
        "Para 49 (b): Market-based Scope 2",
        "시장 기반 범위 2 온실가스 배출량(tCO₂eq)을 공개합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    dp(
        "ESRSE1-E1-6-50-a",
        "ESRS_E1_E1_6_50_A_S1S2_CONSOLIDATED",
        "문단 50-(a): 연결 회계그룹(모·자) 스코프1·2 세분",
        "Para 50 (a): Scope 1 and 2 for consolidated accounting group",
        "통합 회계 그룹(모회사 및 자회사)에 대한 범위 1·2를 별도 공개합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    dp(
        "ESRSE1-E1-6-50-b",
        "ESRS_E1_E1_6_50_B_S1S2_NON_FULLY_CONSOLIDATED",
        "문단 50-(b): 비완전 연결·공동계약 등 스코프1·2 세분",
        "Para 50 (b): Scope 1 and 2 for associates, JVs, non-consolidated, joint arrangements",
        "완전 연결되지 않은 관계사·합작·비연결 자회사·공동 통제 운영 등 운영 통제 계약적 배열의 범위 1·2를 별도 공개합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    dp(
        "ESRSE1-E1-6-51",
        "ESRS_E1_E1_6_51_SCOPE3_BY_CATEGORY",
        "문단 51: 범위 3—우선 범주별 배출(tCO₂eq)",
        "Para 51: Scope 3 by each prioritised category",
        "우선순위가 부여된 각 범위 3 범주별 tCO₂eq 배출량을 포함합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    dp(
        "ESRSE1-E1-6-52-a",
        "ESRS_E1_E1_6_52_A_TOTAL_LOCATION_S2",
        "문단 52-(a): 총 배출—위치기반 범위2 기준 합계",
        "Para 52 (a): Total GHG using location-based Scope 2",
        "문단 44(d) 총 온실가스 배출은 44(a)~(c) 합계이며, 위치 기반 범위 2에서 파생된 총 배출을 뚜렷이 구분하여 공개합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    dp(
        "ESRSE1-E1-6-52-b",
        "ESRS_E1_E1_6_52_B_TOTAL_MARKET_S2",
        "문단 52-(b): 총 배출—시장기반 범위2 기준 합계",
        "Para 52 (b): Total GHG using market-based Scope 2",
        "시장 기반 범위 2에서 파생된 총 온실가스 배출을 뚜렷이 구분하여 공개합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
        dp_type="quantitative",
        unit="tCO2eq",
    ),
    dp(
        "ESRSE1-E1-6-53",
        "ESRS_E1_E1_6_53_GHG_INTENSITY_REQUIRED",
        "문단 53: 온실가스 배출 집약도(순매출당) 공개",
        "Para 53: Disclose GHG emission intensity per net revenue",
        "순매출액당 총 온실가스 배출량(배출 집약도)을 공개합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
        dp_type="quantitative",
        unit="tCO2eq per currency turnover",
    ),
    dp(
        "ESRSE1-E1-6-54",
        "ESRS_E1_E1_6_54_INTENSITY_NUMERATOR",
        "문단 54: 집약도—분자는 44(d) 총 배출(tCO₂eq)",
        "Para 54: Intensity numerator is total GHG per 44(d)",
        "문단 53 집약도는 순매출당 문단 44(d)에 따른 총 온실가스 배출(tCO₂eq)을 사용합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
    ),
    dp(
        "ESRSE1-E1-6-55",
        "ESRS_E1_E1_6_55_REVENUE_RECONCILIATION",
        "문단 55: 분모 순매출의 재무제표 조정",
        "Para 55: Reconcile net revenue denominator to financial statements",
        "순매출(집약도 분모)이 재무제표 관련 항목·주석과 어떻게 조정되는지 공개합니다.",
        "ESRSE1-E1-6",
        topic="온실가스 배출",
        subtopic="E1-6",
    ),
]


def slug_from_dp_id(dp_id: str) -> str:
    # ESRSE1-E1-4-30 -> e1_4_30; ESRSE1-SEC-4 -> sec_4
    rest = dp_id.removeprefix("ESRSE1-").lower().replace("-", "_")
    return rest


def make_parent_rulebook(dp_id: str, title: str, pref: str, child_ids: list[str], cross=None):
    rid = "RULE_" + dp_id.replace("-", "_").upper()
    slug = slug_from_dp_id(dp_id)
    check_id = "ESRSE1_" + slug.upper()
    action = "disclose_esrse1_" + slug
    expected = "esrse1_" + slug + "_traceable"
    return {
        "rulebook_id": rid,
        "standard_id": "ESRSE1",
        "primary_dp_id": dp_id,
        "section_name": title,
        "section_content": f"{pref}. 하위 문단 datapoint.json 참고.",
        "validation_rules": {
            "section_type": "disclosure_requirement",
            "paragraph_reference": pref,
            "key_terms": ["ESRS E1", "climate change"],
            "required_actions": [
                {"action": action, "description": title, "mandatory": True}
            ],
            "verification_checks": [
                {
                    "check_id": check_id,
                    "description": title,
                    "expected": expected,
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


def main():
    data = json.loads(DP_PATH.read_text(encoding="utf-8"))
    dps = data["data_points"]
    by_id = {x["dp_id"]: x for x in dps}

    if "ESRSE1-SEC-4" in by_id:
        print("ESRSE1-SEC-4 already present; abort")
        return

    root = by_id["ESRSE1"]
    root["child_dps"] = root.get("child_dps", []) + ["ESRSE1-SEC-4"]
    root["description"] = (
        "ESRS E1(기후변화) 공시: 거버넌스·전략·IRO 관리·정책·조치·지표·목표 등. "
        "문단 13~55 범위를 다룹니다."
    )
    root["validation_rules"] = [
        "문단 13~19(거버넌스·전략), 20~21(IRO-1 기후), 22~25(E1-2), 26~29(E1-3), "
        "30~34(E1-4), 35~43(E1-5), 44~55(E1-6)이 원문·교차참조와 일치하는지 확인"
    ]

    data["data_points"] = dps + NEW_DATA_POINTS
    DP_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=4), encoding="utf-8")

    rb = json.loads(RB_PATH.read_text(encoding="utf-8"))
    rbs = rb["rulebooks"]
    existing_checks = set()
    for r in rbs:
        for vc in r.get("validation_rules", {}).get("verification_checks", []):
            existing_checks.add(vc["check_id"])

    new_rules = [
        make_parent_rulebook(
            "ESRSE1-SEC-4",
            "Section 4 지표·목표",
            "ESRS E1 Section 4 paras 30–55",
            ["ESRSE1-E1-4", "ESRSE1-E1-5", "ESRSE1-E1-6"],
        ),
        make_parent_rulebook(
            "ESRSE1-E1-4",
            "E1-4 목표(30–34)",
            "ESRS E1 - E1-4 paras 30–34",
            [c["dp_id"] for c in NEW_DATA_POINTS if c["dp_id"].startswith("ESRSE1-E1-4-")],
            cross=["ESRS2-MDR-T"],
        ),
        make_parent_rulebook(
            "ESRSE1-E1-5",
            "E1-5 에너지(35–43)",
            "ESRS E1 - E1-5 paras 35–43",
            [c["dp_id"] for c in NEW_DATA_POINTS if c["dp_id"].startswith("ESRSE1-E1-5-")],
        ),
        make_parent_rulebook(
            "ESRSE1-E1-6",
            "E1-6 GHG 배출(44–55)",
            "ESRS E1 - E1-6 paras 44–55",
            [c["dp_id"] for c in NEW_DATA_POINTS if c["dp_id"].startswith("ESRSE1-E1-6-")],
            cross=["ESRS1"],
        ),
    ]

    for d in NEW_DATA_POINTS:
        if d["dp_id"] in (
            "ESRSE1-SEC-4",
            "ESRSE1-E1-4",
            "ESRSE1-E1-5",
            "ESRSE1-E1-6",
        ):
            continue
        slug = slug_from_dp_id(d["dp_id"])
        sn = d["name_ko"][:80]
        pref = f"ESRS E1 - {d['dp_id']}"
        dr = d["disclosure_requirement"]
        entry = rb_for_leaf(
            d,
            sn,
            pref,
            slug,
            cross=(
                ["ESRS2-MDR-T"]
                if "E1-4-34" in d["dp_id"]
                else (
                    ["ESRS1"]
                    if d["dp_id"] == "ESRSE1-E1-6-46"
                    else None
                )
            ),
            dr=dr,
        )
        new_rules.append(entry)

    for r in new_rules:
        cid = r["validation_rules"]["verification_checks"][0]["check_id"]
        if cid in existing_checks:
            raise SystemExit(f"duplicate check_id: {cid}")
        existing_checks.add(cid)

    rbs.extend(new_rules)

    top = next(x for x in rbs if x["rulebook_id"] == "RULE_ESRSE1")
    top["section_name"] = "ESRS E1 (문단 13~55)"
    top["section_content"] = "ESRS E1 기후변화 — datapoint.json과 동일 범위."
    top["validation_rules"]["paragraph_reference"] = "ESRS E1 - paras 13-55"
    top["related_dp_ids"] = [x["dp_id"] for x in data["data_points"]]

    RB_PATH.write_text(json.dumps(rb, ensure_ascii=False, indent=4), encoding="utf-8")
    print("added datapoints", len(NEW_DATA_POINTS), "rulebooks", len(new_rules))


if __name__ == "__main__":
    main()
