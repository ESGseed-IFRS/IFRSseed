# GHG 산정 — Raw Data 12개월 확장 및 계열사 데이터 격리 전략

작성일: 2026-03-30  
대상 영역: `src/app/(main)/ghg_calc/`  
관련 문서: `md_files/02_Dashboard/02_GHG_dashbord/SUBSIDIARY_GHG_SECTION_REDESIGN_STRATEGY.md`, `md_files/05_Login, Register/LOGIN_REGISTER_50_50_AND_CORPORATE_GATE_STRATEGY.md`

---

## 1. 배경과 목표

### 1-1. Raw Data 월 범위

- **현황**: 에너지 사용량(`EnergyData`)은 UI·타입 모두 1~12월 컬럼을 갖지만, **모의 데이터**는 1~3월만 채워져 있고 4~12월은 빈 값이다.  
- **폐기물·오염물질·약품**(`WasteData`, `PollutionData`, `ChemicalData`)은 **타입·테이블 UI·모의 데이터**가 **1~3월 + 합계(또는 평균)** 수준으로만 구성되어 있다.
- **목표**: **에너지 사용량은 현재 설계 유지**(이미 12개월 그리드). **에너지를 제외한 월별 Raw**를 **1월~12월**로 맞추고, 모의 데이터·타입·화면·(향후) 업로드 스펙을 일관되게 정리한다.

### 1-2. 계열사 접근 통제

- **현황**: UI 카피는 “계열사별 본인 법인 데이터만 입력”을 안내하지만, **산정 결과 조회(그룹)**(`GroupResults`)는 전 계열사·국내 사업장을 한 화면에 표시하고, **통합 감사 추적**은 `auditFeedData`·`auditMockData` 등에서 **법인 구분 없이 전체 이벤트**가 노출되는 구조에 가깝다. 사이드바의 사용자 영역도 고정 문자열(예: 미라콤) 수준이다.
- **목표**: **계열사(자회사) 사용자**는 **소속 법인(legal entity)** 에 해당하는 **산정 결과·감사 추적**만 볼 수 있게 하고, **지주(그룹) 사용자**만 그룹 통합 뷰·타 법인 이벤트에 접근한다.

---

## 2. Raw Data 1~12개월 확장 전략

### 2-1. 데이터 모델 (`types/ghg.ts`)

| 카테고리 | 조치 |
|----------|------|
| `EnergyData` | 변경 최소. 필요 시 `total`을 12개월 합과 정합되게 재계산하는 규칙만 문서화. |
| `WasteData` | `jan`~`dec` 필드 추가, `total`은 **12개월 합**(또는 명시적 정책에 따른 연간 합)으로 정의. |
| `ChemicalData` | 동일하게 `apr`~`dec` 추가, `total` 정의를 `WasteData`와 동일하게. |
| `PollutionData` | `apr`~`dec` 추가. **`avg` 의미 결정** 필요: (권장) **해당 연도 12개월 산술평균** 또는 **법적 보고에 맞는 대표값(예: 가중평균)** 중 하나를 제품/규정에 맞게 고정. |

**의사결정 포인트**: 오염물질은 월별 농도와 “평균” 컬럼 정의가 규정·보고서 양식에 따라 다르므로, 확장 전에 **내부 기준(연평균 vs 분기평균 등)** 을 한 줄로 고정해 두는 것이 좋다.

### 2-2. 모의 데이터 (`lib/mockData.ts`)

- `wasteData`, `pollutionData`, `chemicalData` 각 행에 **4~12월 값**을 채운다.
- `total`(및 `PollutionData.avg`)을 **선택한 평균/합산 규칙**에 맞게 갱신한다.
- 에너지는 요구사항에 따라 **4~12월도 채울지** 선택: 사용자 요청이 “에너지 제외”이므로 **우선순위는 낮게** 두되, 데모 일관성을 위해 나중에 동일 연도 기준으로 채우는 것을 권장.

### 2-3. 화면 (`components/raw-data/RawDataUpload.tsx`)

- `WasteTable`, `ChemicalTable`: 헤더·바디를 `EnergyTable`과 동일하게 **1~12월** 컬럼으로 확장. 가로 스크롤·`min-width`는 에너지 테이블과 유사하게 맞춘다.
- `PollutionTable`: 1~12월 컬럼 추가 후, **평균·법적기준·상태** 컬럼 위치는 기존 UX를 유지.
- 필터(연도·시설·검색)는 그대로 두되, **월 컬럼이 늘어난 만큼** 테이블 가독성(고정 열 sticky 등)은 별도 UX 이슈로 분리 가능.

### 2-4. 엑셀·I/F (`ExcelUploadModal.tsx`, `IFSyncModal.tsx`)

- 템플릿·검증 로직이 있다면 **컬럼 수·헤더명**을 12개월에 맞춘다.
- 백엔드 연동 시: API 스키마에 `month_01`~`month_12` 또는 배열 형태로 통일하는 것을 권장.

### 2-5. 연쇄 영역(선택)

- `ScopeCalculation.tsx`, `GHGReport.tsx` 등 **월별 차트/데모**가 1~3월만 쓰고 있다면, Raw와 무관한 **별도 데모 데이터**이므로 이번 범위에서 **필수는 아님**. 다만 “연간 Raw와 화면이 어긋난다”는 인상을 줄이려면 **같은 연도 기준으로 12개월 차트**로 맞추는 후속 작업을 backlog에 넣을 수 있다.

### 2-6. 구현 순서 제안

1. `WasteData` / `ChemicalData` / `PollutionData` 타입 확장  
2. `mockData.ts` 갱신  
3. `RawDataUpload.tsx` 테이블 컴포넌트 확장  
4. 엑셀·모달·(존재 시) 업로드 파서 정합  
5. 스토리북·스냅샷·수동 QA(가로 스크롤, 작은 화면)

---

## 3. 계열사 vs 지주 — 데이터 격리 전략

### 3-1. 원칙

- **권한의 단일 소스**: 실제 서비스에서는 **백엔드가 법인 단위로 필터링**하는 것이 필수다. 프론트 필터는 **UX·오류 방지용(Defense in depth)** 으로만 둔다.
- **식별자**: 세션(또는 JWT 클레임)에 **`legalEntityId`**(또는 `corpId`)와 **`orgRole`** 또는 **`tenantType: 'holding' | 'subsidiary'`** 를 둔다. 지주 사용자는 “전체 조회” 권한 플래그를 별도로 둘지, 역할 매트릭스로만 풀지 정책에 맞게 선택.

### 3-2. 프론트엔드 아키텍처

| 구성요소 | 계열사 사용자 | 지주(그룹) 사용자 |
|----------|---------------|-------------------|
| 공통 컨텍스트 | `useGhgSession()` 또는 기존 앱 전역 `AuthContext` 확장으로 `legalEntityId`, `canViewGroupAggregate` 등 노출 | 동일 |
| 사이드바 `Sidebar.tsx` | **「산정 결과 조회 (그룹)」** 메뉴 **숨김 또는 비활성** + 툴팁 “지주 전용” | 표시 |
| `page.tsx` / 라우팅 | `group-results` 직접 URL 접근 시 **계열사면 리다이렉트** 또는 403 빈 상태 | 허용 |
| `GroupResults.tsx` | **렌더링하지 않음** 또는 **단일 법인 카드만**(소속 법인명·Scope 합계만) 별도 카피/컴포넌트로 분기 | 현행 그룹 통합 유지 |

### 3-3. 통합 감사 추적

| 파일/흐름 | 조치 |
|-----------|------|
| `auditMockData.ts` — `ChangeEntry.corp` 등 | 이미 법인 문자열이 있으면, **모든 이벤트에 `legalEntityId` 또는 정규화된 `corpKey`** 를 명시. |
| `buildAuditFeedEvents`, `buildUnifiedTimeline` | 빌드 시점에 **`filterByLegalEntity(events, session)`** 적용. 계열사: `corp`/`legalEntityId` 일치만. 지주: 전체 또는 필터 UI 유지. |
| `approvalDemoPack.ts` | 문서별로 `ownerLegalEntityId`를 두고, 피드 생성 시 필터. |
| `AuditTrailFeedView.tsx` | 상단 필터에 “법인”이 있더라도, **계열사는 해당 드롭다운 고정·숨김** 처리. |

### 3-4. 백엔드(향후)

- `GET /audit-events?legalEntityId=` 처럼 **서버가 강제 필터**. 토큰의 법인과 쿼리 불일치 시 403.
- 그룹 집계 API는 **지주 역할만** 호출 가능하도록 RBAC.

### 3-5. 데모·개발 환경

- `.env.local` 또는 개발용 **역할 스위처**(지주/계열사 A/B)로 UI 분기 검증.
- E2E: 계열사 계정으로 그룹 결과 URL·감사 피드에 **타 법인 라벨이 없음**을 assert.

### 3-6. 구현 순서 제안

1. 세션 타입·mock 세션 프로바이더(또는 기존 auth와 연결) 정의  
2. `canViewGroupAggregate` 도입 → `Sidebar` + `GHGCalcPage` 가드  
3. `GroupResults` 분기(그룹 vs 단일 법인 요약)  
4. `buildAuditFeedEvents` 등에 필터 함수 주입  
5. API 연동 시 동일 조건을 쿼리 파라미터/헤더에 반영

---

## 4. 리스크와 테스트 체크리스트

- **리스크**: 타입 확장 후 **기존에 3개월만 가정한 reduce/합계 로직**이 다른 파일에 숨어 있을 수 있음 → `grep`으로 `jan|feb|mar` 패턴 검색 권장.  
- **리스크**: 감사 이벤트에 법인 키가 없으면 필터 불가 → mock 데이터 정비가 선행되어야 함.  
- **테스트**: 계열사 모드에서 그룹 메뉴 미노출, 감사 피드 건수 감소, 지주 모드에서 기존과 동일 노출.

---

## 5. 요약

| 과제 | 핵심 액션 |
|------|-----------|
| Raw 12개월(에너지 제외 우선) | 타입 확장 → mock → `RawDataUpload` 테이블 → 업로드/I/F 정합 |
| 계열사 격리 | 세션에 법인·역할 → 사이드바/라우트 가드 → `GroupResults` 분기 → 감사 피드·mock에 법인 키 후 필터 → 백엔드 강제 필터 |

이 문서는 구현 시 PR 단위로 **2번(데이터 모델+UI)** 과 **3번(권한)** 을 분리하면 리뷰와 롤백이 쉽다.
