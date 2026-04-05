# SR Body 삭제/이전/리네임 체크리스트 (리스크 최소 순서)

## 목적

아래 3가지 변경을 **한 번에** 적용할 때 장애를 최소화하기 위한 실행 순서입니다.

- `sr_body_toc_llm.py` 제거
- `sr_body_db.py` 역할 이전 (`hub` → `repositories`)
- `sr_body_toc.py` 리네임 또는 `sr_body_mapping.py` 통합

---

## 변경 원칙 (필수)

- 동작 경로를 먼저 전환하고, 구경로 삭제는 마지막에 한다.
- 각 단계마다 `rg`로 잔여 import를 확인한다.
- 작은 단위 테스트를 매 단계 실행한다.
- 문서/환경변수 설명(`SR_BODY_TOC_LLM_ALIGN` 등)도 코드와 같이 정리한다.

---

## Phase 0. 사전 점검

- [ ] 현재 참조 확인
  - `rg "sr_body_toc_llm|SR_BODY_TOC_LLM_ALIGN|count_sr_report_body_rows|sr_body_toc" backend`
- [ ] 영향 파일 목록 확정
  - 런타임: `sr_workflow.py`, `sr_agent_router.py`, `sr_body_mapping.py`
  - 테스트: `test_sr_body_toc_llm.py`, `test_sr_body_toc.py`, 관련 body 테스트
- [ ] 롤백 포인트 확보 (브랜치 또는 커밋 포인트)

---

## Phase 1. `sr_body_db.py` 역할 이전 (삭제 아님)

### 1-1) 신규 repository 파일 생성
- [ ] 예: `backend/domain/v1/data_integration/hub/repositories/sr_report_body_repository.py`
- [ ] `count_sr_report_body_rows(report_id)` 함수 이전

### 1-2) 호출부 import 전환
- [ ] `backend/domain/v1/data_integration/hub/orchestrator/sr_workflow.py`
- [ ] `backend/api/v1/data_integration/sr_agent_router.py`

### 1-3) 검증
- [ ] `rg "from .*sr_body_db import count_sr_report_body_rows" backend` 결과 0건
- [ ] 관련 API/워크플로 테스트 또는 스모크 실행

### 1-4) 구파일 정리
- [ ] `sr_body_db.py`를 shim으로 둘지 즉시 삭제할지 결정
- [ ] 즉시 삭제 시 `rg "sr_body_db" backend` 재확인

---

## Phase 2. `sr_body_toc.py` 리네임/통합 준비

> 권장: 완전 통합보다 **리네임 + 얇은 호출 유지**가 안전합니다.

### 옵션 A (권장): 리네임
- [ ] `sr_body_toc.py` → `sr_body_heading_path.py` (의미 일치)
- [ ] `sr_body_mapping.py` import 경로 변경
  - `from .sr_body_toc import apply_toc_paths_to_bodies`
  - → `from .sr_body_heading_path import apply_toc_paths_to_bodies`
- [ ] `test_sr_body_toc.py` 파일명/테스트명 정리

### 옵션 B: `sr_body_mapping.py`로 완전 통합
- [ ] `extract_page_heading`, `apply_toc_paths_to_bodies`를 `sr_body_mapping.py`로 이동
- [ ] `sr_body_toc.py`는 shim 처리 후 단계적 삭제

### 검증
- [ ] `rg "sr_body_toc" backend`에서 의도된 경로만 남는지 확인
- [ ] `test_sr_body_toc.py` / `test_sr_body_enrichment.py` / body 매핑 테스트 실행

---

## Phase 3. `sr_body_toc_llm.py` 제거

### 3-1) 참조 제거 확인
- [ ] `rg "sr_body_toc_llm|should_use_llm_toc_align|align_toc_entries_to_pdf_pages_with_llm" backend`
- [ ] 런타임 참조 0건 확인 (테스트/문서 제외)

### 3-2) 테스트 정리
- [ ] `backend/domain/v1/data_integration/tests/test_sr_body_toc_llm.py` 삭제 또는 legacy 표시

### 3-3) 문서/환경변수 정리
- [ ] `SR_BODY_TOC_LLM_ALIGN`, `SR_BODY_TOC_LLM_MODEL` 관련 설명 제거/수정
- [ ] `docs/body/SR_BODY_PARSING_QUICKSTART.md` 등 문서 반영

### 3-4) 파일 삭제
- [ ] `backend/domain/shared/tool/sr_report/mapping/sr_body_toc_llm.py` 삭제

### 3-5) 최종 확인
- [ ] `rg "SR_BODY_TOC_LLM_ALIGN|sr_body_toc_llm" backend` 결과가 문서상 의도와 일치

---

## Phase 4. 최종 정리 및 회귀 확인

- [ ] import 캐시/중복 경로 점검
  - `rg "from .*sr_body_toc|from .*sr_body_db" backend`
- [ ] lint 확인
  - 변경 파일 기준 lint 에러 0건
- [ ] 본문 저장 경로 스모크 테스트
  - `extract-and-save/body`
  - `extract-and-save/body-agentic`
- [ ] DB 확인
  - `sr_report_body` 저장 row 수 및 `toc_path` 형식(`["제목"]` 또는 `None`) 확인

---

## 권장 실행 순서 (요약)

1. `sr_body_db`를 repository로 이동하고 호출부 전환  
2. `sr_body_toc` 리네임(또는 통합) 후 테스트 통과  
3. `sr_body_toc_llm` 참조 제거 + 테스트/문서 정리  
4. 마지막에 삭제 수행  

---

## 실패 시 롤백 기준

- `Phase 1` 실패: `sr_body_db` 구 import 즉시 복구
- `Phase 2` 실패: `sr_body_toc.py` 원복 + `sr_body_mapping.py` import 원복
- `Phase 3` 실패: `sr_body_toc_llm.py` 복원, 테스트만 임시 skip 후 원인 분석

