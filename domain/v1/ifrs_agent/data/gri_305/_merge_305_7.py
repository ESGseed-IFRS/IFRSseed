"""Append GRI 305-7 (NOx, SOx, other significant air emissions). Run once."""
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
        "topic": kw.get("topic", "배출"),
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


def act(name, desc, mandatory=True):
    d = {"action": name, "description": desc}
    if not mandatory:
        d["mandatory"] = False
    return [d]


def chk(cid, desc, exp="ok"):
    return [{"check_id": cid, "description": desc, "expected": exp}]


A_LEAVES = [
    ("i", "I", "NOx", "GRI_305_DIS_7_A_I_NOX"),
    ("ii", "II", "SOx", "GRI_305_DIS_7_A_II_SOX"),
    ("iii", "III", "POP", "GRI_305_DIS_7_A_III_POP"),
    ("iv", "IV", "VOC", "GRI_305_DIS_7_A_IV_VOC"),
    ("v", "V", "HAP", "GRI_305_DIS_7_A_V_HAP"),
    ("vi", "VI", "PM", "GRI_305_DIS_7_A_VI_PM"),
    ("vii", "VII", "기타 규정 범주", "GRI_305_DIS_7_A_VII_OTHER"),
]


def main() -> None:
    data = json.loads(dp_path.read_text(encoding="utf-8"))
    pts = data["data_points"]
    if any(p["dp_id"] == "GRI305-7" for p in pts):
        raise SystemExit("already present: GRI305-7")

    find_dp(pts, "GRI305").update(
        {
            "description": (
                "GRI 305는 조직의 온실가스·대기 배출 등 배출 관련 영향에 대한 공시를 다룹니다. "
                "본 시드는 섹션 1(주제별 관리), 공개 305-1~305-7(Scope 1·2·3, 집약도, 감축, ODS, 대기 배출물)을 포함합니다."
            ),
            "validation_rules": [
                "시드 범위: 주제별 관리·공개 305-1·305-2·305-3·305-4·305-5·305-6·305-7",
            ],
        }
    )

    sec2 = find_dp(pts, "GRI305-SEC-2")
    sec2["name_ko"] = "섹션 2: 주제별 공시(시드: 305-1~305-7)"
    sec2["name_en"] = "Section 2: Topic-related disclosures (seed: 305-1 to 305-7)"
    sec2["description"] = (
        "배출과 관련된 주제별 정량·정성 공시 항목을 포함합니다. 본 시드에는 공개 305-1~305-7을 포함합니다."
    )
    sec2["child_dps"] = [
        "GRI305-1",
        "GRI305-2",
        "GRI305-3",
        "GRI305-4",
        "GRI305-5",
        "GRI305-6",
        "GRI305-7",
    ]
    sec2["validation_rules"] = ["공개 305-1~305-7 요건 충족(시드 범위)"]

    a_children = [f"GRI305-7-a-{suf}" for suf, _, _, _ in A_LEAVES]

    new_pts: list[dict] = [
        DP(
            dp_id="GRI305-7",
            dp_code="GRI_305_DIS_7_AIR_EMISSIONS",
            name_ko="공개 305-7: NOx·SOx 및 기타 주요 대기 배출물",
            name_en="Disclosure 305-7: NOx, SOx, and other significant air emissions",
            description=(
                "상당한(significant) 대기 배출물(NOx, SOx, POP, VOC, HAP, PM, 규정상 기타 범주)을 kg(또는 그 배수)로 보고하고, "
                "배출계수 출처와 방법론을 제시합니다. 정보 수집 2.13은 GRI305-7-13, 권고 2.14는 GRI305-7-14 트리입니다."
            ),
            subtopic="대기 배출물",
            dp_type="narrative",
            parent_indicator="GRI305-SEC-2",
            child_dps=[
                "GRI305-7-a",
                "GRI305-7-b",
                "GRI305-7-c",
                "GRI305-7-13",
                "GRI305-7-14",
            ],
            disclosure_requirement="필수",
            validation_rules=[
                "하위 a~c 및 GRI305-7-13·GRI305-7-14",
                "지침: RULE_GRI305_7_G_GUIDANCE",
            ],
        ),
        DP(
            dp_id="GRI305-7-a",
            dp_code="GRI_305_DIS_7_A_SIGNIFICANT_AIR",
            name_ko="공개 305-7-a: 상당한 대기 배출량(항목별)",
            name_en="Disclosure 305-7-a: Significant air emissions by pollutant",
            description="다음 각 항목에 대한 상당한 대기 배출량을 킬로그램 또는 그 배수로 보고합니다(하위 i~vii).",
            subtopic="대기 배출물·총괄",
            dp_type="narrative",
            parent_indicator="GRI305-7",
            child_dps=a_children,
            disclosure_requirement="필수",
            validation_rules=["하위 GRI305-7-a-i~a-vii와 GRI305-7-13 산정 접근 정합"],
        ),
    ]

    ko_names = {
        "i": "NOx",
        "ii": "SOx",
        "iii": "잔류성 유기 오염물질(POP)",
        "iv": "휘발성 유기 화합물(VOC)",
        "v": "유해 대기 오염물질(HAP)",
        "vi": "미세먼지(PM)",
        "vii": "관련 규정의 기타 표준 대기 배출 범주",
    }
    en_names = {
        "i": "Nitrogen oxides (NOx)",
        "ii": "Sulfur oxides (SOx)",
        "iii": "Persistent organic pollutants (POP)",
        "iv": "Volatile organic compounds (VOC)",
        "v": "Hazardous air pollutants (HAP)",
        "vi": "Particulate matter (PM)",
        "vii": "Other standard air emission categories in applicable regulations",
    }

    for suf, _rom, _short, code in A_LEAVES:
        new_pts.append(
            DP(
                dp_id=f"GRI305-7-a-{suf}",
                dp_code=code,
                name_ko=f"공개 305-7-a-{suf}: {ko_names[suf]}",
                name_en=f"Disclosure 305-7-a-{suf}: {en_names[suf]}",
                description=f"305-7-a 하위 {suf}: 상당한 대기 배출량을 kg 또는 동등 단위로 보고합니다.",
                subtopic="대기 배출물",
                dp_type="quantitative",
                unit="kg",
                parent_indicator="GRI305-7-a",
                disclosure_requirement="필수",
                validation_rules=[
                    "단위: kg 또는 배수 명시",
                    "해당 없음·미유의 시 근거 또는 0·제외 설명",
                ],
            )
        )

    new_pts.extend(
        [
            DP(
                dp_id="GRI305-7-b",
                dp_code="GRI_305_DIS_7_B_EF_SOURCE",
                name_ko="공개 305-7-b: 배출계수 출처",
                name_en="Disclosure 305-7-b: Source of emission factors",
                description="사용한 배출계수의 출처를 보고합니다.",
                subtopic="대기 배출·계수",
                dp_type="narrative",
                parent_indicator="GRI305-7",
                disclosure_requirement="필수",
                validation_rules=["계수 출처 식별 가능"],
            ),
            DP(
                dp_id="GRI305-7-c",
                dp_code="GRI_305_DIS_7_C_METHODS",
                name_ko="공개 305-7-c: 표준·방법론·가정·산정 도구",
                name_en="Disclosure 305-7-c: Standards, methodologies, assumptions, tools",
                description="사용한 기준, 방법론, 가정 및/또는 계산 도구를 보고합니다.",
                subtopic="대기 배출·방법론",
                dp_type="narrative",
                parent_indicator="GRI305-7",
                disclosure_requirement="필수",
                validation_rules=["산정 접근이 GRI305-7-13 선택과 정합"],
            ),
            DP(
                dp_id="GRI305-7-13",
                dp_code="GRI_305_DIS_7_COMP_2_13",
                name_ko="정보 수집 요건 2.13: 상당한 대기 배출 산정 접근",
                name_en="Compilation 2.13 for Disclosure 305-7 (shall)",
                description="공개 305-7 정보를 집계할 때 상당한 대기 배출량 산정에 사용할 접근(절 2.13)을 하나 선택·적용합니다.",
                subtopic="305-7 정보수집 2.13",
                dp_type="narrative",
                parent_indicator="GRI305-7",
                child_dps=[f"GRI305-7-13-{i}" for i in range(1, 5)],
                disclosure_requirement="필수",
                validation_rules=["2.13.1~2.13.4 중 채택 접근과 공시 수치 정합"],
            ),
            DP(
                dp_id="GRI305-7-13-1",
                dp_code="GRI_305_DIS_7_COMP_2_13_1",
                name_ko="정보 수집 2.13.1: 직접 측정",
                name_en="Compilation 2.13.1: Direct measurement",
                description="배출량 직접 측정(예: 온라인 분석기)을 사용할 수 있습니다.",
                subtopic="305-7 2.13.1",
                dp_type="narrative",
                parent_indicator="GRI305-7-13",
                disclosure_requirement="필수",
                validation_rules=["직접측정 사용 시 방법·경계 명시"],
            ),
            DP(
                dp_id="GRI305-7-13-2",
                dp_code="GRI_305_DIS_7_COMP_2_13_2",
                name_ko="정보 수집 2.13.2: 현장별 데이터 기반 계산",
                name_en="Compilation 2.13.2: Site-specific calculation",
                description="현장별 데이터에 기반한 계산을 사용할 수 있습니다.",
                subtopic="305-7 2.13.2",
                dp_type="narrative",
                parent_indicator="GRI305-7-13",
                disclosure_requirement="필수",
                validation_rules=["현장 데이터·투입 산식 개요"],
            ),
            DP(
                dp_id="GRI305-7-13-3",
                dp_code="GRI_305_DIS_7_COMP_2_13_3",
                name_ko="정보 수집 2.13.3: 공개 배출계수 기반 계산",
                name_en="Compilation 2.13.3: Calculation from published emission factors",
                description="공개된 배출계수에 기반한 계산을 사용할 수 있습니다.",
                subtopic="305-7 2.13.3",
                dp_type="narrative",
                parent_indicator="GRI305-7-13",
                disclosure_requirement="필수",
                validation_rules=["GRI305-7-b와 계수 출처 정합"],
            ),
            DP(
                dp_id="GRI305-7-13-4",
                dp_code="GRI_305_DIS_7_COMP_2_13_4",
                name_ko="정보 수집 2.13.4: 추정",
                name_en="Compilation 2.13.4: Estimation",
                description="기본 수치가 부족하여 추정을 사용하는 경우, 추정치의 근거를 명시해야 합니다.",
                subtopic="305-7 2.13.4",
                dp_type="narrative",
                parent_indicator="GRI305-7-13",
                disclosure_requirement="필수",
                validation_rules=["추정 사용 시 불확실성·근거·가정 공시"],
            ),
            DP(
                dp_id="GRI305-7-14",
                dp_code="GRI_305_DIS_7_REC_2_14",
                name_ko="권고 2.14: 공개 305-7 작성",
                name_en="Recommendation 2.14 for Disclosure 305-7 (should)",
                description="공개 305-7 정보 작성 시 권고 사항(절 2.14)입니다.",
                subtopic="305-7 권고 2.14",
                dp_type="narrative",
                parent_indicator="GRI305-7",
                child_dps=["GRI305-7-14-1", "GRI305-7-14-2"],
                disclosure_requirement="권고",
                validation_rules=["2.14.1·2.14.2 트리 검토"],
            ),
            DP(
                dp_id="GRI305-7-14-1",
                dp_code="GRI_305_DIS_7_REC_2_14_1",
                name_ko="권고 2.14.1: 상이한 기준·방법론 시 설명",
                name_en="Recommendation 2.14.1: Explain mixed standards",
                description="서로 다른 기준·방법론이 적용되면 선택한 접근을 기술할 것을 권고합니다.",
                subtopic="305-7 권고",
                dp_type="narrative",
                parent_indicator="GRI305-7-14",
                disclosure_requirement="권고",
                validation_rules=["혼용 시 근거"],
            ),
            DP(
                dp_id="GRI305-7-14-2",
                dp_code="GRI_305_DIS_7_REC_2_14_2",
                name_ko="권고 2.14.2: 대기 배출 세분화",
                name_en="Recommendation 2.14.2: Disaggregate air emissions",
                description="투명성·비교 가능성 향상을 위해 대기 배출 데이터를 세분화하여 제공할 것을 권고합니다.",
                subtopic="305-7 권고",
                dp_type="narrative",
                parent_indicator="GRI305-7-14",
                child_dps=[f"GRI305-7-14-2-{j}" for j in range(1, 5)],
                disclosure_requirement="권고",
                validation_rules=["하위 2.14.2.1~2.14.2.4 반영"],
            ),
            DP(
                dp_id="GRI305-7-14-2-1",
                dp_code="GRI_305_DIS_7_REC_2_14_2_1",
                name_ko="권고 2.14.2.1: 사업부 또는 시설",
                name_en="Recommendation 2.14.2.1: Business unit or facility",
                description="대기 배출 세분화 권고: 사업부 또는 시설별.",
                subtopic="대기 배출 세분화",
                dp_type="narrative",
                parent_indicator="GRI305-7-14-2",
                disclosure_requirement="권고",
                validation_rules=["세분화 정합"],
            ),
            DP(
                dp_id="GRI305-7-14-2-2",
                dp_code="GRI_305_DIS_7_REC_2_14_2_2",
                name_ko="권고 2.14.2.2: 국가",
                name_en="Recommendation 2.14.2.2: Country",
                description="대기 배출 세분화 권고: 국가별.",
                subtopic="대기 배출 세분화",
                dp_type="narrative",
                parent_indicator="GRI305-7-14-2",
                disclosure_requirement="권고",
                validation_rules=["세분화 정합"],
            ),
            DP(
                dp_id="GRI305-7-14-2-3",
                dp_code="GRI_305_DIS_7_REC_2_14_2_3",
                name_ko="권고 2.14.2.3: 배출원 유형",
                name_en="Recommendation 2.14.2.3: Source type",
                description="대기 배출 세분화 권고: 배출원 유형별.",
                subtopic="대기 배출 세분화",
                dp_type="narrative",
                parent_indicator="GRI305-7-14-2",
                disclosure_requirement="권고",
                validation_rules=["세분화 정합"],
            ),
            DP(
                dp_id="GRI305-7-14-2-4",
                dp_code="GRI_305_DIS_7_REC_2_14_2_4",
                name_ko="권고 2.14.2.4: 활동 유형",
                name_en="Recommendation 2.14.2.4: Activity type",
                description="대기 배출 세분화 권고: 활동 유형별.",
                subtopic="대기 배출 세분화",
                dp_type="narrative",
                parent_indicator="GRI305-7-14-2",
                disclosure_requirement="권고",
                validation_rules=["세분화 정합"],
            ),
        ]
    )

    pts.extend(new_pts)
    dp_path.write_text(json.dumps(data, ensure_ascii=False, indent=4), encoding="utf-8")

    rb_data = json.loads(rb_path.read_text(encoding="utf-8"))
    rbs = rb_data["rulebooks"]
    if any(r["rulebook_id"] == "RULE_GRI305_7" for r in rbs):
        raise SystemExit("rulebook already present: RULE_GRI305_7")

    rg = find_rb(rbs, "RULE_GRI305")
    rg["section_content"] = (
        "GRI 305: Emissions\n\n시드: 섹션 1(주제별 관리), 공개 305-1~305-7. "
        "주의: GRI305-1-1·GRI305-1-2는 공개 305-1의 절 2.1·2.2 트리이며 공개 305-2 루트(GRI305-2)와 혼동 금지."
    )
    rg["validation_rules"]["verification_checks"][0]["description"] = (
        "섹션 1·공개 305-1~305-7 시드 포함 확인"
    )
    rg["related_dp_ids"] = list(rg["related_dp_ids"]) + ["GRI305-7"]
    kt = rg["validation_rules"]["key_terms"]
    if "NOx" not in kt:
        kt.extend(["NOx", "SOx", "air emissions", "VOC", "PM"])

    rs2 = find_rb(rbs, "RULE_GRI305_SEC_2")
    rs2["section_content"] = "Section 2: Topic-related disclosures — 305-1 through 305-7 in seed."
    rs2["related_dp_ids"] = list(rs2["related_dp_ids"]) + ["GRI305-7"]
    rs2["validation_rules"]["verification_checks"][0]["description"] = "305-1~305-7 트리 존재"

    r7_related = (
        ["GRI305-7", "GRI305-7-a", "GRI305-7-b", "GRI305-7-c"]
        + [f"GRI305-7-a-{suf}" for suf, _, _, _ in A_LEAVES]
        + ["GRI305-7-13"]
        + [f"GRI305-7-13-{i}" for i in range(1, 5)]
        + ["GRI305-7-14", "GRI305-7-14-1", "GRI305-7-14-2"]
        + [f"GRI305-7-14-2-{j}" for j in range(1, 5)]
    )

    new_rbs: list[dict] = [
        RB(
            "RULE_GRI305_7",
            "GRI305-7",
            "공개 305-7: 대기 배출물",
            "Disclosure 305-7: NOx, SOx, and other significant air emissions — a (i–vii), b, c; compilation 2.13; recommendations 2.14.",
            "disclosure",
            "GRI 305 Disclosure 305-7",
            ["NOx", "SOx", "air emissions", "VOC", "PM", "emission factors"],
            act("report_305_7", "305-7 패키지"),
            chk("GRI305_7_ROOT_OK", "305-7 존재"),
            [],
            r7_related,
            "Disclosure 305-7",
            "필수",
        ),
        RB(
            "RULE_GRI305_7_A",
            "GRI305-7-a",
            "공개 305-7-a",
            "305-7-a: significant emissions by pollutant category.",
            "disclosure_requirement",
            "GRI 305 Disclosure 305-7-a",
            ["significant air emissions"],
            act("meet_305_7_a", "305-7-a i~vii"),
            chk("GRI305_7_A_OK", "305-7-a"),
            [],
            ["GRI305-7-a"] + [f"GRI305-7-a-{suf}" for suf, _, _, _ in A_LEAVES],
            "305-7-a",
            "필수",
        ),
    ]

    for suf, rom, _short, _code in A_LEAVES:
        pid = f"GRI305-7-a-{suf}"
        new_rbs.append(
            RB(
                f"RULE_GRI305_7_A_{rom}",
                pid,
                f"공개 305-7-a-{suf}",
                f"305-7-a-{suf}",
                "disclosure_requirement",
                f"GRI 305 Disclosure 305-7-a-{suf}",
                [],
                act(f"meet_305_7_a_{suf}", f"305-7-a-{suf}"),
                chk(f"GRI305_7_A_{rom}_OK", pid),
                [],
                [pid],
                f"305-7-a-{suf}",
                "필수",
            )
        )

    new_rbs.extend(
        [
            RB(
                "RULE_GRI305_7_B",
                "GRI305-7-b",
                "공개 305-7-b",
                "305-7-b",
                "disclosure_requirement",
                "GRI 305 Disclosure 305-7-b",
                [],
                act("meet_305_7_b", "305-7-b"),
                chk("GRI305_7_B_OK", "305-7-b"),
                [],
                ["GRI305-7-b"],
                "305-7-b",
                "필수",
            ),
            RB(
                "RULE_GRI305_7_C",
                "GRI305-7-c",
                "공개 305-7-c",
                "305-7-c",
                "disclosure_requirement",
                "GRI 305 Disclosure 305-7-c",
                [],
                act("meet_305_7_c", "305-7-c"),
                chk("GRI305_7_C_OK", "305-7-c"),
                [],
                ["GRI305-7-c"],
                "305-7-c",
                "필수",
            ),
            RB(
                "RULE_GRI305_7_13",
                "GRI305-7-13",
                "정보 수집 2.13",
                "Compilation 2.13 for 305-7.",
                "disclosure_requirement",
                "GRI 305 305-7 — 2.13",
                ["compilation"],
                act("apply_713", "2.13.1~2.13.4"),
                chk("GRI305_7_13_OK", "2.13"),
                [],
                ["GRI305-7-13"] + [f"GRI305-7-13-{i}" for i in range(1, 5)],
                "305-7 compilation 2.13",
                "필수",
            ),
        ]
    )

    for i in range(1, 5):
        pid = f"GRI305-7-13-{i}"
        new_rbs.append(
            RB(
                f"RULE_GRI305_7_13_{i}",
                pid,
                f"정보 수집 2.13.{i}",
                f"2.13.{i}",
                "disclosure_requirement",
                f"GRI 305 305-7 — 2.13.{i}",
                [],
                act(f"meet_713_{i}", f"2.13.{i}"),
                chk(f"GRI305_7_13_{i}_OK", pid),
                [],
                [pid] + (["GRI305-7-b"] if i == 3 else []),
                f"2.13.{i}",
                "필수",
            )
        )

    new_rbs.extend(
        [
            RB(
                "RULE_GRI305_7_14",
                "GRI305-7-14",
                "권고 2.14",
                "Recommendations 2.14 for 305-7.",
                "guidance",
                "GRI 305 305-7 — 2.14",
                [],
                act("rec_714", "권고 2.14", mandatory=False),
                chk("GRI305_7_14_REVIEW", "권고 검토", "reviewed"),
                [],
                ["GRI305-7-14", "GRI305-7-14-1", "GRI305-7-14-2"]
                + [f"GRI305-7-14-2-{j}" for j in range(1, 5)],
                "305-7 recommendations 2.14",
                "권고",
            ),
            RB(
                "RULE_GRI305_7_14_1",
                "GRI305-7-14-1",
                "권고 2.14.1",
                "2.14.1",
                "guidance",
                "GRI 305 305-7 — 2.14.1",
                [],
                act("rec_714_1", "2.14.1", mandatory=False),
                chk("GRI305_7_14_1_OK", "2.14.1", "optional"),
                [],
                ["GRI305-7-14-1"],
                "2.14.1",
                "권고",
            ),
            RB(
                "RULE_GRI305_7_14_2",
                "GRI305-7-14-2",
                "권고 2.14.2",
                "2.14.2",
                "guidance",
                "GRI 305 305-7 — 2.14.2",
                [],
                act("rec_714_2", "2.14.2", mandatory=False),
                chk("GRI305_7_14_2_OK", "2.14.2", "optional"),
                [],
                ["GRI305-7-14-2"] + [f"GRI305-7-14-2-{j}" for j in range(1, 5)],
                "2.14.2",
                "권고",
            ),
        ]
    )

    for j in range(1, 5):
        pid = f"GRI305-7-14-2-{j}"
        new_rbs.append(
            RB(
                f"RULE_GRI305_7_14_2_{j}",
                pid,
                f"권고 2.14.2.{j}",
                f"2.14.2.{j}",
                "guidance",
                f"GRI 305 305-7 — 2.14.2.{j}",
                [],
                act(f"rec_714_2_{j}", f"2.14.2.{j}", mandatory=False),
                chk(f"GRI305_7_14_2_{j}_OK", pid, "optional"),
                [],
                [pid],
                f"2.14.2.{j}",
                "권고",
            )
        )

    g7 = (
        "Guidance for Disclosure 305-7: Organizations should determine which air emissions are significant in context "
        "(e.g. regulatory thresholds, materiality, stakeholder concerns). "
        "References in the standard may include [3], [4], [5], [6], [10] for methodologies and pollutant definitions. "
        "Report in kilograms or multiples thereof; ensure consistency with the approach selected under compilation 2.13."
    )
    new_rbs.append(
        RB(
            "RULE_GRI305_7_G_GUIDANCE",
            "GRI305-7",
            "지침: 공개 305-7",
            g7,
            "guidance",
            "GRI 305 Disclosure 305-7 — Guidance",
            ["significant air emissions", "materiality"],
            act("interpret_air_emissions", "유의성·단위·참고문헌 맥락", mandatory=False),
            chk("GRI305_7_G_OK", "지침 정합", "coherent"),
            ["GRI 305 standard references [3],[4],[5],[6],[10]"],
            ["GRI305-7", "GRI305-7-a", "GRI305-7-13"],
            "Guidance 305-7",
            "필수",
            "지침 전용; 원문 지침 전체는 표준 PDF 참조.",
        )
    )

    rbs.extend(new_rbs)
    rb_path.write_text(json.dumps(rb_data, ensure_ascii=False, indent=4), encoding="utf-8")

    ids = {p["dp_id"] for p in pts}
    assert len(ids) == len(pts), "duplicate dp"
    miss = []
    for r in rbs:
        pid = r.get("primary_dp_id")
        if pid and pid not in ids:
            miss.append((r["rulebook_id"], pid))
    assert not miss, miss
    print("OK datapoints", len(pts), "rulebooks", len(rbs))


if __name__ == "__main__":
    main()
