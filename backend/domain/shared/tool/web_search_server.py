"""Web Search MCP Tool Server

웹 검색을 제공하는 MCP Tool 서버입니다.
"""
import asyncio
import os
import sys
from typing import Dict, Any, List
from pathlib import Path

# 프로젝트 루트(ai/)를 Python 경로에 추가
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))
# 저장소 루트(ifrsseed/) .env 로드 (data_integration 서브프로세스에서도 동일 경로)
repo_root = project_root.parent
try:
    from dotenv import load_dotenv
    load_dotenv(repo_root / ".env")
except ImportError:
    print("python-dotenv가 필요합니다. pip install python-dotenv 후 다시 실행하세요.", file=sys.stderr)
    sys.exit(1)

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("⚠️ MCP가 설치되지 않았습니다. pip install mcp 필요", file=sys.stderr)
    sys.exit(1)

# 웹 검색 라이브러리
try:
    from duckduckgo_search import DDGS
    DUCKDUCKGO_AVAILABLE = True
except ImportError:
    DUCKDUCKGO_AVAILABLE = False
    print("⚠️ duckduckgo-search가 설치되지 않았습니다. pip install duckduckgo-search 필요", file=sys.stderr)

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

mcp = FastMCP("Web Search Tool Server")


@mcp.tool()
async def tavily_search(
    query: str,
    max_results: int = 5
) -> Dict[str, Any]:
    """Tavily 웹 검색 (더 정확한 검색)
    
    Tavily API를 사용하여 더 정확한 웹 검색을 수행합니다.
    
    Args:
        query: 검색 쿼리
        max_results: 최대 결과 수 (기본값: 5)
    
    Returns:
        검색 결과
    """
    if not REQUESTS_AVAILABLE:
        return {
            "error": "requests가 설치되지 않았습니다",
            "results": []
        }
    
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return {
            "error": "Tavily API 키가 환경 변수에 설정되지 않았습니다 (TAVILY_API_KEY)",
            "results": []
        }
    api_url = os.getenv("TAVILY_API_URL", "https://api.tavily.com/search")

    def _tavily() -> Dict[str, Any]:
        limit = min(max_results, 5)
        payload = {"api_key": api_key, "query": query, "max_results": limit}
        response = requests.post(api_url, json=payload, timeout=10)
        response.raise_for_status()
        data = response.json()
        results = data.get("results", [])[:limit]
        formatted_results = [
            {"title": r.get("title", ""), "url": r.get("url", ""), "snippet": r.get("content", ""), "score": r.get("score", 0.0)}
            for r in results
        ]
        return {"query": query, "results": formatted_results, "count": len(formatted_results)}

    try:
        return await asyncio.to_thread(_tavily)
    except Exception as e:
        return {"error": str(e), "results": []}


if __name__ == "__main__":
    mcp.run()

