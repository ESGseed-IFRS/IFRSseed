# 감사대응(Audit & Verification) 기능 — 상세 구현 로드맵

> **현황 진단**: 현재 구현된 내용은 **화면(UI) 레이아웃 수준**에 불과하다. 실무자가 실제로 사용할 수 있는 기능(Period Lock, e-Sign 승인, Audit Trail, Hash Verification 등)은 전혀 반영되지 않았다.  
> 본 문서는 AUDIT_TRAIL_PLANNING.md의 IA 구조 및 모든 기능을 **실제 동작하는 시스템**으로 구축하기 위한 **상세 구현 계획**이다.

---

## 1. 현재 구현 vs 목표

| 구분 | 현재 | 목표 |
|------|------|------|
| **탭 구조** | 단일 화면 (대시보드 + 테이블) | IA 기준 **7개 서브 메뉴** + 좌측 네비게이션 |
| **내부통제 대시보드** | 정적 숫자 표시 (placeholders) | **실제 데이터 기반** 증빙 구비율, 결재 완료율, Lock 현황 |
| **데이터 마감/확정** | 없음 | **Period Lock**, Unlock 승인, Snapshot 생성·조회 |
| **배출량별 감사 추적** | 체크리스트 테이블만 | 활동자료·배출계수·산정결과 **상세 뷰어** + 데이터 링크 |
| **변경 이력** | 없음 | **Audit Trail** 타임라인, 변경 전/후 diff |
| **증빙자료** | Scope 3 영수증만 | **Hash Verification UI**, 무결성 검증 |
| **산정 방법론·계보** | 정적 텍스트 | **Factor Versioning**, 방법론 변경 이력 |
| **감사인 전용 뷰** | 없음 | **Read-only Auditor UI**, Comment & Response |
| **감사 대응 패키지** | 리포트 탭 링크만 | **Sampling Export**, 조건 지정 → ZIP 패키지 |
| **전자서명(e-Sign)** | 없음 | **최종 승인 시 e-Sign 필수** |

---

## 2. IA 구조에 따른 화면·라우팅 설계

```
[감사·검증 대응] 탭 클릭
└─ 좌측 사이드바 (네비게이션)
   ├─ 1. 내부통제 요약 대시보드     ← 기본 진입 화면
   ├─ 2. 데이터 마감/확정 관리      ← Lock & Snapshot
   ├─ 3. 배출량별 감사 추적
   │      ├─ 3-1 활동자료(Activity Data)
   │      ├─ 3-2 배출계수(Emission Factor)
   │      └─ 3-3 산정결과(Calculated Emissions)
   ├─ 4. 변경 이력(Audit Trail)
   ├─ 5. 증빙자료(Evidence & Integrity)
   ├─ 6. 산정 방법론 및 로직 계보(Lineage)
   ├─ 7. 감사인 전용 뷰(Auditor View)
   └─ 8. 감사 대응 패키지(Export)
```

### 2.1 프론트엔드 구현 포인트

| 항목 | 구현 방식 |
|------|-----------|
| **네비게이션** | IFRSAuditView 내부에 `auditSubMenu` state 또는 URL hash (`#dashboard`, `#lock`, `#trail` 등) |
| **컴포넌트 분리** | `AuditDashboard`, `DataLockManager`, `EmissionTrailViewer`, `AuditTrailViewer`, `EvidenceIntegrityView`, `LineageViewer`, `AuditorView`, `AuditPackageExport` |
| **공통 레이아웃** | 좌측 200px 네비 + 메인 콘텐츠 영역 |

---

## 3. 기능별 상세 구현 계획

### 3.1 내부통제 요약 대시보드

#### 3.1.1 목표
- **증빙 구비율(%)**: 실제 레코드 대비 증빙 연결 건수
- **주요 변경 요약**: 직전 Snapshot 대비 ±10% 이상 변동 항목
- **결재 완료율(%)**: Pending → Approved 비율 (승인 워크플로우 연동)
- **Lock / Unlock 현황**: 마감된 기간, 미마감 기간

#### 3.1.2 필요한 데이터/API

| 지표 | 데이터 소스 | 비고 |
|------|-------------|------|
| 증빙 구비율 | scope1/2/3 receipts, activity rows | 프론트 집계 가능 (현재) |
| 주요 변경 | 이전 Snapshot vs 현재 store diff | **Snapshot API** 필요 |
| 결재 완료율 | approval_requests 테이블 | **백엔드** |
| Lock 현황 | period_locks 테이블 | **백엔드** |

#### 3.1.3 구현 순서
1. 증빙 구비율: 기존 store 기반 계산 로직 보강
2. Lock/결재: Phase 1 백엔드 연동 후 대시보드 반영
3. 주요 변경: Snapshot 구현 후 diff 로직

---

### 3.2 데이터 마감/확정 관리 (Lock & Snapshot)

#### 3.2.1 Period Lock (기간 잠금)

**요구사항**
- 월별 또는 연도별 산정 완료 시 "마감(Lock)" 처리
- Lock 상태의 데이터는 Read-only (수정 버튼 비활성화)
- 감사인은 "검증 개시 이후 데이터 미변경" 확인 가능

**데이터 모델 (백엔드)**

```sql
-- period_locks: 기간별 마감 상태
CREATE TABLE period_locks (
  id UUID PRIMARY KEY,
  scope TEXT NOT NULL,           -- 'scope1' | 'scope2' | 'scope3' | 'all'
  period_type TEXT NOT NULL,     -- 'monthly' | 'yearly'
  period_value TEXT NOT NULL,    -- '2025-01' or '2025'
  locked_at TIMESTAMPTZ NOT NULL,
  locked_by TEXT NOT NULL,
  company_id UUID,
  UNIQUE(scope, period_type, period_value, company_id)
);
```

**프론트엔드**
- `usePeriodLocks(scope, year)` 훅 → Lock 여부 조회
- Scope1/2/3 테이블: `isLocked(row)`일 때 input disabled, "마감됨" 배지
- "마감하기" 버튼: 선택 기간에 대해 Lock API 호출

#### 3.2.2 Unlock Workflow

**요구사항**
- Lock 데이터 수정 시: 관리자 승인 필수
- "Unlock 승인 요청" → 승인 프로세스 → 승인 완료 시 자동 Unlock
- 수정 사유 입력 필수
- Unlock / Re-lock 이력은 audit_log에 기록

**데이터 모델**

```sql
-- unlock_requests: Unlock 승인 요청
CREATE TABLE unlock_requests (
  id UUID PRIMARY KEY,
  period_lock_id UUID REFERENCES period_locks(id),
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,          -- 'pending' | 'approved' | 'rejected'
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT
);
```

**프론트엔드**
- Lock된 데이터 수정 시도 → "Unlock 승인 요청" 모달
- 수정 사유 입력 → API 호출
- 관리자: "승인 대기 목록" 화면에서 승인/반려

#### 3.2.3 Snapshot 기능

**요구사항**
- 마감 시점의 전체 데이터셋을 스냅샷으로 저장
- 이후 데이터 변경과 무관하게 "마감 당시 기준 값" 재현

**데이터 모델**

```sql
-- snapshots: 마감 시점 데이터 스냅샷
CREATE TABLE snapshots (
  id UUID PRIMARY KEY,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,
  payload JSONB NOT NULL,        -- scope1, scope2, scope3, boundaryPolicy 전체
  period_locks_snapshot JSONB,   -- 당시 Lock 상태
  company_id UUID
);
```

**프론트엔드**
- "스냅샷 저장" 버튼 → `buildEvidencePayload`와 동일 구조로 직렬화 → API 전송
- "스냅샷 목록" 조회 → 비교 시 "이 스냅샷 기준으로 되돌리기" 또는 diff 보기

#### 3.2.4 Approval Workflow & e-Signature (4.4)

**요구사항 (AUDIT_TRAIL_PLANNING §4.4)**
- 입력자 → 검토자 → 승인자(관리자) 다단계
- 최종 승인 시 **전자서명(e-Sign) 필수**
- 서명자 ID, 서명 시각(UTC), 서명 해시값, Snapshot ID 저장

**데이터 모델**

```sql
-- approval_workflows: 승인 요청
CREATE TABLE approval_workflows (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,            -- 'unlock' | 'methodology_change' | 'final_submission'
  target_id UUID,                -- unlock_request_id, methodology_change_id 등
  status TEXT NOT NULL,          -- 'pending' | 'approved' | 'rejected'
  current_step INT DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL,
  company_id UUID
);

-- approval_steps: 단계별 승인 이력
CREATE TABLE approval_steps (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES approval_workflows(id),
  step_order INT NOT NULL,
  approver_role TEXT NOT NULL,
  approver_id TEXT,
  action TEXT NOT NULL,          -- 'approved' | 'rejected'
  comment TEXT,
  signed_at TIMESTAMPTZ,
  e_sign_data JSONB,             -- { signerId, timestamp, hash, certInfo }
  created_at TIMESTAMPTZ NOT NULL
);
```

**e-Sign 연동**
- **Option A (간편)**: 내장 "간편 전자서명" — 이름 + 확인 버튼 → 해시 생성 후 DB 저장
- **Option B (공인)**: KG이니시스, 쎄트렉아이 등 전자서명 API 연동
- 공통: `e_sign_data`에 `{ signerId, timestamp, hash }` 저장

**프론트엔드**
- 승인 모달: "승인" 클릭 시 → e-Sign 입력 화면 (이름, 비밀번호 또는 API 호출)
- 서명 완료 → approval_steps INSERT → workflow status 갱신
- Unlock 승인 완료 시 → period_locks 해당 행 삭제 또는 status='unlocked'

---

### 3.3 배출량별 감사 추적

#### 3.3.1 활동자료(Activity Data)

**목표**
- Scope 1/2/3 활동자료(사용량)를 **레코드 단위로 조회**
- 각 레코드 ↔ 증빙 파일 링크 표시
- 데이터 품질(실측/추정) 필터

**구현**
- 기존 Scope1/2/3 테이블을 "감사 추적 뷰"로 래핑
- 컬럼: 연도, 월, 사업장, 에너지원, 사용량, 단위, 배출량, 데이터 품질, 증빙 연결
- 클릭 시 상세 패널 + 증빙 파일 목록

#### 3.3.2 배출계수(Emission Factor)

**목표**
- 적용된 배출계수 목록 (연료별, 버전별)
- valid_from / valid_to 기간 표시
- GWP, NCV 적용 기준

**구현**
- 배출계수 마스터 API 또는 프론트 상수 테이블
- "산정에 사용된 계수" 필터 (연도·에너지원 기준)

#### 3.3.3 산정결과(Calculated Emissions)

**목표**
- Scope별 배출량 집계 + 카테고리별 상세
- 산식 적용 내역 (사용량 × NCV × EF 등)
- Lineage 링크 (어떤 활동자료 → 어떤 계수 → 산정결과)

**구현**
- Step4Results 스타일 테이블 + "계산 과정" 펼치기
- 각 행에 `source_row_ids`, `factor_id` 등 lineage 필드 표시

---

### 3.4 변경 이력(Audit Trail)

**요구사항**
- CREATE / UPDATE / DELETE / RESTORE 전부 기록
- 필드 단위 변경 이력 (변경 전/후)
- 변경자, 변경 시각(UTC), 변경 사유 필수

**데이터 모델**

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL,     -- 'scope1_row' | 'scope2_row' | 'boundary_policy' | ...
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,          -- 'create' | 'update' | 'delete' | 'restore'
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL,
  change_reason TEXT,
  old_value JSONB,
  new_value JSONB,
  company_id UUID
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_changed_at ON audit_logs(changed_at DESC);
```

**프론트엔드**
- Audit Trail Viewer: 타임라인 UI
- 필터: 엔티티 유형, 기간, 변경자
- 행 클릭 → diff 뷰 (old_value vs new_value 색상 구분)
- 증빙 파일 링크 (해당 시점 첨부)

**백엔드 연동**
- 현재 프론트는 store만 사용 → **백엔드 CRUD API** 필요
- 또는 프론트에서 변경 시 `audit_log` API 호출 (optimistic update 후 로그 저장)

---

### 3.5 증빙자료(Evidence & Integrity)

#### 3.5.1 저장 구조

- 파일: Object Storage(S3 등) 또는 로컬 업로드
- DB: 파일 URL, **SHA-256 해시**, 업로드 메타데이터

```sql
CREATE TABLE evidence_files (
  id UUID PRIMARY KEY,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  sha256_hash TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL,
  uploaded_by TEXT,
  related_entity_type TEXT,
  related_entity_id TEXT,
  company_id UUID
);
```

#### 3.5.2 Hash Verification UI

**요구사항**
- 증빙 파일 옆 "Integrity Check" 버튼
- 현재 파일 해시 vs 업로드 당시 해시 비교
- ✅ Verified / ❌ Mismatch 표시

**프론트엔드**
- 파일 선택 → Web Crypto API 또는 백엔드로 SHA-256 계산
- DB의 sha256_hash와 비교 → 결과 표시
- "재검증" 버튼으로 수시 확인 가능

---

### 3.6 산정 방법론 및 로직 계보(Lineage)

#### 3.6.1 배출계수 버전 관리 (Factor Versioning)

- 배출계수 테이블: version, valid_from, valid_to
- 신규 고시 계수 → 신규 데이터부터 적용
- 과거 데이터 → 기존 계수 유지

**구현**
- 배출계수 상수/DB에 version, valid_from, valid_to 추가
- 산정 시 "해당 연도·월에 유효한 계수" 선택 로직

#### 3.6.2 방법론 변경 이력 (Logic Change Log)

**데이터 모델**

```sql
CREATE TABLE methodology_changes (
  id UUID PRIMARY KEY,
  changed_at DATE NOT NULL,
  target_scope TEXT,             -- 'A사업장 폐기물' 등
  change_description TEXT NOT NULL,  -- '소각 → 매립'
  reason TEXT NOT NULL,
  approved_by TEXT,
  company_id UUID
);
```

**프론트엔드**
- "방법론 변경 등록" 폼
- 타임라인 목록 조회
- 승인 워크플로우 연동 (선택)

---

### 3.7 감사인 전용 뷰(Auditor View)

#### 3.7.1 Auditor Account

- Read-only 권한
- 감사 전용 UI (실무자 화면과 분리)
- RBAC: role='auditor' → 감사인 뷰만 노출

#### 3.7.2 Sampling Export

**요구사항**
- 감사인이 조건 지정: 상위 10% 배출 항목, 특정 Scope/사업장
- 선택 항목에 대해 입력값 + 증빙 + 변경 이력 → 단일 Audit Package(ZIP) 생성

**구현**
- 조건 폼: Scope, 사업장, 상위 N% 또는 상위 N건
- API: 조건 → 필터링된 payload 생성 → ZIP (Excel + PDF + Evidence 파일들)
- 다운로드 링크 반환

#### 3.7.3 Comment & Response

**데이터 모델**

```sql
CREATE TABLE audit_comments (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  commenter_id TEXT NOT NULL,
  commenter_role TEXT,           -- 'auditor' | 'practitioner'
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  parent_id UUID REFERENCES audit_comments(id),
  status TEXT DEFAULT 'open'     -- 'open' | 'resolved'
);
```

**프론트엔드**
- 레코드/영역별 "코멘트" 버튼
- 코멘트 쓰기/읽기 모달
- 실무자: 답변 작성, 추가 증빙 업로드
- 스레드 형태 표시

---

### 3.8 감사 대응 패키지(Export)

**구성 (AUDIT_TRAIL_PLANNING §10.1)**
- Emission Summary
- Activity Data
- Methodology & Lineage
- Audit Trail
- Evidence Files (ZIP)

**구현**
- 기존 `buildEvidencePayload` + Excel/PDF 생성 확장
- Audit Trail 시트/섹션 추가
- Evidence 파일들 ZIP 포함
- "조건 지정" 시 Sampling Export와 동일 로직

---

## 4. 구현 단계별 로드맵 (Phase)

### Phase 1: 기반 구축 (8~10주)

| 순서 | 작업 | 산출물 | 의존 |
|------|------|--------|------|
| 1.1 | **백엔드**: audit_logs, period_locks, snapshots 테이블 + API | API 스펙, 마이그레이션 | - |
| 1.2 | **프론트**: IA 네비게이션 구조 적용, 8개 서브 메뉴 라우팅 | IFRSAuditView 리팩토링 | - |
| 1.3 | **Period Lock** UI: 마감 버튼, Lock 상태 표시, Read-only 적용 | DataLockManager 컴포넌트 | 1.1 |
| 1.4 | **Snapshot** 저장/목록: 저장 버튼, 목록 조회, diff 미리보기(선택) | Snapshot API 연동 | 1.1 |
| 1.5 | **Audit Log** 연동: 데이터 변경 시 로그 API 호출 | AuditTrailViewer 기본 목록 | 1.1 |
| 1.6 | **내부통제 대시보드** 실데이터 반영 (증빙 구비율, Snapshot 건수) | AuditDashboard | 1.3, 1.4 |

### Phase 2: 승인·무결성 (6~8주)

| 순서 | 작업 | 산출물 | 의존 |
|------|------|--------|------|
| 2.1 | **Unlock Workflow**: unlock_requests, 승인 요청/승인 API | Unlock 승인 플로우 | Phase 1 |
| 2.2 | **Approval Workflow**: approval_workflows, approval_steps 테이블 + API | 승인 엔진 | - |
| 2.3 | **e-Sign (간편)**: 이름+확인 → 해시 생성 저장 | e-Sign 모달, approval_steps.e_sign_data | 2.2 |
| 2.4 | **evidence_files** SHA-256 저장, Hash Verification API | Hash Verification UI | - |
| 2.5 | **증빙자료** 화면: 파일 목록 + Integrity Check 버튼 | EvidenceIntegrityView | 2.4 |
| 2.6 | **결재 완료율** 대시보드 반영 | AuditDashboard | 2.2 |

### Phase 3: 고도화 (6~8주)

| 순서 | 작업 | 산출물 | 의존 |
|------|------|--------|------|
| 3.1 | **Factor Versioning**: 배출계수 version, valid_from/to | 산정 로직 수정 | - |
| 3.2 | **방법론 변경 이력**: methodology_changes 테이블 + UI | LineageViewer | - |
| 3.3 | **Auditor View**: Read-only 라우트, RBAC | AuditorView | Phase 1 |
| 3.4 | **Sampling Export**: 조건 지정 → Audit Package ZIP | AuditPackageExport | 3.3 |
| 3.5 | **Comment & Response**: audit_comments 테이블 + UI | 코멘트 모달 | - |
| 3.6 | **주요 변경 요약** (Snapshot diff) 대시보드 | AuditDashboard | 1.4 |

### Phase 4: e-Sign 고도화 (선택, 4주)

| 순서 | 작업 | 산출물 |
|------|------|--------|
| 4.1 | 공인 전자서명 API 연동 (KG이니시스 등) | e_sign_data 확장 |
| 4.2 | 서명 인증서 검증, 감사 로그 보강 | - |

---

## 5. API 스펙 요약

| API | Method | 용도 |
|-----|--------|------|
| `GET /api/audit/period-locks` | GET | Lock 목록 조회 |
| `POST /api/audit/period-locks` | POST | Lock 생성 |
| `POST /api/audit/unlock-requests` | POST | Unlock 승인 요청 |
| `GET /api/audit/unlock-requests` | GET | 승인 대기 목록 |
| `POST /api/audit/unlock-requests/:id/approve` | POST | 승인 (e-Sign 포함) |
| `GET /api/audit/snapshots` | GET | 스냅샷 목록 |
| `POST /api/audit/snapshots` | POST | 스냅샷 저장 |
| `GET /api/audit/snapshots/:id` | GET | 스냅샷 상세 |
| `GET /api/audit/logs` | GET | Audit Trail 목록 (필터) |
| `POST /api/audit/logs` | POST | Audit Log 기록 |
| `GET /api/audit/evidence/:id/verify` | GET | Hash 검증 |
| `POST /api/audit/approval-workflows` | POST | 승인 요청 생성 |
| `POST /api/audit/approval-workflows/:id/step` | POST | 승인 단계 진행 |
| `GET /api/audit/comments` | GET | 코멘트 목록 |
| `POST /api/audit/comments` | POST | 코멘트 작성 |
| `POST /api/audit/export-package` | POST | Audit Package ZIP 생성 |

---

## 6. 프론트엔드 컴포넌트 구조

```
src/features/ghg-calculation/
├── components/
│   ├── IFRSAuditView.tsx           # 진입점, 좌측 네비 + 메인 영역
│   ├── audit/
│   │   ├── AuditNav.tsx            # 좌측 네비게이션 (8개 메뉴)
│   │   ├── AuditDashboard.tsx      # 내부통제 대시보드
│   │   ├── DataLockManager.tsx     # 데이터 마감/확정
│   │   ├── EmissionTrailViewer.tsx # 배출량별 감사 추적 (3개 서브)
│   │   ├── AuditTrailViewer.tsx    # 변경 이력
│   │   ├── EvidenceIntegrityView.tsx # 증빙자료 + Hash Verification
│   │   ├── LineageViewer.tsx       # 산정 방법론·계보
│   │   ├── AuditorView.tsx         # 감사인 전용 뷰
│   │   ├── AuditPackageExport.tsx  # 감사 대응 패키지
│   │   ├── UnlockApprovalModal.tsx # Unlock 승인 요청/승인
│   │   ├── ESignModal.tsx          # 전자서명 입력
│   │   └── AuditCommentThread.tsx  # 코멘트 스레드
│   └── ...
├── hooks/
│   ├── usePeriodLocks.ts
│   ├── useSnapshots.ts
│   ├── useAuditLogs.ts
│   └── useApprovalWorkflow.ts
├── api/
│   └── audit.ts                    # audit API 클라이언트
└── ...
```

---

## 7. 요약

| 구분 | 내용 |
|------|------|
| **현재** | 화면(대시보드+테이블)만 존재, 실제 기능 없음 |
| **필요** | IA 8개 메뉴 + Period Lock, Unlock, Snapshot, Approval, e-Sign, Audit Trail, Hash Verification, Lineage, Auditor View, Export |
| **백엔드** | audit_logs, period_locks, snapshots, unlock_requests, approval_workflows, approval_steps, evidence_files, methodology_changes, audit_comments 테이블 및 API |
| **예상 기간** | Phase 1 (8~10주) + Phase 2 (6~8주) + Phase 3 (6~8주) = **20~26주** |
| **우선순위** | Phase 1에서 Lock, Snapshot, Audit Log를 먼저 구현하면 "데이터 고정" 요건 충족. Phase 2에서 e-Sign까지 완료 시 내부통제 수준 확보. |

본 문서를 기준으로 백엔드 스펙 확정 후 Phase 1부터 순차 구현하면 된다.
