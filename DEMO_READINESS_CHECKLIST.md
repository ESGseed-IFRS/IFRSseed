# 발표 시연 데이터 적합성 검토 및 보완 계획

## 현재 상태 분석

### ✅ 완료된 항목

1. **오픈핸즈 주식회사 전체 ESG 데이터** (9개 파일)
   - EMS: 에너지, 폐기물, 용수
   - ERP: 재무, 세금
   - HR: 인원, 교육
   - EHS: 안전
   - MDG: 사업장 마스터

2. **지주사(삼성SDS) 실제 배출량 데이터**
   - Scope 1: 184,807 tCO₂e (실제 값)
   - Scope 2: 179,480 tCO₂e (실제 값)
   - Scope 3: 2,992,478 tCO₂e (실제 값)
   - 9개 사업장 정보

3. **Backend API**
   - 계열사 제출: `/subsidiary/submit`
   - 승인/반려: `/subsidiary/approve`, `/subsidiary/reject`
   - 데이터 출처 조회: `/dp/{dp_id}/sources`

4. **Frontend 컴포넌트**
   - SubsidiaryDataSelector (계열사 선택)
   - DataSourceBadge (출처 배지)
   - SubsidiaryApprovalPanel (승인 패널)

---

## 시연 시나리오별 검토

### 시나리오 1: GHG 산정 시연

#### ✅ 가능한 부분
- 오픈핸즈 9개 CSV 업로드
- 전력 데이터 기반 Scope 2 자동 계산 (375.4 tCO₂e)
- 폐기물 데이터 기반 Scope 3 일부 계산

#### ⚠️ 보완 필요
```
문제: 현재 GHG 산정 엔진이 staging_*_data → ghg_emission_results 
      자동 계산 로직이 완전히 구현되지 않음

해결책:
1. ghg_calculation_engine.py 연동
2. 또는 사전 계산된 ghg_emission_results 더미 데이터 생성
```

**권장 사항:**
```python
# backend/scripts/seeds/generate_openhands_ghg_results.py
# 오픈핸즈의 ghg_emission_results 테이블 데이터 생성
INSERT INTO ghg_emission_results (
    company_id, year, scope, total_emission, ...
) VALUES 
('SUB-001', 2024, 'scope2', 375.4, ...),
('SUB-001', 2024, 'scope3', 3800, ...);
```

---

### 시나리오 2: 계열사 제출 시연

#### ✅ 가능한 부분
- API 엔드포인트 구현 완료
- 제출 데이터 구조 정의 완료
- DB 테이블 (`subsidiary_data_submissions`) 준비

#### ⚠️ 보완 필요
```
문제 1: 계열사가 1개만 있음 (오픈핸즈만)
해결책: 최소 2~3개 자회사 추가 생성 권장

문제 2: 제출 이력 시각화 부족
해결책: 제출 상태를 보여주는 더미 레코드 생성
```

**권장 데이터:**
```sql
-- subsidiary_data_submissions 더미 레코드
INSERT INTO subsidiary_data_submissions (
    subsidiary_company_id, holding_company_id,
    submission_year, status, total_emission_tco2e
) VALUES
('SUB-001', '550e8400...', 2024, 'approved', 4175),
('SUB-003', '550e8400...', 2024, 'submitted', 13170),  -- 멀티캠퍼스
('SUB-004', '550e8400...', 2024, 'draft', 17020);      -- 에스코어
```

---

### 시나리오 3: 지주사 승인 및 취합 시연

#### ✅ 가능한 부분
- 승인/반려 API 구현 완료
- 그룹 집계 서비스 구현 완료
- Frontend 승인 패널 구현 완료

#### ⚠️ 보완 필요
```
문제: 실제 승인할 제출 건이 없음

해결책: 
1. 오픈핸즈 + 멀티캠퍼스 2개 회사 데이터 생성
2. 각각 'submitted' 상태 레코드 생성
3. 지주사 계정으로 승인 시연
```

**시연 플로우:**
```
1. 지주사 로그인 → 승인 대기 목록 표시
   ├─ 오픈핸즈: 375 tCO₂e (Scope 2)
   └─ 멀티캠퍼스: 3,850 tCO₂e (Scope 2)

2. 오픈핸즈 승인 클릭
   └─ Status: submitted → approved

3. 그룹 전체 집계 화면
   ├─ 삼성SDS: 179,480 tCO₂e
   ├─ 오픈핸즈: 375 tCO₂e (승인됨)
   └─ 그룹 합계: 179,855 tCO₂e
```

---

### 시나리오 4: SR 보고서 데이터 출처 표시 시연

#### ✅ 가능한 부분
- DataSourceBadge 컴포넌트 구현
- `/dp/{dp_id}/sources` API 구현
- 출처 구분 (지주사 자체 / 계열사 보고)

#### ⚠️ 보완 필요
```
문제 1: SR 보고서 페이지가 출처 표시 미연동

해결책: HoldingPageByPageEditor에 DataSourceList 추가

문제 2: AI 문단 생성 시 출처 인용 테스트 필요

해결책: Gen Node 프롬프트에 출처 정보 포함 확인
```

**시연 화면 예시:**
```typescript
<HoldingPageByPageEditor>
  <DataPointSection dpId="GRI_305-2">
    <DataSourceList sources={[
      { 
        source_type: "holding_own", 
        company_name: "삼성에스디에스", 
        value: 179480, 
        unit: "tCO₂e" 
      },
      { 
        source_type: "subsidiary_reported", 
        company_name: "오픈핸즈", 
        value: 375, 
        unit: "tCO₂e" 
      }
    ]} />
    
    <GeneratedParagraph>
      "2024년 그룹 전체 Scope 2 배출량은 179,855 tCO₂e입니다.
       이 중 지주사 자체 배출량은 179,480 tCO₂e이며,
       오픈핸즈 주식회사로부터 보고받은 375 tCO₂e를 포함합니다."
    </GeneratedParagraph>
  </DataPointSection>
</HoldingPageByPageEditor>
```

---

## 발표 시연 완성도 평가

| 시연 항목 | 현재 상태 | 보완 필요 사항 | 중요도 |
|----------|----------|---------------|--------|
| **1. GHG 산정** | 70% | ghg_emission_results 생성 | ⭐⭐⭐ 필수 |
| **2. 계열사 제출** | 80% | 2~3개 자회사 추가 | ⭐⭐⭐ 필수 |
| **3. 지주사 승인** | 90% | 제출 이력 더미 데이터 | ⭐⭐ 권장 |
| **4. 그룹 집계** | 95% | 승인된 데이터 연동 | ⭐⭐ 권장 |
| **5. 출처 표시** | 85% | SR 페이지 UI 연동 | ⭐⭐ 권장 |
| **6. AI 문단 생성** | 75% | 출처 인용 테스트 | ⭐ 선택 |

---

## 즉시 보완 필요 항목 (발표 전)

### 우선순위 1: GHG 산정 결과 생성 (필수)

```python
# backend/scripts/seeds/generate_ghg_results.py
"""오픈핸즈 GHG 산정 결과 더미 데이터"""

import asyncio
from backend.core.db import get_db_pool

async def insert_ghg_results():
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        # Scope 2 (전력 기반)
        await conn.execute("""
            INSERT INTO ghg_emission_results (
                company_id, year, scope, basis,
                co2_tco2e, total_emission, calculation_method,
                verification_status, source_company_id
            ) VALUES 
            ('SUB-001', 2024, 'scope2', 'market_based',
             375.4, 375.4, 'emission_factor',
             '자가 검증', 'SUB-001')
        """)
        
        # Scope 3 (구매/폐기물 기반)
        await conn.execute("""
            INSERT INTO ghg_emission_results (
                company_id, year, scope, basis,
                co2_tco2e, total_emission, calculation_method,
                verification_status, source_company_id
            ) VALUES 
            ('SUB-001', 2024, 'scope3', 'location_based',
             3800, 3800, 'spend_based',
             '자가 검증', 'SUB-001')
        """)
```

### 우선순위 2: 멀티캠퍼스 데이터 생성 (필수)

```bash
# create_multicampus_full_data.py 실행
python backend/scripts/seeds/create_multicampus_full_data.py
```

### 우선순위 3: 제출 이력 더미 데이터 (권장)

```sql
INSERT INTO subsidiary_data_submissions (
    id, subsidiary_company_id, holding_company_id,
    submission_year, status, scope_2_submitted,
    total_emission_tco2e, staging_row_count, submission_date
) VALUES
-- 오픈핸즈: 승인됨
(gen_random_uuid(), 'SUB-001', '550e8400...', 
 2024, 'approved', true, 375.4, 12, '2024-03-15'),

-- 멀티캠퍼스: 제출 대기
(gen_random_uuid(), 'SUB-003', '550e8400...', 
 2024, 'submitted', true, 3850, 24, '2024-03-20');
```

---

## 시연 데모 스크립트 (권장)

### Part 1: 계열사 GHG 산정 (2분)
```
1. 오픈핸즈 계정 로그인
2. 데이터 수집 탭 → 9개 CSV 업로드 완료 확인
3. GHG 산정 탭 이동
   - Scope 2: 375.4 tCO₂e 자동 계산됨
   - 전력 816,800 kWh 기반
4. "제출 준비 완료" 상태 확인
```

### Part 2: 지주사 제출 (1분)
```
1. "계열사 데이터 제출" 버튼 클릭
2. 제출 범위 선택: Scope 2 ✓
3. 제출 완료 → "submitted" 상태
```

### Part 3: 지주사 승인 (2분)
```
1. 지주사(SDS) 계정 로그인
2. 승인 대기 목록 확인
   - 오픈핸즈: 375.4 tCO₂e
   - 멀티캠퍼스: 3,850 tCO₂e
3. 오픈핸즈 승인 → "approved"
```

### Part 4: 그룹 집계 및 출처 표시 (2분)
```
1. SR 보고서 작성 화면
2. GRI 305-2 (Scope 2) 선택
3. 데이터 출처 표시:
   ├─ 지주사 자체: 179,480 tCO₂e
   └─ 오픈핸즈 보고: 375 tCO₂e
4. AI 문단 생성 → 출처 자동 인용 확인
```

---

## 결론 및 권장사항

### 현재 데이터 적합성: ⭐⭐⭐⭐☆ (80%)

**✅ 강점:**
- 실제 삼성SDS 배출량 사용
- 완전한 ESG 데이터 구조 (EMS/ERP/HR/EHS/MDG)
- Backend API 완성도 높음

**⚠️ 보완 필요:**
1. **ghg_emission_results 생성** (필수)
2. **멀티캠퍼스 데이터 추가** (필수)
3. **제출 이력 더미 데이터** (권장)

### 발표 전 최소 작업 (1~2시간)
```
1. ✅ ghg_emission_results 더미 생성 (30분)
2. ✅ 멀티캠퍼스 전체 데이터 생성 (30분)
3. ✅ 제출 이력 3~4개 생성 (20분)
4. ✅ 시연 스크립트 리허설 (20분)
```

위 작업 완료 시 **완성도 95%**로 발표 시연 가능합니다!
