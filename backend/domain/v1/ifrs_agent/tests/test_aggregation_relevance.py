"""
aggregation_node 관련성 기반 검색 테스트

패턴 감지, 관련성 분석, 임베딩 생성 테스트
"""
import pytest
from backend.domain.v1.ifrs_agent.spokes.agents.aggregation_node.pattern_detector import (
    detect_data_source_patterns,
    determine_source_type,
)
from backend.domain.v1.ifrs_agent.spokes.agents.aggregation_node.relevance_analyzer import (
    build_relevance_query_text,
)


class TestPatternDetector:
    """패턴 감지 테스트"""
    
    def test_news_pattern_detection(self):
        """뉴스 패턴 감지 테스트"""
        body_text = """
        삼성SDS는 보건복지부 건강친화기업 인증을 획득하였으며,
        관련 성과를 부서장 평가에도 반영하고 있습니다.
        """
        
        patterns = detect_data_source_patterns(body_text)
        
        assert patterns["has_news_citation"] is True
        assert patterns["news_pattern_count"] > 0
        assert "인증\\s*획득" in patterns["matched_news_patterns"]
    
    def test_subsidiary_pattern_detection(self):
        """계열사 패턴 감지 테스트"""
        body_text = """
        동탄 데이터센터는 준공 시 건물 옥상에 352kW 태양광 발전설비를 구축하였습니다.
        2024년 7월 동탄 데이터센터 옥상 및 주차장에 태양광 발전설비 374kW를 추가 증설하여
        재생에너지 발전용량이 최대 726kW로 증가하였습니다.
        기존 태양광 발전설비에서는 연간 389,584kWh를 발전하였습니다.
        """
        
        patterns = detect_data_source_patterns(body_text)
        
        assert patterns["has_subsidiary_mention"] is True
        assert patterns["subsidiary_pattern_count"] > 0
        assert "데이터센터" in patterns["matched_subsidiary_patterns"]
    
    def test_both_patterns(self):
        """뉴스 + 계열사 패턴 동시 감지"""
        body_text = """
        삼성SDS는 보건복지부 건강친화기업 인증을 획득하였습니다.
        동탄 데이터센터는 연간 389,584kWh를 발전하였습니다.
        """
        
        patterns = detect_data_source_patterns(body_text)
        
        assert patterns["has_news_citation"] is True
        assert patterns["has_subsidiary_mention"] is True
    
    def test_no_patterns(self):
        """패턴 없음"""
        body_text = """
        당사는 인적자본 관리를 위해 다양한 정책을 운영하고 있습니다.
        """
        
        patterns = detect_data_source_patterns(body_text)
        
        assert patterns["has_news_citation"] is False
        assert patterns["has_subsidiary_mention"] is False
        assert patterns["confidence"] < 0.3
    
    def test_determine_source_type_external_only(self):
        """소스 유형 결정: external_only"""
        patterns = {
            "has_news_citation": True,
            "has_subsidiary_mention": False,
            "news_score": 0.8,
            "subsidiary_score": 0.0,
            "confidence": 0.4
        }
        
        source_type = determine_source_type(patterns)
        assert source_type == "external_only"
    
    def test_determine_source_type_subsidiary_only(self):
        """소스 유형 결정: subsidiary_only"""
        patterns = {
            "has_news_citation": False,
            "has_subsidiary_mention": True,
            "news_score": 0.0,
            "subsidiary_score": 0.9,
            "confidence": 0.45
        }
        
        source_type = determine_source_type(patterns)
        assert source_type == "subsidiary_only"
    
    def test_determine_source_type_both(self):
        """소스 유형 결정: both"""
        patterns = {
            "has_news_citation": True,
            "has_subsidiary_mention": True,
            "news_score": 0.7,
            "subsidiary_score": 0.8,
            "confidence": 0.75
        }
        
        source_type = determine_source_type(patterns)
        assert source_type == "both"
    
    def test_determine_source_type_skip(self):
        """소스 유형 결정: skip (신뢰도 낮음)"""
        patterns = {
            "has_news_citation": False,
            "has_subsidiary_mention": False,
            "news_score": 0.0,
            "subsidiary_score": 0.0,
            "confidence": 0.1
        }
        
        source_type = determine_source_type(patterns)
        assert source_type == "skip"


class TestRelevanceAnalyzer:
    """관련성 분석 테스트"""
    
    def test_build_relevance_query_text(self):
        """관련성 쿼리 텍스트 생성"""
        dp_metadata = {
            "unified_column_id": "UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i",
            "column_name_ko": "문단 13: 인센티브 제도에 기후 고려 반영 여부·방법",
            "column_description": "행정·경영·감독 기관 구성원 보수에 기후 고려 사항이 반영되는지와 방법을 공개합니다.",
            "column_topic": "거버넌스",
            "column_subtopic": "GOV-3"
        }
        
        sr_context = {
            "toc_path": ["ESG PERFORMANCE", "GOVERNANCE", "기후변화 거버넌스"],
            "subtitle": "기후 관련 인센티브"
        }
        
        query_text = build_relevance_query_text(dp_metadata, sr_context)
        
        assert "인센티브" in query_text
        assert "거버넌스" in query_text
        assert "기후" in query_text
        assert len(query_text) > 0
    
    def test_build_relevance_query_text_minimal(self):
        """최소 정보로 쿼리 텍스트 생성"""
        dp_metadata = {
            "column_name_ko": "재생에너지 사용량"
        }
        
        sr_context = {}
        
        query_text = build_relevance_query_text(dp_metadata, sr_context)
        
        assert "재생에너지" in query_text
        assert len(query_text) > 0


@pytest.mark.asyncio
class TestIntegration:
    """통합 테스트 (DB 연결 필요)"""
    
    @pytest.mark.skip(reason="DB 연결 필요")
    async def test_full_relevance_pipeline(self):
        """전체 관련성 파이프라인 테스트"""
        from backend.domain.v1.ifrs_agent.spokes.agents.aggregation_node.relevance_analyzer import (
            analyze_prior_year_body,
            build_relevance_query_embedding,
        )
        
        # 1. 전년도 SR 본문 분석
        prior_analysis = await analyze_prior_year_body(
            company_id="550e8400-e29b-41d4-a716-446655440001",
            dp_id="UCM_ESRSE1_GOV_3_13__IFRS2_29_g_i",
            year=2024,
            toc_path=["ESG PERFORMANCE", "GOVERNANCE", "기후변화 거버넌스"],
            subtitle="기후 관련 인센티브"
        )
        
        assert prior_analysis["source_type"] in ["external_only", "subsidiary_only", "both", "skip"]
        
        # 2. 관련성 임베딩 생성
        if prior_analysis["source_type"] != "skip":
            dp_metadata = {
                "column_name_ko": "문단 13: 인센티브 제도에 기후 고려 반영 여부·방법",
                "column_description": "행정·경영·감독 기관 구성원 보수에 기후 고려 사항이...",
                "column_topic": "거버넌스",
                "column_subtopic": "GOV-3"
            }
            
            sr_context = {
                "toc_path": ["ESG PERFORMANCE", "GOVERNANCE", "기후변화 거버넌스"],
                "subtitle": "기후 관련 인센티브"
            }
            
            embedding = await build_relevance_query_embedding(dp_metadata, sr_context)
            
            assert isinstance(embedding, list)
            assert len(embedding) == 1024  # BGE-M3 차원


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
