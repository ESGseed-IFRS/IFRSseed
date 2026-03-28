# Audit Trail 결재 예제 이전 · GHG 결재함 제거 · 배지 정합 · SR 딥링크 — 통합 전략

작성일: 2026-03-27  
대상: GHG 산정(`ghg_calc`) 내 Audit 결재함, 대시보드(`dashboard`) 결재함 UI, SR 보고서 작성 플로우  
관련 기존 문서: [APPROVAL_INBOX_DASHBOARD_STRATEGY.md](./APPROVAL_INBOX_DASHBOARD_STRATEGY.md) (공문·IA·통합 스키마)

---

## 1. 목표 요약

| 항목 | 목표 |
|------|------|
| Audit Trail | GHG 화면에 있던 **결재함(예제/목)** 을 제거하고, **대시보드 결재함**과 동일한 IA(결재 수신함 / 결재 상신함 + 하위 7메뉴)로만 노출 |
| GHG 산정 | 사이드바·라우팅에서 **결재함 진입점 삭제** — 감사는 **통합 감사 추적**만 유지 |
| 배지 숫자 | 좌측 결재함 서브메뉴 오렌지 배지가 **실제 목록에 필터링되는 문서 건수**와 일치 |
| SR 보고서 | 「결재 상신 →」 등 이동 시 **대시보드 결재함 예제**가 열리고, 필요 시 **해당 DP/문서로 포커스** |

---

## 2. 현재 코드 구조 (이전 작업 시 참조)

### 2-1. 대시보드 쪽 (목표 UX의 기준)

- **사이드바 결재 서브메뉴·배지**: `src/app/(main)/dashboard/components/DashboardNewSidebar.tsx`  
  - `APPROVAL_COUNTS_HOLDING` / `APPROVAL_COUNTS_SUBSIDIARY`를 `dashboardNewMock.ts`에서 읽어 **도메인별 합산**으로 배지 표시
- **목록·상세(공문 패널)**: `src/app/(main)/dashboard/components/approvalIndex/DashboardApprovalInbox.tsx`  
  - 데이터: `approvalUnified.ts`의 `APPROVAL_UNIFIED_MOCK` → `cloneApprovalUnifiedMock()` 후 필터
- **상단 결재함 탭 배지**: `DashboardNewShell.tsx` → `getApprovalInboxBadgeCount()` (`approvalUnified.ts`)

### 2-2. GHG Audit 쪽 (이전·삭제 대상)

- **결재함 뷰**: `src/app/(main)/ghg_calc/components/audit/ApprovalInboxView.tsx` (미결/기결/기안/수신 탭 + `buildApprovalInboxFeedEvents`)
- **패널 분기**: `AuditTrailPanel.tsx` — `activeTab === 'approval'` 시 위 뷰
- **상태·워크플로**: `auditApprovalState.ts`, `approvalWorkflow.ts`, `data/auditFeedData.ts`, `approvalDemoPack.ts` 등
- **사이드바**: `ghg_calc/components/layout/Sidebar.tsx` — Audit Trail 하위 **「결재함」** 항목
- **브레드크럼**: `GHGCalcLayout.tsx` — `audit-approval`

### 2-3. SR 보고서

- `SrReportStandardsEditor.tsx`, `SrReportGhgEditor.tsx`: `router.push('/dashboard?...')` 로 `tab=approval`, `domain`, `menu`, `dpId`/`srDpId` 전달
- 대시보드: `DashboardPageClient.tsx` → `focusDocId`, `focusSrDpId` 파싱 → `DashboardApprovalInbox`에서 선택 문서 매칭

---

## 3. 근본 원인: 배지와 목록 건수가 어긋나는 이유

**두 개의 서로 다른 데이터 소스**가 공존한다.

1. **배지**: `dashboardNewMock.ts`의 `APPROVAL_COUNTS_*` — 기획용 고정 테이블 (예: 지주 `inbox.request` 합 13 등)
2. **실제 목록**: `approvalUnified.ts`의 `APPROVAL_UNIFIED_MOCK` — 현재는 **메뉴별 소수 건**(예: `inbox.request` 2건 등)만 존재

따라서 스크린샷과 같이 배지는 크게 보이지만, 우측 목록은 비어 있거나 훨씬 적게 보이는 현상이 발생한다.

**원칙**: 배지는 **항상** “`DashboardApprovalInbox`가 그 메뉴·모드에서 보여주는 문서 집합”의 건수와 같아야 한다. (API 연동 후에도 동일 규칙.)

---

## 4. 전략: 단일 진실 공급원(SSOT)으로 배지 계산

### 4-1. 권장 방향 (프론트 mock 단계)

1. `approvalUnified.ts`에 헬퍼 추가 (예시 시그니처):
   - `getApprovalCountsByMenu(docs: ApprovalDocUnified[], mode: 'subsidiary' | 'holding'): Record<ApprovalMenuKey, number>`
   - 지주 전용 엔티티 필터가 배지에도 적용되는지 **제품 정책으로 확정** 후, holding일 때는 `entityFilter`와 동일 규칙으로 subset을 쓸지 결정
2. `DashboardNewSidebar`의 `ApprovalSidebarSubMenu`는 **`APPROVAL_COUNTS_*` 상수를 읽지 않고**, 상위에서 내려준 `counts` prop 또는 Context로 **위 함수 결과**만 표시
3. `getApprovalInboxBadgeCount()`도 동일 `docs` 기준으로 정의 (예: `inbox.request` 중 `pending | inProgress`이면서 내 차례 등 — 정책 문장화 후 코드화)

### 4-2. 대안 (비권장)

- `APPROVAL_UNIFIED_MOCK`을 수십 건으로 부풀려 `APPROVAL_COUNTS_*`와 수치만 맞추기 → 유지보수 시 이중 수정 발생, SSOT 위반

### 4-3. API 연동 시

- 서버가 `menuKey`별 count API를 주거나, 목록과 동일 쿼리의 `total`을 내려주면 프론트는 **같은 응답**으로 사이드바·목록을 갱신

---

## 5. GHG 산정에서 결재함 제거

### 5-1. UI·네비게이션

- `Sidebar.tsx`: `auditChildren`에서 **`approval` 항목 제거**; `AuditSubTab` 타입을 `'unified'`만 남기거나, 내부적으로 `approval` 분기 제거
- `GHGCalcLayout.tsx`: `audit-approval` 브레드크럼·키 제거
- `ghg_calc` 기타 참조: `constants.ts` 등에 결재함 메뉴 정의가 있으면 정리

### 5-2. Audit 패널 동작

- `AuditTrailPanel.tsx`: `ApprovalInboxView` 렌더 분기 **삭제** — 항상 `AuditTrailFeedView`만 표시
- `AuditTrailFeedView.tsx`의 **「결재함」** 버튼:
  - 기존: `onGoApproval` → GHG 내 결재 탭
  - 변경: **대시보드 딥링크** (예: `/dashboard?version=new&mode=subsidiary&tab=approval&domain=all&menu=inbox.request`)  
  - 감사 맥락 유지 시: `domain=audit` 또는 `docId`/`ghgAuditEventId` 쿼리로 연결 (아래 6절과 통합)

### 5-3. 사용하지 않는 컴포넌트

- `ApprovalInboxView.tsx` 및 GHG 전용 결재 타임라인 등은 **삭제** 또는 `deprecated` 후 대시보드 쪽으로 이전 완료 시 제거  
- `buildApprovalInboxFeedEvents`를 결재 **목록**에만 쓰던 경우, 대시보드 통합 목으로 흡수 후 피드 전용 로직만 남길지 검토

---

## 6. Audit Trail 결재 “예제”를 대시보드 결재함 형식으로 이전

### 6-1. 데이터 매핑

- 기존 `approvalMap` / `ApprovalStep[]` 기반 시나리오를 **`ApprovalDocUnified`** 로 변환 규칙을 문서화:
  - `menuKey`: 수신/상신 7분류 중 어디에 속하는지 (기존 미결→`inbox.request`, 기결→`inbox.history` 등 매핑표 작성)
  - `domain`: 감사 성격은 `audit`, GHG 산정 연계는 `ghg` 또는 정책에 따라 `audit` 단일화
  - `links.ghgAuditEventId`: Audit Trail 타임라인과 상호 이동 시 사용 (대시보드 공문 패널의 「GHG 산정에서 보기」 링크와 정합)

### 6-2. 콘텐츠 반영

- `APPROVAL_UNIFIED_MOCK`에 기존 데모 시나리오(문서 제목, 결재선, 본문 요지)를 **추가·치환**  
- GHG 화면에만 있던 **승인/반려 인터랙션**이 필요하면 `DashboardApprovalInbox`의 상태 업데이트 경로와 동일하게 맞출 것 (이미 `updateDoc` 패턴 존재)

### 6-3. 기존 전략 문서와의 역할 분담

- [APPROVAL_INBOX_DASHBOARD_STRATEGY.md](./APPROVAL_INBOX_DASHBOARD_STRATEGY.md): 공문 UI, 결재라인 모달, 계열사/지주 IA  
- **본 문서**: GHG 제거, Audit 예제 이전, **배지=건수**, SR 딥링크

---

## 7. SR 보고서 → 대시보드 결재함 딥링크

### 7-1. 현재 동작

- 이미 `tab=approval`, `domain=sr`, `menu=outbox.progress`, `srDpId`/`dpId` 등 쿼리 전달
- `DashboardApprovalInbox`는 `focusSrDpId`로 `links.srDpId` / `srDpCode` 매칭해 선택

### 7-2. 정합성 강화 체크리스트

- [ ] 카드 ID(`card.id`)와 `APPROVAL_UNIFIED_MOCK`의 `links.srDpId`·`srDpCode` **대소문자·포맷 통일** (`dp-e-01` vs `DP-E-01` 등)
- [ ] 해당 DP에 맞는 문서가 mock에 없으면 **목에 1건 추가**하거나, 포커스 실패 시 **첫 행 선택 + 토스트** 등 UX 정의
- [ ] 필요 시 `docId`를 명시적으로 넘겨 `focusDocId`로 **단건 고정** (여러 문서가 같은 DP에 매핑될 때)

### 7-3. 사용자 문구

- 에디터 내 “대시보드/결재함에서 진행” 안내는 유지하되, 이동 URL이 **항상 동일 규칙**을 따르도록 `dashboard` 쿼리 빌더를 **한 유틸 함수**로 추출하면 SR/GHG/감사 버튼이 일관됨

---

## 8. 구현 순서 제안

1. **SSOT 배지**: `getApprovalCountsByMenu` 도입 → 사이드바가 mock 목록과 동일 건수 표시  
2. **Mock 보강**: Audit에서 쓰던 예제를 `APPROVAL_UNIFIED_MOCK`으로 이전 (메뉴·도메인·링크 필드 정리)  
3. **GHG 결재함 제거**: Sidebar / Panel / Layout / 버튼 링크 교체  
4. **SR 딥링크 검증**: 대표 DP 몇 개로 수동 시나리오 테스트  
5. **정리**: 미사용 GHG 결재 컴포넌트 삭제, 타입(`AuditSubTab` 등) 정리

---

## 9. 검수 기준 (완료 정의)

- GHG 산정 UI에서 **결재함 메뉴·화면 진입 불가**
- Audit Trail에서 결재 관련 액션은 **대시보드 결재함**으로만 이어짐
- 결재함 사이드바 7개 메뉴 배지 합산이 **필터 없을 때** 본문 목록 건수와 일치 (동일 `menuKey` 기준)
- SR 「결재 상신 →」 클릭 시 대시보드 결재 탭에서 **해당 DP 문서가 선택**되거나, 없을 때 정의된 대체 동작 수행

---

## 10. 참고 파일 경로 빠른 목록

| 역할 | 경로 |
|------|------|
| 통합 mock·필터·배지(상단) | `src/app/(main)/dashboard/lib/approvalUnified.ts` |
| 배지용 고정 카운트(제거 대상) | `src/app/(main)/dashboard/lib/dashboardNewMock.ts` (`APPROVAL_COUNTS_*`) |
| 결재 본문 | `src/app/(main)/dashboard/components/approvalIndex/DashboardApprovalInbox.tsx` |
| 결재 사이드바 | `src/app/(main)/dashboard/components/DashboardNewSidebar.tsx` |
| URL 파싱 | `src/app/(main)/dashboard/DashboardPageClient.tsx` |
| GHG Audit 패널 | `src/app/(main)/ghg_calc/components/audit/AuditTrailPanel.tsx`, `AuditTrailFeedView.tsx` |
| GHG 사이드바 | `src/app/(main)/ghg_calc/components/layout/Sidebar.tsx` |

이 문서는 구현 착수 시 체크리스트로 사용하고, 세부 공문 UX는 기존 `APPROVAL_INBOX_DASHBOARD_STRATEGY.md`를 계속 따른다.
