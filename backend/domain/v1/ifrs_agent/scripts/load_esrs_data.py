"""ESRS data_point.json과 rulebook.json 데이터를 데이터베이스에 로드하는 스크립트

이 스크립트는 다음 작업을 수행합니다:
1. ai/ifrs_agent/data/esrs/esrs_e1/data_point.json 파일에서 데이터 포인트를 읽어옴
2. ai/ifrs_agent/data/esrs/esrs_e1/rulebook.json 파일에서 rulebook 섹션을 읽어옴
3. data_points 테이블과 rulebooks 테이블에 데이터 저장 (upsert 방식)

사용법:
    python load_esrs_data.py                    # 두 파일 모두 로드
    python load_esrs_data.py --data-points-only # data_point.json만 로드
    python load_esrs_data.py --rulebooks-only   # rulebook.json만 로드
    python load_esrs_data.py --force            # 기존 데이터 덮어쓰기
    python load_esrs_data.py --dry-run          # 실제 저장 없이 테스트
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
    try:
        load_dotenv(env_path, encoding='utf-8')
    except UnicodeDecodeError:
        try:
            load_dotenv(env_path, encoding='utf-16')
        except Exception:
            load_dotenv(env_path)

import psycopg2
from psycopg2.extras import execute_values, Json
import numpy as np
import re


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


# =============================================================================
# 임베딩 관련 함수
# =============================================================================

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


def generate_embedding_text_for_dp(dp_data: Dict[str, Any]) -> str:
    """DataPoint 임베딩 텍스트 — EmbeddingTextService.generate_data_point_text_from_dict 와 동일."""
    parts = []
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


def generate_embedding_text_for_rulebook(rulebook_data: Dict[str, Any]) -> str:
    """Rulebook 딕셔너리에서 임베딩 텍스트 생성"""
    parts = []
    
    # 1. 핵심 정보
    if rulebook_data.get("section_name"):
        parts.append(rulebook_data["section_name"])
    if rulebook_data.get("rulebook_title"):
        parts.append(rulebook_data["rulebook_title"])
    if rulebook_data.get("rulebook_content"):
        # 내용이 너무 길면 앞부분만 사용
        content = rulebook_data["rulebook_content"]
        if len(content) > 2000:
            content = content[:2000] + "..."
        parts.append(content)
    
    # 2. 표준 및 섹션 정보
    if rulebook_data.get("standard_id"):
        parts.append(rulebook_data["standard_id"])
    if rulebook_data.get("primary_dp_id"):
        parts.append(f"Primary DP: {rulebook_data['primary_dp_id']}")
    
    # 3. 검증 규칙
    validation_rules = rulebook_data.get("validation_rules")
    if validation_rules:
        if isinstance(validation_rules, dict):
            # key_terms 추출
            if "key_terms" in validation_rules:
                parts.extend(validation_rules["key_terms"])
            # paragraph_reference 추출
            if "paragraph_reference" in validation_rules:
                parts.append(validation_rules["paragraph_reference"])
            # section_type 추출
            if "section_type" in validation_rules:
                parts.append(validation_rules["section_type"])
    
    # 4. 공시 요구사항
    if rulebook_data.get("disclosure_requirement"):
        parts.append(str(rulebook_data["disclosure_requirement"]))
    
    # 5. 관련 데이터 포인트
    if rulebook_data.get("related_dp_ids"):
        parts.append(f"Related DPs: {', '.join(rulebook_data['related_dp_ids'])}")
    
    # 결합 및 정리
    embedding_text = " ".join(parts)
    embedding_text = " ".join(embedding_text.split())
    
    return embedding_text


# =============================================================================
# Data Points 처리
# =============================================================================

def load_data_points_json() -> List[Dict[str, Any]]:
    """data_point.json 파일에서 데이터 포인트 로드
    
    Returns:
        데이터 포인트 딕셔너리 리스트
    """
    # 파일 경로 설정
    json_path = script_dir.parent / "data" / "esrs" / "esrs_e1" / "data_point.json"
    
    if not json_path.exists():
        logger.error(f"data_point.json 파일을 찾을 수 없습니다: {json_path}")
        raise FileNotFoundError(f"data_point.json not found at {json_path}")
    
    logger.info(f"data_point.json 파일 로드 중: {json_path}")
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # data_points 키에서 데이터 추출
    if isinstance(data, dict) and "data_points" in data:
        data_points = data["data_points"]
    elif isinstance(data, list):
        data_points = data
    else:
        logger.error("data_point.json 형식이 올바르지 않습니다")
        raise ValueError("Invalid data_point.json format")
    
    logger.info(f"{len(data_points)}개의 데이터 포인트 로드 완료")
    return data_points


def check_existing_data_point(cursor, dp_id: str) -> bool:
    """기존 DataPoint 존재 여부 확인"""
    cursor.execute(
        "SELECT 1 FROM data_points WHERE dp_id = %s AND is_active = TRUE",
        (dp_id,)
    )
    return cursor.fetchone() is not None


def insert_data_point(cursor, dp_record: Dict[str, Any]):
    """DataPoint 삽입"""
    # data_points 테이블에 없는 컬럼 제외
    excluded_cols = {"validation_rules", "value_range"}
    columns = [col for col in dp_record.keys() if col not in excluded_cols]
    values = []
    
    for col in columns:
        val = dp_record[col]
        if col == "embedding":
            # pgvector 형식으로 변환
            values.append(val)
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
    """DataPoint 업데이트"""
    set_clauses = []
    values = []
    
    for col, val in dp_record.items():
        if col == "dp_id":
            continue
        
        if col == "embedding":
            set_clauses.append(f"{col} = %s::vector")
            values.append(val)
        elif col in ["equivalent_dps", "child_dps", "financial_linkages"]:
            set_clauses.append(f"{col} = %s")
            values.append(val if val else None)
        elif col == "validation_rules" or col == "value_range":
            # data_points 테이블에 이 컬럼들이 없으므로 스킵
            continue
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


def sort_data_points_by_dependency(data_points: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """부모-자식 관계에 따라 데이터 포인트를 정렬 (부모가 먼저 오도록)
    
    Topological sort를 사용하여 parent_indicator 관계에 따라 정렬합니다.
    """
    # dp_id -> index 매핑 생성
    dp_id_to_index = {dp.get("dp_id"): idx for idx, dp in enumerate(data_points) if dp.get("dp_id")}
    
    # 모든 dp_id 집합
    all_dp_ids = set(dp_id_to_index.keys())
    
    # 정렬된 결과
    sorted_dps = []
    visited = set()
    temp_visited = set()  # 순환 참조 감지용
    
    def visit(dp_id: str):
        """DFS를 사용한 topological sort"""
        if dp_id in temp_visited:
            # 순환 참조 감지 (일반적으로 발생하지 않아야 함)
            logger.warning(f"순환 참조 감지: {dp_id}")
            return
        if dp_id in visited:
            return
        
        temp_visited.add(dp_id)
        
        # 현재 노드 찾기
        if dp_id in dp_id_to_index:
            idx = dp_id_to_index[dp_id]
            dp_data = data_points[idx]
            
            # 부모가 있으면 부모를 먼저 방문
            parent_id = dp_data.get("parent_indicator")
            if parent_id and parent_id in all_dp_ids and parent_id != dp_id:
                visit(parent_id)
        
        temp_visited.remove(dp_id)
        visited.add(dp_id)
        
        # 현재 노드 추가
        if dp_id in dp_id_to_index:
            idx = dp_id_to_index[dp_id]
            if data_points[idx] not in sorted_dps:
                sorted_dps.append(data_points[idx])
    
    # 모든 노드 방문
    for dp_data in data_points:
        dp_id = dp_data.get("dp_id")
        if dp_id and dp_id not in visited:
            visit(dp_id)
    
    # parent_indicator가 없는 노드들도 추가 (이미 추가되었을 수 있음)
    for dp_data in data_points:
        if dp_data not in sorted_dps:
            sorted_dps.append(dp_data)
    
    logger.info(f"데이터 포인트 정렬 완료: {len(sorted_dps)}개")
    return sorted_dps


def load_data_points_to_db(
    data_points: List[Dict[str, Any]],
    force_update: bool = False,
    dry_run: bool = False,
    batch_size: int = 50
) -> Dict[str, int]:
    """DataPoint를 데이터베이스에 저장"""
    stats = {"inserted": 0, "updated": 0, "skipped": 0, "errors": 0}
    skipped_items = []  # 스킵된 항목 목록
    
    if dry_run:
        logger.info("Dry-run 모드: 실제 데이터베이스 저장 없음")
    
    # 임베딩 모델 로드
    logger.info("임베딩 모델 로딩 중...")
    try:
        embedder, model_type = load_embedding_model()
    except Exception as e:
        logger.error(f"임베딩 모델 로드 실패: {e}")
        logger.warning("임베딩 없이 진행합니다...")
        embedder = None
        model_type = None
    
    # 부모-자식 관계에 따라 정렬 (부모가 먼저 오도록)
    logger.info("데이터 포인트를 부모-자식 관계에 따라 정렬 중...")
    sorted_data_points = sort_data_points_by_dependency(data_points)
    
    # 데이터베이스 연결
    if not dry_run:
        conn = get_db_connection()
        cursor = conn.cursor()
    else:
        conn = None
        cursor = None
    
    try:
        total = len(sorted_data_points)
        logger.info(f"총 {total}개 데이터 포인트 처리 시작")
        
        for i, dp_data in enumerate(sorted_data_points, 1):
            dp_id = dp_data.get("dp_id", "")
            
            if not dp_id:
                logger.warning(f"[{i}/{total}] dp_id가 없어 스킵")
                stats["skipped"] += 1
                continue
            
            try:
                # 1. 기존 레코드 확인
                existing = False
                if cursor and not force_update:
                    if check_existing_data_point(cursor, dp_id):
                        skipped_items.append(dp_id)
                        if len(skipped_items) <= 10:  # 처음 10개만 상세 로그
                            logger.info(f"[{i}/{total}] {dp_id}: 이미 데이터베이스에 존재하여 스킵 (덮어쓰려면 --force 옵션 사용)")
                        stats["skipped"] += 1
                        continue
                elif cursor:
                    existing = check_existing_data_point(cursor, dp_id)
                
                # 2. parent_indicator 검증 및 처리
                parent_indicator = dp_data.get("parent_indicator")
                
                # parent_indicator가 실제 데이터 포인트인지 확인
                if parent_indicator:
                    # 현재 배치에서 이미 처리된 레코드 확인 (정렬된 순서이므로 앞에 있는 것들은 이미 처리됨)
                    parent_exists_in_batch = any(
                        dp.get("dp_id") == parent_indicator 
                        for dp in sorted_data_points[:i-1]  # 현재 인덱스 이전만 확인
                    )
                    
                    # 데이터베이스에 있는지 확인
                    parent_exists_in_db = False
                    if cursor and not dry_run:
                        try:
                            cursor.execute(
                                "SELECT 1 FROM data_points WHERE dp_id = %s AND is_active = TRUE",
                                (parent_indicator,)
                            )
                            parent_exists_in_db = cursor.fetchone() is not None
                        except Exception as e:
                            logger.warning(f"[{i}/{total}] {dp_id}: parent_indicator 확인 중 오류: {e}")
                    
                    # 부모가 존재하지 않으면 NULL로 설정 (예: "ESRS2" 같은 표준 ID)
                    if not parent_exists_in_batch and not parent_exists_in_db:
                        logger.debug(f"[{i}/{total}] {dp_id}: parent_indicator '{parent_indicator}'가 존재하지 않아 NULL로 설정")
                        parent_indicator = None
                
                # 3. disclosure_requirement ENUM 검증
                disclosure_requirement = dp_data.get("disclosure_requirement")
                valid_disclosure_requirements = {"필수", "권장", "선택", "조건부"}
                if disclosure_requirement and disclosure_requirement not in valid_disclosure_requirements:
                    logger.warning(f"[{i}/{total}] {dp_id}: disclosure_requirement '{disclosure_requirement}'가 유효하지 않아 NULL로 설정")
                    disclosure_requirement = None
                
                # 4. 임베딩 텍스트 및 벡터 생성
                embedding_text = None
                embedding_list = None
                
                if embedder:
                    try:
                        embedding_text = generate_embedding_text_for_dp(dp_data)
                        
                        if not embedding_text.strip():
                            logger.warning(f"[{i}/{total}] {dp_id}: 임베딩 텍스트가 비어있음")
                            embedding_text = f"{dp_data.get('name_ko', '')} {dp_data.get('name_en', '')}"
                        
                        embedding_list = generate_embedding_with_model(embedder, model_type, embedding_text)
                    except Exception as e:
                        logger.warning(f"[{i}/{total}] {dp_id}: 임베딩 생성 실패 - {e}")
                        embedding_text = None
                        embedding_list = None
                
                # 5. 데이터 매핑
                dp_record = {
                    "dp_id": dp_id,
                    "dp_code": dp_data.get("dp_code", ""),
                    "name_ko": dp_data.get("name_ko", ""),
                    "name_en": dp_data.get("name_en", ""),
                    "description": dp_data.get("description"),
                    "standard": dp_data.get("standard", ""),
                    "category": dp_data.get("category", ""),
                    "topic": dp_data.get("topic"),
                    "subtopic": dp_data.get("subtopic"),
                    "dp_type": dp_data.get("dp_type", "narrative"),
                    "unit": dp_data.get("unit"),
                    "equivalent_dps": dp_data.get("equivalent_dps", []),
                    "parent_indicator": parent_indicator,  # 검증된 parent_indicator 사용
                    "child_dps": dp_data.get("child_dps", []),
                    "financial_linkages": dp_data.get("financial_linkages", []),
                    "financial_impact_type": dp_data.get("financial_impact_type"),
                    "disclosure_requirement": disclosure_requirement,  # 검증된 disclosure_requirement 사용
                    "reporting_frequency": dp_data.get("reporting_frequency"),
                    # validation_rules와 value_range는 data_points 테이블에 컬럼이 없으므로 제외
                    "is_active": True,
                    "embedding": embedding_list,  # 생성된 임베딩 벡터
                    "embedding_text": embedding_text  # 생성된 임베딩 텍스트
                }
                
                if dry_run:
                    action = "UPDATE" if existing else "INSERT"
                    logger.info(f"[{i}/{total}] {dp_id}: {action} (dry-run)")
                    if existing:
                        stats["updated"] += 1
                    else:
                        stats["inserted"] += 1
                    continue
                
                # 3. Insert or Update
                if existing:
                    update_data_point(cursor, dp_id, dp_record)
                    stats["updated"] += 1
                    logger.debug(f"[{i}/{total}] {dp_id}: 업데이트 완료")
                else:
                    insert_data_point(cursor, dp_record)
                    stats["inserted"] += 1
                    logger.debug(f"[{i}/{total}] {dp_id}: 삽입 완료")
                
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
        
        # 스킵된 항목 요약 출력
        if skipped_items:
            logger.info(f"\n스킵된 항목 요약: 총 {len(skipped_items)}개")
            if len(skipped_items) <= 20:
                logger.info(f"스킵된 dp_id 목록: {', '.join(skipped_items)}")
            else:
                logger.info(f"스킵된 dp_id 목록 (처음 20개): {', '.join(skipped_items[:20])} ... 외 {len(skipped_items) - 20}개")
                logger.info("모든 스킵된 항목을 보려면 --force 옵션 없이 다시 실행하세요")
        
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


# =============================================================================
# Rulebooks 처리
# =============================================================================

def load_rulebooks_json() -> List[Dict[str, Any]]:
    """rulebook.json 파일에서 rulebook 섹션 로드
    
    Returns:
        rulebook 섹션 딕셔너리 리스트
    """
    # 파일 경로 설정
    json_path = script_dir.parent / "data" / "esrs" / "esrs_e1" / "rulebook.json"
    
    if not json_path.exists():
        logger.error(f"rulebook.json 파일을 찾을 수 없습니다: {json_path}")
        raise FileNotFoundError(f"rulebook.json not found at {json_path}")
    
    logger.info(f"rulebook.json 파일 로드 중: {json_path}")
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # rulebooks 키에서 데이터 추출
    if isinstance(data, dict) and "rulebooks" in data:
        rulebooks = data["rulebooks"]
    elif isinstance(data, list):
        rulebooks = data
    else:
        logger.error("rulebook.json 형식이 올바르지 않습니다")
        raise ValueError("Invalid rulebook.json format")
    
    logger.info(f"{len(rulebooks)}개의 rulebook 섹션 로드 완료")
    return rulebooks


def check_existing_rulebook(cursor, standard_id: str, section_name: str) -> bool:
    """기존 Rulebook 존재 여부 확인"""
    cursor.execute(
        "SELECT 1 FROM rulebooks WHERE standard_id = %s AND section_name = %s AND is_active = TRUE",
        (standard_id, section_name)
    )
    return cursor.fetchone() is not None


def get_existing_rulebook_id(cursor, standard_id: str, section_name: str) -> Optional[str]:
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
        elif col == "effective_date":
            # 날짜 문자열을 Date 객체로 변환
            if val:
                if isinstance(val, str):
                    from datetime import datetime as dt
                    try:
                        val = dt.strptime(val, "%Y-%m-%d").date()
                    except:
                        pass
            values.append(val)
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


def update_rulebook(cursor, rulebook_id: str, rulebook_record: Dict[str, Any]):
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
        elif col == "effective_date":
            # 날짜 문자열을 Date 객체로 변환
            if val:
                if isinstance(val, str):
                    from datetime import datetime as dt
                    try:
                        val = dt.strptime(val, "%Y-%m-%d").date()
                    except:
                        pass
            set_clauses.append(f"{col} = %s")
            values.append(val)
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
        logger.warning("임베딩 없이 진행합니다...")
        embedder = None
        model_type = None
    
    # 데이터베이스 연결
    if not dry_run:
        conn = get_db_connection()
        cursor = conn.cursor()
    else:
        conn = None
        cursor = None
    
    try:
        total = len(rulebooks)
        logger.info(f"총 {total}개 rulebook 섹션 처리 시작")
        
        for i, rulebook_data in enumerate(rulebooks, 1):
            standard_id = rulebook_data.get("standard_id", "")
            section_name = rulebook_data.get("section_name", "")
            
            if not standard_id or not section_name:
                logger.warning(f"[{i}/{total}] standard_id 또는 section_name이 없어 스킵")
                stats["skipped"] += 1
                continue
            
            try:
                # 1. rulebook_id 생성 (standard_id + section_name 기반)
                # JSON에 rulebook_id가 이미 있으면 사용, 없으면 생성
                rulebook_id = rulebook_data.get("rulebook_id", "")
                
                if not rulebook_id:
                    # 특수문자 정리 (공백, /, (, ), - 등을 _로 변환)
                    section_name_clean = re.sub(r'[ /()\-\.]', '_', section_name)
                    section_name_clean = re.sub(r'_+', '_', section_name_clean).strip('_')  # 연속된 _ 제거 및 앞뒤 _ 제거
                    rulebook_id = f"{standard_id}_{section_name_clean}"
                    
                    # rulebook_id가 너무 길면 해시 사용 (200자 초과 시)
                    if len(rulebook_id) > 200:
                        import hashlib
                        hash_suffix = hashlib.md5(section_name.encode('utf-8')).hexdigest()[:16]
                        rulebook_id = f"{standard_id}_{hash_suffix}"
                        logger.debug(f"[{i}/{total}] {standard_id}/{section_name}: rulebook_id가 너무 길어 해시 사용: {rulebook_id}")
                
                # 2. 기존 레코드 확인
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
                
                # 3. disclosure_requirement ENUM 검증
                disclosure_requirement = rulebook_data.get("disclosure_requirement")
                valid_disclosure_requirements = {"필수", "권장", "선택", "조건부"}
                if disclosure_requirement and disclosure_requirement not in valid_disclosure_requirements:
                    logger.warning(f"[{i}/{total}] {standard_id}/{section_name}: disclosure_requirement '{disclosure_requirement}'가 유효하지 않아 NULL로 설정")
                    disclosure_requirement = None
                
                # 4. 임베딩 텍스트 및 벡터 생성
                section_embedding_text = None
                section_embedding_list = None
                
                if embedder:
                    try:
                        section_embedding_text = generate_embedding_text_for_rulebook(rulebook_data)
                        
                        if not section_embedding_text.strip():
                            logger.warning(f"[{i}/{total}] {standard_id}/{section_name}: 임베딩 텍스트가 비어있음")
                            section_embedding_text = f"{rulebook_data.get('section_name', '')} {rulebook_data.get('rulebook_title', '')}"
                        
                        section_embedding_list = generate_embedding_with_model(embedder, model_type, section_embedding_text)
                    except Exception as e:
                        logger.warning(f"[{i}/{total}] {standard_id}/{section_name}: 임베딩 생성 실패 - {e}")
                        section_embedding_text = None
                        section_embedding_list = None
                
                # 5. 데이터 매핑
                rulebook_record = {
                    "rulebook_id": rulebook_id,
                    "standard_id": standard_id,
                    "section_name": section_name,
                    "rulebook_content": rulebook_data.get("section_content"),  # JSON의 section_content를 DB의 rulebook_content로 매핑
                    "rulebook_title": rulebook_data.get("rulebook_title"),
                    "primary_dp_id": rulebook_data.get("primary_dp_id"),
                    "validation_rules": rulebook_data.get("validation_rules", {}),
                    "related_dp_ids": rulebook_data.get("related_dp_ids", []),
                    "disclosure_requirement": disclosure_requirement,  # 검증된 disclosure_requirement 사용
                    "version": rulebook_data.get("version"),
                    "effective_date": rulebook_data.get("effective_date"),
                    "is_active": rulebook_data.get("is_active", True),
                    "is_primary": rulebook_data.get("is_primary", False),
                    "section_embedding": section_embedding_list,  # 생성된 임베딩 벡터
                    "section_embedding_text": section_embedding_text  # 생성된 임베딩 텍스트
                }
                
                if dry_run:
                    action = "UPDATE" if existing_id else "INSERT"
                    logger.info(f"[{i}/{total}] {standard_id}/{section_name}: {action} (dry-run)")
                    if existing_id:
                        stats["updated"] += 1
                    else:
                        stats["inserted"] += 1
                    continue
                
                # 4. Insert or Update
                if existing_id:
                    update_rulebook(cursor, existing_id, rulebook_record)
                    stats["updated"] += 1
                    logger.debug(f"[{i}/{total}] {standard_id}/{section_name}: 업데이트 완료")
                else:
                    insert_rulebook(cursor, rulebook_record)
                    stats["inserted"] += 1
                    logger.debug(f"[{i}/{total}] {standard_id}/{section_name}: 삽입 완료")
                
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


# =============================================================================
# 메인 함수
# =============================================================================

def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(
        description="ESRS data_point.json과 rulebook.json 데이터를 데이터베이스에 로드"
    )
    parser.add_argument(
        "--data-points-only",
        action="store_true",
        help="data_point.json만 로드"
    )
    parser.add_argument(
        "--rulebooks-only",
        action="store_true",
        help="rulebooks.json만 로드"
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
        default=50,
        help="배치 커밋 크기 (기본값: 50)"
    )
    
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("ESRS 데이터 로드 스크립트")
    logger.info("=" * 60)
    
    start_time = datetime.now()
    
    try:
        # 처리할 작업 결정
        load_data_points = not args.rulebooks_only
        load_rulebooks = not args.data_points_only
        
        total_stats = {
            "data_points": {"inserted": 0, "updated": 0, "skipped": 0, "errors": 0},
            "rulebooks": {"inserted": 0, "updated": 0, "skipped": 0, "errors": 0}
        }
        
        # 1. Data Points 로드
        if load_data_points:
            logger.info("\n" + "=" * 60)
            logger.info("Data Points 로드 시작")
            logger.info("=" * 60)
            
            data_points = load_data_points_json()
            stats = load_data_points_to_db(
                data_points,
                force_update=args.force,
                dry_run=args.dry_run,
                batch_size=args.batch_size
            )
            total_stats["data_points"] = stats
            
            logger.info("\nData Points 처리 결과:")
            logger.info(f"   - 삽입: {stats['inserted']}개")
            logger.info(f"   - 업데이트: {stats['updated']}개")
            logger.info(f"   - 스킵: {stats['skipped']}개")
            logger.info(f"   - 오류: {stats['errors']}개")
        
        # 2. Rulebooks 로드
        if load_rulebooks:
            logger.info("\n" + "=" * 60)
            logger.info("Rulebooks 로드 시작")
            logger.info("=" * 60)
            
            rulebooks = load_rulebooks_json()
            stats = load_rulebooks_to_db(
                rulebooks,
                force_update=args.force,
                dry_run=args.dry_run,
                batch_size=args.batch_size
            )
            total_stats["rulebooks"] = stats
            
            logger.info("\nRulebooks 처리 결과:")
            logger.info(f"   - 삽입: {stats['inserted']}개")
            logger.info(f"   - 업데이트: {stats['updated']}개")
            logger.info(f"   - 스킵: {stats['skipped']}개")
            logger.info(f"   - 오류: {stats['errors']}개")
        
        # 3. 전체 결과 출력
        elapsed = (datetime.now() - start_time).total_seconds()
        
        logger.info("\n" + "=" * 60)
        logger.info("전체 처리 결과:")
        logger.info("=" * 60)
        
        if load_data_points:
            dp_stats = total_stats["data_points"]
            logger.info(f"Data Points:")
            logger.info(f"   - 삽입: {dp_stats['inserted']}개")
            logger.info(f"   - 업데이트: {dp_stats['updated']}개")
            logger.info(f"   - 스킵: {dp_stats['skipped']}개")
            logger.info(f"   - 오류: {dp_stats['errors']}개")
        
        if load_rulebooks:
            rb_stats = total_stats["rulebooks"]
            logger.info(f"Rulebooks:")
            logger.info(f"   - 삽입: {rb_stats['inserted']}개")
            logger.info(f"   - 업데이트: {rb_stats['updated']}개")
            logger.info(f"   - 스킵: {rb_stats['skipped']}개")
            logger.info(f"   - 오류: {rb_stats['errors']}개")
        
        logger.info(f"\n소요 시간: {elapsed:.1f}초")
        logger.info("=" * 60)
        
        # 오류가 있으면 종료 코드 1 반환
        total_errors = (
            total_stats["data_points"]["errors"] + 
            total_stats["rulebooks"]["errors"]
        )
        
        if total_errors > 0:
            logger.warning(f"{total_errors}개의 오류가 발생했습니다")
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
