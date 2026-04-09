import sys
sys.path.insert(0, '.')

from backend.core.db import get_session
from sqlalchemy import text

session = get_session()

print("=" * 80)
print("스테이징 EMS 데이터 샘플 (LNG)")
print("=" * 80)

# LNG 데이터 확인
rows = session.execute(text("""
    SELECT source_file, data_type, system_key,
           jsonb_array_length(data->'items') as item_count
    FROM staging_ems_data
    WHERE data::text ILIKE '%lng%' OR data::text ILIKE '%천연가스%'
    LIMIT 3
""")).fetchall()

print(f"LNG 관련 EMS 파일: {len(rows)}개")
for r in rows:
    print(f"  - {r[0]} ({r[1]}, {r[2]}) - {r[3]}개 항목")

if rows:
    print("\n상세 데이터 (첫 항목):")
    detail = session.execute(text("""
        SELECT data->'items'->0 as first_item
        FROM staging_ems_data
        WHERE data::text ILIKE '%lng%'
        LIMIT 1
    """)).fetchone()
    
    if detail:
        import json
        item = detail[0]
        if isinstance(item, dict):
            print(f"  시설: {item.get('facility', 'N/A')}")
            print(f"  에너지 타입: {item.get('energy_type', 'N/A')}")
            print(f"  단위: {item.get('unit', 'N/A')}")
            # 월별 데이터 샘플
            for month in ['jan', 'feb', 'mar']:
                if month in item:
                    print(f"  {month}: {item[month]}")

print("\n" + "=" * 80)
print("전력 데이터 샘플")
print("=" * 80)

# 전력 데이터
rows = session.execute(text("""
    SELECT source_file, data_type, system_key,
           jsonb_array_length(data->'items') as item_count
    FROM staging_ems_data
    WHERE data_type = 'energy' AND (data::text ILIKE '%전력%' OR data::text ILIKE '%electric%')
    LIMIT 3
""")).fetchall()

print(f"전력 관련 EMS 파일: {len(rows)}개")
for r in rows:
    print(f"  - {r[0]} ({r[1]}, {r[2]}) - {r[3]}개 항목")

if rows:
    print("\n상세 데이터 (첫 항목):")
    detail = session.execute(text("""
        SELECT data->'items'->0 as first_item
        FROM staging_ems_data
        WHERE data::text ILIKE '%전력%'
        LIMIT 1
    """)).fetchone()
    
    if detail:
        import json
        item = detail[0]
        if isinstance(item, dict):
            print(f"  시설: {item.get('facility', 'N/A')}")
            print(f"  에너지 타입: {item.get('energy_type', 'N/A')}")
            print(f"  단위: {item.get('unit', 'N/A')}")
            # 월별 데이터 샘플
            total = 0
            for month in ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']:
                if month in item:
                    val = float(item[month] or 0)
                    total += val
            print(f"  연간 합계: {total}")

session.close()
