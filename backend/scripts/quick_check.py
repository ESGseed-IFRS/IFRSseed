import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')

from backend.core.db import get_session
from sqlalchemy import text

session = get_session()

print("=" * 80)
print("최근 저장된 Scope 결과")
print("=" * 80)

result = session.execute(text("""
    SELECT 
        scope1_total_tco2e,
        scope2_location_tco2e,
        total_tco2e
    FROM ghg_emission_results
    WHERE period_year = 2024
    ORDER BY created_at DESC
    LIMIT 1
""")).fetchone()

if result:
    print(f"Scope 1: {result[0]:,.2f} tCO₂eq")
    print(f"Scope 2: {result[1]:,.2f} tCO₂eq")
    print(f"총계: {result[2]:,.2f} tCO₂eq")

session.close()
