import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')

from backend.core.db import get_session
from sqlalchemy import text
import json

session = get_session()

print("=" * 80)
print("스테이징 EMS 데이터에서 LNG 상세 확인")
print("=" * 80)

# LNG 관련 스테이징 데이터
result = session.execute(text("""
    SELECT 
        id,
        source_file_name,
        ghg_raw_category,
        jsonb_array_length(raw_data->'items') as item_count,
        imported_at
    FROM staging_ems_data
    WHERE ghg_raw_category = 'energy'
      AND raw_data::text ILIKE '%lng%'
    ORDER BY imported_at DESC
    LIMIT 5
""")).fetchall()

print(f"\nLNG 포함 파일: {len(result)}개")
for r in result:
    print(f"\n파일: {r[1]}")
    print(f"  카테고리: {r[2]}")
    print(f"  항목 수: {r[3]}")
    print(f"  업로드: {r[4]}")
    
    # 첫 번째 LNG 항목 샘플
    detail = session.execute(text("""
        SELECT raw_data->'items' as items
        FROM staging_ems_data
        WHERE id = :id
    """), {"id": r[0]}).fetchone()
    
    if detail and detail[0]:
        items = detail[0]
        lng_items = [item for item in items if isinstance(item, dict) and 
                     'lng' in str(item.get('energy_type', '')).lower()]
        
        print(f"  LNG 항목: {len(lng_items)}개")
        
        if lng_items:
            sample = lng_items[0]
            print(f"\n  샘플 데이터:")
            print(f"    시설: {sample.get('facility', 'N/A')}")
            print(f"    에너지 타입: {sample.get('energy_type', 'N/A')}")
            print(f"    단위: {sample.get('usage_unit') or sample.get('unit', 'N/A')}")
            print(f"    연도: {sample.get('year', 'N/A')}")
            
            # 월별 사용량 합계
            total = 0
            months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                     'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
            for m in months:
                val = float(sample.get(m, 0) or 0)
                total += val
            
            print(f"    연간 합계: {total:,.0f}")
            print(f"    1월: {sample.get('jan', 0)}, 2월: {sample.get('feb', 0)}")

print("\n" + "=" * 80)
print("전체 energy 스테이징 파일 수")
print("=" * 80)

count = session.execute(text("""
    SELECT COUNT(*) 
    FROM staging_ems_data 
    WHERE ghg_raw_category = 'energy'
""")).scalar()

print(f"총 {count}개 energy 파일")

session.close()
