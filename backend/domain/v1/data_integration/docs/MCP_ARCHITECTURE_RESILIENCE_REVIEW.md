# MCP 구조/경로/로직 견고성 진단서

SR 인덱스 파이프라인의 MCP 연동 구조를 대상으로, 현재 구조가 얼마나 쉽게 무너질 수 있는지(경로/연결/로직 취약성)와 에이전틱 AI 관점에서 LLM이 얼마나 유연하게 대처할 수 있는지를 점검한 문서입니다.

검토 대상:
- `backend/domain/v1/data_integration/spokes/infra/sr_index_tools_server.py`
- `backend/domain/v1/data_integration/spokes/agents/sr_index_agent.py`
- `backend/domain/shared/tool/` 하위 파싱/인덱스 도구
- `backend/domain/v1/data_integration/hub/orchestrator/sr_workflow.py`

---

## 1) 현재 구조 요약

### 실행 흐름
1. `sr_workflow.py`에서 `save_index` 노드 진입
2. `AgentRouter`가 `SRIndexAgent` 호출
3. `SRIndexAgent`가 **`MCPClient.tool_runtime("sr_index_tools")`**로 도구 런타임 확보  
   - URL 미설정 시 **In-process**(同一 프로세스 함수 호출)  
   - `MCP_SR_INDEX_TOOLS_URL` 설정 시 **Streamable HTTP** MCP
4. (원격일 때만) `sr_index_tools_server.py`가 MCP Tool 엔드포인트 제공
5. 실제 도메인 로직은 `shared/tool/sr_report/index/sr_index_agent_tools.py`에서 수행
6. 파싱은 `docling.py`, `llamaparse.py` 등 하위 파서에 위임

### 설계 특징
- 파싱/검증/보정은 에이전트가 수행하고, 최종 저장은 오케스트레이터(`save_sr_report_index_batch`)가 담당
- 파싱 단계에서 Docling/LlamaParse 병렬 호출을 유도
- 결과가 0건이면 완료로 간주하지 않는 안전장치 존재

---

## 2) 취약 지점 진단 (무너지기 쉬운 부분)

## 2-1. 경로 결합도(하드코딩) — **완화됨**

### 이전 관측
- `parent.parent...` 체인으로 저장소 루트·`shared/tool` 경로 계산

### 현재
- `path_resolver.find_repo_root()` + `REPO_ROOT` 환경변수로 일원화
- MCP 서버·클라이언트 경로 계산에 반영

### 남는 리스크
- 마커 파일(`.git` 등)이 없는 비표준 배포 구조에서는 `REPO_ROOT` 명시 필요

### 심각도 (갱신)
- 중간 이하 (Medium-Low)

---

## 2-2. MCP 연결 실패 시 복구 전략이 약함 → **완화됨**

### 이전 관측
- 재시도(backoff) 없음, 빈 도구 목록 시 즉시 실패

### 현재
- `tool_runtime()` 원격 경로: 최대 3회 재시도(대기 1초·2초)
- `load_tools` 결과가 빈 리스트면 재시도 대상으로 처리

### 심각도 (갱신)
- 중간 (Medium)

---

## 2-3. 에이전트 실행 루프가 단일 대형 블록에 집중 → **완화됨**

### 현재
- `SRIndexAgent`: `_prepare_tool_args`, `_invoke_tool`, `_apply_best_parsing_result` 등으로 분해
- `SRBodyAgent`: `_build_user_prompt`, `_prepare_tool_args`, `_invoke_tool` 분해

### 남는 리스크
- 루프·종료 조건은 여전히 `execute()`에 있음(추가 분해 여지)

### 심각도 (갱신)
- 낮음~중간 (Low-Medium)

---

## 2-4. 규칙 기반 보정 단계의 한계 → **대폭 개선됨**

### 이전 관측
- 이상치 보정은 LLM 보조를 쓰되, 입력 형태/키 정규화에 의존하는 규칙 기반 전처리가 강함
- 데이터 형태가 예외적으로 흔들리면 보정 품질이 급락할 수 있음

### 현재 (2026-03-20 개선)
- **다중 파서 자동 병합**: Docling + LlamaParse 결과를 코드 레이어에서 자동 병합
  - 품질 게이트: 필수 필드 채움률·최소 행 수 검사
  - dp_id 단위 정렬·매칭, 불일치는 우선순위 규칙으로 자동 해결
  - 한쪽만 값 있음 → `needs_review` (참고용)
  - 둘 다 있고 동일 → 채택
  - 둘 다 있고 상이 → `conflicts` + 우선순위 규칙(page_numbers 합집합, index_type·dp_id는 docling 우선, 나머지는 긴 값)
- **LLM 역할 최소화**: 도구 호출 순서·이상치 보정 여부만 판단, 병합·검증은 코드가 처리
- **근거 추적**: 병합 시 `merge_source`, `{field}_source` 필드로 출처 명시

### 리스크 (잔여)
- 공통 실패: 두 파서가 같은 셀을 동시에 못 읽으면 누락 가능
- 동적 스키마: 새 기준서 추가 시 필수 필드 정의 갱신 필요

### 심각도 (갱신)
- 낮음~중간 (Low-Medium, 이전 Medium에서 하향)

---

## 3) 에이전틱 AI 유연성 평가

## 3-1. 강점 (유연한 부분)

- **병렬 파싱 + 자동 병합**: Docling/LlamaParse를 동시 호출하고 코드 레이어에서 품질 게이트·병합·불일치 해결
- **자동 인자 보완**: LLM이 일부 인자를 누락해도 직전 결과를 자동 주입해 실행 지속
- **0건 완료 방지**: 빈 결과를 성공으로 오인하지 않도록 방지
- **단계 분리**: 파싱과 저장 책임을 분리해 실패 지점을 축소
- **규칙 기반 최소화**: LLM은 전략적 판단(도구 호출 순서, 이상치 보정 여부)만, 세부 규칙(스키마 검증, 병합, 페이지 범위 검증)은 코드가 처리

## 3-2. 약점 (유연성이 제한되는 부분)

- **공통 실패 대응 제한**: 두 파서가 동시에 실패하면 LLM도 대처 불가 (추가 파서 또는 재시도 전략 필요)
- **반복 정책 고정**: `max_iterations` 고정값 기반이라 문서 복잡도 적응성이 제한
- **복구 경로 제한**: 연결/파싱 실패 시 대체 경로(서킷브레이커/강등 모드)가 약함

## 3-3. 종합 판단

- "에이전틱한 의사결정" 자체는 구현되어 있음
- **다중 파서 병합·품질 게이트로 §2-4 약점 상당 부분 해소** (Medium → Low-Medium)
- 다만 "운영 탄력성(Resilience)"은 연결/복구 레이어에서 아직 취약
- 즉, **지능(판단)은 어느 정도 있고, 기반 인프라 견고성도 개선 중이지만, 극단 실패 시나리오는 여전히 취약**

---

## 4) 우선순위 개선안

## P0 (즉시 권장)

1. **경로 해석 중앙화**
   - `Path(...parent...)` 체인 제거
   - 단일 설정 모듈(예: `data_integration/config/paths.py`) 또는 환경변수 기반 루트 해석으로 일원화

2. **MCP 연결 재시도 도입**
   - 연결/초기화/list_tools 단계에 짧은 지수 백오프 재시도 추가
   - 일시 장애를 하드 실패로 처리하지 않도록 보완

3. **서버 경로 유효성/헬스 체크 강화**
   - 기동 시점에 핵심 서버 스크립트 존재 여부 + import 가능성 점검

## P1 (단기 권장)

1. **`SRIndexAgent.execute()` 분해**
   - 도구 호출 준비, 호출 실행, 결과 선택, 상태 반영을 별도 메서드로 분리
   - 테스트 가능한 단위로 쪼개 회귀 리스크 감소

2. **복구 정책 명시화**
   - Docling 실패 시 LlamaParse 강등 정책
   - MCP 실패 시 인프로세스 호출 가능한 도구 우선 사용 정책

3. **관측성(Observability) 정리**
   - 현재 로그가 풍부하므로, 단계별 상관 ID/요약 메트릭(성공률/재시도 횟수) 추가

## P2 (중기 권장)

1. **복잡도 기반 동적 반복 정책**
   - `inspect_index_pages` 결과로 최대 반복/도구 전략을 조정

2. **도구 호출 정책 유연화**
   - 검증/탐지 단계의 안전한 병렬화 가능 지점 재검토

3. **장애 주입 테스트**
   - MCP 서버 미기동, 타임아웃, 파서 실패 케이스를 CI 테스트로 고정

---

## 5) 점수 기반 평가 (개선 반영 후, 2026-03-20 기준)

- 경로 견고성: **7/10** (`path_resolver` + `REPO_ROOT`)
- 연결/복구 탄력성: **6/10** (재시도·빈 도구 목록 재시도)
- 로직 유지보수성: **8/10** (인덱스/본문 에이전트 메서드 분해 + 다중 파서 병합 모듈)
- 에이전틱 의사결정 유연성: **8/10** (병합 자동화 + LLM 역할 명확화, 이전 7/10에서 상향)
- 파싱 품질 안정성: **7/10** (다중 파서 품질 게이트 + 자동 병합, 신규 항목)
- 운영 안정성 종합: **7.5/10** (이전 7/10에서 소폭 상향)

---

## 6) 결론

현재 구조는 "LLM이 도구를 선택하고 결과를 비교해 다음 행동을 결정하는 에이전틱 패턴"은 비교적 잘 반영되어 있습니다.

**2026-03-20 개선 사항**:
- **다중 파서 자동 병합**: 품질 게이트·스키마 검증·불일치 해결을 코드 레이어로 이동
- **LLM 역할 명확화**: 전략적 판단(도구 호출 순서, 이상치 보정)만 담당, 세부 규칙은 코드가 처리
- **규칙 기반 약점(§2-4) 완화**: 다중 파서 교차 검증 + 자동 병합으로 단일 파서 의존도 감소
- **테스트 자동화**: `test_multi_parser_merger.py` 12개 케이스 (품질 게이트, 병합 전략, 불일치 해결)

단기 과제였던 **경로 일원화 + MCP 재시도 + 실행 루프 분해 + 다중 파서 병합**은 코드에 반영된 상태입니다.

이후 과제는 **관측성(메트릭)·동적 반복 정책·장애 주입 테스트 확장·공통 실패 대응(3+ 파서 또는 재시도 전략)** 등이 남습니다.

---

*문서 작성일: 2026-03-20 (최종 동기화: 다중 파서 병합 반영)*  
*대상 버전: 현재 `develop` 브랜치 기준 코드*

---

## 7) 적용 완료 사항 (하이브리드 전송)

본 문서의 권장안 중 **"외부 통합은 HTTP 유지, 내부는 In-process 우선"** 전략을 다음과 같이 반영했습니다.

### 7-1. 경로 하드코딩 제거

- 신규 유틸 추가: `backend/domain/v1/data_integration/spokes/infra/path_resolver.py`
  - `REPO_ROOT` 환경변수 우선
  - 없으면 상위 디렉터리로 올라가며 `pyproject.toml`, `.git`, `README.md` 마커로 루트 탐색
- 적용 파일:
  - `spokes/infra/sr_index_tools_server.py`
  - `spokes/infra/sr_tools_server.py`
  - `spokes/infra/sr_body_tools_server.py`
  - `spokes/infra/mcp_client.py`

기존 `parent.parent.parent...` 체인 의존을 제거하여 폴더 리팩터링/실행 위치 변경 내성을 높였습니다.

### 7-2. 내부 In-process 런타임 추가

- `mcp_client.py`에 내부 도구 실행 런타임을 추가:
  - `should_use_inprocess(server_name)`
  - `load_inprocess_tools(server_name)`
  - `tool_runtime(server_name)` (async context manager)
- 기본 정책:
  - `sr_tools`, `sr_index_tools`, `sr_body_tools`는 **URL 미설정 시 In-process 사용**
  - `MCP_SR_INDEX_TOOLS_URL`, `MCP_SR_BODY_TOOLS_URL`가 설정되어 있으면 기존처럼 HTTP 사용
  - `MCP_INTERNAL_TRANSPORT=stdio` 설정 시 In-process 강제 비활성화

### 7-3. 에이전트 실행 경로 연결

- `spokes/agents/sr_index_agent.py`
- `spokes/agents/sr_body_agent.py`
- `spokes/agents/sr_agent.py`

두 에이전트는 MCP 세션 직접 구성 대신 `mcp_client.tool_runtime(...)`를 사용하도록 변경되어,
환경에 따라 자동으로 In-process 또는 HTTP 경로를 선택합니다.
`sr_agent`도 동일하게 `web_search` + `sr_tools` 조합 시 `tool_runtime(...)`를 사용하도록 통일했습니다.
(`web_search`는 MCP 유지, `sr_tools`는 URL 미설정 시 In-process)

### 7-4. 부수 수정

- 잘못된 import 경로 정정:
  - `backend.domain.shared.tool.sr_index_agent_tools` →
  - `backend.domain.shared.tool.sr_report.index.sr_index_agent_tools`
  - 적용 파일: `sr_index_tools_server.py`, `sr_body_tools_server.py`

### 7-5. MCP 원격 연결 재시도(backoff) 추가

- 적용 파일: `spokes/infra/mcp_client.py`
- `tool_runtime()` 내부 원격 연결 경로에 재시도 정책 추가:
  - 최대 3회 시도
  - 대기 시간: 1초 → 2초 (선형 backoff)
  - 최종 실패 시 빈 도구 리스트 반환 + 에러 로그 남김

효과:
- 일시적인 MCP 서버 지연/네트워크 흔들림에서 즉시 하드 실패하는 빈도를 줄임

### 7-6. In-process 경로에서 MCP import 의존 제거

- 신규 파일: `spokes/infra/sr_tools_runtime.py`
  - `fetch_page_links`, `download_pdf`, `download_pdf_bytes`의 순수 런타임 구현 분리
  - MCP 서버 모듈(`sr_tools_server.py`)을 import하지 않아도 내부 호출 가능
- 적용 파일: `spokes/infra/mcp_client.py`
  - `load_inprocess_tools("sr_tools")`가 `sr_tools_server.py` 대신 `sr_tools_runtime.py`를 참조하도록 변경

효과:
- In-process 모드에서 `mcp/fastmcp` 미설치로 인한 import 실패 및 프로세스 종료 리스크 제거
- 내부 런타임과 MCP 서버 엔트리포인트를 분리해 결합도 감소

### 7-7. 원격 도구 목록 비어 있음 케이스 재시도 강화

- 적용 파일: `spokes/infra/mcp_client.py`
- 원격 연결 성공 후 `load_tools_from_session()` 결과가 빈 리스트면 예외로 간주하고 재시도하도록 보완

효과:
- 일시적으로 `list_tools`가 비정상 응답(빈 목록)을 주는 상황에서 즉시 실패하지 않고 회복 가능성 확보

### 7-8. 에이전트 코드 구조 (리팩터링)

- `SRIndexAgent`: 프롬프트/결과 조립·도구 인자 준비·도구 실행·파싱 결과 선택을 전용 메서드로 분리
- `SRBodyAgent`: 사용자 프롬프트·도구 인자 준비·도구 실행 분리

### 7-9. 다중 파서 병합 전략 (신규, 2026-03-20)

- **신규 모듈**: `backend/domain/shared/tool/sr_report/index/multi_parser_merger.py`
  - `ParsingQualityGate`: 필수 필드 채움률, 최소 행 수 검사
  - `MultiParserMerger`: dp_id 단위 정렬·매칭, 불일치 우선순위 규칙
  - `merge_parser_results()`: 외부 API (docling_result, llamaparse_result → 병합 결과)

- **병합 전략**:
  1. 품질 게이트: 둘 다 통과 → 병합, 한쪽만 통과 → 그쪽 사용, 둘 다 실패 → 오류
  2. dp_id 단위로 정렬·매칭
  3. 한쪽만 값 있음 → `needs_review` (참고용)
  4. 둘 다 있고 동일 → 채택
  5. 둘 다 있고 상이 → `conflicts` + 우선순위 규칙
     - `page_numbers`: 합집합 (중복 제거·정렬)
     - `index_type`, `dp_id`: docling 우선 (구조화 안정적)
     - 나머지: 긴 값 선택 (정보량 기준)
  6. `total_pages` 초과 페이지 자동 제거

- **`SRIndexAgent` 통합**:
  - `_apply_best_parsing_result()` → 병합 메타 반환 (`merge_strategy`, `conflicts`, `needs_review`, `quality_report`, **`observability`**)
  - `execute()` 반환 `IndexAgentState`에 **`merge_observability`** (병합 직후 스냅샷) 포함
  - 시스템 프롬프트: LLM은 도구 호출 순서만 판단, 병합·검증은 코드가 처리
  - 사용자 프롬프트: "병합은 코드가 자동 수행"

- **테스트**:
  - `backend/domain/v1/data_integration/tests/test_multi_parser_merger.py`
  - 품질 게이트·병합·관측성 등 **17개** 케이스
  - **결과**: 17 passed (로컬 기준)

효과:
- §2-4 "규칙 기반 보정 한계" 완화: 다중 파서 교차 검증으로 단일 파서 의존도 감소
- §3-2 "유연성 제한" 개선: LLM 역할 명확화 (전략적 판단), 세부 규칙은 코드가 처리
- 필수 필드 누락·페이지 범위 오류 자동 감지·해결

### 7-10. 관측성 메트릭 (병합 결과, 2026-03-20)

- **모듈**: `multi_parser_merger.py` — `compute_cross_parser_field_metrics()`, `build_observability_payload()`
- **`merge_parser_results()` 반환 `observability`** (모든 병합 전략에 포함):
  - `needs_review_count`: 한쪽 파서만 행을 가진 dp 수준 보류(참고) 건수
  - `conflict_dp_count`: 최소 한 필드 불일치가 있었던 dp 건수
  - `conflict_field_entries`: 불일치 필드 항목 수(여러 필드 동시 불일치 시 누적)
  - `merged_row_count`: 병합 후 `sr_report_index` 행 수
  - **`merged` 전략** (`cross_parser: "computed"`):
    - `field_metrics`: 필드별 `comparable`, `agree`, `disagree`, `agreement_rate`, `disagreement_rate`, `doc_only`, `llama_only`, `both_null`
    - `overall`: `weighted_agreement_rate`, `weighted_disagreement_rate`, `total_comparable_field_pairs` 등
    - `dp_counts`: `both_parsers`, `docling_only_rows`, `llamaparse_only_rows`, `total_union_dp_ids`
  - **단일 파서·`both_failed`**: `cross_parser: "not_applicable"` (교차 비교 없음, 카운트·품질 게이트 사유만)

---

## 8) 운영 가이드

### 기본(권장): 내부 In-process

- 별도 설정 없이 실행
- `sr_tools`, `sr_index_tools`, `sr_body_tools`는 프로세스 내부 함수 호출로 동작
- `web_search`는 기존 MCP 연결 방식 유지

### 외부 통합 필요 시: Streamable HTTP

- URL 설정 시 자동으로 HTTP 경로 사용
  - `MCP_SR_INDEX_TOOLS_URL=http://.../mcp`
  - `MCP_SR_BODY_TOOLS_URL=http://.../mcp`
  - `MCP_SR_TOOLS_URL=http://.../mcp`

### 강제 stdio 모드

- `MCP_INTERNAL_TRANSPORT=stdio`
- URL이 없어도 In-process를 사용하지 않고 stdio MCP를 사용

---

## 9) 자동 테스트 (통합 시나리오)

### 위치

- `backend/domain/v1/data_integration/tests/test_mcp_integration_scenarios.py`

### 실행 (저장소 루트에서)

```text
python -m unittest discover -s backend/domain/v1/data_integration/tests -v -p "test_*.py"
```

### 검증 범위

| 시나리오 | 내용 |
|----------|------|
| 경로 | `path_resolver` 마커 탐색, `REPO_ROOT` 오버라이드 |
| In-process 기본 | URL 미설정 시 `sr_*` 서버 in-process 선택 |
| stdio 강제 | `MCP_INTERNAL_TRANSPORT=stdio` 시 in-process 비활성 |
| HTTP URL | `MCP_SR_*_URL` 설정 시 `streamable_http` 파라미터 |
| sr_tools in-process | 도구 이름·`tool_runtime("sr_tools")` 목록 |
| sr_index_tools (선택) | `sr_index_agent_tools` import 가능할 때만 실행, 아니면 skip |

### 구현 메모

- 테스트 모듈 import 시 **`infra/__init__.py`를 건너뛰는 부트스트랩**을 사용한다.  
  (`sr_report_tools` → `langchain_core` 등이 없는 CI에서도 MCP 정책·`sr_tools` in-process를 검증하기 위함.)
- 실제 LangGraph/LLM end-to-end는 이 파일 범위 밖이며, API/스테이징에서 별도 검증하는 것을 권장한다.
