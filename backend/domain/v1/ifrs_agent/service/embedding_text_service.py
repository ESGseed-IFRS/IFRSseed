"""임베딩 텍스트 생성 서비스

각 테이블의 컬럼들을 종합적으로 결합하여 임베딩 텍스트를 생성하는 서비스입니다.
제안 6개 테이블 구조 지원.
"""
from typing import Any, Dict, List, Union
from backend.domain.v1.esg_data.models.bases import (
    DataPoint,
    Glossary,
    Rulebook,
    Standard,
    SynonymGlossary,
    UnifiedColumnMapping,
)


class EmbeddingTextService:
    """임베딩 텍스트 생성 서비스
    
    각 모델의 컬럼들을 종합하여 임베딩 생성에 사용할 텍스트를 생성합니다.
    """
    
    def generate_data_point_text(self, dp: DataPoint) -> str:
        """DataPoint 임베딩 텍스트: 이름·설명·주제 축만 사용 (UCM 1차 의미 검색용).

        타입·단위·공시·검증 규칙 등은 구조/규칙 점수 쪽에서 다루도록 임베딩에서 제외한다.
        """
        parts = []
        parts.append(dp.name_ko)
        parts.append(dp.name_en)
        if dp.description:
            parts.append(dp.description)
        if dp.topic:
            parts.append(dp.topic)
        if dp.subtopic:
            parts.append(dp.subtopic)
        embedding_text = " ".join(parts)
        embedding_text = " ".join(embedding_text.split())
        return embedding_text
    
    def generate_data_point_text_from_dict(self, dp_data: Dict[str, Any]) -> str:
        """`generate_data_point_text`와 동일 축: name_ko, name_en, description, topic, subtopic."""
        parts: List[str] = []
        parts.append(dp_data.get("name_ko", "") or "")
        parts.append(dp_data.get("name_en", "") or "")
        if dp_data.get("description"):
            parts.append(str(dp_data["description"]))
        if dp_data.get("topic"):
            parts.append(str(dp_data["topic"]))
        if dp_data.get("subtopic"):
            parts.append(str(dp_data["subtopic"]))
        embedding_text = " ".join(parts)
        embedding_text = " ".join(embedding_text.split())
        return embedding_text
    
    def generate_glossary_text(self, term: Union[Glossary, SynonymGlossary]) -> str:
        """Glossary/SynonymGlossary 테이블의 포괄적인 임베딩 텍스트 생성
        
        Args:
            term: Glossary 또는 SynonymGlossary 객체
        
        Returns:
            임베딩 생성에 사용될 텍스트
        """
        parts = []
        
        # 1. 핵심 용어 정보
        parts.append(term.term_ko)
        if term.term_en:
            parts.append(term.term_en)
        
        # 2. 정의 (Glossary에만 있음)
        if hasattr(term, 'definition_ko') and term.definition_ko:
            parts.append(term.definition_ko)
        if hasattr(term, 'definition_en') and term.definition_en:
            parts.append(term.definition_en)
        
        # 3. 기준서 정보
        if term.standard:
            parts.append(term.standard)
        
        # 4. 카테고리 (Glossary에만 있음)
        if hasattr(term, 'category') and term.category:
            parts.append(term.category)
        
        # 5. 관련 DP 정보 (간단히)
        if term.related_dps:
            parts.append(f"관련_DP: {len(term.related_dps)}개")
        
        # 6. 출처 (Glossary에만 있음)
        if hasattr(term, 'source') and term.source:
            parts.append(f"출처: {term.source}")
        
        # 결합 및 정리
        embedding_text = " ".join(parts)
        embedding_text = " ".join(embedding_text.split())
        
        return embedding_text
    
    # 하위 호환성을 위한 별칭
    def generate_synonym_text(self, term: SynonymGlossary) -> str:
        """SynonymGlossary 임베딩 텍스트 생성 (하위 호환성)"""
        return self.generate_glossary_text(term)
    
    def generate_rulebook_text(self, rule: Rulebook) -> str:
        """Rulebook 테이블의 포괄적인 임베딩 텍스트 생성
        
        Args:
            rule: Rulebook 객체
        
        Returns:
            임베딩 생성에 사용될 텍스트
        """
        parts = []
        
        # 1. 섹션 정보
        if rule.section_name:
            parts.append(rule.section_name)
        if rule.standard_id:
            parts.append(rule.standard_id)
        
        # 2. 규칙 제목 및 내용 (핵심)
        if hasattr(rule, 'rulebook_title') and rule.rulebook_title:
            parts.append(rule.rulebook_title)
        if hasattr(rule, 'rulebook_content') and rule.rulebook_content:
            parts.append(rule.rulebook_content)
        
        # 3. 문단 참조
        if hasattr(rule, 'paragraph_reference') and rule.paragraph_reference:
            parts.append(f"문단: {rule.paragraph_reference}")
        
        # 4. 공시 요구사항
        if hasattr(rule, 'disclosure_requirement') and rule.disclosure_requirement:
            parts.append(str(rule.disclosure_requirement))
        
        # 5. 핵심 용어
        if hasattr(rule, 'key_terms') and rule.key_terms:
            parts.extend(rule.key_terms)
        
        # 6. 관련 개념
        if hasattr(rule, 'related_concepts') and rule.related_concepts:
            parts.extend(rule.related_concepts)
        
        # 7. 검증 규칙
        if rule.validation_rules:
            if isinstance(rule.validation_rules, dict):
                for key, value in rule.validation_rules.items():
                    if value:
                        parts.append(f"{key}: {value}")
            elif isinstance(rule.validation_rules, list):
                parts.extend([str(r) for r in rule.validation_rules])
            else:
                parts.append(str(rule.validation_rules))
        
        # 결합 및 정리
        embedding_text = " ".join(parts)
        embedding_text = " ".join(embedding_text.split())
        
        return embedding_text
    
    def generate_standard_text(self, std: Standard) -> str:
        """Standard 테이블의 포괄적인 임베딩 텍스트 생성
        
        Args:
            std: Standard 객체
        
        Returns:
            임베딩 생성에 사용될 텍스트
        """
        parts = []
        
        # 1. 기준서 정보
        if std.standard_id:
            parts.append(std.standard_id)
        if std.standard_name:
            parts.append(std.standard_name)
        if std.version:
            parts.append(f"버전: {std.version}")
        
        # 2. 섹션 정보
        if std.section_name:
            parts.append(std.section_name)
        if std.section_type:
            parts.append(std.section_type)
        if std.paragraph_reference:
            parts.append(f"문단: {std.paragraph_reference}")
        
        # 3. 섹션 내용 (핵심)
        if std.section_content:
            parts.append(std.section_content)
        
        # 4. 핵심 용어
        if std.key_terms:
            parts.extend(std.key_terms)
        
        # 5. 관련 개념
        if std.related_concepts:
            parts.extend(std.related_concepts)
        
        # 6. 검증 규칙
        if std.validation_rules:
            if isinstance(std.validation_rules, dict):
                for key, value in std.validation_rules.items():
                    if value:
                        parts.append(f"{key}: {value}")
            elif isinstance(std.validation_rules, list):
                parts.extend([str(r) for r in std.validation_rules])
            else:
                parts.append(str(std.validation_rules))
        
        # 결합 및 정리
        embedding_text = " ".join(parts)
        embedding_text = " ".join(embedding_text.split())
        
        return embedding_text
    
    def generate_unified_mapping_text(self, mapping: UnifiedColumnMapping) -> str:
        """UnifiedColumnMapping 테이블의 포괄적인 임베딩 텍스트 생성
        
        Args:
            mapping: UnifiedColumnMapping 객체
        
        Returns:
            임베딩 생성에 사용될 텍스트
        """
        parts = []
        
        # 1. 기본 정보
        parts.append(mapping.column_name_ko)
        parts.append(mapping.column_name_en)
        if mapping.column_description:
            parts.append(mapping.column_description)
        
        # 2. 분류 정보
        if mapping.column_category:
            category_map = {"E": "환경 Environment", "S": "사회 Social", "G": "지배구조 Governance"}
            parts.append(category_map.get(mapping.column_category, mapping.column_category))
        if mapping.column_topic:
            parts.append(mapping.column_topic)
        if mapping.column_subtopic:
            parts.append(mapping.column_subtopic)
        
        # 3. 기준서/Rulebook 연결
        if mapping.primary_standard:
            parts.append(mapping.primary_standard)
        if mapping.applicable_standards:
            parts.extend(mapping.applicable_standards)
        
        # 4. 데이터 타입
        if mapping.column_type:
            parts.append(str(mapping.column_type))
        if mapping.unit:
            parts.append(mapping.unit)
        
        # 5. 공시 요구사항
        if mapping.disclosure_requirement:
            parts.append(str(mapping.disclosure_requirement))
        if mapping.reporting_frequency:
            parts.append(mapping.reporting_frequency)
        
        # 6. 재무 연결
        if mapping.financial_linkages:
            parts.extend(mapping.financial_linkages)
        if mapping.financial_impact_type:
            parts.append(f"재무영향: {mapping.financial_impact_type}")
        
        # 7. 매핑 메모
        if mapping.mapping_notes:
            parts.append(mapping.mapping_notes)
        
        # 결합 및 정리
        embedding_text = " ".join(parts)
        embedding_text = " ".join(embedding_text.split())
        
        return embedding_text
