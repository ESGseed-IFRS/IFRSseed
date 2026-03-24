"""다양한 기준서(GRI, TCFD, SASB, IFRS)에서 Data Point 추출 스크립트"""
import re
import os
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from abc import ABC, abstractmethod

import fitz  # PyMuPDF
from loguru import logger

try:
    from llama_parse import LlamaParse
    LLAMAPARSE_AVAILABLE = True
except ImportError:
    LLAMAPARSE_AVAILABLE = False
    logger.warning("LlamaParse를 사용할 수 없습니다. PyMuPDF만 사용합니다.")

try:
    from unstructured.partition.pdf import partition_pdf
    UNSTRUCTURED_AVAILABLE = True
except ImportError:
    UNSTRUCTURED_AVAILABLE = False
    logger.warning("Unstructured를 사용할 수 없습니다.")

from FlagEmbedding import FlagModel

from ifrs_agent.database.base import get_session
from ifrs_agent.model.models import (
    DataPoint, DPTypeEnum, DPUnitEnum, DisclosureRequirementEnum
)


class BasePDFParser(ABC):
    """PDF 파서 기본 클래스"""
    
    def __init__(self, use_llm: bool = False):
        """초기화"""
        self.use_llm = use_llm
        self.embedder = None
        self._load_embedder()
    
    def _load_embedder(self):
        """임베딩 모델 로드"""
        try:
            logger.info("임베딩 모델 로딩 중...")
            self.embedder = FlagModel('BAAI/bge-m3', use_fp16=True)
            logger.info("✅ 임베딩 모델 로드 완료")
        except Exception as e:
            logger.warning(f"임베딩 모델 로드 실패: {e}")
    
    @abstractmethod
    def extract_dps_from_pdf(self, pdf_path: str, standard: str) -> List[Dict]:
        """PDF에서 DP 추출"""
        pass
    
    def _infer_dp_type(self, text: str) -> DPTypeEnum:
        """텍스트에서 DP 타입 추론"""
        text_lower = text.lower()
        
        quantitative_keywords = [
            "amount", "quantity", "number", "total", "emissions", "배출량",
            "tCO₂e", "percentage", "비율", "수치"
        ]
        
        qualitative_keywords = [
            "describe", "explain", "disclose", "narrative", "서술",
            "설명", "공시", "제시"
        ]
        
        if any(kw in text_lower for kw in quantitative_keywords):
            return DPTypeEnum.QUANTITATIVE
        elif any(kw in text_lower for kw in qualitative_keywords):
            return DPTypeEnum.QUALITATIVE
        else:
            return DPTypeEnum.NARRATIVE
    
    def _infer_category(self, text: str, standard: str) -> str:
        """텍스트에서 ESG 카테고리 추론"""
        text_lower = text.lower()
        
        # Environment
        if any(kw in text_lower for kw in [
            "climate", "emission", "ghg", "carbon", "environmental",
            "기후", "배출", "온실가스", "탄소", "환경"
        ]):
            return "E"
        
        # Social
        if any(kw in text_lower for kw in [
            "employee", "workforce", "human rights", "community",
            "임직원", "인권", "사회"
        ]):
            return "S"
        
        # Governance
        if any(kw in text_lower for kw in [
            "governance", "board", "oversight", "management",
            "거버넌스", "이사회", "감독", "지배구조"
        ]):
            return "G"
        
        # 기본값
        if standard == "IFRS_S2":
            return "E"
        elif standard.startswith("GRI"):
            return "E"  # GRI는 다양하지만 기본값
        else:
            return "G"
    
    def _extract_topic_subtopic(self, text: str, standard: str) -> Tuple[Optional[str], Optional[str]]:
        """Topic과 Subtopic 추출 (개선 버전)"""
        text_lower = text.lower()
        
        # IFRS S1 (추가)
        if standard == "IFRS_S1":
            if "governance" in text_lower or "거버넌스" in text:
                return ("거버넌스", None)
            elif "strategy" in text_lower or "전략" in text:
                return ("전략", None)
            elif "risk management" in text_lower or "위험관리" in text:
                return ("위험관리", None)
            elif "metric" in text_lower or "target" in text_lower or "지표" in text or "목표" in text:
                return ("지표 및 목표", None)
            elif "materiality" in text_lower or "중요성" in text or "material" in text_lower:
                return ("일반 요구사항", "중요성")
            elif "fair presentation" in text_lower or "공정한 표시" in text or "공정 표시" in text:
                return ("일반 요구사항", "공정한 표시")
            elif "connected information" in text_lower or "연결 정보" in text or "연결된 정보" in text:
                return ("일반 요구사항", "연결 정보")
            elif "reporting entity" in text_lower or "보고 기업" in text or "보고 주체" in text:
                return ("일반 요구사항", "보고 주체")
            elif "comparative" in text_lower or "비교 정보" in text or "기간 비교" in text:
                return ("일반 요구사항", "비교 정보")
            elif "timing" in text_lower or "시기" in text or "보고 시기" in text:
                return ("일반 요구사항", "보고 시기")
            elif "location" in text_lower or "위치" in text or "공시 위치" in text:
                return ("일반 요구사항", "공시 위치")
            elif "judgement" in text_lower or "판단" in text or "의견" in text:
                return ("일반 요구사항", "판단 및 불확실성")
            elif "error" in text_lower or "오류" in text or "에러" in text:
                return ("일반 요구사항", "오류")
            # 기본값: IFRS S1의 경우 표준 이름을 topic으로
            return ("일반 요구사항", None)
        
        # IFRS S2
        elif standard == "IFRS_S2":
            if "governance" in text_lower or "거버넌스" in text:
                return ("거버넌스", None)
            elif "strategy" in text_lower or "전략" in text:
                if "risk" in text_lower or "위험" in text:
                    return ("전략", "기후 리스크")
                elif "financial" in text_lower or "재무" in text or "financial impact" in text_lower:
                    return ("전략", "재무적 영향")
                elif "scenario" in text_lower or "시나리오" in text:
                    return ("전략", "시나리오 분석")
                elif "transition" in text_lower or "전환" in text:
                    return ("전략", "전환 계획")
                return ("전략", None)
            elif "metric" in text_lower or "target" in text_lower or "지표" in text or "목표" in text:
                if "emission" in text_lower or "배출" in text or "ghg" in text_lower:
                    return ("지표 및 목표", "온실가스 배출")
                elif "scope" in text_lower and ("1" in text or "2" in text or "3" in text):
                    return ("지표 및 목표", "배출량 범위")
                return ("지표 및 목표", None)
            elif "risk management" in text_lower or "위험관리" in text:
                return ("위험관리", None)
            elif "physical risk" in text_lower or "물리적 리스크" in text or "물리적 위험" in text:
                return ("전략", "물리적 리스크")
            elif "transition risk" in text_lower or "전환 리스크" in text or "전환 위험" in text:
                return ("전략", "전환 리스크")
            # 기본값: IFRS S2의 경우 표준 이름을 topic으로
            return ("기후 관련 공시", None)
        
        # GRI (개선: 더 많은 패턴 추가)
        elif standard.startswith("GRI"):
            if "governance" in text_lower or "거버넌스" in text:
                return ("거버넌스", None)
            elif "emission" in text_lower or "배출" in text or "ghg" in text_lower or "온실가스" in text:
                return ("환경", "온실가스 배출")
            elif "energy" in text_lower or "에너지" in text:
                return ("환경", "에너지")
            elif "water" in text_lower or "물" in text or "수자원" in text:
                return ("환경", "수자원")
            elif "waste" in text_lower or "폐기물" in text:
                return ("환경", "폐기물")
            elif "biodiversity" in text_lower or "생물다양성" in text:
                return ("환경", "생물다양성")
            elif "employee" in text_lower or "임직원" in text or "직원" in text or "근로자" in text:
                return ("사회", "고용")
            elif "human rights" in text_lower or "인권" in text:
                return ("사회", "인권")
            elif "safety" in text_lower or "안전" in text or "안전보건" in text:
                return ("사회", "안전보건")
            elif "community" in text_lower or "지역사회" in text or "커뮤니티" in text:
                return ("사회", "지역사회")
            elif "customer" in text_lower or "고객" in text:
                return ("사회", "고객")
            elif "supplier" in text_lower or "공급망" in text or "공급자" in text:
                return ("사회", "공급망")
            elif "anti-corruption" in text_lower or "반부패" in text or "부패방지" in text:
                return ("거버넌스", "반부패")
            elif "ethics" in text_lower or "윤리" in text:
                return ("거버넌스", "윤리")
            # 기본값: GRI의 경우 표준 이름을 topic으로
            return ("GRI 표준", None)
        
        # TCFD (개선: 더 많은 패턴 추가)
        elif standard == "TCFD":
            if "governance" in text_lower or "거버넌스" in text:
                return ("Governance", None)
            elif "strategy" in text_lower or "전략" in text:
                if "scenario" in text_lower or "시나리오" in text:
                    return ("Strategy", "시나리오 분석")
                elif "transition" in text_lower or "전환" in text:
                    return ("Strategy", "전환 계획")
                return ("Strategy", None)
            elif "risk" in text_lower or "위험" in text:
                if "physical" in text_lower or "물리적" in text:
                    return ("Risk Management", "물리적 리스크")
                elif "transition" in text_lower or "전환" in text:
                    return ("Risk Management", "전환 리스크")
                return ("Risk Management", None)
            elif "metric" in text_lower or "target" in text_lower or "지표" in text or "목표" in text:
                if "emission" in text_lower or "배출" in text:
                    return ("Metrics and Targets", "온실가스 배출")
                return ("Metrics and Targets", None)
            # 기본값: TCFD의 경우 표준 이름을 topic으로
            return ("TCFD 권고사항", None)
        
        # SASB (추가)
        elif standard == "SASB":
            if "environment" in text_lower or "환경" in text:
                return ("환경", None)
            elif "social" in text_lower or "사회" in text:
                return ("사회", None)
            elif "governance" in text_lower or "거버넌스" in text:
                return ("거버넌스", None)
            return ("SASB 표준", None)
        
        # 기본값: 매칭 실패 시에도 표준 이름을 topic으로 사용
        standard_name = standard.replace("IFRS_", "").replace("_", " ")
        return (standard_name, None)
    
    def _extract_reporting_frequency(self, text: str) -> Optional[str]:
        """공시 주기 추출"""
        text_lower = text.lower()
        
        # 연간
        if any(kw in text_lower for kw in [
            "annually", "annual", "yearly", "each year", "every year",
            "연간", "매년", "년간", "연 1회", "1년에 1회"
        ]):
            return "연간"
        
        # 반기
        if any(kw in text_lower for kw in [
            "semi-annually", "semi-annual", "half-yearly", "biannually",
            "반기", "반년", "6개월", "반기별"
        ]):
            return "반기"
        
        # 분기
        if any(kw in text_lower for kw in [
            "quarterly", "quarter", "each quarter", "every quarter",
            "분기", "분기별", "3개월", "분기마다"
        ]):
            return "분기"
        
        # 월간
        if any(kw in text_lower for kw in [
            "monthly", "each month", "every month",
            "월간", "월별", "매월"
        ]):
            return "월간"
        
        # 기본값 없음 (호출하는 곳에서 기준서별 기본값 설정)
        return None
    
    def _get_default_reporting_frequency(self, standard: str) -> str:
        """기준서별 기본 공시 주기"""
        # IFRS, GRI, TCFD, SASB는 기본적으로 연간 공시
        return "연간"
    
    def _extract_financial_impact_type(self, text: str) -> Optional[str]:
        """재무 영향 유형 추출 (보수적 접근: 명확한 맥락만)"""
        text_lower = text.lower()
        
        # 수익: 재무 영향과 함께 언급된 경우만
        if any(kw in text_lower for kw in [
            "revenue", "income", "profit", "gain", "earnings",
            "수익", "매출", "이익", "손익", "수입"
        ]):
            # 재무 영향 맥락 확인 (더 구체적인 패턴)
            if any(kw in text_lower for kw in [
                "financial impact", "재무적 영향", "financial effect", "재무 효과",
                "affect revenue", "영향을 미치는 수익", "impact on income"
            ]):
                return "수익"
            # 단독으로 명확한 경우만
            elif any(kw in text_lower for kw in [
                "revenue from", "수익 발생", "income from", "수입원"
            ]):
                return "수익"
        
        # 비용: 재무 영향과 함께 언급된 경우만
        if any(kw in text_lower for kw in [
            "cost", "expense", "loss", "expenditure", "charge",
            "비용", "지출", "손실", "경비"
        ]):
            # 재무 영향 맥락 확인
            if any(kw in text_lower for kw in [
                "financial impact", "재무적 영향", "financial effect", "재무 효과",
                "affect cost", "영향을 미치는 비용", "impact on expense"
            ]):
                return "비용"
            # 단독으로 명확한 경우만
            elif any(kw in text_lower for kw in [
                "cost of", "비용 발생", "expense for", "지출 항목"
            ]):
                return "비용"
        
        # 자산: 재무 영향과 함께 언급된 경우만
        if any(kw in text_lower for kw in [
            "asset", "assets", "property", "plant", "equipment",
            "자산", "재산", "설비", "시설"
        ]):
            # 재무 영향 맥락 확인
            if any(kw in text_lower for kw in [
                "financial impact", "재무적 영향", "asset value", "자산 가치",
                "affect asset", "영향을 미치는 자산", "impact on assets"
            ]):
                return "자산"
            # 단독으로 명확한 경우만
            elif any(kw in text_lower for kw in [
                "asset impairment", "자산 손상", "asset value", "자산 평가"
            ]):
                return "자산"
        
        # 부채: 재무 영향과 함께 언급된 경우만
        if any(kw in text_lower for kw in [
            "liability", "liabilities", "debt", "obligation",
            "부채", "채무", "의무"
        ]):
            # 재무 영향 맥락 확인
            if any(kw in text_lower for kw in [
                "financial impact", "재무적 영향", "liability value", "부채 가치",
                "affect liability", "영향을 미치는 부채", "impact on liabilities"
            ]):
                return "부채"
            # 단독으로 명확한 경우만
            elif any(kw in text_lower for kw in [
                "liability recognition", "부채 인식", "debt obligation", "채무 의무"
            ]):
                return "부채"
        
        # 자본: 재무 영향과 함께 언급된 경우만
        if any(kw in text_lower for kw in [
            "equity", "capital", "shareholders' equity",
            "자본", "주주자본", "자본금"
        ]):
            # 재무 영향 맥락 확인
            if any(kw in text_lower for kw in [
                "financial impact", "재무적 영향", "equity value", "자본 가치",
                "affect equity", "영향을 미치는 자본", "impact on capital"
            ]):
                return "자본"
            # 단독으로 명확한 경우만
            elif any(kw in text_lower for kw in [
                "equity change", "자본 변동", "capital structure", "자본 구조"
            ]):
                return "자본"
        
        # 불확실한 경우 null 반환 (보수적 접근)
        return None
    
    def _extract_value_range(self, text: str) -> Optional[Dict[str, float]]:
        """값 범위 추출 (JSONB 형식)"""
        
        # 패턴 1: "0-100%", "0 to 100%", "0~100%"
        range_patterns = [
            r'(\d+(?:\.\d+)?)\s*[-~~~]\s*(\d+(?:\.\d+)?)\s*%',  # 0-100%
            r'(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s*%',  # 0 to 100%
            r'(\d+(?:\.\d+)?)\s*[-~]\s*(\d+(?:\.\d+)?)',  # 0-100
            r'between\s+(\d+(?:\.\d+)?)\s+and\s+(\d+(?:\.\d+)?)',  # between 0 and 100
        ]
        
        for pattern in range_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    min_val = float(match.group(1))
                    max_val = float(match.group(2))
                    return {"min": min_val, "max": max_val}
                except ValueError:
                    continue
        
        # 패턴 2: "최소 0", "minimum 0", "at least 0"
        min_patterns = [
            r'(?:최소|minimum|at least|min|>=|≥)\s*(\d+(?:\.\d+)?)',
            r'(\d+(?:\.\d+)?)\s*(?:이상|이상의|or more|or above)',
        ]
        
        for pattern in min_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    min_val = float(match.group(1))
                    return {"min": min_val}
                except ValueError:
                    continue
        
        # 패턴 3: "최대 100", "maximum 100", "at most 100"
        max_patterns = [
            r'(?:최대|maximum|at most|max|<=|≤)\s*(\d+(?:\.\d+)?)',
            r'(\d+(?:\.\d+)?)\s*(?:이하|이하의|or less|or below)',
        ]
        
        for pattern in max_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    max_val = float(match.group(1))
                    return {"max": max_val}
                except ValueError:
                    continue
        
        return None
    
    def _generate_dp_code(self, standard: str, identifier: str, name_en: str) -> str:
        """DP 코드 생성"""
        standard_code = standard.replace("IFRS_", "").replace("_", "")
        
        # 이름에서 키워드 추출
        keywords = re.findall(r'\b[A-Z][a-z]+\b', name_en)
        if keywords:
            code_suffix = "_".join(k.upper() for k in keywords[:4])
        else:
            code_suffix = identifier.replace("-", "_").upper()
        
        return f"{standard_code}_{code_suffix}"
    
    def _extract_korean_name(self, text: str, use_llm: bool = False, para_num: Optional[str] = None) -> str:
        """한국어 이름 추출 (개선 버전 + LLM 보조 옵션)"""
        # 패턴 0: Paragraph 제목 형식 (가장 우선) - "Paragraph 13(a) 사업 모델 및 가치 사슬" 형식
        if para_num:
            # 특정 Paragraph 번호로 검색 (더 정확)
            para_title_pattern = re.compile(
                rf'(?:Paragraph|Para|para|paragraph)\s+{para_num}(?:\([a-z]\))?\s+([가-힣][가-힣\s]{3,50})(?:\.|\n|:|$)',
                re.IGNORECASE | re.MULTILINE
            )
            match = para_title_pattern.search(text[:500])
            if match:
                title = match.group(1).strip()
                if 5 <= len(title) <= 200:
                    return title[:200]
            
            # 패턴 0-1: 숫자. 제목 형식 - "13. 사업 모델 및 가치 사슬" 형식
            num_title_pattern = re.compile(
                rf'^{para_num}\.?\s+([가-힣][가-힣\s]{3,50})(?:\.|\n|:|$)',
                re.MULTILINE
            )
            match = num_title_pattern.search(text[:500])
            if match:
                title = match.group(1).strip()
                if 5 <= len(title) <= 200:
                    return title[:200]
        else:
            # para_num이 없으면 일반 패턴 사용
            para_title_pattern = re.compile(
                r'(?:Paragraph|Para|para|paragraph)\s+\d+(?:\([a-z]\))?\s+([가-힣][가-힣\s]{3,50})(?:\.|\n|:|$)',
                re.IGNORECASE | re.MULTILINE
            )
            match = para_title_pattern.search(text[:500])
            if match:
                title = match.group(1).strip()
                if 5 <= len(title) <= 200:
                    return title[:200]
            
            num_title_pattern = re.compile(
                r'^\d+\.?\s+([가-힣][가-힣\s]{3,50})(?:\.|\n|:|$)',
                re.MULTILINE
            )
            match = num_title_pattern.search(text[:500])
            if match:
                title = match.group(1).strip()
                if 5 <= len(title) <= 200:
                    return title[:200]
        
        # 영어 텍스트인 경우 영어에서 핵심 키워드 추출 후 한국어로 변환
        if not re.search(r'[가-힣]', text[:500]):
            # 영어 키워드 → 한국어 매핑
            keyword_map = {
                "governance": "거버넌스",
                "strategy": "전략",
                "risk management": "위험관리",
                "risk": "리스크",
                "metrics and targets": "지표 및 목표",
                "metrics": "지표",
                "targets": "목표",
                "climate-related": "기후 관련",
                "climate": "기후",
                "emission": "배출량",
                "emissions": "배출량",
                "ghg": "온실가스",
                "greenhouse gas": "온실가스",
                "disclosure": "공시",
                "financial": "재무",
                "transition": "전환",
                "physical": "물리적",
                "scenario": "시나리오",
                "scope 1": "Scope 1",
                "scope 2": "Scope 2",
                "scope 3": "Scope 3",
            }
            
            text_lower = text[:300].lower()
            found_keywords = []
            for en_kw, ko_kw in keyword_map.items():
                if en_kw in text_lower:
                    found_keywords.append(ko_kw)
            
            if found_keywords:
                # 중복 제거 및 조합
                unique_keywords = list(dict.fromkeys(found_keywords))[:4]
                return " ".join(unique_keywords)[:200]
        
        # 한국어 텍스트인 경우 기존 패턴 사용
        patterns = [
            # 패턴 1: 의무 표현 포함 제목 형식 (가장 정확)
            r'(?:기업은|보고기업은|회사는)\s+([가-힣\s]+(?:의\s+)?(?:재무적\s+)?(?:영향|리스크|배출량|목표|지표|정책|프로세스|관리|감독|보고|공시|제시))[가-힣\s]*(?:하여야|해야|합니다|한다|공시해야|제시해야)',
            # 패턴 2: 제목 형식 (한글 + 숫자/영문 가능)
            r'^([가-힣][가-힣\s]+(?:의\s+)?(?:재무적\s+)?(?:영향|리스크|배출량|목표|지표|정책|프로세스|관리|감독|보고))',
            # 패턴 3: 일반 한글 문장 시작 (5-50자)
            r'^([가-힣][가-힣\s]{4,49})(?:\.|\n|:|$)',
            # 패턴 4: 괄호 안 한글
            r'\(([가-힣\s]{3,50})\)',
            # 패턴 5: 기본 한글 패턴
            r'([가-힣][가-힣\s]{2,100})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text[:500], re.MULTILINE)  # 범위 확대: 400 -> 500
            if match:
                name = match.group(1).strip()
                
                # 불필요한 단어 제거
                name = re.sub(r'^(기업은|보고기업은|회사는)\s+', '', name)
                name = re.sub(r'\s+(하여야|해야|합니다|한다|공시해야|제시해야)$', '', name)
                
                # 너무 짧거나 긴 것 필터링 (DB 제한: 200자)
                if 5 <= len(name) <= 200:  # 개선: 최대 200자로 제한 (DB 스키마 제한)
                    # 불필요한 공백 제거
                    name = " ".join(name.split())
                    return name[:200]  # 안전장치: 200자로 자르기
        
        # LLM 보조 (옵션: 정규식으로 못 찾았을 때 또는 use_llm=True 시 항상 호출)
        if use_llm:
            try:
                groq_api_key = os.getenv("GROQ_API_KEY")
                if groq_api_key:
                    from groq import Groq
                    client = Groq(api_key=groq_api_key)
                    
                    # 개선된 프롬프트: 더 명확한 지시
                    prompt = f"""다음 IFRS 공시 요구사항 텍스트에서 **공시 항목의 한국어 제목**만 추출하세요.

텍스트:
{text[:400]}

**규칙:**
1. 공시 항목의 제목만 반환 (설명, 분석, 이유 금지)
2. 한 줄, 최대 50자
3. 영어 텍스트인 경우 한국어로 번역하여 제목 생성
4. 제목을 찾을 수 없으면 "Unknown" 반환

**예시:**
- 입력: "An entity shall disclose information about governance processes..."
- 출력: 거버넌스 프로세스 공시

제목:"""
                    
                    # 에러 처리 강화: 타임아웃 및 재시도
                    max_retries = 2
                    for retry in range(max_retries):
                        try:
                            response = client.chat.completions.create(
                                model="llama-3.3-70b-versatile",
                                messages=[{"role": "user", "content": prompt}],
                                temperature=0.1,
                                max_tokens=50,
                                timeout=10  # 10초 타임아웃
                            )
                            break
                        except Exception as retry_error:
                            if retry < max_retries - 1:
                                logger.debug(f"LLM 호출 재시도 {retry + 1}/{max_retries}: {retry_error}")
                                continue
                            raise
                    
                    llm_name = response.choices[0].message.content.strip()
                    
                    # LLM 응답 후처리 (설명 제거)
                    # 1. 첫 줄만 추출 (개행 문자 기준)
                    llm_name = llm_name.split('\n')[0].strip()
                    # 2. "Unknown"이 포함된 긴 설명 제거
                    if "Unknown" in llm_name and len(llm_name) > 10:
                        llm_name = "Unknown"
                    # 3. 따옴표 제거
                    llm_name = llm_name.strip('"\'')
                    # 4. 콜론 이후 내용만 추출 (예: "제목: 거버넌스" -> "거버넌스")
                    if ':' in llm_name or '：' in llm_name:
                        llm_name = re.split(r'[:：]', llm_name)[-1].strip()
                    # 5. 설명 패턴 제거
                    explanation_patterns = [
                        r'^이\s+텍스트.*?제목',
                        r'^제목이\s+없',
                        r'^제목은\s*[:：]?',
                        r'^IFRS\s+공시\s+요구사항',
                        r'^다음\s+텍스트',
                        r'^공시\s+항목',
                    ]
                    for pattern in explanation_patterns:
                        if re.search(pattern, llm_name, re.IGNORECASE):
                            llm_name = "Unknown"
                            break
                    
                    # 길이 검증 및 제한 (DB 제한: 200자)
                    if llm_name and llm_name != "Unknown" and 5 <= len(llm_name) <= 200:
                        return llm_name[:200]  # 안전장치: 200자로 자르기
            except Exception as e:
                logger.debug(f"LLM 보조 이름 추출 실패: {e}")
        
        return "Unknown"
    
    def _extract_english_name(self, text: str, para_num: Optional[str] = None) -> str:
        """영어 이름 추출 (개선 버전)"""
        # 패턴 0: Paragraph 제목 형식 (가장 우선)
        if para_num:
            para_title_pattern = re.compile(
                rf'(?:Paragraph|Para|para|paragraph)\s+{para_num}(?:\([a-z]\))?\s+([A-Z][A-Za-z\s]{3,50})(?:\.|\n|:|$)',
                re.IGNORECASE | re.MULTILINE
            )
            match = para_title_pattern.search(text[:500])
            if match:
                title = match.group(1).strip()
                if 5 <= len(title) <= 200:
                    return title[:200]
            
            num_title_pattern = re.compile(
                rf'^{para_num}\.?\s+([A-Z][A-Za-z\s]{3,50})(?:\.|\n|:|$)',
                re.MULTILINE
            )
            match = num_title_pattern.search(text[:500])
            if match:
                title = match.group(1).strip()
                if 5 <= len(title) <= 200:
                    return title[:200]
        # 1단계: 핵심 공시 요구사항 제목 추출
        disclosure_patterns = [
            # "An entity shall disclose information about X" 형식
            r'(?:An|The)\s+entity\s+(?:shall|must|should)\s+(?:disclose|report|provide)\s+(?:information\s+about\s+)?([a-z][a-z\s\-]+(?:risks?|opportunities|emissions?|targets?|governance|strategy|metrics?|management))(?:\s+that|\s+which|\s+and|\s*\.|\s*:)',
            # "Disclosure of X" 형식
            r'(?:Disclosure|Disclosures?)\s+(?:of|about|on)\s+([A-Za-z][A-Za-z\s\-]+)(?:\s+that|\s+which|\s*\.|\s*:)',
            # 섹션 제목 형식 (Governance, Strategy 등)
            r'^(Governance|Strategy|Risk\s+Management|Metrics\s+and\s+Targets?|Climate-related\s+[A-Za-z\s]+)(?:\s*\n|\s*:)',
        ]
        
        for pattern in disclosure_patterns:
            match = re.search(pattern, text[:500], re.IGNORECASE | re.MULTILINE)
            if match:
                name = match.group(1).strip()
                # 첫 글자 대문자로
                name = name.capitalize()
                if 5 <= len(name) <= 100:
                    return " ".join(name.split())[:200]
        
        # 2단계: 일반 제목 형식
        general_patterns = [
            # 대문자로 시작하는 명사구 (10-80자)
            r'^([A-Z][a-z]+(?:\s+[a-z]+){1,8})(?:\s*\.|:|\n)',
            # 괄호 안 영어 (용어 정의)
            r'\(([A-Z][A-Za-z\s\-]{5,60})\)',
        ]
        
        for pattern in general_patterns:
            match = re.search(pattern, text[:400], re.MULTILINE)
            if match:
                name = match.group(1).strip()
                if 5 <= len(name) <= 100:
                    return " ".join(name.split())[:200]
        
        # 3단계: 첫 문장에서 핵심 키워드 추출
        first_sentence = text[:200].split('.')[0] if '.' in text[:200] else text[:100]
        # 핵심 키워드 찾기
        keywords = re.findall(r'\b(governance|strategy|risk|emission|target|metric|climate|disclosure|financial)\b', first_sentence, re.IGNORECASE)
        if keywords:
            return " ".join(k.capitalize() for k in keywords[:4])[:200]
        
        return "Unknown"
    
    def _generate_dp_id_from_text(self, text: str, standard: str, topic: Optional[str]) -> str:
        """텍스트에서 표준화된 DP ID 생성 (해시 대신)"""
        # 1. 텍스트에서 핵심 키워드 추출
        keywords = re.findall(r'\b[A-Z][a-z]+\b', text[:200])
        if keywords:
            keyword_hash = abs(hash('_'.join(keywords[:3]))) % 10000
        else:
            # 한글 키워드 추출
            korean_keywords = re.findall(r'[가-힣]{2,}', text[:200])
            if korean_keywords:
                keyword_hash = abs(hash('_'.join(korean_keywords[:3]))) % 10000
            else:
                keyword_hash = abs(hash(text[:100])) % 10000
        
        # 2. 표준 + 토픽 + 키워드 해시
        topic_code = topic[:3].upper().replace(" ", "_") if topic else "GEN"
        return f"{standard}-{topic_code}-{keyword_hash:04d}"


class PyMuPDFParser(BasePDFParser):
    """PyMuPDF 기반 PDF 파서 (IFRS, GRI용)"""
    
    def __init__(self, use_llm: bool = False):
        """초기화"""
        super().__init__(use_llm=use_llm)
    
    def extract_dps_from_pdf(self, pdf_path: str, standard: str) -> List[Dict]:
        """PDF에서 DP 추출 (에러 처리 강화)"""
        logger.info(f"PyMuPDF로 PDF 파싱 시작: {pdf_path}")
        
        try:
            doc = fitz.open(pdf_path)
        except FileNotFoundError:
            logger.error(f"❌ PDF 파일을 찾을 수 없습니다: {pdf_path}")
            return []
        except Exception as e:
            logger.error(f"❌ PDF 파일 열기 실패: {pdf_path}, 오류: {e}")
            return []
        dps = []
        seen_dp_ids = set()  # 중복 방지
        
        # 기준서별 Paragraph 패턴 (개선: 중첩된 하위항목 지원)
        if standard in ["IFRS_S1", "IFRS_S2"]:
            # IFRS 패턴: Para 15, Para 15-a, Para 14-a-i, S2-15-a, S2-14-a-i, §15, 15-a 등 모두 지원
            # 중첩된 하위항목 지원: 14-a-i (3단계)
            para_pattern = re.compile(
                r'(?:Para|Paragraph|para|paragraph|§|§§)?\s*(\d+)(?:[-\s]*\(?([a-z])\)?)(?:[-\s]*\(?([a-z])\)?)?|'  # Para 15-a, Para 14-a-i, §15
                r'(?:S[12]|IFRS\s*S[12])[-\s]*(\d+)(?:[-\s]*([a-z]))(?:[-\s]*([a-z]))?',  # S2-15-a, S2-14-a-i
                re.IGNORECASE
            )
        elif standard.startswith("GRI"):
            # GRI 패턴: GRI 2-7-a, GRI 305-1 등
            para_pattern = re.compile(
                r'GRI\s*(\d+)(?:[-\s]*(\d+))?(?:[-\s]*([a-z]))?',
                re.IGNORECASE
            )
        else:
            # 기본 패턴 (개선)
            para_pattern = re.compile(
                r'(?:Para|Paragraph|para|paragraph|§)?\s*(\d+)(?:[-\s]*([a-z]))?',
                re.IGNORECASE
            )
        
        # 의무 표현 키워드 (개선: 레벨별 구분 및 확장)
        mandatory_keywords = {
            "required": [
                "shall", "must", "requires", "required to", "required",
                "기업은", "보고기업은", "공시해야", "제시해야", "공시하여야",
                "의무", "필수"
            ],
            "recommended": [
                "should", "recommends", "recommended", "권장", "제시 권장",
                "제시하는 것이 바람직"
            ],
            "optional": [
                "may", "can", "선택", "가능", "제시할 수 있음"
            ]
        }
        # 모든 키워드를 하나의 리스트로 (기존 호환성 유지)
        all_mandatory_keywords = (
            mandatory_keywords["required"] + 
            mandatory_keywords["recommended"]
        )
        
        # 단위 패턴 (개선: 한국어 통화 단위 확장)
        unit_patterns = {
            # CO2 관련 (가장 구체적인 것부터)
            r"tCO₂e|tCO2e|tonnes?\s*(?:of\s+)?CO2(?:\s*equivalent)?|톤\s*CO2|톤\s*CO₂|metric\s+ton": DPUnitEnum.TCO2E,
            r"kgCO₂e|kgCO2e|kg\s*CO2e|킬로그램\s*CO2": DPUnitEnum.TCO2E,
            r"MtCO₂e|MtCO2e|메가톤\s*CO2|million\s+tonnes": DPUnitEnum.TCO2E,
            r"GtCO₂e|GtCO2e|기가톤\s*CO2|billion\s+tonnes": DPUnitEnum.TCO2E,
            # GHG 관련 키워드 (보수적: 명시적 단위와 함께 있을 때만)
            # r"greenhouse\s+gas|GHG|온실가스|배출량|emissions?": DPUnitEnum.TCO2E,  # 제거: 너무 광범위
            # 비율/퍼센트
            r"percentage|percent|\d+\s*%|퍼센트|비율|proportion|ratio": DPUnitEnum.PERCENTAGE,
            # 카운트
            r"count|number\s+of|수|건|명|개수|인원": DPUnitEnum.COUNT,
            # 통화 - 한국 (확장: 천만 원, 조 원 등 추가)
            r"KRW|₩|한화": DPUnitEnum.CURRENCY_KRW,
            r"조\s*원|조원|trillion\s*KRW": DPUnitEnum.CURRENCY_KRW,
            r"억\s*원|억원|hundred\s*million\s*KRW": DPUnitEnum.CURRENCY_KRW,
            r"천만\s*원|천만원|ten\s*million\s*KRW": DPUnitEnum.CURRENCY_KRW,
            r"백만\s*원|백만원|million\s*KRW": DPUnitEnum.CURRENCY_KRW,
            r"만\s*원|만원|ten\s*thousand\s*KRW": DPUnitEnum.CURRENCY_KRW,
            # 통화 - 미국 (확장)
            r"USD|US\s*\$|\$|달러": DPUnitEnum.CURRENCY_USD,
            r"trillion\s*USD|trillion\s*dollars?": DPUnitEnum.CURRENCY_USD,
            r"billion\s*USD|billion\s*dollars?": DPUnitEnum.CURRENCY_USD,
            r"million\s*USD|million\s*dollars?": DPUnitEnum.CURRENCY_USD,
            # 에너지
            r"MWh|mwh|메가와트시|megawatt\s*hour": DPUnitEnum.MWH,
            r"GWh|gwh|기가와트시|gigawatt\s*hour": DPUnitEnum.MWH,
            r"kWh|kwh|킬로와트시|kilowatt\s*hour": DPUnitEnum.MWH,
            r"TJ|terajoule|테라줄": DPUnitEnum.MWH,  # 에너지 단위 추가
            r"GJ|gigajoule|기가줄": DPUnitEnum.MWH,
            # 물
            r"cubic\s*met(?:er|re)|m³|입방미터|㎥|톤\s*물|리터|L|㎘": DPUnitEnum.CUBIC_METER,
        }
        
        # 전체 텍스트를 먼저 수집 (페이지 경계 문제 해결, 에러 처리 강화)
        full_text_pages = []
        try:
            for page_num, page in enumerate(doc):
                try:
                    page_text = page.get_text()
                    full_text_pages.append((page_num + 1, page_text))
                except Exception as e:
                    logger.warning(f"⚠️ 페이지 {page_num + 1} 텍스트 추출 실패: {e}")
                    full_text_pages.append((page_num + 1, ""))  # 빈 텍스트로 대체
        finally:
            doc.close()
        
        # 전체 텍스트를 하나로 합치기 (페이지 경계 고려)
        full_text = "\n\n[PAGE_BREAK]\n\n".join([text for _, text in full_text_pages])
        
        # Paragraph 번호 찾기
        for match in para_pattern.finditer(full_text):
            # IFRS의 경우 그룹 번호 확인
            if standard in ["IFRS_S1", "IFRS_S2"]:
                # 그룹 1, 2, 3 (Para 14-a-i 형식) 또는 그룹 4, 5, 6 (S2-14-a-i 형식)
                para_num = match.group(1)
                para_sub = match.group(2) if match.group(2) else ""
                para_sub2 = match.group(3) if match.group(3) else ""
                
                # 그룹 1이 없으면 그룹 4 사용 (S2-14-a-i 형식)
                if not para_num and match.group(4):
                    para_num = match.group(4)
                    para_sub = match.group(5) if match.group(5) else ""
                    para_sub2 = match.group(6) if match.group(6) else ""
                
                # 숫자 하위항목 제외 (예: 11-1은 잘못된 매칭)
                if para_sub and para_sub.isdigit():
                    continue
            else:
                para_num = match.group(1)
                para_sub = match.group(2) if len(match.groups()) > 1 and match.group(2) else ""
                para_sub2 = match.group(3) if len(match.groups()) > 2 and match.group(3) else ""
            
            if not para_num:
                continue
            
            # DP ID 생성 (개선: 올바른 형식으로 생성, SS 접두사 제거)
            if standard in ["IFRS_S1", "IFRS_S2"]:
                # 표준 약자 추출: IFRS_S1 -> S1, IFRS_S2 -> S2
                standard_abbr = standard.replace("IFRS_", "S")
                
                if para_sub2:
                    # 3단계 하위항목: S2-14-a-i
                    dp_id = f"{standard_abbr}-{para_num}-{para_sub}-{para_sub2}"
                    identifier = f"{para_num}-{para_sub}-{para_sub2}"
                elif para_sub:
                    # 2단계 하위항목: S2-15-a
                    dp_id = f"{standard_abbr}-{para_num}-{para_sub}"
                    identifier = f"{para_num}-{para_sub}"
                else:
                    # 1단계: S2-11
                    dp_id = f"{standard_abbr}-{para_num}"
                    identifier = para_num
            elif standard.startswith("GRI"):
                # GRI 패턴 개선: GRI 305-1 (para_num=305, para_sub=1) 또는 GRI 2-7-a (para_num=2, para_sub=7, para_sub2=a)
                if para_sub:
                    if para_sub.isdigit():
                        # 숫자인 경우 (GRI 305-1)
                        if para_sub2:
                            dp_id = f"GRI-{para_num}-{para_sub}-{para_sub2}"  # GRI-2-7-a
                            identifier = f"{para_num}-{para_sub}-{para_sub2}"
                        else:
                            dp_id = f"GRI-{para_num}-{para_sub}"  # GRI-305-1
                            identifier = f"{para_num}-{para_sub}"
                    else:
                        # 알파벳인 경우 (GRI 305-1-a)
                        dp_id = f"GRI-{para_num}-{para_sub2}-{para_sub}"  # 재정렬
                        identifier = f"{para_num}-{para_sub2}-{para_sub}"
                else:
                    # para_sub가 없는 경우
                    if para_sub2:
                        dp_id = f"GRI-{para_num}-{para_sub2}"
                        identifier = f"{para_num}-{para_sub2}"
                    else:
                        dp_id = f"GRI-{para_num}"
                        identifier = para_num
            else:
                dp_id = f"{standard}-{para_num}{para_sub}"
                identifier = f"{para_num}{para_sub}"
            
            # 중복 체크
            if dp_id in seen_dp_ids:
                continue
            seen_dp_ids.add(dp_id)
            
            # 해당 Paragraph 주변 텍스트 추출 (개선: 다음 paragraph까지)
            start_pos = match.start()
            para_text = self._extract_paragraph_text(full_text, start_pos, para_num, standard)
            
            # 페이지 번호 찾기
            page_num = self._find_page_number(full_text, start_pos, full_text_pages)
            
            # 의무 표현 확인 (개선: 레벨별 확인)
            disclosure_level = self._check_disclosure_requirement(para_text, mandatory_keywords)
            if not disclosure_level:
                continue  # 의무 표현이 없으면 스킵
            
            # Topic/Subtopic 추출 (이름 Fallback을 위해 먼저 추출)
            topic, subtopic = self._extract_topic_subtopic(para_text, standard)
            
            # DP 이름 추출 (개선: Paragraph 번호 활용하여 더 정확하게 추출)
            name_en = self._extract_english_name(para_text, para_num)
            name_ko = self._extract_korean_name(para_text, use_llm=self.use_llm, para_num=para_num)
            
            # 이름 상호 보완 (하나라도 있으면 사용)
            if name_ko == "Unknown" and name_en != "Unknown":
                name_ko = name_en
            elif name_en == "Unknown" and name_ko != "Unknown":
                name_en = name_ko
            
            # 둘 다 Unknown이면 Fallback 이름 생성 (스마트 Fallback: 중복 제거 및 키워드 추출)
            if name_ko == "Unknown" and name_en == "Unknown":
                # Fallback 1: Topic 기반 이름 (중복 제거)
                if topic:
                    # topic에 이미 "공시"가 포함되어 있으면 중복 제거
                    if "공시" in topic or "disclosure" in topic.lower():
                        if standard in ["IFRS_S1", "IFRS_S2"]:
                            name_ko = f"{topic} 요구사항"
                            name_en = f"{topic} Requirement"
                        else:
                            name_ko = topic
                            name_en = topic
                    else:
                        if standard in ["IFRS_S1", "IFRS_S2"]:
                            name_ko = f"{topic} 공시 요구사항"
                            name_en = f"{topic} Disclosure Requirement"
                        else:
                            name_ko = topic
                            name_en = topic
                else:
                    # Fallback 2: 첫 문장에서 핵심 키워드 추출
                    first_sentence = para_text[:200].split('.')[0] if '.' in para_text[:200] else para_text[:100]
                    keywords = re.findall(
                        r'\b(governance|strategy|risk|emission|target|metric|climate|disclosure|financial|management|transition|physical|scenario|ghg|greenhouse|gas)\b',
                        first_sentence, re.IGNORECASE
                    )
                    if keywords:
                        # 중복 제거 및 정렬
                        unique_keywords = list(dict.fromkeys(keywords))[:3]  # 최대 3개
                        # 키워드를 의미 있는 순서로 정렬
                        priority_order = ["governance", "strategy", "risk", "management", "climate", "emission", "ghg", "target", "metric", "financial", "disclosure", "transition", "physical", "scenario", "greenhouse", "gas"]
                        sorted_keywords = sorted(unique_keywords, key=lambda x: priority_order.index(x.lower()) if x.lower() in priority_order else 999)
                        
                        name_en = " ".join(k.capitalize() for k in sorted_keywords)
                        # 한국어 매핑
                        keyword_map = {
                            "governance": "거버넌스",
                            "strategy": "전략",
                            "risk": "리스크",
                            "management": "관리",
                            "climate": "기후",
                            "emission": "배출",
                            "ghg": "온실가스",
                            "target": "목표",
                            "metric": "지표",
                            "financial": "재무",
                            "disclosure": "공시",
                            "transition": "전환",
                            "physical": "물리적",
                            "scenario": "시나리오",
                            "greenhouse": "온실",
                            "gas": "가스"
                        }
                        name_ko = " ".join(keyword_map.get(k.lower(), k.capitalize()) for k in sorted_keywords)
                    else:
                        # Fallback 3: Paragraph 번호 기반 이름
                        if standard in ["IFRS_S1", "IFRS_S2"]:
                            name_ko = f"IFRS S{standard[-1]} Paragraph {identifier}"
                            name_en = f"IFRS S{standard[-1]} Paragraph {identifier}"
                        else:
                            name_ko = f"{standard} Paragraph {identifier}"
                            name_en = f"{standard} Paragraph {identifier}"
                
                logger.warning(f"⚠️ 이름 추출 실패, Fallback 이름 사용: {dp_id} -> {name_ko}")
            
            # DP 타입 판단
            dp_type = self._infer_dp_type(para_text)
            
            # 단위 추출 (보수적 접근: 명시적 패턴만 사용)
            unit = None
            # 1. 명시적 패턴 매칭 (가장 신뢰할 수 있는 방법)
            for pattern, unit_enum in unit_patterns.items():
                if re.search(pattern, para_text, re.IGNORECASE):
                    unit = unit_enum
                    break
            
            # 2. 기본값 설정은 매우 보수적으로 (모든 조건이 충족되어야 함)
            if unit is None and dp_type == DPTypeEnum.QUANTITATIVE:
                # IFRS S2 기후 관련: 매우 구체적인 키워드 조합만 허용
                if (standard == "IFRS_S2" and 
                    all(kw in para_text.lower() for kw in ["emission", "ghg"]) and  # 모든 핵심 키워드 필요
                    any(kw in para_text.lower() for kw in ["tonne", "ton", "tco2e", "톤"])):  # 단위 힌트 필요
                    unit = DPUnitEnum.TCO2E
                # 비율: 매우 명확한 경우만
                elif (all(kw in para_text.lower() for kw in ["percentage", "%"]) or
                      all(kw in para_text.lower() for kw in ["ratio", "%"]) or
                      all(kw in para_text.lower() for kw in ["proportion", "%"])):
                    unit = DPUnitEnum.PERCENTAGE
                # 그 외는 null 유지 (불확실하므로)
            
            # 카테고리 추출
            category = self._infer_category(para_text, standard)
            
            # DP 코드 생성
            dp_code = self._generate_dp_code(standard, identifier, name_en)
            
            # disclosure_requirement 변환
            disclosure_map = {
                "required": DisclosureRequirementEnum.REQUIRED,
                "recommended": DisclosureRequirementEnum.RECOMMENDED,
                "optional": DisclosureRequirementEnum.OPTIONAL
            }
            disclosure_req = disclosure_map.get(disclosure_level, DisclosureRequirementEnum.REQUIRED)
            
            # 추가 필드 추출 (보수적 접근)
            reporting_frequency = self._extract_reporting_frequency(para_text)
            # 공시 주기 기본값 설정 (보수적: IFRS 표준은 기본적으로 연간이지만, 명시적으로 언급된 경우만)
            # IFRS S1, S2는 기본적으로 연간 공시이므로 기본값 설정 (표준에 명시됨)
            if reporting_frequency is None:
                # IFRS 표준은 기본적으로 연간 공시 (표준 문서에 명시)
                if standard in ["IFRS_S1", "IFRS_S2"]:
                    reporting_frequency = self._get_default_reporting_frequency(standard)
                # 다른 기준서는 명시적으로 언급된 경우만
                # else: reporting_frequency = None (이미 None이므로 유지)
            
            financial_impact_type = self._extract_financial_impact_type(para_text)
            value_range = self._extract_value_range(para_text)
            
            dp_data = {
                "dp_id": dp_id,
                "dp_code": dp_code,
                "name_ko": name_ko,
                "name_en": name_en,
                "description": para_text[:1500],  # 개선: 1000 -> 1500
                "standard": standard,
                "category": category,
                "topic": topic,
                "subtopic": subtopic,
                "dp_type": dp_type,
                "unit": unit,
                "disclosure_requirement": disclosure_req,
                "reporting_frequency": reporting_frequency,
                "financial_impact_type": financial_impact_type,
                "value_range": value_range,
                "paragraph": identifier,
                "page": page_num,
                "raw_text": para_text
            }
            
            dps.append(dp_data)
            logger.info(f"✅ DP 추출: {dp_id} - {name_ko} ({disclosure_level})")
        
        # 추출 결과 요약
        logger.info(f"📊 총 {len(dps)}개 DP 추출 완료")
        if len(seen_dp_ids) > len(dps):
            logger.info(f"   - 중복 제외: {len(seen_dp_ids) - len(dps)}개")
        
        # 추출된 DP 통계
        if dps:
            topics = set(dp.get("topic") for dp in dps if dp.get("topic"))
            categories = set(dp.get("category") for dp in dps)
            logger.info(f"   - Topic 종류: {len(topics)}개 ({', '.join(topics)})")
            logger.info(f"   - Category 분포: {dict((c, sum(1 for dp in dps if dp.get('category') == c)) for c in categories)}")
        
        return dps
    
    def _extract_paragraph_text(self, text: str, start_pos: int, para_num: str, standard: str) -> str:
        """Paragraph 전체 텍스트 추출 (다음 paragraph까지) - 개선"""
        # 현재 paragraph 시작 (이전 paragraph 포함하지 않음)
        current_start = start_pos
        
        # 다음 paragraph 패턴 찾기
        if standard in ["IFRS_S1", "IFRS_S2"]:
            next_para_pattern = re.compile(
                r'(?:Para|Paragraph|§|§§)?\s*(\d+)|(?:S[12]|IFRS\s*S[12])[-\s]*(\d+)',
                re.IGNORECASE
            )
        elif standard.startswith("GRI"):
            next_para_pattern = re.compile(r'GRI\s*(\d+)', re.IGNORECASE)
        else:
            next_para_pattern = re.compile(r'(?:Para|Paragraph|§|§§)?\s*(\d+)', re.IGNORECASE)
        
        # 다음 paragraph 찾기 (현재 paragraph 다음부터, 최소 50자 이후)
        search_start = start_pos + 50
        next_match = next_para_pattern.search(text, search_start)
        
        if next_match:
            # 다음 paragraph의 번호 확인
            next_para_num = next_match.group(1) or (next_match.group(2) if len(next_match.groups()) > 1 else None)
            
            # para_num과 비교 (문자열로 변환하여 비교)
            if next_para_num and str(next_para_num) != str(para_num):
                # 다른 paragraph면 그 전까지
                end_pos = next_match.start()
            else:
                # 같은 paragraph면 3000자까지 (개선: 2000 -> 3000)
                end_pos = min(start_pos + 3000, len(text))
        else:
            # 다음 paragraph가 없으면 3000자까지 (개선: 2000 -> 3000)
            end_pos = min(start_pos + 3000, len(text))
        
        extracted_text = text[current_start:end_pos].strip()
        
        # 빈 텍스트 체크
        if not extracted_text or len(extracted_text) < 10:
            # 최소한 500자까지는 확보
            end_pos = min(start_pos + 500, len(text))
            extracted_text = text[current_start:end_pos].strip()
        
        return extracted_text
    
    def _find_page_number(self, full_text: str, position: int, full_text_pages: List[Tuple[int, str]]) -> int:
        """텍스트 위치에서 페이지 번호 찾기"""
        current_pos = 0
        for page_num, page_text in full_text_pages:
            page_end = current_pos + len(page_text) + len("\n\n[PAGE_BREAK]\n\n")
            if current_pos <= position < page_end:
                return page_num
            current_pos = page_end
        return 1  # 기본값
    
    def _check_disclosure_requirement(self, text: str, mandatory_keywords: Dict[str, List[str]]) -> Optional[str]:
        """의무 표현 확인 (레벨별) - 개선"""
        text_lower = text.lower()
        
        # Required 우선 확인 (가장 엄격)
        if any(kw in text_lower for kw in mandatory_keywords["required"]):
            return "required"
        # Recommended 확인
        elif any(kw in text_lower for kw in mandatory_keywords["recommended"]):
            return "recommended"
        # Optional은 기본값이므로 별도 체크 불필요
        # (의무 표현이 없으면 None 반환하여 스킵)
        
        return None
    


class LlamaParseParser(BasePDFParser):
    """LlamaParse 기반 PDF 파서 (TCFD, SASB용)"""
    
    def __init__(self, api_key: Optional[str] = None, use_llm: bool = False):
        super().__init__(use_llm=use_llm)
        self.api_key = api_key or os.getenv("LLAMA_CLOUD_API_KEY")
        if not self.api_key:
            raise ValueError("LLAMA_CLOUD_API_KEY 환경변수 또는 인자 필요")
        
        self.parser = LlamaParse(
            api_key=self.api_key,
            result_type="text",
            parsing_instruction="Extract all disclosure requirements, especially paragraphs containing 'shall', 'must', 'requires'. Preserve paragraph numbers and structure."
        )
    
    def extract_dps_from_pdf(self, pdf_path: str, standard: str) -> List[Dict]:
        """PDF에서 DP 추출"""
        logger.info(f"LlamaParse로 PDF 파싱 시작: {pdf_path}")
        
        documents = self.parser.load_data(pdf_path)
        dps = []
        
        # 기준서별 패턴
        if standard == "TCFD":
            # TCFD는 구조 기반 추출
            return self._extract_tcfd_dps(documents, standard)
        elif standard == "SASB":
            # SASB는 표 중심 추출
            return self._extract_sasb_dps(documents, standard)
        else:
            # 기본 추출
            return self._extract_generic_dps(documents, standard)
    
    def _extract_tcfd_dps(self, documents, standard: str) -> List[Dict]:
        """TCFD DP 추출"""
        dps = []
        
        # TCFD 4개 핵심 영역
        tcfd_areas = ["Governance", "Strategy", "Risk Management", "Metrics and Targets"]
        
        for doc in documents:
            text = doc.text
            page_num = getattr(doc.metadata, 'page_label', 'Unknown')
            
            # 각 영역별로 DP 추출
            for area in tcfd_areas:
                if area.lower() in text.lower():
                    # 해당 영역의 요구사항 추출
                    dp_data = self._create_dp_from_text(
                        text, standard, area, page_num
                    )
                    if dp_data:
                        dps.append(dp_data)
        
        return dps
    
    def _extract_sasb_dps(self, documents, standard: str) -> List[Dict]:
        """SASB DP 추출 (표 중심)"""
        dps = []
        
        for doc in documents:
            text = doc.text
            page_num = getattr(doc.metadata, 'page_label', 'Unknown')
            
            # 표에서 메트릭 추출
            # SASB는 "Accounting Metrics", "Activity Metrics" 등으로 구분
            metric_pattern = re.compile(
                r'(?:Accounting|Activity|Topic)\s+Metrics?[:\s]+(.+?)(?:\n\n|\Z)',
                re.IGNORECASE | re.DOTALL
            )
            
            for match in metric_pattern.finditer(text):
                metric_text = match.group(1)
                dp_data = self._create_dp_from_text(
                    metric_text, standard, "Metrics", page_num
                )
                if dp_data:
                    dps.append(dp_data)
        
        return dps
    
    def _extract_generic_dps(self, documents, standard: str) -> List[Dict]:
        """일반적인 DP 추출"""
        dps = []
        mandatory_keywords = ["shall", "must", "requires"]
        
        for doc in documents:
            text = doc.text
            page_num = getattr(doc.metadata, 'page_label', 'Unknown')
            
            if any(kw in text.lower() for kw in mandatory_keywords):
                dp_data = self._create_dp_from_text(
                    text, standard, None, page_num
                )
                if dp_data:
                    dps.append(dp_data)
        
        return dps
    
    def _create_dp_from_text(
        self, text: str, standard: str, topic: Optional[str], page_num: str
    ) -> Optional[Dict]:
        """텍스트에서 DP 데이터 생성 (개선)"""
        # 이름 추출 (개선: 영어/한국어 모두 추출)
        name_en = self._extract_english_name(text)
        name_ko = self._extract_korean_name(text, use_llm=self.use_llm)
        
        # 이름 상호 보완
        if name_ko == "Unknown" and name_en != "Unknown":
            name_ko = name_en
        elif name_en == "Unknown" and name_ko != "Unknown":
            name_en = name_ko
        
        # 둘 다 Unknown이면 스킵
        if name_ko == "Unknown" and name_en == "Unknown":
            return None
        
        # Topic/Subtopic 추출 (개선: topic 파라미터가 없으면 자동 추출)
        if topic:
            # topic 파라미터가 제공되면 사용, subtopic은 자동 추출
            _, subtopic = self._extract_topic_subtopic(text, standard)
        else:
            # topic 파라미터가 없으면 자동 추출
            topic, subtopic = self._extract_topic_subtopic(text, standard)
        
        # 추가 필드 추출 (개선)
        reporting_frequency = self._extract_reporting_frequency(text)
        financial_impact_type = self._extract_financial_impact_type(text)
        value_range = self._extract_value_range(text)
        
        # 단위 추출
        unit = None
        unit_patterns = {
            r"tCO₂e|tCO2e|tonnes? CO2|톤\s*CO2|톤\s*CO₂": DPUnitEnum.TCO2E,
            r"kgCO₂e|kgCO2e|kg\s*CO2e|킬로그램\s*CO2": DPUnitEnum.TCO2E,
            r"MtCO₂e|MtCO2e|메가톤\s*CO2": DPUnitEnum.TCO2E,
            r"percentage|%|퍼센트|비율": DPUnitEnum.PERCENTAGE,
            r"count|number|수|건|명": DPUnitEnum.COUNT,
            r"KRW|원|₩|억\s*원|억원|백만\s*원|백만원": DPUnitEnum.CURRENCY_KRW,
            r"USD|\$|달러|billion\s*USD|million\s*USD": DPUnitEnum.CURRENCY_USD,
            r"MWh|mwh|메가와트시": DPUnitEnum.MWH,
            r"GWh|gwh|기가와트시": DPUnitEnum.MWH,
        }
        for pattern, unit_enum in unit_patterns.items():
            if re.search(pattern, text, re.IGNORECASE):
                unit = unit_enum
                break
        
        # DP ID 생성 (개선: 해시 대신 표준화된 규칙)
        dp_id = self._generate_dp_id_from_text(text, standard, topic)
        
        return {
            "dp_id": dp_id,
            "dp_code": self._generate_dp_code(standard, dp_id, name_en),
            "name_ko": name_ko,
            "name_en": name_en,
            "description": text[:1000],
            "standard": standard,
            "category": self._infer_category(text, standard),
            "topic": topic,
            "subtopic": subtopic,
            "dp_type": self._infer_dp_type(text),
            "unit": unit,
            "disclosure_requirement": DisclosureRequirementEnum.REQUIRED,
            "reporting_frequency": reporting_frequency,
            "financial_impact_type": financial_impact_type,
            "value_range": value_range,
            "paragraph": None,
            "page": page_num,
            "raw_text": text
        }


class UnstructuredParser(BasePDFParser):
    """Unstructured 기반 PDF 파서 (TCFD, SASB 대체용)"""
    
    def __init__(self, use_llm: bool = False):
        super().__init__(use_llm=use_llm)
    
    def extract_dps_from_pdf(self, pdf_path: str, standard: str) -> List[Dict]:
        """PDF에서 DP 추출"""
        logger.info(f"Unstructured로 PDF 파싱 시작: {pdf_path}")
        
        elements = partition_pdf(
            filename=pdf_path,
            strategy="hi_res",  # 고해상도 전략
            infer_table_structure=True
        )
        
        dps = []
        
        for element in elements:
            text = element.text
            element_type = element.category if hasattr(element, 'category') else None
            
            # 표 요소인 경우
            if element_type == "Table":
                # 표에서 DP 추출
                table_dps = self._extract_dps_from_table(text, standard)
                dps.extend(table_dps)
            else:
                # 일반 텍스트에서 DP 추출
                if any(kw in text.lower() for kw in ["shall", "must", "requires"]):
                    dp_data = self._create_dp_from_text(text, standard)
                    if dp_data:
                        dps.append(dp_data)
        
        return dps
    
    def _extract_dps_from_table(self, table_text: str, standard: str) -> List[Dict]:
        """표에서 DP 추출"""
        dps = []
        # 표 파싱 로직 (간단 버전)
        lines = table_text.split('\n')
        for line in lines:
            if line.strip():
                dp_data = self._create_dp_from_text(line, standard)
                if dp_data:
                    dps.append(dp_data)
        return dps
    
    def _create_dp_from_text(self, text: str, standard: str, topic: Optional[str] = None) -> Optional[Dict]:
        """텍스트에서 DP 데이터 생성 (개선)"""
        if len(text.strip()) < 10:
            return None
        
        # 이름 추출 (개선: 영어/한국어 모두 추출)
        name_en = self._extract_english_name(text)
        name_ko = self._extract_korean_name(text, use_llm=self.use_llm)
        
        # 이름 상호 보완
        if name_ko == "Unknown" and name_en != "Unknown":
            name_ko = name_en
        elif name_en == "Unknown" and name_ko != "Unknown":
            name_en = name_ko
        
        # 둘 다 Unknown이면 스킵
        if name_ko == "Unknown" and name_en == "Unknown":
            return None
        
        # Topic/Subtopic 추출 (개선: topic 파라미터가 없으면 자동 추출)
        if topic:
            # topic 파라미터가 제공되면 사용, subtopic은 자동 추출
            _, subtopic = self._extract_topic_subtopic(text, standard)
        else:
            # topic 파라미터가 없으면 자동 추출
            topic, subtopic = self._extract_topic_subtopic(text, standard)
        
        # 추가 필드 추출 (개선)
        reporting_frequency = self._extract_reporting_frequency(text)
        financial_impact_type = self._extract_financial_impact_type(text)
        value_range = self._extract_value_range(text)
        
        # 단위 추출
        unit = None
        unit_patterns = {
            r"tCO₂e|tCO2e|tonnes? CO2|톤\s*CO2|톤\s*CO₂": DPUnitEnum.TCO2E,
            r"kgCO₂e|kgCO2e|kg\s*CO2e|킬로그램\s*CO2": DPUnitEnum.TCO2E,
            r"MtCO₂e|MtCO2e|메가톤\s*CO2": DPUnitEnum.TCO2E,
            r"percentage|%|퍼센트|비율": DPUnitEnum.PERCENTAGE,
            r"count|number|수|건|명": DPUnitEnum.COUNT,
            r"KRW|원|₩|억\s*원|억원|백만\s*원|백만원": DPUnitEnum.CURRENCY_KRW,
            r"USD|\$|달러|billion\s*USD|million\s*USD": DPUnitEnum.CURRENCY_USD,
            r"MWh|mwh|메가와트시": DPUnitEnum.MWH,
            r"GWh|gwh|기가와트시": DPUnitEnum.MWH,
        }
        for pattern, unit_enum in unit_patterns.items():
            if re.search(pattern, text, re.IGNORECASE):
                unit = unit_enum
                break
        
        # DP ID 생성 (개선)
        dp_id = self._generate_dp_id_from_text(text, standard, topic)
        
        return {
            "dp_id": dp_id,
            "dp_code": self._generate_dp_code(standard, dp_id, name_en),
            "name_ko": name_ko,
            "name_en": name_en,
            "description": text[:1000],
            "standard": standard,
            "category": self._infer_category(text, standard),
            "topic": topic,
            "subtopic": subtopic,
            "dp_type": self._infer_dp_type(text),
            "unit": unit,
            "disclosure_requirement": DisclosureRequirementEnum.REQUIRED,
            "reporting_frequency": reporting_frequency,
            "financial_impact_type": financial_impact_type,
            "value_range": value_range,
            "paragraph": None,
            "page": None,
            "raw_text": text
        }


class MultiStandardDPExtractor:
    """다양한 기준서에서 DP 추출 (하이브리드 접근)"""
    
    def __init__(self, use_llm: bool = False):
        """
        Args:
            use_llm: LLM 보조 한국어 이름 추출 사용 여부 (기본값: False)
        """
        # PyMuPDF 파서 (기본)
        self.pymupdf_parser = PyMuPDFParser(use_llm=use_llm)
        
        # LlamaParse 파서 (선택적)
        self.llamaparse_parser = None
        if LLAMAPARSE_AVAILABLE and os.getenv("LLAMA_CLOUD_API_KEY"):
            try:
                self.llamaparse_parser = LlamaParseParser(use_llm=use_llm)
                logger.info("✅ LlamaParse 파서 사용 가능")
            except Exception as e:
                logger.warning(f"LlamaParse 파서 초기화 실패: {e}")
        
        # Unstructured 파서 (선택적)
        self.unstructured_parser = None
        if UNSTRUCTURED_AVAILABLE:
            try:
                self.unstructured_parser = UnstructuredParser(use_llm=use_llm)
                logger.info("✅ Unstructured 파서 사용 가능")
            except Exception as e:
                logger.warning(f"Unstructured 파서 초기화 실패: {e}")
    
    def extract_dps(
        self, 
        pdf_path: str, 
        standard: str,
        force_parser: Optional[str] = None
    ) -> List[Dict]:
        """
        기준서별로 적합한 파서 선택하여 DP 추출
        
        Args:
            pdf_path: PDF 파일 경로
            standard: 기준서 코드 ("IFRS_S1", "IFRS_S2", "GRI", "TCFD", "SASB")
            force_parser: 강제로 사용할 파서 ("pymupdf", "llamaparse", "unstructured")
        
        Returns:
            추출된 DP 딕셔너리 리스트
        """
        # 강제 파서 지정
        if force_parser == "pymupdf":
            return self.pymupdf_parser.extract_dps_from_pdf(pdf_path, standard)
        elif force_parser == "llamaparse" and self.llamaparse_parser:
            return self.llamaparse_parser.extract_dps_from_pdf(pdf_path, standard)
        elif force_parser == "unstructured" and self.unstructured_parser:
            return self.unstructured_parser.extract_dps_from_pdf(pdf_path, standard)
        
        # 기준서별 자동 선택
        if standard in ["IFRS_S1", "IFRS_S2"]:
            # IFRS → PyMuPDF
            logger.info(f"IFRS 기준서 감지: PyMuPDF 사용")
            return self.pymupdf_parser.extract_dps_from_pdf(pdf_path, standard)
        
        elif standard.startswith("GRI"):
            # GRI → PyMuPDF
            logger.info(f"GRI 기준서 감지: PyMuPDF 사용")
            return self.pymupdf_parser.extract_dps_from_pdf(pdf_path, standard)
        
        elif standard == "TCFD":
            # TCFD → LlamaParse 또는 Unstructured
            if self.llamaparse_parser:
                logger.info(f"TCFD 기준서 감지: LlamaParse 사용")
                return self.llamaparse_parser.extract_dps_from_pdf(pdf_path, standard)
            elif self.unstructured_parser:
                logger.info(f"TCFD 기준서 감지: Unstructured 사용 (LlamaParse 없음)")
                return self.unstructured_parser.extract_dps_from_pdf(pdf_path, standard)
            else:
                logger.warning(f"TCFD 기준서: LlamaParse/Unstructured 없음, PyMuPDF 사용")
                return self.pymupdf_parser.extract_dps_from_pdf(pdf_path, standard)
        
        elif standard == "SASB":
            # SASB → LlamaParse 또는 Unstructured
            if self.llamaparse_parser:
                logger.info(f"SASB 기준서 감지: LlamaParse 사용")
                return self.llamaparse_parser.extract_dps_from_pdf(pdf_path, standard)
            elif self.unstructured_parser:
                logger.info(f"SASB 기준서 감지: Unstructured 사용 (LlamaParse 없음)")
                return self.unstructured_parser.extract_dps_from_pdf(pdf_path, standard)
            else:
                logger.warning(f"SASB 기준서: LlamaParse/Unstructured 없음, PyMuPDF 사용")
                return self.pymupdf_parser.extract_dps_from_pdf(pdf_path, standard)
        
        else:
            # 기본값: PyMuPDF
            logger.info(f"알 수 없는 기준서: PyMuPDF 사용 (기본값)")
            return self.pymupdf_parser.extract_dps_from_pdf(pdf_path, standard)
    
    def save_dps_to_db(
        self, 
        dps: List[Dict], 
        generate_embeddings: bool = True
    ) -> int:
        """
        추출된 DP를 DB에 저장
        
        Args:
            dps: 추출된 DP 딕셔너리 리스트
            generate_embeddings: 임베딩 생성 여부
        
        Returns:
            저장된 DP 개수
        """
        db = get_session()
        saved_count = 0
        embedder = self.pymupdf_parser.embedder
        
        try:
            for dp_data in dps:
                # 기존 DP 확인 (dp_id 또는 dp_code로 체크)
                existing_by_id = db.query(DataPoint).filter(
                    DataPoint.dp_id == dp_data["dp_id"]
                ).first()
                
                existing_by_code = db.query(DataPoint).filter(
                    DataPoint.dp_code == dp_data["dp_code"]
                ).first()
                
                if existing_by_id:
                    logger.warning(f"⚠️ DP 이미 존재 (dp_id): {dp_data['dp_id']}, 스킵")
                    continue
                
                if existing_by_code:
                    logger.warning(f"⚠️ DP 이미 존재 (dp_code): {dp_data['dp_code']}, 스킵")
                    continue
                
                # 임베딩 텍스트 생성 (개선된 버전: 모든 컬럼 포함)
                from ifrs_agent.utils.embedding_utils import generate_data_point_embedding_text_from_dict
                embedding_text = generate_data_point_embedding_text_from_dict(dp_data)
                
                # 임베딩 생성
                embedding = None
                if generate_embeddings and embedder:
                    try:
                        # FlagEmbedding의 encode는 리스트를 받음
                        embedding_vector = embedder.encode([embedding_text])
                        # 결과는 2D 배열이므로 첫 번째 요소를 가져옴
                        # numpy array 또는 torch tensor일 수 있음
                        if hasattr(embedding_vector, 'ndim') and embedding_vector.ndim > 1:
                            embedding = embedding_vector[0].tolist()
                        elif hasattr(embedding_vector, '__len__') and len(embedding_vector) > 0:
                            # 리스트나 튜플인 경우
                            if hasattr(embedding_vector[0], 'tolist'):
                                embedding = embedding_vector[0].tolist()
                            else:
                                embedding = list(embedding_vector[0])
                        else:
                            embedding = embedding_vector.tolist() if hasattr(embedding_vector, 'tolist') else list(embedding_vector)
                    except Exception as e:
                        logger.error(f"임베딩 생성 실패: {e}")
                
                # DataPoint 객체 생성
                # dp_type 변환 - 항상 소문자 문자열로 변환
                dp_type_raw = dp_data["dp_type"]
                
                # 어떤 경우든 문자열로 변환 후 소문자로
                # DPTypeEnum(str, Enum)의 경우 str()이 값을 반환
                dp_type_str = str(dp_type_raw).lower()
                
                # 유효한 ENUM 값 목록
                valid_dp_types = {"quantitative", "qualitative", "narrative", "binary"}
                
                if dp_type_str in valid_dp_types:
                    dp_type_value = dp_type_str
                else:
                    # 기본값
                    dp_type_value = "narrative"
                    logger.warning(f"알 수 없는 dp_type: {dp_type_raw} -> 'narrative'로 설정")
                
                # unit 변환
                unit_raw = dp_data.get("unit")
                unit_value = None
                if unit_raw:
                    unit_str = str(unit_raw).lower()
                    valid_units = {"percentage", "count", "currency_krw", "currency_usd", "tco2e", "mwh", "cubic_meter", "text"}
                    if unit_str in valid_units:
                        unit_value = unit_str
                    else:
                        unit_value = None  # 유효하지 않으면 None
                
                # disclosure_requirement 변환
                disclosure_raw = dp_data.get("disclosure_requirement")
                disclosure_req_value = "필수"  # 기본값
                if disclosure_raw:
                    disclosure_str = str(disclosure_raw).upper()
                    disclosure_map = {
                        "REQUIRED": "필수",
                        "RECOMMENDED": "권장", 
                        "OPTIONAL": "선택",
                        "필수": "필수",
                        "권장": "권장",
                        "선택": "선택"
                    }
                    disclosure_req_value = disclosure_map.get(disclosure_str, "필수")
                
                # 이름 필드 길이 제한 (DB 스키마: 200자)
                name_ko = dp_data["name_ko"][:200] if len(dp_data["name_ko"]) > 200 else dp_data["name_ko"]
                name_en = dp_data["name_en"][:200] if len(dp_data["name_en"]) > 200 else dp_data["name_en"]
                
                new_dp = DataPoint(
                    dp_id=dp_data["dp_id"],
                    dp_code=dp_data["dp_code"],
                    name_ko=name_ko,
                    name_en=name_en,
                    description=dp_data.get("description"),
                    standard=dp_data["standard"],
                    category=dp_data["category"],
                    topic=dp_data.get("topic"),
                    subtopic=dp_data.get("subtopic"),
                    dp_type=dp_type_value,
                    unit=unit_value,
                    disclosure_requirement=disclosure_req_value,
                    reporting_frequency=dp_data.get("reporting_frequency"),
                    financial_impact_type=dp_data.get("financial_impact_type"),
                    value_range=dp_data.get("value_range"),
                    embedding=embedding,
                    embedding_text=embedding_text,
                    embedding_updated_at=datetime.now() if embedding else None,
                    is_active=True
                )
                
                try:
                    db.add(new_dp)
                    db.commit()  # 개별 커밋으로 중복 즉시 감지
                    saved_count += 1
                    logger.info(f"✅ DB 저장: {dp_data['dp_id']} - {dp_data['name_ko']}")
                except Exception as e:
                    db.rollback()  # 에러 발생 시 롤백
                    # 중복 키 에러인 경우 스킵
                    if "UniqueViolation" in str(e) or "duplicate key" in str(e).lower():
                        logger.warning(f"⚠️ 중복 DP 스킵 (dp_code={dp_data['dp_code']}, dp_id={dp_data['dp_id']})")
                        continue
                    else:
                        # 다른 에러는 다시 발생시킴
                        logger.error(f"❌ DP 저장 중 에러: {e}")
                        raise
            
            logger.info(f"✅ 총 {saved_count}개 DP 저장 완료")
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ DB 저장 실패: {e}")
            raise
        finally:
            db.close()
        
        return saved_count


def main():
    """메인 실행 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description="다양한 기준서에서 DP 추출")
    parser.add_argument(
        "pdf_path",
        type=str,
        help="PDF 파일 경로 (예: ./data/IFRS_S2.pdf)"
    )
    parser.add_argument(
        "--standard",
        type=str,
        default="IFRS_S2",
        choices=["IFRS_S1", "IFRS_S2", "GRI", "TCFD", "SASB"],
        help="기준서 코드"
    )
    parser.add_argument(
        "--parser",
        type=str,
        choices=["pymupdf", "llamaparse", "unstructured"],
        help="강제로 사용할 파서 (기본값: 기준서별 자동 선택)"
    )
    parser.add_argument(
        "--no-embeddings",
        action="store_true",
        help="임베딩 생성 안 함"
    )
    parser.add_argument(
        "--use-llm",
        action="store_true",
        help="LLM 보조 한국어 이름 추출 사용 (Groq API 필요, 비용 발생 가능)"
    )
    
    args = parser.parse_args()
    
    # PDF 파일 확인
    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        logger.error(f"❌ PDF 파일을 찾을 수 없습니다: {pdf_path}")
        return
    
    # 추출기 생성
    extractor = MultiStandardDPExtractor(use_llm=args.use_llm)
    
    # DP 추출
    logger.info(f"📄 PDF에서 DP 추출 시작: {pdf_path} (기준서: {args.standard})")
    dps = extractor.extract_dps(
        str(pdf_path), 
        args.standard,
        force_parser=args.parser
    )
    
    if not dps:
        logger.warning("⚠️ 추출된 DP가 없습니다.")
        return
    
    # DB 저장
    logger.info("💾 DB 저장 시작...")
    saved_count = extractor.save_dps_to_db(
        dps,
        generate_embeddings=not args.no_embeddings
    )
    
    logger.info(f"✅ 완료! {saved_count}개 DP 저장됨")


if __name__ == "__main__":
    main()
