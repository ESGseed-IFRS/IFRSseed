"""Shared DB bootstrap (SQLAlchemy Base/engine/session) for backend domains."""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Prefer backend/.env, then fallback to repo-root .env.
_backend_dir = Path(__file__).resolve().parents[1]
env_path = _backend_dir / ".env"
_repo_root_env = _backend_dir.parent / ".env"

for _p in (env_path, _repo_root_env):
    if not _p.exists():
        continue
    try:
        load_dotenv(_p, encoding="utf-8")
        break
    except UnicodeDecodeError:
        try:
            load_dotenv(_p, encoding="utf-16")
            break
        except Exception:
            load_dotenv(_p)
            break

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost/ifrs_agent",
)


def _create_engine_with_pool(url: str):
    """Pool + libpq keepalive: 장시간 LLM 대기로 DB idle 끊김(SSL closed) 완화."""
    kwargs: dict = {
        "pool_pre_ping": True,
        "pool_size": 5,
        "max_overflow": 10,
        # 서버/프록시가 오래된 풀 연결을 끊기 전에 클라이언트가 교체
        "pool_recycle": int(os.getenv("SQLALCHEMY_POOL_RECYCLE", "1800")),
        "echo": False,
    }
    try:
        parsed = make_url(url)
        if parsed.drivername.startswith("postgresql"):
            # psycopg2/libpq: TCP keepalive로 세션 장시간 유지 중 연결 생존
            kwargs["connect_args"] = {
                "keepalives": 1,
                "keepalives_idle": int(os.getenv("PG_KEEPALIVES_IDLE", "30")),
                "keepalives_interval": int(os.getenv("PG_KEEPALIVES_INTERVAL", "10")),
                "keepalives_count": int(os.getenv("PG_KEEPALIVES_COUNT", "5")),
            }
    except Exception:
        pass
    return create_engine(url, **kwargs)


engine = _create_engine_with_pool(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_session():
    return SessionLocal()


def init_db():
    Base.metadata.create_all(bind=engine)
