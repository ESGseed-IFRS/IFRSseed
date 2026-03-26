"""Append rulebooks for GRI 305-2 and 305-3; patch RULE_GRI305 / SEC_2."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
rb_path = root / "rulebook.json"
data = json.loads(rb_path.read_text(encoding="utf-8"))
rbs = data["rulebooks"]

def find_rid(rid: str):
    for r in rbs:
        if r["rulebook_id"] == rid:
            return r
    raise KeyError(rid)


def RB(
    rid,
    primary,
    section_name,
    section_content,
    stype,
    pref,
    keys,
    concepts,
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
            "related_concepts": concepts,
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


new = []

# --- 305-2 disclosure ---
new.append(
    RB(
        "RULE_GRI305_2",
        "GRI305-2",
        "공개 305-2: Scope 2",
        "Disclosure 305-2: Energy indirect (Scope 2) GHG emissions — requirements a–g; compilation 2.3; recommendations 2.4.",
        "disclosure",
        "GRI 305 Disclosure 305-2",
        ["Scope 2", "location-based", "market-based", "GHG Protocol Scope 2"],
        ["dual reporting", "contractual instruments"],
        [{"action": "report_305_2", "description": "305-2 요구사항·2.3·2.4 트리 충족"}],
        [{"check_id": "GRI305_2_ROOT_OK", "description": "Scope 2 공개 패키지 존재", "expected": "305_2_present"}],
        ["GRI 302-1", "GHG Protocol Scope 2 Guidance"],
        ["GRI305-2"]
        + [f"GRI305-2-{x}" for x in "abcdefg"]
        + ["GRI305-2-d-i", "GRI305-2-d-ii", "GRI305-2-d-iii"]
        + ["GRI305-2-3", "GRI305-2-3-1", "GRI305-2-3-2", "GRI305-2-3-3", "GRI305-2-3-4"]
        + ["GRI305-2-4", "GRI305-2-4-1", "GRI305-2-4-2", "GRI305-2-4-3", "GRI305-2-4-4", "GRI305-2-4-5"]
        + [f"GRI305-2-4-5-{i}" for i in range(1, 5)],
        "Disclosure 305-2",
        "필수",
        "GRI305-1-1·GRI305-1-2는 공개 305-1의 절 2.1·2.2 트리(공개 305-2와 무관).",
    )
)

for letter in "abcdefg":
    pid = f"GRI305-2-{letter}"
    new.append(
        RB(
            f"RULE_GRI305_2_{letter.upper()}",
            pid,
            f"공개 305-2-{letter}",
            f"305-2-{letter}: requirement.",
            "disclosure_requirement",
            f"GRI 305 Disclosure 305-2-{letter}",
            ["Scope 2"],
            [],
            [{"action": f"meet_305_2_{letter}", "description": f"305-2-{letter} 충족"}],
            [{"check_id": f"GRI305_2_{letter.upper()}_OK", "description": f"305-2-{letter}", "expected": "ok"}],
            [],
            [pid],
            f"305-2-{letter}",
            "조건부" if letter in ("b", "c") else "필수",
        )
    )

for suf, roman in [("i", "I"), ("ii", "II"), ("iii", "III")]:
    pid = f"GRI305-2-d-{suf}"
    new.append(
        RB(
            f"RULE_GRI305_2_D_{roman}",
            pid,
            f"공개 305-2-d-{suf}",
            f"305-2-d-{suf}",
            "disclosure_requirement",
            f"GRI 305 Disclosure 305-2-d-{suf}",
            ["base year"],
            [],
            [{"action": "meet_d_sub", "description": f"d-{suf}"}],
            [{"check_id": f"GRI305_2_D_{roman}_OK", "description": pid, "expected": "ok"}],
            [],
            [pid],
            f"305-2-d-{suf}",
            "필수",
        )
    )

new.append(
    RB(
        "RULE_GRI305_2_3",
        "GRI305-2-3",
        "정보 수집 2.3",
        "Compilation 2.3 for 305-2 (shall).",
        "disclosure_requirement",
        "GRI 305 Disclosure 305-2 - Compilation 2.3",
        ["compilation", "Scope 2", "Scope 3 boundary"],
        [],
        [{"action": "apply_23", "description": "2.3.1~2.3.4"}],
        [{"check_id": "GRI305_2_3_OK", "description": "2.3 패키지", "expected": "ok"}],
        [],
        ["GRI305-2-3", "GRI305-2-3-1", "GRI305-2-3-2", "GRI305-2-3-3", "GRI305-2-3-4"],
        "305-2 compilation 2.3",
        "필수",
    )
)
for i in range(1, 5):
    pid = f"GRI305-2-3-{i}"
    new.append(
        RB(
            f"RULE_GRI305_2_3_{i}",
            pid,
            f"정보 수집 2.3.{i}",
            f"2.3.{i}",
            "disclosure_requirement",
            f"GRI 305 305-2 - 2.3.{i}",
            ["Scope 2"],
            [],
            [{"action": f"meet_23_{i}", "description": f"2.3.{i}"}],
            [{"check_id": f"GRI305_2_3_{i}_OK", "description": pid, "expected": "ok"}],
            ["GRI305-3"] if i == 2 else [],
            [pid] + (["GRI305-2-a", "GRI305-2-b"] if i == 4 else []),
            f"2.3.{i}",
            "필수",
        )
    )

new.append(
    RB(
        "RULE_GRI305_2_4",
        "GRI305-2-4",
        "권고 2.4",
        "Recommendations 2.4 for 305-2.",
        "guidance",
        "GRI 305 Disclosure 305-2 - Recommendations 2.4",
        ["recommendations", "Scope 2"],
        [],
        [{"action": "rec_24", "description": "권고 2.4", "mandatory": False}],
        [{"check_id": "GRI305_2_4_REVIEW", "description": "권고 검토", "expected": "reviewed"}],
        ["GHG Protocol Corporate Standard"],
        ["GRI305-2-4"]
        + [f"GRI305-2-4-{i}" for i in range(1, 6)]
        + [f"GRI305-2-4-5-{j}" for j in range(1, 5)],
        "305-2 recommendations 2.4",
        "권고",
    )
)
for i in range(1, 6):
    pid = f"GRI305-2-4-{i}"
    rel = [pid] + ([f"GRI305-2-4-5-{j}" for j in range(1, 5)] if i == 5 else [])
    new.append(
        RB(
            f"RULE_GRI305_2_4_{i}",
            pid,
            f"권고 2.4.{i}",
            f"2.4.{i}",
            "guidance",
            f"GRI 305 305-2 - 2.4.{i}",
            ["Scope 2"],
            [],
            [{"action": f"rec_24_{i}", "description": f"2.4.{i}", "mandatory": False}],
            [{"check_id": f"GRI305_2_4_{i}_OK", "description": pid, "expected": "optional"}],
            [],
            rel,
            f"2.4.{i}",
            "권고",
        )
    )
for j in range(1, 5):
    pid = f"GRI305-2-4-5-{j}"
    new.append(
        RB(
            f"RULE_GRI305_2_4_5_{j}",
            pid,
            f"권고 2.4.5.{j}",
            f"2.4.5.{j}",
            "guidance",
            f"GRI 305 305-2 - 2.4.5.{j}",
            ["disaggregation"],
            [],
            [{"action": f"rec_245_{j}", "description": f"2.4.5.{j}", "mandatory": False}],
            [{"check_id": f"GRI305_2_4_5_{j}_OK", "description": pid, "expected": "optional"}],
            [],
            [pid],
            f"2.4.5.{j}",
            "권고",
        )
    )

scope2_guidance = """Guidance for Disclosure 305-2 (summary)

Scope 2 includes GHG emissions from purchased/acquired electricity, heating, cooling, and steam consumed; not limited to CO2. Link to GRI 302: Energy 2016, Disclosure 302-1.

GHG Protocol Scope 2 Guidance requires two distinct Scope 2 figures where applicable: location-based (grid average intensity where consumption occurs) and market-based (contractual instruments, residual mix when specific factors unavailable; grid average as proxy if residual mix unavailable — figures may coincide).

Apply quality criteria for contractual instruments to avoid double counting. Base-year recalculation may follow GHG Protocol Corporate Standard. GWP: IPCC SAR under Kyoto Protocol or latest IPCC where permitted. May combine 305-1, 305-2, 305-3 for total GHG.
"""
new.append(
    RB(
        "RULE_GRI305_2_G_GUIDANCE",
        "GRI305-2",
        "지침: 공개 305-2",
        scope2_guidance,
        "guidance",
        "GRI 305 Disclosure 305-2 - Guidance",
        ["location-based", "market-based", "residual mix", "contractual instruments"],
        ["dual reporting"],
        [
            {
                "action": "apply_scope2_guidance",
                "description": "위치·시장 기반 이중 보고 및 잔여믹스 해석",
                "mandatory": False,
            }
        ],
        [{"check_id": "GRI305_2_G_DUAL", "description": "이중 보고 요건과 서술 정합", "expected": "coherent"}],
        ["GRI 302-1", "GHG Protocol Scope 2 Guidance", "GHG Protocol Corporate Standard"],
        ["GRI305-2", "GRI305-2-a", "GRI305-2-b", "GRI305-2-3-4", "GRI305-2-e"],
        "Guidance to Disclosure 305-2",
        "필수",
        "지침 전용; 별도 지침용 dp_id 없음.",
    )
)

# --- 305-3 ---
new.append(
    RB(
        "RULE_GRI305_3",
        "GRI305-3",
        "공개 305-3: Scope 3",
        "Disclosure 305-3: Other indirect (Scope 3) GHG emissions — a–g; compilation 2.5; recommendations 2.6.",
        "disclosure",
        "GRI 305 Disclosure 305-3",
        ["Scope 3", "value chain", "GHG Protocol"],
        ["upstream", "downstream"],
        [{"action": "report_305_3", "description": "305-3 패키지"}],
        [{"check_id": "GRI305_3_ROOT_OK", "description": "305-3 존재", "expected": "ok"}],
        ["GHG Protocol Corporate Value Chain (Scope 3) Standard"],
        ["GRI305-3"]
        + [f"GRI305-3-{x}" for x in "abcdefg"]
        + ["GRI305-3-e-i", "GRI305-3-e-ii", "GRI305-3-e-iii"]
        + ["GRI305-3-5", "GRI305-3-5-1", "GRI305-3-5-2", "GRI305-3-5-3"]
        + ["GRI305-3-6", "GRI305-3-6-1", "GRI305-3-6-2", "GRI305-3-6-3", "GRI305-3-6-4", "GRI305-3-6-5"]
        + [f"GRI305-3-6-5-{i}" for i in range(1, 5)],
        "Disclosure 305-3",
        "필수",
    )
)

for letter in "abcdefg":
    pid = f"GRI305-3-{letter}"
    disc = "조건부" if letter == "b" else "필수"
    new.append(
        RB(
            f"RULE_GRI305_3_{letter.upper()}",
            pid,
            f"공개 305-3-{letter}",
            f"305-3-{letter}",
            "disclosure_requirement",
            f"GRI 305 Disclosure 305-3-{letter}",
            ["Scope 3"],
            [],
            [{"action": f"meet_305_3_{letter}", "description": f"305-3-{letter}"}],
            [{"check_id": f"GRI305_3_{letter.upper()}_OK", "description": pid, "expected": "ok"}],
            [],
            [pid],
            f"305-3-{letter}",
            disc,
        )
    )

for suf, roman in [("i", "I"), ("ii", "II"), ("iii", "III")]:
    pid = f"GRI305-3-e-{suf}"
    new.append(
        RB(
            f"RULE_GRI305_3_E_{roman}",
            pid,
            f"공개 305-3-e-{suf}",
            f"305-3-e-{suf}",
            "disclosure_requirement",
            f"GRI 305 Disclosure 305-3-e-{suf}",
            ["base year"],
            [],
            [{"action": "meet_e_sub", "description": f"e-{suf}"}],
            [{"check_id": f"GRI305_3_E_{roman}_OK", "description": pid, "expected": "ok"}],
            [],
            [pid],
            f"305-3-e-{suf}",
            "필수",
        )
    )

new.append(
    RB(
        "RULE_GRI305_3_5",
        "GRI305-3-5",
        "정보 수집 2.5",
        "Compilation 2.5 for 305-3.",
        "disclosure_requirement",
        "GRI 305 Disclosure 305-3 - Compilation 2.5",
        ["Scope 3", "biogenic"],
        [],
        [{"action": "apply_25", "description": "2.5.1~2.5.3"}],
        [{"check_id": "GRI305_3_5_OK", "description": "2.5", "expected": "ok"}],
        [],
        ["GRI305-3-5", "GRI305-3-5-1", "GRI305-3-5-2", "GRI305-3-5-3"],
        "305-3 compilation 2.5",
        "필수",
    )
)
for i in range(1, 4):
    pid = f"GRI305-3-5-{i}"
    xref = ["GRI305-2"] if i == 2 else []
    rel = [pid, "GRI305-3-a"] if i == 1 else [pid]
    if i == 2:
        rel.append("GRI305-2-a")
    if i == 3:
        rel.extend(["GRI305-3-a", "GRI305-3-c"])
    new.append(
        RB(
            f"RULE_GRI305_3_5_{i}",
            pid,
            f"정보 수집 2.5.{i}",
            f"2.5.{i}",
            "disclosure_requirement",
            f"GRI 305 305-3 - 2.5.{i}",
            ["Scope 3"],
            [],
            [{"action": f"meet_25_{i}", "description": f"2.5.{i}"}],
            [{"check_id": f"GRI305_3_5_{i}_OK", "description": pid, "expected": "ok"}],
            xref,
            rel,
            f"2.5.{i}",
            "필수",
        )
    )

new.append(
    RB(
        "RULE_GRI305_3_6",
        "GRI305-3-6",
        "권고 2.6",
        "Recommendations 2.6 for 305-3.",
        "guidance",
        "GRI 305 Disclosure 305-3 - Recommendations 2.6",
        ["Scope 3"],
        [],
        [{"action": "rec_26", "description": "권고 2.6", "mandatory": False}],
        [{"check_id": "GRI305_3_6_REVIEW", "description": "권고 검토", "expected": "reviewed"}],
        [],
        ["GRI305-3-6"]
        + [f"GRI305-3-6-{i}" for i in range(1, 6)]
        + [f"GRI305-3-6-5-{j}" for j in range(1, 5)],
        "305-3 recommendations 2.6",
        "권고",
    )
)
for i in range(1, 6):
    pid = f"GRI305-3-6-{i}"
    rel = [pid] + ([f"GRI305-3-6-5-{j}" for j in range(1, 5)] if i == 5 else [])
    new.append(
        RB(
            f"RULE_GRI305_3_6_{i}",
            pid,
            f"권고 2.6.{i}",
            f"2.6.{i}",
            "guidance",
            f"GRI 305 305-3 - 2.6.{i}",
            ["Scope 3"],
            [],
            [{"action": f"rec_26_{i}", "description": f"2.6.{i}", "mandatory": False}],
            [{"check_id": f"GRI305_3_6_{i}_OK", "description": pid, "expected": "optional"}],
            [],
            rel,
            f"2.6.{i}",
            "권고",
        )
    )
for j in range(1, 5):
    pid = f"GRI305-3-6-5-{j}"
    new.append(
        RB(
            f"RULE_GRI305_3_6_5_{j}",
            pid,
            f"권고 2.6.5.{j}",
            f"2.6.5.{j}",
            "guidance",
            f"GRI 305 305-3 - 2.6.5.{j}",
            ["disaggregation"],
            [],
            [{"action": f"rec_265_{j}", "description": f"2.6.5.{j}", "mandatory": False}],
            [{"check_id": f"GRI305_3_6_5_{j}_OK", "description": pid, "expected": "optional"}],
            [],
            [pid],
            f"2.6.5.{j}",
            "권고",
        )
    )

cat15 = """15 Scope 3 categories (GHG Protocol Corporate Value Chain Standard):
Upstream: (1) Purchased goods and services, (2) Capital goods, (3) Fuel and energy-related activities (not in Scope 1 or 2), (4) Upstream transportation and distribution, (5) Waste generated in operations, (6) Business travel, (7) Employee commuting, (8) Upstream leased assets.
Downstream: (9) Downstream transportation and distribution, (10) Processing of sold products, (11) Use of sold products, (12) End-of-life treatment of sold products, (13) Downstream leased assets, (14) Franchises, (15) Investments.
"""
new.append(
    RB(
        "RULE_GRI305_3_G_GUIDANCE",
        "GRI305-3",
        "지침: 공개 305-3",
        cat15
        + "\nScope 3 are indirect emissions in the value chain not owned/controlled by the organization. "
        "Identify significant categories by size, influence, risk, stakeholders, outsourcing, sector norms. "
        "Report CO2e per category or explain exclusions. Recalculation may follow GHG Protocol Corporate Value Chain Standard. "
        "GWP: IPCC SAR / Kyoto or latest IPCC if allowed. Combine 305-1+305-2+305-3 for total GHG.",
        "guidance",
        "GRI 305 Disclosure 305-3 - Guidance",
        ["Scope 3", "value chain", "categories"],
        ["significance assessment"],
        [{"action": "interpret_scope3", "description": "15개 범주·중요성 평가 반영", "mandatory": False}],
        [{"check_id": "GRI305_3_G_CATEGORIES", "description": "범주·제외 설명 정합", "expected": "coherent"}],
        ["GHG Protocol Scope 3 Standard", "IPCC"],
        ["GRI305-3", "GRI305-3-d", "GRI305-3-a"],
        "Guidance to Disclosure 305-3",
        "필수",
        "요구 d는 단일 DP; 15개 범주는 지침·validation으로 보강.",
    )
)

existing_ids = {r["rulebook_id"] for r in rbs}
for r in new:
    if r["rulebook_id"] in existing_ids:
        raise SystemExit(f"duplicate rulebook {r['rulebook_id']}")
rbs.extend(new)

# patch RULE_GRI305
rg = find_rid("RULE_GRI305")
rg["section_content"] = (
    "GRI 305: Emissions\n\n시드: 섹션 1(주제별 관리), 공개 305-1·305-2·305-3. "
    "주의: GRI305-1-1·GRI305-1-2는 공개 305-1의 절 2.1·2.2 트리이며 공개 305-2 루트(GRI305-2)와 혼동 금지."
)
rg["validation_rules"]["verification_checks"][0]["description"] = (
    "섹션 1·공개 305-1·305-2·305-3 시드 포함 확인"
)
rg["related_dp_ids"] = [
    "GRI305",
    "GRI305-SEC-1",
    "GRI305-SEC-2",
    "GRI305-1",
    "GRI305-2",
    "GRI305-3",
]
rg["mapping_notes"] = (
    "시드: 305-1~305-3. GRI305-2=공개305-2; GRI305-1-1·GRI305-1-2=공개305-1의 절 2.1·2.2 트리."
)

rs2 = find_rid("RULE_GRI305_SEC_2")
rs2["section_content"] = "Section 2: Topic-related disclosures — 305-1, 305-2, 305-3 in seed."
rs2["related_dp_ids"] = ["GRI305-SEC-2", "GRI305-1", "GRI305-2", "GRI305-3"]
rs2["validation_rules"]["verification_checks"][0]["description"] = "305-1·305-2·305-3 트리 존재"

# patch guidance 305-1
g1 = find_rid("RULE_GRI305_1_G_GUIDANCE")
g1["related_dp_ids"] = list(
    dict.fromkeys(
        (g1.get("related_dp_ids") or [])
        + ["GRI305-2", "GRI305-3", "GRI305-2-a", "GRI305-3-a"]
    )
)
g1["mapping_notes"] = "지침; Scope 2·3는 RULE_GRI305_2_G_GUIDANCE·RULE_GRI305_3_G_GUIDANCE 참조."

rb_path.write_text(json.dumps({"rulebooks": rbs}, ensure_ascii=False, indent=4), encoding="utf-8")
print("OK rulebooks", len(rbs))
