"""DART API MCP Tool Server

기업 공시 데이터를 조회하는 MCP Tool 서버입니다.
"""
import os
import sys
from typing import Dict, Any, List, Optional
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

# DART API 관련 import
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("⚠️ requests가 설치되지 않았습니다. pip install requests 필요")

mcp = FastMCP("DART API Tool Server")


@mcp.tool()
async def get_sustainability_report(
    company_id: str,
    fiscal_year: int
) -> Dict[str, Any]:
    """지속가능경영보고서 조회
    
    DART API를 사용하여 기업의 지속가능경영보고서를 조회합니다.
    
    Args:
        company_id: 기업 식별자 (예: "삼성전자", "samsung-electronics")
        fiscal_year: 회계연도 (예: 2024)
    
    Returns:
        보고서 정보 및 데이터
    """
    if not REQUESTS_AVAILABLE:
        return {
            "error": "requests가 설치되지 않았습니다",
            "reports": []
        }
    
    dart_api_key = os.getenv("DART_API_KEY")
    if not dart_api_key:
        return {
            "error": "DART_API_KEY가 설정되지 않았습니다",
            "reports": []
        }
    
    try:
        # 회사명 매핑
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
        
        # 기업 코드 조회 (간단한 구현)
        corp_code = await _get_company_code_simple(actual_company_name, dart_api_key)
        if not corp_code:
            return {
                "error": f"기업 코드를 찾을 수 없습니다: {company_id}",
                "reports": []
            }
        
        # 지속가능경영보고서 목록 조회
        reports = await _get_sustainability_reports(corp_code, fiscal_year, dart_api_key)
        
        return {
            "company_id": company_id,
            "fiscal_year": fiscal_year,
            "corp_code": corp_code,
            "reports": reports,
            "count": len(reports)
        }
    except Exception as e:
        return {
            "error": str(e),
            "reports": []
        }


@mcp.tool()
async def search_disclosure(
    company_id: str,
    keyword: str,
    fiscal_year: Optional[int] = None
) -> Dict[str, Any]:
    """공시 검색
    
    DART API를 사용하여 기업의 공시를 검색합니다.
    
    Args:
        company_id: 기업 식별자
        keyword: 검색 키워드
        fiscal_year: 회계연도 (선택)
    
    Returns:
        검색 결과
    """
    if not REQUESTS_AVAILABLE:
        return {
            "error": "requests가 설치되지 않았습니다",
            "results": []
        }
    
    dart_api_key = os.getenv("DART_API_KEY")
    if not dart_api_key:
        return {
            "error": "DART_API_KEY가 설정되지 않았습니다",
            "results": []
        }
    
    try:
        # 간단한 구현: 지속가능경영보고서만 검색
        company_name_map = {
            "samsung-sds": "삼성에스디에스",
            "samsung-electronics": "삼성전자",
        }
        actual_company_name = company_name_map.get(company_id.lower(), company_id)
        
        corp_code = await _get_company_code_simple(actual_company_name, dart_api_key)
        if not corp_code:
            return {
                "error": f"기업 코드를 찾을 수 없습니다: {company_id}",
                "results": []
            }
        
        if fiscal_year:
            reports = await _get_sustainability_reports(corp_code, fiscal_year, dart_api_key)
        else:
            # 최근 3년 검색
            from datetime import datetime
            current_year = datetime.now().year
            all_reports = []
            for year in range(current_year - 2, current_year + 1):
                year_reports = await _get_sustainability_reports(corp_code, year, dart_api_key)
                all_reports.extend(year_reports)
            reports = all_reports
        
        # 키워드 필터링
        filtered_reports = [
            r for r in reports
            if keyword.lower() in r.get("report_nm", "").lower()
        ]
        
        return {
            "company_id": company_id,
            "keyword": keyword,
            "results": filtered_reports,
            "count": len(filtered_reports)
        }
    except Exception as e:
        return {
            "error": str(e),
            "results": []
        }


async def _get_company_code_simple(company_name: str, dart_api_key: str) -> Optional[str]:
    """기업 코드 조회 (간단한 구현)"""
    try:
        url = "https://opendart.fss.or.kr/api/corpCode.xml"
        params = {"crtfc_key": dart_api_key}
        
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        # ZIP 파일 처리
        import zipfile
        import io
        import xml.etree.ElementTree as ET
        
        if response.content[:2] == b'PK':
            with zipfile.ZipFile(io.BytesIO(response.content)) as zip_file:
                xml_files = [f for f in zip_file.namelist() if f.endswith('.xml')]
                if xml_files:
                    xml_bytes = zip_file.read(xml_files[0])
                    try:
                        xml_content = xml_bytes.decode('utf-8')
                    except UnicodeDecodeError:
                        xml_content = xml_bytes.decode('euc-kr')
                    
                    root = ET.fromstring(xml_content.encode('utf-8'))
                    for item in root.findall('.//list'):
                        corp_name = item.find('corp_name')
                        if corp_name is not None and corp_name.text == company_name:
                            corp_code = item.find('corp_code')
                            if corp_code is not None:
                                return corp_code.text
    except Exception as e:
        print(f"기업 코드 조회 실패: {e}")
    
    return None


async def _get_sustainability_reports(
    corp_code: str,
    fiscal_year: int,
    dart_api_key: str
) -> List[Dict[str, Any]]:
    """지속가능경영보고서 목록 조회"""
    try:
        url = "https://opendart.fss.or.kr/api/list.json"
        bgn_de = f"{fiscal_year}0101"
        end_de = f"{fiscal_year}1231"
        
        params = {
            "crtfc_key": dart_api_key,
            "corp_code": corp_code,
            "bgn_de": bgn_de,
            "end_de": end_de,
            "pblntf_ty": "A"
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") == "000":
            reports = data.get("list", [])
            sustainability_reports = [
                r for r in reports
                if any(keyword in r.get("report_nm", "") for keyword in [
                    "지속가능", "ESG", "sustainability", "Sustainability"
                ])
            ]
            return sustainability_reports
    except Exception as e:
        print(f"보고서 목록 조회 실패: {e}")
    
    return []


if __name__ == "__main__":
    mcp.run()

