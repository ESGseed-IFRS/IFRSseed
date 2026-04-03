# 온프레미스 환경 인증 및 사용자 관리

> **환경**: 온프레미스 (On-Premise)  
> **목적**: 온프레미스 환경의 인증 및 사용자 관리 시스템 설계를 정리합니다.  
> **대상**: 개발자, 시스템 아키텍트, 데이터베이스 설계자  
> **최종 업데이트**: 2025-01-XX

---

## 1. 개요

### 1.1 온프레미스 환경 특징

본 플랫폼은 **온프레미스 환경**에서 운영되며, 다음과 같은 특징을 가집니다:

- **회원가입 기능 없음**: 모든 사용자는 관리자가 미리 등록
- **권한은 관리자가 설정**: 사용자 등록 시 역할, 부서, 직급을 관리자가 지정
- **로그인은 등록된 사용자만**: `users` 테이블에 등록된 사용자만 로그인 가능
- **초기 비밀번호 변경 필수**: 관리자가 설정한 초기 비밀번호는 최초 로그인 시 변경 필요

### 1.2 SaaS vs 온프레미스 비교

| 구분 | SaaS 환경 | 온프레미스 환경 |
|------|----------|---------------|
| **회원가입** | ✅ 사용자가 직접 회원가입 | ❌ **삭제** - 관리자가 사용자 등록 |
| **회사 등록** | ✅ 사용자가 회사 등록 | ❌ **삭제** - 관리자가 회사 등록 |
| **사용자 등록** | ✅ 회원가입으로 자동 등록 | ✅ **관리자가 미리 등록** |
| **로그인** | ✅ 이메일/비밀번호 + 소셜 로그인 | ✅ 이메일/비밀번호 (소셜 로그인 선택적) |
| **권한 분배** | ✅ HRIS 자동 할당 또는 승인 | ✅ **관리자가 미리 설정** |
| **초기 비밀번호** | ❌ 사용자가 직접 설정 | ✅ **관리자가 설정** (최초 로그인 시 변경 필수) |

---

## 2. 데이터베이스 스키마

### 2.1 `users` 테이블 (온프레미스용)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- ===== 기본 정보 =====
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,  -- 암호화된 비밀번호
  name TEXT,
  
  -- ===== 권한 정보 (관리자가 미리 설정) =====
  role TEXT NOT NULL,  -- 'final_approver' | 'esg_team' | 'dept_user' | 'viewer'
  department TEXT,  -- '환경안전팀' | '인사팀' | '재무팀' | 'ESG팀'
  position TEXT,  -- '팀장' | '팀원' | '대표이사'
  
  -- ===== 계정 상태 =====
  is_active BOOLEAN DEFAULT TRUE,  -- 활성화 여부
  is_first_login BOOLEAN DEFAULT TRUE,  -- 최초 로그인 여부 (비밀번호 변경 필요)
  password_changed_at TIMESTAMPTZ,  -- 비밀번호 변경 시각
  
  -- ===== 초기 비밀번호 정보 =====
  initial_password TEXT,  -- 초기 비밀번호 (관리자가 설정, 최초 로그인 후 삭제)
  must_change_password BOOLEAN DEFAULT TRUE,  -- 비밀번호 변경 필수 여부
  
  -- ===== 메타데이터 =====
  created_by TEXT,  -- 등록한 관리자
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  
  INDEX idx_users_company (company_id),
  INDEX idx_users_email (email),
  INDEX idx_users_active (company_id, is_active)
);
```

### 2.2 `companies` 테이블 (온프레미스용)

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  
  -- ===== 기본 정보 =====
  company_name_ko TEXT NOT NULL,
  company_name_en TEXT,
  business_registration_number TEXT UNIQUE,
  representative_name TEXT,
  industry TEXT,
  
  -- ===== 연락처 =====
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  
  -- ===== 메타데이터 =====
  created_by TEXT,  -- 등록한 관리자
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3. 사용자 등록 프로세스

### 3.1 관리자 사용자 등록 API

```python
from typing import Dict
from uuid import UUID
from datetime import datetime
import bcrypt

class UserRegistrationService:
    """사용자 등록 서비스 (관리자 전용)"""
    
    async def register_user(
        self,
        admin_user_id: UUID,
        company_id: UUID,
        email: str,
        name: str,
        role: str,
        department: str = None,
        position: str = None,
        initial_password: str = None
    ) -> Dict:
        """
        관리자가 사용자 등록
        
        Args:
            admin_user_id: 등록하는 관리자 ID
            company_id: 회사 ID
            email: 사용자 이메일
            name: 사용자 이름
            role: 역할 ('final_approver' | 'esg_team' | 'dept_user' | 'viewer')
            department: 부서 (선택)
            position: 직급 (선택)
            initial_password: 초기 비밀번호 (없으면 자동 생성)
        
        Returns:
            {
                "user_id": "uuid",
                "email": "user@company.com",
                "initial_password": "TempPass123!",
                "message": "사용자가 등록되었습니다."
            }
        """
        # 1. 관리자 권한 확인
        admin = await self._get_user(admin_user_id)
        if admin.role not in ['final_approver', 'esg_team']:
            raise PermissionError("사용자 등록 권한이 없습니다.")
        
        # 2. 이메일 중복 확인
        existing_user = await self._get_user_by_email(email)
        if existing_user:
            raise ValueError("이미 등록된 이메일입니다.")
        
        # 3. 초기 비밀번호 생성 (없으면)
        if not initial_password:
            initial_password = self._generate_initial_password()
        
        # 4. 비밀번호 해시 생성
        password_hash = self._hash_password(initial_password)
        
        # 5. 사용자 등록
        user = await self._create_user(
            company_id=company_id,
            email=email,
            password_hash=password_hash,
            name=name,
            role=role,
            department=department,
            position=position,
            initial_password=initial_password,  # 평문 저장 (최초 로그인 후 삭제)
            is_first_login=True,
            must_change_password=True,
            created_by=admin_user_id
        )
        
        return {
            "user_id": user.id,
            "email": user.email,
            "initial_password": initial_password,
            "message": "사용자가 등록되었습니다. 초기 비밀번호를 안전하게 전달하세요."
        }
    
    def _generate_initial_password(self) -> str:
        """초기 비밀번호 자동 생성"""
        import secrets
        import string
        
        # 특수문자, 영문, 숫자 포함 12자리 비밀번호
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        password = ''.join(secrets.choice(alphabet) for i in range(12))
        
        return password
    
    def _hash_password(self, password: str) -> str:
        """비밀번호 해시 생성"""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
```

### 3.2 사용자 등록 SQL 예시

```sql
-- 관리자가 사용자 등록
INSERT INTO users (
  company_id,
  email,
  password_hash,
  name,
  role,
  department,
  position,
  initial_password,
  must_change_password,
  is_first_login,
  created_by
) VALUES (
  'company_123',
  'user@company.com',
  '$2b$10$...',  -- 'TempPass123!' 해시
  '홍길동',
  'esg_team',  -- 관리자가 선택
  'ESG팀',  -- 관리자가 선택
  '팀원',  -- 관리자가 선택
  'TempPass123!',  -- 초기 비밀번호 (평문)
  TRUE,
  TRUE,
  'admin_user_id'
);
```

---

## 4. 로그인 프로세스

### 4.1 로그인 API

```python
from typing import Dict, Optional
from uuid import UUID
from datetime import datetime
import bcrypt
import jwt

class AuthenticationService:
    """인증 서비스"""
    
    async def login(
        self,
        email: str,
        password: str
    ) -> Dict:
        """
        로그인 (온프레미스 환경)
        
        Args:
            email: 사용자 이메일
            password: 비밀번호
        
        Returns:
            {
                "success": True,
                "access_token": "jwt_token",
                "must_change_password": True/False,
                "user": {...}
            }
        """
        # 1. 사용자 조회
        user = await self._get_user_by_email(email)
        
        if not user:
            raise AuthenticationError("등록되지 않은 사용자입니다.")
        
        if not user.is_active:
            raise AuthenticationError("비활성화된 사용자입니다.")
        
        # 2. 비밀번호 검증
        if not self._verify_password(password, user.password_hash):
            raise AuthenticationError("비밀번호가 일치하지 않습니다.")
        
        # 3. JWT 토큰 발급
        access_token = self._generate_jwt_token(
            user_id=user.id,
            email=user.email,
            role=user.role,
            company_id=user.company_id
        )
        
        # 4. 마지막 로그인 시각 업데이트
        user.last_login_at = datetime.now()
        await self._update_user(user)
        
        # 5. 최초 로그인 여부 확인
        response = {
            "success": True,
            "access_token": access_token,
            "must_change_password": user.is_first_login,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "department": user.department
            }
        }
        
        if user.is_first_login:
            response["message"] = "최초 로그인입니다. 비밀번호를 변경해주세요."
        
        return response
    
    def _verify_password(self, password: str, password_hash: str) -> bool:
        """비밀번호 검증"""
        return bcrypt.checkpw(
            password.encode('utf-8'),
            password_hash.encode('utf-8')
        )
    
    def _generate_jwt_token(
        self,
        user_id: UUID,
        email: str,
        role: str,
        company_id: UUID
    ) -> str:
        """JWT 토큰 생성"""
        payload = {
            "user_id": str(user_id),
            "email": email,
            "role": role,
            "company_id": str(company_id),
            "exp": datetime.utcnow() + timedelta(days=7)  # 7일 유효
        }
        
        return jwt.encode(payload, SECRET_KEY, algorithm="HS256")
```

### 4.2 로그인 플로우

```
[사용자] 로그인 페이지 접속
  ↓
[사용자] 이메일 + 비밀번호 입력
  ↓
[사용자] "이메일로 로그인" 버튼 클릭
  ↓
[시스템] 사용자 확인
  1. email로 users 테이블 조회
  2. password_hash 검증
  3. is_active = TRUE 확인
  4. company_id 확인
  ↓
[시스템] 로그인 성공
  - JWT 토큰 발급
  - last_login_at 업데이트
  - is_first_login 확인
  ↓
[조건 분기]
  ├─ is_first_login = TRUE
  │   ↓
  │   [시스템] 비밀번호 변경 화면으로 리다이렉트
  │   ↓
  │   [사용자] 새 비밀번호 입력
  │   ↓
  │   [시스템] 비밀번호 업데이트
  │   - password_hash 업데이트
  │   - is_first_login = FALSE
  │   - must_change_password = FALSE
  │   - password_changed_at = NOW()
  │   - initial_password 삭제
  │   ↓
  │   [사용자] 메인 화면으로 이동
  │
  └─ is_first_login = FALSE
      ↓
      [사용자] 메인 화면으로 이동 (권한별 메뉴 표시)
```

---

## 5. 비밀번호 변경

### 5.1 최초 로그인 시 비밀번호 변경

```python
async def change_password_on_first_login(
    user_id: UUID,
    current_password: str,
    new_password: str
) -> Dict:
    """
    최초 로그인 시 비밀번호 변경
    
    Args:
        user_id: 사용자 ID
        current_password: 현재 비밀번호 (초기 비밀번호)
        new_password: 새 비밀번호
    
    Returns:
        {
            "success": True,
            "message": "비밀번호가 변경되었습니다."
        }
    """
    user = await self._get_user(user_id)
    
    if not user.is_first_login:
        raise ValueError("이미 비밀번호를 변경한 사용자입니다.")
    
    # 1. 현재 비밀번호 검증 (initial_password와 비교)
    if current_password != user.initial_password:
        raise AuthenticationError("현재 비밀번호가 일치하지 않습니다.")
    
    # 2. 새 비밀번호 강도 검증
    if not self._validate_password_strength(new_password):
        raise ValidationError(
            "비밀번호는 특수문자, 영문, 숫자를 포함하여 8~14자여야 합니다."
        )
    
    # 3. 비밀번호 업데이트
    user.password_hash = self._hash_password(new_password)
    user.is_first_login = False
    user.must_change_password = False
    user.password_changed_at = datetime.now()
    user.initial_password = None  # 초기 비밀번호 삭제
    user.updated_at = datetime.now()
    
    await self._update_user(user)
    
    return {
        "success": True,
        "message": "비밀번호가 변경되었습니다."
    }
```

### 5.2 일반 비밀번호 변경

```python
async def change_password(
    user_id: UUID,
    current_password: str,
    new_password: str
) -> Dict:
    """
    일반 비밀번호 변경
    
    Args:
        user_id: 사용자 ID
        current_password: 현재 비밀번호
        new_password: 새 비밀번호
    
    Returns:
        {
            "success": True,
            "message": "비밀번호가 변경되었습니다."
        }
    """
    user = await self._get_user(user_id)
    
    # 1. 현재 비밀번호 검증 (password_hash와 비교)
    if not self._verify_password(current_password, user.password_hash):
        raise AuthenticationError("현재 비밀번호가 일치하지 않습니다.")
    
    # 2. 새 비밀번호 강도 검증
    if not self._validate_password_strength(new_password):
        raise ValidationError(
            "비밀번호는 특수문자, 영문, 숫자를 포함하여 8~14자여야 합니다."
        )
    
    # 3. 비밀번호 업데이트
    user.password_hash = self._hash_password(new_password)
    user.password_changed_at = datetime.now()
    user.updated_at = datetime.now()
    
    await self._update_user(user)
    
    return {
        "success": True,
        "message": "비밀번호가 변경되었습니다."
    }
```

---

## 6. 관리자 사용자 관리 기능

### 6.1 사용자 목록 조회

```python
async def get_user_list(
    admin_user_id: UUID,
    company_id: UUID,
    page: int = 1,
    page_size: int = 20,
    search_email: str = None,
    role: str = None,
    is_active: bool = None
) -> Dict:
    """
    사용자 목록 조회 (관리자 전용)
    
    Args:
        admin_user_id: 관리자 ID
        company_id: 회사 ID
        page: 페이지 번호
        page_size: 페이지 크기
        search_email: 이메일 검색 (선택)
        role: 역할 필터 (선택)
        is_active: 활성화 여부 필터 (선택)
    
    Returns:
        {
            "users": [...],
            "total": 100,
            "page": 1,
            "page_size": 20
        }
    """
    # 1. 관리자 권한 확인
    admin = await self._get_user(admin_user_id)
    if admin.role not in ['final_approver', 'esg_team']:
        raise PermissionError("사용자 목록 조회 권한이 없습니다.")
    
    # 2. 사용자 목록 조회
    query = self._build_user_query(
        company_id=company_id,
        search_email=search_email,
        role=role,
        is_active=is_active
    )
    
    users = await query.paginate(page=page, page_size=page_size)
    
    return {
        "users": [
            {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "department": user.department,
                "position": user.position,
                "is_active": user.is_active,
                "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
                "created_at": user.created_at.isoformat()
            }
            for user in users.items
        ],
        "total": users.total,
        "page": page,
        "page_size": page_size
    }
```

### 6.2 사용자 수정

```python
async def update_user(
    admin_user_id: UUID,
    target_user_id: UUID,
    name: str = None,
    role: str = None,
    department: str = None,
    position: str = None,
    is_active: bool = None
) -> Dict:
    """
    사용자 정보 수정 (관리자 전용)
    
    Args:
        admin_user_id: 관리자 ID
        target_user_id: 대상 사용자 ID
        name: 이름 (선택)
        role: 역할 (선택)
        department: 부서 (선택)
        position: 직급 (선택)
        is_active: 활성화 여부 (선택)
    
    Returns:
        {
            "success": True,
            "message": "사용자 정보가 수정되었습니다."
        }
    """
    # 1. 관리자 권한 확인
    admin = await self._get_user(admin_user_id)
    if admin.role not in ['final_approver', 'esg_team']:
        raise PermissionError("사용자 수정 권한이 없습니다.")
    
    # 2. 대상 사용자 조회
    user = await self._get_user(target_user_id)
    
    # 3. 정보 업데이트
    if name is not None:
        user.name = name
    if role is not None:
        user.role = role
    if department is not None:
        user.department = department
    if position is not None:
        user.position = position
    if is_active is not None:
        user.is_active = is_active
    
    user.updated_at = datetime.now()
    
    await self._update_user(user)
    
    return {
        "success": True,
        "message": "사용자 정보가 수정되었습니다."
    }
```

### 6.3 비밀번호 재설정 (관리자)

```python
async def admin_reset_password(
    admin_user_id: UUID,
    target_user_id: UUID,
    new_password: str = None
) -> Dict:
    """
    관리자가 사용자 비밀번호 재설정
    
    Args:
        admin_user_id: 관리자 ID
        target_user_id: 대상 사용자 ID
        new_password: 새 비밀번호 (없으면 자동 생성)
    
    Returns:
        {
            "success": True,
            "initial_password": "TempPass123!",
            "message": "비밀번호가 재설정되었습니다."
        }
    """
    # 1. 관리자 권한 확인
    admin = await self._get_user(admin_user_id)
    if admin.role not in ['final_approver', 'esg_team']:
        raise PermissionError("비밀번호 재설정 권한이 없습니다.")
    
    # 2. 대상 사용자 조회
    user = await self._get_user(target_user_id)
    
    # 3. 새 비밀번호 생성 (없으면)
    if not new_password:
        new_password = self._generate_initial_password()
    
    # 4. 비밀번호 업데이트
    user.password_hash = self._hash_password(new_password)
    user.initial_password = new_password  # 초기 비밀번호로 설정
    user.is_first_login = True  # 최초 로그인으로 설정
    user.must_change_password = True
    user.updated_at = datetime.now()
    
    await self._update_user(user)
    
    return {
        "success": True,
        "initial_password": new_password,
        "message": f"비밀번호가 재설정되었습니다. 사용자에게 '{new_password}'를 안전하게 전달하세요."
    }
```

---

## 7. 소셜 로그인 처리 (온프레미스)

### 7.1 옵션 1: 소셜 로그인 비활성화 (권장)

```python
# 소셜 로그인 버튼 숨김 또는 비활성화
# 프론트엔드에서 소셜 로그인 버튼 제거

# 또는 API에서 에러 반환
async def social_login(provider: str, code: str) -> Dict:
    """소셜 로그인 (온프레미스 환경에서는 비활성화)"""
    raise NotImplementedError(
        "온프레미스 환경에서는 소셜 로그인이 지원되지 않습니다. "
        "이메일/비밀번호로 로그인해주세요."
    )
```

### 7.2 옵션 2: 등록된 사용자만 소셜 로그인 허용

```python
async def social_login(provider: str, email: str) -> Dict:
    """
    소셜 로그인 (등록된 사용자만)
    
    Args:
        provider: 소셜 로그인 제공자 ('google' | 'kakao' | 'naver')
        email: 소셜 로그인으로 획득한 이메일
    
    Returns:
        {
            "success": True,
            "access_token": "jwt_token",
            "user": {...}
        }
    """
    # 1. 등록된 사용자인지 확인
    user = await self._get_user_by_email(email)
    
    if not user:
        raise AuthenticationError(
            "등록되지 않은 사용자입니다. 관리자에게 문의하세요."
        )
    
    if not user.is_active:
        raise AuthenticationError("비활성화된 사용자입니다.")
    
    # 2. JWT 토큰 발급
    access_token = self._generate_jwt_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
        company_id=user.company_id
    )
    
    # 3. 마지막 로그인 시각 업데이트
    user.last_login_at = datetime.now()
    await self._update_user(user)
    
    return {
        "success": True,
        "access_token": access_token,
        "must_change_password": user.is_first_login,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role
        }
    }
```

---

## 8. 권한 분배 구조

### 8.1 권한은 관리자가 미리 설정

**사용자 등록 시 관리자가 설정하는 항목**:

| 항목 | 설명 | 예시 |
|------|------|------|
| **role** | 역할 (필수) | 'final_approver', 'esg_team', 'dept_user', 'viewer' |
| **department** | 부서 (선택) | 'ESG팀', '환경안전팀', '인사팀', '재무팀' |
| **position** | 직급 (선택) | '대표이사', '팀장', '팀원' |

### 8.2 권한별 접근 제어

```python
# 권한 계층 구조
ROLE_HIERARCHY = {
    'final_approver': 1,  # 최종 승인권자 (최고 권한)
    'esg_team': 2,        # ESG팀
    'dept_user': 3,       # 현업팀
    'viewer': 4           # 일반 사용자 (최소 권한)
}

def check_permission(user: User, required_role: str) -> bool:
    """사용자 권한 확인"""
    user_level = ROLE_HIERARCHY.get(user.role, 99)
    required_level = ROLE_HIERARCHY.get(required_role, 99)
    
    return user_level <= required_level

# 예시: ESG 데이터 승인 기능
@require_permission('esg_team')
async def approve_environmental_data(
    user_id: UUID,
    data_id: UUID
):
    """ESG 데이터 승인 (ESG팀 이상 권한 필요)"""
    user = await get_user(user_id)
    
    if not check_permission(user, 'esg_team'):
        raise PermissionError("승인 권한이 없습니다.")
    
    # 승인 로직...
```

---

## 9. 요약

### 9.1 핵심 변경사항

1. **회원가입 기능 삭제**
   - ❌ "회원가입" 버튼 제거
   - ❌ "회사 등록" 버튼 제거
   - ❌ "아직 계정이 없으신가요?" 링크 제거

2. **관리자 사용자 등록**
   - ✅ 관리자가 사용자를 미리 등록
   - ✅ 역할, 부서, 직급을 관리자가 설정
   - ✅ 초기 비밀번호를 관리자가 설정

3. **로그인 프로세스**
   - ✅ 등록된 사용자인지만 확인
   - ✅ 비밀번호 검증
   - ✅ 최초 로그인 시 비밀번호 변경 필수

4. **소셜 로그인**
   - 옵션 1: 비활성화 (권장)
   - 옵션 2: 등록된 사용자만 허용

### 9.2 데이터베이스 테이블

- `users` 테이블에 다음 필드 추가:
  - `initial_password`: 초기 비밀번호 (평문, 최초 로그인 후 삭제)
  - `is_first_login`: 최초 로그인 여부
  - `must_change_password`: 비밀번호 변경 필수 여부
  - `password_changed_at`: 비밀번호 변경 시각
  - `created_by`: 등록한 관리자

### 9.3 권한 분배

- **관리자가 미리 설정**: 사용자 등록 시 `role`, `department`, `position` 설정
- **로그인 후 권한 확인**: JWT 토큰에 권한 정보 포함, 메뉴 및 기능 접근 제어

---

## 참조 문서

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 시스템 아키텍처
- [USER_JOURNEY_MAP.md](./USER_JOURNEY_MAP.md) - 사용자 저니맵
- [DATABASE_TABLES_STRUCTURE.md](./DATABASE_TABLES_STRUCTURE.md) - 데이터베이스 테이블 구조
