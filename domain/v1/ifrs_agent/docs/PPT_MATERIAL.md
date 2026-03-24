# IFRS SR 보고서 자동 생성 에이전트 시스템

---

## 목차

1. 시스템 개요
2. 데이터베이스 테이블 전체 구조
3. 데이터 수집 파이프라인
4. End-to-End 플로우: 데이터 수집 → 사용자 트리거 → 페이지 생성
5. 아키텍처 및 구성 요소
6. Supervisor (오케스트레이터)
7. RAG Node (데이터 수집·추출)
8. Gen Node (문단 생성)
9. 전년도 SR 보고서 파싱 파이프라인
10. SR 보고서 벤치마킹 및 자동 개선
11. 기술 스택 요약

---

## 1. 시스템 개요

### 목적

IFRS S1/S2 기반 지속가능경영(SR) 보고서를 **AI 에이전트**로 자동 작성·검증·개선하는 시스템

### 핵심 가치

- **자동화**: 데이터 수집 → 문단 생성 → 검증까지 End-to-End
- **IFRS 준수**: S1/S2 요구사항 기반 검증·감사 내장
- **기업 맞춤**: 온프레미스 LoRA 학습으로 기업별 문체 일관성 유지
- **외부 피드백 반영**: 뉴스·공시·경쟁사 벤치마킹으로 지속적 개선

### 3가지 핵심 플로우

| 플로우 | 설명 |
|--------|------|
| **보고서 생성** | Supervisor → RAG Node(데이터 수집) → Gen Node(문단 생성) → 검증·감사 |
| **전년도 보고서 활용** | PDF 파싱 → Index/본문 분리 → DP→페이지 매핑 → JOIN 검색 → 생성 참조 |
| **벤치마킹·개선** | 외부 데이터 수집 → 평가 → 경쟁사 비교 → 개선점 도출 → 자동 재생성 |

---

## 2. 데이터베이스 테이블 전체 구조

시스템 전체에서 사용하는 테이블을 **4개 그룹**으로 나눕니다.

### 2.1 테이블 그룹 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│              전체 데이터베이스 테이블 구조 (PostgreSQL + pgvector)     │
└─────────────────────────────────────────────────────────────────────┘

 ┌─ A. 온톨로지 테이블 (4개) ─────────────────────────────────────┐
 │  ESG 기준서·지표·매핑·용어 등 "규칙(Rule)" 데이터              │
 │  data_points / unified_column_mappings /                        │
 │  disclosure_methods / glossary                                 │
 └───────────────────────────────────────────────────────────────┘

 ┌─ B. 기업 실데이터 테이블 (4+α개) ─────────────────────────────┐
 │  내부 시스템(ERP/EMS/EHS/HR)에서 수집된 "팩트(Fact)" 데이터   │
 │  sr_report_unified_data / ghg_emission_results /              │
 │  environmental_data / social_data / governance_data           │
 └───────────────────────────────────────────────────────────────┘

 ┌─ C. 전년도 SR 보고서 테이블 (4개) ────────────────────────────┐
 │  전년도 보고서 파싱 결과 저장                                  │
 │  historical_sr_reports / sr_report_index /                    │
 │  sr_report_body / sr_report_images                            │
 └───────────────────────────────────────────────────────────────┘

 ┌─ D. 벤치마킹·평가 테이블 (2개) ───────────────────────────────┐
 │  외부 피드백·평가·경쟁사 비교 데이터                           │
 │  news_articles / sr_report_evaluations                       │
 └───────────────────────────────────────────────────────────────┘
```

### 2.2 그룹 A: 온톨로지 테이블 (규칙 데이터)

ESG 기준서의 지표·요구사항·매핑·용어를 관리합니다. RAG Node가 DP 검색에, Supervisor가 검증에, Gen Node가 문단 생성에 사용합니다.

| 테이블 | 역할 | 주요 컬럼 | 사용 노드 |
|--------|------|----------|----------|
| **data_points** | DP 메타데이터 | dp_id, name_ko, name_en, standard, category, validation_rules, value_range, embedding(1024) | RAG, Supervisor |
| **unified_column_mappings** | 통합 컬럼 매핑 (기준서 중립) | unified_column_id, mapped_dp_ids[], column_category(E/S/G), financial_linkages[], disclosure_requirement, unified_embedding | RAG, Gen |
| **disclosure_methods** | 공시 방법·템플릿 | method_id, unified_column_id, template_type, writing_guideline, example_text | Gen |
| **glossary** | 용어집 | term_id, term_ko(UNIQUE), term_en, definition_ko, term_embedding | RAG, Gen |

#### 테이블 관계

```
data_points ──→ unified_column_mappings ──→ disclosure_methods
                        │
                        glossary (독립)
```

#### 통합 컬럼 매핑의 핵심 역할

여러 기준서의 **동일 의미 DP를 하나의 통합 컬럼**으로 묶어 관리합니다.

```
예: "Scope 1 온실가스 배출량" 통합 컬럼 (unified_column_id: UCM_GRI2_2_11_b)
    │  사용자는 이 UCM ID로 지정 (기준서별 dp_id가 아님)
    │
    ├── mapped_dp_ids: S2-29-a (IFRS S2), GRI-305-1 (GRI), SASB-EM-110a.1, TCFD-EM-1
    │
    ├── 속성:
    ├── column_category: 'E' (환경)
    ├── column_type: 'quantitative'
    ├── unit: 'tCO2e'
    ├── financial_linkages: ['탄소배출권', '배출권거래손익', '환경부채']
    ├── disclosure_requirement: '필수'
    └── unified_embedding: vector(1024)
```

### 2.3 그룹 B: 기업 실데이터 테이블 (팩트 데이터)

내부 시스템(ERP/EMS/EHS/HR)에서 수집된 기업별 ESG 실제 데이터입니다.

| 테이블 | 데이터 출처 | 주요 컬럼 | 역할 |
|--------|-----------|----------|------|
| **sr_report_unified_data** | 전체 통합 | company_id, period_year, unified_column_id, data_value, data_type, unit, data_source, confidence_score, included_in_final_report | RAG Node의 1순위 조회 대상 |
| **ghg_emission_results** | EMS | company_id, fiscal_year, scope1/2/3, total_emissions | Scope 1/2/3 배출량 |
| **environmental_data** | EMS/ERP | energy_usage, renewable_ratio, water_usage, waste_generated | 환경 데이터 |
| **social_data** | HR/EHS | total_employees, gender_breakdown, safety_incidents, training_hours | 사회 데이터 |
| **governance_data** | ERP/HR | board_composition, independent_directors, esg_committee | 지배구조 데이터 |

#### 데이터 흐름: 원천계 → 통합 테이블

```
EMS(배출량) ─┐
EHS(안전)  ─┤
HR(인사)   ─┤──→ 전처리·검증 ──→ sr_report_unified_data
ERP(재무)  ─┤                    (unified_column_id로 DP 매핑)
PLM(제품)  ─┤
SRM(공급망) ─┘
```

### 2.4 그룹 C: 전년도 SR 보고서 테이블

전년도 SR 보고서를 파싱하여 Index/본문/이미지를 분리 저장합니다.

| 테이블 | 주요 컬럼 | 용도 |
|--------|----------|------|
| **historical_sr_reports** | company_id, report_year, total_pages, index_page_numbers[] | 보고서 메타데이터 |
| **sr_report_index** | report_id, dp_id, page_numbers[], confidence_score, index_type(gri/sasb/ifrs) | DP → 페이지 매핑 (핵심) |
| **sr_report_body** | report_id, page_number, content_text, paragraphs(JSONB), embedding_id | 페이지별 본문·문단 |
| **sr_report_images** | report_id, page_number, image_type, caption_text, extracted_data(JSONB) | 이미지·캡션·차트 데이터 |

#### 핵심 JOIN 쿼리 (unified_column_id → 문단 검색)

사용자가 지정한 `unified_column_id`로 `unified_column_mappings`에서 `mapped_dp_ids`를 조회한 뒤, Index는 `dp_id`로 매핑되어 있으므로 해당 목록으로 검색합니다.

```sql
-- 1) unified_column_id → mapped_dp_ids (unified_column_mappings)
-- 2) 아래 쿼리에서 :mapped_dp_ids 사용
SELECT b.content_text, b.paragraphs, i.dp_id
FROM sr_report_index i
  JOIN historical_sr_reports hr ON i.report_id = hr.id
  JOIN sr_report_body b ON b.report_id = hr.id
    AND b.page_number = ANY(i.page_numbers)
WHERE i.dp_id = ANY(:mapped_dp_ids)
  AND hr.company_id = :company_id
  AND hr.report_year IN (2023, 2022)
```

### 2.5 그룹 D: 벤치마킹·평가 테이블

외부 피드백(뉴스·공시)과 보고서 평가 결과를 저장합니다.

| 테이블 | 주요 컬럼 | 용도 |
|--------|----------|------|
| **news_articles** | company_id, title, content, esg_relevance_score, sentiment(-1~+1), key_issues(JSONB) | 뉴스 감정 분석 |
| **sr_report_evaluations** | company_id, report_year, overall_score(0~100), news_sentiment_score, disclosure_alignment_score, issue_coverage_score, improvement_areas(JSONB) | 종합 평가 결과 |

---

## 3. 데이터 수집 파이프라인

데이터는 크게 **3가지 종류**로 분류하여 수집합니다.

### 3.1 데이터 분류

| 구분 | 설명 | 예시 | 저장 위치 |
|------|------|------|----------|
| **규칙 데이터 (외부)** | 공시 기준서·표준·가이드라인 | IFRS S1/S2, GRI, SASB, TCFD, ESRS, KCGS | 온톨로지 테이블 (그룹 A) |
| **팩트 데이터 (내부)** | 기업별 ESG 실제 데이터 | SR 보고서, 재무제표, ERP/EMS/EHS 원천계 | 기업 실데이터 테이블 (그룹 B) |
| **참조 데이터 (외부)** | 벤치마크·비교 데이터 | 경쟁사 보고서, 뉴스, 공시 | 벤치마킹 테이블 (그룹 D) |

### 3.2 규칙 데이터 수집 (기준서·표준)

| 기준서 | 출처 | 수집 방법 | 갱신 주기 | 파싱 기술 |
|--------|------|----------|----------|----------|
| **IFRS S1/S2** | ifrs.org | PDF 다운로드 | 연 1회 | LlamaParse |
| **GRI Standards** | globalreporting.org | ZIP 다운로드 | 연 1회 | LlamaParse |
| **SASB Standards** | sasb.ifrs.org | PDF/Excel | 연 1회 | LlamaParse |
| **TCFD** | fsb-tcfd.org | PDF | 수시 | LlamaParse |
| **ESRS** | efrag.org | PDF | 연 1회 | LlamaParse |
| **KSSB/KCGS** | kasb.or.kr / cgs.or.kr | PDF | 연 1회 | LlamaParse |

```
기준서 PDF 다운로드
    │
    ▼
LlamaParse로 구조화 파싱
    ├── 목차 추출
    ├── 섹션별 텍스트 추출
    ├── 요구사항 추출 (shall, must)
    └── DP 추출 및 매핑
    │
    ▼
온톨로지 테이블 저장
    ├── data_points (DP 메타)
    ├── unified_column_mappings (통합 매핑)
    └── glossary (용어집)
    │
    ▼
BGE-M3로 임베딩 생성 → 각 테이블 embedding 컬럼 저장
```

### 3.3 팩트 데이터 수집 (기업 내부 데이터)

#### 수집 경로 및 원천계

| 원천계 | 수집 데이터 | 연동 방식 | 동기화 주기 |
|--------|-----------|----------|-----------|
| **EMS** (환경관리) | 배출량, 에너지, 물, 폐기물 | REST API | 월 1회 |
| **EHS** (안전보건) | 산업재해, 안전 데이터 | REST API | 월 1회 |
| **HR/HRIS** (인사) | 임직원, 다양성, 교육 | REST API | 월 1회 |
| **ERP** (전사자원) | 재무, 구매, 에너지, 공급망 | OData(SAP) / REST(Oracle/더존) | 월 1회 |
| **PLM** (제품생명주기) | 제품 환경 데이터 | REST API | 월 1회 |
| **SRM/SCM** (공급망) | 협력업체, Scope 3 데이터 | REST API | 분기 1회 |
| **DART API** | 공시, SR 보고서 PDF | REST API | 주 1회 |

#### 데이터 수집 → 검증 → 저장 파이프라인

```
┌──────────────────────────────────────────────────────┐
│ Phase 1: 원천계 수집                                  │
│ EMS/EHS/HR/ERP/PLM/SRM/DART → Raw Data              │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│ Phase 2: 전처리 (Python 로직)                         │
│ · 데이터 타입 변환                                    │
│ · 단위 통일 (kWh→MWh, kg→t)                          │
│ · ERP 필드명 → ESG 필드명 매핑                        │
│ · 누락값 처리 (전년도 값)                              │
│ · 중복 제거                                          │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│ Phase 3: 검증 (Python 규칙 + 통계)                    │
│ · 필수 필드 검증                                      │
│ · 범위 검증 (0~100%, 최소/최대)                       │
│ · 일관성 검증 (합계, 비율)                             │
│ · 전년도 비교 (이상 수치 탐지)                         │
│ · 시계열 이상치 (Isolation Forest / LSTM)              │
│ · 물리적 임계치 (에너지 효율 한계, 배출 강도 최소)      │
│ · 다차원 상관관계 (매출↔배출량, 임직원↔에너지)          │
└────────────────────┬─────────────────────────────────┘
                     │
              이상 수치 발견 시
                     ▼
┌──────────────────────────────────────────────────────┐
│ Phase 4: LLM 이상 탐지 에이전트                       │
│ · 맥락 기반 정상/오류 구분                            │
│ · 원인 추론                                          │
│ · 확인/수정 필요 여부 판단                             │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│ Phase 5: 수정 요청 에이전트 (LLM)                     │
│ · 구체적 수정 요청 생성                               │
│ · 심각도 분류 (critical/high/medium/low)              │
│ · 사용자 알림 → 워크플로우 승인 프로세스               │
│   현업팀 → ESG팀 → 최종 승인권자                      │
└────────────────────┬─────────────────────────────────┘
                     │
              검증 통과 시
                     ▼
┌──────────────────────────────────────────────────────┐
│ Phase 6: DB 저장                                      │
│ → sr_report_unified_data (통합 데이터)                │
│ → ghg_emission_results / environmental_data 등        │
│ → DP(unified_column_id)에 매핑하여 저장               │
└──────────────────────────────────────────────────────┘
```

### 3.4 참조 데이터 수집 (벤치마킹용)

| 수집 소스 | 수집 대상 | 주기 | 분석 항목 | 저장 테이블 |
|----------|----------|------|----------|-----------|
| **뉴스** (네이버/다음/구글) | ESG 관련 기사 | 일 1회 | 감정 분석, 핵심 이슈 | news_articles |
| **경쟁사 SR** | 동일 업종 상위 5사 | 분기 1회 | Docling 파싱 → 평가 | historical_sr_reports |
| **외부 평가** (MSCI/CDP) | 등급, 피드백 | 선택 | 강점/약점 식별 | sr_report_evaluations |

### 3.5 수집 스케줄 종합

| 데이터 | 주기 | 수집 방법 |
|--------|------|----------|
| 기준서(IFRS/GRI) | 연 1회 | PDF 다운로드 → LlamaParse |
| DART 공시 | 일 1회 | DART REST API |
| 뉴스 크롤링 | 6시간마다 | 미디어 크롤러 |
| ERP/EMS 원천계 | 월 1회 | OData/REST API |
| 경쟁사 보고서 | 분기 1회 | DART → Docling 파싱 |

---

## 4. End-to-End 플로우: 데이터 수집 → 사용자 트리거 → 페이지 생성

### 4.1 전체 E2E 플로우 개요

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  사전 준비 단계 (초기 설정 + 주기적 수집)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[A] 기준서 파싱 → 온톨로지 DB (data_points, unified_column_mappings)
[B] 원천계 연동 → 전처리·검증 → 기업 실데이터 DB (unified_data 등)
[C] 전년도 SR 파싱 → Index/본문/이미지 DB
[D] 뉴스·공시 수집 → 벤치마킹 DB
[E] 기업별 LoRA 학습 (DART PDF → JSONL → EXAONE LoRA)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  실시간 단계 (사용자 트리거 → 페이지 생성)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1] 사용자 DP 선택 → Supervisor 요청 수신
[2] Supervisor: 요청 분석 (unified_column_id 기준) + 참고 SR 결정(sr_report_evaluations)
[3] RAG Node: 데이터 수집 (DB + 참고 SR 벡터 + MCP 외부)
[4] RAG Node: FactSheet 생성
[5] Gen Node: IFRS 문체 문단 생성
[6] Supervisor: 검증·감사 (그린워싱/IFRS/재무연결성)
[7] 검증 실패 → 피드백 루프 (RAG/Gen 재요청)
[8] 검증 통과 → 페이지 결과 반환
```

### 4.2 사전 준비 단계 상세

#### [A] 기준서 → 온톨로지 구축

```
IFRS S1/S2 PDF ──→ LlamaParse ──→ DP 추출 ──→ data_points 테이블
GRI Standards  ──→ LlamaParse ──→ 지표 추출 ──→ unified_column_mappings
SASB/TCFD/ESRS ──→ LlamaParse ──→ 매핑 생성 ──→ (동일 의미 DP 통합)
                                      │
                                      ▼
                               BGE-M3 임베딩 생성
                               → 각 테이블 embedding 컬럼
```

#### [B] 원천계 → 기업 실데이터

```
SAP/Oracle/더존 ERP
    ├── 재무 데이터 (매출, ESG 투자)
    ├── 에너지 데이터 (총에너지, 재생비율)
    ├── 구매/공급망 (Scope 3 계산)
    └── 인사 데이터 (임직원, 다양성)
         │
EMS ─── 배출량 (Scope 1/2/3)
EHS ─── 안전보건 (재해율, 사고)
HR  ─── 임직원 (성별, 고용형태, 교육)
         │
         ▼
전처리·검증·이상탐지 파이프라인
         │
         ▼
sr_report_unified_data (통합 저장)
    · unified_column_id로 DP 매핑
    · confidence_score로 신뢰도 표시
    · data_source로 출처 추적
```

#### [C] 전년도 SR → 파싱·저장

```
DART API → 전년도 SR PDF
    │
    ▼
Docling 파싱
    ├── Index 페이지 감지 → sr_report_index (DP→페이지 매핑)
    ├── 본문 추출 → sr_report_body (페이지별 문단)
    └── 이미지 추출 → sr_report_images (캡션, 차트 데이터)
```

#### [E] 기업별 LoRA 학습

```
DART → 전년도 SR PDF
    → LlamaParse 파싱
    → 섹션별 추출 + DP 매핑
    → JSONL 학습 데이터
    → Unsloth + QLoRA (EXAONE 3.0 7.8B)
    → 기업별 LoRA 모델 저장
```

### 4.3 실시간 단계 상세: 사용자 트리거 → 페이지 생성

```
━━━ STEP 1: 사용자 트리거 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

사용자가 플랫폼에서 통합 컬럼(Unified Column) 선택
  예: UCM_GRI2_2_11_b (unified_column_mappings에 정의된 ID)
  예: UCM_S2_15_a (기준서 중립 식별자, S2-15-a 등에 매핑)
    │
    ▼
"보고서 페이지 생성" 버튼 클릭
    │
    │  파라미터: company_id, fiscal_year, unified_column_id, (선택) target_standard
    │
    ▼

━━━ STEP 2: Supervisor 요청 분석 ━━━━━━━━━━━━━━━━━━━━━

Supervisor (Llama 3.3 70B, Groq)
    │
    ├── 1. unified_column_id 수신 → unified_column_mappings 조회
    │       disclosure_requirement, financial_linkages, value_range 등 확보
    │       필요 시 mapped_dp_ids로 기준서별 DP 식별 (Index 검색용)
    │
    ├── 2. 필요 통합 컬럼 목록 확정 (관련 unified_column_id 포함)
    │
    ├── 3. 참고할 SR 보고서 결정 (sr_report_evaluations 활용)
    │     ├── sr_report_evaluations 조회: 자사(company_id) + 전년(report_year) overall_score
    │     ├── 판단: overall_score >= 임계값(예: 80) → "자사 전년도 참고"
    │     │         overall_score < 임계값 → "평가 우수 기업 SR 참고"
    │     ├── [자사 전년도] reference_mode = 'self', reference_company_ids = [자사]
    │     └── [평가 우수] reference_mode = 'competitor',
    │           reference_company_ids = sr_report_evaluations에서 동일 업종·동일 연도·overall_score >= 임계값인 company_id 목록
    │
    └── 4. _decide_next_action() → "call_rag_node" (reference_mode, reference_company_ids 전달)
    │
    ▼

━━━ STEP 3: RAG Node 데이터 수집 ━━━━━━━━━━━━━━━━━━━━━

RAG Node (Llama 3.1 70B Tool-Use, Groq)
    │  입력: Supervisor가 넘긴 reference_mode, reference_company_ids (참고할 SR 대상)
    │
    ├── [1순위] 구조화 데이터: DB 직접 조회
    │     sr_report_unified_data
    │       WHERE company_id = ? AND unified_column_id = ?
    │       AND period_year = ? AND included_in_final_report = TRUE
    │     → 값, 단위, 출처, 신뢰도 추출
    │
    ├── [2순위] 비구조화 데이터: 벡터 검색 (BGE-M3 + BM25 하이브리드)
    │     ├── 참고 SR 보고서 문단 (Supervisor가 정한 참고 대상 기준)
    │     │     reference_company_ids + report_year로 historical_sr_reports 식별
    │     │     sr_report_index ↔ sr_report_body JOIN (해당 report_id; mapped_dp_ids로 dp_id 사용)
    │     │     같은 페이지 이미지도 검색 (sr_report_images)
    │     │
    │     ├── 지정 DP 요구사항·내용 조회 (벡터 검색 없음)
    │     │     unified_column_id → unified_column_mappings 조회
    │     │     disclosure_requirement, (필요 시) data_points 등 해당 DP 내용 → FactSheet에 반영
    │     │
    └── [MCP Tool] 외부 데이터 자동 수집 (필요 시)
          ├── DART Tool → 공시 조회
          ├── News Tool → 최신 뉴스
          └── Web Search → IFRS 최신 정보
    │
    ▼

━━━ STEP 4: FactSheet 생성 ━━━━━━━━━━━━━━━━━━━━━━━━━━

RAG Node → FactSheet 조립

{
  "unified_column_id": "UCM_GRI2_2_11_b",
  "column_name": "Scope 1 GHG 배출량",
  "structured_data": {
    "value": 1234.5, "unit": "tCO2e",
    "data_source": "EMS", "confidence": 95.0
  },
  "unstructured_data": [
    {"content": "전년도 보고서 문단...", "source_type": "historical_report"},
    {"content": "해당 통합 컬럼 공시 요구사항 (disclosure_requirement)...", "source_type": "disclosure_requirement"},
    {"content": "관련 이미지 캡션...", "source_type": "image"}
  ]
}
    │
    ▼

━━━ STEP 5: Gen Node 문단 생성 ━━━━━━━━━━━━━━━━━━━━━━

Gen Node (EXAONE 3.0 7.8B + 기업별 LoRA)
    │
    │  입력:
    │  ├── FactSheet (구조화 + 비구조화 + 지정 DP 요구사항 포함)
    │  ├── 전년도 참고 문단 (문체 일관성)
    │  └── disclosure_methods 템플릿
    │
    │  프롬프트:
    │  ├── 내부 시스템 데이터 우선 반영
    │  ├── 재무적 연결성 명시
    │  ├── 정량 데이터 + 출처 + 기준연도
    │  ├── 시계열 분석 (전년 대비 변화)
    │  └── IFRS 문체 (객관적, 전문적)
    │
    ▼
생성 결과:
    ├── 문단 본문 (IFRS 문체)
    ├── 재무적 영향 설명
    ├── 출처 목록
    ├── 데이터 품질 등급 (high/medium/low)
    └── 전년도 일관성 검사 결과
    │
    ▼

━━━ STEP 6-7: Supervisor 검증·감사 ━━━━━━━━━━━━━━━━━━

Supervisor 검증
    │
    ├── 그린워싱 체크 (위험도 > 0.7 → reject)
    ├── IFRS 준수 (점수 < 0.8 → 피드백)
    ├── 재무 연결성 확인
    └── 데이터 근거 확인
    │
    ├─ [실패] 구체적 피드백과 함께 노드에 재요청 ──→ STEP 3 또는 5로 복귀
    │    · DP 누락 → RAG Node에 재검색
    │    · 문단 품질 부족 → Gen Node에 재생성
    │    · 그린워싱 표현 → Gen Node에 수정 지시
    │
    └─ [통과] 최종 승인
    │
    ▼

━━━ STEP 8: 결과 반환 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

최종 페이지 결과
    ├── 본문 (IFRS 문체, 근거 주석 포함)
    ├── 재무적 영향 섹션
    ├── 참고 이미지 (전년도 차트 등)
    ├── 출처·데이터 품질 메타데이터
    └── 검증 결과 리포트

→ 사용자에게 반환 (플랫폼 UI 렌더링)
```

### 4.4 검증 피드백 루프 상세

```
Supervisor 검증 실패 시:

 Case 1: DP 누락
 ──────────────────────────────────
 준수 점수 < 0.8 & 누락 DP 존재
    → RAG Node에 재검색 지시
       "다음 통합 컬럼 추가 검색: unified_column_id 목록 또는 mapped_dp_ids"
       "벡터 DB / DART / 원천계에서 재조회"
    → RAG Node 재실행 → FactSheet 보강
    → Gen Node 재생성

 Case 2: 문단 품질 부족
 ──────────────────────────────────
 DP는 충분하나 표현 부족
    → Gen Node에 재생성 지시
       "재무적 연결성 명시 필요"
       "시계열 분석 추가 필요"
    → Gen Node 재실행

 Case 3: 그린워싱 감지
 ──────────────────────────────────
 그린워싱 위험도 > 0.7
    → Gen Node에 수정 지시
       "과장 표현 제거"
       "구체적 수치와 인증 기준 포함"
    → Gen Node 재실행
```

### 4.5 데이터 연결 관계 요약 (어떤 테이블이 언제 사용되는가)

| 단계 | 사용 테이블 | 용도 |
|------|-----------|------|
| **Supervisor: 요청 분석** | unified_column_mappings, data_points | 통합 컬럼 식별, disclosure_requirement 등 확인 |
| **Supervisor: 참고 SR 결정** | sr_report_evaluations | 자사 전년도 평가(overall_score) 조회 → 참고 대상 결정(자사 전년도 vs 평가 우수 기업) |
| **RAG: 구조화 수집** | sr_report_unified_data, ghg_emission_results 등 | 기업 실데이터 조회 |
| **RAG: 비구조화 수집** | sr_report_index + sr_report_body (JOIN) | Supervisor가 정한 참고 SR 문단 검색 |
| | sr_report_images | 관련 이미지 검색 |
| | unified_column_mappings (disclosure_requirement) | 지정 DP 요구사항 조회 → FactSheet 반영 |
| | glossary | 용어 검색 |
| **RAG: MCP 외부 수집** | (외부 API) | DART, 뉴스, 웹 검색 |
| **Gen: 문단 생성** | disclosure_methods | 공시 템플릿 참조 |
| | unified_column_mappings (financial_linkages) | 재무 연결성 정보 |
| **Supervisor: 검증** | unified_column_mappings (disclosure_requirement 등) | 공시 요구사항·값 범위 검증 |
| | unified_column_mappings (value_range) | 값 범위 검증 |
| **벤치마킹** | news_articles | 외부 피드백 |
| | sr_report_evaluations | 평가 점수 |

---

## 5. 아키텍처 및 구성 요소

### 구성 요소 일람

| 구성 요소 | 모델 | 학습 여부 | 주요 역할 |
|----------|------|----------|----------|
| **Supervisor** | Llama 3.3 70B (Groq) | X | 감사관 페르소나, 워크플로우 제어, 검증·감사 |
| **RAG Node** | Llama 3.1 70B Tool-Use (Groq) | X | 데이터 수집(DB+벡터), 팩트시트 생성 |
| **Gen Node** | EXAONE 3.0 7.8B | LoRA 학습 | IFRS 문체 문단 생성 |
| **Embedding** | BGE-M3 | Contrastive 학습 | ESG 전문 벡터 검색 |

### 노드 간 통신

- **FastMCP (Model Context Protocol)** 기반
- 각 노드는 독립 프로세스(MCP 서버)로 실행
- Supervisor가 MCP를 통해 각 노드를 호출·제어

### 전체 아키텍처 흐름

```
사용자 요청
    │
    ▼
┌──────────────────────────────────────────────┐
│              Supervisor (Llama 3.3 70B)       │
│   감사관 페르소나 · 워크플로우 제어 · 검증/감사   │
│                                              │
│  1. 요청 분석 → 통합 컬럼(unified_column_id) 식별 │
│  2. _decide_next_action() → 다음 액션 결정     │
│  3. 노드 호출 (MCP)                           │
│  4. 결과 검증 (그린워싱 · IFRS · 재무 연결성)    │
└──────┬────────────┬──────────────────────────┘
       │            │
  MCP 호출      MCP 호출
       │            │
       ▼            ▼
┌────────────┐  ┌────────────┐
│  RAG Node  │  │  Gen Node  │
│ 데이터 수집 │  │  문단 생성  │
└─────┬──────┘  └────────────┘
      │
      ├── DB 직접 조회 (그룹 B)
      ├── 벡터 검색 (그룹 A, C)
      └── MCP Tool (DART, News, Web)
```

---

## 6. Supervisor (오케스트레이터)

### 역할

- **감사관(Auditor) 페르소나**로 동작
- 전체 워크플로우를 중앙에서 제어하는 오케스트레이터

### 핵심 기능

| 기능 | 설명 |
|------|------|
| **요청 분석** | 사용자 요청(unified_column_id) → 통합 컬럼·mapped_dp_ids 식별 |
| **동적 라우팅** | LLM 기반으로 다음 액션 결정 (`_decide_next_action()`) |
| **노드 호출** | MCP를 통해 RAG Node / Gen Node 직접 호출 |
| **검증·감사** | 그린워싱 탐지, IFRS 준수 검사, 재무 연결성 검증 |
| **피드백 루프** | 검증 실패 시 구체적 피드백과 함께 노드에 재요청 |

### 동적 워크플로우 결정

```
현재 상태 분석
    │
    ▼
┌─────────────────────────────┐
│  필요 DP: N개               │
│  추출된 DP: M개             │
│  누락된 DP: (N-M)개         │
│  생성된 섹션: K개            │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  결정 옵션:                              │
│  1. call_rag_node  → 데이터 추출 필요     │
│  2. call_gen_node  → 문단 생성 필요       │
│  3. complete       → 모든 작업 완료       │
└─────────────────────────────────────────┘
```

### 검증·감사 프로세스

1. **그린워싱 체크**: 과장·모호 표현 탐지 (위험도 > 0.7이면 reject)
2. **IFRS 준수 검사**: 준수 점수 < 0.8이면 누락 DP 식별 후 RAG에 재검색 요청
3. **재무 연결성 확인**: ESG 지표 ↔ 재무제표 연결 정보가 충분한지 검증
4. **피드백 분기**:
   - DP 누락 → RAG Node에 재검색 지시
   - 문단 품질 부족 → Gen Node에 재생성 지시
   - 모든 검증 통과 → 승인

### Rulebook 기반 검증 예시

| 기준서 | 필수 DP | 검증 규칙 |
|--------|---------|----------|
| S1 거버넌스 | S1-GOV-1, -2, -3 | 이사회 역할·경영진 책임·보고 주기 명시 필수 |
| S1 전략 | S1-STR-1, -2 | 단기/중기/장기 구분, 재무적 영향 정량화 권장 |
| S2 기후 리스크 | S2-15-a, -b, -c | 물리적/전환 리스크 구분, 시나리오 분석, 재무제표 연결 필수 |

---

## 7. RAG Node (데이터 수집·추출)

### 역할

- **데이터 추출가** 페르소나
- 구조화 + 비구조화 데이터를 모두 수집하여 DP 단위 **팩트시트(FactSheet)** 생성

### 모델

- **Llama 3.1 70B Tool-Use** (Groq API)
- Tool Calling 성능이 3.3보다 우수 (함수 호출 정확도 높음)

### 데이터 수집 전략 (2계층)

```
┌─────────────────────────────────────────────────────────┐
│  1순위: 구조화된 데이터 (DB 직접 조회)                     │
│  ─────────────────────────────────────────               │
│  · sr_report_unified_data (통합 데이터)                   │
│  · ghg_emission_results / environmental_data 등           │
│                                                         │
│  unified_column_id → sr_report_unified_data 등 직접 조회 │
└─────────────────────────────────────────────────────────┘
                        │
                  데이터 부족 시
                        ▼
┌─────────────────────────────────────────────────────────┐
│  2순위: 비구조화된 데이터 (벡터 검색)                      │
│  ─────────────────────────────────────                   │
│  · 전년도 SR 보고서 문단 (Index↔본문 JOIN)                │
│  · 지정 DP 요구사항 (unified_column_mappings 조회)        │
│  · 외부 공시 문서 (DART, 뉴스)                            │
└─────────────────────────────────────────────────────────┘
```

### 하이브리드 검색

| 검색 방식 | 기술 | 가중치 |
|----------|------|--------|
| **Dense (임베딩)** | BGE-M3 벡터 검색 | 0.7 (70%) |
| **Sparse (키워드)** | BM25 | 0.3 (30%) |
| **융합** | RRF (Reciprocal Rank Fusion) | - |

### FastMCP 외부 데이터 수집

| MCP Tool 서버 | 도구 | 용도 |
|---------------|------|------|
| **DART Tool Server** | `get_sustainability_report` | 기업 공시·SR 보고서 조회 |
| | `search_disclosure` | 키워드 기반 공시 검색 |
| **Web Search Server** | `duckduckgo_search` | IFRS S1/S2 최신 정보 무료 검색 |
| | `tavily_search` | 고정밀 웹 검색 (API 키) |
| **News Server** | `search_news` | ESG 관련 최신 뉴스 |

### 멀티모달 처리

| 대상 | 기술 | 설명 |
|------|------|------|
| **표 추출** | LlamaParse | 마크다운 변환, 구조 인식 |
| **이미지 캡셔닝** | BLIP / GPT-4o Vision | 차트·그래프 설명 생성 |
| **차트 데이터 추출** | GPT-4o Vision | 차트에서 수치 데이터 JSON 추출 |

---

## 8. Gen Node (문단 생성)

### 역할

- **전문 작가** 페르소나
- RAG Node가 생성한 팩트시트를 기반으로 **IFRS 문체**로 보고서 문단 생성

### 모델

- **EXAONE 3.0 7.8B Instruct** + **LoRA 파인튜닝**
- 한국어 문체 최적화
- 기업별 전년도 SR 보고서로 LoRA 학습 → 문체 일관성

### 기업별 LoRA 학습 파이프라인

```
DART API → SR 보고서 PDF 다운로드
    → PDF 파싱 (LlamaParse)
    → 섹션별 추출 → DP 매핑
    → JSONL 학습 데이터 (instruction/input/output)
    → Unsloth + QLoRA 학습
    → 기업별 LoRA 모델 저장
```

### LoRA 학습 설정

| 항목 | 값 |
|------|-----|
| 베이스 모델 | EXAONE 3.0 7.8B Instruct |
| LoRA rank | 16 |
| LoRA alpha | 32 |
| 양자화 | 4bit (QLoRA, RTX 4070 Super 12GB 대응) |
| 최대 시퀀스 | 4096 |
| 학습률 | 2e-4 |
| Epoch | 3 |

### 문단 생성 프로세스

```
팩트시트 (RAG Node 출력)
    │
    ├── 구조화 데이터 (내부 시스템: EMS/EHS/ERP/PLM/SRM/HR)
    ├── 전년도 SR 보고서 참고 문단
    ├── 기준서 요구사항 (IFRS S2, GRI)
    └── 외부 공시 데이터 (검증용)
    │
    ▼
프롬프트 구성
    │
    ▼
기업별 LoRA 모델로 문단 생성
    │
    ▼
근거 주석 자동 추가
    │
    ▼
┌──────────────────────────────────────┐
│ 출력:                                │
│  · 문단 본문 (IFRS 문체)              │
│  · 재무적 영향 설명                   │
│  · 출처 목록                          │
│  · 데이터 품질 (high/medium/low)      │
│  · 전년도 일관성 검사 결과             │
└──────────────────────────────────────┘
```

### 작성 규칙

1. 전년도 보고서와 일관된 문체 유지
2. 재무적 연결성: 모든 ESG 지표 ↔ 재무제표 연결 명시
3. 정량적 근거: 수치에 출처·기준연도 포함
4. 시계열 분석: 전년 대비 변화율·추세 설명
5. 데이터 우선순위: 내부 시스템 > 전년도 보고서 > 외부 공시

### 데이터 품질 평가

| 등급 | 조건 |
|------|------|
| **high** | 내부 시스템 DB 데이터 존재 |
| **medium** | 전년도 SR 보고서 데이터만 존재 |
| **low** | 외부 크롤링 데이터만 존재 |

---

## 9. 전년도 SR 보고서 파싱 파이프라인

### 목적

전년도 SR 보고서를 파싱하여 **Index 페이지와 본문을 분리 저장**하고, **DP → 페이지 매핑**을 추출하여 DP 선택 시 정확한 문단을 검색

### Phase 1: 보고서 파싱 (초기 설정)

```
DART API → 전년도 SR PDF 다운로드
    │
    ▼
Docling으로 PDF 파싱
    │
    ├──→ [Index 페이지 감지]
    │     GRI/SASB/IFRS/ESRS 키워드 기반 자동 감지
    │     Index 테이블에서 DP → 페이지 번호 매핑 추출
    │     예: mapped_dp_ids 중 GRI-305-1 → [131]
    │
    ├──→ [본문 페이지 추출]
    │     Index 페이지를 제외한 본문
    │     페이지별 텍스트 추출 → 문단 분할
    │
    └──→ [이미지 추출]
          차트·그래프·사진 추출
          캡셔닝 (BLIP / GPT-4o Vision)
          차트 데이터 추출 (JSON)
    │
    ▼
DB 저장
    ├── historical_sr_reports  (보고서 메타데이터)
    ├── sr_report_index        (DP → 페이지 매핑)
    ├── sr_report_body         (페이지별 본문·문단)
    └── sr_report_images       (이미지·캡션·추출 데이터)
```

### Phase 2: 사용자 DP 선택 시 (실시간 검색)

```
사용자: 통합 컬럼 선택 (예: UCM_GRI2_2_11_b)
    │
    ▼
RAG Node: unified_column_mappings에서 mapped_dp_ids 조회 후 Index ↔ 본문 JOIN
    │
    │  sr_report_index.page_numbers = ANY(sr_report_body.page_number)
    │  WHERE dp_id IN (mapped_dp_ids) AND report_year IN (2023, 2022)
    │
    ▼
검색 결과 → FactSheet에 포함
    │
    ▼
같은 페이지의 이미지도 검색 (차트·그래프)
    │
    ▼
Gen Node: 전년도 문단 참고하여 새 문단 생성
```

### 이미지 처리 전략

| 단계 | 기술 | 비고 |
|------|------|------|
| **추출** | Docling | PDF에서 이미지 자동 추출 |
| **캡셔닝** | BLIP (기본) / BLIP-2 (고정밀) / GPT-4o Vision (최고) | 용도별 선택 |
| **타입 분류** | 키워드 기반 | chart / graph / table / diagram / photo |
| **데이터 추출** | GPT-4o Vision | 차트/그래프 → JSON (데이터 포인트, 추세) |

---

## 10. SR 보고서 벤치마킹 및 자동 개선

### 목적

외부 피드백(뉴스·공시·경쟁사)을 활용하여 현재 SR 보고서를 평가하고, 개선점을 도출하여 자동 조치를 적용

### 전체 플로우 (5단계)

```
Phase 1                Phase 2              Phase 3
외부 데이터 수집    →   현재 보고서 평가   →   경쟁사 보고서 수집·평가
(뉴스/공시/평가)       (외부 피드백 중심)      (동일 업종 상위 5사)
                            │                       │
                            ▼                       ▼
                       Phase 4                 Phase 5
                   벤치마킹·개선점 도출   →   자동 조치 적용
                   (현재 vs 경쟁사 비교)     (Gen Node 재생성)
```

### Phase 1: 외부 데이터 수집

| 수집 소스 | 주기 | 분석 항목 | 저장 |
|----------|------|----------|------|
| **뉴스** (네이버/다음/구글) | 일 1회 | ESG 관련성, 감정 분석, 핵심 이슈 추출 | news_articles |
| **외부 평가** (MSCI/CDP 등) | 선택 | 등급, 강점/약점, 권고사항 | - |

### Phase 2: 현재 보고서 평가

#### 평가 항목 및 가중치

| 평가 항목 | 가중치 | 평가 방법 |
|----------|--------|----------|
| **뉴스 감정 점수** | 20% | 최근 3개월 ESG 뉴스 평균 감정 → 신뢰도 점수 반영 |
| **핵심 이슈 반영도** | 50% | 뉴스 핵심 이슈가 SR에서 다뤄지는지 + 깊이 평가 |
| **외부 평가 기관** | 30% | MSCI/CDP 등 등급·권고사항 반영 (있는 경우) |

#### 종합 점수

```
종합 점수 (0~100) =
  (뉴스 감정 기반 신뢰도 × 0.2) +
  (이슈 반영도 점수 × 0.5) +
  (외부 평가 기관 점수 × 0.3)
```

### Phase 3~5: 벤치마킹 → 자동 개선

- **경쟁사**: 동일 업종 상위 5사, Docling 파싱, 동일 평가 기준
- **비교**: 경쟁사 대비 5점+ 낮은 섹션 식별
- **자동 개선**: Gen Node로 경쟁사 우수 사례 참조 재생성 → Supervisor 검증

#### 자동화 수준

| Level | 설명 |
|-------|------|
| **Level 1** | 평가·제안만 (사용자 승인 필요) |
| **Level 2** | 자동 개선 적용 (검증 후) |
| **Level 3** | 완전 자동화 (실시간 모니터링 기반) |

---

## 11. 기술 스택 요약

### LLM · AI 모델

| 용도 | 기술 | 비고 |
|------|------|------|
| Supervisor | Llama 3.3 70B (Groq) | 오케스트레이션, 검증·감사 |
| RAG Node | Llama 3.1 70B Tool-Use (Groq) | Tool Calling 최적화, 데이터 수집 |
| Gen Node | EXAONE 3.0 7.8B + LoRA | 한국어 IFRS 문체, 기업별 학습 |
| 임베딩 | BGE-M3 (Contrastive) | ESG 전문 벡터 검색 (1024차원) |
| 이미지 캡션 | BLIP / BLIP-2 / GPT-4o Vision | 차트 데이터 추출 포함 |
| 이상 탐지 | Isolation Forest / LSTM + LLM | ERP 데이터 검증 |

### 데이터베이스

| 용도 | 기술 |
|------|------|
| 메인 DB | PostgreSQL (JSONB, GIN 인덱스, 배열 연산) |
| 벡터 검색 | pgvector (HNSW 인덱스, Cosine 유사도) |
| 온톨로지 | PostgreSQL (6개 핵심 테이블) + 선택적 Neo4j |

### 파싱·문서 처리

| 용도 | 기술 |
|------|------|
| PDF 파싱 (SR) | **Docling** (표 구조·이미지 추출, OCR) |
| PDF 파싱 (기준서) | **LlamaParse** (구조화 파싱, 표 마크다운 변환) |
| 목차·섹션 | 키워드 기반 Index 감지 + 페이지 범위 추출 |

### 검색

| 용도 | 기술 |
|------|------|
| 벡터 검색 | BGE-M3 + pgvector |
| 키워드 검색 | BM25 (Sparse) |
| 하이브리드 | Dense(70%) + Sparse(30%), RRF 융합 |
| DP → 문단 검색 | SQL JOIN (sr_report_index ↔ sr_report_body) |

### 인프라·프로토콜

| 용도 | 기술 |
|------|------|
| 노드 간 통신 | **FastMCP** (Model Context Protocol) |
| 외부 데이터 수집 | FastMCP Tool 서버 (DART, Web Search, News) |
| 외부 API | DART API (공시·SR 보고서) |
| ERP 연동 | SAP OData / Oracle REST / 더존 REST |
| LoRA 학습 | Unsloth + QLoRA (4bit, RTX 4070 Super 12GB) |
| 학습 프레임워크 | PEFT, Transformers, PyTorch |
| 스케줄링 | APScheduler (데이터 수집 주기 관리) |

### 평가·분석

| 용도 | 기술 |
|------|------|
| 뉴스 감정 분석 | LLM 기반 (-1 ~ +1) |
| ESG 관련성 판단 | LLM (주제 분류, DP 매핑) |
| 이슈 반영도 | 뉴스 이슈 ↔ SR 섹션 매칭·깊이 |
| 그린워싱 탐지 | Supervisor LLM (과장·모호 표현) |
| IFRS 준수 | Rulebook 기반 + LLM 검증 |
| ERP 데이터 검증 | 규칙 기반 + 시계열 분석 + LLM 이상 탐지 |
