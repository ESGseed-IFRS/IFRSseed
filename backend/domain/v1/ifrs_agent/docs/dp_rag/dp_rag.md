# dp_rag

**최종 수정**: 2026-04-05  
**문서 버전**: 1.2

---

## 1. 개요

`dp_rag`(Data Point-based RAG)는 **사용자가 선택한 Data Point(DP)의 최신 실데이터 값**을 조회하는 노드입니다. `c_rag`가 **SR 보고서 본문·이미지**를 수집한다면, `dp_rag`는 **현재 연도 팩트 수치**(예: 2025년 임직원 수, GHG 배출량 등)를 추출합니다.

| 항목 | 내용 |
|------|------|
| **코드 위치** | `backend/domain/v1/ifrs_agent/spokes/agents/dp_rag/` (예정) |
| **등록** | `hub/bootstrap.py` — `make_dp_rag_handler(infra)` |
| **핵심 흐름** | DP ID → UCM/DP 메타 조회 → **LLM으로 물리 테이블·컬럼 결정** → 실데이터 조회 |
| **LLM** | **Gemini 2.5 Flash** — API 모델 ID `gemini-2.5-flash` (`google.generativeai`). `.env`: `DP_RAG_GEMINI_MODEL`로 변경 가능 |
| **DB 테이블** | `unified_column_mappings`, `data_points`, **`social_data`**, **`environmental_data`**, **`governance_data`**, **`company_info`** (맥락용, DP 비의존) |

---

## 2. 역할 및 데이터 범위

### 2.1 역할

1. **DP 메타데이터 조회** — `data_points`, `unified_column_mappings`  
2. **물리 저장 위치 결정** — LLM이 실데이터 테이블·컬럼 선택 (화이트리스트 기반)  
3. **실데이터 추출** — `social_data` / `environmental_data` / `governance_data`에서 최신 값 조회  
4. **회사 프로필** — 동일 요청에서 **`company_info`**를 `company_id`로 조회해 응답에 `company_profile`로 첨부 (DP·UCM 매핑과 무관)  
5. **유효성 검증** — 데이터 누락·오래됨 여부 체크

### 2.2 수집 대상

| 항목 | 설명 |
|------|------|
| **현재 연도 팩트** | 예: 2025년 값 (오케스트레이터가 `year` 지정) |
| **단일 DP** | 사용자가 선택한 **1개 DP**에 대한 값 |
| **반환 형식** | `{"dp_id", "value", "unit", "year", "company_profile", "table", "column", …, "error"?}` |

### 2.3 `company_info`와 DP의 관계

| 구분 | E/S/G 실데이터 | `company_info` |
|------|----------------|----------------|
| 결정 요인 | 선택한 **DP(또는 UCM)** → LLM·allowlist로 테이블·컬럼 결정 | **회사 ID만** — 매 호출마다 조회 |
| 연도 | `payload["year"]` → `period_year` 필터 | **없음** — 회사당 1행 프로필 |
| LLM 매핑 | 사용 (테이블·컬럼 선택) | **사용 안 함** — 고정 컬럼 `SELECT` (`query_company_info` 툴) |
| 목적 | 공시 수치·지표 | 미션·비전·산업·ESG 목표 등 **서술·맥락** (생성 노드 참고용) |

**개인정보·연락처**: `query_company_info`는 전화·이메일·주소를 반환하지 않는다.

**`c_rag`와 비교**:

| 구분 | c_rag | dp_rag |
|------|-------|--------|
| 입력 | `category` (문자열) | `dp_id` (DP 식별자) |
| 출력 | SR 본문 + 이미지 (페이지) | 단일 수치/텍스트 값 |
| 연도 | 전년·전전년 (2024, 2023) | 현재 연도 (2025) |
| LLM | OpenAI (후보 재선택) | Gemini 2.5 Flash (테이블·컬럼 선택) |

---

## 3. 응답 구조 (개선됨 ✨ + 정량 적합성 경고)

```json
{
  "dp_id": "ESRS2-SBM-3-48-c-i",
  "value": 10,
  "unit": "명",
  "year": 2025,

  "company_profile": {
    "company_id": "…",
    "company_name_ko": "…",
    "industry": "…",
    "mission": "…",
    "vision": "…",
    "esg_goals": {},
    "total_employees": 1000,
    "updated_at": "2025-01-01T00:00:00+00:00"
  },
  
  // DP 메타데이터 (풍부한 정보)
  "dp_metadata": {
    "name_ko": "이사회 총 인원",
    "name_en": "Total Board Members",
    "description": "이사회를 구성하는 총 인원 수",
    "topic": "지배구조",
    "subtopic": "이사회 구성",
    "category": "G",
    "dp_type": "quantitative"
  },
  
  // UCM 정보 (gen_node가 문맥 이해에 사용)
  "ucm": {
    "unified_column_id": "UCM_ESRS2_MDR_T_80_i",
    "column_name_ko": "이사회 총 인원",
    "column_name_en": "Total Board Members",
    "column_category": "G",
    "column_topic": "지배구조",
    "column_subtopic": "이사회",
    "column_description": "지배구조를 담당하는 이사회 총 인원",
    "validation_rules": {
      "min": 3,
      "max": 30,
      "type": "integer"
    },
    "disclosure_requirement": "필수",
    "financial_linkages": ["지배구조 비용", "이사회 운영비"]
  },
  
  // 소스 정보
  "source": {
    "table": "governance_data",
    "column": "total_board_members",
    "data_type": "board"
  },
  
  // 검증 결과
  "is_outdated": false,
  "confidence": 0.95,
  "validation_passed": true,
  "validation_error": null,
  
  // 제안 A: 정량 적합성 경고 (정성/서술형 신호 감지 시)
  "suitability_warning": null,  // 또는 "DP type is 'qualitative' — fact_data 수치만으로 부족할 수 있음"
  
  // 에러 (없으면 null)
  "error": null
}
```

**개선 포인트**:
- ✅ **`company_profile`** — `company_info` 행(없으면 `null`), DP와 독립
- ✅ **DP 메타데이터** 포함 (topic, subtopic, description 등)
- ✅ **UCM 정보** 포함 (column_topic, validation_rules, financial_linkages 등)
- ✅ `gen_node`가 이 정보로 풍부한 문단 생성 가능
- ✅ 소스를 `source` 객체로 그룹화하여 가독성 향상
- ✅ **`suitability_warning`** — rulebook·UCM description 기반 정량 적합성 경고 (제안 A)

---

## 4. 현재 스키마 상황 (문제점)

### 4.1 `unified_column_mappings`에 물리 위치 정보 없음

**UCM이 갖고 있는 것**:
- `unified_column_id`, `column_name_ko`, `column_name_en`  
- `column_category` (**`'E' | 'S' | 'G'`** — 환경·사회·지배구조 축)  
- `mapped_dp_ids` (여러 기준서 DP ID 배열)  
- `unit`, `validation_rules`, `column_type` 등

**UCM이 갖고 있지 **않은** 것**:
- ❌ **`source_table`** (예: `social_data`, `environmental_data`)  
- ❌ **`source_column`** (예: `total_employees`, `scope1_total_tco2e`)  
- ❌ **`data_type_filter`** (`social_data`는 `data_type`으로 행이 갈림)

### 4.2 왜 문제인가?

DP ID만 받으면:
1. UCM에서 `mapped_dp_ids`로 해당 통합 컬럼을 찾을 수 있고  
2. `column_category`로 E/S/G는 알 수 있지만  
3. **"그래서 `social_data`의 `total_employees` 컬럼을 봐야 한다"**는 정보가 **DB 스키마에 명시되지 않음**

→ 따라서 **코드 하드코딩** 또는 **LLM 추론**으로 물리 위치를 정해야 함.

---

## 5. 해결 전략 (LLM 기반 매핑)

### 5.1 기본 아이디어

**"DP 메타데이터 + 실데이터 테이블·컬럼 허용 목록"**을 Gemini 2.5 Flash에 주고, **가장 적합한 `(table, column, data_type?)`을 JSON으로 고르게 한다.**

### 5.2 장점

- **`source_table` / `source_column` 필드 추가 없이** 동작 가능  
- **신규 DP / 테이블 컬럼 추가 시 허용 목록만 업데이트**하면 자동 대응  
- **유연성** — 하드코딩 없이 의미 기반 매칭

### 5.3 위험 요소 및 대책

| 위험 | 대책 |
|------|------|
| **잘못된 컬럼 선택 → 수치 오류** | ① 화이트리스트만 후보로 제공 ② 검증 로직 (타입·범위 체크) |
| **`social_data`는 테이블 내 `data_type` 행 구분 필요** | LLM 출력에 **`data_type` 필드 포함** 필수 |
| **비용·지연** | ① 결과 캐싱(DB 또는 설정 파일) ② 후보 줄이기(E/S/G로 1차 필터) |
| **임의 SQL 생성 위험** | ❌ LLM이 SQL 작성 금지. **화이트리스트 검증 후 템플릿 쿼리**만 실행 |

---

## 5. 구현 설계

### 5.1 처리 흐름

```
0. 회사 프로필 (DP와 무관)
   - query_company_info(company_id) → company_profile

1. DP 메타 조회
   - data_points: dp_id, name_ko, description, topic, subtopic, unit
   - unified_column_mappings: column_category (E/S/G), column_name_ko, unit

1.5. 정량 적합성 체크 (제안 A, 보조 안전장치)
   - rulebook·UCM description에서 정성/서술 키워드 감지
   - dp_type이 qualitative/narrative/binary면 경고
   - suitability_warning 필드에 메시지 (없으면 null)

2. 물리 위치 결정 (LLM)
   - 화이트리스트 후보 생성 (column_category로 1차 필터)
   - Gemini 2.5 Flash → {"table", "column", "data_type"?} JSON
   - 화이트리스트 검증

3. 실데이터 조회 (템플릿 쿼리)
   - social_data / environmental_data / governance_data
   - WHERE company_id, period_year, (data_type?)
   
4. 유효성 검사
   - 데이터 없음 / 오래됨(> 1년) 체크
   - validation_rules 적용
```

---

### 5.2 화이트리스트 (허용 목록)

**고정된 허용 목록**만 LLM에 제공 → SQL 인젝션·잘못된 선택 방지.

#### **A. `social_data` (data_type별 그룹)**

```python
SOCIAL_DATA_COLUMNS = {
    "workforce": [
        {"column": "total_employees", "desc": "전체 임직원 수", "unit": "명"},
        {"column": "male_employees", "desc": "남성 임직원 수", "unit": "명"},
        {"column": "female_employees", "desc": "여성 임직원 수", "unit": "명"},
        {"column": "disabled_employees", "desc": "장애인 임직원 수", "unit": "명"},
        {"column": "average_age", "desc": "평균 연령", "unit": "세"},
        {"column": "turnover_rate", "desc": "이직률", "unit": "%"},
    ],
    "safety": [
        {"column": "total_incidents", "desc": "총 안전사고 건수", "unit": "건"},
        {"column": "fatal_incidents", "desc": "중대재해 건수", "unit": "건"},
        {"column": "lost_time_injury_rate", "desc": "손실시간 부상률 (LTIR)", "unit": "%"},
        {"column": "total_recordable_injury_rate", "desc": "총 기록 부상률 (TRIR)", "unit": "%"},
        {"column": "safety_training_hours", "desc": "안전보건 교육시간", "unit": "시간"},
    ],
    "supply_chain": [
        {"column": "total_suppliers", "desc": "전체 협력회사 수", "unit": "개사"},
        {"column": "supplier_purchase_amount", "desc": "협력회사 구매액", "unit": "원"},
        {"column": "esg_evaluated_suppliers", "desc": "ESG 평가 협력회사 수", "unit": "개사"},
    ],
    "community": [
        {"column": "social_contribution_cost", "desc": "사회공헌 비용", "unit": "원"},
        {"column": "volunteer_hours", "desc": "봉사활동 시간", "unit": "시간"},
    ],
}
```

#### **B. `environmental_data`**

```python
ENVIRONMENTAL_DATA_COLUMNS = [
    {"column": "scope1_total_tco2e", "desc": "Scope 1 GHG 배출량", "unit": "tCO2e"},
    {"column": "scope2_location_tco2e", "desc": "Scope 2 GHG (Location-based)", "unit": "tCO2e"},
    {"column": "scope2_market_tco2e", "desc": "Scope 2 GHG (Market-based)", "unit": "tCO2e"},
    {"column": "scope3_total_tco2e", "desc": "Scope 3 GHG 배출량", "unit": "tCO2e"},
    
    {"column": "total_energy_consumption_mwh", "desc": "총 에너지 소비량", "unit": "MWh"},
    {"column": "renewable_energy_mwh", "desc": "재생에너지 사용량", "unit": "MWh"},
    {"column": "renewable_energy_ratio", "desc": "재생에너지 비율", "unit": "%"},
    
    {"column": "total_waste_generated", "desc": "폐기물 발생량", "unit": "톤"},
    {"column": "waste_recycled", "desc": "재활용 폐기물", "unit": "톤"},
    {"column": "hazardous_waste", "desc": "유해 폐기물", "unit": "톤"},
    
    {"column": "water_withdrawal", "desc": "용수 취수량", "unit": "㎥"},
    {"column": "water_consumption", "desc": "용수 소비량", "unit": "㎥"},
    {"column": "water_discharge", "desc": "용수 배출량", "unit": "㎥"},
    
    {"column": "nox_emission", "desc": "NOx 배출량", "unit": "톤"},
    {"column": "sox_emission", "desc": "SOx 배출량", "unit": "톤"},
]
```

#### **C. `governance_data` (향후 추가)**

```python
# governance_data ORM 추가 후 화이트리스트 작성
GOVERNANCE_DATA_COLUMNS = [
    # 예: board_size, independent_directors, ethics_training_hours 등
]
```

---

### 5.3 LLM 프롬프트 구조

```python
system_msg = """
You are a data mapping specialist. Given a Data Point and a list of allowed table columns,
select the SINGLE best match. Output ONLY valid JSON, no markdown.

Format:
{
  "table": "social_data" | "environmental_data" | "governance_data",
  "column": "<column_name>",
  "data_type": "<workforce|safety|supply_chain|community>" or null,
  "confidence": 0.0-1.0
}

Rules:
1. table MUST be one of: social_data, environmental_data, governance_data
2. column MUST exist in the allowlist for that table
3. If table=social_data, data_type is REQUIRED (workforce/safety/supply_chain/community)
4. confidence: your certainty (0.0 = no match, 1.0 = perfect match)
"""

user_msg = f"""
Data Point:
- dp_id: {dp_id}
- name_ko: {dp_meta['name_ko']}
- description: {dp_meta['description']}
- topic: {dp_meta['topic']}
- subtopic: {dp_meta['subtopic']}
- unit: {dp_meta['unit']}

UCM Info (if found):
- column_category: {ucm_category}  # 'E' | 'S' | 'G'
- column_name_ko: {ucm_name_ko}

Allowed columns (filtered by category={ucm_category}):
{json.dumps(filtered_allowlist, ensure_ascii=False, indent=2)}

Select the best match.
"""
```

**LLM 출력 예**:

```json
{
  "table": "social_data",
  "column": "total_employees",
  "data_type": "workforce",
  "confidence": 0.95
}
```

---

### 5.4 실데이터 조회 (템플릿 쿼리)

**LLM 응답을 화이트리스트 검증 후**, **파라미터 바인딩 쿼리**만 실행:

```python
# social_data 예시
if table == "social_data":
    query = """
        SELECT 
            sd.period_year,
            sd.{column} as value,
            sd.status,
            sd.updated_at
        FROM social_data sd
        WHERE sd.company_id = $1::uuid
          AND sd.period_year = $2
          AND sd.data_type = $3
        ORDER BY sd.updated_at DESC
        LIMIT 1
    """
    # ❌ f-string으로 column 삽입 금지 → 화이트리스트 검증 후 안전한 방식으로
    # 실제로는 psycopg2.sql.Identifier 등 사용
    
# environmental_data 예시
elif table == "environmental_data":
    query = """
        SELECT 
            ed.period_year,
            ed.{column} as value,
            ed.status,
            ed.updated_at
        FROM environmental_data ed
        WHERE ed.company_id = $1::uuid
          AND ed.period_year = $2
        ORDER BY ed.updated_at DESC
        LIMIT 1
    """
```

**주의**: `{column}`은 **화이트리스트 검증된 값**만 삽입 가능 (SQL 인젝션 방지).

---

### 5.5 캐싱 전략

**DP → 물리 위치 매핑 결과를 저장**해 LLM 호출 줄이기:

**구현 완료** (`cache.py`):

1. **설정 파일 캐시** (`dp_mapping_cache.json`)  
   - 관리자가 검증한 고정 매핑 (`verified=true`)
   - Git에 포함, 배포 시 함께 전달
   - 우선순위: **가장 높음**

2. **메모리 캐시**  
   - LLM이 선택한 결과를 런타임에 저장 (`confidence >= 0.8`만 자동 캐싱)
   - 검증 전 상태 (`verified=false`)
   - 서버 재시작 시 초기화

**조회 우선순위**:
```
파일 캐시(검증됨) > 메모리 캐시(런타임) > LLM 추론 → 메모리 캐시 저장
```

**캐시 무효화**:
- `cache.invalidate(dp_id)` — 특정 DP 캐시 삭제
- `cache.clear_memory()` — 메모리만 전체 클리어

---

### 5.6 Validation Rules 적용

**구현 완료** (`_validate_value`):

```python
validation_rules = {
    "min": 0,
    "max": 10000,
    "type": "integer"
}

# 체크 항목:
# 1. min/max 범위
# 2. type (integer, number)
# 3. 실패 시 에러 문자열 반환
```

**적용 시점**: 실데이터 조회 후, 반환 전  
**에러 처리**: `validation_error` 필드에 메시지 포함, 값은 그대로 반환 (경고 로그)

---

### 5.7 Unmapped Data Points 처리

**구현 완료** (`query_unmapped_dp` 툴):

- UCM에 매핑이 없으면 **`unmapped_data_points`** 테이블 조회
- `dp_id`, `name_ko`, `category`, `unit`, `validation_rules`, `mapping_status` 추출
- LLM은 동일하게 물리 위치 선택 (unmapped여도 category·의미로 매칭)

**흐름**:
```
1. query_ucm_by_dp → 없음
2. query_unmapped_dp → 발견
3. unmapped 메타를 UCM 형식으로 변환 (_unmapped: true 마킹)
4. LLM이 allowlist에서 선택 (동일 경로)
```

---

## 6. 에이전트 구조 (`dp_rag/agent.py`)

### 6.1 클래스 구조

```python
class DpRagAgent:
    def __init__(self, infra):
        self.infra = infra
        self.runtime_config = None
        self.cache = get_cache()  # 파일 + 메모리 캐시
    
    async def collect(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Args:
            payload: {
                "company_id": str,
                "dp_id": str,
                "year": int,  # 현재 연도 (2025)
                "runtime_config": AgentRuntimeConfig (선택)
            }
        
        Returns:
            {
                "dp_id": str,
                "value": Any,
                "unit": str,
                "year": int,
                "table": str,
                "column": str,
                "data_type": str?,
                "is_outdated": bool,
                "confidence": float,
                "validation_error": str?,
                "error": str?
            }
        """
        # 1. DP 메타 조회 (data_points)
        dp_meta = await self._query_dp_metadata(dp_id)
        
        # 2. UCM 조회 (없으면 unmapped_data_points)
        ucm_info = await self._query_ucm_by_dp(dp_id)
        
        # 3. 물리 위치 결정 (캐시 → LLM → 검증)
        mapping = await self._resolve_physical_location(dp_id, dp_meta, ucm_info)
        
        # 4. Confidence 임계값 체크 (< 0.5 경고)
        
        # 5. 실데이터 조회
        data = await self._query_real_data(...)
        
        # 6. Validation rules 적용
        validation_error = self._validate_value(data["value"], validation_rules)
        
        # 7. 오래됨 체크
        is_outdated = self._check_outdated(data, year)
        
        return {
            "dp_id": dp_id,
            "value": data["value"],
            "validation_error": validation_error,
            "is_outdated": is_outdated,
            "confidence": mapping["confidence"],
            ...
        }
```

### 6.2 주요 메서드

| 메서드 | 역할 |
|--------|------|
| `_query_company_info` | `query_company_info` 툴 호출 → `company_profile` |
| `_query_dp_metadata` | `data_points` 테이블 조회 |
| `_query_ucm_by_dp` | UCM 조회 → 없으면 `unmapped_data_points` |
| `_check_quantitative_suitability` | **제안 A**: rulebook·UCM·dp_type 기반 정량 적합성 체크 |
| `_resolve_physical_location` | **캐시 확인** → LLM 호출 → 화이트리스트 검증 → **캐시 저장** |
| `_llm_select_column` | Gemini 2.5 Flash 호출 (프롬프트 생성 + JSON 파싱) |
| `_query_real_data` | 테이블별 템플릿 쿼리 실행 |
| `_check_outdated` | `현재 연도 - period_year > 1` 체크 |
| `_validate_value` | **validation_rules 적용** (min/max/type) |

---

## 7. 툴 구조 (`dp_query.py` 수정)

### 7.1 현재 문제점

기존 `backend/domain/shared/tool/ifrs_agent/database/dp_query.py`:
- ❌ UCM에 없는 `table_name`, `column_name` 필드 조회 시도  
- ❌ 동적 SQL f-string (인젝션 위험)  
- ❌ `social_data`의 `data_type` 미고려

### 7.2 구현 완료 (Phase 1 + Phase 2 + company 프로필)

**툴**:

1. **`query_dp_metadata(dp_id)`** — `data_points` 조회 (실제 스키마 맞춤)
2. **`query_ucm_by_dp(dp_id)`** — `mapped_dp_ids @> ARRAY[dp_id]` 조회 + `validation_rules`
3. **`query_unmapped_dp(dp_id)`** — `unmapped_data_points` 조회 (UCM 없는 DP)
4. **`query_dp_real_data(company_id, year, table, column, data_type?)`** — E/S/G 화이트리스트 검증된 조회
5. **`query_company_info(company_id)`** — `company_info` 1행 (맥락용, 연락처·주소 제외)

**기존 `query_dp_data()`**: deprecated 표시 (하위 호환)

---

## 8. 에러 처리

| 상황 | 동작 |
|------|------|
| DP가 `data_points`에 없음 | `{"error": "DP not found"}` |
| UCM·unmapped 모두 없음 | LLM은 DP 메타만으로 진행 (category 추정) |
| LLM 선택 실패 / 화이트리스트 불일치 | `{"error": "No valid column mapping", "confidence": 0.0}` |
| 실데이터 없음 | `{"value": null, "error": "No data for year {year}"}` |
| `confidence < 0.5` | 경고 로그 (오케스트레이터 단에서 사용자 알림 가능) |
| `validation_error` 있음 | `validation_error` 필드에 메시지, 값은 그대로 반환 |

---

## 9. 관련 파일 요약

| 경로 | 역할 |
|------|------|
| `spokes/agents/dp_rag/agent.py` | `DpRagAgent`, `make_dp_rag_handler` |
| `spokes/agents/dp_rag/allowlist.py` | 화이트리스트 정의·검증 |
| `spokes/agents/dp_rag/cache.py` | 매핑 캐시 (파일 + 메모리) |
| `spokes/agents/dp_rag/dp_mapping_cache.json` | 고정 매핑 설정 파일 |
| `shared/tool/ifrs_agent/database/dp_query.py` | 메타·UCM·unmapped·실데이터·`query_company_info` |
| `esg_data/models/bases/governance_data.py` | `GovernanceData` ORM |
| `hub/bootstrap.py` | 에이전트·툴 등록 |

---

## 9. 운영 체크리스트

### Phase 1: 최소 구현 ✅ (완료)

- [x] `dp_rag/agent.py` 생성 (`c_rag` 패턴 참고)
- [x] 화이트리스트 고정 (Python dict — `allowlist.py`)
- [x] LLM 프롬프트 구현 (Gemini 2.5 Flash)
- [x] `social_data`, `environmental_data` 조회 로직
- [x] `governance_data` ORM 추가 + 화이트리스트
- [x] `bootstrap.py` 에이전트 등록
- [x] 툴 등록: `query_dp_metadata`, `query_ucm_by_dp`, `query_dp_real_data`

### Phase 2: 고도화 ✅ (완료)

- [x] 캐싱 (설정 파일 + 메모리) — `cache.py`, `dp_mapping_cache.json`
- [x] `validation_rules` 적용 (min/max 범위 체크) — `_validate_value`
- [x] `unmapped_data_points` 연동 — `query_unmapped_dp` 툴
- [x] Confidence 임계값 처리 (< 0.5 경고 로그)

### Phase 3: DP 유형 라우팅 + 적합성 경고 ✅

- [x] `company_info` 조회 — `query_company_info` + 응답 `company_profile`
- [x] **제안 B**: 오케스트레이터 `_check_dp_type_for_routing` — `dp_type=quantitative`만 `dp_rag` 호출
- [x] **제안 A**: `dp_rag` 내부 `_check_quantitative_suitability` — rulebook·UCM 기반 경고

### Phase 4: 향후 개선

- [ ] 정성 DP 전용 라우팅 (narrative_rag 또는 c_rag 통합)
- [ ] 관리자 UI (매핑 검증·수정)
- [ ] DB 캐시 테이블 (선택적, 파일 캐시로도 충분)
- [ ] 통합 테스트 (실제 DB + Gemini)

---

## 10. 테스트 시나리오

### 단위 테스트

```python
# Mock Gemini → 고정 응답
mock_llm_response = {
    "table": "social_data",
    "column": "total_employees",
    "data_type": "workforce",
    "confidence": 0.95
}

# Mock DB
mock_social_data = {
    "period_year": 2025,
    "value": 1500,
    "status": "final_approved"
}

result = await dp_rag.collect({
    "company_id": "test-company",
    "dp_id": "TEST_DP_001",
    "year": 2025
})

assert result["value"] == 1500
assert result["table"] == "social_data"
assert result["column"] == "total_employees"
```

### 통합 테스트

- 실제 DB + 실제 Gemini 호출
- 여러 DP 카테고리(E/S/G) 테스트
- 데이터 없음 / 오래된 데이터 케이스

---

## 11. 참고 문서

- `c_rag/c_rag.md` — 유사 패턴 (에이전트 구조)
- `REVISED_WORKFLOW.md` §5.3 — DP 조회 설계 (초기 스케치)
- `DATABASE_TABLES_STRUCTURE.md` — `social_data`, `environmental_data`, UCM 스키마
- `esg_data/docs/architecture.md` — UCM·DP 온톨로지

---

**최종 수정**: 2026-04-05
