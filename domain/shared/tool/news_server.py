"""News Search MCP Tool Server

뉴스 검색을 제공하는 MCP Tool 서버입니다.
"""
import asyncio
import os
import sys
from typing import Dict, Any, List
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from mcp.server.fastmcp import FastMCP
    MCP_AVAILABLE = True
except ImportError:
    print("⚠️ MCP가 설치되지 않았습니다. pip install mcp 필요")
    MCP_AVAILABLE = False
    sys.exit(1)

# 웹 검색 라이브러리
try:
    from duckduckgo_search import DDGS
    DUCKDUCKGO_AVAILABLE = True
except ImportError:
    DUCKDUCKGO_AVAILABLE = False
    print("⚠️ duckduckgo-search가 설치되지 않았습니다. pip install duckduckgo-search 필요")

mcp = FastMCP("News Search Tool Server")


@mcp.tool()
async def search_news(
    company_id: str,
    keyword: str,
    max_results: int = 5
) -> Dict[str, Any]:
    """뉴스 기사 검색
    
    기업 관련 뉴스 기사를 검색합니다.
    
    Args:
        company_id: 기업 식별자 (예: "삼성전자", "samsung-electronics")
        keyword: 검색 키워드 (예: "ESG", "지속가능성")
        max_results: 최대 결과 수 (기본값: 5)
    
    Returns:
        검색 결과
    """
    if not DUCKDUCKGO_AVAILABLE:
        return {
            "error": "duckduckgo-search가 설치되지 않았습니다",
            "results": []
        }
    
    def _search() -> Dict[str, Any]:
        company_name_map = {
            "samsung-sds": "삼성에스디에스",
            "samsung-electronics": "삼성전자",
            "samsung-sdi": "삼성SDI",
            "lg-electronics": "LG전자",
            "lg-chem": "LG화학",
            "sk-hynix": "SK하이닉스",
            "hyundai-motor": "현대자동차",
        }
        actual_company_name = company_name_map.get(company_id.lower(), company_id)
        search_query = f"{actual_company_name} {keyword} 뉴스"
        with DDGS() as ddgs:
            results = list(ddgs.text(search_query, max_results=max_results))
        formatted_results = [
            {
                "title": r.get("title", ""),
                "url": r.get("href", ""),
                "snippet": r.get("body", ""),
                "company": actual_company_name,
                "keyword": keyword,
            }
            for r in results
        ]
        return {
            "company_id": company_id,
            "keyword": keyword,
            "query": search_query,
            "results": formatted_results,
            "count": len(formatted_results),
        }

    try:
        return await asyncio.to_thread(_search)
    except Exception as e:
        return {"error": str(e), "results": []}


if __name__ == "__main__":
    mcp.run()

