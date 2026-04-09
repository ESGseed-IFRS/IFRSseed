"""배출계수 이탈 검증 서비스 (국가 고유 배출계수 ±15% 범위)."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from loguru import logger

from backend.domain.v1.ghg_calculation.hub.services.emission_factor_service import EmissionFactorService
from backend.domain.v1.ghg_calculation.models.states import GhgAnomalyFindingVo


class GhgEmissionFactorValidationService:
    """배출계수 이탈 검증."""

    def __init__(self, ef_service: EmissionFactorService | None = None):
        self._ef_service = ef_service or EmissionFactorService()

    def validate_emission_factors(
        self,
        items: list[dict[str, Any]],
        year: str,
        staging_id: UUID,
        staging_system: str,
        source_file: str,
    ) -> list[GhgAnomalyFindingVo]:
        """
        입력된 배출계수가 표준 범위(±15%)를 벗어나는지 검증.

        Args:
            items: raw_data.items (정규화된 dict 리스트)
            year: 산정 연도
            staging_id: 스테이징 ID
            staging_system: 시스템명
            source_file: 파일명

        Returns:
            이상 발견 목록
        """
        findings: list[GhgAnomalyFindingVo] = []

        for idx, raw in enumerate(items, start=1):
            item = self._normalize_keys(raw)

            # 입력 배출계수가 명시된 경우만 검증
            input_factor = self._extract_emission_factor(item)
            if input_factor is None or input_factor <= 0:
                continue

            # 에너지 유형 및 단위 추출
            energy_type = self._pick(item, "energy_type", "re_type", "fuel_type", "에너지원", "연료")
            unit = self._pick(item, "unit", "usage_unit", "단위") or "kWh"

            # 표준 배출계수 조회
            category, fuel_type = self._classify_energy_type(energy_type, unit)
            if not category or not fuel_type:
                continue

            try:
                standard = self._ef_service.resolve(category, fuel_type, unit.lower(), year)
                if standard is None:
                    # 표준값이 없으면 검증 불가
                    continue

                standard_value, source = standard

                # 편차율 계산
                deviation_pct = abs((input_factor - standard_value) / standard_value * 100)

                if deviation_pct > 15.0:
                    severity = "critical" if deviation_pct > 30.0 else "high"
                    findings.append(
                        GhgAnomalyFindingVo(
                            rule_code="EMISSION_FACTOR_DEVIATION",
                            severity=severity,  # type: ignore
                            phase="sync",
                            message=(
                                f"배출계수 {deviation_pct:.1f}% 이탈: "
                                f"{energy_type} (입력: {input_factor:.4f}, 기준: {standard_value:.4f}) "
                                f"(Row {idx})"
                            ),
                            csv_row=idx,
                            staging_system=staging_system,
                            staging_id=str(staging_id),
                            context={
                                "energy_type": energy_type,
                                "unit": unit,
                                "input_factor": round(input_factor, 6),
                                "standard_factor": round(standard_value, 6),
                                "deviation_pct": round(deviation_pct, 2),
                                "source": source,
                                "year": year,
                                "source_file": source_file,
                                "row_index": idx,
                                "note": "환경부 고시 또는 IPCC 기준과 비교",
                            },
                        )
                    )
            except Exception as e:
                logger.warning(
                    "[EmissionFactorValidation] Failed to validate row {}: {}",
                    idx,
                    str(e),
                )
                continue

        return findings

    def _normalize_keys(self, item: dict[str, Any]) -> dict[str, Any]:
        """BOM 제거 및 키 정규화."""
        return {str(k).lstrip("\ufeff").strip(): v for k, v in item.items()}

    def _pick(self, item: dict[str, Any], *keys: str) -> str:
        """여러 키 후보 중 첫 번째 유효 값 반환."""
        for key in keys:
            if key in item and item[key] not in (None, ""):
                return str(item[key]).strip()
        return ""

    def _to_float(self, v: Any) -> float:
        """문자열/숫자를 float로 변환."""
        if v in ("", None):
            return 0.0
        s = str(v).replace(",", "").strip()
        if not s:
            return 0.0
        try:
            return float(s)
        except ValueError:
            return 0.0

    def _extract_emission_factor(self, item: dict[str, Any]) -> float | None:
        """
        항목에서 배출계수 추출.
        컬럼명: emission_factor, ef, 배출계수, co2_factor 등
        """
        factor_keys = [
            "emission_factor",
            "ef",
            "배출계수",
            "co2_factor",
            "ghg_factor",
            "composite_factor",
        ]
        for key in factor_keys:
            val = self._to_float(item.get(key, 0))
            if val > 0:
                return val
        return None

    def _classify_energy_type(self, energy_type: str, unit: str) -> tuple[str, str]:
        """
        에너지 유형과 단위로부터 (category, fuel_type) 분류.

        Returns:
            (category, fuel_type) 예: ("stationary_combustion", "lng")
        """
        et = energy_type.lower()
        u = unit.lower().replace("³", "3")

        # LNG / 천연가스
        if "lng" in et or "천연가스" in et or "natural gas" in et:
            return ("stationary_combustion", "lng")

        # LPG
        if "lpg" in et or "액화석유" in et or "propane" in et:
            return ("stationary_combustion", "lpg")

        # 경유
        if "경유" in et or "diesel" in et:
            return ("stationary_combustion", "diesel")

        # 휘발유
        if "휘발유" in et or "gasoline" in et or "가솔린" in et:
            return ("stationary_combustion", "gasoline")

        # 전력 (Scope 2)
        if "전력" in et or "전기" in et or "electricity" in et or "kwh" in u:
            return ("electricity", "grid")

        # 열/스팀
        if "열" in et or "스팀" in et or "steam" in et or "gcal" in u:
            return ("heat_steam", "district")

        # 기타: 단위 기반 추정
        if "nm3" in u or "nm³" in u:
            return ("stationary_combustion", "lng")
        if "l" in u or "liter" in u:
            return ("stationary_combustion", "diesel")

        # 분류 불가
        return ("", "")
