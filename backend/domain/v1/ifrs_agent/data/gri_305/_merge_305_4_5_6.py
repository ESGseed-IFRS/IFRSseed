"""Append GRI 305-4, 305-5, 305-6 datapoints and rulebooks. Run once from repo root."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
dp_path = root / "datapoint.json"
rb_path = root / "rulebook.json"


def find_dp(pts, pid: str):
    for p in pts:
        if p["dp_id"] == pid:
            return p
    raise KeyError(pid)


def find_rb(rbs, rid: str):
    for r in rbs:
        if r["rulebook_id"] == rid:
            return r
    raise KeyError(rid)


def DP(**kw):
    return {
        "dp_id": kw["dp_id"],
        "dp_code": kw["dp_code"],
        "name_ko": kw["name_ko"],
        "name_en": kw["name_en"],
        "description": kw["description"],
        "standard": "GRI",
        "category": "E",
        "topic": kw.get("topic", "온실가스"),
        "subtopic": kw["subtopic"],
        "dp_type": kw["dp_type"],
        "unit": kw.get("unit"),
        "equivalent_dps": kw.get("equivalent_dps", []),
        "parent_indicator": kw["parent_indicator"],
        "child_dps": kw.get("child_dps", []),
        "financial_linkages": [],
        "financial_impact_type": None,
        "disclosure_requirement": kw["disclosure_requirement"],
        "reporting_frequency": "연간",
        "validation_rules": kw["validation_rules"],
        "value_range": None,
    }


def RB(
    rid,
    primary,
    section_name,
    section_content,
    stype,
    pref,
    keys,
    actions,
    checks,
    xref,
    related,
    title,
    disc,
    notes=None,
):
    return {
        "rulebook_id": rid,
        "standard_id": "GRI305",
        "primary_dp_id": primary,
        "section_name": section_name,
        "section_content": section_content,
        "validation_rules": {
            "section_type": stype,
            "paragraph_reference": pref,
            "key_terms": keys,
            "related_concepts": [],
            "required_actions": actions,
            "verification_checks": checks,
            "cross_references": xref,
        },
        "related_dp_ids": related,
        "rulebook_title": title,
        "disclosure_requirement": disc,
        "version": "1.0",
        "is_active": True,
        "is_primary": False,
        "effective_date": "2016-01-01",
        "mapping_notes": notes,
        "conflicts_with": [],
    }


def main() -> None:
    data = json.loads(dp_path.read_text(encoding="utf-8"))
    pts = data["data_points"]
    for pid in ("GRI305-4", "GRI305-5", "GRI305-6"):
        if any(p["dp_id"] == pid for p in pts):
            raise SystemExit(f"already present: {pid}")

    find_dp(pts, "GRI305").update(
        {
            "description": (
                "GRI 305는 조직의 온실가스·대기 배출 등 배출 관련 영향에 대한 공시를 다룹니다. "
                "본 시드는 섹션 1(주제별 관리), 공개 305-1~305-6(Scope 1·2·3, 집약도, 감축, ODS)을 포함합니다."
            ),
            "validation_rules": [
                "시드 범위: 주제별 관리·공개 305-1·305-2·305-3·305-4·305-5·305-6",
            ],
        }
    )

    sec2 = find_dp(pts, "GRI305-SEC-2")
    sec2["name_ko"] = "섹션 2: 주제별 공시(시드: 305-1~305-6)"
    sec2["name_en"] = "Section 2: Topic-related disclosures (seed: 305-1 to 305-6)"
    sec2["description"] = (
        "배출과 관련된 주제별 정량·정성 공시 항목을 포함합니다. 본 시드에는 공개 305-1~305-6을 포함합니다."
    )
    sec2["child_dps"] = [
        "GRI305-1",
        "GRI305-2",
        "GRI305-3",
        "GRI305-4",
        "GRI305-5",
        "GRI305-6",
    ]
    sec2["validation_rules"] = ["공개 305-1~305-6 요건 충족(시드 범위)"]

    new_pts: list[dict] = []

    # --- 305-4 intensity ---
    new_pts.extend(
        [
            DP(
                dp_id="GRI305-4",
                dp_code="GRI_305_DIS_4_GHG_INTENSITY",
                name_ko="공개 305-4: 온실가스 배출 집약도",
                name_en="Disclosure 305-4: GHG emissions intensity",
                description=(
                    "조직의 온실가스 배출 집약도(비율), 분모로 쓴 조직별 측정 기준, "
                    "비율에 포함된 Scope(1·2·3) 범위, 포함 가스를 보고합니다. "
                    "정보 수집 2.7은 GRI305-4-7, 권고 2.8은 GRI305-4-8 트리입니다."
                ),
                subtopic="집약도",
                dp_type="narrative",
                parent_indicator="GRI305-SEC-2",
                child_dps=[
                    "GRI305-4-a",
                    "GRI305-4-b",
                    "GRI305-4-c",
                    "GRI305-4-d",
                    "GRI305-4-7",
                    "GRI305-4-8",
                ],
                disclosure_requirement="필수",
                validation_rules=[
                    "하위 a~d 및 GRI305-4-7·GRI305-4-8",
                    "지침: RULE_GRI305_4_G_GUIDANCE",
                ],
            ),
            DP(
                dp_id="GRI305-4-a",
                dp_code="GRI_305_DIS_4_A_INTENSITY_RATIO",
                name_ko="공개 305-4-a: 배출 집약도 비율",
                name_en="Disclosure 305-4-a: GHG intensity ratio",
                description="조직의 온실가스 배출 강도 비율을 보고합니다(분자·분모 정의는 4-b·4-7과 정합).",
                subtopic="집약도 비율",
                dp_type="narrative",
                parent_indicator="GRI305-4",
                disclosure_requirement="필수",
                validation_rules=[
                    "집약도 수치 또는 동등 표현과 단위(분모 기준)가 식별 가능할 것",
                    "GRI305-4-b 분모·GRI305-4-c 스코프 범위와 모순 없을 것",
                ],
            ),
            DP(
                dp_id="GRI305-4-b",
                dp_code="GRI_305_DIS_4_B_DENOMINATOR",
                name_ko="공개 305-4-b: 분모(조직별 측정 기준)",
                name_en="Disclosure 305-4-b: Organizational metric in the denominator",
                description="비율 계산에 선택된 조직별 측정 기준(분모)을 보고합니다.",
                subtopic="집약도 분모",
                dp_type="narrative",
                parent_indicator="GRI305-4",
                disclosure_requirement="필수",
                validation_rules=[
                    "생산량·매출·면적·직원 수 등 분모 지표와 산식이 명확할 것",
                ],
            ),
            DP(
                dp_id="GRI305-4-c",
                dp_code="GRI_305_DIS_4_C_SCOPES_IN_RATIO",
                name_ko="공개 305-4-c: 비율에 포함된 배출 범위(Scope)",
                name_en="Disclosure 305-4-c: Scopes included in the intensity ratio",
                description="강도 비율에 직접(Scope 1), 에너지 간접(Scope 2), 기타 간접(Scope 3) 중 무엇이 포함되는지 보고합니다.",
                subtopic="집약도 스코프",
                dp_type="narrative",
                parent_indicator="GRI305-4",
                disclosure_requirement="필수",
                validation_rules=[
                    "포함 Scope와 GRI305-4-7-2(Scope 3 별도 보고) 정합",
                ],
            ),
            DP(
                dp_id="GRI305-4-d",
                dp_code="GRI_305_DIS_4_D_GASES",
                name_ko="공개 305-4-d: 포함 가스",
                name_en="Disclosure 305-4-d: Gases included",
                description="산정에 포함된 가스(CO₂, CH₄, N₂O, HFCs, PFCs, SF₆, NF₃ 또는 전체)를 명시합니다.",
                subtopic="집약도 가스",
                dp_type="narrative",
                parent_indicator="GRI305-4",
                disclosure_requirement="필수",
                validation_rules=["포함 가스 또는 ‘전체’ 범위 명확"],
            ),
            DP(
                dp_id="GRI305-4-7",
                dp_code="GRI_305_DIS_4_COMP_2_7",
                name_ko="정보 수집 요건 2.7: 공개 305-4 집계",
                name_en="Compilation 2.7 for Disclosure 305-4 (shall)",
                description="공개 305-4 정보를 집계할 때 준수할 필수 규칙(절 2.7)입니다.",
                subtopic="305-4 정보수집 2.7",
                dp_type="narrative",
                parent_indicator="GRI305-4",
                child_dps=["GRI305-4-7-1", "GRI305-4-7-2"],
                disclosure_requirement="필수",
                validation_rules=["GRI305-4-7-1·GRI305-4-7-2 준수"],
            ),
            DP(
                dp_id="GRI305-4-7-1",
                dp_code="GRI_305_DIS_4_COMP_2_7_1",
                name_ko="정보 수집 2.7.1: 절대 배출 ÷ 분모",
                name_en="Compilation 2.7.1: Absolute emissions over denominator",
                description="절대 온실가스 배출량(분자)을 조직별 측정 기준(분모)으로 나누어 비율을 계산해야 합니다.",
                subtopic="305-4 2.7.1",
                dp_type="narrative",
                parent_indicator="GRI305-4-7",
                disclosure_requirement="필수",
                validation_rules=["분자·분모 정의와 산식이 305-4-a·b·GRI305-1·2·3 총량과 정합"],
            ),
            DP(
                dp_id="GRI305-4-7-2",
                dp_code="GRI_305_DIS_4_COMP_2_7_2",
                name_ko="정보 수집 2.7.2: Scope 3 집약도 별도",
                name_en="Compilation 2.7.2: Scope 3 intensity separate",
                description="기타 간접(Scope 3) 집약도를 보고하는 경우, Scope 1·2 집약도와 별도로 보고해야 합니다.",
                subtopic="305-4 2.7.2",
                dp_type="narrative",
                parent_indicator="GRI305-4-7",
                disclosure_requirement="필수",
                validation_rules=["Scope 3 집약도 제시 시 1·2와 혼합하지 않음"],
            ),
            DP(
                dp_id="GRI305-4-8",
                dp_code="GRI_305_DIS_4_REC_2_8",
                name_ko="권고 2.8: 집약도 세분화",
                name_en="Recommendation 2.8: Disaggregate intensity (should)",
                description="투명성·비교 가능성을 위해 집약도를 세분화하여 제공할 것을 권고합니다(절 2.8).",
                subtopic="305-4 권고 2.8",
                dp_type="narrative",
                parent_indicator="GRI305-4",
                child_dps=[
                    "GRI305-4-8-1",
                    "GRI305-4-8-2",
                    "GRI305-4-8-3",
                    "GRI305-4-8-4",
                ],
                disclosure_requirement="권고",
                validation_rules=["하위 2.8.1~2.8.4를 가능한 범위에서 반영"],
            ),
            DP(
                dp_id="GRI305-4-8-1",
                dp_code="GRI_305_DIS_4_REC_2_8_1",
                name_ko="권고 2.8.1: 사업부 또는 시설",
                name_en="Recommendation 2.8.1: Business unit or facility",
                description="집약도 세분화 권고: 사업부 또는 시설별.",
                subtopic="집약도 세분화",
                dp_type="narrative",
                parent_indicator="GRI305-4-8",
                disclosure_requirement="권고",
                validation_rules=["세분화 시 경계·합산 정합"],
            ),
            DP(
                dp_id="GRI305-4-8-2",
                dp_code="GRI_305_DIS_4_REC_2_8_2",
                name_ko="권고 2.8.2: 국가",
                name_en="Recommendation 2.8.2: Country",
                description="집약도 세분화 권고: 국가별.",
                subtopic="집약도 세분화",
                dp_type="narrative",
                parent_indicator="GRI305-4-8",
                disclosure_requirement="권고",
                validation_rules=["세분화 정합"],
            ),
            DP(
                dp_id="GRI305-4-8-3",
                dp_code="GRI_305_DIS_4_REC_2_8_3",
                name_ko="권고 2.8.3: 배출원 유형",
                name_en="Recommendation 2.8.3: Source type",
                description="집약도 세분화 권고: 배출원 유형별.",
                subtopic="집약도 세분화",
                dp_type="narrative",
                parent_indicator="GRI305-4-8",
                disclosure_requirement="권고",
                validation_rules=["세분화 정합"],
            ),
            DP(
                dp_id="GRI305-4-8-4",
                dp_code="GRI_305_DIS_4_REC_2_8_4",
                name_ko="권고 2.8.4: 활동 유형",
                name_en="Recommendation 2.8.4: Activity type",
                description="집약도 세분화 권고: 활동 유형별.",
                subtopic="집약도 세분화",
                dp_type="narrative",
                parent_indicator="GRI305-4-8",
                disclosure_requirement="권고",
                validation_rules=["세분화 정합"],
            ),
        ]
    )

    # --- 305-5 reduction ---
    new_pts.extend(
        [
            DP(
                dp_id="GRI305-5",
                dp_code="GRI_305_DIS_5_GHG_REDUCTION",
                name_ko="공개 305-5: 온실가스 배출 감축",
                name_en="Disclosure 305-5: Reduction of GHG emissions",
                description=(
                    "감축 이니셔티브로 인한 배출 감축량(t CO₂e), 포함 가스, 기준년·근거, 감축이 발생한 Scope, 방법론을 보고합니다. "
                    "편성 요건 2.9는 GRI305-5-9, 권고 2.10은 GRI305-5-10입니다."
                ),
                subtopic="감축",
                dp_type="narrative",
                parent_indicator="GRI305-SEC-2",
                child_dps=[
                    "GRI305-5-a",
                    "GRI305-5-b",
                    "GRI305-5-c",
                    "GRI305-5-d",
                    "GRI305-5-e",
                    "GRI305-5-9",
                    "GRI305-5-10",
                ],
                disclosure_requirement="필수",
                validation_rules=[
                    "하위 a~e 및 GRI305-5-9·GRI305-5-10",
                    "지침: RULE_GRI305_5_G_GUIDANCE",
                ],
            ),
            DP(
                dp_id="GRI305-5-a",
                dp_code="GRI_305_DIS_5_A_REDUCTION_TCO2E",
                name_ko="공개 305-5-a: 감축 이니셔티브에 따른 감축량",
                name_en="Disclosure 305-5-a: GHG reductions from initiatives (t CO2e)",
                description="감축 이니셔티브의 직접적 결과로서의 온실가스 배출 감축량을 t CO₂e로 보고합니다.",
                subtopic="감축량",
                dp_type="quantitative",
                unit="tco2e",
                parent_indicator="GRI305-5",
                disclosure_requirement="필수",
                validation_rules=["감축량 수치와 산정 경계(이니셔티브 대비) 명시"],
            ),
            DP(
                dp_id="GRI305-5-b",
                dp_code="GRI_305_DIS_5_B_GASES",
                name_ko="공개 305-5-b: 포함 가스",
                name_en="Disclosure 305-5-b: Gases included",
                description="산정에 포함된 가스를 명시합니다.",
                subtopic="감축 가스",
                dp_type="narrative",
                parent_indicator="GRI305-5",
                disclosure_requirement="필수",
                validation_rules=["가스 범위 명확"],
            ),
            DP(
                dp_id="GRI305-5-c",
                dp_code="GRI_305_DIS_5_C_BASELINE",
                name_ko="공개 305-5-c: 기준년 또는 베이스라인",
                name_en="Disclosure 305-5-c: Base year or baseline and rationale",
                description="기준년 또는 베이스라인과 그 선택 근거를 보고합니다.",
                subtopic="감축 기준",
                dp_type="narrative",
                parent_indicator="GRI305-5",
                disclosure_requirement="필수",
                validation_rules=["기준·베이스라인 정의와 재산정 규칙이 읽힐 것"],
            ),
            DP(
                dp_id="GRI305-5-d",
                dp_code="GRI_305_DIS_5_D_SCOPES",
                name_ko="공개 305-5-d: 감축이 발생한 Scope",
                name_en="Disclosure 305-5-d: Scopes in which reductions occurred",
                description="감축이 직접(Scope 1), 에너지 간접(Scope 2), 기타 간접(Scope 3) 중 어디에서 발생했는지 보고합니다.",
                subtopic="감축 스코프",
                dp_type="narrative",
                parent_indicator="GRI305-5",
                disclosure_requirement="필수",
                validation_rules=["GRI305-5-9-4(스코프별 별도 보고)와 정합"],
            ),
            DP(
                dp_id="GRI305-5-e",
                dp_code="GRI_305_DIS_5_E_METHODS",
                name_ko="공개 305-5-e: 표준·방법론·가정·산정 도구",
                name_en="Disclosure 305-5-e: Standards, methodologies, assumptions, tools",
                description="사용한 표준, 방법론, 가정 및/또는 계산 도구를 보고합니다.",
                subtopic="감축 방법론",
                dp_type="narrative",
                parent_indicator="GRI305-5",
                disclosure_requirement="필수",
                validation_rules=["인벤토리 기반 vs 프로젝트 기반 등 접근이 GRI305-5-9-2와 정합"],
            ),
            DP(
                dp_id="GRI305-5-9",
                dp_code="GRI_305_DIS_5_COMP_2_9",
                name_ko="편성 요건 2.9: 공개 305-5 정보 편성",
                name_en="Compilation 2.9 for Disclosure 305-5 (shall)",
                description="공개 305-5 정보를 편성할 때 준수할 필수 규칙(절 2.9)입니다.",
                subtopic="305-5 편성 2.9",
                dp_type="narrative",
                parent_indicator="GRI305-5",
                child_dps=[
                    "GRI305-5-9-1",
                    "GRI305-5-9-2",
                    "GRI305-5-9-3",
                    "GRI305-5-9-4",
                    "GRI305-5-9-5",
                ],
                disclosure_requirement="필수",
                validation_rules=["2.9.1~2.9.5 준수"],
            ),
            DP(
                dp_id="GRI305-5-9-1",
                dp_code="GRI_305_DIS_5_COMP_2_9_1",
                name_ko="편성 2.9.1: 생산능력 감소·아웃소싱으로 인한 감축 제외",
                name_en="Compilation 2.9.1: Exclude capacity/outsourcing-driven reductions",
                description="생산능력 감소나 아웃소싱으로 인한 감축은 감축량에서 제외합니다.",
                subtopic="305-5 2.9.1",
                dp_type="narrative",
                parent_indicator="GRI305-5-9",
                disclosure_requirement="필수",
                validation_rules=["구조적 감소와 실질 감축 이니셔티브 구분"],
            ),
            DP(
                dp_id="GRI305-5-9-2",
                dp_code="GRI_305_DIS_5_COMP_2_9_2",
                name_ko="편성 2.9.2: 인벤토리 또는 프로젝트 접근",
                name_en="Compilation 2.9.2: Inventory-based or project-based approach",
                description="감축 산정에 인벤토리 기반 또는 프로젝트 기반 접근을 사용해야 합니다.",
                subtopic="305-5 2.9.2",
                dp_type="narrative",
                parent_indicator="GRI305-5-9",
                disclosure_requirement="필수",
                validation_rules=["접근 방식 명시; 지침 RULE_GRI305_5_G_GUIDANCE 참조"],
            ),
            DP(
                dp_id="GRI305-5-9-3",
                dp_code="GRI_305_DIS_5_COMP_2_9_3",
                name_ko="편성 2.9.3: 1차·유의한 2차 효과 합산",
                name_en="Compilation 2.9.3: Primary + significant secondary effects",
                description="이니셔티브의 총 감축량은 1차 효과와 유의한 2차 효과의 합으로 계산합니다.",
                subtopic="305-5 2.9.3",
                dp_type="narrative",
                parent_indicator="GRI305-5-9",
                disclosure_requirement="필수",
                validation_rules=["2차 효과 포함 시 유의성·이중계상 방지"],
            ),
            DP(
                dp_id="GRI305-5-9-4",
                dp_code="GRI_305_DIS_5_COMP_2_9_4",
                name_ko="편성 2.9.4: 복수 Scope 시 스코프별 별도",
                name_en="Compilation 2.9.4: Separate reductions per scope",
                description="둘 이상의 Scope에 대한 감축을 보고하는 경우, Scope별로 감축량을 별도 보고합니다.",
                subtopic="305-5 2.9.4",
                dp_type="narrative",
                parent_indicator="GRI305-5-9",
                disclosure_requirement="필수",
                validation_rules=["GRI305-5-d와 수치 정합"],
            ),
            DP(
                dp_id="GRI305-5-9-5",
                dp_code="GRI_305_DIS_5_COMP_2_9_5",
                name_ko="편성 2.9.5: 상쇄로 인한 감축 별도",
                name_en="Compilation 2.9.5: Reductions from offsets separate",
                description="상쇄(offsets)에서 비롯된 감축은 별도로 보고합니다.",
                subtopic="305-5 2.9.5",
                dp_type="narrative",
                parent_indicator="GRI305-5-9",
                disclosure_requirement="필수",
                validation_rules=["상쇄 기반 감축과 현장 감축 구분"],
            ),
            DP(
                dp_id="GRI305-5-10",
                dp_code="GRI_305_DIS_5_REC_2_10",
                name_ko="권고 2.10: 상이한 기준·방법론 시 설명",
                name_en="Recommendation 2.10: Explain mixed standards (should)",
                description="항목별로 서로 다른 기준·방법론이 적용되면, 선택한 접근을 설명할 것을 권고합니다.",
                subtopic="305-5 권고 2.10",
                dp_type="narrative",
                parent_indicator="GRI305-5",
                disclosure_requirement="권고",
                validation_rules=["혼용 시 투명한 근거"],
            ),
        ]
    )

    # --- 305-6 ODS ---
    new_pts.extend(
        [
            DP(
                dp_id="GRI305-6",
                dp_code="GRI_305_DIS_6_ODS",
                name_ko="공개 305-6: 오존층 파괴 물질(ODS) 배출",
                name_en="Disclosure 305-6: Emissions of ozone-depleting substances (ODS)",
                description=(
                    "ODS의 생산·수입·수출(CFC-11 환산 톤), 포함 물질, 배출계수 출처, 방법론을 보고합니다. "
                    "정보 수집 2.11은 GRI305-6-11, 권고 2.12는 GRI305-6-12 트리입니다."
                ),
                subtopic="ODS",
                dp_type="narrative",
                parent_indicator="GRI305-SEC-2",
                child_dps=[
                    "GRI305-6-a",
                    "GRI305-6-b",
                    "GRI305-6-c",
                    "GRI305-6-d",
                    "GRI305-6-11",
                    "GRI305-6-12",
                ],
                disclosure_requirement="필수",
                validation_rules=[
                    "하위 a~d 및 GRI305-6-11·GRI305-6-12",
                    "지침: RULE_GRI305_6_G_GUIDANCE",
                ],
            ),
            DP(
                dp_id="GRI305-6-a",
                dp_code="GRI_305_DIS_6_A_PROD_IMP_EXP",
                name_ko="공개 305-6-a: 생산·수입·수출",
                name_en="Disclosure 305-6-a: Production, import, export of ODS",
                description="ODS의 생산, 수입 및 수출량을 CFC-11 환산 메트릭 톤으로 보고합니다.",
                subtopic="ODS 양",
                dp_type="quantitative",
                unit="tcfc11e",
                parent_indicator="GRI305-6",
                disclosure_requirement="필수",
                validation_rules=["CFC-11e 단위 또는 동등 명시", "GRI305-6-11-1 산식과 정합"],
            ),
            DP(
                dp_id="GRI305-6-b",
                dp_code="GRI_305_DIS_6_B_SUBSTANCES",
                name_ko="공개 305-6-b: 포함 물질",
                name_en="Disclosure 305-6-b: Substances included",
                description="계산에 포함된 물질을 명시합니다.",
                subtopic="ODS 물질",
                dp_type="narrative",
                parent_indicator="GRI305-6",
                disclosure_requirement="필수",
                validation_rules=["물질 목록 또는 집계 범위 명확"],
            ),
            DP(
                dp_id="GRI305-6-c",
                dp_code="GRI_305_DIS_6_C_EF_SOURCE",
                name_ko="공개 305-6-c: 배출계수 출처",
                name_en="Disclosure 305-6-c: Source of emission factors",
                description="사용한 배출계수의 출처를 보고합니다.",
                subtopic="ODS 계수",
                dp_type="narrative",
                parent_indicator="GRI305-6",
                disclosure_requirement="필수",
                validation_rules=["계수 출처 식별 가능"],
            ),
            DP(
                dp_id="GRI305-6-d",
                dp_code="GRI_305_DIS_6_D_METHODS",
                name_ko="공개 305-6-d: 표준·방법론·가정·산정 도구",
                name_en="Disclosure 305-6-d: Standards, methodologies, assumptions, tools",
                description="사용한 기준, 방법론, 가정 및/또는 계산 도구를 보고합니다.",
                subtopic="ODS 방법론",
                dp_type="narrative",
                parent_indicator="GRI305-6",
                disclosure_requirement="필수",
                validation_rules=["산정 접근 개요"],
            ),
            DP(
                dp_id="GRI305-6-11",
                dp_code="GRI_305_DIS_6_COMP_2_11",
                name_ko="정보 수집 요건 2.11: 공개 305-6 집계",
                name_en="Compilation 2.11 for Disclosure 305-6 (shall)",
                description="공개 305-6 정보를 집계할 때 준수할 필수 규칙(절 2.11)입니다.",
                subtopic="305-6 정보수집 2.11",
                dp_type="narrative",
                parent_indicator="GRI305-6",
                child_dps=["GRI305-6-11-1", "GRI305-6-11-2"],
                disclosure_requirement="필수",
                validation_rules=["2.11.1·2.11.2 준수"],
            ),
            DP(
                dp_id="GRI305-6-11-1",
                dp_code="GRI_305_DIS_6_COMP_2_11_1",
                name_ko="정보 수집 2.11.1: ODS 생산량 산식",
                name_en="Compilation 2.11.1: ODS production formula",
                description=(
                    "ODS 생산량 = 생산된 ODS − 승인된 기술로 파괴된 ODS − "
                    "다른 화학물질의 원료로 전량 사용된 ODS. "
                    "재활용·재사용 ODS는 GRI305-6-11-2에 따라 제외합니다."
                ),
                subtopic="305-6 2.11.1",
                dp_type="narrative",
                parent_indicator="GRI305-6-11",
                disclosure_requirement="필수",
                validation_rules=["산식 구성요소가 공시 수치와 정합"],
            ),
            DP(
                dp_id="GRI305-6-11-2",
                dp_code="GRI_305_DIS_6_COMP_2_11_2",
                name_ko="정보 수집 2.11.2: 재활용·재사용 ODS 제외",
                name_en="Compilation 2.11.2: Exclude recycled/reused ODS",
                description="재활용 및 재사용된 ODS는 산정에서 제외합니다.",
                subtopic="305-6 2.11.2",
                dp_type="narrative",
                parent_indicator="GRI305-6-11",
                disclosure_requirement="필수",
                validation_rules=["재활용·재사용 분리"],
            ),
            DP(
                dp_id="GRI305-6-12",
                dp_code="GRI_305_DIS_6_REC_2_12",
                name_ko="권고 2.12: 공개 305-6 작성",
                name_en="Recommendation 2.12 for Disclosure 305-6 (should)",
                description="공개 305-6 정보 작성 시 권고 사항(절 2.12)입니다.",
                subtopic="305-6 권고 2.12",
                dp_type="narrative",
                parent_indicator="GRI305-6",
                child_dps=["GRI305-6-12-1", "GRI305-6-12-2"],
                disclosure_requirement="권고",
                validation_rules=["2.12.1·2.12.2 트리 검토"],
            ),
            DP(
                dp_id="GRI305-6-12-1",
                dp_code="GRI_305_DIS_6_REC_2_12_1",
                name_ko="권고 2.12.1: 상이한 기준·방법론 시 설명",
                name_en="Recommendation 2.12.1: Explain mixed standards",
                description="서로 다른 기준·방법론이 적용되면 선택한 접근을 설명할 것을 권고합니다.",
                subtopic="305-6 권고",
                dp_type="narrative",
                parent_indicator="GRI305-6-12",
                disclosure_requirement="권고",
                validation_rules=["혼용 시 근거"],
            ),
            DP(
                dp_id="GRI305-6-12-2",
                dp_code="GRI_305_DIS_6_REC_2_12_2",
                name_ko="권고 2.12.2: ODS 세분화",
                name_en="Recommendation 2.12.2: Disaggregate ODS",
                description="투명성·비교 가능성을 위해 ODS 데이터를 세분화하여 제공할 것을 권고합니다.",
                subtopic="305-6 권고",
                dp_type="narrative",
                parent_indicator="GRI305-6-12",
                child_dps=[
                    "GRI305-6-12-2-1",
                    "GRI305-6-12-2-2",
                    "GRI305-6-12-2-3",
                    "GRI305-6-12-2-4",
                ],
                disclosure_requirement="권고",
                validation_rules=["하위 2.12.2.1~2.12.2.4 반영"],
            ),
            DP(
                dp_id="GRI305-6-12-2-1",
                dp_code="GRI_305_DIS_6_REC_2_12_2_1",
                name_ko="권고 2.12.2.1: 사업부 또는 시설",
                name_en="Recommendation 2.12.2.1: Business unit or facility",
                description="ODS 세분화 권고: 사업부 또는 시설별.",
                subtopic="ODS 세분화",
                dp_type="narrative",
                parent_indicator="GRI305-6-12-2",
                disclosure_requirement="권고",
                validation_rules=["세분화 정합"],
            ),
            DP(
                dp_id="GRI305-6-12-2-2",
                dp_code="GRI_305_DIS_6_REC_2_12_2_2",
                name_ko="권고 2.12.2.2: 국가",
                name_en="Recommendation 2.12.2.2: Country",
                description="ODS 세분화 권고: 국가별.",
                subtopic="ODS 세분화",
                dp_type="narrative",
                parent_indicator="GRI305-6-12-2",
                disclosure_requirement="권고",
                validation_rules=["세분화 정합"],
            ),
            DP(
                dp_id="GRI305-6-12-2-3",
                dp_code="GRI_305_DIS_6_REC_2_12_2_3",
                name_ko="권고 2.12.2.3: 원천 유형",
                name_en="Recommendation 2.12.2.3: Source type",
                description="ODS 세분화 권고: 원천 유형별.",
                subtopic="ODS 세분화",
                dp_type="narrative",
                parent_indicator="GRI305-6-12-2",
                disclosure_requirement="권고",
                validation_rules=["세분화 정합"],
            ),
            DP(
                dp_id="GRI305-6-12-2-4",
                dp_code="GRI_305_DIS_6_REC_2_12_2_4",
                name_ko="권고 2.12.2.4: 활동 유형",
                name_en="Recommendation 2.12.2.4: Activity type",
                description="ODS 세분화 권고: 활동 유형별.",
                subtopic="ODS 세분화",
                dp_type="narrative",
                parent_indicator="GRI305-6-12-2",
                disclosure_requirement="권고",
                validation_rules=["세분화 정합"],
            ),
        ]
    )

    pts.extend(new_pts)
    dp_path.write_text(json.dumps(data, ensure_ascii=False, indent=4), encoding="utf-8")

    rb_data = json.loads(rb_path.read_text(encoding="utf-8"))
    rbs = rb_data["rulebooks"]
    for rid in (
        "RULE_GRI305_4",
        "RULE_GRI305_5",
        "RULE_GRI305_6",
    ):
        if any(r["rulebook_id"] == rid for r in rbs):
            raise SystemExit(f"rulebook already present: {rid}")

    rg = find_rb(rbs, "RULE_GRI305")
    rg["section_content"] = (
        "GRI 305: Emissions\n\n시드: 섹션 1(주제별 관리), 공개 305-1~305-6. "
        "주의: GRI305-1-1·GRI305-1-2는 공개 305-1의 절 2.1·2.2 트리이며 공개 305-2 루트(GRI305-2)와 혼동 금지."
    )
    rg["validation_rules"]["verification_checks"][0]["description"] = (
        "섹션 1·공개 305-1~305-6 시드 포함 확인"
    )
    rg["related_dp_ids"] = [
        "GRI305",
        "GRI305-SEC-1",
        "GRI305-SEC-2",
        "GRI305-1",
        "GRI305-2",
        "GRI305-3",
        "GRI305-4",
        "GRI305-5",
        "GRI305-6",
    ]
    rg["mapping_notes"] = (
        "시드: 305-1~305-6. GRI305-2=공개305-2; GRI305-1-1·GRI305-1-2=공개305-1의 절 2.1·2.2."
    )
    rg["validation_rules"]["key_terms"].extend(
        ["GHG intensity", "emission reductions", "ozone-depleting substances"]
    )

    rs2 = find_rb(rbs, "RULE_GRI305_SEC_2")
    rs2["section_content"] = "Section 2: Topic-related disclosures — 305-1 through 305-6 in seed."
    rs2["related_dp_ids"] = [
        "GRI305-SEC-2",
        "GRI305-1",
        "GRI305-2",
        "GRI305-3",
        "GRI305-4",
        "GRI305-5",
        "GRI305-6",
    ]
    rs2["validation_rules"]["verification_checks"][0]["description"] = "305-1~305-6 트리 존재"

    def act(name: str, desc: str, mandatory: bool = True):
        return [{"action": name, "description": desc, **({"mandatory": False} if not mandatory else {})}]

    def chk(cid: str, desc: str, exp: str = "ok"):
        return [{"check_id": cid, "description": desc, "expected": exp}]

    new_rbs: list[dict] = []

    # 305-4 rulebooks
    r4_related = (
        ["GRI305-4"]
        + [f"GRI305-4-{x}" for x in "abcd"]
        + ["GRI305-4-7", "GRI305-4-7-1", "GRI305-4-7-2"]
        + ["GRI305-4-8"]
        + [f"GRI305-4-8-{i}" for i in range(1, 5)]
    )
    new_rbs.append(
        RB(
            "RULE_GRI305_4",
            "GRI305-4",
            "공개 305-4: 집약도",
            "Disclosure 305-4: GHG emissions intensity — requirements a–d; compilation 2.7; recommendations 2.8.",
            "disclosure",
            "GRI 305 Disclosure 305-4",
            ["intensity", "denominator", "Scope 1", "Scope 2", "Scope 3"],
            act("report_305_4", "305-4 패키지"),
            chk("GRI305_4_ROOT_OK", "305-4 존재"),
            ["GRI 305-1", "GRI 305-2", "GRI 305-3"],
            r4_related,
            "Disclosure 305-4",
            "필수",
        )
    )
    for letter in "abcd":
        pid = f"GRI305-4-{letter}"
        new_rbs.append(
            RB(
                f"RULE_GRI305_4_{letter.upper()}",
                pid,
                f"공개 305-4-{letter}",
                f"305-4-{letter}",
                "disclosure_requirement",
                f"GRI 305 Disclosure 305-4-{letter}",
                ["intensity"],
                act(f"meet_305_4_{letter}", f"305-4-{letter}"),
                chk(f"GRI305_4_{letter.upper()}_OK", pid),
                [],
                [pid],
                f"305-4-{letter}",
                "필수",
            )
        )
    new_rbs.append(
        RB(
            "RULE_GRI305_4_7",
            "GRI305-4-7",
            "정보 수집 2.7",
            "Compilation 2.7 for 305-4.",
            "disclosure_requirement",
            "GRI 305 305-4 — 2.7",
            ["compilation"],
            act("apply_47", "2.7.1~2.7.2"),
            chk("GRI305_4_7_OK", "2.7"),
            [],
            ["GRI305-4-7", "GRI305-4-7-1", "GRI305-4-7-2"],
            "305-4 compilation 2.7",
            "필수",
        )
    )
    for i in (1, 2):
        pid = f"GRI305-4-7-{i}"
        new_rbs.append(
            RB(
                f"RULE_GRI305_4_7_{i}",
                pid,
                f"정보 수집 2.7.{i}",
                f"2.7.{i}",
                "disclosure_requirement",
                f"GRI 305 305-4 — 2.7.{i}",
                ["intensity"],
                act(f"meet_47_{i}", f"2.7.{i}"),
                chk(f"GRI305_4_7_{i}_OK", pid),
                ["GRI 305 Disclosure 305-3"] if i == 2 else [],
                [pid] + (["GRI305-4-a", "GRI305-4-b"] if i == 1 else ["GRI305-4-c"]),
                f"2.7.{i}",
                "필수",
            )
        )
    new_rbs.append(
        RB(
            "RULE_GRI305_4_8",
            "GRI305-4-8",
            "권고 2.8",
            "Recommendations 2.8 for 305-4.",
            "guidance",
            "GRI 305 305-4 — 2.8",
            ["disaggregation"],
            act("rec_48", "권고 2.8", mandatory=False),
            chk("GRI305_4_8_REVIEW", "권고 검토", "reviewed"),
            [],
            ["GRI305-4-8"] + [f"GRI305-4-8-{j}" for j in range(1, 5)],
            "305-4 recommendations 2.8",
            "권고",
        )
    )
    for j in range(1, 5):
        pid = f"GRI305-4-8-{j}"
        new_rbs.append(
            RB(
                f"RULE_GRI305_4_8_{j}",
                pid,
                f"권고 2.8.{j}",
                f"2.8.{j}",
                "guidance",
                f"GRI 305 305-4 — 2.8.{j}",
                [],
                act(f"rec_48_{j}", f"2.8.{j}", mandatory=False),
                chk(f"GRI305_4_8_{j}_OK", pid, "optional"),
                [],
                [pid],
                f"2.8.{j}",
                "권고",
            )
        )
    g4 = (
        "Guidance for Disclosure 305-4: Intensity ratios may be expressed per product, service, or sales volume; "
        "denominators may include production (t, L, MWh), floor area, headcount, or currency (revenue/sales). "
        "Organizations may use 305-1 and 305-2 figures for combined Scope 1+2 intensity. "
        "Intensity metrics contextualize environmental performance and comparability across organizations."
    )
    new_rbs.append(
        RB(
            "RULE_GRI305_4_G_GUIDANCE",
            "GRI305-4",
            "지침: 공개 305-4",
            g4,
            "guidance",
            "GRI 305 Disclosure 305-4 — Guidance",
            ["intensity ratio", "normalization"],
            act("interpret_intensity", "집약도·분모 예시 반영", mandatory=False),
            chk("GRI305_4_G_COHERENT", "집약도 서술 정합", "coherent"),
            ["Disclosure 305-1", "Disclosure 305-2"],
            ["GRI305-4", "GRI305-4-a", "GRI305-4-b", "GRI305-1-a", "GRI305-2-a"],
            "Guidance 305-4",
            "필수",
            "지침 전용.",
        )
    )

    # 305-5
    r5_related = (
        ["GRI305-5"]
        + [f"GRI305-5-{x}" for x in "abcde"]
        + ["GRI305-5-9"]
        + [f"GRI305-5-9-{i}" for i in range(1, 6)]
        + ["GRI305-5-10"]
    )
    new_rbs.append(
        RB(
            "RULE_GRI305_5",
            "GRI305-5",
            "공개 305-5: 감축",
            "Disclosure 305-5: Reduction of GHG emissions — a–e; compilation 2.9; recommendation 2.10.",
            "disclosure",
            "GRI 305 Disclosure 305-5",
            ["reduction", "initiatives", "offsets", "baseline"],
            act("report_305_5", "305-5 패키지"),
            chk("GRI305_5_ROOT_OK", "305-5 존재"),
            ["Disclosure 305-1", "305-2", "305-3"],
            r5_related,
            "Disclosure 305-5",
            "필수",
        )
    )
    for letter in "abcde":
        pid = f"GRI305-5-{letter}"
        new_rbs.append(
            RB(
                f"RULE_GRI305_5_{letter.upper()}",
                pid,
                f"공개 305-5-{letter}",
                f"305-5-{letter}",
                "disclosure_requirement",
                f"GRI 305 Disclosure 305-5-{letter}",
                ["reduction"],
                act(f"meet_305_5_{letter}", f"305-5-{letter}"),
                chk(f"GRI305_5_{letter.upper()}_OK", pid),
                [],
                [pid],
                f"305-5-{letter}",
                "필수",
            )
        )
    new_rbs.append(
        RB(
            "RULE_GRI305_5_9",
            "GRI305-5-9",
            "편성 요건 2.9",
            "Compilation 2.9 for 305-5.",
            "disclosure_requirement",
            "GRI 305 305-5 — 2.9",
            ["compilation"],
            act("apply_59", "2.9.1~2.9.5"),
            chk("GRI305_5_9_OK", "2.9"),
            [],
            ["GRI305-5-9"] + [f"GRI305-5-9-{i}" for i in range(1, 6)],
            "305-5 compilation 2.9",
            "필수",
        )
    )
    for i in range(1, 6):
        pid = f"GRI305-5-9-{i}"
        new_rbs.append(
            RB(
                f"RULE_GRI305_5_9_{i}",
                pid,
                f"편성 2.9.{i}",
                f"2.9.{i}",
                "disclosure_requirement",
                f"GRI 305 305-5 — 2.9.{i}",
                [],
                act(f"meet_59_{i}", f"2.9.{i}"),
                chk(f"GRI305_5_9_{i}_OK", pid),
                [],
                [pid],
                f"2.9.{i}",
                "필수",
            )
        )
    new_rbs.append(
        RB(
            "RULE_GRI305_5_10",
            "GRI305-5-10",
            "권고 2.10",
            "Recommendation 2.10 for 305-5.",
            "guidance",
            "GRI 305 305-5 — 2.10",
            [],
            act("rec_510", "권고 2.10", mandatory=False),
            chk("GRI305_5_10_REVIEW", "권고 검토", "reviewed"),
            [],
            ["GRI305-5-10"],
            "305-5 recommendation 2.10",
            "권고",
        )
    )
    g5 = (
        "Guidance for 305-5: Organizations may prioritize initiatives in the reporting period with significant reduction potential; "
        "may describe initiatives and targets in the management approach. Initiatives may include process redesign, equipment retrofit, "
        "fuel switching, behavior change, and offsets. Reductions may be broken down by initiative or group. "
        "Use with 305-1–305-3 to track progress vs targets or regulations. "
        "Clause 2.9.2: inventory-based approach compares to a base year; project-based compares to a baseline (see protocol references). "
        "Clause 2.9.3: primary effects are intended reductions; significant secondary effects may include e.g. carbon storage elements."
    )
    new_rbs.append(
        RB(
            "RULE_GRI305_5_G_GUIDANCE",
            "GRI305-5",
            "지침: 공개 305-5",
            g5,
            "guidance",
            "GRI 305 Disclosure 305-5 — Guidance",
            ["reduction initiatives", "inventory vs project", "primary effect"],
            act("interpret_reduction", "감축 지침·2.9.2·2.9.3 해석", mandatory=False),
            chk("GRI305_5_G_OK", "지침 정합", "coherent"),
            [],
            ["GRI305-5", "GRI305-5-9-2", "GRI305-5-9-3", "GRI305-1", "GRI305-2", "GRI305-3"],
            "Guidance 305-5",
            "필수",
            "지침 전용.",
        )
    )

    # 305-6
    r6_related = (
        ["GRI305-6"]
        + [f"GRI305-6-{x}" for x in "abcd"]
        + ["GRI305-6-11", "GRI305-6-11-1", "GRI305-6-11-2"]
        + ["GRI305-6-12", "GRI305-6-12-1", "GRI305-6-12-2"]
        + [f"GRI305-6-12-2-{k}" for k in range(1, 5)]
    )
    new_rbs.append(
        RB(
            "RULE_GRI305_6",
            "GRI305-6",
            "공개 305-6: ODS",
            "Disclosure 305-6: Ozone-depleting substances — a–d; compilation 2.11; recommendations 2.12.",
            "disclosure",
            "GRI 305 Disclosure 305-6",
            ["ODS", "CFC-11 equivalent", "Montreal Protocol"],
            act("report_305_6", "305-6 패키지"),
            chk("GRI305_6_ROOT_OK", "305-6 존재"),
            [],
            r6_related,
            "Disclosure 305-6",
            "필수",
        )
    )
    for letter in "abcd":
        pid = f"GRI305-6-{letter}"
        new_rbs.append(
            RB(
                f"RULE_GRI305_6_{letter.upper()}",
                pid,
                f"공개 305-6-{letter}",
                f"305-6-{letter}",
                "disclosure_requirement",
                f"GRI 305 Disclosure 305-6-{letter}",
                ["ODS"],
                act(f"meet_305_6_{letter}", f"305-6-{letter}"),
                chk(f"GRI305_6_{letter.upper()}_OK", pid),
                [],
                [pid],
                f"305-6-{letter}",
                "필수",
            )
        )
    new_rbs.append(
        RB(
            "RULE_GRI305_6_11",
            "GRI305-6-11",
            "정보 수집 2.11",
            "Compilation 2.11 for 305-6.",
            "disclosure_requirement",
            "GRI 305 305-6 — 2.11",
            ["ODS production"],
            act("apply_611", "2.11.1~2.11.2"),
            chk("GRI305_6_11_OK", "2.11"),
            [],
            ["GRI305-6-11", "GRI305-6-11-1", "GRI305-6-11-2"],
            "305-6 compilation 2.11",
            "필수",
        )
    )
    new_rbs.append(
        RB(
            "RULE_GRI305_6_11_1",
            "GRI305-6-11-1",
            "정보 수집 2.11.1",
            "Production = produced − destroyed by approved tech − entirely used as feedstock.",
            "disclosure_requirement",
            "GRI 305 305-6 — 2.11.1",
            ["ODS formula"],
            act("apply_ods_production_formula", "2.11.1 산식"),
            chk("GRI305_6_111_OK", "2.11.1"),
            [],
            ["GRI305-6-11-1", "GRI305-6-a"],
            "2.11.1",
            "필수",
        )
    )
    new_rbs.append(
        RB(
            "RULE_GRI305_6_11_2",
            "GRI305-6-11-2",
            "정보 수집 2.11.2",
            "Exclude recycled/reused ODS.",
            "disclosure_requirement",
            "GRI 305 305-6 — 2.11.2",
            [],
            act("exclude_recycled_ods", "2.11.2"),
            chk("GRI305_6_112_OK", "2.11.2"),
            [],
            ["GRI305-6-11-2"],
            "2.11.2",
            "필수",
        )
    )
    new_rbs.append(
        RB(
            "RULE_GRI305_6_12",
            "GRI305-6-12",
            "권고 2.12",
            "Recommendations 2.12 for 305-6.",
            "guidance",
            "GRI 305 305-6 — 2.12",
            [],
            act("rec_612", "권고 2.12", mandatory=False),
            chk("GRI305_6_12_REVIEW", "권고 검토", "reviewed"),
            [],
            ["GRI305-6-12", "GRI305-6-12-1", "GRI305-6-12-2"]
            + [f"GRI305-6-12-2-{k}" for k in range(1, 5)],
            "305-6 recommendations 2.12",
            "권고",
        )
    )
    new_rbs.append(
        RB(
            "RULE_GRI305_6_12_1",
            "GRI305-6-12-1",
            "권고 2.12.1",
            "Explain mixed standards.",
            "guidance",
            "GRI 305 305-6 — 2.12.1",
            [],
            act("rec_6121", "2.12.1", mandatory=False),
            chk("GRI305_6_121_OK", "2.12.1", "optional"),
            [],
            ["GRI305-6-12-1"],
            "2.12.1",
            "권고",
        )
    )
    new_rbs.append(
        RB(
            "RULE_GRI305_6_12_2",
            "GRI305-6-12-2",
            "권고 2.12.2",
            "Disaggregate ODS.",
            "guidance",
            "GRI 305 305-6 — 2.12.2",
            [],
            act("rec_6122", "2.12.2", mandatory=False),
            chk("GRI305_6_122_OK", "2.12.2", "optional"),
            [],
            ["GRI305-6-12-2"] + [f"GRI305-6-12-2-{k}" for k in range(1, 5)],
            "2.12.2",
            "권고",
        )
    )
    for k in range(1, 5):
        pid = f"GRI305-6-12-2-{k}"
        new_rbs.append(
            RB(
                f"RULE_GRI305_6_12_2_{k}",
                pid,
                f"권고 2.12.2.{k}",
                f"2.12.2.{k}",
                "guidance",
                f"GRI 305 305-6 — 2.12.2.{k}",
                [],
                act(f"rec_6122_{k}", f"2.12.2.{k}", mandatory=False),
                chk(f"GRI305_6_2122_{k}_OK", pid, "optional"),
                [],
                [pid],
                f"2.12.2.{k}",
                "권고",
            )
        )
    g6 = (
        "Guidance for 305-6: The organization may report individual or aggregate data for substances included. "
        "ODS metrics support regulatory compliance (e.g. phase-out obligations) and market positioning under ODS regimes."
    )
    new_rbs.append(
        RB(
            "RULE_GRI305_6_G_GUIDANCE",
            "GRI305-6",
            "지침: 공개 305-6",
            g6,
            "guidance",
            "GRI 305 Disclosure 305-6 — Guidance",
            ["ODS disclosure", "aggregate vs substance-level"],
            act("interpret_ods", "ODS 지침", mandatory=False),
            chk("GRI305_6_G_OK", "지침 정합", "coherent"),
            [],
            ["GRI305-6", "GRI305-6-b"],
            "Guidance 305-6",
            "필수",
            "지침 전용.",
        )
    )

    rbs.extend(new_rbs)
    rb_path.write_text(json.dumps(rb_data, ensure_ascii=False, indent=4), encoding="utf-8")

    ids = {p["dp_id"] for p in pts}
    assert len(ids) == len(pts), "duplicate dp_id"
    miss = []
    for r in rbs:
        pid = r.get("primary_dp_id")
        if pid and pid not in ids:
            miss.append((r["rulebook_id"], pid))
    assert not miss, miss
    print("OK datapoints", len(pts), "rulebooks", len(rbs))


if __name__ == "__main__":
    main()
