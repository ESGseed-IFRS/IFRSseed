# GHG Scope 산정 탭·산정 결과 조회·수치 정합 전략 (1~12월·합계 일치)

작성일: 2026-03-30  
대상 영역: `src/app/(main)/ghg_calc/`  
관련 문서:  
- `GHG_RAW_12MONTH_AND_SUBSIDIARY_ACCESS_STRATEGY.md` (Raw 12개월·계열사 격리)  
- `GHG_SUBSIDIARY_RESULTS_AND_HOLDING_REPORT_STRATEGY.md` (지주/계열사 뷰·보고서)

---

## 1. 배경과 문제

### 1-1. 월 범위 불일치

| 영역 | 현재 경향 | 비고 |
|------|-----------|------|
| **Scope 1·2·3 산정** (`ScopeCalculation.tsx`) | 표·모의 데이터가 **1~3월** 컬럼, KPI 문구도「1~3월」 | 월별 차트도 3개 포인트 |
| **산정 결과 조회** (`GroupResults.tsx`) | 법인·그룹 **연간(또는 보고 연도) 합계** 중심 | 월 단위 그리드 없음 |
| **GHG 보고서** (`GHGReport.tsx` + `ghgReportData.ts`) | **1~12월** 추이를 파생 생성 | 연간 Scope 합계와 비율·가중치로 월별 분해 |

같은 사용자가 **산정 결과 조회**에서 본 Scope 합계와 **Scope 산정 탭**의 합계·기간을 비교하면 **기간 정의와 숫자 출처가 달라** 신뢰가 깨진다.

### 1-2. 수치 출처 분리

- `groupEmissionEntities.ts`의 **법인(·사업장) 행**: `scope1`, `scope2`, `scope3`, `total` (연간 데모).
- `ScopeCalculation.tsx`의 **카테고리/항목 mock**: 위 법인 데이터와 **무관한 별도 숫자**(예: 소규모 공장 단위 t 규모 vs 미라콤 등 만 단위).

→ **「법인 전체 배출 = Scope 1+2+3」** 이라는 화면상 기대와 **실제 구현이 어긋남**.

---

## 2. 목표 (계열사·지주 공통)

1. **Scope 1·2·3 산정 탭**의 월별 입력·표시를 **선택 연도 기준 1~12월**로 통일한다. (가로 스크롤·sticky 열 등 UX는 `RawDataUpload`의 에너지 테이블과 톤을 맞춘다.)
2. **동일 법인(또는 지주 시 그룹 합산)** 에 대해 다음이 **한 세트의 정본에서 파생**되도록 한다.  
   - 산정 결과 조회의 **법인(그룹) 총배출·Scope 1·2·3**  
   - Scope 산정 탭 상단 KPI·탭 배지 합계  
   - Scope 산정 탭 **항목 `total`(연간 또는 선택 연도 합)** 의 Scope별 합  
   - 월별 추이 차트(12개 포인트)의 **월별 Scope 합이 연간(또는 해당 연도) Scope 합과 정합**
3. **지주 관점**에서는 선택한 집계 단위(그룹 전체 또는 필터된 자회사+국내 사업장)에 대해 **동일 규칙**으로 합산·표시한다.

---

## 3. 설계 원칙: 단일 정본(SSOT) + 파생만 허용

### 3-1. 권장 정본 구조 (개념)

연도 `Y`, 법인(또는 집계 노드) `E`에 대해:

- `annual[E][Y].scope1 | scope2 | scope3` — **정수 또는 소수 한 세트** (산정 결과·보고서 요약과 동일).
- `annual[E][Y].total` — **`scope1 + scope2 + scope3`** 로 **항상 계산**(저장 시 중복이면 검증 단계에서 `total` 재작성 또는 경고).

월별은 **반드시 정본이 될 수 있는 두 가지 중 하나**로 고른다.

| 방식 | 설명 | 장단 |
|------|------|------|
| **A. 월별이 정본** | 각 항목에 `jan`…`dec` 저장, 연간 Scope = Σ월 | Raw·산정 탭과 직결, 합계 일치가 자연스러움 |
| **B. 연간이 정본** | 연간 Scope만 저장, 월별은 알고리즘 분해(현 `ghgReportData` 방식) | API가 연간만 줄 때 유리; **분해 후 Σ월 = 연간** 보정 필요 |

**권장 (프론트 데모 → API 연동까지)**: 장기적으로 **A**를 표준으로 두고, 백엔드가 아직 연간만 주면 **어댑터에서 B → 월 생성 후 합계 보정**한다.

### 3-2. 불변식 (검증에 사용)

다음을 개발·CI 또는 런타임 assert(데모)로 체크한다.

1. `total === scope1 + scope2 + scope3` (허용 오차 `ε`는 표시 단위에 맞게, 예: 0.1 tCO₂eq).
2. 각 Scope에 대해: **항목 `total`의 합** = **해당 Scope의 `scopeN`** (같은 연도·같은 법인).
3. 월별: **각 항목** `jan+…+dec === item.total` (또는 정책상 “연중 미가동 월은 0” 명시).
4. 월별 차트: **월 m의 (s1+s2+s3)** 가 “그래프용 분해 모델”을 쓸 경우, **12개월 합이 연간 총배출과 일치**하도록 마지막 월 또는 스케일로 **보정**(reconciliation).

---

## 4. 지주사 vs 계열사 뷰

### 4-1. 계열사

- **정본**: `GhgSession`의 `legalEntityId`에 해당하는 **단일 법인** 행(현재는 `GHG_SUBSIDIARY_ENTITY_ROWS` 등).
- **Scope 산정 탭**: 그 법인의 연간 Scope 규모에 맞게 **라인 아이템을 스케일**하거나, 정본에 **해당 법인 전용 월별 시계열**을 두고 표시한다.  
  - 데모 단계: “한 법인 = 한 세트 라인 아이템”을 **숫자만 법인별로 치환**하는 것보다, **데이터 파일 한 곳**에서 법인별 `ScopeCalculationDataset`을 생성하는 편이 유지보수에 유리하다.

### 4-2. 지주사

- **집계 단위**: `GHG_ALL_GROUP_ENTITIES` 합산(또는 필터된 부분집합) = 현 `sumEntityFields`와 동일 개념.
- **Scope 산정 탭**:  
  - **옵션 1 (권장·데모)**: “그룹 합산” 모드에서는 **읽기 전용 요약 + 월별 추이**만 보여 주고, 상세 라인은 “대표 법인” 또는 “드릴다운으로 법인 선택”으로 분리해 **이중 합산**을 피한다.  
  - **옵션 2**: 모든 자회사·사업장 라인을 한 테이블에 합치면 **행 수 폭증** — API 설계 후 단계적 적용.

초기 목표가 “숫자만 맞게”라면 **옵션 1**으로 KPI·12개월 차트·보고서를 그룹 합산 정본에 맞추고, 라인 테이블은 **선택 법인 단위**로 전환하는 UX가 안전하다.

---

## 5. 탭·화면별 소비 규칙

| 화면 | 입력(정본) | 표시 |
|------|------------|------|
| **산정 결과 조회** | `annual[entity][Y]` | 카드·표의 Scope·총계는 정본 그대로; `total`은 파생 표시도 가능하나 저장은 3 Scope 기준 |
| **Scope 1·2·3 산정** | 동일 정본의 **항목별 월별** 또는 연간+분해 | KPI = Σ항목; 표 1~12월; 차트 = 월별 Scope 합 |
| **GHG 보고서** | 동일 정본 | Scope 표·pie·12개월 추이는 **산정 결과와 동일 숫자**에서만 파생 (별도 mock 금지) |

---

## 6. Scope 2 (위치 vs 시장) 정리

- **산정 결과 / Scope 산정 탭**: 사용자 이해를 위해 **위치기반 Scope 2 합**을 “Scope 2” 카드에 쓸지, 시장기반을 별도 행으로 둘지 **용어를 한 번에 고정**한다.
- **총배출 `total`**: 보통 **이중 계상 방지**를 위해 “보고서에 쓰는 총합 정의”(예: 위치기반 S2 + S1 + S3)를 문서 한 줄로 박는다.  
- 현재 `ghgReportData`의 시장/위치 **분할 비율**은 데모용이므로, 정본에 `scope2_location`, `scope2_market`을 **명시적으로 넣거나**, 비율을 **상수 한 곳**으로 모은다.

---

## 7. 구현 단계 (권장 순서)

1. **타입·상수**  
   - `jan`~`dec` 키와 `MONTH_KEYS`, `MONTH_LABELS`를 `lib/constants.ts`(또는 `types/ghg.ts`)에 **한 번만** 정의.  
   - `ScopeCalculation` 항목 타입에 12개월 필드 추가.

2. **정본 모듈**  
   - `groupEmissionEntities.ts`를 확장하거나 `ghgScopeLedger.ts`(신규)에 **법인별 연간 Scope + (선택) 월별 총액** 저장.  
   - `ScopeCalculation`의 대형 상수 배열을 **이 모듈에서 생성**하거나 import.

3. **ScopeCalculation UI**  
   - 테이블 헤더·바디: 1~12월 + 합계 열.  
   - KPI 문구:「선택 연도 1~12월」.  
   - `monthlyChart`: 정본 월별 Scope 합계 12건.

4. **GroupResults / GHGReport**  
   - 보고서 월별 추이가 **산정 탭과 동일 알고리즘**이면 `buildMonthlyTrendFromLedger(...)` 같은 **공유 함수**로 통합.  
   - 서로 다른 파일에 남아 있는 **독립 mock 숫자 제거**.

5. **지주 모드**  
   - `useGhgSession()`이 지주일 때 Scope 산정 탭에 **그룹 합산 KPI + 12개월** 연결; 상세 테이블은 법인 선택 시 해당 법인 정본 로드.

6. **검증**  
   - 간단한 유닛 테스트: `sum(items.total per scope) === ledger.scopeN`, `sum(months) === item.total`.

---

## 8. 관련 파일 (현재 기준)

| 파일 | 역할 |
|------|------|
| `lib/groupEmissionEntities.ts` | 법인·사업장 연간 Scope·total (산정 결과·보고서 요약 정본 후보) |
| `lib/ghgReportData.ts` | 보고서용 월별 파생·Scope2 분할 (산정 탭과 통합 검토 대상) |
| `lib/ghgScopeCalculationData.ts` | Scope 산정 탭 정본 파생·12개월·라인 스케일 |
| `components/ghg/ScopeCalculation.tsx` | Scope 탭 UI — **정본 연동 완료** |
| `components/ghg/GroupResults.tsx` | 산정 결과 조회 |
| `components/report/GHGReport.tsx` | 보고서 |
| `lib/ghgSession.tsx` | 지주/계열사·법인 키 |

---

## 9. 완료 기준 (체크리스트)

- [x] Scope 산정 표에 **1~12월** 컬럼·가로 스크롤·sticky 열 (`ScopeCalculation` + `ghgScopeCalculationData.ts`).  
- [x] 동일 정본(`groupEmissionEntities` + 월별 파생)으로 **산정 결과 조회·Scope 산정 KPI·보고서(FY)** 연간 Scope 일치.  
- [x] **항목 `total` 합** ≈ 각 Scope 연간값(마지막 항목 drift 보정).  
- [x] **월별 차트 12개월** `reconcileMonthlyToTargets`로 연간 Scope와 합 일치(§3-2-4).  
- [x] 지주 **그룹 합산** / 계열사 **세션 법인** 동일 파이프라인.
- [x] **산정 결과 조회** 상단 KPI는 **`toLocaleString` 등으로 전체 값** 표시 — `~k` 축약 사용하지 않음 (`GroupResults.tsx`).  
- [x] **GHG 보고서** 분기(1~4분기)·연간 선택 시, **동일 월별 파생 시계열의 구간 합**으로 Scope 요약·총계·파이·막대 차트가 함께 갱신 (`ghgReportData.ts` + `GHGReport.tsx`).  
- [x] **Scope별 세부 breakdown**: Scope 1만이 아니라 **Scope 2·3** 전환 탭 + 범례·툴팁 (`buildScope2PieBreakdown`, `buildScope3PieBreakdown`).  
- [x] **Scope 산정** 월별 막대 차트 툴팁은 **payload의 `month`로 제목 표시** — 잘못된 월 라벨 버그 방지 (`ScopeCalculation.tsx`).

---

## 10. UI·표시 정책 (요약 카드·보고서 필터)

### 10-1. 산정 결과 조회 — `k` 축약 금지

- **문제**: 총배출·Scope 카드만 `29.96k` 형태로 줄이면, 하단 표의 `29,960`과 **같은 수인지 한눈에 어렵고** 반올림 오해가 생긴다.  
- **정책**: 계열사·지주 모두 KPI 카드에 **`n.toLocaleString('ko-KR')`** 로 **정수(또는 소수) 전체**를 표시한다.  
- **레이아웃**: 자릿수가 많으면 `tabular-nums`, `break-all`, 글자 크기 소폭 조정으로 카드 내 수용한다.

### 10-2. GHG 보고서 — 분기·연간 필터와 수치 연동

- **정본**: 연간 Scope는 `groupEmissionEntities` 합산(지주) 또는 법인 행(계열사); **월별**은 `buildHoldingMonthlyTrend` / `buildSubsidiaryMonthlyTrend` 파생.  
- **분기 정의**: `1Q` = 1~3월, `2Q` = 4~6월, … `FY` = 12개월 전체 (`GHG_REPORT_PERIOD_MONTH_INDICES`).  
- **연동 규칙**  
  - **막대 차트**: 선택 구간에 해당하는 **월만** 표시 (`filterMonthlyByPeriod`).  
  - **Scope 요약 표·총계 행**: 선택 구간의 **s1+s2+s3 월 합** (`sumMonthlyScopes`)과 동일하도록 행 값·총계·전년대비(전년도 동일 비율로 구간 스케일) 갱신.  
  - **Scope 1·2·3 파이**: 위 구간 합 `sums.s1` / `sums.s2` / `sums.s3`을 각각 breakdown 함수에 넣어 **분기마다 크기가 변함**.  
- **연도 셀렉터**: 데모에서는 데이터가 연도 무관할 수 있음 — API 연동 시 `year` 파라미터와 정본을 맞춘다.

### 10-3. 보고서 Scope breakdown — 세 Scope 모두

- 단일 파이(Scope 1만)는 **Scope 2·3 구성 설명이 부족**하다.  
- **조치**: `Scope 1 | Scope 2 | Scope 3` **세그먼트 탭** + 파이 색상·**범례 리스트**(항목명·tCO₂eq) + 툴팁.

---

## 11. API 연동 시 메모

- `GET .../emissions?entityId=&year=&period=` 형태로 **연간 Scope**·**월별 시계열**·(선택) **분기 집계**를 내려주면 프론트는 위 SSOT 규칙을 그대로 적용한다.  
- 연간만 제공 시: 서버 또는 클라이언트 어댑터에서 월별을 생성하고 **§3-2 불변식 4**로 보정한다. 분기는 월 합으로 계산한다.

이 문서는 **수치·기간 정합**에 초점을 맞춘다. Raw 업로드·월 컬럼 확장의 세부는 `GHG_RAW_12MONTH_AND_SUBSIDIARY_ACCESS_STRATEGY.md`를 따른다.

---

## 12. 구현 매핑 (2026-03-30)

| 요구사항 | 코드 |
|----------|------|
| 산정 결과 KPI 전체 숫자 | `components/ghg/GroupResults.tsx` — `formatTco2eq` |
| 보고서 분기·파이·표 연동 | `lib/ghgReportData.ts` — `sumMonthlyScopes`, `filterMonthlyByPeriod`, `build*ForPeriod`, `buildScope2PieBreakdown`, `buildScope3PieBreakdown` |
| 보고서 UI | `components/report/GHGReport.tsx` — `pieScopeTab`, 기간 라벨 |
| Scope 산정 차트 툴팁 월 | `components/ghg/ScopeCalculation.tsx` — 커스텀 `Tooltip` |
| Scope 산정 SSOT·12개월·표 | `lib/ghgScopeCalculationData.ts`, `ScopeCalculation.tsx` |
