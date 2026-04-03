# 데이터베이스 설정 및 사용 가이드

## 빠른 시작

### 1. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성:

```bash
DATABASE_URL=postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
```

### 2. 의존성 설치

```bash
pip install -r requirement.txt
```

### 3. 마이그레이션 실행

```bash
# ai/ 디렉토리에서 실행
cd ai/

# 환경 변수 설정 (PowerShell)
$env:SERVICE_NAME="ifrs_agent"

# 또는 (Linux/Mac)
export SERVICE_NAME=ifrs_agent

# 최신 마이그레이션 적용
alembic upgrade head

# 마이그레이션 상태 확인
alembic current
alembic history
```

또는 Python 스크립트로 직접 테이블 생성 (개발/테스트용):

```bash
python -m ifrs_agent.database.base
```

## 프로젝트 구조

```
ai/ifrs_agent/
├── database/
│   ├── __init__.py
│   ├── base.py              # 데이터베이스 연결 설정 + 유틸리티
│   └── README.md             # 상세 가이드
├── model/
│   ├── __init__.py
│   └── models.py            # SQLAlchemy 모델 정의
└── ...
```

## 주요 기능

### ✅ 구현된 기능

- ✅ 모든 테이블 스키마 (6개 테이블)
- ✅ ENUM 타입 정의 (5개)
- ✅ Foreign Key 제약조건
- ✅ Soft Delete 지원
- ✅ 인덱스 최적화 (GIN, 부분 인덱스)
- ✅ Soft Delete 트리거
- ✅ 타임스탬프 자동 업데이트

### 테이블 목록

1. **data_points**: Data Point 정의
2. **standard_mappings**: 기준서 간 매핑
3. **dp_financial_linkages**: DP-재무 계정 연결
4. **rulebooks**: 검증 규칙
5. **synonyms_glossary**: 동의어/용어집
6. **dp_decomposition_rules**: DP 분해 규칙

### ENUM 타입

- `dp_type_enum`: quantitative, qualitative, narrative, binary
- `dp_unit_enum`: percentage, count, currency_krw, currency_usd, tco2e, mwh, cubic_meter, text
- `mapping_type_enum`: exact, partial, aggregated, derived
- `impact_direction_enum`: positive, negative, neutral, variable
- `disclosure_requirement_enum`: 필수, 권장, 선택

### 인덱스

다음 인덱스가 자동으로 생성됩니다:

- `idx_dp_standard_category`: 기준서 및 카테고리 조회 최적화
- `idx_dp_parent_indicator`: 계층 구조 조회 최적화
- `idx_dp_validation_rules_gin`: JSONB 검색 최적화
- `idx_term_ko_gin`: 한국어 텍스트 검색 최적화 (pg_trgm 사용)
- 기타 성능 최적화 인덱스

## 사용 예시

### 기본 사용

```python
from database.base import SessionLocal
from model.models import DataPoint, DPTypeEnum

db = SessionLocal()

try:
# DP 생성
dp = DataPoint(
    dp_id="S2-29-a",
    dp_code="IFRS_S2_SCOPE1_EMISSIONS",
    name_ko="Scope 1 온실가스 배출량",
    name_en="Scope 1 GHG emissions",
    standard="IFRS_S2",
    category="E",
    topic="지표 및 목표",
    dp_type=DPTypeEnum.QUANTITATIVE,
        validation_rules={"min": 0},
    is_active=True
)
db.add(dp)
db.commit()
except Exception as e:
    db.rollback()
    print(f"에러: {e}")
finally:
db.close()
```

### Soft Delete 사용

```python
# 삭제 (Soft Delete)
dp.is_active = False
db.commit()  # deleted_at이 자동으로 설정됨

# 복구
dp.is_active = True
db.commit()  # deleted_at이 자동으로 NULL로 설정됨
```

### FastAPI에서 사용

```python
from fastapi import Depends
from database.base import get_db
from sqlalchemy.orm import Session
from model.models import DataPoint

@app.get("/data-points")
def get_data_points(db: Session = Depends(get_db)):
    return db.query(DataPoint).filter(DataPoint.is_active == True).all()
```

## 마이그레이션 명령어

```bash
# 현재 상태 확인
alembic current

# 마이그레이션 히스토리
alembic history

# 최신으로 업그레이드
alembic upgrade head

# 한 단계 되돌리기
alembic downgrade -1

# 특정 리비전으로
alembic upgrade 002_add_indexes
alembic downgrade 001_initial
```

## 문제 해결

### 연결 오류

- NeonDB 연결 문자열 확인
- SSL 모드가 `require`인지 확인
- 방화벽 설정 확인

### ENUM 타입 충돌

기존 ENUM 타입이 있는 경우:

```sql
DROP TYPE IF EXISTS dp_type_enum CASCADE;
```

그 후 마이그레이션 재실행.

### 마이그레이션 충돌

```bash
# 상태 확인
alembic current

# 강제로 특정 리비전으로 설정 (주의!)
alembic stamp <revision_id>
```

## 초기 마이그레이션 생성

Alembic이 아직 초기화되지 않은 경우:

```bash
# 공유 Alembic 사용 (ai/ 디렉토리에서 실행)
cd ai/
export SERVICE_NAME=ifrs_agent
alembic revision --autogenerate -m "Initial ontology schema"
```
