# 공유 Alembic 설정 사용 가이드

## 개요

모든 서비스가 공유하는 Alembic 설정이 `ai/` 레벨에 구성되어 있습니다.
각 서비스는 자신의 마이그레이션 파일을 `ai/alembic/versions/{service_name}/` 디렉토리에 보관합니다.

## 구조

```
ai/
├── alembic.ini                    # 공유 Alembic 설정
├── alembic/
│   ├── env.py                     # 동적 서비스 로딩
│   ├── script.py.mako            # 마이그레이션 템플릿
│   └── versions/
│       └── ifrs_agent/           # 서비스별 마이그레이션
│           ├── 001_initial_schema.py
│           ├── 002_add_indexes.py
│           └── 003_add_soft_delete_triggers.py
└── ifrs_agent/
    └── database/
        ├── base.py                # 서비스별 Base
        └── models.py              # 서비스별 모델
```

## 빠른 시작

### 1. 환경 변수 설정

```bash
# .env 파일 또는 환경 변수
export SERVICE_NAME=ifrs_agent
export DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

### 2. 마이그레이션 실행

```bash
# ai/ 디렉토리로 이동
cd ai

# 최신 마이그레이션 적용
SERVICE_NAME=ifrs_agent alembic upgrade head
```

### 3. 마이그레이션 상태 확인

```bash
# 현재 상태
SERVICE_NAME=ifrs_agent alembic current

# 히스토리
SERVICE_NAME=ifrs_agent alembic history
```

## 주요 명령어

### 마이그레이션 적용

```bash
# 최신으로 업그레이드
SERVICE_NAME=ifrs_agent alembic upgrade head

# 특정 리비전으로
SERVICE_NAME=ifrs_agent alembic upgrade 002_add_indexes

# 한 단계 업그레이드
SERVICE_NAME=ifrs_agent alembic upgrade +1
```

### 마이그레이션 되돌리기

```bash
# 한 단계 되돌리기
SERVICE_NAME=ifrs_agent alembic downgrade -1

# 특정 리비전으로
SERVICE_NAME=ifrs_agent alembic downgrade 001_initial

# 모든 마이그레이션 제거
SERVICE_NAME=ifrs_agent alembic downgrade base
```

### 새 마이그레이션 생성

```bash
# 자동 생성 (모델 변경 감지)
SERVICE_NAME=ifrs_agent alembic revision --autogenerate -m "Add new table"

# 수동 생성
SERVICE_NAME=ifrs_agent alembic revision -m "Manual migration"
```

## 서비스 추가 방법

### 1. env.py에 서비스 추가

`ai/alembic/env.py` 파일을 수정:

```python
elif service_name == "new_service":
    from new_service.database.base import Base
    from new_service.database.models import *
```

### 2. 버전 디렉토리 생성

```bash
mkdir -p ai/alembic/versions/new_service
```

### 3. 초기 마이그레이션 생성

```bash
SERVICE_NAME=new_service alembic revision --autogenerate -m "Initial schema"
```

## 기존 서비스별 Alembic 파일 정리

기존에 `ifrs_agent/database/alembic/` 디렉토리에 있던 파일들은 이제 사용하지 않습니다.
다음 파일들을 삭제하거나 보관할 수 있습니다:

- `ifrs_agent/alembic.ini` (삭제 가능)
- `ifrs_agent/database/alembic/` (삭제 가능)

**주의**: 마이그레이션 파일들은 이미 `ai/alembic/versions/ifrs_agent/`로 이동되었으므로 안전하게 삭제할 수 있습니다.

## 문제 해결

### 서비스를 찾을 수 없음

```
ImportError: Failed to import models for service 'xxx'
```

**해결**: `ai/alembic/env.py`에 해당 서비스의 모델 임포트를 추가하세요.

### 버전 디렉토리를 찾을 수 없음

**해결**: `ai/alembic/versions/{service_name}/` 디렉토리를 생성하세요.

### 데이터베이스 연결 오류

**해결**: `DATABASE_URL` 환경 변수가 올바르게 설정되었는지 확인하세요.

## Docker에서 사용

```yaml
# docker-compose.yaml
services:
  agent-service:
    environment:
      - SERVICE_NAME=ifrs_agent
      - DATABASE_URL=${NEON_DATABASE_URL}
    command: >
      sh -c "
        cd /app/ai &&
        SERVICE_NAME=ifrs_agent alembic upgrade head &&
        python -m ifrs_agent.main
      "
```

## 장점

✅ **중복 제거**: Alembic 설정을 한 곳에서 관리  
✅ **일관성**: 모든 서비스가 동일한 프로세스 사용  
✅ **확장성**: 새 서비스 추가가 쉬움  
✅ **독립성**: 각 서비스는 자신의 마이그레이션 히스토리 유지
