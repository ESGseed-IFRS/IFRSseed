"""배치 임베딩 생성 스크립트

모든 테이블의 임베딩을 생성하거나 업데이트합니다.
제안 6개 테이블 구조 지원.

참고:
    이 스크립트의 핵심 기능은 Service 레이어로 이전되었습니다:
    - 임베딩 텍스트 생성: `ifrs_agent.service.embedding_text_service.EmbeddingTextService`
    - 임베딩 벡터 생성: `ifrs_agent.service.embedding_service.EmbeddingService`
    
    향후 리팩토링 시 이 스크립트는 Service 레이어를 사용하도록 수정될 수 있습니다.
"""
import sys
import os
from datetime import datetime
from typing import Optional

# 프로젝트 루트를 경로에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from FlagEmbedding import FlagModel
from ifrs_agent.database.base import get_session
from ifrs_agent.model.models import (
    DataPoint, Glossary,
    Rulebook, Standard,
    SynonymGlossary  # 하위 호환성
)
from ifrs_agent.utils.embedding_utils import (
    generate_data_point_embedding_text,
    generate_glossary_embedding_text,
    generate_rulebook_embedding_text,
    generate_standard_embedding_text
)
from sqlalchemy.sql import func
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def generate_all_embeddings(
    force_update: bool = False,
    since: Optional[datetime] = None
):
    """모든 테이블의 임베딩 생성
    
    Args:
        force_update: True이면 모든 레코드 재생성, False이면 임베딩이 없는 레코드만
        since: 이 날짜 이후 업데이트된 레코드만 재생성
    """
    # BGE-M3 모델 로드
    logger.info("임베딩 모델 로딩 중...")
    try:
        embedder = FlagModel('BAAI/bge-m3', use_fp16=True)
        logger.info("✅ 임베딩 모델 로드 완료")
    except Exception as e:
        logger.error(f"❌ 임베딩 모델 로드 실패: {e}")
        return
    
    db = get_session()
    
    try:
        # 1. data_points 테이블
        logger.info("=" * 60)
        logger.info("1. data_points 테이블 임베딩 생성 중...")
        query = db.query(DataPoint).filter(DataPoint.is_active == True)
        
        if not force_update and since:
            query = query.filter(DataPoint.updated_at >= since)
        elif not force_update:
            # 임베딩이 없거나 오래된 것만
            query = query.filter(
                (DataPoint.embedding == None) | 
                (DataPoint.embedding_updated_at < DataPoint.updated_at)
            )
        
        dps = query.all()
        logger.info(f"   처리할 레코드 수: {len(dps)}")
        
        for i, dp in enumerate(dps, 1):
            try:
                # 개선된 임베딩 텍스트 생성
                embedding_text = generate_data_point_embedding_text(dp)
                
                if not embedding_text.strip():
                    logger.warning(f"   [{i}/{len(dps)}] DP {dp.dp_id}: 임베딩 텍스트가 비어있음, 스킵")
                    continue
                
                # 임베딩 생성
                embedding_vector = embedder.encode([embedding_text], normalize_embeddings=True)
                
                # 벡터 변환
                if hasattr(embedding_vector, 'ndim') and embedding_vector.ndim > 1:
                    embedding = embedding_vector[0].tolist()
                elif hasattr(embedding_vector, '__len__') and len(embedding_vector) > 0:
                    if hasattr(embedding_vector[0], 'tolist'):
                        embedding = embedding_vector[0].tolist()
                    else:
                        embedding = list(embedding_vector[0])
                else:
                    embedding = embedding_vector.tolist() if hasattr(embedding_vector, 'tolist') else list(embedding_vector)
                
                # 저장
                dp.embedding = embedding
                dp.embedding_text = embedding_text
                dp.embedding_updated_at = func.now()
                
                if i % 10 == 0:
                    logger.info(f"   진행: {i}/{len(dps)}")
                    
            except Exception as e:
                logger.error(f"   [{i}/{len(dps)}] DP {dp.dp_id} 임베딩 생성 실패: {e}")
                continue
        
        logger.info(f"✅ data_points: {len(dps)}개 레코드 처리 완료")
        
        # 2. glossary 테이블 (기존 synonyms_glossary 대체)
        logger.info("=" * 60)
        logger.info("2. glossary 테이블 임베딩 생성 중...")
        query = db.query(Glossary).filter(Glossary.is_active == True)
        
        if not force_update and since:
            query = query.filter(Glossary.created_at >= since)
        elif not force_update:
            query = query.filter(
                (Glossary.term_embedding == None) |
                (Glossary.term_embedding_updated_at < Glossary.created_at)
            )
        
        terms = query.all()
        logger.info(f"   처리할 레코드 수: {len(terms)}")
        
        for i, term in enumerate(terms, 1):
            try:
                embedding_text = generate_glossary_embedding_text(term)
                
                if not embedding_text.strip():
                    logger.warning(f"   [{i}/{len(terms)}] Term {term.term_id}: 임베딩 텍스트가 비어있음, 스킵")
                    continue
                
                embedding_vector = embedder.encode([embedding_text], normalize_embeddings=True)
                
                if hasattr(embedding_vector, 'ndim') and embedding_vector.ndim > 1:
                    embedding = embedding_vector[0].tolist()
                elif hasattr(embedding_vector, '__len__') and len(embedding_vector) > 0:
                    if hasattr(embedding_vector[0], 'tolist'):
                        embedding = embedding_vector[0].tolist()
                    else:
                        embedding = list(embedding_vector[0])
                else:
                    embedding = embedding_vector.tolist() if hasattr(embedding_vector, 'tolist') else list(embedding_vector)
                
                term.term_embedding = embedding
                term.term_embedding_text = embedding_text
                term.term_embedding_updated_at = func.now()
                
                if i % 10 == 0:
                    logger.info(f"   진행: {i}/{len(terms)}")
                    
            except Exception as e:
                logger.error(f"   [{i}/{len(terms)}] Term {term.term_id} 임베딩 생성 실패: {e}")
                continue
        
        logger.info(f"✅ glossary: {len(terms)}개 레코드 처리 완료")
        
        # 3. rulebooks 테이블
        logger.info("=" * 60)
        logger.info("4. rulebooks 테이블 임베딩 생성 중...")
        query = db.query(Rulebook).filter(Rulebook.is_active == True)
        
        if not force_update and since:
            query = query.filter(Rulebook.updated_at >= since)
        elif not force_update:
            query = query.filter(
                (Rulebook.section_embedding == None) |
                (Rulebook.section_embedding_updated_at < Rulebook.updated_at)
            )
        
        rules = query.all()
        logger.info(f"   처리할 레코드 수: {len(rules)}")
        
        for i, rule in enumerate(rules, 1):
            try:
                embedding_text = generate_rulebook_embedding_text(rule)
                
                if not embedding_text.strip():
                    logger.warning(f"   [{i}/{len(rules)}] Rulebook {rule.rulebook_id}: 임베딩 텍스트가 비어있음, 스킵")
                    continue
                
                embedding_vector = embedder.encode([embedding_text], normalize_embeddings=True)
                
                if hasattr(embedding_vector, 'ndim') and embedding_vector.ndim > 1:
                    embedding = embedding_vector[0].tolist()
                elif hasattr(embedding_vector, '__len__') and len(embedding_vector) > 0:
                    if hasattr(embedding_vector[0], 'tolist'):
                        embedding = embedding_vector[0].tolist()
                    else:
                        embedding = list(embedding_vector[0])
                else:
                    embedding = embedding_vector.tolist() if hasattr(embedding_vector, 'tolist') else list(embedding_vector)
                
                rule.section_embedding = embedding
                rule.section_embedding_text = embedding_text
                rule.section_embedding_updated_at = func.now()
                
                if i % 10 == 0:
                    logger.info(f"   진행: {i}/{len(rules)}")
                    
            except Exception as e:
                logger.error(f"   [{i}/{len(rules)}] Rulebook {rule.rulebook_id} 임베딩 생성 실패: {e}")
                continue
        
        logger.info(f"✅ rulebooks: {len(rules)}개 레코드 처리 완료")
        
        # 4. standards 테이블
        logger.info("=" * 60)
        logger.info("4. standards 테이블 임베딩 생성 중...")
        query = db.query(Standard).filter(Standard.is_active == True)
        
        if not force_update and since:
            query = query.filter(Standard.updated_at >= since)
        elif not force_update:
            query = query.filter(
                (Standard.section_embedding == None) |
                (Standard.section_embedding_updated_at < Standard.updated_at)
            )
        
        standards = query.all()
        logger.info(f"   처리할 레코드 수: {len(standards)}")
        
        for i, std in enumerate(standards, 1):
            try:
                embedding_text = generate_standard_embedding_text(std)
                
                if not embedding_text.strip():
                    logger.warning(f"   [{i}/{len(standards)}] Standard {std.standard_id}: 임베딩 텍스트가 비어있음, 스킵")
                    continue
                
                embedding_vector = embedder.encode([embedding_text], normalize_embeddings=True)
                
                if hasattr(embedding_vector, 'ndim') and embedding_vector.ndim > 1:
                    embedding = embedding_vector[0].tolist()
                elif hasattr(embedding_vector, '__len__') and len(embedding_vector) > 0:
                    if hasattr(embedding_vector[0], 'tolist'):
                        embedding = embedding_vector[0].tolist()
                    else:
                        embedding = list(embedding_vector[0])
                else:
                    embedding = embedding_vector.tolist() if hasattr(embedding_vector, 'tolist') else list(embedding_vector)
                
                std.section_embedding = embedding
                std.section_embedding_text = embedding_text
                std.section_embedding_updated_at = func.now()
                
                if i % 10 == 0:
                    logger.info(f"   진행: {i}/{len(standards)}")
                    
            except Exception as e:
                logger.error(f"   [{i}/{len(standards)}] Standard {std.standard_id} 임베딩 생성 실패: {e}")
                continue
        
        logger.info(f"✅ standards: {len(standards)}개 레코드 처리 완료")
        
        # 커밋
        db.commit()
        logger.info("=" * 60)
        logger.info("✅ 모든 임베딩 생성 완료!")
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ 에러: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="배치 임베딩 생성 스크립트")
    parser.add_argument(
        "--force",
        action="store_true",
        help="모든 레코드의 임베딩을 강제로 재생성"
    )
    parser.add_argument(
        "--since",
        type=str,
        help="이 날짜 이후 업데이트된 레코드만 재생성 (YYYY-MM-DD 형식)"
    )
    
    args = parser.parse_args()
    
    since = None
    if args.since:
        try:
            since = datetime.strptime(args.since, "%Y-%m-%d")
        except ValueError:
            logger.error(f"날짜 형식 오류: {args.since}. YYYY-MM-DD 형식으로 입력하세요.")
            sys.exit(1)
    
    generate_all_embeddings(force_update=args.force, since=since)
