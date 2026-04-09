"""GHG Raw Data 품질 검증 서비스 (0값, 음수, 중복, 단위 불일치)."""
from __future__ import annotations

from collections import defaultdict
from typing import Any
from uuid import UUID

from backend.domain.v1.ghg_calculation.models.states import GhgAnomalyFindingVo


class GhgDataQualityService:
    """데이터 품질 검증 (스테이징 적재 직후 또는 배치 검증)."""

    def validate_staging_quality(
        self,
        staging_id: UUID,
        raw_data: dict[str, Any],
        category: str,
        staging_system: str,
    ) -> list[GhgAnomalyFindingVo]:
        """
        단일 스테이징 데이터의 품질 검증.

        Args:
            staging_id: 스테이징 ID
            raw_data: { "items": [...], "source_file": "..." }
            category: energy | waste | pollution | chemical
            staging_system: ems | erp | ehs | ...

        Returns:
            이상 발견 목록
        """
        findings: list[GhgAnomalyFindingVo] = []

        items = raw_data.get("items")
        if not isinstance(items, list):
            return findings

        source_file = raw_data.get("source_file", "unknown")

        # 1. 필수 항목 0값/미입력 검증
        findings.extend(self._check_required_zero_values(items, category, staging_id, staging_system, source_file))

        # 2. 음수값 검증
        findings.extend(self._check_negative_values(items, category, staging_id, staging_system, source_file))

        # 3. 중복 데이터 검증
        findings.extend(self._check_duplicates(items, category, staging_id, staging_system, source_file))

        # 4. 단위 불일치 검증 (1000배/0.001배 의심)
        findings.extend(self._check_unit_mismatch(items, category, staging_id, staging_system, source_file))

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

    def _check_required_zero_values(
        self,
        items: list[dict[str, Any]],
        category: str,
        staging_id: UUID,
        staging_system: str,
        source_file: str,
    ) -> list[GhgAnomalyFindingVo]:
        """필수 항목이 0 또는 비어있는 경우 검증."""
        findings: list[GhgAnomalyFindingVo] = []

        for idx, raw in enumerate(items, start=1):
            item = self._normalize_keys(raw)

            # Scope 1 직접 배출: 에너지 사용량이 있는 시설의 경우 0이면 의심
            if category == "energy":
                usage_keys = [
                    "usage_amount",
                    "consumption_kwh",
                    "generation_kwh",
                    "usage_ton",
                    "renewable_kwh",
                    "purewater_m3",
                    "raw_water_m3",
                ]
                usage = 0.0
                for key in usage_keys:
                    usage += self._to_float(item.get(key, 0))

                facility = self._pick(item, "facility", "site_name", "시설명")
                energy_type = self._pick(item, "energy_type", "re_type", "에너지원", "에너지유형")

                # 에너지 유형이 명시되어 있는데 사용량이 0이면 의심
                if energy_type and usage == 0.0:
                    findings.append(
                        GhgAnomalyFindingVo(
                            rule_code="REQUIRED_FIELD_ZERO",
                            severity="high",
                            phase="sync",
                            message=f"필수 항목 0값: {facility or '시설 미명시'} / {energy_type} (Row {idx})",
                            csv_row=idx,
                            staging_system=staging_system,
                            staging_id=str(staging_id),
                            context={
                                "category": category,
                                "facility": facility,
                                "energy_type": energy_type,
                                "source_file": source_file,
                                "row_index": idx,
                            },
                        )
                    )

            elif category == "waste":
                amount = self._to_float(
                    self._pick(item, "generation_ton", "amount_ton", "quantity", "amount", "usage_amount")
                )
                waste_type = self._pick(item, "waste_type", "waste_category", "폐기물종류")

                if waste_type and amount == 0.0:
                    findings.append(
                        GhgAnomalyFindingVo(
                            rule_code="REQUIRED_FIELD_ZERO",
                            severity="medium",
                            phase="sync",
                            message=f"폐기물 발생량 0값: {waste_type} (Row {idx})",
                            csv_row=idx,
                            staging_system=staging_system,
                            staging_id=str(staging_id),
                            context={
                                "category": category,
                                "waste_type": waste_type,
                                "source_file": source_file,
                                "row_index": idx,
                            },
                        )
                    )

        return findings

    def _check_negative_values(
        self,
        items: list[dict[str, Any]],
        category: str,
        staging_id: UUID,
        staging_system: str,
        source_file: str,
    ) -> list[GhgAnomalyFindingVo]:
        """음수값 검증 (물리적으로 음수 불가능한 항목)."""
        findings: list[GhgAnomalyFindingVo] = []

        for idx, raw in enumerate(items, start=1):
            item = self._normalize_keys(raw)

            if category == "energy":
                usage_keys = [
                    ("usage_amount", "사용량"),
                    ("consumption_kwh", "소비량(kWh)"),
                    ("generation_kwh", "발전량(kWh)"),
                    ("purewater_m3", "순수(m³)"),
                    ("raw_water_m3", "용수(m³)"),
                ]
                for key, label in usage_keys:
                    val = self._to_float(item.get(key, 0))
                    if val < 0:
                        findings.append(
                            GhgAnomalyFindingVo(
                                rule_code="NEGATIVE_VALUE",
                                severity="critical",
                                phase="sync",
                                message=f"음수값 불가: {label} = {val} (Row {idx})",
                                csv_row=idx,
                                staging_system=staging_system,
                                staging_id=str(staging_id),
                                context={
                                    "category": category,
                                    "field": key,
                                    "value": val,
                                    "source_file": source_file,
                                    "row_index": idx,
                                },
                            )
                        )

            elif category in ("waste", "chemical", "pollution"):
                amount_keys = [
                    ("generation_ton", "발생량(ton)"),
                    ("amount_ton", "수량(ton)"),
                    ("usage_amount_kg", "사용량(kg)"),
                    ("measured_value", "측정값"),
                ]
                for key, label in amount_keys:
                    val = self._to_float(item.get(key, 0))
                    if val < 0:
                        findings.append(
                            GhgAnomalyFindingVo(
                                rule_code="NEGATIVE_VALUE",
                                severity="critical",
                                phase="sync",
                                message=f"음수값 불가: {label} = {val} (Row {idx})",
                                csv_row=idx,
                                staging_system=staging_system,
                                staging_id=str(staging_id),
                                context={
                                    "category": category,
                                    "field": key,
                                    "value": val,
                                    "source_file": source_file,
                                    "row_index": idx,
                                },
                            )
                        )

        return findings

    def _check_duplicates(
        self,
        items: list[dict[str, Any]],
        category: str,
        staging_id: UUID,
        staging_system: str,
        source_file: str,
    ) -> list[GhgAnomalyFindingVo]:
        """중복 데이터 검증 (동일 기간·시설·항목)."""
        findings: list[GhgAnomalyFindingVo] = []
        seen: dict[tuple, list[int]] = defaultdict(list)

        for idx, raw in enumerate(items, start=1):
            item = self._normalize_keys(raw)

            # 복합키 생성: (시설, 연도, 월, 유형)
            facility = self._pick(item, "facility", "site_name", "시설명")
            year = self._pick(item, "year", "연도", "yr")
            month = self._pick(item, "month", "월", "m")

            if category == "energy":
                type_key = self._pick(item, "energy_type", "re_type", "에너지원")
            elif category == "waste":
                type_key = self._pick(item, "waste_type", "폐기물종류")
            elif category == "pollution":
                type_key = self._pick(item, "pollutant", "오염물질")
            elif category == "chemical":
                type_key = self._pick(item, "chemical_name", "약품명")
            else:
                type_key = ""

            composite_key = (facility, year, month, type_key)
            seen[composite_key].append(idx)

        # 중복 발견된 키만 처리
        for key, row_indices in seen.items():
            if len(row_indices) > 1:
                facility, year, month, type_key = key
                findings.append(
                    GhgAnomalyFindingVo(
                        rule_code="DUPLICATE_ENTRY",
                        severity="high",
                        phase="sync",
                        message=(
                            f"중복 데이터 {len(row_indices)}건: "
                            f"{facility}/{year}-{month}/{type_key} "
                            f"(Rows: {', '.join(map(str, row_indices))})"
                        ),
                        csv_row=row_indices[0],
                        staging_system=staging_system,
                        staging_id=str(staging_id),
                        context={
                            "category": category,
                            "facility": facility,
                            "year": year,
                            "month": month,
                            "type": type_key,
                            "duplicate_rows": row_indices,
                            "source_file": source_file,
                        },
                    )
                )

        return findings

    def _check_unit_mismatch(
        self,
        items: list[dict[str, Any]],
        category: str,
        staging_id: UUID,
        staging_system: str,
        source_file: str,
    ) -> list[GhgAnomalyFindingVo]:
        """단위 불일치 검증 (kWh vs MWh, 1000배 차이 의심)."""
        findings: list[GhgAnomalyFindingVo] = []

        if category != "energy":
            return findings

        # (시설, 에너지유형) 기준 월별 값 수집
        groups: dict[tuple[str, str], list[tuple[int, float, int]]] = defaultdict(list)

        for idx, raw in enumerate(items, start=1):
            item = self._normalize_keys(raw)

            facility = self._pick(item, "facility", "site_name", "시설명")
            energy_type = self._pick(item, "energy_type", "re_type", "에너지원")
            month = self._pick(item, "month", "월", "m")

            usage_keys = ["usage_amount", "consumption_kwh", "generation_kwh"]
            usage = 0.0
            for key in usage_keys:
                usage += self._to_float(item.get(key, 0))

            if usage > 0 and month:
                try:
                    month_int = int(month.lstrip("0") or "1")
                    groups[(facility, energy_type)].append((month_int, usage, idx))
                except ValueError:
                    pass

        # 같은 그룹 내 값들의 배율 확인
        for (facility, energy_type), values in groups.items():
            if len(values) < 2:
                continue

            # 값들을 정렬하여 최소/최대 확인
            sorted_values = sorted(values, key=lambda x: x[1])
            min_val = sorted_values[0][1]
            max_val = sorted_values[-1][1]

            # 900배 이상 차이나면 단위 불일치 의심 (1000배 기준에서 약간의 여유)
            if max_val / min_val > 900:
                findings.append(
                    GhgAnomalyFindingVo(
                        rule_code="UNIT_MISMATCH_SUSPECTED",
                        severity="critical",
                        phase="sync",
                        message=(
                            f"단위 불일치 의심: {facility}/{energy_type} "
                            f"최소 {min_val:.1f} vs 최대 {max_val:.1f} ({max_val/min_val:.0f}배 차이)"
                        ),
                        csv_row=sorted_values[0][2],
                        staging_system=staging_system,
                        staging_id=str(staging_id),
                        context={
                            "category": category,
                            "facility": facility,
                            "energy_type": energy_type,
                            "min_value": min_val,
                            "max_value": max_val,
                            "ratio": round(max_val / min_val, 1),
                            "values": [(m, v, r) for m, v, r in values],
                            "source_file": source_file,
                            "note": "kWh와 MWh 혼용 또는 소수점 오류 가능성",
                        },
                    )
                )

        return findings
