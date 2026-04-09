import sys
import json
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')

from backend.core.db import get_session
from sqlalchemy import text

session = get_session()

print("=" * 80)
print("LNG 스테이징 데이터 분석")
print("=" * 80)

# LNG 데이터
result = session.execute(text("""
    SELECT raw_data
    FROM staging_ems_data
    WHERE raw_data::text ILIKE '%lng%'
    LIMIT 1
""")).fetchone()

if result:
    raw_data = result[0]
    items = raw_data.get('items', [])
    
    if items:
        first_item = items[0]
        print("\n첫 번째 LNG 항목:")
        print(f"  시설: {first_item.get('facility')}")
        print(f"  에너지 타입: {first_item.get('energy_type')}")
        print(f"  단위: {first_item.get('unit')}")
        
        # 월별 합계
        total = 0
        for m in ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']:
            val = float(first_item.get(m, 0) or 0)
            total += val
        
        print(f"  연간 사용량: {total:,.0f} {first_item.get('unit')}")
        print(f"  1월 사용량: {first_item.get('jan', 0)} {first_item.get('unit')}")

print("\n" + "=" * 80)
print("전력 스테이징 데이터 분석")
print("=" * 80)

result = session.execute(text("""
    SELECT raw_data
    FROM staging_ems_data
    WHERE raw_data::text ILIKE '%전력%'
    LIMIT 1
""")).fetchone()

if result:
    raw_data = result[0]
    items = raw_data.get('items', [])
    
    if items:
        first_item = items[0]
        print("\n첫 번째 전력 항목:")
        print(f"  시설: {first_item.get('facility')}")
        print(f"  에너지 타입: {first_item.get('energy_type')}")
        print(f"  단위: {first_item.get('unit')}")
        
        # 월별 합계
        total = 0
        for m in ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']:
            val = float(first_item.get(m, 0) or 0)
            total += val
        
        print(f"  연간 사용량: {total:,.0f} {first_item.get('unit')}")
        print(f"  1월 사용량: {first_item.get('jan', 0)} {first_item.get('unit')}")

print("\n" + "=" * 80)
print("계산 비교 (예상)")
print("=" * 80)

# LNG 예상 배출량
lng_usage = 0
result = session.execute(text("""
    SELECT raw_data
    FROM staging_ems_data
    WHERE raw_data::text ILIKE '%lng%'
""")).fetchall()

for row in result:
    items = row[0].get('items', [])
    for item in items:
        for m in ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']:
            lng_usage += float(item.get(m, 0) or 0)

print(f"\nLNG 총 사용량: {lng_usage:,.0f} Nm³")
print(f"LNG 예상 TJ: {lng_usage / 1000 * 0.0388:.2f} TJ")
print(f"LNG 예상 배출량: {lng_usage / 1000 * 0.0388 * 56.1552:.2f} tCO₂eq")

# 전력 예상 배출량
elec_usage = 0
result = session.execute(text("""
    SELECT raw_data
    FROM staging_ems_data
    WHERE raw_data::text ILIKE '%전력%'
""")).fetchall()

for row in result:
    items = row[0].get('items', [])
    for item in items:
        for m in ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']:
            elec_usage += float(item.get(m, 0) or 0)

print(f"\n전력 총 사용량: {elec_usage:,.0f} kWh")
print(f"전력 예상 배출량: {elec_usage * 0.4157 / 1000:.2f} tCO₂eq")

session.close()
