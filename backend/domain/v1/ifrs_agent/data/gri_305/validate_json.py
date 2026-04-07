#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""datapoint.json, rulebook.json 필드 유효성 검증"""
import json
import sys
from pathlib import Path
from collections import Counter

# UTF-8 출력 강제
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = Path(__file__).parent

def validate_datapoints():
    dp_path = BASE / "datapoint.json"
    data = json.loads(dp_path.read_text(encoding="utf-8"))
    dps = data.get("data_points", [])
    
    print(f"\n{'='*60}")
    print(f"datapoint.json 검증 (총 {len(dps)}개)")
    print(f"{'='*60}")
    
    issues = []
    dp_ids = []
    
    for i, dp in enumerate(dps):
        dp_id = dp.get("dp_id", "")
        dp_ids.append(dp_id)
        
        # 필수 필드
        if not dp_id:
            issues.append(f"#{i}: dp_id 없음")
        if not dp.get("name_ko"):
            issues.append(f"#{i} ({dp_id}): name_ko 없음")
        if not dp.get("description"):
            issues.append(f"#{i} ({dp_id}): description 없음")
        
        # dp_type 검증
        dp_type = dp.get("dp_type")
        if dp_type and dp_type not in ["quantitative", "qualitative", "narrative", "binary"]:
            issues.append(f"#{i} ({dp_id}): 비표준 dp_type='{dp_type}'")
        
        # unit 검증
        unit = dp.get("unit")
        valid_units = [
            "percentage",
            "count",
            "currency_krw",
            "currency_usd",
            "tco2e",
            "tcfc11e",
            "kg",
            "mwh",
            "cubic_meter",
            "text",
        ]
        if unit and unit not in valid_units:
            issues.append(f"#{i} ({dp_id}): 비표준 unit='{unit}'")
        
        # parent_indicator 순환 참조 체크
        parent = dp.get("parent_indicator")
        if parent and parent == dp_id:
            issues.append(f"#{i} ({dp_id}): parent_indicator가 자기 자신")
    
    # dp_id 중복 체크
    dp_id_counts = Counter(dp_ids)
    duplicates = {k: v for k, v in dp_id_counts.items() if v > 1}
    if duplicates:
        for dp_id, count in duplicates.items():
            issues.append(f"dp_id '{dp_id}' 중복 {count}회")
    
    if issues:
        print(f"\n[WARNING] 발견된 이슈: {len(issues)}건\n")
        for issue in issues[:30]:
            print(f"  - {issue}")
        if len(issues) > 30:
            print(f"  ... 외 {len(issues)-30}건")
    else:
        print("\n[OK] 모든 검증 통과")
    
    return len(issues) == 0


def validate_rulebooks():
    rb_path = BASE / "rulebook.json"
    data = json.loads(rb_path.read_text(encoding="utf-8"))
    rbs = data.get("rulebooks", [])
    
    print(f"\n{'='*60}")
    print(f"rulebook.json 검증 (총 {len(rbs)}개)")
    print(f"{'='*60}")
    
    issues = []
    rb_ids = []
    primary_dp_ids = []
    
    for i, rb in enumerate(rbs):
        rb_id = rb.get("rulebook_id", "")
        rb_ids.append(rb_id)
        primary = rb.get("primary_dp_id", "")
        primary_dp_ids.append(primary)
        
        # 필수 필드
        if not rb_id:
            issues.append(f"#{i}: rulebook_id 없음")
        if not primary:
            issues.append(f"#{i} ({rb_id}): primary_dp_id 없음")
        if not rb.get("section_name"):
            issues.append(f"#{i} ({rb_id}): section_name 없음")
        
        # disclosure_requirement 검증
        req = rb.get("disclosure_requirement")
        valid_reqs = ["필수", "권장", "선택", "조건부", None]
        if req and req not in valid_reqs:
            issues.append(f"#{i} ({rb_id}): 비표준 disclosure_requirement='{req}'")
    
    # rulebook_id 중복 체크
    rb_id_counts = Counter(rb_ids)
    duplicates = {k: v for k, v in rb_id_counts.items() if v > 1}
    if duplicates:
        for rb_id, count in duplicates.items():
            issues.append(f"rulebook_id '{rb_id}' 중복 {count}회")
    
    # primary_dp_id 중복 체크
    primary_counts = Counter(primary_dp_ids)
    dup_primaries = {k: v for k, v in primary_counts.items() if v > 1}
    if dup_primaries:
        for dp_id, count in dup_primaries.items():
            issues.append(f"primary_dp_id '{dp_id}' 중복 {count}회")
    
    if issues:
        print(f"\n[WARNING] 발견된 이슈: {len(issues)}건\n")
        for issue in issues[:30]:
            print(f"  - {issue}")
        if len(issues) > 30:
            print(f"  ... 외 {len(issues)-30}건")
    else:
        print("\n[OK] 모든 검증 통과")
    
    return len(issues) == 0


def validate_cross_references():
    dp_path = BASE / "datapoint.json"
    rb_path = BASE / "rulebook.json"
    
    dp_data = json.loads(dp_path.read_text(encoding="utf-8"))
    rb_data = json.loads(rb_path.read_text(encoding="utf-8"))
    
    dps = dp_data.get("data_points", [])
    rbs = rb_data.get("rulebooks", [])
    
    dp_ids = {dp["dp_id"] for dp in dps if dp.get("dp_id")}
    primary_dp_ids = {rb["primary_dp_id"] for rb in rbs if rb.get("primary_dp_id")}
    
    print(f"\n{'='*60}")
    print(f"교차 참조 검증")
    print(f"{'='*60}")
    
    issues = []
    
    # primary_dp_id가 datapoint에 없는 경우
    orphan_primaries = primary_dp_ids - dp_ids
    if orphan_primaries:
        issues.append(f"rulebook의 primary_dp_id 중 datapoint에 없는 것: {len(orphan_primaries)}개")
        for dp_id in sorted(orphan_primaries)[:10]:
            issues.append(f"  - {dp_id}")
    
    # datapoint에만 있고 rulebook에 없는 경우
    orphan_dps = dp_ids - primary_dp_ids
    if orphan_dps:
        issues.append(f"datapoint 중 rulebook에 매칭되지 않는 것: {len(orphan_dps)}개")
        for dp_id in sorted(orphan_dps)[:10]:
            issues.append(f"  - {dp_id}")
    
    # 1:1 매칭 확인
    is_one_to_one = (len(dp_ids) == len(primary_dp_ids) and 
                     len(orphan_primaries) == 0 and 
                     len(orphan_dps) == 0)
    
    print(f"\ndatapoint 고유 dp_id: {len(dp_ids)}개")
    print(f"rulebook 고유 primary_dp_id: {len(primary_dp_ids)}개")
    print(f"1:1 매칭: {'[OK] 예' if is_one_to_one else '[FAIL] 아니오'}")
    
    if issues:
        print(f"\n[WARNING] 발견된 이슈: {len(issues)}건\n")
        for issue in issues[:30]:
            print(f"  {issue}")
    else:
        print("\n[OK] 완벽한 1:1 매칭")
    
    return is_one_to_one


if __name__ == "__main__":
    dp_ok = validate_datapoints()
    rb_ok = validate_rulebooks()
    cross_ok = validate_cross_references()
    
    print(f"\n{'='*60}")
    print(f"최종 결과")
    print(f"{'='*60}")
    print(f"datapoint.json: {'[OK] 통과' if dp_ok else '[FAIL] 실패'}")
    print(f"rulebook.json: {'[OK] 통과' if rb_ok else '[FAIL] 실패'}")
    print(f"교차 참조: {'[OK] 통과' if cross_ok else '[FAIL] 실패'}")
    print()
    
    if dp_ok and rb_ok and cross_ok:
        print("[SUCCESS] 모든 검증 통과! load_gri_305_datapoint_rulebook_embeddings.py 실행 가능")
        exit(0)
    else:
        print("[WARNING] 일부 검증 실패. 위 이슈를 수정 후 재시도하세요.")
        exit(1)
