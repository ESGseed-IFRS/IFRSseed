"""데이터베이스 연결 설정"""
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# .env 파일 로드 (ifrsseed 프로젝트 루트에서)
project_root = Path(__file__).resolve().parents[3]  # ifrsseed/ 디렉토리
env_path = project_root / ".env"
if env_path.exists():
    try:
        # UTF-8 인코딩으로 시도
        load_dotenv(env_path, encoding='utf-8')
    except UnicodeDecodeError:
        try:
            # UTF-16 인코딩으로 시도
            load_dotenv(env_path, encoding='utf-16')
        except Exception:
            # 기본 방식으로 시도
            load_dotenv(env_path)

# NeonDB 연결 문자열
# 예: postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost/ifrs_agent"
)

# Engine 생성
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # 연결 유효성 검사
    pool_size=5,
    max_overflow=10,
    echo=False  # SQL 로깅 (개발 시 True)
)

# Session 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base 클래스
Base = declarative_base()


def get_db():
    """FastAPI 등에서 사용할 DB 세션 (제너레이터)"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_session():
    """일반적인 DB 세션 생성"""
    return SessionLocal()


def init_db():
    """데이터베이스 초기화 (테이블 생성)"""
    Base.metadata.create_all(bind=engine)


def create_sample_dp():
    """샘플 DP 생성 (테스트/개발용)"""
    from model.models import DataPoint, DPTypeEnum
    
    db = get_session()
    try:
        new_dp = DataPoint(
            dp_id="S2-29-a",
            dp_code="IFRS_S2_SCOPE1_EMISSIONS",
            name_ko="Scope 1 온실가스 배출량",
            name_en="Scope 1 GHG emissions",
            standard="IFRS_S2",
            category="E",
            topic="지표 및 목표",
            dp_type=DPTypeEnum.QUANTITATIVE,
            validation_rules={"min": 0},
            is_active=True
        )
        db.add(new_dp)
        db.commit()
        print("✅ 샘플 DP 생성 완료!")
        return new_dp
    except Exception as e:
        db.rollback()
        print(f"❌ 에러: {e}")
        raise
    finally:
        db.close()


# 개발/테스트용 실행
if __name__ == "__main__":
    print("데이터베이스 초기화 중...")
    init_db()
    print("✅ 데이터베이스 초기화 완료!")
    
    print("샘플 데이터 생성 중...")
    try:
        create_sample_dp()
    except Exception as e:
        print(f"⚠️ 샘플 데이터 생성 실패: {e}")