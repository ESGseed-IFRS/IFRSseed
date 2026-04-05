# IFRS 에이전트 워크플로우 · 데이터 · dp_rag — 새 채팅 이어가기용 컨텍스트

**작성 목적**: 이전 대화에서 정리·구현한 내용을 한곳에 모아, 새 채팅에서 동일한 전제를 빠르게 복구하기 위함.  
**최종 반영일**: 2026-04-05  
**최근 업데이트**: DP 유형 라우팅 + 정성 DP 처리 + 파이프라인 정합 완료

---

## 1. 새 채팅에서 이렇게 쓰면 됨

- 이 파일 경로를 열어 두거나, 요약만 붙여 넣기:  
  `backend/domain/v1/ifrs_agent/docs/NEW_CHAT_CONTEXT.md`
- 세부 설계·스키마는 아래 “참고 문서” 링크를 추가로 열면 됨.

---

## 2. 데이터가 앉는 테이블 (역할만)

| 영역 | 테이블(예) | 비고 |
|------|------------|------|
| ESG 정량 wide | `environmental_data`, `social_data`, `governance_data` | `company_id` + `period_year` (+ `data_type` for S/G) |
| 회사 프로필 | `company_info` | 회사당 1행, `period_year` 없음 — 미션·비전·산업·ESG 목표 등 |
| 온톨로지 | `data_points`, `unified_column_mappings`, `rulebooks`, `unmapped_data_points` | DP·UCM·룰북 |
| SR·히스토리 | `sr_report_body`, `sr_report_images`, `historical_*` 등 | c_rag 쪽 |
| 계열사 상세 | `subsidiary_data_contributions` | 사업장·서술·정량 |
| 외부 보도 스냅샷 | `external_company_data` | 배치 인제스션(예: SDS 뉴스) 등 |

스테이징 → 위 wide 테이블로 가는 **ESG 집계 파이프라인**(`esg_data`의 aggregate/build 서비스)은 **계열사·외부 테이블과 별개**이다.

---

## 3. 오케스트레이터 관점: “agg” 두 가지 의미 구분

1. **`agg_data` / `aggregation_node`**  
   - SR 생성 **런타임**에서 `subsidiary_data_contributions`·`external_company_data`를 **조회·묶어서** 넘기는 슬롯.  
   - `orchestrator`는 `references["subsidiary_data"]` ← `agg_data["subsidiary_data"]`, 외부 스냅샷 사용 여부 ← `agg_data["external_company_data"]` 등.  
   - 설계상 **데이터 적재**는 크롤/제출 파이프라인이고, 요청 경로에서는 **DB 조회** 위주.

2. **ESG 도메인의 “집계”(staging → environmental_data 등)**  
   - `environmental_aggregate_service`, `social_data_build_service` 등 **별 코드 경로**.  
   - **계열사·외부 스토리 테이블을 여기서 채우는 구조가 아님.**

정리: “계열사·외부 정보를 SR에서 쓸 때 **파이프라인상 agg 슬롯에서 가져온다**”는 말은 맞고, “그 테이블이 **ESG wide 집계 결과**다”는 말은 틀리다.

---

## 4. `dp_rag` — 구현 의도와 현재 상태

### 4.1 역할

- 사용자가 고른 **단일 DP(또는 UCM 접두 `UCM...`)**에 대해 **실데이터 값**을 조회해 `fact_data`로 넘김.
- `c_rag`(SR 본문·이미지)와 병렬로 호출될 수 있음 (`dp_id` 있을 때).

### 4.2 E/S/G 실데이터 경로 (DP-driven)

1. `data_points` 또는 UCM 직접 조회  
2. `unified_column_mappings` / `unmapped_data_points`  
3. **캐시 → LLM**으로 `social_data` | `environmental_data` | `governance_data` + 컬럼 + (필요 시) `data_type` 선택 — **`allowlist.py` 화이트리스트만 허용**  
4. `query_dp_real_data`로 템플릿 쿼리 실행 (동적 SQL은 검증된 식별자만)

### 4.3 `company_info` 경로 (DP 비의존, 항상 시도)

- **결정**: E/S/G는 DP·UCM·LLM 매핑을 따르고, **`company_info`는 매 `collect` 호출마다 `company_id`로만 조회**해 맥락(미션·비전·산업 등)을 붙인다.
- **LLM 매핑·allowlist에 `company_info`를 넣지 않음** — 별 툴로 고정 `SELECT`.

### 4.4 구현된 파일

| 구분 | 경로 |
|------|------|
| 툴 | `backend/domain/shared/tool/ifrs_agent/database/dp_query.py` — `query_company_info` |
| 등록 | `backend/domain/v1/ifrs_agent/hub/bootstrap.py` — `query_company_info` 등록 |
| 에이전트 | `backend/domain/v1/ifrs_agent/spokes/agents/dp_rag/agent.py` — `company_profile` 모든 응답에 포함 |
| 문서 | `backend/domain/v1/ifrs_agent/docs/dp_rag/dp_rag.md`, `IMPLEMENTATION_STATUS.md`, `TEST_SCENARIOS.md` |

### 4.5 `query_company_info` 동작 요약

- `company_id`(UUID)로 `company_info` 1행.  
- **반환에서 제외**: `phone`, `email`, `address` (연락·주소 미노출).  
- 행 없음·DB 오류 시 **`None`** → 응답의 `company_profile`은 `null`에 해당.

### 4.6 DP 유형 라우팅 + 적합성 경고 (2026-04-05 추가)

**제안 B (오케스트레이터 선행 체크)**:
- `orchestrator._check_dp_type_for_routing(dp_id)` 메서드 추가.
- `data_points.dp_type=quantitative`만 `dp_rag` 호출, 나머지는 생략 (fact_data 빈 dict).
- UCM 접두(`UCM...`)는 description 키워드로 정성 여부 판단.

**제안 A (dp_rag 내부 경고)**:
- `DpRagAgent._check_quantitative_suitability()` 메서드 추가.
- rulebook·UCM description에서 정성 키워드("여부", "방법", "설명", "공개" 등) 감지.
- `dp_type`이 `qualitative` / `narrative` / `binary`면 경고.
- 응답에 `suitability_warning` 필드 추가 (없으면 `null`).

**동작 흐름**:
```
오케스트레이터: dp_id → _check_dp_type_for_routing
  → quantitative: dp_rag 호출
  → 정성: 생략 (TODO: narrative_rag 라우팅)

dp_rag (quantitative만 도달):
  → _check_quantitative_suitability (보조 안전장치)
  → suitability_warning 반환 (정성 신호 감지 시)
```

### 4.7 Phase 1 정합 완료 (2026-04-05 오후)

- ✅ 오케스트레이터 → gen_node에 `narrative_data` 전달
- ✅ c_rag `narrative_query` 처리 (벡터 검색·LLM)
- ✅ gen_node 스텁 `narrative_data` (c_rag 형태) 처리
- ✅ pytest 통합 테스트 10개 시나리오

### 4.8 아직 스텁/미완(설계 대비)

- `aggregation_node`: `bootstrap`에서 주석 처리된 등록 — **실조회 미연결 가능성**  
- `gen_node`, `validator_node`: **스텁 개선됨**, 실 LLM 프롬프트는 미구현  
- `query_external_company_data` 등: TODO 주석 수준
- **정성 DP 전용 폼·문서** (`qualitative_dp_responses`, narrative_rag): 중장기 계획

---

## 5. 관련 문서 (깊이 있게 볼 때)

| 주제 | 경로 |
|------|------|
| dp_rag 상세 | `docs/dp_rag/dp_rag.md` |
| dp_rag 구현 상태 | `docs/dp_rag/IMPLEMENTATION_STATUS.md` |
| 전체 워크플로 설계 | `docs/REVISED_WORKFLOW.md` |
| DB 테이블 | `docs/DATABASE_TABLES_STRUCTURE.md` |
| 온톨로지 | `docs/DATA_ONTOLOGY.md` |
| 외부 뉴스 적재 | `domain/v1/data_integration/docs/Crawling/EXTERNAL_COMPANY_DATA_SAMSUNG_SDS_NEWS.md` |

---

## 6. Phase 1 정합 완료 (2026-04-05 오후)

### 6.1 파이프라인 연결

- ✅ 오케스트레이터 → gen_node payload에 `narrative_data` 추가
- ✅ c_rag에서 `narrative_query` 처리 (벡터 검색·LLM 재선택)
- ✅ gen_node 스텁이 `narrative_data` (c_rag 형태) 처리
- ✅ pytest 통합 테스트 10개 시나리오 작성

### 6.2 테스트 실행

```bash
cd backend
pytest domain/v1/ifrs_agent/tests/test_orchestrator_dp_routing_integration.py -v
```

---

## 7. 이후 작업 아이디어 (우선순위는 프로젝트에 맞게)

- **실 DB 환경 테스트** — pytest 실행 및 디버깅
- **gen_node 실구현** — Gemini 프롬프트 + `suitability_warning` / `narrative_data` 활용
- **정성 DP 전용 폼** — `qualitative_dp_responses` 테이블 + UI (중기)
- **narrative_rag** — SR·폼·문서 통합 검색 (장기)
- `aggregation_node` 실구현 및 `agg_data` 스키마를 설계 문서와 코드 정합

---

**끝.** 새 채팅에서는 “`NEW_CHAT_CONTEXT.md` 기준으로 이어가줘”라고 하면 된다.
