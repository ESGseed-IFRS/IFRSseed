# 사이드바 ↔ 데이터 그리드 연동 전략 (SIDBAR_CONNECT)

> **문제**: 첫 번째 이미지(필터 사이드바)와 두 번째 이미지(데이터 그리드)가 잘 연동되지 않음. 사업장·에너지원 선택에 따라 그리드에 표시되는 값이 **선택 조건과 일치하지 않는** 현상.

---

## 0. UI·내비게이션 통합 전략

### 0-1. 탭 구조: 첫 번째에 결과만, 밑줄 버튼 제거

**요구사항**:
- **상단에는 한 줄만** 존재: 첫 번째 탭 = **결과**, 두 번째 탭 = **리포트 생성**
- **밑에 줄 버튼(데이터 관리 센터 | 결과)은 없앤다.** 즉, "데이터 관리 센터" / "결과" 로 나뉜 **두 번째 행 탭은 사용하지 않음**
- 첫 번째 탭(결과) 클릭 시: **결과 화면만** 한 번에 표시 (배출량 산정 결과 + 방법론). 데이터 관리(사이드바+그리드)는 **같은 화면 위쪽 또는 한 페이지 안**에 배치해, 별도 탭 없이 스크롤로 확인

**구체 사양**:
| 상단 탭 (유일한 탭 행) | 클릭 시 표시 내용 |
|------------------------|-------------------|
| **결과** | (1) 데이터 관리 영역(사이드바 + 그리드) + (2) 배출량 산정 결과 + (3) 방법론 — **한 페이지에 모두 표시, 하위 탭 없음** |
| **리포트 생성** | 증적·보고서 생성 (Step5Report) |

- **금지**: "데이터 관리 센터" / "결과" 를 묶은 **두 번째 행 버튼** 사용 금지

### 0-2. 버튼 형태: 네모난 모양 (둥근 모서리 사용 금지)

| 구분 | 스타일 |
|------|--------|
| **형태** | 직사각형, **모서리 둥글게 하지 않음** (`rounded-none` 또는 `border-radius: 0`) |
| **금지** | `rounded-lg`, `rounded-xl`, `rounded-sm`, `rounded-full` 등 **어떤 rounded 도 사용하지 않음** |
| **적용 대상** | 결과·리포트 생성, Scope 1·2·3, 고정 연소·이동 연소, 전력·열, RAW 데이터 관리·탄소 배출량 등 **모든 탭/버튼** |

### 0-3. Scope 1·2·3 버튼 (세그먼트 + 오른쪽 정렬)

| 항목 | 규격 |
|------|------|
| **위치** | **오른쪽 정렬** (화면 우측) |
| **스타일** | 세그먼트 컨트롤(Connected Segments) — 세 버튼이 하나의 그룹처럼 붙어 있는 형태 |
| **모서리** | **네모** (`rounded-none`) |
| **활성 상태** | 진한 네이비/다크 그레이 배경 + 흰색 텍스트 |
| **비활성 상태** | 밝은 배경(흰색/연회색) + 진한 회색 텍스트 |
| **테두리** | 전체 그룹을 감싸는 얇은 회색 테두리 |

### 0-4. Scope 하위 버튼 (고정 연소 / 이동 연소, 전력 / 열 등)

- **형태**: 직사각형, **모서리 둥글지 않음** (0-2와 동일)
- **위치**: Scope 1·2·3 버튼의 **왼쪽** 또는 Scope 선택 직후 **아래** 배치

### 0-5. RAW vs 탄소 배출량 토글

- **형태**: 직사각형, **모서리 둥글지 않음**
- **색상**: RAW 데이터 관리(활성 시 오렌지), 탄소 배출량 관리(비활성 시 베이지/연한 배경)
- **그룹**: 연한 베이지/노란색 배경의 컨테이너로 감싸 기능적 구분 표시

---

### 0-6. 데이터 연동 반영 (사이드바 ↔ 그리드)

**원칙**: 사이드바에서 선택한 조건이 **그리드에 반드시 반영**되어야 함. 연동이 안 되면 안 됨.

| 구현 체크 | 설명 |
|-----------|------|
| **조회 버튼** | 사이드바에 [조회] 버튼 존재. 클릭 시에만 `appliedFilters` 갱신 |
| **그리드 데이터 소스** | 그리드(EnergySourceMonthTable)에 넘기는 `rows`는 **전체** scope 데이터. 필터링은 **그리드 내부**에서 `selectedFacilities`, `selectedEnergySources`, `year` 로 수행 |
| **selectedFacilities** | `appliedFilters.facilities` (또는 filters.facilities) 를 Scope1Page/Scope2Page → Form → EnergySourceMonthTable 까지 **동일 값**으로 전달 |
| **selectedEnergySources** | `appliedFilters.energySources` (또는 filters.energySources) 를 동일하게 전달. 그리드에서 `rows` 중 `facility IN selectedFacilities` **AND** `energySource IN selectedEnergySources` **AND** `year === selectedYear` 인 row만 집계·표시 |
| **빈 배열 = 전체** | facilities 또는 energySources 가 빈 배열이면 해당 조건은 "전체"로 간주 (필터 미적용) |
| **조회 전** | `appliedFilters` 가 null 이면 "조회를 클릭하여 데이터를 확인하세요" 안내 문구 표시 |

**구현 시 반드시 맞출 데이터 경로** (연동이 안 되면 아래 경로를 검증할 것):

1. **사이드바 [조회] 클릭** → `GHGFilterSidebar`의 `onApplyFilters()` 호출 → 스토어 `applyFilters(activeScope)` 실행 → `appliedFiltersByScope[scope] = filtersByScope[scope]` 로 갱신.
2. **그리드까지 전달**: `Step2ActivityData`가 `appliedFiltersByScope[activeScope]`를 읽어 `Scope1Page`/`Scope2Page`에 `appliedFilters` prop으로 전달. Scope 페이지는 `effectiveFilters = appliedFilters ?? filters` 로 두고, **selectedFacilities / selectedEnergySources / year**는 **effectiveFilters**에서만 취해 Form → `EnergySourceMonthTable`에 전달.
3. **조회 전 상태**: `appliedFilters`가 `null`이면 Form에 `filtersApplied={false}` 전달. Form은 이때 그리드 대신 "조회를 클릭하여 데이터를 확인하세요" 문구만 표시.
4. **에너지원 라벨 일치**: 사이드바 에너지원 옵션(예: `도시가스(LNG)`)과 그리드 행의 `energySource`(예: `lng`)가 다를 수 있음. `EnergySourceMonthTable`은 `energySourceLabels`로 표시명 매핑 후, `selectedEnergySources`와 비교 시 **키 또는 표시명 둘 다**로 매칭하도록 구현 (`s === src || s === displayLabel`).

---

## 1. 현황 및 문제 정의

### 1-1. 사용자 체감 이슈

| 현상 | 설명 |
|------|------|
| **선택에 따른 값만 안 나옴** | 사업장(공장A, 공장B), 에너지원(도시가스) 선택해도 그리드에 **다른 사업장·다른 에너지원** 데이터가 섞여 표시 |
| **사업장-에너지원 연계 없음** | 사업장 선택과 에너지원 선택이 **독립적**이라, "공장A가 쓰는 에너지원만" 같이 연계되는 느낌이 없음 |
| **조회 결과가 필터와 불일치** | 사이드바 선택과 그리드 표시가 **동기화되지 않음** |

### 1-2. 기술적 원인 분석

| 구분 | 현재 동작 | 문제점 |
|------|-----------|--------|
| **사업장 필터** | `selectedFacilities`로 그리드 행 필터링 | `appliedFilters` 미적용 시 필터 미반영, 조회 버튼 전 사용 시 혼선 |
| **에너지원 필터** | 그리드에 **에너지원 필터 미적용** | 사이드바에서 에너지원 선택해도 그리드에 모든 에너지원 표시 |
| **조회 타이밍** | 조회 버튼 클릭 시에만 조건 적용 | 조회 전/후 상태 구분 부족, 사용자 혼란 |
| **사업장-에너지원 연계** | 없음 | "이 사업장이 쓰는 에너지원" 기반 연계 로직 부재 |

---

## 2. 연동 전략: "Filter-First, Single Source of Truth"

### 2-1. 핵심 원칙

1. **Single Source of Truth**: 사이드바 필터 = 그리드 표시 조건의 **유일한 기준**
2. **조회 시에만 반영**: 필터 변경 후 **[조회]** 클릭 시에만 그리드 갱신 (STEP_DETAIL 준수)
3. **AND 조건 적용**: 사업장 AND 에너지원 AND 연도 AND 기간 → 모두 만족하는 데이터만 표시

### 2-2. 필터 → 그리드 매핑 규칙

| 사이드바 필터 | 그리드 적용 로직 |
|---------------|------------------|
| **사업장** | `facility IN selectedFacilities` (빈 배열이면 전체) |
| **에너지원** | `energySource IN selectedEnergySources` (빈 배열이면 전체) |
| **연도** | `year = selectedYear` |
| **시기 단위** | 월별(1~12) / 분기별(1~4) / 연간 집계 |

- **AND 조건**: 위 조건을 모두 만족하는 row만 그리드에 표시
- **빈 선택 = 전체**: 사업장/에너지원을 아무것도 선택하지 않으면 해당 조건은 "전체"로 간주

---

## 3. 사업장-에너지원 연계 전략

### 3-1. 연계 모드 (Option A vs B)

| 모드 | 설명 | UX |
|------|------|-----|
| **Option A: 독립 필터** | 사업장·에너지원을 **완전 독립**으로 선택 | 현재와 동일, 구현 단순 |
| **Option B: 연계 필터** | 사업장 선택 시 **해당 사업장에 데이터가 있는 에너지원만** 에너지원 목록에 표시 | 연동감 강화, 추천 |

### 3-2. Option B 상세 (추천)

```
[사업장 선택: 공장A, 공장B]
    ↓
[에너지원 목록 동적 갱신]
  - RAW DATA에서 (공장A OR 공장B)에 실제 데이터가 있는 에너지원만 표시
  - 예: 도시가스(LNG), 벙커유 → 경유, LPG 등은 해당 사업장에 데이터 없으면 비표시 또는 비활성
```

**구현 요건**:

1. `getEnergySourcesByFacilities(facilities: string[])` → 해당 사업장에 **실제 데이터가 있는** 에너지원 목록 반환
2. 사이드바 에너지원 영역: facilities 선택 시 위 함수 결과로 옵션 갱신
3. facilities 미선택 시: Scope별 전체 에너지원 표시

### 3-3. 시각적 피드백

| 상황 | 표시 |
|------|------|
| 조회 미적용 | "조회를 클릭하여 데이터를 확인하세요" |
| 조회 적용 + 데이터 없음 | "선택 조건에 맞는 데이터가 없습니다. 사업장·에너지원을 확인하세요." |
| 조회 적용 + 데이터 있음 | 그리드에 **필터 조건과 일치하는** 데이터만 표시 |

---

## 4. EMS 연동 전략 (구체화)

### 4-1. 연동 흐름

```
[사용자] 사이드바에서 사업장·에너지원·연도 선택
    ↓
[조회] 클릭 → appliedFilters 확정
    ↓
[EMS 불러오기] 클릭
    ↓
[플랫폼] appliedFilters를 EMS API 요청 파라미터로 변환
    - facilities: 선택된 사업장 코드/ID
    - energySources: 선택된 에너지원 코드
    - year, monthRange
    ↓
[EMS API] GET /api/energy-usage?facilities=...&energySources=...&year=...
    ↓
[응답] { rows: [{ year, month, facility, energySource, amount, unit }, ...] }
    ↓
[플랫폼] rows를 EmissionData로 변환, dataType: 'ems' 부여
    ↓
[스토어] scope1 또는 scope2에 병합 (덮어쓰기/추가 옵션)
```

### 4-2. EMS API 요구사항 (플랫폼 → EMS)

| 항목 | 내용 |
|------|------|
| **인증** | API Key 또는 OAuth 2.0 |
| **엔드포인트** | `GET /api/energy-usage` (또는 EMS 제공 스펙) |
| **요청 파라미터** | year, monthRange, facilities[], energySources[], scope |
| **응답 형식** | JSON `{ rows: [{ year, month, facility, energySource, amount, unit }] }` |

### 4-3. EMS 미연동 시 대안

- **Mock 모드**: EMS API 호출 대신 샘플 JSON 반환 (개발·데모용)
- **수동 입력 / 엑셀 업로드**로 대체 안내

---

## 5. Excel 업로드 연동 전략

### 5-1. 필수 엑셀 양식 (Required Columns)

| 컬럼명 (한글 또는 영문) | 필수 | 타입 | 설명 |
|-------------------------|------|------|------|
| **월** / month | ✅ | 1~12 | 보고 월 |
| **사업장** / facility | ✅ | string | 사업장명 (플랫폼에 등록된 이름과 일치 권장) |
| **에너지원** / energySource | ✅ | string | 도시가스(LNG), 경유, 전력 등 |
| **사용량** / amount | ✅ | number | 에너지 사용량 |
| **단위** / unit | ✅ | string | kWh, MWh, Nm³, L, ton 등 |
| **연도** / year | ⚠️ 선택 | number | 없으면 **필터의 연도**로 적용 |

### 5-2. 엑셀 템플릿 예시

**Scope 1용 (고정연소/이동연소)**

| 월 | 사업장 | 에너지원 | 사용량 | 단위 |
|----|--------|----------|--------|------|
| 1 | 본사 | 도시가스(LNG) | 1200 | Nm³ |
| 1 | 공장A | 경유 | 500 | L |
| 2 | 본사 | 도시가스(LNG) | 1150 | Nm³ |
| 2 | 공장A | 벙커유(중유) | 10 | ton |

**Scope 2용 (전력)**

| 월 | 사업장 | 에너지원 | 사용량 | 단위 |
|----|--------|----------|--------|------|
| 1 | 본사 | 전력 | 12500 | kWh |
| 1 | 공장A | 전력 | 82000 | kWh |

### 5-3. 에너지원 명칭 매핑 (엑셀 → 플랫폼)

| 엑셀 입력값 | 플랫폼 매핑 |
|-------------|-------------|
| 도시가스, LNG, lng | 도시가스(LNG) |
| 경유, diesel | 경유 |
| 휘발유, gasoline | 휘발유 |
| LPG, lpg | LPG |
| 벙커유, 중유, bunker | 벙커유(중유) |
| 무연탄, anthracite | 무연탄 |
| 전력, electricity | 전력 |

### 5-4. 업로드 처리 흐름

```
1. 사용자: 엑셀 파일 선택 (드래그앤드롭 또는 파일 선택)
2. 파싱: 첫 시트, 첫 행 = 헤더
3. 검증: 필수 컬럼(월, 사업장, 에너지원, 사용량, 단위) 존재 여부
4. 에너지원 정규화: 위 매핑 테이블 적용
5. 연도: year 없으면 appliedFilters.year 또는 현재 연도 적용
6. 중복: (year, month, facility, energySource) 동일 시 → 덮어쓰기/건너뛰기 선택 UI
7. 적용: dataType: 'excel'로 EmissionData 생성 후 스토어에 병합
```

### 5-5. 템플릿 다운로드

- GHG 산정 화면에 **"엑셀 템플릿 다운로드"** 버튼 제공
- Scope 1용, Scope 2용 템플릿 각각 제공 (필수 컬럼 + 예시 1~2행)

---

## 6. 구현 우선순위

| 단계 | 항목 | 설명 |
|------|------|------|
| **P0** | 탭 구조 단일화 | Row 2(데이터 관리 센터·결과·리포트) → Row 1(산정 엔진·리포트 생성)에 통합 |
| **P0** | 버튼 형태 통일 | 모든 탭/버튼 직사각형·날카로운 모서리로 변경 |
| **P0** | Scope 1·2·3 세그먼트 | 세그먼트 스타일(연결형), 오른쪽 정렬, 활성=다크/비활성=라이트 |
| **P0** | 에너지원 필터 그리드 반영 | EnergySourceMonthTable에 `selectedEnergySources` 필터 추가 |
| **P0** | 조회 전/후 상태 명확화 | appliedFilters null 시 안내 문구, 조회 후만 그리드 표시 |
| **P1** | 사업장-에너지원 연계(Option B) | facilities 선택 시 에너지원 목록 동적 갱신 |
| **P1** | 엑셀 템플릿 다운로드 | Scope 1/2 템플릿 파일 제공 |
| **P2** | EMS API 연동 | 실제 EMS 엔드포인트 연동 (Mock → Real) |

---

## 7. 참조 문서

- `SIDEBAR_Strategy.md` — 멀티 필터 바, EMS·엑셀 RAW DATA 연동
- `STEP_DETAIL.md` — Focus & Trace, 조회 시 조건 적용
- `SCDOPE1,2.md` — Scope 1·2 상세
