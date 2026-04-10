# GHG 이상치 검증 규칙 완벽 가이드 (14가지)

## 📋 목차

1. [시계열 이상치 (6가지)](#1-시계열-이상치-timeseries-anomaly)
2. [데이터 품질 (4가지)](#2-데이터-품질-검증-data-quality)
3. [배출계수 이탈 (1가지)](#3-배출계수-이탈-emission-factor-deviation)
4. [원단위 이상 (3가지)](#4-원단위-이상-intensity-anomaly)
5. [경계·일관성 (3가지)](#5-경계일관성-검증-boundary-consistency)

---

## 🎯 **전체 요약**

| 카테고리 | 규칙 수 | 구현 상태 | 커버리지 |
|---------|---------|----------|----------|
| **시계열 이상치** | 6개 | ✅ 완료 | 100% |
| **데이터 품질** | 4개 | ✅ 완료 | 100% |
| **배출계수 이탈** | 1개 | ✅ 완료 | 100% |
| **원단위 이상** | 3개 | ✅ 완료 | 100% |
| **경계·일관성** | 3개 | ✅ 완료 (DB 의존) | 100% |
| **합계** | **17개** | ✅ 완료 | **100%** |

---

## 1. 시계열 이상치 (Timeseries Anomaly)

### 1-1. 전월 대비 급증 (MOM_RATIO) ⚡

**룰 코드**: `MOM_RATIO`  
**기준**: 전월 대비 **2.0배 이상** 증가  
**심각도**: `high`  
**Phase**: `timeseries`

#### 📊 예시
```text
💡 실생활 예시: 회사 전력 사용량
- 2024년 1월: 10,000 kWh
- 2024년 2월: 25,000 kWh  ← ⚠️ 이상! (2.5배)

🤔 왜 이상한가?
→ 갑자기 2배 이상 오르면:
  ✓ 데이터 입력 오류 (단위 실수: kWh → MWh)
  ✓ 설비 고장 또는 측정기 오작동
  ✓ 실제 큰 이벤트 발생 (공장 신설, 설비 증설)
  ✓ 겨울철 난방 급증 (정상일 수도 있음)
```

#### 🔍 검증 로직
```python
if current_value > prior_month * 2.0:
    finding = "MOM_RATIO"
```

#### 📦 Context 정보
```json
{
  "current": 25000,
  "prior_month": 10000,
  "ratio": 2.5,
  "category": "energy",
  "facility": "본사",
  "metric": "전력"
}
```

---

### 1-2. 전년 동기 대비 변동 (YOY_PCT) 📆

**룰 코드**: `YOY_PCT`  
**기준**: 작년 같은 달 대비 **±30%** 초과 변동  
**심각도**: `high`  
**Phase**: `timeseries`

#### 📊 예시
```text
💡 실생활 예시: 폐기물 발생량
- 2023년 3월: 100톤
- 2024년 3월: 150톤  ← ⚠️ 이상! (+50% 증가)

🤔 왜 이상한가?
→ 계절 패턴이 있는 데이터는 작년과 비슷해야 정상
  ✓ 같은 3월인데 갑자기 50% 증가는 의심스러움
  ✓ 생산량 변화 없이 폐기물만 급증?
  ✓ 단위 오류 또는 측정 오류 가능성
  ✓ 폐기물 분류 기준 변경 (재활용 → 일반 폐기물)
```

#### 🔍 검증 로직
```python
change_pct = abs((current - prior_year_same_month) / prior_year_same_month * 100)
if change_pct > 30.0:
    finding = "YOY_PCT"
```

#### 📦 Context 정보
```json
{
  "current": 150,
  "prior_year_same_month": 100,
  "change_pct": 50.0,
  "year_month": 202403
}
```

---

### 1-3. 12개월 평균 대비 급증 (MA12_RATIO) 📈

**룰 코드**: `MA12_RATIO`  
**기준**: 최근 12개월 평균 대비 **2.5배 이상**  
**심각도**: `medium`  
**Phase**: `timeseries`

#### 📊 예시
```text
💡 실생활 예시: LNG 사용량
- 최근 12개월 평균: 1,000 Nm³
- 현재 월: 3,000 Nm³  ← ⚠️ 이상! (3배)

🤔 왜 이상한가?
→ 평소 패턴과 너무 다르면 의심
  ✓ 겨울에 난방 사용량이 늘어도 보통 2배 이내
  ✓ 3배 이상이면 설비 문제 또는 데이터 오류
  ✓ 보일러 효율 저하 또는 단열 문제
```

#### 🔍 검증 로직
```python
ma12 = mean(last_12_months)
if current > ma12 * 2.5:
    finding = "MA12_RATIO"
```

#### 📦 Context 정보
```json
{
  "current": 3000,
  "ma12": 1000,
  "ratio": 3.0
}
```

---

### 1-4. 통계적 이상치 (ZSCORE_12M) 🎲

**룰 코드**: `ZSCORE_12M`  
**기준**: 표준편차 **3σ (시그마)** 초과  
**심각도**: `medium`  
**Phase**: `timeseries`

#### 📊 예시
```text
💡 실생활 예시: 수질 오염물질 측정값
- 최근 12개월 평균(μ): 10 mg/L
- 표준편차(σ): 2 mg/L
- 현재 측정값: 25 mg/L

계산:
Z = (25 - 10) / 2 = 7.5  ← ⚠️ 이상! (3σ 초과)

🤔 통계학적 의미
→ 정규분포에서 3σ 벗어날 확률 = 0.3%
  ✓ 99.7%는 3σ 안에 들어옴
  ✓ 벗어나면 "진짜 이상" 또는 "측정 오류"
  ✓ 배출 시설 문제 또는 처리 공정 이상
```

#### 🔍 검증 로직
```python
mu = mean(last_12_months)
sigma = stdev(last_12_months)
z = abs((current - mu) / sigma)
if z > 3.0:
    finding = "ZSCORE_12M"
```

#### 📦 Context 정보 ✅ (개선됨)
```json
{
  "current": 25,
  "mean": 10,           // ✅ 추가됨
  "std_dev": 2,         // ✅ 추가됨
  "zscore": 7.5,
  "window_n": 12
}
```

---

### 1-5. IQR 1.5배 이상치 (IQR_OUTLIER) 📦

**룰 코드**: `IQR_OUTLIER`  
**기준**: 사분위수 범위의 **1.5배** 벗어남 (박스플롯 이상치)  
**심각도**: `medium`  
**Phase**: `timeseries`

#### 📊 예시
```text
💡 실생활 예시: 월별 전력 사용량 (최근 12개월)
데이터: [100, 105, 110, 108, 112, 115, 120, 118, 125, 130, 500, 128]
                                                    ↑
                                                  이상치!

계산:
1. 정렬: [100, 105, 108, 110, 112, 115, 118, 120, 125, 128, 130, 500]
2. Q1 (25%): 110  (3번째 위치)
3. Q3 (75%): 128  (9번째 위치)
4. IQR = Q3 - Q1 = 128 - 110 = 18
5. 상한: Q3 + 1.5×IQR = 128 + 27 = 155
6. 하한: Q1 - 1.5×IQR = 110 - 27 = 83

→ 500 kWh는 155를 크게 초과 ⚠️ 이상!

🤔 왜 IQR을 쓰나?
→ 평균/표준편차는 이상치에 민감 (500이 평균을 높임)
→ IQR은 중간값 기반이라 robust (이상치 영향 적음)
→ 비정규분포(치우친 데이터)에도 효과적
```

#### 🔍 검증 로직
```python
q1 = percentile(hist, 25)
q3 = percentile(hist, 75)
iqr = q3 - q1
lower_bound = q1 - 1.5 * iqr
upper_bound = q3 + 1.5 * iqr

if current < lower_bound or current > upper_bound:
    finding = "IQR_OUTLIER"
```

#### 📦 Context 정보 ✅ (개선됨)
```json
{
  "current": 500,
  "q1": 110,
  "q3": 128,
  "iqr": 18,
  "lower_bound": 83,
  "upper_bound": 155,
  "extreme_lower_bound": 56,  // ✅ 추가됨
  "extreme_upper_bound": 182, // ✅ 추가됨
  "is_extreme": false
}
```

---

### 1-6. IQR 3배 극단값 (IQR_EXTREME) ⚠️⚠️

**룰 코드**: `IQR_EXTREME`  
**기준**: IQR의 **3.0배** 벗어남 (심각한 이상치)  
**심각도**: `high`  
**Phase**: `timeseries`

#### 📊 예시
```text
위 예시에서:
- 극단 상한: Q3 + 3×IQR = 128 + 54 = 182
- 500 kWh는 182도 초과 ⚠️⚠️ 극단값!

→ 1.5배보다 훨씬 심각한 이상
→ high 심각도로 즉시 확인 필요
→ 단위 오류(MWh → kWh) 또는 계측기 고장 확실

🤔 1.5배 vs 3.0배 차이
  ✓ 1.5배: 경계선상 이상치 (확인 필요)
  ✓ 3.0배: 극단 이상치 (즉시 조치 필요)
```

#### 🔍 검증 로직
```python
extreme_lower = q1 - 3.0 * iqr
extreme_upper = q3 + 3.0 * iqr

if current < extreme_lower or current > extreme_upper:
    finding = "IQR_EXTREME"
```

---

## 2. 데이터 품질 검증 (Data Quality)

### 2-1. 필수 항목 0값 (REQUIRED_FIELD_ZERO) 🕳️

**룰 코드**: `REQUIRED_FIELD_ZERO`  
**기준**: 에너지 유형은 명시되었으나 사용량이 **0**  
**심각도**: `high`  
**Phase**: `sync`

#### 📊 예시
```text
💡 실생활 예시:
CSV 데이터:
| 시설 | 에너지유형 | 사용량 | 단위 |
|------|-----------|--------|------|
| 본사 | 전력      | 0      | kWh  |  ← ⚠️ 이상!

🤔 왜 이상한가?
→ 전력을 사용했다고 명시했는데 사용량이 0?
  ✓ 데이터 누락 (CSV 빈 칸)
  ✓ 시스템 연동 오류
  ✓ 엑셀 수식 오류
  ✓ NULL 값이 0으로 변환됨
```

#### 🔍 검증 로직
```python
if energy_type and usage_amount == 0:
    finding = "REQUIRED_FIELD_ZERO"
```

#### 📦 Context 정보
```json
{
  "category": "energy",
  "facility": "본사",
  "energy_type": "전력",
  "source_file": "EMS_ENERGY_USAGE.csv",
  "row_index": 15
}
```

---

### 2-2. 음수값 불가 (NEGATIVE_VALUE) ➖

**룰 코드**: `NEGATIVE_VALUE`  
**기준**: 물리적으로 음수 불가능한 항목 (사용량, 발생량, 측정값)  
**심각도**: `critical`  
**Phase**: `sync`

#### 📊 예시
```text
💡 실생활 예시:
- 폐기물 발생량: -50톤  ← ⚠️ 불가능!
- 전력 사용량: -1000 kWh  ← ⚠️ 불가능!
- 오염물질 측정값: -5 mg/L  ← ⚠️ 불가능!

🤔 물리적으로 불가능
→ 사용량, 발생량, 측정값은 음수일 수 없음
  ✓ 데이터 입력 오류
  ✓ 계산 오류 (차감 로직 잘못)
  ✓ 엑셀 수식 오류 (매입-매출 계산 실수)
  ✓ 시스템 마이그레이션 오류
```

#### 🔍 검증 로직
```python
if usage_amount < 0 or generation_ton < 0 or measured_value < 0:
    finding = "NEGATIVE_VALUE"
```

#### 📦 Context 정보
```json
{
  "category": "waste",
  "field": "generation_ton",
  "value": -50,
  "source_file": "EMS_WASTE.csv",
  "row_index": 42
}
```

---

### 2-3. 중복 데이터 (DUPLICATE_ENTRY) 🔄

**룰 코드**: `DUPLICATE_ENTRY`  
**기준**: 동일 (시설, 연도, 월, 유형) 조합이 **2건 이상**  
**심각도**: `high`  
**Phase**: `sync`

#### 📊 예시
```text
💡 실생활 예시: 같은 시설, 같은 월, 같은 유형이 2건 이상

CSV:
| 시설 | 연도 | 월 | 유형 | 사용량 |
|------|------|----|----|--------|
| 본사 | 2024 | 1  | 전력 | 5,000  |
| 본사 | 2024 | 1  | 전력 | 3,000  |  ← ⚠️ 중복!

🤔 어느 값이 맞나?
→ 어떻게 처리해야 하나?
  ✓ 합치기? (8,000 kWh)
  ✓ 나중 것만 사용? (3,000 kWh)
  ✓ 먼저 것만 사용? (5,000 kWh)
  ✓ 평균? (4,000 kWh)
  → 반드시 사람이 확인 필요!
```

#### 🔍 검증 로직
```python
composite_key = (facility, year, month, energy_type)
if count(composite_key) > 1:
    finding = "DUPLICATE_ENTRY"
```

#### 📦 Context 정보
```json
{
  "category": "energy",
  "facility": "본사",
  "year": "2024",
  "month": "1",
  "type": "전력",
  "duplicate_rows": [15, 42],
  "source_file": "EMS_ENERGY_USAGE.csv"
}
```

---

### 2-4. 단위 불일치 의심 (UNIT_MISMATCH_SUSPECTED) ⚖️

**룰 코드**: `UNIT_MISMATCH_SUSPECTED`  
**기준**: 같은 그룹 내 값이 **900배 이상** 차이  
**심각도**: `critical`  
**Phase**: `sync`

#### 📊 예시
```text
💡 실생활 예시: 같은 "전력" 그룹 내 데이터

CSV:
| 시설  | 사용량  | 단위 |
|-------|---------|------|
| 공장A | 50,000  | kWh  |
| 공장B | 50      | kWh  |  ← ⚠️ 1000배 차이!

계산:
50,000 / 50 = 1,000배

🤔 의심 포인트
→ 공장B는 실제로는 MWh였는데 kWh로 입력?
  ✓ 50 MWh = 50,000 kWh
  ✓ 단위 혼용 가능성 매우 높음
  ✓ 엑셀 셀 서식 문제
  ✓ 데이터 소스별 단위 불일치
  
→ 900배 기준 (1000배에서 10% 여유)
  ✓ kWh ↔ MWh: 정확히 1000배
  ✓ Nm³ ↔ 천Nm³: 정확히 1000배
  ✓ L ↔ kL: 정확히 1000배
```

#### 🔍 검증 로직
```python
group = group_by(facility, energy_type)
ratio = max(group) / min(group)
if ratio > 900:
    finding = "UNIT_MISMATCH_SUSPECTED"
```

#### 📦 Context 정보
```json
{
  "category": "energy",
  "facility": "공장B",
  "energy_type": "전력",
  "min_value": 50,
  "max_value": 50000,
  "ratio": 1000,
  "values": [[1, 50000, 10], [2, 45000, 11], [3, 50, 12]],
  "note": "kWh와 MWh 혼용 또는 소수점 오류 가능성"
}
```

---

## 3. 배출계수 이탈 (Emission Factor Deviation)

### 3-1. 배출계수 ±15% 이탈 (EMISSION_FACTOR_DEVIATION) 📏

**룰 코드**: `EMISSION_FACTOR_DEVIATION`  
**기준**: 국가 고유 배출계수 대비 **±15%** 초과 (30% 이상이면 critical)  
**심각도**: `high` (30% 이상: `critical`)  
**Phase**: `sync`

#### 📊 예시
```text
💡 실생활 예시: LNG 배출계수
- 국가 고시 배출계수: 56.1 tCO₂/TJ (환경부 기준)
- 사용자 입력 배출계수: 70 tCO₂/TJ

계산:
이탈율 = |(70 - 56.1) / 56.1| × 100 = 24.8%  ← ⚠️ 이상!

🤔 왜 문제인가?
→ ISO 14064-1은 국가 고유 배출계수 사용 권장
  ✓ 24.8% 이탈은 과대 산정 가능
  ✓ 검증 심사 시 지적 대상
  ✓ 30% 이상이면 critical (재산정 필요)
  ✓ 자체 성적서 사용 시 근거 필요

실제 사례:
  - LNG: 56.1 vs 70 (24.8%) → high
  - 전력: 0.4157 vs 0.5 (20.3%) → high
  - 경유: 2.64 vs 3.5 (32.6%) → critical!
```

#### 🔍 검증 로직
```python
standard_factor = get_national_factor(fuel_type, year)
deviation_pct = abs((input_factor - standard_factor) / standard_factor * 100)
if deviation_pct > 15:
    severity = "critical" if deviation_pct > 30 else "high"
    finding = "EMISSION_FACTOR_DEVIATION"
```

#### 📦 Context 정보
```json
{
  "energy_type": "천연가스_lng",
  "unit": "Nm³",
  "input_factor": 70.0,
  "standard_factor": 56.1,
  "deviation_pct": 24.8,
  "source": "환경부 고시 제2024-123호",
  "year": "2024",
  "note": "환경부 고시 또는 IPCC 기준과 비교"
}
```

---

## 4. 원단위 이상 (Intensity Anomaly)

### 4-1. 면적당 배출량 초과 (INTENSITY_AREA_HIGH) 🏢

**룰 코드**: `INTENSITY_AREA_HIGH`  
**기준**: 업종별 벤치마크 × **1.5배** 초과  
**심각도**: `medium`  
**Phase**: `batch`

#### 📊 예시
```text
💡 실생활 예시: IT 제조업 (벤치마크: 0.05 tCO₂/m²)
- 연면적: 50,000 m²
- 총 배출량: 5,000 tCO₂
- 원단위: 5,000 / 50,000 = 0.1 tCO₂/m²

임계값: 0.05 × 1.5 = 0.075 tCO₂/m²
→ 0.1 > 0.075  ← ⚠️ 벤치마크 1.5배 초과!

🤔 의미
→ 같은 업종 대비 에너지 효율 낮음
  ✓ 노후 설비 (에너지 효율 저하)
  ✓ 에너지 관리 부실
  ✓ 냉난방 시스템 비효율
  ✓ 데이터 오류 가능성도 있음

업종별 벤치마크 예시:
  - IT 제조: 0.05 tCO₂/m²
  - 화학: 0.15 tCO₂/m²
  - 사무실: 0.02 tCO₂/m²
  - 병원: 0.08 tCO₂/m²
```

#### 🔍 검증 로직
```python
intensity = total_emissions / floor_area_sqm
threshold = benchmark * 1.5
if intensity > threshold:
    finding = "INTENSITY_AREA_HIGH"
```

#### 📦 Context 정보
```json
{
  "intensity_per_sqm": 0.1,
  "benchmark_per_sqm": 0.05,
  "threshold": 0.075,
  "ratio": 2.0,
  "floor_area_sqm": 50000,
  "total_emissions_tco2e": 5000,
  "year": "2024"
}
```

---

### 4-2. 인원당 배출량 초과 (INTENSITY_EMPLOYEE_HIGH) 👥

**룰 코드**: `INTENSITY_EMPLOYEE_HIGH`  
**기준**: 업종별 벤치마크 × **1.5배** 초과  
**심각도**: `medium`  
**Phase**: `batch`

#### 📊 예시
```text
💡 실생활 예시: 사무실 (벤치마크: 5.0 tCO₂/인)
- 임직원 수: 1,200명
- 총 배출량: 10,000 tCO₂
- 원단위: 10,000 / 1,200 = 8.33 tCO₂/인

임계값: 5.0 × 1.5 = 7.5 tCO₂/인
→ 8.33 > 7.5  ← ⚠️ 초과!

🤔 왜 높을까?
→ 인당 에너지 사용량이 평균보다 많음
  ✓ 재택근무율 낮음 (전원 출근)
  ✓ 서버실, 데이터센터 운영
  ✓ 24시간 운영 시설
  ✓ 냉난방 설정 온도 문제

업종별 벤치마크 예시:
  - 사무직: 5.0 tCO₂/인
  - 제조업: 8.0 tCO₂/인
  - 병원: 12.0 tCO₂/인
  - 소매업: 3.0 tCO₂/인
```

#### 🔍 검증 로직
```python
intensity = total_emissions / employee_count
threshold = benchmark * 1.5
if intensity > threshold:
    finding = "INTENSITY_EMPLOYEE_HIGH"
```

---

### 4-3. 생산량당 집약도 변동 (INTENSITY_PRODUCTION_CHANGE) 🏭

**룰 코드**: `INTENSITY_PRODUCTION_CHANGE`  
**기준**: 전년 대비 **±25%** 초과 변동  
**심각도**: `high`  
**Phase**: `batch`

#### 📊 예시
```text
💡 실생활 예시: 자동차 공장
- 2023년: 총 배출량 10,000 tCO₂, 생산량 10,000대
  → 원단위: 1.0 tCO₂/대
  
- 2024년: 총 배출량 8,000 tCO₂, 생산량 5,000대
  → 원단위: 1.6 tCO₂/대

변동률: |(1.6 - 1.0) / 1.0| × 100 = 60%  ← ⚠️ 25% 초과!

🤔 왜 이상한가?
→ 생산량이 줄어도 원단위는 비슷해야 정상
  ✓ 원단위 60% 상승 = 효율 악화
  ✓ 생산 감소했는데 에너지는 고정비 때문에 비율 증가
  ✓ 설비 가동률 저하 (효율 최적점 벗어남)
  ✓ 근본 원인 분석 필요

근본 원인 예시:
  - 공장 가동률 50% → 단위당 고정비↑
  - 노후 설비 교체 지연
  - 생산 라인 변경 (신규 제품)
```

#### 🔍 검증 로직
```python
current_intensity = current_emissions / production_volume
prev_intensity = prev_emissions / production_volume
change_pct = abs((current - prev) / prev * 100)
if change_pct > 25:
    finding = "INTENSITY_PRODUCTION_CHANGE"
```

#### 📦 Context 정보
```json
{
  "current_intensity": 1.6,
  "prev_intensity": 1.0,
  "change_pct": 60.0,
  "production_volume": 5000,
  "production_unit": "대",
  "current_year": "2024",
  "prev_year": "2023",
  "note": "공정 변경, 원료 전환, 설비 효율 저하 등 확인 필요"
}
```

---

## 5. 경계·일관성 검증 (Boundary Consistency)

### 5-1. 조직 경계 변경 후 재산정 미수행 (BOUNDARY_CHANGE_NO_RECALC) 🏢

**룰 코드**: `BOUNDARY_CHANGE_NO_RECALC`  
**기준**: 5,000 tCO₂ 이상 OR 5% 이상 변동 시 기준연도 재산정 필요  
**심각도**: `critical`  
**Phase**: `batch`

#### 📊 예시
```text
💡 실생활 예시:
- 2023년 6월: 자회사 A 편입 (추가 배출량 6,000 tCO₂)
- 기준연도(2020년): 재산정 안 함  ← ⚠️ 문제!

🤔 왜 재산정해야 하나?
→ ISO 14064-1 & GHG Protocol 규정:
  ✓ 조직 경계 변경 시 기준연도부터 재산정
  ✓ 5,000 tCO₂ 이상 OR 5% 이상 변동 시 필수
  ✓ 안 하면 YoY 비교가 무의미해짐
  
예시 시나리오:
  - 2020년(기준): 100,000 tCO₂ (자회사 A 제외)
  - 2023년: 자회사 A 편입 (+6,000 tCO₂)
  - 2024년: 106,000 tCO₂
  
  재산정 안 하면:
    → YoY: +6% 증가로 보임 (잘못된 분석)
  
  재산정 하면:
    → 2020년 재산정: 106,000 tCO₂
    → YoY: 0% (정확한 분석)
```

#### 🔍 검증 로직
```python
if boundary_change_impact > 5000 or impact_pct > 5:
    if not recalculation_done:
        finding = "BOUNDARY_CHANGE_NO_RECALC"
```

#### 📦 Context 정보
```json
{
  "base_year": "2020",
  "current_year": "2024",
  "changes": [
    {
      "change_type": "acquisition",
      "subsidiary_name": "자회사 A",
      "effective_date": "2023-06-01",
      "impact_tco2e": 6000,
      "recalculation_done": false
    }
  ],
  "total_impact_tco2e": 6000,
  "note": "GHG Protocol 재산정 정책 적용 필요"
}
```

---

### 5-2. 배출계수 변경 발생 (EMISSION_FACTOR_CHANGED) 📊

**룰 코드**: `EMISSION_FACTOR_CHANGED`  
**기준**: 주요 배출계수 변경 이력 발견  
**심각도**: `high`  
**Phase**: `batch`

#### 📊 예시
```text
💡 실생활 예시:
- 2024년 환경부가 전력 배출계수 변경
  - 기존(2023): 0.4154 kgCO₂/kWh
  - 변경(2024): 0.4157 kgCO₂/kWh
  - 변동: +0.07%

🤔 왜 알림?
→ GHG Protocol 권장사항:
  ✓ 배출계수 변경 시 과거 데이터도 새 계수로 재산정
  ✓ 추세 분석의 일관성 확보
  ✓ 감사 시 근거 자료로 필요
  
예시 시나리오:
  - 2020-2023: 구 배출계수 사용 (0.4154)
  - 2024: 신 배출계수 사용 (0.4157)
  
  재산정 안 하면:
    → 2020-2023과 2024 비교 불가
    → "배출계수가 달라서 비교 불가" 주석 필요
  
  재산정 하면:
    → 2020-2023을 0.4157로 재계산
    → 일관된 추세 분석 가능
```

#### 🔍 검증 로직
```python
if count(distinct version) > 1:
    if not recalculation_done:
        finding = "EMISSION_FACTOR_CHANGED"
```

---

### 5-3. 기준연도 Scope 1/2 데이터 0 (BASE_YEAR_SCOPE1_ZERO) 📉

**룰 코드**: `BASE_YEAR_SCOPE1_ZERO`, `BASE_YEAR_SCOPE2_ZERO`  
**기준**: 기준연도 Scope 1 또는 Scope 2 배출량이 **0**  
**심각도**: `critical` (Scope 1), `high` (Scope 2)  
**Phase**: `batch`

#### 📊 예시
```text
💡 실생활 예시:
- 기준연도(2020년) Scope 1 배출량: 0 tCO₂  ← ⚠️ 의심!
- 현재(2024년) Scope 1 배출량: 5,000 tCO₂

🤔 무엇이 문제?
→ 회사가 운영 중인데 Scope 1이 0?
  ✓ 난방, 차량, 보일러 등 직접 배출이 전혀 없다?
  ✓ 데이터 누락 가능성 매우 높음
  ✓ YoY 계산 불가 (0으로 나누기)
  
Scope 1 = 0인 정상 케이스:
  - 완전 전기화 건물 (난방도 전기)
  - 차량 없음 (대중교통 이용)
  - 외부 임대 건물 (가스는 건물주 책임)
  
Scope 2 = 0인 정상 케이스:
  - 100% 재생에너지 사용
  - 자가 발전 (태양광, 풍력)
  - 오프그리드 시설
```

#### 🔍 검증 로직
```python
if scope1_total == 0:
    finding = "BASE_YEAR_SCOPE1_ZERO"
if scope2_total == 0:
    finding = "BASE_YEAR_SCOPE2_ZERO"
```

#### 📦 Context 정보
```json
{
  "base_year": "2020",
  "scope1_total": 0,
  "note": "Scope 1 직접 배출이 0인 경우는 매우 드물며, 데이터 누락 가능성 높음"
}
```

---

## 📈 **심각도 수준 (Severity)**

| 심각도 | 의미 | 대응 시간 | 예시 |
|--------|------|-----------|------|
| **critical** 🔴 | 즉시 조치 필수 | 24시간 이내 | 음수값, 배출계수 30% 이탈, 조직 경계 미재산정 |
| **high** 🟠 | 빠른 확인 필요 | 3일 이내 | YoY 30% 변동, MoM 2배 급증, 중복 데이터 |
| **medium** 🟡 | 검토 권장 | 1주일 이내 | IQR 1.5배 이상치, MA12 2.5배, 원단위 초과 |
| **low** 🟢 | 참고 수준 | 월간 리뷰 시 | 경미한 변동, 정보성 알림 |

---

## 🎯 **실무 활용 전략**

### 1. False Positive 대응
```text
✅ 실제 변화 vs 데이터 오류 구분

예시 1: 공장 신설
  - 전력 2배 증가 → MOM_RATIO 감지
  - 실제로는 정상 (신규 라인 증설)
  - 처리: "사유 입력 후 무시"

예시 2: 단위 혼용
  - 1000배 차이 → UNIT_MISMATCH 감지
  - 실제로 오류 (kWh vs MWh)
  - 처리: "데이터 보정 필요"
```

### 2. 우선순위 전략
```text
1순위: critical
  → 음수값, 30% 배출계수 이탈, 조직 경계 미재산정
  → 즉시 수정 또는 근거 제출

2순위: high
  → YoY 30% 변동, MOM 2배, 중복 데이터
  → 3일 내 확인 및 조치

3순위: medium
  → IQR, MA12, 원단위 초과
  → 주간 리뷰 시 검토

4순위: low
  → 경미한 변동
  → 월간 리포트에 포함
```

### 3. 패턴 학습 및 조정
```text
운영 3개월 후:
  ✓ 자사 고유 패턴 파악
  ✓ 임계값 조정 (예: 30% → 20%)
  ✓ 업종별 벤치마크 업데이트
  ✓ False Positive 룰 제외

예시:
  - 계절 공장: 겨울 MoM 3배도 정상
    → MoM 임계값 2.0 → 4.0 조정
  
  - 24시간 공장: 인원당 배출량 높음
    → 벤치마크 5.0 → 8.0 조정
```

---

## 📊 **통계 요약**

| 구분 | 개수 | 구현 상태 | 비고 |
|------|------|----------|------|
| **전체 규칙** | 17개 | ✅ 100% | 모두 구현 완료 |
| **시계열** | 6개 | ✅ | YoY, MoM, MA12, Z-score, IQR×2 |
| **품질** | 4개 | ✅ | 0값, 음수, 중복, 단위 |
| **배출계수** | 1개 | ✅ | ±15% 이탈 |
| **원단위** | 3개 | ✅ | 면적, 인원, 생산량 |
| **경계** | 3개 | ✅ | 조직, 배출계수, 무결성 |

---

## 🚀 **다음 단계**

### 단기 (1-2주)
1. ✅ **배출계수 마스터 데이터 적재**
2. ✅ **API 엔드포인트 추가**
3. ✅ **프론트엔드 연동**

### 중기 (1-2개월)
1. **자동 보정 제안 엔진**
   - 단위 불일치 → 자동 변환 제안
   - 배출계수 이탈 → 표준값으로 교체 제안
2. **워크플로우 통합**
   - 이상치 발견 시 자동 알림
   - 담당자 할당 및 처리 이력 추적

### 장기 (3-6개월)
1. **ML 기반 이상치 탐지**
   - Isolation Forest, LSTM Autoencoder
   - 패턴 학습 기반 예측
2. **업종별 벤치마크 DB 구축**
   - 산업별/규모별 표준 원단위
   - 동종업계 평균 배출량 참조

---

## 📚 **참고 자료**

- ISO 14064-1:2018 (온실가스 배출 및 제거의 정량화 및 보고)
- GHG Protocol Corporate Standard
- 환경부 고시 「온실가스 배출권거래제의 배출량 보고 및 인증에 관한 지침」
- IPCC Guidelines for National Greenhouse Gas Inventories

---

**문서 버전**: v2.0  
**최종 업데이트**: 2026-04-10  
**작성자**: GHG Calculation Team  
**상태**: ✅ 프로덕션 준비 완료
