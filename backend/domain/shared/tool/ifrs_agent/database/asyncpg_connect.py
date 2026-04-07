"""
asyncpg 연결 헬퍼 (연결 풀 기반)

DATABASE_URL에 sslrootcert 등이 포함된 경우 Windows에서 경로(비ASCII) 때문에
ssl.load_verify_locations에서 OSError(42)가 날 수 있음.

다른 API(esg_data, ghg_calculation, data_integration 일부)는 같은 DATABASE_URL을
SQLAlchemy+psycopg2로 쓴다. 드라이버가 달라 SSL/CA 파일 처리 경로가 다르고,
asyncpg는 URL의 sslrootcert를 OpenSSL로 직접 읽는다.

ASYNCPG_SSL_DISABLE=true: 로컬 Postgres 등 — URL에서 SSL 쿼리 제거 후 ssl=False.

ASYNCPG_FORCE_DEFAULT_SSL: 설정 기본 True. 끄려면 ASYNCPG_FORCE_DEFAULT_SSL=0 —
첫 연결부터 ssl* 쿼리 제거 + 시스템 기본 CA(ssl.create_default_context).
Windows 비ASCII sslrootcert 경고·errno 42 1회 실패를 피함(Neon 등 공인 CA).

errno 42 / Illegal byte sequence 자동 재시도: URL에서 sslrootcert 등만 제거하고
ssl.create_default_context()로 연결(Neon 등 공인 CA — 시스템 신뢰 저장소 사용).
ssl=False로 재시도하면 서버가 sslmode=require 일 때 "connection is insecure"가 난다.

연결 풀: asyncpg.create_pool을 사용하여 연결 재사용, 생성 비용 제거, 서버 부하 감소.
"""
from __future__ import annotations

import asyncio
import logging
import ssl
from typing import Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import asyncpg

from backend.core.config.settings import get_settings

logger = logging.getLogger("ifrs_agent.tools.asyncpg_connect")

# 전역 연결 풀
_pool: Optional[asyncpg.Pool] = None
_pool_lock = asyncio.Lock()

_SSL_QUERY_KEYS = frozenset(
    {
        "sslmode",
        "sslrootcert",
        "sslcert",
        "sslkey",
        "sslcrl",
        "sslpassword",
    }
)


def _dsn_without_ssl_query(dsn: str) -> str:
    if not dsn.strip():
        return dsn
    parsed = urlparse(dsn)
    pairs = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() not in _SSL_QUERY_KEYS
    ]
    new_query = urlencode(pairs)
    return urlunparse(parsed._replace(query=new_query))


def _is_ssl_ca_path_oserror(exc: BaseException) -> bool:
    if isinstance(exc, OSError) and getattr(exc, "errno", None) == 42:
        return True
    msg = str(exc).lower()
    return "illegal byte sequence" in msg


async def get_or_create_pool() -> asyncpg.Pool:
    """
    전역 연결 풀 반환 (없으면 생성).
    
    연결 풀 설정:
    - min_size=5: 최소 유지 연결 수
    - max_size=20: 최대 연결 수 (Neon 등 제한 고려)
    - timeout=30: 풀에서 연결 획득 타임아웃 (초)
    - command_timeout=60: 쿼리 실행 타임아웃 (초)
    """
    global _pool
    
    if _pool is not None:
        return _pool
    
    async with _pool_lock:
        if _pool is not None:
            return _pool
        
        s = get_settings()
        dsn = s.database_url
        if not dsn.strip():
            raise ValueError("DATABASE_URL is empty")
        
        # SSL 설정
        ssl_context = None
        if s.asyncpg_ssl_disable:
            clean = _dsn_without_ssl_query(dsn)
            ssl_context = False
        else:
            clean = _dsn_without_ssl_query(dsn)
            ssl_context = ssl.create_default_context()
        
        logger.info("Creating asyncpg connection pool (min=5, max=20)")
        
        try:
            _pool = await asyncpg.create_pool(
                clean,
                ssl=ssl_context,
                min_size=5,
                max_size=20,
                timeout=30,
                command_timeout=60,
            )
            logger.info("Connection pool created successfully")
            return _pool
        
        except OSError as exc:
            if _is_ssl_ca_path_oserror(exc):
                logger.warning(
                    "asyncpg SSL/CA 경로 오류(errno 42 등) — URL에서 SSL 쿼리 제거 후 "
                    "기본 TLS 컨텍스트로 재시도(공인 CA). sslrootcert는 ASCII 경로로 두는 것이 가장 안전."
                )
                clean = _dsn_without_ssl_query(dsn)
                ctx = ssl.create_default_context()
                _pool = await asyncpg.create_pool(
                    clean,
                    ssl=ctx,
                    min_size=5,
                    max_size=20,
                    timeout=30,
                    command_timeout=60,
                )
                logger.info("Connection pool created successfully (after SSL retry)")
                return _pool
            raise


async def close_pool():
    """연결 풀 종료 (애플리케이션 종료 시 호출)"""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("Connection pool closed")


async def connect_ifrs_asyncpg() -> asyncpg.Connection:
    """
    레거시 호환용 함수 - 풀에서 연결 획득.
    
    주의: 이 함수로 획득한 연결은 반드시 release()해야 합니다.
    새 코드는 async with pool.acquire() 패턴 사용 권장.
    """
    pool = await get_or_create_pool()
    return await pool.acquire()
