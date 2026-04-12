# 삼성SDS 실제 사업장 기반 GHG 더미 데이터

## 개요

이 데이터는 **실제 삼성SDS 2024년 지속가능경영보고서**의 사업장 정보와 배출량 데이터를 기반으로 생성한 더미 데이터입니다.

### 참고 자료
- `SDS_ESG_DATA/README.md` - 실제 보고서 기반 앵커 값
- `MDG_SITE_MASTER.csv` - 9개 사업장 정보
- `GHG_SCOPE12_SUMMARY.csv` - 실제 검증된 Scope 1/2 배출량
- `GHG_SCOPE3_DETAIL.csv` - 실제 14개 카테고리 배출량

---

## 데이터 구조

### 지주사: 삼성에스디에스 주식회사

**실제 2024년 배출량 (제3자 검증: DNV)**
- Scope 1: **184,807 tCO₂e**
- Scope 2 (Market-based): **179,480 tCO₂e**
- Scope 3: **2,992,478 tCO₂e**
- **합계: 3,356,765 tCO₂e**

**9개 사업장**

| 코드 | 사업장명 | 유형 | PUE 목표 | IT 용량 |
|------|---------|------|----------|---------|
| SITE-DC01 | 수원 데이터센터 | DC | 1.18 | 20,000 kW |
| SITE-DC02 | 동탄 데이터센터 | DC (액침냉각) | 1.15 | 18,000 kW |
| SITE-DC03 | 상암 데이터센터 | DC | 1.22 | 12,000 kW |
| SITE-DC04 | 춘천 데이터센터 | DC | 1.16 | 15,000 kW |
| SITE-DC05 | 구미 데이터센터 | DC | 1.20 | 10,000 kW |
| SITE-CA01 | 서울 R&D 캠퍼스 | R&D | - | - |
| SITE-CA02 | 판교 IT캠퍼스 | 캠퍼스 | - | - |
| SITE-CA03 | 판교 물류캠퍼스 | 캠퍼스 | - | - |
| SITE-OF01 | 잠실 본사 | 오피스 | - | - |

**임직원 수**: 26,401명 (2024년 기준)

---

### 자회사 6개 (100% 지분 5개 + 51% 지분 1개)

#### 1. 오픈핸즈 주식회사
- **사업**: 모바일 솔루션
- **임직원**: 85명
- **배출량**: Scope1 45 / Scope2 850 / Scope3 3,200 tCO₂e
- **사업장**: 1개 (오픈핸즈 본사)

#### 2. 엠로 주식회사
- **사업**: 물류 IT 솔루션
- **임직원**: 120명
- **배출량**: Scope1 180 / Scope2 1,250 / Scope3 4,800 tCO₂e
- **사업장**: 1개 (엠로 본사)

#### 3. 멀티캠퍼스 주식회사
- **사업**: IT 교육
- **임직원**: 320명
- **배출량**: Scope1 420 / Scope2 3,850 / Scope3 8,900 tCO₂e
- **사업장**: 2개 (역삼, 선릉 교육센터)

#### 4. 에스코어 주식회사
- **사업**: 클라우드 MSP (Managed Service Provider)
- **임직원**: 450명
- **배출량**: Scope1 320 / Scope2 4,200 / Scope3 12,500 tCO₂e
- **사업장**: 1개 (에스코어 판교)

#### 5. 시큐아이 주식회사
- **사업**: 정보보안
- **임직원**: 180명
- **배출량**: Scope1 95 / Scope2 1,680 / Scope3 5,200 tCO₂e
- **사업장**: 1개 (시큐아이 서울)

#### 6. 미라콤아이앤씨 주식회사 (51% 지분)
- **사업**: 네트워크 통합
- **임직원**: 280명
- **배출량**: Scope1 220 / Scope2 2,850 / Scope3 9,100 tCO₂e
- **사업장**: 1개 (미라콤 서울)

---

## 그룹 전체 배출량

| 회사 | 구분 | Scope 1 | Scope 2 | Scope 3 | 합계 |
|------|------|---------|---------|---------|------|
| 삼성에스디에스 | 지주사 | 184,807 | 179,480 | 2,992,478 | **3,356,765** |
| 오픈핸즈 | 자회사 | 45 | 850 | 3,200 | 4,095 |
| 엠로 | 자회사 | 180 | 1,250 | 4,800 | 6,230 |
| 멀티캠퍼스 | 자회사 | 420 | 3,850 | 8,900 | 13,170 |
| 에스코어 | 자회사 | 320 | 4,200 | 12,500 | 17,020 |
| 시큐아이 | 자회사 | 95 | 1,680 | 5,200 | 6,975 |
| 미라콤아이앤씨 | 계열사 (51%) | 220 | 2,850 | 9,100 | 12,170 |
| **그룹 합계** | | **186,087** | **194,160** | **3,036,178** | **3,416,425** |

**그룹 전체 배출량: 3,416,425 tCO₂e**

---

## 폴더 구조

```
SDS_ESG_DATA_REAL/
├── holding_삼성에스디에스/
│   └── EMS/
│       ├── EMS_ENERGY_USAGE.csv       (9개 사업장 × 12개월 = 108행)
│       ├── GHG_SCOPE12_SUMMARY.csv    (Scope1/2 실제 값)
│       └── GHG_SCOPE3_DETAIL.csv      (11개 카테고리 × 4분기 = 44행)
│
├── subsidiary_오픈핸즈 주식회사/
│   └── EMS/ (동일 구조)
├── subsidiary_엠로 주식회사/
├── subsidiary_멀티캠퍼스 주식회사/
├── subsidiary_에스코어 주식회사/
├── subsidiary_시큐아이 주식회사/
├── subsidiary_미라콤아이앤씨 주식회사/
│
├── MDG/
│   └── MDG_SITE_MASTER.csv            (16개 사업장)
│
└── companies_seed.csv                 (7개 회사)
```

---

## 주요 특징

### 1. 실제 배출량 반영
- 삼성SDS 2024년 실제 배출량 사용
- 제3자 검증 완료 (DNV)
- Scope 3 14개 카테고리 실제 비중 반영

### 2. 실제 사업장 반영
- 5개 데이터센터 (수원, 동탄, 상암, 춘천, 구미)
- 3개 캠퍼스/오피스 (R&D, IT, 물류, 본사)
- PUE 목표값 실제 값 사용

### 3. 실제 자회사 반영
- 6개 실제 자회사 (오픈핸즈, 엠로, 멀티캠퍼스, 에스코어, 시큐아이, 미라콤아이앤씨)
- 각 자회사별 사업 영역 반영
- 지분율 구분 (100% / 51%)

### 4. 월별 데이터 생성
- 12개월 에너지 사용량
- 여름철 냉방 부하 반영 (7-8월 1.2배)
- 배출계수 적용 (0.4157 kgCO₂e/kWh)

---

## 데이터 활용

### 1. 계열사 데이터 제출 시뮬레이션
```python
# 자회사가 지주사에게 데이터 제출
POST /data-integration/subsidiary/submit
{
  "subsidiary_company_id": "SUB-004",  # 에스코어
  "holding_company_id": "550e8400-e29b-41d4-a716-446655440000",
  "year": 2024,
  "scope_1": true,
  "scope_2": true,
  "scope_3": true
}
```

### 2. 그룹 전체 배출량 집계
```python
# 지주사 + 모든 자회사 배출량
GET /ifrs-agent/dp/GRI_305-1/sources
  ?company_id=550e8400-e29b-41d4-a716-446655440000
  &year=2024
```

### 3. 데이터 출처 추적
```typescript
// 각 DP의 데이터 출처 표시
<DataSourceList sources={[
  { 
    source_type: "holding_own", 
    company_name: "삼성에스디에스", 
    value: 184807, 
    unit: "tCO2e" 
  },
  { 
    source_type: "subsidiary_reported", 
    company_name: "에스코어", 
    value: 320, 
    unit: "tCO2e" 
  }
]} />
```

---

## 검증 정보

### 지주사 (삼성SDS)
- **검증기관**: DNV (Det Norske Veritas)
- **검증 범위**: Scope 1, 2 (Location & Market-based)
- **검증 기준**: ISO 14064-3, GHG Protocol
- **검증 완료일**: 2024년 3월

### 자회사
- **검증 수준**: 자가 검증 (내부 검토)
- **데이터 품질**: Low ~ Medium
- **제출 주기**: 분기별

---

## 데이터 정확도

| 항목 | 정확도 | 출처 |
|------|--------|------|
| 삼성SDS Scope 1 | 100% 실제 값 | 지속가능경영보고서 2025 p.86 |
| 삼성SDS Scope 2 (Market) | 100% 실제 값 | 지속가능경영보고서 2025 p.86 |
| 삼성SDS Scope 3 | 100% 실제 값 | 지속가능경영보고서 2025 p.87 |
| 사업장 정보 (9개) | 100% 실제 값 | SDS_ESG_DATA/MDG_SITE_MASTER.csv |
| 자회사 배출량 | 추정값 | 업계 평균 기반 |
| PUE 목표값 | 실제 값 | 수원 1.18, 동탄 1.15 등 |

---

## 사용 방법

### 1. 회사 데이터 임포트
```sql
COPY companies (id, company_name, group_entity_type, parent_company_id, equity_ratio, employees, business_type, company_login_id)
FROM 'SDS_ESG_DATA_REAL/companies_seed.csv' 
DELIMITER ',' CSV HEADER;
```

### 2. 사업장 데이터 임포트
```sql
COPY staging_ems_data (...)
FROM 'SDS_ESG_DATA_REAL/holding_삼성에스디에스/EMS/EMS_ENERGY_USAGE.csv'
DELIMITER ',' CSV HEADER;
```

### 3. 마이그레이션 실행
```bash
cd backend
alembic upgrade head  # 044_subsidiary_submissions.py 적용
```

---

## 주의사항

- **실제 배출량은 삼성SDS만 적용**, 자회사는 추정값
- **자회사 사업장 주소는 가상**, 실제 주소 아님
- **Scope 3 세부 카테고리는 간소화**, 실제는 더 복잡
- **개발/테스트 목적으로만 사용**, 실제 보고서 작성 시 실데이터 교체 필수

---

## 생성일
2026-04-12

## 생성 스크립트
`backend/scripts/seeds/create_subsidiary_ghg_data.py`

## 참고 문서
- `SDS_ESG_DATA/README.md` - 실제 보고서 기반 더미 데이터 명세
- `REAL_WORLD_SUBSIDIARY_REPORTING.md` - 계열사 보고 체계
- `IMPLEMENTATION_REPORT_PHASE1_PHASE2.md` - 구현 완료 보고서
