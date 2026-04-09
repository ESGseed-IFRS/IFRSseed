# GHG 배출계수 확장 및 산정 엔진 구현 가이드

## 📋 개요

Excel 배출계수 마스터(`GHG_배출계수_마스터_v2.xlsx`)의 구조를 반영하여 DB 스키마를 확장하고, 열량계수·GHG 가스별 배출계수·GWP를 지원하는 정확한 산정 엔진을 구현했습니다.

**구현 기간**: 2026-04-09  
**버전**: v2.0

---

## 🎯 주요 구현 사항

### 1. DB 스키마 확장 (`emission_factors` 테이블)

**Migration**: `backend/alembic/versions/042_extend_emission_factors.py`

**추가된 컬럼**:
```sql
-- 열량 변환
heat_content_coefficient  DECIMAL(18,8)  -- 예: 0.0388 TJ/천Nm³
heat_content_unit         TEXT
net_calorific_value       DECIMAL(18,4)  -- 순발열량 MJ/kg
ncv_unit                  TEXT

-- GHG 가스별 배출계수
co2_factor                DECIMAL(18,6)  -- tCO₂/TJ
ch4_factor                DECIMAL(18,6)  -- tCH₄/TJ
n2o_factor                DECIMAL(18,6)  -- tN₂O/TJ

-- 복합 배출계수
composite_factor          DECIMAL(18,6)  -- tCO₂eq/TJ
composite_factor_unit     TEXT

-- GWP
gwp_basis                 TEXT           -- AR5 | AR6
ch4_gwp                   DECIMAL(10,2)  -- 28 (AR5)
n2o_gwp                   DECIMAL(10,2)  -- 265 (AR5)

-- 기타
source_unit               TEXT           -- 사용자 입력 단위
fuel_type                 TEXT
version                   TEXT
notes                     TEXT
```

### 2. Excel 파싱 스크립트

**파일**: `backend/scripts/parse_emission_factors_excel.py`

**지원 시트**:
- **Sheet 1** (Scope1_고정연소): LNG, LPG, 경유, 휘발유, 등유, 중유 등 15개 연료
- **Sheet 3** (Scope1_공정·냉매): HFC/PFC 냉매 12종
- **Sheet 4** (Scope2_전력·스팀): 전력, 지역난방 3개

**사용법**:
```bash
python backend/scripts/parse_emission_factors_excel.py "c:\path\to\GHG_배출계수_마스터_v2.xlsx"
```

**출력**: `emission_factors_parsed.json` (총 30개 배출계수)

### 3. DB 임포트 서비스

**파일**: `backend/scripts/import_emission_factors.py`

**기능**:
- JSON에서 배출계수 읽기
- 중복 시 UPDATE (factor_code 기준)
- 신규 시 INSERT

**사용법**:
```bash
python backend/scripts/import_emission_factors.py emission_factors_parsed.json
```

### 4. 계산 엔진 (GhgCalculationEngine)

**파일**: `backend/domain/v1/ghg_calculation/hub/services/ghg_calculation_engine.py`

**핵심 메서드**:

#### 4.1 TJ 변환 (`convert_to_tj`)
```python
tj, formula = engine.convert_to_tj(
    usage_amount=1000,           # 사용량
    source_unit="천Nm³",          # 입력 단위
    heat_content_coefficient=0.0388,  # 열량계수 TJ/천Nm³
)
# → (38.8 TJ, "1000 천Nm³ × 0.0388 TJ/천Nm³ = 38.8 TJ")
```

**지원 단위**:
- 에너지: kWh, MWh, GJ, MJ, TJ, Gcal
- 가스: Nm³, 천Nm³, m³
- 액체: L, 천L, kL
- 고체: kg, t, ton, 천톤

#### 4.2 배출량 계산 (`calculate_emissions`)
```python
emissions = engine.calculate_emissions(
    activity_tj=38.8,
    co2_factor=56.1,      # tCO₂/TJ
    ch4_factor=0.001,     # tCH₄/TJ
    n2o_factor=0.0001,    # tN₂O/TJ
    ch4_gwp=28,
    n2o_gwp=265,
)
# → {
#   'total_emission': 2178.7946,  # tCO₂eq
#   'co2_emission': 2176.68,
#   'ch4_co2eq': 1.0864,
#   'n2o_co2eq': 1.0282,
#   'formula': "38.8 TJ × [...] = 2178.7946 tCO₂eq"
# }
```

#### 4.3 전력 배출량 (간편)
```python
emissions = engine.calculate_electricity_emissions(
    usage_kwh=50000,
    electricity_ef_kg_per_kwh=0.4157,
)
# → {'total_emission': 20.785 tCO₂eq}
```

#### 4.4 냉매 배출량
```python
emissions = engine.calculate_refrigerant_emissions(
    refrigerant_leak_kg=10,
    gwp=1300,  # HFC-134a
)
# → {'total_emission': 13.0 tCO₂eq}
```

### 5. 배출계수 서비스 V2 (EmissionFactorServiceV2)

**파일**: `backend/domain/v1/ghg_calculation/hub/services/emission_factor_service_v2.py`

**핵심 메서드**:

#### 5.1 상세 조회
```python
ef = service.resolve_detailed(
    fuel_type='천연가스_lng',
    source_unit='천Nm³',
    year=2024,
    applicable_scope='Scope1',
)
# → EmissionFactorDetail(
#   heat_content_coefficient=0.0388,
#   co2_factor=56.1,
#   ch4_factor=0.001,
#   composite_factor=56.1552,
#   ...
# )
```

#### 5.2 전체 목록
```python
factors = service.list_all_factors(
    year=2024,
    scope='Scope1',
    active_only=True,
)
```

### 6. 산정 Orchestrator V2

**파일**: `backend/domain/v1/ghg_calculation/hub/orchestrator/scope_calculation_orchestrator_v2.py`

**개선사항**:
1. ✅ 열량계수를 사용한 TJ 변환
2. ✅ GHG 가스별(CO₂, CH₄, N₂O) 배출량 분리 계산
3. ✅ 단위 자동 변환 (kWh, 천Nm³, L 등)
4. ✅ Scope 2 전력 직접 계산 (kgCO₂eq/kWh)
5. ✅ 배출계수 버전 관리 (v2.0)

**사용법**:
```python
orchestrator = ScopeCalculationOrchestratorV2()
result = orchestrator.recalculate(
    company_id=company_uuid,
    year="2024",
    basis="location",
)
```

---

## 📝 구현 완료 체크리스트

- [x] **EF-1**: 배출계수 DB 스키마 확장 설계 및 Migration 작성
- [x] **EF-2**: Excel 배출계수 파싱 및 분석 스크립트 작성
- [x] **EF-3**: 배출계수 임포트 서비스 구현 (Scope 1 고정연소)
- [x] **EF-4**: TJ 변환 로직 구현 (convert_to_tj)
- [x] **EF-5**: 배출량 계산 로직 구현 (calculate_emissions)
- [x] **EF-6**: EmissionFactorService 확장 및 리팩토링
- [x] **EF-7**: Scope 2 전력 배출계수 임포트
- [x] **EF-8**: 냉매(HFC/PFC) 배출계수 임포트
- [x] **EF-9**: scope_calculation_orchestrator 산정 로직 개선
- [x] **EF-10**: 통합 테스트 및 검증 (이 문서)

---

## 🚀 통합 테스트 절차

### Step 1: DB Migration 실행

```bash
cd backend
alembic upgrade head
```

**확인사항**:
- `emission_factors` 테이블에 새로운 컬럼 추가 확인
- 기존 `emission_factor` 값이 `composite_factor`로 복사되었는지 확인

### Step 2: Excel 파싱

```bash
python backend/scripts/parse_emission_factors_excel.py "c:\Users\여태호\Downloads\GHG_배출계수_마스터_v2 (1).xlsx"
```

**예상 출력**:
```
[1] Scope 1 고정연소 파싱...
  파싱 완료: 15개 연료
  - 천연가스 (LNG): 56.1552 tCO₂eq/TJ
  - 액화석유가스 (LPG): 63.1552 tCO₂eq/TJ
  - 도시가스 (PNG): 56.1552 tCO₂eq/TJ

[2] Scope 2 전력 파싱...
  파싱 완료: 3개 항목

[3] 냉매 파싱...
  파싱 완료: 12개 냉매

총 파싱된 배출계수: 30개
```

### Step 3: DB 임포트

```bash
python backend/scripts/import_emission_factors.py emission_factors_parsed.json
```

**예상 출력**:
```
  - 신규 생성: 30개
  - 업데이트: 0개
  - 건너뜀: 0개
  - 총계: 30개
```

### Step 4: 계산 엔진 테스트

```bash
python backend/domain/v1/ghg_calculation/hub/services/ghg_calculation_engine.py
```

**예상 출력**:
```
[예제 1] LNG 1,000 천Nm³ 사용
  활동자료: 1000 천Nm³ × 0.0388 TJ/천Nm³ = 38.8 TJ
  배출량: 38.8 TJ × [...] = 2178.7946 tCO₂eq
  총 배출량: 2178.7946 tCO₂eq
    - CO₂: 2176.68 tCO₂
    - CH₄: 1.0864 tCO₂eq
    - N₂O: 1.0282 tCO₂eq

[예제 2] 전력 50,000 kWh 사용
  배출량: 50000 kWh × 0.4157 kgCO₂eq/kWh = 20.785 tCO₂eq

[예제 3] HFC-134a 냉매 10 kg 누출
  배출량: 10 kg / 1000 × GWP 1300 = 13.0 tCO₂eq
```

### Step 5: 배출계수 서비스 테스트

**Python 인터랙티브 세션**:
```python
from backend.domain.v1.ghg_calculation.hub.services.emission_factor_service_v2 import EmissionFactorServiceV2

service = EmissionFactorServiceV2()

# 천연가스 배출계수 조회
ef = service.resolve_detailed(
    fuel_type='천연가스_lng',
    source_unit='천Nm³',
    year=2024,
)

print(f"Factor Code: {ef.factor_code}")
print(f"한국명: {ef.factor_name_ko}")
print(f"열량계수: {ef.heat_content_coefficient} {ef.heat_content_unit}")
print(f"CO₂: {ef.co2_factor} tCO₂/TJ")
print(f"CH₄: {ef.ch4_factor} tCH₄/TJ")
print(f"N₂O: {ef.n2o_factor} tN₂O/TJ")
print(f"복합: {ef.composite_factor} tCO₂eq/TJ")
```

### Step 6: 통합 산정 테스트 (API)

**API 호출**:
```bash
POST /api/v1/ghg/calculation/scope/recalculate
Content-Type: application/json

{
  "company_id": "uuid-here",
  "year": "2024",
  "basis": "location"
}
```

**예상 응답**:
```json
{
  "company_id": "uuid-here",
  "year": "2024",
  "scope1_total": 2178.7946,
  "scope2_total": 20.785,
  "grand_total": 2199.5796,
  "emission_factor_version": "v2.0",
  "scope1_categories": [
    {
      "id": "s1-fixed",
      "category": "고정연소",
      "items": [
        {
          "name": "LNG (공장A)",
          "ef": "56.1552",
          "ef_source": "환경부 고시 2024",
          "total": 2178.7946
        }
      ]
    }
  ]
}
```

---

## 🎓 계산 공식 설명

### ISO 14064-1 / GHG Protocol 기준

#### 1. Scope 1 고정연소 (연료 연소)

**단계 1**: 활동자료를 TJ로 변환
```
활동자료(TJ) = 연료사용량(단위) × 열량계수(TJ/단위)
```

**예시**:
```
1,000 천Nm³ × 0.0388 TJ/천Nm³ = 38.8 TJ
```

**단계 2**: TJ에서 배출량 계산
```
tCO₂eq = TJ × (CO₂계수 + CH₄계수×GWP_CH₄ + N₂O계수×GWP_N₂O)
```

**예시** (AR5 기준: CH₄=28, N₂O=265):
```
38.8 TJ × (56.1 + 0.001×28 + 0.0001×265) = 2178.79 tCO₂eq
```

#### 2. Scope 2 전력

**단순 곱셈**:
```
배출량(tCO₂eq) = 전력사용량(kWh) × 배출계수(kgCO₂eq/kWh) ÷ 1000
```

**예시** (2024년 한국 전력):
```
50,000 kWh × 0.4157 kgCO₂eq/kWh ÷ 1000 = 20.785 tCO₂eq
```

#### 3. 냉매 탈루 (Scope 1)

```
배출량(tCO₂eq) = 냉매 누출량(kg) ÷ 1000 × GWP
```

**예시** (HFC-134a, GWP=1300):
```
10 kg ÷ 1000 × 1300 = 13.0 tCO₂eq
```

---

## 📚 참고 자료

1. **환경부 고시**: 온실가스 배출계수 및 지구온난화지수 (2024)
2. **IPCC AR5**: Fifth Assessment Report (2014) - GWP 기준
3. **ISO 14064-1**: 온실가스 조직 수준 정량화 및 보고 지침
4. **GHG Protocol**: Corporate Accounting and Reporting Standard

---

## ⚠️ 주의사항

1. **단위 일관성**: 입력 단위와 배출계수 단위가 일치해야 합니다.
   - 예: 사용량이 "Nm³"인데 배출계수가 "천Nm³" 기준이면 1000으로 나눠야 함
   
2. **GWP 버전**: 한국 온실가스 인벤토리는 AR5 기준을 사용합니다.
   - CH₄: 28 (AR5), 29.8 (AR6)
   - N₂O: 265 (AR5), 273 (AR6)

3. **Scope 2 방법론**:
   - **위치기반(Location-based)**: 전력망 평균 배출계수 사용
   - **시장기반(Market-based)**: 전력 구매 계약(REC, PPA) 기반

4. **재산정 조건** (ISO 14064-1):
   - 배출계수 업데이트 시
   - 조직 경계 변경 시
   - 계산 방법 개선 시

---

## 📞 문의

- 구현 담당: AI Assistant
- 구현일: 2026-04-09
- 버전: v2.0
