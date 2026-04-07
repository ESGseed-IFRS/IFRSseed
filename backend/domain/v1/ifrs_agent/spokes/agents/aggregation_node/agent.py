"""
aggregation_node 에이전트

계열사/자회사·외부 기업 데이터 집계·조회
관련성 기반 검색 지원
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional

from backend.domain.v1.ifrs_agent.spokes.agents.aggregation_node.relevance_analyzer import (
    analyze_prior_year_body,
    build_relevance_query_embedding,
)

logger = logging.getLogger("ifrs_agent.aggregation_node")

# 환경 변수로 관련성 기반 검색 on/off
USE_RELEVANCE_BASED_AGGREGATION = os.getenv("USE_RELEVANCE_AGG", "true").lower() == "true"


class AggregationNodeAgent:
    """
    aggregation_node 에이전트
    
    subsidiary_data_contributions + external_company_data 조회·병합
    """

    def __init__(self, infra):
        """
        Args:
            infra: InfraLayer 인스턴스
        """
        from backend.domain.v1.ifrs_agent.spokes.infra import InfraLayer

        if not isinstance(infra, InfraLayer):
            raise TypeError(f"infra must be InfraLayer, got {type(infra)}")
        self.infra = infra

    async def collect(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        계열사·외부 기업 데이터 수집.
        
        Args:
            payload: {
                "company_id": str (UUID),
                "category": str (레거시 호환용),
                "dp_id": str (선택),
                "years": List[int] (기본 [2024, 2023]),
                # 신규 필드 (프롬프트 기반 검색용)
                "include_external": bool (기본 True, External 실행 여부),
                "external_query": str (프롬프트 기반 검색 쿼리),
                "external_keywords": List[str] (키워드 부스팅용),
                # 기존 필드 (관련성 기반 검색용 - 사용 안 함)
                "dp_metadata": Dict (UCM 메타데이터),
                "sr_context": {
                    "toc_path": List[str],
                    "subtitle": str
                }
            }
        
        Returns:
            {
                "2024": {
                    "subsidiary_data": [...],
                    "external_company_data": [...]
                },
                "2023": {
                    "subsidiary_data": [...],
                    "external_company_data": [...]
                }
            }
        """
        company_id = payload.get("company_id")
        category = payload.get("category")
        dp_id = payload.get("dp_id")
        years = payload.get("years", [2024, 2023])
        
        # 신규: External 제어 필드
        include_external = payload.get("include_external", True)
        external_query = payload.get("external_query", "")
        external_keywords = payload.get("external_keywords", [])

        if not company_id:
            logger.error("aggregation_node: company_id 필수")
            return {}
        
        if not category:
            logger.error("aggregation_node: category 필수")
            return {}

        logger.info(
            "aggregation_node.collect: company_id=%s, category=%s, dp_id=%s, years=%s, "
            "include_external=%s, external_query=%s",
            company_id, category, dp_id, years, include_external, 
            external_query[:50] if external_query else "(없음)"
        )

        # 프롬프트 기반 검색 (신규 기본 모드)
        return await self._collect_with_prompt(
            company_id, category, dp_id, years, 
            include_external, external_query, external_keywords
        )

    async def _collect_with_prompt(
        self,
        company_id: str,
        category: str,
        dp_id: Optional[str],
        years: List[int],
        include_external: bool,
        external_query: str,
        external_keywords: List[str]
    ) -> Dict[str, Any]:
        """
        프롬프트 기반 검색 방식 (신규 기본 모드).
        
        - Subsidiary: 항상 실행 (category_embedding 기반)
        - External: 조건부 실행 (include_external=True일 때만)
        """
        result = {}
        
        # 연도별 병렬 조회
        tasks = []
        for year in years:
            task = self._collect_year_with_prompt(
                company_id, category, dp_id, year,
                include_external, external_query, external_keywords
            )
            tasks.append((year, task))
        
        # 병렬 실행
        year_results = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)
        
        # 결과 병합
        for (year, _), year_data in zip(tasks, year_results):
            if isinstance(year_data, Exception):
                logger.error("aggregation_node: year %s failed: %s", year, year_data)
                result[str(year)] = {
                    "subsidiary_data": [],
                    "external_company_data": []
                }
            else:
                result[str(year)] = year_data
        
        logger.info(
            "aggregation_node._collect_with_prompt: 완료 (years=%s, total_subsidiary=%d, total_external=%d)",
            years,
            sum(len(v.get("subsidiary_data", [])) for v in result.values()),
            sum(len(v.get("external_company_data", [])) for v in result.values())
        )
        
        return result

    async def _collect_legacy(
        self,
        company_id: str,
        category: str,
        dp_id: Optional[str],
        years: List[int]
    ) -> Dict[str, Any]:
        """
        레거시 검색 방식 (category 기반) - 하위 호환용.
        """
        result = {}
        
        # 연도별 병렬 조회
        tasks = []
        for year in years:
            task = self._collect_year(company_id, category, dp_id, year)
            tasks.append((year, task))
        
        # 병렬 실행
        year_results = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)
        
        # 결과 병합
        for (year, _), year_data in zip(tasks, year_results):
            if isinstance(year_data, Exception):
                logger.error("aggregation_node: year %s failed: %s", year, year_data)
                result[str(year)] = {
                    "subsidiary_data": [],
                    "external_company_data": []
                }
            else:
                result[str(year)] = year_data
        
        logger.info(
            "aggregation_node._collect_legacy: 완료 (years=%s, total_subsidiary=%d, total_external=%d)",
            years,
            sum(len(v.get("subsidiary_data", [])) for v in result.values()),
            sum(len(v.get("external_company_data", [])) for v in result.values())
        )
        
        return result

    async def _collect_relevant(
        self,
        company_id: str,
        dp_id: Optional[str],
        years: List[int],
        dp_metadata: Dict[str, Any],
        sr_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        관련성 기반 검색 방식 (DP 메타데이터 + SR 컨텍스트).
        """
        # 1. 전년도 SR 본문 분석
        prior_analysis = await analyze_prior_year_body(
            company_id=company_id,
            dp_id=dp_id,
            year=years[0],  # 현재 연도
            toc_path=sr_context.get("toc_path", []),
            subtitle=sr_context.get("subtitle")
        )
        
        source_type = prior_analysis.get("source_type", "skip")
        
        # 2. skip이면 빈 결과 반환
        if source_type == "skip":
            logger.info("aggregation_node: 관련 데이터 소스 없음, skip")
            return {str(y): {"subsidiary_data": [], "external_company_data": []} for y in years}
        
        # 3. 관련성 임베딩 생성
        try:
            relevance_embedding = await build_relevance_query_embedding(
                dp_metadata=dp_metadata,
                sr_context=sr_context
            )
        except Exception as e:
            logger.error("aggregation_node: 임베딩 생성 실패: %s", e, exc_info=True)
            return {str(y): {"subsidiary_data": [], "external_company_data": []} for y in years}
        
        # 4. 소스 유형에 따라 조회
        result = {}
        tasks = []
        for year in years:
            task = self._collect_year_relevant(
                company_id=company_id,
                year=year,
                source_type=source_type,
                relevance_embedding=relevance_embedding
            )
            tasks.append((year, task))
        
        # 병렬 실행
        year_results = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)
        
        # 결과 병합
        for (year, _), year_data in zip(tasks, year_results):
            if isinstance(year_data, Exception):
                logger.error("aggregation_node: year %s failed: %s", year, year_data)
                result[str(year)] = {
                    "subsidiary_data": [],
                    "external_company_data": []
                }
            else:
                result[str(year)] = year_data
        
        logger.info(
            "aggregation_node._collect_relevant: 완료 (source_type=%s, years=%s, "
            "total_subsidiary=%d, total_external=%d)",
            source_type,
            years,
            sum(len(v.get("subsidiary_data", [])) for v in result.values()),
            sum(len(v.get("external_company_data", [])) for v in result.values())
        )
        
        return result

    async def _collect_year_with_prompt(
        self,
        company_id: str,
        category: str,
        dp_id: Optional[str],
        year: int,
        include_external: bool,
        external_query: str,
        external_keywords: List[str]
    ) -> Dict[str, Any]:
        """
        특정 연도의 계열사·외부 데이터 수집 (프롬프트 기반).
        
        - Subsidiary: 항상 실행
        - External: include_external=True일 때만
        
        Returns:
            {
                "subsidiary_data": [...],
                "external_company_data": [...]
            }
        """
        # Subsidiary: 항상 조회 (category_embedding 기반)
        sub_task = self.infra.call_tool(
            "query_subsidiary_data",
            {
                "company_id": company_id,
                "year": year,
                "category": category,
                "dp_id": dp_id,
                "limit": 5
            }
        )
        
        # External: 조건부 조회
        ext_task = None
        if include_external:
            if external_query:
                # 프롬프트 기반 검색
                ext_task = self.infra.call_tool(
                    "query_external_by_prompt",
                    {
                        "company_id": company_id,
                        "year": year,
                        "category": category,
                        "query_text": external_query,
                        "keywords": external_keywords,
                        "limit": 3
                    }
                )
            else:
                # 폴백: category 기반 (기존 레거시)
                ext_task = self.infra.call_tool(
                    "query_external_company_data",
                    {
                        "company_id": company_id,
                        "year": year,
                        "category": category,
                        "limit": 3
                    }
                )
        
        try:
            # 병렬 실행
            if ext_task:
                sub_data, ext_data = await asyncio.gather(sub_task, ext_task, return_exceptions=True)
            else:
                sub_data = await sub_task
                ext_data = []
            
            # 예외 처리
            if isinstance(sub_data, Exception):
                logger.error("aggregation_node: subsidiary query failed for year %s: %s", year, sub_data)
                sub_data = []
            
            if isinstance(ext_data, Exception):
                logger.error("aggregation_node: external query failed for year %s: %s", year, ext_data)
                ext_data = []
            
            return {
                "subsidiary_data": sub_data if isinstance(sub_data, list) else [],
                "external_company_data": ext_data if isinstance(ext_data, list) else []
            }
        
        except Exception as e:
            logger.error("aggregation_node: _collect_year_with_prompt failed for year %s: %s", year, e, exc_info=True)
            return {
                "subsidiary_data": [],
                "external_company_data": []
            }

    async def _collect_year(
        self,
        company_id: str,
        category: str,
        dp_id: Optional[str],
        year: int
    ) -> Dict[str, Any]:
        """
        특정 연도의 계열사·외부 데이터 수집 (레거시 방식).
        
        Returns:
            {
                "subsidiary_data": [...],
                "external_company_data": [...]
            }
        """
        # 병렬 조회
        sub_task = self.infra.call_tool(
            "query_subsidiary_data",
            {
                "company_id": company_id,
                "year": year,
                "category": category,
                "dp_id": dp_id,
                "limit": 5
            }
        )
        
        ext_task = self.infra.call_tool(
            "query_external_company_data",
            {
                "company_id": company_id,
                "year": year,
                "category": category,
                "limit": 3
            }
        )
        
        try:
            sub_data, ext_data = await asyncio.gather(sub_task, ext_task, return_exceptions=True)
            
            # 예외 처리
            if isinstance(sub_data, Exception):
                logger.error("aggregation_node: subsidiary query failed for year %s: %s", year, sub_data)
                sub_data = []
            
            if isinstance(ext_data, Exception):
                logger.error("aggregation_node: external query failed for year %s: %s", year, ext_data)
                ext_data = []
            
            return {
                "subsidiary_data": sub_data if isinstance(sub_data, list) else [],
                "external_company_data": ext_data if isinstance(ext_data, list) else []
            }
        
        except Exception as e:
            logger.error("aggregation_node: _collect_year failed for year %s: %s", year, e, exc_info=True)
            return {
                "subsidiary_data": [],
                "external_company_data": []
            }

    async def _collect_year_relevant(
        self,
        company_id: str,
        year: int,
        source_type: str,
        relevance_embedding: List[float]
    ) -> Dict[str, Any]:
        """
        관련성 기반 연도별 데이터 수집.
        
        Args:
            source_type: "external_only" | "subsidiary_only" | "both"
            relevance_embedding: 1024차원 임베딩 벡터
        
        Returns:
            {
                "subsidiary_data": [...],
                "external_company_data": [...]
            }
        """
        subsidiary_data = []
        external_data = []
        
        tasks = []
        
        # subsidiary 조회
        if source_type in ("subsidiary_only", "both"):
            sub_task = self.infra.call_tool(
                "query_subsidiary_data_relevant",
                {
                    "company_id": company_id,
                    "year": year,
                    "relevance_embedding": relevance_embedding,
                    "similarity_threshold": 0.5,
                    "limit": 5
                }
            )
            tasks.append(("subsidiary", sub_task))
        
        # external 조회
        if source_type in ("external_only", "both"):
            ext_task = self.infra.call_tool(
                "query_external_data_relevant",
                {
                    "company_id": company_id,
                    "year": year,
                    "relevance_embedding": relevance_embedding,
                    "similarity_threshold": 0.5,
                    "limit": 3
                }
            )
            tasks.append(("external", ext_task))
        
        # 병렬 실행
        if tasks:
            results = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)
            
            for (data_type, _), data in zip(tasks, results):
                if isinstance(data, Exception):
                    logger.error(
                        "aggregation_node: %s query failed for year %s: %s",
                        data_type, year, data
                    )
                elif isinstance(data, list):
                    if data_type == "subsidiary":
                        subsidiary_data = data
                    else:
                        external_data = data
        
        return {
            "subsidiary_data": subsidiary_data,
            "external_company_data": external_data
        }


def make_aggregation_node_handler(infra):
    """
    aggregation_node 에이전트 핸들러 생성.

    InfraLayer.call_agent는 handler(payload) 단일 인자만 전달한다 (action은 미전달).
    """
    agent = AggregationNodeAgent(infra)

    async def _handler(payload: Dict[str, Any]) -> Dict[str, Any]:
        return await agent.collect(payload)

    return _handler
