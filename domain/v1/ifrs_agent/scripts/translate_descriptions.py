"""JSON 파일의 description 필드에 있는 영문을 한글로 번역하는 스크립트

사용법:
    python translate_descriptions.py
"""
import sys
import os
import json
from pathlib import Path
from typing import Dict, Any, List
import re

# 프로젝트 루트를 경로에 추가
script_dir = Path(__file__).parent.resolve()
project_root = script_dir.parent.parent
sys.path.insert(0, str(project_root))

# .env 파일 로드
from dotenv import load_dotenv
env_path = project_root.parent / ".env"
if env_path.exists():
    try:
        load_dotenv(env_path, encoding='utf-8')
    except UnicodeDecodeError:
        try:
            load_dotenv(env_path, encoding='utf-16')
        except Exception:
            load_dotenv(env_path)

from loguru import logger

# 로거 설정
logger.remove()
logger.add(
    sys.stdout,
    format='<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <level>{message}</level>',
    level='INFO'
)


def has_english_text(text: str) -> bool:
    """텍스트에 영문이 포함되어 있는지 확인"""
    if not text:
        return False
    # 한글이 없고 영문이 있으면 영문으로 판단
    has_korean = bool(re.search(r'[가-힣]', text))
    has_english = bool(re.search(r'[A-Za-z]', text))
    
    # 영문이 있고 한글이 없거나, 영문이 많으면 영문으로 판단
    if has_english and not has_korean:
        return True
    # 혼합된 경우 영문 비율이 높으면 영문으로 판단
    if has_english and has_korean:
        english_chars = len(re.findall(r'[A-Za-z]', text))
        korean_chars = len(re.findall(r'[가-힣]', text))
        if english_chars > korean_chars * 2:  # 영문이 한글의 2배 이상
            return True
    
    return False


def translate_with_llm(text: str) -> str:
    """LLM을 사용하여 영문을 한글로 번역"""
    try:
        groq_api_key = os.getenv("GROQ_API_KEY")
        if not groq_api_key:
            logger.warning("GROQ_API_KEY가 설정되지 않아 번역을 건너뜁니다.")
            return text
        
        from groq import Groq
        client = Groq(api_key=groq_api_key)
        
        prompt = f"""다음 ESRS(European Sustainability Reporting Standards) 데이터 포인트 설명을 전문적이고 정확한 한국어로 번역하세요.

원문:
{text}

**번역 규칙:**
1. ESRS 전문 용어는 정확히 번역 (예: "undertaking" → "기업", "sustainability statement" → "지속가능성 보고서")
2. 법률 조항 참조는 그대로 유지 (예: "Para 3", "Directive 2013/34/EU")
3. 기술적 용어는 표준 한국어 용어 사용
4. 자연스럽고 읽기 쉬운 한국어로 번역
5. 원문의 구조와 의미를 정확히 보존

번역:"""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=500,
            timeout=15
        )
        
        translated = response.choices[0].message.content.strip()
        
        # 프롬프트 잔여 제거
        translated = re.sub(r'^번역\s*:?\s*', '', translated, flags=re.IGNORECASE)
        translated = translated.strip()
        
        return translated
        
    except Exception as e:
        logger.warning(f"LLM 번역 실패: {e}")
        return text


def translate_descriptions_in_file(file_path: Path, dry_run: bool = False) -> Dict[str, int]:
    """JSON 파일의 description 필드를 번역
    
    Args:
        file_path: JSON 파일 경로
        dry_run: 실제 저장 없이 테스트
    
    Returns:
        통계 딕셔너리
    """
    stats = {
        "total": 0,
        "translated": 0,
        "skipped": 0,
        "errors": 0
    }
    
    logger.info(f"파일 로드 중: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # data_points 추출
    if isinstance(data, dict) and "data_points" in data:
        data_points = data["data_points"]
    elif isinstance(data, list):
        data_points = data
    else:
        logger.error("JSON 형식이 올바르지 않습니다")
        return stats
    
    stats["total"] = len(data_points)
    logger.info(f"총 {stats['total']}개 데이터 포인트 확인")
    
    for i, dp in enumerate(data_points, 1):
        dp_id = dp.get("dp_id", "")
        description = dp.get("description", "")
        
        if not description:
            continue
        
        # 영문이 포함되어 있는지 확인
        if not has_english_text(description):
            stats["skipped"] += 1
            continue
        
        try:
            logger.info(f"[{i}/{stats['total']}] {dp_id}: 번역 중...")
            
            if dry_run:
                logger.info(f"  원문: {description[:100]}...")
                logger.info(f"  [DRY-RUN] 번역 건너뜀")
                stats["translated"] += 1
                continue
            
            # LLM으로 번역
            translated = translate_with_llm(description)
            
            if translated and translated != description:
                dp["description"] = translated
                stats["translated"] += 1
                logger.info(f"  ✓ 번역 완료")
            else:
                logger.warning(f"  번역 결과가 원문과 동일하거나 비어있음")
                stats["skipped"] += 1
                
        except Exception as e:
            logger.error(f"  ✗ 번역 실패: {e}")
            stats["errors"] += 1
            continue
    
    # 파일 저장
    if not dry_run and stats["translated"] > 0:
        logger.info(f"\n파일 저장 중...")
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        logger.info(f"파일 저장 완료: {file_path}")
    
    return stats


def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description="JSON 파일의 description 영문을 한글로 번역")
    parser.add_argument(
        "--file",
        type=str,
        default="ai/ifrs_agent/data/esrs/esrs_e1/data_point copy.json",
        help="번역할 JSON 파일 경로"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="실제 저장 없이 테스트"
    )
    
    args = parser.parse_args()
    
    file_path = Path(args.file)
    if not file_path.exists():
        logger.error(f"파일을 찾을 수 없습니다: {file_path}")
        sys.exit(1)
    
    logger.info("=" * 60)
    logger.info("Description 번역 스크립트")
    logger.info("=" * 60)
    
    if args.dry_run:
        logger.info("DRY-RUN 모드: 실제 저장 없이 테스트")
    
    stats = translate_descriptions_in_file(file_path, dry_run=args.dry_run)
    
    logger.info("\n" + "=" * 60)
    logger.info("번역 결과:")
    logger.info(f"  총 항목: {stats['total']}개")
    logger.info(f"  번역 완료: {stats['translated']}개")
    logger.info(f"  건너뜀: {stats['skipped']}개")
    logger.info(f"  오류: {stats['errors']}개")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()

