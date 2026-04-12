# 계열사/자회사 → 지주사 데이터 전달 구조 분석

## 📋 현재 상황 요약

### ✅ 구현된 부분
1. **더미 데이터 (`SDS_ESG_DATA/`)**: 삼성SDS 지주사의 전체 ESG 데이터 (7개 시스템, 50개 CSV)
2. **데이터 적재 파이프라인**: CSV → 스테이징 테이블 자동 적재
3. **UI 화면**: GHG Calc 화면 + Holding SR Editor 화면

### ❌ 구현 안 된 부분
1. **계열사/자회사별 데이터 분리**: 현재는 지주사 통합 데이터만 존재
2. **데이터 전송 워크플로우**: 계열사 → 지주사 승인/취합 프로세스
3. **실시간 데이터 동기화**: 각 계열사가 자체 데이터를 입력하고 전송하는 기능

---

## 🏗️ 현재 데이터 구조

### 1. SDS_ESG_DATA 폴더 구조

```
SDS_ESG_DATA/
├── EMS/          # 환경관리시스템 (11개 CSV)
│   ├── EMS_ENERGY_USAGE.csv          ← Scope 1/2 직접 데이터
│   ├── GHG_SCOPE12_SUMMARY.csv       ← Scope 1/2 집계
│   ├── GHG_SCOPE3_DETAIL.csv         ← Scope 3 (14개 카테고리)
│   └── ...
├── ERP/          # 전사자원관리 (15개 CSV)
├── EHS/          # 안전보건환경 (6개 CSV)
├── HR/           # 인사시스템 (8개 CSV)
├── PLM/          # 제품수명주기 (3개 CSV)
├── SRM/          # 공급망관리 (3개 CSV)
└── MDG/          # 마스터데이터 (3개 CSV)
```

### 2. 스테이징 테이블 구조

```sql
-- 7개 스테이징 테이블
staging_ems_data         -- EMS 시스템 원시 데이터
staging_erp_data         -- ERP 시스템 원시 데이터
staging_ehs_data         -- EHS 시스템 원시 데이터
staging_plm_data         -- PLM 시스템 원시 데이터
staging_srm_data         -- SRM 시스템 원시 데이터
staging_hr_data          -- HR 시스템 원시 데이터
staging_mdg_data         -- MDG 마스터 데이터

-- 공통 구조
CREATE TABLE staging_ems_data (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL,           -- 회사 ID (지주사 or 계열사)
    source_system VARCHAR(20),          -- 'EMS', 'ERP' 등
    ingest_source VARCHAR(50),          -- 'folder_scan', 'file_upload' 등
    ingest_timestamp TIMESTAMPTZ,
    raw_data JSONB NOT NULL,            -- CSV 행 전체 (동적 스키마)
    ghg_raw_category VARCHAR(50)        -- 'energy', 'waste' 등
);
```

### 3. 데이터 적재 API

```http
POST /data-integration/staging/ingest
{
  "base_path": "C:/data/SDS_ESG_DATA",
  "company_id": "550e8400-e29b-41d4-a716-446655440000",
  "systems": ["ems", "erp", "ehs", "plm", "srm", "hr", "mdg"]
}
```

**흐름**:
```
SDS_ESG_DATA/*.csv
    ↓
StagingIngestionOrchestrator
    ↓
StagingIngestionService (7개 시스템별 파싱)
    ↓
staging_*_data 테이블 INSERT
```

---

## 🔄 현재 데이터 흐름 (지주사 통합 모델)

```
┌─────────────────────────────────────────────────────────┐
│         SDS_ESG_DATA (온프레미스 파일 시스템)            │
│                                                         │
│  EMS/EMS_ENERGY_USAGE.csv                              │
│  ├─ site_code: SITE-DC01 (수원DC)                      │
│  ├─ energy_type: 전력, LNG                             │
│  ├─ consumption_kwh: 12,450,000                        │
│  └─ company_id: 삼성SDS (지주사 통합)                   │
└─────────────────────────────────────────────────────────┘
                    ↓ (파일 스캔 또는 업로드)
┌─────────────────────────────────────────────────────────┐
│       Backend API: /data-integration/staging/ingest     │
│                                                         │
│  StagingIngestionOrchestrator                           │
│  └─ 7개 시스템별 CSV 파싱                               │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│         PostgreSQL: staging_*_data 테이블                │
│                                                         │
│  staging_ems_data                                       │
│  ├─ company_id: 550e8400-...  (삼성SDS)                │
│  ├─ source_system: 'EMS'                               │
│  ├─ raw_data: {                                         │
│  │    "site_code": "SITE-DC01",                        │
│  │    "energy_type": "전력",                            │
│  │    "consumption_kwh": 12450000,                     │
│  │    ...                                              │
│  │  }                                                  │
│  └─ ghg_raw_category: 'energy'                         │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│    GHG Calculation Engine (Scope 1/2/3 계산)           │
│                                                         │
│  1) staging_ems_data → ghg_activity_data 변환           │
│  2) 배출계수 매핑                                        │
│  3) TJ 변환 및 배출량 산정                               │
│  4) ghg_emission_results 저장                           │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│           IFRS Agent (SR 보고서 생성)                    │
│                                                         │
│  Phase 1: DP-RAG → 데이터포인트 조회                    │
│  Phase 2: Aggregation → ghg_emission_results 집계       │
│  Phase 3: Gen Node → SR 문단 생성                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🏢 계열사/자회사 데이터 구분 (현재 미구현)

### 문제점

**현재**: 모든 데이터가 `company_id = 삼성SDS(지주사)` 하나로 통합
**필요**: 각 계열사/자회사별로 데이터를 분리하여 관리

### 예시: 삼성 그룹 구조

```
삼성SDS (지주사, company_id: A)
├── 삼성전자 (계열사, company_id: B)
│   ├── Scope 1: 공장 직접 배출
│   ├── Scope 2: 공장 전력 사용
│   └── Scope 3: 제품 운송, 협력사
├── 삼성물산 (계열사, company_id: C)
│   └── ...
└── 삼성생명 (계열사, company_id: D)
    └── ...
```

### SDS_ESG_DATA 파일에서 계열사 구분 정보

#### 1. `MDG_SITE_MASTER.csv` (사업장 마스터)

```csv
site_code,site_name,site_type,company_id,pue_target,it_capacity_kw
SITE-DC01,수원 데이터센터,DC,550e8400-...,1.18,20000
SITE-DC02,동탄 데이터센터,DC,550e8400-...,1.15,18000
SITE-OF01,잠실 본사,오피스,550e8400-...,—,—
```

**현재 문제**: `company_id`가 전부 삼성SDS로 동일

**해결 방안**: 각 사업장을 계열사별로 분류
```csv
site_code,site_name,company_id,company_name
SITE-DC01,수원 데이터센터,A,삼성SDS
SITE-DC02,동탄 데이터센터,A,삼성SDS
SITE-SE01,기흥 반도체공장,B,삼성전자
SITE-SE02,화성 반도체공장,B,삼성전자
SITE-SM01,여수 석유화학공장,C,삼성물산
```

#### 2. `EMS_ENERGY_USAGE.csv` (에너지 사용량)

```csv
site_code,year,month,energy_type,consumption_kwh
SITE-DC01,2024,1,전력,12450000
SITE-DC02,2024,1,전력,8950000
SITE-SE01,2024,1,전력,45000000  ← 삼성전자 공장
```

**현재**: `site_code`만 있음 → 조인으로 `company_id` 파악
**필요**: 각 행이 어느 계열사 데이터인지 명시

---

## 🚀 구현해야 할 기능 (To-Do)

### Phase 1: 데이터 모델 확장

#### 1.1 회사 마스터 테이블 확장

```sql
-- 기존 companies 테이블 확장
ALTER TABLE companies ADD COLUMN company_type VARCHAR(20);
-- 'holding' (지주사), 'subsidiary' (계열사), 'affiliate' (자회사)

ALTER TABLE companies ADD COLUMN parent_company_id UUID;
-- 계열사의 경우 지주사 ID 참조

-- 예시 데이터
INSERT INTO companies VALUES
('A', '삼성SDS', 'holding', NULL),        -- 지주사
('B', '삼성전자', 'subsidiary', 'A'),      -- 계열사
('C', '삼성물산', 'subsidiary', 'A'),
('D', '삼성전자서비스', 'affiliate', 'B'); -- 자회사 (삼성전자 산하)
```

#### 1.2 사업장 마스터에 회사 ID 추가

```sql
-- MDG_SITE_MASTER.csv → staging_mdg_data 적재 시
-- raw_data에 company_id 명시
{
  "site_code": "SITE-SE01",
  "site_name": "기흥 반도체공장",
  "company_id": "B",  -- 삼성전자
  "company_name": "삼성전자"
}
```

#### 1.3 스테이징 데이터에 원소속 회사 ID 저장

```sql
-- 현재: company_id는 데이터를 업로드한 회사 (지주사 통합)
-- 변경: source_company_id 추가 (실제 데이터 발생 계열사)

ALTER TABLE staging_ems_data ADD COLUMN source_company_id UUID;

-- 예시:
-- company_id: A (삼성SDS, 업로드한 주체)
-- source_company_id: B (삼성전자, 실제 데이터 발생 주체)
```

---

### Phase 2: 계열사 데이터 입력 UI

#### 2.1 계열사 로그인 및 권한

```typescript
// frontend/src/app/(main)/ghg_calc/lib/ghgSession.ts
export type GhgSession = {
  userDisplayName: string;
  corpDisplayName: string;
  companyId: string;
  companyType: 'holding' | 'subsidiary' | 'affiliate';  // 추가
  parentCompanyId?: string;  // 계열사의 경우 지주사 ID
  userRole: 'admin' | 'manager' | 'viewer';
};
```

#### 2.2 계열사별 데이터 입력 화면

**현재 화면**: `/ghg_calc` → 지주사 통합 데이터만 표시

**변경 후**:
```typescript
// 계열사 로그인 시
if (session.companyType === 'subsidiary') {
  // 자기 회사 데이터만 입력/수정 가능
  // 지주사로 "제출" 버튼 표시
} else if (session.companyType === 'holding') {
  // 모든 계열사 데이터 조회 가능
  // 계열사별 집계/승인 기능
}
```

#### 2.3 Raw Data 업로드 화면 수정

```tsx
// frontend/src/app/(main)/ghg_calc/components/raw-data/RawDataUpload.tsx

<form onSubmit={handleUpload}>
  {/* 기존 */}
  <input type="file" accept=".csv" />
  
  {/* 추가: 계열사 선택 (지주사 로그인 시에만) */}
  {session.companyType === 'holding' && (
    <select name="sourceCompanyId">
      <option value="B">삼성전자</option>
      <option value="C">삼성물산</option>
      <option value="D">삼성생명</option>
    </select>
  )}
  
  {/* 계열사 로그인 시 자동 설정 */}
  {session.companyType === 'subsidiary' && (
    <input type="hidden" name="sourceCompanyId" value={session.companyId} />
  )}
</form>
```

---

### Phase 3: 계열사 → 지주사 전송 워크플로우

#### 3.1 데이터 제출 상태 관리

```sql
-- 새 테이블: 계열사 데이터 제출 이력
CREATE TABLE subsidiary_data_submissions (
    id UUID PRIMARY KEY,
    subsidiary_company_id UUID NOT NULL,  -- 계열사 ID
    holding_company_id UUID NOT NULL,      -- 지주사 ID
    submission_year INT NOT NULL,
    submission_quarter INT,
    submission_date TIMESTAMPTZ DEFAULT NOW(),
    
    -- 제출 데이터 범위
    scope_1_submitted BOOLEAN DEFAULT FALSE,
    scope_2_submitted BOOLEAN DEFAULT FALSE,
    scope_3_submitted BOOLEAN DEFAULT FALSE,
    
    -- 승인 상태
    status VARCHAR(20) DEFAULT 'draft',
    -- 'draft' (작성중)
    -- 'submitted' (제출완료)
    -- 'approved' (승인)
    -- 'rejected' (반려)
    
    reviewed_by UUID,  -- 검토자 (지주사 담당자)
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- 메타데이터
    staging_row_count INT,
    total_emission_tco2e NUMERIC(15,4)
);
```

#### 3.2 제출 API

```http
POST /data-integration/subsidiary/submit
{
  "subsidiary_company_id": "B",  // 삼성전자
  "holding_company_id": "A",     // 삼성SDS
  "year": 2024,
  "quarter": 1,
  "scope_1": true,
  "scope_2": true,
  "scope_3": false  // Scope 3는 아직 작성 중
}
```

**Backend 로직**:
```python
# backend/api/v1/data_integration/subsidiary_router.py

@router.post("/subsidiary/submit")
async def submit_subsidiary_data(req: SubmitRequest):
    # 1) staging_*_data에서 해당 계열사 데이터 조회
    rows = await db.fetchall(
        """
        SELECT * FROM staging_ems_data
        WHERE source_company_id = $1
          AND EXTRACT(YEAR FROM ingest_timestamp) = $2
        """,
        req.subsidiary_company_id,
        req.year,
    )
    
    # 2) GHG 계산 실행 (임시)
    result = ghg_engine.calculate(rows)
    
    # 3) 제출 이력 생성
    submission = await db.fetchrow(
        """
        INSERT INTO subsidiary_data_submissions
        (subsidiary_company_id, holding_company_id, year, quarter, 
         scope_1_submitted, scope_2_submitted, scope_3_submitted,
         status, staging_row_count, total_emission_tco2e)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'submitted', $8, $9)
        RETURNING id
        """,
        req.subsidiary_company_id, req.holding_company_id,
        req.year, req.quarter,
        req.scope_1, req.scope_2, req.scope_3,
        len(rows), result['total_emission']
    )
    
    return {"submission_id": submission['id'], "status": "submitted"}
```

#### 3.3 지주사 승인 UI

```tsx
// frontend/src/app/(main)/ghg_calc/components/holding/SubsidiaryApprovalPanel.tsx

function SubsidiaryApprovalPanel() {
  const [submissions, setSubmissions] = useState([]);
  
  useEffect(() => {
    fetch('/data-integration/subsidiary/list')
      .then(res => res.json())
      .then(setSubmissions);
  }, []);
  
  return (
    <div>
      <h2>계열사 데이터 제출 현황</h2>
      <table>
        <thead>
          <tr>
            <th>계열사</th>
            <th>연도/분기</th>
            <th>Scope 1</th>
            <th>Scope 2</th>
            <th>Scope 3</th>
            <th>총 배출량</th>
            <th>상태</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map(sub => (
            <tr key={sub.id}>
              <td>{sub.subsidiary_company_name}</td>
              <td>{sub.year}년 Q{sub.quarter}</td>
              <td>{sub.scope_1_submitted ? '✅' : '❌'}</td>
              <td>{sub.scope_2_submitted ? '✅' : '❌'}</td>
              <td>{sub.scope_3_submitted ? '✅' : '❌'}</td>
              <td>{sub.total_emission_tco2e.toLocaleString()} tCO₂e</td>
              <td>
                <StatusBadge status={sub.status} />
              </td>
              <td>
                {sub.status === 'submitted' && (
                  <>
                    <Button onClick={() => approve(sub.id)}>승인</Button>
                    <Button onClick={() => reject(sub.id)}>반려</Button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

### Phase 4: 데이터 집계 및 SR 보고서 생성

#### 4.1 계열사 데이터 집계

```python
# backend/domain/v1/ifrs_agent/spokes/agents/aggregation_node/agent.py

async def collect_subsidiary_data(
    company_id: str,  # 지주사 ID
    category: str,    # 'ghg_emissions'
    year: int,
    scope: str,       # 'scope1', 'scope2', 'scope3'
) -> Dict[str, Any]:
    """계열사 승인된 데이터만 집계"""
    
    # 1) 승인된 제출 이력 조회
    submissions = await db.fetch(
        """
        SELECT s.*, c.company_name
        FROM subsidiary_data_submissions s
        JOIN companies c ON s.subsidiary_company_id = c.id
        WHERE s.holding_company_id = $1
          AND s.year = $2
          AND s.status = 'approved'
        """,
        company_id, year
    )
    
    # 2) 각 계열사별 배출량 합산
    result = []
    for sub in submissions:
        emissions = await db.fetchrow(
            """
            SELECT SUM(total_emission) as total
            FROM ghg_emission_results
            WHERE company_id = $1
              AND year = $2
              AND scope = $3
            """,
            sub['subsidiary_company_id'],
            year,
            scope
        )
        result.append({
            "company_id": sub['subsidiary_company_id'],
            "company_name": sub['company_name'],
            "emission_tco2e": emissions['total'],
            "submission_date": sub['submission_date'],
        })
    
    return {
        "subsidiary_data": result,
        "total_emission": sum(r['emission_tco2e'] for r in result),
    }
```

#### 4.2 SR 보고서 생성 시 계열사 데이터 포함

```python
# IFRS Agent Orchestrator Phase 2

if dp_id == 'GRI_305-1':  # Scope 1 직접 배출
    # 지주사 데이터
    holding_data = await query_ghg_emission_results(company_id, year, 'scope1')
    
    # 계열사 데이터 집계
    subsidiary_data = await aggregation_node.collect_subsidiary_data(
        company_id, 'ghg_emissions', year, 'scope1'
    )
    
    # Gen Node 입력 데이터
    context = {
        "holding_emission": holding_data['total'],
        "subsidiaries": subsidiary_data['subsidiary_data'],
        "total_group_emission": holding_data['total'] + subsidiary_data['total_emission'],
    }
    
    # SR 문단 생성
    paragraph = await gen_node.generate(
        dp_id='GRI_305-1',
        context=context,
        template="""
        당사 그룹의 2024년 Scope 1 직접 온실가스 배출량은 총 {total_group_emission:,.0f} tCO₂e입니다.
        
        이 중 지주사(삼성SDS)는 {holding_emission:,.0f} tCO₂e를 배출했으며,
        주요 계열사별 배출량은 다음과 같습니다:
        
        {% for sub in subsidiaries %}
        - {sub.company_name}: {sub.emission_tco2e:,.0f} tCO₂e
        {% endfor %}
        """
    )
```

---

## 📊 전송 데이터 스키마

### 계열사 → 지주사 전송 데이터

#### 1. Scope 1 직접 배출

```json
{
  "submission_id": "uuid",
  "subsidiary_company_id": "B",
  "subsidiary_company_name": "삼성전자",
  "year": 2024,
  "quarter": 1,
  "scope": "scope1",
  "data": {
    "total_emission_tco2e": 45230.5,
    "by_source": [
      {
        "source": "LNG 보일러",
        "site_code": "SITE-SE01",
        "site_name": "기흥공장",
        "fuel_type": "LNG",
        "consumption_amount": 1250000,
        "consumption_unit": "Nm³",
        "emission_factor": 0.0563,
        "emission_tco2e": 7037.5
      },
      {
        "source": "경유 비상발전기",
        "site_code": "SITE-SE01",
        "fuel_type": "경유",
        "consumption_amount": 50000,
        "consumption_unit": "L",
        "emission_factor": 2.64,
        "emission_tco2e": 132.0
      }
    ],
    "by_site": [
      {"site_code": "SITE-SE01", "site_name": "기흥공장", "emission_tco2e": 35200.0},
      {"site_code": "SITE-SE02", "site_name": "화성공장", "emission_tco2e": 10030.5}
    ]
  },
  "attachments": [
    {
      "type": "spreadsheet",
      "filename": "삼성전자_2024Q1_Scope1.xlsx",
      "url": "s3://bucket/submissions/..."
    },
    {
      "type": "verification_report",
      "filename": "제3자검증보고서.pdf",
      "url": "s3://bucket/submissions/..."
    }
  ],
  "submission_date": "2024-04-15T09:30:00Z",
  "submitter_name": "홍길동",
  "submitter_email": "hong@samsung.com"
}
```

#### 2. Scope 2 간접 배출 (전력)

```json
{
  "scope": "scope2",
  "data": {
    "total_emission_tco2e": 125400.0,
    "market_based_tco2e": 120300.0,
    "location_based_tco2e": 125400.0,
    "by_site": [
      {
        "site_code": "SITE-SE01",
        "electricity_kwh": 450000000,
        "electricity_supplier": "한국전력",
        "emission_factor_market": 0.4157,
        "emission_factor_location": 0.4385,
        "emission_market_tco2e": 187065.0,
        "emission_location_tco2e": 197325.0,
        "renewable_kwh": 50000000,
        "renewable_cert_type": "REC"
      }
    ]
  }
}
```

#### 3. Scope 3 기타 간접 배출

```json
{
  "scope": "scope3",
  "data": {
    "total_emission_tco2e": 1250000.0,
    "by_category": [
      {
        "category": "Cat.1 구매상품·서비스",
        "emission_tco2e": 450000.0,
        "calculation_method": "supplier_specific",
        "data_quality": "high",
        "top_items": [
          {"item": "반도체 웨이퍼", "emission_tco2e": 120000.0},
          {"item": "화학약품", "emission_tco2e": 80000.0}
        ]
      },
      {
        "category": "Cat.4 업스트림 운송·유통",
        "emission_tco2e": 350000.0,
        "calculation_method": "distance_based",
        "data_quality": "medium"
      },
      {
        "category": "Cat.6 출장",
        "emission_tco2e": 15000.0,
        "calculation_method": "spend_based",
        "data_quality": "low"
      }
    ]
  }
}
```

---

## 🚦 구현 우선순위

### 1단계: 데이터 모델 확장 (1주)
- [ ] `companies` 테이블에 `company_type`, `parent_company_id` 추가
- [ ] `staging_*_data` 테이블에 `source_company_id` 추가
- [ ] `subsidiary_data_submissions` 테이블 생성
- [ ] Alembic 마이그레이션 스크립트 작성

### 2단계: Backend API (2주)
- [ ] `/subsidiary/submit` API 구현
- [ ] `/subsidiary/list` API (지주사용)
- [ ] `/subsidiary/approve`, `/subsidiary/reject` API
- [ ] Aggregation Node에 계열사 데이터 집계 로직 추가

### 3단계: Frontend UI (2주)
- [ ] 로그인 시 `companyType` 구분
- [ ] 계열사 전용 Raw Data 업로드 화면
- [ ] 지주사 전용 계열사 승인 화면
- [ ] Holding SR Editor에 계열사 데이터 표시

### 4단계: SR 보고서 통합 (1주)
- [ ] IFRS Agent에서 계열사 데이터 조회
- [ ] Gen Node 템플릿에 계열사별 집계 포함
- [ ] 보고서 출력 시 계열사 명단 자동 생성

---

## 💡 기술적 고려사항

### 1. 데이터 보안
```python
# 계열사는 자기 데이터만 조회
@router.get("/subsidiary/my-data")
async def get_my_subsidiary_data(user: User = Depends(get_current_user)):
    if user.company_type != 'subsidiary':
        raise HTTPException(403, "계열사만 접근 가능")
    
    return await db.fetch(
        "SELECT * FROM staging_ems_data WHERE source_company_id = $1",
        user.company_id
    )
```

### 2. 대용량 데이터 처리
```python
# 계열사가 많을 경우 비동기 집계
async def aggregate_all_subsidiaries(holding_id: str):
    subsidiaries = await db.fetch(
        "SELECT id FROM companies WHERE parent_company_id = $1",
        holding_id
    )
    
    # 병렬 처리
    tasks = [
        calculate_subsidiary_emission(sub['id'])
        for sub in subsidiaries
    ]
    results = await asyncio.gather(*tasks)
    
    return sum(results)
```

### 3. 실시간 동기화
```typescript
// SSE로 계열사 제출 알림
const eventSource = new EventSource('/subsidiary/notifications');
eventSource.onmessage = (event) => {
  const { subsidiary_name, status } = JSON.parse(event.data);
  toast.success(`${subsidiary_name}가 데이터를 제출했습니다.`);
  refetch(); // 목록 새로고침
};
```

---

## 📝 요약

### 현재 상태
- ✅ **SDS_ESG_DATA**: 삼성SDS 지주사 통합 더미 데이터 (50개 CSV)
- ✅ **스테이징 파이프라인**: CSV → PostgreSQL 자동 적재
- ✅ **GHG 계산**: Scope 1/2/3 배출량 산정 로직
- ✅ **IFRS Agent**: SR 보고서 자동 생성 (지주사 데이터 기반)

### 구현 필요
- ❌ **계열사 데이터 분리**: `source_company_id` 추가
- ❌ **제출 워크플로우**: 계열사 → 지주사 승인 프로세스
- ❌ **UI 화면**: 계열사 입력 + 지주사 승인 화면
- ❌ **데이터 집계**: Aggregation Node에서 계열사 데이터 합산

### 전송 데이터
```json
{
  "scope1": "LNG, 경유 등 직접 배출 + 사업장별 집계",
  "scope2": "전력 사용 + 재생에너지 인증서",
  "scope3": "14개 카테고리 (구매, 운송, 출장 등)"
}
```

이 구조로 구현하면 각 계열사가 자체 데이터를 입력하고, 지주사가 승인 후 통합 SR 보고서를 생성할 수 있습니다!
