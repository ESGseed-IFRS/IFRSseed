"""배출계수 DB 임포트 서비스.

Excel에서 파싱한 배출계수 데이터를 DB에 저장합니다.
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

# 루트 디렉토리를 PYTHONPATH에 추가
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# 출력 인코딩을 UTF-8로 설정
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from sqlalchemy import text

from backend.core.db import get_session


class EmissionFactorImportService:
    """배출계수 임포트 서비스."""
    
    def import_from_json(self, json_path: str) -> dict[str, int]:
        """
        JSON 파일에서 배출계수를 읽어 DB에 저장.
        
        Args:
            json_path: JSON 파일 경로
            
        Returns:
            저장 통계 {"inserted": N, "updated": M, "skipped": K}
        """
        json_file = Path(json_path)
        if not json_file.exists():
            raise FileNotFoundError(f"JSON file not found: {json_path}")
        
        with json_file.open("r", encoding="utf-8") as f:
            data = json.load(f)
        
        stats = {"inserted": 0, "updated": 0, "skipped": 0}
        
        # Scope 1 고정연소
        if "scope1_stationary" in data:
            s1_stats = self._import_emission_factors(data["scope1_stationary"])
            stats["inserted"] += s1_stats["inserted"]
            stats["updated"] += s1_stats["updated"]
            stats["skipped"] += s1_stats["skipped"]
        
        # Scope 2 전력
        if "scope2_electricity" in data:
            s2_stats = self._import_emission_factors(data["scope2_electricity"])
            stats["inserted"] += s2_stats["inserted"]
            stats["updated"] += s2_stats["updated"]
            stats["skipped"] += s2_stats["skipped"]
        
        # 냉매
        if "refrigerants" in data:
            rf_stats = self._import_emission_factors(data["refrigerants"])
            stats["inserted"] += rf_stats["inserted"]
            stats["updated"] += rf_stats["updated"]
            stats["skipped"] += rf_stats["skipped"]
        
        return stats
    
    def _import_emission_factors(self, factors: list[dict[str, Any]]) -> dict[str, int]:
        """
        배출계수 목록을 DB에 저장.
        
        Args:
            factors: 배출계수 데이터 리스트
            
        Returns:
            저장 통계
        """
        session = get_session()
        stats = {"inserted": 0, "updated": 0, "skipped": 0}
        
        try:
            for factor_data in factors:
                try:
                    # factor_code로 기존 데이터 확인
                    factor_code = factor_data["factor_code"]
                    
                    existing = session.execute(
                        text("SELECT id FROM emission_factors WHERE factor_code = :code"),
                        {"code": factor_code}
                    ).fetchone()
                    
                    if existing:
                        # UPDATE
                        self._update_emission_factor(session, existing[0], factor_data)
                        stats["updated"] += 1
                        print(f"Updated: {factor_code}")
                    else:
                        # INSERT
                        self._insert_emission_factor(session, factor_data)
                        stats["inserted"] += 1
                        print(f"Inserted: {factor_code}")
                    
                    session.commit()
                    
                except Exception as e:
                    session.rollback()
                    print(f"Failed to import {factor_data.get('factor_code', 'unknown')}: {e}")
                    stats["skipped"] += 1
        
        finally:
            session.close()
        
        return stats
    
    def _insert_emission_factor(self, session, data: dict[str, Any]) -> None:
        """배출계수 INSERT."""
        sql = text("""
            INSERT INTO emission_factors (
                id, factor_code, factor_name_ko, factor_name_en,
                applicable_scope, applicable_category, fuel_type,
                heat_content_coefficient, heat_content_unit,
                net_calorific_value, ncv_unit,
                co2_factor, ch4_factor, n2o_factor,
                composite_factor, composite_factor_unit,
                gwp_basis, ch4_gwp, n2o_gwp,
                source_unit, reference_year, reference_source,
                version, notes,
                emission_factor, unit, gwp_value,
                effective_from, effective_to, is_active
            ) VALUES (
                :id, :factor_code, :factor_name_ko, :factor_name_en,
                :applicable_scope, :applicable_category, :fuel_type,
                :heat_content_coefficient, :heat_content_unit,
                :net_calorific_value, :ncv_unit,
                :co2_factor, :ch4_factor, :n2o_factor,
                :composite_factor, :composite_factor_unit,
                :gwp_basis, :ch4_gwp, :n2o_gwp,
                :source_unit, :reference_year, :reference_source,
                :version, :notes,
                :composite_factor, :composite_factor_unit, :gwp_value,
                :effective_from, :effective_to, true
            )
        """)
        
        params = {
            "id": str(uuid4()),
            "factor_code": data["factor_code"],
            "factor_name_ko": data["factor_name_ko"],
            "factor_name_en": data.get("factor_name_en"),
            "applicable_scope": data.get("applicable_scope"),
            "applicable_category": data.get("applicable_category"),
            "fuel_type": data.get("fuel_type"),
            "heat_content_coefficient": data.get("heat_content_coefficient"),
            "heat_content_unit": data.get("heat_content_unit"),
            "net_calorific_value": data.get("net_calorific_value"),
            "ncv_unit": data.get("ncv_unit"),
            "co2_factor": data.get("co2_factor"),
            "ch4_factor": data.get("ch4_factor"),
            "n2o_factor": data.get("n2o_factor"),
            "composite_factor": data.get("composite_factor"),
            "composite_factor_unit": data.get("composite_factor_unit"),
            "gwp_basis": data.get("gwp_basis", "AR5"),
            "ch4_gwp": data.get("ch4_gwp", 28),
            "n2o_gwp": data.get("n2o_gwp", 265),
            "source_unit": data.get("source_unit"),
            "reference_year": data.get("reference_year"),
            "reference_source": data.get("reference_source"),
            "version": data.get("version", "v1.0"),
            "notes": data.get("notes"),
            "gwp_value": data.get("gwp_value"),  # 냉매용
            "effective_from": data.get("effective_from", "2024-01-01"),
            "effective_to": data.get("effective_to"),
        }
        
        session.execute(sql, params)
    
    def _update_emission_factor(self, session, ef_id: UUID, data: dict[str, Any]) -> None:
        """배출계수 UPDATE."""
        sql = text("""
            UPDATE emission_factors SET
                factor_name_ko = :factor_name_ko,
                factor_name_en = :factor_name_en,
                applicable_scope = :applicable_scope,
                applicable_category = :applicable_category,
                fuel_type = :fuel_type,
                heat_content_coefficient = :heat_content_coefficient,
                heat_content_unit = :heat_content_unit,
                net_calorific_value = :net_calorific_value,
                ncv_unit = :ncv_unit,
                co2_factor = :co2_factor,
                ch4_factor = :ch4_factor,
                n2o_factor = :n2o_factor,
                composite_factor = :composite_factor,
                composite_factor_unit = :composite_factor_unit,
                gwp_basis = :gwp_basis,
                ch4_gwp = :ch4_gwp,
                n2o_gwp = :n2o_gwp,
                source_unit = :source_unit,
                reference_year = :reference_year,
                reference_source = :reference_source,
                version = :version,
                notes = :notes,
                emission_factor = :composite_factor,
                unit = :composite_factor_unit,
                gwp_value = :gwp_value,
                updated_at = NOW()
            WHERE id = :id
        """)
        
        params = {
            "id": str(ef_id),
            "factor_name_ko": data["factor_name_ko"],
            "factor_name_en": data.get("factor_name_en"),
            "applicable_scope": data.get("applicable_scope"),
            "applicable_category": data.get("applicable_category"),
            "fuel_type": data.get("fuel_type"),
            "heat_content_coefficient": data.get("heat_content_coefficient"),
            "heat_content_unit": data.get("heat_content_unit"),
            "net_calorific_value": data.get("net_calorific_value"),
            "ncv_unit": data.get("ncv_unit"),
            "co2_factor": data.get("co2_factor"),
            "ch4_factor": data.get("ch4_factor"),
            "n2o_factor": data.get("n2o_factor"),
            "composite_factor": data.get("composite_factor"),
            "composite_factor_unit": data.get("composite_factor_unit"),
            "gwp_basis": data.get("gwp_basis", "AR5"),
            "ch4_gwp": data.get("ch4_gwp", 28),
            "n2o_gwp": data.get("n2o_gwp", 265),
            "source_unit": data.get("source_unit"),
            "reference_year": data.get("reference_year"),
            "reference_source": data.get("reference_source"),
            "version": data.get("version", "v1.0"),
            "notes": data.get("notes"),
            "gwp_value": data.get("gwp_value"),
        }
        
        session.execute(sql, params)


def main():
    """메인 실행 함수."""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python import_emission_factors.py <json_path>")
        sys.exit(1)
    
    json_path = sys.argv[1]
    
    service = EmissionFactorImportService()
    
    print("=" * 80)
    print("배출계수 DB 임포트 시작")
    print("=" * 80)
    
    try:
        stats = service.import_from_json(json_path)
        
        print("\n" + "=" * 80)
        print("임포트 완료")
        print("=" * 80)
        print(f"  - 신규 생성: {stats['inserted']}개")
        print(f"  - 업데이트: {stats['updated']}개")
        print(f"  - 건너뜀: {stats['skipped']}개")
        print(f"  - 총계: {stats['inserted'] + stats['updated']}개")
        
    except Exception as e:
        print(f"\n오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
