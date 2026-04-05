"""Tool 유틸리티 - 검색 결과 처리, URL 필터링 등"""
from __future__ import annotations

import json
import re
from collections import Counter
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse
from loguru import logger


class ToolUtils:
    """Tool 실행 결과 처리 유틸리티"""
    
    # 서브도메인 제외 목록
    SUB_DROP = frozenset(("www", "admin", "api", "m", "app", "cdn", "static", "mail", "support"))

    # Tavily 상위 결과에 섞이는 검색·포털·SNS 등(코어 도메인) — 회사 사이트 후보에서 제외
    _AGGREGATOR_CORES = frozenset(
        {
            "google",
            "gstatic",
            "googleusercontent",
            "googleapis",
            "youtube",
            "youtu",
            "naver",
            "daum",
            "kakao",
            "bing",
            "microsoft",
            "facebook",
            "instagram",
            "linkedin",
            "twitter",
            "wikipedia",
            "wikimedia",
            "medium",
            "github",
            "tavily",
            "duckduckgo",
            "yahoo",
            "reddit",
            "pinterest",
            "tistory",
            "blogspot",
            "wordpress",
        }
    )

    # 회사명 정규화 시 제거할 접미어
    _KO_CORP_SUFFIXES = ("주식회사", "(주)", "㈜")
    _EN_CORP_SUFFIXES = ("co., ltd.", "co.,ltd.", "co ltd", "ltd.", "ltd", "inc.", "inc", "corp.", "corp")
    
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
    def infer_allowed_domains_from_tavily_results(
        cls,
        tool_result: dict,
        *,
        max_results: int = 10,
    ) -> Set[str]:
        """
        DB `website`가 없을 때: Tavily organic 결과 URL에서 가장 많이 등장하는 등록상 코어 도메인을
        '회사 공식 사이트'로 보고, 해당 코어에 속한 호스트·코어 문자열을 허용 집합으로 반환한다.

        - 상위 max_results개 URL만 사용
        - 검색/포털/SNS 도메인(_AGGREGATOR_CORES)은 후보에서 제외
        - 동률이면 검색 순위가 더 빠른(먼저 나온) 코어를 선택
        """
        if not isinstance(tool_result, dict):
            return set()

        results: Optional[List[Any]] = tool_result.get("results")
        if results is None and "result" in tool_result:
            raw = tool_result["result"]
            if isinstance(raw, str):
                try:
                    inner = json.loads(raw)
                except Exception:
                    inner = None
                results = inner.get("results") if isinstance(inner, dict) else None
            elif isinstance(raw, dict):
                results = raw.get("results")

        if not isinstance(results, list):
            return set()

        urls_ordered: List[str] = []
        for r in results:
            if isinstance(r, dict) and r.get("url"):
                urls_ordered.append(str(r["url"]).strip())
            if len(urls_ordered) >= max_results:
                break

        if not urls_ordered:
            return set()

        # (순서, 코어) — 집계용 노이즈 제외
        cores_in_order: List[Tuple[int, str]] = []
        for i, u in enumerate(urls_ordered):
            try:
                host = cls.normalize_host(urlparse(u).netloc or "")
                core = cls.normalize_core_domain(host)
                if not core or core in cls._AGGREGATOR_CORES:
                    continue
                cores_in_order.append((i, core))
            except Exception:
                continue

        if not cores_in_order:
            return set()

        counts = Counter(c for _, c in cores_in_order)
        best_count = max(counts.values())
        candidates = [c for c, n in counts.items() if n == best_count]
        # 동률: 가장 먼저 등장한 코어
        winner_core = ""
        for _, c in cores_in_order:
            if c in candidates:
                winner_core = c
                break
        if not winner_core:
            return set()

        allowed: Set[str] = {winner_core}
        for u in urls_ordered:
            try:
                host = cls.normalize_host(urlparse(u).netloc or "")
                core = cls.normalize_core_domain(host)
                if core == winner_core and host:
                    allowed.add(host)
            except Exception:
                continue

        logger.info(
            "[ToolUtils] Tavily 결과 기반 허용 도메인 추정: winner_core={} hosts/cores={}",
            winner_core,
            sorted(allowed),
        )
        return allowed

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
    def normalize_host(cls, host: str) -> str:
        """호스트 정규화 (port 제거, 소문자)."""
        h = (host or "").strip().lower()
        if ":" in h:
            h = h.split(":", 1)[0]
        if h.startswith("www."):
            h = h[4:]
        return h

    @classmethod
    def extract_host_and_core_from_url(cls, website: str) -> Tuple[str, str]:
        """웹사이트 URL에서 host/core 추출."""
        if not website:
            return "", ""
        raw = website.strip()
        parsed = urlparse(raw if "://" in raw else f"https://{raw}")
        host = cls.normalize_host(parsed.netloc or parsed.path)
        core = cls.normalize_core_domain(host)
        return host, core
    
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

    @classmethod
    def filter_search_results_by_domains(cls, tool_result: dict, allowed_domains: Set[str]) -> dict:
        """검색 결과를 허용 도메인(host/core) 집합으로 필터링."""
        domains = {d.strip().lower() for d in (allowed_domains or set()) if d and d.strip()}
        if not domains:
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

        filtered: List[Dict[str, Any]] = []
        for r in results:
            if not isinstance(r, dict) or not r.get("url"):
                continue
            try:
                host = cls.normalize_host(urlparse(r["url"]).netloc or "")
                core = cls.normalize_core_domain(host)
                if host in domains or core in domains:
                    filtered.append(r)
            except Exception:
                continue

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

    @classmethod
    def _normalize_company_label(cls, text: str) -> str:
        s = (text or "").strip().lower()
        for suffix in cls._KO_CORP_SUFFIXES:
            s = s.replace(suffix, "")
        for suffix in cls._EN_CORP_SUFFIXES:
            s = s.replace(suffix, "")
        s = re.sub(r"[^0-9a-zA-Z가-힣]+", "", s)
        return s

    @classmethod
    def _ascii_token(cls, text: str) -> str:
        raw = (text or "").strip().lower()
        return "".join(c for c in raw if c.isascii() and c.isalnum())

    @classmethod
    def _lookup_company_row(cls, company: str, company_id: Optional[str]) -> Dict[str, str]:
        """
        companies 테이블에서 회사 식별 정보 조회.
        스키마 호환을 위해 컬럼셋별로 순차 시도.
        """
        try:
            from sqlalchemy import text
            from backend.core.db import get_session
        except Exception:
            return {}

        db = get_session()
        try:
            queries = [
                (
                    """
                    SELECT
                      CAST(id AS TEXT) AS id,
                      COALESCE(company_name_ko, name, '') AS company_name_ko,
                      COALESCE(company_name_en, '') AS company_name_en,
                      COALESCE(website, '') AS website
                    FROM companies
                    WHERE (:company_id IS NOT NULL AND CAST(id AS TEXT) = :company_id)
                       OR (:company_id IS NULL AND (
                            lower(COALESCE(company_name_ko, '')) LIKE :name_like
                         OR lower(COALESCE(name, '')) LIKE :name_like
                         OR lower(COALESCE(company_name_en, '')) LIKE :name_like
                       ))
                    ORDER BY CASE WHEN :company_id IS NOT NULL AND CAST(id AS TEXT) = :company_id THEN 0 ELSE 1 END
                    LIMIT 1
                    """,
                    True,
                ),
                (
                    """
                    SELECT
                      CAST(id AS TEXT) AS id,
                      COALESCE(name, '') AS company_name_ko,
                      '' AS company_name_en,
                      COALESCE(website, '') AS website
                    FROM companies
                    WHERE (:company_id IS NOT NULL AND CAST(id AS TEXT) = :company_id)
                       OR (:company_id IS NULL AND lower(COALESCE(name, '')) LIKE :name_like)
                    ORDER BY CASE WHEN :company_id IS NOT NULL AND CAST(id AS TEXT) = :company_id THEN 0 ELSE 1 END
                    LIMIT 1
                    """,
                    False,
                ),
            ]

            name_like = f"%{(company or '').strip().lower()}%"
            params = {"company_id": (company_id or "").strip() or None, "name_like": name_like}
            for q, _ in queries:
                try:
                    row = db.execute(text(q), params).mappings().first()
                except Exception:
                    continue
                if row:
                    return {k: str(v or "") for k, v in dict(row).items()}
            return {}
        finally:
            db.close()

    @classmethod
    def build_company_search_profile(cls, company: str, company_id: Optional[str] = None) -> Dict[str, Any]:
        """
        검색 가드레일용 회사 프로필 생성.
        Returns:
            {
              "query_terms": [...],
              "allowed_domains": set[str],  # host/core
              "company_name_ko": str,
              "company_name_en": str,
            }
        """
        row = cls._lookup_company_row(company, company_id)
        req_name = (company or "").strip()
        ko_name = row.get("company_name_ko", "").strip() or req_name
        en_name = row.get("company_name_en", "").strip()
        website = row.get("website", "").strip()
        host, core = cls.extract_host_and_core_from_url(website)

        query_terms: List[str] = []
        for cand in (req_name, ko_name, en_name, core, cls._ascii_token(en_name), cls._ascii_token(ko_name)):
            c = (cand or "").strip()
            if c and c not in query_terms:
                query_terms.append(c)

        allowed_domains: Set[str] = set()
        if host:
            allowed_domains.add(host)
        if core:
            allowed_domains.add(core)

        return {
            "query_terms": query_terms,
            "allowed_domains": allowed_domains,
            "company_name_ko": ko_name,
            "company_name_en": en_name,
        }

    @classmethod
    def is_url_allowed_for_company(cls, url: str, allowed_domains: Set[str]) -> bool:
        """다운로드 대상 URL이 허용 도메인인지 검증."""
        domains = {d.strip().lower() for d in (allowed_domains or set()) if d and d.strip()}
        if not domains:
            return True
        try:
            host = cls.normalize_host(urlparse(url).netloc or "")
            core = cls.normalize_core_domain(host)
            return host in domains or core in domains
        except Exception:
            return False
