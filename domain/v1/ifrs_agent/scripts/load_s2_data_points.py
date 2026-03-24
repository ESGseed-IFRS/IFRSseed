"""s2.json 데이터를 data_points 테이블에 로드하고 임베딩을 생성하는 스크립트

이 스크립트는 다음 작업을 수행합니다:
1. ai/ifrs_agent/data/s2/s2.json 파일에서 데이터 포인트를 읽어옴
2. EmbeddingTextService를 사용하여 임베딩 텍스트 생성
3. EmbeddingService를 사용하여 벡터 임베딩 생성
4. data_points 테이블에 데이터 저장 (upsert 방식)

사용법:
    python load_s2_data_points.py
    python load_s2_data_points.py --force  # 기존 데이터 덮어쓰기
    python load_s2_data_points.py --dry-run  # 실제 저장 없이 테스트
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


def load_s2_json() -> List[Dict[str, Any]]:
    """s2.json 파일에서 데이터 포인트 로드
    
    Returns:
        데이터 포인트 딕셔너리 리스트
    """
    # 파일 경로 설정
    json_path = script_dir.parent / "data" / "s2" / "s2.json"
    
    if not json_path.exists():
        logger.error(f"s2.json 파일을 찾을 수 없습니다: {json_path}")
        raise FileNotFoundError(f"s2.json not found at {json_path}")
    
    logger.info(f"s2.json 파일 로드 중: {json_path}")
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # data_points 키에서 데이터 추출
    if isinstance(data, dict) and "data_points" in data:
        data_points = data["data_points"]
    elif isinstance(data, list):
        data_points = data
    else:
        logger.error("s2.json 형식이 올바르지 않습니다")
        raise ValueError("Invalid s2.json format")
    
    logger.info(f"{len(data_points)}개의 데이터 포인트 로드 완료")
    return data_points


def generate_embedding_text(dp_data: Dict[str, Any]) -> str:
    """DataPoint 딕셔너리에서 임베딩 텍스트 생성
    
    EmbeddingTextService의 로직을 직접 구현
    """
    parts = []
    
    # 1. 핵심 정보
    parts.append(dp_data.get("name_ko", ""))
    parts.append(dp_data.get("name_en", ""))
    if dp_data.get("description"):
        parts.append(dp_data["description"])
    
    # 2. 분류 정보
    if dp_data.get("topic"):
        parts.append(dp_data["topic"])
    if dp_data.get("subtopic"):
        parts.append(dp_data["subtopic"])
    if dp_data.get("standard"):
        parts.append(dp_data["standard"])
    if dp_data.get("category"):
        category_map = {"E": "환경 Environment", "S": "사회 Social", "G": "지배구조 Governance"}
        parts.append(category_map.get(dp_data["category"], dp_data["category"]))
    
    # 3. 데이터 타입 정보
    if dp_data.get("dp_type"):
        parts.append(str(dp_data["dp_type"]))
    if dp_data.get("unit"):
        parts.append(str(dp_data["unit"]))
    
    # 4. 검증 규칙
    validation_rules = dp_data.get("validation_rules")
    if validation_rules:
        if isinstance(validation_rules, dict):
            for key, value in validation_rules.items():
                if value:
                    parts.append(f"{key}: {value}")
        elif isinstance(validation_rules, list):
            parts.extend([str(rule) for rule in validation_rules])
        else:
            parts.append(str(validation_rules))
    
    # 5. 값 범위
    value_range = dp_data.get("value_range")
    if value_range and isinstance(value_range, dict):
        if "min" in value_range:
            parts.append(f"최소값: {value_range['min']}")
        if "max" in value_range:
            parts.append(f"최대값: {value_range['max']}")
    
    # 6. 공시 요구사항
    if dp_data.get("disclosure_requirement"):
        parts.append(str(dp_data["disclosure_requirement"]))
    if dp_data.get("reporting_frequency"):
        parts.append(str(dp_data["reporting_frequency"]))
    
    # 7. 재무 연결
    if dp_data.get("financial_linkages"):
        parts.extend([str(linkage) for linkage in dp_data["financial_linkages"]])
    if dp_data.get("financial_impact_type"):
        parts.append(f"재무영향: {dp_data['financial_impact_type']}")
    
    # 결합 및 정리
    embedding_text = " ".join(parts)
    embedding_text = " ".join(embedding_text.split())
    
    return embedding_text


def generate_embedding(embedder, text: str) -> List[float]:
    """임베딩 벡터 생성"""
    embedding_vector = embedder.encode([text])
    
    # numpy 배열 처리
    if hasattr(embedding_vector, 'ndim') and embedding_vector.ndim > 1:
        embedding = embedding_vector[0]
    elif hasattr(embedding_vector, '__len__') and len(embedding_vector) > 0:
        embedding = embedding_vector[0]
    else:
        embedding = embedding_vector
    
    # L2 정규화
    if isinstance(embedding, np.ndarray):
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        return embedding.tolist()
    
    return list(embedding)


def map_dp_type(dp_type_str: str) -> str:
    """DP 타입 문자열을 PostgreSQL ENUM 값으로 변환"""
    type_mapping = {
        "quantitative": "quantitative",
        "qualitative": "qualitative",
        "narrative": "narrative",
        "binary": "binary",
        "QUANTITATIVE": "quantitative",
        "QUALITATIVE": "qualitative",
        "NARRATIVE": "narrative",
        "BINARY": "binary"
    }
    return type_mapping.get(dp_type_str, "narrative")


def map_unit(unit_str: Optional[str]) -> Optional[str]:
    """단위 문자열을 PostgreSQL ENUM 값으로 변환"""
    if not unit_str:
        return None
    
    unit_mapping = {
        "percentage": "percentage",
        "count": "count",
        "currency_krw": "currency_krw",
        "currency_usd": "currency_usd",
        "tco2e": "tco2e",
        "tco2eq": "tco2e",  # tco2eq도 tco2e로 매핑
        "mwh": "mwh",
        "cubic_meter": "cubic_meter",
        "text": "text"
    }
    return unit_mapping.get(unit_str.lower(), None)


def map_disclosure_requirement(req_str: Optional[str]) -> Optional[str]:
    """공시 요구사항 문자열을 PostgreSQL ENUM 값으로 변환"""
    if not req_str:
        return None
    
    req_mapping = {
        "필수": "필수",
        "권장": "권장",
        "선택": "선택",
        "required": "필수",
        "recommended": "권장",
        "optional": "선택"
    }
    return req_mapping.get(req_str, "필수")


def convert_validation_rules(rules: Any) -> Dict:
    """validation_rules를 JSONB 형식으로 변환"""
    if rules is None:
        return {}
    
    if isinstance(rules, dict):
        return rules
    
    if isinstance(rules, list):
        result = {}
        for i, rule in enumerate(rules):
            if isinstance(rule, str):
                if ": " in rule:
                    key, value = rule.split(": ", 1)
                    if value.lower() == "true":
                        result[key] = True
                    elif value.lower() == "false":
                        result[key] = False
                    else:
                        result[key] = value
                else:
                    result[f"rule_{i}"] = rule
            else:
                result[f"rule_{i}"] = rule
        return result
    
    return {"value": str(rules)}


def check_existing_dp(cursor, dp_id: str) -> bool:
    """기존 DP 존재 여부 확인"""
    cursor.execute(
        "SELECT 1 FROM data_points WHERE dp_id = %s",
        (dp_id,)
    )
    return cursor.fetchone() is not None


def insert_data_point(cursor, dp_record: Dict[str, Any]):
    """데이터 포인트 삽입"""
    columns = list(dp_record.keys())
    values = []
    
    for col in columns:
        val = dp_record[col]
        if col == "embedding":
            # pgvector 형식으로 변환
            values.append(val)
        elif col in ["validation_rules", "value_range"]:
            values.append(Json(val) if val else None)
        elif col in ["equivalent_dps", "child_dps", "financial_linkages"]:
            values.append(val if val else None)
        else:
            values.append(val)
    
    placeholders = []
    for col in columns:
        if col == "embedding":
            placeholders.append("%s::vector")
        else:
            placeholders.append("%s")
    
    sql = f"""
        INSERT INTO data_points ({', '.join(columns)})
        VALUES ({', '.join(placeholders)})
    """
    
    cursor.execute(sql, values)


def update_data_point(cursor, dp_id: str, dp_record: Dict[str, Any]):
    """데이터 포인트 업데이트"""
    set_clauses = []
    values = []
    
    for col, val in dp_record.items():
        if col == "dp_id":
            continue
        
        if col == "embedding":
            set_clauses.append(f"{col} = %s::vector")
            values.append(val)
        elif col in ["validation_rules", "value_range"]:
            set_clauses.append(f"{col} = %s")
            values.append(Json(val) if val else None)
        elif col in ["equivalent_dps", "child_dps", "financial_linkages"]:
            set_clauses.append(f"{col} = %s")
            values.append(val if val else None)
        else:
            set_clauses.append(f"{col} = %s")
            values.append(val)
    
    set_clauses.append("updated_at = NOW()")
    values.append(dp_id)
    
    sql = f"""
        UPDATE data_points
        SET {', '.join(set_clauses)}
        WHERE dp_id = %s
    """
    
    cursor.execute(sql, values)


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


def load_data_points_to_db(
    data_points: List[Dict[str, Any]],
    force_update: bool = False,
    dry_run: bool = False,
    batch_size: int = 10
) -> Dict[str, int]:
    """데이터 포인트를 데이터베이스에 저장"""
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
        total = len(data_points)
        logger.info(f"총 {total}개 데이터 포인트 처리 시작")
        
        for i, dp_data in enumerate(data_points, 1):
            dp_id = dp_data.get("dp_id", "")
            
            try:
                # 1. 기존 레코드 확인
                existing = False
                if cursor and not force_update:
                    existing = check_existing_dp(cursor, dp_id)
                    if existing:
                        logger.debug(f"[{i}/{total}] {dp_id}: 이미 존재, 스킵")
                        stats["skipped"] += 1
                        continue
                elif cursor:
                    existing = check_existing_dp(cursor, dp_id)
                
                # 2. 임베딩 텍스트 생성
                embedding_text = generate_embedding_text(dp_data)
                
                if not embedding_text.strip():
                    logger.warning(f"[{i}/{total}] {dp_id}: 임베딩 텍스트가 비어있음")
                    embedding_text = f"{dp_data.get('name_ko', '')} {dp_data.get('name_en', '')}"
                
                # 3. 임베딩 벡터 생성
                embedding_list = generate_embedding_with_model(embedder, model_type, embedding_text)
                
                # 4. 데이터 매핑
                parent_indicator = dp_data.get("parent_indicator")
                if parent_indicator == "":
                    parent_indicator = None
                
                dp_record = {
                    "dp_id": dp_id,
                    "dp_code": dp_data.get("dp_code", f"CODE_{dp_id}"),
                    "name_ko": dp_data.get("name_ko", ""),
                    "name_en": dp_data.get("name_en", ""),
                    "description": dp_data.get("description"),
                    "standard": dp_data.get("standard", "IFRS_S2"),
                    "category": dp_data.get("category", "G"),
                    "topic": dp_data.get("topic"),
                    "subtopic": dp_data.get("subtopic"),
                    "dp_type": map_dp_type(dp_data.get("dp_type", "narrative")),
                    "unit": map_unit(dp_data.get("unit")),
                    "validation_rules": convert_validation_rules(dp_data.get("validation_rules")),
                    "value_range": dp_data.get("value_range"),
                    "equivalent_dps": dp_data.get("equivalent_dps", []),
                    "parent_indicator": parent_indicator,
                    "child_dps": dp_data.get("child_dps", []),
                    "financial_linkages": dp_data.get("financial_linkages", []),
                    "financial_impact_type": dp_data.get("financial_impact_type"),
                    "disclosure_requirement": map_disclosure_requirement(
                        dp_data.get("disclosure_requirement")
                    ),
                    "reporting_frequency": dp_data.get("reporting_frequency"),
                    "is_active": True,
                    "embedding": embedding_list,
                    "embedding_text": embedding_text
                }
                
                if dry_run:
                    action = "UPDATE" if existing else "INSERT"
                    logger.info(f"[{i}/{total}] {dp_id}: {action} (dry-run)")
                    if existing:
                        stats["updated"] += 1
                    else:
                        stats["inserted"] += 1
                    continue
                
                # 5. Insert or Update
                if existing:
                    update_data_point(cursor, dp_id, dp_record)
                    stats["updated"] += 1
                    logger.info(f"[{i}/{total}] {dp_id}: 업데이트 완료")
                else:
                    insert_data_point(cursor, dp_record)
                    stats["inserted"] += 1
                    logger.info(f"[{i}/{total}] {dp_id}: 삽입 완료")
                
                # 배치 커밋
                if i % batch_size == 0:
                    if conn:
                        conn.commit()
                    logger.info(f"진행: {i}/{total} ({i/total*100:.1f}%)")
                    
            except Exception as e:
                logger.error(f"[{i}/{total}] {dp_id}: 처리 실패 - {e}")
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
        description="s2.json 데이터를 data_points 테이블에 로드하고 임베딩 생성"
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
    logger.info("s2.json -> data_points 테이블 로드 스크립트")
    logger.info("=" * 60)
    
    start_time = datetime.now()
    
    try:
        # 1. JSON 파일 로드
        data_points = load_s2_json()
        
        # 2. 데이터베이스에 저장
        stats = load_data_points_to_db(
            data_points,
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
