"""GRI synonyms_glossary.json 데이터를 synonyms_glossary 테이블에 로드하고 임베딩을 생성하는 스크립트

이 스크립트는 다음 작업을 수행합니다:
1. ai/ifrs_agent/data/gri/synonyms_glossary.json 파일에서 용어 데이터를 읽어옴
2. EmbeddingTextService를 사용하여 임베딩 텍스트 생성
3. EmbeddingService를 사용하여 벡터 임베딩 생성
4. synonyms_glossary 테이블에 데이터 저장 (upsert 방식)

사용법:
    python load_gri_synonyms_glossary.py
    python load_gri_synonyms_glossary.py --force  # 기존 데이터 덮어쓰기
    python load_gri_synonyms_glossary.py --dry-run  # 실제 저장 없이 테스트
"""
import sys
import os
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
import argparse

# 프로젝트 루트를 경로에 추가
script_dir = Path(__file__).parent.resolve()
project_root = script_dir.parent.parent  # ai/ 디렉토리
sys.path.insert(0, str(project_root))

# .env 파일 로드
from dotenv import load_dotenv
env_path = project_root.parent / ".env"  # ifrsseed/.env
if env_path.exists():
    load_dotenv(env_path)

import psycopg2
from psycopg2.extras import execute_values, Json
import numpy as np


def get_logger():
    """간단한 로거 설정"""
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s | %(levelname)-8s | %(message)s',
        datefmt='%H:%M:%S'
    )
    return logging.getLogger(__name__)


logger = get_logger()


def get_db_connection():
    """데이터베이스 연결"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL 환경 변수가 설정되지 않았습니다")
    
    # psycopg2 연결
    conn = psycopg2.connect(database_url)
    return conn


def load_synonyms_glossary_json() -> List[Dict[str, Any]]:
    """synonyms_glossary.json 파일에서 용어 데이터 로드
    
    Returns:
        용어 딕셔너리 리스트
    """
    # 파일 경로 설정
    json_path = script_dir.parent / "data" / "gri" / "synonyms_glossary.json"
    
    if not json_path.exists():
        logger.error(f"synonyms_glossary.json 파일을 찾을 수 없습니다: {json_path}")
        raise FileNotFoundError(f"synonyms_glossary.json not found at {json_path}")
    
    logger.info(f"synonyms_glossary.json 파일 로드 중: {json_path}")
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # terms 키에서 데이터 추출
    if isinstance(data, dict) and "terms" in data:
        terms = data["terms"]
    elif isinstance(data, list):
        terms = data
    else:
        logger.error("synonyms_glossary.json 형식이 올바르지 않습니다")
        raise ValueError("Invalid synonyms_glossary.json format")
    
    logger.info(f"{len(terms)}개의 용어 로드 완료")
    return terms


def generate_embedding_text(term_data: Dict[str, Any]) -> str:
    """용어 딕셔너리에서 임베딩 텍스트 생성
    
    임베딩 텍스트는 다음을 포함합니다:
    - term_ko (한글 용어)
    - term_en (영문 용어)
    - description (설명)
    - standard (표준)
    - paragraph_reference (단락 참조)
    - related_dps (관련 DP 개수 정보)
    """
    parts = []
    
    # 1. 핵심 정보
    if term_data.get("term_ko"):
        parts.append(term_data["term_ko"])
    if term_data.get("term_en"):
        parts.append(term_data["term_en"])
    
    # 2. 설명
    if term_data.get("description"):
        parts.append(term_data["description"])
    
    # 3. 표준 정보
    if term_data.get("standard"):
        parts.append(f"표준: {term_data['standard']}")
    
    # 4. 단락 참조
    if term_data.get("paragraph_reference"):
        parts.append(f"참조: {term_data['paragraph_reference']}")
    
    # 5. 관련 DP 정보
    related_dps = term_data.get("related_dps", [])
    if related_dps:
        parts.append(f"관련 데이터포인트: {len(related_dps)}개")
        # 관련 DP ID들도 포함
        parts.extend(related_dps)
    
    # 결합 및 정리
    embedding_text = " ".join(parts)
    embedding_text = " ".join(embedding_text.split())
    
    return embedding_text


def load_embedding_model():
    """임베딩 모델 로드 (여러 방식 시도)"""
    # 방법 1: FlagEmbedding 시도
    try:
        from FlagEmbedding import FlagModel
        embedder = FlagModel('BAAI/bge-m3', use_fp16=True)
        logger.info("FlagEmbedding 모델 로드 완료")
        return embedder, "flag"
    except Exception as e:
        logger.warning(f"FlagEmbedding 로드 실패: {e}")
    
    # 방법 2: sentence-transformers 시도
    try:
        from sentence_transformers import SentenceTransformer
        embedder = SentenceTransformer('BAAI/bge-m3')
        logger.info("SentenceTransformer 모델 로드 완료")
        return embedder, "sentence"
    except Exception as e:
        logger.warning(f"SentenceTransformer 로드 실패: {e}")
    
    # 방법 3: HuggingFace transformers 직접 사용
    try:
        from transformers import AutoTokenizer, AutoModel
        import torch
        
        tokenizer = AutoTokenizer.from_pretrained('BAAI/bge-m3')
        model = AutoModel.from_pretrained('BAAI/bge-m3')
        model.eval()
        
        logger.info("HuggingFace Transformers 모델 로드 완료")
        return (tokenizer, model), "transformers"
    except Exception as e:
        logger.warning(f"Transformers 로드 실패: {e}")
    
    raise RuntimeError("임베딩 모델을 로드할 수 없습니다. FlagEmbedding, sentence-transformers, 또는 transformers를 설치하세요.")


def generate_embedding_with_model(embedder, model_type: str, text: str) -> List[float]:
    """모델 타입에 따라 임베딩 생성"""
    if model_type == "flag":
        embedding_vector = embedder.encode([text])
        if hasattr(embedding_vector, 'ndim') and embedding_vector.ndim > 1:
            embedding = embedding_vector[0]
        else:
            embedding = embedding_vector[0] if len(embedding_vector) > 0 else embedding_vector
    
    elif model_type == "sentence":
        embedding = embedder.encode(text, normalize_embeddings=True)
    
    elif model_type == "transformers":
        import torch
        tokenizer, model = embedder
        
        inputs = tokenizer(text, return_tensors='pt', truncation=True, max_length=512)
        with torch.no_grad():
            outputs = model(**inputs)
        
        # CLS 토큰 임베딩 사용
        embedding = outputs.last_hidden_state[:, 0, :].squeeze().numpy()
    
    else:
        raise ValueError(f"알 수 없는 모델 타입: {model_type}")
    
    # L2 정규화
    if isinstance(embedding, np.ndarray):
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        return embedding.tolist()
    
    return list(embedding)


def check_existing_term(cursor, term_ko: str, term_en: str, standard: str) -> Optional[int]:
    """기존 용어 존재 여부 확인 및 term_id 반환"""
    cursor.execute(
        """
        SELECT term_id FROM synonyms_glossary 
        WHERE term_ko = %s AND term_en = %s AND standard = %s
        """,
        (term_ko, term_en, standard)
    )
    result = cursor.fetchone()
    return result[0] if result else None


def insert_term(cursor, term_record: Dict[str, Any]):
    """용어 삽입"""
    columns = list(term_record.keys())
    values = []
    
    for col in columns:
        val = term_record[col]
        if col == "term_embedding":
            # pgvector 형식으로 변환
            values.append(val)
        elif col == "related_dps":
            values.append(val if val else None)
        else:
            values.append(val)
    
    placeholders = []
    for col in columns:
        if col == "term_embedding":
            placeholders.append("%s::vector")
        else:
            placeholders.append("%s")
    
    sql = f"""
        INSERT INTO synonyms_glossary ({', '.join(columns)})
        VALUES ({', '.join(placeholders)})
    """
    
    cursor.execute(sql, values)


def update_term(cursor, term_id: int, term_record: Dict[str, Any]):
    """용어 업데이트"""
    set_clauses = []
    values = []
    
    for col, val in term_record.items():
        if col == "term_id":
            continue
        
        if col == "term_embedding":
            set_clauses.append(f"{col} = %s::vector")
            values.append(val)
        elif col == "related_dps":
            set_clauses.append(f"{col} = %s")
            values.append(val if val else None)
        else:
            set_clauses.append(f"{col} = %s")
            values.append(val)
    
    set_clauses.append("term_embedding_updated_at = NOW()")
    values.append(term_id)
    
    sql = f"""
        UPDATE synonyms_glossary
        SET {', '.join(set_clauses)}
        WHERE term_id = %s
    """
    
    cursor.execute(sql, values)


def load_terms_to_db(
    terms: List[Dict[str, Any]],
    force_update: bool = False,
    dry_run: bool = False,
    batch_size: int = 10
) -> Dict[str, int]:
    """용어를 데이터베이스에 저장"""
    stats = {"inserted": 0, "updated": 0, "skipped": 0, "errors": 0}
    
    if dry_run:
        logger.info("Dry-run 모드: 실제 데이터베이스 저장 없음")
    
    # 임베딩 모델 로드
    logger.info("임베딩 모델 로딩 중...")
    try:
        embedder, model_type = load_embedding_model()
    except Exception as e:
        logger.error(f"임베딩 모델 로드 실패: {e}")
        raise
    
    # 데이터베이스 연결
    if not dry_run:
        conn = get_db_connection()
        cursor = conn.cursor()
    else:
        conn = None
        cursor = None
    
    try:
        total = len(terms)
        logger.info(f"총 {total}개 용어 처리 시작")
        
        for i, term_data in enumerate(terms, 1):
            term_ko = term_data.get("term_ko", "")
            term_en = term_data.get("term_en", "")
            standard = term_data.get("standard", "")
            
            try:
                # 1. 기존 레코드 확인
                existing_term_id = None
                if cursor and not force_update:
                    existing_term_id = check_existing_term(cursor, term_ko, term_en, standard)
                    if existing_term_id:
                        logger.debug(f"[{i}/{total}] {term_ko}: 이미 존재, 스킵")
                        stats["skipped"] += 1
                        continue
                elif cursor:
                    existing_term_id = check_existing_term(cursor, term_ko, term_en, standard)
                
                # 2. 임베딩 텍스트 생성
                embedding_text = generate_embedding_text(term_data)
                
                if not embedding_text.strip():
                    logger.warning(f"[{i}/{total}] {term_ko}: 임베딩 텍스트가 비어있음")
                    embedding_text = f"{term_ko} {term_en}"
                
                # 3. 임베딩 벡터 생성
                embedding_list = generate_embedding_with_model(embedder, model_type, embedding_text)
                
                # 4. 데이터 매핑
                term_record = {
                    "term_ko": term_ko,
                    "term_en": term_en,
                    "standard": standard,
                    "related_dps": term_data.get("related_dps", []),
                    "is_active": True,
                    "term_embedding": embedding_list,
                    "term_embedding_text": embedding_text
                }
                
                if dry_run:
                    action = "UPDATE" if existing_term_id else "INSERT"
                    logger.info(f"[{i}/{total}] {term_ko}: {action} (dry-run)")
                    if existing_term_id:
                        stats["updated"] += 1
                    else:
                        stats["inserted"] += 1
                    continue
                
                # 5. Insert or Update
                if existing_term_id:
                    update_term(cursor, existing_term_id, term_record)
                    stats["updated"] += 1
                    logger.info(f"[{i}/{total}] {term_ko}: 업데이트 완료")
                else:
                    insert_term(cursor, term_record)
                    stats["inserted"] += 1
                    logger.info(f"[{i}/{total}] {term_ko}: 삽입 완료")
                
                # 배치 커밋
                if i % batch_size == 0:
                    if conn:
                        conn.commit()
                    logger.info(f"진행: {i}/{total} ({i/total*100:.1f}%)")
                    
            except Exception as e:
                logger.error(f"[{i}/{total}] {term_ko}: 처리 실패 - {e}")
                stats["errors"] += 1
                if conn:
                    conn.rollback()
                continue
        
        # 최종 커밋
        if conn:
            conn.commit()
            logger.info("데이터베이스 커밋 완료")
        
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"전체 처리 실패: {e}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
    
    return stats


def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(
        description="GRI synonyms_glossary.json 데이터를 synonyms_glossary 테이블에 로드하고 임베딩 생성"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="기존 데이터를 덮어쓰기"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="실제 저장 없이 테스트 실행"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=10,
        help="배치 커밋 크기 (기본값: 10)"
    )
    
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("GRI synonyms_glossary.json -> synonyms_glossary 테이블 로드 스크립트")
    logger.info("=" * 60)
    
    start_time = datetime.now()
    
    try:
        # 1. JSON 파일 로드
        terms = load_synonyms_glossary_json()
        
        # 2. 데이터베이스에 저장
        stats = load_terms_to_db(
            terms,
            force_update=args.force,
            dry_run=args.dry_run,
            batch_size=args.batch_size
        )
        
        # 3. 결과 출력
        elapsed = (datetime.now() - start_time).total_seconds()
        
        logger.info("=" * 60)
        logger.info("처리 결과:")
        logger.info(f"   - 삽입: {stats['inserted']}개")
        logger.info(f"   - 업데이트: {stats['updated']}개")
        logger.info(f"   - 스킵: {stats['skipped']}개")
        logger.info(f"   - 오류: {stats['errors']}개")
        logger.info(f"   - 소요 시간: {elapsed:.1f}초")
        logger.info("=" * 60)
        
        if stats['errors'] > 0:
            logger.warning(f"{stats['errors']}개의 오류가 발생했습니다")
            sys.exit(1)
        else:
            logger.info("모든 처리가 완료되었습니다!")
            
    except Exception as e:
        logger.error(f"스크립트 실행 실패: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

