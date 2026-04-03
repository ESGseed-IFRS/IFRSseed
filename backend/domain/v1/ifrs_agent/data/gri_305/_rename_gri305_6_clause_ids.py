"""GRI305-6-2-11* / GRI305-6-2-12* -> GRI305-6-11* / GRI305-6-12* (datapoint + rulebook + merge script)."""
from pathlib import Path

root = Path(__file__).resolve().parent

DP_PAIRS = [
    ("GRI305-6-2-12-2-4", "GRI305-6-12-2-4"),
    ("GRI305-6-2-12-2-3", "GRI305-6-12-2-3"),
    ("GRI305-6-2-12-2-2", "GRI305-6-12-2-2"),
    ("GRI305-6-2-12-2-1", "GRI305-6-12-2-1"),
    ("GRI305-6-2-12-2", "GRI305-6-12-2"),
    ("GRI305-6-2-12-1", "GRI305-6-12-1"),
    ("GRI305-6-2-12", "GRI305-6-12"),
    ("GRI305-6-2-11-2", "GRI305-6-11-2"),
    ("GRI305-6-2-11-1", "GRI305-6-11-1"),
    ("GRI305-6-2-11", "GRI305-6-11"),
]

RB_PAIRS = [
    ("RULE_GRI305_6_2_12_2_4", "RULE_GRI305_6_12_2_4"),
    ("RULE_GRI305_6_2_12_2_3", "RULE_GRI305_6_12_2_3"),
    ("RULE_GRI305_6_2_12_2_2", "RULE_GRI305_6_12_2_2"),
    ("RULE_GRI305_6_2_12_2_1", "RULE_GRI305_6_12_2_1"),
    ("RULE_GRI305_6_2_12_2", "RULE_GRI305_6_12_2"),
    ("RULE_GRI305_6_2_12_1", "RULE_GRI305_6_12_1"),
    ("RULE_GRI305_6_2_12", "RULE_GRI305_6_12"),
    ("RULE_GRI305_6_2_11_2", "RULE_GRI305_6_11_2"),
    ("RULE_GRI305_6_2_11_1", "RULE_GRI305_6_11_1"),
    ("RULE_GRI305_6_2_11", "RULE_GRI305_6_11"),
]

CHK_PAIRS = [
    ("GRI305_6_2122_4_OK", "GRI305_6_122_4_OK"),
    ("GRI305_6_2122_3_OK", "GRI305_6_122_3_OK"),
    ("GRI305_6_2122_2_OK", "GRI305_6_122_2_OK"),
    ("GRI305_6_2122_1_OK", "GRI305_6_122_1_OK"),
    ("GRI305_6_2122_OK", "GRI305_6_122_OK"),
    ("GRI305_6_2121_OK", "GRI305_6_121_OK"),
    ("GRI305_6_212_REVIEW", "GRI305_6_12_REVIEW"),
    ("GRI305_6_2112_OK", "GRI305_6_112_OK"),
    ("GRI305_6_2111_OK", "GRI305_6_111_OK"),
    ("GRI305_6_211_OK", "GRI305_6_11_OK"),
]


def apply(text: str, pairs: list[tuple[str, str]]) -> str:
    for old, new in pairs:
        text = text.replace(old, new)
    return text


def main() -> None:
    for name in ("datapoint.json", "rulebook.json"):
        p = root / name
        t = p.read_text(encoding="utf-8")
        t = apply(t, DP_PAIRS)
        t = apply(t, RB_PAIRS)
        t = apply(t, CHK_PAIRS)
        p.write_text(t, encoding="utf-8")

    mp = root / "_merge_305_4_5_6.py"
    if mp.exists():
        t = mp.read_text(encoding="utf-8")
        t = apply(t, DP_PAIRS)
        t = apply(t, RB_PAIRS)
        t = apply(t, CHK_PAIRS)
        # f-strings in merge file use RULE_GRI305_6_2_11 -> already RB_PAIRS
        mp.write_text(t, encoding="utf-8")

    import json

    data = json.loads((root / "datapoint.json").read_text(encoding="utf-8"))
    ids = [x["dp_id"] for x in data["data_points"]]
    assert len(ids) == len(set(ids)), "duplicate dp_id"
    idset = set(ids)
    for p in data["data_points"]:
        for c in p.get("child_dps") or []:
            assert c in idset, f"missing child {c} of {p['dp_id']}"
        par = p.get("parent_indicator")
        if par:
            assert par in idset, f"bad parent {par} for {p['dp_id']}"
    rb = json.loads((root / "rulebook.json").read_text(encoding="utf-8"))
    miss = []
    for r in rb["rulebooks"]:
        pid = r.get("primary_dp_id")
        if pid and pid not in idset:
            miss.append((r["rulebook_id"], pid))
    assert not miss, miss
    rid = {r["rulebook_id"] for r in rb["rulebooks"]}
    assert len(rid) == len(rb["rulebooks"]), "dup rulebook_id"
    print("OK", len(ids), "dps", len(rb["rulebooks"]), "rbs")


if __name__ == "__main__":
    main()
