# 문제점 분석 및 해결 방안

## 📋 개요

RAG Node 실행 시 발생한 문제점들을 분석하고 해결 방안을 제시합니다.

**분석 일시**: 2026-02-10  
**테스트 쿼리**: `--test-rag --generate "기후 리스크 배출량 데이터 추출" --fiscal-year 2024 --company-id samsung-sds --target-dps S2-15-a S2-16-a`

---

## 🔴 주요 문제점

### 1. DART API 오류 - 회사 코드 조회 실패

#### 문제 상황
```
❌ DART API 오류: 필수값(corp_code)이 누락되었습니다.
⚠️ 기업 코드를 찾을 수 없습니다: samsung-sds
```

#### 원인 분석
- DART API의 `/company.json` 엔드포인트가 `corp_name` 파라미터만으로는 부족할 수 있음
- 회사명 매핑은 정상 작동 (`samsung-sds` → `삼성에스디에스`)
- API 응답에서 `status != "000"` 반환

#### 영향
- 외부 크롤링 실패로 회사별 데이터 수집 불가
- 벡터 DB에 회사별 데이터가 없는 경우 대체 데이터 소스 확보 실패

#### 해결 방안
1. **DART API 파라미터 수정**
   - `corp_name` 대신 정확한 회사명 사용
   - API 문서 확인 후 필수 파라미터 추가

2. **대체 조회 방법**
   - DART OpenAPI의 다른 엔드포인트 활용
   - 회사 코드 사전 매핑 테이블 구축

3. **에러 처리 개선**
   - API 응답 상세 로깅
   - 재시도 로직 추가

---

### 2. 벡터 DB 데이터 부족

#### 문제 상황
```
✅ 회사별 데이터 검색: 0개 결과
✅ 기준서 문서 검색: 20개 결과
```

#### 원인 분석
- 벡터 DB에 회사별 문서가 인덱싱되지 않음
- 기준서 문서만 검색되어 일반적인 정보만 확보
- 실제 회사별 배출량 데이터 부재

#### 영향
- 실제 값 추출 불가
- 더미 데이터로 대체됨

#### 해결 방안
1. **데이터 수집 파이프라인 구축**
   - DART API를 통한 지속가능경영보고서 수집
   - PDF 파싱 및 벡터 DB 인덱싱 자동화

2. **데이터 수집 스크립트 실행**
   ```bash
   python scripts/store_pdf_to_vector_db.py --company-id samsung-sds --year 2024
   ```

3. **데이터 검증**
   - 벡터 DB에 회사별 데이터 존재 여부 확인
   - 검색 테스트 수행

---

### 3. DP ID 매칭 오류

#### 문제 상황
```
✅ DP 숫자 기반 검색 성공: S2-15-a -> SS2-68
✅ DP 숫자 기반 검색 성공: S2-15-b -> SS2-68
✅ DP 숫자 기반 검색 성공: S2-15-c -> SS2-68
✅ DP 숫자 기반 검색 성공: S2-29-a -> SS2-68
✅ DP 숫자 기반 검색 성공: S2-29-b -> SS2-68
✅ DP 숫자 기반 검색 성공: S2-29-c -> SS2-68
```

#### 원인 분석
- `_find_similar_dp()` 함수의 숫자 기반 검색이 너무 광범위함
- 모든 DP가 동일한 `SS2-68`로 잘못 매칭됨
- DP ID 형식 불일치: 요청은 `S2-15-a`, DB는 `SS2-68`

#### 코드 문제점
```python
# 현재 로직 (너무 광범위)
numbers = re.findall(r'\d+', dp_id)  # "S2-15-a" -> ["2", "15"]
for num in numbers:
    dp = db.query(DataPoint).filter(
        DataPoint.dp_id.like(f"%{num}%"),  # "2" 또는 "15" 포함하는 모든 DP
        DataPoint.is_active == True
    ).first()
```

#### 영향
- 잘못된 DP 메타데이터 사용
- 검색 키워드가 부정확해져 관련 결과를 찾지 못함

#### 해결 방안
1. **DP ID 변환 로직 개선**
   ```python
   # S2-15-a -> SS2-15-a 또는 SS2-15 우선 시도
   # 숫자 기반 검색은 마지막 수단으로만 사용
   ```

2. **검색 우선순위 조정**
   - 정확한 ID 매칭 우선
   - ID 변환 시도 (S2-xx -> SS2-xx)
   - 키워드 기반 검색
   - 숫자 기반 검색 (최소한의 범위로 제한)

3. **DP ID 표준화**
   - DB의 DP ID 형식과 요청 형식 일치
   - DP ID 매핑 테이블 구축

---

### 4. 검색 결과 부재로 인한 더미 데이터 생성

#### 문제 상황
```
⚠️ DP S2-15-a에 대한 검색 결과가 없습니다.
⚠️ DP S2-15-b에 대한 검색 결과가 없습니다.
⚠️ DP S2-15-c에 대한 검색 결과가 없습니다.
```

#### 원인 분석
- 벡터 DB에 회사별 데이터 부재
- DP 매칭 오류로 인한 잘못된 검색 키워드 사용
- 검색 쿼리 최적화 부족

#### 영향
- 모든 팩트 시트가 더미 데이터로 생성됨
- 실제 값 추출 불가

#### 해결 방안
1. **검색 쿼리 최적화**
   - DP별 검색 키워드 전략 개선
   - DP 메타데이터(이름, 설명) 활용

2. **하이브리드 검색 강화**
   - Dense 검색 + Sparse 검색 (BM25) 결합
   - RRF(Reciprocal Rank Fusion) 점수 융합

3. **검색 결과 품질 개선**
   - 유사도 임계값 조정
   - 검색 결과 재랭킹

---

### 5. 더미 데이터 문제

#### 문제 상황
```
값: {2022: 100, 2023: 95, 2024: 90}
단위: None
신뢰도: 0.30
```

#### 원인 분석
- 검색 결과가 없어 `_create_dummy_fact_sheet()` 호출
- 모든 팩트 시트가 동일한 더미 값 사용
- 단위 정보 누락

#### 영향
- 실제 데이터와 무관한 결과 생성
- 신뢰도가 낮아 신뢰할 수 없음

#### 해결 방안
1. **더미 데이터 개선**
   - DP 메타데이터 기반 더 현실적인 더미 값 생성
   - 단위 정보 포함

2. **에러 처리 강화**
   - 더미 데이터 생성 시 명확한 경고
   - 사용자에게 데이터 부재 알림

3. **대체 데이터 소스 활용**
   - DART API 직접 조회
   - 외부 크롤링 강화

---

### 6. Validation Node JSON 파싱 실패

#### 문제 상황
```
ERROR | JSON 파싱 실패: Expecting value: line 1 column 1 (char 0)
INFO  | Validation Node: 검증 완료 - 그린워싱 위험도: 0.00, IFRS 준수도: 1.00
```

#### 원인 분석
- LLM 응답이 JSON 형식이 아님
- 빈 응답 또는 텍스트만 반환
- JSON 파싱 에러 처리 후 기본값 사용

#### 영향
- 검증 결과가 제대로 파싱되지 않음
- 기본값(그린워싱 위험도: 0.00)으로 표시되어 실제 검증 결과 반영 안 됨

#### 해결 방안
1. **프롬프트 개선**
   - JSON 형식 응답을 명확히 요구
   - 예시 제공

2. **파싱 로직 개선**
   - JSON 추출 로직 강화
   - 에러 발생 시 재시도

3. **응답 검증**
   - JSON 형식 검증 후 파싱
   - 실패 시 LLM에 재요청

---

### 7. DP ID 형식 불일치

#### 문제 상황
- **요청 형식**: `S2-15-a`, `S2-16-a` (IFRS S2 형식)
- **DB 형식**: `SS2-68` (다른 형식)
- **매칭 결과**: 모든 DP가 `SS2-68`로 잘못 매칭

#### 원인 분석
- DP ID 변환 로직이 올바르게 작동하지 않음
- DB에 실제 `S2-15-a` 형식의 DP가 없을 수 있음

#### 해결 방안
1. **DP ID 매핑 테이블 구축**
   - IFRS S2 DP ID → DB DP ID 매핑
   - 자동 변환 로직 구현

2. **DB 데이터 확인**
   - 실제 DB에 어떤 형식의 DP ID가 있는지 확인
   - 필요한 DP 데이터 추가

3. **ID 변환 로직 개선**
   - 더 정확한 변환 규칙 적용
   - 여러 변환 시도 후 최적 매칭 선택

---

## 📊 문제점 요약

| 문제 | 심각도 | 우선순위 | 상태 |
|------|--------|----------|------|
| DART API 오류 | 높음 | 높음 | 🔴 미해결 |
| 벡터 DB 데이터 부족 | 높음 | 높음 | 🔴 미해결 |
| DP ID 매칭 오류 | 높음 | 높음 | 🔴 미해결 |
| 검색 결과 부재 | 높음 | 중간 | 🔴 미해결 |
| 더미 데이터 문제 | 중간 | 중간 | 🟡 부분 해결 |
| Validation JSON 파싱 실패 | 낮음 | 낮음 | 🟡 부분 해결 |
| DP ID 형식 불일치 | 높음 | 높음 | 🔴 미해결 |

---

## 🛠️ 즉시 조치 사항

### 1. 벡터 DB 데이터 수집 (최우선)
```bash
# 회사별 문서 수집 및 인덱싱
python scripts/store_pdf_to_vector_db.py \
  --company-id samsung-sds \
  --year 2024 \
  --source dart
```

### 2. DP ID 매핑 확인
```sql
-- DB에 실제 존재하는 DP ID 확인
SELECT dp_id, name_ko, standard 
FROM data_points 
WHERE standard = 'IFRS_S2' 
  AND is_active = true
ORDER BY dp_id;
```

### 3. DART API 테스트
```python
# DART API 직접 테스트
import requests

url = "https://opendart.fss.or.kr/api/company.json"
params = {
    "crtfc_key": "YOUR_API_KEY",
    "corp_name": "삼성에스디에스"
}
response = requests.get(url, params=params)
print(response.json())
```

---

## 📝 개선 로드맵

### Phase 1: 데이터 수집 (1주)
- [ ] DART API 연동 수정
- [ ] 회사별 문서 수집 자동화
- [ ] 벡터 DB 인덱싱 파이프라인 구축

### Phase 2: DP 매칭 개선 (1주)
- [ ] DP ID 매핑 테이블 구축
- [ ] DP 매칭 로직 개선
- [ ] 검색 쿼리 최적화

### Phase 3: 검색 품질 향상 (1주)
- [ ] 하이브리드 검색 구현
- [ ] 검색 결과 재랭킹
- [ ] 검색 결과 품질 평가

### Phase 4: 검증 및 모니터링 (1주)
- [ ] Validation Node 개선
- [ ] 에러 처리 강화
- [ ] 모니터링 대시보드 구축

---

## 🔗 관련 문서

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 시스템 아키텍처
- [NODES.md](./NODES.md) - 노드별 구현 상세
- [DATA_COLLECTION.md](./DATA_COLLECTION.md) - 데이터 수집 전략
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - 구현 가이드

---

**작성일**: 2026-02-10  
**작성자**: IFRS Agent Team
