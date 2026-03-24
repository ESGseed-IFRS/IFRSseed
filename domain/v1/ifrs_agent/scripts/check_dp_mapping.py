"""data_point.json의 dp_id와 rulebook.json의 primary_dp_id 매칭 확인 스크립트

이 스크립트는 다음을 확인합니다:
1. rulebook.json의 primary_dp_id가 data_point.json의 dp_id에 존재하는지
2. 매칭되지 않는 primary_dp_id 목록 출력

사용법:
    python check_dp_mapping.py
    python check_dp_mapping.py --data-dir esrs/esrs_e1  # 특정 디렉토리 지정
"""
import sys
import json
from pathlib import Path
from typing import Set, List, Dict, Any
import argparse

# 프로젝트 루트를 경로에 추가
script_dir = Path(__file__).parent.resolve()
project_root = script_dir.parent.parent  # ai/ 디렉토리
sys.path.insert(0, str(project_root))


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


def load_data_points(data_dir: Path) -> Dict[str, Dict[str, Any]]:
    """data_point.json에서 모든 dp_id 추출"""
    data_point_path = data_dir / "data_point.json"
    
    if not data_point_path.exists():
        logger.error(f"data_point.json 파일을 찾을 수 없습니다: {data_point_path}")
        return {}
    
    logger.info(f"data_point.json 로드 중: {data_point_path}")
    
    with open(data_point_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # data_points 키에서 데이터 추출
    if isinstance(data, dict) and "data_points" in data:
        data_points = data["data_points"]
    elif isinstance(data, list):
        data_points = data
    else:
        logger.error("data_point.json 형식이 올바르지 않습니다")
        return {}
    
    # dp_id를 키로 하는 딕셔너리 생성
    dp_dict = {}
    for dp in data_points:
        dp_id = dp.get("dp_id")
        if dp_id:
            dp_dict[dp_id] = dp
    
    logger.info(f"총 {len(dp_dict)}개의 데이터 포인트 로드 완료")
    return dp_dict


def load_rulebooks(data_dir: Path) -> List[Dict[str, Any]]:
    """rulebook.json에서 모든 rulebook 로드"""
    rulebook_path = data_dir / "rulebook.json"
    
    if not rulebook_path.exists():
        # rulebooks.json도 시도
        rulebook_path = data_dir / "rulebooks.json"
        if not rulebook_path.exists():
            logger.error(f"rulebook.json 또는 rulebooks.json 파일을 찾을 수 없습니다: {data_dir}")
            return []
    
    logger.info(f"rulebook.json 로드 중: {rulebook_path}")
    
    with open(rulebook_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # rulebooks 키에서 데이터 추출
    if isinstance(data, dict) and "rulebooks" in data:
        rulebooks = data["rulebooks"]
    elif isinstance(data, list):
        rulebooks = data
    else:
        logger.error("rulebook.json 형식이 올바르지 않습니다")
        return []
    
    logger.info(f"총 {len(rulebooks)}개의 rulebook 로드 완료")
    return rulebooks


def check_mapping(data_dir: Path) -> Dict[str, Any]:
    """dp_id와 primary_dp_id 매칭 확인"""
    # 데이터 로드
    dp_dict = load_data_points(data_dir)
    rulebooks = load_rulebooks(data_dir)
    
    if not dp_dict or not rulebooks:
        logger.error("데이터 로드 실패")
        return {}
    
    # 매칭 확인
    unmatched = []
    matched = []
    null_primary_dp_ids = []
    
    for rulebook in rulebooks:
        primary_dp_id = rulebook.get("primary_dp_id")
        rulebook_id = rulebook.get("rulebook_id", "")
        standard_id = rulebook.get("standard_id", "")
        section_name = rulebook.get("section_name", "")
        
        if not primary_dp_id:
            null_primary_dp_ids.append({
                "rulebook_id": rulebook_id,
                "standard_id": standard_id,
                "section_name": section_name
            })
        elif primary_dp_id not in dp_dict:
            unmatched.append({
                "rulebook_id": rulebook_id,
                "standard_id": standard_id,
                "section_name": section_name,
                "primary_dp_id": primary_dp_id
            })
        else:
            matched.append({
                "rulebook_id": rulebook_id,
                "primary_dp_id": primary_dp_id,
                "dp_name": dp_dict[primary_dp_id].get("name_ko", "")
            })
    
    return {
        "total_rulebooks": len(rulebooks),
        "matched": matched,
        "unmatched": unmatched,
        "null_primary_dp_ids": null_primary_dp_ids,
        "total_dp_ids": len(dp_dict)
    }


def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(
        description="data_point.json의 dp_id와 rulebook.json의 primary_dp_id 매칭 확인"
    )
    parser.add_argument(
        "--data-dir",
        type=str,
        default="esrs/esrs_e1",
        help="데이터 디렉토리 경로 (기본값: esrs/esrs_e1)"
    )
    
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("DP ID 매칭 확인 스크립트")
    logger.info("=" * 60)
    
    # 데이터 디렉토리 경로 설정
    data_dir = script_dir.parent / "data" / args.data_dir
    
    if not data_dir.exists():
        logger.error(f"데이터 디렉토리를 찾을 수 없습니다: {data_dir}")
        sys.exit(1)
    
    logger.info(f"데이터 디렉토리: {data_dir}")
    
    # 매칭 확인
    result = check_mapping(data_dir)
    
    if not result:
        logger.error("매칭 확인 실패")
        sys.exit(1)
    
    # 결과 출력
    logger.info("\n" + "=" * 60)
    logger.info("매칭 결과 요약")
    logger.info("=" * 60)
    logger.info(f"총 Rulebook 수: {result['total_rulebooks']}개")
    logger.info(f"총 Data Point 수: {result['total_dp_ids']}개")
    logger.info(f"매칭된 Rulebook: {len(result['matched'])}개")
    logger.info(f"매칭되지 않은 Rulebook: {len(result['unmatched'])}개")
    logger.info(f"primary_dp_id가 NULL인 Rulebook: {len(result['null_primary_dp_ids'])}개")
    
    # 매칭되지 않은 항목 상세 출력
    if result['unmatched']:
        logger.info("\n" + "=" * 60)
        logger.info("매칭되지 않은 primary_dp_id 목록:")
        logger.info("=" * 60)
        for item in result['unmatched']:
            logger.warning(
                f"Rulebook ID: {item['rulebook_id']}, "
                f"Standard: {item['standard_id']}, "
                f"Section: {item['section_name'][:50]}, "
                f"Primary DP ID: {item['primary_dp_id']}"
            )
    
    # primary_dp_id가 NULL인 항목 출력
    if result['null_primary_dp_ids']:
        logger.info("\n" + "=" * 60)
        logger.info("primary_dp_id가 NULL인 Rulebook 목록:")
        logger.info("=" * 60)
        for item in result['null_primary_dp_ids']:
            logger.info(
                f"Rulebook ID: {item['rulebook_id']}, "
                f"Standard: {item['standard_id']}, "
                f"Section: {item['section_name'][:50]}"
            )
    
    logger.info("\n" + "=" * 60)
    
    # 매칭되지 않은 항목이 있으면 경고
    if result['unmatched']:
        logger.warning(f"\n⚠️  {len(result['unmatched'])}개의 매칭되지 않은 primary_dp_id가 있습니다!")
        sys.exit(1)
    else:
        logger.info("✅ 모든 primary_dp_id가 data_point.json의 dp_id와 매칭됩니다!")


if __name__ == "__main__":
    main()
