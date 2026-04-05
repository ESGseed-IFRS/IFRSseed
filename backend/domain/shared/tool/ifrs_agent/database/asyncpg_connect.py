"""
asyncpg 연결 헬퍼

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
"""
from __future__ import annotations

import logging
import ssl
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import asyncpg

from backend.core.config.settings import get_settings

logger = logging.getLogger("ifrs_agent.tools.asyncpg_connect")

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


async def connect_ifrs_asyncpg() -> asyncpg.Connection:
    s = get_settings()
    dsn = s.database_url
    if not dsn.strip():
        raise ValueError("DATABASE_URL is empty")
    if s.asyncpg_ssl_disable:
        clean = _dsn_without_ssl_query(dsn)
        return await asyncpg.connect(clean, ssl=False)
    # errno 42 재시도와 동일 경로를 처음부터 택해 로그·실패 1회를 줄임 (기본 켬, 끄기: ASYNCPG_FORCE_DEFAULT_SSL=0)
    if s.asyncpg_force_default_ssl:
        clean = _dsn_without_ssl_query(dsn)
        ctx = ssl.create_default_context()
        return await asyncpg.connect(clean, ssl=ctx)
    try:
        return await asyncpg.connect(dsn)
    except OSError as exc:
        if _is_ssl_ca_path_oserror(exc):
            logger.warning(
                "asyncpg SSL/CA 경로 오류(errno 42 등) — URL에서 SSL 쿼리 제거 후 "
                "기본 TLS 컨텍스트로 재시도(공인 CA). sslrootcert는 ASCII 경로로 두는 것이 가장 안전."
            )
            clean = _dsn_without_ssl_query(dsn)
            ctx = ssl.create_default_context()
            return await asyncpg.connect(clean, ssl=ctx)
        raise
