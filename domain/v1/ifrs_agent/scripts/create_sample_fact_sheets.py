"""샘플 팩트 시트 생성 스크립트 (테스트용)

DB에서 Data Point를 읽어서 샘플 팩트 시트 JSON 파일을 생성합니다.
"""
import sys
import json
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(project_root / "ai"))

from ifrs_agent.database.base import get_session
from ifrs_agent.model.models import DataPoint
from loguru import logger


def create_sample_fact_sheets(
    target_standard: str = "IFRS_S2",
    limit: int = 10,
    output_path: str = "sample_fact_sheets.json"
):
    """DB에서 Data Point를 읽어서 샘플 팩트 시트 생성"""
    db = get_session()
    
    try:
        query = db.query(DataPoint).filter(DataPoint.is_active == True)
        
        if target_standard:
            query = query.filter(DataPoint.standard == target_standard)
        
        dps = query.limit(limit).all()
        
        logger.info(f"📊 DB에서 {len(dps)}개 DP 조회")
        
        fact_sheets = []
        for dp in dps:
            # 샘플 값 생성 (실제로는 RAG Node에서 추출된 값이 필요)
            # 여기서는 테스트용 더미 값 사용
            fact_sheet = {
                "dp_id": dp.dp_id,
                "dp_name": dp.name_ko,
                "description": dp.description or "",
                "unit": dp.unit.value if dp.unit else None,
                "values": {
                    # 실제 값은 RAG Node에서 추출해야 함
                    # 여기서는 더미 값 사용 (테스트용)
                    2022: 100,
                    2023: 95,
                    2024: 90
                },
                "source": "database",
                "page_reference": f"p.{dp.page}" if dp.page else "",
                "topic": dp.topic,
                "subtopic": dp.subtopic,
                "financial_impact_type": dp.financial_impact_type,
                "confidence": 0.8  # 더미 신뢰도
            }
            fact_sheets.append(fact_sheet)
        
        # JSON 파일로 저장
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(fact_sheets, f, ensure_ascii=False, indent=2)
        
        logger.info(f"✅ 샘플 팩트 시트 생성 완료: {output_path} ({len(fact_sheets)}개)")
        return fact_sheets
    
    except Exception as e:
        logger.error(f"❌ 샘플 팩트 시트 생성 실패: {e}")
        return []
    
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="샘플 팩트 시트 생성")
    parser.add_argument(
        "--standard",
        type=str,
        default="IFRS_S2",
        help="기준서 코드"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="생성할 최대 개수"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="sample_fact_sheets.json",
        help="출력 JSON 파일 경로"
    )
    
    args = parser.parse_args()
    
    create_sample_fact_sheets(
        args.standard,
        args.limit,
        args.output
    )

