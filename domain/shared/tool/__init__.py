"""MCP Tool Servers (패턴 B: MCP 서버로 도구 제공)

FastMCP 기반 독립 MCP 서버들. 에이전트는 MCP 클라이언트로 연결해 도구를 사용합니다.

서버 목록:
- web_search_server: duckduckgo_search, tavily_search
- dart_server: get_sustainability_report, search_disclosure
- news_server: search_news
- sr_tools_server: fetch_page_links, download_pdf (SR 수집용)

공유 파싱 모듈 (MCP 서버 없이 직접 import):
- sr_report_tools: PDFParser, parse_sr_report_metadata, parse_sr_report_index (§10: 본문/이미지는 에이전트 경로)
"""

from .sr_report_tools import (
    PDFParser,
    parse_sr_report_index,
    parse_sr_report_metadata,
)

__all__ = [
    "PDFParser",
    "parse_sr_report_metadata",
    "parse_sr_report_index",
]

