# 대시보드 기능 구현 전략

> **목적**: 대시보드에 필요한 기능을 실제 구현 가능한 단위로 정의  
> **환경**: On-premise  
> **스택 가정**: React (프론트) + REST API (백엔드) + RDB (PostgreSQL 등)

---

## 1. 구현 기능 목록

| # | 기능 | 설명 |
|---|------|------|
| F-01 | 전체 진행률 | 4개 카드 상태 기반 퍼센트 계산 및 표시 |
| F-02 | 페이지별 진행 상태 카드 | 각 페이지 완료/진행중/대기 상태 실시간 반영 |
| F-03 | 확인 필요 사항 | 미완료 항목 자동 감지 및 우선순위 정렬 |
| F-04 | 마감일 관리 | 팀장 설정, D-Day 카운트다운 전체 표시 |
| F-05 | 팀원 가입 승인 | 가입 요청 → 승인/반려 → 계정 활성화 |
| F-06 | 검토 요청 / 피드백 | 팀원 검토 요청 → 팀장 승인/반려 → 팀원 수신 |
| F-07 | 팀원 현황 패널 | 팀원별 담당 페이지·진행률·마지막 활동 표시 |
| F-08 | 보고서 완성도 스코어카드 | 4개 항목 충족 여부 실시간 표시 |
| F-09 | 최종 승인 | 팀장 최종 승인 → 다운로드 버튼 활성화 |
| F-10 | 다운로드 | Excel / PowerPoint — 승인 후 팀장·팀원 모두 가능 |
| F-11 | 인앱 알림 | 이벤트 발생 시 벨 아이콘 + 알림 목록 표시 |
| F-12 | 최근 활동 로그 | 팀 전체 저장·제출·승인 이력 (팀장 전용) |
| F-13 | 역할별 조건부 렌더링 | MANAGER/MEMBER role 기반 블록 표시/숨김 |

---

## 2. DB 테이블 설계

### users
```sql
id            SERIAL PRIMARY KEY
name          VARCHAR
department    VARCHAR
role          ENUM('MANAGER', 'MEMBER')
status        ENUM('ACTIVE', 'INACTIVE', 'PENDING')  -- PENDING: 승인 대기
email         VARCHAR UNIQUE
password_hash VARCHAR
company_id    INTEGER REFERENCES companies(id)
created_at    TIMESTAMP
```

### companies
```sql
id          SERIAL PRIMARY KEY
name        VARCHAR
deadline    DATE        -- 보고서 마감일 (팀장 설정)
approved_at TIMESTAMP   -- 최종 보고서 승인 시각
approved_by INTEGER REFERENCES users(id)
```

### page_status
```sql
id         SERIAL PRIMARY KEY
company_id INTEGER REFERENCES companies(id)
page       ENUM('company_info', 'ghg', 'sr', 'charts')
status     ENUM('WAITING', 'IN_PROGRESS', 'DONE')
percent    INTEGER DEFAULT 0
assignee   INTEGER REFERENCES users(id)  -- 담당 팀원
updated_at TIMESTAMP
```

### review_requests  -- 검토 요청 / 피드백
```sql
id           SERIAL PRIMARY KEY
company_id   INTEGER REFERENCES companies(id)
page         ENUM('company_info', 'ghg', 'sr', 'charts')
requested_by INTEGER REFERENCES users(id)   -- 요청자 (팀원)
reviewed_by  INTEGER REFERENCES users(id)   -- 처리자 (팀장)
status       ENUM('PENDING', 'APPROVED', 'REJECTED')
message      TEXT     -- 팀장 피드백 내용
created_at   TIMESTAMP
updated_at   TIMESTAMP
```

### notifications  -- 인앱 알림
```sql
id         SERIAL PRIMARY KEY
user_id    INTEGER REFERENCES users(id)   -- 수신자
type       ENUM('JOIN_REQUEST', 'REVIEW_REQUEST', 'APPROVED', 'REJECTED', 'FINAL_APPROVED')
message    TEXT
link       VARCHAR   -- 클릭 시 이동할 경로
is_read    BOOLEAN DEFAULT FALSE
created_at TIMESTAMP
```

### activity_logs
```sql
id         SERIAL PRIMARY KEY
company_id INTEGER REFERENCES companies(id)
user_id    INTEGER REFERENCES users(id)
action     VARCHAR   -- 예: 'GHG 산정 결과 저장'
page       VARCHAR
created_at TIMESTAMP
```

---

## 3. API 설계

### 3.1 대시보드 데이터

```
GET /api/dashboard
Response:
{
  overallPercent: number,
  counts: { done, inProgress, waiting },
  deadline: string,
  dDay: number,
  pageStatuses: PageStatus[],
  actionItems: ActionItem[],        // 확인 필요 사항
  scorecard: ScorecardItem[],
  sections: SectionProgress[],
  teamMembers: TeamMember[],        // MANAGER only
  activityLog: ActivityLog[],       // MANAGER only
  feedbacks: Feedback[],            // MEMBER only
  unreadNotifications: number
}
```

### 3.2 마감일 설정 (팀장 전용)

```
PATCH /api/company/deadline
Body: { deadline: "2026-03-31" }
```

### 3.3 팀원 가입 승인/반려 (팀장 전용)

```
POST /api/users/:userId/approve     -- 승인 → status: ACTIVE
POST /api/users/:userId/reject      -- 반려 → status: INACTIVE
```

승인 시 동작:
1. users.status → ACTIVE
2. notifications 생성 (해당 팀원에게 "가입이 승인되었습니다")

### 3.4 검토 요청 (팀원)

```
POST /api/review-requests
Body: { page: "ghg", message: "검토 부탁드립니다" }
```

생성 시 동작:
1. review_requests 레코드 생성 (status: PENDING)
2. 팀장에게 notifications 생성 ("팀원이 검토를 요청했습니다")

### 3.5 검토 요청 처리 (팀장)

```
PATCH /api/review-requests/:id
Body: { status: "APPROVED" | "REJECTED", message: "피드백 내용" }
```

처리 시 동작:
1. review_requests.status 업데이트
2. 해당 팀원에게 notifications 생성
3. APPROVED 시 page_status 업데이트

### 3.6 최종 보고서 승인 (팀장 전용)

```
POST /api/company/final-approve
```

승인 시 동작:
1. companies.approved_at, approved_by 기록
2. 전체 팀원에게 notifications 생성 ("최종 보고서가 승인되었습니다. 다운로드 가능합니다")
3. 다운로드 권한 활성화

### 3.7 알림

```
GET  /api/notifications             -- 알림 목록
PATCH /api/notifications/read-all   -- 전체 읽음 처리
PATCH /api/notifications/:id/read   -- 단건 읽음 처리
```

### 3.8 다운로드

```
GET /api/report/download?format=xlsx
GET /api/report/download?format=pptx
```

권한 체크: companies.approved_at 존재 여부 확인 → 없으면 403

---

## 4. 프론트 상태 관리

### 4.1 전역 상태 (zustand 권장)

```typescript
// 인증
useAuthStore: {
  user: { id, name, role, status }
  token: string
}

// 대시보드
useDashboardStore: {
  data: DashboardData
  loading: boolean
  fetch: () => void       // GET /api/dashboard
  setDeadline: (date) => void
}

// 알림
useNotificationStore: {
  notifications: Notification[]
  unreadCount: number
  fetchNotifications: () => void
  markRead: (id) => void
}
```

### 4.2 실시간 알림 처리

on-prem 환경에서는 외부 서비스 없이 **폴링(Polling)** 방식을 권장한다.

```typescript
// 30초마다 알림 조회
useEffect(() => {
  const interval = setInterval(() => {
    fetchNotifications()
  }, 30000)
  return () => clearInterval(interval)
}, [])
```

SSE(Server-Sent Events)가 가능한 환경이라면 폴링 대신 SSE를 사용해 즉시 수신 가능.

---

## 5. 역할별 조건부 렌더링

```tsx
const { user } = useAuthStore()
const isManager = user.role === 'MANAGER'

return (
  <Dashboard>
    <OverallProgress />           {/* 공통 */}
    <PageStatusCards />           {/* 공통 */}
    <ActionItems />               {/* 공통 - 역할별 필터링은 API에서 처리 */}

    {isManager && <TeamMemberPanel />}   {/* 팀장 전용: 팀원 현황 + 가입 승인 */}
    {isManager && <ActivityLog />}       {/* 팀장 전용: 최근 활동 로그 */}
    {!isManager && <FeedbackInbox />}    {/* 팀원 전용: 피드백 수신함 */}

    <ReportExport isManager={isManager} />  {/* 공통 - 최종 승인 버튼은 팀장만 */}
  </Dashboard>
)
```

---

## 6. 주요 플로우 정리

### 플로우 1: 팀원 가입 승인

```
팀원 회원가입
  → users.status = PENDING
  → 팀장 대시보드 "확인 필요 사항"에 표시
  → 팀장 [승인] 클릭 → POST /api/users/:id/approve
  → users.status = ACTIVE
  → 팀원에게 인앱 알림 발송
  → 팀원 대시보드 접근 가능
```

### 플로우 2: 검토 요청 → 피드백

```
팀원이 섹션 작성 완료
  → [검토 요청] 버튼 클릭 → POST /api/review-requests
  → 팀장 "확인 필요 사항" + 알림 벨에 표시
  → 팀장 [승인] 또는 [반려 + 피드백 입력] → PATCH /api/review-requests/:id
  → 팀원 피드백 수신함에 결과 표시 + 알림 발송
  → 반려 시 [재요청] 버튼 활성화
```

### 플로우 3: 최종 보고서 승인 → 다운로드

```
스코어카드 4개 항목 모두 충족
  → [최종 승인] 버튼 활성화 (팀장 전용)
  → 팀장 클릭 → POST /api/company/final-approve
  → 전체 팀원 인앱 알림 발송
  → Excel / PowerPoint 다운로드 버튼 활성화 (팀장·팀원 모두)
```

---

## 7. 구현 우선순위

| Phase | 작업 | 포함 기능 | 기간 |
|-------|------|-----------|------|
| 1 | DB + 인증 + 기본 API | users, companies, page_status 테이블 / 로그인·role 기반 인증 | 1주 |
| 2 | 대시보드 데이터 연동 | F-01~04 진행률·카드·액션·마감일 | 1주 |
| 3 | 승인 워크플로우 | F-05~06 가입 승인·검토 요청·피드백 | 1주 |
| 4 | 알림 + 로그 | F-11~12 인앱 알림·활동 로그 | 1주 |
| 5 | 보고서 출력 | F-08~10 스코어카드·최종 승인·다운로드 | 1주 |
