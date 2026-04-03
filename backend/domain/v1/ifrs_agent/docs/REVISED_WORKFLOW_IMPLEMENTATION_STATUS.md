# REVISED_WORKFLOW 구현 현황

> **작성일**: 2026-04-02  
> **최종 반영**: 2026-04-02 — `social_data` 스테이징→적재 경로 구현 반영; `external_company_data`/`subsidiary_data_contributions`는 **Alembic 037**·설계(삼성SDS 뉴스 배치 크롤) 문서 정합성 반영  
> **기준 문서**: [REVISED_WORKFLOW.md](./REVISED_WORKFLOW.md)  
> **데이터 구조 참고**: [DATABASE_TABLES_STRUCTURE.md](./DATABASE_TABLES_STRUCTURE.md)  
> **목적**: 설계 대비 **저장소·코드**에서 무엇이 갖춰졌는지, 무엇이 비어 있는지 한곳에 정리한다.

---

## 1. 한눈에 보는 요약

| 구분 | 대상 | 현재 상태 (코드·연동 기준) |
|------|------|---------------------------|
| SR 파싱 적재 | `historical_sr_reports`, `sr_report_index`, `sr_report_body`, `sr_report_images` | **구현됨** (모델·저장 툴·파싱 결과 리포지토리) |
| 온톨로지·메타 | `unified_column_mappings`, `data_points`, `rulebooks` | **구현됨** (ORM·UCM 생성 스크립트·MCP 툴 일부) |
| **`social_data`** | 사회 지표 통합 (`workforce` / `safety` / `supply_chain` / `community`) | **구현됨** — [§2.3](#23-social_data-스테이징--적재) (스테이징 HR·SRM·EHS·ERP → 집계·upsert·API). **`dp_rag`·통합 SR 본문 자동 삽입 연동은 미구현** |
| 실데이터·통합 (그 외) | `environmental_data`, `governance_data`, `sr_report_unified_data` | **미구현** (아래 [§3](#3-미구현-또는-앱-레이어-미연동) — DB 마이그레이션만 존재할 수 있음) |
| 설계 추가분 | `aggregation_node`, `external_company_data`, `subsidiary_data_contributions` | **DB 스키마만** — Alembic `037_subs_ext_company_data` 로 두 테이블 생성 가능. **ORM·배치 크롤·`aggregation_node`·조회 API는 미구현** |
| 에이전트 파이프라인 | Orchestrator, `c_rag`, `dp_rag`, `gen_node`, `validator_node` (REVISED 기준) | **본 문서 범위 밖** — 별도 구현 상태 점검 필요 |

---

## 2. 구현되어 있는 항목

### 2.1 SR 보고서 관련 테이블

| 테이블 (실제 DB명) | 코드 위치 (예시) | 비고 |
|--------------------|------------------|------|
| `historical_sr_reports` | `data_integration/models/bases/historical_sr_report.py`, `shared/tool/sr_report/save/sr_save_tools.py` | 보고서 메타 1건 단위 저장 |
| `sr_report_index` | 동상, `sr_parsing_result_repository.py` | DP→페이지 매핑 등 |
| `sr_report_body` | `data_integration/models/bases/sr_report_body.py`, 배치 저장 툴 | 페이지별 본문, `toc_path`, `content_embedding` 등 |
| `sr_report_images` | `data_integration/models/bases/sr_report_images.py`, `sr_image_mapping.py`, VLM 보강 스크립트 | 캡션·임베딩 파이프라인 존재 |

> 참고: 문서상 표기 `history_sr_reports`가 아니라 코드·마이그레이션에서는 **`historical_sr_reports`** 를 사용한다.

### 2.2 온톨로지·DP·룰북

| 테이블 | ORM / 도구 |
|--------|------------|
| `unified_column_mappings` | `esg_data/models/bases/unified_column_mapping.py`, `create_unified_column_mapping` MCP·스크립트 |
| `data_points` | `esg_data/models/bases/data_point.py` |
| `rulebooks` | `esg_data/models/bases/rulebook.py` |

### 2.3 `social_data` (스테이징 → 적재)

| 구성요소 | 경로 | 비고 |
|----------|------|------|
| ORM | `backend/domain/v1/esg_data/models/bases/social_data.py` | `data_type` 체크 제약; `company_id`는 DB FK 가능하나 ORM에서는 UUID 컬럼만 (메타데이터 분리 시 `NoReferencedTableError` 방지) |
| 자연키 upsert | `hub/repositories/social_data_repository.py` | `(company_id, data_type, period_year)` 기준 create/update |
| 집계(순수 함수) | `hub/services/social_staging_extract.py` | `raw_data.items[]`의 **컬럼명(키)** 기준. HR·EHS·SRM·ERP 샘플(SDS)에 맞춘 분기·다양성·공급망·공헌·안전교육 등 규칙 |
| 빌드 서비스 | `hub/services/social_data_build_service.py` | `staging_hr` / `srm` / `ehs` / `erp` → `data_type`별 upsert |
| 오케스트레이터 | `hub/orchestrator/social_data_orchestrator.py` | UCM 패턴 진입점 |
| API | `backend/api/v1/esg_data/social_router.py`, `routes.py`에 라우터 등록 | 예: `POST .../esg-data/social/build-from-staging` |
| 테스트 | `esg_data/tests/test_social_staging_extract.py`, `test_social_data_build_service.py` | |
| DB | `019_sr_unified_core.py` 테이블 생성, `034_social_data_natural_key_unique.py` 유니크 인덱스 `uq_social_company_type_year` | |

**집계 소스 (스테이징 시스템별)**  
- **HR** → 주로 `workforce` + `safety`(안전 교육 시간 등) + `community`(공헌 키가 있을 때)  
- **EHS** → `safety` (KPI·`site_code`+`total_hours` 등)  
- **SRM** → `supply_chain`  
- **ERP** → `community` (`investment_krw`, `volunteer_hours` 등)

**아직 아닌 것**: `dp_rag`가 `social_data`를 조회해 SR 문단을 채우는 경로, `sr_report_unified_data`로의 자동 반영 등은 **별도 작업**.

---

## 3. 미구현 또는 앱 레이어 미연동

아래는 **REVISED_WORKFLOW의 `dp_rag`·통합 SR 작성** 관점에서 “팩트 소스”로 쓰기 위해 필요한데, **`social_data`를 제외하고** 현재 레포 기준으로 **적재·조회 파이프라인이 확인되지 않는** 항목이다. (운영 DB에 Alembic만 적용되어 **빈 테이블**이 있을 수는 있다.)

| 항목 | 설계상 역할 (요약) | 비고 |
|------|-------------------|------|
| `environmental_data` | 환경 지표 통합 | [DATABASE_TABLES_STRUCTURE.md](./DATABASE_TABLES_STRUCTURE.md) |
| `governance_data` | 지배구조 지표 통합 | 동일 |
| `sr_report_unified_data` | 통합 컬럼·미매핑 DP 등 SR 작성용 통합 팩트 | `environmental_data` 등과 FK·소스 엔티티로 연결되는 설계 |

**`social_data`**: 테이블 적재용 앱 경로는 [§2.3](#23-social_data-스테이징--적재)에 **구현됨**. 다만 위 표와 같이 **통합 SR·`dp_rag` 소비층**은 여전히 미연동으로 본다.

**마이그레이션**: `backend/alembic/versions/019_sr_unified_core.py` 에 위 테이블(및 `company_info`, `unmapped_data_points` 등) 생성 로직이 포함되어 있다.

### 3.1 REVISED_WORKFLOW에만 있고 코드에 없는 것

| 항목 | 설명 |
|------|------|
| **`aggregation_node`** | 계열사·외부 기업 데이터 집계 전용 실행 노드 — 코드베이스에 해당 모듈 없음 |
| **`external_company_data`** | 보도·언론 스냅샷 테이블 — **[REVISED_WORKFLOW.md](./REVISED_WORKFLOW.md)** 기준 **삼성SDS [언론보도](https://www.samsungsds.com/kr/news/index.html)** 의 **`div#bThumbs`·`div#sThumbs`** 를 **배치 크롤**해 적재·(선택) 수동 보완. **마이그레이션 `037_subs_ext_company_data` 존재**; **ORM·크롤 잡·리포지토리 없음** |
| **`subsidiary_data_contributions`** | 계열사/자회사 상세 — **마이그레이션 `037_subs_ext_company_data` 존재**; **ORM·적재 파이프라인 없음** |

#### 3.1.1 설계와 레포의 정합 (external_company_data)

| 구분 | 상태 |
|------|------|
| **DB 테이블** | `backend/alembic/versions/037_subsidiary_external_company_tables.py` (`revision`: `037_subs_ext_company_data`) |
| **배치 크롤 대상** | 단일 진입 URL + DOM: [언론보도 index](https://www.samsungsds.com/kr/news/index.html) — `#bThumbs`(보도자료 메인), `#sThumbs`(언론이 본 삼성SDS). (선택) **준실시간**: 백그라운드 고빈도 폴링·변경 감지·RSS. 상세는 REVISED_WORKFLOW §2.2·§3.2.7 및 [data_integration/docs/Crawling/EXTERNAL_COMPANY_DATA_SAMSUNG_SDS_NEWS.md](../../data_integration/docs/Crawling/EXTERNAL_COMPANY_DATA_SAMSUNG_SDS_NEWS.md) §5.1. |
| **시드/더미 (수동 검증용)** | `backend/scripts/seeds/external_company_data_dummy.sql`, `external_company_data_dummy.json` — 운영 크롤과 무관한 샘플. |
| **앱 레이어** | 적재 서비스, 스케줄러, `aggregation_node`, `select_external_company_data` 등 **미구현**. |

---

## 4. 설계 문서와 실제 스키마의 차이 (c_rag 관련)

[REVISED_WORKFLOW.md](./REVISED_WORKFLOW.md) 예시 SQL은 `category_column`, `toc_path_embedding`, `body_text` 등을 가정하지만, 현재 `sr_report_body` 모델은 예를 들어 다음과 같이 **이름·형태가 다를 수 있다**.

- 본문: `body_text` 대신 **`content_text`**
- 카테고리 전용 컬럼: **`category_column` 없음** (목차는 `toc_path` JSONB 등)
- 임베딩: 문서의 `toc_path_embedding` 대신 **`content_embedding`** 등

→ **c_rag** 를 구현할 때는 설계서 쿼리를 **실제 컬럼에 맞게 수정**하거나, 마이그레이션으로 컬럼을 추가하는 결정이 필요하다.

---

## 5. 구현 시 권장 순서 (참고)

1. **`environmental_data` / `governance_data`**: ORM·리포지토리·스테이징 집계 경로 확정 후 `dp_rag` 가 조회 가능하게 연결 (`social_data`와 유사 패턴 참고 가능)  
2. **`sr_report_unified_data`**: 통합 컬럼·미매핑 DP 정책에 맞춰 적재·조회 API 정의; **`social_data` 등 소스에서 unified로의 동기화**  
3. **`social_data` 소비층**: `dp_rag`·SR 템플릿에서 `social_data` 조회 연동 (적재는 [§2.3](#23-social_data-스테이징--적재) 완료)  
4. **`subsidiary_data_contributions`**, **`external_company_data`**: 마이그레이션 **037 적용**(완료 시 DB에 테이블 존재) + **배치·(선택) 준실시간 폴링** 인제스션([삼성SDS 언론보도](https://www.samsungsds.com/kr/news/index.html) `#bThumbs`/`#sThumbs` 또는 RSS, 변경 감지, JS 렌더 시 헤드리스·API 대안 검토) + (선택) 수동 주입 API + ORM·리포지토리 + **`aggregation_node`**  
5. **Orchestrator + 병렬 수집**: `c_rag`·`dp_rag`·`aggregation_node` 병합 로직 ([REVISED_WORKFLOW.md](./REVISED_WORKFLOW.md) §4.3.2)

---

## 6. 문서 정합성

- 본 문서는 **2026-04-02 시점** 레포 검색·주요 경로 확인에 기반한다.  
- `social_data` 적재 파이프라인은 동일 시점 코드 기준 **구현 반영**되었다.  
- Alembic 적용 여부는 환경마다 다르므로, 실제 DB에는 §3 테이블이 **이미 존재할 수 있음**을 §3 본문에서 구분해 두었다.  
- **`external_company_data` 수집 전략**은 [REVISED_WORKFLOW.md](./REVISED_WORKFLOW.md)와 동일하게 **SR 요청 경로에서는 크롤 없음**, **배치 또는 백그라운드 준실시간 폴링**으로 삼성SDS 뉴스 `#bThumbs`/`#sThumbs`(또는 RSS) 수집을 기본으로 본다(구현은 §3.1.1 미구현). 세부는 [data_integration/docs/Crawling/EXTERNAL_COMPANY_DATA_SAMSUNG_SDS_NEWS.md](../../data_integration/docs/Crawling/EXTERNAL_COMPANY_DATA_SAMSUNG_SDS_NEWS.md) §5.1.
