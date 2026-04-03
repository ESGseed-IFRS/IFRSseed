# GHG Scope 1·2 배출량 산정 시스템 설계 및 구현서

**작성일**: 2026-04-01  
**버전**: v1.1  
**프로젝트**: IFRS Seeder GHG 계산 모듈  
**목적**: Scope 1·2 온실가스 배출량 자동 산정 로직 구현  

**v1.1 변경 요약**: 산정 결과 영속화 테이블을 통합 DB 구조 문서의 **`ghg_emission_results`** 로 맞춤. 저장소는 **`GhgEmissionResultRepository`** (`ghg_emission_result_repository.py`). 기존 초안 전용 테이블명 `ghg_scope_calculation_results` 는 사용하지 않습니다.

---

## 📋 목차

1. [개요 및 요구사항](#1-개요-및-요구사항)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [데이터 모델 설계](#3-데이터-모델-설계)
4. [배출계수 마스터 관리](#4-배출계수-마스터-관리)
5. [산정 로직 상세 설계](#5-산정-로직-상세-설계)
6. [API 인터페이스 설계](#6-api-인터페이스-설계)
7. [프론트엔드 연동](#7-프론트엔드-연동)
8. [구현 순서 및 마일스톤](#8-구현-순서-및-마일스톤)
9. [핵심 고려사항](#9-핵심-고려사항)

---

## 1. 개요 및 요구사항

### 1.1 목표

**GHG Protocol Corporate Standard** 및 **ISO 14064-1** 기준에 따른 온실가스 인벤토리 자동 산정 시스템 구축:

- **Scope 1 (직접 배출)**
  - 고정연소: 보일러·발전기 등 연료 연소
  - 이동연소: 차량·선박·항공기
  - 공정 배출: 냉매 누설 (HFC/PFC)
  
- **Scope 2 (간접 배출)**
  - 전력: Location-based / Market-based
  - 스팀·열: 외부 구매 열에너지

### 1.2 데이터 소스

| 항목 | 출처 | 비고 |
|------|------|------|
| **활동 데이터** | 스테이징 테이블 (`staging_ems_data`, `staging_erp_data` 등) | `ghg_raw_category = energy` 중심 |
| **배출계수** | `GHG_배출계수_마스터_v2.xlsx` → DB 테이블 | 환경부 고시 2024, IPCC AR5 |
| **기준 정보** | `MDG_SITE_MASTER.csv`, `MDG_ENERGY_SUPPLIER.csv` | 사업장·공급사 메타데이터 |

### 1.3 핵심 요구사항

1. **감사 추적성**: 계산에 사용된 배출계수 버전·값·출처를 결과와 함께 저장
2. **재현 가능성**: 동일 입력 데이터 → 동일 산정 결과 보장
3. **성능**: 연간 데이터(12개월 × 다수 시설) 산정 시 **5초 이내** 응답
4. **확장성**: Scope 3 카테고리 추가 시 최소 수정으로 대응
5. **이상치 연계**: 기존 `ghg_anomaly_scan_results`와 통합하여 산정 전 품질 검증

---

## 2. 시스템 아키텍처

### 2.1 전체 흐름도

```
┌──────────────────────────────────────────────────────────────────┐
│                        프론트엔드 (Next.js)                        │
│                                                                  │
│  ScopeCalculation.tsx                                            │
│    - [재계산] 버튼 클릭                                            │
│    - POST /ghg-calculation/scope/recalculate                     │
│      {company_id, year, basis: 'location'|'market'}             │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼ HTTP Request (JSON)
┌──────────────────────────────────────────────────────────────────┐
│                      FastAPI 백엔드 (Python)                       │
│                                                                  │
│  1️⃣ scope_calculation_router.py                                  │
│     - 요청 검증 (Pydantic DTO)                                    │
│     - 권한 확인 (company_id 소유권)                               │
│     - Orchestrator 호출                                          │
│                                                                  │
│  2️⃣ ScopeCalculationOrchestrator                                 │
│     ┌─────────────────────────────────────────────────────┐    │
│     │ A. 데이터 수집                                         │    │
│     │   - StagingRawRepository.list_by_company(year)       │    │
│     │   - 필터: ghg_raw_category = 'energy'               │    │
│     │                                                       │    │
│     │ B. 카테고리 분류                                       │    │
│     │   - 고정연소 (LNG, 경유, 중유 등)                     │    │
│     │   - 이동연소 (차량 연료)                              │    │
│     │   - 냉매 탈루 (HFC-410A 등)                          │    │
│     │   - 전력 (kWh → MWh)                                 │    │
│     │   - 스팀/열                                           │    │
│     │                                                       │    │
│     │ C. 배출계수 조회                                       │    │
│     │   - EmissionFactorService.get_factor()               │    │
│     │   - 연료명·연도·카테고리 매칭                         │    │
│     │                                                       │    │
│     │ D. 산정 로직 실행                                      │    │
│     │   - Scope1CalculationService                         │    │
│     │     * 고정: 사용량 × 열량계수 × 배출계수             │    │
│     │     * 냉매: kg × GWP / 1000                          │    │
│     │   - Scope2CalculationService                         │    │
│     │     * 전력: MWh × tCO₂eq/MWh                         │    │
│     │     * Market: REC/PPA 조달 시 계수 조정              │    │
│     │                                                       │    │
│     │ E. 집계 및 저장                                        │    │
│     │   - 월별·카테고리별 합산                              │    │
│     │   - GhgEmissionResultRepository.upsert_annual_scope_calc │ │
│     │   - 테이블: ghg_emission_results (연간 스냅샷)         │    │
│     └─────────────────────────────────────────────────────┘    │
│                                                                  │
│  3️⃣ 데이터베이스 (PostgreSQL)                                     │
│     - ghg_emission_factors (배출계수 마스터)                      │
│     - ghg_emission_results (산정 결과, DATABASE_TABLES 구조)   │
│     - staging_*_data (활동 데이터)                                │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼ JSON Response
┌──────────────────────────────────────────────────────────────────┐
│                        프론트엔드 (Next.js)                        │
│                                                                  │
│  ScopeRecalculateResponseDto                                     │
│    - scope1_total, scope2_total, grand_total                    │
│    - monthly_chart: [{ month, scope1, scope2 }, ...]           │
│    - scope1_categories / scope2_categories (테이블용)           │
│                                                                  │
│  화면 업데이트                                                     │
│    - 상단 카드: 전체·Scope별 합계                                 │
│    - 월별 차트: 적층 막대 그래프                                   │
│    - 카테고리별 테이블: 확장 가능한 행                             │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 레이어 구조

```
frontend/
  └─ ScopeCalculation.tsx           UI 컴포넌트
         ↓ API 호출
backend/
  ├─ api/v1/ghg_calculation/
  │   └─ scope_calculation_router.py   API 엔드포인트
  │          ↓
  ├─ domain/v1/ghg_calculation/
  │   ├─ hub/orchestrator/
  │   │   └─ scope_calculation_orchestrator.py   비즈니스 로직 총괄
  │   │          ↓
  │   ├─ hub/services/
  │   │   ├─ emission_factor_service.py          배출계수 조회
  │   │   ├─ scope1_calculation_service.py       Scope1 산정
  │   │   └─ scope2_calculation_service.py       Scope2 산정
  │   │          ↓
  │   ├─ hub/repositories/
  │   │   ├─ staging_raw_repository.py           활동 데이터 조회
  │   │   └─ ghg_emission_result_repository.py   산정 결과 → ghg_emission_results
  │   │          ↓
  │   └─ models/
  │       ├─ bases.py                            SQLAlchemy 모델
  │       └─ states/scope_calculation.py         Pydantic DTO
  │              ↓
  └─ PostgreSQL Database
      ├─ ghg_emission_factors               배출계수
      ├─ ghg_emission_results               산정 결과 (통합 스키마)
      └─ staging_ems_data, staging_erp_data 활동 데이터
```

> **레이어 참고**: `scope1_calculation_service.py` / `scope2_calculation_service.py` 는 설계상 분리 예시이며, **현재 구현**은 `scope_calculation_orchestrator.py` 안에서 집계·분류를 처리합니다.

### 2.3 기술 스택

| 레이어 | 기술 | 버전 | 비고 |
|--------|------|------|------|
| **프론트엔드** | Next.js, TypeScript, React | 14+ | App Router |
| **백엔드** | Python, FastAPI, SQLAlchemy | 3.11+ | 비동기 지원 |
| **데이터베이스** | PostgreSQL | 14+ | JSONB 활용 |
| **검증** | Pydantic | 2.0+ | 요청·응답 스키마 |
| **차트** | Recharts | 2.x | 월별 적층 막대 |
| **테스트** | pytest, pytest-asyncio | - | 단위·통합 테스트 |

---

## 3. 데이터 모델 설계

### 3.1 배출계수 마스터 테이블

#### `ghg_emission_factors`

**목적**: 연료별·카테고리별 배출계수를 버전 관리하며 저장

```sql
CREATE TABLE ghg_emission_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 분류
    category TEXT NOT NULL,      -- 'scope1_fixed', 'scope1_mobile', 
                                 -- 'scope1_fugitive', 'scope2_electricity', 'scope2_heat'
    fuel_type TEXT,              -- 'LNG', 'Diesel', 'HFC-410A', 'Grid', 'Steam'
    sub_category TEXT,           -- 'vehicle_diesel', 'boiler_lng' (세부 구분)
    
    -- 단위 환산 정보
    source_unit TEXT NOT NULL,   -- 'Nm³', 'L', 'kg', 'MWh', 'TJ'
    calorific_value_tj_per_unit NUMERIC(12,6),  -- 열량계수 (TJ/단위), 연소용
    
    -- 배출계수 세부 (tCO₂eq/TJ 기준)
    co2_tco2_per_tj NUMERIC(12,6),      -- CO₂ 배출계수
    ch4_kg_per_tj NUMERIC(12,6),        -- CH₄ 배출계수 (kg/TJ)
    n2o_kg_per_tj NUMERIC(12,6),        -- N₂O 배출계수 (kg/TJ)
    gwp_ar5 INTEGER,                    -- 냉매 GWP (IPCC AR5)
    
    -- ★ 핵심: 통합 배출계수 (활동자료에 직접 곱할 값)
    composite_factor NUMERIC(12,6) NOT NULL,  
    -- 예: LNG = 0.0000388 TJ/Nm³ × 56.1552 tCO₂eq/TJ = 0.002176 tCO₂eq/Nm³
    
    -- 메타데이터
    year_applicable TEXT NOT NULL,   -- '2024', '2023'
    source TEXT NOT NULL,            -- '환경부 2024 고시', 'IPCC AR5'
    version TEXT DEFAULT 'v1.0',    -- 배출계수 버전 (v1.0, v1.1 등)
    is_active BOOLEAN DEFAULT TRUE, -- 현재 사용 여부
    notes TEXT,                     -- 비고 (예: "성적서 확인 시 우선 적용")
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 유니크 제약: 동일 연료·연도·버전 중복 방지
    CONSTRAINT uq_emission_factor 
        UNIQUE (category, fuel_type, sub_category, year_applicable, version)
);

-- 인덱스
CREATE INDEX idx_ef_category_year 
    ON ghg_emission_factors(category, year_applicable, is_active);
CREATE INDEX idx_ef_fuel_type 
    ON ghg_emission_factors(fuel_type, year_applicable);
```

**샘플 데이터**:

```sql
-- Scope1 고정연소: LNG
INSERT INTO ghg_emission_factors 
(category, fuel_type, source_unit, calorific_value_tj_per_unit, 
 co2_tco2_per_tj, ch4_kg_per_tj, n2o_kg_per_tj, composite_factor, 
 year_applicable, source, notes)
VALUES 
('scope1_fixed', 'LNG', 'Nm³', 0.0000388, 56.1, 1.0, 0.1, 0.002176, 
 '2024', '환경부 2024 고시', '열량계수: 0.0388 TJ/천Nm³');

-- Scope1 이동연소: 경유 (차량)
INSERT INTO ghg_emission_factors 
(category, fuel_type, sub_category, source_unit, composite_factor, 
 year_applicable, source)
VALUES 
('scope1_mobile', 'Diesel', 'vehicle', 'L', 0.00262, 
 '2024', '환경부 2024 고시');

-- Scope1 냉매: HFC-410A
INSERT INTO ghg_emission_factors 
(category, fuel_type, source_unit, gwp_ar5, composite_factor, 
 year_applicable, source)
VALUES 
('scope1_fugitive', 'HFC-410A', 'kg', 2088, 2.088, 
 '2024', 'IPCC AR5');
-- composite_factor = GWP / 1000 (kg → tCO₂eq 환산)

-- Scope2 전력: 국가 계통 (위치기반)
INSERT INTO ghg_emission_factors 
(category, fuel_type, source_unit, composite_factor, 
 year_applicable, source)
VALUES 
('scope2_electricity', 'Grid', 'MWh', 0.4567, 
 '2024', '환경부 2024 전력 배출계수');

-- Scope2 스팀
INSERT INTO ghg_emission_factors 
(category, fuel_type, source_unit, composite_factor, 
 year_applicable, source)
VALUES 
('scope2_heat', 'Steam', 'TJ', 45.0, 
 '2024', '환경부 지역난방 배출계수');
```

### 3.2 산정 결과 저장 테이블

#### `ghg_emission_results`

**목적**: `backend/domain/v1/ifrs_agent/docs/DATABASE_TABLES_STRUCTURE.md` 에 정의된 **배출량 산정 결과** 테이블에 맞춰, Scope 1·2 계산 모듈의 연간 집계를 저장합니다. SR·대시보드 등 다른 모듈과 동일한 “산정 결과” 축을 사용합니다.

**식별·기간**

| 컬럼 | 설명 |
|------|------|
| `id` | UUID PK |
| `company_id` | 회사 ID |
| `period_year` | 산정 연도 (**INTEGER**, 예: 2024) |
| `period_month` | 월별 행 확장 시 사용. **연간 스냅샷은 NULL** |

**Scope 1 (tCO₂e)** — 문서 필드명과 동일

- `scope1_total_tco2e`, `scope1_fixed_combustion_tco2e`, `scope1_mobile_combustion_tco2e`, `scope1_fugitive_tco2e`, `scope1_incineration_tco2e`  
- 현재 에너지 스테이징 기반 모듈은 고정/이동 연소·전력·스팀만 반영하며, 냉매·소각은 0으로 둡니다.

**Scope 2 (tCO₂e)**

- `scope2_location_tco2e` — **basis = `location`** 일 때 전력·스팀 등 Scope2 합계
- `scope2_market_tco2e` — **basis = `market`** 일 때 동일 합계(시장기반 로직 확장 전까지는 계수만 구분 가능)
- `scope2_renewable_tco2e` — 추후 REC 등 반영 시 사용

**Scope 3·합계·메타**

- `scope3_total_tco2e`, Cat별 `scope3_category_*_tco2e` — 현재 모듈에서는 0 또는 NULL
- `total_tco2e` — 당해 스냅샷 총합 (Scope1+2+3)
- `applied_framework` — 예: `GHG_Protocol`
- `calculation_version` — 배출계수·산정 로직 버전 문자열
- `data_quality_score`, `data_quality_level`, `created_at`, `updated_at`

**구현 확장 컬럼** (UI·API 복원용, 마이그레이션에 포함)

| 컬럼 | 설명 |
|------|------|
| `calculation_basis` | `location` \| `market` — 유니크·UPSERT 키의 일부 |
| `monthly_scope_breakdown` | JSONB — `{"01":{"scope1":…,"scope2":…}, …}` |
| `scope_line_items` | JSONB — `scope1_categories` / `scope2_categories` (화면 테이블) |
| `emission_factor_bundle_version` | API 응답의 `emission_factor_version` 과 대응 |
| `verification_status` | 예: `draft` |

**유니크 (연간 1행)**: PostgreSQL **부분 유니크 인덱스**  
`(company_id, period_year, calculation_basis) WHERE period_month IS NULL`

**마이그레이션**: `backend/alembic/versions/029_ghg_scope_calculation_tables.py` 에서 `ghg_emission_factors` 와 함께 정의합니다.

> **폐기**: 초안의 전용 테이블 `ghg_scope_calculation_results` 는 채택하지 않습니다. 저장소는 `GhgEmissionResultRepository` 가 `ghg_emission_results` 만 사용합니다.

### 3.3 Pydantic DTO (요청·응답 스키마)

#### 파일: `backend/domain/v1/ghg_calculation/models/states/scope_calculation.py`

실제 API는 아래 DTO 이름을 사용합니다. (과거 초안의 `ScopeCalculationRequestDto` / `ScopeCalculationResponseDto` / 평면 `line_items` 는 사용하지 않습니다.)

```python
from __future__ import annotations
from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field

class ScopeCalcLineItemDto(BaseModel):
    name: str
    facility: str
    unit: str = "tCO₂eq"
    jan: float = 0.0
    feb: float = 0.0
    mar: float = 0.0
    apr: float = 0.0
    may: float = 0.0
    jun: float = 0.0
    jul: float = 0.0
    aug: float = 0.0
    sep: float = 0.0
    oct: float = 0.0
    nov: float = 0.0
    dec: float = 0.0
    total: float = 0.0
    ef: str = ""
    ef_source: str = ""
    yoy: float = 0.0
    status: Literal["confirmed", "draft", "warning", "error"] = "confirmed"

class ScopeCalcCategoryDto(BaseModel):
    id: str
    category: str
    items: list[ScopeCalcLineItemDto] = Field(default_factory=list)

class ScopeMonthlyPointDto(BaseModel):
    month: str
    scope1: float = 0.0
    scope2: float = 0.0

class ScopeRecalculateRequestDto(BaseModel):
    company_id: UUID
    year: str = Field(..., min_length=4, max_length=4)
    basis: str = Field(default="location", description="location | market")

class ScopeRecalculateResponseDto(BaseModel):
    company_id: str
    year: str
    basis: str
    scope1_total: float
    scope2_total: float
    scope3_total: float = 0.0
    grand_total: float
    monthly_chart: list[ScopeMonthlyPointDto]
    scope1_categories: list[ScopeCalcCategoryDto]
    scope2_categories: list[ScopeCalcCategoryDto]
    emission_factor_version: str = "v1.0"
    calculated_at: datetime
    row_import_status: Literal["confirmed", "draft", "warning", "error"] = "confirmed"
```

---

## 4. 배출계수 마스터 관리

### 4.1 XLSX → DB 로딩 스크립트

**목적**: `GHG_배출계수_마스터_v2.xlsx`를 파싱해 DB에 초기 로드

**파일**: `backend/scripts/load_emission_factors.py`

```python
#!/usr/bin/env python
"""
GHG 배출계수 마스터 XLSX → PostgreSQL 로딩 스크립트
실행: python backend/scripts/load_emission_factors.py
"""
import openpyxl
from sqlalchemy import create_engine, text
from loguru import logger
import os

# 환경변수에서 DB URL 가져오기
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://user:pass@localhost/dbname')

def load_scope1_fixed_combustion(ws, engine):
    """Scope1_고정연소 시트 파싱 및 로드"""
    logger.info("Scope1_고정연소 시트 로딩 시작")
    rows = []
    
    # 헤더: row 4 (No., 연료 종류, 열량계수, ...)
    # 데이터: row 6부터 시작 (공백 제외)
    for i, row in enumerate(ws.iter_rows(min_row=6, values_only=True), start=6):
        if not row[1]:  # 연료 종류 없으면 스킵
            continue
        
        fuel_type = str(row[1]).strip()
        if fuel_type.startswith('기체') or fuel_type.startswith('액체'):
            continue  # 섹션 제목 스킵
        
        calorific_raw = row[2]
        calorific = None
        if calorific_raw and calorific_raw != '성적서 확인':
            try:
                calorific = float(calorific_raw)
            except:
                pass
        
        co2 = float(row[4]) if row[4] else 0
        ch4 = float(row[5]) if row[5] else 0
        n2o = float(row[6]) if row[6] else 0
        composite = float(row[7]) if row[7] else 0
        unit = str(row[8]) if row[8] else 'TJ'
        source = str(row[9]) if row[9] else '환경부 2024 고시'
        notes = str(row[10]) if row[10] else None
        
        rows.append({
            'category': 'scope1_fixed',
            'fuel_type': fuel_type,
            'sub_category': None,
            'source_unit': unit.split('/')[1] if '/' in unit else 'TJ',
            'calorific_value_tj_per_unit': calorific,
            'co2_tco2_per_tj': co2,
            'ch4_kg_per_tj': ch4,
            'n2o_kg_per_tj': n2o,
            'composite_factor': composite,
            'year_applicable': '2024',
            'source': source,
            'version': 'v1.0',
            'notes': notes
        })
    
    logger.info(f"Scope1_고정연소: {len(rows)}개 행 파싱 완료")
    
    with engine.begin() as conn:
        for r in rows:
            conn.execute(text("""
                INSERT INTO ghg_emission_factors 
                (category, fuel_type, sub_category, source_unit, 
                 calorific_value_tj_per_unit, co2_tco2_per_tj, ch4_kg_per_tj, n2o_kg_per_tj, 
                 composite_factor, year_applicable, source, version, notes)
                VALUES 
                (:category, :fuel_type, :sub_category, :source_unit, 
                 :calorific, :co2, :ch4, :n2o, 
                 :composite, :year, :source, :version, :notes)
                ON CONFLICT (category, fuel_type, sub_category, year_applicable, version) 
                DO UPDATE SET 
                    composite_factor = EXCLUDED.composite_factor,
                    updated_at = NOW()
            """), {
                'category': r['category'],
                'fuel_type': r['fuel_type'],
                'sub_category': r['sub_category'],
                'source_unit': r['source_unit'],
                'calorific': r['calorific_value_tj_per_unit'],
                'co2': r['co2_tco2_per_tj'],
                'ch4': r['ch4_kg_per_tj'],
                'n2o': r['n2o_kg_per_tj'],
                'composite': r['composite_factor'],
                'year': r['year_applicable'],
                'source': r['source'],
                'version': r['version'],
                'notes': r['notes']
            })
    
    logger.success(f"✅ Scope1_고정연소: {len(rows)}개 배출계수 로드 완료")

def load_scope1_mobile(ws, engine):
    """Scope1_이동연소 시트 로딩"""
    logger.info("Scope1_이동연소 시트 로딩 시작")
    rows = []
    
    for i, row in enumerate(ws.iter_rows(min_row=5, values_only=True), start=5):
        if not row[1]:  # 구분 없으면 스킵
            continue
        
        sub_cat = str(row[1]).strip()
        if sub_cat.startswith('도로') or sub_cat.startswith('해상'):
            continue
        
        fuel = str(row[2]).strip() if row[2] else ''
        co2 = float(row[3]) if row[3] else 0
        ch4 = float(row[4]) if row[4] else 0
        n2o = float(row[5]) if row[5] else 0
        composite = float(row[6]) if row[6] else 0
        unit = str(row[7]) if row[7] else 'TJ'
        source = str(row[8]) if row[8] else '환경부 2024'
        
        rows.append({
            'category': 'scope1_mobile',
            'fuel_type': fuel,
            'sub_category': sub_cat,
            'source_unit': unit.split('/')[1] if '/' in unit else 'TJ',
            'co2_tco2_per_tj': co2,
            'ch4_kg_per_tj': ch4,
            'n2o_kg_per_tj': n2o,
            'composite_factor': composite,
            'year_applicable': '2024',
            'source': source,
            'version': 'v1.0'
        })
    
    logger.info(f"Scope1_이동연소: {len(rows)}개 행 파싱")
    
    with engine.begin() as conn:
        for r in rows:
            conn.execute(text("""
                INSERT INTO ghg_emission_factors 
                (category, fuel_type, sub_category, source_unit, 
                 co2_tco2_per_tj, ch4_kg_per_tj, n2o_kg_per_tj, 
                 composite_factor, year_applicable, source, version)
                VALUES 
                (:cat, :fuel, :sub, :unit, :co2, :ch4, :n2o, 
                 :composite, :year, :source, :version)
                ON CONFLICT (category, fuel_type, sub_category, year_applicable, version) 
                DO UPDATE SET composite_factor = EXCLUDED.composite_factor
            """), {
                'cat': r['category'],
                'fuel': r['fuel_type'],
                'sub': r['sub_category'],
                'unit': r['source_unit'],
                'co2': r['co2_tco2_per_tj'],
                'ch4': r['ch4_kg_per_tj'],
                'n2o': r['n2o_kg_per_tj'],
                'composite': r['composite_factor'],
                'year': r['year_applicable'],
                'source': r['source'],
                'version': r['version']
            })
    
    logger.success(f"✅ Scope1_이동연소: {len(rows)}개 로드 완료")

def load_scope1_fugitive(ws, engine):
    """Scope1_공정·냉매 시트 로딩 (GWP 기반)"""
    logger.info("Scope1_공정·냉매 시트 로딩 시작")
    rows = []
    
    # 냉매 섹션만 파싱 (row 4부터 시작)
    for i, row in enumerate(ws.iter_rows(min_row=5, values_only=True), start=5):
        if not row[0]:  # 냉매 종류 없으면 스킵
            continue
        
        refrigerant = str(row[0]).strip()
        if '냉매' in refrigerant or '계수' in refrigerant:
            continue
        
        gwp_ar5 = int(row[2]) if row[2] and str(row[2]).isdigit() else None
        if not gwp_ar5:
            continue
        
        rows.append({
            'category': 'scope1_fugitive',
            'fuel_type': refrigerant,
            'source_unit': 'kg',
            'gwp_ar5': gwp_ar5,
            'composite_factor': gwp_ar5 / 1000.0,  # kg → tCO₂eq
            'year_applicable': '2024',
            'source': 'IPCC AR5',
            'version': 'v1.0'
        })
    
    logger.info(f"Scope1_냉매: {len(rows)}개 행 파싱")
    
    with engine.begin() as conn:
        for r in rows:
            conn.execute(text("""
                INSERT INTO ghg_emission_factors 
                (category, fuel_type, source_unit, gwp_ar5, 
                 composite_factor, year_applicable, source, version)
                VALUES 
                (:cat, :fuel, :unit, :gwp, :composite, :year, :source, :version)
                ON CONFLICT (category, fuel_type, sub_category, year_applicable, version) 
                DO UPDATE SET composite_factor = EXCLUDED.composite_factor
            """), {
                'cat': r['category'],
                'fuel': r['fuel_type'],
                'unit': r['source_unit'],
                'gwp': r['gwp_ar5'],
                'composite': r['composite_factor'],
                'year': r['year_applicable'],
                'source': r['source'],
                'version': r['version']
            })
    
    logger.success(f"✅ Scope1_냉매: {len(rows)}개 로드 완료")

def load_scope2_electricity(ws, engine):
    """Scope2_전력·스팀 시트 로딩"""
    logger.info("Scope2_전력·스팀 시트 로딩 시작")
    rows = []
    
    # 전력 배출계수 연도별 (row 5부터)
    for i, row in enumerate(ws.iter_rows(min_row=5, max_row=12, values_only=True), start=5):
        if not row[0] or not str(row[0]).isdigit():
            continue
        
        year = str(row[0])
        factor = float(row[1]) if row[1] else 0
        
        rows.append({
            'category': 'scope2_electricity',
            'fuel_type': 'Grid',
            'source_unit': 'MWh',
            'composite_factor': factor,
            'year_applicable': year,
            'source': f'{year}년 환경부 전력 배출계수',
            'version': 'v1.0'
        })
    
    # 스팀 (지역난방)
    rows.append({
        'category': 'scope2_heat',
        'fuel_type': 'Steam',
        'source_unit': 'TJ',
        'composite_factor': 45.0,
        'year_applicable': '2024',
        'source': '환경부 지역난방 배출계수',
        'version': 'v1.0'
    })
    
    logger.info(f"Scope2: {len(rows)}개 행 파싱")
    
    with engine.begin() as conn:
        for r in rows:
            conn.execute(text("""
                INSERT INTO ghg_emission_factors 
                (category, fuel_type, source_unit, composite_factor, 
                 year_applicable, source, version)
                VALUES 
                (:cat, :fuel, :unit, :composite, :year, :source, :version)
                ON CONFLICT (category, fuel_type, sub_category, year_applicable, version) 
                DO UPDATE SET composite_factor = EXCLUDED.composite_factor
            """), {
                'cat': r['category'],
                'fuel': r['fuel_type'],
                'unit': r['source_unit'],
                'composite': r['composite_factor'],
                'year': r['year_applicable'],
                'source': r['source'],
                'version': r['version']
            })
    
    logger.success(f"✅ Scope2: {len(rows)}개 로드 완료")

def main():
    """메인 실행 함수"""
    logger.info("=== GHG 배출계수 마스터 로딩 시작 ===")
    
    xlsx_path = r'C:\Users\여태호\Downloads\GHG_배출계수_마스터_v2.xlsx'
    if not os.path.exists(xlsx_path):
        logger.error(f"파일 없음: {xlsx_path}")
        return
    
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    engine = create_engine(DATABASE_URL)
    
    try:
        load_scope1_fixed_combustion(wb['Scope1_고정연소'], engine)
        load_scope1_mobile(wb['Scope1_이동연소'], engine)
        load_scope1_fugitive(wb['Scope1_공정·냉매'], engine)
        load_scope2_electricity(wb['Scope2_전력·스팀'], engine)
        
        logger.success("=== ✅ 모든 배출계수 로드 완료 ===")
    except Exception as e:
        logger.exception(f"로딩 실패: {e}")
    finally:
        wb.close()
        engine.dispose()

if __name__ == '__main__':
    main()
```

**실행 방법**:
```bash
cd backend
python scripts/load_emission_factors.py
```

### 4.2 배출계수 조회 서비스

**파일**: `backend/domain/v1/ghg_calculation/hub/services/emission_factor_service.py`

```python
from __future__ import annotations
from sqlalchemy import text
from loguru import logger

try:
    from ifrs_agent.database.base import get_session
except ImportError:
    from backend.domain.v1.ifrs_agent.database.base import get_session

class EmissionFactorService:
    """배출계수 조회 전담 서비스"""
    
    def get_factor(
        self, 
        category: str, 
        fuel_type: str, 
        year: str = '2024',
        sub_category: str | None = None
    ) -> dict | None:
        """
        배출계수 조회.
        
        Args:
            category: 'scope1_fixed', 'scope1_mobile', 'scope1_fugitive', 
                     'scope2_electricity', 'scope2_heat'
            fuel_type: 'LNG', 'Diesel', 'HFC-410A', 'Grid', 'Steam' 등
            year: 적용 연도 (기본 '2024')
            sub_category: 세부 구분 (선택)
        
        Returns:
            {
                'id': UUID,
                'factor': float,  # composite_factor
                'unit': str,
                'source': str,
                'gwp': int | None
            }
            또는 None (계수 없음)
        """
        session = get_session()
        try:
            query = """
                SELECT id, composite_factor, source_unit, source, gwp_ar5
                FROM ghg_emission_factors
                WHERE category = :cat 
                  AND fuel_type = :fuel
                  AND year_applicable = :year
                  AND is_active = TRUE
            """
            params = {'cat': category, 'fuel': fuel_type, 'year': year}
            
            if sub_category:
                query += " AND sub_category = :sub"
                params['sub'] = sub_category
            
            query += " ORDER BY version DESC LIMIT 1"
            
            result = session.execute(text(query), params).fetchone()
            
            if not result:
                logger.warning(
                    f"배출계수 없음: category={category}, fuel={fuel_type}, "
                    f"year={year}, sub={sub_category}"
                )
                return None
            
            return {
                'id': str(result[0]),
                'factor': float(result[1]),
                'unit': result[2],
                'source': result[3],
                'gwp': result[4]
            }
        finally:
            session.close()
    
    def get_factors_bulk(
        self,
        category: str,
        fuel_types: list[str],
        year: str = '2024'
    ) -> dict[str, dict]:
        """
        여러 연료의 배출계수 일괄 조회 (성능 최적화).
        
        Returns:
            {'LNG': {...}, 'Diesel': {...}, ...}
        """
        session = get_session()
        try:
            result = session.execute(text("""
                SELECT fuel_type, id, composite_factor, source_unit, source, gwp_ar5
                FROM ghg_emission_factors
                WHERE category = :cat 
                  AND fuel_type = ANY(:fuels)
                  AND year_applicable = :year
                  AND is_active = TRUE
                ORDER BY fuel_type, version DESC
            """), {
                'cat': category,
                'fuels': fuel_types,
                'year': year
            }).fetchall()
            
            factors = {}
            for row in result:
                fuel = row[0]
                if fuel not in factors:  # 첫 번째(최신 버전)만
                    factors[fuel] = {
                        'id': str(row[1]),
                        'factor': float(row[2]),
                        'unit': row[3],
                        'source': row[4],
                        'gwp': row[5]
                    }
            
            return factors
        finally:
            session.close()
```

---

## 5. 산정 로직 상세 설계

### 5.1 Scope 1 고정연소 산정

**파일**: `backend/domain/v1/ghg_calculation/hub/services/scope1_calculation_service.py`

```python
from __future__ import annotations
from typing import Any
from loguru import logger
from backend.domain.v1.ghg_calculation.hub.services.emission_factor_service import (
    EmissionFactorService
)

class Scope1CalculationService:
    """Scope 1 배출량 산정 (고정·이동·냉매)"""
    
    def __init__(self, ef_service: EmissionFactorService):
        self._ef = ef_service
    
    def calculate_fixed_combustion(
        self, 
        items: list[dict[str, Any]], 
        year: str
    ) -> list[dict[str, Any]]:
        """
        고정연소 배출량 산정.
        
        공식: 배출량 = 사용량 × 배출계수(tCO₂eq/단위)
        
        Args:
            items: 스테이징 데이터 (연료 연소 필터링된 행)
            year: 산정 연도
        
        Returns:
            [
                {
                    'category': 'LNG 고정연소',
                    'facility': '수원DC',
                    'month': '01',
                    'emission_tco2e': 123.45,
                    'activity_usage': 56789.0,
                    'activity_unit': 'Nm³',
                    'ef_id': 'uuid',
                    'ef_value': 0.002176,
                    'ef_source': '환경부 2024 고시',
                    'scope': 'scope1',
                    'sub_category': 'fixed',
                    'staging_id': 'uuid'
                },
                ...
            ]
        """
        results = []
        
        # 연료별 계수 일괄 조회 (성능 최적화)
        unique_fuels = list(set(
            self._normalize_fuel_type(it) 
            for it in items 
            if self._normalize_fuel_type(it)
        ))
        factors_map = self._ef.get_factors_bulk('scope1_fixed', unique_fuels, year)
        
        for it in items:
            fuel_type = self._normalize_fuel_type(it)
            if not fuel_type or fuel_type not in factors_map:
                logger.warning(f"연료 매칭 실패: {it.get('energy_type')}")
                continue
            
            ef = factors_map[fuel_type]
            usage = float(it.get('usage_amount') or it.get('consumption_kwh') or 0)
            if usage <= 0:
                continue
            
            # 직접 배출계수 적용
            emission_tco2e = usage * ef['factor']
            
            results.append({
                'category': f'{fuel_type} 고정연소',
                'facility': it.get('facility') or it.get('site_name') or '미상',
                'month': self._parse_month(it),
                'emission_tco2e': emission_tco2e,
                'activity_usage': usage,
                'activity_unit': it.get('unit') or ef['unit'],
                'ef_id': ef['id'],
                'ef_value': ef['factor'],
                'ef_source': ef['source'],
                'scope': 'scope1',
                'sub_category': 'fixed',
                'staging_id': it.get('_staging_id'),
                'staging_system': it.get('_staging_system')
            })
        
        logger.info(f"✅ Scope1 고정연소: {len(results)}개 행 산정 완료")
        return results
    
    def _normalize_fuel_type(self, it: dict) -> str | None:
        """
        연료명 정규화.
        
        매핑 규칙:
        - LNG / 천연가스 / Natural Gas → 'LNG'
        - 경유 / Diesel → 'Diesel'
        - 휘발유 / Gasoline → 'Gasoline'
        """
        raw = str(it.get('energy_type') or it.get('fuel_type') or '').strip().lower()
        
        mapping = {
            'lng': 'LNG',
            '천연가스': 'LNG',
            'natural gas': 'LNG',
            '경유': 'Diesel',
            'diesel': 'Diesel',
            '휘발유': 'Gasoline',
            'gasoline': 'Gasoline',
            'lpg': 'LPG',
            '액화석유가스': 'LPG',
            '중유': 'Heavy Oil',
            'b-c': 'Heavy Oil',
            '등유': 'Kerosene',
            'kerosene': 'Kerosene'
        }
        
        for key, standard in mapping.items():
            if key in raw:
                return standard
        
        return None
    
    def _parse_month(self, it: dict) -> str:
        """월 파싱 (01~12 형식)"""
        m = it.get('month') or it.get('월')
        if m:
            try:
                return f"{int(m):02d}"
            except:
                pass
        
        # 날짜 필드에서 추출
        for key in ['date', 'usage_date', '일자']:
            date_str = str(it.get(key) or '')
            if len(date_str) >= 6:  # YYYYMM 형식
                try:
                    return date_str[4:6]
                except:
                    pass
        
        return '01'  # 기본값
    
    def calculate_mobile_combustion(
        self,
        items: list[dict],
        year: str
    ) -> list[dict]:
        """이동연소 배출량 산정 (차량·선박 등)"""
        results = []
        
        for it in items:
            fuel = self._normalize_fuel_type(it)
            if not fuel:
                continue
            
            vehicle_type = self._detect_vehicle_type(it)  # 'vehicle', 'ship', 'aircraft'
            
            ef = self._ef.get_factor('scope1_mobile', fuel, year, sub_category=vehicle_type)
            if not ef:
                continue
            
            usage = float(it.get('usage_amount') or 0)
            if usage <= 0:
                continue
            
            emission_tco2e = usage * ef['factor']
            
            results.append({
                'category': f'{fuel} 이동연소 ({vehicle_type})',
                'facility': it.get('facility', '전사'),
                'month': self._parse_month(it),
                'emission_tco2e': emission_tco2e,
                'activity_usage': usage,
                'activity_unit': it.get('unit', ef['unit']),
                'ef_id': ef['id'],
                'ef_value': ef['factor'],
                'ef_source': ef['source'],
                'scope': 'scope1',
                'sub_category': 'mobile',
                'staging_id': it.get('_staging_id')
            })
        
        logger.info(f"✅ Scope1 이동연소: {len(results)}개 행 산정")
        return results
    
    def _detect_vehicle_type(self, it: dict) -> str:
        """차량 유형 감지"""
        desc = str(it).lower()
        if 'ship' in desc or '선박' in desc:
            return 'ship'
        if 'aircraft' in desc or '항공' in desc:
            return 'aircraft'
        return 'vehicle'
    
    def calculate_fugitive_refrigerant(
        self,
        items: list[dict],
        year: str
    ) -> list[dict]:
        """
        냉매 탈루 배출량 산정.
        
        공식: 배출량 = 누설량(kg) × GWP / 1000
        """
        results = []
        
        for it in items:
            refrigerant = self._normalize_refrigerant(it)
            if not refrigerant:
                continue
            
            ef = self._ef.get_factor('scope1_fugitive', refrigerant, year)
            if not ef or not ef.get('gwp'):
                logger.warning(f"냉매 계수 없음: {refrigerant}")
                continue
            
            leakage_kg = float(
                it.get('leakage_kg') or 
                it.get('usage_kg') or 
                it.get('refill_kg') or 0
            )
            if leakage_kg <= 0:
                continue
            
            emission_tco2e = leakage_kg * ef['gwp'] / 1000.0
            
            results.append({
                'category': f'{refrigerant} 냉매 탈루',
                'facility': it.get('facility', '미상'),
                'month': self._parse_month(it),
                'emission_tco2e': emission_tco2e,
                'activity_usage': leakage_kg,
                'activity_unit': 'kg',
                'ef_id': ef['id'],
                'ef_value': ef['gwp'],
                'ef_source': ef['source'],
                'scope': 'scope1',
                'sub_category': 'fugitive',
                'staging_id': it.get('_staging_id')
            })
        
        logger.info(f"✅ Scope1 냉매 탈루: {len(results)}개 행 산정")
        return results
    
    def _normalize_refrigerant(self, it: dict) -> str | None:
        """냉매명 정규화"""
        raw = str(it.get('refrigerant') or it.get('chemical_name') or '').strip().upper()
        
        # HFC-410A, R-410A 등 정규화
        if 'R-' in raw:
            raw = raw.replace('R-', 'HFC-')
        if 'HFC' in raw or 'PFC' in raw or 'SF6' in raw:
            return raw
        
        return None
```

### 5.2 Scope 2 전력·스팀 산정

**파일**: `backend/domain/v1/ghg_calculation/hub/services/scope2_calculation_service.py`

```python
from __future__ import annotations
from typing import Any, Literal
from loguru import logger
from backend.domain.v1.ghg_calculation.hub.services.emission_factor_service import (
    EmissionFactorService
)

class Scope2CalculationService:
    """Scope 2 배출량 산정 (전력·스팀·열)"""
    
    def __init__(self, ef_service: EmissionFactorService):
        self._ef = ef_service
    
    def calculate_electricity(
        self,
        items: list[dict],
        year: str,
        basis: Literal['location', 'market'] = 'location'
    ) -> list[dict]:
        """
        전력 배출량 산정.
        
        공식:
        - Location-based: MWh × 국가 계통 계수
        - Market-based: (MWh - REC/PPA) × 국가 계통 계수
        
        Args:
            items: 전력 사용 데이터
            year: 산정 연도
            basis: 'location' 또는 'market'
        """
        results = []
        
        ef = self._ef.get_factor('scope2_electricity', 'Grid', year)
        if not ef:
            raise ValueError(f"전력 배출계수 없음: year={year}")
        
        base_factor = ef['factor']
        
        for it in items:
            usage_kwh = float(
                it.get('consumption_kwh') or 
                it.get('usage_kwh') or 
                it.get('usage_amount') or 0
            )
            if usage_kwh <= 0:
                continue
            
            usage_mwh = usage_kwh / 1000.0
            
            # Market-based 조정
            factor = base_factor
            renewable_mwh = 0.0
            
            if basis == 'market':
                rec_kwh = float(it.get('rec_purchased_kwh') or 0)
                ppa_kwh = float(it.get('ppa_kwh') or 0)
                renewable_kwh = rec_kwh + ppa_kwh
                renewable_mwh = renewable_kwh / 1000.0
                
                if renewable_mwh > 0:
                    # 재생에너지 비율만큼 계수 감소
                    net_mwh = max(0, usage_mwh - renewable_mwh)
                    factor = base_factor * (net_mwh / usage_mwh) if usage_mwh > 0 else 0
            
            emission_tco2e = usage_mwh * factor
            
            results.append({
                'category': f'전력 ({basis})',
                'facility': it.get('facility') or it.get('site_name') or '전사',
                'month': self._parse_month(it),
                'emission_tco2e': emission_tco2e,
                'activity_usage': usage_mwh,
                'activity_unit': 'MWh',
                'ef_id': ef['id'],
                'ef_value': factor,
                'ef_source': ef['source'],
                'scope': 'scope2',
                'sub_category': 'electricity',
                'staging_id': it.get('_staging_id'),
                'renewable_mwh': renewable_mwh if basis == 'market' else None
            })
        
        logger.info(f"✅ Scope2 전력 ({basis}): {len(results)}개 행 산정")
        return results
    
    def calculate_heat(self, items: list[dict], year: str) -> list[dict]:
        """스팀·열 배출량 산정"""
        results = []
        
        ef = self._ef.get_factor('scope2_heat', 'Steam', year)
        if not ef:
            logger.warning(f"스팀 배출계수 없음: year={year}")
            return results
        
        for it in items:
            usage_tj = float(it.get('usage_tj') or 0)
            if usage_tj <= 0:
                # GJ → TJ 환산
                usage_gj = float(it.get('usage_gj') or 0)
                if usage_gj > 0:
                    usage_tj = usage_gj / 1000.0
            
            if usage_tj <= 0:
                continue
            
            emission_tco2e = usage_tj * ef['factor']
            
            results.append({
                'category': '스팀/열 구매',
                'facility': it.get('facility', '전사'),
                'month': self._parse_month(it),
                'emission_tco2e': emission_tco2e,
                'activity_usage': usage_tj,
                'activity_unit': 'TJ',
                'ef_id': ef['id'],
                'ef_value': ef['factor'],
                'ef_source': ef['source'],
                'scope': 'scope2',
                'sub_category': 'heat',
                'staging_id': it.get('_staging_id')
            })
        
        logger.info(f"✅ Scope2 스팀/열: {len(results)}개 행 산정")
        return results
    
    def _parse_month(self, it: dict) -> str:
        """월 파싱"""
        m = it.get('month') or it.get('월')
        if m:
            try:
                return f"{int(m):02d}"
            except:
                pass
        return '01'
```

---

## 6. API 인터페이스 설계

### 6.1 오케스트레이터·저장소 (현재 구현)

**오케스트레이터** — `backend/domain/v1/ghg_calculation/hub/orchestrator/scope_calculation_orchestrator.py`  
클래스 `ScopeCalculationOrchestrator` 가 스테이징 집계(`raw_data_inquiry_service.aggregate_energy_activity_by_month_for_year`), `EmissionFactorService`, 카테고리 분류, 월별 합계를 수행한 뒤 `GhgEmissionResultRepository.upsert_annual_scope_calc` 로 **`ghg_emission_results`** 에 반영합니다.

- Scope1 고정·이동 합계 → `scope1_fixed_combustion_tco2e`, `scope1_mobile_combustion_tco2e`, `scope1_total_tco2e`
- Scope2 → `basis` 가 `location` 이면 `scope2_location_tco2e`, `market` 이면 `scope2_market_tco2e`
- UI 복원용 JSONB: `monthly_scope_breakdown`, `scope_line_items`
- `applied_framework='GHG_Protocol'`, `calculation_version`·`emission_factor_bundle_version` 에 버전 문자열

**저장소** — `backend/domain/v1/ghg_calculation/hub/repositories/ghg_emission_result_repository.py`  
클래스 `GhgEmissionResultRepository`: `upsert_annual_scope_calc`, `get_annual_scope_calc` (조회 시 API용 dict 로 `monthly_breakdown` / `line_items_payload` 키 매핑).

**충돌 처리**: `ON CONFLICT (company_id, period_year, calculation_basis) WHERE (period_month IS NULL) DO UPDATE`

### 6.2 (참고) 초안 의사코드 — 미반영

과거 문서에 있던 **분리된 Scope1CalculationService / Scope2CalculationService** 및 **ghg_scope_calculation_results** 전용 저장소 예시는 **현재 코드베이스에 없음**. 모듈 분리·냉매 산정 등은 후속 단계에서 ghg_emission_results 컬럼과 함께 확장합니다.

### 6.3 FastAPI Router

**파일**: `backend/api/v1/ghg_calculation/scope_calculation_router.py`

- `POST /ghg-calculation/scope/recalculate` — 본문: `ScopeRecalculateRequestDto` (`company_id`, `year`, `basis`)
- `GET /ghg-calculation/scope/results?company_id=&year=&basis=` — 쿼리 파라미터(경로 변수 아님)

```python
from uuid import UUID
from fastapi import APIRouter, HTTPException, Query
from backend.domain.v1.ghg_calculation.hub.orchestrator.scope_calculation_orchestrator import (
    ScopeCalculationOrchestrator,
)
from backend.domain.v1.ghg_calculation.models.states import (
    ScopeRecalculateRequestDto,
    ScopeRecalculateResponseDto,
)

scope_calculation_router = APIRouter(prefix="/scope", tags=["GHG Scope Calculation"])
_orch = ScopeCalculationOrchestrator()

@scope_calculation_router.post("/recalculate", response_model=ScopeRecalculateResponseDto)
def post_scope_recalculate(body: ScopeRecalculateRequestDto) -> ScopeRecalculateResponseDto:
    return _orch.recalculate(body.company_id, body.year.strip(), (body.basis or "location").strip())

@scope_calculation_router.get("/results", response_model=ScopeRecalculateResponseDto)
def get_scope_results(
    company_id: UUID = Query(...),
    year: str = Query(..., min_length=4, max_length=4),
    basis: str = Query("location"),
) -> ScopeRecalculateResponseDto:
    row = _orch.get_stored_results(company_id, year.strip(), basis.strip() or "location")
    if row is None:
        raise HTTPException(status_code=404, detail="저장된 산정 결과가 없습니다.")
    return row
```

**Router 등록** (`backend/api/v1/ghg_calculation/routes.py`):

```python
from .raw_data_router import raw_data_router
from .scope_calculation_router import scope_calculation_router

router = APIRouter(prefix="/ghg-calculation", tags=["GHG Calculation"])
router.include_router(raw_data_router)
router.include_router(scope_calculation_router)
```

---

## 7. 프론트엔드 연동

### 7.1 타입 정의

**참고**: 구현에서는 `ghgScopeCalculationData.ts` 의 `ScopeRecalculateApiResponse` 등으로 API 응답을 매핑할 수 있습니다. 아래는 초안 예시 타입입니다.

**파일 (예시)**: `frontend/src/app/(main)/ghg_calc/lib/scopeCalculationTypes.ts`

```typescript
export interface ScopeCalculationRequest {
  company_id: string;
  year: string;
  basis: 'location' | 'market';
  recalculate?: boolean;
  emission_factor_version?: string;
}

export interface ScopeCalculationLineItem {
  category: string;
  facility: string;
  scope: 'scope1' | 'scope2' | 'scope3';
  sub_category: string;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  total: number;
  emission_factor_id?: string;
  emission_factor_value?: number;
  emission_factor_source?: string;
  activity_data_source: string;
  unit: string;
  status: 'draft' | 'confirmed' | 'warning';
  yoy_change_pct?: number;
}

export interface ScopeCalculationResponse {
  company_id: string;
  year: string;
  basis: string;
  scope1_total: number;
  scope2_total: number;
  scope3_total: number;
  grand_total: number;
  monthly_totals: Record<string, { scope1: number; scope2: number; scope3: number }>;
  line_items: ScopeCalculationLineItem[];
  calculation_timestamp: string;
  emission_factor_version: string;
  verification_status?: string;
}
```

### 7.2 API 호출 함수

**파일**: `frontend/src/app/(main)/ghg_calc/lib/scopeCalculationApi.ts`

```typescript
import { fetchWithAuthJson } from '@/store/authSessionStore';
import type { 
  ScopeCalculationRequest, 
  ScopeCalculationResponse 
} from './scopeCalculationTypes';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:9004';

export async function recalculateScopeEmissions(
  req: ScopeCalculationRequest
): Promise<ScopeCalculationResponse> {
  const res = await fetchWithAuthJson(
    `${API_BASE}/ghg-calculation/scope/recalculate`,
    {
      method: 'POST',
      jsonBody: req
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`산정 실패 (${res.status}): ${errText}`);
  }

  return (await res.json()) as ScopeCalculationResponse;
}

export async function getSavedCalculationResult(
  companyId: string,
  year: string,
  basis: 'location' | 'market' = 'location'
): Promise<ScopeCalculationResponse | null> {
  const q = new URLSearchParams({ company_id: companyId, year, basis });
  const res = await fetchWithAuthJson(
    `${API_BASE}/ghg-calculation/scope/results?${q.toString()}`,
    { method: 'GET' }
  );

  if (res.status === 404) {
    return null; // 결과 없음
  }

  if (!res.ok) {
    throw new Error(`결과 조회 실패 (${res.status})`);
  }

  return (await res.json()) as ScopeCalculationResponse;
}
```

### 7.3 ScopeCalculation 컴포넌트 수정

**파일**: `frontend/src/app/(main)/ghg_calc/components/ghg/ScopeCalculation.tsx`  

**현재 구현**: 아래는 초안 예시입니다. 실제 코드는 동 파일에서 `fetchWithAuthJson`, `mergeScopeCalculationWithApi12`, `ScopeRecalculateApiResponse` 를 사용합니다.

```typescript
'use client';

import { useMemo, useState, useEffect } from 'react';
import { RefreshCw, Download, /* ... 기타 아이콘 */ } from 'lucide-react';
import { useAuthSessionStore } from '@/store/authSessionStore';
import { 
  recalculateScopeEmissions, 
  getSavedCalculationResult 
} from '../../lib/scopeCalculationApi';
import type { ScopeCalculationResponse } from '../../lib/scopeCalculationTypes';

export function ScopeCalculation() {
  const [activeScope, setActiveScope] = useState<'scope1' | 'scope2' | 'scope3'>('scope1');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcDone, setRecalcDone] = useState(false);
  
  // 백엔드에서 가져온 실제 산정 결과
  const [calculationResult, setCalculationResult] = useState<ScopeCalculationResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const companyId = useAuthSessionStore((s) => s.user?.company_id?.trim() ?? '');

  // 초기 로드: 저장된 결과 조회
  useEffect(() => {
    if (!companyId) return;
    
    const loadSavedResult = async () => {
      try {
        const result = await getSavedCalculationResult(companyId, selectedYear, 'location');
        if (result) {
          setCalculationResult(result);
        }
      } catch (e) {
        console.error('저장된 결과 로드 실패:', e);
      }
    };
    
    void loadSavedResult();
  }, [companyId, selectedYear]);

  // 재계산 버튼 클릭
  const handleRecalculate = async () => {
    if (!companyId) {
      alert('회사 ID가 없습니다.');
      return;
    }
    
    setIsRecalculating(true);
    setRecalcDone(false);
    setLoadError(null);
    
    try {
      const result = await recalculateScopeEmissions({
        company_id: companyId,
        year: selectedYear,
        basis: 'location',
        recalculate: true,
        emission_factor_version: 'v1.0_2024'
      });
      
      setCalculationResult(result);
      setRecalcDone(true);
      
      // 3초 후 완료 배지 제거
      setTimeout(() => setRecalcDone(false), 3000);
      
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      setLoadError(msg);
      alert(`산정 중 오류 발생: ${msg}`);
    } finally {
      setIsRecalculating(false);
    }
  };

  // 결과가 없으면 기본 메시지
  if (!calculationResult) {
    return (
      <div className="p-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
          {loadError 
            ? `오류: ${loadError}` 
            : '산정 결과가 없습니다. "재계산" 버튼을 눌러 산정을 시작하세요.'}
        </div>
        <button
          type="button"
          onClick={handleRecalculate}
          disabled={isRecalculating}
          className="mt-4 flex items-center gap-1.5 px-3 py-2 text-xs text-blue-600 border border-blue-300 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
        >
          <RefreshCw size={13} className={isRecalculating ? 'animate-spin' : ''} />
          {isRecalculating ? '재계산 중...' : '재계산'}
        </button>
      </div>
    );
  }

  // 데이터 변환
  const totals = {
    scope1: calculationResult.scope1_total,
    scope2: calculationResult.scope2_total,
    scope3: calculationResult.scope3_total
  };
  const grandTotal = calculationResult.grand_total;

  // 월별 차트 데이터
  const monthlyChart = Object.entries(calculationResult.monthly_totals).map(([month, values]) => ({
    month: `${month}월`,
    scope1: values.scope1,
    scope2: values.scope2,
    scope3: values.scope3
  }));

  // 카테고리별 그룹핑
  const scope1Categories = [
    {
      id: 'fixed',
      category: '고정연소',
      items: calculationResult.line_items.filter(
        li => li.scope === 'scope1' && li.sub_category === 'fixed'
      )
    },
    {
      id: 'mobile',
      category: '이동연소',
      items: calculationResult.line_items.filter(
        li => li.scope === 'scope1' && li.sub_category === 'mobile'
      )
    },
    {
      id: 'fugitive',
      category: '공정·탈루',
      items: calculationResult.line_items.filter(
        li => li.scope === 'scope1' && li.sub_category === 'fugitive'
      )
    }
  ];

  const scope2Categories = [
    {
      id: 'electricity',
      category: '전력',
      items: calculationResult.line_items.filter(
        li => li.scope === 'scope2' && li.sub_category === 'electricity'
      )
    },
    {
      id: 'heat',
      category: '스팀/열',
      items: calculationResult.line_items.filter(
        li => li.scope === 'scope2' && li.sub_category === 'heat'
      )
    }
  ];

  // 전년 대비는 추후 구현 (현재 0으로 고정)
  const grandYoyPct = 0;
  const s1yoy = 0;
  const s2yoy = 0;
  const s3yoy = 0;

  const formatInt = (n: number) => Math.round(n).toLocaleString('ko-KR');

  return (
    <div className="p-5 space-y-4">
      {/* 기존 UI 유지, 데이터만 교체 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-gray-900 mt-1">Scope별 배출량 산정 결과</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            백엔드 산정 결과 · 마지막 계산: {new Date(calculationResult.calculation_timestamp).toLocaleString('ko-KR')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {recalcDone && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
              ✓ 재계산 완료
            </span>
          )}
          <button
            type="button"
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-blue-600 border border-blue-300 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
          >
            <RefreshCw size={13} className={isRecalculating ? 'animate-spin' : ''} />
            {isRecalculating ? '재계산 중...' : '재계산'}
          </button>
        </div>
      </div>

      {/* 상단 카드: 합계 표시 */}
      <div className="grid grid-cols-4 gap-3">
        {/* 전체 합계 카드 */}
        {/* Scope1, Scope2, Scope3 카드 */}
        {/* ... 기존 코드 유지 ... */}
      </div>

      {/* 월별 차트 & 구성비 */}
      {/* ... 기존 차트 코드, monthlyChart 데이터 사용 ... */}

      {/* 카테고리별 테이블 */}
      {/* ... scope1Categories, scope2Categories 사용 ... */}
    </div>
  );
}
```

---

## 8. 구현 순서 및 마일스톤

### Phase 1: 기반 구축 (1주)

**목표**: DB 스키마·배출계수 로드·DTO 정의

| Task | 상세 | 산출물 |
|------|------|--------|
| 1.1 DB 마이그레이션 | `ghg_emission_factors`, `ghg_emission_results` 테이블 생성 | `029_ghg_scope_calculation_tables.py` |
| 1.2 배출계수 로딩 스크립트 | XLSX 파싱 → DB INSERT | `load_emission_factors.py` |
| 1.3 Pydantic DTO | 요청·응답 스키마 정의 | `scope_calculation.py` |
| 1.4 EmissionFactorService | 배출계수 조회 서비스 | `emission_factor_service.py` |

**완료 기준**: 
- ✅ `alembic upgrade head` 성공
- ✅ 배출계수 100개 이상 로드
- ✅ DTO Validation 테스트 통과

---

### Phase 2: Scope 1 산정 로직 (1주)

**목표**: 고정·이동·냉매 산정 구현

| Task | 상세 | 테스트 |
|------|------|--------|
| 2.1 Scope1CalculationService | 고정연소·이동연소·냉매 로직 | `test_scope1_calculation.py` |
| 2.2 연료명 정규화 | `_normalize_fuel_type` 함수 | 50개 연료명 매핑 테스트 |
| 2.3 단위 테스트 | pytest로 각 메서드 검증 | 커버리지 > 80% |

**테스트 케이스 예시**:

```python
def test_calculate_fixed_combustion_lng():
    """LNG 고정연소 산정 테스트"""
    service = Scope1CalculationService(EmissionFactorService())
    items = [
        {
            'energy_type': 'LNG',
            'usage_amount': 100000,  # Nm³
            'unit': 'Nm³',
            'facility': '수원DC',
            'month': '01',
            'year': '2024',
            '_staging_id': 'test-id'
        }
    ]
    
    results = service.calculate_fixed_combustion(items, '2024')
    
    assert len(results) == 1
    assert results[0]['category'] == 'LNG 고정연소'
    assert results[0]['emission_tco2e'] == pytest.approx(217.6, rel=0.01)  # 100000 × 0.002176
    assert results[0]['scope'] == 'scope1'
```

---

### Phase 3: Scope 2 산정 로직 (3일)

**목표**: 전력·스팀 산정 구현

| Task | 상세 |
|------|------|
| 3.1 Scope2CalculationService | 전력(location/market), 스팀 로직 |
| 3.2 Market-based 로직 | REC/PPA 조달 처리 |
| 3.3 단위 테스트 | Location vs Market 결과 비교 |

---

### Phase 4: Orchestrator & API (3일)

**목표**: 비즈니스 로직 통합 및 API 엔드포인트

| Task | 상세 |
|------|------|
| 4.1 ScopeCalculationOrchestrator | 전체 플로우 통합 |
| 4.2 GhgEmissionResultRepository | `ghg_emission_results` 저장·조회 |
| 4.3 FastAPI Router | `/scope/recalculate`, `/scope/results` |
| 4.4 통합 테스트 | End-to-End 시나리오 |

**E2E 테스트 시나리오**:

1. 더미 데이터 스테이징 테이블 INSERT
2. API 호출: `POST /recalculate`
3. 응답 검증: `scope1_total + scope2_total == grand_total`
4. DB 조회: `ghg_emission_results` (`period_month IS NULL`, `calculation_basis`) 레코드 확인
5. API 호출: `GET /ghg-calculation/scope/results?company_id=&year=&basis=`
6. 응답 일치 확인

---

### Phase 5: 프론트엔드 연동 (2일)

**목표**: ScopeCalculation.tsx와 백엔드 통합

| Task | 상세 |
|------|------|
| 5.1 API 함수 작성 | `scopeCalculationApi.ts` |
| 5.2 컴포넌트 수정 | `handleRecalculate` 백엔드 연동 |
| 5.3 테이블 렌더링 | `line_items` → 카테고리별 테이블 |
| 5.4 차트 연동 | `monthly_chart` → Recharts |

---

### Phase 6: 검증 및 최적화 (1주)

**목표**: 품질·성능 개선

| Task | 상세 |
|------|------|
| 6.1 더미 데이터 검증 | SDS_ESG_DATA로 전체 흐름 테스트 |
| 6.2 성능 최적화 | 배치 쿼리, 캐싱 |
| 6.3 에러 핸들링 | 누락 계수·잘못된 입력 처리 |
| 6.4 사용자 매뉴얼 | 산정 방법·문제 해결 가이드 |

---

## 9. 핵심 고려사항

### 9.1 배출계수 버전 관리

**문제**: 배출계수는 연도·출처별로 변경되며, 과거 산정 재현을 위해 버전 관리 필수

**해결책**:
1. `emission_factor_version` 필드로 계수 세트 식별 (예: `v1.0_2024`)
2. 계수 변경 시 새 버전으로 INSERT, 기존 `is_active=false` 처리
3. 산정 결과에 사용된 버전 저장 → 재산정 시 동일 버전 사용 가능

```sql
-- 계수 업데이트 예시
UPDATE ghg_emission_factors SET is_active = FALSE WHERE version = 'v1.0';
INSERT INTO ghg_emission_factors (..., version) VALUES (..., 'v1.1');
```

### 9.2 데이터 품질 관리

**문제**: 스테이징 데이터 누락·이상값 → 산정 오류

**해결책**:
1. **산정 전 검증**: 기존 `ghg_anomaly_scan_results` 참고
2. **누락 처리**: 연료명·사용량 없는 행은 WARNING 로그 + 스킵
3. **수동 보정**: 사용자가 특정 값을 수동 입력 시 `manual_override` 플래그

### 9.3 성능 최적화

**문제**: 연간 데이터(12개월 × 다수 시설) 산정 시 응답 지연

**해결책**:
1. **배치 쿼리**: `get_factors_bulk`로 계수 일괄 조회 (N+1 방지)
2. **인덱스**: `(category, year_applicable, is_active)` 복합 인덱스
3. **캐싱**: 배출계수는 요청당 1회만 조회 (메모리 캐시)
4. **병렬 처리**: 12개월 산정을 `ThreadPoolExecutor`로 병렬화 (선택)

**성능 목표**: 12개월 × 100개 시설 = 1,200개 라인 산정 시 **< 5초**

### 9.4 확장성

**Scope 3 추가 시**:
1. `Scope3CalculationService` 클래스 추가
2. Orchestrator에 `_scope3_service` 추가 및 분기
3. `ghg_emission_factors`에 Scope3 카테고리별 계수 추가
4. 프론트: `scope3Categories` 추가

**멀티 테넌트**:
- `company_id` 기반 격리 완료
- 그룹사 연결 집계는 별도 API (`/scope/group-summary`)

---

## 부록 A: 참고 자료

- **GHG Protocol Corporate Standard**: [ghgprotocol.org](https://ghgprotocol.org/corporate-standard)
- **ISO 14064-1:2018**: 온실가스 정량화 및 보고 지침
- **환경부 배출계수**: [환경부 온실가스 종합정보센터](https://www.gir.go.kr)
- **IPCC AR5 GWP**: IPCC 5차 평가보고서

---

## 부록 B: FAQ

**Q1. 배출계수가 없는 연료는 어떻게 처리하나요?**  
A. WARNING 로그를 남기고 해당 행을 스킵합니다. 필요시 `ghg_emission_factors` 테이블에 수동 추가 가능합니다.

**Q2. Location-based vs Market-based 차이는?**  
A. Location은 국가 전력 계통 평균 계수, Market은 REC/PPA 조달 시 계수를 0 또는 공급사 계수로 조정합니다.

**Q3. 산정 결과를 Excel로 다운로드할 수 있나요?**  
A. Phase 5에서 "Excel 다운로드" 버튼 구현 예정 (openpyxl 사용).

**Q4. 이상치 검증과 연계는?**  
A. `ghg_anomaly_scan_results`의 `timeseries_findings`를 산정 전 참고하여, 이상값이 있는 행은 `status='warning'`으로 표시합니다.

---

**문서 종료**

이 설계서를 바탕으로 구현을 진행하시면 됩니다. 추가 질문이 있으시면 말씀해주세요.
