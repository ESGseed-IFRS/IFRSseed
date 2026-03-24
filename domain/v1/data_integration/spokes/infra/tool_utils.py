"""Tool 유틸리티 - 검색 결과 처리, URL 필터링 등"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse
from loguru import logger


class ToolUtils:
    """Tool 실행 결과 처리 유틸리티"""
    
    # 서브도메인 제외 목록
    SUB_DROP = frozenset(("www", "admin", "api", "m", "app", "cdn", "static", "mail", "support"))
    
    @staticmethod
    def extract_search_urls(tool_result: Any) -> Tuple[List[str], str]:
        """
        검색 도구 반환값에서 URL 목록 추출
        
        Returns:
            (url_list, content_for_message)
        """
        content = str(tool_result) if not isinstance(tool_result, dict) else json.dumps(tool_result, ensure_ascii=False)
        urls: List[str] = []
        
        try:
            data = tool_result if isinstance(tool_result, dict) else json.loads(str(tool_result))
            if not isinstance(data, dict):
                return urls, content
            
            results = data.get("results")
            if results is None and "result" in data:
                raw = data["result"]
                if isinstance(raw, str):
                    inner = json.loads(raw)
                    results = inner.get("results") if isinstance(inner, dict) else None
                elif isinstance(raw, dict):
                    results = raw.get("results")
            
            if isinstance(results, list):
                for r in results:
                    if isinstance(r, dict) and r.get("url"):
                        urls.append(r["url"])
        except Exception:
            pass
        
        return urls, content
    
    @staticmethod
    def reorder_urls_sustainability_first(urls: List[str]) -> List[str]:
        """경로에 sustainability 또는 esg가 포함된 URL을 앞으로"""
        path_keywords = ("sustainability", "esg")
        preferred: List[str] = []
        rest: List[str] = []
        
        for u in urls:
            try:
                path = (urlparse(u).path or "").lower()
                if any(kw in path for kw in path_keywords):
                    preferred.append(u)
                else:
                    rest.append(u)
            except Exception:
                rest.append(u)
        
        return preferred + rest
    
    @classmethod
    def normalize_core_domain(cls, host: str) -> str:
        """서브도메인·TLD를 제외한 코어 도메인만 반환"""
        if not host:
            return ""
        
        parts = host.lower().strip().split(".")
        while parts and parts[0] in cls.SUB_DROP:
            parts = parts[1:]
        
        if not parts:
            return ""
        
        # .co.kr, .co.uk 같은 경우
        if len(parts) >= 3 and parts[-1] in ("kr", "uk") and parts[-2] == "co":
            return parts[-3]
        
        # .com, .kr 같은 경우
        if len(parts) >= 2 and parts[-1] in ("com", "kr", "site", "net", "org", "io", "co", "info", "biz"):
            return parts[-2]
        
        return parts[0] if parts else ""
    
    @classmethod
    def filter_search_results_by_domain(cls, tool_result: dict, allowed_domain: str) -> dict:
        """검색 결과에서 특정 도메인만 남기기"""
        allowed_norm = allowed_domain.lower().strip().replace(" ", "")
        if not allowed_norm:
            return tool_result
        
        data = dict(tool_result)
        results = data.get("results")
        
        if results is None and "result" in data:
            raw = data["result"]
            if isinstance(raw, str):
                try:
                    inner = json.loads(raw)
                except Exception:
                    return tool_result
                results = inner.get("results") if isinstance(inner, dict) else None
            elif isinstance(raw, dict):
                results = raw.get("results")
        
        if not isinstance(results, list):
            return tool_result
        
        # 필터링
        filtered = []
        for r in results:
            if not isinstance(r, dict) or not r.get("url"):
                continue
            
            try:
                host = (urlparse(r["url"]).netloc or "").strip()
                core = cls.normalize_core_domain(host)
                # 도메인 코어가 회사명과 일치하거나, 회사명을 포함할 때만 통과 (회사명이 도메인을 포함하면 제외)
                if core == allowed_norm or allowed_norm in core:
                    filtered.append(r)
            except Exception:
                continue
        
        # 결과 업데이트
        if "results" in data:
            data["results"] = filtered
            data["count"] = len(filtered)
            return data
        
        if "result" in data:
            raw = data["result"]
            if isinstance(raw, str):
                try:
                    inner = json.loads(raw)
                    inner["results"] = filtered
                    inner["count"] = len(filtered)
                    data["result"] = json.dumps(inner, ensure_ascii=False)
                    return data
                except Exception:
                    return tool_result
            if isinstance(raw, dict):
                data["result"] = {**raw, "results": filtered, "count": len(filtered)}
                return data
        
        return tool_result
    
    @staticmethod
    def company_to_domain_filter(company: str) -> Optional[str]:
        """회사명을 정규화해 도메인 필터용 문자열로 변환"""
        raw = (company or "").strip().lower()
        candidate = "".join(c for c in raw if c.isascii() and c.isalnum())
        return candidate if len(candidate) >= 2 else None
