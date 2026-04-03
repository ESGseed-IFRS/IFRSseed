"""Raw Data 조회 DTO / VO."""
from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class RawDataInquiryRequestDto(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    company_id: UUID
    year: str = Field(default="2026", description="조회 연도 (문자열, item year와 동일 형식 권장)")
    month: str = Field(default="", description="조회 월(01~12). 비우면 연도 내 전체(월/분기/반기 필터는 period_type과 조합)")
    period_type: str = Field(
        default="월",
        validation_alias=AliasChoices("period_type", "periodType"),
    )
    facility: str = Field(default="전체")
    sub_type: str = Field(
        default="전체",
        validation_alias=AliasChoices("sub_type", "subType"),
        description="유형 드릴다운 (전체 | 전력 | …)",
    )
    search_keyword: str = Field(
        default="",
        validation_alias=AliasChoices("search_keyword", "searchKeyword"),
    )


class EnergyUsageRowVo(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    facility: str
    energy_type: str = Field(serialization_alias="energyType")
    unit: str
    jan: str = ""
    feb: str = ""
    mar: str = ""
    apr: str = ""
    may: str = ""
    jun: str = ""
    jul: str = ""
    aug: str = ""
    sep: str = ""
    oct: str = ""
    nov: str = ""
    dec: str = ""
    total: str = ""
    source: Literal["manual", "if"]
    status: Literal["confirmed", "draft", "error"]


class WasteRowVo(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    facility: str
    waste_type: str = Field(serialization_alias="wasteType")
    disposal_method: str = Field(serialization_alias="disposalMethod")
    unit: str
    jan: str = ""
    feb: str = ""
    mar: str = ""
    apr: str = ""
    may: str = ""
    jun: str = ""
    jul: str = ""
    aug: str = ""
    sep: str = ""
    oct: str = ""
    nov: str = ""
    dec: str = ""
    total: str = ""
    vendor: str = ""
    status: Literal["confirmed", "draft", "error"]


class PollutionRowVo(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    facility: str
    outlet_name: str = Field(serialization_alias="outletName")
    pollutant: str
    unit: str
    jan: str = ""
    feb: str = ""
    mar: str = ""
    apr: str = ""
    may: str = ""
    jun: str = ""
    jul: str = ""
    aug: str = ""
    sep: str = ""
    oct: str = ""
    nov: str = ""
    dec: str = ""
    avg: str = ""
    legal_limit: str = Field(serialization_alias="legalLimit")
    status: Literal["normal", "warning", "exceed"]


class ChemicalRowVo(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    facility: str
    chemical_name: str = Field(serialization_alias="chemicalName")
    cas_no: str = Field(serialization_alias="casNo")
    unit: str
    jan: str = ""
    feb: str = ""
    mar: str = ""
    apr: str = ""
    may: str = ""
    jun: str = ""
    jul: str = ""
    aug: str = ""
    sep: str = ""
    oct: str = ""
    nov: str = ""
    dec: str = ""
    total: str = ""
    hazard_class: str = Field(serialization_alias="hazardClass")
    status: Literal["confirmed", "draft"]


class EnergyProviderRowVo(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    provider_name: str = Field(serialization_alias="providerName")
    energy_type: str = Field(serialization_alias="energyType")
    contract_no: str = Field(serialization_alias="contractNo")
    supply_start: str = Field(serialization_alias="supplyStart")
    supply_end: str = Field(serialization_alias="supplyEnd")
    renewable_ratio: str = Field(serialization_alias="renewableRatio")
    cert_no: str = Field(serialization_alias="certNo")
    status: Literal["active", "expired", "pending"]


class ConsignmentRowVo(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    vendor_name: str = Field(serialization_alias="vendorName")
    biz_no: str = Field(serialization_alias="bizNo")
    waste_type: str = Field(serialization_alias="wasteType")
    permit_no: str = Field(serialization_alias="permitNo")
    permit_expiry: str = Field(serialization_alias="permitExpiry")
    contract_start: str = Field(serialization_alias="contractStart")
    contract_end: str = Field(serialization_alias="contractEnd")
    status: Literal["active", "expired"]


class RawDataInquiryResponseDto(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    category: str = "all"
    year: str
    energy_rows: list[EnergyUsageRowVo] = Field(default_factory=list, serialization_alias="energyRows")
    waste_rows: list[WasteRowVo] = Field(default_factory=list, serialization_alias="wasteRows")
    pollution_rows: list[PollutionRowVo] = Field(default_factory=list, serialization_alias="pollutionRows")
    chemical_rows: list[ChemicalRowVo] = Field(default_factory=list, serialization_alias="chemicalRows")
    energy_provider_rows: list[EnergyProviderRowVo] = Field(
        default_factory=list,
        serialization_alias="energyProviderRows",
    )
    consignment_rows: list[ConsignmentRowVo] = Field(
        default_factory=list,
        serialization_alias="consignmentRows",
    )
