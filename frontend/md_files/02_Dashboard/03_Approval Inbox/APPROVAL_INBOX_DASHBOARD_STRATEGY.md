# 대시보드(신규) 결재함 — 공문 기반 구현 전략 (계열사/지주사)

작성일: 2026-03-26  
대상: `src/app/(main)/dashboard` 내 `approval` 탭, 좌측 사이드바의 `결재함` 메뉴군  
목표: “Audit Trail 결재함 목록” UX를 유지하면서, **SR보고서/ GHG/ 감사(Audit) 결재 문서**를 한 곳에서 보고, 클릭 시 **공문(기안) 형태 상세**가 열리며, 필요 시 **결재라인 설정 → 상신**까지 가능한 구조

---

## 0. 핵심 요구사항 정리

- 관점 분리: **계열사 vs 지주사** 결재함은 보는 범위/권한이 다름
- 주된 기능:
  - (1) **목록 UI**는 Audit Trail 결재함에서 가져온 패턴을 최대한 유지
  - (2) 클릭 시 “아무 동작 없음”이 아니라 **문서 상세(공문 본문) 표시**
  - (3) **SR보고서에서 상신한 승인 요청 문서도 결재함에서 조회**
  - (4) **필터**: SR만 / GHG만 / (선택) Audit만
  - (5) 지주사는 **데이터센터, 국내사업장, 해외법인, 자회사**에서 올라온 요청도 다 볼 수 있어야 함
- 기안(공문) 형식: 제공 이미지 기반
  - 이미지1: “결재기안” 화면(문서번호/기안일시/부서/직급/기안자/보존연한/수신·참조/제목/첨부/기안의견 + 본문 편집기)
  - 이미지2: “결재라인 설정” 팝업(부서 트리 + 구성원 검색 + 결재/합의/협조/수신/참조 영역에 인원 배치)

---

## 1. 기존 자산(재사용)과 차이점

### 1-1. Audit Trail 결재함(기존) 재사용 포인트

현재 코드베이스에는 GHG Audit 모듈의 결재함 UI가 존재한다.

- `src/app/(main)/ghg_calc/components/audit/ApprovalInboxView.tsx`
  - 좌측: 탭(미결/기결/기안/수신) + 검색 + 목록
  - 우측: 선택 문서 상세(본문 + 결재선 + 승인/반려)
  - 데이터: `approvalMap: Record<eventId, ApprovalStep[]>` 기반의 mock/state 머신

이 UI 패턴을 “대시보드(신규) 결재함”에도 **목록/검색/선택/상세** UX로 가져온다.

### 1-2. 대시보드 결재함의 추가 요구

Audit 결재함은 “GHG 감사 이벤트” 중심이지만, 대시보드 결재함은 도메인을 확장해야 한다.

- SR보고서 상신 문서(“DP 제출 승인 요청”, “반려 재상신” 등)
- GHG 결재(기존 audit approval)
- (선택) 플랫폼 운영성 공문(공지/공문서 등)도 확장 가능

따라서 **목록/상세의 공통 스키마**(문서 메타 + 결재선 + 본문 + 첨부)로 통합이 필요하다.

---

## 2. IA(정보구조) — 계열사/지주사 공통 뼈대

### 2-1. 좌측: 결재함 메뉴(그룹) 유지

대시보드(신규)에서 이미 사용 중인 구조를 유지한다.

- 결재 수신함
  - 결재요청
  - 결재내역
  - 수신참조
- 결재 상신함
  - 결재 진행함
  - 결재 완료함
  - 반려함
  - 임시저장

### 2-2. 상단: 도메인 필터(탭/칩)

현재 `DashboardNewContent.tsx`의 approval 탭에는 도메인 필터(전체/GHG/SR)가 이미 있다.

- `전체` / `SR` / `GHG` (+ 옵션: `Audit`)
- 기본값:
  - 계열사: `전체`
  - 지주사: `전체` (단, 기본 정렬은 “SR 상신/검토”를 상단에)

### 2-3. 본문: 2패널(목록 + 상세) 고정

```
┌─────────────────────────┬───────────────────────────────────────────────┐
│ (좌) 문서 목록            │ (우) 공문 상세(기안서)                        │
│ - 검색/정렬/필터         │ - 문서 메타 + 결재선 요약                      │
│ - 상태 칩/진행도         │ - 제목/첨부/기안의견 + 본문(편집/읽기)          │
│ - 선택 강조(블루 앵커)    │ - 결재라인 설정(필요시) + 상신/승인/반려 액션   │
└─────────────────────────┴───────────────────────────────────────────────┘
```

> Audit UI의 “좌측 목록 + 우측 상세”를 그대로 적용하되, 상세는 “공문 양식”으로 바꾼다.

---

## 3. 관점(권한) 설계 — 계열사 vs 지주사

### 3-1. 계열사(실무자)

- 본인/본 부서 관련 문서 중심
- SR: 본인이 작성/제출/상신한 DP 문서, 본인에게 결재요청 온 문서
- GHG: 본인 차례 결재(감사 이벤트) 및 수신참조
- 엔티티 범위: “자기 회사(계열사 1개)” 기본

### 3-2. 지주사(검토/승인자)

- 범위 확장: 여러 조직/법인/단위에서 들어오는 요청을 조회/처리
- SR: 데이터센터/국내사업장/해외법인/자회사 요청을 모두 볼 수 있어야 함
- GHG: audit 결재 이벤트도 동일 범위로 조회(필터로 분리)

지주사 뷰에는 추가 필터를 둔다.

- 엔티티 필터: `전체` / `데이터센터` / `국내사업장` / `해외법인` / `자회사`
- (선택) 회사/법인 검색

---

## 4. 통합 문서 모델(프론트 DTO) 제안

### 4-1. 최소 통합 스키마

대시보드 결재함에서 “표 형태 목록”과 “공문 상세”를 모두 만족하려면 아래 정도의 공통 필드가 필요하다.

```ts
type ApprovalDomain = 'sr' | 'ghg' | 'audit';
type ApprovalBox = 'inbox' | 'outbox';
type ApprovalMenuKey =
  | 'inbox.request'
  | 'inbox.history'
  | 'inbox.cc'
  | 'outbox.progress'
  | 'outbox.completed'
  | 'outbox.rejected'
  | 'outbox.draft';

type ApprovalDocStatus = 'draft' | 'pending' | 'inProgress' | 'approved' | 'rejected' | 'received';

type ApprovalLineRole = '기안' | '검토' | '승인' | '합의' | '협조' | '수신' | '참조';

type ApprovalPerson = { id: string; name: string; dept: string; title?: string };

type ApprovalLine = {
  role: ApprovalLineRole;
  people: ApprovalPerson[];
};

type EntityType = 'datacenter' | 'domestic_site' | 'overseas_legal' | 'subsidiary';

/**
 * 문서(공시 단위)와 분리해서 관리하는 “발행 시점 스냅샷”
 * - 목적: 법인/조직 마스터가 바뀌더라도, 당시 기안/상신 시점의 entityType/name을 보존
 */
type ApprovalDocEntitySnapshot = {
  id: string;

  entityType: EntityType; // 법인/조직 마스터의 타입 필드 값
  entityName: string; // 당시 이름(표시용)
  entityCode?: string; // 마스터에 있던 코드(있으면)

  snapshotAt: string; // 스냅샷 생성 시각(기안하기/상신 시)

  /** (선택) 문서 상세에 같이 보여주기 위한 보조 필드 */
  companyName?: string;

  /** (선택) 당시 마스터 행 ID — 감사·재처리 시 조인/추적용(목록 필터에는 사용하지 않음) */
  masterEntityId?: string;
};

type ApprovalDocUnified = {
  id: string;                 // 문서번호(표시용)
  domain: ApprovalDomain;     // SR/GHG/Audit
  menuKey: ApprovalMenuKey;   // 좌측 메뉴 상태
  status: ApprovalDocStatus;  // 상태 칩

  /**
   * 지주사 필터/목록 정렬에는 “스냅샷”의 entityType을 사용
   * - entityType/name은 발행 시점의 값으로 고정
   */
  entitySnapshot: ApprovalDocEntitySnapshot;

  draftedAt: string;         // 기안일시
  drafter: ApprovalPerson;   // 기안자
  dept: string;              // 기안부서
  retention: string;         // 보존연한

  title: string;             // 문서제목
  bodyHtml: string;          // 공문 본문(에디터 저장 결과)
  opinion: string;           // 기안의견
  attachments: Array<{ name: string; size?: string; url?: string }>;

  approvalLines: ApprovalLine[];  // 결재/합의/협조/수신/참조

  // 도메인별 연결(딥링크/추적)
  links?: {
    srDpId?: string;         // sr-report dpId
    srDpCode?: string;       // dashboard dpCode
    ghgAuditEventId?: string;
    /** B 정책: 재상신 시 이전 문서 id(표시용 문서번호와 별개의 내부 id 권장) */
    previousDocId?: string;
  };

  updatedAt: string;         // 목록 정렬 기준
};
```

### 4-2. 데이터 소스(초기)

1) 기존 `APPROVAL_DOCS_MOCK`(`dashboardNewMock.ts`)를 통합 DTO 형태로 확장  
2) GHG Audit 결재함의 `ApprovalInboxView`에서 쓰는 이벤트(`AuditEventDTO`)는 `ApprovalDocUnified`로 “보기용” 변환 레이어를 둔다  
3) SR보고서 상신 문서:
- 현재 SR 쪽은 `sr-report/lib/mockSrReport.ts`의 `APPROVALS_INIT`가 가장 가까운 형태
- 이를 “대시보드 결재함 문서 목록”에 합치기 위해 `ApprovalDocUnified`로 매핑

> 초기에는 프론트 mock/매핑으로 시작하고, 추후 API 설계 시 위 DTO를 백엔드 응답으로 이동.

---

## 5. UX — 목록(좌) 세부 규칙

### 5-1. 목록 행 정보(가독성 우선)

Audit 결재함 스타일을 따라가되, SR/GHG 모두 다음을 보여준다.

- 좌측 상단: 도메인 배지(`SR`/`GHG`) + 문서번호
- 제목 2줄(ellipsis)
- 메타 1줄: `기안자 · 출처(회사/엔티티) · 날짜` — **§5-5**의 “목록 표시 문자열” 규칙 적용
- 우측: 결재선 요약(Compact) + 상태 칩

### 5-2. 정렬 기본값

- `updatedAt` 내림차순
- 단, “내 차례(결재 필요)”는 항상 상단 pin 옵션 제공

### 5-3. 필터(계열사/지주사 공통)

- 도메인 필터: 전체 / SR / GHG
- 메뉴 필터: 좌측 결재함 메뉴 선택으로 이미 결정됨
- 텍스트 검색: **§5-5** “통합 검색 대상 필드” 참고

### 5-4. 지주사 전용 필터

- 엔티티 타입: 데이터센터/국내사업장/해외법인/자회사/전체 — **반드시 `entitySnapshot.entityType` 기준**(§5-5)
- (선택) 회사/조직명 검색은 통합 검색(`q`) 또는 별도 `company` 파라미터로 처리(§5-5)

### 5-5. 필터·검색·목록 표시 — 필드 역할(스냅샷 기준, 구체 규칙)

**원칙**: 지주사/계열사 모두, “당시 기준”이 필요한 판단(필터·감사·리포트)은 **항상 `entitySnapshot`에 저장된 값**을 사용한다. **현행 마스터만 조인해서 필터링하지 않는다**(마스터 변경 시 과거 문서가 잘못된 버킷으로 이동하는 문제 방지).

#### (1) 스냅샷 필드별 역할

| 필드 | 용도 | 목록/필터에서 사용 |
|------|------|-------------------|
| `entitySnapshot.entityType` | 지주사 4분류(데이터센터 등) **정본** | 지주사 칩/드롭다운 필터의 **유일한 equality 조건** |
| `entitySnapshot.entityName` | 조직·사업장·DC 등 **사용자에게 익숙한 표시명** | 목록 2차 줄, 통합 검색, (선택) 자동완성 라벨 |
| `entitySnapshot.companyName` | **법인명(등기/대외 명칭)** | 목록 1차 줄 우선 표시, 통합 검색, 엑셀보내기 |
| `entitySnapshot.entityCode` | 마스터의 **안정적 비즈니스 코드**(있을 때만) | 통합 검색, 관리자용 정확 일치 필터, URL `entityCode=` (선택) |
| `entitySnapshot.masterEntityId` | 당시 마스터 PK | **목록 필터에 쓰지 않음**. 감사 추적·재처리·지원툴 조인 전용 |
| `entitySnapshot.snapshotAt` | 스냅샷 생성 시각 | 상세 패널/감사 로그 표시, (선택) 2차 정렬 |

**표시명 의미 구분(권장)**  
- `companyName`: “삼성에스디에스(주)”처럼 **법인 단위**  
- `entityName`: “판교 DC”, “국내사업장 A”, “EU 법인 운영본부”처럼 **필터 타입 아래의 구체 단위**  
- 둘 중 하나만 있는 경우: 있는 쪽을 목록 주 표시에 사용(§5-5 (3)).

#### (2) 지주사 엔티티 타입 필터(칩) — 쿼리 규칙

- UI 값 → `EntityType` 매핑 예:
  - `데이터센터` → `datacenter`
  - `국내사업장` → `domestic_site`
  - `해외법인` → `overseas_legal`
  - `자회사` → `subsidiary`
  - `전체` → 조건 없음
- **백엔드/목 mock 필터 조건**: `WHERE entity_snapshot.entity_type = :entityType` (문서 본문 테이블이 아닌 **스냅샷 테이블 또는 JSON 스냅샷 컬럼** 기준)
- **금지**: `JOIN master_entity SET type = … WHERE master.current_type = …` 만으로 목록을 거르기(과거 문서 오분류)

#### (3) 목록 행 — “출처(회사/엔티티)” 한 줄 만들기

권장 포맷(우선순위):

1. `companyName`이 있으면: `{companyName}` + ( `entityName` 있으면 ` · {entityName}` )
2. `companyName` 없으면: `{entityName}`
3. 둘 다 비어 있으면(비정상 데이터): `{entityCode ?? '출처 미지정'}`

부가: 지주사 뷰에서는 `entityType`을 **작은 칩**으로 같이 표시(예: `[데이터센터]`).

#### (4) 통합 검색(`q`) — 대상 필드(OR 매칭, 대소문자 무시 권장)

클라이언트/서버 공통으로 아래를 검색 대상에 포함한다.

- `id`(문서번호 표시 문자열)
- `title`
- `drafter.name`, `drafter.dept`(선택)
- `entitySnapshot.companyName`, `entitySnapshot.entityName`, `entitySnapshot.entityCode`(있을 때)
- SR: `links.srDpId`, `links.srDpCode`
- GHG: `links.ghgAuditEventId`(있을 때)

**검색에서 제외(기본)**: `bodyHtml` 전문(성능 이슈). 본문 검색이 필요하면 별도 “본문 검색” 토글 또는 서버 전문 검색 인덱스 도입 후 §5-5 보완.

#### (5) 정렬

- 1순위: `updatedAt` 내림차순(기존 §5-2 유지)
- 2순위(동률 시): `draftedAt` 내림차순
- (선택) 지주사 “엔티티 타입 필터 적용 중”일 때 3순위: `entitySnapshot.entityName` 오름차순

#### (6) URL 딥링크(대시보드 결재함) — 권장 쿼리 키

기존 `version`, `mode`, `tab`에 더해 결재함 전용으로 예시:

- `domain`: `sr` | `ghg` | `all`
- `menu`: `inbox.request` 등 `ApprovalMenuKey`
- `entityType`: `datacenter` 등 — **스냅샷 기준 필터**
- `docId`: 선택 문서(내부 id 권장; 표시용 문서번호와 분리 가능하면 `docNo`와 별도)
- `srDpId` / `srDpCode`: SR 딥링크
- `q`: 통합 검색어

예: `/dashboard?version=new&mode=holding&tab=approval&domain=sr&menu=inbox.request&entityType=datacenter`

#### (7) API(예시) — 쿼리 파라미터와 DB 매핑

`GET /api/approvals` (예시):

| 파라미터 | 의미 | 매핑 |
|----------|------|------|
| `domain` | SR/GHG | 문서 `domain` |
| `menu` | 수신함/상신함 세부 | 문서 `menuKey` 또는 서버에서 파생 |
| `entityType` | 지주사 4분류 | **`entity_snapshot.entity_type`** |
| `q` | 통합 검색 | §5-5 (4) 필드들에 대한 OR `ILIKE`/전문검색 |
| `company` | (선택) 법인명만 좁히기 | `entity_snapshot.company_name` |
| `entityCode` | (선택) 정확 일치 | `entity_snapshot.entity_code` |
| `srDpId` / `srDpCode` | SR DP 딥링크 | `links` JSON 또는 컬럼 |

응답에는 **목록용 경량 DTO**와 **상세용 전체 DTO**를 분리하는 것을 권장한다(목록에 `bodyHtml` 미포함).

---

## 6. UX — 공문 상세(우) “결재기안” 형식 (이미지1 기반)

### 6-1. 레이아웃(상단 메타 + 본문)

1) 상단 버튼 바(우측 정렬)
- `결재라인설정` (필수)
- `기안하기` (상신)
- `임시보관`
- `닫기`

2) 문서 메타 그리드(좌측 표 형태)
- 문서번호(자동채번)
- 기안일시
- 기안부서
- 기안직급
- 기안자
- 보존연한(드롭다운)
- 합의/수신/참조(표 형태 또는 요약)

3) 기록물철/참조문서(선택)
- 지금 단계에서는 mock로 빈 영역 유지 가능

4) 문서제목(단일 input)

5) 첨부(드롭존 + 리스트)

6) 기안의견(단일 라인 또는 textarea)

7) 본문 에디터(리치 텍스트)
- 초기에는 “템플릿”으로 시작(예: `SR 데이터 제출 승인 요청`, `GHG 이상치 조치 보고` 등)
- SR DP 연결 문서는 본문 상단에 “관련 DP/기준” 요약 블록 삽입

### 6-2. 상태별 편집 권한

| 상태 | 문서 편집 | 결재라인 변경 | 상신/승인/반려 버튼 |
|------|-----------|---------------|----------------------|
| 임시저장(draft) | 가능 | 가능 | 기안하기 활성 |
| 진행중(inProgress) | 제한(원칙: 불가) | 불가 | 읽기 전용 |
| 결재요청/내 차례(my turn) | 본문 편집 불가 | 불가 | 승인/반려 활성 |
| 승인완료(approved) | 불가 | 불가 | 없음 |
| 반려(rejected) | 가능(재기안용) | 가능 | 기안하기 활성 |

> “SR보고서 제출완료는 수정 가능” 정책은 SR보고서 작성 화면의 상태이며, 결재 문서가 이미 생성된 뒤에는 결재함에서는 **문서 수정이 아니라 재기안**으로 처리하는 편이 자연스럽다.

---

## 7. 결재라인 설정(이미지2 기반)

### 7-1. 팝업 구성

좌측 패널:
- 결재라인(프리셋) 드롭다운
- 부서코드/부서명 트리(“마이오피스/대표이사/사업기획팀…”)
- 사용자 검색 + 결과 리스트(이름/직급)

우측 패널(배치 영역):
- 결재(기안 포함): 기안 1 + 결재 n
- 합의(선택)
- 수신(선택)
- 참조(선택)

### 7-2. 인터랙션

- 사용자 목록에서 “결재/협조/합의/수신/참조” 액션으로 우측 박스에 추가
- 우측에서 순서 변경(위로/아래로)
- 삭제
- 반영/닫기

### 7-3. 기본 결재선(권장)

SR 계열사 → 지주사:
- 기안(계열사 담당자)
- 검토(계열사 ESG팀/관리)
- 승인(지주사 ESG팀)

GHG audit:
- 기안(요청 부서)
- 검토(검증 담당)
- 승인(관리자/지주사)

---

## 8. 딥링크/연계

### 8-1. SR보고서 → 결재함 문서 생성/이동

SR보고서 화면에서 `submitted` 상태에 “결재 상신” 버튼이 존재한다.  
이 버튼은 “대시보드 신규/계열사 결재함”으로 이동하고, 해당 DP 문서를 선택 상태로 만드는 것이 목표.

권장 URL:
- `/dashboard?version=new&mode=subsidiary&tab=approval&domain=sr&menu=inbox.request&docId=<...>`  
또는
- `/dashboard?version=new&mode=subsidiary&tab=approval&srDpId=d3`

> 현재 코드에는 `dashboard/page.tsx`에서 `version/mode` 쿼리 기반 초기 선택 로직이 추가되어 있으므로, 결재함 딥링크도 같은 방식으로 확장 가능하다.

### 8-2. 결재함 → 원문(작성 화면) 이동

문서 상세에 “원문 보기” 링크를 둔다.

- SR: `/sr-report?dpId=...`
- GHG: `/ghg_calc`의 특정 탭/이벤트로 이동(추후)

---

## 9. 구현 단계(권장 Phase)

### Phase 1 — “클릭하면 공문 상세가 나온다”

- 대시보드 `approval` 탭에서 목록 row 클릭 시 우측에 공문 상세 렌더
- SR/GHG 도메인 필터 유지
- 공문 상세는 우선 읽기 전용 템플릿으로 시작

### Phase 2 — “기안/임시보관/반려 재기안”

- draft 문서 생성(임시보관)
- 반려 문서 → 수정 후 재기안(새 문서번호 or 버전) 정책 결정

### Phase 3 — “결재라인 설정”

- 이미지2 기반 결재라인 설정 팝업 구현
- 프리셋 결재선 + 사용자 검색/추가/순서

### Phase 4 — “결재 액션(승인/반려) + Audit Trail 연계”

- GHG Audit 결재(기존 `ApprovalInboxView`의 state 머신)를 대시보드 결재함 통합 UI에 연결
- SR 결재도 동일한 액션 모델로 통일

---

## 10. 오픈 이슈(결정 필요)

- 문서번호 정책: `ESG-YYYY-XXX`를 전사 공통으로 할지, 도메인별 prefix(SR/GHG)로 나눌지
- 반려 재기안 정책:
  - (A) 동일 문서 수정 후 재상신(버전 증가)
  - (B) 새 문서로 재상신(링크로 이전 문서 참조)
- SR 상신 단위:
  - 이 범위에서는 **DP별 상신만** 채택
- 지주사 엔티티 분류 체계 + 스냅샷 보존:
  - 법인/조직 마스터에 `entityType` 부여하고,
  - 문서와 분리된 `ApprovalDocEntitySnapshot`에 당시 `entityType/name`을 스냅샷으로 저장

---

## 11. 결정사항(권장 기본안)

아래는 이번 구현 범위에 적용하는 “권장 기본안”이다.

1. 반려 재기안: **B = 새 문서로 재상신**
   - 기존 문서는 `반려됨`으로 유지
   - 새 문서번호 발급(또는 발행 시퀀스 재생성)
   - 공문 상세에는 `이전 문서 참조(links.previousDocId)`를 표시

2. SR 상신 단위: **DP별 상신만**
   - 목록/상세/필터가 `srDpId`(또는 `srDpCode`)에 의해 자연스럽게 동작
   - `links.srPackageId`는 추후 확장 포인트로만 남긴다

3. 엔티티 분류: **법인/조직 마스터의 타입 + 문서 스냅샷**
   - 법인/조직 마스터(권장): `entityType`을 `datacenter/domestic_site/overseas_legal/subsidiary`처럼 부여
   - 결재 “문서(공시 단위)” 발행 시점에 `ApprovalDocEntitySnapshot`을 생성해서
     - 당시의 `entityType`
     - 당시의 `entityName`
     - (가능하면) `entityCode`
     를 스냅샷으로 고정
   - **목록·지주사 엔티티 필터·통합 검색·URL/API 쿼리**에서 어떤 필드를 쓸지는 **§5-5**에 구체 규칙으로 정의한다.

4. 문서(공시 단위) vs 스냅샷(발행시점) 분리 이유
   - 마스터 명칭/소속이 변경되어도, 과거 상신된 문서는 “그때 기준”으로 회계/감사 추적 가능

---

## 참고(관련 문서/코드)

- Audit 결재함 UI(기존): `src/app/(main)/ghg_calc/components/audit/ApprovalInboxView.tsx`
- Audit 결재함 전략 문서:
  - `md_files/08_new_UI_project/03_audit_trail/AUDIT_TRAIL_WITH_APPROVAL_STRATEGY.md`
  - `md_files/08_new_UI_project/03_audit_trail/AUDIT_TRAIL_APPROVAL_INBOX_UI.md`
  - `md_files/08_new_UI_project/03_audit_trail/APPROVAL_INBOX_FULL_DETAIL_STRATEGY.md`
- 대시보드 결재함(현 상태): `src/app/(main)/dashboard/components/DashboardNewContent.tsx`의 `renderApproval()`
- 대시보드 결재 mock: `src/app/(main)/dashboard/lib/dashboardNewMock.ts`의 `APPROVAL_DOCS_MOCK`

