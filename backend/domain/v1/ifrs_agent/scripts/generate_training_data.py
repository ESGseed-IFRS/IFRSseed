"""학습 데이터(JSONL) 자동 생성 스크립트

팩트 시트를 기반으로 IFRS 문체의 문단을 생성하여 학습 데이터를 만듭니다.
"""
import os
import sys
import json
import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

from dotenv import load_dotenv
from loguru import logger

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(project_root / "ai"))

# .env 파일 로드
env_path = project_root / ".env"
if env_path.exists():
    load_dotenv(env_path)

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    logger.warning("Groq 라이브러리가 설치되지 않았습니다. pip install groq 필요")


class TrainingDataGenerator:
    """학습 데이터 생성기"""
    
    def __init__(self, model: str = "llama-3.3-70b-versatile"):
        """초기화"""
        self.model = model
        self.client = None
        
        groq_api_key = os.getenv("GROQ_API_KEY")
        if groq_api_key and GROQ_AVAILABLE:
            try:
                self.client = Groq(api_key=groq_api_key)
                logger.info(f"✅ Groq 클라이언트 초기화 완료 (모델: {model})")
            except Exception as e:
                logger.error(f"❌ Groq 클라이언트 초기화 실패: {e}")
        else:
            logger.warning("⚠️ GROQ_API_KEY가 설정되지 않았거나 Groq 라이브러리가 없습니다.")
    
    def format_fact_sheet(self, fact_sheet: Dict[str, Any]) -> str:
        """팩트 시트를 텍스트로 포맷팅"""
        lines = [
            f"### DP: {fact_sheet.get('dp_id', 'Unknown')}",
            f"이름: {fact_sheet.get('dp_name', 'Unknown')}",
        ]
        
        # 설명이 있으면 추가
        if fact_sheet.get("description"):
            lines.append(f"설명: {fact_sheet.get('description')[:200]}")
        
        # 단위
        if fact_sheet.get("unit"):
            lines.append(f"단위: {fact_sheet.get('unit')}")
        
        # 연도별 값
        values = fact_sheet.get("values", {})
        if values:
            lines.append("\n연도별 값:")
            for year in sorted(values.keys()):
                value = values[year]
                unit = fact_sheet.get("unit", "")
                if unit:
                    lines.append(f"- {year}: {value} {unit}")
                else:
                    lines.append(f"- {year}: {value}")
            
            # 변화율 계산 (있는 경우)
            if len(values) >= 2:
                years = sorted(values.keys())
                if len(years) >= 2:
                    prev_year = years[-2]
                    curr_year = years[-1]
                    try:
                        prev_val = float(values[prev_year])
                        curr_val = float(values[curr_year])
                        if prev_val != 0:
                            change_rate = ((curr_val - prev_val) / prev_val) * 100
                            lines.append(f"\n변화율 ({prev_year} → {curr_year}): {change_rate:+.2f}%")
                    except (ValueError, TypeError):
                        pass
        
        # 출처
        if fact_sheet.get("source"):
            lines.append(f"\n출처: {fact_sheet.get('source')}")
        
        # 페이지 참조
        if fact_sheet.get("page_reference"):
            lines.append(f"페이지: {fact_sheet.get('page_reference')}")
        
        # 재무 영향 유형
        if fact_sheet.get("financial_impact_type"):
            lines.append(f"재무 영향: {fact_sheet.get('financial_impact_type')}")
        
        return "\n".join(lines)
    
    def generate_section_name(self, fact_sheet: Dict[str, Any], target_standard: str) -> str:
        """섹션 이름 생성"""
        dp_name = fact_sheet.get("dp_name", "Unknown")
        topic = fact_sheet.get("topic")
        
        if topic:
            return f"{topic} - {dp_name}"
        return dp_name
    
    def generate_instruction(
        self,
        fact_sheet: Dict[str, Any],
        target_standard: str = "IFRS_S2"
    ) -> str:
        """Instruction 생성"""
        section_name = self.generate_section_name(fact_sheet, target_standard)
        
        standard_map = {
            "IFRS_S1": "IFRS S1: 일반 요구사항",
            "IFRS_S2": "IFRS S2: 기후 관련 공시",
            "GRI": "GRI Standards",
            "TCFD": "TCFD",
            "SASB": "SASB"
        }
        
        standard_name = standard_map.get(target_standard, target_standard)
        
        return f"다음 팩트 시트 데이터를 기반으로 {standard_name}의 '{section_name}' 섹션을 작성하세요."
    
    def generate_output_with_llm(
        self,
        fact_sheet: Dict[str, Any],
        target_standard: str = "IFRS_S2",
        section_name: Optional[str] = None
    ) -> Optional[str]:
        """LLM을 사용하여 IFRS 문체의 output 문단 생성"""
        if not self.client:
            logger.error("Groq 클라이언트가 초기화되지 않았습니다.")
            return None
        
        fact_sheet_text = self.format_fact_sheet(fact_sheet)
        
        if not section_name:
            section_name = self.generate_section_name(fact_sheet, target_standard)
        
        # IFRS 문체 프롬프트
        prompt = f"""다음 팩트 시트를 기반으로 {target_standard} '{section_name}' 섹션을 작성하세요.

**작성 규칙:**
1. 재무적 연결성 명시 (재무제표 항목 연결)
2. 정량적 근거 포함 (수치, 출처, 연도)
3. 시계열 분석 (전년 대비 변화율, 추세 설명)
4. 객관적·전문적 IFRS 문체 유지
5. 그린워싱 표현 금지 (과장·모호한 약속 피함)
6. 구체적인 수치와 출처 명시
7. 재무적 영향이 있는 경우 재무제표 항목과 연결

**팩트 시트:**
{fact_sheet_text}

**출력 형식:**
- 전문적이고 객관적인 IFRS 문체로 작성
- 문단 형식 (3-5문장)
- 수치와 출처를 명확히 포함
- 재무적 영향이 있으면 재무제표 항목 언급

작성된 섹션:"""
        
        try:
            # 에러 처리 강화: 타임아웃 및 재시도
            max_retries = 2
            response = None
            
            for retry in range(max_retries):
                try:
                    response = self.client.chat.completions.create(
                        model=self.model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.3,  # 낮게 해서 일관성 ↑
                        max_tokens=800,
                        timeout=30  # 30초 타임아웃
                    )
                    break
                except Exception as retry_error:
                    if retry < max_retries - 1:
                        logger.warning(f"LLM 호출 재시도 {retry + 1}/{max_retries}: {retry_error}")
                        continue
                    raise
            
            if not response:
                logger.error("LLM 응답을 받지 못했습니다.")
                return None
            
            output_text = response.choices[0].message.content.strip()
            
            # 출력 후처리
            # 1. "작성된 섹션:" 같은 프롬프트 잔여 제거
            output_text = re.sub(r'^작성된\s*섹션\s*:?\s*', '', output_text, flags=re.IGNORECASE)
            output_text = re.sub(r'^출력\s*:?\s*', '', output_text, flags=re.IGNORECASE)
            
            # 2. 불필요한 설명 제거
            explanation_patterns = [
                r'^다음\s+팩트\s+시트',
                r'^팩트\s+시트\s+기반',
                r'^IFRS\s+문체로',
            ]
            for pattern in explanation_patterns:
                if re.search(pattern, output_text, re.IGNORECASE):
                    # 설명 부분 제거 (첫 문단만)
                    lines = output_text.split('\n')
                    filtered_lines = []
                    skip_explanation = True
                    for line in lines:
                        if skip_explanation and re.search(pattern, line, re.IGNORECASE):
                            continue
                        if skip_explanation and line.strip() and not re.search(r'^[가-힣]', line):
                            skip_explanation = False
                        if not skip_explanation or line.strip():
                            filtered_lines.append(line)
                    output_text = '\n'.join(filtered_lines)
                    break
            
            # 3. 빈 줄 정리
            output_text = re.sub(r'\n{3,}', '\n\n', output_text)
            output_text = output_text.strip()
            
            return output_text if output_text else None
            
        except Exception as e:
            logger.error(f"LLM 출력 생성 실패: {e}")
            return None
    
    def generate_jsonl_entry(
        self,
        fact_sheet: Dict[str, Any],
        target_standard: str = "IFRS_S2",
        use_llm: bool = True
    ) -> Optional[Dict[str, str]]:
        """JSONL 엔트리 생성"""
        fact_sheet_text = self.format_fact_sheet(fact_sheet)
        instruction = self.generate_instruction(fact_sheet, target_standard)
        
        if use_llm and self.client:
            output = self.generate_output_with_llm(fact_sheet, target_standard)
            if not output:
                logger.warning(f"⚠️ LLM 출력 생성 실패, 스킵: {fact_sheet.get('dp_id', 'Unknown')}")
                return None
        else:
            # LLM 없이 더미 출력 생성 (테스트용)
            output = f"""{fact_sheet.get('dp_name', 'Data Point')}에 대한 정보입니다.

연도별 값:
{chr(10).join(f"- {year}: {value} {fact_sheet.get('unit', '')}" for year, value in sorted(fact_sheet.get('values', {}).items()))}

출처: {fact_sheet.get('source', 'unknown')}"""
            logger.warning("⚠️ LLM을 사용하지 않아 더미 출력 생성")
        
        return {
            "instruction": instruction,
            "input": fact_sheet_text,
            "output": output
        }
    
    def generate_from_fact_sheets(
        self,
        fact_sheets: List[Dict[str, Any]],
        target_standard: str = "IFRS_S2",
        output_path: str = "training_data.jsonl",
        use_llm: bool = True,
        append: bool = False
    ) -> int:
        """팩트 시트 목록에서 학습 데이터 JSONL 생성"""
        if not fact_sheets:
            logger.warning("⚠️ 팩트 시트가 없습니다.")
            return 0
        
        mode = "a" if append else "w"
        saved_count = 0
        failed_count = 0
        
        logger.info(f"📝 학습 데이터 생성 시작: {len(fact_sheets)}개 팩트 시트")
        logger.info(f"   출력 파일: {output_path}")
        logger.info(f"   기준서: {target_standard}")
        logger.info(f"   LLM 사용: {use_llm}")
        
        with open(output_path, mode, encoding="utf-8") as f:
            for i, fact_sheet in enumerate(fact_sheets, 1):
                dp_id = fact_sheet.get("dp_id", f"unknown_{i}")
                logger.info(f"[{i}/{len(fact_sheets)}] 처리 중: {dp_id}")
                
                try:
                    jsonl_entry = self.generate_jsonl_entry(
                        fact_sheet,
                        target_standard,
                        use_llm=use_llm
                    )
                    
                    if jsonl_entry:
                        f.write(json.dumps(jsonl_entry, ensure_ascii=False) + "\n")
                        saved_count += 1
                        logger.info(f"✅ 저장 완료: {dp_id}")
                    else:
                        failed_count += 1
                        logger.warning(f"⚠️ 생성 실패: {dp_id}")
                
                except Exception as e:
                    failed_count += 1
                    logger.error(f"❌ 처리 실패 ({dp_id}): {e}")
        
        logger.info(f"📊 완료! 저장: {saved_count}개, 실패: {failed_count}개")
        return saved_count
    
    def generate_from_db(
        self,
        target_standard: Optional[str] = None,
        limit: int = 100,
        output_path: str = "training_data.jsonl",
        use_llm: bool = True
    ) -> int:
        """DB에서 Data Point를 읽어서 학습 데이터 생성"""
        try:
            from ifrs_agent.database.base import get_session
            from ifrs_agent.model.models import DataPoint
            
            db = get_session()
            try:
                query = db.query(DataPoint).filter(DataPoint.is_active == True)
                
                if target_standard:
                    query = query.filter(DataPoint.standard == target_standard)
                
                dps = query.limit(limit).all()
                
                logger.info(f"📊 DB에서 {len(dps)}개 DP 조회")
                
                # DP를 팩트 시트 형식으로 변환
                fact_sheets = []
                for dp in dps:
                    # 더미 값 생성 (실제로는 RAG Node에서 추출된 값이 필요)
                    fact_sheet = {
                        "dp_id": dp.dp_id,
                        "dp_name": dp.name_ko,
                        "description": dp.description or "",
                        "unit": dp.unit.value if dp.unit else None,
                        "values": {
                            # 실제 값은 RAG Node에서 추출해야 함
                            # 여기서는 더미 값 사용
                            2022: 100,
                            2023: 95,
                            2024: 90
                        },
                        "source": "database",
                        "page_reference": f"p.{dp.page}" if dp.page else "",
                        "topic": dp.topic,
                        "subtopic": dp.subtopic,
                        "financial_impact_type": dp.financial_impact_type
                    }
                    fact_sheets.append(fact_sheet)
                
                return self.generate_from_fact_sheets(
                    fact_sheets,
                    target_standard or "IFRS_S2",
                    output_path,
                    use_llm
                )
            
            finally:
                db.close()
        
        except Exception as e:
            logger.error(f"❌ DB에서 학습 데이터 생성 실패: {e}")
            return 0


def main():
    """메인 실행 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description="학습 데이터(JSONL) 자동 생성")
    parser.add_argument(
        "--fact-sheets-json",
        type=str,
        help="팩트 시트 JSON 파일 경로 (예: fact_sheets.json)"
    )
    parser.add_argument(
        "--from-db",
        action="store_true",
        help="DB에서 Data Point를 읽어서 생성 (더미 값 사용)"
    )
    parser.add_argument(
        "--standard",
        type=str,
        default="IFRS_S2",
        choices=["IFRS_S1", "IFRS_S2", "GRI", "TCFD", "SASB"],
        help="기준서 코드"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="training_data.jsonl",
        help="출력 JSONL 파일 경로"
    )
    parser.add_argument(
        "--no-llm",
        action="store_true",
        help="LLM을 사용하지 않고 더미 출력 생성 (테스트용)"
    )
    parser.add_argument(
        "--append",
        action="store_true",
        help="기존 파일에 추가 (기본값: 덮어쓰기)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="DB에서 읽을 최대 개수 (--from-db 사용 시)"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="llama-3.3-70b-versatile",
        help="사용할 LLM 모델"
    )
    
    args = parser.parse_args()
    
    # 생성기 초기화
    generator = TrainingDataGenerator(model=args.model)
    
    if args.fact_sheets_json:
        # JSON 파일에서 팩트 시트 읽기
        fact_sheets_path = Path(args.fact_sheets_json)
        if not fact_sheets_path.exists():
            logger.error(f"❌ 팩트 시트 파일을 찾을 수 없습니다: {fact_sheets_path}")
            return
        
        with open(fact_sheets_path, "r", encoding="utf-8") as f:
            fact_sheets = json.load(f)
        
        saved_count = generator.generate_from_fact_sheets(
            fact_sheets,
            args.standard,
            args.output,
            use_llm=not args.no_llm,
            append=args.append
        )
    
    elif args.from_db:
        # DB에서 읽기
        saved_count = generator.generate_from_db(
            args.standard,
            args.limit,
            args.output,
            use_llm=not args.no_llm
        )
    
    else:
        logger.error("❌ --fact-sheets-json 또는 --from-db 중 하나를 지정해야 합니다.")
        logger.info("사용법:")
        logger.info("  python -m ifrs_agent.scripts.generate_training_data --fact-sheets-json fact_sheets.json")
        logger.info("  python -m ifrs_agent.scripts.generate_training_data --from-db --standard IFRS_S2")
        return
    
    logger.info(f"✅ 완료! {saved_count}개 학습 데이터 생성됨: {args.output}")


if __name__ == "__main__":
    main()

