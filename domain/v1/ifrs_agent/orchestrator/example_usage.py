"""오케스트레이터 사용 예제

이 파일은 오케스트레이터의 기본 사용법을 보여줍니다.
"""
import asyncio
from ifrs_agent.orchestrator import IFRSAgentWorkflow


async def main():
    """기본 사용 예제"""
    
    # 워크플로우 초기화
    workflow = IFRSAgentWorkflow(
        config={
            "max_retries": 3,
            "enable_checkpointing": False
        }
    )
    
    # 워크플로우 실행
    result = await workflow.run(
        query="IFRS S2 기준으로 기후 관련 위험과 기회를 보고서에 포함해주세요",
        target_standards=["IFRS_S2"],
        fiscal_year=2024,
        company_id="test_company_001"
    )
    
    # 결과 출력
    print(f"상태: {result['status']}")
    print(f"식별된 DP: {len(result['target_dps'])}개")
    print(f"추출된 팩트 시트: {len(result['fact_sheets'])}개")
    print(f"생성된 섹션: {len(result['generated_sections'])}개")
    print(f"감사 로그: {len(result['audit_log'])}개 항목")
    
    if result.get("errors"):
        print(f"에러: {result['errors']}")


if __name__ == "__main__":
    asyncio.run(main())

