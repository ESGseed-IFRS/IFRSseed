"""
패턴 감지기: SR 본문에서 데이터 소스 유형 패턴 감지

뉴스/기사 인용 패턴과 계열사/사업장 언급 패턴을 분석하여
aggregation 데이터 소스 유형을 결정합니다.
"""
import re
from typing import Dict, Any


# 뉴스/기사 인용 패턴 (우선순위 순)
NEWS_PATTERNS = {
    r"인증\s*획득": 1.0,
    r"수상\s*내역": 1.0,
    r"장관상": 1.0,
    r"대통령상": 1.0,
    r"언론\s*보도": 0.9,
    r"기사\s*내용": 0.9,
    r"뉴스\s*기사": 0.9,
    r"보도\s*자료": 0.9,
    r"외부\s*평가": 0.8,
    r"제3자\s*검증": 0.8,
    r"미디어\s*커버리지": 0.7,
    r"외부\s*기관": 0.7,
    r"협약\s*체결": 0.6,
    r"업무\s*협약": 0.6,
    r"MOU": 0.6,
}

# 계열사/사업장 언급 패턴 (우선순위 순)
SUBSIDIARY_PATTERNS = {
    r"데이터센터": 1.0,
    r"데이터\s*센터": 1.0,
    r"사업장": 0.9,
    r"캠퍼스": 0.9,
    r"공장": 0.9,
    r"물류센터": 0.9,
    r"물류\s*센터": 0.9,
    r"연구소": 0.8,
    r"지사": 0.8,
    r"법인": 0.7,
    r"자회사": 0.9,
    r"계열사": 0.9,
    r"그룹사": 0.8,
    # 정량 데이터 패턴
    r"\d+[\s,]*kWh": 0.9,
    r"\d+[\s,]*MWh": 0.9,
    r"\d+[\s,]*GWh": 0.9,
    r"\d+[\s,]*tCO2eq": 0.9,
    r"\d+[\s,]*tCO2-eq": 0.9,
    r"\d+[\s,]*MW": 0.8,
    r"\d+[\s,]*kW": 0.8,
    r"발전량": 0.8,
    r"발전\s*용량": 0.8,
    r"절감량": 0.8,
    r"감축량": 0.8,
    r"증설": 0.7,
    r"준공": 0.7,
    r"구축": 0.7,
    r"설치": 0.7,
}

# 최소 신뢰도 임계값
MIN_CONFIDENCE = 0.3


def detect_data_source_patterns(body_text: str) -> Dict[str, Any]:
    """
    본문에서 데이터 소스 유형 패턴 감지.
    
    Args:
        body_text: SR 본문 텍스트
    
    Returns:
        {
            "has_news_citation": bool,
            "has_subsidiary_mention": bool,
            "news_pattern_count": int,
            "subsidiary_pattern_count": int,
            "news_score": float,
            "subsidiary_score": float,
            "confidence": float,
            "matched_news_patterns": List[str],
            "matched_subsidiary_patterns": List[str]
        }
    """
    if not body_text:
        return {
            "has_news_citation": False,
            "has_subsidiary_mention": False,
            "news_pattern_count": 0,
            "subsidiary_pattern_count": 0,
            "news_score": 0.0,
            "subsidiary_score": 0.0,
            "confidence": 0.0,
            "matched_news_patterns": [],
            "matched_subsidiary_patterns": []
        }
    
    # 뉴스 패턴 매칭
    news_matches = []
    news_score = 0.0
    for pattern, weight in NEWS_PATTERNS.items():
        if re.search(pattern, body_text, re.IGNORECASE):
            news_matches.append(pattern)
            news_score += weight
    
    # 계열사 패턴 매칭
    subsidiary_matches = []
    subsidiary_score = 0.0
    for pattern, weight in SUBSIDIARY_PATTERNS.items():
        if re.search(pattern, body_text, re.IGNORECASE):
            subsidiary_matches.append(pattern)
            subsidiary_score += weight
    
    # 정규화 (0~1 범위)
    news_score_normalized = min(1.0, news_score / 3.0)  # 3개 이상 매칭 시 1.0
    subsidiary_score_normalized = min(1.0, subsidiary_score / 3.0)
    
    # 전체 신뢰도 (두 스코어의 평균)
    confidence = (news_score_normalized + subsidiary_score_normalized) / 2
    
    return {
        "has_news_citation": len(news_matches) > 0,
        "has_subsidiary_mention": len(subsidiary_matches) > 0,
        "news_pattern_count": len(news_matches),
        "subsidiary_pattern_count": len(subsidiary_matches),
        "news_score": news_score_normalized,
        "subsidiary_score": subsidiary_score_normalized,
        "confidence": confidence,
        "matched_news_patterns": news_matches,
        "matched_subsidiary_patterns": subsidiary_matches
    }


def determine_source_type(patterns: Dict[str, Any]) -> str:
    """
    패턴 분석 결과를 기반으로 데이터 소스 유형 결정.
    
    Args:
        patterns: detect_data_source_patterns() 결과
    
    Returns:
        "external_only" | "subsidiary_only" | "both" | "skip"
    """
    has_news = patterns["has_news_citation"]
    has_subsidiary = patterns["has_subsidiary_mention"]
    confidence = patterns["confidence"]
    
    # 신뢰도가 너무 낮으면 skip
    if confidence < MIN_CONFIDENCE:
        return "skip"
    
    # 둘 다 있으면 스코어 비교
    if has_news and has_subsidiary:
        news_score = patterns["news_score"]
        subsidiary_score = patterns["subsidiary_score"]
        
        # 스코어 차이가 크면 우세한 쪽만
        if abs(news_score - subsidiary_score) > 0.3:
            return "external_only" if news_score > subsidiary_score else "subsidiary_only"
        
        # 비슷하면 둘 다
        return "both"
    
    # 하나만 있으면 해당 유형
    if has_news:
        return "external_only"
    if has_subsidiary:
        return "subsidiary_only"
    
    # 둘 다 없으면 skip
    return "skip"
