import sys
import json
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')

from backend.core.db import get_session
from sqlalchemy import text

session = get_session()

print("=" * 80)
print("최근 Scope 산정 결과 분석")
print("=" * 80)

# 최근 산정 결과
result = session.execute(text("""
    SELECT 
        period_year,
        calculation_basis,
        scope1_total_tco2e,
        scope1_fixed_combustion_tco2e,
        scope1_mobile_combustion_tco2e,
        scope2_location_tco2e,
        scope2_market_tco2e,
        total_tco2e,
        emission_factor_bundle_version,
        scope_line_items
    FROM ghg_emission_results
    ORDER BY created_at DESC
    LIMIT 1
""")).fetchone()

if result:
    print(f"\n연도: {result[0]}")
    print(f"방법론: {result[1]}")
    print(f"Scope 1 총계: {result[2] or 0:,.2f} tCO₂eq")
    print(f"  - 고정연소: {result[3] or 0:,.2f} tCO₂eq")
    print(f"  - 이동연소: {result[4] or 0:,.2f} tCO₂eq")
    print(f"Scope 2 총계: {result[5] or 0:,.2f} tCO₂eq")
    print(f"총 배출량: {result[7] or 0:,.2f} tCO₂eq")
    print(f"배출계수 버전: {result[8]}")
    
    print("\n" + "=" * 80)
    print("Scope 1 상세 (고정연소)")
    print("=" * 80)
    
    line_items = result[9]
    if line_items and isinstance(line_items, dict):
        s1_cats = line_items.get('scope1_categories', [])
        
        for cat in s1_cats:
            if cat.get('id') == 's1-fixed':
                items = cat.get('items', [])
                print(f"\n고정연소 항목: {len(items)}개")
                
                for item in items[:5]:  # 첫 5개만
                    print(f"\n  {item.get('name')}:")
                    print(f"    - 시설: {item.get('facility')}")
                    print(f"    - 배출계수: {item.get('ef')}")
                    print(f"    - 출처: {item.get('ef_source')}")
                    print(f"    - 연간 배출량: {item.get('total'):,.2f} tCO₂eq")
                    print(f"    - 1월: {item.get('jan'):,.2f}, 2월: {item.get('feb'):,.2f}")
    
    print("\n" + "=" * 80)
    print("Scope 2 상세 (전력)")
    print("=" * 80)
    
    if line_items and isinstance(line_items, dict):
        s2_cats = line_items.get('scope2_categories', [])
        
        for cat in s2_cats:
            if cat.get('id') == 's2-grid':
                items = cat.get('items', [])
                print(f"\n전력 항목: {len(items)}개")
                
                for item in items[:5]:  # 첫 5개만
                    print(f"\n  {item.get('name')}:")
                    print(f"    - 시설: {item.get('facility')}")
                    print(f"    - 배출계수: {item.get('ef')}")
                    print(f"    - 출처: {item.get('ef_source')}")
                    print(f"    - 연간 배출량: {item.get('total'):,.2f} tCO₂eq")

session.close()
