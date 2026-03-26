"""Build gri_303 datapoint.json and rulebook.json (GRI 303: Water — disclosures 303-3~303-5). Run from repo."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent


def DP(**kw):
    return {
        "dp_id": kw["dp_id"],
        "dp_code": kw["dp_code"],
        "name_ko": kw["name_ko"],
        "name_en": kw["name_en"],
        "description": kw["description"],
        "standard": "GRI",
        "category": kw.get("category", "E"),
        "topic": kw["topic"],
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


def RB(rid, primary, section_name, section_content, stype, pref, keys, actions, checks, xref, related, title, disc, notes=None):
    return {
        "rulebook_id": rid,
        "standard_id": "GRI303",
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
        "effective_date": "2018-01-01",
        "mapping_notes": notes,
        "conflicts_with": [],
    }


def act(name, desc, mandatory=True):
    d = {"action": name, "description": desc}
    if not mandatory:
        d["mandatory"] = False
    return [d]


def chk(cid, desc, exp="ok"):
    return [{"check_id": cid, "description": desc, "expected": exp}]


def _src_rows_3a(prefix: str, code_base: str, parent: str, label_ko: str, dis_letter: str) -> list:
    rows = [
        ("i", "SURFACE", "지표수", "Surface water", "지표수(빗물 수집·저장 포함) 취수량(메가리터)."),
        ("ii", "GROUND", "지하수", "Groundwater", "지하수 취수량(메가리터)."),
        ("iii", "SEA", "해수", "Seawater", "해수 취수량(메가리터)."),
        ("iv", "PRODUCED", "생산수", "Produced water", "생산수 취수량(메가리터)."),
        ("v", "THIRD_PARTY", "제3자 공급수", "Third-party water", "제3자 공급수(상수도 등) 취수량(메가리터)."),
    ]
    out = []
    for suf, mid, nko, nen, desc in rows:
        out.append(
            DP(
                dp_id=f"{prefix}-{suf}",
                dp_code=f"{code_base}_{mid}",
                name_ko=f"공개 303-3-{dis_letter}-{suf}: {nko}",
                name_en=f"Disclosure 303-3-{dis_letter}-{suf}: {nen}",
                description=desc,
                topic="수자원·배수",
                subtopic="취수",
                dp_type="narrative",
                unit="megaliter",
                parent_indicator=parent,
                disclosure_requirement="필수",
                validation_rules=[f"{label_ko} 출처별 메가리터", "해당 없음 시 명시"],
            )
        )
    return out


def main() -> None:
    pts: list = [
        DP(
            dp_id="GRI303",
            dp_code="GRI_303_WATER_EFFLUENTS",
            name_ko="GRI 303: 수자원 및 폐수 2018",
            name_en="GRI 303: Water and Effluents 2018",
            description=(
                "GRI 303은 조직의 수자원 취수·방류·소비 등 물 관련 영향에 대한 주제별 기준입니다. "
                "본 시드는 주제별 공시(섹션 2) 중 공개 303-3(취수), 303-4(방류), 303-5(소비)만 포함합니다."
            ),
            topic="수자원·배수",
            subtopic="GRI 303",
            dp_type="narrative",
            parent_indicator=None,
            child_dps=["GRI303-SEC-2"],
            disclosure_requirement="필수",
            validation_rules=["시드 범위: 공개 303-3·303-4·303-5"],
        ),
        DP(
            dp_id="GRI303-SEC-2",
            dp_code="GRI_303_SEC_2_TOPIC_DISCLOSURES",
            name_ko="섹션 2: 주제별 공시(시드: 303-3~303-5)",
            name_en="Section 2: Topic-related disclosures (seed: 303-3 to 303-5)",
            description="물 주제에 대한 취수·방류·소비 공시 묶음입니다.",
            topic="수자원·배수",
            subtopic="주제별 공시",
            dp_type="narrative",
            parent_indicator="GRI303",
            child_dps=["GRI303-3", "GRI303-4", "GRI303-5"],
            disclosure_requirement="필수",
            validation_rules=["303-3~303-5 요건 충족"],
        ),
    ]

    # --- 303-3 ---
    pts.append(
        DP(
            dp_id="GRI303-3",
            dp_code="GRI_303_DIS_3_WATER_WITHDRAWAL",
            name_ko="공개 303-3: 취수",
            name_en="Disclosure 303-3: Water withdrawal",
            description=(
                "전 지역·물 스트레스 지역 취수량 및 출처별·수질(담수/기타) 세분, 집계 배경(d), "
                "편성 2.1(스트레스 평가 도구), 권고 2.2를 포함합니다."
            ),
            topic="수자원·배수",
            subtopic="취수",
            dp_type="narrative",
            parent_indicator="GRI303-SEC-2",
            child_dps=["GRI303-3-a", "GRI303-3-b", "GRI303-3-c", "GRI303-3-d", "GRI303-3-2-1", "GRI303-3-2-2"],
            disclosure_requirement="필수",
            validation_rules=["a~d·2.1·2.2 트리", "단위 메가리터", "RULE_GRI303_3_*"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-3-a",
            dp_code="GRI_303_DIS_3_A_ALL_AREAS",
            name_ko="공개 303-3-a: 전 지역 총 취수 및 출처별 내역",
            name_en="Disclosure 303-3-a: Total withdrawal all areas by source",
            description="모든 지역에서의 총 취수량(메가리터)과 지표수·지하수·해수·생산수·제3자 공급별 내역을 보고합니다.",
            topic="수자원·배수",
            subtopic="취수",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-3",
            child_dps=[f"GRI303-3-a-{x}" for x in ["i", "ii", "iii", "iv", "v"]],
            disclosure_requirement="필수",
            validation_rules=["총량·출처별 합의", "표 1(지침)"],
        )
    )
    pts.extend(_src_rows_3a("GRI303-3-a", "GRI_303_DIS_3_A", "GRI303-3-a", "전 지역", "a"))

    pts.append(
        DP(
            dp_id="GRI303-3-b",
            dp_code="GRI_303_DIS_3_B_WATER_STRESS",
            name_ko="공개 303-3-b: 물 스트레스 지역 총 취수 및 출처별 내역",
            name_en="Disclosure 303-3-b: Withdrawal in water-stressed areas by source",
            description=(
                "물 스트레스 지역에서의 총 취수(메가리터) 및 출처별(i~v) 내역을 보고합니다. "
                "제3자 공급(v)은 원천(i~iv)별 세분이 필요할 수 있습니다(지침·RULE_GRI303_3_B_V_GUIDANCE)."
            ),
            topic="수자원·배수",
            subtopic="취수·스트레스",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-3",
            child_dps=[f"GRI303-3-b-{x}" for x in ["i", "ii", "iii", "iv", "v"]],
            disclosure_requirement="필수",
            validation_rules=["스트레스 구역 정의·도구(2.1)", "303-3-b 지침"],
        )
    )
    pts.extend(_src_rows_3a("GRI303-3-b", "GRI_303_DIS_3_B", "GRI303-3-b", "스트레스 지역", "b"))

    pts.append(
        DP(
            dp_id="GRI303-3-c",
            dp_code="GRI_303_DIS_3_C_QUALITY_BREAKDOWN",
            name_ko="공개 303-3-c: 출처별 취수의 담수·기타 수질 세분",
            name_en="Disclosure 303-3-c: Freshwater vs other water by source (303-3-a,b)",
            description=(
                "공개 303-3-a 및 303-3-b에 제시된 각 출처별 총 취수를 메가리터로 "
                "담수(TDS≤1,000 mg/L)(i)와 기타 수질(TDS>1,000 mg/L)(ii)로 세분하여 보고합니다."
            ),
            topic="수자원·배수",
            subtopic="취수·수질",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-3",
            child_dps=["GRI303-3-c-i", "GRI303-3-c-ii"],
            disclosure_requirement="필수",
            validation_rules=["출처×수질 매트릭스와 정합", "단일 범주 시 0 보고 가능(지침)"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-3-c-i",
            dp_code="GRI_303_DIS_3_C_I_FRESHWATER",
            name_ko="공개 303-3-c-i: 담수(TDS ≤ 1,000 mg/L)",
            name_en="Disclosure 303-3-c-i: Freshwater (TDS ≤ 1,000 mg/L)",
            description="303-3-a·b 각 출처에서 취한 담수 구간(메가리터) 세분을 보고합니다.",
            topic="수자원·배수",
            subtopic="취수·수질",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-3-c",
            disclosure_requirement="필수",
            validation_rules=["TDS 기준", "출처별 합산 가능"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-3-c-ii",
            dp_code="GRI_303_DIS_3_C_II_OTHER_WATER",
            name_ko="공개 303-3-c-ii: 기타 수질(TDS > 1,000 mg/L)",
            name_en="Disclosure 303-3-c-ii: Other water (TDS > 1,000 mg/L)",
            description="303-3-a·b 각 출처에서 기타 수질(메가리터) 세분을 보고합니다.",
            topic="수자원·배수",
            subtopic="취수·수질",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-3-c",
            disclosure_requirement="필수",
            validation_rules=["TDS 기준"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-3-d",
            dp_code="GRI_303_DIS_3_D_CONTEXT",
            name_ko="공개 303-3-d: 집계 맥락 정보",
            name_en="Disclosure 303-3-d: Context for compilation",
            description="표준, 방법론, 가정 등 데이터 집계 이해에 필요한 맥락 정보를 보고합니다.",
            topic="수자원·배수",
            subtopic="취수",
            dp_type="narrative",
            parent_indicator="GRI303-3",
            disclosure_requirement="필수",
            validation_rules=["방법론 투명성"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-3-2-1",
            dp_code="GRI_303_DIS_3_COMP_2_1_WATER_STRESS_TOOLS",
            name_ko="편성 요건 2.1: 물 스트레스 평가 도구",
            name_en="Reporting requirement 2.1: Water stress assessment tools",
            description="공개 303-3을 작성할 때 물 스트레스 평가에 공개적으로 이용 가능하고 신뢰할 수 있는 도구·방법론을 사용해야 합니다.",
            topic="수자원·배수",
            subtopic="취수·편성",
            dp_type="narrative",
            parent_indicator="GRI303-3",
            disclosure_requirement="필수",
            validation_rules=["도구명·버전·역수준 최소", "Aqueduct·WWF 등(지침)"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-3-2-2",
            dp_code="GRI_303_DIS_3_REC_2_2",
            name_ko="권장 2.2: 취수 추가 세분(스트레스 지역)",
            name_en="Recommendation 2.2: Additional withdrawal breakdown (should)",
            description="표준 권장 조항 2.2(시설별·공급업체별) 묶음입니다.",
            topic="수자원·배수",
            subtopic="취수",
            dp_type="narrative",
            parent_indicator="GRI303-3",
            child_dps=["GRI303-3-2-2-1", "GRI303-3-2-2-2"],
            disclosure_requirement="권고",
            validation_rules=["2.2.1·2.2.2 검토"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-3-2-2-1",
            dp_code="GRI_303_DIS_3_REC_2_2_1_BY_FACILITY",
            name_ko="권장 2.2.1: 스트레스 지역 시설별 취수 세분",
            name_en="Recommendation 2.2.1: Withdrawal by facility in stressed areas",
            description="물 스트레스 지역 내 시설별로 공개 303-3의 취수 범주별 메가리터 세분을 보고할 것을 권장합니다.",
            topic="수자원·배수",
            subtopic="취수",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-3-2-2",
            disclosure_requirement="권고",
            validation_rules=["시설 식별·표 2(지침)"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-3-2-2-2",
            dp_code="GRI_303_DIS_3_REC_2_2_2_BY_SUPPLIER",
            name_ko="권장 2.2.2: 스트레스 지역 중대 영향 공급업체별 취수",
            name_en="Recommendation 2.2.2: Withdrawal by impactful suppliers",
            description="물 스트레스 지역에서 물 관련 중대 영향이 있는 공급업체별 총 취수(메가리터)를 권장합니다.",
            topic="수자원·배수",
            subtopic="취수·가치사슬",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-3-2-2",
            disclosure_requirement="권고",
            validation_rules=["공급업체 식별·표 3(지침)"],
        )
    )

    # --- 303-4 ---
    pts.append(
        DP(
            dp_id="GRI303-4",
            dp_code="GRI_303_DIS_4_WATER_DISCHARGE",
            name_ko="공개 303-4: 방류수",
            name_en="Disclosure 303-4: Water discharge",
            description=(
                "전 지역·수질별 방류, 스트레스 지역 방류, 우려 물질(d), 맥락(e), 편성 2.3, 권고 2.4를 포함합니다."
            ),
            topic="수자원·배수",
            subtopic="방류",
            dp_type="narrative",
            parent_indicator="GRI303-SEC-2",
            child_dps=[
                "GRI303-4-a",
                "GRI303-4-b",
                "GRI303-4-c",
                "GRI303-4-d",
                "GRI303-4-e",
                "GRI303-4-2-3",
                "GRI303-4-2-4",
            ],
            disclosure_requirement="필수",
            validation_rules=["a~e·2.3·2.4", "메가리터"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-4-a",
            dp_code="GRI_303_DIS_4_A_ALL_AREAS",
            name_ko="공개 303-4-a: 전 지역 총 방류 및 배출처별",
            name_en="Disclosure 303-4-a: Total discharge all areas by recipient",
            description="모든 지역으로의 총 방류량(메가리터) 및 지표수·지하수·해수·제3자(타 기관 공급 포함)별 내역을 보고합니다.",
            topic="수자원·배수",
            subtopic="방류",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-4",
            child_dps=["GRI303-4-a-i", "GRI303-4-a-ii", "GRI303-4-a-iii", "GRI303-4-a-iv"],
            disclosure_requirement="필수",
            validation_rules=["총량·출처별", "표 1(지침)"],
        )
    )
    for suf, mid, nko, nen, desc in [
        ("i", "SURFACE", "지표수", "Surface water", "지표수로의 방류(메가리터)."),
        ("ii", "GROUND", "지하수", "Groundwater", "지하수로의 방류(메가리터)."),
        ("iii", "SEA", "해수", "Seawater", "해수로의 방류(메가리터)."),
        (
            "iv",
            "THIRD_PARTY",
            "제3자 용수·타 기관 공급",
            "Third-party and water to other organizations",
            "제3자로의 방류·다른 기관에 공급된 물(메가리터). 타 조직 재사용을 위해 이송 시 별도 보고(지침).",
        ),
    ]:
        pts.append(
            DP(
                dp_id=f"GRI303-4-a-{suf}",
                dp_code=f"GRI_303_DIS_4_A_{mid}",
                name_ko=f"공개 303-4-a-{suf}: {nko}",
                name_en=f"Disclosure 303-4-a-{suf}: {nen}",
                description=desc,
                topic="수자원·배수",
                subtopic="방류",
                dp_type="narrative",
                unit="megaliter",
                parent_indicator="GRI303-4-a",
                disclosure_requirement="필수",
                validation_rules=["메가리터"],
            )
        )

    pts.append(
        DP(
            dp_id="GRI303-4-b",
            dp_code="GRI_303_DIS_4_B_QUALITY_ALL",
            name_ko="공개 303-4-b: 전 지역 방류의 수질별 세분",
            name_en="Disclosure 303-4-b: Discharge quality breakdown all areas",
            description="모든 지역으로 배출된 총 용수량(메가리터)을 담수(i)·기타(ii)로 세분합니다.",
            topic="수자원·배수",
            subtopic="방류·수질",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-4",
            child_dps=["GRI303-4-b-i", "GRI303-4-b-ii"],
            disclosure_requirement="필수",
            validation_rules=["TDS ≤1000 / >1000", "기타 최소 보고(지침)"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-4-b-i",
            dp_code="GRI_303_DIS_4_B_I_FRESH",
            name_ko="공개 303-4-b-i: 담수 방류(TDS ≤ 1,000 mg/L)",
            name_en="Disclosure 303-4-b-i: Freshwater discharge",
            description="TDS ≤ 1,000 mg/L인 방류(메가리터).",
            topic="수자원·배수",
            subtopic="방류·수질",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-4-b",
            disclosure_requirement="필수",
            validation_rules=["TDS 정의"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-4-b-ii",
            dp_code="GRI_303_DIS_4_B_II_OTHER",
            name_ko="공개 303-4-b-ii: 기타 용수 방류(TDS > 1,000 mg/L)",
            name_en="Disclosure 303-4-b-ii: Other water discharge",
            description="TDS > 1,000 mg/L인 방류(메가리터).",
            topic="수자원·배수",
            subtopic="방류·수질",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-4-b",
            disclosure_requirement="필수",
            validation_rules=["TDS 정의", "303-4-e 수질 접근과 연계 가능"],
        )
    )

    pts.append(
        DP(
            dp_id="GRI303-4-c",
            dp_code="GRI_303_DIS_4_C_STRESS_QUALITY",
            name_ko="공개 303-4-c: 물 스트레스 지역 방류 수질별 세분",
            name_en="Disclosure 303-4-c: Discharge in water-stressed areas by quality",
            description="물 스트레스 지역으로 방류된 총량(메가리터)의 담수(i)·기타 수역(ii) 세분을 보고합니다.",
            topic="수자원·배수",
            subtopic="방류·스트레스",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-4",
            child_dps=["GRI303-4-c-i", "GRI303-4-c-ii"],
            disclosure_requirement="필수",
            validation_rules=["303-3-b 스트레스 정의와 정합"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-4-c-i",
            dp_code="GRI_303_DIS_4_C_I_FRESH",
            name_ko="공개 303-4-c-i: 스트레스 지역 담수 방류",
            name_en="Disclosure 303-4-c-i: Freshwater discharge to stressed areas",
            description="스트레스 지역으로의 담수 방류(메가리터).",
            topic="수자원·배수",
            subtopic="방류·스트레스",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-4-c",
            disclosure_requirement="필수",
            validation_rules=["TDS ≤ 1,000 mg/L"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-4-c-ii",
            dp_code="GRI_303_DIS_4_C_II_OTHER",
            name_ko="공개 303-4-c-ii: 스트레스 지역 기타 수역 방류",
            name_en="Disclosure 303-4-c-ii: Other water discharge to stressed areas",
            description="스트레스 지역으로의 기타 수질 방류(메가리터).",
            topic="수자원·배수",
            subtopic="방류·스트레스",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-4-c",
            disclosure_requirement="필수",
            validation_rules=["TDS > 1,000 mg/L"],
        )
    )

    pts.append(
        DP(
            dp_id="GRI303-4-d",
            dp_code="GRI_303_DIS_4_D_PRIORITY_SUBSTANCES",
            name_ko="공개 303-4-d: 우선 관리 대상 물질",
            name_en="Disclosure 303-4-d: Priority substances of concern",
            description="우선 관리 대상 물질에 대한 정의·기준(i), 배출 한도 설정(ii), 한도 미준수 건수(iii)를 보고합니다.",
            topic="수자원·배수",
            subtopic="방류·물질",
            dp_type="narrative",
            parent_indicator="GRI303-4",
            child_dps=["GRI303-4-d-i", "GRI303-4-d-ii", "GRI303-4-d-iii"],
            disclosure_requirement="필수",
            validation_rules=["허가·자체 한도와 연계(지침)"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-4-d-i",
            dp_code="GRI_303_DIS_4_D_I_DEFINITION",
            name_ko="공개 303-4-d-i: 정의 및 사용 기준",
            name_en="Disclosure 303-4-d-i: Definition and criteria",
            description="우선 관리 대상 물질 정의 및 국제 표준·권위 목록 등 사용 기준을 설명합니다.",
            topic="수자원·배수",
            subtopic="방류·물질",
            dp_type="narrative",
            parent_indicator="GRI303-4-d",
            disclosure_requirement="필수",
            validation_rules=["정의 투명성"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-4-d-ii",
            dp_code="GRI_303_DIS_4_D_II_LIMITS",
            name_ko="공개 303-4-d-ii: 배출 한도 설정 방식",
            name_en="Disclosure 303-4-d-ii: How discharge limits are set",
            description="우선 관리 대상 물질의 배출 한도를 설정한 방식을 설명합니다.",
            topic="수자원·배수",
            subtopic="방류·물질",
            dp_type="narrative",
            parent_indicator="GRI303-4-d",
            disclosure_requirement="필수",
            validation_rules=["규제·내부 기준"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-4-d-iii",
            dp_code="GRI_303_DIS_4_D_III_NONCOMPLIANCE",
            name_ko="공개 303-4-d-iii: 배출 한도 미준수 사례 수",
            name_en="Disclosure 303-4-d-iii: Number of non-compliance cases",
            description="배출 한도 미준수 사례의 수를 보고합니다.",
            topic="수자원·배수",
            subtopic="방류·물질",
            dp_type="narrative",
            parent_indicator="GRI303-4-d",
            disclosure_requirement="필수",
            validation_rules=["건수·기간 명확성"],
        )
    )

    pts.append(
        DP(
            dp_id="GRI303-4-e",
            dp_code="GRI_303_DIS_4_E_CONTEXT",
            name_ko="공개 303-4-e: 집계 맥락 정보",
            name_en="Disclosure 303-4-e: Context for compilation",
            description="기준, 방법론, 가정 등 방류 데이터 집계 이해에 필요한 배경을 보고합니다.",
            topic="수자원·배수",
            subtopic="방류",
            dp_type="narrative",
            parent_indicator="GRI303-4",
            disclosure_requirement="필수",
            validation_rules=["수질 정의 접근(물리·화학 기준)", "모델링·측정(지침)"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-4-2-3",
            dp_code="GRI_303_DIS_4_COMP_2_3_STRESS_TOOLS",
            name_ko="편성 요건 2.3: 방류 공시용 물 스트레스 평가",
            name_en="Reporting requirement 2.3: Water stress tools for 303-4",
            description="공개 303-4 작성 시 물 스트레스 평가에 공개·신뢰 가능한 도구·방법론을 사용해야 합니다.",
            topic="수자원·배수",
            subtopic="방류·편성",
            dp_type="narrative",
            parent_indicator="GRI303-4",
            disclosure_requirement="필수",
            validation_rules=["303-3-b 지침과 정합 가능"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-4-2-4",
            dp_code="GRI_303_DIS_4_REC_2_4",
            name_ko="권장 2.4: 방류 추가 정보",
            name_en="Recommendation 2.4: Additional discharge information (should)",
            description="권장 2.4.1~2.4.3 묶음입니다.",
            topic="수자원·배수",
            subtopic="방류",
            dp_type="narrative",
            parent_indicator="GRI303-4",
            child_dps=["GRI303-4-2-4-1", "GRI303-4-2-4-2", "GRI303-4-2-4-3"],
            disclosure_requirement="권고",
            validation_rules=["2.4.x 검토"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-4-2-4-1",
            dp_code="GRI_303_DIS_4_REC_2_4_1_LIMIT_EXCEEDANCES",
            name_ko="권장 2.4.1: 방류 한도 초과 횟수",
            name_en="Recommendation 2.4.1: Times discharge limits exceeded",
            description="방류 한도를 초과한 횟수를 권장합니다.",
            topic="수자원·배수",
            subtopic="방류",
            dp_type="narrative",
            parent_indicator="GRI303-4-2-4",
            disclosure_requirement="권고",
            validation_rules=["횟수·정의"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-4-2-4-2",
            dp_code="GRI_303_DIS_4_REC_2_4_2_TREATMENT_LEVELS",
            name_ko="권장 2.4.2: 처리 수준별 방류량 및 결정 방식",
            name_en="Recommendation 2.4.2: Discharge by treatment level",
            description="처리 수준별 총 방류 내역과 처리 수준 결정 방식을 권장합니다.",
            topic="수자원·배수",
            subtopic="방류·처리",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-4-2-4",
            disclosure_requirement="권고",
            validation_rules=["1·2·3차 처리 정의(지침)", "온사이트·제3자 처리"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-4-2-4-3",
            dp_code="GRI_303_DIS_4_REC_2_4_3_SUPPLIER_STANDARDS",
            name_ko="권장 2.4.3: 공급업체 방류 최소 기준 설정 비율",
            name_en="Recommendation 2.4.3: Suppliers with minimum discharge quality standards",
            description="방류 영향이 중대한 공급업체 중 방류수 품질 최소 기준을 둔 비율(%)을 권장합니다.",
            topic="수자원·배수",
            subtopic="방류·가치사슬",
            dp_type="narrative",
            parent_indicator="GRI303-4-2-4",
            disclosure_requirement="권고",
            validation_rules=["분자·분모 정의(지침)", "303-2 교차"],
        )
    )

    # --- 303-5 ---
    pts.append(
        DP(
            dp_id="GRI303-5",
            dp_code="GRI_303_DIS_5_WATER_CONSUMPTION",
            name_ko="공개 303-5: 물 소비량",
            name_en="Disclosure 303-5: Water consumption",
            description=(
                "전 지역·스트레스 지역 소비, 중대 영향 시 저수량 변화(c), 맥락(d), 권고 2.5(시설·공급업체)를 포함합니다. "
                "소비=취수−방류 등은 RULE_GRI303_5_FORMULA_GUIDANCE."
            ),
            topic="수자원·배수",
            subtopic="소비",
            dp_type="narrative",
            parent_indicator="GRI303-SEC-2",
            child_dps=["GRI303-5-a", "GRI303-5-b", "GRI303-5-c", "GRI303-5-d", "GRI303-5-2-5"],
            disclosure_requirement="필수",
            validation_rules=["a~d·2.5", "메가리터", "표 1·303-3-b 지침 참조"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-5-a",
            dp_code="GRI_303_DIS_5_A_ALL_AREAS",
            name_ko="공개 303-5-a: 전 지역 총 물 소비량",
            name_en="Disclosure 303-5-a: Total water consumption all areas",
            description="모든 지역의 총 물 소비량(메가리터)을 보고합니다.",
            topic="수자원·배수",
            subtopic="소비",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-5",
            disclosure_requirement="필수",
            validation_rules=["취수−방류와 정합 가능(지침)"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-5-b",
            dp_code="GRI_303_DIS_5_B_STRESS_AREAS",
            name_ko="공개 303-5-b: 물 스트레스 지역 총 소비량",
            name_en="Disclosure 303-5-b: Consumption in water-stressed areas",
            description="물 스트레스 지역 전체의 총 물 소비량(메가리터)을 보고합니다.",
            topic="수자원·배수",
            subtopic="소비·스트레스",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-5",
            disclosure_requirement="필수",
            validation_rules=["스트레스 정의·303-3-b와 정합"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-5-c",
            dp_code="GRI_303_DIS_5_C_STORAGE_CHANGE",
            name_ko="공개 303-5-c: 저수량 변화(중대 영향 시)",
            name_en="Disclosure 303-5-c: Change in water storage if material",
            description="저수량이 물 관련 중대 영향 요인으로 확인된 경우, 기간 중 저수량 변화(메가리터)를 보고합니다.",
            topic="수자원·배수",
            subtopic="소비·저수",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-5",
            disclosure_requirement="필수",
            validation_rules=["기말−기초(지침)", "해당 없음 시 명시"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-5-d",
            dp_code="GRI_303_DIS_5_D_CONTEXT",
            name_ko="공개 303-5-d: 집계 맥락 정보",
            name_en="Disclosure 303-5-d: Context for compilation",
            description="표준, 방법론, 가정, 산정·추정·모델링 여부, 직접 측정, 업종 특수 요인 접근 등을 보고합니다.",
            topic="수자원·배수",
            subtopic="소비",
            dp_type="narrative",
            parent_indicator="GRI303-5",
            disclosure_requirement="필수",
            validation_rules=["방법론 투명성"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-5-2-5",
            dp_code="GRI_303_DIS_5_REC_2_5",
            name_ko="권장 2.5: 소비 추가 세분",
            name_en="Recommendation 2.5: Additional consumption breakdown (should)",
            description="권장 2.5.1·2.5.2 묶음입니다.",
            topic="수자원·배수",
            subtopic="소비",
            dp_type="narrative",
            parent_indicator="GRI303-5",
            child_dps=["GRI303-5-2-5-1", "GRI303-5-2-5-2"],
            disclosure_requirement="권고",
            validation_rules=["2.5.1·2.5.2"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-5-2-5-1",
            dp_code="GRI_303_DIS_5_REC_2_5_1_BY_FACILITY",
            name_ko="권장 2.5.1: 스트레스 지역 시설별 소비",
            name_en="Recommendation 2.5.1: Consumption by facility in stressed areas",
            description="물 스트레스 지역 내 시설별 총 물 소비량(메가리터)을 권장합니다.",
            topic="수자원·배수",
            subtopic="소비",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-5-2-5",
            disclosure_requirement="권고",
            validation_rules=["표 2(지침)"],
        )
    )
    pts.append(
        DP(
            dp_id="GRI303-5-2-5-2",
            dp_code="GRI_303_DIS_5_REC_2_5_2_BY_SUPPLIER",
            name_ko="권장 2.5.2: 스트레스 지역 중대 영향 공급업체별 소비",
            name_en="Recommendation 2.5.2: Consumption by impactful suppliers",
            description="스트레스 지역에서 물 관련 중대 영향 공급업체별 총 물 소비(메가리터) 합계를 권장합니다.",
            topic="수자원·배수",
            subtopic="소비·가치사슬",
            dp_type="narrative",
            unit="megaliter",
            parent_indicator="GRI303-5-2-5",
            disclosure_requirement="권고",
            validation_rules=["표 3(지침)"],
        )
    )

    idset = {p["dp_id"] for p in pts}
    assert len(idset) == len(pts), "duplicate dp_id"
    for p in pts:
        for c in p.get("child_dps") or []:
            assert c in idset, (p["dp_id"], c)
        par = p.get("parent_indicator")
        if par:
            assert par in idset, (p["dp_id"], par)

    g3_main = (
        "Disclosure 303-3: See Table 1 for presentation examples. Surface water includes collected/stored rainwater. "
        "Third-party water includes municipal networks and other suppliers."
    )
    g3_b = (
        "Water stress: ability to meet human and ecological demand (availability, quality, accessibility). "
        "Tools: WRI Aqueduct Water Risk Atlas, WWF Water Risk Filter. Indicators may include withdrawal-to-supply ratio "
        "(High 40–80%, Extremely High >80%) and water depletion metrics (monthly/seasonal/annual >75% thresholds). "
        "Assess at catchment level at minimum. 303-3-b-v: For third-party supply, seek original source split (i–iv) from supplier; may report supplier identity and volume."
    )
    g3_c = (
        "303-3-c: Break down each source from 303-3-a and 303-3-b into Freshwater (TDS≤1,000 mg/L) and Other water (TDS>1,000). "
        "If a source is entirely one category (e.g. seawater as Other), report zero for the other. May describe quality criteria."
    )
    g3_221 = (
        "2.2.1: (a) Identify facilities in water-stressed areas; (b) report total withdrawal by source for each. See Table 2."
    )
    g3_222 = (
        "2.2.2: (a) Suppliers in stressed areas; (b) those with significant water impacts; (c) sum withdrawal per supplier; (d) report total. See Table 3."
    )
    g4_gen = (
        "303-4 background: Discharge quantification helps assess negative impacts; relationship to impact is non-linear and depends on quality and receiving environment. "
        "Advanced treatment can be positive. May report per facility in stressed areas."
    )
    g4_main = (
        "303-4: Table 1 examples. For water-stressed areas use methods per 303-3-b guidance."
    )
    g4_a_iv = (
        "303-4-a-iv: Discharge to third parties includes sending water/wastewater to another organization for their use—report volume separately."
    )
    g4_bc = (
        "303-4-b/c: Freshwater TDS≤1,000 mg/L; Other TDS>1,000. At minimum report Other water discharge; may elaborate per 303-4-e. "
        "Include user value and physical/chemical criteria where relevant."
    )
    g4_d = (
        "303-4-d: Substances of concern cause irreversible harm to water bodies, ecosystems, or health. Limits from regulation or internal factors; "
        "may report unauthorized exceedances of permits and reduction plans."
    )
    g4_242 = (
        "2.4.2: Treatment levels—Primary (settleable/floating solids), Secondary (dissolved/colloidal), Tertiary (e.g. metals, N, P). "
        "Include on-site or third-party treatment; explain why level chosen. High-quality water may need no treatment."
    )
    g4_243 = (
        "2.4.3: Minimum standards exceed regulatory minima for discharge quality; see Disclosure 303-2. "
        "Steps: count suppliers with significant discharge-related water impacts; count those with minimum discharge-quality standards; "
        "percentage = (latter/former)×100. Table 3 example."
    )
    g5_formula = (
        "Water consumption: water used by the organization no longer available to ecosystems or communities in the period. "
        "Consumption ≈ Total water withdrawal − Total water discharge (consistent boundaries). "
        "Change in water storage = total storage at end of period − total at beginning (when storage is a material impact). "
        "See Table 1; water-stressed areas per 303-3-b guidance."
    )
    g5_251 = "2.5.1: Identify stressed-area facilities; report total consumption each. Table 2."
    g5_252 = "2.5.2: Stressed-area suppliers → significant impacts → sum each supplier’s consumption → report total. Table 3."

    sec2 = ["GRI303-SEC-2", "GRI303-3", "GRI303-4", "GRI303-5"]
    ids_3 = [p["dp_id"] for p in pts if p["dp_id"].startswith("GRI303-3")]
    ids_4 = [p["dp_id"] for p in pts if p["dp_id"].startswith("GRI303-4")]
    ids_5 = [p["dp_id"] for p in pts if p["dp_id"].startswith("GRI303-5")]

    rbs = [
        RB(
            "RULE_GRI303",
            "GRI303",
            "GRI 303: 수자원 및 폐수",
            "GRI 303: Water — seed disclosures 303-3 to 303-5.",
            "standard",
            "GRI 303",
            ["water withdrawal", "discharge", "consumption", "megaliter"],
            act("apply_gri303_seed", "시드 범위"),
            chk("GRI303_SEED", "303-3~5", "ok"),
            [],
            ["GRI303", *sec2],
            "GRI 303 (seed)",
            "필수",
        ),
        RB(
            "RULE_GRI303_SEC_2",
            "GRI303-SEC-2",
            "섹션 2",
            "Section 2 topic disclosures (seed).",
            "section",
            "GRI 303 Section 2",
            ["303-3", "303-4", "303-5"],
            act("report_sec2_303", "303-3~5"),
            chk("GRI303_SEC2_OK", "sec2", "ok"),
            [],
            sec2,
            "GRI 303 Section 2",
            "필수",
        ),
        RB(
            "RULE_GRI303_3",
            "GRI303-3",
            "공개 303-3",
            "Disclosure 303-3: Water withdrawal.",
            "disclosure",
            "GRI 303 Disclosure 303-3",
            ["withdrawal", "water stress", "TDS"],
            act("report_303_3", "303-3 패키지"),
            chk("GRI303_3_OK", "303-3", "ok"),
            [],
            ids_3,
            "Disclosure 303-3",
            "필수",
        ),
        RB(
            "RULE_GRI303_3_A",
            "GRI303-3-a",
            "303-3-a",
            "303-3-a all areas",
            "disclosure_requirement",
            "GRI 303 303-3-a",
            [],
            act("meet_303_3_a", "303-3-a"),
            chk("GRI303_3_A_OK", "a", "ok"),
            [],
            ["GRI303-3-a"] + [f"GRI303-3-a-{x}" for x in "ivv"],
            "303-3-a",
            "필수",
        ),
        RB(
            "RULE_GRI303_3_B",
            "GRI303-3-b",
            "303-3-b",
            "303-3-b stressed areas",
            "disclosure_requirement",
            "GRI 303 303-3-b",
            [],
            act("meet_303_3_b", "303-3-b"),
            chk("GRI303_3_B_OK", "b", "ok"),
            [],
            ["GRI303-3-b"] + [f"GRI303-3-b-{x}" for x in "ivv"],
            "303-3-b",
            "필수",
        ),
        RB(
            "RULE_GRI303_3_C",
            "GRI303-3-c",
            "303-3-c",
            "303-3-c quality breakdown",
            "disclosure_requirement",
            "GRI 303 303-3-c",
            [],
            act("meet_303_3_c", "303-3-c"),
            chk("GRI303_3_C_OK", "c", "ok"),
            [],
            ["GRI303-3-c", "GRI303-3-c-i", "GRI303-3-c-ii"],
            "303-3-c",
            "필수",
        ),
        RB(
            "RULE_GRI303_3_D",
            "GRI303-3-d",
            "303-3-d",
            "303-3-d",
            "disclosure_requirement",
            "GRI 303 303-3-d",
            [],
            act("meet_303_3_d", "303-3-d"),
            chk("GRI303_3_D_OK", "d", "ok"),
            [],
            ["GRI303-3-d"],
            "303-3-d",
            "필수",
        ),
        RB(
            "RULE_GRI303_3_2_1",
            "GRI303-3-2-1",
            "편성 2.1",
            "Compilation 2.1 water stress tools",
            "disclosure",
            "GRI 303 — 2.1",
            [],
            act("compile_303_3_21", "2.1"),
            chk("GRI303_3_21_OK", "2.1", "ok"),
            [],
            ["GRI303-3-2-1"],
            "Compilation 2.1",
            "필수",
        ),
        RB(
            "RULE_GRI303_3_2_2",
            "GRI303-3-2-2",
            "권장 2.2",
            "Recommendation 2.2",
            "guidance",
            "GRI 303 — 2.2",
            [],
            act("rec_303_3_22", "2.2", mandatory=False),
            chk("GRI303_3_22_REVIEW", "2.2", "reviewed"),
            [],
            ["GRI303-3-2-2", "GRI303-3-2-2-1", "GRI303-3-2-2-2"],
            "Recommendation 2.2",
            "권고",
        ),
        RB(
            "RULE_GRI303_3_MAIN_GUIDANCE",
            "GRI303-3",
            "지침: 공개 303-3(표1·용어)",
            g3_main,
            "guidance",
            "GRI 303 303-3 — Guidance",
            ["rainwater", "third-party"],
            act("interpret_303_3_main", "303-3 지침", mandatory=False),
            chk("GRI303_3_MAIN_G_OK", "지침", "coherent"),
            [],
            ["GRI303-3"],
            "Guidance 303-3",
            "필수",
        ),
        RB(
            "RULE_GRI303_3_B_STRESS_GUIDANCE",
            "GRI303-3-b",
            "지침: 물 스트레스·303-3-b·제3자 원천",
            g3_b,
            "guidance",
            "GRI 303 303-3-b — Water stress",
            ["Aqueduct", "Water Risk Filter", "depletion"],
            act("interpret_303_3_b_stress", "스트레스·b 지침", mandatory=False),
            chk("GRI303_3_B_G_OK", "지침", "coherent"),
            [],
            ["GRI303-3-b", "GRI303-3-b-v"],
            "Guidance 303-3-b stress",
            "필수",
        ),
        RB(
            "RULE_GRI303_3_B_V_GUIDANCE",
            "GRI303-3-b-v",
            "지침: 303-3-b-v 제3자 공급 세분",
            "Third-party withdrawal in stressed areas: request source split i–iv from supplier; may disclose supplier and volume.",
            "guidance",
            "GRI 303 303-3-b-v",
            ["supplier", "provenance"],
            act("interpret_303_3_bv", "b-v 지침", mandatory=False),
            chk("GRI303_3_BV_G_OK", "지침", "coherent"),
            [],
            ["GRI303-3-b-v"],
            "Guidance 303-3-b-v",
            "필수",
        ),
        RB(
            "RULE_GRI303_3_C_GUIDANCE",
            "GRI303-3-c",
            "지침: 303-3-c TDS·출처 매트릭스",
            g3_c,
            "guidance",
            "GRI 303 303-3-c",
            ["TDS", "freshwater"],
            act("interpret_303_3_c", "303-3-c 지침", mandatory=False),
            chk("GRI303_3_C_G_OK", "지침", "coherent"),
            [],
            ["GRI303-3-c", "GRI303-3-c-i", "GRI303-3-c-ii"],
            "Guidance 303-3-c",
            "필수",
        ),
        RB(
            "RULE_GRI303_3_2_2_1_GUIDANCE",
            "GRI303-3-2-2-1",
            "지침: 권장 2.2.1",
            g3_221,
            "guidance",
            "GRI 303 — 2.2.1",
            ["facility", "Table 2"],
            act("interpret_303_3_221", "2.2.1", mandatory=False),
            chk("GRI303_3_221_G_OK", "지침", "coherent"),
            [],
            ["GRI303-3-2-2-1"],
            "Guidance 2.2.1",
            "필수",
        ),
        RB(
            "RULE_GRI303_3_2_2_2_GUIDANCE",
            "GRI303-3-2-2-2",
            "지침: 권장 2.2.2",
            g3_222,
            "guidance",
            "GRI 303 — 2.2.2",
            ["supplier", "Table 3"],
            act("interpret_303_3_222", "2.2.2", mandatory=False),
            chk("GRI303_3_222_G_OK", "지침", "coherent"),
            [],
            ["GRI303-3-2-2-2"],
            "Guidance 2.2.2",
            "필수",
        ),
        RB(
            "RULE_GRI303_4",
            "GRI303-4",
            "공개 303-4",
            "Disclosure 303-4: Water discharge.",
            "disclosure",
            "GRI 303 Disclosure 303-4",
            ["effluent", "TDS", "substances of concern"],
            act("report_303_4", "303-4 패키지"),
            chk("GRI303_4_OK", "303-4", "ok"),
            [],
            ids_4,
            "Disclosure 303-4",
            "필수",
        ),
        RB(
            "RULE_GRI303_4_A",
            "GRI303-4-a",
            "303-4-a",
            "303-4-a",
            "disclosure_requirement",
            "GRI 303 303-4-a",
            [],
            act("meet_303_4_a", "303-4-a"),
            chk("GRI303_4_A_OK", "a", "ok"),
            [],
            ["GRI303-4-a"] + [f"GRI303-4-a-{x}" for x in ["i", "ii", "iii", "iv"]],
            "303-4-a",
            "필수",
        ),
        RB(
            "RULE_GRI303_4_B",
            "GRI303-4-b",
            "303-4-b",
            "303-4-b",
            "disclosure_requirement",
            "GRI 303 303-4-b",
            [],
            act("meet_303_4_b", "303-4-b"),
            chk("GRI303_4_B_OK", "b", "ok"),
            [],
            ["GRI303-4-b", "GRI303-4-b-i", "GRI303-4-b-ii"],
            "303-4-b",
            "필수",
        ),
        RB(
            "RULE_GRI303_4_C",
            "GRI303-4-c",
            "303-4-c",
            "303-4-c",
            "disclosure_requirement",
            "GRI 303 303-4-c",
            [],
            act("meet_303_4_c", "303-4-c"),
            chk("GRI303_4_C_OK", "c", "ok"),
            [],
            ["GRI303-4-c", "GRI303-4-c-i", "GRI303-4-c-ii"],
            "303-4-c",
            "필수",
        ),
        RB(
            "RULE_GRI303_4_D",
            "GRI303-4-d",
            "303-4-d",
            "303-4-d",
            "disclosure_requirement",
            "GRI 303 303-4-d",
            [],
            act("meet_303_4_d", "303-4-d"),
            chk("GRI303_4_D_OK", "d", "ok"),
            [],
            ["GRI303-4-d", "GRI303-4-d-i", "GRI303-4-d-ii", "GRI303-4-d-iii"],
            "303-4-d",
            "필수",
        ),
        RB(
            "RULE_GRI303_4_E",
            "GRI303-4-e",
            "303-4-e",
            "303-4-e",
            "disclosure_requirement",
            "GRI 303 303-4-e",
            [],
            act("meet_303_4_e", "303-4-e"),
            chk("GRI303_4_E_OK", "e", "ok"),
            [],
            ["GRI303-4-e"],
            "303-4-e",
            "필수",
        ),
        RB(
            "RULE_GRI303_4_2_3",
            "GRI303-4-2-3",
            "편성 2.3",
            "Compilation 2.3",
            "disclosure",
            "GRI 303 — 2.3",
            [],
            act("compile_303_4_23", "2.3"),
            chk("GRI303_4_23_OK", "2.3", "ok"),
            [],
            ["GRI303-4-2-3"],
            "Compilation 2.3",
            "필수",
        ),
        RB(
            "RULE_GRI303_4_2_4",
            "GRI303-4-2-4",
            "권장 2.4",
            "Recommendation 2.4",
            "guidance",
            "GRI 303 — 2.4",
            [],
            act("rec_303_4_24", "2.4", mandatory=False),
            chk("GRI303_4_24_REVIEW", "2.4", "reviewed"),
            [],
            [
                "GRI303-4-2-4",
                "GRI303-4-2-4-1",
                "GRI303-4-2-4-2",
                "GRI303-4-2-4-3",
            ],
            "Recommendation 2.4",
            "권고",
        ),
        RB(
            "RULE_GRI303_4_GEN_GUIDANCE",
            "GRI303-4",
            "지침: 303-4 배경",
            g4_gen,
            "guidance",
            "GRI 303 303-4 — Background",
            ["impact", "treatment"],
            act("interpret_303_4_gen", "303-4 배경", mandatory=False),
            chk("GRI303_4_GEN_G_OK", "지침", "coherent"),
            [],
            ["GRI303-4"],
            "Guidance 303-4 background",
            "필수",
        ),
        RB(
            "RULE_GRI303_4_MAIN_GUIDANCE",
            "GRI303-4",
            "지침: 공개 303-4·표1·스트레스",
            g4_main,
            "guidance",
            "GRI 303 303-4 — General",
            ["Table 1", "303-3-b"],
            act("interpret_303_4_main", "303-4 지침", mandatory=False),
            chk("GRI303_4_MAIN_G_OK", "지침", "coherent"),
            [],
            ["GRI303-4"],
            "Guidance 303-4 main",
            "필수",
        ),
        RB(
            "RULE_GRI303_4_A_IV_GUIDANCE",
            "GRI303-4-a-iv",
            "지침: 303-4-a-iv 제3자 배출",
            g4_a_iv,
            "guidance",
            "GRI 303 303-4-a-iv",
            ["third party", "transfer"],
            act("interpret_303_4_a4", "a-iv 지침", mandatory=False),
            chk("GRI303_4_A4_G_OK", "지침", "coherent"),
            [],
            ["GRI303-4-a-iv"],
            "Guidance 303-4-a-iv",
            "필수",
        ),
        RB(
            "RULE_GRI303_4_BC_GUIDANCE",
            "GRI303-4-b",
            "지침: 303-4-b·c 수질",
            g4_bc,
            "guidance",
            "GRI 303 303-4-b,c",
            ["TDS", "freshwater"],
            act("interpret_303_4_bc", "b·c 지침", mandatory=False),
            chk("GRI303_4_BC_G_OK", "지침", "coherent"),
            [],
            ["GRI303-4-b", "GRI303-4-b-i", "GRI303-4-b-ii", "GRI303-4-c", "GRI303-4-c-i", "GRI303-4-c-ii"],
            "Guidance 303-4-b,c",
            "필수",
        ),
        RB(
            "RULE_GRI303_4_D_GUIDANCE",
            "GRI303-4-d",
            "지침: 303-4-d 우려 물질",
            g4_d,
            "guidance",
            "GRI 303 303-4-d",
            ["permit", "non-compliance"],
            act("interpret_303_4_d", "303-4-d 지침", mandatory=False),
            chk("GRI303_4_D_G_OK", "지침", "coherent"),
            [],
            ["GRI303-4-d", "GRI303-4-d-i", "GRI303-4-d-ii", "GRI303-4-d-iii"],
            "Guidance 303-4-d",
            "필수",
        ),
        RB(
            "RULE_GRI303_4_2_4_2_GUIDANCE",
            "GRI303-4-2-4-2",
            "지침: 권장 2.4.2 처리 수준",
            g4_242,
            "guidance",
            "GRI 303 — 2.4.2 treatment",
            ["primary", "secondary", "tertiary"],
            act("interpret_303_4_242", "2.4.2", mandatory=False),
            chk("GRI303_4_242_G_OK", "지침", "coherent"),
            [],
            ["GRI303-4-2-4-2"],
            "Guidance 2.4.2",
            "필수",
        ),
        RB(
            "RULE_GRI303_4_2_4_3_GUIDANCE",
            "GRI303-4-2-4-3",
            "지침: 권장 2.4.3 공급업체 최소 기준",
            g4_243,
            "guidance",
            "GRI 303 — 2.4.3",
            ["303-2", "percentage"],
            act("interpret_303_4_243", "2.4.3", mandatory=False),
            chk("GRI303_4_243_G_OK", "지침", "coherent"),
            ["Cross-ref Disclosure 303-2"],
            ["GRI303-4-2-4-3"],
            "Guidance 2.4.3",
            "필수",
        ),
        RB(
            "RULE_GRI303_5",
            "GRI303-5",
            "공개 303-5",
            "Disclosure 303-5: Water consumption.",
            "disclosure",
            "GRI 303 Disclosure 303-5",
            ["consumption", "storage"],
            act("report_303_5", "303-5 패키지"),
            chk("GRI303_5_OK", "303-5", "ok"),
            [],
            ids_5,
            "Disclosure 303-5",
            "필수",
        ),
        RB(
            "RULE_GRI303_5_A",
            "GRI303-5-a",
            "303-5-a",
            "303-5-a",
            "disclosure_requirement",
            "GRI 303 303-5-a",
            [],
            act("meet_303_5_a", "303-5-a"),
            chk("GRI303_5_A_OK", "a", "ok"),
            [],
            ["GRI303-5-a"],
            "303-5-a",
            "필수",
        ),
        RB(
            "RULE_GRI303_5_B",
            "GRI303-5-b",
            "303-5-b",
            "303-5-b",
            "disclosure_requirement",
            "GRI 303 303-5-b",
            [],
            act("meet_303_5_b", "303-5-b"),
            chk("GRI303_5_B_OK", "b", "ok"),
            [],
            ["GRI303-5-b"],
            "303-5-b",
            "필수",
        ),
        RB(
            "RULE_GRI303_5_C",
            "GRI303-5-c",
            "303-5-c",
            "303-5-c",
            "disclosure_requirement",
            "GRI 303 303-5-c",
            [],
            act("meet_303_5_c", "303-5-c"),
            chk("GRI303_5_C_OK", "c", "ok"),
            [],
            ["GRI303-5-c"],
            "303-5-c",
            "필수",
        ),
        RB(
            "RULE_GRI303_5_D",
            "GRI303-5-d",
            "303-5-d",
            "303-5-d",
            "disclosure_requirement",
            "GRI 303 303-5-d",
            [],
            act("meet_303_5_d", "303-5-d"),
            chk("GRI303_5_D_OK", "d", "ok"),
            [],
            ["GRI303-5-d"],
            "303-5-d",
            "필수",
        ),
        RB(
            "RULE_GRI303_5_2_5",
            "GRI303-5-2-5",
            "권장 2.5",
            "Recommendation 2.5",
            "guidance",
            "GRI 303 — 2.5",
            [],
            act("rec_303_5_25", "2.5", mandatory=False),
            chk("GRI303_5_25_REVIEW", "2.5", "reviewed"),
            [],
            ["GRI303-5-2-5", "GRI303-5-2-5-1", "GRI303-5-2-5-2"],
            "Recommendation 2.5",
            "권고",
        ),
        RB(
            "RULE_GRI303_5_FORMULA_GUIDANCE",
            "GRI303-5-a",
            "지침: 소비·저수 산식·정의",
            g5_formula,
            "guidance",
            "GRI 303 303-5 — Formulas",
            ["withdrawal minus discharge", "storage"],
            act("interpret_303_5_formula", "303-5 산식", mandatory=False),
            chk("GRI303_5_FORM_G_OK", "지침", "coherent"),
            [],
            ["GRI303-5", "GRI303-5-a", "GRI303-5-b", "GRI303-5-c"],
            "Guidance 303-5 formulas",
            "필수",
        ),
        RB(
            "RULE_GRI303_5_2_5_1_GUIDANCE",
            "GRI303-5-2-5-1",
            "지침: 권장 2.5.1",
            g5_251,
            "guidance",
            "GRI 303 — 2.5.1",
            ["facility", "Table 2"],
            act("interpret_303_5_251", "2.5.1", mandatory=False),
            chk("GRI303_5_251_G_OK", "지침", "coherent"),
            [],
            ["GRI303-5-2-5-1"],
            "Guidance 2.5.1",
            "필수",
        ),
        RB(
            "RULE_GRI303_5_2_5_2_GUIDANCE",
            "GRI303-5-2-5-2",
            "지침: 권장 2.5.2",
            g5_252,
            "guidance",
            "GRI 303 — 2.5.2",
            ["supplier", "Table 3"],
            act("interpret_303_5_252", "2.5.2", mandatory=False),
            chk("GRI303_5_252_G_OK", "지침", "coherent"),
            [],
            ["GRI303-5-2-5-2"],
            "Guidance 2.5.2",
            "필수",
        ),
    ]

    # Fix related_dp_ids for 3_A and 3_B — must include all roman children
    for r in rbs:
        if r["rulebook_id"] == "RULE_GRI303_3_A":
            r["related_dp_ids"] = ["GRI303-3-a"] + [f"GRI303-3-a-{x}" for x in ["i", "ii", "iii", "iv", "v"]]
        if r["rulebook_id"] == "RULE_GRI303_3_B":
            r["related_dp_ids"] = ["GRI303-3-b"] + [f"GRI303-3-b-{x}" for x in ["i", "ii", "iii", "iv", "v"]]

    rid = {r["rulebook_id"] for r in rbs}
    assert len(rid) == len(rbs)
    miss = []
    for r in rbs:
        pid = r.get("primary_dp_id")
        if pid and pid not in idset:
            miss.append((r["rulebook_id"], pid))
    assert not miss, miss

    (root / "datapoint.json").write_text(
        json.dumps({"data_points": pts}, ensure_ascii=False, indent=4), encoding="utf-8"
    )
    (root / "rulebook.json").write_text(
        json.dumps({"rulebooks": rbs}, ensure_ascii=False, indent=4), encoding="utf-8"
    )
    print("OK", len(pts), "dps", len(rbs), "rbs")


if __name__ == "__main__":
    main()
