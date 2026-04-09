"""배출계수 마스터(emission_factors) 조회 - 확장 버전.

열량계수, GHG 가스별 배출계수, GWP를 포함한 완전한 배출계수 정보를 제공합니다.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from loguru import logger
from sqlalchemy import text

from backend.core.db import get_session


@dataclass
class EmissionFactorDetail:
    """배출계수 상세 정보."""
    
    factor_code: str
    factor_name_ko: str
    factor_name_en: str | None
    
    # 적용 범위
    applicable_scope: str  # Scope1, Scope2, Scope3
    applicable_category: str  # 고정연소, 이동연소, 전력 등
    fuel_type: str  # lng, diesel, electricity 등
    
    # 열량 변환 (Scope 1 연소 전용)
    heat_content_coefficient: float | None  # TJ/천Nm³ 등
    heat_content_unit: str | None
    net_calorific_value: float | None  # MJ/kg
    ncv_unit: str | None
    
    # GHG 가스별 배출계수
    co2_factor: float | None  # tCO₂/TJ
    ch4_factor: float | None  # tCH₄/TJ
    n2o_factor: float | None  # tN₂O/TJ
    
    # 복합 배출계수
    composite_factor: float  # tCO₂eq/TJ 또는 kgCO₂eq/kWh
    composite_factor_unit: str
    
    # GWP
    gwp_basis: str  # AR5, AR6
    ch4_gwp: float | None
    n2o_gwp: float | None
    gwp_value: float | None  # 냉매용 단일 GWP
    
    # 메타데이터
    source_unit: str  # 사용자 입력 단위
    reference_year: int
    reference_source: str
    version: str
    notes: str | None


class EmissionFactorServiceV2:
    """배출계수 조회 서비스 (V2 - 확장 스키마)."""
    
    def resolve_detailed(
        self,
        fuel_type: str,
        source_unit: str,
        year: int | str,
        applicable_scope: str | None = None,
        applicable_category: str | None = None,
    ) -> EmissionFactorDetail | None:
        """
        상세 배출계수 정보 조회.
        
        Args:
            fuel_type: 연료 타입 (lng, diesel, electricity 등)
            source_unit: 입력 단위 (천Nm³, kWh 등)
            year: 산정 연도
            applicable_scope: 적용 범위 (Scope1, Scope2 등)
            applicable_category: 적용 카테고리 (고정연소 등)
        
        Returns:
            배출계수 상세 정보 또는 None
        """
        session = get_session()
        try:
            # 정규화
            u_lower = source_unit.lower().replace('³', '3').strip()
            fuel_lower = fuel_type.lower().strip()
            year_str = str(year).strip()
            
            # 단위 변환: nm3 → 천nm3 (1000배 차이)
            # 실제 데이터가 nm3로 들어오면 천nm3 배출계수를 찾아야 함
            u_variants = [u_lower]
            if 'nm3' in u_lower and '천' not in u_lower:
                u_variants.append('천nm3')
            elif '천nm3' in u_lower:
                u_variants.append('nm3')
            
            # 1차 쿼리: 연도 + Scope + 카테고리 모두 일치
            sql = text("""
                SELECT 
                    factor_code, factor_name_ko, factor_name_en,
                    applicable_scope, applicable_category, fuel_type,
                    heat_content_coefficient, heat_content_unit,
                    net_calorific_value, ncv_unit,
                    co2_factor, ch4_factor, n2o_factor,
                    composite_factor, composite_factor_unit,
                    gwp_basis, ch4_gwp, n2o_gwp, gwp_value,
                    source_unit, reference_year, reference_source,
                    version, notes
                FROM emission_factors
                WHERE is_active = true
                  AND lower(fuel_type) = :fuel
                  AND (
                    lower(replace(source_unit, '³', '3')) = ANY(:u_variants)
                    OR lower(source_unit) = ANY(:u_variants)
                  )
                  AND reference_year = :year
                  AND (:scope IS NULL OR applicable_scope = :scope)
                  AND (:category IS NULL OR applicable_category = :category)
                ORDER BY 
                    CASE WHEN applicable_scope = :scope THEN 0 ELSE 1 END,
                    CASE WHEN applicable_category = :category THEN 0 ELSE 1 END
                LIMIT 1
            """)
            
            row = session.execute(sql, {
                "fuel": fuel_lower,
                "u_variants": u_variants,
                "year": int(year_str),
                "scope": applicable_scope,
                "category": applicable_category,
            }).mappings().first()
            
            # 2차 쿼리: 연도만 일치 (Scope/카테고리 무시)
            if row is None:
                sql = text("""
                    SELECT 
                        factor_code, factor_name_ko, factor_name_en,
                        applicable_scope, applicable_category, fuel_type,
                        heat_content_coefficient, heat_content_unit,
                        net_calorific_value, ncv_unit,
                        co2_factor, ch4_factor, n2o_factor,
                        composite_factor, composite_factor_unit,
                        gwp_basis, ch4_gwp, n2o_gwp, gwp_value,
                        source_unit, reference_year, reference_source,
                        version, notes
                    FROM emission_factors
                    WHERE is_active = true
                      AND lower(fuel_type) = :fuel
                      AND (
                        lower(replace(source_unit, '³', '3')) = ANY(:u_variants)
                        OR lower(source_unit) = ANY(:u_variants)
                      )
                      AND reference_year <= :year
                    ORDER BY reference_year DESC
                    LIMIT 1
                """)
                
                row = session.execute(sql, {
                    "fuel": fuel_lower,
                    "u_variants": u_variants,
                    "year": int(year_str),
                }).mappings().first()
            
            if row is None:
                return None
            
            # EmissionFactorDetail 객체 생성
            return EmissionFactorDetail(
                factor_code=row["factor_code"],
                factor_name_ko=row["factor_name_ko"],
                factor_name_en=row["factor_name_en"],
                applicable_scope=row["applicable_scope"],
                applicable_category=row["applicable_category"],
                fuel_type=row["fuel_type"],
                heat_content_coefficient=float(row["heat_content_coefficient"]) if row["heat_content_coefficient"] else None,
                heat_content_unit=row["heat_content_unit"],
                net_calorific_value=float(row["net_calorific_value"]) if row["net_calorific_value"] else None,
                ncv_unit=row["ncv_unit"],
                co2_factor=float(row["co2_factor"]) if row["co2_factor"] else None,
                ch4_factor=float(row["ch4_factor"]) if row["ch4_factor"] else None,
                n2o_factor=float(row["n2o_factor"]) if row["n2o_factor"] else None,
                composite_factor=float(row["composite_factor"]) if row["composite_factor"] else 0.0,
                composite_factor_unit=row["composite_factor_unit"] or "",
                gwp_basis=row["gwp_basis"] or "AR5",
                ch4_gwp=float(row["ch4_gwp"]) if row["ch4_gwp"] else None,
                n2o_gwp=float(row["n2o_gwp"]) if row["n2o_gwp"] else None,
                gwp_value=float(row["gwp_value"]) if row["gwp_value"] else None,
                source_unit=row["source_unit"],
                reference_year=int(row["reference_year"]) if row["reference_year"] else 2024,
                reference_source=row["reference_source"] or "",
                version=row["version"] or "v1.0",
                notes=row["notes"],
            )
        
        except Exception as e:
            logger.exception(
                "[EmissionFactorServiceV2] resolve_detailed failed fuel={} unit={}",
                fuel_type,
                source_unit,
            )
            raise
        finally:
            session.close()
    
    def resolve_simple(
        self,
        fuel_type: str,
        source_unit: str,
        year: int | str,
    ) -> tuple[float, str] | None:
        """
        간단한 조회 (하위 호환성 유지).
        
        Returns:
            (composite_factor, reference_source) 또는 None
        """
        detail = self.resolve_detailed(fuel_type, source_unit, year)
        if detail is None:
            return None
        return detail.composite_factor, detail.reference_source
    
    def list_all_factors(
        self,
        year: int | None = None,
        scope: str | None = None,
        active_only: bool = True,
    ) -> list[EmissionFactorDetail]:
        """
        배출계수 목록 조회.
        
        Args:
            year: 특정 연도 (None이면 전체)
            scope: Scope1, Scope2, Scope3 (None이면 전체)
            active_only: 활성 항목만 조회
        
        Returns:
            배출계수 상세 목록
        """
        session = get_session()
        try:
            sql = """
                SELECT 
                    factor_code, factor_name_ko, factor_name_en,
                    applicable_scope, applicable_category, fuel_type,
                    heat_content_coefficient, heat_content_unit,
                    net_calorific_value, ncv_unit,
                    co2_factor, ch4_factor, n2o_factor,
                    composite_factor, composite_factor_unit,
                    gwp_basis, ch4_gwp, n2o_gwp, gwp_value,
                    source_unit, reference_year, reference_source,
                    version, notes
                FROM emission_factors
                WHERE 1=1
            """
            params: dict[str, Any] = {}
            
            if active_only:
                sql += " AND is_active = true"
            
            if year is not None:
                sql += " AND reference_year = :year"
                params["year"] = year
            
            if scope is not None:
                sql += " AND applicable_scope = :scope"
                params["scope"] = scope
            
            sql += " ORDER BY applicable_scope, applicable_category, fuel_type"
            
            rows = session.execute(text(sql), params).mappings().all()
            
            results = []
            for row in rows:
                results.append(EmissionFactorDetail(
                    factor_code=row["factor_code"],
                    factor_name_ko=row["factor_name_ko"],
                    factor_name_en=row["factor_name_en"],
                    applicable_scope=row["applicable_scope"],
                    applicable_category=row["applicable_category"],
                    fuel_type=row["fuel_type"],
                    heat_content_coefficient=float(row["heat_content_coefficient"]) if row["heat_content_coefficient"] else None,
                    heat_content_unit=row["heat_content_unit"],
                    net_calorific_value=float(row["net_calorific_value"]) if row["net_calorific_value"] else None,
                    ncv_unit=row["ncv_unit"],
                    co2_factor=float(row["co2_factor"]) if row["co2_factor"] else None,
                    ch4_factor=float(row["ch4_factor"]) if row["ch4_factor"] else None,
                    n2o_factor=float(row["n2o_factor"]) if row["n2o_factor"] else None,
                    composite_factor=float(row["composite_factor"]) if row["composite_factor"] else 0.0,
                    composite_factor_unit=row["composite_factor_unit"] or "",
                    gwp_basis=row["gwp_basis"] or "AR5",
                    ch4_gwp=float(row["ch4_gwp"]) if row["ch4_gwp"] else None,
                    n2o_gwp=float(row["n2o_gwp"]) if row["n2o_gwp"] else None,
                    gwp_value=float(row["gwp_value"]) if row["gwp_value"] else None,
                    source_unit=row["source_unit"],
                    reference_year=int(row["reference_year"]) if row["reference_year"] else 2024,
                    reference_source=row["reference_source"] or "",
                    version=row["version"] or "v1.0",
                    notes=row["notes"],
                ))
            
            return results
        
        finally:
            session.close()
    
    def get_by_code(self, factor_code: str) -> EmissionFactorDetail | None:
        """factor_code로 배출계수 조회."""
        session = get_session()
        try:
            sql = text("""
                SELECT 
                    factor_code, factor_name_ko, factor_name_en,
                    applicable_scope, applicable_category, fuel_type,
                    heat_content_coefficient, heat_content_unit,
                    net_calorific_value, ncv_unit,
                    co2_factor, ch4_factor, n2o_factor,
                    composite_factor, composite_factor_unit,
                    gwp_basis, ch4_gwp, n2o_gwp, gwp_value,
                    source_unit, reference_year, reference_source,
                    version, notes
                FROM emission_factors
                WHERE factor_code = :code AND is_active = true
            """)
            
            row = session.execute(sql, {"code": factor_code}).mappings().first()
            
            if row is None:
                return None
            
            return EmissionFactorDetail(
                factor_code=row["factor_code"],
                factor_name_ko=row["factor_name_ko"],
                factor_name_en=row["factor_name_en"],
                applicable_scope=row["applicable_scope"],
                applicable_category=row["applicable_category"],
                fuel_type=row["fuel_type"],
                heat_content_coefficient=float(row["heat_content_coefficient"]) if row["heat_content_coefficient"] else None,
                heat_content_unit=row["heat_content_unit"],
                net_calorific_value=float(row["net_calorific_value"]) if row["net_calorific_value"] else None,
                ncv_unit=row["ncv_unit"],
                co2_factor=float(row["co2_factor"]) if row["co2_factor"] else None,
                ch4_factor=float(row["ch4_factor"]) if row["ch4_factor"] else None,
                n2o_factor=float(row["n2o_factor"]) if row["n2o_factor"] else None,
                composite_factor=float(row["composite_factor"]) if row["composite_factor"] else 0.0,
                composite_factor_unit=row["composite_factor_unit"] or "",
                gwp_basis=row["gwp_basis"] or "AR5",
                ch4_gwp=float(row["ch4_gwp"]) if row["ch4_gwp"] else None,
                n2o_gwp=float(row["n2o_gwp"]) if row["n2o_gwp"] else None,
                gwp_value=float(row["gwp_value"]) if row["gwp_value"] else None,
                source_unit=row["source_unit"],
                reference_year=int(row["reference_year"]) if row["reference_year"] else 2024,
                reference_source=row["reference_source"] or "",
                version=row["version"] or "v1.0",
                notes=row["notes"],
            )
        
        finally:
            session.close()
