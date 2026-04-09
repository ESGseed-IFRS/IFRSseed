"""Excel 배출계수 파싱 및 분석 스크립트.

Excel 파일(GHG_배출계수_마스터_v2.xlsx)을 읽어서
DB에 임포트할 수 있는 형태로 변환합니다.

Usage:
    python scripts/parse_emission_factors_excel.py <excel_path>
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pandas as pd

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


class EmissionFactorExcelParser:
    """배출계수 Excel 파서."""
    
    def __init__(self, excel_path: str):
        self.excel_path = Path(excel_path)
        self.xls = pd.ExcelFile(self.excel_path)
        
    def parse_scope1_stationary(self) -> list[dict[str, Any]]:
        """
        Scope 1 고정연소 배출계수 파싱.
        
        Returns:
            배출계수 데이터 리스트
        """
        # Sheet 1: Scope 1 고정연소 (header=2)
        df = pd.read_excel(self.xls, sheet_name=1, header=2)
        
        # 컬럼명이 'Unnamed'로 되어있으므로 첫 번째 행이 실제 컬럼명
        # 첫 번째 행을 컬럼으로 사용
        new_header = df.iloc[0]
        df = df[1:]
        df.columns = new_header
        
        results = []
        
        for _, row in df.iterrows():
            # 빈 행 또는 구분 행 건너뛰기
            no_val = row.get('No.')
            if pd.isna(no_val):
                continue
            
            # 문자열 구분 행 건너뛰기
            try:
                no = int(float(no_val))
            except (ValueError, TypeError):
                # '기체연료', '액체연료' 등
                continue
            
            fuel_name = str(row['연료 종류']).strip()
            
            # 열량계수 파싱
            heat_coef_str = str(row.get('열량계수\n(연료단위→TJ)', ''))
            if '성적서 확인' in heat_coef_str or heat_coef_str == 'nan' or not heat_coef_str:
                heat_coef = None
            else:
                try:
                    heat_coef = float(heat_coef_str)
                except ValueError:
                    heat_coef = None
            
            # 순발열량
            try:
                ncv = float(row.get('순발열량\n(MJ/kg·Nm³)', 0))
                if ncv == 0:
                    ncv = None
            except (ValueError, TypeError):
                ncv = None
            
            # GHG 배출계수
            try:
                co2 = float(row.get('CO₂\n(tCO₂/TJ)', 0))
                if co2 == 0:
                    co2 = None
            except (ValueError, TypeError):
                co2 = None
                
            try:
                ch4_kg = float(row.get('CH₄\n(kgCH₄/TJ)', 0))
                ch4 = ch4_kg / 1000 if ch4_kg > 0 else None  # kg → t 변환
            except (ValueError, TypeError):
                ch4 = None
                
            try:
                n2o_kg = float(row.get('N₂O\n(kgN₂O/TJ)', 0))
                n2o = n2o_kg / 1000 if n2o_kg > 0 else None  # kg → t 변환
            except (ValueError, TypeError):
                n2o = None
            
            # 복합 배출계수
            try:
                composite_str = row.get('★배출계수\n(tCO₂eq/TJ)', 0)
                composite = float(composite_str)
                if composite == 0:
                    # 계산: CO₂ + CH₄×28 + N₂O×265 (AR5 기준)
                    if co2 and ch4 and n2o:
                        composite = co2 + ch4 * 28 + n2o * 265
                    else:
                        composite = None
            except (ValueError, TypeError):
                # 계산: CO₂ + CH₄×28 + N₂O×265 (AR5 기준)
                if co2 and ch4 and n2o:
                    composite = co2 + ch4 * 28 + n2o * 265
                else:
                    composite = None
            
            # 연료 단위
            fuel_unit = str(row.get('연료단위', '')).strip()
            source = str(row.get('출처', '')).strip()
            notes_val = row.get('실무 산정 메모')
            notes = str(notes_val).strip() if not pd.isna(notes_val) else None
            
            # 연료 타입 추출 (소문자, 공백 제거)
            fuel_type = fuel_name.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('-', '_')
            
            # Source unit 추출 (TJ/ 이후 부분)
            if '/' in fuel_unit and 'TJ' in fuel_unit:
                source_unit = fuel_unit.split('/')[-1]
            else:
                source_unit = fuel_unit if fuel_unit else 'TJ'
            
            # 카테고리 분류 (No 기준)
            if no <= 3:
                category = '고정연소_기체연료'
            elif no <= 12:
                category = '고정연소_액체연료'
            else:
                category = '고정연소_고체연료'
            
            data = {
                'no': no,
                'factor_code': f"KR_2024_{fuel_type.upper()}",
                'factor_name_ko': fuel_name,
                'factor_name_en': self._translate_fuel_name(fuel_name),
                'applicable_scope': 'Scope1',
                'applicable_category': category,
                'fuel_type': fuel_type,
                'heat_content_coefficient': heat_coef,
                'heat_content_unit': fuel_unit if heat_coef else None,
                'net_calorific_value': ncv,
                'ncv_unit': 'MJ/kg' if ncv else None,
                'co2_factor': co2,
                'ch4_factor': ch4,
                'n2o_factor': n2o,
                'composite_factor': composite,
                'composite_factor_unit': 'tCO₂eq/TJ',
                'gwp_basis': 'AR5',
                'ch4_gwp': 28,
                'n2o_gwp': 265,
                'source_unit': source_unit,
                'reference_year': 2024,
                'reference_source': source,
                'version': 'v2.0',
                'notes': notes,
            }
            
            results.append(data)
        
        return results
    
    def parse_scope2_electricity(self) -> list[dict[str, Any]]:
        """
        Scope 2 전력 배출계수 파싱.
        
        Note: Sheet 3 구조에 따라 조정 필요. 
        여기서는 2024년 한국 전력 배출계수를 하드코딩합니다.
        
        Returns:
            전력 배출계수 데이터 리스트
        """
        results = []
        
        # 2024년 한국 전력 배출계수 (환경부 고시)
        # 0.4157 kgCO₂eq/kWh = 415.7 tCO₂eq/GWh
        results.append({
            'factor_code': 'KR_2024_GRID_ELECTRICITY',
            'factor_name_ko': '한국 전력망 (2024년)',
            'factor_name_en': 'Korea Grid Electricity (2024)',
            'applicable_scope': 'Scope2',
            'applicable_category': '전력',
            'fuel_type': 'electricity',
            'composite_factor': 0.4157,  # kgCO2e/kWh
            'composite_factor_unit': 'kgCO₂eq/kWh',
            'source_unit': 'kWh',
            'reference_year': 2024,
            'reference_source': '환경부 온실가스 배출계수 고시 2024',
            'gwp_basis': 'AR5',
            'version': 'v2.0',
            'notes': '한국전력 발전믹스 기준. 연도별 업데이트 필요',
        })
        
        # 2023년 전력 배출계수 (참고용)
        results.append({
            'factor_code': 'KR_2023_GRID_ELECTRICITY',
            'factor_name_ko': '한국 전력망 (2023년)',
            'factor_name_en': 'Korea Grid Electricity (2023)',
            'applicable_scope': 'Scope2',
            'applicable_category': '전력',
            'fuel_type': 'electricity',
            'composite_factor': 0.4593,  # kgCO2e/kWh
            'composite_factor_unit': 'kgCO₂eq/kWh',
            'source_unit': 'kWh',
            'reference_year': 2023,
            'reference_source': '환경부 온실가스 배출계수 고시 2023',
            'gwp_basis': 'AR5',
            'version': 'v2.0',
            'notes': '2023년 기준. 2024년 개정으로 감소',
        })
        
        # 지역난방 (스팀/온수)
        results.append({
            'factor_code': 'KR_2024_DISTRICT_HEAT',
            'factor_name_ko': '지역난방 (열)',
            'factor_name_en': 'District Heat',
            'applicable_scope': 'Scope2',
            'applicable_category': '열',
            'fuel_type': 'district_heat',
            'composite_factor': 0.0694,  # tCO2e/GJ (예시)
            'composite_factor_unit': 'tCO₂eq/GJ',
            'source_unit': 'GJ',
            'reference_year': 2024,
            'reference_source': '환경부 고시',
            'gwp_basis': 'AR5',
            'version': 'v2.0',
            'notes': '지역난방공사 공급 열',
        })
        
        return results
    
    def parse_refrigerants(self) -> list[dict[str, Any]]:
        """
        냉매(HFC/PFC) GWP 파싱.
        
        Returns:
            냉매 GWP 데이터 리스트
        """
        results = []
        
        # Sheet 3: Scope1_공정·냉매
        try:
            df = pd.read_excel(self.xls, sheet_name=3, header=2)
            
            # 첫 번째 행이 실제 컬럼명
            new_header = df.iloc[0]
            df = df[1:]
            df.columns = new_header
            
            for _, row in df.iterrows():
                refrigerant_name = row.get('냉매 종류')
                if pd.isna(refrigerant_name):
                    continue
                
                refrigerant_name = str(refrigerant_name).strip()
                if not refrigerant_name or refrigerant_name == 'nan':
                    continue
                
                formula = str(row.get('화학식', '')).strip()
                
                try:
                    ar5_gwp_val = row.get('AR5 GWP', 0)
                    ar5_gwp = float(ar5_gwp_val) if not pd.isna(ar5_gwp_val) else None
                except (ValueError, TypeError):
                    ar5_gwp = None
                
                try:
                    ar6_gwp_val = row.get('AR6 GWP')
                    if pd.isna(ar6_gwp_val) or str(ar6_gwp_val) in ['미확정', 'nan', '']:
                        ar6_gwp = ar5_gwp
                    else:
                        ar6_gwp = float(ar6_gwp_val)
                except (ValueError, TypeError):
                    ar6_gwp = ar5_gwp
                
                # 한국 기준 GWP
                gwp_kr_col = row.get('★적용 GWP\n(한국 기준:AR5)')
                if pd.isna(gwp_kr_col):
                    gwp_kr = ar5_gwp
                else:
                    try:
                        gwp_kr = float(gwp_kr_col)
                    except (ValueError, TypeError):
                        gwp_kr = ar5_gwp
                
                usage = str(row.get('주요 용도', '')).strip() if not pd.isna(row.get('주요 용도')) else ''
                note = str(row.get('산정 방법 및 메모', '')).strip() if not pd.isna(row.get('산정 방법 및 메모')) else ''
                
                # fuel_type 생성
                fuel_type = refrigerant_name.lower().replace('-', '_').replace('(', '').replace(')', '').replace(' ', '_')
                
                if gwp_kr is None or gwp_kr == 0:
                    print(f"냉매 {refrigerant_name} GWP 값 없음, 건너뜀")
                    continue
                
                data = {
                    'factor_code': f"KR_2024_REFRIGERANT_{fuel_type.upper()}",
                    'factor_name_ko': refrigerant_name,
                    'factor_name_en': refrigerant_name,  # 냉매는 국제 표준명
                    'applicable_scope': 'Scope1',
                    'applicable_category': '냉매 탈루',
                    'fuel_type': fuel_type,
                    'composite_factor': gwp_kr,
                    'composite_factor_unit': 'tCO₂eq/t',
                    'gwp_basis': 'AR5',
                    'gwp_value': gwp_kr,
                    'source_unit': 't',
                    'reference_year': 2024,
                    'reference_source': 'IPCC AR5',
                    'version': 'v2.0',
                    'notes': f"화학식: {formula}. AR5 GWP: {ar5_gwp}. AR6 GWP: {ar6_gwp}. 주요 용도: {usage}. {note}",
                }
                
                results.append(data)
        
        except Exception as e:
            print(f"냉매 시트 파싱 실패: {e}")
            import traceback
            traceback.print_exc()
        
        return results
    
    def _translate_fuel_name(self, korean_name: str) -> str:
        """연료명 한영 변환."""
        translations = {
            '천연가스 (LNG)': 'Natural Gas (LNG)',
            '액화석유가스 (LPG)': 'Liquefied Petroleum Gas (LPG)',
            '도시가스 (PNG)': 'Piped Natural Gas (PNG)',
            '경유 (Diesel)': 'Diesel',
            '휘발유 (Gasoline)': 'Gasoline',
            '등유 (Kerosene)': 'Kerosene',
            '중유 B-A (MFO)': 'Fuel Oil B-A (MFO)',
            '중유 B-C (HFO)': 'Fuel Oil B-C (HFO)',
            '항공유 (Jet-A/Jet-A1)': 'Jet Fuel (Jet-A/Jet-A1)',
            '나프타 (Naphtha)': 'Naphtha',
            '유연탄 (Bituminous)': 'Bituminous Coal',
            '무연탄 (Anthracite)': 'Anthracite',
            '아역청탄 (Sub-bituminous)': 'Sub-bituminous Coal',
        }
        return translations.get(korean_name, korean_name)
    
    def parse_all(self) -> dict[str, list[dict[str, Any]]]:
        """모든 시트 파싱."""
        return {
            'scope1_stationary': self.parse_scope1_stationary(),
            'scope2_electricity': self.parse_scope2_electricity(),
            'refrigerants': self.parse_refrigerants(),
        }


def main():
    """메인 실행 함수."""
    if len(sys.argv) < 2:
        print("Usage: python parse_emission_factors_excel.py <excel_path>")
        sys.exit(1)
    
    excel_path = sys.argv[1]
    
    if not Path(excel_path).exists():
        print(f"Error: File not found: {excel_path}")
        sys.exit(1)
    
    parser = EmissionFactorExcelParser(excel_path)
    
    print("=" * 80)
    print("Excel 배출계수 파싱 시작")
    print("=" * 80)
    
    # Scope 1 고정연소
    print("\n[1] Scope 1 고정연소 파싱...")
    scope1_data = parser.parse_scope1_stationary()
    print(f"  파싱 완료: {len(scope1_data)}개 연료")
    
    for item in scope1_data[:3]:
        print(f"  - {item['factor_name_ko']}: {item['composite_factor']} {item['composite_factor_unit']}")
    
    # Scope 2 전력
    print("\n[2] Scope 2 전력 파싱...")
    scope2_data = parser.parse_scope2_electricity()
    print(f"  파싱 완료: {len(scope2_data)}개 항목")
    
    # 냉매
    print("\n[3] 냉매 파싱...")
    refrigerant_data = parser.parse_refrigerants()
    print(f"  파싱 완료: {len(refrigerant_data)}개 냉매")
    
    print("\n" + "=" * 80)
    print(f"총 파싱된 배출계수: {len(scope1_data) + len(scope2_data) + len(refrigerant_data)}개")
    print("=" * 80)
    
    # JSON으로 저장 (선택)
    import json
    output_path = Path("emission_factors_parsed.json")
    with output_path.open("w", encoding="utf-8") as f:
        json.dump({
            'scope1_stationary': scope1_data,
            'scope2_electricity': scope2_data,
            'refrigerants': refrigerant_data,
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n결과 저장: {output_path}")


if __name__ == "__main__":
    main()
