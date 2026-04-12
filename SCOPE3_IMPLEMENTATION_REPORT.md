# Scope 3 구현 완료 보고서

## 작업 완료 내역

### 1. Scope 3 배출계수 DB 추가 ✅

**파일**: `backend/scripts/seeds/insert_scope3_emission_factors.py`

- Excel 파일 `GHG_배출계수_마스터_v2.xlsx`의 `Scope3_카테고리별` 시트에서 21개 배출계수 추출
- `emission_factors` 테이블에 삽입 완료

**삽입된 카테고리**:
- **Cat.1**: 구매한 제품·서비스 (3개 - 지출기반, 철강, 플라스틱)
- **Cat.2**: 자본재 (1개)
- **Cat.3**: 연료·에너지 관련 (3개 - LNG WTT, 경유 WTT, 전력 T&D Loss)
- **Cat.4**: 업스트림 운송 (5개 - 5톤/15톤 트럭, 철도, 해상, 항공)
- **Cat.5**: 폐기물 (3개 - 매립, 소각, 재활용)
- **Cat.6**: 출장 (3개 - 국내선/국제선 항공, KTX)
- **Cat.7**: 통근 (2개 - 자가용, 버스)
- **Cat.15**: 투자 (1개 - 금융업 기업대출)

**실행 결과**:
```
[OK] Successfully inserted 21 Scope 3 emission factors
```

---

### 2. Scope 3 계산 로직 추가 ✅

**파일**: `backend/domain/v1/ghg_calculation/hub/orchestrator/scope_calculation_orchestrator.py`

**주요 변경사항**:

#### 2.1 새로운 함수 추가

```python
def _read_scope3_data_from_csv(company_id: UUID, year: str) -> dict[str, float]:
    """
    회사 ID와 연도에 해당하는 Scope 3 데이터를 CSV에서 읽어서 카테고리별로 집계
    """
```

- `SDS_ESG_DATA_REAL/{company_type}_{company_name}/EMS/GHG_SCOPE3_DETAIL.csv` 파일 읽기
- 연도별 필터링 및 카테고리별 집계
- 반환: `{"Cat.1 구매상품·서비스": 4005.0, "Cat.4 업스트림 운송": 2225.0, ...}`

```python
def _scope3_categories_from_csv(company_id: UUID, year: str) -> tuple[list[ScopeCalcCategoryDto], float]:
    """
    CSV에서 Scope 3 데이터를 읽어서 카테고리별 ScopeCalcCategoryDto 리스트 생성
    """
```

- CSV 데이터를 DTO 모델로 변환
- 월별 데이터가 없으므로 연간 총량을 12등분하여 월별 데이터 생성
- 반환: (카테고리 리스트, Scope 3 총 배출량)

#### 2.2 `recalculate` 메서드 수정

**변경 전**:
```python
scope3_total = 0.0
```

**변경 후**:
```python
# Scope 3 계산 (CSV 기반)
scope3_categories, scope3_total = _scope3_categories_from_csv(company_id, year)
s3_m = {i: scope3_total / 12.0 for i in range(1, 13)}  # 월별 균등 분할
```

- Scope 3 데이터를 CSV에서 로드
- 월별 배출량 계산
- 카테고리별 라인 아이템 생성

#### 2.3 응답 데이터에 Scope 3 추가

```python
monthly_chart = [
    ScopeMonthlyPointDto(
        month=_MONTH_LABELS[i - 1],
        scope1=round(s1_m[i], 6),
        scope2=round(s2_m[i], 6),
        scope3=round(s3_m[i], 6),  # 추가됨
    )
    for i in range(1, 13)
]

line_payload = {
    "scope1_categories": [...],
    "scope2_categories": [...],
    "scope3_categories": [...]  # 추가됨
}
```

#### 2.4 `get_stored_results` 메서드 수정

- 저장된 결과에서 Scope 3 데이터도 로드하도록 수정
- 월별 차트에 `scope3` 필드 추가

---

### 3. DTO 모델 업데이트 ✅

**파일**: `backend/domain/v1/ghg_calculation/models/states/scope_calculation.py`

#### 3.1 `ScopeMonthlyPointDto` 수정

**변경 전**:
```python
class ScopeMonthlyPointDto(BaseModel):
    month: str
    scope1: float = 0.0
    scope2: float = 0.0
```

**변경 후**:
```python
class ScopeMonthlyPointDto(BaseModel):
    month: str
    scope1: float = 0.0
    scope2: float = 0.0
    scope3: float = 0.0  # 추가됨
```

#### 3.2 `ScopeRecalculateResponseDto` 수정

**변경 전**:
```python
class ScopeRecalculateResponseDto(BaseModel):
    # ...
    scope1_categories: list[ScopeCalcCategoryDto]
    scope2_categories: list[ScopeCalcCategoryDto]
    # ...
```

**변경 후**:
```python
class ScopeRecalculateResponseDto(BaseModel):
    # ...
    scope1_categories: list[ScopeCalcCategoryDto]
    scope2_categories: list[ScopeCalcCategoryDto]
    scope3_categories: list[ScopeCalcCategoryDto] = Field(
        default_factory=list, 
        description="Scope 3 카테고리별 배출량"
    )  # 추가됨
    # ...
```

---

### 4. 데이터 구조 및 흐름

#### 4.1 Scope 3 데이터 소스

**CSV 파일 위치**:
```
backend/SDS_ESG_DATA_REAL/
├── holding_삼성에스디에스 주식회사/EMS/GHG_SCOPE3_DETAIL.csv
├── subsidiary_오픈핸즈 주식회사/EMS/GHG_SCOPE3_DETAIL.csv
├── subsidiary_멀티캠퍼스 주식회사/EMS/GHG_SCOPE3_DETAIL.csv
├── subsidiary_엠로 주식회사/EMS/GHG_SCOPE3_DETAIL.csv
├── subsidiary_에스코어 주식회사/EMS/GHG_SCOPE3_DETAIL.csv
├── subsidiary_시큐아이 주식회사/EMS/GHG_SCOPE3_DETAIL.csv
└── subsidiary_미라콤아이앤씨 주식회사/EMS/GHG_SCOPE3_DETAIL.csv
```

**CSV 구조**:
```csv
company_id,company_name,year,quarter,scope3_category,subcategory,ghg_emission_tco2e,calculation_method,data_quality,notes
SUB-003,멀티캠퍼스 주식회사,2024,1,Cat.1 구매상품·서비스,,1001.25,spend_based,low,멀티캠퍼스 주식회사 Cat.1 구매상품·서비스
SUB-003,멀티캠퍼스 주식회사,2024,1,Cat.4 업스트림 운송,,556.25,spend_based,low,멀티캠퍼스 주식회사 Cat.4 업스트림 운송
...
```

#### 4.2 계산 흐름

1. **API 요청**: `POST /api/v1/ghg/calculation/recalculate`
2. **Scope 1·2 계산**: 스테이징 데이터 + 배출계수 기반 계산
3. **Scope 3 계산**: `_scope3_categories_from_csv()` 호출
   - 회사 ID로 회사명 조회
   - CSV 파일 읽기
   - 연도별 필터링
   - 카테고리별 집계
4. **결과 저장**: `ghg_emission_results` 테이블에 저장
5. **응답 반환**: Scope 1·2·3 모두 포함된 결과 반환

---

### 5. API 응답 예시

```json
{
  "company_id": "550e8400-e29b-41d4-a716-446655440005",
  "year": "2024",
  "basis": "location",
  "scope1_total": 1245.67,
  "scope2_total": 8934.12,
  "scope3_total": 12025.00,
  "grand_total": 22204.79,
  "monthly_chart": [
    {
      "month": "1월",
      "scope1": 103.81,
      "scope2": 744.51,
      "scope3": 1002.08
    },
    // ... 12개월
  ],
  "scope1_categories": [...],
  "scope2_categories": [...],
  "scope3_categories": [
    {
      "id": "s3-cat1",
      "category": "Cat.1 구매상품·서비스",
      "items": [
        {
          "name": "Cat.1 구매상품·서비스 (전사)",
          "facility": "전사",
          "unit": "tCO₂eq",
          "jan": 333.44,
          "feb": 333.44,
          // ... 12개월
          "total": 4005.0,
          "ef": "0",
          "ef_source": "GHG_SCOPE3_DETAIL.csv",
          "status": "confirmed"
        }
      ]
    },
    {
      "id": "s3-cat4",
      "category": "Cat.4 업스트림 운송",
      "items": [...]
    },
    // ... 더 많은 카테고리
  ],
  "calculated_at": "2026-04-12T07:30:00Z",
  "row_import_status": "confirmed"
}
```

---

## 테스트 방법

### 1. 배출계수 확인

```bash
cd backend
python scripts/seeds/insert_scope3_emission_factors.py
```

**예상 출력**:
```
[OK] Successfully inserted 21 Scope 3 emission factors

[INFO] Scope 3 emission factors by category:
  - Scope3_Cat1: 3 factors
  - Scope3_Cat2: 1 factors
  - Scope3_Cat3: 3 factors
  - Scope3_Cat4: 5 factors
  - Scope3_Cat5: 3 factors
  - Scope3_Cat6: 3 factors
  - Scope3_Cat7: 2 factors
  - Scope3_Cat15: 1 factors
```

### 2. GHG 계산 실행

프론트엔드에서:
1. GHG 계산 페이지로 이동
2. 회사 선택 (예: 멀티캠퍼스 주식회사)
3. 연도 선택 (2024)
4. "재계산" 버튼 클릭

**예상 결과**:
- Scope 1: 에너지 사용량 기반 계산된 값
- Scope 2: 전력 사용량 기반 계산된 값
- Scope 3: **0이 아닌 실제 값 표시** (CSV에서 로드된 카테고리별 배출량)

### 3. API 직접 테스트

```bash
curl -X POST "http://localhost:8000/api/v1/ghg/calculation/recalculate" \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "550e8400-e29b-41d4-a716-446655440005",
    "year": "2024",
    "basis": "location"
  }'
```

---

## 주요 특징

### 1. CSV 기반 Scope 3 데이터
- 실제 배출량이 이미 계산된 CSV 파일 사용
- 별도의 스테이징 테이블 불필요
- 유연한 데이터 업데이트 (CSV 파일만 수정)

### 2. 카테고리별 추적
- GHG Protocol의 15개 카테고리 중 주요 8개 카테고리 지원
- 각 카테고리별 배출량 개별 추적
- 월별 데이터 자동 생성 (연간 총량 12등분)

### 3. 데이터 출처 명시
- `ef_source` 필드에 "GHG_SCOPE3_DETAIL.csv" 표시
- 향후 SR 보고서에서 데이터 출처 추적 가능

### 4. 하위 호환성
- Scope 3 데이터가 없는 회사: `scope3_categories = []`, `scope3_total = 0.0`
- 기존 Scope 1·2 계산 로직에 영향 없음

---

## 다음 단계 (옵션)

### 1. 프론트엔드 UI 개선
- Scope 3 카테고리별 차트 추가
- 카테고리별 상세 테이블 표시
- 데이터 출처 표시 UI

### 2. 스테이징 테이블 추가 (선택사항)
- 더 정교한 데이터 관리가 필요한 경우
- `staging_scope3_data` 테이블 생성
- CSV 업로드 기능 추가

### 3. 배출계수 확장
- Cat.8~14 배출계수 추가
- 더 세분화된 배출계수 (산업별, 제품별)

---

## 파일 변경 내역

### 생성된 파일
1. `backend/scripts/seeds/insert_scope3_emission_factors.py` - Scope 3 배출계수 삽입 스크립트
2. `backend/scripts/seeds/read_emission_factors_excel.py` - Excel 배출계수 파일 읽기 스크립트
3. `backend/scripts/seeds/extract_scope3_to_csv.py` - Scope 3 배출계수 CSV 추출 스크립트
4. `backend/SCOPE3_EMISSION_FACTORS.csv` - 추출된 Scope 3 배출계수 CSV

### 수정된 파일
1. `backend/domain/v1/ghg_calculation/hub/orchestrator/scope_calculation_orchestrator.py`
   - `_read_scope3_data_from_csv()` 함수 추가
   - `_scope3_categories_from_csv()` 함수 추가
   - `recalculate()` 메서드에 Scope 3 계산 통합
   - `get_stored_results()` 메서드에 Scope 3 로드 추가

2. `backend/domain/v1/ghg_calculation/models/states/scope_calculation.py`
   - `ScopeMonthlyPointDto`에 `scope3` 필드 추가
   - `ScopeRecalculateResponseDto`에 `scope3_categories` 필드 추가

---

## 구현 완료 확인

- ✅ Scope 3 배출계수 DB 추가 (21개)
- ✅ CSV 기반 Scope 3 데이터 로드 함수 구현
- ✅ Scope 3 계산 로직 통합
- ✅ DTO 모델 업데이트
- ✅ 월별 차트 데이터에 Scope 3 추가
- ✅ 저장 및 조회 기능 Scope 3 지원
- ✅ 하위 호환성 유지
- ✅ 린트 오류 없음

**모든 Scope 3 구현이 완료되었습니다!** 🎉
