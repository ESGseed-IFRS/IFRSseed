# 🔍 활동단위·연간활동량 빈 값 디버깅 가이드

## 문제 상황
`EmissionFactorMapping` 탭에서 **활동단위(source_unit)**와 **연간활동량(annual_activity)** 필드가 비어있는 현상

---

## ✅ 코드 검증 결과

### 1. 백엔드 로직 (정상)
`backend/domain/v1/ghg_calculation/hub/orchestrator/scope_calculation_orchestrator_v2.py`

```python
# Line 332: 연간 활동량 계산
annual_activity = sum(qty.get(m, 0.0) for m in range(1, 13))

# Line 370-377: DTO에 값 전달
li = _line_item(
    et,
    facility,
    em,
    ef_detail.composite_factor,
    ef_detail.reference_source,
    imp_st,
    source_unit=source_unit,           # ✅ 전달됨
    ef_unit=ef_unit_str,
    ef_version=ef_detail.version or "v2.0",
    factor_code=ef_detail.factor_code or "",
    calculation_formula=calc_formula,
    heat_content=ef_detail.heat_content_coefficient,
    annual_activity=annual_activity,   # ✅ 전달됨
)
```

### 2. 프론트엔드 로직 (정상)
`frontend/src/app/(main)/ghg_calc/components/ghg/EmissionFactorMapping.tsx`

```typescript
// Line 53: API 응답에서 추출
sourceUnit: item.source_unit || '',

// Line 62: 연간 활동량
annualActivity: item.annual_activity || 0,

// Line 243-246: UI 렌더링
<td>{row.sourceUnit || '-'}</td>
<td>
  {row.annualActivity > 0 ? row.annualActivity.toLocaleString() : '-'}
</td>
```

**결론**: 코드는 정상이며, 빈 값은 **데이터 문제**입니다.

---

## 🔍 디버깅 로깅 추가됨

### 추가된 백엔드 로깅

1. **스테이징 데이터 조회 로그**
   ```python
   logger.info(f"🔍 스테이징 데이터: {len(snaps)}개 스냅샷")
   logger.info(f"🔍 집계 후 Bucket: {len(bucket)}개 에너지 타입×시설 조합")
   ```

2. **연간 활동량 계산 로그**
   ```python
   if annual_activity == 0:
       logger.warning(f"⚠️ 연간 활동량이 0입니다: facility={facility}, et={et}, unit={source_unit}")
   else:
       logger.debug(f"✅ 활동량 계산 완료: {et} ({facility}), {annual_activity:,.0f} {source_unit}")
   ```

3. **라인 아이템 생성 로그**
   ```python
   logger.debug(
       f"  → 라인 아이템 생성: {li.name}, source_unit=[{li.source_unit}], "
       f"annual_activity={li.annual_activity:,.0f}, total={li.total:,.2f} tCO₂eq"
   )
   ```

4. **최종 카테고리별 집계 로그**
   ```python
   logger.info(f"✅ Scope 1 고정연소: {len(acc_s1_fixed)}개 항목")
   logger.info(f"✅ Scope 2 전력: {len(acc_s2_grid)}개 항목")
   logger.info(f"🎯 최종 산정 결과: Scope 1 = {scope1_total:,.2f}, Scope 2 = {scope2_total:,.2f} tCO₂eq")
   ```

### 추가된 프론트엔드 로깅

1. **API 응답 전체 확인**
   ```javascript
   console.log('=== Scope Calculation API Response ===');
   console.log('Scope 1 Total:', body.scope1_total);
   console.log('Scope 2 Total:', body.scope2_total);
   ```

2. **첫 번째 아이템 상세 확인**
   ```javascript
   console.log('\n=== First Scope 1 Item ===');
   console.log('Name:', firstItem.name);
   console.log('Source Unit:', `[${firstItem.source_unit}]`);
   console.log('Annual Activity:', firstItem.annual_activity);
   console.log('Total Emission:', firstItem.total);
   ```

3. **빈 값 경고**
   ```javascript
   if (!item.source_unit || item.annual_activity === 0) {
     console.warn(`⚠️ [${scopeLabel}] ${item.name} - 빈 값 발견:`, {
       source_unit: item.source_unit,
       annual_activity: item.annual_activity,
       ef: item.ef,
       total: item.total
     });
   }
   ```

---

## 📝 디버깅 방법

### 1. 백엔드 로그 확인
```bash
# 백엔드 서버 실행 시 콘솔 출력 확인
# 또는 로그 파일 확인

# 예상되는 로그 출력:
🔍 스테이징 데이터: 0개 스냅샷                    ← ⚠️ 문제!
🔍 집계 후 Bucket: 0개 에너지 타입×시설 조합      ← ⚠️ 문제!

# 또는
🔍 스테이징 데이터: 15개 스냅샷                   ← ✅ 정상
🔍 집계 후 Bucket: 45개 에너지 타입×시설 조합     ← ✅ 정상
⚠️ 연간 활동량이 0입니다: facility=본사, et=전력, unit=kWh  ← ⚠️ 데이터 0
✅ 활동량 계산 완료: LNG (공장A), 12,500 Nm³      ← ✅ 정상
배출계수 없음: fuel=LPG, unit=kg, scope=Scope1   ← ⚠️ EF 매칭 실패
```

### 2. 프론트엔드 브라우저 콘솔 확인
```
1. 브라우저 개발자 도구 (F12) 열기
2. Console 탭 선택
3. "Scope 산정 재계산" 버튼 클릭
4. 콘솔 출력 확인

예상 출력:
=== Scope Calculation API Response ===
Scope 1 Total: 1234.56
Scope 2 Total: 789.12

=== First Scope 1 Item ===
Name: LNG (본사)
Source Unit: [Nm³]           ← ✅ 정상
Annual Activity: 12500        ← ✅ 정상
Total Emission: 28.5

⚠️ [Scope 1] 경유 (공장A) - 빈 값 발견:  ← ⚠️ 문제 발견!
  source_unit: ""
  annual_activity: 0
  ef: 3.1234
  total: 0
```

### 3. 네트워크 탭에서 API 응답 직접 확인
```
1. 개발자 도구 → Network 탭
2. "Scope 산정 재계산" 버튼 클릭
3. "recalculate" 요청 선택
4. Response 탭 확인

JSON 응답 예시:
{
  "scope1_categories": [
    {
      "items": [
        {
          "name": "LNG (본사)",
          "source_unit": "",           ← ⚠️ 빈 문자열!
          "annual_activity": 0,        ← ⚠️ 0!
          "ef": 56.1,
          "total": 0
        }
      ]
    }
  ]
}
```

---

## 🔧 예상 원인 및 해결 방법

### 원인 1: 스테이징 데이터 없음
**증상**: 
```
🔍 스테이징 데이터: 0개 스냅샷
```

**확인**:
```sql
SELECT COUNT(*) 
FROM staging_ems_data 
WHERE company_id = '사용자_회사_ID';
```

**해결**: 
- CSV 업로드 또는 ERP 연동으로 스테이징 데이터 입력
- `Raw Data Upload` 탭에서 에너지 사용량 CSV 업로드

---

### 원인 2: raw_data.items가 비어있음
**증상**: 
```
🔍 스테이징 데이터: 5개 스냅샷
🔍 집계 후 Bucket: 0개 에너지 타입×시설 조합  ← 집계 실패!
```

**확인**:
```sql
SELECT 
  id,
  staging_system,
  jsonb_array_length(raw_data->'items') as item_count,
  raw_data->'items'->0 as first_item
FROM staging_ems_data
WHERE company_id = '사용자_회사_ID'
LIMIT 5;
```

**해결**:
- CSV 스키마 확인 (필수 컬럼: 에너지타입, 시설명, 월별 사용량, 단위)
- `raw_data_inquiry_service.py`의 스키마 매핑 로직 확인

---

### 원인 3: 단위 인식 실패
**증상**: 
```
⚠️ 연간 활동량이 0입니다: facility=본사, et=전력, unit=
```

**확인**:
- CSV의 단위 컬럼이 비어있거나 잘못된 형식
- `_classify_fuel_type_and_unit()` 함수가 해당 단위를 인식하지 못함

**해결**:
```python
# scope_calculation_orchestrator_v2.py의 _classify_fuel_type_and_unit 함수 확인
# 지원되는 단위: kWh, Nm³, L, kg, ton 등

# 새로운 단위 추가가 필요하면:
def _classify_fuel_type_and_unit(...):
    # ...
    if "새단위" in unit_lower:
        return ("fuel_type", "새단위", "Scope1")
```

---

### 원인 4: 배출계수 매칭 실패
**증상**: 
```
배출계수 없음: fuel=LPG, unit=kg, scope=Scope1
```

**확인**:
```sql
SELECT * 
FROM ghg_emission_factors 
WHERE fuel_type = 'LPG' 
  AND source_unit = 'kg'
  AND applicable_scope = 'Scope1';
```

**해결**:
- 배출계수 DB에 해당 연료·단위 조합 추가
- `EmissionFactorServiceV2.resolve_detailed()` 로직 확인

---

### 원인 5: 월별 데이터가 모두 0
**증상**: 
```
✅ 활동량 계산 완료: 전력 (본사), 0 kWh
```

**확인**:
```python
# CSV의 1월~12월 컬럼 값이 모두 0 또는 null인지 확인
# aggregate_energy_activity_by_month_for_year() 함수의 집계 로직 확인
```

**해결**:
- CSV 데이터 재확인
- 연도 필터링 로직 확인 (2024년 데이터를 조회했는데 2023년만 있는 경우)

---

## ✨ 정상 동작 예시

### 백엔드 로그 (정상)
```
🔍 스테이징 데이터: 18개 스냅샷
🔍 집계 후 Bucket: 42개 에너지 타입×시설 조합
🔍 Bucket 크기: 42개 항목
✅ 활동량 계산 완료: LNG (본사), 15,230 Nm³
  → 라인 아이템 생성: LNG (본사), source_unit=[Nm³], annual_activity=15,230, total=28.45 tCO₂eq
✅ 활동량 계산 완료: 전력 (본사), 125,000 kWh
  → 라인 아이템 생성: 전력 (본사), source_unit=[kWh], annual_activity=125,000, total=51.93 tCO₂eq
✅ Scope 1 고정연소: 12개 항목
✅ Scope 2 전력: 8개 항목
🎯 최종 산정 결과: Scope 1 = 145.67, Scope 2 = 89.34, Total = 235.01 tCO₂eq
```

### 프론트엔드 콘솔 (정상)
```
=== Scope Calculation API Response ===
Scope 1 Total: 145.67
Scope 2 Total: 89.34

=== First Scope 1 Item ===
Name: LNG (본사)
Source Unit: [Nm³]
Annual Activity: 15230
Total Emission: 28.45

(빈 값 경고 없음)
```

---

## 🎯 다음 단계

1. **백엔드 로그 확인** → 스테이징 데이터와 Bucket 크기 확인
2. **데이터 없으면** → CSV 업로드 또는 ERP 연동
3. **데이터 있는데 Bucket 0이면** → 스키마 매핑 문제
4. **Bucket 있는데 라인 아이템 0이면** → 배출계수 매칭 실패
5. **라인 아이템은 있는데 annual_activity = 0이면** → 월별 데이터가 모두 0

---

## 📚 관련 파일

- **백엔드 Orchestrator**: `backend/domain/v1/ghg_calculation/hub/orchestrator/scope_calculation_orchestrator_v2.py`
- **스테이징 Repository**: `backend/domain/v1/ghg_calculation/hub/repositories/staging_raw_repository.py`
- **배출계수 Service**: `backend/domain/v1/ghg_calculation/hub/services/emission_factor_service_v2.py`
- **프론트엔드 UI**: `frontend/src/app/(main)/ghg_calc/components/ghg/EmissionFactorMapping.tsx`
- **API Router**: `backend/api/v1/ghg_calculation/scope_calculation_router.py`

---

디버깅에 성공하시길 바랍니다! 🚀
