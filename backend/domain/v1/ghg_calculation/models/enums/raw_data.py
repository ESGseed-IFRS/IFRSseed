"""Raw Data 조회·매핑용 열거형 및 상수."""
from __future__ import annotations

from enum import Enum


class RawDataCategoryEnum(str, Enum):
    energy = "energy"
    waste = "waste"
    pollution = "pollution"
    chemical = "chemical"
    energy_provider = "energy-provider"
    consignment = "consignment"


class StagingSystemEnum(str, Enum):
    ems = "ems"
    erp = "erp"
    ehs = "ehs"
    plm = "plm"
    srm = "srm"
    hr = "hr"


STAGING_SYSTEMS_BY_CATEGORY: dict[RawDataCategoryEnum, tuple[StagingSystemEnum, ...]] = {
    RawDataCategoryEnum.energy: (StagingSystemEnum.ems, StagingSystemEnum.erp),
    RawDataCategoryEnum.waste: (StagingSystemEnum.ems,),
    RawDataCategoryEnum.pollution: (StagingSystemEnum.ehs, StagingSystemEnum.ems),
    RawDataCategoryEnum.chemical: (StagingSystemEnum.ehs,),
    RawDataCategoryEnum.energy_provider: (StagingSystemEnum.srm, StagingSystemEnum.ems),
    RawDataCategoryEnum.consignment: (StagingSystemEnum.srm,),
}

ENERGY_TYPE_TO_UNIT: dict[str, str] = {
    "전력": "kWh",
    "LNG": "Nm³",
    "열·스팀": "Gcal",
    "용수": "m³",
    "순수": "m³",
    "순수(정제수)": "m³",
}

# UI 필터 값 → raw item 에너지유형 문자열과 비교할 후보
ENERGY_SUB_TYPE_FILTER_ALIASES: dict[str, tuple[str, ...]] = {
    "전력": ("전력", "전기"),
    "열·스팀": ("열·스팀", "스팀", "열"),
    "순수(정제수)": ("순수", "순수(정제수)", "정제수"),
    "LNG": ("LNG",),
    "용수": ("용수",),
}
