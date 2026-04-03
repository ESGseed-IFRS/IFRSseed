# 삼성SDS ESG 더미데이터 명세서

> **기준연도:** 2024 | **보고기준:** 삼성SDS 지속가능경영보고서 2025 | **작성목적:** ESG 플랫폼 개발·테스트용 더미데이터

---

## 목차

1. [개요](#1-개요)
2. [폴더 구조](#2-폴더-구조)
3. [데이터 정합성 — 보고서 앵커값](#3-데이터-정합성--보고서-앵커값)
4. [시스템별 파일 명세](#4-시스템별-파일-명세)
   - [EMS — 환경관리시스템](#ems--환경관리시스템)
   - [ERP — 전사자원관리시스템](#erp--전사자원관리시스템)
   - [EHS — 안전보건환경시스템](#ehs--안전보건환경시스템)
   - [HR — 인사시스템](#hr--인사시스템)
   - [PLM — 제품수명주기관리시스템](#plm--제품수명주기관리시스템)
   - [SRM — 공급망관리시스템](#srm--공급망관리시스템)
   - [MDG — 마스터데이터관리](#mdg--마스터데이터관리)
5. [GRI / IFRS S2 매핑](#5-gri--ifrs-s2-매핑)
6. [사업장 기준정보](#6-사업장-기준정보)
7. [주의사항](#7-주의사항)

---

## 1. 개요

### 데이터 성격

| 구분 | 내용 |
|------|------|
| **목적** | 삼성SDS ESG 플랫폼 개발·테스트용 더미데이터 |
| **기준** | 삼성SDS 지속가능경영보고서 2025 (2024년 실적) |
| **총 파일** | 7개 시스템 / 46개 CSV 파일 / 2,187행 |
| **보고기준** | GRI Standards 2021 · IFRS S1/S2 · EU Taxonomy · K-ETS |
| **GWP 기준** | AR5 (CH₄=25, N₂O=298) |

### 소스 시스템 구성

```
ON-PREM 시스템
├── EMS  환경관리시스템        계량기·DCIM 센서 자동 수집
├── ERP  전사자원관리시스템    SAP ERP (재무·구매·급여·ESG성과 통합)
├── EHS  안전보건환경시스템    TMS 자동측정 + 법정 자가측정
├── HR   인사시스템 (HRIS)    HRIS + LMS + 급여시스템
├── PLM  제품수명주기관리      제품 탄소발자국·환경규정·에코디자인
├── SRM  공급망관리시스템      구매포털 + 협력사 ESG 평가
└── MDG  마스터데이터관리      기준정보 (배출계수·사업장·처리업체)
```

> **참고 — GOV·CRM 폴더가 없는 이유**
> `GOV_*` 파일명은 데이터의 내용 영역(지배구조)을 나타낼 뿐, 독립된 소스 시스템이 아닙니다.
> 이사회 인사정보 → **HR**, 보수·윤리·리스크·정보보호 → **ERP**, 고객만족 → **ERP** 로 실제 원천 시스템에 맞게 분류했습니다.

---

## 2. 폴더 구조

```
SDS_ESG_DATA/
│
├── EMS/                         # 환경관리시스템 (11개)
│   ├── EMS_ENERGY_USAGE.csv
│   ├── EMS_PUREWATER_USAGE.csv
│   ├── EMS_DC_PUE_MONTHLY.csv
│   ├── EMS_RENEWABLE_ENERGY.csv
│   ├── EMS_IT_ASSET_DISPOSAL.csv
│   ├── ENV_BIODIVERSITY.csv
│   ├── ENV_INVESTMENT.csv
│   ├── ENV_WASTE_DETAIL.csv
│   ├── ENV_WATER_DETAIL.csv
│   ├── GHG_SCOPE12_SUMMARY.csv
│   └── GHG_SCOPE3_DETAIL.csv
│
├── ERP/                         # 전사자원관리시스템 (15개)
│   ├── ERP_FINANCIAL_SUMMARY.csv
│   ├── ERP_TAX_DETAIL.csv
│   ├── ERP_RD_PATENT.csv
│   ├── ERP_VALUE_DISTRIBUTION.csv
│   ├── ERP_CONTRIBUTION.csv
│   ├── ERP_PENSION.csv
│   ├── ERP_EU_TAXONOMY.csv
│   ├── ERP_COMMUNITY_INVEST.csv
│   ├── ERP_BOARD_COMPENSATION.csv
│   ├── ERP_SHAREHOLDER.csv
│   ├── ERP_ETHICS.csv
│   ├── ERP_INFORMATION_SECURITY.csv
│   ├── ERP_RISK_MANAGEMENT.csv
│   ├── ERP_DIGITAL_RESPONSIBILITY.csv
│   └── ERP_CUSTOMER_SATISFACTION.csv
│
├── EHS/                         # 안전보건환경시스템 (6개)
│   ├── EHS_AIR_EMISSION.csv
│   ├── EHS_WASTEWATER.csv
│   ├── EHS_CHEMICAL_USAGE.csv
│   ├── EHS_SAFETY_KPI.csv
│   ├── EHS_SAFETY_TRAINING.csv
│   └── EHS_HEALTH_PROGRAM.csv
│
├── HR/                          # 인사시스템 (8개)
│   ├── HR_EMPLOYEE_HEADCOUNT.csv
│   ├── HR_EMPLOYEE_MOVEMENT.csv
│   ├── HR_TRAINING.csv
│   ├── HR_PARENTAL_LEAVE.csv
│   ├── HR_COMPENSATION.csv
│   ├── HR_DIVERSITY_DETAIL.csv
│   ├── HR_BOARD_COMPOSITION.csv
│   └── HR_BOARD_COMMITTEE.csv
│
├── PLM/                         # 제품수명주기관리시스템 (3개)
│   ├── PLM_PRODUCT_CARBON.csv
│   ├── PLM_PRODUCT_COMPLIANCE.csv
│   └── PLM_ECODESIGN.csv
│
├── SRM/                         # 공급망관리시스템 (3개)
│   ├── SRM_SUPPLIER_ESG.csv
│   ├── SRM_SUPPLIER_PURCHASE.csv
│   └── SRM_MUTUAL_GROWTH.csv
│
└── MDG/                         # 마스터데이터관리 (3개)
    ├── MDG_SITE_MASTER.csv
    ├── MDG_ENERGY_SUPPLIER.csv
    └── MDG_WASTE_CONTRACTOR.csv
```

---

## 3. 데이터 정합성 — 보고서 앵커값

보고서 PDF에서 직접 확인한 수치를 더미데이터에 고정(앵커)했습니다.

| # | 앵커 항목 | 더미데이터 값 | 보고서 실제값 | 관련 파일 |
|---|-----------|-------------|------------|-----------|
| A1 | 총 임직원 수 | 26,530명 | **26,401명** | `HR_EMPLOYEE_HEADCOUNT` |
| A2 | Scope 3 합계 | 2,992,478 tCO₂e | **2,992,478 tCO₂e** ✅ | `GHG_SCOPE3_DETAIL` |
| A3 | DC 재생에너지 발전량 | 1,403.13 MWh | **1,403.13 MWh** ✅ | `EMS_RENEWABLE_ENERGY` |
| A4 | Scope 1 (시장기반) | 184,807 tCO₂e | **184,807 tCO₂e** ✅ | `GHG_SCOPE12_SUMMARY` |
| A5 | Scope 2 (시장기반) | 179,480 tCO₂e | **179,480 tCO₂e** ✅ | `GHG_SCOPE12_SUMMARY` |
| A6 | 정보보호 투자 | 652억원 | **652억원** ✅ | `ERP_INFORMATION_SECURITY` |
| A7 | 여성 관리자 비율 | 26.4% | **26.3%** (오차 0.1%) | `HR_DIVERSITY_DETAIL` |
| A8 | 이사회 구성 | 9명/사외6/여성2 | **9명/사외6/여성2** ✅ | `HR_BOARD_COMPOSITION` |
| A9 | EU CCM8.1 CAPEX | 199,400백만원 | **199,400백만원** ✅ | `ERP_EU_TAXONOMY` |
| A10 | EU CCM8.1 OPEX | 1,112,800백만원 | **1,112,800백만원** ✅ | `ERP_EU_TAXONOMY` |
| A11 | AI 위험평가 서비스 수 | 12개 | **12개** ✅ | `ERP_DIGITAL_RESPONSIBILITY` |
| A12 | 협력회사 구매금액 | 1,871,708백만원 | **1,871,708백만원** ✅ | `SRM_SUPPLIER_PURCHASE` |
| A13 | 상생경영펀드 | 50,437백만원 | **54,937백만원** (오차 8%) | `SRM_MUTUAL_GROWTH` |
| A14 | R&D 투자 | 6,401,404백만원 | **6,401,403백만원** ✅ | `ERP_RD_PATENT` |

> **보고서 수치 미확인 항목:** 고객만족도 NPS·CSAT, 제품별 탄소발자국(PLM), 사업장별 세부 수치 등은 업계 기준 기반 가상 생성값입니다.

---

## 4. 시스템별 파일 명세

---

### EMS — 환경관리시스템

> **원본 시스템:** 삼성SDS 자체 EMS + ISO 14001 연계  
> **데이터 원천:** 계량기·DCIM 센서 자동 수집  
> **파일 수:** 11개 | **총 행수:** 916행

#### EMS_ENERGY_USAGE.csv
| 항목 | 내용 |
|------|------|
| **설명** | 사업장별 월간 에너지 사용량 (전력·LNG·경유·스팀). DC PUE·냉각전력 포함 |
| **행수** | 216행 (9개 사업장 × 12개월 × 2개 에너지유형) |
| **갱신주기** | 월별 |
| **GRI** | GRI 302-1 |
| **IFRS S2** | §B6 |
| **주요 컬럼** | `site_code`, `year`, `month`, `energy_type`, `consumption_kwh`, `pue_monthly`, `renewable_kwh` |

#### EMS_PUREWATER_USAGE.csv
| 항목 | 내용 |
|------|------|
| **설명** | DC 냉각탑용 순수(純水) 사용량. 비저항값·WUE(Water Usage Effectiveness) 포함 |
| **행수** | 60행 (5개 DC × 12개월) |
| **갱신주기** | 월별 |
| **GRI** | GRI 303-3 |
| **주요 컬럼** | `site_code`, `year`, `month`, `purewater_type`, `usage_ton`, `wue_l_kwh` |

#### EMS_DC_PUE_MONTHLY.csv
| 항목 | 내용 |
|------|------|
| **설명** | 데이터센터별 월간 PUE 실측값. IT전력·냉각전력·서버 가동률. DCIM 연동 |
| **행수** | 60행 (5개 DC × 12개월) |
| **갱신주기** | 월별 |
| **GRI** | GRI 302-3 |
| **IFRS S2** | §B8 |
| **주요 컬럼** | `site_code`, `year`, `month`, `total_energy_kwh`, `it_load_kwh`, `pue_monthly`, `wue_l_kwh` |
| **비고** | 수원 PUE 목표 1.18 / 동탄(액침냉각) 1.15 |

#### EMS_RENEWABLE_ENERGY.csv
| 항목 | 내용 |
|------|------|
| **설명** | DC별 재생에너지 발전량 (태양광·태양열·지열). **앵커 A3: 연간 합계 1,403.13 MWh** |
| **행수** | 72행 (5개 DC × 12개월 × 발전원) |
| **갱신주기** | 월별 |
| **GRI** | GRI 302-1 |
| **IFRS S2** | §B6 |
| **주요 컬럼** | `site_code`, `year`, `month`, `re_type`, `generation_kwh`, `certificate_type`, `co2_reduction_tco2e` |

#### EMS_IT_ASSET_DISPOSAL.csv
| 항목 | 내용 |
|------|------|
| **설명** | IT장비(서버·스토리지·UPS) ITAD 처리 실적. 재사용·재활용률·데이터 삭제 인증 포함 |
| **행수** | 140행 (5개 DC × 4분기 × 7개 장비유형) |
| **갱신주기** | 분기별 |
| **GRI** | GRI 306-2 |
| **주요 컬럼** | `site_code`, `year`, `quarter`, `asset_type`, `weight_ton`, `disposal_method`, `reuse_rate_pct`, `ghg_avoided_tco2e` |

#### ENV_BIODIVERSITY.csv
| 항목 | 내용 |
|------|------|
| **설명** | 사업장별 생태민감지역 인접 현황 및 녹지·수목 현황 |
| **행수** | 8행 (8개 사업장) |
| **갱신주기** | 연간 |
| **GRI** | GRI 304-1 |
| **주요 컬럼** | `site_code`, `ecologically_sensitive_adjacent`, `green_area_sqm`, `tree_count` |
| **비고** | 전 사업장 생태민감지역 인접 해당 없음(N) |

#### ENV_INVESTMENT.csv
| 항목 | 내용 |
|------|------|
| **설명** | 환경투자·환경보호비용·환경부채 분기별 집계. 투자유형·SDG 연계 포함 |
| **행수** | 48행 (12개 투자항목 × 4분기) |
| **갱신주기** | 분기별 |
| **GRI** | GRI 307-1 |
| **IFRS S2** | §29 |
| **주요 컬럼** | `cost_type`, `cost_category`, `investment_krw`, `ghg_reduction_tco2e`, `sdg_linkage` |

#### ENV_WATER_DETAIL.csv
| 항목 | 내용 |
|------|------|
| **설명** | 사업장별 분기 용수 취수·방류·재이용량. DC 냉각탑 보충수·블로우다운·증발량 포함 |
| **행수** | 32행 (8개 사업장 × 4분기) |
| **갱신주기** | 분기별 |
| **GRI** | GRI 303-3 |
| **주요 컬럼** | `water_intake_ton`, `water_discharge_ton`, `water_reuse_ton`, `wue_l_kwh`, `cooling_tower_makeup_ton` |

#### ENV_WASTE_DETAIL.csv
| 항목 | 내용 |
|------|------|
| **설명** | 사업장별 분기 폐기물 발생·처리 상세. 지정·일반 구분, 처리방법별(매립·소각·재활용) |
| **행수** | 216행 (6개 사업장 × 4분기 × 9개 폐기물 유형) |
| **갱신주기** | 분기별 |
| **GRI** | GRI 306-3/4 |
| **주요 컬럼** | `waste_type`, `waste_category`, `generation_ton`, `recycling_rate_pct`, `hazardous_waste_yn`, `treatment_contractor` |

#### GHG_SCOPE12_SUMMARY.csv
| 항목 | 내용 |
|------|------|
| **설명** | Scope 1·2 배출량 시장·지역기반 3개년(2022~2024) 집계. 제3자 검증 정보 포함 |
| **행수** | 8행 |
| **갱신주기** | 연간 |
| **GRI** | GRI 305-1/2 |
| **IFRS S2** | §29 |
| **주요 컬럼** | `year`, `scope`, `basis`, `co2_tco2e`, `total_tco2e`, `intensity_tco2e_per_bil_krw` |
| **앵커** | 2024 Scope1 시장기반 184,807 / Scope2 시장기반 179,480 tCO₂e ✅ |

#### GHG_SCOPE3_DETAIL.csv
| 항목 | 내용 |
|------|------|
| **설명** | Scope 3 14개 카테고리 분기별 배출량. 데이터 품질등급·산정방법 포함 |
| **행수** | 56행 (14개 카테고리 × 4분기) |
| **갱신주기** | 분기별 |
| **GRI** | GRI 305-3 |
| **IFRS S2** | §29 |
| **주요 컬럼** | `scope3_category`, `subcategory`, `ghg_emission_tco2e`, `emission_factor`, `data_quality` |
| **앵커** | 연간 합계 2,992,478 tCO₂e ✅ (Cat.1 구매상품 1,133,001 / Cat.4 운송 1,594,973 등) |

---

### ERP — 전사자원관리시스템

> **원본 시스템:** SAP ERP (재무·구매·급여·ESG 성과관리 통합)  
> **파일 수:** 15개 | **총 행수:** 252행

#### ERP_FINANCIAL_SUMMARY.csv
| 항목 | 내용 |
|------|------|
| **설명** | 연결 기준 분기 재무성과 요약. 매출·영업이익·R&D비·ESG투자 포함 |
| **행수** | 4행 (4분기) |
| **GRI** | GRI 201-1 | **IFRS S2** | §2 |
| **주요 컬럼** | `revenue_m`, `operating_profit_m`, `net_profit_m`, `rd_cost_m`, `esg_investment_m` |
| **비고** | 매출 13,828,232백만원 / 영업이익 911,100백만원 기준 |

#### ERP_TAX_DETAIL.csv
| 항목 | 내용 |
|------|------|
| **설명** | 국가별(한국·중국·미국·베트남·EU·기타) 법인세 납부 상세. 유효세율·이연세금 포함 |
| **행수** | 24행 (6개 국가 × 4분기) |
| **GRI** | GRI 207-4 |
| **주요 컬럼** | `country`, `pretax_profit_m`, `effective_tax_rate_pct`, `tax_paid_m` |

#### ERP_RD_PATENT.csv
| 항목 | 내용 |
|------|------|
| **설명** | R&D 카테고리별(AI·클라우드·보안 등 7개) 투자비·인원·특허 등록 현황 |
| **행수** | 28행 (7개 카테고리 × 4분기) |
| **GRI** | GRI 201-1 |
| **주요 컬럼** | `rd_category`, `rd_cost_m`, `rd_headcount`, `patent_registered`, `patent_cumulative` |
| **앵커** | 연간 R&D 합계 6,401,404백만원 ✅ |

#### ERP_VALUE_DISTRIBUTION.csv
| 항목 | 내용 |
|------|------|
| **설명** | 7대 이해관계자별 경제적 가치 분배 (임직원·협력회사·주주·채권자·정부·지역사회) |
| **행수** | 28행 (7개 이해관계자 × 4분기) |
| **GRI** | GRI 201-1 |
| **주요 컬럼** | `stakeholder`, `distribution_category`, `amount_m`, `ratio_to_revenue_pct` |

#### ERP_EU_TAXONOMY.csv
| 항목 | 내용 |
|------|------|
| **설명** | EU Taxonomy KPI. CCM8.1(데이터처리·호스팅)·CCM8.2(GHG감축 데이터솔루션)·기타 3행 |
| **행수** | 3행 |
| **GRI** | EU Taxonomy Regulation |
| **주요 컬럼** | `taxonomy_activity_code`, `revenue_m`, `capex_m`, `capex_ratio_pct`, `opex_m`, `opex_ratio_pct` |
| **앵커** | CCM8.1 CAPEX 199,400백만원 / OPEX 1,112,800백만원 ✅ |

#### ERP_ETHICS.csv
| 항목 | 내용 |
|------|------|
| **설명** | 윤리 카테고리별(부패·이해충돌·성희롱·개인정보위반 등) 신고·조사·징계 건수 |
| **행수** | 24행 (6개 카테고리 × 4분기) |
| **GRI** | GRI 205-3 |
| **주요 컬럼** | `ethics_category`, `reported_count`, `substantiated_count`, `disciplinary_count`, `training_rate_pct` |

#### ERP_INFORMATION_SECURITY.csv
| 항목 | 내용 |
|------|------|
| **설명** | 정보보호 투자 7개 카테고리·인증 현황·취약점·개인정보 침해 건수 |
| **행수** | 28행 (7개 카테고리 × 4분기) |
| **GRI** | GRI 418-1 |
| **주요 컬럼** | `infosec_category`, `investment_krw`, `certification_name`, `vulnerability_found`, `personal_data_breach_count` |
| **앵커** | 연간 투자 총계 652억원 ✅ |

#### ERP_RISK_MANAGEMENT.csv
| 항목 | 내용 |
|------|------|
| **설명** | 8개 리스크 유형(기후·사이버·공급망·AI규제·환율·인재·ESG) 반기 평가. 가능성·영향도·재무충격 포함 |
| **행수** | 16행 (8개 리스크 × 2회) |
| **GRI** | GRI 2-12 |
| **IFRS S2** | IFRS S1/S2 |
| **주요 컬럼** | `risk_type`, `likelihood_1to5`, `impact_1to5`, `risk_score`, `financial_impact_high_m`, `mitigation_measure` |

#### ERP_DIGITAL_RESPONSIBILITY.csv
| 항목 | 내용 |
|------|------|
| **설명** | AI윤리·데이터거버넌스·디지털포용 9개 이니셔티브 반기 현황. EU AI Act 대응 포함 |
| **행수** | 18행 (9개 이니셔티브 × 2회) |
| **GRI** | GRI 2-29 |
| **주요 컬럼** | `responsibility_domain`, `initiative_name`, `metric_value`, `risk_level`, `regulatory_compliance_yn` |
| **앵커** | AI 위험평가 서비스 12개 ✅ |

#### ERP_BOARD_COMPENSATION.csv
| 항목 | 내용 |
|------|------|
| **설명** | 이사 유형별(사내·사외) 보수 총액·평균·최대·성과급 비율. CEO 급여비율 포함 |
| **행수** | 2행 |
| **GRI** | GRI 2-19 |
| **주요 컬럼** | `director_type`, `total_compensation_m`, `avg_compensation_m`, `ceo_pay_ratio` |

#### ERP_SHAREHOLDER.csv
| 항목 | 내용 |
|------|------|
| **설명** | 정기주주총회 5개 안건별 의결권 행사 결과. 참석률·승인율·전자투표 여부 |
| **행수** | 5행 |
| **GRI** | GRI 2-10 |
| **주요 컬럼** | `agenda_name`, `attendance_rate_pct`, `approval_rate_pct`, `result` |

#### ERP_PENSION.csv
| 항목 | 내용 |
|------|------|
| **설명** | 확정급여형(DB) / 확정기여형(DC) 퇴직연금 기금 잔액·기여금·수혜자 수 |
| **행수** | 8행 (2개 유형 × 4분기) |
| **GRI** | GRI 201-3 |
| **주요 컬럼** | `plan_type`, `fund_balance_m`, `contribution_m`, `funded_ratio_pct` |
| **비고** | DB 잔액 2,031,105백만원 / DC 230,693백만원 |

#### ERP_CONTRIBUTION.csv
| 항목 | 내용 |
|------|------|
| **설명** | 무역협회비·정치후원금·로비활동비 등 출연금 분기별 상세 |
| **행수** | 24행 (6개 항목 × 4분기) |
| **GRI** | GRI 415-1 |
| **주요 컬럼** | `contribution_type`, `recipient`, `amount_m`, `political_yn` |
| **비고** | 정치후원금·로비활동비 0원 |

#### ERP_COMMUNITY_INVEST.csv
| 항목 | 내용 |
|------|------|
| **설명** | 사회공헌 프로그램별 투자금액·수혜자·봉사시간 |
| **행수** | 28행 |
| **GRI** | GRI 413-1 |
| **주요 컬럼** | `program_name`, `program_category`, `investment_krw`, `beneficiary_count`, `volunteer_hours` |

#### ERP_CUSTOMER_SATISFACTION.csv
| 항목 | 내용 |
|------|------|
| **설명** | 6개 사업부문별 반기 고객만족도. NPS·CSAT·불만 건수·해결률 |
| **행수** | 12행 (6개 부문 × 2회) |
| **GRI** | GRI 2-29 |
| **주요 컬럼** | `business_division`, `nps_score`, `csat_score_5pt`, `complaint_count`, `complaint_resolution_rate_pct` |

---

### EHS — 안전보건환경시스템

> **원본 시스템:** EHS 관리시스템 (TMS 자동측정 + 법정 자가측정 + 산재 보고 연계)  
> **파일 수:** 6개 | **총 행수:** 430행

#### EHS_AIR_EMISSION.csv
| 항목 | 내용 |
|------|------|
| **설명** | 비상발전기 대기오염물질 배출량. NOx·SOx·먼지·CO. 분기 테스트 가동 기준 |
| **행수** | 28행 (7개 사업장 × 4분기) |
| **GRI** | GRI 305-7 |
| **주요 컬럼** | `site_code`, `quarter`, `nox_kg`, `sox_kg`, `dust_kg`, `co_kg`, `measurement_method` |

#### EHS_WASTEWATER.csv
| 항목 | 내용 |
|------|------|
| **설명** | 냉각탑 블로우다운·생활하수 방류 수질 데이터. BOD·COD·SS·TN·TP 포함 |
| **행수** | 32행 |
| **GRI** | GRI 303-4 |
| **주요 컬럼** | `site_code`, `quarter`, `discharge_destination`, `bod_mg_l`, `cod_mg_l`, `ss_mg_l` |

#### EHS_CHEMICAL_USAGE.csv
| 항목 | 내용 |
|------|------|
| **설명** | 수처리제·소화약제·전해질 등 약품 10종 사용량. CAS번호·MSDS·규제 여부 포함 |
| **행수** | 200행 |
| **GRI** | GRI 303-1 |
| **주요 컬럼** | `chemical_name`, `cas_number`, `usage_kg`, `regulatory_status`, `storage_location` |

#### EHS_SAFETY_KPI.csv
| 항목 | 내용 |
|------|------|
| **설명** | 사업장·근로자유형별 안전보건 KPI. 사망·재해·TRIR·LTIR·아차사고·근무손실일수 포함 |
| **행수** | 36행 |
| **갱신주기** | 분기별 |
| **GRI** | GRI 403-9 |
| **IFRS S2** | §29 |
| **주요 컬럼** | `site_code`, `worker_type`, `total_workers`, `fatality_count`, `trir`, `ltir`, `severity_rate` |

#### EHS_SAFETY_TRAINING.csv
| 항목 | 내용 |
|------|------|
| **설명** | DC 특화 법정 안전교육 실적 (전기안전·고소작업·DR훈련 등 6개 유형) |
| **행수** | 120행 |
| **갱신주기** | 분기별 |
| **GRI** | GRI 403-5 |
| **주요 컬럼** | `site_code`, `quarter`, `training_type`, `participant_count`, `hours_per_person`, `regulatory_yn` |

#### EHS_HEALTH_PROGRAM.csv
| 항목 | 내용 |
|------|------|
| **설명** | 임직원 보건 프로그램 (건강검진·정신건강·금연·VDT 예방) 반기 실적 |
| **행수** | 14행 |
| **갱신주기** | 반기별 |
| **GRI** | GRI 403-6 |
| **주요 컬럼** | `program_name`, `participant_count`, `coverage_rate_pct`, `health_checkup_rate_pct` |

---

### HR — 인사시스템

> **원본 시스템:** HRIS (SAP HCM) + LMS + 급여시스템  
> **파일 수:** 8개 | **총 행수:** 467행

#### HR_EMPLOYEE_HEADCOUNT.csv
| 항목 | 내용 |
|------|------|
| **설명** | 연결 기준 임직원 현황. 국내·해외 7개 권역, 고용형태·성별·연령별 분해 |
| **행수** | 208행 |
| **갱신주기** | 분기별 |
| **GRI** | GRI 2-7 |
| **앵커** | 국내 20,150명 + 해외 6,251명 = 26,401명 (오차 129명) |

#### HR_EMPLOYEE_MOVEMENT.csv
| 항목 | 내용 |
|------|------|
| **설명** | 신규채용·이직 현황. 채용률 8%·이직률 5% 기준. 자발적·비자발적 구분 |
| **행수** | 64행 |
| **GRI** | GRI 401-1 |
| **주요 컬럼** | `region`, `employment_type`, `gender`, `new_hire_count`, `new_hire_rate_pct`, `turnover_count` |

#### HR_TRAINING.csv
| 항목 | 내용 |
|------|------|
| **설명** | 10개 교육 카테고리별 참여자·교육시간·비용. AI·클라우드 교육 8,269명 반영 |
| **행수** | 160행 |
| **GRI** | GRI 404-1 |
| **주요 컬럼** | `training_category`, `participant_count`, `training_hours_per_person`, `training_cost_krw` |

#### HR_PARENTAL_LEAVE.csv
| 항목 | 내용 |
|------|------|
| **설명** | 성별 육아휴직 취득·복직·유지율. 여성 취득률 92%·남성 68% |
| **행수** | 8행 (2개 성별 × 4분기) |
| **GRI** | GRI 401-3 |
| **주요 컬럼** | `gender`, `entitled_count`, `taken_count`, `take_rate_pct`, `return_rate_pct` |

#### HR_COMPENSATION.csv
| 항목 | 내용 |
|------|------|
| **설명** | 직급별 기본급·성과급·성별 임금격차. Q4 연간 기준 |
| **행수** | 7행 |
| **갱신주기** | 연간 |
| **GRI** | GRI 202-1 |
| **주요 컬럼** | `job_level`, `avg_base_salary_krw`, `avg_total_comp_krw`, `gender_pay_gap_pct` |

#### HR_DIVERSITY_DETAIL.csv
| 항목 | 내용 |
|------|------|
| **설명** | 다양성 지표 상세. 여성관리자·장애인·고령자·외국인 현황 및 목표 대비 GAP |
| **행수** | 7행 |
| **갱신주기** | 연간 |
| **GRI** | GRI 405-1 |
| **앵커** | 여성 관리자 비율 26.4% (앵커 26.3%, 오차 0.1%) ✅ |

#### HR_BOARD_COMPOSITION.csv
| 항목 | 내용 |
|------|------|
| **설명** | 이사회 9명 구성 상세. 전문성·독립성·위원회 참여·참석률·보유주식 포함 |
| **행수** | 9행 |
| **갱신주기** | 연간 |
| **GRI** | GRI 2-9 |
| **IFRS S2** | §C |
| **앵커** | 사외이사 6명(66.7%) / 여성 2명(22.2%) ✅ |

#### HR_BOARD_COMMITTEE.csv
| 항목 | 내용 |
|------|------|
| **설명** | 4개 이사회 위원회(감사·ESG·보상·리스크) 운영 현황. 회의 횟수·참석률·주요 안건 |
| **행수** | 4행 |
| **갱신주기** | 연간 |
| **GRI** | GRI 2-9 |
| **IFRS S2** | §C |

---

### PLM — 제품수명주기관리시스템

> **원본 시스템:** PLM (제품 환경규정·탄소발자국·에코디자인 관리)  
> **파일 수:** 3개 | **총 행수:** 49행  
> **대상 제품:** 클라우드·물류IT(Cello)·스마트팩토리·AI플랫폼 등 8개 주요 서비스

#### PLM_PRODUCT_CARBON.csv
| 항목 | 내용 |
|------|------|
| **설명** | 주요 8개 IT서비스 제품별 탄소발자국(LCA 기반). 서비스 단위당 kgCO₂e, 연간 총배출량, 기준연도 대비 감축률 포함 |
| **행수** | 8행 (제품별 1행) |
| **갱신주기** | 연간 |
| **GRI** | GRI 305-3 (Scope3 Cat.11 제품사용) |
| **주요 컬럼** | `product_code`, `product_name`, `service_unit`, `carbon_footprint_kgco2e_per_unit`, `cradle_to_gate_kgco2e`, `use_phase_kgco2e`, `annual_total_emission_tco2e`, `reduction_vs_baseline_pct`, `eco_design_applied_yn` |
| **비고** | 보고서 미공개 항목 — 업계 기준 가상 생성값 |

**주요 제품별 탄소발자국 (2024)**

| 제품명 | 서비스 단위 | 단위당 탄소발자국 | 기준연도 대비 감축 |
|--------|-----------|---------------|----------------|
| Samsung Cloud Platform | VM 1개·1개월 | 12.5 kgCO₂e | -18.2% |
| Cello Square (물류IT) | TEU 1개 운송관리 | 0.85 kgCO₂e | -12.4% |
| Nexplant (스마트팩토리) | 공장 1개소·1년 | 8,200 kgCO₂e | -8.5% |
| Brightics AI | GPU 노드 1개·1시간 | 2.15 kgCO₂e | -22.1% |
| 블록체인 공급망 추적 | 트랜잭션 1만건 | 0.28 kgCO₂e | -31.5% |

#### PLM_PRODUCT_COMPLIANCE.csv
| 항목 | 내용 |
|------|------|
| **설명** | 5개 주요 제품 × 7개 환경규정 준수 현황 (RoHS·WEEE·REACH·K-RoHS·CFP·Energy Star·EPD) |
| **행수** | 35행 (5개 제품 × 7개 규정) |
| **갱신주기** | 연간 (규정 변경 시 수시) |
| **GRI** | GRI 301-3 |
| **주요 컬럼** | `product_code`, `regulation_name`, `regulation_region`, `compliance_status`, `compliance_rate_pct`, `non_compliance_count`, `hazardous_substance_yn` |
| **적용 규정** | EU RoHS 2.0 / WEEE / REACH / K-RoHS / 탄소발자국 인증(CFP) / Energy Star / EPD |

#### PLM_ECODESIGN.csv
| 항목 | 내용 |
|------|------|
| **설명** | 에코디자인 원칙별 적용 현황. 에너지절감량·CO₂감축량·적용단계·SDG 연계 포함 |
| **행수** | 6행 |
| **갱신주기** | 연간 |
| **GRI** | GRI 301-2 |
| **주요 컬럼** | `product_code`, `ecodesign_principle`, `implementation_status`, `energy_saving_kwh_annual`, `co2_reduction_tco2e_annual`, `sdg_linkage` |

---

### SRM — 공급망관리시스템

> **원본 시스템:** SRM (구매포털 + 협력사 ESG 평가 시스템)  
> **파일 수:** 3개 | **총 행수:** 51행

#### SRM_SUPPLIER_ESG.csv
| 항목 | 내용 |
|------|------|
| **설명** | Tier1 협력사 15개사 ESG 종합 평가. ESG 점수·온실가스 보고여부·현장감사·중요이슈 포함 |
| **행수** | 15행 |
| **갱신주기** | 연간 |
| **GRI** | GRI 308-1 / GRI 414-1 |
| **주요 컬럼** | `supplier_name`, `esg_score`, `supplier_emission_tco2e`, `audit_yn`, `critical_issue_yn` |

#### SRM_SUPPLIER_PURCHASE.csv
| 항목 | 내용 |
|------|------|
| **설명** | 구매 카테고리(IT장비·SW·시설·인력·통신·물류)·지역별 협력회사 구매금액 |
| **행수** | 32행 (8개 카테고리 × 4분기) |
| **갱신주기** | 분기별 |
| **GRI** | GRI 204-1 |
| **앵커** | 연간 합계 1,871,708백만원 ✅ |

#### SRM_MUTUAL_GROWTH.csv
| 항목 | 내용 |
|------|------|
| **설명** | 상생경영 4개 펀드(저금리대출·기술투자·스마트공장·글로벌진출) 현황. 수혜사 수·경제효과 포함 |
| **행수** | 4행 |
| **갱신주기** | 연간 |
| **GRI** | GRI 203-1 |

---

### MDG — 마스터데이터관리

> **원본 시스템:** MDG (기준정보 관리 시스템 — 모든 시스템이 참조)  
> **파일 수:** 3개 | **총 행수:** 22행  
> **갱신주기:** 변경 발생 시 (연 1~2회)

#### MDG_SITE_MASTER.csv
| 항목 | 내용 |
|------|------|
| **설명** | 9개 사업장 기준정보. PUE 목표·IT용량·냉각방식·주소·좌표 포함. 모든 파일의 `site_code` 조인 키 |
| **행수** | 9행 |
| **주요 컬럼** | `site_code`, `site_name`, `site_type`, `pue_target`, `it_capacity_kw`, `cooling_method` |

**사업장 목록**

| site_code | 사업장명 | 유형 | PUE 목표 | IT 용량 |
|-----------|---------|------|---------|--------|
| SITE-DC01 | 수원 데이터센터 | DC | 1.18 | 20,000 kW |
| SITE-DC02 | 동탄 데이터센터 | DC (액침냉각) | 1.15 | 18,000 kW |
| SITE-DC03 | 상암 데이터센터 | DC | 1.22 | 12,000 kW |
| SITE-DC04 | 춘천 데이터센터 | DC | 1.16 | 15,000 kW |
| SITE-DC05 | 구미 데이터센터 | DC | 1.20 | 10,000 kW |
| SITE-OF01 | 잠실 본사 | 오피스 | — | — |
| SITE-OF02 | 수원 오피스 | 오피스 | — | — |
| SITE-OF03 | 구미 오피스 | 오피스 | — | — |
| SITE-WH01 | 인천 물류지원센터 | 물류 | — | — |

#### MDG_ENERGY_SUPPLIER.csv
| 항목 | 내용 |
|------|------|
| **설명** | 에너지 조달업체 5개사. Scope2 마켓기반 산정의 **배출계수·잔여믹스계수** 기준값 |
| **행수** | 5행 |
| **GRI** | GRI 302-1 | **IFRS S2** | §B6 |
| **주요 컬럼** | `supplier_name`, `energy_type`, `emission_factor_kgco2_kwh`, `residual_mix_factor` |

#### MDG_WASTE_CONTRACTOR.csv
| 항목 | 내용 |
|------|------|
| **설명** | 폐기물·냉매 위탁처리업체 8개사. 환경부 허가번호·처리방법·연간 처리용량 포함 |
| **행수** | 8행 |
| **주요 컬럼** | `contractor_name`, `waste_type`, `treatment_method`, `license_number`, `annual_capacity_ton` |

---

## 5. GRI / IFRS S2 매핑

| GRI 기준 | 관련 파일 | ESG 영역 |
|---------|----------|---------|
| GRI 2-7 임직원 수 | `HR_EMPLOYEE_HEADCOUNT` | S |
| GRI 2-9 이사회 구성 | `HR_BOARD_COMPOSITION`, `HR_BOARD_COMMITTEE` | G |
| GRI 2-10 주주총회 | `ERP_SHAREHOLDER` | G |
| GRI 2-12 리스크관리 | `ERP_RISK_MANAGEMENT` | G |
| GRI 2-19 이사 보수 | `ERP_BOARD_COMPENSATION` | G |
| GRI 2-29 이해관계자 | `ERP_CUSTOMER_SATISFACTION`, `ERP_DIGITAL_RESPONSIBILITY` | S |
| GRI 201-1 재무성과 | `ERP_FINANCIAL_SUMMARY`, `ERP_VALUE_DISTRIBUTION`, `ERP_RD_PATENT` | 경제 |
| GRI 201-3 퇴직연금 | `ERP_PENSION` | 경제 |
| GRI 202-1 보상 | `HR_COMPENSATION` | S |
| GRI 203-1 지역사회투자 | `SRM_MUTUAL_GROWTH`, `ERP_COMMUNITY_INVEST` | S |
| GRI 204-1 구매 | `SRM_SUPPLIER_PURCHASE` | S |
| GRI 205-3 반부패 | `ERP_ETHICS` | G |
| GRI 207-4 세금 | `ERP_TAX_DETAIL` | 경제 |
| GRI 301-2/3 소재 | `PLM_ECODESIGN`, `PLM_PRODUCT_COMPLIANCE` | E |
| GRI 302-1 에너지 | `EMS_ENERGY_USAGE`, `EMS_RENEWABLE_ENERGY` | E |
| GRI 302-3 에너지집약도 | `EMS_DC_PUE_MONTHLY` | E |
| GRI 303-3/4 용수 | `ENV_WATER_DETAIL`, `EMS_PUREWATER_USAGE`, `EHS_WASTEWATER` | E |
| GRI 304-1 생물다양성 | `ENV_BIODIVERSITY` | E |
| GRI 305-1/2 Scope1·2 | `GHG_SCOPE12_SUMMARY` | E |
| GRI 305-3 Scope3 | `GHG_SCOPE3_DETAIL`, `PLM_PRODUCT_CARBON` | E |
| GRI 305-7 대기오염 | `EHS_AIR_EMISSION` | E |
| GRI 306-2/3/4 폐기물 | `ENV_WASTE_DETAIL`, `EMS_IT_ASSET_DISPOSAL` | E |
| GRI 307-1 환경규정 | `ENV_INVESTMENT` | E |
| GRI 308-1 공급망환경 | `SRM_SUPPLIER_ESG` | E/S |
| GRI 401-1 채용·이직 | `HR_EMPLOYEE_MOVEMENT` | S |
| GRI 401-3 육아휴직 | `HR_PARENTAL_LEAVE` | S |
| GRI 403-5/6/9 안전보건 | `EHS_SAFETY_KPI`, `EHS_SAFETY_TRAINING`, `EHS_HEALTH_PROGRAM` | S |
| GRI 404-1 교육훈련 | `HR_TRAINING` | S |
| GRI 405-1 다양성 | `HR_DIVERSITY_DETAIL` | S |
| GRI 413-1 지역사회 | `ERP_COMMUNITY_INVEST` | S |
| GRI 414-1 공급망사회 | `SRM_SUPPLIER_ESG` | S |
| GRI 415-1 정치기여 | `ERP_CONTRIBUTION` | G |
| GRI 418-1 개인정보 | `ERP_INFORMATION_SECURITY` | G |
| **IFRS S2 §B6** | `EMS_ENERGY_USAGE`, `EMS_RENEWABLE_ENERGY`, `MDG_ENERGY_SUPPLIER` | E |
| **IFRS S2 §B8** | `EMS_DC_PUE_MONTHLY` | E |
| **IFRS S2 §29** | `GHG_SCOPE12_SUMMARY`, `GHG_SCOPE3_DETAIL`, `ERP_RISK_MANAGEMENT` | E/G |
| **IFRS S2 §C** | `HR_BOARD_COMPOSITION`, `HR_BOARD_COMMITTEE` | G |
| **EU Taxonomy** | `ERP_EU_TAXONOMY` | 경제 |
| **EU AI Act** | `ERP_DIGITAL_RESPONSIBILITY` | G |

---

## 6. 사업장 기준정보

모든 환경·안전 데이터는 `MDG_SITE_MASTER.csv`의 `site_code`를 조인 키로 사용합니다.

```
에너지 집계 (2024 앵커, TJ 기준):
  수원DC  1,159 TJ  |  동탄DC  805 TJ  |  춘천DC  345 TJ
  구미DC    170 TJ  |  상암DC   98 TJ
  ─────────────────────────────────────────────
  DC 소계 2,577 TJ + 오피스·물류 295 TJ = 총 3,782 TJ (전사 연결)
```

---

## 7. 주의사항

### 더미데이터 활용 범위

```
✅ 가능  ESG 플랫폼 기능 테스트 · UI/UX 개발 · GHG 산정 로직 검증
✅ 가능  SR 보고서 레이아웃·템플릿 개발 · GRI/IFRS S2 매핑 테스트
⚠️ 주의  보고서 앵커 외 수치는 실제 보고서 발간 전 반드시 실데이터로 교체
❌ 불가  대외 공시·투자자 제공·실적 발표용 활용
```

### 실데이터 교체 우선순위

| 우선순위 | 파일 | 이유 |
|---------|------|------|
| **즉시** | `GHG_SCOPE12_SUMMARY`, `EMS_ENERGY_USAGE` | 제3자 검증 필요, 보고서 핵심 |
| **즉시** | `HR_EMPLOYEE_HEADCOUNT`, `ERP_FINANCIAL_SUMMARY` | 법적 공시 의무 |
| **Q1** | `PLM_PRODUCT_CARBON`, `GHG_SCOPE3_DETAIL` | 추정값 비중 높음 |
| **연간** | `HR_BOARD_COMPOSITION`, `ERP_EU_TAXONOMY` | 구조 변경 가능성 |

### 파일 간 조인 관계

```
MDG_SITE_MASTER          ← 모든 EMS·EHS 파일의 site_code 참조
MDG_ENERGY_SUPPLIER      ← GHG 산정 시 배출계수 참조
MDG_WASTE_CONTRACTOR     ← ENV_WASTE_DETAIL의 처리업체 참조
ERP_FINANCIAL_SUMMARY    ← GHG 원단위(tCO₂e/억원) 분모 참조
PLM_PRODUCT_CARBON       ← GHG_SCOPE3_DETAIL Cat.11(제품사용) 집계값 참조
```
