"""Data Integration API만 실행하는 진입점.

backend/api/v1/data_integration 라우터만 올려 한 포트에서 서비스합니다.
전체 Backend API는 backend/api/v1/main.py 를 사용하세요.

배치형 적재(삼성SDS 언론보도 → external_company_data)는 동일 프로세스에서
POST /data-integration/external-company/sds-news/ingest 로 트리거합니다.

MCP SR Index 도구 서버: MCP_SR_INDEX_TOOLS_URL이 미설정이면 main 기동 시 자동으로
서브프로세스로 기동합니다. 이미 URL이 설정되어 있으면 별도 서버를 사용합니다.
"""
from __future__ import annotations

import asyncio
import os
import socket
import subprocess
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

# 프로젝트 루트(ifrsseedr_re)를 path에 추가 — import backend 사용을 위해
_project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

try:
    from dotenv import load_dotenv
    # 셸에 남아 있는 이전 환경변수보다 .env 값을 우선 적용
    load_dotenv(_project_root / ".env", override=True)
except ImportError:
    pass

from fastapi import FastAPI

from backend.api.v1.data_integration.routes import router as data_integration_router
from backend.core.config.settings import get_settings

# 폴링: 이전 ingest가 끝나기 전 다음 주기가 오면 중복 실행 방지
_sds_news_poll_ingest_task: asyncio.Task | None = None


def _mcp_index_bind() -> tuple[str, int, str]:
    """자동 기동 MCP 바인딩: MCP_SR_INDEX_TOOLS_* 우선, 없으면 공통 MCP_HTTP_* (core settings)."""
    s = get_settings()
    host = os.environ.get("MCP_SR_INDEX_TOOLS_HOST", "").strip() or s.mcp_http_host
    port_s = os.environ.get("MCP_SR_INDEX_TOOLS_PORT", "").strip()
    port = int(port_s) if port_s else s.mcp_http_port
    path = os.environ.get("MCP_SR_INDEX_TOOLS_PATH", "").strip() or s.mcp_http_path
    return host, port, path

# 자동 기동한 MCP Index 서버 프로세스 (shutdown 시 종료용)
_mcp_index_server_process: subprocess.Popen | None = None

# MCP Index 서버 스크립트 경로 (프로젝트 루트 기준)
_MCP_INDEX_SERVER_SCRIPT = (
    _project_root / "backend" / "domain" / "v1" / "data_integration"
    / "spokes" / "infra" / "sr_index_tools_server.py"
)


def _wait_for_port(host: str, port: int, timeout_sec: float = 30.0, interval: float = 0.3) -> bool:
    """지정 포트가 열릴 때까지 대기."""
    deadline = time.monotonic() + timeout_sec
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((host, port), timeout=1.0):
                return True
        except (OSError, socket.error):
            time.sleep(interval)
    return False


@asynccontextmanager
async def _lifespan(app: FastAPI):
    """앱 수명 주기: MCP Index 서버 자동 기동/종료 + SDS 뉴스 폴링."""
    global _mcp_index_server_process

    url_raw = os.environ.get("MCP_SR_INDEX_TOOLS_URL", "").strip()
    if url_raw:
        # 사용자 정보/쿼리스트링 노출 방지를 위해 간단 마스킹
        masked_url = url_raw.split("?", 1)[0]
    else:
        masked_url = "(unset)"

    # 런타임 환경 확인용 시작 로그 (민감정보는 값 대신 설정 여부만 출력)
    llama_set = bool(get_settings().llama_cloud_api_key.strip())
    print(
        "[DataIntegration] env check: "
        f"MCP_SR_INDEX_TOOLS_URL={'set' if url_raw else 'unset'}({masked_url}), "
        f"LLAMA_CLOUD_API_KEY={'set' if llama_set else 'unset'}",
        file=sys.stderr,
        flush=True,
    )

    url_env = url_raw
    
    # MCP Index 서버 자동 기동
    if not url_env:
        mcp_host, mcp_port, mcp_path = _mcp_index_bind()
        url = f"http://{mcp_host}:{mcp_port}{mcp_path}"

        if _MCP_INDEX_SERVER_SCRIPT.exists():
            env = os.environ.copy()
            env["MCP_HTTP"] = "1"
            env["MCP_HTTP_HOST"] = mcp_host
            env["MCP_HTTP_PORT"] = str(mcp_port)
            env["MCP_HTTP_PATH"] = mcp_path

            try:
                _mcp_index_server_process = subprocess.Popen(
                    [sys.executable, str(_MCP_INDEX_SERVER_SCRIPT)],
                    cwd=str(_project_root),
                    env=env,
                    stdout=subprocess.DEVNULL,
                    stderr=None,
                )
                os.environ["MCP_SR_INDEX_TOOLS_URL"] = url

                if _wait_for_port(mcp_host, mcp_port, timeout_sec=25.0):
                    print(f"[DataIntegration] MCP SR Index 도구 서버 자동 기동: {url}", file=sys.stderr, flush=True)
            except Exception as e:
                print(f"[DataIntegration] MCP Index 서버 기동 실패: {e}", file=sys.stderr, flush=True)
    
    # SDS 뉴스 폴링 백그라운드 태스크
    polling_task = None
    if get_settings().sds_news_auto_poll:
        from backend.domain.v1.data_integration.hub.orchestrator.sds_news_ingest_orchestrator import (
            run_sds_news_ingest,
        )
        polling_task = asyncio.create_task(_poll_sds_news(run_sds_news_ingest))
        print(
            f"[DataIntegration] SDS 뉴스 자동 폴링 시작 (interval={get_settings().sds_news_poll_interval_s}s)",
            file=sys.stderr,
            flush=True,
        )
    
    yield
    
    # 종료: 폴링 태스크 취소
    if polling_task:
        polling_task.cancel()
        try:
            await polling_task
        except asyncio.CancelledError:
            pass
        print("[DataIntegration] SDS 뉴스 폴링 종료", file=sys.stderr, flush=True)

    global _sds_news_poll_ingest_task
    if _sds_news_poll_ingest_task is not None and not _sds_news_poll_ingest_task.done():
        _sds_news_poll_ingest_task.cancel()
        try:
            await _sds_news_poll_ingest_task
        except asyncio.CancelledError:
            pass
        _sds_news_poll_ingest_task = None
    
    # 종료: MCP Index 서버 종료
    if _mcp_index_server_process is not None:
        try:
            _mcp_index_server_process.terminate()
            _mcp_index_server_process.wait(timeout=5)
        except Exception:
            try:
                _mcp_index_server_process.kill()
            except Exception:
                pass
        _mcp_index_server_process = None
    if url_env:
        pass  # 외부 서버 사용 시 종료 안 함
    elif os.environ.get("MCP_SR_INDEX_TOOLS_URL"):
        os.environ.pop("MCP_SR_INDEX_TOOLS_URL", None)


async def _poll_sds_news(run_ingest_fn):
    """SDS 뉴스 폴링 루프. 이전 배치가 아직 끝나지 않았으면 해당 주기는 스킵."""
    from loguru import logger

    global _sds_news_poll_ingest_task

    interval = get_settings().sds_news_poll_interval_s

    async def _ingest_once() -> None:
        await asyncio.to_thread(run_ingest_fn, anchor_company_id=None)

    while True:
        await asyncio.sleep(interval)
        if _sds_news_poll_ingest_task is not None and not _sds_news_poll_ingest_task.done():
            logger.warning(
                "SDS 뉴스 ingest가 이전 주기에서 아직 실행 중이라 이번 폴링을 스킵합니다 "
                "(처리 시간이 {}초보다 길면 주기적으로 스킵될 수 있음)",
                interval,
            )
            continue
        try:
            logger.info("SDS 뉴스 폴링 체크 시작")
            _sds_news_poll_ingest_task = asyncio.create_task(_ingest_once())

            def _done(t: asyncio.Task) -> None:
                try:
                    t.result()
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.exception("SDS 뉴스 폴링 ingest 오류: {}", e)

            _sds_news_poll_ingest_task.add_done_callback(_done)
        except Exception as e:
            logger.exception("SDS 뉴스 폴링 오류: {}", e)


app = FastAPI(
    title="Data Integration API",
    description="에이전트 기반 지속가능경영보고서(SR) 검색·다운로드 API",
    version="0.1.0",
    lifespan=_lifespan,
)
app.include_router(data_integration_router)


def run(host: str = "0.0.0.0", port: int | None = None) -> None:
    """ASGI 앱을 실행합니다."""
    import uvicorn

    if port is None:
        port = get_settings().data_integration_port
    reload = get_settings().data_integration_reload
    uvicorn.run(app, host=host, port=port, reload=reload)


if __name__ == "__main__":
    run()
