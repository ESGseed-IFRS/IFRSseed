# 차트 기능 데이터 분리 리팩토링 전략

> REFACTOR_REPORT.md 패턴 적용: 1000줄+ 파일 축소, data 분리로 토큰 효율화

---

## 1. 현황 및 문제

### 현재 구조

| 파일 | 줄 수 | 주요 포함 내용 |
|------|-------|----------------|
| EnvironmentalChartsPage.tsx | ~1,839 | INITIAL_GHG/WATER/WASTE_AIR/INVEST_PUE/ENERGY_TABLES, dataSources, chartTypes, UI |
| SocialChartsPage.tsx | ~2,213 | INITIAL_SOC_*_TABLES (6종+), dataSources, chartTypes, UI |
| GovernanceChartsPage.tsx | ~1,317 | INITIAL_GOV_BOARD/ETHICS_TABLES, dataSources, chartTypes, UI |

### 문제

- **REFACTOR_REPORT** 기준: "800줄 이상 되는 파일을 만들거나 유지하라고 제안 금지"
- **1000줄+** 단일 파일 → 가독성·유지보수·토큰 효율 저하
- **긴 배열(테이블 프리셋, 데이터 소스)** 이 컴포넌트 안에 인라인 → 불필요한 로딩
- report는 `data/sr-data.ts`, `data/ifrs-data.ts`로 분리하여 토큰 절약

---

## 2. REFACTOR_REPORT 패턴 핵심

```
- 데이터(목차·매핑 배열)는 반드시 data/ 폴더로 분리 (토큰 절약 최고 효과)
- 긴 배열은 data/로 옮기는 게 토큰 효율적
- 800줄 이상 파일 금지
```

---

## 3. 목표 구조

### Phase 7: data 분리 및 파일 축소

```
src/features/charts/
├── index.tsx
├── types.ts                        # EditableTable, DataPoint, ChartSeries 등 공통 타입
├── data/                           # ← 토큰 절약 핵심
│   ├── environmental-data.ts       # E: 테이블 프리셋, 데이터 소스, 카테고리
│   ├── social-data.ts              # S: 테이블 프리셋, 데이터 소스
│   └── governance-data.ts          # G: 테이블 프리셋, 데이터 소스
├── utils/
│   └── chartJs.ts                  # ensureChartJsLoaded 등
├── components/                     # 공통 UI (선택, 2차)
│   ├── EditableTableCard.tsx
│   └── ChartGalleryCard.tsx
├── environmental/
│   ├── EnvironmentalChartsPage.tsx # ~600줄 이하 (UI·로직만)
│   └── index.ts
├── social/
│   ├── SocialChartsPage.tsx        # ~700줄 이하
│   └── index.ts
└── governance/
    ├── GovernanceChartsPage.tsx    # ~500줄 이하
    └── index.ts
```

### 목표 줄 수

| 파일 | 현재 | 목표 | 축소 전략 |
|------|------|------|----------|
| EnvironmentalChartsPage.tsx | ~1,839 | ~600 | data 이동(~800), utils 이동(~100) |
| SocialChartsPage.tsx | ~2,213 | ~700 | data 이동(~1,000), utils 이동(~100) |
| GovernanceChartsPage.tsx | ~1,317 | ~500 | data 이동(~600), utils 이동(~50) |

---

## 4. data/ 분리 전략

### 4.1 environmental-data.ts

**이동 대상:**

- `TABLE_PRESETS` (ghg_emissions, energy, investment_pue, water, waste_air)
- `INITIAL_GHG_TABLES` (Scope 1·2, Scope 3)
- `INITIAL_WATER_TABLES` (용수 취수량/방류량, 용수 사용량)
- `INITIAL_WASTE_AIR_TABLES` (폐기물 발생량, 본사 폐기물 유형별, ISO, 기후리스크)
- `INITIAL_INVEST_PUE_TABLES` (친환경 투자, PUE 평균, PUE 센터별)
- `INITIAL_ENERGY_TABLES` (에너지사용량, 재생에너지)
- `dataSources` 배열 (ghg_s12_total, energy_total, waste_total 등)
- `dataSourceLegendHints`
- `categoryTabs` (ghg_energy, waste_air, water_wastewater)
- `chartTypes` (막대, 원형, 선형 등) → 공통이면 `types.ts` 또는 `common-chart-config.ts`로
- `colors` 팔레트

**유의:** `makeId()`는 런타임 함수 → EditableTable 생성 시 `id`는 데이터에서 제외하고, 컴포넌트 마운트 시 `makeId()`로 주입

### 4.2 social-data.ts

**이동 대상:**

- `TABLE_PRESETS` (social_workforce, social_training 등 6종)
- `INITIAL_SOC_WORKFORCE_TABLES` (글로벌 인력, 국적별 인력)
- `INITIAL_SOC_TRAINING_TABLES` 등 (채용/교육, 다양성, 안전, 협력회사, 고객/개인정보)
- `dataSources` 배열
- `chartTypes`, `colors`

### 4.3 governance-data.ts

**이동 대상:**

- `TABLE_PRESETS` (governance_board, governance_ethics)
- `INITIAL_GOV_BOARD_TABLES` (이사회 현황, 운영 성과, 위원회, 보수, 주식 보유)
- `INITIAL_GOV_ETHICS_TABLES` (부정부패, 유형별 제보, 위반, 법적 위험, 제재, 정보보안)
- `dataSources` (GovernanceDataSource: board_meetings, board_attendance 등 + defaultChartType, defaultSeries)
- `chartTypes`, `colors`

---

## 5. types.ts 분리

**이동 대상:**

- `DataPoint`, `ChartSeries`, `SeriesType`
- `SavedChart` (또는 reportStore와 중복 시 제거)
- `EditableTable`, `EditableTableColumn`, `EditableTableRow`
- `TablePresetId` (environmental/social/governance 각각 또는 유니온)
- `GovernanceDataSource` 등 탭별 데이터 소스 타입

---

## 6. utils/chartJs.ts 분리

**이동 대상:**

- `ensureChartJsLoaded()` (3개 탭 공통 사용)
- `makeId()` (공통 유틸)

---

## 7. 실행 단계 (권장 순서)

### Step 1: types.ts 생성

- `src/features/charts/types.ts` 생성
- EditableTable, DataPoint, ChartSeries, TablePresetId 등 이동
- 각 *ChartsPage에서 import

### Step 2: utils/chartJs.ts 생성

- `ensureChartJsLoaded`, `makeId` 이동
- 3개 탭에서 import

### Step 3: data/ 폴더 생성 및 데이터 이동

1. `environmental-data.ts` 생성 → EnvironmentalChartsPage 데이터 이동
2. `social-data.ts` 생성 → SocialChartsPage 데이터 이동
3. `governance-data.ts` 생성 → GovernanceChartsPage 데이터 이동

**데이터 형식:**  
- `makeId()` 의존 제거: rows는 `{ cells }` 형태로 저장, `id`는 컴포넌트에서 `useMemo`/`useState` 초기화 시 주입
- 또는 `createEditableTable(rowsWithoutId)` 팩토리 함수를 data에서 export

### Step 4: 각 *ChartsPage.tsx 리팩터링

- data, types, utils import로 교체
- 컴포넌트 본문은 UI·상태·이벤트 핸들러만 유지
- 목표: 파일당 **800줄 이하**

### Step 5: (선택) components/ 공통화

- `EditableTableCard`, `ChartGalleryCard` 등 중복 UI 추출
- 2차 리팩터링으로 진행

---

## 8. 데이터 id 처리 방식

**문제:** EditableTable의 rows에 `id`가 필요 (React key, 수정/삭제 시 식별)

**옵션 A – 데이터에 id 제외, 마운트 시 주입**

```ts
// environmental-data.ts
export const GHG_TABLE_ROWS = [
  { cells: { category: '(시장 기반) 온실가스 배출량', unit: 'tCO₂eq', ... } },
  ...
];

// EnvironmentalChartsPage.tsx
const [ghgTables, setGhgTables] = useState<EditableTable[]>(() =>
  hydrateTableIds(GHG_TABLES_TEMPLATE)  // hydrateTableIds: cells만 있는 배열 → id 주입
);
```

**옵션 B – 데이터에 placeholder id, clone 시 makeId()로 치환**

```ts
export const INITIAL_GHG_TABLES = (makeId: () => string) => [...];
```

**권장:** 옵션 A. 데이터는 순수하게 cells만 두고, `hydrateTableIds(rows)` 유틸로 id를 주입.

---

## 9. 검증 기준

- [ ] EnvironmentalChartsPage.tsx **800줄 이하**
- [ ] SocialChartsPage.tsx **800줄 이하**
- [ ] GovernanceChartsPage.tsx **800줄 이하**
- [ ] data/*.ts에 테이블 프리셋·데이터 소스·카테고리 배열 분리
- [ ] types.ts에 공통 타입 분리
- [ ] utils/chartJs.ts에 Chart.js 로드·makeId 분리
- [ ] 기존 기능 동작 유지 (차트 생성·저장·테이블 편집·갤러리)

---

## 10. REFACTOR_REPORT와의 정렬

| 항목 | REFACTOR_REPORT | 차트 적용 |
|------|-----------------|----------|
| 800줄 이상 파일 금지 | ✅ | ✅ 각 *ChartsPage 800줄 이하 |
| 데이터 data/ 분리 | sr-data, ifrs-data | environmental/social/governance-data |
| 토큰 절약 | 긴 배열 data/ 이동 | 테이블 프리셋·dataSources data/ 이동 |
| 타입 분리 | types.ts | charts/types.ts |
| 공통 UI | common/ | components/ (2차) |
