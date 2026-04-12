# 계열사 데이터 제출 기능 구현 완료 보고서

## 구현 완료 항목

### 1. 데이터 모델 확장 ✅
- **파일**: `backend/alembic/versions/044_subsidiary_submissions.py`
- **내용**:
  - `subsidiary_data_submissions` 테이블 생성 (제출 이력 관리)
  - `staging_*_data` 7개 테이블에 `source_company_id` 컬럼 추가
  - `ghg_emission_results`에 `source_company_id` 추가
  - 적절한 인덱스 및 제약 조건 설정

### 2. GHG 더미 데이터 생성 ✅
- **파일**: `backend/scripts/seeds/create_subsidiary_ghg_data.py`
- **생성 데이터**:
  - 지주사: 삼성SDS (138,500 tCO₂e)
  - 계열사 3개:
    - 삼성전자 (4,875,000 tCO₂e) - 반도체 공장 3개
    - 삼성물산 (3,075,000 tCO₂e) - 석유화학 공장 2개
    - 삼성생명 (547,000 tCO₂e) - 오피스 2개
  - **그룹 전체**: 8,635,500 tCO₂e
- **출력 위치**: `backend/SDS_ESG_DATA_MULTI/`

### 3. Backend API - 계열사 제출 ✅
- **파일**: `backend/api/v1/data_integration/subsidiary_router.py`
- **엔드포인트**:
  - `POST /subsidiary/submit` - 계열사 데이터 제출
  - `GET /subsidiary/list` - 제출 이력 조회
  - `POST /subsidiary/approve` - 지주사 승인
  - `POST /subsidiary/reject` - 지주사 반려

### 4. Backend Service - 제출 로직 ✅
- **파일**: `backend/domain/v1/data_integration/hub/services/subsidiary_submission_service.py`
- **기능**:
  - 계열사 데이터 제출 처리
  - 제출 이력 조회 (필터링)
  - 승인/반려 처리 (검토자 기록)

### 5. Backend Service - 그룹 집계 ✅
- **파일**: `backend/domain/v1/data_integration/hub/services/group_aggregation_service.py`
- **기능**:
  - 지주사 + 계열사 배출량 취합
  - DP별 데이터 출처 목록 반환
  - 승인된 계열사 데이터만 집계

### 6. IFRS Agent API - 데이터 출처 ✅
- **파일**: `backend/api/v1/ifrs_agent/router.py`
- **엔드포인트**:
  - `GET /dp/{dp_id}/sources` - 특정 DP의 데이터 출처 목록 반환
- **기능**: 지주사 자체 + 계열사 보고 데이터 구분

### 7. Frontend - 계열사 데이터 선택 ✅
- **파일**: `frontend/src/app/(main)/sr-report/components/SubsidiaryDataSelector.tsx`
- **기능**:
  - 계열사별 배출량 표시
  - 포함할 계열사 선택 (체크박스)
  - 선택된 계열사 합계 계산

### 8. Frontend - 데이터 출처 배지 ✅
- **파일**: `frontend/src/app/(main)/sr-report/components/DataSourceBadge.tsx`
- **컴포넌트**:
  - `DataSourceBadge` - 개별 출처 배지
  - `DataSourceList` - 출처 목록 + 합계

### 9. Frontend - 계열사 승인 패널 ✅
- **파일**: `frontend/src/app/(main)/ghg_calc/components/subsidiary/SubsidiaryApprovalPanel.tsx`
- **기능**:
  - 제출 이력 테이블 (필터링: 전체/제출완료/승인/반려)
  - Scope 1/2/3 제출 여부 표시
  - 승인/반려 액션 버튼

### 10. Gen Node 프롬프트 개선 ✅
- **파일**: `backend/domain/v1/ifrs_agent/spokes/agents/gen_node/prompts.py`
- **내용**:
  - 데이터 출처 정보 프롬프트에 포함
  - 지주사 자체 vs 계열사 보고 구분
  - 출처별 수치 표시

---

## 구현 상태 요약

| 번호 | 팀장 요구사항 | 상태 | 구현 내역 |
|------|--------------|------|----------|
| 1 | GHG 더미데이터 (계열사+DC) | ✅ 완료 | 4개 회사, 10개 사업장, 8.6M tCO₂e |
| 2 | SR 더미데이터 (법인+지주사) | ⏳ 다음 | - |
| 3 | SR 프론트 DP 추가 (6개) | ⏳ 다음 | - |
| 4 | 지주사 페이지별 출처 표시 | ✅ 완료 | DataSourceBadge, API 연동 |
| 5 | AI 문단 생성 출처 표시 | ✅ 완료 | 프롬프트 개선, 출처 구조화 |

---

## 다음 단계 (Phase 3)

### 1. SR 더미데이터 생성
- 법인별 narrative 공시 내용
- 지주사 통합 공시 내용
- 데이터 출처 메타데이터 포함

### 2. SR 프론트 DP 추가 (6개)
- 계열사/지주사 구분 DP 정의
- 입력 폼 컴포넌트 생성
- 데이터 저장 API 연동

### 3. 마이그레이션 실행
```bash
cd backend
alembic upgrade head
```

### 4. 더미 데이터 적재
```bash
python backend/scripts/seeds/create_subsidiary_ghg_data.py
# DB에 companies_seed.csv 임포트
# SDS_ESG_DATA_MULTI 폴더 데이터 ingest
```

### 5. 프론트엔드 통합
- HoldingPageByPageEditor에 SubsidiaryDataSelector 추가
- GHGCalcLayout에 SubsidiaryApprovalPanel 추가
- 데이터 출처 표시 적용

---

## 기술 스택 추가

| 항목 | 기술 |
|------|------|
| 계열사 데이터 흐름 | REST API (FastAPI) |
| 데이터 출처 추적 | source_company_id (PostgreSQL) |
| 승인 워크플로우 | status: draft → submitted → approved/rejected |
| 프론트 상태 관리 | React useState, useEffect |
| UI 컴포넌트 | Lucide React Icons, Tailwind CSS |

---

## 파일 구조

```
backend/
├── alembic/versions/
│   └── 044_subsidiary_submissions.py              # 마이그레이션
├── api/v1/
│   ├── data_integration/
│   │   ├── subsidiary_router.py                   # 계열사 API
│   │   └── routes.py                              # 라우터 통합
│   └── ifrs_agent/
│       └── router.py                              # 데이터 출처 API
├── domain/v1/
│   ├── data_integration/hub/services/
│   │   ├── subsidiary_submission_service.py       # 제출 서비스
│   │   └── group_aggregation_service.py           # 집계 서비스
│   └── ifrs_agent/spokes/agents/gen_node/
│       └── prompts.py                             # 프롬프트 개선
└── scripts/seeds/
    └── create_subsidiary_ghg_data.py              # 더미 데이터 생성

frontend/src/app/(main)/
├── sr-report/components/
│   ├── SubsidiaryDataSelector.tsx                 # 계열사 선택
│   └── DataSourceBadge.tsx                        # 출처 배지
└── ghg_calc/components/subsidiary/
    └── SubsidiaryApprovalPanel.tsx                # 승인 패널

backend/SDS_ESG_DATA_MULTI/                        # 생성된 더미 데이터
├── holding_삼성SDS/
├── subsidiary_삼성전자/
├── subsidiary_삼성물산/
├── subsidiary_삼성생명/
├── MDG/
└── companies_seed.csv
```

---

## 테스트 시나리오

### 1. 계열사 데이터 제출
1. 계열사 로그인
2. GHG 데이터 입력
3. 지주사에게 제출 (Scope 1/2/3 선택)
4. 제출 완료 확인

### 2. 지주사 승인
1. 지주사 로그인
2. 제출 이력 조회
3. 계열사 데이터 검토
4. 승인/반려

### 3. 데이터 출처 표시
1. SR 작성 페이지 접근
2. DP 선택
3. 데이터 출처 배지 확인 (지주사 자체 vs 계열사 보고)
4. AI 문단 생성
5. 생성된 문단에 출처 표시 확인

---

## 성능 고려사항

- 대량 계열사 데이터 조회 시 인덱스 활용 (`idx_submissions_holding`)
- 집계 쿼리 최적화 (JOIN 최소화)
- 프론트엔드 페이지네이션 (제출 이력이 많을 경우)

---

## 보안 고려사항

- 계열사는 자기 회사 데이터만 조회/제출 가능
- 지주사는 모든 계열사 데이터 조회 가능
- 승인/반려는 지주사 권한자(reviewer)만 가능
- reviewed_by 필드로 감사 추적 (audit trail)

---

## 완료일: 2026-04-12
