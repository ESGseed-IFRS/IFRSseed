"""매핑 추천 서비스

벡터 검색과 구조적 필터링을 결합한 하이브리드 접근법으로
기준서 간 Data Point 매핑을 자동 추천하는 서비스입니다.
"""
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import os
import re
import json
from functools import lru_cache
from sqlalchemy.orm import Session
from sqlalchemy import text
from loguru import logger

from ifrs_agent.model.models import DataPoint
from ifrs_agent.service.embedding_service import EmbeddingService
from ifrs_agent.service.embedding_text_service import EmbeddingTextService


class MappingSuggestionService:
    """매핑 추천 서비스
    
    하이브리드 접근법:
    1. 벡터 검색: 의미적 유사도 계산
    2. 구조적 필터링: 카테고리, 단위, 데이터 타입 등 구조적 일치 확인
    3. 종합 점수: 벡터 70% + 구조적 30%
    """
    
    def __init__(self, db: Session, use_llm_for_topic: bool = True, use_llm_for_keywords: bool = True):
        """매핑 추천 서비스 초기화
        
        Args:
            db: 데이터베이스 세션
            use_llm_for_topic: LLM을 사용하여 주제 유사도 계산 (기본: True)
            use_llm_for_keywords: LLM을 사용하여 키워드 추출 (기본: True)
        """
        self.db = db
        self.embedding_service = EmbeddingService()
        self.embedding_text_service = EmbeddingTextService()
        self.use_llm_for_topic = use_llm_for_topic
        self.use_llm_for_keywords = use_llm_for_keywords
        
        # LLM 클라이언트 초기화 (지연 로딩)
        self._llm_client = None
        self._llm_cache = {}  # 주제 유사도 캐시
        self._keyword_cache = {}  # 키워드 추출 캐시
        
        # 단위 호환성 매핑
        self.compatible_units = {
            ("tco2e", "tco2eq"): True,
            ("tco2e", "metric_tons_co2"): True,
            ("mwh", "kwh"): True,
            ("mwh", "watt_hours"): True,
            ("joules", "watt_hours"): True,
            ("currency_krw", "currency_usd"): False,  # 환율 변환 필요
        }
        
        # 주제 유사성 매핑 (폴백용)
        self.topic_similarity_map = {
            ("기후 변화", "기후"): 0.9,
            ("기후 변화", "온실가스"): 0.85,
            ("GHG 배출", "온실가스 배출"): 0.95,
            ("GHG 배출", "기후 변화"): 0.8,
            ("에너지", "에너지 소비"): 0.9,
            ("에너지", "에너지 효율"): 0.7,
            ("거버넌스", "지배구조"): 0.95,
            ("고용", "인력"): 0.85,
            ("고용", "임직원"): 0.9,
        }
        
        # Topic 호환성 매핑 (주제 영역 불일치 감지용)
        self.topic_mapping = {
            # 정책 관련
            "Policies and actions": ["정책", "policy", "actions", "조치", "policies"],
            "정책": ["Policies and actions", "policy", "actions", "조치", "policies"],
            # 거버넌스 관련
            "일반 공시": ["governance", "거버넌스", "지배구조", "일반 공시"],
            "거버넌스": ["governance", "거버넌스", "지배구조", "일반 공시"],
            "지배구조": ["governance", "거버넌스", "일반 공시"],
            # 기후 관련
            "기후": ["climate", "기후", "온실가스", "GHG"],
            "climate": ["기후", "온실가스", "GHG"],
            # 환경 관련
            "환경": ["environment", "environmental"],
            "environment": ["환경"],
            # 사회 관련
            "사회": ["social", "society"],
            "social": ["사회"],
        }
        
        # 호환되지 않는 Topic 조합 (명시적 불일치)
        self.incompatible_topic_pairs = [
            ("Policies and actions", "일반 공시"),
            ("Policies and actions", "거버넌스"),
            ("Policies and actions", "지배구조"),
            ("정책", "일반 공시"),
            ("정책", "거버넌스"),
            ("정책", "지배구조"),
        ]
        
        # 키워드 동의어 사전 (정규화용)
        self.keyword_synonyms = {
            # 온실가스 관련
            "GHG": ["온실가스", "greenhouse", "gas", "ghg"],
            "온실가스": ["GHG", "greenhouse", "gas", "ghg"],
            "greenhouse": ["GHG", "온실가스", "gas", "ghg"],
            "gas": ["GHG", "온실가스", "greenhouse", "ghg"],
            "ghg": ["GHG", "온실가스", "greenhouse", "gas"],
            
            # 배출 관련
            "배출": ["배출량", "emission", "emissions"],
            "배출량": ["배출", "emission", "emissions"],
            "emission": ["배출", "배출량", "emissions"],
            "emissions": ["배출", "배출량", "emission"],
            
            # 에너지 관련
            "에너지": ["energy", "소비", "consumption"],
            "energy": ["에너지", "소비", "consumption"],
            "소비": ["에너지", "energy", "consumption"],
            "consumption": ["에너지", "energy", "소비"],
            
            # 기후 관련
            "기후": ["climate", "변화", "change"],
            "climate": ["기후", "변화", "change"],
            "변화": ["기후", "climate", "change"],
            "change": ["기후", "climate", "변화"],
            
            # 거버넌스 관련
            "거버넌스": ["지배구조", "governance"],
            "지배구조": ["거버넌스", "governance"],
            "governance": ["거버넌스", "지배구조"],
            
            # 고용 관련
            "고용": ["임직원", "인력", "employee", "employment", "인원"],
            "임직원": ["고용", "인력", "employee", "employment", "인원"],
            "인력": ["고용", "임직원", "employee", "employment", "인원"],
            "인원": ["고용", "임직원", "인력", "employee", "employment"],
            "employee": ["고용", "임직원", "인력", "employment", "인원"],
            "employment": ["고용", "임직원", "인력", "employee", "인원"],
            
            # 리스크 관련
            "리스크": ["위험", "risk"],
            "위험": ["리스크", "risk"],
            "risk": ["리스크", "위험"],
            
            # 인권 관련
            "인권": ["human", "rights"],
            "human": ["인권", "rights"],
            "rights": ["인권", "human"],
        }
    
    def _get_llm_client(self):
        """LLM 클라이언트 가져오기 (지연 로딩)"""
        if self._llm_client is None:
            try:
                groq_api_key = os.getenv("GROQ_API_KEY")
                if not groq_api_key:
                    logger.warning("GROQ_API_KEY가 설정되지 않아 LLM 기반 주제 유사도 계산을 사용할 수 없습니다.")
                    return None
                
                from groq import Groq
                self._llm_client = Groq(api_key=groq_api_key)
                logger.info("LLM 클라이언트 초기화 완료 (Groq)")
            except ImportError:
                logger.warning("groq 패키지가 설치되지 않아 LLM 기반 주제 유사도 계산을 사용할 수 없습니다.")
                return None
            except Exception as e:
                logger.error(f"LLM 클라이언트 초기화 실패: {e}")
                return None
        
        return self._llm_client
    
    def _calculate_topic_similarity_with_llm(
        self,
        source_name_ko: str,
        source_name_en: str,
        target_name_ko: str,
        target_name_en: str
    ) -> Optional[float]:
        """LLM을 사용하여 주제 유사도 계산 (name_ko, name_en 기반)
        
        Args:
            source_name_ko: 원본 한국어 이름
            source_name_en: 원본 영어 이름
            target_name_ko: 대상 한국어 이름
            target_name_en: 대상 영어 이름
        
        Returns:
            유사도 점수 (0.0 ~ 1.0) 또는 None (실패 시)
        """
        # 캐시 확인
        cache_key = (source_name_ko, source_name_en, target_name_ko, target_name_en)
        if cache_key in self._llm_cache:
            return self._llm_cache[cache_key]
        
        # 역순 캐시 확인
        reverse_cache_key = (target_name_ko, target_name_en, source_name_ko, source_name_en)
        if reverse_cache_key in self._llm_cache:
            return self._llm_cache[reverse_cache_key]
        
        client = self._get_llm_client()
        if not client:
            return None
        
        try:
            prompt = f"""다음 두 데이터 포인트의 의미적 유사도를 0.0부터 1.0 사이의 숫자로 평가하세요.

데이터 포인트 1:
- 한국어: {source_name_ko}
- 영어: {source_name_en}

데이터 포인트 2:
- 한국어: {target_name_ko}
- 영어: {target_name_en}

**평가 기준:**
- 1.0: 완전히 동일한 의미
- 0.9-0.99: 매우 유사 (거의 동일)
- 0.7-0.89: 유사함 (관련된 주제)
- 0.5-0.69: 약간 관련됨
- 0.3-0.49: 거의 관련 없음
- 0.0-0.29: 전혀 관련 없음

**중요:** 숫자만 반환하세요 (예: 0.85). 설명이나 다른 텍스트는 포함하지 마세요."""

            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,  # 낮은 temperature로 일관성 확보
                max_tokens=10,
                timeout=10
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # 숫자 추출
            match = re.search(r'0?\.\d+|1\.0|0', result_text)
            if match:
                similarity = float(match.group())
                # 0.0 ~ 1.0 범위로 제한
                similarity = max(0.0, min(1.0, similarity))
                
                # 캐시에 저장
                self._llm_cache[cache_key] = similarity
                
                logger.debug(f"LLM 주제 유사도: '{source_name_ko}' vs '{target_name_ko}' = {similarity:.3f}")
                return similarity
            else:
                logger.warning(f"LLM 응답에서 숫자를 추출할 수 없음: {result_text}")
                return None
                
        except Exception as e:
            logger.warning(f"LLM 기반 주제 유사도 계산 실패: {e}")
            return None
    
    def find_similar_dps_hybrid(
        self,
        source_dp_id: str,
        target_standard: str,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """하이브리드 검색: 벡터 검색 + 구조적 필터링
        
        Args:
            source_dp_id: 원본 DP ID
            target_standard: 대상 기준서
            vector_threshold: 벡터 검색 임계값 (기본: 0.70)
            structural_threshold: 구조적 점수 임계값 (기본: 0.50)
            final_threshold: 최종 점수 임계값 (기본: 0.75)
            top_k: 반환할 상위 K개 (기본: 5)
        
        Returns:
            추천된 매핑 후보 리스트 (final_score 내림차순)
        """
        # 1. Source DP 정보 가져오기
        source_dp = self.db.query(DataPoint).filter(
            DataPoint.dp_id == source_dp_id,
            DataPoint.is_active == True
        ).first()
        
        if not source_dp:
            logger.warning(f"Source DP를 찾을 수 없습니다: {source_dp_id}")
            return []
        
        # 2. 벡터 검색으로 후보 찾기 (더 많이 가져옴)
        vector_candidates = self._find_similar_dps_vector(
            source_dp,
            target_standard,
            threshold=vector_threshold,
            top_k=top_k * 3  # 구조적 필터링을 위해 더 많이 가져옴
        )
        
        if not vector_candidates:
            logger.info(f"벡터 검색 결과 없음: {source_dp_id} -> {target_standard}")
            return []
        
        # 3. 구조적 필터링 적용
        hybrid_candidates = []
        for target_dp_id, vector_similarity in vector_candidates:
            target_dp = self.db.query(DataPoint).filter(
                DataPoint.dp_id == target_dp_id,
                DataPoint.is_active == True
            ).first()
            
            if not target_dp:
                continue
            
            # 구조적 점수 계산
            structural_score, match_details = self._calculate_structural_match(
                source_dp, target_dp
            )
            
            # 구조적 임계값 통과 확인
            if structural_score < structural_threshold:
                continue
            
            # 종합 점수 계산 (벡터 70% + 구조적 30%)
            final_score = (vector_similarity * 0.7) + (structural_score * 0.3)
            
            # 최종 임계값 통과 확인
            if final_score >= final_threshold:
                hybrid_candidates.append({
                    "target_dp_id": target_dp_id,
                    "target_dp_name_ko": target_dp.name_ko,
                    "target_dp_name_en": target_dp.name_en,
                    "vector_similarity": round(vector_similarity, 4),
                    "structural_score": round(structural_score, 4),
                    "final_score": round(final_score, 4),
                    "match_details": match_details
                })
        
        # 4. 최종 점수로 정렬 및 상위 K개 선택
        hybrid_candidates.sort(key=lambda x: x["final_score"], reverse=True)
        
        logger.info(
            f"하이브리드 검색 완료: {source_dp_id} -> {target_standard}, "
            f"후보 {len(hybrid_candidates)}개 (벡터 후보: {len(vector_candidates)}개)"
        )
        
        return hybrid_candidates[:top_k]
    
    def _find_similar_dps_vector(
        self,
        source_dp: DataPoint,
        target_standard: str,
        threshold: float = 0.70,
        top_k: int = 15
    ) -> List[Tuple[str, float]]:
        """벡터 검색으로 유사한 DP 찾기
        
        Args:
            source_dp: 원본 DataPoint 객체
            target_standard: 대상 기준서
            threshold: 유사도 임계값
            top_k: 반환할 상위 K개
        
        Returns:
            (target_dp_id, similarity) 튜플 리스트
        """
        if source_dp.embedding is None:
            logger.warning(f"Source DP {source_dp.dp_id}의 임베딩이 없습니다.")
            return []
        
        # PostgreSQL 벡터 검색 (Cosine 유사도)
        # 임베딩 벡터를 문자열로 변환 (f-string으로 SQL에 직접 삽입)
        embedding_str = str(source_dp.embedding.tolist() if hasattr(source_dp.embedding, 'tolist') else list(source_dp.embedding))
        
        query = text(f"""
            SELECT 
                dp_id,
                1 - (embedding <=> '{embedding_str}'::vector) as similarity
            FROM data_points
            WHERE standard = :target_standard
              AND is_active = TRUE
              AND embedding IS NOT NULL
              AND dp_id != :source_dp_id
            ORDER BY embedding <=> '{embedding_str}'::vector
            LIMIT :top_k
        """)
        
        result = self.db.execute(
            query,
            {
                "target_standard": target_standard,
                "source_dp_id": source_dp.dp_id,
                "top_k": top_k * 2  # 임계값 필터링 전에 더 많이 가져옴
            }
        )
        
        # 임계값 이상인 것만 반환
        candidates = [
            (row.dp_id, float(row.similarity))
            for row in result
            if row.similarity >= threshold
        ]
        
        return candidates[:top_k]
    
    def _calculate_structural_match(
        self,
        source_dp: DataPoint,
        target_dp: DataPoint
    ) -> Tuple[float, Dict[str, Any]]:
        """구조적 매칭 점수 계산
        
        Args:
            source_dp: 원본 DataPoint
            target_dp: 대상 DataPoint
        
        Returns:
            (구조적 점수, 매칭 상세 정보) 튜플
        """
        score = 0.0
        max_score = 0.0
        match_details = {}
        
        # 1. 카테고리 일치 (가중치: 10%)
        max_score += 0.1
        category_match = source_dp.category == target_dp.category
        if category_match:
            score += 0.1
        match_details["category_match"] = category_match
        
        # 2. 단위 일치/호환성 (가중치: 15%)
        max_score += 0.15
        unit_match = False
        unit_compatible = False
        if source_dp.unit and target_dp.unit:
            if source_dp.unit == target_dp.unit:
                unit_match = True
                score += 0.15
            elif self._are_units_compatible(source_dp.unit, target_dp.unit):
                unit_compatible = True
                score += 0.09  # 호환 가능한 단위 (15%의 60%)
        elif not source_dp.unit and not target_dp.unit:
            # 둘 다 단위가 없는 경우 (narrative 등)
            unit_match = True
            score += 0.15
        match_details["unit_match"] = unit_match
        match_details["unit_compatible"] = unit_compatible
        
        # 3. 주제 유사성 (가중치: 30%) - name_ko, name_en 기반
        max_score += 0.3
        topic_similarity = self._calculate_topic_similarity(
            source_dp.name_ko, source_dp.name_en,
            target_dp.name_ko, target_dp.name_en
        )
        score += 0.3 * topic_similarity
        match_details["topic_similarity"] = round(topic_similarity, 4)
        
        # 3-1. Topic/Subtopic 유사성 검증 (가중치: 20%)
        max_score += 0.2
        topic_subtopic_score = self._calculate_topic_subtopic_similarity(
            source_dp.topic, source_dp.subtopic,
            target_dp.topic, target_dp.subtopic
        )
        score += 0.2 * topic_subtopic_score
        match_details["topic_subtopic_similarity"] = round(topic_subtopic_score, 4)
        
        # 4. 키워드 매칭 (가중치: 35%) - description 기반 (45% → 35%로 감소)
        max_score += 0.35
        keyword_match = self._calculate_keyword_match(
            source_dp.description or "",
            target_dp.description or ""
        )
        score += 0.35 * keyword_match
        match_details["keyword_match"] = round(keyword_match, 4)
        
        # 정규화
        final_score = score / max_score if max_score > 0 else 0.0
        
        return final_score, match_details
    
    def _are_units_compatible(self, unit1: Optional[str], unit2: Optional[str]) -> bool:
        """단위 호환성 확인
        
        Args:
            unit1: 첫 번째 단위
            unit2: 두 번째 단위
        
        Returns:
            호환 가능 여부
        """
        if not unit1 or not unit2:
            return False
        
        # 대소문자 무시 비교
        unit1_lower = str(unit1).lower()
        unit2_lower = str(unit2).lower()
        
        # 직접 호환성 확인
        if (unit1_lower, unit2_lower) in self.compatible_units:
            return self.compatible_units[(unit1_lower, unit2_lower)]
        if (unit2_lower, unit1_lower) in self.compatible_units:
            return self.compatible_units[(unit2_lower, unit1_lower)]
        
        # 부분 일치 확인 (예: "tco2e"와 "tco2eq")
        if "co2" in unit1_lower and "co2" in unit2_lower:
            return True
        if "wh" in unit1_lower and "wh" in unit2_lower:
            return True
        
        return False
    
    def _calculate_topic_similarity(
        self,
        source_name_ko: Optional[str],
        source_name_en: Optional[str],
        target_name_ko: Optional[str],
        target_name_en: Optional[str]
    ) -> float:
        """주제 유사성 계산 (name_ko, name_en 기반, LLM 우선, 폴백: 키워드 기반)
        
        Args:
            source_name_ko: 원본 한국어 이름
            source_name_en: 원본 영어 이름
            target_name_ko: 대상 한국어 이름
            target_name_en: 대상 영어 이름
        
        Returns:
            유사성 점수 (0.0 ~ 1.0)
        """
        if not source_name_ko and not source_name_en:
            return 0.0
        if not target_name_ko and not target_name_en:
            return 0.0
        
        # 1. 정확히 일치 (가장 빠른 체크)
        source_name = f"{source_name_ko or ''} {source_name_en or ''}".strip()
        target_name = f"{target_name_ko or ''} {target_name_en or ''}".strip()
        
        if source_name == target_name:
            return 1.0
        
        # 2. LLM 기반 유사도 계산 (활성화된 경우)
        if self.use_llm_for_topic:
            llm_similarity = self._calculate_topic_similarity_with_llm(
                source_name_ko or "", source_name_en or "",
                target_name_ko or "", target_name_en or ""
            )
            if llm_similarity is not None:
                return llm_similarity
        
        # 3. 키워드 기반 유사성 (폴백)
        source_keywords = set()
        if source_name_ko:
            source_keywords.update(source_name_ko.lower().split())
        if source_name_en:
            source_keywords.update(source_name_en.lower().split())
        
        target_keywords = set()
        if target_name_ko:
            target_keywords.update(target_name_ko.lower().split())
        if target_name_en:
            target_keywords.update(target_name_en.lower().split())
        
        if source_keywords & target_keywords:  # 교집합이 있으면
            common = len(source_keywords & target_keywords)
            total = len(source_keywords | target_keywords)
            return common / total if total > 0 else 0.0
        
        return 0.0
    
    def _calculate_topic_subtopic_similarity(
        self,
        source_topic: Optional[str],
        source_subtopic: Optional[str],
        target_topic: Optional[str],
        target_subtopic: Optional[str]
    ) -> float:
        """Topic/Subtopic 유사성 계산
        
        Args:
            source_topic: 원본 topic
            source_subtopic: 원본 subtopic
            target_topic: 대상 topic
            target_subtopic: 대상 subtopic
        
        Returns:
            유사성 점수 (0.0 ~ 1.0)
        """
        if not source_topic or not target_topic:
            return 0.5  # Topic이 없으면 중간 점수
        
        source_topic_lower = source_topic.lower()
        target_topic_lower = target_topic.lower()
        
        # 1. 호환되지 않는 Topic 조합 확인
        for src_topic, tgt_topic in self.incompatible_topic_pairs:
            if (src_topic.lower() in source_topic_lower and 
                tgt_topic.lower() in target_topic_lower):
                logger.debug(f"호환되지 않는 Topic 조합: {source_topic} vs {target_topic}")
                return 0.0
            if (tgt_topic.lower() in source_topic_lower and 
                src_topic.lower() in target_topic_lower):
                logger.debug(f"호환되지 않는 Topic 조합: {source_topic} vs {target_topic}")
                return 0.0
        
        # 2. Topic 일치 여부
        topic_exact_match = source_topic_lower == target_topic_lower
        
        # 3. Topic 호환성 확인
        topic_compatible = self._are_topics_compatible(source_topic, target_topic)
        
        # 4. Subtopic 일치 여부
        subtopic_match = False
        if source_subtopic and target_subtopic:
            subtopic_match = source_subtopic.lower() == target_subtopic.lower()
        elif not source_subtopic and not target_subtopic:
            subtopic_match = True  # 둘 다 없으면 일치로 간주
        
        # 점수 계산
        if topic_exact_match:
            if subtopic_match:
                return 1.0  # Topic과 Subtopic 모두 일치
            else:
                return 0.8  # Topic은 일치하지만 Subtopic이 다름
        elif topic_compatible:
            if subtopic_match:
                return 0.7  # Topic은 호환되지만 정확히 일치하지 않음
            else:
                return 0.5  # Topic은 호환되지만 Subtopic이 다름
        else:
            return 0.0  # Topic이 호환되지 않음
    
    def _are_topics_compatible(
        self,
        source_topic: Optional[str],
        target_topic: Optional[str]
    ) -> bool:
        """Topic 호환성 확인
        
        Args:
            source_topic: 원본 topic
            target_topic: 대상 topic
        
        Returns:
            호환 가능 여부
        """
        if not source_topic or not target_topic:
            return True  # Topic이 없으면 통과
        
        source_lower = source_topic.lower()
        target_lower = target_topic.lower()
        
        # 정확히 일치
        if source_lower == target_lower:
            return True
        
        # 매핑 사전 확인
        for topic, keywords in self.topic_mapping.items():
            if source_lower == topic.lower():
                if any(kw.lower() in target_lower for kw in keywords):
                    return True
            if target_lower == topic.lower():
                if any(kw.lower() in source_lower for kw in keywords):
                    return True
        
        # 호환되지 않음
        return False
    
    def _calculate_keyword_match_with_llm(
        self,
        source_description: str,
        target_description: str
    ) -> Optional[float]:
        """LLM을 사용하여 description 의미적 유사도 계산
        
        Args:
            source_description: 원본 description
            target_description: 대상 description
        
        Returns:
            유사도 점수 (0.0 ~ 1.0) 또는 None (실패 시)
        """
        if not source_description or not target_description:
            return None
        
        # 캐시 확인
        cache_key = (source_description, target_description)
        if cache_key in self._llm_cache:
            return self._llm_cache[cache_key]
        
        # 역순 캐시 확인
        reverse_cache_key = (target_description, source_description)
        if reverse_cache_key in self._llm_cache:
            return self._llm_cache[reverse_cache_key]
        
        client = self._get_llm_client()
        if not client:
            return None
        
        try:
            # description이 너무 길면 앞부분만 사용
            source_desc = source_description[:500] if len(source_description) > 500 else source_description
            target_desc = target_description[:500] if len(target_description) > 500 else target_description
            
            prompt = f"""다음 두 ESG 기준서 프레임워크별 지표(Data Point) 설명의 의미적 유사도를 0.0부터 1.0 사이의 숫자로 평가하세요.

**컨텍스트:**
이 두 설명은 서로 다른 ESG 공시 프레임워크(GRI, IFRS S2, ESRS, KSSB 등)의 지표 요구사항입니다. 
같은 개념을 다르게 표현하거나, 유사한 공시 목적을 가진 지표일 수 있습니다.
ESG 공시 프레임워크 간 지표 매핑 관점에서 평가하세요.

**설명 1:**
{source_desc}

**설명 2:**
{target_desc}

**평가 기준:**
- 1.0: 완전히 동일한 의미와 내용 (같은 지표를 다른 프레임워크에서 표현)
- 0.9-0.99: 매우 유사 (거의 동일한 공시 요구사항, 약간의 표현 차이만 있음)
- 0.7-0.89: 유사함 (관련된 공시 요구사항, 같은 주제 영역)
- 0.5-0.69: 약간 관련됨 (부분적으로 겹치는 개념)
- 0.3-0.49: 거의 관련 없음
- 0.0-0.29: 전혀 관련 없음

**중요:** 
- ESG 공시 프레임워크 간 지표 매핑 관점에서 평가하세요.
- 숫자만 반환하세요 (예: 0.85). 설명이나 다른 텍스트는 포함하지 마세요."""

            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=10,
                timeout=15
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # 숫자 추출
            match = re.search(r'0?\.\d+|1\.0|0', result_text)
            if match:
                similarity = float(match.group())
                # 0.0 ~ 1.0 범위로 제한
                similarity = max(0.0, min(1.0, similarity))
                
                # 캐시에 저장
                self._llm_cache[cache_key] = similarity
                
                logger.debug(f"LLM description 유사도 = {similarity:.3f}")
                return similarity
            else:
                logger.warning(f"LLM 응답에서 숫자를 추출할 수 없음: {result_text}")
                return None
                
        except Exception as e:
            logger.warning(f"LLM 기반 description 유사도 계산 실패: {e}")
            return None
    
    def _calculate_keyword_match_with_llm_multi(
        self,
        source_description: str,
        target_descriptions: List[Tuple[str, str, str]]
    ) -> Dict[str, float]:
        """LLM을 사용하여 여러 Target DP description들과 Source DP description의 의미적 유사도를 한 번에 계산
        
        Args:
            source_description: 원본 description
            target_descriptions: 대상 description 리스트 [(dp_id, standard, description), ...]
        
        Returns:
            {dp_id: similarity} 딕셔너리
        """
        if not source_description or not target_descriptions:
            return {}
        
        client = self._get_llm_client()
        if not client:
            return {}
        
        try:
            # description이 너무 길면 앞부분만 사용
            source_desc = source_description[:500] if len(source_description) > 500 else source_description
            
            # Target descriptions 준비
            target_list = []
            for idx, (dp_id, standard, desc) in enumerate(target_descriptions, 1):
                target_desc = desc[:500] if len(desc) > 500 else desc if desc else ""
                target_list.append(f"{idx}. {target_desc} (기준서: {standard}, DP ID: {dp_id})")
            
            targets_text = "\n".join(target_list)
            
            prompt = f"""다음 ESG 기준서 프레임워크별 지표(Data Point) 설명들의 의미적 유사도를 평가하세요.

**컨텍스트:**
이 설명들은 서로 다른 ESG 공시 프레임워크(GRI, IFRS S2, ESRS, KSSB 등)의 지표 요구사항입니다. 
같은 개념을 다르게 표현하거나, 유사한 공시 목적을 가진 지표일 수 있습니다.
ESG 공시 프레임워크 간 지표 매핑 관점에서 평가하세요.

**Source 지표:**
{source_desc}

**Target 지표들:**
{targets_text}

**평가 기준:**
- 1.0: 완전히 동일한 의미와 내용 (같은 지표를 다른 프레임워크에서 표현)
- 0.9-0.99: 매우 유사 (거의 동일한 공시 요구사항, 약간의 표현 차이만 있음)
- 0.7-0.89: 유사함 (관련된 공시 요구사항, 같은 주제 영역)
- 0.5-0.69: 약간 관련됨 (부분적으로 겹치는 개념)
- 0.3-0.49: 거의 관련 없음
- 0.0-0.29: 전혀 관련 없음

**중요:** 
- 각 Target 지표와 Source 지표의 유사도를 평가하세요.
- JSON 형식으로 반환하세요: {{"dp_id_1": 0.85, "dp_id_2": 0.72, ...}}
- 숫자만 포함하세요 (0.0 ~ 1.0)."""

            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=500,
                timeout=30
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # JSON 추출
            json_match = re.search(r'\{[^}]+\}', result_text, re.DOTALL)
            if json_match:
                try:
                    similarities = json.loads(json_match.group())
                    # 결과 검증 및 캐시 저장
                    result = {}
                    for dp_id, standard, desc in target_descriptions:
                        if dp_id in similarities:
                            similarity = float(similarities[dp_id])
                            similarity = max(0.0, min(1.0, similarity))
                            result[dp_id] = similarity
                            # 캐시에 저장
                            cache_key = (source_description, desc)
                            self._llm_cache[cache_key] = similarity
                    
                    logger.debug(f"LLM multi description 유사도 계산 완료: {len(result)}개")
                    return result
                except json.JSONDecodeError as e:
                    logger.warning(f"LLM 응답 JSON 파싱 실패: {e}, 응답: {result_text}")
                    return {}
            else:
                logger.warning(f"LLM 응답에서 JSON을 찾을 수 없음: {result_text}")
                return {}
                
        except Exception as e:
            logger.warning(f"LLM 기반 multi description 유사도 계산 실패: {e}")
            return {}
    
    def _calculate_keyword_match(
        self,
        source_description: str,
        target_description: str
    ) -> float:
        """키워드 매칭 점수 계산 (LLM 우선, 폴백: 키워드 기반)
        
        Args:
            source_description: 원본 description
            target_description: 대상 description
        
        Returns:
            키워드 매칭 점수 (0.0 ~ 1.0)
        """
        if not source_description or not target_description:
            return 0.0
        
        # 1. LLM 기반 의미적 유사도 계산 (활성화된 경우)
        if self.use_llm_for_keywords:
            llm_similarity = self._calculate_keyword_match_with_llm(
                source_description, target_description
            )
            if llm_similarity is not None:
                return llm_similarity
        
        # 2. 키워드 기반 매칭 (폴백)
        source_keywords = self._extract_keywords(source_description)
        target_keywords = self._extract_keywords(target_description)
        
        if not source_keywords or not target_keywords:
            return 0.0
        
        # 정규화된 키워드 집합으로 변환 (동의어 포함)
        source_keyword_set = set(source_keywords)
        target_keyword_set = set(target_keywords)
        
        # 교집합 비율 (Jaccard 유사도)
        common = source_keyword_set & target_keyword_set
        total = source_keyword_set | target_keyword_set
        
        return len(common) / len(total) if total else 0.0
    
    def _extract_keywords_with_llm(self, description: str) -> Optional[List[str]]:
        """LLM을 사용하여 핵심 키워드 추출 (description 기반)
        
        Args:
            description: 데이터 포인트 description
        
        Returns:
            키워드 리스트 또는 None (실패 시)
        """
        if not description:
            return None
        
        # 캐시 확인
        cache_key = description
        if cache_key in self._keyword_cache:
            return self._keyword_cache[cache_key]
        
        client = self._get_llm_client()
        if not client:
            return None
        
        try:
            # description이 너무 길면 앞부분만 사용
            description_text = description[:500] if len(description) > 500 else description
            
            prompt = f"""다음 데이터 포인트 설명에서 핵심 키워드만 추출하세요.

설명: {description_text}

**규칙:**
1. 핵심 개념 키워드만 추출 (예: "온실가스", "GHG", "배출", "에너지", "기후", "공시", "요구사항")
2. 숫자는 포함 (예: "Scope 1" → "1", "Para 3" → "3")
3. 불필요한 조사, 관사, 문법적 요소 제외
4. 동의어는 정규화 (예: "GHG"와 "온실가스"는 둘 다 포함)
5. 각 키워드를 쉼표로 구분하여 나열
6. 최대 20개 키워드만 추출

**출력 형식:** 키워드1, 키워드2, 키워드3

키워드:"""

            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=150,
                timeout=10
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # 쉼표로 분리하고 정리
            keywords = [kw.strip().lower() for kw in result_text.split(',')]
            keywords = [kw for kw in keywords if kw]  # 빈 문자열 제거
            
            if keywords:
                # 캐시에 저장
                self._keyword_cache[cache_key] = keywords
                logger.debug(f"LLM 키워드 추출 (description): '{description[:50]}...' → {keywords[:5]}...")
                return keywords
            else:
                logger.warning(f"LLM 응답에서 키워드를 추출할 수 없음: {result_text}")
                return None
                
        except Exception as e:
            logger.warning(f"LLM 기반 키워드 추출 실패: {e}")
            return None
    
    def _normalize_keyword(self, keyword: str) -> List[str]:
        """키워드를 동의어 사전을 사용하여 정규화
        
        Args:
            keyword: 원본 키워드
        
        Returns:
            정규화된 키워드 리스트 (원본 + 동의어)
        """
        normalized = [keyword.lower()]
        
        keyword_lower = keyword.lower()
        
        # 동의어 사전에서 찾기
        for main_term, synonyms in self.keyword_synonyms.items():
            if keyword_lower == main_term.lower():
                # 메인 용어와 모든 동의어 추가
                normalized.extend([s.lower() for s in synonyms])
                break
            elif keyword_lower in [s.lower() for s in synonyms]:
                # 동의어 중 하나인 경우, 메인 용어와 다른 동의어들 추가
                normalized.append(main_term.lower())
                normalized.extend([s.lower() for s in synonyms if s.lower() != keyword_lower])
                break
        
        return list(set(normalized))  # 중복 제거
    
    def _extract_keywords(self, description: str) -> List[str]:
        """핵심 키워드 추출 (description 기반, LLM 우선, 폴백: 하드코딩 방식)
        
        Args:
            description: 데이터 포인트 description
        
        Returns:
            키워드 리스트 (정규화됨)
        """
        if not description:
            return []
        
        keywords = []
        
        # 1. LLM 기반 키워드 추출 (활성화된 경우)
        if self.use_llm_for_keywords:
            llm_keywords = self._extract_keywords_with_llm(description)
            if llm_keywords:
                # LLM 키워드를 정규화하여 추가
                for kw in llm_keywords:
                    normalized = self._normalize_keyword(kw)
                    keywords.extend(normalized)
                return list(set(keywords))  # 중복 제거
        
        # 2. 하드코딩된 키워드 추출 (폴백)
        description_lower = description.lower()
        
        ko_keywords = [
            "배출", "배출량", "GHG", "온실가스", "Scope", "에너지", "소비",
            "기후", "변화", "리스크", "위험", "거버넌스", "지배구조",
            "임직원", "고용", "인권", "사회", "환경", "공시", "요구사항",
            "정책", "조치", "목표", "지표", "통합", "보고서"
        ]
        for keyword in ko_keywords:
            if keyword in description:
                # 동의어 정규화 적용
                normalized = self._normalize_keyword(keyword)
                keywords.extend(normalized)
        
        en_keywords = [
            "emission", "ghg", "greenhouse", "gas", "scope",
            "energy", "consumption", "climate", "risk", "governance",
            "employee", "employment", "human", "rights", "social", "environment",
            "disclosure", "requirement", "policy", "action", "target", "metric",
            "consolidation", "statement", "sustainability"
        ]
        for keyword in en_keywords:
            if keyword in description_lower:
                # 동의어 정규화 적용
                normalized = self._normalize_keyword(keyword)
                keywords.extend(normalized)
        
        # 3. 숫자 추출 (예: "Scope 1", "Para 3", "102-5")
        numbers = re.findall(r'\d+', description)
        keywords.extend(numbers)
        
        return list(set(keywords))  # 중복 제거
    
    def determine_mapping_type_auto(
        self,
        final_score: float,
        structural_score: float,
        match_details: Dict[str, Any]
    ) -> Tuple[str, float]:
        """신뢰도에 따라 자동으로 매핑 타입 결정
        
        Args:
            final_score: 최종 점수 (0.0 ~ 1.0)
            structural_score: 구조적 점수 (0.0 ~ 1.0)
            match_details: 매칭 상세 정보
        
        Returns:
            (mapping_type, confidence) 튜플
        """
        # 1. 매우 높은 신뢰도 (0.95 이상) + 완벽한 구조적 매칭 → exact
        if final_score >= 0.95 and structural_score >= 0.90:
            if (match_details.get("category_match") and 
                match_details.get("unit_match") and 
                match_details.get("topic_similarity", 0) >= 0.9):
                logger.debug(f"자동 확정: exact (final: {final_score:.3f}, structural: {structural_score:.3f})")
                return ("exact", final_score)
        
        # 2. 높은 신뢰도 (0.90 이상) + 좋은 구조적 매칭 → exact 또는 partial
        if final_score >= 0.90:
            if structural_score >= 0.80:
                # 카테고리와 주제 유사성이 높으면 exact
                if (match_details.get("category_match") and 
                    match_details.get("topic_similarity", 0) >= 0.8):
                    logger.debug(f"자동 확정: exact (final: {final_score:.3f}, structural: {structural_score:.3f})")
                    return ("exact", final_score)
                else:
                    logger.debug(f"자동 확정: partial (final: {final_score:.3f}, structural: {structural_score:.3f})")
                    return ("partial", final_score)
        
        # 3. 중간 신뢰도 (0.80~0.90) → partial
        if final_score >= 0.80:
            logger.debug(f"자동 확정: partial (final: {final_score:.3f})")
            return ("partial", final_score)
        
        # 4. 낮은 신뢰도 (0.60 미만) + 구조적 매칭도 낮음 → no_mapping
        if final_score < 0.60 and structural_score < 0.40:
            logger.debug(f"자동 확정: no_mapping (final: {final_score:.3f}, structural: {structural_score:.3f})")
            return ("no_mapping", 0.0)
        
        # 5. 그 외 → auto_suggested (검토 필요)
        logger.debug(f"추천: auto_suggested (final: {final_score:.3f}, structural: {structural_score:.3f})")
        return ("auto_suggested", final_score)
    
    def auto_suggest_mappings_batch(
        self,
        source_standard: str,
        target_standard: str,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        batch_size: int = 40,
        dry_run: bool = False
    ) -> Dict[str, int]:
        """배치 매핑 자동 추천 및 저장
        
        Args:
            source_standard: 원본 기준서
            target_standard: 대상 기준서
            vector_threshold: 벡터 검색 임계값
            structural_threshold: 구조적 점수 임계값
            final_threshold: 최종 점수 임계값
            batch_size: 한 번에 처리할 DP 수
            dry_run: 실제 저장 없이 테스트
        
        Returns:
            통계 딕셔너리
        """
        stats = {
            "processed": 0,
            "auto_confirmed_exact": 0,
            "auto_confirmed_partial": 0,
            "auto_confirmed_no_mapping": 0,
            "suggested": 0,
            "skipped_low_score": 0,
            "skipped_no_embedding": 0,
            "errors": 0
        }
        
        # 처리할 DP 조회 (임베딩이 있는 활성 DP)
        pending_dps = self.db.query(DataPoint).filter(
            DataPoint.standard == source_standard,
            DataPoint.is_active == True,
            DataPoint.embedding.isnot(None)
        ).limit(batch_size).all()
        
        logger.info(f"처리할 DP: {len(pending_dps)}개 ({source_standard} -> {target_standard})")
        
        for source_dp in pending_dps:
            stats["processed"] += 1
            
            try:
                # 하이브리드 검색으로 매핑 후보 찾기
                suggestions = self.find_similar_dps_hybrid(
                    source_dp.dp_id,
                    target_standard,
                    vector_threshold=vector_threshold,
                    structural_threshold=structural_threshold,
                    final_threshold=final_threshold,
                    top_k=3
                )
                
                if not suggestions:
                    stats["skipped_low_score"] += 1
                    continue
                
                # 가장 좋은 매핑 선택
                best_match = suggestions[0]
                
                # 자동으로 매핑 타입 결정
                mapping_type, confidence = self.determine_mapping_type_auto(
                    best_match["final_score"],
                    best_match["structural_score"],
                    best_match["match_details"]
                )
                
                # 통계 업데이트
                if mapping_type == "exact":
                    stats["auto_confirmed_exact"] += 1
                elif mapping_type == "partial":
                    stats["auto_confirmed_partial"] += 1
                elif mapping_type == "no_mapping":
                    stats["auto_confirmed_no_mapping"] += 1
                else:
                    stats["suggested"] += 1
                
                # no_mapping 타입이면 저장하지 않음
                if mapping_type == "no_mapping":
                    logger.debug(
                        f"{source_dp.dp_id}: 매핑 없음으로 판단되어 저장하지 않음"
                    )
                    continue
                
                # 기존 매핑 확인 (equivalent_dps 필드에서)
                existing_equivalent_dps = source_dp.equivalent_dps or []
                target_dp_id = best_match["target_dp_id"]
                is_existing = target_dp_id in existing_equivalent_dps
                
                if not dry_run:
                    # equivalent_dps 필드 업데이트
                    if not is_existing:
                        # 새 매핑 추가
                        updated_equivalent_dps = list(set(existing_equivalent_dps + [target_dp_id]))
                        source_dp.equivalent_dps = updated_equivalent_dps
                        logger.debug(
                            f"{source_dp.dp_id}: equivalent_dps에 {target_dp_id} 추가 "
                            f"(매핑 타입: {mapping_type}, 신뢰도: {confidence:.3f})"
                        )
                    else:
                        logger.debug(
                            f"{source_dp.dp_id}: {target_dp_id}는 이미 equivalent_dps에 존재함"
                        )
            
            except Exception as e:
                logger.error(f"매핑 추천 실패: {source_dp.dp_id}, 오류: {e}")
                stats["errors"] += 1
                # 오류 발생 시 트랜잭션 롤백하여 실패 상태 해제
                try:
                    self.db.rollback()
                except Exception as rollback_error:
                    logger.warning(f"롤백 실패: {rollback_error}")
                continue
        
        # 커밋
        if not dry_run:
            try:
                self.db.commit()
                confirmed_count = (
                    stats.get("auto_confirmed_exact", 0) +
                    stats.get("auto_confirmed_partial", 0) +
                    stats.get("auto_confirmed_no_mapping", 0)
                )
                suggested_count = stats.get("suggested", 0)
                
                logger.info(f"✅ {stats['processed']}개 DP 처리 완료:")
                logger.info(f"   - 자동 확정 (exact): {stats.get('auto_confirmed_exact', 0)}개")
                logger.info(f"   - 자동 확정 (partial): {stats.get('auto_confirmed_partial', 0)}개")
                logger.info(f"   - 자동 확정 (no_mapping): {stats.get('auto_confirmed_no_mapping', 0)}개")
                logger.info(f"   - 추천 (auto_suggested): {suggested_count}개")
            except Exception as e:
                self.db.rollback()
                logger.error(f"❌ 커밋 실패: {e}")
                raise
        
        return stats
    
    def suggest_mappings_batch(
        self,
        source_standard: str,
        target_standard: str,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """배치 매핑 추천
        
        Args:
            source_standard: 원본 기준서
            target_standard: 대상 기준서
            vector_threshold: 벡터 검색 임계값
            structural_threshold: 구조적 점수 임계값
            final_threshold: 최종 점수 임계값
            limit: 처리할 최대 개수
        
        Returns:
            추천된 매핑 리스트
        """
        # pending 상태의 매핑 찾기
        pending_dps = self.db.query(DataPoint).filter(
            DataPoint.standard == source_standard,
            DataPoint.is_active == True,
            DataPoint.embedding.isnot(None)
        ).limit(limit).all()
        
        all_suggestions = []
        
        for source_dp in pending_dps:
            try:
                suggestions = self.find_similar_dps_hybrid(
                    source_dp.dp_id,
                    target_standard,
                    vector_threshold=vector_threshold,
                    structural_threshold=structural_threshold,
                    final_threshold=final_threshold,
                    top_k=3  # DP당 최대 3개 추천
                )
                
                for suggestion in suggestions:
                    all_suggestions.append({
                        "source_dp_id": source_dp.dp_id,
                        "source_dp_name_ko": source_dp.name_ko,
                        "source_dp_name_en": source_dp.name_en,
                        **suggestion
                    })
            except Exception as e:
                logger.error(f"매핑 추천 실패: {source_dp.dp_id} -> {target_standard}, 오류: {e}")
                continue
        
        # 최종 점수로 정렬
        all_suggestions.sort(key=lambda x: x["final_score"], reverse=True)
        
        logger.info(
            f"배치 매핑 추천 완료: {source_standard} -> {target_standard}, "
            f"총 {len(all_suggestions)}개 추천"
        )
        
        return all_suggestions
