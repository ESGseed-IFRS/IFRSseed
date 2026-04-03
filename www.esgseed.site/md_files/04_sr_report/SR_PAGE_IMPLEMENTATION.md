# SR 보고서 작성 페이지 기능 구현 전략

> **목적**: SR 보고서 작성 페이지의 목차-공시기준 매칭, 직접 작성/AI 문단 생성 탭 분리, 시각화 자료 추천 기능 정의  
> **정량 데이터**: 수동 입력 폼 없음 — ERP/EMS 등 외부 시스템 연동으로 처리  
> **참조 화면**: SR 보고서 작성 페이지 (3단 레이아웃 — 목차 / 작성 영역 / 공시기준·준수율)

---

## 1. 페이지 레이아웃 구조

```
┌──────────────┬──────────────────────────────────┬─────────────────────┐
│  목차        │  작성 영역                         │  우측 패널          │
│  (좌측)      │  (중앙)                            │  (우측)             │
│              │  [직접 작성] [AI 문단 생성]         │                     │
│  TABLE OF    │                                    │  전체 준수율        │
│  CONTENTS    │  직접 작성 탭:                     │  준수/부분/미준수   │
│              │  - 리치 텍스트 에디터               │                     │
│  섹션 클릭   │  - [저장] 버튼                     │  관련 공시 기준     │
│  → 해당      │                                    │  매핑된 기준 목록   │
│  페이지 이동 │  AI 문단 생성 탭:                  │                     │
│              │  - 생성 조건 요약                  │  시각화 추천        │
│              │  - [AI 문단 생성] 버튼              │  차트/테이블 추천   │
│              │  - 미리보기 → 에디터 삽입           │  [도표 생성으로 →] │
└──────────────┴──────────────────────────────────┴─────────────────────┘
```

---

## 2. 기능 상세

---

### F-01. 목차 ↔ 공시기준 매칭

각 목차 페이지에 해당하는 GRI / IFRS S2 공시 기준을 사전 매핑해두고, 페이지 선택 시 우측 패널에 자동 표시한다.

#### DB 구조

```sql
-- 목차 페이지
disclosure_pages
  id          SERIAL PRIMARY KEY
  page_no     INTEGER        -- 예: 04
  title       VARCHAR        -- 예: Introduction
  section     VARCHAR        -- 예: ESG Performance
  order_index INTEGER

-- 공시 기준
disclosure_standards
  id          SERIAL PRIMARY KEY
  framework   ENUM('GRI', 'IFRS_S2', 'SASB')
  code        VARCHAR        -- 예: GRI 2-1, IFRS S2-10
  title       VARCHAR
  description TEXT

-- 페이지 ↔ 공시기준 매핑
page_standard_mapping
  page_id     INTEGER REFERENCES disclosure_pages(id)
  standard_id INTEGER REFERENCES disclosure_standards(id)
  is_required BOOLEAN        -- 필수 / 권장 구분
```

#### 우측 패널 공시기준 표시 예시

```
관련 공시 기준
페이지 (04) Introduction와 관련된 기준

● [필수] GRI 2-1  조직 세부 사항
  기업의 법적 명칭, 소유 형태, 사업장 위치 등을 보고한다.

● [필수] GRI 2-2  조직이 지속가능성 보고에 포함하는 실체
  ...

○ [권장] IFRS S2-4  전략 및 전환 계획
  ...
```

---

### F-02. 작성 모드 분리 — 직접 작성 / AI 문단 생성

#### 탭 UI

```
┌─────────────────────────────────────────────────┐
│  [ 직접 작성 ]   [ AI 문단 생성 ]                │
│  ─────────────────────────────────────────────  │
```

---

#### 직접 작성 탭

- 리치 텍스트 에디터 (굵기·기울임·목록·표 삽입 툴바)
- 30초 자동 임시저장
- [저장] 버튼 클릭 시 DB 반영 및 준수율 재계산
- 작성 분량이 50자 미만일 경우 저장 시 "내용이 너무 짧습니다" 경고

---

#### AI 문단 생성 탭

AI가 해당 페이지에 맞는 문단 초안을 생성한다.

**생성 시 참조하는 컨텍스트:**

| 참조 데이터 | 출처 |
|------------|------|
| 회사명·업종·규모·ESG 목표 | 회사정보 페이지 |
| GHG 배출량 Scope 1·2·3 | GHG 산정 페이지 |
| 매핑된 공시기준 텍스트 | disclosure_standards |
| 이전 페이지 작성 내용 | sr_page_contents |
| ERP/EMS 연동 정량 데이터 | 외부 시스템 연동값 |

**생성 흐름:**

```
[AI 문단 생성] 클릭
  → 로딩 (생성 중...)
  → 생성된 문단 미리보기 표시
      ├ [이 내용 사용]   → 직접 작성 탭 에디터에 삽입
      ├ [다시 생성]      → 재생성 요청
      └ [직접 수정]      → 에디터에서 편집 후 저장
```

**생성 전 조건 요약 표시** (사용자가 어떤 데이터로 생성되는지 확인 가능):

```
이 문단은 아래 정보를 바탕으로 생성됩니다.
✓ 회사정보 입력됨
✓ GHG 산정 데이터 연동됨
✗ ERP 연동 데이터 없음 (연동 시 더 정확한 문단 생성 가능)
```

---

### F-03. 정량 데이터 — ERP / EMS 연동

수동 입력 폼은 제공하지 않는다. 외부 시스템 연동을 통해 데이터를 가져온다.

#### 연동 방식

```
ERP / EMS 시스템
  → REST API 또는 DB 직접 조회
  → 표준화된 quantitative_data 테이블에 저장
  → SR 작성 페이지 AI 생성 컨텍스트로 활용
  → 시각화 추천 데이터로 활용
```

#### 연동 상태 표시

- 연동됨: 정량 데이터 정상 수신, AI 생성 시 자동 반영
- 미연동: AI 생성 시 "정량 데이터 없음" 안내, 문단 생성은 가능하나 수치 미포함

#### DB 구조

```sql
quantitative_data
  id           SERIAL PRIMARY KEY
  company_id   INTEGER
  page_id      INTEGER REFERENCES disclosure_pages(id)
  field_key    VARCHAR    -- 예: ghg_scope1, energy_total
  value        NUMERIC
  unit         VARCHAR
  year         INTEGER
  prev_value   NUMERIC    -- 전년도 값
  source       ENUM('GHG_MODULE', 'ERP', 'EMS', 'MANUAL')
  synced_at    TIMESTAMP
```

---

### F-04. 시각화 자료 추천

우측 공시기준 패널 하단에 현재 페이지에 적합한 차트·테이블을 추천한다.  
도표 생성 페이지(`/charts`)와 연동하여 클릭 시 바로 생성 가능하도록 연결한다.

#### 추천 로직

페이지별 매핑된 공시기준과 연동 가능한 데이터를 기반으로 추천 유형을 결정한다.

| 조건 | 추천 차트 유형 |
|------|---------------|
| Scope 1·2·3 데이터 존재 | 누적 막대 그래프 (Scope별 비교) |
| 연도별 수치 데이터 2개 이상 | 라인 차트 (연도별 추이) |
| 전체 대비 비율 데이터 | 도넛 차트 |
| 항목별 수치 나열 | 데이터 테이블 |
| 여러 지표 동시 비교 | 방사형(레이더) 차트 |
| 목표 대비 달성률 | 진행률 바 (Gauge 차트) |

#### UI 표시

```
┌─────────────────────────────────────┐
│  시각화 추천                         │
│  이 섹션에 어울리는 자료              │
│  ───────────────────────────────── │
│  📊 온실가스 배출량 막대 그래프       │
│     Scope 1·2·3 연도별 비교          │
│     [도표 생성으로 이동 →]           │
│  ───────────────────────────────── │
│  📋 배출량 현황 테이블               │
│     항목별 수치 및 전년 대비          │
│     [도표 생성으로 이동 →]           │
│  ───────────────────────────────── │
│  🍩 에너지 믹스 도넛 차트            │
│     재생에너지 비율                  │
│     [도표 생성으로 이동 →]           │
└─────────────────────────────────────┘
```

#### 도표 생성 페이지 연동

[도표 생성으로 이동 →] 클릭 시 쿼리 파라미터로 차트 타입과 데이터 키를 전달한다.

```
/charts?type=stacked_bar&data=ghg_scope&page_id=33
```

도표 생성 페이지에서:
- 해당 차트 타입 자동 선택
- 연동 데이터 자동 바인딩
- 사용자는 스타일·색상만 조정 후 저장

---

## 3. 준수율 계산 로직

```typescript
function calcPageCompliance(page) {
  const hasContent = (page.content?.length ?? 0) > 50
  const requiredStandards = page.standards.filter(s => s.is_required)

  if (!hasContent) return 'NON_COMPLIANT'          // 내용 없음: 미준수
  if (requiredStandards.length === 0) return 'COMPLIANT'

  const coveredCount = requiredStandards.filter(s =>
    page.content.includes(s.code)                  // 공시코드 언급 여부
    || page.quantData.find(q => q.standard_id === s.id)
  ).length

  const ratio = coveredCount / requiredStandards.length
  if (ratio >= 0.9) return 'COMPLIANT'
  if (ratio >= 0.6) return 'PARTIAL'
  return 'NON_COMPLIANT'
}

// 전체 준수율
const percent = Math.round(
  pages.filter(p => p.compliance === 'COMPLIANT').length / pages.length * 100
)
```

---

## 4. API 설계

```
-- 목차 전체 조회
GET /api/sr/pages
Response: [{ id, page_no, title, section, compliance, percent }]

-- 페이지 상세 (작성 내용 + 공시기준 + 시각화 추천)
GET /api/sr/pages/:pageId
Response: {
  page,
  content: SrPageContent,
  standards: DisclosureStandard[],
  visualizationRecommendations: Recommendation[]
}

-- 내용 저장 (직접 작성 / AI 생성 구분)
POST /api/sr/pages/:pageId/content
Body: { content, writeMode: 'MANUAL' | 'AI' }

-- AI 문단 생성
POST /api/sr/pages/:pageId/generate
Response: { generatedText: string }

-- 전체 준수율 조회
GET /api/sr/compliance
Response: { total, compliant, partial, nonCompliant, percent }

-- 데이터 최종 제출
POST /api/sr/submit
```

---

## 5. 구현 우선순위

| Phase | 작업 | 기간 |
|-------|------|------|
| 1 | 목차 데이터 + 공시기준 매핑 DB 구축 및 우측 패널 표시 | 1주 |
| 2 | 직접 작성 탭 — 리치 텍스트 에디터 + 저장 + 준수율 계산 | 1주 |
| 3 | AI 문단 생성 탭 — 생성·미리보기·에디터 삽입 흐름 | 1주 |
| 4 | 시각화 추천 — 추천 로직 + 도표 생성 페이지 연동 | 1주 |
| 5 | ERP/EMS 연동 — 정량 데이터 수신 및 AI 컨텍스트 반영 | 별도 일정 |
