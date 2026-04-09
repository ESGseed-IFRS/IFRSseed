import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')

from backend.core.db import get_session
from sqlalchemy import text

session = get_session()

print("=" * 80)
print("ghg_emission_results 최근 데이터 확인 (저장된 배출량)")
print("=" * 80)

result = session.execute(text("""
    SELECT 
        period_year,
        calculation_basis,
        scope1_total_tco2e,
        scope1_fixed_combustion_tco2e,
        scope2_location_tco2e,
        total_tco2e,
        emission_factor_bundle_version,
        created_at
    FROM ghg_emission_results
    ORDER BY created_at DESC
    LIMIT 3
""")).fetchall()

print(f"\n저장된 결과: {len(result)}개")
for r in result:
    print(f"\n{r[7]} ({r[0]}년, {r[1]})")
    print(f"  Scope 1: {r[2] or 0:,.2f} tCO₂eq")
    print(f"    - 고정연소: {r[3] or 0:,.2f} tCO₂eq")
    print(f"  Scope 2: {r[4] or 0:,.2f} tCO₂eq")
    print(f"  총계: {r[5] or 0:,.2f} tCO₂eq")
    print(f"  버전: {r[6]}")

print("\n" + "=" * 80)
print("ghg_activity_data에서 실제 배출량 확인 (개별 레코드)")
print("=" * 80)

result = session.execute(text("""
    SELECT 
        site_name,
        fuel_type,
        SUM(ghg_total_tco2e) as total_emission,
        COUNT(*) as record_count
    FROM ghg_activity_data
    WHERE tab_type = 'fuel_vehicle'
      AND period_year = 2024
      AND fuel_type ILIKE '%lng%'
    GROUP BY site_name, fuel_type
    ORDER BY total_emission DESC
""")).fetchall()

print(f"\nghg_activity_data LNG 배출량:")
total_activity = 0
for r in result:
    print(f"  {r[0]}: {r[2]:,.2f} tCO₂eq ({r[3]}개 레코드)")
    total_activity += float(r[2] or 0)

print(f"\nghg_activity_data 총 LNG 배출량: {total_activity:,.2f} tCO₂eq")

print("\n" + "=" * 80)
print("문제 분석")
print("=" * 80)
print(f"1. ghg_activity_data (원시 데이터): {total_activity:,.2f} tCO₂eq")
print(f"2. ghg_emission_results (저장): {result[0][2] if result else 0:,.2f} tCO₂eq")
print(f"3. 프론트엔드 표시: 438,711 tCO₂eq")
print(f"\n차이: ghg_activity_data가 ghg_emission_results보다 {total_activity / float(result[0][2] or 1):.1f}배 큽니다")

session.close()
