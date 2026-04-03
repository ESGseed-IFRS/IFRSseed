# 차트 기능(Charts Feature) 리팩토링 계획

## 개요

이 문서는 **차트 기능 전체**의 구조 변경을 다룹니다. 단순 페이지 리팩토링이 아니라, ESG 차트·테이블 기능을 일관된 구조로 정리하고, 규모가 커질 경우 `src/features`로 분리하는 계획을 포함합니다.

### 리팩토링 범위

1. **Phase 1 (현재)**: `charts` 페이지 리팩토링

   - `charts_2` 구조를 `app/(main)/charts`에 적용
   - ESG 3탭 (Environmental / Social / Governance)로 분리
2. **Phase 2 (추가 확장 시)**: `src/features/charts`로 이전

   - 차트·테이블 로직이 커지거나 재사용성이 필요해지면 features로 분리
   - `ghg-calculation`, `report`와 동일한 features 패턴 적용

### 왜 features로 분리하는가

- **일관성**: `ghg-calculation`, `report` 등 다른 기능과 동일한 아키텍처
- **재사용성**: 차트/테이블 컴포넌트를 다른 페이지에서도 사용 가능
- **유지보수**: store, types, utils 등을 기능 단위로 응집
- **규모**: Environmental/Social/Governance 각 1,300~2,200줄 수준으로, 합계 5,000줄+ → features 분리 적합

---

## 현재 구조 vs 목표 구조

### 현재 구조

```
src/app/(main)/
├── charts/
│   └── page.tsx              # 825줄 단일 파일 (모든 기능 포함)
└── charts_2/                 # 참조용 (리팩토링 후 삭제)
    ├── ChartsPage.tsx        # 60줄 - 탭 래퍼
    ├── EnvironmentalChartsPage.tsx   # ~1,839줄
    ├── SocialChartsPage.tsx          # ~2,213줄
    └── GovernanceChartsPage.tsx      # ~1,317줄
```

**현재 `charts/page.tsx` 포함 기능:**

- 차트 유형 선택 (막대, 원형, 선형, 영역)
- 데이터 소스 선택 (탄소, 에너지, 폐기물 등 8종)
- 데이터 포인트 수동 입력 (최대 10개)
- Chart.js 동적 로드 및 렌더링
- 차트 갤러리 (저장/로드/삭제)
- 재생에너지 생산 표 (단일 테이블)
- useReportStore 연동 (charts, addChart, removeChart, renewableTable 등)

### 목표 구조

#### Phase 1: app/(main)/charts (현재 리팩토링 목표)

```
src/app/(main)/charts/
├── page.tsx                  # 라우트 엔트리 (ChartsPage 래핑)
├── ChartsPage.tsx            # 탭 컨테이너 (Environmental/Social/Governance)
├── EnvironmentalChartsPage.tsx   # 환경(E) 차트 및 테이블 (~1,839줄)
├── SocialChartsPage.tsx          # 사회(S) 차트 및 테이블 (~2,213줄)
└── GovernanceChartsPage.tsx      # 지배구조(G) 차트 및 테이블 (~1,317줄)
```

#### Phase 2: src/features/charts (확장 시 목표)

차트 기능이 커지거나 다른 페이지에서 재사용이 필요해지면 `src/features`로 이전합니다.
`ghg-calculation`, `report` 패턴을 따릅니다.

```
src/features/charts/
├── index.tsx                 # ChartsPage (또는 ChartsMain) - 탭 컨테이너
├── components/               # 공통 차트·테이블 컴포넌트 (분리 가능 시)
│   ├── ChartPreview.tsx
│   ├── EditableTable.tsx
│   └── ChartGallery.tsx
├── environmental/            # 환경(E) 탭
│   ├── EnvironmentalChartsPage.tsx
│   └── index.ts
├── social/                   # 사회(S) 탭
│   ├── SocialChartsPage.tsx
│   └── index.ts
├── governance/               # 지배구조(G) 탭
│   ├── GovernanceChartsPage.tsx
│   └── index.ts
├── store/                    # 차트 전용 store (reportStore에서 분리 검토 시)
│   └── charts.store.ts
├── types/
│   └── charts.types.ts
└── utils/
    └── chartJs.ts            # Chart.js 로드 유틸
```

**app/(main)/charts/page.tsx** → `features/charts`에서 import:

```tsx
'use client';
import { ChartsPage } from '@/features/charts';

export default function ChartsRoutePage() {
  return <ChartsPage />;
}
```

**Phase 2 이전 시점 (참고)**

- Environmental/Social/Governance 각 탭이 1,000줄 이상
- 차트·테이블 로직을 다른 리포트/대시보드에서 재사용 필요
- charts 관련 store·types를 reportStore에서 분리하고 싶을 때

---

## 파일별 역할

### 1. `page.tsx` (라우트 엔트리)

- **역할**: Next.js App Router 라우트 (`/charts`)
- **변경 내용**:
  - `ChartsPage` 컴포넌트 import
  - `'use client'` 선언 유지 (탭 상태 등 클라이언트 기능)
  - `page.tsx`에서 `ChartsPage` 렌더링

```tsx
'use client';

import { ChartsPage } from './ChartsPage';

export default function ChartsRoutePage() {
  return <ChartsPage />;
}
```

### 2. `ChartsPage.tsx` (탭 래퍼)

- **역할**: ESG 3탭 UI 및 탭별 컨텐츠 전환
- **내용**: `charts_2/ChartsPage.tsx` 동일
  - `activeTab` 상태: `'environmental' | 'social' | 'governance'`
  - `sessionStorage.chartsInitialTab` 지원 (HomePage 등에서 초기 탭 지정)
  - Environmental/Social/Governance 탭 버튼
  - 탭별 컴포넌트 렌더링

### 3. `EnvironmentalChartsPage.tsx`

- **역할**: 환경(E) 관련 차트 및 테이블
- **내용**: `charts_2/EnvironmentalChartsPage.tsx` 동일
- **주요 기능**:
  - 테이블 프리셋: 온실가스 배출량, 에너지/재생에너지, 투자/PUE, 용수/폐수, 폐기물/대기
  - EditableTable 기반 Scope 1·2, Scope 3, 용수, 폐기물 등 테이블 편집
  - 차트 유형 선택 (막대, 원형, 선형, 영역)
  - 복수 시리즈 차트 (bar/line 혼합)
  - Chart.js 렌더링, 다운로드, 저장
  - useReportStore 연동 (charts, addChart, savedEsgTables 등)

### 4. `SocialChartsPage.tsx`

- **역할**: 사회(S) 관련 차트 및 테이블
- **내용**: `charts_2/SocialChartsPage.tsx` 동일
- **주요 기능**:
  - 테이블 프리셋: 인력/구성, 채용/교육/역량, 다양성/근속/육아, 안전/보건/보상, 협력회사/공급망, 고객/채널/개인정보
  - 글로벌/국적별 인력, 국적별 인력, 채용/교육 등 테이블 편집
  - 차트 및 테이블 생성/저장

### 5. `GovernanceChartsPage.tsx`

- **역할**: 지배구조(G) 관련 차트 및 테이블
- **내용**: `charts_2/GovernanceChartsPage.tsx` 동일
- **주요 기능**:
  - 테이블 프리셋: 이사회/보수/위원회, 컴플라이언스/부패/정보보안
  - 이사회 현황, 운영 성과, 위원회 개최, 이사 보수, 주식 보유, 부정부패 등 테이블 편집
  - 차트 및 테이블 생성/저장

---

## 기존 `charts/page.tsx` vs `charts_2` 차이 요약

| 항목                  | charts/page.tsx (현재)                  | charts_2 (목표)                      |
| --------------------- | --------------------------------------- | ------------------------------------ |
| **레이아웃**    | 단일 페이지 (좌: 설정, 우: 미리보기+표) | ESG 3탭 (E/S/G 각각 별도 페이지)     |
| **차트 범위**   | 8종 데이터 소스 혼재                    | E/S/G 영역별 분리                    |
| **테이블**      | 재생에너지 1개 고정                     | E: 5종, S: 6종, G: 2종 프리셋        |
| **데이터 구조** | TableRow (division, type, unit, values) | EditableTable (columns, rows, cells) |
| **저장소**      | charts, renewableTable                  | charts, savedEsgTables               |
| **스타일**      | Card 기반, seed-light                   | primary/background, rounded-3xl 등   |

---

## 리팩토링 단계

### Phase 1: MD 문서 작성 ✅

- [X] `md_files/CHARTS_REFACTORING.md` 작성
- [X] Charts 기능 전반 및 `src/features` 이전 계획 반영

### Phase 2: app/(main)/charts 폴더 구조 생성

1. `charts/ChartsPage.tsx` 생성 (`charts_2/ChartsPage.tsx` 복사)
2. `charts/EnvironmentalChartsPage.tsx` 생성 (`charts_2/EnvironmentalChartsPage.tsx` 복사)
3. `charts/SocialChartsPage.tsx` 생성 (`charts_2/SocialChartsPage.tsx` 복사)
4. `charts/GovernanceChartsPage.tsx` 생성 (`charts_2/GovernanceChartsPage.tsx` 복사)

### Phase 3: page.tsx 수정

- `charts/page.tsx`를 ChartsPage 래퍼로 교체 (기존 825줄 로직 제거)

### Phase 4: 라우트 및 내비게이션 검증

- `/charts` 라우트 동작 확인
- Navigation `href: '/charts'` 유지 (변경 없음)
- HomePage 등에서 `chartsInitialTab` 사용 시 동작 확인

### Phase 5: charts_2 폴더 삭제 (사용자 수동)

- 리팩토링 검증 완료 후 `charts_2` 폴더 삭제
- `charts_2` import 참조가 없는지 전체 검색 후 제거

### Phase 6: src/features/charts로 이전 ✅

- [x] `src/features/charts` 폴더 생성
- [x] `index.tsx` (ChartsPage), `environmental/`, `social/`, `governance/` 구조 생성
- [x] `app/(main)/charts/page.tsx`에서 `@/features/charts` import로 변경
- [ ] (추후) 필요 시 `components/`, `store/`, `types/`, `utils/` 분리

### Phase 7: data 분리 및 파일 축소 (REFACTOR_REPORT 패턴)

- **전략 문서**: [`md_files/CHARTS_DATA_REFACTOR_STRATEGY.md`](./CHARTS_DATA_REFACTOR_STRATEGY.md)
- 1000줄+ 파일 → 800줄 이하로 축소
- `data/` 폴더로 테이블 프리셋·데이터 소스·카테고리 배열 분리 (토큰 절약)
- `types.ts`, `utils/chartJs.ts` 분리

---

## 의존성

### Store (useReportStore)

- `charts`, `addChart`, `removeChart`, `setCurrentChart`, `currentChart`
- `savedEsgTables`, `setSavedEsgTables` (charts_2용)
- `renewableTable`, `setRenewableTable` (charts/page.tsx용, Environmental로 이전 시 고려)

### UI 컴포넌트

- `@/components/ui/card`, `button`, `input`, `label`, `select`, `switch`
- `lucide-react` 아이콘

### 외부 스크립트

- Chart.js 4.4.2 (CDN 동적 로드)

---

## src/features와의 관계

### 기존 features 패턴 (참고)

| 기능     | 경로                              | 구조                                               |
| -------- | --------------------------------- | -------------------------------------------------- |
| GHG 산정 | `src/features/ghg-calculation/` | index, scope1/2/3, components, store, types, utils |
| 리포트   | `src/features/report/`          | components, data, utils, types                     |

차트 기능 역시 규모가 커지면 위와 같은 features 구조로 이전할 예정입니다.

### features 이전 시점

- Environmental/Social/Governance 각 탭이 2,000줄 이상으로 커질 때
- 차트·테이블 컴포넌트를 최종보고서·CDP 응답 등 다른 페이지에서 재사용할 때
- charts 관련 store·types를 reportStore에서 분리하고 싶을 때

---

## 주의사항

1. **reportStore 타입**: `SavedEsgTable` 등 charts_2에서 사용하는 타입이 store에 정의되어 있는지 확인
2. **경로**: charts_2 → charts 이전 시 상대 import 경로 자동 유효 (동일 폴더 내)
3. **기존 데이터**: `renewableTable`은 EnvironmentalChartsPage의 에너지/재생에너지 관련 테이블로 대체될 수 있음. 마이그레이션 필요 시 별도 검토
4. **features 이전 시**: `app/(main)/charts/page.tsx`는 라우트 엔트리만 유지하고, 실제 로직은 `@/features/charts`에서 import

---

## 완료 조건

### Phase 1~5 (app/charts 리팩토링)

- [ ] `/charts` 접속 시 ESG 3탭 UI 표시
- [ ] Environmental/Social/Governance 탭 전환 정상 동작
- [ ] 각 탭 내 차트 생성·저장·갤러리 기능 동작
- [ ] 각 탭 내 테이블 편집·저장 기능 동작
- [ ] 최종보고서 페이지와 차트/테이블 연동 정상
- [ ] `charts_2` 폴더 삭제 후 빌드/실행 오류 없음

### Phase 6 (src/features/charts 이전, 선택)

- [ ] `src/features/charts` 폴더 구조 생성
- [ ] app/(main)/charts/page.tsx에서 features/charts import
- [ ] 기능 동작·빌드 정상
