# Raw Data 스키마 기반 라우팅 구현서

## 1) 목적

현재 Raw Data Inquiry는 `source_file_name` 중심(부분 키워드 포함)으로 매퍼를 고른다.  
이 방식은 파일명이 변경되거나 신규 파일이 들어오면 매핑 누락이 발생하기 쉽다.

본 문서는 `raw_data.items`의 **실제 키/형태(스키마)**를 기반으로 매퍼를 선택하는 구조를 정의한다.

- 파일명 변경에 강한 구조로 전환
- 카테고리별 포맷 차이(월/분기/와이드/롱)를 안정적으로 수용
- 미매핑 사유를 로그/응답에 남겨 운영 디버깅 시간 단축

---aa

## 2) 질문에 대한 핵심 답변

### 프론트 스키마와 완전 일치가 필요한가?

**아니오. 완전 일치가 목표가 아니다.**

- 프론트는 `EnergyUsageRowVo`, `WasteRowVo` 등 **응답 VO 스키마**만 일치하면 된다.
- 백엔드 입력(`raw_data.items`)은 소스마다 컬럼명이 달라도 된다.
- 백엔드는 입력을 표준화(normalize)하고, 매퍼가 이를 VO로 변환한다.

즉, 계약(Contract)은 아래처럼 분리한다.

- **입력 계약(느슨함)**: `items`에 들어오는 원천 키는 alias/패턴으로 허용
- **출력 계약(엄격함)**: 프론트가 받는 응답 VO 필드는 고정

---

## 3) 현재 구조 요약

`raw_data_inquiry_service.py`에서 카테고리별로 스냅샷을 모은 뒤 파일명으로 매퍼를 선택한다.

- `energy`: `_ENERGY_BY_FILE` 딕셔너리(사실상 고정 파일명)
- `waste/pollution/chemical/provider/consignment`: 고정 파일명 + 키워드 fallback
- 공통 전제: `raw_data`가 dict이고 `items`가 list여야 처리

문제점:

- 파일명 의존도가 높아 운영 데이터 유연성이 낮음
- 같은 카테고리라도 소스별 키가 다르면 mapper 내부 분기에서 `[]`
- 실패 원인이 사용자/운영자에게 충분히 보이지 않음

---

## 4) 목표 아키텍처

### 4.1 매퍼 선택 우선순위

1. `raw_data_type` (있다면 최우선)  
2. `items` 스키마 시그니처 판별  
3. `source_file_name` 패턴(마지막 fallback)  
4. 실패 시 `unknown_schema`로 로깅 + 사유 수집

> 1번(`raw_data_type`)은 3단계 고도화이며, 본 문서의 즉시 구현 범위는 2번 중심.

### 4.2 책임 분리

- `SchemaDetector`: `items` 샘플에서 타입 후보 계산
- `MapperRegistry`: `category + schema_type` -> mapper 함수 매핑
- `InquiryService`: detector + registry를 호출하고 결과만 조합

---

## 5) 스키마 판별 규칙 (초안)

`items[0]`만 보지 말고, 앞 `N`개(권장 20개)에서 키 빈도를 집계한다.

### 5.1 공통 정규화

- key: BOM 제거, trim, lower, 구분자 통일(`-`, ` ` -> `_`)
- value: 문자열 trim, 숫자 파싱 가능 여부 체크

### 5.2 카테고리별 시그니처 예시

#### waste

- `waste_monthly_long`
  - 필수 후보: `year`, (`month` or `월`), (`amount`/`quantity`/`amount_ton`)
- `waste_quarterly_long`
  - 필수 후보: `year`, (`quarter` or `분기`), (`amount_ton` or amount alias)
- `waste_wide_q1q3`
  - 필수 후보: (`jan`,`feb`,`mar`) 또는 (`1월`,`2월`,`3월`)

#### pollution

- `pollution_monthly_long`
  - `year`, `month`, `pollutant` 유사 키, 수치 키
- `pollution_wide`
  - 월 컬럼 다수 + 기준치/단위 키

#### chemical

- `chemical_inventory`
  - `chemical_name`/`cas_no`/`usage` 계열 키

#### energy_provider

- `provider_contract`
  - `provider_name`, `energy_type`, `contract_no` 유사 키

#### consignment

- `consignment_vendor`
  - `vendor_name`, `waste_type`, `permit_no` 유사 키

#### energy

- `renewable_energy_monthly`
  - `energy_type`, 월 컬럼(1~12), `unit`

> 시그니처는 완전 일치가 아니라 **가중치 점수 기반**으로 판별한다.

---

## 6) 판별 알고리즘 (권장)

### 6.1 점수화

- 시그니처별로 `required_keys`, `optional_keys`, `negative_keys`를 정의
- 점수:
  - required 매칭: +3
  - optional 매칭: +1
  - negative 매칭: -2
- 임계치 미달 시 `unknown_schema`

### 6.2 충돌 해결

- 최고 점수가 임계치 이상 1개면 채택
- 동점/근접 점수면:
  1) `category`와 스테이징 시스템 제약으로 1차 필터
  2) `source_file_name` 패턴으로 tie-break
  3) 그래도 모호하면 unknown + 로그

### 6.3 성능

- `items` 전량 스캔 금지, 샘플 N개만 사용
- 판별 결과는 `staging_id` 기준 캐시 가능(요청 1회 내)

---

## 7) 코드 변경 포인트

## 7.1 신규 모듈

- `hub/mappers/schema_detector.py`
  - 키 정규화
  - 샘플 기반 시그니처 점수 계산
- `hub/mappers/mapper_registry.py`
  - `resolve_mapper(category, schema_type, file_key)` 제공

### 7.2 서비스 변경

- `hub/services/raw_data_inquiry_service.py`
  - `_collect_energy`, `_collect_generic`에서 파일명 우선 로직 제거/축소
  - `schema_type = detect_schema(category, items, file_key, staging_system)` 호출
  - `mapper = registry.resolve(...)` 호출

### 7.3 로깅/관측

- 미매핑 시 아래 구조로 warning 로그
  - `company_id`, `staging_id`, `category`, `staging_system`, `file_key`
  - `schema_candidates`, `top_score`, `sample_keys`

---

## 8) 데이터 계약 (프론트 관점)

프론트가 기대하는 것은 **입력 CSV 스키마가 아니라 응답 VO**다.

- `WasteRowVo`: `facility`, `wasteType`, `disposalMethod`, `jan/feb/mar`, `total`, `status`
- `EnergyUsageRowVo`: `jan~dec`, `total`, ...

백엔드는 다양한 입력을 위 VO로 변환만 해주면 된다.  
따라서 "프론트와 완전 일치"는 입력 쪽 요구사항이 아니다.

---

## 9) 실패 처리 정책

- `items` 미존재/비리스트: skip + reason=`invalid_items_shape`
- 시그니처 미검출: skip + reason=`unknown_schema`
- mapper 예외: skip + reason=`mapper_error`

선택 옵션:

- 운영 디버깅용으로 응답에 `meta.unmappedCount`, `meta.unmappedReasons` 추가
- 기본 릴리스에서는 로그만 남기고 응답 스키마는 유지

---

## 10) 단계별 적용 계획

### Phase 1 (빠른 적용)

- waste/pollution만 schema detector 우선 적용
- 기존 file_name 라우팅 fallback 유지
- 운영 로그 수집으로 false positive/negative 보정

### Phase 2

- chemical/provider/consignment/energy로 확대
- 시그니처 룰 외부 설정화(JSON/YAML)

### Phase 3

- ingest 시 `raw_data_type` 저장(정식 메타)
- inquiry에서 `raw_data_type` 우선 사용

---

## 11) 테스트 계획

### 단위 테스트

- `schema_detector`:
  - 월 롱/분기 롱/와이드/미확정 케이스
  - BOM, 대소문자, 공백, 별칭 키 케이스
- `mapper_registry`:
  - category + schema_type 정상 해석
  - fallback 및 unknown 처리

### 통합 테스트

- 카테고리별 대표 payload fixture로 `/raw-data/inquiry` 호출
- 기존 하드코딩 파일명 케이스 회귀 테스트
- source_file_name 변경 시에도 동일 결과 확인

---

## 12) 리스크 및 대응

- **오탐/미탐**: 초기에는 fallback 유지 + 로그 기반 룰 튜닝
- **운영 데이터 편차**: alias 사전 지속 확장
- **성능**: 샘플링/캐시로 비용 제한
- **가독성 저하**: detector/registry 분리로 서비스 복잡도 억제

---

## 13) 완료 기준 (Definition of Done)

- 파일명 변경(동일 스키마) 시에도 매핑 성공
- 카테고리별 대표 샘플 fixture 테스트 통과
- unknown_schema 비율이 운영 기준 이하
- 프론트 응답 VO 호환성 100% 유지

