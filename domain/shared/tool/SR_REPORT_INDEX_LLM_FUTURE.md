# SR 보고서 인덱스 파싱 · 컬럼 보정 — 구현 현황 및 추후 작업

## 1. 현재 구현 (완료)

### 1.1 툴: 파싱만 담당 (Docling + LlamaParse)

- **Docling**  
  - 인덱스 페이지(또는 전체) PDF 변환 후 표 추출.  
  - 헤더 키워드: `disclosure`, `공시`, `code`, `항목` / `page`, `페이지` 등.  
  - GRI, IFRS/ESRS, SASB 등 `_normalize_dp_id` / `_detect_index_type`로 정규화.
- **LlamaParse 폴백**  
  - Docling으로 행이 안 나온 페이지는 전체 PDF(또는 해당 페이지만)를 LlamaParse로 보완.
- **중복 제거**  
  - `(dp_id, page_numbers)` 기준으로 중복 제거 후 **파싱 결과를 그대로 반환**.  
  - **컬럼 보정은 툴에서 하지 않음** (GROQ/LLM 의존 제거).

### 1.2 에이전트: 검토·선정 후 저장

- **SRSaveAgent** (`backend/domain/v1/data_integration/spokes/agents/sr_save_agent.py`)  
  - `parse_index_tool` 반환값(sr_report_index 리스트)을 받은 뒤,  
    각 행이 **삽입에 적합한 컬럼**(dp_id, index_type, dp_name, page_numbers, section_title)에 맞는지 **검토**하고,  
    잘못 매핑된 값은 올바른 컬럼으로 **선정·보정**한 뒤 `save_sr_report_index`로 저장하도록 시스템 프롬프트에 명시.
- 보정은 **에이전트의 LLM(OpenAI GPT)** 이 수행. DB 컨텍스트는 아직 미사용(추후 확장).

### 1.3 관련 코드

- `backend/domain/shared/tool/sr_report_tools_docling.py`  
  - `parse_sr_report_index_with_docling(pdf_path_or_bytes, report_id, index_page_numbers)` — 파싱만.
- `backend/domain/v1/data_integration/spokes/agents/sr_save_agent.py`  
  - 4단계: 인덱스 검토 후 저장(스키마 설명 + 컬럼 재배치 지시).

---

## 2. 추후 구현 예정

### 2.1 DB 기반 컬럼 컨텍스트 (우선)

- **목적**  
  - 이미 DB에 저장된 `sr_report_index` / 관련 마스터 데이터를 활용해,  
    에이전트가 보정할 때 “이 컬럼에는 이런 값들이 있다”는 **컨텍스트**를 넘겨 정확도 향상.

- **수집할 컨텍스트 예시**  
  - `dp_id`: 동일 report 또는 동일 회사/연도에서 사용된 dp_id 목록 또는 패턴.  
  - `index_type`: gri / ifrs / sasb 비율 또는 허용 값.  
  - `section_title`, `dp_name`: 자주 쓰인 문자열 샘플.

- **연동 방식**  
  - 에이전트 호출 전 또는 메시지에, `report_id`(및 필요 시 company/year)로 DB 조회한 컨텍스트를 포함.  
  - SRSaveAgent 시스템 프롬프트 또는 user 메시지에 “예: 이 보고서의 기존 dp_id 목록: …” 형태로 전달.

- **저장 위치 제안**  
  - 컨텍스트 조회: `backend/domain/v1/data_integration` 내 서비스/리포지토리.

### 2.2 보정 결과 검증 강화

- **목적**  
  - 에이전트가 save_*에 넘기는 인자를 허용 패턴/범위로 한 번 더 검증해 이상치 제거(선택).

- **내용**  
  - `dp_id`: 허용 정규식으로 재검사; 실패 시 해당 행 스킵 또는 경고.  
  - `page_numbers`: 보고서 총 페이지 범위 밖이면 경고 또는 null 처리 옵션.  
  - `index_type`: gri/ifrs/sasb만 허용.

- **위치**  
  - save_sr_report_index 도구 내부 또는 에이전트 호출 직후 검증 레이어.

### 2.3 에러·재시도

- 에이전트 도구 호출 실패 시 재시도 또는 실패 행만 로그에 남겨 추후 재처리 가능하게 할 것.

### 2.4 파싱 단계별 메타데이터

- `parsing_method`: `docling`, `llamaparse` 유지.  
- 필요 시 에이전트가 보정한 행에만 별도 플래그를 두어 추후 학습/평가에 활용할지 검토.

---

## 3. 요약

| 구분              | 상태 | 비고                                           |
|-------------------|------|------------------------------------------------|
| Docling + LP (툴) | 완료 | code/SASB/다중 페이지 fallback 반영, 파싱만    |
| 에이전트 검토·저장 | 완료 | parse 결과를 검토·컬럼 선정 후 save_* 호출     |
| DB 컨텍스트       | 추후 | 에이전트 프롬프트에 컬럼 예시/목록 전달        |
| 검증 강화         | 추후 | save 시 dp_id / page_numbers / index_type 검증 |
| 재시도·로깅       | 추후 | 실패 행 추적 및 재처리                         |

이 문서는 툴(파싱 전담)과 에이전트(검토·보정·저장) 역할 분리 기준으로 유지보수됩니다.
