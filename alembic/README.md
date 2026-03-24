# 공유 Alembic 설정

이 디렉토리는 모든 서비스가 공유하는 Alembic 마이그레이션 설정을 포함합니다.

## 구조

```
ai/
├── alembic.ini                    # 공유 Alembic 설정
└── alembic/
    ├── env.py                     # 공통 환경 설정 (서비스별 동적 로딩)
    ├── script.py.mako            # 마이그레이션 템플릿
    └── versions/                 # 서비스별 버전 디렉토리
        ├── ifrs_agent/           # ifrs_agent 서비스 마이그레이션
        │   ├── 001_initial_schema.py
        │   ├── 002_add_indexes.py
        │   └── 003_add_soft_delete_triggers.py
        └── other_service/        # 다른 서비스 마이그레이션 (추가 가능)
```

## 사용 방법

### 환경 변수 설정

```bash
# 서비스 이름 지정
export SERVICE_NAME=ifrs_agent

# 데이터베이스 URL 설정
export DATABASE_URL=postgresql://user:password@host/dbname
```

### 마이그레이션 실행

```bash
# ai/ 디렉토리에서 실행
cd ai

# 최신 마이그레이션 적용
SERVICE_NAME=ifrs_agent alembic upgrade head

# 마이그레이션 상태 확인
SERVICE_NAME=ifrs_agent alembic current

# 마이그레이션 히스토리
SERVICE_NAME=ifrs_agent alembic history
```

### 새 마이그레이션 생성

```bash
# ai/ 디렉토리에서 실행
SERVICE_NAME=ifrs_agent alembic revision --autogenerate -m "description"
```

## 서비스 추가 방법

1. `ai/alembic/env.py`에 새 서비스 모델 임포트 추가:

```python
elif service_name == "new_service":
    from new_service.database.base import Base
    from new_service.database.models import *
```

2. `ai/alembic/versions/new_service/` 디렉토리 생성

3. 초기 마이그레이션 생성:

```bash
SERVICE_NAME=new_service alembic revision --autogenerate -m "Initial schema"
```

## 장점

- ✅ 중복 제거: Alembic 설정을 한 곳에서 관리
- ✅ 일관성: 모든 서비스가 동일한 마이그레이션 프로세스 사용
- ✅ 확장성: 새 서비스 추가 시 설정 복사 불필요
- ✅ 독립성: 각 서비스는 자신의 마이그레이션 히스토리 유지
