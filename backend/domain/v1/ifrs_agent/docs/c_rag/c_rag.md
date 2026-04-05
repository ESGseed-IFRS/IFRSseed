# c_rag

**최종 수정**: 2026-04-04  
**문서 버전**: 2.0 (벡터 상위 4건 + OpenAI LLM 재선택 기준)

---

## 1. 개요

`c_rag`(Category-based RAG)는 **카테고리 문자열**(예: 「직원 역량개발」)을 기준으로 **전년·전전년 등 요청 연도별** SR 보고서에서 **본문 1페이지(행) + 해당 페이지 이미지**를 고른 뒤 오케스트레이터에 넘기는 **참조 수집 노드**다. 계열사·외부 기업 집계 데이터는 **`aggregation_node`** 등 다른 노드가 담당한다.

| 항목 | 내용 |
|------|------|
| **코드** | `backend/domain/v1/ifrs_agent/spokes/agents/c_rag/agent.py` |
| **등록** | `hub/bootstrap.py` — `make_c_rag_handler(infra)` → `infra`에 `c_rag` 에이전트로 등록 |
| **본문 1차 선별** | `embed_text` + `query_sr_body_vector` — **임베딩 유사도 상위 4건** |
| **본문 최종 선택** | **OpenAI Chat Completions** — 후보별 `subtitle` / `toc_path` / 본문 미리보기를 보고 `chosen_index` JSON |
| **이미지** | 선택된 `report_id` + `page_number`로 `query_sr_images` |
| **DB** | `sr_report_body`, `historical_sr_reports`, `sr_report_images`, **pgvector** (`content_embedding`) |

**LLM 역할 구분**: `c_rag` 내부 재선택만 **OpenAI**를 쓴다. 오케스트레이터의 슈퍼바이저·생성 등 다른 단계의 모델과는 별개다.

---

## 2. 데이터 수집 범위

| 구분 | 수집 | 비고 |
|------|------|------|
| SR 본문 | 연도·회사별 **한 건** (`content_text`) | 벡터 4건 후 LLM이 1건 확정 |
| SR 이미지 | 위에서 고른 **페이지**의 이미지 메타데이터 | `sr_report_images` |
| 계열사/외부 | ❌ | `aggregation_node` 등 |

---

## 3. 처리 흐름

```
Orchestrator
    → infra.call_agent("c_rag", payload)
        → CRagAgent.collect(payload)
            연도별:
              1) _query_sr_body
                   embed_text(category)  [선택: runtime_config.embedding_model]
                   query_sr_body_vector(top_k=4)
                   _llm_pick_body_candidate → OpenAI → chosen_index
              2) _query_sr_images(report_id, page_number)
```

### 3.1 `collect` 입력 (`payload`)

| 필드 | 타입 | 설명 |
|------|------|------|
| `company_id` | `str` | 회사 UUID 문자열 |
| `category` | `str` | 사용자 주제·카테고리 (임베딩·LLM 프롬프트에 그대로 사용) |
| `years` | `list[int]` | 예: `[2024, 2023]` |
| `runtime_config` | `dict` (선택) | 아래 **런타임 설정** 참고 |

### 3.2 `collect` 출력 (연도별 키)

성공 시 각 연도 값:

- `sr_body` — 본문 텍스트  
- `page_number`, `report_id`  
- `sr_images` — `query_sr_images` 결과 리스트  

실패 시(해당 연도만 예외를 삼킴):

- `sr_body`: `""`, `sr_images`: `[]`, `page_number` / `report_id`: `null`  
- `error`: 예외 문자열  

---

## 4. 본문 선택 상세 (`_query_sr_body`)

1. **`query_sr_body_exact`는 `c_rag`에서 호출하지 않는다.**  
   과거에는 `subtitle` / `toc_path` 규칙 매칭을 1차로 썼으나, 현재는 **항상 벡터 → LLM** 경로만 탄다.  
   `query_sr_body_exact` 툴은 `bootstrap`에 등록된 채로 남아 있어 **다른 용도·디버깅**에만 해당한다.

2. **`embed_text`**  
   - 인자: `text` = `category`  
   - `runtime_config["embedding_model"]`이 있으면 함께 전달 (BGE-M3 등 프로젝트 기본과 맞춤).

3. **`query_sr_body_vector`**  
   - 인자: `company_id`, `embedding`, `year`, `top_k` (**`c_rag`는 고정 4** — 상수 `_VECTOR_TOP_K`)  
   - 툴 내부에서 `top_k`는 **1~20으로 클램프**.  
   - 조인: `sr_report_body` + `historical_sr_reports` (`report_year`, `company_id`).  
   - 정렬: `content_embedding <=> 질의벡터` 오름차순 (가까운 순).  
   - 반환 행 필드: `body`(= `content_text`), `page_number`, `report_id`, `subtitle`, `toc_path`, `similarity`(float).

4. **후보 0건**이면 `ValueError` — 해당 연도는 `collect`에서 `error` 필드로 기록.

---

## 5. LLM 최종 선택 (`_llm_pick_body_candidate`)

- **후보 1건**이면 LLM 없이 인덱스 `0`.  
- **`OPENAI_API_KEY` 없음** (`runtime_config["openai_api_key"]` 비어 있음): LLM 생략, **벡터 1순위(인덱스 0)**.  
- **모델**: `runtime_config["c_rag_llm_model"]` → 없으면 코드 폴백 **`gpt-5-mini`**. 전역 기본은 `get_settings().c_rag_llm_model`이며 환경변수 **`IFRS_C_RAG_LLM_MODEL`** 또는 **`C_RAG_LLM_MODEL`**로 덮어쓴다 (`backend/core/config/settings.py`, `agent_runtime_config_from_settings`).

프롬프트에 넣는 후보별 정보:

- `page_number`, `similarity`  
- `subtitle`, `toc_path`(JSON 직렬화 문자열, 길이 상한 있음)  
- `body` 앞부분 미리보기(약 450자)

기대 응답: JSON 한 덩어리, 형식 `{"chosen_index": <0..n-1>}`.  
우선 **`response_format={"type": "json_object"}`** 로 호출하고, 실패 시 **동일 메시지로 `response_format` 없이** 재시도한다.

### 5.1 `gpt-5-mini` / 일부 모델 주의

- **`temperature`를 넘기지 않는다.** 해당 계열은 `temperature`를 기본값(예: 1) 외로 두면 **400**이 난다.  
- 파싱 실패 시 **인덱스 0**으로 폴백한다.

---

## 6. 이미지 (`_query_sr_images`)

`infra.call_tool("query_sr_images", {"report_id", "page_number"})`.

구현: `backend/domain/shared/tool/ifrs_agent/database/sr_images_query.py`  
반환 필드 예: `id`, `image_index`, `image_url`, `caption`, `caption_confidence`, `image_type`, `image_width`, `image_height`, `placement_bboxes`, `extracted_at`.

에이전트는 툴 결과를 **가공 없이** 리스트로 그대로 반환한다.

---

## 7. 런타임 설정 (`runtime_config`)

오케스트레이터가 `payload["runtime_config"]`로 주입할 수 있는 항목(일부):

| 키 | 용도 |
|----|------|
| `openai_api_key` | LLM 재선택 |
| `c_rag_llm_model` | Chat 모델명 (기본 `gpt-5-mini` 계열) |
| `embedding_model` | `embed_text`에 전달 |

타입 정의: `backend/domain/v1/ifrs_agent/models/runtime_config.py` — `AgentRuntimeConfig`.

---

## 8. 관련 파일 요약

| 경로 | 역할 |
|------|------|
| `spokes/agents/c_rag/agent.py` | `CRagAgent`, `make_c_rag_handler` |
| `shared/tool/ifrs_agent/database/sr_body_query.py` | `query_sr_body_vector`, `query_sr_body_exact` |
| `shared/tool/ifrs_agent/database/sr_images_query.py` | `query_sr_images` |
| `hub/bootstrap.py` | 툴·에이전트 등록 |

---

## 9. 에러·로깅

| 상황 | 동작 |
|------|------|
| 특정 연도 본문 검색 실패 | 해당 연도만 `error` 문자열 포함 객체 반환; 다른 연도는 계속 처리 |
| 벡터 후보 없음 | `ValueError` → 위와 같이 연도별 `error` |
| LLM 키 없음 / 패키지 없음 / 파싱 실패 | 경고 로그 후 **인덱스 0** 등 폴백 |

로거 이름: `ifrs_agent.c_rag`.

---

## 10. 테스트 시 참고 (Mock)

`c_rag`는 **`query_sr_body_exact`를 부르지 않는다.** Mock 할 때는 최소:

1. `embed_text` → 임의 float 리스트(차원은 DB·임베딩 모델과 맞출 것)  
2. `query_sr_body_vector` → 최대 4개 dict (`body`, `page_number`, `report_id`, `subtitle`, `toc_path`, `similarity`)  
3. OpenAI를 끄려면 `runtime_config`에 `openai_api_key`를 비우면 **항상 0번 후보** 선택  
4. `query_sr_images` → 리스트

---

## 11. 참고 문서

- `REVISED_WORKFLOW.md`, `orchestrator` 관련 문서  
- `backend/domain/shared/tool/ifrs_agent/database/README.md` (툴 개요)

---

**최종 수정**: 2026-04-04
