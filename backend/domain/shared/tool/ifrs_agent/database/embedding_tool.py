"""
임베딩 생성 툴

BGE-M3 모델을 사용한 텍스트 임베딩
"""
import logging
from typing import Dict, Any, List, Optional
from functools import lru_cache

logger = logging.getLogger("ifrs_agent.tools.embedding")

_model_cache: Optional[Any] = None


@lru_cache(maxsize=1)
def _get_embedding_model(model_name: str = "BAAI/bge-m3"):
    """
    BGE-M3 임베딩 모델 싱글톤 로더
    
    Args:
        model_name: 모델 이름 (기본 BAAI/bge-m3)
    
    Returns:
        SentenceTransformer: 로드된 모델
    """
    try:
        from sentence_transformers import SentenceTransformer
        
        logger.info(f"Loading embedding model: {model_name}")
        model = SentenceTransformer(model_name)
        logger.info(f"Embedding model loaded successfully: {model_name}")
        
        return model
    
    except ImportError:
        logger.error(
            "sentence-transformers not installed. Install with: pip install sentence-transformers"
        )
        raise
    except Exception as e:
        logger.error(f"Failed to load embedding model {model_name}: {e}", exc_info=True)
        raise


async def embed_text(params: Dict[str, Any]) -> List[float]:
    """
    BGE-M3 임베딩 생성
    
    Args:
        params: {
            "text": str,
            "embedding_model": str  # 선택, Settings.embedding_model 과 동일 권장
        }
    
    Returns:
        List[float]: 1024차원 임베딩 벡터
    """
    text = params["text"]
    model_name = params.get("embedding_model") or "BAAI/bge-m3"

    logger.info("embed_text: text_length=%s, model=%s", len(text), model_name)
    
    try:
        # BGE-M3 모델 로드 (싱글톤)
        model = _get_embedding_model(model_name)
        
        # 임베딩 생성 (normalize_embeddings=True로 코사인 유사도 최적화)
        embedding = model.encode(
            text,
            normalize_embeddings=True,
            show_progress_bar=False
        )
        
        # numpy array → list 변환
        embedding_list = embedding.tolist()
        
        logger.debug(f"embed_text success: dimension={len(embedding_list)}")
        
        return embedding_list
    
    except Exception as e:
        logger.error(f"embed_text failed: {e}", exc_info=True)
        raise

