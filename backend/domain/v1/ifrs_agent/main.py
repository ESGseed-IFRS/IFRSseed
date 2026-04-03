#!/usr/bin/env python
"""IFRS Agent 서비스 메인 진입점"""
import os
import sys
from pathlib import Path
from typing import List, Optional
from dotenv import load_dotenv
from loguru import logger

# Windows에서 Unicode 출력 문제 해결
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass  # Python 3.6 이하에서는 지원하지 않음

# 프로젝트 루트를 경로에 추가 (ai 디렉토리)
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

# 환경 변수 로드 (루트 디렉토리의 .env 파일)
env_path = project_root.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()  # 현재 디렉토리에서 찾기


def initialize_service():
    """서비스 초기화"""
    logger.info("🚀 IFRS Agent 서비스 초기화 중...")
    
    # 데이터베이스 연결 확인
    try:
        from ifrs_agent.database.base import get_session
        db = get_session()
        db.close()
        logger.info("✅ 데이터베이스 연결 성공")
    except Exception as e:
        logger.error(f"❌ 데이터베이스 연결 실패: {e}")
        raise
    
    logger.info("✅ 서비스 초기화 완료")


def generate_report(
    query: str,
    target_standards: List[str] = None,
    fiscal_year: int = None,
    company_id: str = None,
    document_paths: List[str] = None,
    additional_context: Optional[str] = None
) -> dict:
    """
    IFRS 보고서 생성 함수
    
    Args:
        query: 작성할 섹션에 대한 쿼리 (예: '기후 리스크의 재무적 영향 섹션 작성')
        target_standards: 대상 기준서 목록 (기본값: ["IFRS_S2"])
        fiscal_year: 회계 연도
        company_id: 회사 ID
        document_paths: 문서 파일 경로 목록
        additional_context: 추가 컨텍스트 정보
    
    Returns:
        보고서 생성 결과 딕셔너리
    """
    if target_standards is None:
        target_standards = ["IFRS_S2"]
    
    if document_paths is None:
        document_paths = []
    
    logger.info(f"📝 보고서 생성 요청: {query}")
    logger.info(f"   기준서: {target_standards}")
    logger.info(f"   회계연도: {fiscal_year}")
    logger.info(f"   회사ID: {company_id}")
    logger.info(f"   문서 수: {len(document_paths)}")
    
    try:
        # 워크플로우 초기화 및 실행
        from ifrs_agent.orchestrator.workflow import IFRSAgentWorkflow
        
        workflow = IFRSAgentWorkflow()
        
        # 동기 실행 (CLI에서 사용)
        result = workflow.run_sync(
            query=query,
            documents=document_paths,
            target_standards=target_standards,
            fiscal_year=fiscal_year,
            company_id=company_id
        )
        
        # 결과 포맷팅
        success = result.get("status") not in ["error", "failed"]
        
        return {
            "success": success,
            "status": result.get("status", "unknown"),
            "report_id": f"report_{company_id}_{fiscal_year}" if company_id and fiscal_year else "report_unknown",
            "fact_sheets": result.get("fact_sheets", []),
            "generated_sections": result.get("generated_sections", []),
            "validation_results": result.get("validation_results", []),
            "message": "보고서 생성 완료" if success else "보고서 생성 실패",
            "errors": result.get("errors", []),
            "metadata": {
                "query": query,
                "target_standards": target_standards,
                "fiscal_year": fiscal_year,
                "company_id": company_id,
                "documents_count": len(document_paths),
                "fact_sheets_count": len(result.get("fact_sheets", [])),
                "generated_sections_count": len(result.get("generated_sections", []))
            }
        }
        
    except Exception as e:
        logger.error(f"❌ 보고서 생성 실패: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise


def get_data_points(
    standard: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 100
) -> List[dict]:
    """
    데이터 포인트 조회 함수
    
    Args:
        standard: 기준서 필터 (예: "IFRS_S2")
        category: 카테고리 필터 ("E", "S", "G")
        limit: 최대 조회 개수
    
    Returns:
        데이터 포인트 목록
    """
    try:
        from ifrs_agent.database.base import get_session
        from ifrs_agent.model.models import DataPoint
        
        db = get_session()
        try:
            query = db.query(DataPoint).filter(DataPoint.is_active == True)
            
            if standard:
                query = query.filter(DataPoint.standard == standard)
            if category:
                query = query.filter(DataPoint.category == category)
            
            dps = query.limit(limit).all()
            result = [
                {
                    "dp_id": dp.dp_id,
                    "dp_code": dp.dp_code,
                    "name_ko": dp.name_ko,
                    "name_en": dp.name_en,
                    "standard": dp.standard,
                    "category": dp.category
                }
                for dp in dps
            ]
            logger.info(f"✅ 데이터 포인트 조회 완료: {len(result)}개")
            return result
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ 데이터 포인트 조회 실패: {e}")
        raise


def main():
    """메인 실행 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description="IFRS Agent 서비스")
    parser.add_argument(
        "--init",
        action="store_true",
        help="서비스 초기화"
    )
    parser.add_argument(
        "--generate",
        type=str,
        help="보고서 생성 쿼리"
    )
    parser.add_argument(
        "--standards",
        nargs="+",
        default=["IFRS_S2"],
        help="대상 기준서 목록"
    )
    parser.add_argument(
        "--fiscal-year",
        type=int,
        help="회계 연도"
    )
    parser.add_argument(
        "--company-id",
        type=str,
        help="회사 ID"
    )
    parser.add_argument(
        "--documents",
        nargs="+",
        help="문서 파일 경로 목록"
    )
    parser.add_argument(
        "--data-points",
        action="store_true",
        help="데이터 포인트 조회"
    )
    parser.add_argument(
        "--standard",
        type=str,
        help="데이터 포인트 조회 시 기준서 필터"
    )
    parser.add_argument(
        "--category",
        type=str,
        choices=["E", "S", "G"],
        help="데이터 포인트 조회 시 카테고리 필터"
    )
    parser.add_argument(
        "--test-rag",
        action="store_true",
        help="RAG Node만 테스트 (팩트 시트 생성)"
    )
    parser.add_argument(
        "--target-dps",
        nargs="+",
        help="RAG Node 테스트 시 추출할 DP 목록 (예: S2-15-a S2-16-a)"
    )
    
    args = parser.parse_args()
    
    # 서비스 초기화
    if args.init:
        initialize_service()
        return
    
    # 데이터 포인트 조회
    if args.data_points:
        dps = get_data_points(
            standard=args.standard,
            category=args.category
        )
        print(f"\n📊 데이터 포인트 조회 결과 ({len(dps)}개):")
        for dp in dps:
            print(f"  - {dp['dp_id']}: {dp['name_ko']} ({dp['standard']})")
        return
    
    # 보고서 생성
    if args.generate:
        if not args.fiscal_year or not args.company_id:
            parser.error("--generate 사용 시 --fiscal-year와 --company-id가 필요합니다.")
        
        result = generate_report(
            query=args.generate,
            target_standards=args.standards,
            fiscal_year=args.fiscal_year,
            company_id=args.company_id,
            document_paths=args.documents or []
        )
        
        print("\n📄 보고서 생성 결과:")
        print(f"  성공: {result['success']}")
        print(f"  상태: {result.get('status', 'unknown')}")
        print(f"  리포트 ID: {result.get('report_id')}")
        print(f"  메시지: {result['message']}")
        
        # 팩트 시트 정보
        fact_sheets = result.get('fact_sheets', [])
        if fact_sheets:
            print(f"\n📊 팩트 시트 ({len(fact_sheets)}개):")
            for fs in fact_sheets[:5]:  # 최대 5개만 출력
                print(f"  - {fs.get('dp_id')}: {fs.get('dp_name', 'N/A')}")
                print(f"    값: {fs.get('values', {})}")
                print(f"    단위: {fs.get('unit', 'N/A')}")
                print(f"    신뢰도: {fs.get('confidence', 0):.2f}")
            if len(fact_sheets) > 5:
                print(f"  ... 외 {len(fact_sheets) - 5}개")
        
        # 생성된 섹션 정보
        sections = result.get('generated_sections', [])
        if sections:
            print(f"\n📝 생성된 섹션 ({len(sections)}개):")
            for section in sections[:3]:  # 최대 3개만 출력
                print(f"  - {section.get('section_name', 'N/A')}")
        
        # 에러 정보
        errors = result.get('errors', [])
        if errors:
            print(f"\n⚠️ 에러 ({len(errors)}개):")
            for error in errors:
                print(f"  - {error}")
        
        return
    
    # RAG Node 테스트
    if args.test_rag:
        if not args.generate or not args.fiscal_year or not args.company_id:
            parser.error("--test-rag 사용 시 --generate(쿼리), --fiscal-year, --company-id가 필요합니다.")
        
        if not args.target_dps:
            parser.error("--test-rag 사용 시 --target-dps가 필요합니다.")
        
        import asyncio
        from ifrs_agent.agent.rag_node import RAGNode
        from ifrs_agent.orchestrator.state import IFRSAgentState
        
        async def test_rag():
            """RAG Node 테스트"""
            logger.info("🧪 RAG Node 테스트 시작")
            
            # RAG Node 초기화
            rag_node = RAGNode()
            
            # 테스트 상태 생성
            state: IFRSAgentState = {
                "query": args.generate,
                "documents": args.documents or [],
                "target_standards": args.standards,
                "fiscal_year": args.fiscal_year,
                "company_id": args.company_id,
                "current_node": "rag_node",
                "iteration_count": 0,
                "status": "retrieving",
                "target_dps": args.target_dps,
                "fact_sheets": [],
                "yearly_data": {},
                "generated_sections": [],
                "validation_results": [],
                "corporate_identity": {},
                "reference_sources": [],
                "audit_log": [],
                "errors": []
            }
            
            # RAG Node 실행
            result = await rag_node.process(state)
            
            # 결과 출력
            print("\n📊 RAG Node 테스트 결과:")
            print(f"  상태: {result.get('status', 'unknown')}")
            print(f"  생성된 팩트 시트 수: {len(result.get('fact_sheets', []))}")
            
            fact_sheets = result.get('fact_sheets', [])
            if fact_sheets:
                print("\n📋 팩트 시트 상세:")
                for i, fs in enumerate(fact_sheets, 1):
                    print(f"\n  [{i}] DP ID: {fs.get('dp_id')}")
                    print(f"      이름: {fs.get('dp_name', 'N/A')}")
                    print(f"      설명: {fs.get('description', 'N/A')[:100]}...")
                    print(f"      값: {fs.get('values', {})}")
                    print(f"      단위: {fs.get('unit', 'N/A')}")
                    print(f"      출처: {fs.get('source', 'N/A')}")
                    print(f"      신뢰도: {fs.get('confidence', 0):.2f}")
                    if fs.get('topic'):
                        print(f"      주제: {fs.get('topic')} > {fs.get('subtopic', 'N/A')}")
            else:
                print("  ⚠️ 팩트 시트가 생성되지 않았습니다.")
            
            errors = result.get('errors', [])
            if errors:
                print(f"\n⚠️ 에러 ({len(errors)}개):")
                for error in errors:
                    print(f"  - {error}")
            
            return result
        
        # 비동기 실행
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        loop.run_until_complete(test_rag())
        return
    
    # 인자가 없으면 도움말 표시
    parser.print_help()


if __name__ == "__main__":
    main()
