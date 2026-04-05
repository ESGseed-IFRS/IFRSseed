# UCM(Unified Column Mapping) 정책 파이프라인 — LLM 컨텍스트·프롬프트 팩

이 파일은 아래 **스펙 문서를 대체하지 않습니다.** LLM이 **사용자에게 “한 소스 지표가 다른 기준서 지표와 어떻게 연결되는지”** 를 **1차~5차 단계** 중심으로 설명할 때 쓰는 **압축 브리프**입니다. **점수식·페널티·API JSON 전체·TypedDict 필드**는 스펙을 같은 대화에 붙여야 합니다.

| 스펙 | 파일 | 쓰임 |
|------|------|------|
| **결정·정책·점수** | [`UCM_DECISION_POLICY_DESIGN.md`](./UCM_DECISION_POLICY_DESIGN.md) | `hybrid_score`, `compute_penalty`, `tentative_decision`, LLM 보정, `use_llm_in_mapping_service` |
| **5단계 코드 흐름·레거시 배치** | [`UCM_POLICY_PIPELINE_AND_LEGACY_BATCH.md`](./UCM_POLICY_PIPELINE_AND_LEGACY_BATCH.md) | 오케스트레이터 루프, 코드 인용, `create_mappings` 스텁 |
| **툴·MCP·아키텍처** | [`UCM_PIPELINE_IMPLEMENTATION_AND_MCP.md`](./UCM_PIPELINE_IMPLEMENTATION_AND_MCP.md) | 공유 Tool 모듈 경로, 레이어 설명 |
| **허브 전체** | [`../architecture.md`](../architecture.md) | esg_data Hub/Spokes, 라우터 마운트 |

**핵심 한 줄**: **소스 `data_point` 하나**에 대해 **임베딩으로 후보를 찾고 → 규칙으로 걸러고 → (선택) LLM으로 다듬은 뒤 정책으로 accept/review/reject를 정하고 → UCM 저장용 dict를 만들고 → DB에 upsert** 한다.

---

## LLM에게 줄 때 권장 패키지 (중요)

| 구성 요소 | 역할 |
|-----------|------|
| **1) `UCM_POLICY_PIPELINE_AND_LEGACY_BATCH.md`** | 5단계가 코드 줄 번호와 함께 나온 **1순위 근거** |
| **2) `UCM_DECISION_POLICY_DESIGN.md`** | 판정·점수·페널티·LLM 게이트 상세 |
| **3) 이 브리프** | 사용자 설명용 **단계 번호(1~5차)** · 비유 · **부록 프롬프트** |
| **4) (선택) `UCM_PIPELINE_IMPLEMENTATION_AND_MCP.md`** | Tool 파일 경로·MCP vs 인프로세스 |
| **5) (선택) 소스** | `ucm_orchestrator.py`, `ucm_policy.py`, `ucm_creation_agent.py` 일부 |

**주의**

- 상대 경로만 있는 다른 파일은 LLM이 열 수 없다. 필요한 절은 **붙여 넣기**.
- **레거시** `create_unified_column_mapping` / `UCMMappingService.create_mappings`는 **스텁(에러)** 이라 실매핑 설명에 쓰면 안 된다 — **정책 파이프라인**(`run_ucm_policy_pipeline` 등)이 실경로다.
- 소스를 첨부하지 않았으면 **함수 시그니처·필드명 추측 금지**. 스펙·브리프·첨부 코드에 있는 것만 말한다.

---

## 이 문서를 쓰는 방법 (요약)

| 목적 | 무엇을 붙이나 | 프롬프트 |
|------|----------------|----------|
| **비개발자·사용자 설명** | 이 브리프 + (선택) POLICY_PIPELINE §2 | **부록 A** 또는 **부록 B** |
| **개발자 — 단계·코드** | `UCM_POLICY_PIPELINE_AND_LEGACY_BATCH.md` 전문 | **부록 C** 또는 **부록 D** |
| **개발자 — 정책·점수** | DECISION_POLICY + POLICY_PIPELINE + 브리프 | **부록 E** 또는 **부록 F** |

---

## 1차 ~ 5차: 무엇을 하는가 (사용자·개발자 공통 뼈대)

한 **소스 지표(DP)** 마다 아래를 **순서대로** 반복한다. (`UCMOrchestrator.run_ucm_policy_pipeline` / `run_ucm_nearest_pipeline` 동일 골격; nearest는 타깃 기준서 대신 **가장 가까운** 후보를 쓴다.)

| 차수 | 이름(비공식) | 하는 일 | 코드에서 대응 |
|------|----------------|---------|----------------|
| **1차** | 임베딩·구조로 후보 찾기 | 소스 DP와 **타깃 기준서**(또는 nearest) 쪽 지표들 중, 벡터 유사도와 구조 점수를 섞은 **`hybrid_score`** 로 상위 `top_k` 후보 목록을 만든다. 임계값에 못 미치면 후보가 비어 **이 소스는 여기서 종료**(오류/반려 처리). | `EmbeddingCandidateTool.run` |
| **2차** | 규칙 검증 | 1차 후보마다 rulebook·데이터포인트 메타를 붙여 **통과 여부·점수·위반 목록**을 계산한다. 실패 시 이 소스는 **여기서 종료**. | `RuleValidationTool.run` → `per_candidate` |
| **3차** | 최적 쌍 + (선택) LLM + 정책 판정 | 후보·규칙 행 중 **치명 위반이 없는 쌍**만 남겨 **가장 점수 좋은 한 쌍**을 고른다(`pick_best`). 없으면 `no_valid_pair` 반려. **API에서 `use_llm_in_mapping_service=true`** 이면 소스 스냅샷·규칙 맥락을 모아 **마이크로배치로 LLM 재평가**(`llm_refinement_batch`) 후, 그 결과를 넣어 **최종 accept / review / reject** 와 confidence를 확정한다. 기본값은 LLM 끔. | `policy_pick_best` → `should_call_llm`(항상 True, 실질 스위치는 요청 플래그) → `llm_refinement_batch`(선택) → `policy_finalize_decision` → `ucm_policy.decide_mapping_pair` |
| **4차** | 매핑 행 페이로드 만들기 | 3차에서 정한 결정과 소스·타깃 DP 행으로 **`unified_column_mappings` 테이블에 넣을 dict** 를 조립한다. **아직 DB 쓰기 아님.** | `SchemaMappingTool.build_payload` |
| **5차** | DB 반영 | `dry_run=false` 이고 페이로드가 성공이면 **`upsert_ucm_from_payload`** 로 저장한다. `persist_mode`가 `per_item`이면 **건건마다**, `batch_end`이면 **배치 끝에 한꺼번에** upsert할 수 있다. | `UCMMappingService.upsert_ucm_from_payload` |

**한 줄로**: 1·2차는 **“누가 후보인가, 규칙상 말이 되나”**, 3차는 **“운영 정책과 (선택) LLM으로 최종 판을 내린다”**, 4·5차는 **“저장 형식으로 바꿔 실제로 넣는다”**.

---

## 아키텍처·플로우 (개발자용 요약)

### 한 줄 플로우 (요청 → DB)

**`POST /esg-data/ucm/pipeline/policy`** (또는 `/pipeline/nearest`) → **`UCMOrchestrator`** 가 DB에서 소스 DP 목록을 읽고 루프 → **1~5차** → 응답에 `stats`·`items`(결정·페이로드·upsert 결과 등).

### 레이어별 역할

| 레이어 | 역할 |
|--------|------|
| **FastAPI `ucm_router`** | 요청 검증, `use_llm_in_mapping_service`, `dry_run`, `persist_mode` 등 전달 |
| **UCMOrchestrator** | 소스 DP 루프, Tool 3종 호출, LLM 마이크로배치 플러시, 저장 분기 |
| **공유 Tool** (`shared/tool/UnifiedColumnMapping/`) | 임베딩 후보, 규칙, 스키마 페이로드 — **판단 없이 계산·변환** |
| **`ucm_policy`** | 점수·페널티·임계 판정·`decide_mapping_pair` — **순수 로직** |
| **`UCMCreationAgent`** | `policy_pick_best`, `policy_finalize_decision`, `llm_refinement_batch` |
| **`UCMMappingService`** | upsert·검증 등 영속화 퍼사드 |

### 기술 스택 (요지)

| 영역 | 기술 |
|------|------|
| API | **FastAPI**, **Pydantic** |
| 임베딩·DB | 기존 **`UCMMappingService` / 벡터 컬럼** (Embedding Tool 내부) |
| 정책 | **`ucm_policy.py`** (가중치·페널티 코드 고정; §13 `.env`는 미연동) |
| LLM | 켜졌을 때 **`llm_refinement_batch`**, 기본 모델명 요청에 `gpt-5-mini` 등(라우터 기본과 스펙 정합) |
| DB | **PostgreSQL**, **`unified_column_mappings`** upsert |

---

## 한 줄로 (파이프라인 요약)

**GRI·ESRS 같은 서로 다른 공시 언어**에서 **“이 지표와 저 지표가 같은 말인지”** 를 **자동으로 후보를 뽑고, 규칙과 정책(및 선택적 LLM)으로 판정한 뒤, 통합 매핑 테이블에 한 줄로 기록**한다.

---

## 비유 (초보자용)

- **1차 임베딩**은 도서관에서 **비슷한 제목의 책 여 권을 검색기로 찾아 오는 것**이다. 점수가 **`hybrid_score`** 로 붙는다.  
- **2차 규칙**은 사서가 **“단위·카테고리·필수 요건이 맞는지”** 책마다 스티커를 붙이는 단계다.  
- **3차**는 **가장 그럴듯한 한 권만 고르고**, 필요하면 **전문가(LLM)에게 한 번 더 물어본 뒤** “채택 / 검토 필요 / 반려”를 찍는다. 기본 설정은 **전문가 호출 안 함**.  
- **4차**는 **대출 카드에 적을 최종 문구를 양식에 맞게 적는 것**, **5차**는 **카드를 실제 장부(DB)에 붙이는 것**이다.

---

## 꼭 알아 둘 용어

| 용어 | 한눈에 보는 뜻 |
|------|----------------|
| **`UCM` / `unified_column_mappings`** | 여러 기준서의 DP를 **하나의 통합 열**로 묶어 둔 매핑 행. |
| **`hybrid_score`** | 1차에서 나오는 **벡터+구조** 결합 점수; 정책 점수식의 첫 항. |
| **`accept` / `review` / `reject`** | 3차 최종 판정. `review`는 **사람 검토 큐**로 이어지는 운영 모델을 전제로 할 수 있음. |
| **`use_llm_in_mapping_service`** | **LLM 3차 호출의 실질 스위치**(API 기본 `false`). |
| **`should_call_llm`** | 코드상 항상 `True` — **비용 절감 밴드는 아직 여기에 없음**(스펙 참고). |
| **`dry_run`** | `true`면 5차 upsert를 **건너뜀**. |
| **`persist_mode`** | `per_item` vs `batch_end` — 5차 저장 타이밍. |
| **`mapping_leaf_only`** | 리프 DP만 소스(및 타깃 후보)로 쓸지 여부(파이프라인 인자). |
| **레거시 배치** | `create_mappings` 스텁 — **실사용 금지**, 정책 파이프라인 사용. |

---

## API·엔드포인트 (빠른 참고)

- **정책(기준서 고정)**: `POST /esg-data/ucm/pipeline/policy`  
- **최근접(nearest)**: `POST /esg-data/ucm/pipeline/nearest`  

(`main.py`에서 `ucm_router`가 `prefix="/esg-data"` 아래에 포함됨; 라우터 자체는 `prefix="/ucm"`.)

요청 필드·응답 스키마 전체는 **스펙 문서·OpenAPI**를 따른다.

---

## 하지 않는 것 (브리프 범위 밖)

- **SR 보고서 PDF 파싱**(본문·이미지·인덱스)은 `data_integration` 도메인 문서.  
- **데이터포인트·룰북 JSON 시드 작성법**은 `ifrs_agent` 쪽 UCM 추출 가이드 등 별도.  
- **LangGraph 워크플로**(`run_ucm_workflow`)의 생성 노드가 **레거시 툴**만 치는 경로는 **정책 파이프라인과 다름** — 질문이 “워크플로 한 방”이면 스펙에서 구분해 설명할 것.

---

## 부록 A — 다른 LLM에게 붙이는 지시문 (사용자·비개발자 설명)

**사용법**: 아래 블록을 유저 메시지 **앞**에 두고, 이어서 **이 브리프 전체** + (선택) `UCM_POLICY_PIPELINE_AND_LEGACY_BATCH.md` §2 를 붙인다.

```text
역할: 너는 기술 문서만 근거로, 비개발자에게 UCM(통합 열 매핑) **정책 파이프라인**을 설명하는 가이드다.

규칙:
- 아래에 이어 붙인 Markdown만 근거로 답한다. 추측·외부 지식으로 채우지 않는다.
- 문서에 없으면 "문서에 없음"이라고 한다.
- 상대경로 링크는 열 수 없다는 전제로 답한다.

출력 구조 (한국어, 완전한 문장):
1) 비유(도서관·사서·대출 카드)로 **전체 목적**을 4~7문장.
2) **1차** 임베딩 후보 → **2차** 규칙 검증 → **3차** 최적 쌍·선택적 LLM·최종 판정 → **4차** 저장용 dict → **5차** DB upsert 를 **각각 2~4문장**으로 설명. 단계 번호를 반드시 쓴다.
3) **accept / review / reject** 가 사용자에게 무엘 의미하는지 일상어로.
4) **LLM은 기본적으로 끄고**, 켤 때는 API 플래그로 켠다는 점을 명확히.
5) **dry_run** 과 **persist_mode** 가 “실제 저장”에 주는 영향을 짧게.
6) 레거시 배치 경로는 **지금 쓰면 안 되는 이유**를 문서 근거로 한 문단 이내.

마지막에 한 문장: 빠진 주제가 있으면 질문해 달라고 안내한다.
```

---

## 부록 B — 짧은 한 줄 (비개발자)

```text
첨부 Markdown만 근거로, 비개발자에게 UCM 정책 파이프라인을 **1차~5차** 단계 번호를 붙여 설명해 줘. 임베딩 후보→규칙→(선택 LLM+)판정→페이로드→DB 순서, LLM 기본 off, 레거시 배치는 스텁이라 쓰지 말 것. 추측 금지.
```

---

## 부록 C — 다른 LLM에게 붙이는 지시문 (개발자용·단계·코드)

**사용법**: 아래 블록 → **`UCM_POLICY_PIPELINE_AND_LEGACY_BATCH.md` 전문** → (선택) `UCM_DECISION_POLICY_DESIGN.md`.

```text
역할: 너는 백엔드 동료에게 UCM 정책 파이프라인을 설명하는 시니어 엔지니어다.

입력: 이어 붙인 Markdown만 근거로 한다. 첨부에 없는 파일·함수·필드는 추측하지 말고 "문서에 없음"이라고 한다.

과제: 한국어로 다음을 순서대로 다룬다.

1) 오케스트레이터 진입 메서드 이름과, 소스 DP 한 건당 **5단계**를 Tool/에이전트/서비스 이름과 매핑.
2) 1차 `EmbeddingCandidateTool` 입력·출력 요지(`candidates`, `hybrid_score`).
3) 2차 `RuleValidationTool` → `per_candidate`.
4) 3차 `policy_pick_best`, LLM 마이크로배치 조건(`use_llm_in_mapping_service`), `policy_finalize_decision` / `ucm_policy.decide_mapping_pair`.
5) 4차 `SchemaMappingTool.build_payload`, 5차 `upsert_ucm_from_payload` 와 `dry_run`·`persist_mode`.
6) `run_ucm_nearest_pipeline` 와 policy 파이프라인의 차이 한 줄.
7) 레거시 `create_mappings` 스텁 — 왜 실매핑에 쓰면 안 되는지.

출력: 목차 번호 본문 + 마지막에 확인용 불릿 5~8개.
```

---

## 부록 D — 짧은 한 줄 (개발자)

```text
첨부한 UCM_POLICY_PIPELINE_AND_LEGACY_BATCH.md 전문만 근거로, 개발자에게 소스 DP당 5단계(임베딩→규칙→pick_best+LLM선택+finalize→payload→upsert)를 클래스·함수명과 함께 설명해 줘. 추측 금지.
```

---

## 부록 E — 정책·점수·LLM (개발자 심화)

**사용법**: 아래 블록 → **`UCM_DECISION_POLICY_DESIGN.md` 전문** + **이 브리프 「1차~5차」·「용어」**.

```text
역할: 너는 데이터 품질·매핑 정책을 동료에게 설명하는 엔지니어다. 비유는 최소화하고 용어를 정확히 쓴다.

입력: 첨부 Markdown만 근거로 한다.

과제: 한국어로 설명한다.

1) `compute_final_score` 가중치와 `hybrid_score` 의미.
2) `compute_penalty` 규칙(심각도·type·상한).
3) `tentative_decision_from_scores` 임계값과 `has_critical` 우선.
4) LLM 성공 시 `decide_mapping_pair` 가 점수·판정을 어떻게 보정하는지(문서에 있는 수식·분기만).
5) `use_llm_in_mapping_service` 와 `should_call_llm` 관계.
6) §13 `.env` 키가 현재 코드에 연동되지 않았다는 점.

금지: 첨부에 없는 임계값·필드 추가 창작.

출력: 소제목 6개 + 마지막에 "스펙 문서 읽는 순서" 한 문단.
```

---

## 부록 F — 짧은 한 줄 (정책 심화)

```text
첨부 UCM_DECISION_POLICY_DESIGN.md + 이 브리프만 근거로, hybrid_score·final_score·penalty·tentative·LLM 보정·use_llm 플래그를 개발자에게 한국어로 정리해 줘. 추측·환경변수 실연동 주장 금지.
```

---

## 더 깊게 (사람용 링크)

- [UCM_DECISION_POLICY_DESIGN.md](./UCM_DECISION_POLICY_DESIGN.md)  
- [UCM_POLICY_PIPELINE_AND_LEGACY_BATCH.md](./UCM_POLICY_PIPELINE_AND_LEGACY_BATCH.md)  
- [UCM_PIPELINE_IMPLEMENTATION_AND_MCP.md](./UCM_PIPELINE_IMPLEMENTATION_AND_MCP.md)  
- [architecture.md](../architecture.md)

---

**작성**: LLM·사용자 설명용 브리프 (정책 파이프라인 1~5차 중심)  
**상태**: 구현 정합 — 스펙 변경 시 본 문서의 표·부록을 함께 갱신할 것  
