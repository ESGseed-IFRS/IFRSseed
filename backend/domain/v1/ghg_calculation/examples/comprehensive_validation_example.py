"""GHG 종합 검증 사용 예제."""
from uuid import UUID

from backend.domain.v1.ghg_calculation.hub.orchestrator import GhgComprehensiveValidationOrchestrator
from backend.domain.v1.ghg_calculation.hub.orchestrator.ghg_comprehensive_validation_orchestrator import (
    GhgComprehensiveValidationRequestDto,
)


def example_comprehensive_validation():
    """통합 검증 실행 예제."""
    # 회사 ID (실제 환경에서는 세션에서 가져옴)
    company_id = UUID("00000000-0000-0000-0000-000000000000")

    # 오케스트레이터 초기화
    orchestrator = GhgComprehensiveValidationOrchestrator()

    # 요청 생성
    request = GhgComprehensiveValidationRequestDto(
        company_id=company_id,
        year="2024",
        categories=["energy", "waste"],
        base_year="2020",
        # 시계열 이상치 검증
        enable_timeseries=True,
        yoy_threshold_pct=30.0,
        mom_ratio=2.0,
        ma12_ratio=2.5,
        zscore_threshold=3.0,
        iqr_multiplier=1.5,
        enable_iqr=True,
        # 데이터 품질 검증
        enable_quality=True,
        # 배출계수 이탈 검증
        enable_emission_factor=True,
        # 원단위 검증 (메타데이터 필요)
        enable_intensity=True,
        floor_area_sqm=50000.0,  # 50,000 m² (연면적)
        employee_count=1200,  # 1,200명
        production_volume=10000.0,  # 10,000대
        production_unit="대",
        # 업종별 벤치마크 (예: IT 제조업)
        benchmark_per_sqm=0.05,  # 0.05 tCO2e/m²
        benchmark_per_employee=5.0,  # 5.0 tCO2e/인
        benchmark_per_production=0.5,  # 0.5 tCO2e/대
        # 경계·일관성 검증
        enable_boundary=True,
    )

    # 검증 실행
    response = orchestrator.run_comprehensive_validation(request)

    # 결과 출력
    print("=" * 80)
    print("GHG 종합 검증 결과")
    print("=" * 80)
    print(f"회사 ID: {response.company_id}")
    print(f"검증 연도: {response.year}")
    print(f"검증 카테고리: {', '.join(response.categories)}")
    print(f"\n총 이상 발견: {response.total_findings}건")
    print(f"  - Critical: {response.critical_count}건")
    print(f"  - High: {response.high_count}건")
    print(f"  - Medium: {response.medium_count}건")
    print(f"  - Low: {response.low_count}건")

    # 유형별 결과
    print("\n" + "=" * 80)
    print("1. 시계열 이상치 검증")
    print("=" * 80)
    for finding in response.timeseries_findings[:5]:  # 상위 5개만
        print(f"[{finding.severity.upper()}] {finding.rule_code}: {finding.message}")

    print("\n" + "=" * 80)
    print("2. 데이터 품질 검증")
    print("=" * 80)
    for finding in response.quality_findings[:5]:
        print(f"[{finding.severity.upper()}] {finding.rule_code}: {finding.message}")

    print("\n" + "=" * 80)
    print("3. 배출계수 이탈 검증")
    print("=" * 80)
    for finding in response.emission_factor_findings[:5]:
        print(f"[{finding.severity.upper()}] {finding.rule_code}: {finding.message}")

    print("\n" + "=" * 80)
    print("4. 원단위 이상치 검증")
    print("=" * 80)
    for finding in response.intensity_findings:
        print(f"[{finding.severity.upper()}] {finding.rule_code}: {finding.message}")

    print("\n" + "=" * 80)
    print("5. 경계·일관성 검증")
    print("=" * 80)
    for finding in response.boundary_findings:
        print(f"[{finding.severity.upper()}] {finding.rule_code}: {finding.message}")

    # 요약
    print("\n" + "=" * 80)
    print("검증 요약")
    print("=" * 80)
    print(f"실행된 검증 유형:")
    for vtype, enabled in response.summary["validation_types_run"].items():
        status = "✓" if enabled else "✗"
        print(f"  {status} {vtype}")

    print(f"\nPhase별 분포:")
    for phase, count in response.summary["by_phase"].items():
        print(f"  - {phase}: {count}건")

    return response


def example_individual_service():
    """개별 서비스 사용 예제."""
    from backend.domain.v1.ghg_calculation.hub.services import GhgDataQualityService

    # 데이터 품질 검증 단독 실행
    quality_service = GhgDataQualityService()

    staging_id = UUID("00000000-0000-0000-0000-000000000001")
    raw_data = {
        "items": [
            {
                "year": "2024",
                "month": "1",
                "facility": "본사",
                "energy_type": "전력",
                "usage_amount": -100,  # 음수값 (이상)
                "unit": "kWh",
            },
            {
                "year": "2024",
                "month": "1",
                "facility": "본사",
                "energy_type": "전력",
                "usage_amount": 50000,
                "unit": "kWh",
            },
            {
                "year": "2024",
                "month": "1",
                "facility": "본사",
                "energy_type": "전력",  # 중복
                "usage_amount": 50000,
                "unit": "kWh",
            },
        ],
        "source_file": "energy_test.csv",
    }

    findings = quality_service.validate_staging_quality(
        staging_id=staging_id,
        raw_data=raw_data,
        category="energy",
        staging_system="ems",
    )

    print("\n데이터 품질 검증 결과:")
    for finding in findings:
        print(f"[{finding.rule_code}] {finding.message}")
        print(f"  Row: {finding.csv_row}, Severity: {finding.severity}")


if __name__ == "__main__":
    # 통합 검증 실행
    print("=" * 80)
    print("예제 1: 종합 검증")
    print("=" * 80)
    try:
        example_comprehensive_validation()
    except Exception as e:
        print(f"오류 발생: {e}")
        print("(실제 환경에서는 DB 연결 및 데이터가 필요합니다)")

    # 개별 서비스 실행
    print("\n" + "=" * 80)
    print("예제 2: 개별 서비스")
    print("=" * 80)
    example_individual_service()
