"""개선된 매핑 자동 추천 스크립트 (하이브리드 접근법)

MappingSuggestionService를 사용하여 벡터 검색과 구조적 필터링을 결합한
하이브리드 접근법으로 매핑 후보를 자동 추천합니다.

================================================================================
⚠️ 스크립트 제거 고려사항
================================================================================

이 스크립트는 **트리거 역할(CLI 진입점)**만 수행합니다.

[아키텍처 구조]
  Script Layer (이 파일) → Service Layer → Repository Layer → Database
  
[스크립트의 역할]
  - 명령줄 인자 파싱
  - Service 메서드 호출
  - 결과 출력
  
[제거 가능 여부]
  ✅ 제거 가능: 
     - 다른 코드에서 import하지 않음
     - 실제 비즈니스 로직은 Service 레이어에 있음
     - Python 코드에서 직접 Service 호출 가능
  
  ⚠️ 유지 권장:
     - CLI에서 직접 실행 가능한 편의성
     - 배치 작업/자동화에 유용
     - 사용자가 터미널에서 쉽게 실행 가능

[제거 시 대안]
  Python 코드에서 직접 호출:
    from ifrs_agent.database.base import get_session
    from ifrs_agent.service.mapping_suggestion_service import MappingSuggestionService
    
    db = get_session()
    service = MappingSuggestionService(db)
    stats = service.auto_suggest_mappings_batch(
        source_standard="GRI",
        target_standard="ESRS",
        batch_size=100
    )

[관련 문서]
  - ARCHITECTURE.md: 매핑 추천 시스템 아키텍처 상세 설명
  - DATA_ONTOLOGY.md: standard_mappings 테이블 구조 및 매핑 타입 설명

================================================================================

사용법:
    python auto_suggest_mappings_improved.py                    # 기본: GRI -> ESRS
    python auto_suggest_mappings_improved.py --source GRI --target ESRS
    python auto_suggest_mappings_improved.py --threshold 0.80
    python auto_suggest_mappings_improved.py --dry-run
"""
import sys
import os
from pathlib import Path
import argparse

# 프로젝트 루트를 경로에 추가
script_dir = Path(__file__).parent.resolve()
project_root = script_dir.parent.parent
sys.path.insert(0, str(project_root))

# .env 파일 로드
from dotenv import load_dotenv
env_path = project_root.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from loguru import logger

from ifrs_agent.service.mapping_suggestion_service import MappingSuggestionService


def get_db_session():
    """데이터베이스 세션 생성
    
    [트리거 역할]
    이 함수는 스크립트 실행을 위한 DB 세션을 생성합니다.
    실제 데이터 접근은 Repository 레이어에서 처리됩니다.
    """
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL 환경 변수가 설정되지 않았습니다.")
    
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    return Session()


def main():
    """메인 실행 함수
    
    [트리거 역할]
    이 함수는 CLI 인터페이스만 제공하며, 실제 비즈니스 로직은
    MappingSuggestionService.auto_suggest_mappings_batch()에서 처리됩니다.
    
    [처리 흐름]
    1. 명령줄 인자 파싱
    2. DB 세션 생성
    3. Service 인스턴스 생성
    4. Service 메서드 호출 (실제 로직 실행)
    5. 결과 출력
    
    [제거 고려사항]
    - 이 스크립트를 제거해도 Service 레이어의 기능은 그대로 사용 가능
    - 다른 Python 코드에서 직접 Service를 호출하여 동일한 기능 수행 가능
    """
    parser = argparse.ArgumentParser(description="개선된 매핑 자동 추천 (하이브리드 접근법)")
    parser.add_argument("--source", type=str, default="GRI", help="원본 기준서 (기본: GRI)")
    parser.add_argument("--target", type=str, default="ESRS", help="대상 기준서 (기본: ESRS)")
    parser.add_argument("--vector-threshold", type=float, default=0.70, help="벡터 검색 임계값 (기본: 0.70)")
    parser.add_argument("--structural-threshold", type=float, default=0.50, help="구조적 점수 임계값 (기본: 0.50)")
    parser.add_argument("--final-threshold", type=float, default=0.75, help="최종 점수 임계값 (기본: 0.75)")
    parser.add_argument("--batch-size", type=int, default=40, help="한 번에 처리할 DP 수 (기본: 40)")
    parser.add_argument("--dry-run", action="store_true", help="실제 저장 없이 테스트")
    
    args = parser.parse_args()
    
    try:
        db = get_db_session()
        logger.info("데이터베이스 연결 성공")
        
        service = MappingSuggestionService(db)
        
        stats = service.auto_suggest_mappings_batch(
            source_standard=args.source,
            target_standard=args.target,
            vector_threshold=args.vector_threshold,
            structural_threshold=args.structural_threshold,
            final_threshold=args.final_threshold,
            batch_size=args.batch_size,
            dry_run=args.dry_run
        )
        
        logger.info("=" * 50)
        logger.info("자동 매핑 완료 (하이브리드 접근법)")
        logger.info(f"  처리한 DP: {stats['processed']}개")
        logger.info(f"  자동 확정 (exact): {stats.get('auto_confirmed_exact', 0)}개")
        logger.info(f"  자동 확정 (partial): {stats.get('auto_confirmed_partial', 0)}개")
        logger.info(f"  자동 확정 (no_mapping): {stats.get('auto_confirmed_no_mapping', 0)}개")
        logger.info(f"  추천 (auto_suggested): {stats.get('suggested', 0)}개")
        logger.info(f"  낮은 점수로 건너뜀: {stats['skipped_low_score']}개")
        logger.info(f"  임베딩 없음: {stats['skipped_no_embedding']}개")
        logger.info(f"  오류: {stats['errors']}개")
        logger.info("=" * 50)
        
        db.close()
        
    except Exception as e:
        logger.error(f"오류 발생: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
