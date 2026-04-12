# 실무 계열사 → 지주사 ESG 데이터 보고 체계

## 📊 실무에서의 데이터 전달 구조

### 1. 계열사가 지주사에게 전달하는 데이터

```
┌─────────────────────────────────────────────────────────────┐
│           계열사 (삼성전자, 삼성물산 등)                      │
│                                                             │
│  ✅ 반드시 전달: Scope 1, 2 (직접 통제 가능한 배출)         │
│  ⚠️ 선택적 전달: Scope 3 일부 (데이터 품질 따라)           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    지주사 (삼성SDS)                          │
│                                                             │
│  • 계열사 데이터 취합 + 검증                                 │
│  • 지주사 자체 운영 데이터 추가                              │
│  • 통합 SR 보고서 작성                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Scope별 전달 기준 (실무)

### ✅ **Scope 1 (직접 배출) - 100% 전달**

**계열사 책임**: 자기 공장/사무실에서 발생한 직접 배출

```json
{
  "scope": "scope1",
  "subsidiary_company": "삼성전자",
  "data": [
    {
      "site_code": "SITE-SE01",
      "site_name": "기흥 반도체공장",
      "source": "LNG 보일러",
      "fuel_type": "LNG",
      "consumption": 5200000,
      "consumption_unit": "Nm³",
      "emission_tco2e": 29276,
      "verification_status": "제3자 검증 완료",
      "verifier": "한국품질재단"
    },
    {
      "site_code": "SITE-SE01",
      "source": "냉매 누출 (R-410A)",
      "refrigerant_type": "R-410A",
      "leak_amount_kg": 850,
      "gwp": 2088,
      "emission_tco2e": 1774.8
    },
    {
      "site_code": "SITE-SE01",
      "source": "비상발전기 (경유)",
      "fuel_type": "경유",
      "consumption": 12000,
      "consumption_unit": "L",
      "emission_tco2e": 31.68
    }
  ],
  "total_scope1_tco2e": 31082.48,
  "reporting_period": "2024-Q1",
  "submission_date": "2024-04-20"
}
```

**지주사 요구사항**:
- ✅ 사업장별 상세 데이터 (site_code 필수)
- ✅ 연료별 사용량 + 배출계수
- ✅ 제3자 검증 여부 (연간 보고 시 필수)

---

### ✅ **Scope 2 (간접 배출 - 전력) - 100% 전달**

**계열사 책임**: 구매 전력, 스팀 사용

```json
{
  "scope": "scope2",
  "subsidiary_company": "삼성전자",
  "data": [
    {
      "site_code": "SITE-SE01",
      "site_name": "기흥 반도체공장",
      "electricity_kwh": 850000000,
      "electricity_supplier": "한국전력",
      
      "location_based": {
        "emission_factor": 0.4385,
        "emission_tco2e": 372725
      },
      
      "market_based": {
        "emission_factor": 0.4157,
        "emission_tco2e": 353345,
        "renewable_kwh": 120000000,
        "renewable_cert_type": "REC",
        "rec_count": 120000
      },
      
      "steam_purchased_gj": 45000,
      "steam_emission_tco2e": 2250
    }
  ],
  "total_scope2_market_based_tco2e": 355595,
  "total_scope2_location_based_tco2e": 374975,
  "renewable_energy_ratio": 14.1,
  "reporting_period": "2024-Q1"
}
```

**지주사 요구사항**:
- ✅ Location-based (지역 기반) 필수
- ✅ Market-based (시장 기반) 필수
- ✅ 재생에너지 인증서 (REC/I-REC) 증빙

---

### ⚠️ **Scope 3 (기타 간접 배출) - 선택적 전달**

**실무 현실**: Scope 3는 15개 카테고리 중 **4~6개만** 계열사가 보고

#### 🟢 **반드시 전달 (High Priority)**

##### Cat.1 구매 상품 및 서비스
```json
{
  "category": "Cat.1 구매상품·서비스",
  "data": [
    {
      "item_category": "반도체 웨이퍼",
      "purchase_amount_krw": 1500000000000,
      "emission_factor_type": "supplier_specific",
      "supplier_name": "SK하이닉스",
      "supplier_emission_tco2e": 850000,
      "data_quality": "high"
    },
    {
      "item_category": "포장재",
      "purchase_amount_krw": 50000000000,
      "emission_factor_type": "spend_based",
      "emission_intensity": 0.45,
      "emission_tco2e": 22500,
      "data_quality": "medium"
    }
  ]
}
```

**이유**: 제조업 계열사는 원자재 구매가 Scope 3의 50% 이상

##### Cat.4 업스트림 운송·유통
```json
{
  "category": "Cat.4 운송·유통",
  "data": [
    {
      "transport_mode": "해상운송",
      "route": "인천항 → LA항",
      "distance_km": 9500,
      "cargo_weight_ton": 12500,
      "ton_km": 118750000,
      "emission_factor": 0.015,
      "emission_tco2e": 1781.25
    },
    {
      "transport_mode": "육상운송 (트럭)",
      "distance_km": 15000000,
      "emission_tco2e": 4500
    }
  ]
}
```

##### Cat.11 판매 제품 사용
```json
{
  "category": "Cat.11 판매제품 사용",
  "product": "Galaxy S24",
  "units_sold": 25000000,
  "lifetime_years": 3,
  "avg_power_consumption_kwh_year": 15,
  "electricity_emission_factor": 0.475,
  "total_emission_tco2e": 534375
}
```

#### 🟡 **선택적 전달 (Medium Priority)**

- Cat.5 폐기물 처리
- Cat.6 출장
- Cat.7 통근

#### 🔴 **지주사가 직접 산정 (Low Priority)**

- Cat.2 자본재 (지주사가 그룹 전체 투자 데이터로 산정)
- Cat.3 연료 및 에너지 관련 활동 (Scope 1/2 기반 자동 계산)
- Cat.8~15 (다운스트림) - 대부분 추정값

---

## 🏢 실무 시스템 구조

### 1. **계층적 보고 체계**

```
┌────────────────────────────────────────────────────┐
│  Level 1: 사업장 (Plant/Site)                      │
│  - 각 공장/DC/오피스가 원시 데이터 입력            │
│  - EMS, ERP 시스템에서 자동 수집                   │
└────────────────────────────────────────────────────┘
                    ↓ 월별/분기별
┌────────────────────────────────────────────────────┐
│  Level 2: 계열사 (Subsidiary Company)              │
│  - 사업장 데이터 취합                              │
│  - 계열사 ESG팀이 검증                             │
│  - Scope 1/2 제3자 검증 (연 1회)                   │
└────────────────────────────────────────────────────┘
                    ↓ 분기별
┌────────────────────────────────────────────────────┐
│  Level 3: 지주사 (Holding Company)                 │
│  - 계열사 데이터 승인                              │
│  - 그룹 전체 집계                                  │
│  - 통합 SR 보고서 작성                             │
│  - CDP, TCFD, GRI 등 외부 공시                     │
└────────────────────────────────────────────────────┘
```

---

### 2. **실제 시스템 예시 (SK 그룹)**

#### A. 계열사 → 지주사 전송 시스템

**SK하이닉스** (계열사) → **SK Inc.** (지주사)

```python
# 계열사 ESG 담당자가 분기별 제출
{
  "company_id": "SK하이닉스",
  "reporting_period": "2024-Q1",
  "submission_type": "regular",  # regular, revised, audit
  
  "scope1": {
    "total_tco2e": 185000,
    "by_facility": [...],
    "verification_status": "internal_verified",
    "data_completeness": 100.0
  },
  
  "scope2": {
    "market_based_tco2e": 420000,
    "location_based_tco2e": 450000,
    "renewable_ratio": 15.5,
    "verification_status": "internal_verified"
  },
  
  "scope3": {
    "cat1_tco2e": 1200000,  # 반도체 재료 구매
    "cat4_tco2e": 85000,    # 운송
    "cat11_tco2e": 450000,  # 제품 사용
    "data_completeness": 60.0,  # Cat.1,4,11만 보고
    "note": "Cat.2,3,5,6,7,8-15는 지주사에서 추정 요청"
  },
  
  "attachments": [
    {"type": "verification_statement", "url": "..."},
    {"type": "detailed_spreadsheet", "url": "..."}
  ],
  
  "contact": {
    "name": "김철수",
    "department": "ESG팀",
    "email": "cs.kim@skhynix.com"
  }
}
```

#### B. 지주사 통합 시스템

**SK Inc.** (지주사) 통합 대시보드

```
╔═══════════════════════════════════════════════════════════╗
║       SK 그룹 통합 GHG 배출량 (2024 Q1)                   ║
╠═══════════════════════════════════════════════════════════╣
║  계열사         │ Scope 1  │ Scope 2  │ Scope 3  │ 합계  ║
║─────────────────┼──────────┼──────────┼──────────┼───────║
║ SK하이닉스      │ 185,000  │ 420,000  │ 1,735,000│2,340K ║
║ SK텔레콤        │  45,000  │ 320,000  │   890,000│1,255K ║
║ SK이노베이션    │ 850,000  │ 125,000  │ 2,100,000│3,075K ║
║ SK네트웍스      │  12,000  │  85,000  │   450,000│  547K ║
║ 지주사 자체     │   8,500  │  45,000  │    85,000│  138K ║
║─────────────────┼──────────┼──────────┼──────────┼───────║
║ 그룹 합계       │1,100,500 │ 995,000  │ 5,260,000│7,355K ║
╚═══════════════════════════════════════════════════════════╝

상태:
  ✅ SK하이닉스: 제출완료, 검증대기
  ✅ SK텔레콤: 승인완료
  ⏳ SK이노베이션: 제출완료, 검토중
  ❌ SK네트웍스: 미제출 (마감: 4/30)
```

---

### 3. **데이터 전송 주기**

| 항목 | 주기 | 제출 마감일 | 비고 |
|-----|-----|-----------|-----|
| **원시 데이터 (Raw Data)** | 월별 | 익월 10일 | 사업장 → 계열사 |
| **계열사 집계 데이터** | 분기별 | 분기 종료 후 45일 | 계열사 → 지주사 |
| **제3자 검증 데이터** | 연간 | 익년 3월 31일 | Scope 1/2 필수 |
| **SR 보고서 최종본** | 연간 | 익년 6월 30일 | 지주사 통합 작성 |

---

## 📝 팀장님 요구사항 구현 방안

### 1. GHG 더미데이터 - 모든 계열사+데이터센터

#### A. 계열사별 더미 데이터 생성

```
SDS_ESG_DATA/
├── 지주사_삼성SDS/
│   ├── EMS/
│   │   ├── EMS_ENERGY_USAGE.csv
│   │   │   site_code,company_id,energy_type,consumption_kwh
│   │   │   SITE-DC01,SDS,전력,12450000
│   │   │   SITE-DC02,SDS,전력,8950000
│   │   └── GHG_SCOPE12_SUMMARY.csv
│   │       company_id,scope,total_tco2e
│   │       SDS,scope1,184807
│   │       SDS,scope2,179480
│   └── ...
│
├── 계열사_삼성전자/
│   ├── EMS/
│   │   ├── EMS_ENERGY_USAGE.csv
│   │   │   site_code,company_id,energy_type,consumption_kwh
│   │   │   SITE-SE01,SEC,전력,850000000
│   │   │   SITE-SE02,SEC,전력,620000000
│   │   └── GHG_SCOPE12_SUMMARY.csv
│   │       company_id,scope,total_tco2e
│   │       SEC,scope1,425000
│   │       SEC,scope2,1250000
│   └── ...
│
├── 계열사_삼성물산/
│   └── ...
│
└── 계열사_삼성생명/
    └── ...
```

#### B. 취합 로직

```python
# backend/domain/v1/data_integration/hub/services/group_aggregation_service.py

class GroupAggregationService:
    """지주사가 계열사 데이터를 취합"""
    
    async def aggregate_group_emissions(
        self,
        holding_company_id: str,
        year: int,
        scope: str
    ) -> Dict[str, Any]:
        """
        지주사 + 모든 계열사 배출량 집계
        """
        # 1) 지주사 자체 배출량
        holding = await self.get_company_emissions(holding_company_id, year, scope)
        
        # 2) 계열사 목록 조회
        subsidiaries = await db.fetch(
            """
            SELECT id, company_name 
            FROM companies 
            WHERE parent_company_id = $1
              AND company_type = 'subsidiary'
            """,
            holding_company_id
        )
        
        # 3) 각 계열사 배출량 조회 (승인된 것만)
        sub_emissions = []
        for sub in subsidiaries:
            emission = await db.fetchrow(
                """
                SELECT 
                    c.company_name,
                    SUM(e.total_emission) as total_tco2e,
                    COUNT(DISTINCT e.site_code) as site_count
                FROM ghg_emission_results e
                JOIN companies c ON e.company_id = c.id
                WHERE e.company_id = $1
                  AND e.year = $2
                  AND e.scope = $3
                  AND EXISTS (
                    SELECT 1 FROM subsidiary_data_submissions s
                    WHERE s.subsidiary_company_id = e.company_id
                      AND s.year = $2
                      AND s.status = 'approved'
                  )
                GROUP BY c.company_name
                """,
                sub['id'], year, scope
            )
            if emission:
                sub_emissions.append(emission)
        
        # 4) 그룹 전체 합계
        total = holding['total_tco2e'] + sum(s['total_tco2e'] for s in sub_emissions)
        
        return {
            "holding_company": {
                "company_name": "삼성SDS",
                "emission_tco2e": holding['total_tco2e'],
                "site_count": holding['site_count']
            },
            "subsidiaries": [
                {
                    "company_name": s['company_name'],
                    "emission_tco2e": s['total_tco2e'],
                    "site_count": s['site_count'],
                    "ratio_pct": round(s['total_tco2e'] / total * 100, 1)
                }
                for s in sub_emissions
            ],
            "group_total": total,
            "scope": scope,
            "year": year
        }
```

---

### 2. SR 더미데이터 - 법인별 내용

#### A. 계열사별 SR 데이터

```json
// 삼성전자 제출 데이터
{
  "company_id": "SEC",
  "company_name": "삼성전자",
  "year": 2024,
  
  "narrative_disclosures": [
    {
      "dp_id": "GRI_305-1",
      "dp_name": "직접 온실가스 배출",
      "content": "당사의 2024년 Scope 1 직접 온실가스 배출량은 425,000 tCO₂e입니다. 주요 배출원은 기흥·화성 반도체 공장의 LNG 보일러(85%)와 공정가스 배출(12%)입니다.",
      "data_points": [
        {"metric": "Scope 1 배출량", "value": 425000, "unit": "tCO₂e"},
        {"metric": "전년 대비 증감", "value": -5.2, "unit": "%"}
      ]
    },
    {
      "dp_id": "GRI_305-5",
      "dp_name": "온실가스 감축",
      "content": "반도체 공정 최적화를 통해 2024년 12,500 tCO₂e를 감축했으며, 태양광 발전 확대로 5,800 tCO₂e의 Scope 2 배출을 회피했습니다.",
      "data_points": [
        {"metric": "공정 최적화 감축량", "value": 12500, "unit": "tCO₂e"},
        {"metric": "재생에너지 전환 감축량", "value": 5800, "unit": "tCO₂e"}
      ]
    }
  ]
}
```

#### B. 지주사 SR 데이터

```json
// 삼성SDS (지주사) SR 데이터
{
  "company_id": "SDS",
  "company_name": "삼성SDS",
  "company_type": "holding",
  "year": 2024,
  
  "narrative_disclosures": [
    {
      "dp_id": "GRI_305-1",
      "content": "**그룹 전체 배출량**\n\n삼성SDS 그룹의 2024년 Scope 1 직접 온실가스 배출량은 총 1,100,500 tCO₂e입니다.\n\n**지주사 자체**: 데이터센터 비상발전기 및 냉매 관리로 8,500 tCO₂e 배출\n\n**주요 계열사별 배출량**:\n- 삼성전자: 425,000 tCO₂e (38.6%)\n- SK이노베이션: 850,000 tCO₂e (77.2%)\n- SK텔레콤: 45,000 tCO₂e (4.1%)",
      
      "data_sources": [
        {
          "source_type": "holding_own",
          "company_name": "삼성SDS",
          "emission_tco2e": 8500,
          "verification": "제3자 검증 완료"
        },
        {
          "source_type": "subsidiary_reported",
          "company_name": "삼성전자",
          "emission_tco2e": 425000,
          "submission_date": "2024-04-20",
          "verification": "계열사 제3자 검증"
        }
      ]
    }
  ]
}
```

---

### 3. SR 작성 프론트 - DP 6개 추가

#### A. 추가할 DP 목록

```typescript
// frontend/src/app/(main)/sr-report/lib/additionalDataPoints.ts

export const SUBSIDIARY_RELATED_DPS = [
  {
    dp_id: "GRI_305-1",
    dp_name_ko: "직접 온실가스 배출 (Scope 1)",
    dp_name_en: "Direct GHG emissions",
    applicable_to: ["holding", "subsidiary"],  // 지주사, 계열사 모두
    data_collection_level: "site"  // 사업장 단위
  },
  {
    dp_id: "GRI_305-2",
    dp_name_ko: "간접 온실가스 배출 (Scope 2)",
    applicable_to: ["holding", "subsidiary"],
    data_collection_level: "site"
  },
  {
    dp_id: "GRI_305-3",
    dp_name_ko: "기타 간접 온실가스 배출 (Scope 3)",
    applicable_to: ["holding", "subsidiary"],
    data_collection_level: "company"  // 회사 단위
  },
  {
    dp_id: "GRI_305-4",
    dp_name_ko: "온실가스 배출 원단위",
    applicable_to: ["holding", "subsidiary"],
    data_collection_level: "company"
  },
  {
    dp_id: "GRI_305-5",
    dp_name_ko: "온실가스 감축량",
    applicable_to: ["holding", "subsidiary"],
    data_collection_level: "site"
  },
  {
    dp_id: "CUSTOM_GROUP_CONSOLIDATION",
    dp_name_ko: "그룹 연결 배출량",
    applicable_to: ["holding"],  // 지주사만
    data_collection_level: "group",
    description: "지주사 + 모든 계열사 배출량 합산"
  }
];
```

#### B. 공시데이터 추가 UI

```tsx
// frontend/src/app/(main)/sr-report/components/DisclosureDataAdd.tsx

export function DisclosureDataAdd() {
  const { session } = useGhgSession();
  const isHolding = session.companyType === 'holding';
  
  return (
    <div>
      <h3>공시 데이터 추가</h3>
      
      {/* 일반 DP */}
      <section>
        <h4>Scope 1/2/3 배출량</h4>
        {SUBSIDIARY_RELATED_DPS
          .filter(dp => dp.applicable_to.includes(session.companyType))
          .map(dp => (
            <div key={dp.dp_id}>
              <label>{dp.dp_name_ko}</label>
              
              {/* 계열사: 자기 데이터만 입력 */}
              {!isHolding && (
                <input 
                  type="number" 
                  placeholder="배출량 (tCO₂e)" 
                />
              )}
              
              {/* 지주사: 자체 + 계열사 선택 */}
              {isHolding && (
                <>
                  <div>
                    <label>지주사 자체 배출량</label>
                    <input type="number" />
                  </div>
                  
                  <SubsidiaryDataSelector 
                    dpId={dp.dp_id}
                    onSelect={(subsidiaries) => {
                      // 선택한 계열사 데이터 포함
                    }}
                  />
                </>
              )}
            </div>
          ))}
      </section>
      
      {/* 지주사 전용 DP */}
      {isHolding && (
        <section>
          <h4>그룹 연결 배출량</h4>
          <div>
            <label>CUSTOM_GROUP_CONSOLIDATION</label>
            <p>지주사 + 계열사 배출량이 자동 합산됩니다.</p>
            <GroupConsolidationPreview />
          </div>
        </section>
      )}
    </div>
  );
}
```

---

### 4. 페이지별 작성 - 데이터 출처 표시

```tsx
// frontend/src/app/(main)/sr-report/components/holding/HoldingPageByPageEditor.tsx

type DataSource = {
  source_type: 'holding_own' | 'subsidiary_reported' | 'calculated';
  company_id: string;
  company_name: string;
  value: number;
  unit: string;
  submission_date?: string;
};

function PageDataSourceBadge({ source }: { source: DataSource }) {
  const bgColor = {
    holding_own: 'bg-blue-100 text-blue-800',
    subsidiary_reported: 'bg-green-100 text-green-800',
    calculated: 'bg-gray-100 text-gray-800',
  }[source.source_type];
  
  const label = {
    holding_own: '지주사 자체',
    subsidiary_reported: '계열사 보고',
    calculated: '계산값',
  }[source.source_type];
  
  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs rounded ${bgColor}`}>
      <Building2 size={12} className="mr-1" />
      {label}: {source.company_name}
      {source.submission_date && (
        <span className="ml-1 opacity-70">
          ({new Date(source.submission_date).toLocaleDateString()})
        </span>
      )}
    </span>
  );
}

function DataPointWithSources({ dpId }: { dpId: string }) {
  const [sources, setSources] = useState<DataSource[]>([]);
  
  useEffect(() => {
    // API 호출: 해당 DP의 데이터 출처 조회
    fetch(`/ifrs-agent/dp/${dpId}/sources`)
      .then(res => res.json())
      .then(setSources);
  }, [dpId]);
  
  return (
    <div className="border rounded p-4">
      <h4 className="font-semibold mb-2">Scope 1 직접 배출</h4>
      
      {/* 총합 */}
      <div className="mb-3">
        <span className="text-2xl font-bold">
          {sources.reduce((sum, s) => sum + s.value, 0).toLocaleString()}
        </span>
        <span className="text-sm ml-2">tCO₂e</span>
      </div>
      
      {/* 출처별 상세 */}
      <div className="space-y-2">
        {sources.map((source, idx) => (
          <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
            <PageDataSourceBadge source={source} />
            <span className="font-medium">
              {source.value.toLocaleString()} {source.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 5. AI 문단 생성 - 데이터 출처 포함

#### A. Gen Node 프롬프트 수정

```python
# backend/domain/v1/ifrs_agent/spokes/agents/gen_node/prompts.py

PROMPT_WITH_DATA_SOURCES = """
당신은 지속가능경영보고서(SR)를 작성하는 전문가입니다.

## 데이터 출처 정보
{data_sources_json}

## 요구사항
1. 그룹 전체 배출량을 먼저 언급
2. 지주사 자체 배출량을 명시
3. 주요 계열사별 배출량을 나열 (비중 10% 이상)
4. 각 수치의 출처(계열사명)을 자연스럽게 포함

## 예시 문장 구조
"당사 그룹의 2024년 Scope 1 직접 온실가스 배출량은 총 1,100,500 tCO₂e입니다. 
이 중 지주사(삼성SDS) 자체는 데이터센터 운영으로 8,500 tCO₂e를 배출했으며, 
주요 계열사별로는 삼성전자가 425,000 tCO₂e(38.6%), SK이노베이션이 850,000 tCO₂e(77.2%)를 배출했습니다."

이제 다음 데이터포인트에 대한 SR 문단을 작성하세요:
DP ID: {dp_id}
DP 이름: {dp_name}
"""
```

#### B. 생성 결과에 출처 메타데이터 포함

```json
{
  "dp_id": "GRI_305-1",
  "generated_paragraph": "당사 그룹의 2024년 Scope 1 직접 온실가스 배출량은 총 1,100,500 tCO₂e입니다...",
  
  "data_sources": [
    {
      "company_id": "SDS",
      "company_name": "삼성SDS",
      "source_type": "holding_own",
      "value": 8500,
      "cited_in_sentence": "지주사(삼성SDS) 자체는 데이터센터 운영으로 8,500 tCO₂e를 배출"
    },
    {
      "company_id": "SEC",
      "company_name": "삼성전자",
      "source_type": "subsidiary_reported",
      "value": 425000,
      "submission_date": "2024-04-20",
      "cited_in_sentence": "삼성전자가 425,000 tCO₂e(38.6%)"
    }
  ],
  
  "citations": [
    "[1] 삼성SDS 2024년 Scope 1 배출량: 내부 EMS 시스템, 제3자 검증 완료",
    "[2] 삼성전자 2024년 Scope 1 배출량: 계열사 제출 데이터 (2024-04-20), 제3자 검증"
  ]
}
```

---

## 📊 최종 구현 체크리스트

### Phase 1: 데이터 구조 (1주)
- [ ] `companies` 테이블: `company_type`, `parent_company_id` 추가
- [ ] 계열사별 더미 데이터 생성 (삼성전자, 삼성물산, 삼성생명 등 5개)
- [ ] 각 계열사 50개 CSV 파일 (EMS/ERP/EHS/HR/PLM/SRM/MDG)
- [ ] `site_master`에 계열사별 사업장 추가

### Phase 2: Backend API (1.5주)
- [ ] `GroupAggregationService`: 지주사+계열사 취합
- [ ] `/subsidiary/submit` API
- [ ] `/subsidiary/approve` API
- [ ] `/ifrs-agent/dp/{dp_id}/sources` API (데이터 출처 조회)

### Phase 3: Frontend - 공시데이터 추가 (1주)
- [ ] 6개 DP 추가 UI
- [ ] 계열사: 자기 데이터만 입력
- [ ] 지주사: 자체 + 계열사 선택 UI
- [ ] `SubsidiaryDataSelector` 컴포넌트

### Phase 4: 페이지별 작성 - 출처 표시 (0.5주)
- [ ] `DataPointWithSources` 컴포넌트
- [ ] `PageDataSourceBadge` 배지
- [ ] 출처별 색상 구분 (지주사/계열사/계산)

### Phase 5: AI 문단 생성 - 출처 포함 (1주)
- [ ] Gen Node 프롬프트에 `data_sources` 주입
- [ ] 생성 결과에 `citations` 포함
- [ ] 문단 하단에 각주 자동 생성

---

## 💡 핵심 답변

### Q: 계열사가 지주사에게 무슨 데이터를 전달?

**A: 실무 기준**
- ✅ **Scope 1**: 100% 필수 (공장 직접 배출)
- ✅ **Scope 2**: 100% 필수 (전력 사용)
- ⚠️ **Scope 3**: 4~6개 카테고리만 (Cat.1,4,11 등)

### Q: 실무에서는 어떻게?

**A: 계층적 보고**
```
사업장 (월별) 
  → 계열사 ESG팀 (분기별) 
    → 지주사 통합 (연간 SR)
```

- 분기별로 계열사가 Excel/시스템 제출
- 지주사 ESG팀이 검토 후 승인
- 연간 보고서 작성 시 통합
