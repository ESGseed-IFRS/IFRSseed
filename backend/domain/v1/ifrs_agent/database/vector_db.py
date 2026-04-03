"""벡터 DB 초기화 및 관리

PostgreSQL + pgvector를 사용한 벡터 데이터베이스 초기화 및 관리 함수들
"""
from sqlalchemy import text
from loguru import logger
from .base import engine, Base, init_db


def enable_pgvector_extension():
    """pgvector 확장 활성화"""
    logger.info("🔧 pgvector 확장 활성화 중...")
    
    try:
        with engine.connect() as conn:
            # pgvector 확장 활성화
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
            logger.info("✅ pgvector 확장 활성화 완료")
            return True
    except Exception as e:
        logger.error(f"❌ pgvector 확장 활성화 실패: {e}")
        logger.warning("⚠️ PostgreSQL에 pgvector 확장이 설치되어 있지 않을 수 있습니다.")
        logger.warning("⚠️ 설치 방법: https://github.com/pgvector/pgvector")
        return False


def check_pgvector_installed():
    """pgvector 확장 설치 여부 확인"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'vector'
                );
            """))
            installed = result.scalar()
            return installed
    except Exception as e:
        logger.error(f"❌ pgvector 확인 실패: {e}")
        return False


def init_vector_db():
    """벡터 DB 전체 초기화
    
    pgvector 확장 활성화, 테이블 생성, 인덱스 생성까지 모두 수행합니다.
    
    Returns:
        bool: 초기화 성공 여부
    """
    logger.info("=" * 60)
    logger.info("벡터 DB 초기화 시작")
    logger.info("=" * 60)
    
    # 1. pgvector 확장 확인 및 활성화
    if not check_pgvector_installed():
        logger.warning("⚠️ pgvector 확장이 설치되지 않았습니다.")
        if not enable_pgvector_extension():
            logger.error("❌ pgvector 확장 활성화 실패. 수동으로 설치해주세요.")
            logger.info("설치 방법:")
            logger.info("  PostgreSQL에 접속하여 실행:")
            logger.info("  CREATE EXTENSION IF NOT EXISTS vector;")
            return False
    else:
        logger.info("✅ pgvector 확장이 이미 설치되어 있습니다.")
    
    # 2. 모든 테이블 생성
    logger.info("📦 테이블 생성 중...")
    try:
        init_db()
        logger.info("✅ 테이블 생성 완료")
    except Exception as e:
        logger.error(f"❌ 테이블 생성 실패: {e}")
        return False
    
    logger.info("=" * 60)
    logger.info("✅ 벡터 DB 초기화 완료!")
    logger.info("=" * 60)
    
    return True

