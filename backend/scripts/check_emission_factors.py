import sys
sys.path.insert(0, '.')

from backend.core.db import get_session
from sqlalchemy import text

session = get_session()

print("=" * 80)
print("DB에 저장된 LNG 배출계수")
print("=" * 80)

rows = session.execute(text("""
    SELECT factor_code, factor_name_ko, source_unit, 
           heat_content_coefficient, composite_factor, composite_factor_unit
    FROM emission_factors 
    WHERE fuel_type LIKE :pattern
    ORDER BY factor_code
"""), {"pattern": "%lng%"}).fetchall()

for r in rows:
    print(f"{r[0]}")
    print(f"  - 한글명: {r[1]}")
    print(f"  - 단위: {r[2]}")
    print(f"  - 열량계수: {r[3]} TJ/{r[2]}")
    print(f"  - 복합계수: {r[4]} {r[5]}")
    print()

print("=" * 80)
print("전력 배출계수")
print("=" * 80)

rows = session.execute(text("""
    SELECT factor_code, factor_name_ko, source_unit, composite_factor, composite_factor_unit
    FROM emission_factors 
    WHERE fuel_type = 'electricity'
    ORDER BY reference_year DESC
""")).fetchall()

for r in rows:
    print(f"{r[0]}: {r[1]} | 단위: {r[2]} | 배출계수: {r[3]} {r[4]}")

session.close()
