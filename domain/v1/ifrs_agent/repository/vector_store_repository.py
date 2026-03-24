"""벡터 저장소 Repository (스텁)

document_chunks 테이블 제거에 따라 벡터 저장/검색 기능이 비활성화되었습니다.
호출부 호환을 위해 인터페이스만 유지하며, 모든 메서드는 빈 결과/0을 반환합니다.
"""
from typing import List, Dict, Optional, Tuple, Any
from loguru import logger
from sqlalchemy.orm import Session

from ifrs_agent.database.base import get_session


class VectorStoreRepository:
    """벡터 저장소 Repository (스텁)

    document_chunks 미사용. 저장/검색 호출 시 빈 결과만 반환합니다.
    """

    def __init__(self, db_session: Optional[Session] = None):
        self._db_session = db_session
        self._owns_session = db_session is None

    def _get_session(self) -> Session:
        if self._db_session:
            return self._db_session
        return get_session()

    def save_chunks(
        self,
        chunks: List[Any],
        deactivate_existing: bool = True
    ) -> int:
        """청크 저장 (미구현: 0 반환)"""
        logger.debug("vector_store_repository: save_chunks 스텁 (document_chunks 제거됨)")
        return 0

    def deactivate_document_chunks(self, document_path: str) -> int:
        """문서 청크 비활성화 (미구현: 0 반환)"""
        logger.debug("vector_store_repository: deactivate_document_chunks 스텁")
        return 0

    def search_by_vector(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        filters: Optional[Dict] = None,
        similarity_threshold: float = 0.0
    ) -> List[Tuple[Any, float]]:
        """벡터 유사도 검색 (미구현: 빈 리스트 반환)"""
        logger.debug("vector_store_repository: search_by_vector 스텁 (document_chunks 제거됨)")
        return []

    def get_chunks_by_document(
        self,
        document_path: str,
        active_only: bool = True
    ) -> List[Any]:
        """문서별 청크 조회 (미구현: 빈 리스트 반환)"""
        return []

    def get_chunk_by_id(self, chunk_id: int) -> Optional[Any]:
        """청크 ID로 조회 (미구현: None 반환)"""
        return None

    def delete_chunk(self, chunk_id: int) -> bool:
        """청크 삭제 (미구현: False 반환)"""
        return False
