# GHG 산정 및 SR 보고서 자동 작성 데이터베이스 테이블 구조

> **목적**: GHG 산정 탭과 SR 보고서 자동 작성에 필요한 모든 데이터베이스 테이블 구조를 정리합니다.  
> **대상**: 개발자, 데이터베이스 설계자, 시스템 아키텍트  
> **최종 업데이트**: 2025-01-XX

---

## 목차

1. [GHG 산정 탭 테이블](#1-ghg-산정-탭-테이블)
2. [SR 보고서 자동 작성 테이블](#2-sr-보고서-자동-작성-테이블)
3. [테이블 간 관계 및 데이터 흐름](#3-테이블-간-관계-및-데이터-흐름)
4. [데이터 확정 프로세스](#4-데이터-확정-프로세스)

---

## 1. GHG 산정 탭 테이블

### 1.1 핵심 데이터 테이블

#### `ghg_activity_data` - 활동자료 (원시 데이터)

**역할**: EMS/ERP/EHS에서 수집한 원시 활동 데이터 저장

**주요 필드**:
```sql
CREATE TABLE ghg_activity_data (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- 탭 구분
  tab_type TEXT NOT NULL,  -- 'power_heat_steam' | 'fuel_vehicle' | 'refrigerant' | 'waste' | 'logistics_travel' | 'raw_materials'
  
  -- 기본 정보
  site_name TEXT NOT NULL,
  period_year INTEGER NOT NULL,
  period_month INTEGER,
  
  -- 전력·열·스팀 (tab_type = 'power_heat_steam')
  energy_type TEXT,  -- '전력' | '열' | '스팀'
  energy_source TEXT,  -- '한국전력' | '지역난방' 등
  usage_amount DECIMAL(18, 4),
  usage_unit TEXT,  -- 'kWh' | 'Gcal' | 'GJ'
  renewable_ratio DECIMAL(5, 2),  -- 재생에너지 비율 (%)
  
  -- 연료·차량 (tab_type = 'fuel_vehicle')
  fuel_category TEXT,  -- '고정연소' | '이동연소'
  fuel_type TEXT,  -- 'LNG' | '경유' | '휘발유' 등
  consumption_amount DECIMAL(18, 4),
  fuel_unit TEXT,  -- 'Nm³' | 'L' | 'kg'
  purchase_amount DECIMAL(18, 4),
  
  -- 냉매 (tab_type = 'refrigerant')
  equipment_id TEXT,
  equipment_type TEXT,  -- '에어컨' | '냉동기' | '칠러'
  refrigerant_type TEXT,  -- 'HFC-134a' | 'HFC-410A' 등
  charge_amount_kg DECIMAL(18, 4),
  leak_amount_kg DECIMAL(18, 4),
  gwp_factor DECIMAL(18, 4),
  inspection_date DATE,
  
  -- 폐기물 (tab_type = 'waste')
  waste_type TEXT,  -- '일반' | '지정' | '건설'
  waste_name TEXT,
  generation_amount DECIMAL(18, 4),  -- 발생량 (톤)
  disposal_method TEXT,  -- '소각' | '매립' | '재활용' | '위탁'
  incineration_amount DECIMAL(18, 4),  -- 소각량 (톤)
  recycling_amount DECIMAL(18, 4),  -- 재활용량 (톤)
  
  -- 물류·출장·통근 (tab_type = 'logistics_travel')
  category TEXT,  -- '물류(인바운드)' | '물류(아웃바운드)' | '출장' | '통근'
  transport_mode TEXT,  -- '항공' | '해상' | '도로' | '철도' | '자가용'
  origin_country TEXT,
  destination_country TEXT,
  distance_km DECIMAL(18, 4),
  weight_ton DECIMAL(18, 4),  -- 물류용
  person_trips INTEGER,  -- 출장·통근용
  
  -- 원료·제품 (tab_type = 'raw_materials')
  supplier_name TEXT,
  product_name TEXT,
  supplier_emission_tco2e DECIMAL(18, 4),
  use_phase_emission DECIMAL(18, 4),
  eol_emission DECIMAL(18, 4),
  ghg_reported_yn TEXT,  -- '직접보고' | '추정'
  
  -- 데이터 품질 및 출처
  data_quality TEXT,  -- 'M1' | 'M2' | 'E1' | 'E2'
  source_system TEXT,  -- 'EMS' | 'ERP' | 'EHS' | 'SRM' | 'HR' | 'PLM' | 'manual'
  synced_at TIMESTAMPTZ,  -- 시스템 동기화 시각
  updated_at TIMESTAMPTZ,  -- 수동 수정 시각
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_ghg_activity_company (company_id, period_year, period_month),
  INDEX idx_ghg_activity_tab (company_id, tab_type)
);
```

**데이터 소스**:
- EMS: 전력·열·스팀, 폐기물
- ERP: 연료·차량
- EHS: 냉매
- SRM: 물류, 원료
- HR: 출장·통근
- PLM: 제품

---

#### `ghg_emission_results` - 배출량 산정 결과

**역할**: 활동자료를 배출계수와 곱해 계산한 최종 배출량 저장

**주요 필드**:
```sql
CREATE TABLE ghg_emission_results (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- 기간 정보
  period_year INTEGER NOT NULL,
  period_month INTEGER,
  
  -- Scope별 배출량
  scope1_total_tco2e DECIMAL(18, 4),  -- Scope 1 총 배출량
  scope1_fixed_combustion_tco2e DECIMAL(18, 4),  -- 고정연소
  scope1_mobile_combustion_tco2e DECIMAL(18, 4),  -- 이동연소
  scope1_fugitive_tco2e DECIMAL(18, 4),  -- 탈루 (냉매)
  scope1_incineration_tco2e DECIMAL(18, 4),  -- 소각
  
  scope2_location_tco2e DECIMAL(18, 4),  -- Scope 2 위치 기반
  scope2_market_tco2e DECIMAL(18, 4),  -- Scope 2 시장 기반
  scope2_renewable_tco2e DECIMAL(18, 4),  -- 재생에너지 반영
  
  scope3_total_tco2e DECIMAL(18, 4),  -- Scope 3 총 배출량
  scope3_category_1_tco2e DECIMAL(18, 4),  -- Cat.1: 구매 물품
  scope3_category_4_tco2e DECIMAL(18, 4),  -- Cat.4: 인바운드 물류
  scope3_category_6_tco2e DECIMAL(18, 4),  -- Cat.6: 출장
  scope3_category_7_tco2e DECIMAL(18, 4),  -- Cat.7: 통근
  scope3_category_9_tco2e DECIMAL(18, 4),  -- Cat.9: 아웃바운드 물류
  scope3_category_11_tco2e DECIMAL(18, 4),  -- Cat.11: 제품 사용
  scope3_category_12_tco2e DECIMAL(18, 4),  -- Cat.12: 제품 폐기
  
  total_tco2e DECIMAL(18, 4),  -- 총 배출량
  
  -- 적용 프레임워크 및 버전
  applied_framework TEXT,  -- 'GHG_Protocol' | 'IFRS_S2' | 'K-ETS' | 'GRI' | 'ESRS'
  calculation_version TEXT,  -- 'v1' | 'v2' | 'latest'
  
  -- 데이터 신뢰도
  data_quality_score DECIMAL(5, 2),  -- 0~100
  data_quality_level TEXT,  -- 'M1' | 'M2' | 'E1' | 'E2'
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_ghg_results_company (company_id, period_year),
  INDEX idx_ghg_results_framework (company_id, applied_framework)
);
```

---

#### `ghg_emission_factors` - 배출계수

**역할**: 배출계수 마스터 데이터 저장

**주요 필드**:
```sql
CREATE TABLE ghg_emission_factors (
  id UUID PRIMARY KEY,
  
  -- 배출계수 식별
  factor_code TEXT NOT NULL UNIQUE,  -- 'KR_2024_GRID_ELECTRICITY'
  factor_name_ko TEXT NOT NULL,
  factor_name_en TEXT,
  
  -- 배출계수 값
  emission_factor DECIMAL(18, 6),  -- tCO2e/단위
  unit TEXT NOT NULL,  -- 'kWh' | 'Nm³' | 'L' | 'kg' 등
  
  -- 적용 범위
  applicable_scope TEXT,  -- 'Scope1' | 'Scope2' | 'Scope3'
  applicable_category TEXT,  -- '고정연소' | '이동연소' | '전력' 등
  
  -- 기준 정보
  reference_year INTEGER,  -- 2024
  reference_source TEXT,  -- '환경부' | 'K-ETS' | 'IPCC' | 'IEA'
  reference_url TEXT,
  
  -- GWP 정보
  gwp_value DECIMAL(18, 4),  -- 지구온난화지수 (CO2=1 기준)
  
  -- 유효 기간
  effective_from DATE,
  effective_to DATE,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_ghg_factors_code (factor_code),
  INDEX idx_ghg_factors_scope (applicable_scope, applicable_category)
);
```

---

### 1.2 감사 및 버전 관리 테이블

#### `ghg_calculation_snapshots` - 산정 버전 스냅샷

**역할**: 특정 시점의 산정 결과를 버전으로 저장 (v1, v2, v3...)

**주요 필드**:
```sql
CREATE TABLE ghg_calculation_snapshots (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- 버전 정보
  snapshot_version TEXT NOT NULL,  -- 'v1' | 'v2' | 'v3'
  label TEXT,  -- '2024년 1분기 최종' | '수원공장 수정 반영'
  
  -- 스냅샷 데이터
  payload JSONB NOT NULL,  -- 전체 데이터셋 (scope1, scope2, scope3, boundaryPolicy)
  period_locks_snapshot JSONB,  -- 당시 Lock 상태
  
  -- 메타데이터
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_ghg_snapshots_company (company_id, created_at)
);
```

**사용 목적**:
- 버전 비교 (v1 vs v2 vs v3)
- 롤백 (특정 버전으로 되돌리기)
- 감사 증빙 (마감 시점 데이터 재현)

---

#### `ghg_audit_logs` - 변경 추적 로그

**역할**: 데이터 변경 이력 추적 (어떤 필드가 언제, 누가, 왜 변경되었는지)

**주요 필드**:
```sql
CREATE TABLE ghg_audit_logs (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- 변경 대상
  entity_type TEXT NOT NULL,  -- 'activity_data' | 'emission_results'
  entity_id UUID NOT NULL,
  
  -- 변경 정보
  action TEXT NOT NULL,  -- 'insert' | 'update' | 'delete'
  old_value JSONB,  -- 변경 전 값 (변경된 필드만)
  new_value JSONB,  -- 변경 후 값 (변경된 필드만)
  
  -- 변경자 정보
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_reason TEXT,  -- 'ERP 데이터 오류 정정' | '현장 확인 후 수정'
  
  -- 트리거 정보
  triggered_by TEXT,  -- 'api' | 'trigger' | 'manual'
  
  INDEX idx_ghg_audit_entity (entity_type, entity_id),
  INDEX idx_ghg_audit_company (company_id, changed_at)
);
```

**사용 목적**:
- 수동 수정 감지
- 감사인 질의 대응
- 필드별 변경 추적

---

### 1.3 승인 및 잠금 관리 테이블

#### `ghg_period_locks` - 기간별 데이터 잠금

**역할**: 특정 기간의 데이터를 마감하여 수정 불가 상태로 설정

**주요 필드**:
```sql
CREATE TABLE ghg_period_locks (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- 잠금 대상
  period_year INTEGER NOT NULL,
  period_month INTEGER,  -- NULL이면 연간 잠금
  scope_type TEXT,  -- 'scope1' | 'scope2' | 'scope3' | 'all'
  
  -- 잠금 상태
  status TEXT NOT NULL,  -- 'locked' | 'unlocked'
  locked_by TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lock_reason TEXT,
  
  -- 잠금 해제 정보
  unlocked_by TEXT,
  unlocked_at TIMESTAMPTZ,
  unlock_reason TEXT,
  
  INDEX idx_ghg_locks_company (company_id, period_year, period_month)
);
```

---

#### `ghg_unlock_requests` - 잠금 해제 요청

**역할**: 잠금된 데이터 수정을 위한 해제 요청

**주요 필드**:
```sql
CREATE TABLE ghg_unlock_requests (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- 요청 대상
  period_lock_id UUID NOT NULL REFERENCES ghg_period_locks(id),
  
  -- 요청 정보
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL,  -- '데이터 오류 정정' | '추가 데이터 입력'
  
  -- 승인 상태
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  approval_comment TEXT,
  
  INDEX idx_ghg_unlock_requests_company (company_id, status)
);
```

---

#### `ghg_approval_workflows` - 승인 워크플로우

**역할**: 다단계 승인 프로세스 관리

**주요 필드**:
```sql
CREATE TABLE ghg_approval_workflows (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- 워크플로우 정보
  workflow_type TEXT NOT NULL,  -- 'unlock' | 'data_submission' | 'final_approval'
  target_id UUID NOT NULL,  -- unlock_request_id 등
  
  -- 진행 상태
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'in_progress' | 'approved' | 'rejected'
  current_step INTEGER DEFAULT 1,  -- 현재 단계 (1, 2, 3...)
  total_steps INTEGER DEFAULT 2,  -- 총 단계 수
  
  -- 승인자 정보
  approver_1_id TEXT,  -- 검토자
  approver_2_id TEXT,  -- 승인자 (팀장)
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  INDEX idx_ghg_workflows_company (company_id, status)
);
```

---

#### `ghg_approval_steps` - 승인 단계별 상세

**역할**: 각 승인 단계의 상세 정보 및 e-Sign

**주요 필드**:
```sql
CREATE TABLE ghg_approval_steps (
  id UUID PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES ghg_approval_workflows(id),
  
  -- 단계 정보
  step_order INTEGER NOT NULL,  -- 1, 2, 3...
  approver_role TEXT NOT NULL,  -- 'reviewer' | 'approver'
  approver_id TEXT NOT NULL,
  
  -- 승인 정보
  action TEXT NOT NULL,  -- 'approved' | 'rejected'
  comment TEXT,
  signed_at TIMESTAMPTZ,
  
  -- e-Sign 정보
  e_sign_data JSONB,  -- {signerId, timestamp, hash}
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_ghg_steps_workflow (workflow_id, step_order)
);
```

---

### 1.4 증빙 및 공시 요건 테이블

#### `ghg_evidence_files` - 증빙 파일

**역할**: 산정 근거 자료 (영수증, 측정 기록 등) 저장

**주요 필드**:
```sql
CREATE TABLE ghg_evidence_files (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- 연결 정보
  related_entity_type TEXT NOT NULL,  -- 'activity_data' | 'emission_results'
  related_entity_id UUID NOT NULL,
  
  -- 파일 정보
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,  -- 'pdf' | 'excel' | 'image'
  file_size BIGINT,  -- bytes
  
  -- 무결성 검증
  sha256_hash TEXT NOT NULL,  -- 파일 해시
  
  -- 메타데이터
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT,
  
  INDEX idx_ghg_evidence_entity (related_entity_type, related_entity_id)
);
```

**사용 목적**:
- 감사 증빙 (모든 Scope)
- 데이터 무결성 검증
- 공시 제출 (리포트 생성 시 증빙 패키지 포함)

---

#### `ghg_audit_comments` - 감사 코멘트

**역할**: 감사인/검증인 코멘트 저장

**주요 필드**:
```sql
CREATE TABLE ghg_audit_comments (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- 연결 정보
  related_entity_type TEXT NOT NULL,
  related_entity_id UUID NOT NULL,
  
  -- 코멘트 정보
  comment_text TEXT NOT NULL,
  comment_type TEXT,  -- 'question' | 'finding' | 'recommendation'
  
  -- 작성자 정보
  commented_by TEXT NOT NULL,
  commented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 응답 정보
  response_text TEXT,
  responded_by TEXT,
  responded_at TIMESTAMPTZ,
  
  INDEX idx_ghg_comments_entity (related_entity_type, related_entity_id)
);
```

---

#### `ghg_disclosure_requirements` - 공시 요건 체크리스트

**역할**: 프레임워크별 공시 요건 충족 여부 추적

**주요 필드**:
```sql
CREATE TABLE ghg_disclosure_requirements (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- 프레임워크 정보
  framework TEXT NOT NULL,  -- 'IFRS_S2' | 'K-ETS' | 'GRI' | 'ESRS'
  requirement_code TEXT NOT NULL,  -- 'S2-29-a' | 'KETS-MONTHLY-ENERGY'
  requirement_name_ko TEXT NOT NULL,
  requirement_name_en TEXT,
  
  -- 충족 여부
  is_fulfilled BOOLEAN DEFAULT FALSE,
  fulfillment_evidence TEXT,  -- 'ghg_emission_results.id=123'
  fulfillment_date DATE,
  
  -- 자동 체크 로직
  auto_check_query TEXT,  -- 자동 체크 SQL 또는 로직
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_ghg_requirements_company (company_id, framework),
  INDEX idx_ghg_requirements_fulfilled (company_id, is_fulfilled)
);
```

**사용 목적**:
- 프레임워크별 요건 자동 체크
- 미충족 항목 명확히 파악
- 공시 준수율 계산

---

## 2. SR 보고서 자동 작성 테이블

### 2.1 환경 데이터 테이블

#### `environmental_data` - 환경 데이터 통합

**역할**: GHG 배출량, 에너지, 용수, 폐기물, 대기 배출 데이터 통합 저장

**주요 필드**:
```sql
CREATE TABLE environmental_data (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  period_year INTEGER NOT NULL,
  period_month INTEGER,
  
  -- ===== GHG 배출량 (ghg_emission_results에서 가져오기) =====
  scope1_total_tco2e DECIMAL(18, 4),
  scope2_location_tco2e DECIMAL(18, 4),
  scope2_market_tco2e DECIMAL(18, 4),
  scope3_total_tco2e DECIMAL(18, 4),
  
  -- ===== 에너지 (ghg_activity_data에서 집계) =====
  total_energy_consumption_mwh DECIMAL(18, 4),  -- 총 에너지 소비량
  renewable_energy_mwh DECIMAL(18, 4),  -- 재생에너지 사용량
  renewable_energy_ratio DECIMAL(5, 2),  -- 재생에너지 비율 (%)
  
  -- ===== 폐기물 (ghg_activity_data에서 집계) =====
  total_waste_generated DECIMAL(18, 4),  -- 총 폐기물 발생량
  waste_recycled DECIMAL(18, 4),  -- 재활용량
  waste_incinerated DECIMAL(18, 4),  -- 소각량
  waste_landfilled DECIMAL(18, 4),  -- 매립량
  hazardous_waste DECIMAL(18, 4),  -- 유해폐기물
  
  -- ===== 용수 (별도 수집 필요) =====
  water_withdrawal DECIMAL(18, 4),  -- 용수 취수량 (톤)
  water_consumption DECIMAL(18, 4),  -- 용수 사용량 (톤)
  water_discharge DECIMAL(18, 4),  -- 폐수 방류량 (톤)
  water_recycling DECIMAL(18, 4),  -- 용수 재활용량 (톤)
  
  -- ===== 대기 배출 (별도 수집 필요) =====
  nox_emission DECIMAL(18, 4),  -- NOx 배출량
  sox_emission DECIMAL(18, 4),  -- SOx 배출량
  voc_emission DECIMAL(18, 4),  -- VOC 배출량
  dust_emission DECIMAL(18, 4),  -- 먼지 배출량 (TSP)
  
  -- ===== 환경 인증 =====
  iso14001_certified BOOLEAN,
  iso14001_cert_date DATE,
  carbon_neutral_certified BOOLEAN,
  carbon_neutral_cert_date DATE,
  
  -- ===== 데이터 소스 추적 =====
  ghg_data_source TEXT,  -- 'ghg_emission_results' | 'ghg_activity_data' | 'manual' | 'erp' | 'ems'
  ghg_calculation_version TEXT,  -- GHG 산정 버전
  
  -- ===== 승인 상태 =====
  status TEXT DEFAULT 'draft',  -- 'draft' | 'pending_review' | 'approved' | 'rejected' | 'final_approved'
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  final_approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_env_company (company_id, period_year),
  INDEX idx_env_status (company_id, status)
);
```

**데이터 소스**:
- GHG 배출량: `ghg_emission_results`에서 자동 가져오기
- 에너지/폐기물: `ghg_activity_data`에서 집계
- 용수/대기: 별도 입력 또는 ERP/EMS 연동

---

### 2.2 사회 데이터 테이블

#### `social_data` - 사회 데이터 통합

**역할**: 임직원, 안전보건, 협력회사, 사회공헌 데이터 저장

**주요 필드**:
```sql
CREATE TABLE social_data (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  data_type TEXT NOT NULL,  -- 'workforce' | 'safety' | 'supply_chain' | 'community'
  period_year INTEGER NOT NULL,
  
  -- ===== 인력 구성 =====
  total_employees INTEGER,  -- 총 임직원 수
  male_employees INTEGER,  -- 남성 임직원 수
  female_employees INTEGER,  -- 여성 임직원 수
  disabled_employees INTEGER,  -- 장애인 임직원 수
  average_age DECIMAL(5, 2),  -- 평균 연령
  turnover_rate DECIMAL(5, 2),  -- 이직률 (%)
  
  -- ===== 안전보건 =====
  total_incidents INTEGER,  -- 총 산업재해 건수
  fatal_incidents INTEGER,  -- 사망 사고 건수
  lost_time_injury_rate DECIMAL(5, 2),  -- LTIFR
  total_recordable_injury_rate DECIMAL(5, 2),  -- TRIR
  safety_training_hours DECIMAL(10, 2),  -- 안전교육 시간
  
  -- ===== 협력회사 =====
  total_suppliers INTEGER,  -- 총 협력사 수
  supplier_purchase_amount DECIMAL(18, 2),  -- 협력사 구매액
  esg_evaluated_suppliers INTEGER,  -- ESG 평가 협력사 수
  
  -- ===== 사회공헌 =====
  social_contribution_cost DECIMAL(18, 2),  -- 사회공헌 활동 비용
  volunteer_hours DECIMAL(10, 2),  -- 봉사활동 시간
  
  -- ===== 승인 상태 =====
  status TEXT DEFAULT 'draft',  -- 'draft' | 'pending_review' | 'approved' | 'rejected' | 'final_approved'
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  final_approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_social_company (company_id, period_year),
  INDEX idx_social_status (company_id, status)
);
```

**데이터 소스**:
- HR 시스템 (임직원, 안전보건)
- SRM 시스템 (협력회사)
- 수동 입력 (사회공헌)

---

### 2.3 지배구조 데이터 테이블

#### `governance_data` - 지배구조 데이터 통합

**역할**: 이사회, 컴플라이언스, 정보보안 데이터 저장

**주요 필드**:
```sql
CREATE TABLE governance_data (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  data_type TEXT NOT NULL,  -- 'board' | 'compliance' | 'ethics' | 'risk'
  period_year INTEGER NOT NULL,
  
  -- ===== 이사회 =====
  total_board_members INTEGER,  -- 총 이사 수
  female_board_members INTEGER,  -- 여성 이사 수
  board_meetings INTEGER,  -- 이사회 개최 수
  board_attendance_rate DECIMAL(5, 2),  -- 출석률 (%)
  board_compensation DECIMAL(18, 2),  -- 이사 보수 합계
  
  -- ===== 컴플라이언스/부패 =====
  corruption_cases INTEGER,  -- 부정부패 발생 건수
  corruption_reports INTEGER,  -- 부정부패 제보 건수
  legal_sanctions INTEGER,  -- 법적 제재 건수
  
  -- ===== 정보보안 =====
  security_incidents INTEGER,  -- 정보보안 사고 건수
  data_breaches INTEGER,  -- 데이터 누출 건수
  security_fines DECIMAL(18, 2),  -- 벌금/과태료
  
  -- ===== 승인 상태 =====
  status TEXT DEFAULT 'draft',  -- 'draft' | 'pending_review' | 'approved' | 'rejected' | 'final_approved'
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  final_approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_gov_company (company_id, period_year),
  INDEX idx_gov_status (company_id, status)
);
```

**데이터 소스**:
- 별도 시스템 (이사회, 컴플라이언스)
- 수동 입력

---

### 2.4 회사정보 테이블

#### `company_info` - 회사 기본정보

**역할**: 회사 기본정보, ESG 목표, 이해관계자 정보 저장

**주요 필드**:
```sql
CREATE TABLE company_info (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE,
  
  -- ===== 기본정보 =====
  company_name_ko TEXT NOT NULL,
  company_name_en TEXT,
  business_registration_number TEXT,
  representative_name TEXT,
  industry TEXT,
  
  -- ===== 연락처 =====
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  
  -- ===== ESG 목표 =====
  mission TEXT,
  vision TEXT,
  esg_goals JSONB,  -- ESG 핵심 목표 목록
  carbon_neutral_target_year INTEGER,  -- 탄소중립 목표 연도
  
  -- ===== 이해관계자 =====
  total_employees INTEGER,
  major_shareholders JSONB,  -- 주요 주주 목록
  stakeholders JSONB,  -- 기타 이해관계자
  
  -- ===== 최종보고서 제출 여부 =====
  submitted_to_final_report BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**확정 조건**: "최종 보고서에 제출" 버튼 클릭 시 `submitted_to_final_report = TRUE`

---

### 2.5 SR 보고서 본문 테이블

#### `sr_report_content` - SR 보고서 문단/본문

**역할**: SR 보고서 목차별 문단 텍스트 저장

**주요 필드**:
```sql
CREATE TABLE sr_report_content (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- ===== 목차 정보 =====
  table_of_contents_id TEXT NOT NULL,  -- 목차 항목 ID
  section_title TEXT NOT NULL,
  page_number INTEGER,
  
  -- ===== 본문 내용 =====
  content_text TEXT NOT NULL,  -- 문단 텍스트
  content_type TEXT,  -- 'narrative' | 'quantitative' | 'mixed'
  
  -- ===== 공시 기준 연결 =====
  related_standards TEXT[],  -- ['IFRS_S2', 'GRI-305-1']
  related_dp_ids TEXT[],  -- ['S2-29-a', 'GRI-305-1']
  
  -- ===== 정량 데이터 (GHG 등) =====
  quantitative_data JSONB,  -- {"scope1_emission": 1234.5, ...}
  
  -- ===== 메타데이터 =====
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- ===== 최종보고서 포함 여부 =====
  saved_to_final_report BOOLEAN DEFAULT FALSE,
  
  INDEX idx_content_company (company_id, table_of_contents_id),
  INDEX idx_content_final_report (company_id, saved_to_final_report)
);
```

**확정 조건**: "저장" 또는 "최종보고서에 저장" 클릭 시 `saved_to_final_report = TRUE`

---

### 2.6 차트/도표 테이블

#### `esg_charts` - 차트/도표 데이터

**역할**: 차트/도표 데이터 및 이미지 저장

**주요 필드**:
```sql
CREATE TABLE esg_charts (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- ===== 차트 정보 =====
  chart_type TEXT NOT NULL,  -- 'bar' | 'pie' | 'line' | 'table'
  chart_category TEXT,  -- 'environmental' | 'social' | 'governance'
  chart_title TEXT NOT NULL,
  
  -- ===== 차트 데이터 =====
  chart_data JSONB NOT NULL,  -- 차트 시리즈 데이터
  chart_config JSONB,  -- 차트 설정 (색상, 범례 등)
  
  -- ===== 이미지 (생성된 차트) =====
  chart_image_url TEXT,  -- 차트 이미지 URL
  
  -- ===== 최종보고서 포함 여부 =====
  saved_to_final_report BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_charts_company (company_id, chart_category),
  INDEX idx_charts_final_report (company_id, saved_to_final_report)
);
```

**확정 조건**: "저장" 버튼 클릭 시 `saved_to_final_report = TRUE`

---

## 3. 테이블 간 관계 및 데이터 흐름

### 3.1 GHG 산정 데이터 흐름

```
[EMS/ERP/EHS] 원시 데이터
    ↓
[ghg_activity_data] 활동자료 저장
    ↓
[배출계수 적용] ghg_emission_factors 조회
    ↓
[ghg_emission_results] 배출량 산정 결과 저장
    ↓
[ghg_calculation_snapshots] 버전 저장 (v1, v2, v3...)
    ↓
[environmental_data] SR 보고서용 환경 데이터 집계
```

### 3.2 SR 보고서 자동 작성 데이터 흐름

```
[데이터 소스]                    [테이블]                      [SR 보고서 생성]
─────────────────              ────────────              ─────────────────
GHG 산정 결과            →    ghg_emission_results  →    "온실가스 배출량" 문단
                                                          Scope 1/2/3 수치 삽입

환경 데이터 (에너지/용수)  →    environmental_data    →    "에너지 사용량" 문단
                                                          "용수 관리" 문단

사회 데이터 (임직원/안전)   →    social_data          →    "인력 구성" 문단
                                                          "안전보건" 문단

지배구조 데이터           →    governance_data       →    "이사회" 문단
                                                          "컴플라이언스" 문단

회사정보                 →    company_info          →    표지, 회사 소개

SR 작성 문단             →    sr_report_content     →    본문 텍스트

차트/도표                →    esg_charts            →    차트 이미지 삽입
```

### 3.3 데이터 집계 로직

#### `environmental_data` 자동 집계 예시

```sql
-- 에너지 사용량 집계 (ghg_activity_data에서)
INSERT INTO environmental_data (
  company_id,
  period_year,
  total_energy_consumption_mwh,
  renewable_energy_mwh,
  total_waste_generated,
  waste_recycled,
  ghg_data_source
)
SELECT 
  company_id,
  period_year,
  -- 총 에너지 소비량 집계
  SUM(CASE 
    WHEN tab_type = 'power_heat_steam' 
    THEN usage_amount * 
      CASE usage_unit
        WHEN 'kWh' THEN 1.0 / 1000.0
        WHEN 'Gcal' THEN 1.163 / 1000.0
        WHEN 'GJ' THEN 0.2778 / 1000.0
        ELSE 0
      END
    WHEN tab_type = 'fuel_vehicle'
    THEN usage_amount * fuel_to_mwh_factor
    ELSE 0
  END) as total_energy_consumption_mwh,
  
  -- 재생에너지 집계
  SUM(CASE 
    WHEN tab_type = 'power_heat_steam' 
    THEN usage_amount * renewable_ratio / 100.0
    ELSE 0
  END) as renewable_energy_mwh,
  
  -- 폐기물 집계
  SUM(CASE 
    WHEN tab_type = 'waste' 
    THEN generation_amount 
    ELSE 0 
  END) as total_waste_generated,
  
  SUM(CASE 
    WHEN tab_type = 'waste' 
    THEN recycling_amount 
    ELSE 0 
  END) as waste_recycled,
  
  'ghg_activity_data' as ghg_data_source
  
FROM ghg_activity_data
WHERE company_id = ?
  AND period_year = ?
GROUP BY company_id, period_year;
```

---

## 4. 데이터 확정 프로세스

### 4.1 GHG 산정 데이터 확정

```
[사용자] GHG 산정 결과 저장
  ↓
[시스템] ghg_emission_results 저장
  ↓
[사용자] "이 탭 결과 저장" 또는 "전체 결과 저장" 클릭
  ↓
[시스템] ghg_calculation_snapshots 생성 (v1, v2, v3...)
  ↓
[확정] SR 보고서 생성 시 이 버전 사용
```

### 4.2 ESG 데이터 확정 (승인 워크플로우)

```
[현업팀] environmental_data / social_data / governance_data 입력
  ↓
[현업팀] "검토 요청" 버튼 클릭
  ↓
[시스템] status = 'pending_review'
  ↓
[ESG팀] 데이터 검토 후 "승인" 또는 "반려" 클릭
  ↓
[시스템] status = 'approved' 또는 'rejected'
  ↓
[ESG팀] "최종 승인 요청" 클릭
  ↓
[최종 승인권자] 최종 승인 클릭
  ↓
[시스템] status = 'final_approved'
  ↓
[확정] SR 보고서 생성 시 이 데이터 사용
```

### 4.3 회사정보 확정

```
[사용자] 회사정보 페이지에서 데이터 입력
  ↓
[사용자] "최종 보고서에 제출" 버튼 클릭
  ↓
[시스템] company_info.submitted_to_final_report = TRUE
  ↓
[확정] SR 보고서 생성 시 이 데이터 사용
```

### 4.4 SR 본문 및 차트 확정

```
[사용자] SR 작성 페이지에서 문단 작성
  ↓
[사용자] "저장" 또는 "최종보고서에 저장" 클릭
  ↓
[시스템] sr_report_content.saved_to_final_report = TRUE
  ↓
[확정] SR 보고서 생성 시 이 문단 사용

[사용자] 도표 및 그림 생성 페이지에서 차트 생성
  ↓
[사용자] "저장" 버튼 클릭
  ↓
[시스템] esg_charts.saved_to_final_report = TRUE
  ↓
[확정] SR 보고서 생성 시 이 차트 사용
```

---

## 5. 요약

### 5.1 GHG 산정 탭 테이블 (12개)

1. **핵심 데이터**: `ghg_activity_data`, `ghg_emission_results`, `ghg_emission_factors`
2. **감사 및 버전 관리**: `ghg_calculation_snapshots`, `ghg_audit_logs`
3. **승인 및 잠금**: `ghg_period_locks`, `ghg_unlock_requests`, `ghg_approval_workflows`, `ghg_approval_steps`
4. **증빙 및 공시**: `ghg_evidence_files`, `ghg_audit_comments`, `ghg_disclosure_requirements`

### 5.2 SR 보고서 자동 작성 테이블 (6개)

1. **환경 데이터**: `environmental_data` (GHG 데이터는 `ghg_emission_results`에서, 에너지/폐기물은 `ghg_activity_data`에서 집계)
2. **사회 데이터**: `social_data` (HR, SRM 시스템에서 수집)
3. **지배구조 데이터**: `governance_data` (별도 시스템에서 수집)
4. **회사정보**: `company_info` (수동 입력)
5. **SR 본문**: `sr_report_content` (사용자 작성 또는 AI 생성)
6. **차트/도표**: `esg_charts` (사용자 생성)

### 5.3 데이터 확정 조건

- **GHG 산정**: 버전 저장 시 확정
- **ESG 데이터**: 승인 워크플로우 완료 시 확정 (`status = 'final_approved'`)
- **회사정보**: "최종 보고서에 제출" 클릭 시 확정
- **SR 본문/차트**: "저장" 또는 "최종보고서에 저장" 클릭 시 확정

---

## 참조 문서

- `JOURNEYMAP_GHG.md` - GHG 산정 탭 사용자 저니맵
- `JOURNEYMAP_SR_REPORT.md` - SR 보고서 작성 사용자 저니맵
- `FINAL_REPORT_DATA_STRATEGY.md` - 최종보고서 데이터 전략
- `ERP_DATA_FOR_SR_REPORT.md` - ERP 데이터 가이드
