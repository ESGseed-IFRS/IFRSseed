# GHG 산정 — 계열사 산정결과 자동 격리 및 지주 GHG 보고서 취합 전략

작성일: 2026-03-30  
관련 구현: `src/app/(main)/ghg_calc/`  
선행 문서: `GHG_RAW_12MONTH_AND_SUBSIDIARY_ACCESS_STRATEGY.md`

---

## 1. 배경과 목표

### 1-1. 현재 상태

- **산정 결과 조회**: 계열사/지주 분기는 구현되어 있었으나, 일시적으로 **사이드바「데모 권한」**과 env에 기대는 부분이 있었다. **헤더「계열사 \| 지주사」**와 동기화하도록 정리하고, 사이드바 데모 UI는 제거한다.
- **GHG 보고서**(`GHGReport.tsx`): 단일 법인(또는 단일 데모 집합) 기준의 **고정 mock**으로, 지주 관점에서 **자회사 + 국내 사업장 전체**가 반영된 보고서 구조가 아니다.

### 1-2. 목표

| 구분 | 목표 |
|------|------|
| 계열사 · 산정 결과 조회 | **소속 법인(`legalEntityId`)**에 맞는 데이터만 표시. (향후 로그인 세션과 결합.) |
| 화면 전환 | **앱 상단 크롬의「계열사 \| 지주사」세그먼트**(`AppChromeHeader` / `WorkspacePerspectiveContext`)를 바꾸면 GHG 산정 화면도 **동일 관점**으로 갱신. |
| 지주 · GHG 보고서 | **자회사 전체 + 국내 사업장** 배출·요약·(선택) 조직별 비교가 **취합된 보고서**로 표시. |

### 1-3. UI 범위 구분 (중요)

| UI | 처리 |
|----|------|
| **첫 번째 이미지**: GHG 사이드바 하단「데모 권한 (로컬)」지주/계열사(미라콤) 버튼 | **제거**. GHG 전용 중복 토글이므로 혼선만 유발. |
| **두 번째 이미지**: 상단 헤더「계열사 \| 지주사」pill 토글 | **유지**. 앱 전역 관점 전환의 단일 진입점으로 두고, **GHG `GhgSession`은 이 값과 동기화**한다. |

> 즉, “수동 토글을 모두 없앤다”가 아니라 **사이드바 데모 블록만 없애고**, 사용자가 이미 쓰는 **헤더 관점 전환**에 GHG가 따르게 하는 것이 목표다.

---

## 2. 세션·권한 — 헤더 관점 + (향후) 로그인

### 2-1. 원칙

- GHG 내부에 **별도의 지주/계열사 데모 스위처를 두지 않는다.**
- 현 단계: `WorkspacePerspective`(`subsidiary` \| `holding`) → `resolveGhgSession()`으로 `tenantType`·`canViewGroupAggregate`·(계열사 시) `legalEntityId` 파생.
- 운영 고도화 시: 동일 필드를 **로그인·API**에서 채우되, 지주 사용자만 헤더로 관점을 바꿀 수 있게 할지 여부는 정책에 따름(계열사 계정은 항상 `subsidiary` 고정 등).

### 2-2. 권장 데이터 흐름

1. 로그인 성공 → `GET /api/me` 또는 토큰 디코드로 `userId`, `legalEntityId`, `orgType`(holding | subsidiary), `roles` 수신.
2. 앱 루트 또는 `(main)` 레이아웃에서 **전역 `AuthContext`**(또는 기존 인증 스토어)에 저장.
3. `ghg_calc` 진입 시 **`GhgSessionProvider`**: 현재는 **`useWorkspacePerspective()`**와 동기화. 이후 **`mapAuthToGhgSession(authUser)`**와 병합 가능(계열사 계정은 perspective 무시 등).
   - **`NEXT_PUBLIC_GHG_TENANT`**: 배포 포털에서 관점을 **강제**할 때만 사용(예: 항상 계열사 전용 빌드). 미설정이면 헤더 관점이 우선.

### 2-3. UI 정리

- **`Sidebar.tsx`**: 「데모 권한 (로컬)」블록 **삭제(완료)**. GHG 관점은 **헤더 세그먼트**만 사용.

### 2-4. 화면 전환(컨텍스트 변경)

- 법인 전환(지주 사용자가 “어느 자회사를 대리 입력”하는 경우 등)이 제품에 있다면:  
  - 전역 상태의 `legalEntityId` 변경 → `GhgSessionProvider`가 **key 리마운트** 또는 `useMemo` 의존성으로 하위 **산정결과·감사 피드·보고서** 데이터 재요청.
- 별도 전환이 없고 **1인 1법인**이면: 로그인 시 한 번만 세션 확정.

---

## 3. 계열사 — 산정 결과 조회 탭

### 3-1. 동작 정의

- 메뉴 라벨은 **「산정 결과 조회」**(계열사에게는 “그룹”을 암시하지 않는 카피 권장) 또는 기존 유지 + 부제에 “본 법인”.
- `tenantType === 'subsidiary'`일 때:
  - **그룹 통합 테이블·타 법인 행 비노출**(현 `SubsidiaryEmissionResults` 방향 유지).
  - 데이터 소스는 장기적으로 **`GET /ghg/emissions/summary?legalEntityId={session}`** 형태의 API. mock 단계에서는 `legalEntityId`로 행 필터.

### 3-2. 가드

- URL로 `group-results` 직접 접근 시 계열사면 **리다이렉트 또는 단일 법인 뷰**(이미 `page.tsx`에서 탭 보정 로직 존재 — 세션이 Auth 기반이 되면 동일 규칙 유지).

### 3-3. 일관성

- `GroupResults`에 쓰는 **법인 키·표시명**은 감사 mock·Raw Data 카피와 동일 enum(`GhgLegalEntityId`)을 재사용해 **표기 불일치**를 방지.

---

## 4. 지주 — GHG 보고서에 자회사·국내 사업장 반영

### 4-1. 정보 구조(IA)

보고서 상단 → **그룹 합산 KPI** → **조직별(자회사 / 국내 사업장) 분해** → **Scope·월별 추이(합산 또는 드릴다운)** → 증빙·다운로드.

### 4-2. 데이터 모델(프론트 DTO 예시)

- `HoldingReportSummary`: 그룹 총배출, 전년 대비, 동결 여부 등.
- `HoldingReportByEntity[]`: `{ legalEntityId?, name, segment: 'subsidiary' | 'domestic', scope1, scope2, scope3, total, frozen }`  
  - `GroupResults`의 `subsidiaryRows` + `domesticSiteRows`와 **동일 스키마**로 맞추면 mock → API 전환이 쉬움.
- `MonthlyTrendAggregated[]`: 그룹 월별 합산(또는 분기).
- (선택) `ScopeBreakdownGroup`: 그룹 전체 Scope1 세부 항목 합산.

### 4-3. 백엔드

- `GET /ghg/reports/holding?year=&period=`  
  - 서버에서 **권한 검증**(지주 역할만).  
  - 응답에 자회사·국내 사업장 라인아이템 + 합계 포함.
- 계열사 전용 엔드포인트는 별도: `GET /ghg/reports/subsidiary?legalEntityId=` (본인만).

### 4-4. `GHGReport.tsx` 개편 방향

- `useGhgSession()`으로 분기:
  - **지주**: 위 취합 DTO로 차트·표·카드 렌더. mock은 `GroupResults`와 동일 출처의 **파생 합산 데이터**로 교체해 데모 일관성 확보.
  - **계열사**: 단일 법인 요약만(산정결과와 숫자 정합).
- 월별 추이는 Raw/산정과 맞추려 **12개월 또는 선택 기간** 파라미터와 연동(선행 문서의 12개월 Raw 전략과 정합).

### 4-5. 성능·UX

- 조직 수가 많으면 **표 가상 스크롤** 또는 **상위 N + 기타** 요약.
- PDF 생성은 서버에서 테이블·차트 스냅샷을 권장(클라이언트만으로는 한계).

---

## 5. 구현 순서 제안

1. **헤더 관점 ↔ GhgSession 동기화**(`ghgSession.tsx` + `WorkspacePerspectiveContext`) — 사이드바 데모 제거와 함께 반영.  
2. **Auth → GhgSession** 매핑(선택): 실사용자 법인·역할과 충돌 시 perspective 보조 또는 덮어쓰기 규칙 정의.  
3. **계열사 산정결과**: API 연동 시 `legalEntityId` 쿼리 고정, 로딩·빈 상태·에러 처리.  
4. **지주 보고서**: DTO 정의 → mock을 그룹 취합 구조로 교체 → API 스위치.  
5. **회귀 테스트**: 헤더에서 계열사/지주사 전환 시 GHG 메뉴·산정결과·감사 피드가 기대대로 바뀌는지 확인.

---

## 6. 리스크·검증 체크리스트

- 토큰에 `legalEntityId` 누락 시 계열사가 빈 화면 — **기본 에러 메시지·관리자 문의** 처리.  
- 지주 사용자가 실수로 계열사 엔드포인트 호출, 또는 그 반대 — **서버 403** 필수.  
- mock과 API 전환 시 **합계 = 부분합** 검증.  
- GHG 사이드바 **데모 권한**은 제거되었는지, **헤더 관점 전환** 후 GHG가 따라오는지 릴리스 체크리스트에 포함.

---

## 7. 요약

- **제거**: GHG 사이드바「데모 권한 (로컬)」만. **유지·연동**: 상단「계열사 \| 지주사」→ `GhgSession`·산정결과·감사 필터.  
- **계열사 산정결과**: 관점이 계열사일 때 본 법인만(법인 키는 `NEXT_PUBLIC_GHG_LEGAL_ENTITY` 등으로 조정 가능, 추후 로그인과 통합).  
- **지주 GHG 보고서**: **자회사 + 국내 사업장** 취합 DTO·API로 `GHGReport` 개편(후속).

이 문서는 UI/데이터 계약을 고정한 뒤, 백엔드 스펙 확정과 병행해 단계적으로 적용하는 것을 권장한다.

---

## 8. 프론트 반영 현황 (2026-03-30 기준)

| 항목 | 상태 | 구현 위치 |
|------|------|-----------|
| 헤더 관점 ↔ `GhgSession` | 반영 | `lib/ghgSession.tsx` |
| 사이드바「데모 권한」제거 | 반영 | `components/layout/Sidebar.tsx` |
| 산정 결과 메뉴: 지주는「(그룹)」·계열사는「산정 결과 조회」+ 배지 본 법인 | 반영 | `Sidebar.tsx` |
| 계열사도 `group-results` 탭 접근(강제 이동 제거) | 반영 | `page.tsx` |
| 산정 mock 단일 출처 | 반영 | `lib/groupEmissionEntities.ts` → `GroupResults.tsx` |
| 지주 GHG 보고서: 그룹 합산 + 조직별 표 + 12개월 추이 | 반영 | `lib/ghgReportData.ts`, `components/report/GHGReport.tsx` |
| 계열사 GHG 보고서: 본 법인만·산정과 동일 수치 | 반영 | `GHGReport.tsx` |
| Auth → GhgSession | 미반영(향후) | 로그인 연동 시 `mapAuthToGhgSession` |
| API `GET /ghg/reports/holding` 등 | 미반영(향후) | mock 유지 |
