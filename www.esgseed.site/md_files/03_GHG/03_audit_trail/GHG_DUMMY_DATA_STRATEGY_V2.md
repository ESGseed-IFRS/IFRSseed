# GHG 산정 더미데이터 전략 v2

> **목적**: ON-PREM 내부 시스템 연동 기반 더미데이터를 GHG 산정에 활용하되,  
> **데이터 계보(Data Lineage)** 를 핵심 설계 축으로 삼아 IFRS S2 감사 대응까지 커버한다.  
> **관련 문서**: `DUMMY_DATA_PLANNING.md`, `GHG_TAB_DESIGN.md`, `JOURNEYMAP_GHG_v2.md`

---

## 1. 전략 핵심 — 왜 데이터 계보가 중요한가

### 1.1 IFRS S2 감사 요건

IFRS S2는 단순히 "배출량이 얼마냐"가 아니라 **"그 숫자가 어디서 왔고, 어떻게 산정됐으며, 누가 검증했는가"** 를 요구한다.

| IFRS S2 요구 항목 | 데이터 계보로 충족하는 방법 |
|------------------|--------------------------|
| 데이터 출처 명시 | `source_system` — 어느 시스템에서 왔는가 |
| 데이터 수집 시점 | `synced_at` — ON-PREM에서 언제 넘어왔는가 |
| 수동 조정 여부 | `synced_at` vs `updated_at` 시간 차이로 감지 |
| 수정 주체 | `updated_by` — 누가 수정했는가 |
| 배출계수 근거 | `applied_factor_id`, `applied_factor_version` 스냅샷 |
| 산정 방법론 | `calculation_method`, `calculation_formula` 저장 |
| 검증 의견 | 감사 대응 탭 — 요건별 충족 여부·근거 문서 |

### 1.2 GHG 산정 화면의 3탭과 데이터 계보 연결

```
[탭 1] 산정 입력       →  활동자료 수집·확인
         ↓ source_system, synced_at, data_quality
[탭 2] 산정 결과       →  배출량 계산·검토
         ↓ applied_factor_id, calculation_formula, tCO₂e
[탭 3] 감사 대응       →  IFRS S2 요건별 계보 추적·증빙
         ↓ lineage_log, audit_evidence, verification_status
```

---

## 2. 데이터 계보 컬럼 체계

### 2.1 전체 파일 공통 적용 (DUMMY_DATA_PLANNING 반영)

| 컬럼명 | 타입 | 설명 | 감사 활용 |
|--------|------|------|-----------|
| `source_system` | STRING | 원천 시스템 (EMS/ERP/EHS/SRM/HR/PLM/수동) | 데이터 출처 명시 |
| `synced_at` | DATETIME | ON-PREM → 플랫폼 동기화 일시 | 수집 시점 증빙 |
| `created_at` | DATETIME | 플랫폼 최초 적재 일시 | 적재 기록 |
| `updated_at` | DATETIME | 마지막 수정 일시 | 수동 조정 감지 |
| `updated_by` | STRING | 수정한 사용자 ID | 수정 주체 추적 |

### 2.2 수동 조정 감지 로직

```
if (updated_at - synced_at) > 24시간:
    → manual_adjustment_flag = true
    → 감사 대응 탭에 "수동 조정 이력 있음" 표시
    → updated_by, updated_at, 수정 전후 값 로그 보존
```

> **임계값**: 동기화 후 24시간 이내 수정은 정상(데이터 정제),  
> 24시간 초과 수정은 수동 조정으로 플래그 처리.

### 2.3 산정 결과에 추가되는 계보 컬럼

산정 완료 시 활동자료 레코드에 아래 컬럼이 추가 저장된다.

| 컬럼명 | 타입 | 설명 | 예시값 |
|--------|------|------|--------|
| `applied_factor_id` | STRING | 적용 배출계수 ID (MDG 스냅샷) | EF-LNG-2023 |
| `applied_factor_value` | FLOAT | 적용 배출계수 값 (산정 시점 고정) | 2.15900 |
| `applied_factor_version` | STRING | 배출계수 버전·기준연도 | 2023-환경부 |
| `applied_gwp_basis` | STRING | 적용 GWP 기준 | AR5 / AR6 |
| `calculation_method` | STRING | 산정 방법론 | 연료연소법 / spend-based / distance-based |
| `calculation_formula` | STRING | 산정 산식 (텍스트) | 82500 × 2.159 × 1.0 |
| `ghg_emission_tco2e` | FLOAT | 산정된 배출량 (tCO₂e) | 178.1 |
| `calculated_at` | DATETIME | 산정 실행 일시 | 2024-02-15 10:30:00 |
| `calculated_by` | STRING | 산정 실행 사용자 ID | user_001 |

> **핵심 원칙**: `applied_factor_value`는 산정 시점의 값을 **스냅샷으로 고정** 저장.  
> MDG 배출계수가 나중에 바뀌어도 당시 산정 근거가 보존된다.

---

## 3. 탭별 더미데이터 활용 상세

### 3.1 탭 1 — 산정 입력 (6개 입력 탭)

**목적**: 활동자료를 업로드·연동하고 데이터 계보 필드가 올바르게 채워졌는지 확인

| 입력 탭 | 소스 파일 | 계보 확인 포인트 |
|---------|-----------|----------------|
| 전력·열·스팀 | `EMS_ENERGY_USAGE.csv` | `source_system = EMS`, `synced_at` 존재, `data_quality` M1/M2 여부 |
| 연료·차량 | `ERP_FUEL_PURCHASE.csv` | `source_system = ERP`, `consumption_amount` vs `purchase_amount` 재고 검증 |
| 냉매 | `EHS_REFRIGERANT.csv` | `source_system = EHS`, `gwp_factor` MDG 값 일치 여부 |
| 폐기물 | `EMS_WASTE.csv` | `disposal_method` 기반 Scope 자동 분류 정확도 |
| 물류·출장·통근 | `SRM_LOGISTICS.csv`, `HR_COMMUTE_BUSINESS_TRAVEL.csv` | 파일별 `source_system` 분리 (SRM / HR) |
| 원료·제품 | `SRM_SUPPLIER_ESG.csv`, `PLM_PRODUCT_CARBON.csv` | `supplier_emission_tco2e` 출처 — 공급업체 직접 보고 vs 추정 |

**화면에서 행별 계보 표시 예시**:

```
EMS-E-2024-001 | 서울본사 | 1월 | 전력 | 125,000 kWh
  └─ 출처: EMS  |  동기화: 2024-02-05 08:55  |  품질: M1  |  수정이력: 없음 ✅

EMS-E-2024-002 | 수원공장 | 1월 | 전력 | 280,000 kWh
  └─ 출처: EMS  |  동기화: 2024-02-05 08:55  |  품질: M1  |  수정이력: 있음 ⚠️
     → 수정자: user_002  |  수정일시: 2024-02-10 14:32  |  수정전: 275,000 kWh
```

---

### 3.2 탭 2 — 산정 결과

**목적**: 배출량 계산 결과와 함께 적용 배출계수·산식을 투명하게 표시

**산정 결과 표시 구조**:

```
Scope 1  합계: 1,234 tCO₂e

활동자료          배출계수                   산식                  배출량
─────────────────────────────────────────────────────────────────────────
LNG 82,500 Nm³   2.159 tCO₂e/TJ           82,500 × 2.159 × 1.0   178.1 tCO₂e
[ERP 원본↗]      EF-LNG-2023 [환경부·AR5↗]

경유 12,500 L    2.581 tCO₂e/TJ           12,500 × 2.581 × 1.0    32.3 tCO₂e
[ERP 원본↗]      EF-경유-2023 [환경부·AR5↗]
```

- **[ERP 원본↗]**: 클릭 시 원천 레코드 드릴다운
- **[환경부·AR5↗]**: 클릭 시 MDG 배출계수 상세 표시
- 배출계수 값은 산정 시점 스냅샷(`applied_factor_value`) 기준

**산정 버전 히스토리**:

```
v3  2024-02-15 10:30  user_001  Scope1: 1,234  Scope2: 567  [현재]  ← 수원공장 수동 수정 반영
v2  2024-02-10 09:15  user_002  Scope1: 1,198  Scope2: 567
v1  2024-02-05 11:00  user_001  Scope1: 1,198  Scope2: 545  [최초 산정]
```

---

### 3.3 탭 3 — 감사 대응

**목적**: IFRS S2 요건 항목별로 충족 여부·근거 데이터·계보를 한 화면에서 제시

**감사 대응 탭 화면 구조**:

```
IFRS S2 감사 대응          전체 요건 충족률: 87%  (13/15 항목)
──────────────────────────────────────────────────────────────
요건                       상태    근거 데이터                계보
──────────────────────────────────────────────────────────────
Scope 1 배출량 공시         ✅     1,234 tCO₂e               [↗]
Scope 2 배출량 공시         ✅     567 tCO₂e (위치기반)       [↗]
Scope 2 마켓기반 공시       ✅     489 tCO₂e                 [↗]
Scope 3 중요 카테고리       ✅     Cat.1,4,6,7,9,11,12       [↗]
배출계수 출처 명시          ✅     MDG_EMISSION_FACTOR        [↗]
GWP 기준 명시              ✅     AR5 (IPCC 5차)             [↗]
데이터 수집 방법론          ✅     연료연소법·spend기반        [↗]
조직 경계 설정              ✅     운영통제 기준               [↗]
수동 조정 이력              ⚠️     3건 수동 수정 존재          [↗]
배출계수 최신 여부          ⚠️     1건 구버전 계수 적용        [↗]
Scope 3 Cat.2 자본재       ❌     미산정                      —
내부 탄소 가격              ❌     미설정                      —
```

**[↗] 계보 드릴다운 예시 — "Scope 1 배출량"**:

```
Scope 1 배출량: 1,234 tCO₂e

데이터 계보 추적
├── 고정연소: 852.4 tCO₂e
│   ├── 원천 파일: ERP_FUEL_PURCHASE.csv
│   ├── 레코드 수: 60건 (5사업장 × 12개월)
│   ├── synced_at: 2024-02-05 07:30 (ERP DB Direct)
│   ├── 수동 수정: 1건 (수원공장 1월 LNG, user_002, 2024-02-10)
│   ├── 적용 배출계수: EF-LNG-2023 (2.159 tCO₂e/TJ, 환경부, AR5)
│   └── 산식: consumption_amount × emission_factor × GWP
├── 이동연소: 298.6 tCO₂e
│   ├── 원천 파일: ERP_FUEL_PURCHASE.csv
│   ├── synced_at: 2024-02-05 07:30
│   └── 적용 배출계수: EF-경유-2023 (2.581 tCO₂e/TJ, 환경부, AR5)
├── 탈루(냉매): 61.2 tCO₂e
│   ├── 원천 파일: EHS_REFRIGERANT.csv
│   ├── synced_at: 2024-07-01 08:00 (EHS REST API)
│   └── GWP 기준: HFC-134a=1430, HFC-410A=2088 (AR5)
└── 폐기물 소각: 22.0 tCO₂e
    ├── 원천 파일: EMS_WASTE.csv (disposal_method = 소각 필터)
    └── synced_at: 2024-02-05 08:55

산정 버전: v3  |  산정일시: 2024-02-15 10:30  |  산정자: user_001
```

---

## 4. 더미데이터 계보 시나리오 설계

실제 감사 대응을 테스트할 수 있도록 더미데이터에 **의도적인 시나리오**를 포함한다.

### 4.1 정상 케이스 (전체의 약 90%)

```
synced_at:  2024-02-05 08:55
created_at: 2024-02-05 09:00
updated_at: 2024-02-05 09:00  ← synced_at과 동일 = 수동 수정 없음
updated_by: system
→ 감사 탭: ✅ 정상 적재, 수동 조정 없음
```

### 4.2 수동 조정 케이스 (3~5건 의도적 포함)

```
레코드: ERP-F-2024-013 (수원공장 1월 LNG)
synced_at:  2024-02-05 07:30
created_at: 2024-02-05 09:00
updated_at: 2024-02-10 14:32  ← 5일 후 수동 수정
updated_by: user_002
수정전값:   275,000 Nm³
수정후값:   280,000 Nm³
수정사유:   "ERP 데이터 오류 — 계량기 오독, 현장 확인 후 정정"
→ 감사 탭: ⚠️ 수동 조정 이력, 사유 및 수정자 명시
```

### 4.3 데이터 품질 혼재 케이스

```
Scope 2 전력:   data_quality = M1 (계량기 실측)     → ✅
Scope 3 통근:   data_quality = E2 (추정치)           → ⚠️ 추정 근거 명시 권장
Scope 3 Cat.1:  data_quality = E2 (spend-based)      → ⚠️ 공급업체 실측 권장
→ 감사 탭: 데이터 품질 분포 차트 + 등급별 개선 권장사항
```

### 4.4 배출계수 버전 불일치 케이스 (1~2건)

```
레코드: EMS-E-2024-001 (일부 사업장)
emission_factor_year: 2022  ← MDG 현행(2023)과 불일치
applied_factor_id:    EF-전력-2022
→ 감사 탭: ⚠️ 최신 배출계수 미적용 — 재산정 권장
```

---

## 5. 리포트 생성 탭 — 증빙 패키지 구성

| 파일명 | 내용 | 제출 대상 |
|--------|------|-----------|
| `GHG_산정결과_2024.pdf` | Scope 1/2/3 배출량·산식·배출계수 요약 | 공시 제출 |
| `GHG_데이터계보_2024.xlsx` | 전체 레코드의 source_system, synced_at, updated_by 등 | 감사인 제출 |
| `GHG_수동조정이력_2024.xlsx` | 수동 수정 레코드 목록·수정전후값·사유·수정자 | 감사인 제출 |
| `GHG_배출계수적용내역_2024.xlsx` | applied_factor_id, applied_factor_value, 기준 스냅샷 | 감사인 제출 |
| `GHG_IFRS_S2_체크리스트_2024.pdf` | 요건별 충족 여부·근거 요약 | 검증의견서 부속 |

---

## 6. 전체 흐름 요약

```
[1] ON-PREM 연동
    EMS/ERP/EHS/SRM/HR/PLM → synced_at, source_system 자동 기록

[2] 산정 입력 탭 (6개)
    활동자료 확인
    → 수동 수정 시 updated_at, updated_by, 수정전후값 로그 저장

[3] MDG 배출계수 적용
    → applied_factor_id, applied_factor_value 스냅샷 고정 저장
    → applied_gwp_basis, calculation_formula 기록

[4] 산정 결과 탭
    → tCO₂e 계산 완료
    → calculated_at, calculated_by 기록
    → 버전 히스토리 저장 (v1 → v2 → v3)

[5] 감사 대응 탭
    → IFRS S2 요건 자동 체크
    → 수동 조정 이력 플래그
    → 배출계수 버전 불일치 경고
    → 데이터 품질 분포 표시
    → 계보 드릴다운 (숫자 → 원천 레코드 추적)

[6] 리포트 생성 탭
    → 증빙 패키지 5종 다운로드
```

---

## 7. Scope별 계보 체크 기준

| Scope | 주요 원천 | 핵심 계보 체크 | 주요 감사 리스크 |
|-------|----------|---------------|----------------|
| **Scope 1** | ERP, EHS, EMS | synced_at 존재, 수동 조정 이력, 배출계수 스냅샷 | 수동 수정·계수 불일치 |
| **Scope 2** | EMS | 위치기반·마켓기반 구분, renewable_ratio 근거 | 계산 방식 미구분 |
| **Scope 3** | SRM, HR, PLM | data_quality E2 비율, spend-based 추정 근거 | 추정치 과다·공급업체 미보고 |

---

## 8. 구현 우선순위

| Phase | 항목 | 비고 |
|-------|------|------|
| **P0** | 계보 컬럼 전체 파일 적용 | DUMMY_DATA_PLANNING 반영 완료 |
| **P0** | 산정 입력 탭 — 행별 계보 표시 | source_system, synced_at, 수정이력 뱃지 |
| **P0** | 산정 결과 탭 — 배출계수 스냅샷 저장 | applied_factor_id, applied_factor_value |
| **P1** | 감사 대응 탭 — IFRS S2 요건 자동 체크 | 드릴다운 포함 |
| **P1** | 수동 조정 감지 로직 | synced_at vs updated_at 비교 플래그 |
| **P1** | 산정 버전 히스토리 | v1/v2/v3 저장·비교 뷰 |
| **P2** | 리포트 증빙 패키지 5종 | PDF·Excel 다운로드 |
| **P2** | 배출계수 버전 불일치 자동 경고 | MDG 현행 vs applied_factor_year 비교 |

---

## 참조

- `DUMMY_DATA_PLANNING.md` §6-1 — 공통 감사 추적 컬럼 정의
- `GHG_TAB_DESIGN.md` — 6개 입력 탭 구조 및 소스 파일 매핑
- `JOURNEYMAP_GHG_v2.md` — GHG 산정 전체 사용자 흐름
- `MDG_EMISSION_FACTOR.csv` — 배출계수 기준 원본 (스냅샷 소스)