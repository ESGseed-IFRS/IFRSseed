"""빠른 매칭 확인 스크립트"""
import json
from pathlib import Path

# 파일 경로
script_dir = Path(__file__).parent.resolve()
data_dir = script_dir.parent / "data" / "esrs" / "esrs_e1"

# data_point.json 로드
with open(data_dir / "data_point.json", 'r', encoding='utf-8') as f:
    dp_data = json.load(f)

# rulebook.json 로드
with open(data_dir / "rulebook.json", 'r', encoding='utf-8') as f:
    rb_data = json.load(f)

# dp_id 집합 생성
dp_ids = set()
if isinstance(dp_data, dict) and "data_points" in dp_data:
    for dp in dp_data["data_points"]:
        if dp.get("dp_id"):
            dp_ids.add(dp["dp_id"])
elif isinstance(dp_data, list):
    for dp in dp_data:
        if dp.get("dp_id"):
            dp_ids.add(dp["dp_id"])

# primary_dp_id 추출 및 매칭 확인
rulebooks = rb_data.get("rulebooks", []) if isinstance(rb_data, dict) else rb_data
unmatched = []
null_primary = []
referenced_dp_ids = set()  # rulebook에서 참조된 dp_id 집합

for rb in rulebooks:
    primary_dp_id = rb.get("primary_dp_id")
    if not primary_dp_id:
        null_primary.append({
            "rulebook_id": rb.get("rulebook_id"),
            "section_name": rb.get("section_name", "")[:50]
        })
    elif primary_dp_id not in dp_ids:
        unmatched.append({
            "rulebook_id": rb.get("rulebook_id"),
            "primary_dp_id": primary_dp_id,
            "section_name": rb.get("section_name", "")[:50]
        })
    else:
        referenced_dp_ids.add(primary_dp_id)

# 참조되지 않은 dp_id 찾기
unreferenced_dp_ids = []
for dp_id in dp_ids:
    if dp_id not in referenced_dp_ids:
        unreferenced_dp_ids.append(dp_id)

# 결과 출력
print("=" * 60)
print("매칭 결과")
print("=" * 60)
print(f"총 Data Point 수: {len(dp_ids)}")
print(f"총 Rulebook 수: {len(rulebooks)}")
print(f"참조된 Data Point 수: {len(referenced_dp_ids)}")
print(f"참조되지 않은 Data Point 수: {len(unreferenced_dp_ids)}")
print(f"primary_dp_id가 NULL인 Rulebook: {len(null_primary)}개")
print(f"매칭되지 않은 primary_dp_id: {len(unmatched)}개")
print()

if null_primary:
    print("=" * 60)
    print("primary_dp_id가 NULL인 Rulebook:")
    print("=" * 60)
    for item in null_primary[:10]:  # 처음 10개만
        print(f"  - {item['rulebook_id']}: {item['section_name']}")
    if len(null_primary) > 10:
        print(f"  ... 외 {len(null_primary) - 10}개")
    print()

if unmatched:
    print("=" * 60)
    print("매칭되지 않은 primary_dp_id:")
    print("=" * 60)
    for item in unmatched:
        print(f"  - Rulebook ID: {item['rulebook_id']}")
        print(f"    Primary DP ID: {item['primary_dp_id']}")
        print(f"    Section: {item['section_name']}")
        print()
else:
    print("✅ 모든 primary_dp_id가 data_point.json의 dp_id와 매칭됩니다!")

if unreferenced_dp_ids:
    print("=" * 60)
    print("참조되지 않은 dp_id (rulebook의 primary_dp_id로 사용되지 않음):")
    print("=" * 60)
    # data_point 정보도 함께 출력
    dp_list = dp_data.get("data_points", []) if isinstance(dp_data, dict) else dp_data
    dp_map = {dp.get("dp_id"): dp for dp in dp_list if dp.get("dp_id")}
    
    for dp_id in sorted(unreferenced_dp_ids):
        dp_info = dp_map.get(dp_id, {})
        name_ko = dp_info.get("name_ko", "")
        print(f"  - {dp_id}: {name_ko[:60] if name_ko else '(이름 없음)'}")
    print()
else:
    print("✅ 모든 dp_id가 rulebook의 primary_dp_id로 참조됩니다!")
