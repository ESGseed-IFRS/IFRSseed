# ESG 데이터(`esg_data`) 서비스 — LLM 컨텍스트·프롬프트 팩

이 파일은 **[서비스 설계 `esg_data.md`](./esg_data.md)** 와 **[아키텍처 `architecture.md`](./architecture.md)** 를 **대체하지 않습니다.**  
LLM이 사용자에게 **“esg_data가 무엇을 하고, SR(`data_integration`)과 어떻게 다른지, 어디가 설계 목표이고 어디가 구현된 API인지”** 를 설명할 때 쓰는 **압축 브리프**입니다. **테이블 스키마 전체·엔드포인트 상세 JSON·코드 경로**는 위 두 문서(및 UCM 하위 스펙)를 **같은 대화에 붙여야** 합니다.

> **역할 구분 (SR 브리프와의 대응)**  
> `data_integration`은 **본문·이미지·인덱스**처럼 PDF 파생 파이프라인이 **서로 다른 LLM 브리프 파일**로 갈라져 있다.  
> `esg_data`는 **한 도메인** 안에서 (1) **온톨로지·UCM**, (2) **GHG·사회·환경 등 운영 API**, (3) **`sr_report_unified_data` 통합 적재(설계)** 가 **문서상 축**으로 공존하므로, **이 파일 하나**에서 세 축을 구분해 설명하고, UCM **단계별** 상세는 **[`UCM/UCM_POLICY_PIPELINE_LLM_BRIEF.md`](./UCM/UCM_POLICY_PIPELINE_LLM_BRIEF.md)** 로 넘긴다.

---

## LLM에게 줄 때 권장 패키지 (중요)

| 구성 요소 | 파일 | 역할 |
|-----------|------|------|
| **1) 서비스 목적·테이블·통합 플로우** | [`esg_data.md`](./esg_data.md) | `sr_report_unified_data`, XOR 규칙, IngestionCoordinator 등 **설계·목표** |
| **2) Hub/Spokes·MCP·Phase** | [`architecture.md`](./architecture.md) | 레이어 다이어그램, `data_integration` 비교, 컴포넌트 경로 |
| **3) 이 브리프** | `ESG_DATA_LLM_BRIEF.md` | 세 축 요약·실제 API prefix·**부록 프롬프트** |
| **4) UCM 정책 파이프라인 (사용자 설명용)** | [`UCM/UCM_POLICY_PIPELINE_LLM_BRIEF.md`](./UCM/UCM_POLICY_PIPELINE_LLM_BRIEF.md) | 1~5차 임베딩→저장 |
| **5) UCM 정책·점수 스펙** | [`UCM/UCM_DECISION_POLICY_DESIGN.md`](./UCM/UCM_DECISION_POLICY_DESIGN.md), [`UCM/UCM_POLICY_PIPELINE_AND_LEGACY_BATCH.md`](./UCM/UCM_POLICY_PIPELINE_AND_LEGACY_BATCH.md) | 심층 질문 시 |
| **6) (선택) MCP·async 계획** | [`UCM/UCM_ESG_MCP_ASYNC_IMPLEMENTATION_PLAN.md`](./UCM/UCM_ESG_MCP_ASYNC_IMPLEMENTATION_PLAN.md) | 인프로세스·async 반영 요약 |
| **7) (선택) 소스** | `main.py`(라우터 마운트), `hub/orchestrator/*.py`, `api/v1/esg_data/*_router.py` | 호출 그래프 설명용 |

**주의**

- `architecture.md` 안의 **일부 코드 스니펫**(예: 예전 라우터 prefix, `create_ucm_from_datapoints`)은 **목표·예시**일 수 있다. **실제 HTTP 경로**는 아래 **「실제 API 마운트」** 와 **첨부한 `main.py`** 를 우선한다.  
- `esg_data.md` §11 체크리스트는 **설계상 과제**일 수 있음 — 구현 여부는 코드·별도 스펙을 본다.  
- 상대 경로만 있으면 LLM은 파일을 열 수 없다. 필요한 절은 **붙여 넣기**.  
- 소스 미첨부 시 **함수·필드 추측 금지**.

---

## 이 문서를 쓰는 방법 (요약)

| 목적 | 무엇을 붙이나 | 프롬프트 |
|------|----------------|----------|
| **비개발자·온보딩** | 이 브리프 + `esg_data.md` §1~5 | **부록 A** 또는 **부록 B** |
| **개발자 — 도메인·API** | `architecture.md` + 브리프 + (선택) 라우터 소스 | **부록 C** 또는 **부록 D** |
| **개발자 — UCM 심화** | UCM 폴더 스펙 + `UCM_POLICY_PIPELINE_LLM_BRIEF` | UCM 브리프 부록 또는 **부록 E** |
| **비교·경계 (SR vs ESG)** | `architecture.md` §7 + 브리프 | **부록 F** |

---

## 세 축으로 보는 `esg_data` (SR의 본문/이미지/인덱스에 대응하는 **구분선**)

| 축 | 한 줄 | 문서 근거 | 구현 상태(브리프 수준) |
|----|--------|-----------|-------------------------|
| **A — 온톨로지·UCM** | 여러 기준서 **데이터포인트**를 **`unified_column_mappings`** 로 묶고, 규칙·임베딩·정책(선택 LLM)으로 품질 관리 | `esg_data.md` §2.2, `architecture.md` §1·§4 | **정책 파이프라인**·`UCMOrchestrator`·공유 Tool·`ucm_policy` 등 **코드 존재**. 레거시 배치 툴은 **스텁** — 스펙 참고 |
| **B — 도메인 운영 API** | **GHG 활동**, **사회**, **환경** 데이터 적재·빌드 등 **REST** | `architecture.md` Hub, `main.py` 마운트 | **`/esg-data/ghg/...`**, **`/social/...`**, **`/environmental/...`** 등 실제 라우터(접두사는 아래 표) |
| **C — 통합 사실 테이블** | 소스 테이블들을 **`sr_report_unified_data`** 로 모으는 **배치 파이프라인** | `esg_data.md` §3~6, IngestionCoordinator | **설계·원칙** 중심; 세부 구현·API는 문서 초안(`§7 권장 API`)과 코드베이스를 **대조**해야 함 |

---

## 실제 API 마운트 (FastAPI)

`backend/api/v1/main.py` 기준, ESG Data 라우터는 **`prefix="/esg-data"`** 아래에 올라간다. 각 라우터가 **추가 prefix** (`/ucm`, `/ghg` 등)를 가진다.

| 영역 | 전체 경로 패턴 (예) | 비고 |
|------|---------------------|------|
| UCM | `/esg-data/ucm/...` | `pipeline/policy`, `pipeline/nearest`, 워크플로 등 — **`ucm_router`** |
| Social | `/esg-data/social/...` | **`social_router`** |
| GHG | `/esg-data/ghg/...` | 스테이징 → `ghg_activity_data` 빌드 등 — **`ghg_router`** |
| Environmental | `/esg-data/environmental/...` | **`environmental_router`** |

**정확한 메서드·바디**는 OpenAPI 또는 해당 `*_router.py` 를 따른다.

---

## 아키텍처·플로우 (개발자용 요약)

`architecture.md` §2.1과 정합되게 요약한다.

### 한 줄 (UCM·품질 중심)

**외부(HTTP / MCP)** → **FastAPI 또는 `esg_tools_server`(FastMCP)** → **`UCMOrchestrator` 등 Hub 오케스트레이터** → **에이전트·공유 Tool·`UCMMappingService`** → **`hub/repositories` → PostgreSQL(pgvector)**.

### 레이어별 역할

| 레이어 | 역할 |
|--------|------|
| **API** | `/esg-data/...` 검증·응답 |
| **Orchestrator** | UCM 정책 파이프라인 루프, LangGraph 워크플로(Phase 3), GHG/Social/Environmental 각 오케스트레이터 |
| **Agent** | `UCMCreationAgent` — 정책 퍼사드·LLM 재평가; SR의 대화형 `sr_agent`와 달리 **로직·선택적 LLM** |
| **MCP `esg_data_tools`** | 툴 핸들러에서 `UCMMappingService`·파이프라인 툴로 **인프로세스** 하강 — `data_integration`과 유사한 **계약 재사용** 목표 |
| **공유 Tool** | `shared/tool/UnifiedColumnMapping/` — 임베딩 후보, 규칙, 스키마 페이로드 |
| **Repository** | `esg_data/hub/repositories` — UCM·DP·도메인별 영속화 |

### `data_integration`과 한 줄 비교

| | `data_integration` | `esg_data` |
|--|---------------------|------------|
| 초점 | SR **PDF** → 본문·이미지·인덱스·외부회사 데이터 | **온톨로지·매핑·ESG 정량/활동 데이터**·품질 |
| 대표 산출 | `sr_report_body`, `sr_report_images`, `sr_report_index` | `unified_column_mappings`, (설계) `sr_report_unified_data`, `ghg_activity_data` 등 |
| 에이전트 | SR 쪽 LLM·에이전틱 경로 많음 | UCM은 **정책·선택 LLM** |

---

## 한 줄로 (서비스 요약)

**공시 기준서 간 지표를 같은 “통합 열”로 연결(UCM)하고**, GHG·사회·환경 데이터를 **API로 다루며**, (목표로) **SR 생성용 통합 사실 테이블**을 소스·매핑과 맞춰 유지한다.

---

## 비유 (초보자용)

- **데이터포인트·룰북**은 여러 나라 **어휘 사전**, **UCM**은 “이 단어와 저 단어는 같은 뜻”이라고 **통합 색인 카드**를 만드는 일이다.  
- **정책 파이프라인**은 카드을 붙이기 전에 **검색(임베딩) → 문법 검사(규칙) → (필요 시) 편집장(LLM) → 최종 결재 → 기록** 순서로 간다.  
- **GHG/사회/환경 API**는 공장·인사·환경 부서에서 올라오는 **숫자와 건수를 시스템에 넣는 창구**에 가깝다.  
- **`sr_report_unified_data`** (설계)는 나중에 보고서 엔진이 읽는 **한 장의 진실 표**를 만들려는 **목표 그림**이다.

---

## 꼭 알아 둘 용어

| 용어 | 한눈에 보는 뜻 |
|------|----------------|
| **`unified_column_mappings` (UCM)** | 여러 `dp_id`를 하나의 통합 열 ID로 묶은 매핑 행 |
| **`data_points` / `rulebooks`** | 기준서별 지표 정의와 공시 규칙 맥락 |
| **`hybrid_score`** | UCM 정책 파이프라인 1차에서 쓰는 벡터·구조 결합 점수 |
| **`sr_report_unified_data`** | SR용 통합 사실 테이블 — **UCM 경로 vs 미매핑 경로 XOR** (`esg_data.md` §3) |
| **`UCMOrchestrator`** | UCM 워크플로·정책 파이프라인·검증 단계 조율 |
| **`DirectEsgToolRuntime`** | 에이전트가 MCP 없이도 **인프로세스로** 동일 툴 핸들러를 부르는 경로 |
| **레거시 `create_mappings`** | 배치 매핑 **스텁** — 실매핑은 정책 파이프라인 문서 참고 |

---

## 하지 않는 것 (범위 밖)

- **SR PDF 파싱**(본문·이미지·인덱스) 전체 설명은 `data_integration`의 **`SR_*_PARSING_LLM_BRIEF.md`** 및 해당 설계 문서.  
- **배출량 계산식·Scope 1/2/3 산술**의 세부는 **`ghg_calculation`** 도메인 API·문서가 담당할 수 있다 — 질문이 계산 엔진이면 경로를 구분한다.  
- **`ifrs_agent` 워크플로 UI** 전체는 별도 라우터·문서.

---

## 부록 A — 다른 LLM에게 붙이는 지시문 (비개발자·온보딩)

```text
역할: 너는 첨부 Markdown만 근거로, 비개발자에게 ESG 데이터 백엔드 도메인 `esg_data`가 무엇인지 설명하는 가이드다.

규칙:
- 추측·외부 지식 금지. 없으면 "문서에 없음".
- 상대경로 링크는 열 수 없다는 전제.

출력 (한국어, 완전한 문장):
1) SR 보고서 파싱(`data_integration`)과 `esg_data`의 **목적 차이**를 4~6문장.
2) 세 축: **온톨로지·UCM**, **GHG/사회/환경 API**, **통합 사실 테이블(설계)** 을 각 2~4문장.
3) UCM이 왜 필요한지 **비유**로 3~5문장.
4) **실제 REST**는 `/esg-data` 아래에 여러 하위 경로가 있다는 점만(세부 path 지어내지 말 것).
5) `esg_data.md`의 통합 파이프라인이 **설계·체크리스트**일 수 있음을 명시.
6) 더 알고 싶으면 어떤 문서를 붙이면 좋은지(본 브리프 표) 한 문단.

마지막: 질문을 환영한다는 한 문장.
```

---

## 부록 B — 짧은 한 줄 (비개발자)

```text
첨부 ESG_DATA_LLM_BRIEF + esg_data.md §1~5만 근거로, 비개발자에게 esg_data를 한국어로 설명해 줘. data_integration과 구분, 세 축(UCM·도메인 API·통합표 설계), 추측 금지.
```

---

## 부록 C — 다른 LLM에게 붙이는 지시문 (개발자·아키텍처)

```text
역할: 동료 백엔드 개발자에게 esg_data를 설명하는 시니어 엔지니어.

입력: 첨부 Markdown(esg_data.md, architecture.md, 이 브리프)만 근거. 추가 소스가 없으면 코드 경로·시그니처 추측 금지.

과제 (한국어):
1) Hub/Spokes·오케스트레이터·에이전트·MCP·Repository 흐름 (architecture 다이어그램 수준).
2) main.py 기준 `/esg-data` 마운트와 ucm/ghg/social/environmental 역할.
3) UCM 정책 파이프라인 존재 — 상세 단계는 UCM_POLICY_PIPELINE_LLM_BRIEF를 참고하라고 안내.
4) architecture.md 예시 코드와 실제 진입점이 다를 수 있음 — 어떻게 검증할지.
5) esg_data.md 통합 플로우(IngestionCoordinator 등)의 지위(설계 vs 구현 확인 필요).

출력: 목차 본문 + 확인 불릿 6~10개.
```

---

## 부록 D — 짧은 한 줄 (개발자)

```text
첨부 architecture.md + ESG_DATA_LLM_BRIEF만 근거로 esg_data 레이어와 /esg-data 라우터 구성을 한국어로 설명해 줘. UCM 세부는 UCM 폴더 브리프로 넘기고 추측 금지.
```

---

## 부록 E — UCM 질문 전용 (한 줄)

```text
UCM 정책 파이프라인(임베딩~upsert)을 사용자에게 단계 번호로 설명하려면 첨부 UCM_POLICY_PIPELINE_LLM_BRIEF.md를 쓰고, 점수·페널티는 UCM_DECISION_POLICY_DESIGN.md를 붙여 한국어로 답해 줘. 추측 금지.
```

---

## 부록 F — data_integration vs esg_data (비교·경계)

```text
첨부 architecture.md §7 + ESG_DATA_LLM_BRIEF만 근거로, data_integration과 esg_data의 목적·에이전트 스타일·대표 산출물·MCP 패턴 공통점을 표로 정리하고, 질문이 어느 쪽 도메인인지 판별하는 기준을 한국어로 짧게 써 줘. 추측 금지.
```

---

## 더 깊게 (사람용 링크)

- [esg_data.md](./esg_data.md)  
- [architecture.md](./architecture.md)  
- [UCM_POLICY_PIPELINE_LLM_BRIEF.md](./UCM/UCM_POLICY_PIPELINE_LLM_BRIEF.md)  
- [UCM_DECISION_POLICY_DESIGN.md](./UCM/UCM_DECISION_POLICY_DESIGN.md)  
- [UCM_POLICY_PIPELINE_AND_LEGACY_BATCH.md](./UCM/UCM_POLICY_PIPELINE_AND_LEGACY_BATCH.md)

---

**작성**: LLM·온보딩용 서비스 브리프 (`esg_data.md` · `architecture.md` 정합)  
**상태**: 구현과 설계가 공존하므로, 엔드포인트·체크리스트는 **코드·OpenAPI와 대조**해 유지보수할 것  
