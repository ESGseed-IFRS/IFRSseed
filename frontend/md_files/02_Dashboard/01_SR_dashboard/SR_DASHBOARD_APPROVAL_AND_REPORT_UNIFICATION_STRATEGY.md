# SR 보고서 작성 대시보드 — 결재함 통합·SR 보고서 연동·지주 DP 확장 전략

작성일: 2026-03-30  
대상: 계열사·지주사 **SR 보고서 작성** 영역 (`md_files/02_Dashboard/01_SR_dashboard/SRReportDashboard_v3.jsx` → `DashboardSrTab` 임베드), **대시보드 결재함** (`src/app/(main)/dashboard`), **SR 보고서 본편** (`src/app/(main)/sr-report`)  
관련 문서: `md_files/02_Dashboard/03_Approval Inbox/APPROVAL_INBOX_DASHBOARD_STRATEGY.md`, `01_SR_dashboard/SUBSIDIARY_OVERVIEW_REDESIGN_STRATEGY.md`, `01_SR_dashboard/SR_HOLDING_DASHBOARD_AND_REPORT_TAB_LINKAGE_STRATEGY.md` (지주 대시보드 KPI·매트릭스·페이지 그리드 ↔ `/sr-report` 지주 모드 연동)

---

## 1. 배경과 문제

### 1-1. 중복 결재함

- 계열사 SR 작성 대시보드에 **내부 탭「결재함」**이 있고, 지주 SR 작성에도 **동일하게 내부「결재함」**이 존재한다.  
- 플랫폼 전체 IA는 이미 **좌측 사이드바 → 결재함**(대시보드 `approval` 탭)을 **단일 허브**로 두고 있다.  
- 사용자는 “어디서 결재를 봐야 하는지” 혼란스럽고, 배지·미처리 건수도 **이중 관리** 위험이 있다.

### 1-2. 작성 액션과 SR 본편 분리

- **작성 시작 / 이어 작성** 등이 `SRReportDashboard_v3.jsx` 내 **풀스크린 오버레이(`DPDetailPage`)** 또는 별도 흐름으로 열리고, 실제 **SR 보고서 탭(메인 앱의 SR 보고서 페이지)** 과 데이터·네비게이션이 분리되어 있다.  
- 유지보수 시 DP 목록·상태가 **대시보드 mock**과 **sr-report mock**에 이중으로 흩어질 수 있다.

### 1-3. 지주사 매트릭스의 한계

- **조직(행) × DP(열)** 그리드는 소수 DP에서는 현황 파악에 유리하나, **DP 수가 수십~수백**으로 늘면 가로 스크롤·가독성·성능 문제가 발생한다.  
- 셀 클릭 시 **피드백·다음 액션(결재·작성·독촉)** 이 없어 “모니터링만 되고 업무로 이어지지 않는” 느낌이다.

### 1-4. 「페이지 작성」 탭

- 지주 화면의 **페이지 작성**이 실제 **SR 보고서(지주 워크스페이스)** 와 연결되지 않으면, 사용자 기대(최종 보고서 편집)와 어긋난다.

---

## 2. 목표 (요약)

| 구분 | 목표 |
|------|------|
| 결재 | SR 작성 화면 **내부 결재함 탭 제거**. 모든 결재 조회·처리는 **대시보드 결재함**으로 **딥링크**한다. |
| 계열사 작성 | **작성 시작 / 이어 작성 / 결재 상신** 등은 **SR 보고서 페이지**(`sr-report`)로 이동하며, **동일 `dpId`** 로 에디터 포커스. |
| 레거시 제거 | 대시보드 전용 **독립 작성 오버레이(`DPDetailPage`)** 및 그에 묶인 라우팅은 **폐기**하고, 단일 작성 UX는 `sr-report`에만 둔다. |
| 지주 그리드 | DP 증가에 대비한 **열 제어·요약·드릴다운** 패턴을 정의하고, 셀 인터랙션을 **결재·SR·알림**과 연결한다. |
| 페이지 작성 | 지주 **페이지 작성**은 `sr-report` **지주 워크스페이스** 탭과 **동일 네비게이션 계약**(쿼리·탭 ID)으로 맞춘다. |

---

## 3. IA 변경 — 결재함 단일화

### 3-1. 삭제할 UI

- 계열사: `작성 현황` 옆 **「결재함 (N)」** 서브탭 전체.  
- 지주: **「결재함」** 서브탭 전체.  
- 구현 위치 참고: `SRReportDashboard_v3.jsx` 내 `kanban` / `holding` 탭 정의(약 717행대, 846행대 근처) 및 결재 전용 패널 블록.

### 3-2. 대체 동작 (필수)

- SR 작성 화면에 **“결재는 여기서”** 안내 한 줄 + 버튼 **「결재함으로 이동」**:
  - 클릭 시 `setTab('approval')` + 필요 시 도메인/메뉴 preset (예: SR만 보기).  
- 카드 단위 액션 **「결재 상신」**, **「반려 재작성」** 등은:
  - **문서가 이미 있으면**: `/dashboard?tab=approval&domain=sr&menu=...&docId=...`  
  - **DP만 알려진 경우**: `dpId` / `srDpId`로 목록에서 하이라이트 (`DashboardPageClient`가 이미 `focusDocId`, `focusSrDpId` 쿼리 지원 — `docId`, `dpId`/`srDpId`).

### 3-3. 데이터 계약

- SR 상신·반려 문서는 **대시보드 통합 결재 스키마**(`approvalUnified` 등)와 **동일 ID**로 연결한다.  
- 상세: `APPROVAL_INBOX_DASHBOARD_STRATEGY.md`의 문서 메타·도메인(`sr`) 규칙을 따른다.

---

## 4. SR 보고서 본편 연동 — 계열사

### 4-1. 네비게이션

- **작성 시작** (`status: todo`):  
  `router.push('/sr-report?dpId=<id>&mode=subsidiary')` (또는 워크스페이스 기본이 계열사면 `dpId`만).  
- **이어 작성** (`wip`): 동일하게 `dpId` 지정.  
- **반려·피드백**: `dpId` + (선택) `feedbackId` / 쿼리 확장 시 `SrReportPageClient`와 `DashboardNewShell`의 `selectedFeedbackId` 패턴을 **URL 단일화**할지 검토(권장: `sr-report` 쿼리로 흡수).

### 4-2. 상태의 단일 정본(SSOT)

- DP 카드 목록·상태(`todo` / `wip` / `submitted` / …)는 **한 소스**에서만 정의한다.  
- 권장 순서:  
  1. `sr-report/lib/mockSrReport`(또는 향후 API)를 **정본**으로 두고,  
  2. 대시보드 SR 탭은 **동일 데이터를 import**하거나 **훅/컨텍스트**로 구독.  
- 대시보드 전용 `DP_CARDS_INIT`만 쓰는 구조는 **단계적으로 제거**한다.

### 4-3. 제거 대상 코드

- `SRReportDashboard_v3.jsx`의 **`DPDetailPage`** 풀스크린 작성 UI 및 이를 여는 **작성 시작/이어 작성 → 오버레이** 경로.  
- 해당 경로를 대체한 뒤 **Dead code 삭제**.

---

## 5. 지주사 — DP 확장·인터랙션

### 5-1. 열(DP)이 많을 때 UI 패턴 (권장 조합)

1. **DP 세트 필터**: 기준군(GRI / TCFD / SASB / ESRS) · 주제(환경·사회·지배) · 마감 임박만 보기.  
2. **가로 스크롤 + 고정 열**: 조직명·진행률·액션 열은 `sticky`, DP 열만 스크롤.  
3. **가상 스크롤**: 행·열이 커지면 `react-window` 등으로 **렌더링 최적화**.  
4. **2단계 뷰 (요약 → 상세)**  
   - 기본: 조직별 **집계 KPI**(제출율·반려 수·미제출 DP 수)만 표.  
   - 행 클릭: 사이드 패널 또는 모달에서 **해당 조직의 DP 목록** 표시(전수 DP는 여기서 스크롤).  
5. **열 그룹 헤더**: 표준별로 상위 헤더 병합해 스캔성 향상.

### 5-2. 셀 클릭 → 실무 연결 (행동 규칙)

| 셀 상태 | 1차 동작 | 선택 연결 |
|---------|----------|-----------|
| 미작성 | 토스트 + **「SR에서 작성」** → 해당 법인 컨텍스트는 지주 뷰 유지, `sr-report` 지주 모드에서 조직·DP 선택 | (API 시) 독촉 이력 기록 |
| 검토중/제출 | **결재함으로 이동** + `docId`/`dpId` 포커스 | 문서 미리보기 모달(옵션) |
| 반려 | **결재함** + 반려 사유 하이라이트 또는 **SR 보고서** 해당 DP로 이동 | 재상신 가이드 토스트 |
| 승인 | 짧은 확인 토스트 + (옵션) 감사 로그 링크 | 읽기 전용 상세 |

- **아무 반응 없음** 상태를 없애기 위해, 최소한 **토스트 + 1개 CTA 버튼**은 항상 둔다.

### 5-3. 내부 결재함 제거

- 계열사와 동일하게 **지주 SR 작성 내 결재함 탭 삭제**, 사이드바 결재함으로 통일.

### 5-4. 「페이지 작성」 탭

- `sr-report`의 지주 워크스페이스 탭 ID와 매핑한다. (현재 클라이언트: `HoldingSrTabId` — `h-write`, `h-gen`, `h-aggregate-write` 등, `SrReportPageClient`의 `parseHoldingTab` 참고.)  
- 대시보드에서 **「페이지 작성」** 클릭 시 예:  
  `router.push('/sr-report?mode=holding&holdingTab=h-write')`  
- 쿼리 키 이름은 **한 번 정해** `sr-report`와 `SRReportDashboard_v3` 양쪽에 동일하게 적용한다.

---

## 6. 구현 단계 (권장 순서)

1. **Props 계약 추가**  
   - `DashboardSrTab` → 임베드되는 SR 대시보드 컴포넌트에 `onNavigateToApproval`, `onNavigateToSrReport` (또는 `useRouter`를 대시보드 레벨에서 주입) 전달.  
   - `DashboardNewContent`에서 SR 탭 렌더 시 위 콜백 연결.

2. **내부 결재함 UI 제거**  
   - `SRReportDashboard_v3.jsx`에서 탭 항목·패널 삭제, 빈 탭이 없도록 **작성 현황(계열사)** / **제출 현황·페이지 작성(지주)** 만 유지.

3. **버튼 라우팅 교체**  
   - 작성 시작/이어 작성 → `next/navigation` `push` 로 `/sr-report?...`.  
   - 결재 관련 → `push` 로 `/dashboard?tab=approval&...`.

4. **`DPDetailPage` 제거** 및 mock 단일화  
   - 작성 UX는 `sr-report`만 사용.

5. **지주 그리드**  
   - 필터 바 + sticky 열 + 셀 `onClick` 핸들러(토스트+링크) 적용.  
   - DP 개수 증가 시 가상 스크롤 또는 2단계 뷰 중 택1 도입.

6. **문서·배지**  
   - SR 화면 상단에 “결재는 좌측 **결재함**에서 처리합니다” 짧은 가이드.

---

## 7. URL·쿼리 참고 (현 코드 기준)

| 목적 | 예시 |
|------|------|
| 대시보드 결재함 + SR 도메인 | `/dashboard?tab=approval&domain=sr` |
| 결재 메뉴 지정 | `&menu=inbox.request` 등 (`dashboardNewMock`의 `ApprovalMenuKey`) |
| 문서 포커스 | `&docId=<unifiedDocId>` |
| SR DP 포커스 | `&dpId=` 또는 `&srDpId=` (`DashboardPageClient` 파싱) |
| SR 보고서 특정 DP | `/sr-report?dpId=<id>` (`SrReportPageClient`) |
| 지주 + 탭 | `/sr-report?mode=holding&holdingTab=h-write` (키 이름은 구현 시 확정) |

---

## 8. 완료 기준 (체크리스트)

- [ ] 계열사·지주 SR 작성 화면에 **내부「결재함」탭이 없다**.  
- [ ] **작성 시작 / 이어 작성**이 **독립 작성 페이지·오버레이가 아닌** `sr-report`로 이동한다.  
- [ ] **결재 상신·반려 확인** 등이 **대시보드 결재함**으로 이동하며, 가능하면 **문서/DP 포커스**가 된다.  
- [ ] `DPDetailPage` 및 중복 mock 경로가 **제거**되었거나 제거 일정이 명시되었다.  
- [ ] 지주 매트릭스: **필터·스크롤·sticky** 중 최소 세트 적용 + **셀 클릭 시** 토스트/링크 등 **피드백**이 있다.  
- [ ] **페이지 작성**이 `sr-report` 지주 워크스페이스와 **쿼리/탭으로 연동**된다.

---

## 9. 오픈 이슈

- **다법인 작성**: 지주가 특정 자회사 DP를 “대신 작성”하는 경우, `sr-report`의 워크스페이스·권한 모델과 정렬 필요.  
- **실시간 동기화**: 대시보드 카드 상태와 SR 에디터 저장이 **WebSocket/폴링** 없이 mock이면 수동 새로고침 안내 문구 고려.  
- **모바일**: 지주 매트릭스는 모바일에서 **카드 리스트 뷰**로 전환할지 별도 정책 권장.

이 문서는 **제품·IA 전략**에 초점을 맞추며, 결재 통합의 기술 세부는 `APPROVAL_INBOX_DASHBOARD_STRATEGY.md`를 보조 근거로 삼는다.
