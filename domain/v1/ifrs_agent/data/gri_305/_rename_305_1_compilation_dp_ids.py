"""Rename GRI305-2-1 / GRI305-2-2 compilation trees to GRI305-1-1 / GRI305-1-2 (305-1 sub-clauses)."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent

DP_ORDERED = [
    ("GRI305-2-2-5-4", "GRI305-1-2-5-4"),
    ("GRI305-2-2-5-3", "GRI305-1-2-5-3"),
    ("GRI305-2-2-5-2", "GRI305-1-2-5-2"),
    ("GRI305-2-2-5-1", "GRI305-1-2-5-1"),
    ("GRI305-2-2-5", "GRI305-1-2-5"),
    ("GRI305-2-2-4", "GRI305-1-2-4"),
    ("GRI305-2-2-3", "GRI305-1-2-3"),
    ("GRI305-2-2-2", "GRI305-1-2-2"),
    ("GRI305-2-2-1", "GRI305-1-2-1"),
    ("GRI305-2-2", "GRI305-1-2"),
    ("GRI305-2-1-2", "GRI305-1-1-2"),
    ("GRI305-2-1-1", "GRI305-1-1-1"),
    ("GRI305-2-1", "GRI305-1-1"),
]

DP_CODE_ORDERED = [
    ("GRI_305_DIS_1_REC_2_2_5_4", "GRI_305_DIS_1_2_5_4"),
    ("GRI_305_DIS_1_REC_2_2_5_3", "GRI_305_DIS_1_2_5_3"),
    ("GRI_305_DIS_1_REC_2_2_5_2", "GRI_305_DIS_1_2_5_2"),
    ("GRI_305_DIS_1_REC_2_2_5_1", "GRI_305_DIS_1_2_5_1"),
    ("GRI_305_DIS_1_REC_2_2_5", "GRI_305_DIS_1_2_5"),
    ("GRI_305_DIS_1_REC_2_2_4", "GRI_305_DIS_1_2_4"),
    ("GRI_305_DIS_1_REC_2_2_3", "GRI_305_DIS_1_2_3"),
    ("GRI_305_DIS_1_REC_2_2_2", "GRI_305_DIS_1_2_2"),
    ("GRI_305_DIS_1_REC_2_2_1", "GRI_305_DIS_1_2_1"),
    ("GRI_305_DIS_1_REC_2_2", "GRI_305_DIS_1_2"),
    ("GRI_305_DIS_1_COMP_2_1_2", "GRI_305_DIS_1_1_2"),
    ("GRI_305_DIS_1_COMP_2_1_1", "GRI_305_DIS_1_1_1"),
    ("GRI_305_DIS_1_COMP_2_1", "GRI_305_DIS_1_1"),
]

RB_ORDERED = [
    ("RULE_GRI305_2_2_5_4", "RULE_GRI305_1_2_5_4"),
    ("RULE_GRI305_2_2_5_3", "RULE_GRI305_1_2_5_3"),
    ("RULE_GRI305_2_2_5_2", "RULE_GRI305_1_2_5_2"),
    ("RULE_GRI305_2_2_5_1", "RULE_GRI305_1_2_5_1"),
    ("RULE_GRI305_2_2_5", "RULE_GRI305_1_2_5"),
    ("RULE_GRI305_2_2_4", "RULE_GRI305_1_2_4"),
    ("RULE_GRI305_2_2_3", "RULE_GRI305_1_2_3"),
    ("RULE_GRI305_2_2_2", "RULE_GRI305_1_2_2"),
    ("RULE_GRI305_2_2_1", "RULE_GRI305_1_2_1"),
    ("RULE_GRI305_2_2", "RULE_GRI305_1_2"),
    ("RULE_GRI305_2_1_2", "RULE_GRI305_1_1_2"),
    ("RULE_GRI305_2_1_1", "RULE_GRI305_1_1_1"),
    ("RULE_GRI305_2_1", "RULE_GRI305_1_1"),
]

CHECK_ORDERED = [
    ("GRI305_2_2_5_4_IF_USED", "GRI305_1_2_5_4_IF_USED"),
    ("GRI305_2_2_5_3_IF_USED", "GRI305_1_2_5_3_IF_USED"),
    ("GRI305_2_2_5_2_IF_USED", "GRI305_1_2_5_2_IF_USED"),
    ("GRI305_2_2_5_1_IF_USED", "GRI305_1_2_5_1_IF_USED"),
    ("GRI305_2_2_5_BREAKDOWN", "GRI305_1_2_5_BREAKDOWN"),
    ("GRI305_2_2_4_EXPLAIN", "GRI305_1_2_4_EXPLAIN"),
    ("GRI305_2_2_3_SCOPE12", "GRI305_1_2_3_SCOPE12"),
    ("GRI305_2_2_2_GWP_STATED", "GRI305_1_2_2_GWP_STATED"),
    ("GRI305_2_2_1_IF_CLAIMED", "GRI305_1_2_1_IF_CLAIMED"),
    ("GRI305_2_2_TREE_REVIEWED", "GRI305_1_2_TREE_REVIEWED"),
    ("GRI305_2_1_2_BIOGENIC", "GRI305_1_1_2_BIOGENIC"),
    ("GRI305_2_1_1_EXCLUSION", "GRI305_1_1_1_EXCLUSION"),
    ("GRI305_2_1_CHILDREN_OK", "GRI305_1_1_CHILDREN_OK"),
]


def apply_pairs(text: str, pairs: list[tuple[str, str]]) -> str:
    for old, new in pairs:
        text = text.replace(old, new)
    return text


def fix_shorthand_datapoint(text: str) -> str:
    """Expand ·2-1-1· style fragments left after GRI305-2-1 → GRI305-1-1."""
    text = re.sub(r"GRI305-1-1·2-1-1·2-1-2", "GRI305-1-1·GRI305-1-1-1·GRI305-1-1-2", text)
    text = text.replace("GRI305-1-1(하위 2-1-1·2-1-2)", "GRI305-1-1(하위 GRI305-1-1-1·GRI305-1-1-2)")
    text = text.replace("GRI305-1-1-1·2-1-2 요건", "GRI305-1-1-1·GRI305-1-1-2 요건")
    return text


def main() -> None:
    dp_path = root / "datapoint.json"
    rb_path = root / "rulebook.json"
    t = dp_path.read_text(encoding="utf-8")
    t = apply_pairs(t, DP_CODE_ORDERED)
    t = apply_pairs(t, DP_ORDERED)
    t = fix_shorthand_datapoint(t)
    dp_path.write_text(t, encoding="utf-8")

    t2 = rb_path.read_text(encoding="utf-8")
    t2 = apply_pairs(t2, RB_ORDERED)
    t2 = apply_pairs(t2, CHECK_ORDERED)
    t2 = apply_pairs(t2, DP_ORDERED)
    t2 = fix_shorthand_datapoint(t2)
    t2 = t2.replace(
        "Note: GRI305-2-* numbering follows the standard’s 「정보 수집 요건」 clause numbers under Disclosure 305-1; it does not denote Disclosure 305-2.",
        "Note: GRI305-1-1 and GRI305-1-2 trees map the standard’s compilation clause numbers under Disclosure 305-1; they do not denote Disclosure 305-2.",
    )
    t2 = t2.replace(
        "주의: GRI305-1-1·GRI305-1-2는 공개 305-1의 정보 수집 절번 2.1·2.2이며 공개 305-2 루트(GRI305-2)와 혼동 금지.",
        "주의: GRI305-1-1·GRI305-1-2는 공개 305-1 하위의 정보 수집 절번 2.1·2.2 그룹이며, 공개 305-2 루트(GRI305-2)와 혼동 금지.",
    )
    t2 = t2.replace(
        "시드: 305-1~305-3. GRI305-2=공개305-2; GRI305-1-1·GRI305-1-2=305-1 하위 절번.",
        "시드: 305-1~305-3. GRI305-2=공개305-2; GRI305-1-1·GRI305-1-2=공개305-1의 절 2.1·2.2 트리.",
    )
    t2 = t2.replace(
        'mapping_notes": "dp_id GRI305-1-1은 공개 305-2가 아니라 절번 2.1."',
        'mapping_notes": "dp_id GRI305-1-1은 공개 305-2가 아니라 공개 305-1의 절 2.1 그룹."',
    )
    t2 = t2.replace(
        'mapping_notes": "dp_id GRI305-1-2는 공개 305-2가 아니라 절번 2.2."',
        'mapping_notes": "dp_id GRI305-1-2는 공개 305-2가 아니라 공개 305-1의 절 2.2 그룹."',
    )
    t2 = t2.replace(
        'mapping_notes": "GRI305-1-1·GRI305-1-2는 305-1 하위 절번과 별개."',
        'mapping_notes": "GRI305-1-1·GRI305-1-2는 공개 305-1의 절 2.1·2.2 트리(공개 305-2와 무관)."',
    )
    rb_path.write_text(t2, encoding="utf-8")

    data = json.loads(dp_path.read_text(encoding="utf-8"))
    ids = [p["dp_id"] for p in data["data_points"]]
    assert len(ids) == len(set(ids)), "duplicate dp_id"
    rb = json.loads(rb_path.read_text(encoding="utf-8"))
    idset = set(ids)
    miss = []
    for r in rb["rulebooks"]:
        pid = r.get("primary_dp_id")
        if pid and pid not in idset:
            miss.append((r["rulebook_id"], pid))
    assert not miss, miss
    print("OK datapoints", len(ids), "rulebooks", len(rb["rulebooks"]))


if __name__ == "__main__":
    main()
