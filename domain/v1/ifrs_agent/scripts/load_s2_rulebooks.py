"""IFRS S2 rulebooks.json 데이터를 rulebooks 테이블에 로드하고 임베딩을 생성하는 스크립트

이 스크립트는 다음 작업을 수행합니다:
1. ai/ifrs_agent/data/s2/rulebooks.json 파일에서 rulebook 섹션을 읽어옴
2. EmbeddingTextService를 사용하여 임베딩 텍스트 생성
3. EmbeddingService를 사용하여 벡터 임베딩 생성
4. rulebooks 테이블에 데이터 저장 (upsert 방식)

사용법:
    python load_s2_rulebooks.py
    python load_s2_rulebooks.py --force  # 기존 데이터 덮어쓰기
    python load_s2_rulebooks.py --dry-run  # 실제 저장 없이 테스트

주의: 이 스크립트는 IFRS S2 전용입니다. IFRS S1은 load_s1_rulebooks.py, GRI는 load_gri_rulebooks.py를 사용하세요.
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


def load_s2_rulebooks_json() -> List[Dict[str, Any]]:
    """IFRS S2 rulebooks.json 파일에서 rulebook 섹션 로드
    
    Returns:
        rulebook 섹션 딕셔너리 리스트
    """
    # 파일 경로 설정 (IFRS S2 전용)
    json_path = script_dir.parent / "data" / "s2" / "rulebooks.json"
    
    if not json_path.exists():
        logger.error(f"IFRS S2 rulebooks.json 파일을 찾을 수 없습니다: {json_path}")
        raise FileNotFoundError(f"IFRS S2 rulebooks.json not found at {json_path}")
    
    logger.info(f"IFRS S2 rulebooks.json 파일 로드 중: {json_path}")
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # rulebooks 키에서 데이터 추출
    if isinstance(data, dict) and "rulebooks" in data:
        rulebooks = data["rulebooks"]
    elif isinstance(data, list):
        rulebooks = data
    else:
        logger.error("IFRS S2 rulebooks.json 형식이 올바르지 않습니다")
        raise ValueError("Invalid IFRS S2 rulebooks.json format")
    
    logger.info(f"{len(rulebooks)}개의 IFRS S2 rulebook 섹션 로드 완료")
    return rulebooks


def generate_embedding_text(rulebook_data: Dict[str, Any]) -> str:
    """Rulebook 딕셔너리에서 임베딩 텍스트 생성
    
    EmbeddingTextService의 로직을 직접 구현
    """
    parts = []
    
    # 1. 섹션 정보
    if rulebook_data.get("section_name"):
        parts.append(rulebook_data["section_name"])
    if rulebook_data.get("standard_id"):
        parts.append(rulebook_data["standard_id"])
    
    # 2. 섹션 내용 (핵심)
    if rulebook_data.get("section_content"):
        parts.append(rulebook_data["section_content"])
    
    # 3. 검증 규칙
    validation_rules = rulebook_data.get("validation_rules")
    if validation_rules:
        if isinstance(validation_rules, dict):
            for key, value in validation_rules.items():
                if value:
                    if isinstance(value, list):
                        parts.append(f"{key}: {', '.join(str(v) for v in value)}")
                    else:
                        parts.append(f"{key}: {value}")
        elif isinstance(validation_rules, list):
            parts.extend([str(rule) for rule in validation_rules])
        else:
            parts.append(str(validation_rules))
    
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


def check_existing_rulebook(cursor, standard_id: str, section_name: str) -> bool:
    """기존 Rulebook 존재 여부 확인"""
    cursor.execute(
        "SELECT 1 FROM rulebooks WHERE standard_id = %s AND section_name = %s AND is_active = TRUE",
        (standard_id, section_name)
    )
    return cursor.fetchone() is not None


def get_existing_rulebook_id(cursor, standard_id: str, section_name: str) -> Optional[int]:
    """기존 Rulebook의 rulebook_id 가져오기"""
    cursor.execute(
        "SELECT rulebook_id FROM rulebooks WHERE standard_id = %s AND section_name = %s AND is_active = TRUE",
        (standard_id, section_name)
    )
    result = cursor.fetchone()
    return result[0] if result else None


def insert_rulebook(cursor, rulebook_record: Dict[str, Any]):
    """Rulebook 삽입"""
    columns = list(rulebook_record.keys())
    values = []
    
    for col in columns:
        val = rulebook_record[col]
        if col == "section_embedding":
            # pgvector 형식으로 변환
            values.append(val)
        elif col == "validation_rules":
            values.append(Json(val) if val else None)
        elif col == "related_dp_ids":
            values.append(val if val else None)
        else:
            values.append(val)
    
    placeholders = []
    for col in columns:
        if col == "section_embedding":
            placeholders.append("%s::vector")
        else:
            placeholders.append("%s")
    
    sql = f"""
        INSERT INTO rulebooks ({', '.join(columns)})
        VALUES ({', '.join(placeholders)})
    """
    
    cursor.execute(sql, values)


def update_rulebook(cursor, rulebook_id: int, rulebook_record: Dict[str, Any]):
    """Rulebook 업데이트"""
    set_clauses = []
    values = []
    
    for col, val in rulebook_record.items():
        if col == "rulebook_id":
            continue
        
        if col == "section_embedding":
            set_clauses.append(f"{col} = %s::vector")
            values.append(val)
        elif col == "validation_rules":
            set_clauses.append(f"{col} = %s")
            values.append(Json(val) if val else None)
        elif col == "related_dp_ids":
            set_clauses.append(f"{col} = %s")
            values.append(val if val else None)
        else:
            set_clauses.append(f"{col} = %s")
            values.append(val)
    
    set_clauses.append("updated_at = NOW()")
    values.append(rulebook_id)
    
    sql = f"""
        UPDATE rulebooks
        SET {', '.join(set_clauses)}
        WHERE rulebook_id = %s
    """
    
    cursor.execute(sql, values)


def load_rulebooks_to_db(
    rulebooks: List[Dict[str, Any]],
    force_update: bool = False,
    dry_run: bool = False,
    batch_size: int = 10
) -> Dict[str, int]:
    """Rulebook 섹션을 데이터베이스에 저장"""
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
        total = len(rulebooks)
        logger.info(f"총 {total}개 IFRS S2 rulebook 섹션 처리 시작")
        
        for i, rulebook_data in enumerate(rulebooks, 1):
            standard_id = rulebook_data.get("standard_id", "")
            section_name = rulebook_data.get("section_name", "")
            
            try:
                # 1. 기존 레코드 확인
                existing_id = None
                if cursor and not force_update:
                    if check_existing_rulebook(cursor, standard_id, section_name):
                        existing_id = get_existing_rulebook_id(cursor, standard_id, section_name)
                        if existing_id:
                            logger.debug(f"[{i}/{total}] {standard_id}/{section_name}: 이미 존재, 스킵")
                            stats["skipped"] += 1
                            continue
                elif cursor:
                    if check_existing_rulebook(cursor, standard_id, section_name):
                        existing_id = get_existing_rulebook_id(cursor, standard_id, section_name)
                
                # 2. 임베딩 텍스트 생성
                embedding_text = generate_embedding_text(rulebook_data)
                
                if not embedding_text.strip():
                    logger.warning(f"[{i}/{total}] {standard_id}/{section_name}: 임베딩 텍스트가 비어있음")
                    embedding_text = f"{section_name} {standard_id}"
                
                # 3. 임베딩 벡터 생성
                embedding_list = generate_embedding_with_model(embedder, model_type, embedding_text)
                
                # 4. 데이터 매핑
                rulebook_record = {
                    "standard_id": standard_id,
                    "section_name": section_name,
                    "section_content": rulebook_data.get("section_content"),
                    "validation_rules": rulebook_data.get("validation_rules", {}),
                    "related_dp_ids": rulebook_data.get("related_dp_ids", []),
                    "is_active": True,
                    "section_embedding": embedding_list,
                    "section_embedding_text": embedding_text
                }
                
                if dry_run:
                    action = "UPDATE" if existing_id else "INSERT"
                    logger.info(f"[{i}/{total}] {standard_id}/{section_name}: {action} (dry-run)")
                    if existing_id:
                        stats["updated"] += 1
                    else:
                        stats["inserted"] += 1
                    continue
                
                # 5. Insert or Update
                if existing_id:
                    update_rulebook(cursor, existing_id, rulebook_record)
                    stats["updated"] += 1
                    logger.info(f"[{i}/{total}] {standard_id}/{section_name}: 업데이트 완료")
                else:
                    insert_rulebook(cursor, rulebook_record)
                    stats["inserted"] += 1
                    logger.info(f"[{i}/{total}] {standard_id}/{section_name}: 삽입 완료")
                
                # 배치 커밋
                if i % batch_size == 0:
                    if conn:
                        conn.commit()
                    logger.info(f"진행: {i}/{total} ({i/total*100:.1f}%)")
                    
            except Exception as e:
                logger.error(f"[{i}/{total}] {standard_id}/{section_name}: 처리 실패 - {e}")
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
        description="IFRS S2 rulebooks.json 데이터를 rulebooks 테이블에 로드하고 임베딩 생성"
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
    logger.info("IFRS S2 rulebooks.json -> rulebooks 테이블 로드 스크립트")
    logger.info("=" * 60)
    
    start_time = datetime.now()
    
    try:
        # 1. JSON 파일 로드
        rulebooks = load_s2_rulebooks_json()
        
        # 2. 데이터베이스에 저장
        stats = load_rulebooks_to_db(
            rulebooks,
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
