# 더미데이터 설계 전략 — ON-PREM 시스템 연동 기반

> **목적**: ON-PREM 내부 시스템(EMS·ERP·EHS·PLM·SRM·HR·MDG) 연동을 전제로,  
> GHG 산정 및 SR 보고서 작성에 필요한 더미데이터 구조·컬럼·양식을 정의한다.  
> **보고 기준**: IFRS S2, GRI Standards, K-ETS  
> **보고 연도**: 2024년 기준 (월별 데이터 포함)

---

## 1. 시스템별 역할 및 데이터 공급 범위

| 폴더 | 시스템 | 역할 | GHG 기여 | SR 기여 |
|------|--------|------|----------|---------|
| 01 | **EMS** | 환경경영시스템 | ✅ Scope 1·2 핵심 (에너지·배출량) | ✅ 환경 성과 지표 |
| 02 | **ERP** | 전사적자원관리 | ✅ Scope 1 (연료 구매·사용) | ✅ 경제 성과·공급망 비용 |
| 03 | **EHS** | 환경안전보건 | ✅ Scope 1 (폐기물·냉매) | ✅ 안전·보건 지표 |
| 04 | **PLM** | 제품수명주기관리 | ✅ Scope 3 (제품 생산·폐기) | ✅ 제품 책임·혁신 지표 |
| 05 | **SRM** | 공급망관리 | ✅ Scope 3 (구매 물품·물류) | ✅ 공급망 ESG 지표 |
| 06 | **HR** | 인사관리 | ⬜ 간접 (통근·출장) | ✅ 사회 지표 (고용·교육·다양성) |
| 07 | **MDG** | 기준정보관리 | ✅ 배출계수·단위 기준 | ✅ 조직 구조·사업장 기준 |

---

## 2. 시스템별 더미데이터 상세 설계

---

### 📁 01 EMS — 환경경영시스템

#### 2.1-1 `EMS_ENERGY_USAGE.csv` — 에너지 사용량 (Scope 2 핵심)

> 사업장별·월별 전력·열·스팀 사용량

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `record_id` | STRING | 레코드 고유 ID | EMS-E-2024-001 |
| `site_code` | STRING | 사업장 코드 (MDG 연동) | SITE-001 |
| `site_name` | STRING | 사업장명 | 서울 본사 |
| `year` | INT | 보고 연도 | 2024 |
| `month` | INT | 월 | 1 |
| `energy_type` | STRING | 에너지 종류 | 전력 / 열 / 스팀 / LNG |
| `energy_source` | STRING | 공급원 | 한국전력 / 지역난방 / 자가발전 |
| `usage_amount` | FLOAT | 사용량 | 125000.5 |
| `usage_unit` | STRING | 단위 | kWh / GJ / Gcal |
| `renewable_ratio` | FLOAT | 재생에너지 비율 (%) | 12.5 |
| `cost_krw` | FLOAT | 에너지 비용 (원) | 18750000 |
| `meter_id` | STRING | 계량기 ID | MTR-SEL-001 |
| `data_quality` | STRING | 데이터 품질 등급 | M1 / M2 / E1 / E2 |
| `source_system` | STRING | 데이터 출처 시스템 | EMS / 수동 |
| `synced_at` | DATETIME | ON-PREM 연동 동기화 일시 | 2024-02-05 08:55:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-02-05 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-02-10 14:32:00 |
| `updated_by` | STRING | 수정한 사용자 ID | user_001 |

**더미 데이터 범위**: 사업장 5개 × 12개월 × 에너지 타입 4종 = 240행

---

#### 2.1-2 `EMS_WATER_USAGE.csv` — 용수 사용량

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `record_id` | STRING | 레코드 고유 ID | EMS-W-2024-001 |
| `site_code` | STRING | 사업장 코드 | SITE-001 |
| `year` | INT | 연도 | 2024 |
| `month` | INT | 월 | 1 |
| `water_source` | STRING | 수원 | 상수도 / 지하수 / 재이용수 |
| `intake_amount` | FLOAT | 취수량 (㎥) | 3200.0 |
| `discharge_amount` | FLOAT | 방류량 (㎥) | 2800.0 |
| `recycle_amount` | FLOAT | 재이용량 (㎥) | 400.0 |
| `water_intensity` | FLOAT | 용수 집약도 (㎥/매출억원) | 0.85 |
| `data_quality` | STRING | 데이터 품질 | M1 |
| `source_system` | STRING | 데이터 출처 시스템 | EMS / 수동 |
| `synced_at` | DATETIME | ON-PREM 연동 동기화 일시 | 2024-02-05 08:55:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-02-05 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-02-10 14:32:00 |
| `updated_by` | STRING | 수정한 사용자 ID | user_001 |

---

#### 2.1-3 `EMS_WASTE.csv` — 폐기물 발생·처리 (Scope 1·3 연계)

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `record_id` | STRING | 레코드 고유 ID | EMS-WS-2024-001 |
| `site_code` | STRING | 사업장 코드 | SITE-002 |
| `year` | INT | 연도 | 2024 |
| `month` | INT | 월 | 3 |
| `waste_type` | STRING | 폐기물 종류 | 일반폐기물 / 지정폐기물 / 건설폐기물 |
| `waste_name` | STRING | 폐기물명 | 폐합성수지 / 폐유 / 폐산 |
| `generation_amount` | FLOAT | 발생량 (톤) | 15.3 |
| `disposal_method` | STRING | 처리 방법 | 매립 / 소각 / 재활용 / 위탁처리 |
| `recycling_amount` | FLOAT | 재활용량 (톤) | 10.2 |
| `landfill_amount` | FLOAT | 매립량 (톤) | 2.1 |
| `incineration_amount` | FLOAT | 소각량 (톤) | 3.0 |
| `ghg_emission_factor` | FLOAT | 폐기물 배출계수 (tCO₂e/톤) | 0.58 |
| `disposal_cost_krw` | FLOAT | 처리 비용 (원) | 920000 |
| `source_system` | STRING | 데이터 출처 시스템 | EMS / 수동 |
| `synced_at` | DATETIME | ON-PREM 연동 동기화 일시 | 2024-03-05 08:55:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-03-05 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-03-10 11:20:00 |
| `updated_by` | STRING | 수정한 사용자 ID | user_002 |

---

### 📁 02 ERP — 전사적자원관리

#### 2.2-1 `ERP_FUEL_PURCHASE.csv` — 연료 구매·사용 (Scope 1 핵심)

> 고정연소·이동연소 연료 구매 및 소비 기록

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `record_id` | STRING | 레코드 고유 ID | ERP-F-2024-001 |
| `site_code` | STRING | 사업장 코드 | SITE-003 |
| `year` | INT | 연도 | 2024 |
| `month` | INT | 월 | 1 |
| `fuel_category` | STRING | 연소 구분 | 고정연소 / 이동연소 |
| `fuel_type` | STRING | 연료 종류 | LNG / LPG / 경유 / 휘발유 / B-C유 / 등유 |
| `fuel_unit` | STRING | 단위 | Nm³ / L / kg / ton |
| `purchase_amount` | FLOAT | 구매량 | 85000.0 |
| `consumption_amount` | FLOAT | 소비량 | 82500.0 |
| `stock_amount` | FLOAT | 재고량 | 2500.0 |
| `purchase_cost_krw` | FLOAT | 구매 비용 (원) | 42500000 |
| `supplier_code` | STRING | 공급업체 코드 (SRM 연동) | SUP-001 |
| `emission_factor_year` | INT | 적용 배출계수 연도 | 2023 |
| `data_quality` | STRING | 데이터 품질 | M1 |
| `source_system` | STRING | 데이터 출처 시스템 | ERP / 수동 |
| `synced_at` | DATETIME | ON-PREM 연동 동기화 일시 | 2024-02-05 07:30:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-02-05 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-02-12 09:15:00 |
| `updated_by` | STRING | 수정한 사용자 ID | user_001 |

---

#### 2.2-2 `ERP_FINANCIAL_SUMMARY.csv` — 재무 요약 (SR 경제 성과)

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `record_id` | STRING | 레코드 고유 ID | ERP-FIN-2024-001 |
| `year` | INT | 연도 | 2024 |
| `quarter` | INT | 분기 | 1 |
| `revenue_krw` | FLOAT | 매출액 (원) | 250000000000 |
| `operating_profit_krw` | FLOAT | 영업이익 (원) | 35000000000 |
| `net_profit_krw` | FLOAT | 당기순이익 (원) | 28000000000 |
| `esg_investment_krw` | FLOAT | ESG 투자액 (원) | 5200000000 |
| `r_and_d_cost_krw` | FLOAT | 연구개발비 (원) | 12500000000 |
| `tax_paid_krw` | FLOAT | 납부 세금 (원) | 8400000000 |
| `local_procurement_ratio` | FLOAT | 지역 조달 비율 (%) | 68.5 |
| `community_investment_krw` | FLOAT | 사회공헌 투자액 (원) | 850000000 |
| `source_system` | STRING | 데이터 출처 시스템 | ERP / 수동 |
| `synced_at` | DATETIME | ON-PREM 연동 동기화 일시 | 2024-04-10 07:30:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-04-10 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-04-15 10:00:00 |
| `updated_by` | STRING | 수정한 사용자 ID | user_003 |

---

### 📁 03 EHS — 환경안전보건

#### 2.3-1 `EHS_REFRIGERANT.csv` — 냉매 사용량 (Scope 1 — 탈루 배출)

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `record_id` | STRING | 레코드 고유 ID | EHS-R-2024-001 |
| `site_code` | STRING | 사업장 코드 | SITE-001 |
| `year` | INT | 연도 | 2024 |
| `equipment_id` | STRING | 설비 ID | EQ-AC-001 |
| `equipment_type` | STRING | 설비 유형 | 에어컨 / 냉동기 / 칠러 |
| `refrigerant_type` | STRING | 냉매 종류 | HFC-134a / HFC-410A / R-22 / HFO-1234yf |
| `charge_amount_kg` | FLOAT | 충전량 (kg) | 5.2 |
| `leak_amount_kg` | FLOAT | 누설량 (kg) | 0.8 |
| `gwp_factor` | FLOAT | GWP 계수 | 1430 |
| `ghg_emission_tco2e` | FLOAT | 배출량 (tCO₂e) | 1.144 |
| `inspection_date` | DATE | 점검일 | 2024-06-15 |
| `source_system` | STRING | 데이터 출처 시스템 | EHS / 수동 |
| `synced_at` | DATETIME | ON-PREM 연동 동기화 일시 | 2024-07-01 08:00:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-07-01 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-07-05 13:00:00 |
| `updated_by` | STRING | 수정한 사용자 ID | user_002 |

---

#### 2.3-2 `EHS_SAFETY.csv` — 산업안전보건 지표 (SR 사회 지표)

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `record_id` | STRING | 레코드 고유 ID | EHS-S-2024-001 |
| `site_code` | STRING | 사업장 코드 | SITE-002 |
| `year` | INT | 연도 | 2024 |
| `quarter` | INT | 분기 | 2 |
| `employee_type` | STRING | 직원 구분 | 정규직 / 계약직 / 협력업체 |
| `total_workers` | INT | 해당 사업장 근로자 수 | 850 |
| `working_hours_total` | FLOAT | 총 근로 시간 | 1632000 |
| `accident_count` | INT | 재해 건수 | 2 |
| `fatality_count` | INT | 사망자 수 | 0 |
| `injury_count` | INT | 부상자 수 | 2 |
| `lost_day_count` | INT | 손실 일수 | 18 |
| `trir` | FLOAT | 재해율 (TRIR) | 0.24 |
| `ltir` | FLOAT | 손실시간재해율 (LTIR) | 0.12 |
| `safety_training_hours` | FLOAT | 안전 교육 시간 (인당) | 16.5 |
| `near_miss_count` | INT | 아차사고 건수 | 14 |
| `source_system` | STRING | 데이터 출처 시스템 | EHS / 수동 |
| `synced_at` | DATETIME | ON-PREM 연동 동기화 일시 | 2024-04-05 08:00:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-04-05 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-04-08 16:00:00 |
| `updated_by` | STRING | 수정한 사용자 ID | user_002 |

---

#### 2.3-3 `EHS_ENVIRONMENTAL_VIOLATION.csv` — 환경 법규 위반 현황

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `record_id` | STRING | 레코드 고유 ID | EHS-EV-2024-001 |
| `site_code` | STRING | 사업장 코드 | SITE-003 |
| `year` | INT | 연도 | 2024 |
| `violation_type` | STRING | 위반 유형 | 대기 / 수질 / 토양 / 폐기물 |
| `violation_count` | INT | 위반 건수 | 0 |
| `fine_krw` | FLOAT | 과징금 (원) | 0 |
| `corrective_action` | STRING | 시정 조치 내용 | 해당 없음 |
| `compliance_status` | STRING | 준수 여부 | 준수 / 위반 |
| `source_system` | STRING | 데이터 출처 시스템 | EHS / 수동 |
| `synced_at` | DATETIME | ON-PREM 연동 동기화 일시 | 2024-04-05 08:00:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-04-05 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-04-08 16:00:00 |
| `updated_by` | STRING | 수정한 사용자 ID | user_002 |

---

### 📁 04 PLM — 제품수명주기관리

#### 2.4-1 `PLM_PRODUCT_CARBON.csv` — 제품 탄소발자국 (Scope 3 Cat.11)

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `record_id` | STRING | 레코드 고유 ID | PLM-PC-2024-001 |
| `product_code` | STRING | 제품 코드 (MDG 연동) | PRD-001 |
| `product_name` | STRING | 제품명 | 스마트 디스플레이 A1 |
| `year` | INT | 연도 | 2024 |
| `production_volume` | FLOAT | 생산량 | 125000 |
| `production_unit` | STRING | 단위 | 대 / 톤 / 개 |
| `raw_material_emission` | FLOAT | 원재료 단계 배출량 (tCO₂e) | 3250.5 |
| `manufacturing_emission` | FLOAT | 제조 단계 배출량 (tCO₂e) | 1850.2 |
| `use_phase_emission` | FLOAT | 사용 단계 배출량 (tCO₂e) | 8500.0 |
| `eol_emission` | FLOAT | 폐기 단계 배출량 (tCO₂e) | 420.3 |
| `total_lifecycle_emission` | FLOAT | 전 생애주기 배출량 (tCO₂e) | 14020.0 |
| `carbon_label_yn` | STRING | 탄소라벨링 인증 여부 | Y / N |
| `eco_design_yn` | STRING | 친환경 설계 적용 여부 | Y / N |
| `source_system` | STRING | 데이터 출처 시스템 | PLM / 수동 |
| `synced_at` | DATETIME | ON-PREM 연동 동기화 일시 | 2024-02-01 07:00:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-02-01 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-02-15 11:00:00 |
| `updated_by` | STRING | 수정한 사용자 ID | user_004 |

---

#### 2.4-2 `PLM_PRODUCT_COMPLIANCE.csv` — 제품 환경규제 준수 (SR 지표)

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `record_id` | STRING | 레코드 고유 ID | PLM-CP-2024-001 |
| `product_code` | STRING | 제품 코드 | PRD-001 |
| `regulation_type` | STRING | 규제 종류 | RoHS / REACH / WEEE / 에너지효율 |
| `compliance_status` | STRING | 준수 여부 | 준수 / 미준수 / 검토중 |
| `certification_name` | STRING | 인증명 | 에너지효율 1등급 / 환경마크 |
| `certification_date` | DATE | 인증 취득일 | 2024-03-20 |
| `expiry_date` | DATE | 만료일 | 2027-03-19 |
| `recycled_material_ratio` | FLOAT | 재활용 소재 비율 (%) | 35.2 |
| `source_system` | STRING | 데이터 출처 시스템 | PLM / 수동 |
| `synced_at` | DATETIME | ON-PREM 연동 동기화 일시 | 2024-04-01 07:00:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-04-01 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-04-10 10:30:00 |
| `updated_by` | STRING | 수정한 사용자 ID | user_004 |

---

### 📁 05 SRM — 공급망관리

#### 2.5-1 `SRM_SUPPLIER_ESG.csv` — 공급업체 ESG 평가 (Scope 3 Cat.1, SR 공급망)

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `record_id` | STRING | 레코드 고유 ID | SRM-SE-2024-001 |
| `supplier_code` | STRING | 공급업체 코드 | SUP-001 |
| `supplier_name` | STRING | 공급업체명 | (주)한국소재 |
| `supplier_country` | STRING | 국가 | KR / CN / VN |
| `year` | INT | 연도 | 2024 |
| `spend_krw` | FLOAT | 구매 금액 (원) | 8500000000 |
| `spend_ratio` | FLOAT | 전체 구매 대비 비율 (%) | 12.5 |
| `esg_score` | FLOAT | ESG 종합 점수 (100점) | 78.5 |
| `environmental_score` | FLOAT | 환경 점수 | 82.0 |
| `social_score` | FLOAT | 사회 점수 | 75.0 |
| `governance_score` | FLOAT | 지배구조 점수 | 78.5 |
| `ghg_reported_yn` | STRING | 온실가스 보고 여부 | Y / N |
| `supplier_emission_tco2e` | FLOAT | 공급업체 배출량 (tCO₂e) | 12500.0 |
| `audit_yn` | STRING | 현장 감사 실시 여부 | Y / N |
| `audit_date` | DATE | 감사일 | 2024-09-15 |
| `critical_issue_yn` | STRING | 중대 위반 여부 | N |
| `improvement_required` | STRING | 개선 요구 사항 | 폐수처리 개선 |
| `source_system` | STRING | 데이터 출처 시스템 | SRM / 수동 |
| `synced_at` | DATETIME | ON-PREM 연동 동기화 일시 | 2024-10-01 07:00:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-10-01 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-10-05 14:00:00 |
| `updated_by` | STRING | 수정한 사용자 ID | user_005 |

---

#### 2.5-2 `SRM_LOGISTICS.csv` — 물류·운송 배출량 (Scope 3 Cat.4·9)

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `record_id` | STRING | 레코드 고유 ID | SRM-LG-2024-001 |
| `year` | INT | 연도 | 2024 |
| `month` | INT | 월 | 1 |
| `logistics_type` | STRING | 물류 구분 | 인바운드 / 아웃바운드 |
| `transport_mode` | STRING | 운송 수단 | 도로 / 항공 / 해상 / 철도 |
| `origin_country` | STRING | 출발 국가 | KR |
| `destination_country` | STRING | 도착 국가 | US |
| `distance_km` | FLOAT | 운송 거리 (km) | 11200.0 |
| `weight_ton` | FLOAT | 운송 중량 (톤) | 85.5 |
| `fuel_type` | STRING | 사용 연료 | 경유 / 항공유 / 벙커C유 |
| `emission_factor` | FLOAT | 배출계수 (kgCO₂e/톤·km) | 0.0258 |
| `ghg_emission_tco2e` | FLOAT | 배출량 (tCO₂e) | 24.72 |
| `carrier_name` | STRING | 운송사명 | (주)한국물류 |
| `source_system` | STRING | 데이터 출처 시스템 | SRM / 수동 |
| `synced_at` | DATETIME | ON-PREM 연동 동기화 일시 | 2024-02-05 07:30:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-02-05 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-02-08 10:00:00 |
| `updated_by` | STRING | 수정한 사용자 ID | user_005 |

---

### 📁 06 HR — 인사관리

#### 2.6-1 `HR_EMPLOYEE.csv` — 임직원 현황 (SR 사회 지표 핵심)

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `record_id` | STRING | 레코드 고유 ID | HR-EMP-2024-001 |
| `year` | INT | 연도 | 2024 |
| `quarter` | INT | 분기 | 4 |
| `site_code` | STRING | 사업장 코드 | SITE-001 |
| `region` | STRING | 지역 | 국내 / 해외 |
| `employment_type` | STRING | 고용 형태 | 정규직 / 계약직 / 파견직 |
| `gender` | STRING | 성별 | 남성 / 여성 |
| `age_group` | STRING | 연령대 | 20대 / 30대 / 40대 / 50대이상 |
| `job_level` | STRING | 직급 구분 | 사원 / 대리 / 과장 / 차장 / 부장 / 임원 |
| `headcount` | INT | 인원 수 | 245 |
| `new_hire_count` | INT | 신규 채용 수 | 32 |
| `turnover_count` | INT | 이직 수 | 18 |
| `turnover_rate` | FLOAT | 이직률 (%) | 7.35 |
| `disabled_count` | INT | 장애인 고용 수 | 8 |
| `nationality` | STRING | 국적 구분 | 내국인 / 외국인 |
| `source_system` | STRING | 데이터 출처 시스템 | HR / 수동 |
| `synced_at` | DATETIME | ON-PREM 연동 동기화 일시 | 2024-04-05 07:00:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-04-05 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-04-10 15:00:00 |
| `updated_by` | STRING | 수정한 사용자 ID | user_006 |

---

#### 2.6-2 `HR_TRAINING.csv` — 교육훈련 현황 (SR 사회 지표)

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `record_id` | STRING | 레코드 고유 ID | HR-TR-2024-001 |
| `year` | INT | 연도 | 2024 |
| `quarter` | INT | 분기 | 1 |
| `site_code` | STRING | 사업장 코드 | SITE-001 |
| `employment_type` | STRING | 고용 형태 | 정규직 / 계약직 |
| `gender` | STRING | 성별 | 남성 / 여성 |
| `job_level` | STRING | 직급 | 사원 / 대리 |
| `training_category` | STRING | 교육 분류 | ESG / 안전 / 직무 / 리더십 / 인권 |
| `training_hours_per_person` | FLOAT | 1인당 교육 시간 | 28.5 |
| `total_training_hours` | FLOAT | 총 교육 시간 | 6982.5 |
| `training_cost_krw` | FLOAT | 교육 비용 (원) | 125000000 |
| `participant_count` | INT | 참여 인원 | 245 |
| `source_system` | STRING | 데이터 출처 시스템 | HR / 수동 |
| `synced_at` | DATETIME | ON-PREM 연동 동기화 일시 | 2024-04-05 07:00:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-04-05 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-04-10 15:00:00 |
| `updated_by` | STRING | 수정한 사용자 ID | user_006 |

---

#### 2.6-3 `HR_COMMUTE_BUSINESS_TRAVEL.csv` — 통근·출장 (Scope 3 Cat.6·7)

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `record_id` | STRING | 레코드 고유 ID | HR-TB-2024-001 |
| `year` | INT | 연도 | 2024 |
| `month` | INT | 월 | 1 |
| `category` | STRING | 구분 | 출장 / 통근 |
| `transport_mode` | STRING | 이동 수단 | 항공 / 철도 / 버스 / 자가용 / 택시 |
| `domestic_international` | STRING | 국내외 구분 | 국내 / 국제 |
| `distance_km` | FLOAT | 이동 거리 (km) | 45200.0 |
| `person_trips` | INT | 연인원 (명) | 185 |
| `emission_factor` | FLOAT | 배출계수 | 0.255 |
| `ghg_emission_tco2e` | FLOAT | 배출량 (tCO₂e) | 11.526 |
| `source_system` | STRING | 데이터 출처 시스템 | HR / 수동 |
| `synced_at` | DATETIME | ON-PREM 연동 동기화 일시 | 2024-02-05 07:00:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-02-05 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-02-08 11:00:00 |
| `updated_by` | STRING | 수정한 사용자 ID | user_006 |

---

### 📁 07 MDG — 기준정보관리

#### 2.7-1 `MDG_SITE_MASTER.csv` — 사업장 기준 정보

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `site_code` | STRING | 사업장 코드 (PK) | SITE-001 |
| `site_name` | STRING | 사업장명 | 서울 본사 |
| `site_type` | STRING | 사업장 유형 | 본사 / 공장 / 연구소 / 물류센터 / 판매점 |
| `address` | STRING | 주소 | 서울특별시 강남구 |
| `country` | STRING | 국가 | KR |
| `region` | STRING | 지역 구분 | 국내 / 해외 |
| `floor_area_m2` | FLOAT | 연면적 (㎡) | 25000.0 |
| `ownership_type` | STRING | 소유 형태 | 자가 / 임차 |
| `operational_control` | STRING | 운영 통제 여부 | Y / N |
| `equity_ratio` | FLOAT | 지분율 (%) | 100.0 |
| `boundary_scope` | STRING | 조직 경계 포함 여부 | 포함 / 제외 |
| `start_date` | DATE | 운영 시작일 | 2005-03-01 |
| `active_yn` | STRING | 운영 여부 | Y / N |
| `last_synced_at` | DATETIME | MDG 마지막 동기화 일시 | 2024-01-01 06:00:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-01-01 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-01-15 09:00:00 |
| `updated_by` | STRING | 수정한 사용자 ID | admin_001 |

**더미 사업장 목록**:

| site_code | site_name | site_type |
|-----------|-----------|-----------|
| SITE-001 | 서울 본사 | 본사 |
| SITE-002 | 수원 제1공장 | 공장 |
| SITE-003 | 구미 제2공장 | 공장 |
| SITE-004 | 판교 연구소 | 연구소 |
| SITE-005 | 인천 물류센터 | 물류센터 |

---

#### 2.7-2 `MDG_EMISSION_FACTOR.csv` — 배출계수 기준 정보

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `factor_id` | STRING | 배출계수 ID (PK) | EF-LNG-2023 |
| `energy_type` | STRING | 에너지·연료 종류 | LNG / 경유 / 전력 / LPG |
| `factor_category` | STRING | 계수 분류 | 고정연소 / 이동연소 / 전력 / 탈루 |
| `ghg_type` | STRING | 온실가스 종류 | CO₂ / CH₄ / N₂O / HFC / PFC / SF₆ |
| `emission_factor` | FLOAT | 배출계수 값 | 2.15900 |
| `factor_unit` | STRING | 계수 단위 | tCO₂e/TJ / kgCO₂e/kWh |
| `reference_year` | INT | 기준 연도 | 2023 |
| `source` | STRING | 출처 | 환경부 / IPCC / IEA / 온실가스종합정보센터 |
| `applicable_scope` | STRING | 적용 Scope | Scope1 / Scope2 / Scope3 |
| `gwp_basis` | STRING | GWP 기준 | AR5 / AR6 |
| `valid_from` | DATE | 적용 시작일 | 2024-01-01 |
| `valid_to` | DATE | 적용 종료일 | 2024-12-31 |
| `last_synced_at` | DATETIME | MDG 마지막 동기화 일시 | 2024-01-01 06:00:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-01-01 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-01-05 09:00:00 |
| `updated_by` | STRING | 수정한 사용자 ID | admin_001 |

---

#### 2.7-3 `MDG_PRODUCT_MASTER.csv` — 제품 기준 정보

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `product_code` | STRING | 제품 코드 (PK) | PRD-001 |
| `product_name` | STRING | 제품명 | 스마트 디스플레이 A1 |
| `product_category` | STRING | 제품 분류 | 전자제품 / 부품 / 소재 |
| `business_unit` | STRING | 사업부 | 디스플레이 BU |
| `weight_kg` | FLOAT | 제품 중량 (kg) | 3.5 |
| `material_composition` | STRING | 주요 소재 구성 | 알루미늄40%/플라스틱30%/유리20%/기타10% |
| `energy_label` | STRING | 에너지 등급 | 1등급 |
| `active_yn` | STRING | 현행 제품 여부 | Y |
| `last_synced_at` | DATETIME | MDG 마지막 동기화 일시 | 2024-01-01 06:00:00 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 2024-01-01 09:00:00 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 2024-01-10 09:00:00 |
| `updated_by` | STRING | 수정한 사용자 ID | admin_001 |

---

## 3. GHG 산정용 데이터 매핑

### 3.1 Scope별 데이터 소스 매핑

| Scope | 카테고리 | 활동 유형 | 소스 파일 | 배출계수 파일 |
|-------|----------|-----------|-----------|---------------|
| **Scope 1** | 고정연소 | LNG·LPG·B-C유 연소 | `ERP_FUEL_PURCHASE.csv` | `MDG_EMISSION_FACTOR.csv` |
| **Scope 1** | 이동연소 | 경유·휘발유 차량 | `ERP_FUEL_PURCHASE.csv` | `MDG_EMISSION_FACTOR.csv` |
| **Scope 1** | 탈루 | 냉매 누출 | `EHS_REFRIGERANT.csv` | `MDG_EMISSION_FACTOR.csv` |
| **Scope 1** | 폐기물 소각 | 지정폐기물 소각 | `EMS_WASTE.csv` | `MDG_EMISSION_FACTOR.csv` |
| **Scope 2** | 전력 (마켓기반) | 구매 전력 | `EMS_ENERGY_USAGE.csv` | `MDG_EMISSION_FACTOR.csv` |
| **Scope 2** | 열·스팀 | 지역난방 등 | `EMS_ENERGY_USAGE.csv` | `MDG_EMISSION_FACTOR.csv` |
| **Scope 3** | Cat.1 구매물품 | 원재료·부품 구매 | `SRM_SUPPLIER_ESG.csv` | 공급업체 자체 계수 |
| **Scope 3** | Cat.4 업스트림 물류 | 인바운드 운송 | `SRM_LOGISTICS.csv` | `MDG_EMISSION_FACTOR.csv` |
| **Scope 3** | Cat.6 출장 | 항공·철도 출장 | `HR_COMMUTE_BUSINESS_TRAVEL.csv` | `MDG_EMISSION_FACTOR.csv` |
| **Scope 3** | Cat.7 통근 | 임직원 통근 | `HR_COMMUTE_BUSINESS_TRAVEL.csv` | `MDG_EMISSION_FACTOR.csv` |
| **Scope 3** | Cat.9 다운스트림 물류 | 아웃바운드 운송 | `SRM_LOGISTICS.csv` | `MDG_EMISSION_FACTOR.csv` |
| **Scope 3** | Cat.11 제품 사용 | 제품 사용 단계 | `PLM_PRODUCT_CARBON.csv` | IPCC AR6 |
| **Scope 3** | Cat.12 제품 폐기 | 제품 폐기 처리 | `PLM_PRODUCT_CARBON.csv` | `MDG_EMISSION_FACTOR.csv` |

### 3.2 Scope 3 확장 카테고리 로드맵

현재 문서는 데이터 가용성이 높은 핵심 카테고리에 집중하며, 아래 카테고리는 시스템 고도화 시 순차적으로 추가한다.

| 카테고리 | 활동 유형 | 예상 데이터 소스 | 확장 우선순위 |
|----------|-----------|----------------|---------------|
| Cat.2 자본재 | 설비·기계 구매 | `ERP_ASSET_PURCHASE.csv` (신규) | ⭐⭐⭐ 높음 |
| Cat.3 연료·에너지 관련 | 연료 채굴·정제 업스트림 | `MDG_EMISSION_FACTOR.csv` 계수 추가 | ⭐⭐⭐ 높음 |
| Cat.5 사업장 폐기물 | 외부 위탁 폐기물 처리 | `EMS_WASTE.csv` (컬럼 추가) | ⭐⭐ 중간 |
| Cat.8 업스트림 임차 자산 | 임차 사업장 에너지 | `EMS_ENERGY_USAGE.csv` (`ownership_type = 임차` 필터) | ⭐⭐ 중간 |
| Cat.10 제품 가공 | 중간재 추가 가공 | `PLM_PRODUCT_CARBON.csv` (컬럼 추가) | ⭐ 낮음 |
| Cat.13 다운스트림 임차 자산 | 판매 후 임차 자산 | 별도 파일 필요 | ⭐ 낮음 |
| Cat.15 투자 | 지분 투자 포트폴리오 | `ERP_FINANCIAL_SUMMARY.csv` + 별도 | ⭐ 낮음 |

> **설계 원칙**: 신규 카테고리 추가 시 `SRM_LOGISTICS.csv`, `EMS_WASTE.csv` 등 기존 파일에 컬럼을 추가하는 방식을 우선하고, 데이터 구조가 전혀 다를 경우에만 신규 파일을 생성한다. `site_code`와 `record_id` 명명 규칙은 공통 적용.

---

### 3.3 GHG 산정 계산식

```
배출량(tCO₂e) = 활동자료 × 배출계수 × GWP

Scope 2 마켓기반 = 전력 사용량(kWh) × 잔여믹스계수
Scope 2 위치기반  = 전력 사용량(kWh) × 지역 평균 계수
```

---

## 4. SR 보고서용 데이터 매핑

### 4.1 GRI Standards 매핑

| GRI 기준 | 공시 항목 | 소스 파일 | 핵심 컬럼 |
|----------|----------|-----------|-----------|
| GRI 2-7 | 임직원 수 | `HR_EMPLOYEE.csv` | `headcount`, `employment_type`, `gender` |
| GRI 2-8 | 비임직원 | `HR_EMPLOYEE.csv` | `employment_type = 파견직` |
| GRI 302-1 | 에너지 소비 | `EMS_ENERGY_USAGE.csv` | `usage_amount`, `energy_type` |
| GRI 302-3 | 에너지 집약도 | `EMS_ENERGY_USAGE.csv` + `ERP_FINANCIAL_SUMMARY.csv` | `usage_amount` / `revenue_krw` |
| GRI 303-3 | 용수 취수 | `EMS_WATER_USAGE.csv` | `intake_amount`, `water_source` |
| GRI 305-1 | Scope 1 직접 배출 | `ERP_FUEL_PURCHASE.csv` + `EHS_REFRIGERANT.csv` | 산정 결과 |
| GRI 305-2 | Scope 2 간접 배출 | `EMS_ENERGY_USAGE.csv` | 산정 결과 |
| GRI 305-3 | Scope 3 기타 배출 | `SRM_LOGISTICS.csv` + `HR_COMMUTE_BUSINESS_TRAVEL.csv` | 산정 결과 |
| GRI 305-4 | GHG 집약도 | GHG 결과 + `ERP_FINANCIAL_SUMMARY.csv` | tCO₂e / 매출액 |
| GRI 306-3 | 폐기물 발생 | `EMS_WASTE.csv` | `generation_amount`, `waste_type` |
| GRI 306-4 | 폐기물 처리 | `EMS_WASTE.csv` | `disposal_method`, `recycling_amount` |
| GRI 403-9 | 업무상 재해 | `EHS_SAFETY.csv` | `accident_count`, `trir`, `ltir` |
| GRI 404-1 | 교육훈련 | `HR_TRAINING.csv` | `training_hours_per_person` |
| GRI 405-1 | 다양성·기회균등 | `HR_EMPLOYEE.csv` | `gender`, `job_level`, `headcount` |
| GRI 308-1 | 공급업체 환경 평가 | `SRM_SUPPLIER_ESG.csv` | `esg_score`, `audit_yn` |
| GRI 414-1 | 공급업체 사회 평가 | `SRM_SUPPLIER_ESG.csv` | `social_score`, `critical_issue_yn` |

### 4.2 IFRS S2 매핑

| IFRS S2 요구사항 | 소스 파일 | 핵심 컬럼 |
|-----------------|-----------|-----------|
| 기후 관련 리스크·기회 | `EHS_ENVIRONMENTAL_VIOLATION.csv` + `ERP_FINANCIAL_SUMMARY.csv` | 정성적 서술 보완 필요 |
| Scope 1·2·3 배출량 | 전체 GHG 산정 결과 | tCO₂e |
| 탄소 집약도 | GHG 결과 / 매출 | `revenue_krw` |
| 온실가스 감축 목표 | `ERP_FINANCIAL_SUMMARY.csv` | `esg_investment_krw` |
| 기후 관련 재무 영향 | `ERP_FINANCIAL_SUMMARY.csv` | `esg_investment_krw`, `r_and_d_cost_krw` |
| 내부 탄소 가격 | (별도 정책 문서 필요) | — |

---

## 5. 더미데이터 파일 목록 및 경로

```
📁 06_dummy data/
├── 01 EMS/
│   ├── EMS_ENERGY_USAGE.csv          # 에너지 사용량 (240행)
│   ├── EMS_WATER_USAGE.csv           # 용수 사용량 (60행)
│   └── EMS_WASTE.csv                 # 폐기물 발생·처리 (120행)
├── 02 ERP/
│   ├── ERP_FUEL_PURCHASE.csv         # 연료 구매·사용 (180행)
│   └── ERP_FINANCIAL_SUMMARY.csv     # 재무 요약 (4행 — 분기별)
├── 03 EHS/
│   ├── EHS_REFRIGERANT.csv           # 냉매 사용량 (50행)
│   ├── EHS_SAFETY.csv                # 안전보건 지표 (20행)
│   └── EHS_ENVIRONMENTAL_VIOLATION.csv # 환경 위반 현황 (20행)
├── 04 PLM/
│   ├── PLM_PRODUCT_CARBON.csv        # 제품 탄소발자국 (30행)
│   └── PLM_PRODUCT_COMPLIANCE.csv    # 제품 환경규제 준수 (40행)
├── 05 SRM/
│   ├── SRM_SUPPLIER_ESG.csv          # 공급업체 ESG 평가 (50행)
│   └── SRM_LOGISTICS.csv             # 물류·운송 배출 (120행)
├── 06 HR/
│   ├── HR_EMPLOYEE.csv               # 임직원 현황 (80행)
│   ├── HR_TRAINING.csv               # 교육훈련 현황 (40행)
│   └── HR_COMMUTE_BUSINESS_TRAVEL.csv # 통근·출장 (120행)
└── 07 MDG/
    ├── MDG_SITE_MASTER.csv           # 사업장 기준 정보 (5행)
    ├── MDG_EMISSION_FACTOR.csv       # 배출계수 기준 (80행)
    └── MDG_PRODUCT_MASTER.csv        # 제품 기준 정보 (10행)
```

---

## 6. 데이터 품질 등급 기준 (공통 적용)

| 등급 | 설명 | 적용 기준 |
|------|------|-----------|
| **M1** | 실측 데이터 — 계량기 직접 측정 | 전력·가스 계량기 |
| **M2** | 실측 데이터 — 구매 영수증·세금계산서 | 연료 구매 기록 |
| **E1** | 추정 데이터 — 공학적 계산 | 연소 계산값 |
| **E2** | 추정 데이터 — 프록시·벤치마크 | Scope 3 추정치 |

---

## 6-1. 공통 감사 추적 컬럼 정의

모든 트랜잭션 파일(EMS·ERP·EHS·PLM·SRM·HR)에 아래 5개 컬럼이 공통 적용된다.  
MDG 마스터 파일은 `synced_at` 대신 `last_synced_at`을 사용한다.

| 컬럼명 | 타입 | 설명 | 적용 파일 |
|--------|------|------|-----------|
| `source_system` | STRING | 데이터 출처 시스템 (EMS/ERP/EHS/PLM/SRM/HR/수동) | 전체 |
| `synced_at` | DATETIME | ON-PREM 원천 시스템에서 플랫폼으로 동기화된 일시 | 트랜잭션 파일 |
| `last_synced_at` | DATETIME | MDG 마스터 데이터 마지막 동기화 일시 | MDG 파일 |
| `created_at` | DATETIME | 플랫폼에 최초 적재된 일시 | 전체 |
| `updated_at` | DATETIME | 플랫폼에서 마지막으로 수정된 일시 | 전체 |
| `updated_by` | STRING | 수정한 사용자 ID | 전체 |

**컬럼 간 관계 및 감사 활용**

```
원천 시스템 데이터 생성
       ↓
synced_at   → "이 데이터가 언제 ON-PREM에서 넘어왔는가"
       ↓
created_at  → "플랫폼에 언제 처음 쌓였는가"
       ↓
updated_at  → "누군가 플랫폼에서 언제 수정했는가"
updated_by  → "누가 수정했는가"
```

> **감사 대응 활용**: IFRS S2·GRI 검증 시 `synced_at`과 `updated_at` 간 시간 차이가 크면 수동 수정 가능성을 플래그로 표시. `updated_by`로 수정 주체 추적 가능.

---

## 7. ON-PREM 연동 인터페이스 정의

### 7.1 연동 방식

| 시스템 | 연동 방식 | 주기 | 인증 방식 |
|--------|----------|------|-----------|
| EMS | REST API / DB Direct | 월별 | API Key |
| ERP | DB Direct (SAP RFC) | 월별 | Service Account |
| EHS | REST API | 분기별 | OAuth2 |
| PLM | REST API / File Export | 연간 | API Key |
| SRM | REST API | 분기별 | API Key |
| HR | DB Direct | 분기별 | Service Account |
| MDG | DB Direct (Master Sync) | 상시 | Service Account |

### 7.2 데이터 수신 포맷

- **기본 포맷**: CSV UTF-8 (BOM 없음)
- **날짜 포맷**: `YYYY-MM-DD`
- **숫자**: 천 단위 구분자 없음, 소수점 `.` 사용
- **NULL 처리**: 빈 문자열(`""`) 또는 `NULL` 허용
- **인코딩**: UTF-8

---

### 7.3 보안 및 컴플라이언스 (ON-PREM 환경)

#### 데이터 암호화

| 구간 | 암호화 방식 | 적용 대상 |
|------|------------|-----------|
| 전송 구간 (In-Transit) | TLS 1.2 이상 | 모든 API 통신·파일 전송 |
| 저장 구간 (At-Rest) | AES-256 | CSV 파일·DB 저장 데이터 |
| 민감 필드 | 컬럼 레벨 암호화 | `supplier_name`, `spend_krw`, 임직원 개인정보 |

> ON-PREM 환경 특성상 암호화 키 관리는 내부 KMS(Key Management System) 또는 HSM을 통해 수행하며, 클라우드 키 관리 서비스에 의존하지 않는다.

#### 접근 제어 및 로그

| 항목 | 정책 |
|------|------|
| **접근 권한** | 역할 기반 접근 제어(RBAC) 적용 — 시스템별 읽기/쓰기 권한 분리 |
| **API 인증** | API Key는 90일 주기 로테이션, Service Account는 최소 권한 원칙 |
| **접근 로그** | 모든 데이터 조회·수정·다운로드 이벤트 로깅 (로그 보존 기간: 최소 3년) |
| **감사 추적** | `record_id` + `created_at` 기반으로 데이터 변경 이력 추적 가능하도록 설계 |
| **네트워크 격리** | 내부 시스템 연동은 전용 내부망(VPN 또는 전용선) 경유, 외부망 직접 노출 금지 |

#### 개인정보 처리

- `HR_EMPLOYEE.csv`에 포함된 성별·연령·국적 등 개인정보 관련 항목은 **집계 단위로만 저장** (개인 식별 불가 수준)
- 원천 시스템(HR)의 개인정보는 IFRSseed 플랫폼에 적재하지 않으며, **집계 결과값만 연동**
- 개인정보보호법 및 사내 개인정보 처리 방침 준수

#### 컴플라이언스 체크리스트

- [ ] 전송 구간 TLS 1.2 이상 적용 확인
- [ ] At-Rest 암호화(AES-256) 적용 확인
- [ ] 접근 로그 수집·보존 정책 수립
- [ ] API Key 로테이션 스케줄 설정
- [ ] HR 데이터 집계 처리 방식 검토 및 개인정보 영향평가 실시
- [ ] 데이터 보존 기간 정책 수립 (ESG 보고 데이터: 최소 5년 권장)

---

## 참조 문서

- `JOURNEYMAP_GHG_v2.md` — GHG 산정 페이지 사용자 흐름
- `JOURNEYMAP_SR_REPORT.md` — SR 작성 페이지 사용자 흐름
- `JOURNEYMAP_COMPANY_INFO.md` — 회사정보 연동 기준
- `MDG_SITE_MASTER.csv` — 사업장 기준 (모든 시스템 공통 키)