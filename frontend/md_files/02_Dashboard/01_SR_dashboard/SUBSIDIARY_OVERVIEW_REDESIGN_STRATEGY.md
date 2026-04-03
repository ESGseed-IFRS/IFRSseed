# 계열사 대시보드(신규) — 전체 요약(Overview) 개선 전략

> **대상 파일**: `src/app/(main)/dashboard/components/DashboardNewContent.tsx`  
> `renderOverview()` → `mode === 'subsidiary'` 분기  
> **목적**: 계열사 ESG 실무자(담당자)가 하루를 시작할 때 **지금 뭘 해야 하는지** 즉시 파악하고, 모든 버튼이 의미있는 페이지로 연결되는 세련되고 전문적인 대시보드

---

## 1. 현재 화면의 문제 진단

### 1-1. UI/UX
| 영역 | 현 상태 | 문제점 |
|------|---------|--------|
| 전체 레이아웃 | 2컬럼(SR / GHG) 병렬 | 위계 없이 동등한 비중 → 우선순위 파악 어려움 |
| SR DP 현황 | 상태별 숫자 타일 5개 나열 | 클릭해도 아무 반응 없음 |
| 주의 DP 알림 | 빨간 박스 안에 리스트 | `onSelectTab('sr')` 연결은 됐지만 **어떤 DP로 이동하는지 연결 없음** |
| GHG 이상치 | 3개 버튼 → `onSelectTab('ghg')` | GHG 탭으로 이동하지만 **해당 이상치 항목이 하이라이트되지 않음** |
| 결재함 요약 | 수신함/수신참조 수 표시 | 버튼 클릭 → `approval` 탭으로 이동(O), 그러나 **메뉴 선택 상태가 전달되지 않음** |
| 최근 활동 | SR 항목 상태 나열 | `onSelectTab('sr')` 연결, 특정 항목으로 딥링크 없음 |
| 긴급 마감 "작성→" 버튼 | `onSelectTab('sr')` | SR 탭 전체를 여는 것에 그침 |

### 1-2. 기능 관점
- **DP별 담당자 관리 없음**: 실무자 입장에서 "내가 담당하는 DP"만 필터해서 보기 불가
- **진행률 시각화 약함**: 숫자만 있고, 전체 진척도를 직관적으로 못 보여줌
- **지주사 피드백(반려/수정요청) 강조 미흡**: 오픈 피드백이 있어도 눈에 잘 안 띔
- **제출 기한 카운트다운 없음**: D-Day 등의 명확한 긴박감 전달 어려움
- **GHG 제출 버튼 없음**: 개요에서 바로 GHG 제출 트리거 불가

---

## 2. 새로운 레이아웃 구조

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [A] 상단 상태 띠 (Status Bar)  — 1행, 4개 KPI                              │
│      SR 전체 완료율  |  오픈 피드백(반려)  |  GHG 충실도  |  D-Day 카운트다운 │
├──────────────────────────────┬──────────────────────────────────────────────┤
│  [B] 즉시 처리 필요 (Action Center)  ← 핵심 영역                            │
│  ┌────────────────────────┐  │  ┌──────────────────────────────────────────┐│
│  │  B-1. 지주사 피드백     │  │  │  B-2. 내 마감 임박 DP (D-3 이내)        ││
│  │  (반려/수정요청 오픈)   │  │  │  각 항목에 "바로 작성→" 딥링크           ││
│  └────────────────────────┘  │  └──────────────────────────────────────────┘│
├──────────────────────────────┴──────────────────────────────────────────────┤
│  [C] SR 진행 현황 (3컬럼 분할)                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │  C-1. DP 진행률  │  │  C-2. 카테고리별 │  │  C-3. 결재 수신함        │  │
│  │  (도넛/바 차트)  │  │  완료율 미니바   │  │  (결재요청/반려 집중)    │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│  [D] GHG 산정 현황 + 최근 활동 (2컬럼)                                      │
│  ┌────────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │  D-1. GHG 스코프별 현황        │  │  D-2. 최근 활동 피드 (타임라인)  │  │
│  │  이상치 목록(클릭→GHG 딥링크)  │  │                                  │  │
│  └────────────────────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 영역별 상세 설계

### [A] 상단 요약 (Action-oriented Summary Bar)

```tsx
// 4개 KPI — \"상태\"보다 \"즉시 실행\" 관점으로 구성
const kpis = [
  {
    label: '마감 임박',
    value: dDayText(urgentDl), // "D-3", "D-day", "마감 없음"
    sub: urgentDl ? `${urgentDl} · ${urgentItems.length}개 항목` : '마감 임박 항목 없음',
    accent: dDayNum(urgentDl) <= 3 ? C.red : dDayNum(urgentDl) <= 7 ? C.amber : C.teal,
    onClick: () => onSelectTab('sr'), // 향후: selectedDpId로 딥링크
  },
  {
    label: '지주사 피드백(오픈)',
    value: `${openFeedbackCnt}건`,
    sub: openFeedbackCnt > 0 ? '수정/근거 보완 요청 확인' : '미처리 없음',
    accent: openFeedbackCnt > 0 ? C.red : C.green,
    onClick: () => onSelectTab('sr'), // 향후: selectedFeedbackId로 딥링크
  },
  {
    label: '결재 대기',
    value: `${inboxRequestTotal}건`,
    sub: '본인 승인요청 + SR/GHG 합산',
    accent: inboxRequestTotal > 0 ? C.blue : C.g600,
    onClick: () => {
      setApprDomain('all');
      setApprMenu('inbox.request');
      onSelectTab('approval');
    },
  },
  {
    label: 'GHG 이상치(미조치)',
    value: `${ghgSub.anomalyOpen}건`,
    sub: '데이터 검증/조치 필요',
    accent: ghgSub.anomalyOpen > 0 ? C.amber : C.green,
    onClick: () => onSelectTab('ghg'), // 향후: selectedAnomalyId로 딥링크
  },
]
```

**D-Day 계산 헬퍼 추가**:
```ts
// lib/mockData.ts 또는 DashboardNewContent.tsx 내부
function dDayNum(dl: string | undefined): number {
  if (!dl) return 99;
  const today = new Date();
  const target = new Date(`2026-${dl}`);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
function dDayText(dl: string | undefined): string {
  const n = dDayNum(dl);
  if (n <= 0) return 'D-day';
  if (n > 30) return '마감 여유';
  return `D-${n}`;
}
```

---

### [B] 즉시 처리 필요 (Action Center)

**B-1: 지주사 피드백 (오픈 반려/수정요청)**

```tsx
// FEEDBACKS에서 status === 'open'만 필터
// 클릭 시 → onSelectTab('sr') + 향후: URL hash 또는 state로 피드백 ID 전달
<div
  key={fb.id}
  onClick={() => {
    onSelectTab('sr');
    // TODO: SR탭이 피드백 목록으로 스크롤 or 하이라이트되도록 연결
    // 현재는 state에 selectedFeedbackId 추가 후 SRReportDashboardV3Subsidiary에 prop 전달로 구현
  }}
>
  <FeedbackBadge urgency={fb.responseDl} />
  <span>{fb.item}</span>       // 항목명
  <span>{fb.from}</span>       // 피드백 작성자
  <span>{fb.msg 앞 40자}</span>// 요약
  <ChevronRight />
</div>
```

**B-2: 마감 임박 DP (D-3 이내)**

```tsx
// urgentItems에서 status !== 'approved' && dDayNum(dl) <= 3
// 각 항목마다 "바로 작성 →" 버튼
// 클릭 시 → onSelectTab('sr') 후 향후 딥링크: selectedDpId prop 전달
{urgentItems.map(item => (
  <div key={item.id}>
    <DpCategoryBadge cat={item.cat} />
    <span>{item.label}</span>
    <DayBadge dl={item.dl} />   // D-n 표시
    <StatusBadge status={getEffectiveSrWorkflow(item)} />
    <button onClick={() => onSelectTab('sr')}>
      바로 작성 →
    </button>
  </div>
))}
```

---

### [C] SR 진행 현황 (3컬럼)

**C-1: DP 전체 진행률 (도넛 차트 + 텍스트)**

```tsx
// 외부 라이브러리(recharts PieChart) 또는 SVG 순수 구현
// 중앙에 "완료 X/13" 텍스트
// 아래에 상태별 범례 — 각 범례 클릭 → onSelectTab('sr') + 필터 state 전달

const donutData = [
  { name: '승인완료', value: dpCounts.approved, color: C.green },
  { name: '제출완료', value: dpCounts.submitted, color: C.blue },
  { name: '작성중',   value: dpCounts.drafting,  color: C.amber },
  { name: '반려',     value: dpCounts.rejected,  color: C.red },
  { name: '미작성',   value: dpCounts.not_started, color: C.g200 },
]
```

**C-2: E/S/G/IT 카테고리별 완료율 미니바**

```tsx
// cats = ['E', 'S', 'G', 'IT']
// 각 카테고리 SR_ITEMS 필터 후 승인완료/전체 비율 계산
// 클릭 → onSelectTab('sr') + 카테고리 필터 state 전달
['E','S','G','IT'].map(cat => {
  const items = SR_ITEMS.filter(i => i.cat === cat);
  const done = items.filter(i => getEffectiveSrWorkflow(i) === 'approved').length;
  return { cat, done, total: items.length, pct: Math.round(done/items.length*100) };
})
```

**C-3: 결재 수신함 (미결 중심)**

```tsx
// 결재요청(inbox.request) 강조, 반려(outbox.rejected) 강조
// 각 항목 클릭 → onSelectTab('approval') + setApprMenu(key) — 이미 연결됨
// 개선: 수신함 전체 "보기" 링크 폰트 크기 키우고 배경 강조
```

---

### [D] GHG + 최근 활동

**D-1: GHG 스코프별 현황 (개선)**

```tsx
// 현재: pill 3개 + 이상치 리스트
// 개선: 스코프별 좁은 카드 3개 + 이상치 클릭 시 딥링크 연결

// 이상치 클릭 딥링크:
// 현재: onSelectTab('ghg') — GHG 탭 전체 이동
// 개선: onSelectTab('ghg') + 향후 anomalyId state 추가로
//       GHG 탭 내 이상치 리스트에서 해당 항목 자동 스크롤+하이라이트

onClick={() => {
  onSelectTab('ghg');
  // TODO: DashboardNewShell.tsx에서 selectedAnomalyId state 추가 후
  //       DashboardNewContent → GHG 탭 → renderGhg()로 prop 전달
}}
```

**D-2: 최근 활동 피드 (타임라인 스타일)**

```tsx
// 현재: 점(dot) + 텍스트 나열
// 개선: 타임라인 세로선 + 아이콘(색상 구분) + 날짜 우측 정렬
// 각 항목 클릭 연결:
//   - SR 항목 → onSelectTab('sr')
//   - GHG 이상치 → onSelectTab('ghg')
//   - 결재 → onSelectTab('approval') + menu key
```

---

## 4. 버튼 연결 전략 (현재 → 개선)

| 버튼/항목 | 현재 | 개선 (단계별) |
|----------|------|--------------|
| SR DP 상태 타일(5개) | 클릭 無 | → `onSelectTab('sr')` 연결 + 향후 status 필터 state 전달 |
| 주의 DP 항목 | `onSelectTab('sr')` | → `onSelectTab('sr')` + `selectedDpId` state prop 전달 (딥링크) |
| GHG 이상치 항목 | `onSelectTab('ghg')` | → `onSelectTab('ghg')` + `selectedAnomalyId` state 추가 |
| 피드백(반려) 항목 | — | 신규 추가: `onSelectTab('sr')` + `selectedFeedbackId` state |
| 마감 "작성→" 버튼 | `onSelectTab('sr')` | → `onSelectTab('sr')` + `selectedDpId` state (딥링크) |
| 결재 수신함 버튼 | `onSelectTab('approval') + setApprMenu` | ✅ 이미 연결됨 — 유지 |
| 최근 활동 각 항목 | `onSelectTab('sr' 또는 'ghg')` | 항목 종류별로 적절한 탭+딥링크 연결 |

### 딥링크 state 설계 (DashboardNewShell.tsx 수정 필요)

```ts
// DashboardNewShell.tsx에 추가
const [selectedDpId, setSelectedDpId] = useState<string | null>(null);
const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);
const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);

// DashboardNewContent에 prop으로 내려보내기
<DashboardNewContent
  ...
  selectedDpId={selectedDpId}
  setSelectedDpId={setSelectedDpId}
  selectedAnomalyId={selectedAnomalyId}
  setSelectedAnomalyId={setSelectedAnomalyId}
  selectedFeedbackId={selectedFeedbackId}
  setSelectedFeedbackId={setSelectedFeedbackId}
/>

// SR 탭(SRReportDashboardV3Subsidiary)에서도 prop을 받아
// 해당 DP 카드로 자동 스크롤 + 하이라이트 처리
```

---

## 5. 비주얼 토큰 정의 (세련된 느낌을 위해)

### 색상 계층
```ts
// 현재 C 객체에 추가할 값
const C_EXTENDED = {
  // 상태 배경 — 기존 xxxSoft보다 채도 낮춤 (전문적)
  approvedBg:  '#f0faf4',   // 승인완료: 매우 연한 그린
  submittedBg: '#eff6ff',   // 제출완료: 매우 연한 블루
  draftingBg:  '#fffbeb',   // 작성중: 매우 연한 앰버
  rejectedBg:  '#fff5f5',   // 반려: 매우 연한 레드

  // 구분선
  divider: 'rgba(0,0,0,0.06)',

  // 카드 그림자
  cardShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',

  // 강조 테두리 (왼쪽 accent bar용)
  accentBlue:  '#1351D8',
  accentGreen: '#16a34a',
  accentAmber: '#d97706',
  accentRed:   '#dc2626',
}
```

### 타이포그래피 규칙
| 역할 | fontSize | fontWeight | color |
|------|---------|-----------|-------|
| 섹션 제목 | 13px | 700 | `#111827` |
| KPI 숫자 | 24px | 800 | accent 색 |
| KPI 서브 | 11px | 400 | `#6b7280` |
| 항목 레이블 | 12px | 600 | `#374151` |
| 보조 설명 | 11px | 400 | `#9ca3af` |
| 상태 뱃지 | 10px | 600 | 상태 색 |

### 카드 스타일 통일
```ts
// Card 공통 스타일 (shared.tsx 업데이트)
{
  background: 'white',
  borderRadius: 12,
  padding: '16px 18px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
  border: 'none',   // 기존 border 제거, shadow로 대체
}

// 강조 카드 (Action Center 등)
{
  background: 'white',
  borderRadius: 12,
  padding: '14px 16px',
  borderLeft: '3px solid {accentColor}',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
}
```

---

## 6. 구현 순서 (Phase 계획)

### Phase 1 — 버튼 연결 (즉시 가능)
1. `DashboardNewShell.tsx` — `selectedDpId`, `selectedAnomalyId`, `selectedFeedbackId` state 추가
2. `DashboardNewContent.tsx` — 기존 버튼들에 `setSelectedDpId` 연결
3. `SRReportDashboardV3Subsidiary` — `selectedDpId` prop 수신 후 해당 카드 border 강조 + scroll

### Phase 2 — 레이아웃 리디자인
1. `renderOverview()` 에서 `[A] 상태 띠` 구현 (KPI 4개 + D-Day 헬퍼)
2. `[B] Action Center` 구현 (피드백 + 마감 임박 DP 2컬럼)
3. 기존 SR DP 상태 타일 → 도넛 차트 or 미니 바 (C-1, C-2) 교체
4. 결재함 요약 리스타일 (C-3)

### Phase 3 — GHG + 타임라인
1. GHG 스코프별 카드 재구성 (D-1)
2. 최근 활동 → 타임라인 스타일 (D-2)
3. 이상치 클릭 딥링크 연결

### Phase 4 — 폴리싱
1. 카드 공통 스타일 통일 (`shared.tsx`)
2. 반응형 그리드 (화면 좁을 때 1컬럼 fallback)
3. 빈 상태(empty state) UX 정비

---

## 7. 변경 파일 목록

| 파일 | 변경 유형 | 주요 내용 |
|------|----------|----------|
| `DashboardNewContent.tsx` | 수정 | `renderOverview()` subsidiary 분기 전면 리디자인 |
| `DashboardNewShell.tsx` | 수정 | `selectedDpId`, `selectedAnomalyId`, `selectedFeedbackId` state 추가 |
| `components/shared.tsx` | 수정 | Card 스타일 업데이트, 새 `KpiBar`, `ActionCard`, `Timeline` 컴포넌트 추가 |
| `lib/mockData.ts` | 수정 | D-Day 헬퍼 함수 추가(또는 Content 내부 정의) |
| `md_files/05_dashboard/01_sr_dashboard/SRReportDashboard_v3.jsx` | 수정 | `selectedDpId` prop 수신 후 해당 카드 하이라이트 처리 |

---

## 8. 목업 스케치 (텍스트)

```
┌─ [A] 상단 요약 ────────────────────────────────────────────────────┐
│  마감 임박             지주사 피드백(오픈)        결재 대기        GHG 이상치(미조치) │
│  D-3                  2건                      3건              2건               │
│  03-20 · 3개 항목        수정/근거 보완 요청 확인      본인 승인요청 기준      데이터 검증/조치 필요   │
└──────────────────────────────────────────────────────────────────┘

┌─ [B] 즉시 처리 필요 ──────────────────────────────────────────────┐
│ ┌── B-1 지주사 피드백 ─────────┐  ┌── B-2 마감 임박 DP ──────────┐│
│ │[요청] 온실가스 배출량         │  │ E  온실가스 배출량  D-day  [작성→]││
│ │  Scope 1 급증 사유 기재 요청 │  │ E  에너지·재생에너지 D-1  [작성→]││
│ │  → 최다현 (SDS 지속가능)     │  │ IT 정보보호·AI     D-1  [작성→]││
│ │  답변 기한: 03-21 ▶          │  └──────────────────────────────┘│
│ │                              │                                    │
│ │[요청] 임직원·다양성           │                                    │
│ │  여성관리자 비율 누락          │                                    │
│ │  → 정우석 (SDS 지속가능)     │                                    │
│ │  답변 기한: 03-20 ▶          │                                    │
│ └──────────────────────────────┘                                   │
└──────────────────────────────────────────────────────────────────┘

┌─ [C] SR 진행 현황 3분할 ─────────────────────────────────────────┐
│ ┌── C-1 DP 진행률 ──┐  ┌── C-2 카테고리 ──┐  ┌── C-3 결재함 ──┐ │
│ │     (도넛)        │  │ E ████░ 50%       │  │ 결재요청   3   │ │
│ │   완료 5/13       │  │ S ███░░ 40%       │  │ 결재내역   6   │ │
│ │                   │  │ G ██░░░ 33%       │  │ 수신참조   2   │ │
│ │ ● 승인 1          │  │ IT██░░░ 67%       │  │ ─────────────  │ │
│ │ ● 제출 2          │  │                   │  │ 반려      1    │ │
│ │ ● 작성 0          │  │ [SR탭 이동 →]     │  │ [결재함 →]     │ │
│ │ ● 반려 2          │  └──────────────────┘  └────────────────┘ │
│ │ ○ 미작성 8        │                                             │
│ └──────────────────┘                                              │
└──────────────────────────────────────────────────────────────────┘

┌─ [D] GHG + 최근 활동 ────────────────────────────────────────────┐
│ ┌── D-1 GHG 현황 ──────────────────┐  ┌── D-2 최근 활동 ────────┐│
│ │ Scope 1  122,842 tCO₂  (경고)   │  │ - 안전보건 승인완료      ││
│ │ Scope 2   85,340 tCO₂  (정상)   │  │   03-20                  ││
│ │ Scope 3       미산정             │  │ - 온실가스 배출량 반려   ││
│ │ ────────────────────────         │  │   재작성 필요            ││
│ │ 이상치 미조치 2건                 │  │ - LNG 이상치 감지        ││
│ │  전력 (춘천DC) +52% [이동→]      │  │   GHG 확인 필요          ││
│ │  LNG (판교 캠퍼스) +67% [이동→]  │  └─────────────────────────┘│
│ └──────────────────────────────────┘                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9. 참고 링크

| 항목 | 경로 |
|------|------|
| 현재 Overview 렌더러 | `DashboardNewContent.tsx` L204–L858 |
| SR 아이템 목 데이터 | `lib/mockData.ts` — `SR_ITEMS`, `FEEDBACKS`, `GHG_STATUS` |
| 결재 개수 목 데이터 | `lib/dashboardNewMock.ts` — `APPROVAL_COUNTS_SUBSIDIARY` |
| 워크플로우 상태 스타일 | `lib/workflowStatus.ts` — `WORKFLOW_STATUS_STYLE` |
| 공통 컴포넌트 | `components/shared.tsx` — `Card`, `CTitle`, `Pbar`, `AlertBanner` |
