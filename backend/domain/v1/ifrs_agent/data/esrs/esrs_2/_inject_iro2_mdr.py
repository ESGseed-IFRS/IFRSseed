"""Inject IRO-2 (paras 54–58), para 59, MDR-P (63–65), MDR-A (66–69) into datapoint + rulebook."""
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent


def leaf(
    dp_id: str,
    code: str,
    name_ko: str,
    name_en: str,
    description: str,
    parent: str,
    dr: str = "필수",
    topic: str = "IRO 관리",
    subtopic: str | None = None,
    val: list | None = None,
    dp_type: str = "narrative",
    unit: None | str = None,
):
    sub = subtopic or ("IRO-2" if "IRO-2" in dp_id else "MDR")
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
        "dp_type": dp_type,
        "unit": unit,
        "equivalent_dps": [],
        "parent_indicator": parent,
        "child_dps": [],
        "financial_linkages": [],
        "financial_impact_type": None,
        "disclosure_requirement": dr,
        "reporting_frequency": "연간",
        "validation_rules": val
        or ["원문 문단·항목에 대응하는 서술·교차참조가 있는지 확인"],
        "value_range": None,
    }


def parent_dp(
    dp_id: str,
    code: str,
    name_ko: str,
    name_en: str,
    description: str,
    parent: str,
    children: list[str],
    subtopic: str,
    val: list | None = None,
):
    return {
        "dp_id": dp_id,
        "dp_code": code,
        "name_ko": name_ko,
        "name_en": name_en,
        "description": description,
        "standard": "ESRS",
        "category": "G",
        "topic": "IRO 관리",
        "subtopic": subtopic,
        "dp_type": "narrative",
        "unit": None,
        "equivalent_dps": [],
        "parent_indicator": parent,
        "child_dps": children,
        "financial_linkages": [],
        "financial_impact_type": None,
        "disclosure_requirement": "필수",
        "reporting_frequency": "연간",
        "validation_rules": val
        or ["하위 문단·항목 공시가 원문과 정합하는지 확인"],
        "value_range": None,
    }


def mk_rulebook(
    rulebook_id: str,
    primary_dp_id: str,
    section_name: str,
    paragraph_reference: str,
    check_id: str,
    key_terms: list | None = None,
    cross_refs: list | None = None,
    action: str | None = None,
):
    act = action or f"disclose_{check_id.lower()}"
    return {
        "rulebook_id": rulebook_id,
        "standard_id": "ESRS2",
        "primary_dp_id": primary_dp_id,
        "section_name": section_name,
        "section_content": f"ESRS 2 – {paragraph_reference}. datapoint.json description 참고.",
        "validation_rules": {
            "section_type": "disclosure_requirement",
            "paragraph_reference": paragraph_reference,
            "key_terms": key_terms or ["ESRS 2"],
            "required_actions": [
                {
                    "action": act,
                    "description": section_name,
                    "mandatory": True,
                }
            ],
            "verification_checks": [
                {
                    "check_id": check_id,
                    "description": section_name,
                    "expected": f"{check_id.lower()}_traceable",
                }
            ],
            "cross_references": cross_refs or [],
        },
        "related_dp_ids": [primary_dp_id],
        "rulebook_title": section_name[:40],
        "disclosure_requirement": "필수",
        "version": "1.0",
        "is_active": True,
        "is_primary": False,
        "effective_date": "2024-01-01",
        "mapping_notes": None,
        "conflicts_with": [],
    }


def main():
    dp_path = BASE / "datapoint.json"
    rb_path = BASE / "rulebook.json"
    doc = json.loads(dp_path.read_text(encoding="utf-8"))
    dps = doc["data_points"]
    if any(d.get("dp_id") == "ESRS2-IRO-2" for d in dps):
        print("ESRS2-IRO-2 already present; abort")
        return

    iro2_children = [
        "ESRS2-IRO-2-54",
        "ESRS2-IRO-2-55",
        "ESRS2-IRO-2-56",
        "ESRS2-IRO-2-57",
        "ESRS2-IRO-2-58",
    ]
    mdrp_children = [
        "ESRS2-MDR-P-63",
        "ESRS2-MDR-P-64",
        "ESRS2-MDR-P-65-a",
        "ESRS2-MDR-P-65-b",
        "ESRS2-MDR-P-65-c",
        "ESRS2-MDR-P-65-d",
        "ESRS2-MDR-P-65-e",
        "ESRS2-MDR-P-65-f",
    ]
    mdra_children = [
        "ESRS2-MDR-A-66",
        "ESRS2-MDR-A-67",
        "ESRS2-MDR-A-68-a",
        "ESRS2-MDR-A-68-b",
        "ESRS2-MDR-A-68-c",
        "ESRS2-MDR-A-68-d",
        "ESRS2-MDR-A-68-e",
        "ESRS2-MDR-A-69-a",
        "ESRS2-MDR-A-69-b",
        "ESRS2-MDR-A-69-c",
    ]
    mdr_children = [
        "ESRS2-MDR-59",
        "ESRS2-MDR-60",
        "ESRS2-MDR-61",
        "ESRS2-MDR-62",
        "ESRS2-MDR-P",
        "ESRS2-MDR-A",
    ]

    new_dps = [
        parent_dp(
            "ESRS2-IRO-2",
            "ESRS_2_IRO_2_STATEMENT_CONTENT_INDEX",
            "공개 요건 IRO-2: 지속가능성 성명서에 포함된 ESRS 공개 요건",
            "Disclosure Requirement IRO-2 – ESRS DRs in sustainability statement",
            "문단 54~58: 이행한 공시 요건 보고, 목록·위치(페이지/문단), 부속서 B EU 입법 연계 데이터포인트 표, 기후(E1) 비중대 상세 설명, 그 외 주제 비중대 시 요약 설명(선택).",
            "ESRS2-SEC-5",
            iro2_children,
            "IRO-2",
            val=["IRO-2가 성명서·면제·부속서 B·E1 조건부 설명과 정합하는지 확인"],
        ),
        leaf(
            "ESRS2-IRO-2-54",
            "ESRS_2_IRO_2_54_REPORT_COMPLIED_DRS",
            "IRO-2 문단 54: 이행한 공개 요건 보고",
            "IRO-2 para 54: Report disclosure requirements complied with",
            "기업은 지속가능성 성명서에서 이행한 공개 요건을 보고해야 합니다.",
            "ESRS2-IRO-2",
            subtopic="IRO-2",
            val=["성명서에 이행한 ESRS 공개 요건(또는 그 요지)이 식별 가능한지 확인"],
        ),
        leaf(
            "ESRS2-IRO-2-55",
            "ESRS_2_IRO_2_55_OBJECTIVE",
            "IRO-2 문단 55: 공시 목적(포함·제외 주제)",
            "IRO-2 para 55: Objective — included DRs and omitted topics",
            "어떤 공개 요건이 포함되었고, 중대성 평가에서 비중대로 판단되어 생략된 주제가 무엇인지에 대한 이해를 제공합니다.",
            "ESRS2-IRO-2",
            subtopic="IRO-2",
            val=["포함 DR·비중대 생략 주제가 IRO-1/중대성 평가와 대응하는지 확인"],
        ),
        leaf(
            "ESRS2-IRO-2-56",
            "ESRS_2_IRO_2_56_INDEX_LIST_APPENDIX_B",
            "IRO-2 문단 56: 이행 목록·위치·부속서 B EU 데이터포인트 표",
            "IRO-2 para 56: List, location, Appendix B EU datapoints table",
            "중대성 평가(ESRS 1 제3장)에 기초한 이행 공개 요건 목록, 보고서 내 위치(페이지 및/또는 문단), 기타 EU 입법에서 파생된 데이터포인트 전체 표(표준 부속서 B)를 포함합니다. 해당 항목별 위치를 표시하거나, ESRS 1 문단 35에 따라 적용 시 비중대(중요하지 않음)로 표시합니다.",
            "ESRS2-IRO-2",
            subtopic="IRO-2",
            val=[
                "이행 공개 요건 목록이 중대성 평가와 대응하는지 확인",
                "각 요건·표 항목의 위치(페이지/문단) 또는 비중대 표시가 있는지 확인",
                "부속서 B EU 입법 연계 데이터포인트 표가 완비되는지 확인",
            ],
        ),
        leaf(
            "ESRS2-IRO-2-57",
            "ESRS_2_IRO_2_57_E1_NOT_MATERIAL",
            "IRO-2 문단 57: ESRS E1(기후) 비중대로 전 DR 생략 시 상세 설명",
            "IRO-2 para 57: ESRS E1 omitted — detailed explanation and forward-looking analysis",
            "기후변화(ESRS E1)를 비중대로 판단하여 관련 공개 요건을 모두 생략한 경우, 중대성 평가 결론에 대한 상세한 설명과 향후 기후 관련 사안이 중대해질 수 있는 조건에 대한 전향적 분석을 제공해야 합니다.",
            "ESRS2-IRO-2",
            dr="조건부",
            subtopic="IRO-2",
            val=[
                "E1 전 DR 생략 시에만 적용: 중대성 평가 결론 상세 설명 여부 확인",
                "향후 중대화 가능 조건에 대한 전향적 분석 포함 여부 확인",
            ],
        ),
        leaf(
            "ESRS2-IRO-2-58",
            "ESRS_2_IRO_2_58_OTHER_TOPICS_NOT_MATERIAL",
            "IRO-2 문단 58: 기타 주제 비중대 생략 시 요약 설명(선택)",
            "IRO-2 para 58: Other topics omitted — may give brief explanation",
            "기후 외 주제를 비중대로 판단하여 관련 공개 요건을 생략한 경우, 중대성 평가 결론에 대한 간략한 설명을 제공할 수 있습니다.",
            "ESRS2-IRO-2",
            dr="권고",
            subtopic="IRO-2",
            val=[
                "해당 시 비중대 생략 주제에 대해 간략 설명이 제공되면 IRO-1·중대성 평가와 모순 없는지 확인",
            ],
        ),
        parent_dp(
            "ESRS2-MDR",
            "ESRS_2_MDR_POLICIES_ACTIONS",
            "4.2 정책 및 조치에 관한 최소 공시 요건(MDR 범위)",
            "Section 4.2 Minimum disclosure on policies and actions (MDR)",
            "문단 59(중대 정보 결정 설명), 60~62(MDR 적용 범위·배치·상호참조·미채택 공시), MDR-P(문단 63~65), MDR-A(문단 66~69)를 하위로 둡니다. 주제별·부문별 ESRS 및 기업별 공시와 함께 적용됩니다.",
            "ESRS2-SEC-5",
            mdr_children,
            "MDR",
            val=["MDR-P·MDR-A가 중대 지속가능성 사안별로 누락 없이 원문과 정합하는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-59",
            "ESRS_2_MDR_59_MATERIAL_INFO_DETERMINATION",
            "문단 59: 평가한 영향·위험·기회에 대한 중대 공시 정보 결정 방법",
            "Para 59: How material information to disclose was determined for assessed IROs",
            "평가한 영향, 위험 및 기회에 대해 공개할 중대한 정보를 어떻게 결정했는지 설명합니다. 기준치 사용 및/또는 ESRS 1 섹션 3.2(중대한 사항 및 정보의 중대성) 기준 적용 방식을 포함합니다.",
            "ESRS2-MDR",
            subtopic="MDR",
            val=[
                "기준치·ESRS 1 섹션 3.2 기준 적용이 서술·중대성 논리와 대응하는지 확인",
            ],
        ),
        leaf(
            "ESRS2-MDR-60",
            "ESRS_2_MDR_60_MDR_SCOPE",
            "문단 60: 중대 지속가능성 사안 관리를 위한 정책·조치 최소 공시 총괄",
            "Para 60: MDR scope — policies and actions for management of material sustainability matters",
            "실제·잠재 중대 영향의 예방·완화·시정, 중대 위험 대응, 중대 기회 추구(중대 지속가능성 사안 관리)를 위한 정책 및 조치 정보 공시 시 본 절의 최소 공시 요건을 적용합니다. 주제별·부문별 ESRS 및 기업별 공시 작성 시에도 적용됩니다.",
            "ESRS2-MDR",
            subtopic="MDR",
            val=["MDR가 적용되는 공시 블록(정책·조치)이 식별되는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-61",
            "ESRS_2_MDR_61_PLACEMENT_CROSS_REF",
            "문단 61: 관련 ESRS와의 배치 및 상호 참조",
            "Para 61: Placement alongside topical ESRS and cross-referencing",
            "공시는 관련 ESRS에서 규정하는 내용과 함께 배치합니다. 단일 정책 또는 동일 조치가 여러 상호 연관 지속가능성 사안을 다루는 경우, 한 주제별 ESRS 보고에서 정보를 공개하고 다른 주제 보고에서 상호 참조할 수 있습니다.",
            "ESRS2-MDR",
            subtopic="MDR",
            val=[
                "면제·배치·상호 참조가 독자가 원문을 추적할 수 있게 되어 있는지 확인",
            ],
        ),
        leaf(
            "ESRS2-MDR-62",
            "ESRS_2_MDR_62_NON_ADOPTION",
            "문단 62: 정책·조치 미채택 시 사실·사유·(선택) 일정",
            "Para 62: Non-adoption of policy/action — fact, reasons, optional timetable",
            "해당 지속가능성 문제에 정책 및/또는 조치를 채택하지 않아 관련 ESRS 정보를 공개할 수 없는 경우, 그 사실과 미채택 사유를 공개합니다. 채택 예정 일정을 공개할 수 있습니다.",
            "ESRS2-MDR",
            dr="조건부",
            subtopic="MDR",
            val=[
                "미채택 시 사실·사유 명시 여부 확인",
                "제시된 향후 일정(있는 경우)이 모순 없이 해석 가능한지 확인",
            ],
        ),
        parent_dp(
            "ESRS2-MDR-P",
            "ESRS_2_MDR_P_ROOT",
            "최소 공시 요건 MDR-P: 중대 지속가능성 사안 관리를 위한 정책",
            "MDR-P – Policies for management of material sustainability matters",
            "문단 63(적용)·64(목적)·65(a)~(f)를 하위 DP로 둡니다.",
            "ESRS2-MDR",
            mdrp_children,
            "MDR-P",
        ),
        leaf(
            "ESRS2-MDR-P-63",
            "ESRS_2_MDR_P_63_APPLY_MDR_P",
            "MDR-P 문단 63: 중대 주제별 정책 공시에 MDR-P 적용",
            "MDR-P para 63: Apply MDR-P when disclosing policies per material topic",
            "중요하다고 식별된 각 지속가능성 사안에 대해 수립한 정책을 공개할 때 본 조항의 최소 공시 요건을 적용해야 합니다.",
            "ESRS2-MDR-P",
            subtopic="MDR-P",
            val=["정책 공시 블록에 MDR-P 요건(문단 65)이 반영되는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-P-64",
            "ESRS_2_MDR_P_64_OBJECTIVE",
            "MDR-P 문단 64: 공시 목적",
            "MDR-P para 64: Objective",
            "영향 예방·완화·구제, 위험 해결, 기회 추구를 위한 정책에 대한 이해를 제공하는 것이 목적입니다.",
            "ESRS2-MDR-P",
            subtopic="MDR-P",
            val=["정책이 IRO·관리 목적과 연결되어 서술되는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-P-65-a",
            "ESRS_2_MDR_P_65_A_KEY_CONTENTS",
            "MDR-P 문단 65-(a): 정책 주요 내용(목표·IRO·모니터링)",
            "MDR-P para 65 (a): Key contents — objectives, material IRO, monitoring",
            "정책의 주요 내용(일반적 목표, 관련 중대 영향·위험·기회, 모니터링 절차)을 설명합니다.",
            "ESRS2-MDR-P",
            subtopic="MDR-P",
            val=["목표·관련 중대 IRO·모니터링이 명시되는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-P-65-b",
            "ESRS_2_MDR_P_65_B_SCOPE_EXCLUSIONS",
            "MDR-P 문단 65-(b): 적용 범위·제외(활동·가치사슬·지역·이해관계자)",
            "MDR-P para 65 (b): Scope and exclusions",
            "활동, 상·하류 가치 사슬, 지역 및 해당 시 영향받는 이해관계자 집단을 기준으로 적용 범위 또는 제외 사항을 설명합니다.",
            "ESRS2-MDR-P",
            subtopic="MDR-P",
            val=["범위·제외가 가치사슬·지역·이해관계자와 대응하는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-P-65-c",
            "ESRS_2_MDR_P_65_C_ACCOUNTABLE_SENIORITY",
            "MDR-P 문단 65-(c): 정책 이행 책임 최고위 수준",
            "MDR-P para 65 (c): Senior level accountable for implementation",
            "정책 이행 책임을 지는 조직 내 최고 책임자 수준을 공개합니다.",
            "ESRS2-MDR-P",
            subtopic="MDR-P",
            val=["책임 계급·역할이 식별 가능한지 확인"],
        ),
        leaf(
            "ESRS2-MDR-P-65-d",
            "ESRS_2_MDR_P_65_D_THIRD_PARTY_STANDARDS",
            "MDR-P 문단 65-(d): 제3자 기준·이니셔티브 참조(해당 시)",
            "MDR-P para 65 (d): Third-party standards or initiatives (if applicable)",
            "해당되는 경우 정책 시행을 통해 준수하기로 약속한 제3자 기준 또는 이니셔티브를 참조합니다.",
            "ESRS2-MDR-P",
            dr="조건부",
            subtopic="MDR-P",
            val=["약속한 외부 기준·이니셔티브가 명시되거나 해당 없음이 합리적으로 설명되는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-P-65-e",
            "ESRS_2_MDR_P_65_E_STAKEHOLDER_INTERESTS",
            "MDR-P 문단 65-(e): 정책 수립 시 이해관계자 이익 고려(해당 시)",
            "MDR-P para 65 (e): Stakeholder interests in policy setting (if applicable)",
            "해당되는 경우 정책 수립 시 주요 이해관계자의 이익을 고려한 사항을 설명합니다.",
            "ESRS2-MDR-P",
            dr="조건부",
            subtopic="MDR-P",
            val=["이해관계자 고려사항이 있으면 서술되는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-P-65-f",
            "ESRS_2_MDR_P_65_F_STAKEHOLDER_DISCLOSURE_OF_POLICY",
            "MDR-P 문단 65-(f): 이해관계자에 대한 정책 공개 여부·방법(해당 시)",
            "MDR-P para 65 (f): Whether/how policy is available to stakeholders (if applicable)",
            "해당되는 경우 잠재적 영향받는 이해관계자 및 이행 협조가 필요한 이해관계자에게 정책을 공개하는지 여부와 방법을 설명합니다.",
            "ESRS2-MDR-P",
            dr="조건부",
            subtopic="MDR-P",
            val=["정책의 외부 공개·소통 방식이 명시되는지 확인"],
        ),
        parent_dp(
            "ESRS2-MDR-A",
            "ESRS_2_MDR_A_ROOT",
            "최소 공시 요건 MDR-A: 조치 및 자원",
            "MDR-A – Actions and resources",
            "문단 66(적용)·67(목적)·68(a)~(e)·69(a)~(c)를 하위 DP로 둡니다. 유의적 OpEx·CapEx가 필요할 때 69 적용.",
            "ESRS2-MDR",
            mdra_children,
            "MDR-A",
        ),
        leaf(
            "ESRS2-MDR-A-66",
            "ESRS_2_MDR_A_66_APPLY_MDR_A",
            "MDR-A 문단 66: 조치·계획·자원 공시에 MDR-A 적용",
            "MDR-A para 66: Apply when describing actions, plans and resources",
            "각 중대 지속가능성 사안을 관리하기 위해 취한 또는 계획한 조치(행동 계획 및 배정/계획 자원 포함)를 설명할 때 본 최소 공시 요건을 적용합니다.",
            "ESRS2-MDR-A",
            subtopic="MDR-A",
            val=["조치·자원 서술에 MDR-A 하위 항목이 반영되는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-A-67",
            "ESRS_2_MDR_A_67_OBJECTIVE",
            "MDR-A 문단 67: 공시 목적",
            "MDR-A para 67: Objective",
            "실제·잠재 영향의 예방·완화·시정, 위험 및 기회 대응, 정책 목표 달성을 위해 취하거나 계획한 주요 조치에 대한 이해를 제공합니다.",
            "ESRS2-MDR-A",
            subtopic="MDR-A",
            val=["조치가 정책·IRO·목표와 연결되어 설명되는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-A-68-a",
            "ESRS_2_MDR_A_68_A_KEY_ACTIONS_OUTCOMES",
            "MDR-A 문단 68-(a): 주요 조치 목록·예상 성과·정책 기여",
            "MDR-A para 68 (a): Key actions, expected outcomes, contribution to policy",
            "보고연도 내 취한 주요 조치와 향후 계획 조치, 예상 성과 및 정책 목표에의 기여를 공개합니다.",
            "ESRS2-MDR-A",
            subtopic="MDR-A",
            val=["조치·기대효과·정책 연계가 식별되는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-A-68-b",
            "ESRS_2_MDR_A_68_B_SCOPE_ACTIONS",
            "MDR-A 문단 68-(b): 조치의 범위",
            "MDR-A para 68 (b): Scope of actions",
            "활동, 상·하류 가치 사슬, 지역 범위 및 영향받는 이해관계자 집단을 기준으로 조치 범위를 설명합니다.",
            "ESRS2-MDR-A",
            subtopic="MDR-A",
            val=["조치 범위가 가치사슬·지역·이해관계자와 대응하는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-A-68-c",
            "ESRS_2_MDR_A_68_C_TIMEFRAMES",
            "MDR-A 문단 68-(c): 주요 조치 완료 시기",
            "MDR-A para 68 (c): Timeframe for completing key actions",
            "각 주요 조치 완료 시기(기간)를 공개합니다.",
            "ESRS2-MDR-A",
            subtopic="MDR-A",
            val=["시기표·마일스톤이 추적 가능한지 확인"],
        ),
        leaf(
            "ESRS2-MDR-A-68-d",
            "ESRS_2_MDR_A_68_D_REMEDIATION",
            "MDR-A 문단 68-(d): 구제를 위한 조치·협력(해당 시)",
            "MDR-A para 68 (d): Remediation cooperation (if applicable)",
            "해당되는 경우 중대 영향으로 피해를 입은 자에 대한 구제 제공 또는 협력을 위한 주요 조치를 공개합니다.",
            "ESRS2-MDR-A",
            dr="조건부",
            subtopic="MDR-A",
            val=["구제·협력 조치가 명시되거나 해당 없음이 합리적으로 설명되는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-A-68-e",
            "ESRS_2_MDR_A_68_E_PROGRESS_PRIOR",
            "MDR-A 문단 68-(e): 전기 공시 조치·계획 진행(해당 시)",
            "MDR-A para 68 (e): Progress on prior-period actions (if applicable)",
            "해당되는 경우 전기에 공시한 조치나 계획의 진행에 대한 정성·정량 정보를 공개합니다.",
            "ESRS2-MDR-A",
            dr="조건부",
            subtopic="MDR-A",
            val=["전기 대비 진행 상황이 명시되는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-A-69-a",
            "ESRS_2_MDR_A_69_A_RESOURCE_TYPES_FINANCE",
            "MDR-A 문단 69-(a): 재무·기타 자원 유형·선행조건(유의적 OpEx/CapEx 시)",
            "MDR-A para 69 (a): Types of resources and preconditions (significant Opex/Capex)",
            "행동 계획 이행에 유의적인 운영비·자본지출이 필요한 경우, 배정·계획된 재무 및 기타 자원의 유형을 설명합니다. 지속가능금융 수단 조건, 재정지원·공공정책·시장 동향 등 이행 선행조건 포함 여부를 설명합니다.",
            "ESRS2-MDR-A",
            dr="조건부",
            subtopic="MDR-A",
            val=["자원 유형·지속가능금융 조건·선행조건이 서술되는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-A-69-b",
            "ESRS_2_MDR_A_69_B_CURRENT_FINANCIAL_AMOUNT",
            "MDR-A 문단 69-(b): 당기 재무자원 금액 및 재무제표 연계",
            "MDR-A para 69 (b): Current financial resources and link to financial statements",
            "현재 재무자원의 금액을 표시하고 재무제표상 가장 관련 있는 금액과 어떻게 연계되는지 설명합니다.",
            "ESRS2-MDR-A",
            dr="조건부",
            subtopic="MDR-A",
            val=["금액 제시 및 재무제표 대응 설명이 있는지 확인"],
        ),
        leaf(
            "ESRS2-MDR-A-69-c",
            "ESRS_2_MDR_A_69_C_FUTURE_FINANCIAL_AMOUNT",
            "MDR-A 문단 69-(c): 미래 재무자원 금액",
            "MDR-A para 69 (c): Amount of future financial resources",
            "미래 재무자원의 금액을 제공합니다.",
            "ESRS2-MDR-A",
            dr="조건부",
            subtopic="MDR-A",
            val=["미래 재무자원 규모가 제시되거나 산출 근거가 설명되는지 확인"],
        ),
    ]

    # Insert after last IRO-1 leaf
    insert_at = find_idx = next(
        i
        for i, d in enumerate(dps)
        if d["dp_id"] == "ESRS2-IRO-1-53-h"
    )
    insert_at += 1
    for i, block in enumerate(new_dps):
        dps.insert(insert_at + i, block)

    # Patch ESRS2-SEC-5
    for d in dps:
        if d["dp_id"] == "ESRS2-SEC-5":
            d["child_dps"] = [
                "ESRS2-IRO-1",
                "ESRS2-IRO-2",
                "ESRS2-MDR",
            ]
            d["description"] = (
                "중대성 평가·공시 색인·정책·조치 최소 공시 등 IRO 관련 일반 공시 절입니다. "
                "본 시드는 IRO-1(문단 50~53), IRO-2(문단 54~58), 문단 59 및 4.2 MDR-P·MDR-A(문단 60~69)를 포함합니다."
            )
            d["validation_rules"] = [
                "IRO-1·IRO-2·MDR 하위 항목이 토피컬 ESRS·성명서 구조와 정합하는지 확인",
            ]
            break

    # Patch ESRS2 root
    for d in dps:
        if d["dp_id"] == "ESRS2":
            desc = d["description"]
            if "IRO-2" not in desc:
                d["description"] = (
                    desc.replace(
                        "제4장 IRO-1(문단 50~53)을 포함합니다.",
                        "제4장 IRO-1(문단 50~53), IRO-2(문단 54~58), 문단 59~69(MDR-P·MDR-A)를 포함합니다.",
                    )
                )
            d["validation_rules"] = [
                "ESRS 2 일반 공시 범위에서 BP-1·BP-2·GOV-1~5(문단 37)·SEC-4(SBM-1~3)·SEC-5(IRO-1·IRO-2·MDR)·조건부 공시 충족 여부 점검",
            ]
            break

    dp_path.write_text(json.dumps(doc, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")

    # Rulebooks
    rb_doc = json.loads(rb_path.read_text(encoding="utf-8"))
    rbs = rb_doc["rulebooks"]
    if any(r.get("rulebook_id") == "RULE_ESRS2_IRO_2" for r in rbs):
        print("rulebook IRO-2 already present; datapoint-only updated?")
        return

    new_rbs = [
        mk_rulebook(
            "RULE_ESRS2_IRO_2",
            "ESRS2-IRO-2",
            "IRO-2 총괄(문단 54~58)",
            "ESRS 2 – IRO-2 paras 54–58",
            "ESRS2_IRO2_ROOT",
            key_terms=["IRO-2", "disclosure requirement index", "Appendix B"],
            cross_refs=["ESRS 1 Ch.3", "ESRS2-IRO-1"],
            action="disclose_esrs2_iro2_root",
        ),
        mk_rulebook(
            "RULE_ESRS2_IRO_2_54",
            "ESRS2-IRO-2-54",
            "IRO-2 문단 54",
            "ESRS 2 – IRO-2 para 54",
            "ESRS2_IRO2_54",
            action="disclose_esrs2_iro2_54",
        ),
        mk_rulebook(
            "RULE_ESRS2_IRO_2_55",
            "ESRS2-IRO-2-55",
            "IRO-2 문단 55",
            "ESRS 2 – IRO-2 para 55",
            "ESRS2_IRO2_55",
            action="disclose_esrs2_iro2_55",
        ),
        mk_rulebook(
            "RULE_ESRS2_IRO_2_56",
            "ESRS2-IRO-2-56",
            "IRO-2 문단 56 목록·위치·부속서 B",
            "ESRS 2 – IRO-2 para 56",
            "ESRS2_IRO2_56",
            key_terms=["content index", "Appendix B", "EU law"],
            action="disclose_esrs2_iro2_56",
        ),
        mk_rulebook(
            "RULE_ESRS2_IRO_2_57",
            "ESRS2-IRO-2-57",
            "IRO-2 문단 57 E1 생략",
            "ESRS 2 – IRO-2 para 57",
            "ESRS2_IRO2_57",
            key_terms=["ESRS E1", "climate"],
            action="disclose_esrs2_iro2_57",
        ),
        mk_rulebook(
            "RULE_ESRS2_IRO_2_58",
            "ESRS2-IRO-2-58",
            "IRO-2 문단 58 기타 비중대",
            "ESRS 2 – IRO-2 para 58",
            "ESRS2_IRO2_58",
            action="disclose_esrs2_iro2_58",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR",
            "ESRS2-MDR",
            "MDR 총괄(문단 59~69)",
            "ESRS 2 – Section 4.2 MDR paras 59–69",
            "ESRS2_MDR_ROOT",
            key_terms=["MDR-P", "MDR-A", "policies", "actions"],
            action="disclose_esrs2_mdr_root",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_59",
            "ESRS2-MDR-59",
            "MDR 문단 59",
            "ESRS 2 – para 59 material information determination",
            "ESRS2_MDR_59",
            key_terms=["ESRS 1 Sec 3.2", "thresholds"],
            action="disclose_esrs2_mdr_59",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_60",
            "ESRS2-MDR-60",
            "MDR 문단 60",
            "ESRS 2 – para 60 MDR scope",
            "ESRS2_MDR_60",
            action="disclose_esrs2_mdr_60",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_61",
            "ESRS2-MDR-61",
            "MDR 문단 61",
            "ESRS 2 – para 61 placement cross-reference",
            "ESRS2_MDR_61",
            action="disclose_esrs2_mdr_61",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_62",
            "ESRS2-MDR-62",
            "MDR 문단 62",
            "ESRS 2 – para 62 non-adoption",
            "ESRS2_MDR_62",
            action="disclose_esrs2_mdr_62",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_P",
            "ESRS2-MDR-P",
            "MDR-P 총괄(문단 63~65)",
            "ESRS 2 – MDR-P paras 63–65",
            "ESRS2_MDR_P_ROOT",
            action="disclose_esrs2_mdr_p_root",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_P_63",
            "ESRS2-MDR-P-63",
            "MDR-P 문단 63",
            "ESRS 2 – MDR-P para 63",
            "ESRS2_MDR_P_63",
            action="disclose_esrs2_mdr_p_63",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_P_64",
            "ESRS2-MDR-P-64",
            "MDR-P 문단 64",
            "ESRS 2 – MDR-P para 64",
            "ESRS2_MDR_P_64",
            action="disclose_esrs2_mdr_p_64",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_P_65_A",
            "ESRS2-MDR-P-65-a",
            "MDR-P 65(a)",
            "ESRS 2 – MDR-P para 65(a)",
            "ESRS2_MDR_P_65A",
            action="disclose_esrs2_mdr_p_65a",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_P_65_B",
            "ESRS2-MDR-P-65-b",
            "MDR-P 65(b)",
            "ESRS 2 – MDR-P para 65(b)",
            "ESRS2_MDR_P_65B",
            action="disclose_esrs2_mdr_p_65b",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_P_65_C",
            "ESRS2-MDR-P-65-c",
            "MDR-P 65(c)",
            "ESRS 2 – MDR-P para 65(c)",
            "ESRS2_MDR_P_65C",
            action="disclose_esrs2_mdr_p_65c",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_P_65_D",
            "ESRS2-MDR-P-65-d",
            "MDR-P 65(d)",
            "ESRS 2 – MDR-P para 65(d)",
            "ESRS2_MDR_P_65D",
            action="disclose_esrs2_mdr_p_65d",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_P_65_E",
            "ESRS2-MDR-P-65-e",
            "MDR-P 65(e)",
            "ESRS 2 – MDR-P para 65(e)",
            "ESRS2_MDR_P_65E",
            action="disclose_esrs2_mdr_p_65e",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_P_65_F",
            "ESRS2-MDR-P-65-f",
            "MDR-P 65(f)",
            "ESRS 2 – MDR-P para 65(f)",
            "ESRS2_MDR_P_65F",
            action="disclose_esrs2_mdr_p_65f",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_A",
            "ESRS2-MDR-A",
            "MDR-A 총괄(문단 66~69)",
            "ESRS 2 – MDR-A paras 66–69",
            "ESRS2_MDR_A_ROOT",
            action="disclose_esrs2_mdr_a_root",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_A_66",
            "ESRS2-MDR-A-66",
            "MDR-A 문단 66",
            "ESRS 2 – MDR-A para 66",
            "ESRS2_MDR_A_66",
            action="disclose_esrs2_mdr_a_66",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_A_67",
            "ESRS2-MDR-A-67",
            "MDR-A 문단 67",
            "ESRS 2 – MDR-A para 67",
            "ESRS2_MDR_A_67",
            action="disclose_esrs2_mdr_a_67",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_A_68_A",
            "ESRS2-MDR-A-68-a",
            "MDR-A 68(a)",
            "ESRS 2 – MDR-A para 68(a)",
            "ESRS2_MDR_A_68A",
            action="disclose_esrs2_mdr_a_68a",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_A_68_B",
            "ESRS2-MDR-A-68-b",
            "MDR-A 68(b)",
            "ESRS 2 – MDR-A para 68(b)",
            "ESRS2_MDR_A_68B",
            action="disclose_esrs2_mdr_a_68b",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_A_68_C",
            "ESRS2-MDR-A-68-c",
            "MDR-A 68(c)",
            "ESRS 2 – MDR-A para 68(c)",
            "ESRS2_MDR_A_68C",
            action="disclose_esrs2_mdr_a_68c",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_A_68_D",
            "ESRS2-MDR-A-68-d",
            "MDR-A 68(d)",
            "ESRS 2 – MDR-A para 68(d)",
            "ESRS2_MDR_A_68D",
            action="disclose_esrs2_mdr_a_68d",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_A_68_E",
            "ESRS2-MDR-A-68-e",
            "MDR-A 68(e)",
            "ESRS 2 – MDR-A para 68(e)",
            "ESRS2_MDR_A_68E",
            action="disclose_esrs2_mdr_a_68e",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_A_69_A",
            "ESRS2-MDR-A-69-a",
            "MDR-A 69(a)",
            "ESRS 2 – MDR-A para 69(a)",
            "ESRS2_MDR_A_69A",
            action="disclose_esrs2_mdr_a_69a",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_A_69_B",
            "ESRS2-MDR-A-69-b",
            "MDR-A 69(b)",
            "ESRS 2 – MDR-A para 69(b)",
            "ESRS2_MDR_A_69B",
            action="disclose_esrs2_mdr_a_69b",
        ),
        mk_rulebook(
            "RULE_ESRS2_MDR_A_69_C",
            "ESRS2-MDR-A-69-c",
            "MDR-A 69(c)",
            "ESRS 2 – MDR-A para 69(c)",
            "ESRS2_MDR_A_69C",
            action="disclose_esrs2_mdr_a_69c",
        ),
    ]

    # Extend IRO-2 root rulebook related_dp_ids
    new_rbs[0]["related_dp_ids"] = [
        "ESRS2-IRO-2",
        *iro2_children,
    ]
    new_rbs[6]["related_dp_ids"] = ["ESRS2-MDR", *mdr_children]
    new_rbs[13]["related_dp_ids"] = ["ESRS2-MDR-P", *mdrp_children]
    new_rbs[22]["related_dp_ids"] = ["ESRS2-MDR-A", *mdra_children]

    insert_rb_idx = next(
        i for i, r in enumerate(rbs) if r.get("rulebook_id") == "RULE_ESRS2_IRO_1"
    )
    for i, rb in enumerate(new_rbs):
        rbs.insert(insert_rb_idx + 1 + i, rb)

    # RULE_ESRS2 top-level related_dp_ids — append new ids
    new_ids = [d["dp_id"] for d in new_dps]
    for r in rbs:
        if r.get("rulebook_id") == "RULE_ESRS2":
            rel = list(r.get("related_dp_ids") or [])
            for x in new_ids:
                if x not in rel:
                    rel.append(x)
            r["related_dp_ids"] = rel
            break

    # RULE_ESRS2_SEC_5
    for r in rbs:
        if r.get("rulebook_id") == "RULE_ESRS2_SEC_5":
            r["validation_rules"]["cross_references"] = [
                "ESRS2-IRO-1",
                "ESRS2-IRO-2",
                "ESRS2-MDR",
            ]
            r["related_dp_ids"] = [
                "ESRS2-SEC-5",
                "ESRS2-IRO-1",
                "ESRS2-IRO-2",
                "ESRS2-MDR",
            ]
            r["section_content"] = (
                "ESRS 2 – Section 4: IRO management (IRO-1, IRO-2, MDR paras 59–69)."
            )
            break

    rb_path.write_text(json.dumps(rb_doc, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")
    print("done datapoints +", len(new_dps), "rulebooks +", len(new_rbs))


if __name__ == "__main__":
    main()
