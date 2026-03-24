"""SR(지속가능경영보고서) 수집용 MCP Tool Server

웹 페이지에서 PDF 링크 추출, PDF 다운로드 저장 도구를 제공합니다.
data_integration 에이전트 등에서 MCP 클라이언트로 이 서버에 연결해 사용합니다.
"""
import asyncio
import os
import sys
from pathlib import Path
from typing import Any, Dict, List
try:
    from .path_resolver import find_repo_root
except ImportError:
    from path_resolver import find_repo_root

# 저장소 루트 (환경 변수/마커 파일 기반 탐색)
_repo_root = find_repo_root(Path(__file__))
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))
try:
    from dotenv import load_dotenv
    load_dotenv(_repo_root / ".env")
except ImportError:
    pass

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("⚠️ MCP가 설치되지 않았습니다. pip install mcp fastmcp 필요", file=sys.stderr)
    sys.exit(1)

try:
    import requests
    from bs4 import BeautifulSoup
    from urllib.parse import urlparse
    DEPS_AVAILABLE = True
except ImportError:
    DEPS_AVAILABLE = False

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    async_playwright = None  # type: ignore

mcp = FastMCP("SR Tools Server")


def _default_save_dir() -> Path:
    """PDF 저장 기본 디렉터리 (환경변수 또는 repo/data_integration/data)."""
    env_dir = os.getenv("MCP_TOOL_DATA_DIR")
    if env_dir:
        return Path(env_dir)
    return _repo_root / "data_integration" / "data"


def _parse_html_for_pdf_links(html: str, base_url: str) -> List[Dict[str, str]]:
    """HTML 문자열에서 PDF 링크 추출 (requests/Playwright 공통). javascript:, # 등 비실제 URL 제외."""
    soup = BeautifulSoup(html, "html.parser")
    links: List[Dict[str, str]] = []
    for a in soup.find_all("a", href=True):
        href = (a["href"] or "").strip()
        if not href or href.lower().startswith("javascript:") or href == "#":
            continue
        text = a.get_text(strip=True)
        if (
            ".pdf" in href.lower()
            or any(
                kw in text.lower()
                for kw in ["pdf", "다운로드", "download", "지속가능", "sustainability", "esg"]
            )
        ):
            if href.startswith("/"):
                parsed = urlparse(base_url)
                href = f"{parsed.scheme}://{parsed.netloc}{href}"
            if not href.lower().startswith(("http://", "https://")):
                continue
            links.append({"href": href, "text": text})
    return links[:20]


def _fetch_page_links_sync(url: str) -> List[Dict[str, str]]:
    """동기: 페이지 요청 후 PDF 링크 추출 (to_thread에서 호출)."""
    resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
    resp.raise_for_status()
    raw = resp.content
    for enc in ("utf-8", "cp949", "euc-kr", "iso-8859-1"):
        try:
            html = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        html = raw.decode("utf-8", errors="replace")
    return _parse_html_for_pdf_links(html, url)


async def _fetch_page_links_playwright(url: str, timeout: float = 15000) -> List[Dict[str, str]]:
    """Playwright로 JS 렌더링 후 PDF 링크 추출 (requests에서 링크 없을 때 폴백)."""
    if not PLAYWRIGHT_AVAILABLE or async_playwright is None:
        return []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                page = await browser.new_page()
                await page.goto(url, wait_until="networkidle", timeout=timeout)
                html = await page.content()
            finally:
                await browser.close()
        return _parse_html_for_pdf_links(html, url)
    except Exception as e:
        return [{"error": f"Playwright 폴백 실패: {e}"}]


@mcp.tool()
async def fetch_page_links(url: str) -> List[Dict[str, str]]:
    """웹 페이지에서 PDF 링크 후보를 추출합니다. 정적 HTML에서 링크가 없으면 Playwright로 JS 렌더링 후 재시도합니다.

    Args:
        url: 방문할 페이지 URL

    Returns:
        [{"href": "...", "text": "..."}, ...]  PDF로 보이는 링크 목록 (최대 20개)
    """
    if not DEPS_AVAILABLE:
        return [{"error": "requests, beautifulsoup4 필요"}]
    try:
        links = await asyncio.to_thread(_fetch_page_links_sync, url)
    except Exception as e:
        links = [{"error": str(e)}]
    # 링크가 없거나 전부 error면 Playwright 폴백
    if not links or any("error" in link for link in links):
        if PLAYWRIGHT_AVAILABLE:
            fallback = await _fetch_page_links_playwright(url)
            if fallback:
                return fallback
            return [{"error": "링크 없음 (requests 0개, Playwright 렌더링 후에도 0개)"}]
        else:
            if not links or any("error" in link for link in links):
                err = links[0].get("error", "링크 없음") if links else "링크 없음"
                return [{"error": err}]
    return links


def _download_pdf_sync(url: str, save_path: Path) -> Dict[str, Any]:
    """동기: PDF 다운로드 및 저장 (to_thread에서 호출)."""
    resp = requests.get(
        url, timeout=60, headers={"User-Agent": "Mozilla/5.0"}, stream=True
    )
    resp.raise_for_status()
    ct = (resp.headers.get("content-type") or "").lower()
    if "html" in ct:
        return {"success": False, "path": None, "error": f"PDF가 아님: {ct}"}
    first_chunk = next(resp.iter_content(chunk_size=4), b"")
    # content-type이 pdf가 아니고 URL도 .pdf가 아니면 시그니처로 PDF 여부 확인
    if "pdf" not in ct and not url.lower().endswith(".pdf"):
        if first_chunk and not first_chunk.startswith(b"%PDF"):
            return {"success": False, "path": None, "error": "응답이 PDF 시그니처가 아님"}
    with open(save_path, "wb") as f:
        f.write(first_chunk)
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
    return {"success": True, "path": str(save_path.resolve()), "error": None}


def _download_pdf_bytes_sync(url: str) -> Dict[str, Any]:
    """동기: PDF를 bytes로 다운로드 (저장 없이 메모리 반환)."""
    import base64
    resp = requests.get(
        url, timeout=60, headers={"User-Agent": "Mozilla/5.0"}, stream=True
    )
    resp.raise_for_status()
    ct = (resp.headers.get("content-type") or "").lower()
    if "html" in ct:
        return {"success": False, "pdf_bytes": None, "error": f"PDF가 아님: {ct}"}
    chunks = []
    for chunk in resp.iter_content(chunk_size=8192):
        chunks.append(chunk)
    pdf_bytes = b"".join(chunks)
    if not pdf_bytes.startswith(b"%PDF"):
        if "pdf" not in ct and not url.lower().endswith(".pdf"):
            return {"success": False, "pdf_bytes": None, "error": "응답이 PDF 시그니처가 아님"}
    return {
        "success": True,
        "pdf_bytes_b64": base64.b64encode(pdf_bytes).decode("ascii"),
        "size": len(pdf_bytes),
        "error": None,
    }


@mcp.tool()
async def download_pdf(url: str, filename: str, save_dir: str = "") -> Dict[str, Any]:
    """URL에서 PDF를 다운로드해 지정 디렉터리에 저장합니다.

    Args:
        url: PDF 파일 URL
        filename: 저장할 파일명 (예: 삼성에스디에스_2024_sr.pdf)
        save_dir: 저장 디렉터리. 비우면 MCP_TOOL_DATA_DIR 또는 repo/data_integration/data 사용

    Returns:
        {"success": bool, "path": str|None, "error": str|None}
    """
    if not DEPS_AVAILABLE:
        return {"success": False, "path": None, "error": "requests 필요"}
    base = Path(save_dir) if save_dir.strip() else _default_save_dir()
    base.mkdir(parents=True, exist_ok=True)
    # path traversal 방지: filename에 ../ 등 포함 시 base 밖으로 저장 금지
    save_path = (base / filename).resolve()
    try:
        save_path.relative_to(base.resolve())
    except ValueError:
        return {"success": False, "path": None, "error": "잘못된 파일명(경로 조작 불가)"}

    try:
        return await asyncio.to_thread(_download_pdf_sync, url, save_path)
    except Exception as e:
        return {"success": False, "path": None, "error": str(e)}


@mcp.tool()
async def download_pdf_bytes(url: str) -> Dict[str, Any]:
    """URL에서 PDF를 다운로드하여 bytes(base64)로 반환합니다. 디스크에 저장하지 않습니다.

    Args:
        url: PDF 파일 URL

    Returns:
        {"success": bool, "pdf_bytes_b64": str|None, "size": int, "error": str|None}
        - pdf_bytes_b64: base64로 인코딩된 PDF 바이트 (성공 시)
    """
    if not DEPS_AVAILABLE:
        return {"success": False, "pdf_bytes_b64": None, "size": 0, "error": "requests 필요"}

    try:
        return await asyncio.to_thread(_download_pdf_bytes_sync, url)
    except Exception as e:
        return {"success": False, "pdf_bytes_b64": None, "size": 0, "error": str(e)}


if __name__ == "__main__":
    mcp.run()
