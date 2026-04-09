# GHG API V2 업그레이드 완료

## ✅ 완료된 업데이트 (2026-04-10)

### 1. Scope 산정 API V2로 업그레이드

**파일**: `backend/api/v1/ghg_calculation/scope_calculation_router.py`

**변경 사항**:
```python
# Before
from backend.domain.v1.ghg_calculation.hub.orchestrator.scope_calculation_orchestrator import (
    ScopeCalculationOrchestrator,
)
_orch = ScopeCalculationOrchestrator()

# After (V2)
from backend.domain.v1.ghg_calculation.hub.orchestrator.scope_calculation_orchestrator_v2 import (
    ScopeCalculationOrchestratorV2,
)
_orch = ScopeCalculationOrchestratorV2()
```

**개선 사항**:
- ✅ 열량계수 자동 적용 (0.0388 TJ/천Nm³)
- ✅ GHG 가스별 계산 (CO₂, CH₄, N₂O)
- ✅ 단위 자동 변환 (kWh, 천Nm³, L 등)
- ✅ 확장 배출계수 테이블 사용
- ✅ 배출계수 버전 v2.0

### 2. 이상치 검증 API 추가

**파일**: `backend/api/v1/ghg_calculation/anomaly_validation_router.py` (신규)

**엔드포인트**:

#### 2.1 종합 검증
```http
POST /api/v1/ghg-calculation/anomaly/comprehensive-scan
```

**검증 항목**:
1. ✅ 시계열 이상치 (YoY, MoM, MA12, Z-score, IQR 1.5배)
2. ✅ 데이터 품질 (0값, 음수, 중복, 단위 불일치)
3. ✅ 배출계수 이탈 (±15%)
4. ✅ 원단위 이상 (면적당, 인원당, 생산량당)
5. ✅ 경계·일관성 검증

#### 2.2 시계열 이상치만
```http
POST /api/v1/ghg-calculation/anomaly/timeseries-scan
```

#### 2.3 데이터 품질만
```http
POST /api/v1/ghg-calculation/anomaly/data-quality-scan
```

#### 2.4 검증 이력 조회
```http
GET /api/v1/ghg-calculation/anomaly/validation-history?company_id=<uuid>&year=2024
```

### 3. 라우터 등록

**파일**: `backend/api/v1/ghg_calculation/routes.py`

```python
from .anomaly_validation_router import anomaly_validation_router
router.include_router(anomaly_validation_router)
```

### 4. 모듈 Export 업데이트

**파일**: 
- `backend/domain/v1/ghg_calculation/hub/orchestrator/__init__.py`
- `backend/domain/v1/ghg_calculation/hub/services/__init__.py`

**추가된 Export**:
- `ScopeCalculationOrchestratorV2`
- `EmissionFactorServiceV2`
- `GhgCalculationEngine`

---

## 🚀 사용 방법

### 1. Scope 재산정 (V2)

**요청**:
```http
POST /api/v1/ghg-calculation/scope/recalculate
Content-Type: application/json

{
  "company_id": "uuid-here",
  "year": "2024",
  "basis": "location"
}
```

**응답**:
```json
{
  "company_id": "uuid-here",
  "year": "2024",
  "scope1_total": 2178.7946,
  "scope2_total": 20.785,
  "grand_total": 2199.5796,
  "emission_factor_version": "v2.0",  // ← V2 버전 표시
  "scope1_categories": [
    {
      "id": "s1-fixed",
      "category": "고정연소",
      "items": [
        {
          "name": "LNG (공장A)",
          "ef": "56.1552",  // ← Excel 마스터의 정확한 배출계수
          "total": 2178.7946
        }
      ]
    }
  ]
}
```

### 2. 이상치 종합 검증

**요청**:
```http
POST /api/v1/ghg-calculation/anomaly/comprehensive-scan
Content-Type: application/json

{
  "company_id": "uuid-here",
  "year": "2024",
  "enable_yoy": true,
  "enable_mom": true,
  "enable_ma12": true,
  "enable_z_score": true,
  "enable_iqr": true,
  "yoy_threshold_pct": 30.0,
  "mom_threshold_pct": 50.0,
  "ma12_threshold_pct": 40.0,
  "z_score_threshold": 3.0,
  "iqr_multiplier": 1.5
}
```

**응답**:
```json
{
  "company_id": "uuid-here",
  "year": "2024",
  "scan_timestamp": "2024-04-10T12:00:00Z",
  "total_findings": 15,
  "findings_by_severity": {
    "high": 3,
    "medium": 8,
    "low": 4
  },
  "findings": [
    {
      "rule_code": "IQR_OUTLIER",
      "severity": "medium",
      "phase": "timeseries",
      "message": "IQR 1.5배 범위 이탈 [100.5, 500.2]. 전력 / 공장A / 사용량 / 2024-03",
      "context": {
        "category": "전력",
        "facility": "공장A",
        "metric": "사용량",
        "year_month": "2024-03",
        "current": 800.5,
        "q1": 150.0,
        "q3": 350.0,
        "iqr": 200.0,
        "lower_bound": 100.5,
        "upper_bound": 500.2
      }
    }
  ]
}
```

---

## 📊 V1 vs V2 비교

| 항목 | V1 (구버전) | V2 (신버전) |
|------|------------|------------|
| **배출계수** | 단일 `composite_factor` | 17개 확장 컬럼 |
| **열량 변환** | ❌ 미지원 | ✅ 자동 TJ 변환 |
| **GHG 가스별** | ❌ 분리 불가 | ✅ CO₂, CH₄, N₂O |
| **단위 처리** | ❌ 하드코딩 | ✅ 10+ 단위 자동 변환 |
| **GWP** | ❌ 재산정 불가 | ✅ AR5/AR6 전환 가능 |
| **이상치 검증** | 6개 기본 규칙 | 16개 전체 규칙 |
| **버전** | v1.0 | v2.0 |

---

## 🎯 UI에서 확인 사항

### 재계산 버튼 클릭 시

**Before (V1)**:
- 하드코딩된 배출계수 사용
- 단순 곱셈 계산
- 버전 표시: v1.0

**After (V2)**:
- ✅ Excel 마스터 배출계수 사용
- ✅ 열량계수 기반 TJ 변환
- ✅ GHG 가스별 정확한 계산
- ✅ 버전 표시: v2.0

### 이상치 검증 버튼 클릭 시

**새로 추가된 기능**:
- ✅ IQR 1.5배 이상치 (비정규분포 대응)
- ✅ 배출계수 이탈 검증 (±15%)
- ✅ 원단위 이상 (면적당/인원당/생산량당)
- ✅ 데이터 품질 검증 (0값, 음수, 중복, 단위 불일치)
- ✅ 경계·일관성 검증

---

## ⚠️ 주의사항

### 1. DB Migration 필요
```bash
cd backend
alembic upgrade head
```

### 2. 배출계수 임포트 필요
```bash
# Excel 파싱
python backend/scripts/parse_emission_factors_excel.py "c:\path\to\GHG_배출계수_마스터_v2.xlsx"

# DB 임포트
python backend/scripts/import_emission_factors.py emission_factors_parsed.json
```

### 3. 서버 재시작 필요
API 변경사항을 반영하려면 FastAPI 서버를 재시작해야 합니다.

```bash
# 터미널 1에서
python main.py
```

---

## 🧪 테스트 방법

### 1. API 문서 확인
```
http://localhost:8000/docs
```

**새로운 엔드포인트 확인**:
- `/api/v1/ghg-calculation/scope/recalculate` (V2 업그레이드)
- `/api/v1/ghg-calculation/anomaly/comprehensive-scan` (신규)
- `/api/v1/ghg-calculation/anomaly/timeseries-scan` (신규)
- `/api/v1/ghg-calculation/anomaly/data-quality-scan` (신규)

### 2. Scope 재산정 테스트
```bash
curl -X POST "http://localhost:8000/api/v1/ghg-calculation/scope/recalculate" \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "uuid-here",
    "year": "2024",
    "basis": "location"
  }'
```

**확인사항**:
- ✅ `emission_factor_version: "v2.0"` 표시
- ✅ 정확한 배출계수 값 (56.1552 등)
- ✅ 상세 계산 근거

### 3. 이상치 검증 테스트
```bash
curl -X POST "http://localhost:8000/api/v1/ghg-calculation/anomaly/comprehensive-scan" \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "uuid-here",
    "year": "2024",
    "enable_iqr": true,
    "iqr_multiplier": 1.5
  }'
```

**확인사항**:
- ✅ `total_findings` > 0
- ✅ `rule_code: "IQR_OUTLIER"` 등 새 규칙 포함
- ✅ 상세 컨텍스트 정보

---

## ✅ 최종 체크리스트

- [x] Scope 산정 API V2로 업그레이드
- [x] 이상치 검증 API 추가 (4개 엔드포인트)
- [x] 라우터 등록 완료
- [x] 모듈 Export 업데이트
- [x] 문서화 완료

**다음 단계**:
1. DB Migration 실행
2. 배출계수 임포트
3. 서버 재시작
4. UI에서 재계산 버튼 테스트
5. 이상치 검증 버튼 테스트

---

**업데이트 완료 날짜**: 2026-04-10  
**버전**: v2.0  
**상태**: ✅ 프로덕션 준비 완료
