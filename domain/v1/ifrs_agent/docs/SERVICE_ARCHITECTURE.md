# 서비스 아키텍처 설계

> **목적**: IFRSseed 플랫폼의 마이크로서비스 구조 및 각 서비스의 역할 정의  
> **기준**: 문서 분석 기반 (`JOURNEYMAP_TOTAL.md`, `TOTAL.md`, `DUMMY_DATA_PLANNING.md` 등)

---

## 1. 서비스 구조 개요

### 1.1 전체 서비스 목록 (10개)

```
1. Auth Service (인증/인가)
2. GHG Calculation Service (GHG 계산)
3. Data Integration Service (데이터 수집/파싱)
4. SR Report Service (SR 보고서)
5. ESG Data Service (ESG 데이터)
6. Disclosure Service (공시 데이터)
7. Audit Trail Service (감사 추적)
8. Dashboard Service (대시보드)
9. Report Generation Service (리포트 생성)
10. Common Service (공통)
```

### 1.2 서비스 분리 원칙

- **단일 책임 원칙**: 각 서비스는 하나의 명확한 비즈니스 도메인 담당
- **독립성**: 서비스 간 느슨한 결합, 독립적 배포 가능
- **확장성**: 트래픽이 많은 서비스만 독립적으로 스케일링
- **유지보수성**: 도메인별로 명확히 분리하여 유지보수 용이

---

## 2. 서비스별 상세 설계

### 2.1 Auth Service (인증/인가 서비스)

**역할**: 사용자 인증, 권한 관리, 세션 관리

**주요 기능**:
- 로그인/회원가입
- OAuth 연동 (카카오, 네이버, 구글)
- JWT 토큰 발급/검증
- 권한 관리 (지주사/계열사/팀장/팀원)
- 세션 관리
- 비밀번호 관리

**데이터 모델**:
- `users` 테이블
- `user_roles` 테이블
- `sessions` 테이블

**API 엔드포인트**:
```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/oauth/kakao
POST /api/auth/oauth/naver
POST /api/auth/oauth/google
POST /api/auth/logout
GET  /api/auth/me
```

**현재 상태**: `user-service`, `oauth-service`로 분리되어 있음

---

### 2.2 GHG Calculation Service (GHG 계산 서비스)

**역할**: 활동자료 관리, 배출량 산정, 산정 결과 저장

**주요 기능**:
- 활동자료 입력/관리 (6개 탭)
  - 전력·열·스팀
  - 연료·차량
  - 냉매
  - 폐기물
  - 물류·출장·통근
  - 원료·제품
- 배출계수 매핑
- Scope 1/2/3 배출량 산정
- 산정 결과 저장
- 산정 근거 관리 (`ghg_calculation_evidence`)
- 배출계수 스냅샷 보존

**데이터 모델**:
- `ghg_activity_data` 테이블
- `ghg_emission_results` 테이블
- `ghg_emission_factors` 테이블
- `ghg_calculation_evidence` 테이블
- `ghg_calculation_snapshots` 테이블

**API 엔드포인트**:
```
GET    /api/ghg/activity-data
POST   /api/ghg/activity-data
PUT    /api/ghg/activity-data/:id
DELETE /api/ghg/activity-data/:id
POST   /api/ghg/calculate
GET    /api/ghg/results
GET    /api/ghg/emission-factors
POST   /api/ghg/evidence
GET    /api/ghg/evidence/:activityId
```

**의존성**:
- Data Integration Service (활동자료 수집)
- Audit Trail Service (산정 이력 추적)

---

### 2.3 Data Integration Service (데이터 수집/파싱 서비스)

**역할**: 외부 시스템 연동, 파일 파싱, 데이터 검증

**주요 기능**:
- ERP/EMS/EHS/SRM/HR/PLM 시스템 연동
  - API 연동
  - 파일 기반 연동 (CSV, Excel)
  - 동기화 스케줄링
- 파일 파싱
  - PDF 파싱 (SR 보고서, 공시 문서)
  - Excel/CSV 파싱
  - 이미지 파싱 (차트, 그래프)
- 데이터 검증 및 정제
  - 데이터 형식 검증
  - 이상치 검출
  - 데이터 정규화
- 데이터 계보 추적
  - `source_system` 기록
  - `synced_at` 기록
  - 수동 조정 이력 추적

**데이터 모델**:
- `data_sync_logs` 테이블
- `parsed_files` 테이블
- `data_validation_results` 테이블

**API 엔드포인트**:
```
POST   /api/integration/sync/erp
POST   /api/integration/sync/ems
POST   /api/integration/sync/ehs
POST   /api/integration/parse/pdf
POST   /api/integration/parse/excel
POST   /api/integration/parse/csv
GET    /api/integration/sync-status
GET    /api/integration/validation-results
```

**의존성**:
- Common Service (기준정보 조회)

**현재 상태**: `crawler-service`가 있으나 데이터 파싱 기능 분리 필요

---

### 2.4 SR Report Service (SR 보고서 서비스)

**역할**: AI 기반 문단 생성, 보고서 편집, 버전 관리

**주요 기능**:
- AI 기반 문단 생성 (IFRS Agent)
  - 회사정보 기반 문단 생성
  - GHG 산정 결과 기반 문단 생성
  - 공시 기준 규칙 기반 문단 생성
- 문단 편집/버전 관리
  - 섹션별 콘텐츠 블록 편집
  - 버전 이력 관리
  - 이전 버전 비교
- 보고서 구조 설계
  - 목차 템플릿 관리
  - 공시 프레임워크별 섹션 자동 포함
- 협업 기능
  - 섹션 담당자 지정
  - 코멘트 달기
  - 변경요청 관리

**데이터 모델**:
- `sr_report_content` 테이블
- `sr_report_versions` 테이블
- `sr_report_comments` 테이블

**API 엔드포인트**:
```
POST   /api/sr/generate-paragraph
GET    /api/sr/content/:sectionId
PUT    /api/sr/content/:sectionId
GET    /api/sr/versions/:sectionId
POST   /api/sr/comments
GET    /api/sr/structure
```

**의존성**:
- IFRS Agent Service (AI 문단 생성)
- GHG Calculation Service (배출량 데이터)
- ESG Data Service (차트/도표 데이터)
- Common Service (회사정보)

**현재 상태**: `ifrs-agent-service` 존재

---

### 2.5 ESG Data Service (ESG 데이터 서비스)

**역할**: 차트/도표 생성, ESG KPI 데이터 관리

**주요 기능**:

#### 2.5.1 차트/도표 생성 및 저장
- 차트 생성
  - 막대 차트, 누적 막대 차트, 수평 막대 차트
  - 원형 차트, 도넛 차트
  - 선형 차트, 혼합형(막대+선), 영역 차트
- 차트 데이터 저장
  - `esg_charts` 테이블에 저장
  - `chart_type`, `chart_category` (Environmental/Social/Governance)
  - `chart_data` (JSONB), `chart_config` (JSONB)
  - `chart_image_url` (생성된 차트 이미지)
- 차트 갤러리
  - 저장된 차트 재사용
  - 썸네일 표시
  - 차트 삭제

#### 2.5.2 ESG DATA 테이블 관리
- 테이블 프리셋 관리
  - **Environmental**: 온실가스 배출량, 에너지/재생에너지, 용수/폐수, 폐기물/대기 등
  - **Social**: 임직원/교육, 안전/보건, 인권/협력업체 등
  - **Governance**: 이사회, 내부통제, 윤리/리스크 등
- 테이블 셀 값 입력/편집
- 테이블 저장 및 최종보고서 반영
- 테이블 다운로드 (CSV)

#### 2.5.3 ESG KPI 데이터 관리
- KPI별 목표·실적 값 입력 (연간/분기/월)
- 기존 시스템(인사, 안전, 품질 등) 연동 데이터 조회·매핑
- 원천 데이터 파일·근거 문서 첨부

#### 2.5.4 데이터 소스 관리
- 차트용 데이터 소스
  - GHG 산정 결과 (Scope 1/2/3)
  - 에너지 사용량
  - 재생에너지 사용 현황
  - 폐기물 발생량
  - 용수 사용량 등
- 데이터 소스와 차트 자동 연동

**데이터 모델**:
- `esg_charts` 테이블
- `esg_tables` 테이블
- `esg_kpi_data` 테이블
- `esg_data_sources` 테이블

**API 엔드포인트**:
```
POST   /api/esg/charts
GET    /api/esg/charts
GET    /api/esg/charts/:id
PUT    /api/esg/charts/:id
DELETE /api/esg/charts/:id
GET    /api/esg/charts/gallery
POST   /api/esg/tables
GET    /api/esg/tables
PUT    /api/esg/tables/:id
POST   /api/esg/kpi
GET    /api/esg/kpi
GET    /api/esg/data-sources
```

**데이터 흐름**:
```
[GHG 산정 결과] → ESG 데이터 서비스 → [차트 생성]
[ESG KPI 입력] → ESG 데이터 서비스 → [차트/도표 생성]
[차트 저장] → esg_charts 테이블 → [최종보고서 반영]
```

**의존성**:
- GHG Calculation Service (배출량 데이터)
- Report Generation Service (최종보고서 반영)

---

### 2.6 Disclosure Service (공시 데이터 서비스)

**역할**: 공시 프레임워크별 요건 체크 및 데이터 수집 워크플로우 관리

**주요 기능**:

#### 2.6.1 공시 프레임워크별 요건 체크
- 프레임워크별 필수 항목 정의
  - **IFRS S2 (ISSB)**: Scope 1/2/3, 배출계수 출처, GWP 기준 등
  - **GRI**: GRI 305-1, 305-2, 305-3 등
  - **K-ETS**: Scope 1/2, 할당량 대비 실적 등
  - **KSSB**: 국내 기후 공시 요건
  - **ESRS**: ESRS E1 요건
- 체크리스트 자동 검증
  - 각 프레임워크별 요건 충족 여부 확인
  - 준수/부분/미준수 상태 표시
  - 누락 항목 경고

#### 2.6.2 공시 항목별 데이터 요청/수집
- 공시 항목 정의
  - 예: `S2-1 GHG 배출량`, `S2-2 기후 리스크`, `E1-5 감축목표` 등
- 담당자 매핑
  - 각 항목별 담당 부서·담당자 지정
- 데이터 요청 발송
  - 이메일/인앱 알림
  - 요청 기한 설정
  - 요청 양식 템플릿 제공
- 데이터 수집
  - 정량 데이터: 수치, 단위, 기준, 주석
  - 정성 데이터: 서술형 텍스트, 첨부파일(근거자료)

#### 2.6.3 승인 워크플로우
- 항목별 상태 관리
  - 미요청 / 요청중 / 회신완료 / 검토중 / 확정
- 버전 관리
  - 각 항목 수정 시 버전 이력 저장
  - 이전 버전 비교

#### 2.6.4 리마인드/체이싱
- 요청 기한 임박/지연 항목 자동 리마인드
- 개인별 "나에게 온 요청" 인박스 화면
- 대량 리마인드 발송

#### 2.6.5 공시 진행률 모니터링
- 프레임워크별 진행률 계산
- 상태별 개수 집계 (미요청/요청중/회신완료/검토중/확정)
- 대시보드 연동

**데이터 모델**:
- `disclosure_frameworks` 테이블
- `disclosure_items` 테이블
- `disclosure_requests` 테이블
- `disclosure_responses` 테이블
- `disclosure_approvals` 테이블

**API 엔드포인트**:
```
GET    /api/disclosure/frameworks
GET    /api/disclosure/frameworks/:id/checklist
GET    /api/disclosure/items
POST   /api/disclosure/requests
GET    /api/disclosure/requests
GET    /api/disclosure/requests/:id
PUT    /api/disclosure/responses/:id
GET    /api/disclosure/progress
POST   /api/disclosure/remind
```

**데이터 흐름**:
```
[공시 프레임워크 선택] → [요건 체크리스트 로드]
    ↓
[공시 항목별 데이터 요청] → [담당자에게 알림]
    ↓
[담당자 데이터 입력] → [승인 워크플로우]
    ↓
[공시 진행률 업데이트] → [대시보드 반영]
```

**의존성**:
- Notification Service (알림 발송)
- Dashboard Service (진행률 표시)

---

### 2.7 Audit Trail Service (감사 추적 서비스)

**역할**: 데이터 계보 추적, 수동 조정 이력, 감사 로그 저장

**주요 기능**:
- 데이터 계보 추적
  - 활동자료 → 배출계수 → 배출량 추적
  - 데이터 출처 추적 (`source_system`, `synced_at`)
- 수동 조정 이력
  - 수동 수정 감지 (`updated_at` vs `synced_at`)
  - 수정 전/후 값 저장
  - 수정 사유 기록
- 배출계수 적용 내역
  - 적용 배출계수 ID, 값, 버전
  - 현행 MDG값과 비교
  - 구버전 배출계수 경고
- 감사 로그 저장
  - 모든 데이터 변경 이력
  - 사용자별 활동 로그
- 증빙 패키지 생성
  - PDF Report
  - Excel Details
  - 검증의견서 부속 서류

**데이터 모델**:
- `audit_logs` 테이블
- `data_lineage` 테이블
- `manual_adjustments` 테이블
- `evidence_packages` 테이블

**API 엔드포인트**:
```
GET    /api/audit/lineage/:dataId
GET    /api/audit/adjustments
GET    /api/audit/logs
GET    /api/audit/evidence-package
POST   /api/audit/evidence-package/generate
```

**의존성**:
- GHG Calculation Service (산정 데이터)
- Data Integration Service (데이터 출처)

---

### 2.8 Dashboard Service (대시보드 서비스)

**역할**: 진행률 집계, 알림 관리, 할 일 리스트

**주요 기능**:
- 진행률 집계
  - 회사정보 완료율
  - GHG 산정 완료율
  - SR 작성 완료율
  - 차트/도표 저장 개수
- 알림 관리
  - 인앱 알림 표시
  - 알림 읽음 처리
- 할 일(To-do) 리스트
  - 오늘 해야 할 작업
  - 마감 임박 작업
- 팀원 현황 관리 (팀장 전용)
  - 팀원 목록
  - 담당 카드별 진행 상황
  - 마지막 활동 시각
- 최근 활동 로그 (팀장 전용)
  - 팀 전체 활동 타임라인

**데이터 모델**:
- `dashboard_progress` 테이블
- `notifications` 테이블
- `todo_items` 테이블
- `team_activities` 테이블

**API 엔드포인트**:
```
GET    /api/dashboard/progress
GET    /api/dashboard/notifications
GET    /api/dashboard/todos
GET    /api/dashboard/team-activities
PUT    /api/dashboard/notifications/:id/read
```

**의존성**:
- 모든 서비스 (진행률 집계용)

---

### 2.9 Report Generation Service (리포트 생성 서비스)

**역할**: PDF/Word/Excel 보고서 생성, 최종 보고서 통합

**주요 기능**:
- PDF 보고서 생성
  - SR 보고서 PDF
  - GHG 산정 결과 PDF
  - 검증의견서 부속 서류 PDF
- Word 보고서 생성
  - SR 보고서 Word
- Excel 상세본 생성
  - GHG 데이터 상세 Excel
  - ESG 데이터 상세 Excel
- 최종 보고서 통합
  - 회사정보 + GHG 결과 + SR 문단 + 차트/도표 통합
  - 버전 태깅 (v1.0, v1.1 등)

**데이터 모델**:
- `generated_reports` 테이블
- `report_versions` 테이블

**API 엔드포인트**:
```
POST   /api/reports/generate/pdf
POST   /api/reports/generate/word
POST   /api/reports/generate/excel
GET    /api/reports/:id
GET    /api/reports/versions
```

**의존성**:
- SR Report Service (문단 데이터)
- ESG Data Service (차트/도표 데이터)
- GHG Calculation Service (배출량 데이터)
- Common Service (회사정보)

---

### 2.10 Common Service (공통 서비스)

**역할**: 회사정보 관리, 기준정보 관리, 공통 유틸리티

**주요 기능**:
- 회사정보 관리
  - 기업 기본정보
  - 연락처 정보
  - ESG 목표 및 비전
  - 이해관계자 정보
- 기준정보 관리 (MDG)
  - 사업장 마스터
  - 배출계수 마스터
  - 조직 구조
- 공통 유틸리티
  - 파일 업로드/다운로드
  - 설정 관리

**데이터 모델**:
- `company_info` 테이블
- `site_master` 테이블
- `emission_factors` 테이블 (기준정보)

**API 엔드포인트**:
```
GET    /api/common/company-info
PUT    /api/common/company-info
GET    /api/common/sites
GET    /api/common/emission-factors
POST   /api/common/upload
GET    /api/common/download/:fileId
```

**현재 상태**: `common-service` 존재

---

## 3. 서비스 간 통신 및 의존성

### 3.1 서비스 통신 방식

- **동기 통신**: REST API (HTTP/HTTPS)
- **비동기 통신**: 메시지 큐 (선택적, 향후 확장)
- **API Gateway**: 모든 외부 요청은 Gateway를 통해 라우팅

### 3.2 서비스 의존성 그래프

```
Gateway
  ├─ Auth Service
  ├─ GHG Calculation Service
  │   ├─ Data Integration Service
  │   └─ Audit Trail Service
  ├─ SR Report Service
  │   ├─ IFRS Agent Service
  │   ├─ GHG Calculation Service
  │   ├─ ESG Data Service
  │   └─ Common Service
  ├─ ESG Data Service
  │   ├─ GHG Calculation Service
  │   └─ Report Generation Service
  ├─ Disclosure Service
  │   ├─ Notification Service
  │   └─ Dashboard Service
  ├─ Audit Trail Service
  │   ├─ GHG Calculation Service
  │   └─ Data Integration Service
  ├─ Dashboard Service
  │   └─ (모든 서비스)
  ├─ Report Generation Service
  │   ├─ SR Report Service
  │   ├─ ESG Data Service
  │   ├─ GHG Calculation Service
  │   └─ Common Service
  └─ Common Service
```

### 3.3 데이터베이스 분리 전략

- **서비스별 독립 데이터베이스**: 각 서비스는 자체 데이터베이스 보유
- **공유 데이터베이스**: Common Service의 기준정보는 여러 서비스에서 참조
- **이벤트 기반 동기화**: 서비스 간 데이터 동기화는 이벤트 기반 (선택적)

---

## 4. 구현 우선순위

### Phase 1: 핵심 서비스 (필수)
1. Auth Service (기존 `user-service`, `oauth-service` 활용)
2. GHG Calculation Service (신규)
3. Data Integration Service (기존 `crawler-service` 확장)
4. Common Service (기존 `common-service` 활용)

### Phase 2: 보고서 관련 서비스
5. SR Report Service (기존 `ifrs-agent-service` 확장)
6. ESG Data Service (신규)
7. Report Generation Service (신규)

### Phase 3: 관리 및 모니터링 서비스
8. Disclosure Service (신규)
9. Audit Trail Service (신규)
10. Dashboard Service (신규)

---

## 5. 서비스 통합/분리 고려사항

### 통합 권장
1. **파일 파싱 + 데이터 수집**: 하나의 Data Integration Service로 통합
   - PDF/Excel/CSV 파싱
   - ERP/EMS 등 시스템 연동
   - 데이터 검증

2. **알림 + 워크플로우**: Notification Service로 통합
   - 알림 발송
   - 승인 워크플로우 관리

### 분리 권장
1. **GHG 계산 vs 감사 추적**: 분리 권장
   - GHG 계산: 산정 로직 중심
   - 감사 추적: 이력 추적/로그 중심

2. **SR 보고서 vs ESG 데이터**: 분리 권장
   - SR 보고서: AI 생성/편집 중심
   - ESG 데이터: KPI/차트 관리 중심

---

## 6. 현재 docker-compose와의 비교

### 현재 존재하는 서비스
- `gateway` (API Gateway)
- `user-service` (사용자 관리)
- `oauth-service` (OAuth)
- `common-service` (공통)
- `ifrs-agent-service` (SR 보고서 AI)
- `crawler-service` (크롤링)
- `agent-service` (일반 Agent)

### 추가 필요한 서비스
- GHG Calculation Service
- ESG Data Service
- Disclosure Service
- Audit Trail Service
- Dashboard Service
- Report Generation Service

### 통합/재구성 필요
- `crawler-service` → Data Integration Service로 확장
- `ifrs-agent-service` → SR Report Service로 확장
- 알림/워크플로우 기능 → Notification Service (신규 또는 Common Service 확장)

---

## 7. 참고 문서

- `JOURNEYMAP_TOTAL.md` - 전체 사용자 여정
- `TOTAL.md` - ESG 공시 전 과정 플로우
- `DUMMY_DATA_PLANNING.md` - 데이터 수집 전략
- `DATABASE_TABLES_STRUCTURE.md` - 데이터베이스 구조
- `ARCHITECTURE.md` - 시스템 아키텍처

