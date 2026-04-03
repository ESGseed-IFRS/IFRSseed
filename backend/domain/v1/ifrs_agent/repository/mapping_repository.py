"""매핑 Repository (Deprecated)

⚠️ 이 모듈은 Deprecated입니다.
StandardMapping 테이블이 제거되었으며, 매핑 기능은 다음으로 대체되었습니다:
- UnifiedColumnMapping: 통합 컬럼 매핑
- Rulebook: 기준서별 공시 요구사항

새로운 코드는 UnifiedColumnMappingRepository 또는 RulebookRepository를 사용하세요.
"""
import warnings
from typing import List, Optional
from loguru import logger
from sqlalchemy.orm import Session

from ifrs_agent.model.models import DataPoint


def _warn_deprecated():
    warnings.warn(
        "MappingRepository는 deprecated입니다. "
        "StandardMapping 테이블이 제거되었으며, "
        "UnifiedColumnMapping 또는 Rulebook을 사용하세요.",
        DeprecationWarning,
        stacklevel=3
    )


class MappingRepository:
    """매핑 Repository (Deprecated)
    
    ⚠️ StandardMapping 테이블이 제거되어 이 Repository는 더 이상 사용되지 않습니다.
    """
    
    def __init__(self, db_session: Session):
        """Repository 초기화
        
        Args:
            db_session: DB 세션
        """
        _warn_deprecated()
        self.db = db_session
    
    def get_pending_data_points(
        self,
        source_standard: str,
        limit: int = 100
    ) -> List[DataPoint]:
        """pending 상태의 DataPoint 조회 (Deprecated)
        
        Args:
            source_standard: 원본 기준서
            limit: 최대 개수
        
        Returns:
            DataPoint 리스트
        """
        _warn_deprecated()
        return self.db.query(DataPoint).filter(
            DataPoint.standard == source_standard,
            DataPoint.is_active == True,
            DataPoint.embedding.isnot(None)
        ).limit(limit).all()
    
    def find_existing_mapping(
        self,
        source_dp_id: str,
        target_dp_id: str
    ) -> Optional[object]:
        """기존 매핑 찾기 (Deprecated - 항상 None 반환)
        
        Args:
            source_dp_id: 원본 DP ID
            target_dp_id: 대상 DP ID
        
        Returns:
            항상 None (테이블이 제거됨)
        """
        _warn_deprecated()
        logger.warning("StandardMapping 테이블이 제거되어 find_existing_mapping은 항상 None을 반환합니다.")
        return None
    
    def create_mapping(
        self,
        mapping_id: str,
        source_standard: str,
        source_dp: str,
        target_standard: str,
        target_dp: str,
        mapping_type: str,
        confidence: float,
        notes: str
    ) -> None:
        """새 매핑 생성 (Deprecated - 작업 수행 안함)
        
        Args:
            mapping_id: 매핑 ID
            source_standard: 원본 기준서
            source_dp: 원본 DP ID
            target_standard: 대상 기준서
            target_dp: 대상 DP ID
            mapping_type: 매핑 타입
            confidence: 신뢰도
            notes: 메모
        
        Returns:
            None (테이블이 제거됨)
        """
        _warn_deprecated()
        logger.warning("StandardMapping 테이블이 제거되어 create_mapping은 작업을 수행하지 않습니다.")
        logger.info("대신 UnifiedColumnMapping을 사용하여 매핑을 관리하세요.")
        return None
    
    def update_mapping(
        self,
        mapping: object,
        mapping_type: str,
        confidence: float,
        notes: str
    ) -> None:
        """기존 매핑 업데이트 (Deprecated - 작업 수행 안함)
        
        Args:
            mapping: 업데이트할 매핑
            mapping_type: 새로운 매핑 타입
            confidence: 새로운 신뢰도
            notes: 새로운 메모
        
        Returns:
            None (테이블이 제거됨)
        """
        _warn_deprecated()
        logger.warning("StandardMapping 테이블이 제거되어 update_mapping은 작업을 수행하지 않습니다.")
        return None
    
    def commit(self):
        """변경사항 커밋"""
        self.db.commit()
    
    def rollback(self):
        """변경사항 롤백"""
        self.db.rollback()
