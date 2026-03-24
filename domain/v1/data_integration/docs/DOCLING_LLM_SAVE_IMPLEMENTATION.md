# Docling + LLM/도구 기반 SR 저장 구현 완료

파싱 도구로 Docling을 사용하고, LLM/도구 기반 저장을 구현했습니다.

## 구현된 파일

### 1. Docling 파싱 도구
- **파일**: `backend/domain/shared/tool/sr_report_tools_docling.py`
- **함수**: `parse_sr_report_index_with_docling(pdf_path_or_bytes, report_id, index_page_numbers)`
- **역할**: Docling으로 표(GRI STANDARDS INDEX 등) 추출 → sr_report_index 행 목록 반환
- **특징**:
  - TableFormer 기반 표 구조 인식
  - Classification, Disclosure, Indicators, Page, Note 컬럼 자동 감지
  - DP ID 정규화 (GRI-305-1, S2-15-a 등)
  - 페이지 번호 파싱 (단일·범위·쉼표 구분)
  - (dp_id, page_numbers) 중복 제거

### 2. 4개 테이블 저장 도구 (LangChain Tools)
- **파일**: `backend/domain/shared/tool/sr_save_tools.py`
- **도구 4개**:
  1. `save_historical_sr_report`: historical_sr_reports 테이블에 메타데이터 저장 → report_id 반환
  2. `save_sr_report_index`: sr_report_index 테이블에 DP → 페이지 매핑 저장
  3. `save_sr_report_body`: sr_report_body 테이블에 본문 저장
  4. `save_sr_report_image`: sr_report_images 테이블에 이미지 메타 저장
- **특징**: LangChain @tool 데코레이터로 LLM이 호출 가능

### 3. LLM 기반 저장 에이전트
- **파일**: `backend/domain/v1/data_integration/spokes/agents/sr_save_agent.py`
- **클래스**: `SRSaveAgent`
- **역할**: 파싱 결과를 LLM에게 주고, save_* 도구만 사용해 4개 테이블 저장
- **프롬프트**: 
  - 1단계: save_historical_sr_report → report_id 획득
  - 2단계: save_sr_report_index (각 행)
  - 3단계: save_sr_report_body (각 행)
  - 4단계: save_sr_report_image (각 행)
- **특징**: 한 번에 하나씩 도구 호출, 순서 보장

### 4. 오케스트레이터 통합
- **파일**: `backend/domain/v1/data_integration/hub/orchestrator/sr_orchestrator.py`
- **파라미터**: `use_docling_llm=True` 추가
- **플로우**:
  - `use_docling_llm=False` (기본): 방법 B-1 (PyMuPDF + 리포지토리 저장)
  - `use_docling_llm=True`: 방법 A (Docling + LLM/도구 기반 저장)

### 5. 의존성
- **파일**: `backend/domain/v1/data_integration/requirement.txt`
- **추가**: `docling>=2.0.0`

## 사용 방법

### API 호출 시 (sr_orchestrator 통해)
```python
result = await sr_orchestrator.execute(
    company="삼성SDS",
    year=2024,
    use_docling_llm=True,  # Docling + LLM/도구 기반 저장
    save_to_db=True,
)
```

### 직접 호출 (파싱 결과가 이미 있을 때)
```python
from backend.domain.v1.data_integration.spokes.agents.sr_save_agent import SRSaveAgent

save_agent = SRSaveAgent()
result = await save_agent.execute(parsing_result, company="삼성SDS", year=2024)
# {"success": True, "message": "저장 완료", "report_id": "..."}
```

## 플로우 요약

```
[PDF bytes]
    ↓
[기존 SR Agent] MCP로 검색·다운로드 → PyMuPDF로 메타 추출
    ↓
[Orchestrator] use_docling_llm=True 체크
    ↓
[Docling] parse_sr_report_index_with_docling → 표 구조 추출
    ↓
[SRSaveAgent] LLM이 파싱 결과 해석
    ↓
[LLM] save_* 도구 순차 호출 (메타 → 인덱스 → 본문 → 이미지)
    ↓
[DB] 4개 테이블 INSERT 완료
```

## 특징

- **Docling**: 표 구조 인식 → 컬럼 단위 추출 → 정규식보다 안정적
- **LLM/도구**: 
  - DB 직접 접근이 아닌 save_* 도구만 노출 (보안)
  - 파라미터 검증 후 INSERT
  - 프롬프트로 단계별 지시 → 순서 보장
- **유연성**: use_docling_llm 플래그로 방법 B-1/A 선택 가능

## 설치

```bash
pip install -r backend/domain/v1/data_integration/requirement.txt
```

Docling 의존성이 크므로 설치 시간이 걸릴 수 있습니다.
