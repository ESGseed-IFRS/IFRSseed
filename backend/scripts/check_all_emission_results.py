import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')

from backend.core.db import get_session
from sqlalchemy import text

session = get_session()

print("=" * 80)
print("ghg_emission_results 전체 레코드 확인")
print("=" * 80)

result = session.execute(text("""
    SELECT 
        id,
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
    LIMIT 10
""")).fetchall()

print(f"\n총 {len(result)}개 레코드:")
for i, r in enumerate(result, 1):
    print(f"\n{i}. ID: {str(r[0])[:8]}...")
    print(f"   생성: {r[8]}")
    print(f"   연도: {r[1]}, 방법론: {r[2]}")
    print(f"   Scope 1: {r[3]:,.4f} tCO₂eq")
    print(f"     - 고정연소: {r[4]:,.4f} tCO₂eq")
    print(f"   Scope 2: {r[5]:,.4f} tCO₂eq")
    print(f"   총계: {r[6]:,.4f} tCO₂eq")
    print(f"   버전: {r[7]}")

print("\n" + "=" * 80)
print("이미지 값과 비교")
print("=" * 80)
print(f"이미지 Scope 1: 473928.5938")
print(f"DB 최근 레코드: {result[0][3]:,.4f}" if result else "레코드 없음")
print(f"차이: {abs(result[0][3] - 473928.5938):.4f}" if result and result[0][3] else "N/A")

session.close()
