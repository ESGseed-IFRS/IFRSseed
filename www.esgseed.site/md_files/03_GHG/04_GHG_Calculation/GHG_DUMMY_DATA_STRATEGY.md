# GHG 산정 — 더미데이터 기반 전략

> **목적**: `DUMMY_DATA_PLANNING.md`에 정의된 7개 내부시스템(EMS·ERP·EHS·PLM·SRM·HR·MDG) 더미데이터를 GHG 산정의 **핵심 데이터 소스**로 두고, 워크플로우·공시 전략·산정 입력 구조를 정합성 있게 정립한다.  
> **관련 문서**: `DUMMY_DATA_PLANNING.md`, `GHG_DUMMY_DATA_STRATEGY_v2.md`, `GHG_TAB_DESIGN.md`, `JOURNEYMAP_GHG_v2.md`

---

## 1. 전략 개요

### 1.1 전제

| 항목 | 내용 |
|------|------|
| **데이터 소스** | `DUMMY_DATA_PLANNING.md`에 정의된 CSV 더미데이터 (7개 시스템) |
| **입력 경로** | (1) ON-PREM 내부시스템 자동 연동 (2) 시스템별 불러오기 버튼 (3) 엑셀 업로드 (4) 수동 입력 |
| **산정 입력 탭** | 전력·열·스팀 / 연료·차량 / 냉매 / 폐기물 / 물류·출장·통근 / 원료·제품 (6개, `GHG_TAB_DESIGN.md` 확정) |
| **GHG 화면 3탭** | 산정 입력 / 산정 결과 / 감사 대응 |
| **감사 대응 탭 역할** | IFRS S2 요건별 데이터 계보 추적·수동 조정 이력·배출계수 스냅샷 확인 (`GHG_DUMMY_DATA_STRATEGY_v2.md` §3.3) |
| **공시기준** | ISSB, KSSB, K-ETS, GRI, ESRS 5개 |

### 1.2 관련 전략 문서 역할 분담

| 문서 | 역할 |
|------|------|
| 본 문서 | 더미데이터 → GHG 산정 매핑·워크플로우·공시 전략 전반 |
| `GHG_TAB_DESIGN.md` | 6개 산정 입력 탭 구조·네이밍·소스 파일 매핑 확정 |
| `GHG_DUMMY_DATA_STRATEGY_v2.md` | 데이터 계보(Lineage)·IFRS S2 감사 대응·증빙 패키지 전략 |
| `DUMMY_DATA_PLANNING.md` | 14개 CSV 파일 컬럼 정의·계보 공통 컬럼(§6-1) |

---

## 2. 더미데이터 → GHG 산정 매핑

### 2.1 시스템별 GHG 기여

| 시스템 | 소스 파일 | Scope | 산정 입력 탭 |
|--------|-----------|-------|-------------|
| **EMS** | EMS_ENERGY_USAGE | Scope 2 (전력·열·스팀) | 전력·열·스팀 |
| **EMS** | EMS_WASTE | Scope 1·3 (폐기물 소각, Cat.12) | 폐기물 |
| **ERP** | ERP_FUEL_PURCHASE | Scope 1 (고정·이동 연소) | 연료·차량 |
| **EHS** | EHS_REFRIGERANT | Scope 1 (탈루) | 냉매 |
| **PLM** | PLM_PRODUCT_CARBON | Scope 3 (Cat.11·12) | 원료·제품 |
| **SRM** | SRM_SUPPLIER_ESG, SRM_LOGISTICS | Scope 3 (Cat.1, 4, 9) | 물류·출장·통근 / 원료·제품 |
| **HR** | HR_COMMUTE_BUSINESS_TRAVEL | Scope 3 (Cat.6·7) | 물류·출장·통근 |
| **MDG** | MDG_SITE_MASTER, MDG_EMISSION_FACTOR | 기준정보 | 사업장·배출계수 기준 |

### 2.2 Scope별 소스 파일 매핑

| Scope | 카테고리 | 소스 파일 |
|-------|----------|-----------|
| **Scope 1** | 고정연소·이동연소 | `ERP_FUEL_PURCHASE.csv` |
| **Scope 1** | 탈루(냉매) | `EHS_REFRIGERANT.csv` |
| **Scope 1** | 폐기물 소각 | `EMS_WASTE.csv` (`incineration_amount` 컬럼 기준) |
| **Scope 2** | 전력·열·스팀 | `EMS_ENERGY_USAGE.csv` |
| **Scope 3** | Cat.1 구매물품 | `SRM_SUPPLIER_ESG.csv` |
| **Scope 3** | Cat.4·9 물류 | `SRM_LOGISTICS.csv` |
| **Scope 3** | Cat.6·7 출장·통근 | `HR_COMMUTE_BUSINESS_TRAVEL.csv` |
| **Scope 3** | Cat.11·12 제품 | `PLM_PRODUCT_CARBON.csv` |

### 2.3 배출계수·사업장 기준

- **배출계수**: `MDG_EMISSION_FACTOR.csv` (`factor_id`, `energy_type`, `emission_factor`, `reference_year` 등)
- **사업장**: `MDG_SITE_MASTER.csv` (`site_code`, `site_name`, `site_type` — SITE-001~005)

---

## 3. 워크플로우 전략

### 3.1 데이터 수집 (1단계)

| 채널 | 실무 동작 | 더미데이터 연동 |
|------|-----------|-----------------|
| **ON-PREM 자동 연동** | 기설정 I/F 주기로 자동 적재 | 7개 시스템 CSV → store 적재. `synced_at`, `source_system` 자동 기록 |
| **시스템별 불러오기** | 탭별 불러오기 버튼 클릭 → 해당 탭 데이터만 로드 | EMS 전체 불러오기 → 전력·열·스팀 탭 + 폐기물 탭 자동 분배 |
| **엑셀 업로드** | 표준 템플릿 업로드 | `DUMMY_DATA_PLANNING.md` 컬럼 구조와 호환. `source_system = 수동` 기록 |
| **수동 입력** | 탭별 폼 직접 입력 | store 직접 갱신. `source_system = 수동`, `updated_by` 기록 |

### 3.2 원시 데이터 검증 (2단계)

- 적재 데이터를 **시스템 출처별**로 표시 (`source_system`: EMS / ERP / EHS / SRM / HR / PLM / 수동)
- `record_id`, `site_code`, `year`, `month` 기준 coverage 요약
- `data_quality` (M1/M2/E1/E2) 등급 표시
- `synced_at` vs `updated_at` 비교 → 수동 조정 이력 플래그 표시

### 3.3 활동자료 매핑 (3단계)

- 더미데이터 컬럼 → 산정용 필드 매핑 (예: `usage_amount` → amount, `consumption_amount` → amount)
- Scope 1/2/3 내부 구조로 변환 후 배출계수 적용
- `EMS_WASTE.csv`의 `disposal_method` 컬럼 기준으로 Scope 1(소각) / Scope 3(위탁) 자동 분류

### 3.4 배출량 산정·결과 (4단계)

- `MDG_EMISSION_FACTOR.csv` 기반 배출계수 적용
- 산정 시 `applied_factor_id`, `applied_factor_value`, `applied_factor_version` **스냅샷 고정 저장**
- Scope 2: location-based / market-based (`EMS_ENERGY_USAGE.renewable_ratio` 반영)
- 결과 블록: tCO₂e, 적용 배출계수·산식, 산정 버전 히스토리 (v1/v2/v3)

### 3.5 감사 대응 (5단계)

- IFRS S2 요건별 자동 체크 및 데이터 계보 드릴다운
- 수동 조정 이력·배출계수 버전 불일치 경고 표시
- 상세 내용: `GHG_DUMMY_DATA_STRATEGY_v2.md` §3.3 참조

---

## 4. 산정 입력 탭 구조 — 확정

> **이전 버전(옵션 A/B/C)에서 확정으로 변경**  
> 대화를 통해 "활동 유형 기준 6개 탭"으로 최종 결정. 근거 및 상세는 `GHG_TAB_DESIGN.md` 참조.

### 4.1 확정된 탭 구조

| 탭 | 소스 시스템 | 소스 파일 | 내부 Scope |
|----|------------|-----------|-----------|
| **전력·열·스팀** | EMS | `EMS_ENERGY_USAGE.csv` | Scope 2 |
| **연료·차량** | ERP | `ERP_FUEL_PURCHASE.csv` | Scope 1 |
| **냉매** | EHS | `EHS_REFRIGERANT.csv` | Scope 1 탈루 |
| **폐기물** | EMS | `EMS_WASTE.csv` | Scope 1·3 |
| **물류·출장·통근** | SRM·HR | `SRM_LOGISTICS.csv`, `HR_COMMUTE_BUSINESS_TRAVEL.csv` | Scope 3 |
| **원료·제품** | SRM·PLM | `SRM_SUPPLIER_ESG.csv`, `PLM_PRODUCT_CARBON.csv` | Scope 3 |

### 4.2 탭 네이밍 원칙

- **활동 유형 기준**: 실무자가 "내가 어떤 데이터를 갖고 있는가"로 탭을 찾을 수 있어야 한다
- **Scope는 2차 정보**: 탭 이름에 Scope를 넣지 않되, 탭 상단 배지로 병기
- **03 공정배출**: Phase 1 미노출. Phase 2에서 `ERP_PRODUCTION` 더미 추가 시 탭 노출

### 4.3 EMS 이중 소속 처리

EMS는 전력·열·스팀 탭과 폐기물 탭 두 곳에 데이터를 공급한다.  
"EMS 전체 불러오기" 버튼 한 번으로 시스템이 파일 내 컬럼을 보고 자동 분배한다.

```
"EMS 전체 불러오기" 클릭
    ↓
EMS_ENERGY_USAGE → 전력·열·스팀 탭
EMS_WASTE        → 폐기물 탭
    ↓
토스트: "전력·열·스팀 240건, 폐기물 120건 적재 완료"
```

---

## 5. 공시 전략

### 5.1 원시 데이터 출처 표기

- `source_system`: `EMS` / `ERP` / `EHS` / `PLM` / `SRM` / `HR` / `수동`
- `record_id` 접두어로 출처 식별 (예: `EMS-E-`, `ERP-F-`, `EHS-R-`)

### 5.2 공시기준별 더미데이터 활용

| 기준 | Scope | 활용 더미 파일 |
|------|-------|---------------|
| **K-ETS** | 1·2 | ERP_FUEL, EMS_ENERGY, EHS_REFRIGERANT |
| **KSSB/ISSB** | 1·2·3 | 전체 14개 파일 |
| **GRI** | 1·2·3 | 전체 14개 파일 |
| **ESRS** | 1·2·3 (15 cat) | 전체 + 확장 파일 (Phase 2) |

### 5.3 배출계수 버전 관리

`MDG_EMISSION_FACTOR.csv`의 `factor_id`, `reference_year`, `valid_from`/`valid_to` 활용.  
산정 시 아래 3개 필드를 **스냅샷으로 고정 저장**한다. (필드명 `GHG_DUMMY_DATA_STRATEGY_v2.md` §2.3 기준으로 통일)

| 필드명 | 설명 | 예시값 |
|--------|------|--------|
| `applied_factor_id` | 적용 배출계수 ID | EF-LNG-2023 |
| `applied_factor_value` | 적용 배출계수 값 (산정 시점 고정) | 2.15900 |
| `applied_factor_version` | 배출계수 버전·기준연도·출처 | 2023-환경부 |

> MDG 배출계수가 이후 갱신되더라도 당시 산정 근거가 보존되어 감사 대응 시 계보 추적 가능.

---

## 6. 구현 Phase

| Phase | 내용 | 산출물 |
|-------|------|--------|
| **Phase 1** | 더미데이터 로더·store 연동 | CSV → store 변환, `source_system`·`synced_at` 필드 적재 |
| **Phase 2** | 6개 산정 입력 탭 구현 | `GHG_TAB_DESIGN.md` 기준 탭 구조·불러오기 버튼·계보 뱃지 |
| **Phase 3** | 산정 결과 탭 | 배출계수 스냅샷 저장, 산정 버전 히스토리 (v1/v2/v3) |
| **Phase 4** | 감사 대응 탭 | IFRS S2 요건 체크, 계보 드릴다운, 수동 조정 플래그 |
| **Phase 5** | 리포트 생성·증빙 패키지 | PDF·Excel 5종 다운로드 (`GHG_DUMMY_DATA_STRATEGY_v2.md` §5) |
| **Phase 6** | 03 공정배출 | ERP_PRODUCTION 더미 추가 + 탭 노출 |

---

## 7. 요약

| 항목 | 내용 |
|------|------|
| **데이터 소스** | `DUMMY_DATA_PLANNING.md` 7개 시스템 14개 CSV |
| **워크플로우** | ON-PREM 자동 연동 → 탭별 확인·검증 → 산정 → 감사 대응 → 리포트 |
| **산정 입력 탭** | 활동 유형 기준 6개 탭 확정 (`GHG_TAB_DESIGN.md`) |
| **데이터 계보** | source_system·synced_at·updated_by·applied_factor_id 등 전 파일 공통 적용 |
| **감사 대응** | IFRS S2 요건 자동 체크·드릴다운·증빙 패키지 5종 (`GHG_DUMMY_DATA_STRATEGY_v2.md`) |
| **공시기준** | ISSB/KSSB/K-ETS/GRI/ESRS 5개 |

---

## 참조

- `DUMMY_DATA_PLANNING.md` — 14개 CSV 컬럼 정의, 공통 계보 컬럼(§6-1)
- `GHG_TAB_DESIGN.md` — 6개 입력 탭 구조·네이밍·근거
- `GHG_DUMMY_DATA_STRATEGY_v2.md` — 데이터 계보·감사 대응·증빙 패키지
- `JOURNEYMAP_GHG_v2.md` — GHG 산정 전체 사용자 흐름
