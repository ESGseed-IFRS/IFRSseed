import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')

from backend.core.db import get_session
from sqlalchemy import text

session = get_session()

print("=" * 80)
print("OLD 배출계수 (ghg_emission_factors) - v1.0")
print("=" * 80)

result = session.execute(text("""
    SELECT 
        fuel_type,
        source_unit,
        composite_factor,
        year_applicable,
        version,
        source
    FROM ghg_emission_factors
    WHERE version = 'v1.0' AND fuel_type LIKE '%LNG%'
""")).fetchall()

print("\nOLD LNG 계수:")
for r in result:
    print(f"  {r[0]}: {r[2]} tCO₂eq/{r[1]} (출처: {r[5]})")

print("\n" + "=" * 80)
print("NEW 배출계수 (emission_factors) - v2.0")
print("=" * 80)

result = session.execute(text("""
    SELECT 
        fuel_type,
        source_unit,
        heat_content_coefficient,
        composite_factor,
        composite_factor_unit,
        reference_source
    FROM emission_factors
    WHERE fuel_type LIKE '%lng%'
""")).fetchall()

print("\nNEW LNG 계수:")
for r in result:
    print(f"  {r[0]}")
    print(f"    단위: {r[1]}")
    print(f"    열량계수: {r[2]} TJ/{r[1]}")
    print(f"    복합계수: {r[3]} {r[4]}")
    print(f"    출처: {r[5]}")

print("\n" + "=" * 80)
print("차이 분석")
print("=" * 80)

old_factor = 0.002179  # tCO₂eq/Nm³
new_factor_tj = 0.0388  # TJ/천Nm³
new_factor_ghg = 56.1552  # tCO₂eq/TJ

# 1 Nm³ 기준
old_emission = 1000000 * old_factor  # 1백만 Nm³
new_emission = (1000000 / 1000) * new_factor_tj * new_factor_ghg  # 1백만 Nm³

print(f"\n1백만 Nm³ 기준:")
print(f"  OLD: {old_emission:,.2f} tCO₂eq")
print(f"  NEW: {new_emission:,.2f} tCO₂eq")
print(f"  배율: {new_emission / old_emission:.1f}x")

# 실제 LNG 사용량 기준
lng_usage = 110353379  # Nm³
old_total = lng_usage * old_factor
new_total = (lng_usage / 1000) * new_factor_tj * new_factor_ghg

print(f"\n실제 LNG 사용량 ({lng_usage:,} Nm³):")
print(f"  OLD: {old_total:,.2f} tCO₂eq")
print(f"  NEW: {new_total:,.2f} tCO₂eq")
print(f"  차이: {new_total - old_total:,.2f} tCO₂eq")

session.close()
