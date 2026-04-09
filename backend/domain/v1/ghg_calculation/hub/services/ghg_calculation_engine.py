"""GHG 배출량 계산 핵심 로직 - TJ 변환 및 배출량 산정.

ISO 14064-1 / GHG Protocol에 따른 정확한 산정 공식을 구현합니다.

공식:
  배출량(tCO₂eq) = 활동자료(TJ) × 배출계수(tCO₂eq/TJ)
  활동자료(TJ) = 연료사용량(단위) × 열량계수(TJ/단위)
  tCO₂eq = CO₂ + CH₄×GWP_CH₄ + N₂O×GWP_N₂O
"""
from __future__ import annotations

from typing import Any

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


class GhgCalculationEngine:
    """GHG 배출량 계산 엔진."""
    
    # 단위 변환 상수
    KWH_TO_TJ = 0.0000036  # 1 kWh = 0.0036 MJ = 0.0000036 TJ
    MWH_TO_TJ = 0.0036     # 1 MWh = 3.6 GJ = 0.0036 TJ
    GJ_TO_TJ = 0.001       # 1 GJ = 0.001 TJ
    MJ_TO_TJ = 0.000001    # 1 MJ = 0.000001 TJ
    
    def convert_to_tj(
        self,
        usage_amount: float,
        source_unit: str,
        heat_content_coefficient: float | None = None,
        net_calorific_value: float | None = None,
    ) -> tuple[float, str]:
        """
        사용량을 TJ(테라줄)로 변환.
        
        Args:
            usage_amount: 사용량 (예: 1000, 50000)
            source_unit: 입력 단위 (예: '천Nm³', 'kWh', 'L')
            heat_content_coefficient: 열량계수 (예: 0.0388 TJ/천Nm³)
            net_calorific_value: 순발열량 (예: 54 MJ/kg)
        
        Returns:
            (TJ 값, 변환 공식)
        """
        unit_lower = source_unit.lower().replace('³', '3').strip()
        
        # 1. 이미 TJ 단위인 경우
        if unit_lower in ['tj', 'terajoule']:
            return usage_amount, f"{usage_amount} TJ (변환 불필요)"
        
        # 2. 전력 단위 (kWh, MWh)
        if unit_lower in ['kwh', 'kw-h', 'kilowatt-hour']:
            tj = usage_amount * self.KWH_TO_TJ
            return tj, f"{usage_amount} kWh × {self.KWH_TO_TJ} = {tj} TJ"
        
        if unit_lower in ['mwh', 'mw-h', 'megawatt-hour']:
            tj = usage_amount * self.MWH_TO_TJ
            return tj, f"{usage_amount} MWh × {self.MWH_TO_TJ} = {tj} TJ"
        
        # 3. 에너지 단위 (GJ, MJ)
        if unit_lower in ['gj', 'gigajoule']:
            tj = usage_amount * self.GJ_TO_TJ
            return tj, f"{usage_amount} GJ × {self.GJ_TO_TJ} = {tj} TJ"
        
        if unit_lower in ['mj', 'megajoule']:
            tj = usage_amount * self.MJ_TO_TJ
            return tj, f"{usage_amount} MJ × {self.MJ_TO_TJ} = {tj} TJ"
        
        # 4. 열량 단위 (Gcal)
        if unit_lower in ['gcal', 'gigacalorie']:
            tj = usage_amount * 0.0041868  # 1 Gcal = 4.1868 GJ = 0.0041868 TJ
            return tj, f"{usage_amount} Gcal × 0.0041868 = {tj} TJ"
        
        # 5. 연료 단위 - 열량계수 사용
        if heat_content_coefficient:
            # Case A: 단위가 "천Nm³" 형태로 DB에 저장되어 있지만, 
            #         실제 데이터는 "Nm³"로 들어옴 → 1000으로 나눠야 함
            # Case B: 단위가 이미 "천Nm³"로 들어옴 → 그대로 사용
            
            # DB 배출계수 단위가 "천Nm³"인 경우:
            # - 입력 데이터가 "Nm³"이면 usage_amount를 1000으로 나눔
            # - 입력 데이터가 "천Nm³"이면 그대로 사용
            
            if '천' in source_unit:
                # 이미 천 단위: 그대로 사용
                tj = usage_amount * heat_content_coefficient
                return tj, f"{usage_amount} {source_unit} × {heat_content_coefficient} TJ/{source_unit} = {tj} TJ"
            else:
                # 일반 단위 (Nm³, L, kg 등): 1000으로 나눔
                # 왜냐하면 heat_content_coefficient가 TJ/천Nm³ 형태이므로
                tj = (usage_amount / 1000) * heat_content_coefficient
                return tj, f"{usage_amount} {source_unit} / 1000 × {heat_content_coefficient} = {tj} TJ"
        
        # 6. 순발열량으로 변환 (성적서 확인 케이스)
        if net_calorific_value and any(u in unit_lower for u in ['kg', 'kilogram', 'ton', 'tonne']):
            # usage_amount (kg 또는 ton) × net_calorific_value (MJ/kg) → MJ → TJ
            if 'ton' in unit_lower or 't' == unit_lower:
                usage_kg = usage_amount * 1000
            else:
                usage_kg = usage_amount
            
            mj = usage_kg * net_calorific_value
            tj = mj * self.MJ_TO_TJ
            return tj, f"{usage_amount} {source_unit} × {net_calorific_value} MJ/kg = {mj} MJ = {tj} TJ"
        
        # 7. 변환 불가
        logger.warning(
            f"TJ 변환 불가: {usage_amount} {source_unit} "
            f"(heat_coef={heat_content_coefficient}, ncv={net_calorific_value})"
        )
        return 0.0, f"변환 불가: {source_unit}"
    
    def calculate_emissions(
        self,
        activity_tj: float,
        co2_factor: float | None = None,
        ch4_factor: float | None = None,
        n2o_factor: float | None = None,
        composite_factor: float | None = None,
        ch4_gwp: float = 28,
        n2o_gwp: float = 265,
        gwp_basis: str = "AR5",
    ) -> dict[str, Any]:
        """
        활동자료(TJ)로부터 배출량 계산.
        
        Args:
            activity_tj: 활동자료 (TJ)
            co2_factor: CO₂ 배출계수 (tCO₂/TJ)
            ch4_factor: CH₄ 배출계수 (tCH₄/TJ)
            n2o_factor: N₂O 배출계수 (tN₂O/TJ)
            composite_factor: 복합 배출계수 (tCO₂eq/TJ) - 있으면 우선 사용
            ch4_gwp: CH₄ GWP (AR5: 28, AR6: 29.8)
            n2o_gwp: N₂O GWP (AR5: 265, AR6: 273)
            gwp_basis: GWP 기준 (AR5 | AR6)
        
        Returns:
            {
                'co2_emission': float,       # tCO₂
                'ch4_emission': float,       # tCH₄
                'n2o_emission': float,       # tN₂O
                'ch4_co2eq': float,          # tCO₂eq (CH₄ × GWP)
                'n2o_co2eq': float,          # tCO₂eq (N₂O × GWP)
                'total_emission': float,     # tCO₂eq
                'formula': str,              # 계산 공식
                'gwp_basis': str,            # 사용한 GWP 기준
            }
        """
        # 방법 1: 복합 배출계수가 있으면 직접 계산
        if composite_factor is not None and composite_factor > 0:
            total = activity_tj * composite_factor
            return {
                'co2_emission': None,
                'ch4_emission': None,
                'n2o_emission': None,
                'ch4_co2eq': None,
                'n2o_co2eq': None,
                'total_emission': round(total, 4),
                'formula': f"{activity_tj:.6f} TJ × {composite_factor} tCO₂eq/TJ = {total:.4f} tCO₂eq",
                'gwp_basis': gwp_basis,
                'calculation_method': 'composite_factor',
            }
        
        # 방법 2: 가스별 배출계수로 계산
        if co2_factor is not None and ch4_factor is not None and n2o_factor is not None:
            # 가스별 배출량
            co2_emission = activity_tj * co2_factor
            ch4_emission_t = activity_tj * ch4_factor
            n2o_emission_t = activity_tj * n2o_factor
            
            # GWP 적용하여 CO₂eq로 변환
            ch4_co2eq = ch4_emission_t * ch4_gwp
            n2o_co2eq = n2o_emission_t * n2o_gwp
            
            # 총 배출량
            total = co2_emission + ch4_co2eq + n2o_co2eq
            
            formula = (
                f"{activity_tj:.6f} TJ × [{co2_factor} tCO₂/TJ + "
                f"{ch4_factor}×{ch4_gwp} tCH₄/TJ + "
                f"{n2o_factor}×{n2o_gwp} tN₂O/TJ] = {total:.4f} tCO₂eq"
            )
            
            return {
                'co2_emission': round(co2_emission, 4),
                'ch4_emission': round(ch4_emission_t, 6),
                'n2o_emission': round(n2o_emission_t, 6),
                'ch4_co2eq': round(ch4_co2eq, 4),
                'n2o_co2eq': round(n2o_co2eq, 4),
                'total_emission': round(total, 4),
                'formula': formula,
                'gwp_basis': gwp_basis,
                'calculation_method': 'detailed',
            }
        
        # 방법 3: CO₂만 있는 경우 (Scope 2 전력 등)
        if co2_factor is not None:
            total = activity_tj * co2_factor
            return {
                'co2_emission': round(total, 4),
                'ch4_emission': None,
                'n2o_emission': None,
                'ch4_co2eq': None,
                'n2o_co2eq': None,
                'total_emission': round(total, 4),
                'formula': f"{activity_tj:.6f} TJ × {co2_factor} tCO₂/TJ = {total:.4f} tCO₂eq",
                'gwp_basis': gwp_basis,
                'calculation_method': 'co2_only',
            }
        
        # 계산 불가
        logger.error(f"배출량 계산 불가: activity_tj={activity_tj}, 배출계수 없음")
        return {
            'co2_emission': 0.0,
            'ch4_emission': 0.0,
            'n2o_emission': 0.0,
            'ch4_co2eq': 0.0,
            'n2o_co2eq': 0.0,
            'total_emission': 0.0,
            'formula': '계산 불가 (배출계수 없음)',
            'gwp_basis': gwp_basis,
            'calculation_method': 'none',
        }
    
    def calculate_electricity_emissions(
        self,
        usage_kwh: float,
        electricity_ef_kg_per_kwh: float = 0.4157,  # 2024년 한국 전력 배출계수
    ) -> dict[str, Any]:
        """
        Scope 2 전력 배출량 계산 (간편 버전).
        
        Args:
            usage_kwh: 전력 사용량 (kWh)
            electricity_ef_kg_per_kwh: 전력 배출계수 (kgCO₂eq/kWh)
        
        Returns:
            배출량 계산 결과
        """
        # 방법 1: kgCO2e/kWh 직접 곱셈 (가장 일반적)
        total_kg = usage_kwh * electricity_ef_kg_per_kwh
        total_t = total_kg / 1000  # kg → t 변환
        
        return {
            'co2_emission': round(total_t, 4),
            'ch4_emission': None,
            'n2o_emission': None,
            'ch4_co2eq': None,
            'n2o_co2eq': None,
            'total_emission': round(total_t, 4),
            'formula': f"{usage_kwh} kWh × {electricity_ef_kg_per_kwh} kgCO₂eq/kWh = {total_kg:.2f} kgCO₂eq = {total_t:.4f} tCO₂eq",
            'gwp_basis': 'N/A',
            'calculation_method': 'electricity_direct',
        }
    
    def calculate_refrigerant_emissions(
        self,
        refrigerant_leak_kg: float,
        gwp: float,
    ) -> dict[str, Any]:
        """
        냉매 탈루 배출량 계산 (Scope 1).
        
        Args:
            refrigerant_leak_kg: 냉매 누출량 (kg)
            gwp: 냉매 GWP
        
        Returns:
            배출량 계산 결과
        """
        # 배출량(tCO₂eq) = 누출량(t) × GWP
        leak_t = refrigerant_leak_kg / 1000
        total = leak_t * gwp
        
        return {
            'co2_emission': None,
            'ch4_emission': None,
            'n2o_emission': None,
            'ch4_co2eq': None,
            'n2o_co2eq': None,
            'total_emission': round(total, 4),
            'formula': f"{refrigerant_leak_kg} kg / 1000 × GWP {gwp} = {total:.4f} tCO₂eq",
            'gwp_basis': 'AR5',
            'calculation_method': 'refrigerant',
        }


def convert_unit_to_standard(value: float, from_unit: str, to_unit: str) -> float:
    """
    단위 변환 헬퍼 함수.
    
    Args:
        value: 변환할 값
        from_unit: 원본 단위
        to_unit: 목표 단위
    
    Returns:
        변환된 값
    """
    conversions = {
        # 에너지
        ('kWh', 'MWh'): 0.001,
        ('MWh', 'kWh'): 1000,
        ('kWh', 'TJ'): 0.0000036,
        ('MWh', 'TJ'): 0.0036,
        ('GJ', 'TJ'): 0.001,
        ('MJ', 'TJ'): 0.000001,
        ('Gcal', 'TJ'): 0.0041868,
        
        # 부피 (가스)
        ('Nm³', '천Nm³'): 0.001,
        ('천Nm³', 'Nm³'): 1000,
        ('m³', '천m³'): 0.001,
        
        # 부피 (액체)
        ('L', '천L'): 0.001,
        ('천L', 'L'): 1000,
        ('kL', '천L'): 1,
        
        # 질량
        ('kg', 't'): 0.001,
        ('t', 'kg'): 1000,
        ('kg', '천kg'): 0.001,
        ('ton', 't'): 1,
        ('천톤', 't'): 1000,
    }
    
    key = (from_unit, to_unit)
    if key in conversions:
        return value * conversions[key]
    
    # 동일 단위
    if from_unit.lower() == to_unit.lower():
        return value
    
    logger.warning(f"지원하지 않는 단위 변환: {from_unit} → {to_unit}")
    return value


def example_calculation():
    """계산 예제."""
    engine = GhgCalculationEngine()
    
    print("=" * 80)
    print("GHG 배출량 계산 예제")
    print("=" * 80)
    
    # 예제 1: LNG 1,000 천Nm³
    print("\n[예제 1] LNG 1,000 천Nm³ 사용")
    tj, formula = engine.convert_to_tj(
        usage_amount=1000,
        source_unit="천Nm³",
        heat_content_coefficient=0.0388,  # TJ/천Nm³
    )
    print(f"  활동자료: {formula}")
    
    emissions = engine.calculate_emissions(
        activity_tj=tj,
        co2_factor=56.1,
        ch4_factor=0.001,  # 1 kg/TJ = 0.001 t/TJ
        n2o_factor=0.0001,  # 0.1 kg/TJ = 0.0001 t/TJ
        ch4_gwp=28,
        n2o_gwp=265,
    )
    print(f"  배출량: {emissions['formula']}")
    print(f"  총 배출량: {emissions['total_emission']} tCO₂eq")
    print(f"    - CO₂: {emissions['co2_emission']} tCO₂")
    print(f"    - CH₄: {emissions['ch4_co2eq']} tCO₂eq")
    print(f"    - N₂O: {emissions['n2o_co2eq']} tCO₂eq")
    
    # 예제 2: 전력 50,000 kWh
    print("\n[예제 2] 전력 50,000 kWh 사용")
    emissions = engine.calculate_electricity_emissions(
        usage_kwh=50000,
        electricity_ef_kg_per_kwh=0.4157,
    )
    print(f"  배출량: {emissions['formula']}")
    print(f"  총 배출량: {emissions['total_emission']} tCO₂eq")
    
    # 예제 3: HFC-134a 냉매 10 kg 누출
    print("\n[예제 3] HFC-134a 냉매 10 kg 누출")
    emissions = engine.calculate_refrigerant_emissions(
        refrigerant_leak_kg=10,
        gwp=1300,  # AR5
    )
    print(f"  배출량: {emissions['formula']}")
    print(f"  총 배출량: {emissions['total_emission']} tCO₂eq")


if __name__ == "__main__":
    example_calculation()
