"""UnifiedColumnMapping 생성 스크립트

여러 기준서의 유사한 DataPoint를 통합하여 UnifiedColumnMapping을 생성합니다.

사용법:
    python create_unified_column_mappings.py --source GRI --targets ESRS IFRS_S2
    python create_unified_column_mappings.py --source GRI --targets ESRS IFRS_S2 --batch-size 40
    python create_unified_column_mappings.py --source GRI --targets ESRS IFRS_S2 --dry-run
"""
import sys
import os
from pathlib import Path
import argparse
from typing import List, Tuple, Dict, Any, Optional

# 프로젝트 루트를 경로에 추가
script_dir = Path(__file__).parent.resolve()
project_root = script_dir.parent.parent
sys.path.insert(0, str(project_root))

# .env 파일 로드
from dotenv import load_dotenv
env_path = project_root.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from loguru import logger

from ifrs_agent.service.mapping_suggestion_service import MappingSuggestionService
from ifrs_agent.model.models import DataPoint, UnifiedColumnMapping


def get_db_session():
    """데이터베이스 세션 생성"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL 환경 변수가 설정되지 않았습니다.")
    
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def calculate_vector_similarity(
    db,
    dp1: DataPoint,
    dp2: DataPoint
) -> float:
    """두 DataPoint 간의 벡터 유사도 계산
    
    Args:
        db: 데이터베이스 세션
        dp1: 첫 번째 DataPoint
        dp2: 두 번째 DataPoint
    
    Returns:
        코사인 유사도 (0.0 ~ 1.0)
    """
    if dp1.embedding is None or dp2.embedding is None:
        return 0.0
    
    embedding1_str = str(dp1.embedding.tolist() if hasattr(dp1.embedding, 'tolist') else list(dp1.embedding))
    embedding2_str = str(dp2.embedding.tolist() if hasattr(dp2.embedding, 'tolist') else list(dp2.embedding))
    
    query = text(f"""
        SELECT 1 - (
            '{embedding1_str}'::vector <=> '{embedding2_str}'::vector
        ) as similarity
    """)
    
    result = db.execute(query)
    row = result.first()
    return float(row.similarity) if row else 0.0


def find_similar_dps_multi_standards(
    db,
    source_dp: DataPoint,
    target_standards: List[str],
    threshold: float = 0.70,
    top_k_per_standard: int = 5
) -> List[Tuple[str, str, float]]:
    """여러 기준서에서 유사한 DP 찾기
    
    Args:
        db: 데이터베이스 세션
        source_dp: 원본 DataPoint 객체
        target_standards: 대상 기준서 리스트
        threshold: 유사도 임계값
        top_k_per_standard: 기준서당 반환할 상위 K개
    
    Returns:
        (target_dp_id, standard, similarity) 튜플 리스트
    """
    if source_dp.embedding is None:
        logger.warning(f"Source DP {source_dp.dp_id}의 임베딩이 없습니다.")
        return []
    
    if not target_standards:
        return []
    
    # PostgreSQL 벡터 검색 (Cosine 유사도)
    embedding_str = str(source_dp.embedding.tolist() if hasattr(source_dp.embedding, 'tolist') else list(source_dp.embedding))
    
    # 여러 기준서를 한 번에 조회
    standards_placeholders = ','.join([f"'{std}'" for std in target_standards])
    
    query = text(f"""
        SELECT 
            dp_id,
            standard,
            1 - (embedding <=> '{embedding_str}'::vector) as similarity
        FROM data_points
        WHERE standard IN ({standards_placeholders})
          AND is_active = TRUE
          AND embedding IS NOT NULL
          AND dp_id != :source_dp_id
        ORDER BY embedding <=> '{embedding_str}'::vector
        LIMIT :top_k
    """)
    
    result = db.execute(
        query,
        {
            "source_dp_id": source_dp.dp_id,
            "top_k": top_k_per_standard * len(target_standards) * 2
        }
    )
    
    # 기준서별로 그룹화하고 각 기준서당 top_k개 선택
    candidates_by_standard = {}
    for row in result:
        if row.similarity >= threshold:
            standard = row.standard
            if standard not in candidates_by_standard:
                candidates_by_standard[standard] = []
            candidates_by_standard[standard].append((row.dp_id, standard, float(row.similarity)))
    
    # 각 기준서당 top_k개만 선택
    final_candidates = []
    for standard in target_standards:
        if standard in candidates_by_standard:
            candidates = sorted(candidates_by_standard[standard], key=lambda x: x[2], reverse=True)
            final_candidates.extend(candidates[:top_k_per_standard])
    
    return final_candidates


def validate_topic_compatibility(
    source_dp: DataPoint,
    target_dp: DataPoint
) -> bool:
    """Topic 호환성 검증
    
    Args:
        source_dp: 원본 DataPoint
        target_dp: 대상 DataPoint
    
    Returns:
        호환 가능 여부
    """
    if not source_dp.topic or not target_dp.topic:
        return True  # Topic이 없으면 통과
    
    # MappingSuggestionService의 호환성 검증 사용
    # 여기서는 간단한 검증만 수행 (서비스 인스턴스가 필요하면 파라미터로 전달)
    source_topic_lower = source_dp.topic.lower()
    target_topic_lower = target_dp.topic.lower()
    
    # 명시적 불일치 조합 확인
    incompatible_pairs = [
        ("policies and actions", "일반 공시"),
        ("policies and actions", "거버넌스"),
        ("policies and actions", "지배구조"),
        ("정책", "일반 공시"),
        ("정책", "거버넌스"),
        ("정책", "지배구조"),
    ]
    
    for src_topic, tgt_topic in incompatible_pairs:
        if src_topic in source_topic_lower and tgt_topic in target_topic_lower:
            return False
        if tgt_topic in source_topic_lower and src_topic in target_topic_lower:
            return False
    
    return True


def create_unified_column_mapping(
    db,
    service: MappingSuggestionService,
    source_dp_id: str,
    target_standards: List[str],
    vector_threshold: float = 0.70,
    structural_threshold: float = 0.50,
    final_threshold: float = 0.75,
    min_mapping_count: int = 2
) -> Tuple[Optional[UnifiedColumnMapping], Dict[str, int]]:
    """UnifiedColumnMapping 생성
    
    Args:
        db: 데이터베이스 세션
        service: MappingSuggestionService 인스턴스
        source_dp_id: 원본 DP ID
        target_standards: 대상 기준서 리스트
        vector_threshold: 벡터 검색 임계값
        structural_threshold: 구조적 점수 임계값
        final_threshold: 최종 점수 임계값
        min_mapping_count: 최소 매핑 개수
    
    Returns:
        생성된 UnifiedColumnMapping 또는 None
    """
    # 1. Source DP 조회
    source_dp = db.query(DataPoint).filter(
        DataPoint.dp_id == source_dp_id,
        DataPoint.is_active == True
    ).first()
    
    validation_stats = {
        "cross_validation_failed": 0
    }
    
    if not source_dp:
        logger.warning(f"Source DP를 찾을 수 없습니다: {source_dp_id}")
        return None, validation_stats
    
    # 2. 여러 기준서에서 유사한 DP 찾기
    vector_candidates = find_similar_dps_multi_standards(
        db,
        source_dp,
        target_standards,
        threshold=vector_threshold,
        top_k_per_standard=3
    )
    
    if not vector_candidates:
        logger.debug(f"벡터 검색 결과 없음: {source_dp_id}")
        return None, validation_stats
    
    # 3-1. 첫 번째 단계: source_dp와 각 target_dp 간의 유사성 확인
    # 먼저 모든 target_dp를 조회
    target_dp_list = []
    for target_dp_id, target_standard, vector_similarity in vector_candidates:
        target_dp = db.query(DataPoint).filter(
            DataPoint.dp_id == target_dp_id,
            DataPoint.is_active == True
        ).first()
        
        if not target_dp:
            continue
        
        target_dp_list.append((target_dp_id, target_standard, vector_similarity, target_dp))
    
    if not target_dp_list:
        logger.debug(f"유효한 Target DP 없음: {source_dp_id}")
        return None, validation_stats
    
    # 여러 Target DP의 description을 한 번에 LLM에 전달하여 유사도 계산
    source_description = source_dp.description or ""
    target_descriptions = [
        (dp_id, std, dp_obj.description or "")
        for dp_id, std, _, dp_obj in target_dp_list
    ]
    
    # LLM을 사용하여 여러 Target DP와 Source DP의 유사도를 한 번에 계산
    llm_similarities = {}
    if service.use_llm_for_keywords and source_description:
        llm_similarities = service._calculate_keyword_match_with_llm_multi(
            source_description, target_descriptions
        )
    
    # 각 Target DP에 대해 구조적 점수 계산 및 종합 점수 계산
    candidate_dps = []  # (dp_id, standard, final_score, dp_obj) 튜플 리스트
    for target_dp_id, target_standard, vector_similarity, target_dp in target_dp_list:
        # 맥락 검증: Topic/Subtopic 불일치 감지
        if not validate_topic_compatibility(source_dp, target_dp):
            logger.debug(f"Topic 불일치로 제외: {source_dp_id} ({source_dp.topic}) vs {target_dp_id} ({target_dp.topic})")
            continue
        
        # 구조적 점수 계산
        structural_score, match_details = service._calculate_structural_match(
            source_dp, target_dp
        )
        
        # LLM에서 계산된 키워드 매칭 점수가 있으면 구조적 점수 재계산
        if target_dp_id in llm_similarities:
            # 구조적 점수 구성: 카테고리(10%) + 단위(15%) + 주제(30%) + Topic/Subtopic(20%) + 키워드(35%) = 100%
            # 기존 키워드 매칭 점수를 LLM 결과로 대체
            original_keyword_score = match_details.get("keyword_match", 0.0)
            llm_keyword_score = llm_similarities[target_dp_id]
            
            # 구조적 점수에서 키워드 부분만 교체
            # 구조적 점수는 정규화된 값이므로, 키워드 부분만 교체
            keyword_diff = (llm_keyword_score - original_keyword_score) * 0.35
            structural_score = structural_score + keyword_diff
            structural_score = max(0.0, min(1.0, structural_score))  # 0.0 ~ 1.0 범위로 제한
            
            match_details["keyword_match"] = llm_keyword_score
            match_details["keyword_match_source"] = "llm_multi"
        
        # Topic/Subtopic 유사성이 너무 낮으면 추가 필터링
        topic_subtopic_similarity = match_details.get("topic_subtopic_similarity", 1.0)
        if topic_subtopic_similarity < 0.3:  # Topic이 호환되지 않으면 제외
            logger.debug(f"Topic/Subtopic 유사도 낮음으로 제외: {source_dp_id} vs {target_dp_id} (유사도: {topic_subtopic_similarity:.3f})")
            continue
        
        if structural_score < structural_threshold:
            continue
        
        # 종합 점수 계산
        final_score = (vector_similarity * 0.7) + (structural_score * 0.3)
        
        if final_score >= final_threshold:
            candidate_dps.append((target_dp_id, target_standard, final_score, target_dp))
    
    if not candidate_dps:
        logger.debug(f"후보 DP 없음: {source_dp_id}")
        return None, validation_stats
    
    # 3-2. 두 번째 단계: 매핑된 DP들 간의 상호 유사성 검증
    # 각 기준서에서 최고 점수 DP만 선택하고, 서로 간의 유사성도 확인
    validated_dps = []
    mapped_dps = []
    applicable_standards = set([source_dp.standard])
    mapping_confidences = []
    
    # 점수 순으로 정렬
    candidate_dps.sort(key=lambda x: x[2], reverse=True)
    
    for dp_id, standard, score, dp_obj in candidate_dps:
        # 같은 기준서에서 이미 선택된 DP가 있으면 스킵 (최고 점수만 유지)
        if any(v[1] == standard for v in validated_dps):
            continue
        
        # 다른 기준서의 DP들과도 유사한지 확인
        is_valid = True
        for validated_id, validated_std, validated_score, validated_dp in validated_dps:
            if validated_std != standard:
                # 서로 다른 기준서의 DP들 간 유사성 확인
                cross_structural_score, _ = service._calculate_structural_match(
                    dp_obj, validated_dp
                )
                cross_vector_sim = calculate_vector_similarity(db, dp_obj, validated_dp)
                cross_final = (cross_vector_sim * 0.7) + (cross_structural_score * 0.3)
                
                # 약간 낮은 임계값 사용 (final_threshold의 80%)
                cross_threshold = final_threshold * 0.8
                if cross_final < cross_threshold:
                    logger.debug(
                        f"상호 유사성 검증 실패: {dp_id} ({standard}) <-> {validated_id} ({validated_std}) "
                        f"(유사도: {cross_final:.3f} < {cross_threshold:.3f})"
                    )
                    validation_stats["cross_validation_failed"] += 1
                    is_valid = False
                    break
        
        if is_valid:
            validated_dps.append((dp_id, standard, score, dp_obj))
            mapped_dps.append(dp_id)
            applicable_standards.add(standard)
            mapping_confidences.append(score)
    
    # Source DP도 포함
    if source_dp_id not in mapped_dps:
        mapped_dps.insert(0, source_dp_id)
    
    # 최소 매핑 개수 확인
    if len(mapped_dps) < min_mapping_count:
        logger.debug(f"매핑 개수 부족: {len(mapped_dps)}개 (최소: {min_mapping_count}개)")
        return None, validation_stats
    
    # 4. UnifiedColumnMapping 생성
    unified_column_id = f"UCM_{source_dp.dp_id.replace('-', '_')}"
    
    # 평균 신뢰도 계산
    avg_confidence = sum(mapping_confidences) / len(mapping_confidences) if mapping_confidences else 0.0
    
    unified_mapping = UnifiedColumnMapping(
        unified_column_id=unified_column_id,
        column_name_ko=source_dp.name_ko,
        column_name_en=source_dp.name_en,
        column_description=source_dp.description,
        column_category=source_dp.category,
        column_topic=source_dp.topic,
        column_subtopic=source_dp.subtopic,
        primary_standard=source_dp.standard,
        applicable_standards=list(applicable_standards),
        mapped_dp_ids=mapped_dps,
        mapping_confidence=avg_confidence,
        column_type=source_dp.dp_type,
        unit=source_dp.unit,
        disclosure_requirement=source_dp.disclosure_requirement,
        reporting_frequency=source_dp.reporting_frequency,
        financial_linkages=source_dp.financial_linkages,
        financial_impact_type=source_dp.financial_impact_type,
        unified_embedding=source_dp.embedding
    )
    
    return unified_mapping, validation_stats


def main():
    """메인 실행 함수"""
    parser = argparse.ArgumentParser(
        description="UnifiedColumnMapping 생성 (여러 기준서 통합)"
    )
    parser.add_argument(
        "--source",
        type=str,
        default="GRI",
        help="원본 기준서 (기본: GRI)"
    )
    parser.add_argument(
        "--targets",
        type=str,
        nargs="+",
        default=["ESRS", "IFRS_S2"],
        help="대상 기준서 리스트 (기본: ESRS IFRS_S2)"
    )
    parser.add_argument(
        "--vector-threshold",
        type=float,
        default=0.70,
        help="벡터 검색 임계값 (기본: 0.70)"
    )
    parser.add_argument(
        "--structural-threshold",
        type=float,
        default=0.50,
        help="구조적 점수 임계값 (기본: 0.50)"
    )
    parser.add_argument(
        "--final-threshold",
        type=float,
        default=0.75,
        help="최종 점수 임계값 (기본: 0.75)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=40,
        help="한 번에 처리할 DP 수 (기본: 40)"
    )
    parser.add_argument(
        "--min-mapping-count",
        type=int,
        default=2,
        help="최소 매핑 개수 (기본: 2)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="실제 저장 없이 테스트"
    )
    
    args = parser.parse_args()
    
    try:
        db = get_db_session()
        logger.info("데이터베이스 연결 성공")
        
        service = MappingSuggestionService(db)
        
        logger.info("=" * 60)
        logger.info("UnifiedColumnMapping 생성 시작")
        logger.info("=" * 60)
        logger.info(f"원본 기준서: {args.source}")
        logger.info(f"대상 기준서: {args.targets}")
        logger.info(f"벡터 임계값: {args.vector_threshold}")
        logger.info(f"구조적 임계값: {args.structural_threshold}")
        logger.info(f"최종 임계값: {args.final_threshold}")
        logger.info(f"배치 크기: {args.batch_size}")
        logger.info(f"최소 매핑 개수: {args.min_mapping_count}")
        if args.dry_run:
            logger.info("DRY-RUN 모드: 실제 저장 없이 테스트")
        logger.info("=" * 60)
        
        stats = {
            "processed": 0,
            "created": 0,
            "updated": 0,
            "skipped_low_mapping_count": 0,
            "skipped_cross_validation": 0,
            "errors": 0
        }
        
        # 처리할 DP 조회
        pending_dps = db.query(DataPoint).filter(
            DataPoint.standard == args.source,
            DataPoint.is_active == True,
            DataPoint.embedding.isnot(None)
        ).limit(args.batch_size).all()
        
        logger.info(f"처리할 DP: {len(pending_dps)}개 ({args.source} -> {args.targets})")
        
        for source_dp in pending_dps:
            stats["processed"] += 1
            
            try:
                unified_mapping, validation_stats_result = create_unified_column_mapping(
                    db,
                    service,
                    source_dp.dp_id,
                    target_standards=args.targets,
                    vector_threshold=args.vector_threshold,
                    structural_threshold=args.structural_threshold,
                    final_threshold=args.final_threshold,
                    min_mapping_count=args.min_mapping_count
                )
                
                if not unified_mapping:
                    stats["skipped_low_mapping_count"] += 1
                    continue
                
                # 상호 검증 실패 통계 추가
                stats["skipped_cross_validation"] += validation_stats_result.get("cross_validation_failed", 0)
                
                if not args.dry_run:
                    # 기존 매핑 확인
                    existing = db.query(UnifiedColumnMapping).filter(
                        UnifiedColumnMapping.unified_column_id == unified_mapping.unified_column_id
                    ).first()
                    
                    if existing:
                        # 업데이트
                        for key, value in unified_mapping.__dict__.items():
                            if not key.startswith('_') and key != 'unified_column_id':
                                setattr(existing, key, value)
                        stats["updated"] += 1
                        logger.debug(f"업데이트: {unified_mapping.unified_column_id} (매핑: {len(unified_mapping.mapped_dp_ids)}개)")
                    else:
                        # 생성
                        db.add(unified_mapping)
                        stats["created"] += 1
                        logger.debug(f"생성: {unified_mapping.unified_column_id} (매핑: {len(unified_mapping.mapped_dp_ids)}개)")
                else:
                    logger.debug(f"[DRY-RUN] 생성 예정: {unified_mapping.unified_column_id} (매핑: {len(unified_mapping.mapped_dp_ids)}개)")
                    stats["created"] += 1
                    
            except Exception as e:
                logger.error(f"UnifiedColumnMapping 생성 실패: {source_dp.dp_id}, 오류: {e}")
                stats["errors"] += 1
                try:
                    db.rollback()
                except Exception:
                    pass
                continue
        
        # 커밋
        if not args.dry_run:
            try:
                db.commit()
                logger.info(f"✅ {stats['processed']}개 DP 처리 완료:")
                logger.info(f"   - 생성: {stats['created']}개")
                logger.info(f"   - 업데이트: {stats['updated']}개")
                logger.info(f"   - 건너뜀 (매핑 부족): {stats['skipped_low_mapping_count']}개")
                logger.info(f"   - 상호 검증 실패: {stats['skipped_cross_validation']}개")
            except Exception as e:
                db.rollback()
                logger.error(f"❌ 커밋 실패: {e}")
                raise
        
        logger.info("=" * 60)
        logger.info("처리 결과:")
        logger.info(f"  처리된 DP: {stats['processed']}개")
        logger.info(f"  생성: {stats['created']}개")
        logger.info(f"  업데이트: {stats['updated']}개")
        logger.info(f"  건너뜀 (매핑 부족): {stats['skipped_low_mapping_count']}개")
        logger.info(f"  상호 검증 실패: {stats['skipped_cross_validation']}개")
        logger.info(f"  오류: {stats['errors']}개")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if 'db' in locals():
            db.close()


if __name__ == "__main__":
    main()


