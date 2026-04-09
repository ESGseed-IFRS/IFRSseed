import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')

from backend.core.db import get_session
from sqlalchemy import text

session = get_session()

print("=" * 80)
print("ghg_activity_data에서 LNG 데이터 확인")
print("=" * 80)

result = session.execute(text("""
    SELECT 
        site_name,
        fuel_type,
        fuel_unit,
        SUM(consumption_amount) as total_usage,
        AVG(ghg_total_tco2e) as avg_emission_per_record
    FROM ghg_activity_data
    WHERE tab_type = 'fuel_vehicle'
      AND fuel_type ILIKE '%lng%'
      AND period_year = 2024
    GROUP BY site_name, fuel_type, fuel_unit
    ORDER BY total_usage DESC
""")).fetchall()

print(f"\n총 {len(result)}개 시설")
total_lng = 0
total_emission = 0

for r in result:
    print(f"\n{r[0]}:")
    print(f"  연료: {r[1]}")
    print(f"  단위: {r[2]}")
    print(f"  총 사용량: {r[3]:,.0f} {r[2]}")
    print(f"  평균 배출량/레코드: {r[4] or 0:,.2f} tCO₂eq")
    total_lng += float(r[3] or 0)
    total_emission += float(r[4] or 0) * 12  # 월별 레코드

print(f"\n전체 LNG 사용량: {total_lng:,.0f} Nm³")
print(f"OLD 계수 예상 배출량: {total_lng * 0.002179:,.2f} tCO₂eq")
print(f"NEW 계수 예상 배출량: {total_lng / 1000 * 0.0388 * 56.1552:,.2f} tCO₂eq")

session.close()
