"""One-off merge: add Disclosure 305-2 and 305-3 datapoints. Run from repo root."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
dp_path = root / "datapoint.json"
data = json.loads(dp_path.read_text(encoding="utf-8"))
pts = data["data_points"]


def find(pid: str):
    for p in pts:
        if p["dp_id"] == pid:
            return p
    raise KeyError(pid)


find("GRI305")["description"] = (
    "GRI 305는 조직의 온실가스·대기 배출 등 배출 관련 영향에 대한 공시를 다룹니다. "
    "본 시드는 섹션 1(주제별 관리), 공개 305-1·305-2·305-3(Scope 1·2·3)을 포함합니다."
)
find("GRI305")["validation_rules"] = ["시드 범위: 주제별 관리·공개 305-1·305-2·305-3"]

sec2 = find("GRI305-SEC-2")
sec2["name_ko"] = "섹션 2: 주제별 공시(시드: 305-1~305-3)"
sec2["name_en"] = "Section 2: Topic-related disclosures (seed: 305-1 to 305-3)"
sec2["description"] = (
    "배출과 관련된 주제별 정량·정성 공시 항목을 포함합니다. 본 시드에는 공개 305-1·305-2·305-3을 포함합니다."
)
sec2["child_dps"] = ["GRI305-1", "GRI305-2", "GRI305-3"]
sec2["validation_rules"] = ["공개 305-1·305-2·305-3 요건 충족(시드 범위)"]

new_dps: list[dict] = []


def P(**kw):
    new_dps.append(kw)


P(
    dp_id="GRI305-2",
    dp_code="GRI_305_DIS_2_SCOPE2_GHG",
    name_ko="공개 305-2: 에너지 간접(Scope 2) 온실가스 배출",
    name_en="Disclosure 305-2: Energy indirect (Scope 2) GHG emissions",
    description=(
        "구매·취득한 전력·열·냉방·스팀 등으로 인한 에너지 간접(Scope 2) 배출을 위치 기반 및(해당 시) 시장 기반으로 보고합니다. "
        "GHG Protocol Scope 2 Guidance에 따른 이중 보고 원칙을 반영합니다. "
        "주의: GRI305-1-1·GRI305-1-2는 공개 305-1의 정보 수집 절번 2.1·2.2 그룹이며 본 공개(GRI305-2)의 자식이 아닙니다."
    ),
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 2",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-SEC-2",
    child_dps=[
        "GRI305-2-a",
        "GRI305-2-b",
        "GRI305-2-c",
        "GRI305-2-d",
        "GRI305-2-e",
        "GRI305-2-f",
        "GRI305-2-g",
        "GRI305-2-3",
        "GRI305-2-4",
    ],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=[
        "하위 a~g 및 정보 수집 2.3(GRI305-2-3)·권고 2.4(GRI305-2-4) 충족",
        "지침: RULE_GRI305_2_G_GUIDANCE",
    ],
    value_range=None,
)

P(
    dp_id="GRI305-2-a",
    dp_code="GRI_305_DIS_2_A_LOCATION_BASED",
    name_ko="공개 305-2-a: 위치 기반 총 Scope 2 배출",
    name_en="Disclosure 305-2-a: Location-based gross Scope 2 GHG emissions",
    description="위치 기반(location-based) 총 에너지 간접(Scope 2) 온실가스 배출량을 t CO2e로 보고합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 2 위치기반",
    dp_type="quantitative",
    unit="tco2e",
    equivalent_dps=[],
    parent_indicator="GRI305-2",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=[
        "t CO2e 단위",
        "그리드 평균 등 위치 기반 계수 사용 근거",
        "GRI305-2-3-1·2-3-3·2-3-4와 산정 경계 정합",
    ],
    value_range=None,
)

P(
    dp_id="GRI305-2-b",
    dp_code="GRI_305_DIS_2_B_MARKET_BASED",
    name_ko="공개 305-2-b: 시장 기반 Scope 2 배출(해당 시)",
    name_en="Disclosure 305-2-b: Market-based Scope 2 GHG emissions, if applicable",
    description=(
        "해당되는 경우 시장 기반(market-based) 에너지 간접(Scope 2) 온실가스 배출량을 t CO2e로 보고합니다. "
        "계약·증서·잔여믹스(residual mix) 등 시장 기반 계수와 품질기준을 지침과 정합되게 설명합니다."
    ),
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 2 시장기반",
    dp_type="quantitative",
    unit="tco2e",
    equivalent_dps=[],
    parent_indicator="GRI305-2",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="조건부",
    reporting_frequency="연간",
    validation_rules=[
        "시장 기반이 적용되는 경우 수치·계수 출처·이중계상 방지 논리 명시",
        "GRI305-2-3-4와 병행 시 위치 기반(a)과 구분",
    ],
    value_range=None,
)

P(
    dp_id="GRI305-2-c",
    dp_code="GRI_305_DIS_2_C_GASES",
    name_ko="공개 305-2-c: 산정에 포함된 가스(가능한 경우)",
    name_en="Disclosure 305-2-c: Gases included, if applicable",
    description="가능한 경우 산정에 포함된 온실가스를 명시합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 2 가스",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-2",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="조건부",
    reporting_frequency="연간",
    validation_rules=["포함 가스 또는 CO2e 단일 지표임을 명시"],
    value_range=None,
)

P(
    dp_id="GRI305-2-d",
    dp_code="GRI_305_DIS_2_D_BASE_YEAR",
    name_ko="공개 305-2-d: 기준 연도(해당 시)",
    name_en="Disclosure 305-2-d: Base year, if applicable",
    description="해당 시 기준 연도 및 하위 i~iii를 보고합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 2 기준년도",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-2",
    child_dps=["GRI305-2-d-i", "GRI305-2-d-ii", "GRI305-2-d-iii"],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["해당 없음 시 명시", "d-i~iii 충족(해당 시)"],
    value_range=None,
)

for suf, ko, en, q in [
    ("i", "기준 연도 선정 근거", "Rationale", False),
    ("ii", "기준 연도 배출량", "Emissions in base year", True),
    ("iii", "재계산 유발 중대 변화 맥락", "Recalculation context", False),
]:
    P(
        dp_id=f"GRI305-2-d-{suf}",
        dp_code=f"GRI_305_DIS_2_D_{suf.upper()}_BASE",
        name_ko=f"공개 305-2-d-{suf}: {ko}",
        name_en=f"Disclosure 305-2-d-{suf}: {en}",
        description=f"공개 305-2-d 하위 {suf} 요구사항.",
        standard="GRI",
        category="E",
        topic="온실가스",
        subtopic="Scope 2 기준년도",
        dp_type="quantitative" if q else "narrative",
        unit="tco2e" if q else None,
        equivalent_dps=[],
        parent_indicator="GRI305-2-d",
        child_dps=[],
        financial_linkages=[],
        financial_impact_type=None,
        disclosure_requirement="필수",
        reporting_frequency="연간",
        validation_rules=[f"305-2-d-{suf} 충족"],
        value_range=None,
    )

P(
    dp_id="GRI305-2-e",
    dp_code="GRI_305_DIS_2_E_FACTORS_GWP",
    name_ko="공개 305-2-e: 배출계수 및 GWP 출처",
    name_en="Disclosure 305-2-e: Emission factors and GWP sources",
    description="배출계수 및 GWP 값의 출처 또는 GWP 출처 참조를 보고합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 2 계수",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-2",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["위치·시장 기반 각각의 계수 출처 추적 가능"],
    value_range=None,
)

P(
    dp_id="GRI305-2-f",
    dp_code="GRI_305_DIS_2_F_CONSOLIDATION",
    name_ko="공개 305-2-f: 배출 통합 접근법",
    name_en="Disclosure 305-2-f: Consolidation approach",
    description="지분율·재무적 통제권·운영 통제권 중 배출 통합 방식을 보고합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 2 연결",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-2",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["GHG Protocol 연결 방식 명시", "GRI305-2-4-3·GRI305-1-f와 논리 정합"],
    value_range=None,
)

P(
    dp_id="GRI305-2-g",
    dp_code="GRI_305_DIS_2_G_METHODS",
    name_ko="공개 305-2-g: 기준·방법론·가정·도구",
    name_en="Disclosure 305-2-g: Standards, methodologies, assumptions, tools",
    description="사용한 기준, 방법론, 가정 및/또는 계산 도구를 보고합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 2 방법론",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-2",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["방법론 식별 가능"],
    value_range=None,
)

P(
    dp_id="GRI305-2-3",
    dp_code="GRI_305_DIS_2_COMP_2_3",
    name_ko="공개 305-2: 정보 수집 요건 2.3",
    name_en="Disclosure 305-2: Compilation requirements 2.3 (shall)",
    description="공개 305-2 정보 집계 시 준수할 필수 규칙(절 2.3)입니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="정보 수집 2.3",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-2",
    child_dps=["GRI305-2-3-1", "GRI305-2-3-2", "GRI305-2-3-3", "GRI305-2-3-4"],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["2.3.1~2.3.4 하위 준수"],
    value_range=None,
)

P(
    dp_id="GRI305-2-3-1",
    dp_code="GRI_305_DIS_2_COMP_2_3_1",
    name_ko="정보 수집 2.3.1: Scope 2 산정에서 GHG 거래 제외",
    name_en="Compilation 2.3.1: Exclude GHG trades from Scope 2",
    description="총 에너지 간접(Scope 2) 온실가스 배출량 계산에서 온실가스 거래량을 제외합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="2.3.1",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-2-3",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["거래·상쇄가 Scope 2 gross에 섞이지 않음"],
    value_range=None,
)

P(
    dp_id="GRI305-2-3-2",
    dp_code="GRI_305_DIS_2_COMP_2_3_2",
    name_ko="정보 수집 2.3.2: 공개 305-3에 따른 Scope 3 제외",
    name_en="Compilation 2.3.2: Exclude Scope 3 per Disclosure 305-3",
    description="공개 305-3에 명시된 기타 간접(Scope 3) 배출은 Scope 2 산정에서 제외합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="2.3.2",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-2-3",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["Scope 2·3 이중 계상 방지"],
    value_range=None,
)

P(
    dp_id="GRI305-2-3-3",
    dp_code="GRI_305_DIS_2_COMP_2_3_3",
    name_ko="정보 수집 2.3.3: 제품·공급업체별 데이터 없는 시장—위치 기반",
    name_en="Compilation 2.3.3: Location-based when no supplier-specific data",
    description="제품 또는 공급업체별 데이터가 없는 시장에서는 위치 기반 방법으로 Scope 2를 계산·보고합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="2.3.3",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-2-3",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["해당 시장 조건과 위치 기반 산정의 연결"],
    value_range=None,
)

P(
    dp_id="GRI305-2-3-4",
    dp_code="GRI_305_DIS_2_COMP_2_3_4",
    name_ko="정보 수집 2.3.4: 계약적 수단 시장—위치·시장 기반 병행",
    name_en="Compilation 2.3.4: Location and market-based under contractual instruments",
    description=(
        "계약적 수단을 통해 제품·공급업체별 데이터를 제공하는 시장에서는 "
        "위치 기반과 시장 기반 모두로 에너지 간접(Scope 2) 온실가스 배출량을 계산·보고합니다."
    ),
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="2.3.4",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-2-3",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["305-2-a·b와 이중 보고 요건 정합", "잔여믹스·대체계수 사용 시 근거"],
    value_range=None,
)

P(
    dp_id="GRI305-2-4",
    dp_code="GRI_305_DIS_2_REC_2_4",
    name_ko="공개 305-2: 정보 수집 권고 2.4",
    name_en="Disclosure 305-2: Recommendations 2.4 (should)",
    description="공개 305-2 정보를 작성할 때의 권고 사항(절 2.4)입니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="권고 2.4",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-2",
    child_dps=[
        "GRI305-2-4-1",
        "GRI305-2-4-2",
        "GRI305-2-4-3",
        "GRI305-2-4-4",
        "GRI305-2-4-5",
    ],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="권고",
    reporting_frequency="연간",
    validation_rules=["2.4.1~2.4.5 하위 권고 검토"],
    value_range=None,
)

rec24 = [
    ("배출계수·GWP 일관 적용", "Consistent factors and GWP"),
    ("IPCC 100년 GWP", "IPCC 100-year GWP"),
    ("Scope 1·2 일관 연결", "Consistent consolidation for Scope 1 and 2"),
    ("상이 기준·방법론 시 설명", "Explain if different standards apply"),
    ("Scope 2 세분화", "Disaggregate Scope 2 emissions"),
]
for i, (ko, en) in enumerate(rec24, 1):
    ch = (
        [
            "GRI305-2-4-5-1",
            "GRI305-2-4-5-2",
            "GRI305-2-4-5-3",
            "GRI305-2-4-5-4",
        ]
        if i == 5
        else []
    )
    P(
        dp_id=f"GRI305-2-4-{i}",
        dp_code=f"GRI_305_DIS_2_REC_2_4_{i}",
        name_ko=f"권고 2.4.{i}: {ko}",
        name_en=f"Recommendation 2.4.{i}: {en}",
        description=f"표준 권고 2.4.{i}.",
        standard="GRI",
        category="E",
        topic="온실가스",
        subtopic=f"권고 2.4.{i}",
        dp_type="narrative",
        unit=None,
        equivalent_dps=[],
        parent_indicator="GRI305-2-4",
        child_dps=ch,
        financial_linkages=[],
        financial_impact_type=None,
        disclosure_requirement="권고",
        reporting_frequency="연간",
        validation_rules=[f"2.4.{i} 권고 반영(선택)"],
        value_range=None,
    )

rec245 = [
    ("사업부·시설", "Business unit or facility"),
    ("국가", "Country"),
    ("배출원 유형(전기·난방·냉방·증기)", "Electricity, heating, cooling, steam"),
    ("활동 유형", "Activity type"),
]
for j, (ko, en) in enumerate(rec245, 1):
    P(
        dp_id=f"GRI305-2-4-5-{j}",
        dp_code=f"GRI_305_DIS_2_REC_2_4_5_{j}",
        name_ko=f"권고 2.4.5.{j}: {ko}",
        name_en=f"Recommendation 2.4.5.{j}: {en}",
        description="Scope 2 세분화 권고 차원.",
        standard="GRI",
        category="E",
        topic="온실가스",
        subtopic="Scope 2 세분화",
        dp_type="narrative",
        unit=None,
        equivalent_dps=[],
        parent_indicator="GRI305-2-4-5",
        child_dps=[],
        financial_linkages=[],
        financial_impact_type=None,
        disclosure_requirement="권고",
        reporting_frequency="연간",
        validation_rules=["세분화 제공 시 정합성"],
        value_range=None,
    )

cats = (
    "구매 상품·서비스, 자본재, 연료·에너지 관련(Scope1/2 제외), 상류 운송·유통, 운영 폐기물, 출장, 직원 통근, 상류 임대자산, "
    "하류 운송·유통, 판매 제품 가공, 판매 제품 사용, 판매 제품 폐기, 하류 임대자산, 프랜차이즈, 투자"
)

P(
    dp_id="GRI305-3",
    dp_code="GRI_305_DIS_3_SCOPE3_GHG",
    name_ko="공개 305-3: 기타 간접(Scope 3) 온실가스 배출",
    name_en="Disclosure 305-3: Other indirect (Scope 3) GHG emissions",
    description=(
        "가치사슬에서 발생하는 기타 간접(Scope 3) 온실가스 배출 총계, 포함 가스, 생물 기원 CO2, "
        "범주·활동, 기준 연도, 계수·GWP, 방법론을 보고합니다. 정보 수집 2.5·권고 2.6은 GRI305-3-5·GRI305-3-6 트리입니다."
    ),
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 3",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-SEC-2",
    child_dps=[
        "GRI305-3-a",
        "GRI305-3-b",
        "GRI305-3-c",
        "GRI305-3-d",
        "GRI305-3-e",
        "GRI305-3-f",
        "GRI305-3-g",
        "GRI305-3-5",
        "GRI305-3-6",
    ],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=[
        "하위 a~g 및 GRI305-3-5·GRI305-3-6 충족",
        "15개 범주·가치사슬 지침: RULE_GRI305_3_G_GUIDANCE",
    ],
    value_range=None,
)

P(
    dp_id="GRI305-3-a",
    dp_code="GRI_305_DIS_3_A_TOTAL_SCOPE3",
    name_ko="공개 305-3-a: Scope 3 총계",
    name_en="Disclosure 305-3-a: Total Scope 3 GHG emissions",
    description="기타 간접(Scope 3) 온실가스 배출량 총계를 t CO2e로 보고합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 3 총량",
    dp_type="quantitative",
    unit="tco2e",
    equivalent_dps=[],
    parent_indicator="GRI305-3",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["GRI305-3-5-1·5-2와 산정 경계 정합"],
    value_range=None,
)

P(
    dp_id="GRI305-3-b",
    dp_code="GRI_305_DIS_3_B_GASES",
    name_ko="공개 305-3-b: 포함 가스(가능한 경우)",
    name_en="Disclosure 305-3-b: Gases included, if applicable",
    description="가능한 경우 산정에 포함된 가스를 명시합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 3 가스",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-3",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="조건부",
    reporting_frequency="연간",
    validation_rules=["가스 범위 명시"],
    value_range=None,
)

P(
    dp_id="GRI305-3-c",
    dp_code="GRI_305_DIS_3_C_BIOGENIC_CO2",
    name_ko="공개 305-3-c: 생물 기원 CO2",
    name_en="Disclosure 305-3-c: Biogenic CO2 emissions",
    description="생물 기원 CO2 배출량을 t CO2e로 별도 보고합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 3 생물성",
    dp_type="quantitative",
    unit="tco2e",
    equivalent_dps=[],
    parent_indicator="GRI305-3",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["GRI305-3-5-3(2.5.3)과 별도 보고·제외 규칙 정합"],
    value_range=None,
)

P(
    dp_id="GRI305-3-d",
    dp_code="GRI_305_DIS_3_D_CATEGORIES",
    name_ko="공개 305-3-d: 포함 범주 및 활동",
    name_en="Disclosure 305-3-d: Scope 3 categories and activities in the calculation",
    description=(
        "산정에 포함된 Scope 3 배출 범주 및 활동을 설명합니다. "
        "GHG Protocol Corporate Value Chain Standard의 15개 범주와의 대응을 드러내야 합니다."
    ),
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 3 범주",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-3",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=[
        "포함·제외 범주와 근거(중요성·데이터) 명시",
        "15개 범주 점검: " + cats,
    ],
    value_range=None,
)

P(
    dp_id="GRI305-3-e",
    dp_code="GRI_305_DIS_3_E_BASE_YEAR",
    name_ko="공개 305-3-e: 기준 연도(해당 시)",
    name_en="Disclosure 305-3-e: Base year, if applicable",
    description="해당 시 기준 연도 및 하위 i~iii를 보고합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 3 기준년도",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-3",
    child_dps=["GRI305-3-e-i", "GRI305-3-e-ii", "GRI305-3-e-iii"],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["e-i~iii(해당 시)"],
    value_range=None,
)

for suf, ko, en, q in [
    ("i", "기준 연도 선정 근거", "Rationale", False),
    ("ii", "기준 연도 배출량", "Emissions in base year", True),
    ("iii", "재계산 유발 중대 변화 맥락", "Recalculation context", False),
]:
    P(
        dp_id=f"GRI305-3-e-{suf}",
        dp_code=f"GRI_305_DIS_3_E_{suf.upper()}_BASE",
        name_ko=f"공개 305-3-e-{suf}: {ko}",
        name_en=f"Disclosure 305-3-e-{suf}: {en}",
        description=f"공개 305-3-e 하위 {suf}.",
        standard="GRI",
        category="E",
        topic="온실가스",
        subtopic="Scope 3 기준년도",
        dp_type="quantitative" if q else "narrative",
        unit="tco2e" if q else None,
        equivalent_dps=[],
        parent_indicator="GRI305-3-e",
        child_dps=[],
        financial_linkages=[],
        financial_impact_type=None,
        disclosure_requirement="필수",
        reporting_frequency="연간",
        validation_rules=[f"e-{suf} 충족"],
        value_range=None,
    )

P(
    dp_id="GRI305-3-f",
    dp_code="GRI_305_DIS_3_F_FACTORS_GWP",
    name_ko="공개 305-3-f: 배출 계수 및 GWP",
    name_en="Disclosure 305-3-f: Emission factors and GWP",
    description="사용한 배출 계수 및 GWP의 출처 또는 GWP 출처 참조를 보고합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 3 계수",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-3",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["출처 추적 가능"],
    value_range=None,
)

P(
    dp_id="GRI305-3-g",
    dp_code="GRI_305_DIS_3_G_METHODS",
    name_ko="공개 305-3-g: 기준·방법론·가정·도구",
    name_en="Disclosure 305-3-g: Standards, methodologies, assumptions, tools",
    description="사용한 표준, 방법론, 가정 및/또는 계산 도구를 보고합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="Scope 3 방법론",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-3",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["가치사슬 산정 방법 명시"],
    value_range=None,
)

P(
    dp_id="GRI305-3-5",
    dp_code="GRI_305_DIS_3_COMP_2_5",
    name_ko="공개 305-3: 정보 수집 요건 2.5",
    name_en="Disclosure 305-3: Compilation requirements 2.5 (shall)",
    description="공개 305-3 정보 집계 시 준수할 필수 규칙(절 2.5)입니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="정보 수집 2.5",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-3",
    child_dps=["GRI305-3-5-1", "GRI305-3-5-2", "GRI305-3-5-3"],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["2.5.1~2.5.3 하위 준수"],
    value_range=None,
)

P(
    dp_id="GRI305-3-5-1",
    dp_code="GRI_305_DIS_3_COMP_2_5_1",
    name_ko="정보 수집 2.5.1: Scope 3 총계에서 GHG 거래 제외",
    name_en="Compilation 2.5.1: Exclude GHG trades from Scope 3",
    description="총 기타 간접(Scope 3) 온실가스 배출량 계산에서 온실가스 거래량을 제외합니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="2.5.1",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-3-5",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["거래 제외"],
    value_range=None,
)

P(
    dp_id="GRI305-3-5-2",
    dp_code="GRI_305_DIS_3_COMP_2_5_2",
    name_ko="정보 수집 2.5.2: Scope 2는 본 공개에서 제외(305-2로 보고)",
    name_en="Compilation 2.5.2: Exclude Scope 2 from this disclosure",
    description="에너지 간접(Scope 2) 온실가스 배출은 본 공개에서 제외하고 공개 305-2에 따릅니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="2.5.2",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-3-5",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["Scope 2·3 경계 정합"],
    value_range=None,
)

P(
    dp_id="GRI305-3-5-3",
    dp_code="GRI_305_DIS_3_COMP_2_5_3",
    name_ko="정보 수집 2.5.3: 생물 기원 CO2 별도·기타 생물성 제외",
    name_en="Compilation 2.5.3: Biogenic CO2 separate and exclusions",
    description=(
        "바이오매스 연소·생물학적 분해에서의 생물 기원 CO2를 총 Scope 3과 별도 보고하고, "
        "다른 유형의 생물 기원 GHG 및 연소·생분해 외 생애주기 단계 CO2 등은 제외합니다."
    ),
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="2.5.3",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-3-5",
    child_dps=[],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="필수",
    reporting_frequency="연간",
    validation_rules=["305-3-c와 정합"],
    value_range=None,
)

P(
    dp_id="GRI305-3-6",
    dp_code="GRI_305_DIS_3_REC_2_6",
    name_ko="공개 305-3: 정보 수집 권고 2.6",
    name_en="Disclosure 305-3: Recommendations 2.6 (should)",
    description="공개 305-3 정보를 작성할 때의 권고(절 2.6)입니다.",
    standard="GRI",
    category="E",
    topic="온실가스",
    subtopic="권고 2.6",
    dp_type="narrative",
    unit=None,
    equivalent_dps=[],
    parent_indicator="GRI305-3",
    child_dps=[
        "GRI305-3-6-1",
        "GRI305-3-6-2",
        "GRI305-3-6-3",
        "GRI305-3-6-4",
        "GRI305-3-6-5",
    ],
    financial_linkages=[],
    financial_impact_type=None,
    disclosure_requirement="권고",
    reporting_frequency="연간",
    validation_rules=["2.6.1~2.6.5 하위 검토"],
    value_range=None,
)

rec26 = [
    ("배출계수·GWP 일관", "Consistent factors and GWP"),
    ("IPCC 100년 GWP", "IPCC 100-year GWP"),
    ("상이 기준 시 설명", "Explain mixed standards"),
    ("상류·하류·활동별 세분", "Upstream/downstream by activity"),
    ("세분화(시설·국가·원·활동)", "Breakdown dimensions"),
]
for i, (ko, en) in enumerate(rec26, 1):
    ch = (
        [
            "GRI305-3-6-5-1",
            "GRI305-3-6-5-2",
            "GRI305-3-6-5-3",
            "GRI305-3-6-5-4",
        ]
        if i == 5
        else []
    )
    P(
        dp_id=f"GRI305-3-6-{i}",
        dp_code=f"GRI_305_DIS_3_REC_2_6_{i}",
        name_ko=f"권고 2.6.{i}: {ko}",
        name_en=f"Recommendation 2.6.{i}: {en}",
        description=f"권고 2.6.{i}.",
        standard="GRI",
        category="E",
        topic="온실가스",
        subtopic=f"권고 2.6.{i}",
        dp_type="narrative",
        unit=None,
        equivalent_dps=[],
        parent_indicator="GRI305-3-6",
        child_dps=ch,
        financial_linkages=[],
        financial_impact_type=None,
        disclosure_requirement="권고",
        reporting_frequency="연간",
        validation_rules=[f"2.6.{i} 권고(선택)"],
        value_range=None,
    )

rec265 = [
    ("사업부·시설", "Business unit or facility"),
    ("국가", "Country"),
    ("배출원 유형", "Source type"),
    ("활동 유형", "Activity type"),
]
for j, (ko, en) in enumerate(rec265, 1):
    P(
        dp_id=f"GRI305-3-6-5-{j}",
        dp_code=f"GRI_305_DIS_3_REC_2_6_5_{j}",
        name_ko=f"권고 2.6.5.{j}: {ko}",
        name_en=f"Recommendation 2.6.5.{j}: {en}",
        description="Scope 3 세분화 권고.",
        standard="GRI",
        category="E",
        topic="온실가스",
        subtopic="Scope 3 세분화",
        dp_type="narrative",
        unit=None,
        equivalent_dps=[],
        parent_indicator="GRI305-3-6-5",
        child_dps=[],
        financial_linkages=[],
        financial_impact_type=None,
        disclosure_requirement="권고",
        reporting_frequency="연간",
        validation_rules=["세분화 정합"],
        value_range=None,
    )

existing = {p["dp_id"] for p in pts}
for p in new_dps:
    if p["dp_id"] in existing:
        raise SystemExit(f"duplicate dp_id: {p['dp_id']}")
pts.extend(new_dps)

dp_path.write_text(json.dumps({"data_points": pts}, ensure_ascii=False, indent=4), encoding="utf-8")
print("OK datapoints", len(pts))
