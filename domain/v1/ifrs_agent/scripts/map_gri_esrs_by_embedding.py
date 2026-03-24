"""GRI와 ESRS 데이터 포인트의 임베딩을 비교하여 매핑하는 스크립트

이 스크립트는 다음 작업을 수행합니다:
1. data_points 테이블에서 GRI 데이터 포인트들을 가져옴
2. data_points 테이블에서 ESRS 데이터 포인트들을 가져옴
3. 각 GRI DP에 대해 ESRS DP들과 코사인 유사도를 계산
4. 유사도가 임계값 이상인 매핑을 찾아서 저장
5. 결과를 CSV/JSON 파일로 출력

사용법:
    python map_gri_esrs_by_embedding.py                    # 기본 설정으로 실행
    python map_gri_esrs_by_embedding.py --threshold 0.75   # 유사도 임계값 설정
    python map_gri_esrs_by_embedding.py --top-k 5          # 상위 5개만 매핑
    python map_gri_esrs_by_embedding.py --update-db         # equivalent_dps 필드 업데이트
    python map_gri_esrs_by_embedding.py --output results.csv # 결과를 CSV로 저장
"""
import sys
import os
import json
import csv
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
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
from psycopg2.extras import RealDictCursor
import numpy as np


def get_logger():
    """간단한 로거 설정"""
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s | %(levelname)-8s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
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


def get_gri_data_points(cursor) -> List[Dict[str, Any]]:
    """GRI 데이터 포인트들을 가져옴"""
    query = """
        SELECT 
            dp_id,
            dp_code,
            name_ko,
            name_en,
            description,
            standard,
            category,
            topic,
            subtopic,
            dp_type,
            unit,
            embedding,
            embedding_text
        FROM data_points
        WHERE (standard LIKE 'GRI%' OR standard = 'GRI')
          AND is_active = TRUE
          AND embedding IS NOT NULL
        ORDER BY dp_id
    """
    cursor.execute(query)
    return cursor.fetchall()


def get_esrs_data_points(cursor) -> List[Dict[str, Any]]:
    """ESRS 데이터 포인트들을 가져옴"""
    query = """
        SELECT 
            dp_id,
            dp_code,
            name_ko,
            name_en,
            description,
            standard,
            category,
            topic,
            subtopic,
            dp_type,
            unit,
            embedding,
            embedding_text
        FROM data_points
        WHERE standard LIKE 'ESRS%'
          AND is_active = TRUE
          AND embedding IS NOT NULL
        ORDER BY dp_id
    """
    cursor.execute(query)
    return cursor.fetchall()


def calculate_cosine_similarity(
    cursor,
    source_embedding: Any,
    target_standard: str,
    exclude_dp_id: Optional[str] = None,
    top_k: int = 10
) -> List[Tuple[str, float]]:
    """pgvector를 사용하여 코사인 유사도 계산
    
    Args:
        cursor: 데이터베이스 커서
        source_embedding: 소스 임베딩 벡터 (리스트, numpy 배열, 또는 pgvector 객체)
        target_standard: 대상 기준서 (예: 'ESRS%')
        exclude_dp_id: 제외할 DP ID
        top_k: 반환할 상위 K개
    
    Returns:
        (dp_id, similarity) 튜플 리스트
    """
    # 임베딩 벡터를 리스트로 변환
    if hasattr(source_embedding, 'tolist'):
        # numpy 배열인 경우
        embedding_list = source_embedding.tolist()
    elif isinstance(source_embedding, (list, tuple)):
        # 이미 리스트인 경우
        embedding_list = list(source_embedding)
    else:
        # pgvector 객체나 다른 타입인 경우
        embedding_list = list(source_embedding)
    
    # pgvector 형식의 문자열로 변환: [1.0, 2.0, 3.0] -> '[1.0,2.0,3.0]'
    embedding_str = '[' + ','.join(str(float(x)) for x in embedding_list) + ']'
    
    # SQL 쿼리 작성
    if exclude_dp_id:
        query = f"""
            SELECT 
                dp_id,
                1 - (embedding <=> '{embedding_str}'::vector) as similarity
            FROM data_points
            WHERE standard LIKE '{target_standard}'
              AND is_active = TRUE
              AND embedding IS NOT NULL
              AND dp_id != %s
            ORDER BY embedding <=> '{embedding_str}'::vector
            LIMIT %s
        """
        cursor.execute(query, (exclude_dp_id, top_k))
    else:
        query = f"""
            SELECT 
                dp_id,
                1 - (embedding <=> '{embedding_str}'::vector) as similarity
            FROM data_points
            WHERE standard LIKE '{target_standard}'
              AND is_active = TRUE
              AND embedding IS NOT NULL
            ORDER BY embedding <=> '{embedding_str}'::vector
            LIMIT %s
        """
        cursor.execute(query, (top_k,))
    
    results = cursor.fetchall()
    return [(row['dp_id'], float(row['similarity'])) for row in results]


def find_mappings(
    cursor,
    gri_dps: List[Dict[str, Any]],
    esrs_dps: List[Dict[str, Any]],
    threshold: float = 0.70,
    top_k: int = 5
) -> List[Dict[str, Any]]:
    """GRI DP와 ESRS DP 간의 매핑 찾기
    
    Args:
        cursor: 데이터베이스 커서
        gri_dps: GRI 데이터 포인트 리스트
        esrs_dps: ESRS 데이터 포인트 리스트 (참고용)
        threshold: 유사도 임계값
        top_k: 각 GRI DP당 찾을 ESRS DP 개수
    
    Returns:
        매핑 결과 리스트
    """
    mappings = []
    total = len(gri_dps)
    
    logger.info(f"총 {total}개의 GRI 데이터 포인트 처리 시작")
    logger.info(f"유사도 임계값: {threshold}, 상위 {top_k}개 매핑")
    
    for i, gri_dp in enumerate(gri_dps, 1):
        gri_dp_id = gri_dp['dp_id']
        gri_embedding = gri_dp['embedding']
        
        if not gri_embedding:
            logger.warning(f"[{i}/{total}] {gri_dp_id}: 임베딩이 없어 스킵")
            continue
        
        try:
            # pgvector를 사용하여 유사한 ESRS DP 찾기
            similar_esrs = calculate_cosine_similarity(
                cursor,
                gri_embedding,
                'ESRS%',
                exclude_dp_id=gri_dp_id,
                top_k=top_k * 2  # 임계값 필터링 전에 더 많이 가져옴
            )
            
            # 임계값 이상인 것만 필터링
            filtered_mappings = [
                (esrs_id, sim) for esrs_id, sim in similar_esrs
                if sim >= threshold
            ][:top_k]
            
            if filtered_mappings:
                for esrs_id, similarity in filtered_mappings:
                    mappings.append({
                        'gri_dp_id': gri_dp_id,
                        'gri_dp_code': gri_dp.get('dp_code', ''),
                        'gri_name_ko': gri_dp.get('name_ko', ''),
                        'gri_name_en': gri_dp.get('name_en', ''),
                        'gri_category': gri_dp.get('category', ''),
                        'gri_topic': gri_dp.get('topic', ''),
                        'esrs_dp_id': esrs_id,
                        'similarity': similarity,
                        'mapping_confidence': 'high' if similarity >= 0.85 else 'medium' if similarity >= 0.75 else 'low'
                    })
                
                logger.info(
                    f"[{i}/{total}] {gri_dp_id}: {len(filtered_mappings)}개 매핑 발견 "
                    f"(최고 유사도: {filtered_mappings[0][1]:.4f})"
                )
            else:
                logger.debug(f"[{i}/{total}] {gri_dp_id}: 임계값 이상의 매핑 없음")
        
        except Exception as e:
            logger.error(f"[{i}/{total}] {gri_dp_id}: 매핑 검색 실패 - {e}")
            continue
    
    logger.info(f"총 {len(mappings)}개의 매핑 발견")
    return mappings


def update_equivalent_dps(cursor, mappings: List[Dict[str, Any]]):
    """equivalent_dps 필드를 업데이트"""
    # GRI DP별로 그룹화
    gri_to_esrs = {}
    for mapping in mappings:
        gri_id = mapping['gri_dp_id']
        esrs_id = mapping['esrs_dp_id']
        if gri_id not in gri_to_esrs:
            gri_to_esrs[gri_id] = []
        gri_to_esrs[gri_id].append(esrs_id)
    
    # 업데이트 실행
    updated_count = 0
    for gri_id, esrs_ids in gri_to_esrs.items():
        try:
            # 기존 equivalent_dps와 병합 (중복 제거)
            cursor.execute(
                "SELECT equivalent_dps FROM data_points WHERE dp_id = %s",
                (gri_id,)
            )
            existing = cursor.fetchone()
            existing_dps = existing['equivalent_dps'] if existing and existing['equivalent_dps'] else []
            
            # 새로운 ESRS DP 추가 (중복 제거)
            updated_dps = list(set(existing_dps + esrs_ids))
            
            cursor.execute(
                "UPDATE data_points SET equivalent_dps = %s WHERE dp_id = %s",
                (updated_dps, gri_id)
            )
            updated_count += 1
            logger.debug(f"{gri_id}: equivalent_dps 업데이트 ({len(updated_dps)}개)")
        
        except Exception as e:
            logger.error(f"{gri_id}: equivalent_dps 업데이트 실패 - {e}")
    
    logger.info(f"총 {updated_count}개의 GRI DP의 equivalent_dps 필드 업데이트 완료")


def save_to_csv(mappings: List[Dict[str, Any]], output_path: str):
    """매핑 결과를 CSV 파일로 저장"""
    if not mappings:
        logger.warning("저장할 매핑이 없습니다.")
        return
    
    fieldnames = [
        'gri_dp_id', 'gri_dp_code', 'gri_name_ko', 'gri_name_en',
        'gri_category', 'gri_topic',
        'esrs_dp_id', 'similarity', 'mapping_confidence'
    ]
    
    with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(mappings)
    
    logger.info(f"매핑 결과를 {output_path}에 저장했습니다.")


def save_to_json(mappings: List[Dict[str, Any]], output_path: str):
    """매핑 결과를 JSON 파일로 저장"""
    if not mappings:
        logger.warning("저장할 매핑이 없습니다.")
        return
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(mappings, f, ensure_ascii=False, indent=2)
    
    logger.info(f"매핑 결과를 {output_path}에 저장했습니다.")


def main():
    parser = argparse.ArgumentParser(description='GRI와 ESRS 데이터 포인트 임베딩 비교 매핑')
    parser.add_argument(
        '--threshold',
        type=float,
        default=0.70,
        help='유사도 임계값 (기본값: 0.70)'
    )
    parser.add_argument(
        '--top-k',
        type=int,
        default=5,
        help='각 GRI DP당 찾을 ESRS DP 개수 (기본값: 5)'
    )
    parser.add_argument(
        '--update-db',
        action='store_true',
        help='equivalent_dps 필드를 업데이트'
    )
    parser.add_argument(
        '--output',
        type=str,
        default=None,
        help='결과를 저장할 파일 경로 (CSV 또는 JSON)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='실제 저장 없이 테스트 실행'
    )
    
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("GRI-ESRS 임베딩 기반 매핑 스크립트")
    logger.info("=" * 60)
    logger.info("")
    
    conn = None
    try:
        # 데이터베이스 연결
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # GRI 데이터 포인트 가져오기
        logger.info("GRI 데이터 포인트 로드 중...")
        gri_dps = get_gri_data_points(cursor)
        logger.info(f"GRI 데이터 포인트: {len(gri_dps)}개")
        
        # ESRS 데이터 포인트 가져오기 (참고용)
        logger.info("ESRS 데이터 포인트 로드 중...")
        esrs_dps = get_esrs_data_points(cursor)
        logger.info(f"ESRS 데이터 포인트: {len(esrs_dps)}개")
        
        if not gri_dps:
            logger.warning("GRI 데이터 포인트가 없습니다.")
            return
        
        if not esrs_dps:
            logger.warning("ESRS 데이터 포인트가 없습니다.")
            return
        
        # 매핑 찾기
        logger.info("")
        logger.info("=" * 60)
        logger.info("매핑 검색 시작")
        logger.info("=" * 60)
        mappings = find_mappings(
            cursor,
            gri_dps,
            esrs_dps,
            threshold=args.threshold,
            top_k=args.top_k
        )
        
        # 결과 출력
        logger.info("")
        logger.info("=" * 60)
        logger.info("매핑 결과 요약")
        logger.info("=" * 60)
        logger.info(f"총 매핑 수: {len(mappings)}")
        
        if mappings:
            # 유사도별 통계
            high_confidence = sum(1 for m in mappings if m['mapping_confidence'] == 'high')
            medium_confidence = sum(1 for m in mappings if m['mapping_confidence'] == 'medium')
            low_confidence = sum(1 for m in mappings if m['mapping_confidence'] == 'low')
            
            logger.info(f"  - High confidence (>=0.85): {high_confidence}개")
            logger.info(f"  - Medium confidence (>=0.75): {medium_confidence}개")
            logger.info(f"  - Low confidence (>=0.70): {low_confidence}개")
            
            # 최고 유사도 매핑 예시
            top_mapping = max(mappings, key=lambda x: x['similarity'])
            logger.info("")
            logger.info("최고 유사도 매핑 예시:")
            logger.info(f"  GRI: {top_mapping['gri_dp_id']} - {top_mapping['gri_name_ko']}")
            logger.info(f"  ESRS: {top_mapping['esrs_dp_id']}")
            logger.info(f"  유사도: {top_mapping['similarity']:.4f}")
        
        # 파일로 저장
        if args.output:
            output_path = Path(args.output)
            if output_path.suffix.lower() == '.csv':
                save_to_csv(mappings, str(output_path))
            elif output_path.suffix.lower() == '.json':
                save_to_json(mappings, str(output_path))
            else:
                logger.warning(f"지원하지 않는 파일 형식: {output_path.suffix}")
        
        # 데이터베이스 업데이트
        if args.update_db and not args.dry_run:
            logger.info("")
            logger.info("=" * 60)
            logger.info("equivalent_dps 필드 업데이트")
            logger.info("=" * 60)
            conn.commit()  # 읽기 작업 후 커밋
            update_equivalent_dps(cursor, mappings)
            conn.commit()
            logger.info("데이터베이스 업데이트 완료")
        elif args.update_db and args.dry_run:
            logger.info("--dry-run 모드: 데이터베이스 업데이트를 건너뜁니다.")
        
        logger.info("")
        logger.info("=" * 60)
        logger.info("작업 완료")
        logger.info("=" * 60)
    
    except Exception as e:
        logger.error(f"오류 발생: {e}", exc_info=True)
        if conn:
            conn.rollback()
        sys.exit(1)
    
    finally:
        if conn:
            conn.close()
            logger.info("데이터베이스 연결 종료")


if __name__ == "__main__":
    main()
