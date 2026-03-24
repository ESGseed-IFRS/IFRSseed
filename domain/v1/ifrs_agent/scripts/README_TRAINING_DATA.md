# 학습 데이터 생성 가이드

Gen Node 학습을 위한 JSONL 데이터를 자동으로 생성하는 방법입니다.

## 개요

이 스크립트는 팩트 시트를 기반으로 IFRS 문체의 문단을 생성하여 학습 데이터(JSONL)를 만듭니다.

**JSONL 형식:**
```json
{
  "instruction": "다음 팩트 시트 데이터를 기반으로 IFRS S2: 기후 관련 공시의 '기후 리스크 - Scope 1 배출량' 섹션을 작성하세요.",
  "input": "### DP: S2-29-a\n이름: Scope 1 온실가스 배출량\n단위: tCO2e\n\n연도별 값:\n- 2022: 1,500 tCO2e\n- 2023: 1,350 tCO2e\n- 2024: 1,200 tCO2e\n\n변화율 (2023 → 2024): -11.11%\n\n출처: 재무제표 주석",
  "output": "본사는 2024년 기준 Scope 1 온실가스 배출량이 1,200 tCO2e로 집계되었으며, 이는 전년 대비 11.11% 감소한 수치입니다. 이는 주로 에너지 효율 개선 및 저탄소 에너지 전환 정책의 효과로 나타났습니다. 해당 배출량은 재무제표의 '환경비용' 항목과 연결되며, 향후 탄소배출권 구매 비용 증가에 따른 재무적 리스크로 관리하고 있습니다."
}
```

## 사용 방법

### 1. 샘플 팩트 시트 생성 (테스트용)

```bash
# DB에서 Data Point를 읽어서 샘플 팩트 시트 생성
python -m ifrs_agent.scripts.create_sample_fact_sheets --standard IFRS_S2 --limit 10 --output sample_fact_sheets.json
```

### 2. 학습 데이터 생성

#### 방법 1: JSON 파일에서 생성

```bash
# 팩트 시트 JSON 파일에서 학습 데이터 생성
python -m ifrs_agent.scripts.generate_training_data \
    --fact-sheets-json sample_fact_sheets.json \
    --standard IFRS_S2 \
    --output training_data.jsonl
```

#### 방법 2: DB에서 직접 생성

```bash
# DB에서 Data Point를 읽어서 학습 데이터 생성 (더미 값 사용)
python -m ifrs_agent.scripts.generate_training_data \
    --from-db \
    --standard IFRS_S2 \
    --limit 50 \
    --output training_data.jsonl
```

### 3. LLM 없이 더미 데이터 생성 (테스트용)

```bash
# LLM을 사용하지 않고 더미 출력 생성
python -m ifrs_agent.scripts.generate_training_data \
    --fact-sheets-json sample_fact_sheets.json \
    --no-llm \
    --output training_data_dummy.jsonl
```

### 4. 기존 파일에 추가

```bash
# 기존 JSONL 파일에 추가
python -m ifrs_agent.scripts.generate_training_data \
    --fact-sheets-json new_fact_sheets.json \
    --append \
    --output training_data.jsonl
```

## 옵션 설명

### `generate_training_data.py`

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--fact-sheets-json` | 팩트 시트 JSON 파일 경로 | - |
| `--from-db` | DB에서 Data Point 읽기 | False |
| `--standard` | 기준서 코드 (IFRS_S1, IFRS_S2, GRI, TCFD, SASB) | IFRS_S2 |
| `--output` | 출력 JSONL 파일 경로 | training_data.jsonl |
| `--no-llm` | LLM 사용 안 함 (더미 출력) | False |
| `--append` | 기존 파일에 추가 | False |
| `--limit` | DB에서 읽을 최대 개수 | 100 |
| `--model` | 사용할 LLM 모델 | llama-3.3-70b-versatile |

## 팩트 시트 JSON 형식

```json
[
  {
    "dp_id": "S2-29-a",
    "dp_name": "Scope 1 온실가스 배출량",
    "description": "Scope 1 직접 배출량",
    "unit": "tco2e",
    "values": {
      "2022": 1500,
      "2023": 1350,
      "2024": 1200
    },
    "source": "재무제표 주석",
    "page_reference": "p.45",
    "topic": "지표 및 목표",
    "subtopic": "온실가스 배출",
    "financial_impact_type": "비용",
    "confidence": 0.9
  }
]
```

## 전체 워크플로우

### 1단계: 팩트 시트 생성
- RAG Node에서 실제 데이터 추출
- 또는 샘플 팩트 시트 생성 스크립트 사용

### 2단계: 학습 데이터 생성
```bash
python -m ifrs_agent.scripts.generate_training_data \
    --fact-sheets-json fact_sheets.json \
    --standard IFRS_S2 \
    --output training_data.jsonl
```

### 3단계: 수동 검토 (선택)
- 생성된 JSONL 파일 검토
- 품질이 낮은 항목 제거 또는 수정

### 4단계: LoRA 학습
- 생성된 JSONL 파일로 EXAONE 3.0 7.8B LoRA 학습

## 예상 결과

- **생성 속도**: 팩트 시트당 약 5-10초 (LLM 호출 시간 포함)
- **정확도**: 70-80% (프롬프트 기반, 학습 후 85-92% 예상)
- **일일 생성량**: 약 500-1,000개 쌍 가능 (Groq API 제한 내)

## 주의사항

1. **Groq API 키 필요**: `GROQ_API_KEY` 환경변수 설정 필요
2. **비용**: Groq API는 무료 티어가 있지만, 대량 생성 시 제한 가능
3. **품질 검토**: 자동 생성된 데이터는 수동 검토 권장
4. **실제 값 필요**: DB에서 생성 시 더미 값 사용 (실제로는 RAG Node에서 추출 필요)

## 다음 단계

1. 실제 팩트 시트 생성 (RAG Node 구현)
2. 학습 데이터 품질 검토 및 필터링
3. LoRA 학습 실행
4. Gen Node에 학습된 모델 적용

