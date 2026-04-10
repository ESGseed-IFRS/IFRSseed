"""GHG Raw Data 조회 API."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.core.db import get_session
from backend.domain.v1.data_integration.models.bases.staging_tables import (
    StagingEmsData, StagingErpData, StagingEhsData, 
    StagingPlmData, StagingSrmData, StagingHrData, StagingMdgData
)
from backend.domain.v1.ghg_calculation.models.anomaly_correction import AnomalyCorrection
from backend.domain.v1.ghg_calculation.hub.orchestrator.ghg_anomaly_orchestrator import (
    GhgAnomalyOrchestrator,
)
from backend.domain.v1.ghg_calculation.hub.orchestrator.raw_data_inquiry_orchestrator import (
    RawDataInquiryOrchestrator,
)
from backend.domain.v1.ghg_calculation.models.states import (
    GhgAnomalyScanRequestDto,
    GhgAnomalyScanResponseDto,
    RawDataInquiryRequestDto,
    RawDataInquiryResponseDto,
)
from backend.domain.v1.ghg_calculation.hub.services.raw_data_inquiry_service import _pick
from sqlalchemy.orm.attributes import flag_modified

raw_data_router = APIRouter(prefix="/raw-data", tags=["GHG Raw Data"])

_orchestrator = RawDataInquiryOrchestrator()
_anomaly_orch = GhgAnomalyOrchestrator()

STAGING_MODEL_MAP = {
    "ems": StagingEmsData,
    "erp": StagingErpData,
    "ehs": StagingEhsData,
    "plm": StagingPlmData,
    "srm": StagingSrmData,
    "hr": StagingHrData,
    "mdg": StagingMdgData,
}


class CorrectionValidationRequest(BaseModel):
    rule_code: str
    current_value: float
    corrected_value: float
    context: dict
    unit: str


class CorrectionValidationResponse(BaseModel):
    isValid: bool
    message: str
    calculatedDeviation: float | None = None


class ApplyCorrectionRequest(BaseModel):
    company_id: str
    anomaly_context: dict
    corrected_value: float
    original_value: float
    reason: str
    rule_code: str


class ApplyCorrectionResponse(BaseModel):
    success: bool
    updated_records: int
    message: str
    correction_id: str | None = None


@raw_data_router.post(
    "/inquiry",
    response_model=RawDataInquiryResponseDto,
    response_model_by_alias=True,
)
def post_raw_data_inquiry(body: RawDataInquiryRequestDto) -> RawDataInquiryResponseDto:
    """
    스테이징 테이블을 조회해 카테고리·필터에 맞는 Raw Data 행을 반환합니다.
    에너지 카테고리는 등록된 `source_file` 매퍼가 있는 CSV만 변환합니다 (예: EMS_RENEWABLE_ENERGY.csv).
    """
    try:
        return _orchestrator.inquire_raw_data(body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@raw_data_router.post(
    "/anomaly-scan",
    response_model=GhgAnomalyScanResponseDto,
    response_model_by_alias=True,
)
def post_raw_data_anomaly_scan(body: GhgAnomalyScanRequestDto) -> GhgAnomalyScanResponseDto:
    """
    스테이징 에너지 월별 시계열 기준 이상치 스캔 (전년 동기·전월·MA12·3σ).
    배치·마감 전 전수 재검증 또는 수동 실행에 사용합니다.
    """
    try:
        res = _anomaly_orch.scan_timeseries(body)
        _anomaly_orch.persist_scan_response(body.company_id, res)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@raw_data_router.get(
    "/anomaly-latest",
    response_model=GhgAnomalyScanResponseDto,
    response_model_by_alias=True,
)
def get_raw_data_anomaly_latest(
    company_id: UUID = Query(..., description="companies.id"),
) -> GhgAnomalyScanResponseDto:
    """DB에 저장된 최신 시계열 이상치 스캔 결과(업로드·적재 시 자동 갱신)."""
    try:
        cached = _anomaly_orch.get_latest_persisted_scan(company_id)
        if cached:
            return cached
        return GhgAnomalyScanResponseDto(
            company_id=str(company_id),
            categories=["energy", "waste", "pollution", "chemical"],
            systems=[],
            group_by_system=True,
            timeseries_findings=[],
            series_evaluated=0,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@raw_data_router.post("/validate-correction")
def validate_correction(body: CorrectionValidationRequest) -> CorrectionValidationResponse:
    """
    보정값 적합성 검증.
    
    비교 기준값과 보정값을 비교하여 이상치 임계값 내에 있는지 판단합니다.
    """
    try:
        rule_code = body.rule_code
        current_value = body.current_value
        corrected_value = body.corrected_value
        context = body.context
        
        # 규칙별 검증 로직
        if rule_code == "MOM_RATIO":
            prior_month = float(context.get("prior_month", 0))
            if prior_month > 0:
                new_ratio = corrected_value / prior_month
                is_valid = new_ratio < 2.0  # 2배 미만이면 적합
                deviation = ((corrected_value - prior_month) / prior_month) * 100
                return CorrectionValidationResponse(
                    isValid=is_valid,
                    message=f"전월 대비 {new_ratio:.2f}배 {'(정상 범위)' if is_valid else '(여전히 이상)'}",
                    calculatedDeviation=round(deviation, 1)
                )
        
        elif rule_code == "YOY_PCT":
            prior_year = float(context.get("prior_year_same_month", 0))
            if prior_year > 0:
                change_pct = abs((corrected_value - prior_year) / prior_year * 100)
                is_valid = change_pct <= 30  # ±30% 이내면 적합
                return CorrectionValidationResponse(
                    isValid=is_valid,
                    message=f"전년 동기 대비 {change_pct:.1f}% {'(정상 범위)' if is_valid else '(여전히 이상)'}",
                    calculatedDeviation=round(change_pct, 1)
                )
        
        elif rule_code == "MA12_RATIO":
            ma12 = float(context.get("ma12", 0))
            if ma12 > 0:
                new_ratio = corrected_value / ma12
                is_valid = new_ratio < 2.5  # 2.5배 미만이면 적합
                return CorrectionValidationResponse(
                    isValid=is_valid,
                    message=f"12개월 평균 대비 {new_ratio:.2f}배 {'(정상 범위)' if is_valid else '(여전히 이상)'}",
                    calculatedDeviation=round(new_ratio, 2)
                )
        
        elif rule_code == "ZSCORE_12M":
            mean = float(context.get("mean", 0))
            std_dev = float(context.get("std_dev", 1))
            if std_dev > 0:
                z_score = abs((corrected_value - mean) / std_dev)
                is_valid = z_score < 3.0  # 3σ 미만이면 적합
                return CorrectionValidationResponse(
                    isValid=is_valid,
                    message=f"|Z| = {z_score:.2f} {'(정상 범위)' if is_valid else '(여전히 이상)'}",
                    calculatedDeviation=round(z_score, 2)
                )
        
        elif rule_code == "IQR_OUTLIER" or rule_code == "IQR_EXTREME":
            q1 = float(context.get("q1", 0))
            q3 = float(context.get("q3", 0))
            iqr = float(context.get("iqr", 0))
            if iqr > 0:
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                is_valid = lower_bound <= corrected_value <= upper_bound
                return CorrectionValidationResponse(
                    isValid=is_valid,
                    message=f"IQR 범위 [{lower_bound:.1f}, {upper_bound:.1f}] {'내' if is_valid else '외'}",
                    calculatedDeviation=None
                )
        
        elif rule_code == "REQUIRED_FIELD_ZERO":
            is_valid = corrected_value > 0
            return CorrectionValidationResponse(
                isValid=is_valid,
                message="사용량 > 0 (정상)" if is_valid else "여전히 0",
                calculatedDeviation=None
            )
        
        elif rule_code == "NEGATIVE_VALUE":
            is_valid = corrected_value >= 0
            return CorrectionValidationResponse(
                isValid=is_valid,
                message="양수값 (정상)" if is_valid else "여전히 음수",
                calculatedDeviation=None
            )
        
        # 기본 응답
        return CorrectionValidationResponse(
            isValid=True,
            message="검증 완료",
            calculatedDeviation=None
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"검증 실패: {str(e)}") from e


@raw_data_router.post("/apply-correction")
def apply_correction(body: ApplyCorrectionRequest) -> ApplyCorrectionResponse:
    """
    보정값을 staging_*_data 테이블의 raw_data에 적용하고 이력을 기록합니다.
    
    주의사항:
    - 원본 데이터는 _original_value 필드에 보존
    - 보정 메타데이터 추가 (_corrected, _correction_date, _correction_reason)
    - anomaly_corrections 테이블에 감사 이력 저장
    """
    session: Session = get_session()
    try:
        company_id = UUID(body.company_id)
        anomaly_context = body.anomaly_context
        corrected_value = body.corrected_value
        original_value = body.original_value
        reason = body.reason
        rule_code = body.rule_code
        
        # 컨텍스트에서 필요한 정보 추출
        category = anomaly_context.get("category", "energy")
        system = anomaly_context.get("system", "ems")
        facility = anomaly_context.get("facility", "")
        metric = anomaly_context.get("metric", "")
        year_month = int(anomaly_context.get("year_month", 0))
        year = year_month // 100
        month = year_month % 100
        unit = anomaly_context.get("unit", "")
        
        # 스테이징 테이블 결정
        staging_model = STAGING_MODEL_MAP.get(system)
        if not staging_model:
            raise HTTPException(400, f"지원하지 않는 시스템: {system}")
        
        # 해당 레코드 조회
        rows = (
            session.query(staging_model)
            .filter(staging_model.company_id == company_id)
            .order_by(staging_model.imported_at.desc())
            .all()
        )
        
        updated_count = 0
        updated_staging_id = None
        
        for row in rows:
            raw_data = row.raw_data
            if not isinstance(raw_data, dict):
                continue
            
            items = raw_data.get("items")
            if not isinstance(items, list):
                continue
            
            # items에서 해당 항목 찾아 수정
            for item in items:
                # 조건 매칭
                item_facility = _pick(item, "facility", "site_name", "시설명") or ""
                item_year = str(_pick(item, "year", "연도", "yr") or "").strip()
                
                # 월 추출
                item_month_str = _pick(item, "month", "월", "m")
                if item_month_str:
                    try:
                        item_month = int(str(item_month_str).strip())
                    except ValueError:
                        item_month = 0
                else:
                    item_month = 0
                
                # metric 매칭 (에너지 타입, 폐기물 타입 등)
                item_metric = ""
                if category == "energy":
                    item_metric = _pick(item, "energy_type", "re_type", "에너지원", "에너지유형") or ""
                elif category == "waste":
                    item_metric = _pick(item, "waste_type", "폐기물", "waste_name") or ""
                elif category == "pollution":
                    item_metric = _pick(item, "pollutant", "오염물질") or ""
                
                # 매칭 확인
                if (item_facility == facility and 
                    item_metric == metric and 
                    item_year == str(year) and 
                    item_month == month):
                    
                    # 원본 값 보존 (처음 보정 시에만)
                    if "_original_value" not in item:
                        item["_original_value"] = original_value
                    
                    # 보정값 적용
                    if category == "energy":
                        # 사용량 필드 업데이트
                        if "usage_amount" in item:
                            item["usage_amount"] = corrected_value
                        elif "consumption_kwh" in item:
                            item["consumption_kwh"] = corrected_value
                        elif "generation_kwh" in item:
                            item["generation_kwh"] = corrected_value
                        elif "usage_ton" in item:
                            item["usage_ton"] = corrected_value
                    
                    elif category == "waste":
                        if "generation_ton" in item:
                            item["generation_ton"] = corrected_value
                        elif "amount_ton" in item:
                            item["amount_ton"] = corrected_value
                        elif "amount" in item:
                            item["amount"] = corrected_value
                    
                    elif category == "pollution":
                        if "value" in item:
                            item["value"] = corrected_value
                        elif "amount" in item:
                            item["amount"] = corrected_value
                    
                    # 보정 메타데이터 추가
                    item["_corrected"] = True
                    item["_correction_date"] = datetime.now(timezone.utc).isoformat()
                    item["_correction_reason"] = reason
                    item["_rule_code"] = rule_code
                    
                    updated_count += 1
                    updated_staging_id = row.id
            
            # JSONB 컬럼 업데이트
            if updated_count > 0:
                row.raw_data = raw_data
                flag_modified(row, "raw_data")
        
        # 보정 이력 저장
        correction_record = None
        if updated_count > 0:
            correction_record = AnomalyCorrection(
                company_id=company_id,
                rule_code=rule_code,
                staging_system=system,
                staging_id=updated_staging_id,
                facility=facility,
                metric=metric,
                year_month=f"{year}{month:02d}",
                original_value=original_value,
                corrected_value=corrected_value,
                unit=unit,
                reason=reason,
                anomaly_context=anomaly_context,
                status="applied"
            )
            session.add(correction_record)
        
        session.commit()
        
        return ApplyCorrectionResponse(
            success=True,
            updated_records=updated_count,
            message=f"{updated_count}개 레코드의 보정값이 적용되었습니다.",
            correction_id=str(correction_record.id) if correction_record else None
        )
    
    except Exception as e:
        session.rollback()
        raise HTTPException(500, f"보정 적용 실패: {str(e)}") from e
    finally:
        session.close()
