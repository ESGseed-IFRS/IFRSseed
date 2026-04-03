from __future__ import annotations

import asyncio
import base64
import os
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import urlparse

try:
    import requests
    from bs4 import BeautifulSoup
    DEPS_AVAILABLE = True
except ImportError:
    DEPS_AVAILABLE = False

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    async_playwright = None  # type: ignore

try:
    from .path_resolver import find_repo_root
except ImportError:
    from path_resolver import find_repo_root


def _default_save_dir() -> Path:
    env_dir = os.getenv("MCP_TOOL_DATA_DIR")
    if env_dir:
        return Path(env_dir)
    repo_root = find_repo_root(Path(__file__))
    return repo_root / "data_integration" / "data"


def _parse_html_for_pdf_links(html: str, base_url: str) -> List[Dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    links: List[Dict[str, str]] = []
    for a in soup.find_all("a", href=True):
        href = (a["href"] or "").strip()
        if not href or href.lower().startswith("javascript:") or href == "#":
            continue
        text = a.get_text(strip=True)
        if (
            ".pdf" in href.lower()
            or any(kw in text.lower() for kw in ["pdf", "다운로드", "download", "지속가능", "sustainability", "esg"])
        ):
            if href.startswith("/"):
                parsed = urlparse(base_url)
                href = f"{parsed.scheme}://{parsed.netloc}{href}"
            if not href.lower().startswith(("http://", "https://")):
                continue
            links.append({"href": href, "text": text})
    return links[:20]


def _fetch_page_links_sync(url: str) -> List[Dict[str, str]]:
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


async def fetch_page_links(url: str) -> List[Dict[str, str]]:
    if not DEPS_AVAILABLE:
        return [{"error": "requests, beautifulsoup4 필요"}]
    try:
        links = await asyncio.to_thread(_fetch_page_links_sync, url)
    except Exception as e:
        links = [{"error": str(e)}]
    if not links or any("error" in link for link in links):
        if PLAYWRIGHT_AVAILABLE:
            fallback = await _fetch_page_links_playwright(url)
            if fallback:
                return fallback
            return [{"error": "링크 없음 (requests 0개, Playwright 렌더링 후에도 0개)"}]
        err = links[0].get("error", "링크 없음") if links else "링크 없음"
        return [{"error": err}]
    return links


def _download_pdf_sync(url: str, save_path: Path) -> Dict[str, Any]:
    resp = requests.get(url, timeout=60, headers={"User-Agent": "Mozilla/5.0"}, stream=True)
    resp.raise_for_status()
    ct = (resp.headers.get("content-type") or "").lower()
    if "html" in ct:
        return {"success": False, "path": None, "error": f"PDF가 아님: {ct}"}
    first_chunk = next(resp.iter_content(chunk_size=4), b"")
    if "pdf" not in ct and not url.lower().endswith(".pdf"):
        if first_chunk and not first_chunk.startswith(b"%PDF"):
            return {"success": False, "path": None, "error": "응답이 PDF 시그니처가 아님"}
    with open(save_path, "wb") as f:
        f.write(first_chunk)
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
    return {"success": True, "path": str(save_path.resolve()), "error": None}


async def download_pdf(url: str, filename: str, save_dir: str = "") -> Dict[str, Any]:
    if not DEPS_AVAILABLE:
        return {"success": False, "path": None, "error": "requests 필요"}
    base = Path(save_dir) if save_dir.strip() else _default_save_dir()
    base.mkdir(parents=True, exist_ok=True)
    save_path = (base / filename).resolve()
    try:
        save_path.relative_to(base.resolve())
    except ValueError:
        return {"success": False, "path": None, "error": "잘못된 파일명(경로 조작 불가)"}
    try:
        return await asyncio.to_thread(_download_pdf_sync, url, save_path)
    except Exception as e:
        return {"success": False, "path": None, "error": str(e)}


def _download_pdf_bytes_sync(url: str) -> Dict[str, Any]:
    resp = requests.get(url, timeout=60, headers={"User-Agent": "Mozilla/5.0"}, stream=True)
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


async def download_pdf_bytes(url: str) -> Dict[str, Any]:
    if not DEPS_AVAILABLE:
        return {"success": False, "pdf_bytes_b64": None, "size": 0, "error": "requests 필요"}
    try:
        return await asyncio.to_thread(_download_pdf_bytes_sync, url)
    except Exception as e:
        return {"success": False, "pdf_bytes_b64": None, "size": 0, "error": str(e)}

