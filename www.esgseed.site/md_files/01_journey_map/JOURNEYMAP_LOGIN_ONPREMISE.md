# 온프레미스 환경 로그인 및 사용자 관리 저니맵

> **환경**: 온프레미스 (On-Premise)  
> **목적**: 회사 내부에서 사용하는 온프레미스 환경의 로그인 및 사용자 관리 프로세스를 정리합니다.  
> **대상**: 관리자, 시스템 운영자, 개발자  
> **최종 업데이트**: 2025-01-XX

---

## 1. 온프레미스 환경 특징

### 1.1 SaaS vs 온프레미스 차이점

| 구분 | SaaS 환경 | 온프레미스 환경 |
|------|----------|---------------|
| **회원가입** | ✅ 사용자가 직접 회원가입 | ❌ **삭제** - 관리자가 사용자 등록 |
| **회사 등록** | ✅ 사용자가 회사 등록 | ❌ **삭제** - 관리자가 회사 등록 |
| **사용자 등록** | ✅ 회원가입으로 자동 등록 | ✅ **관리자가 미리 등록** |
| **로그인** | ✅ 이메일/비밀번호 + 소셜 로그인 | ✅ 이메일/비밀번호 (소셜 로그인 선택적) |
| **권한 분배** | ✅ HRIS 자동 할당 또는 승인 | ✅ **관리자가 미리 설정** |
| **초기 비밀번호** | ❌ 사용자가 직접 설정 | ✅ **관리자가 설정** (최초 로그인 시 변경 필수) |

### 1.2 온프레미스 환경의 핵심 원칙

1. **회원가입 기능 없음**: 모든 사용자는 관리자가 미리 등록
2. **권한은 관리자가 설정**: 사용자 등록 시 역할, 부서, 직급을 관리자가 지정
3. **로그인은 등록된 사용자만**: `users` 테이블에 등록된 사용자만 로그인 가능
4. **초기 비밀번호 변경 필수**: 관리자가 설정한 초기 비밀번호는 최초 로그인 시 변경 필요

---

## 2. 데이터베이스 테이블 구조

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

---

## 3. 관리자 사용자 등록 프로세스

### 3.1 사용자 등록 화면 (관리자 전용)

**접근 권한**: `role = 'final_approver'` 또는 `role = 'esg_team'` (사용자 관리 권한)

**화면 구성**:
```
┌─────────────────────────────────────┐
│ 사용자 등록                          │
├─────────────────────────────────────┤
│ 이메일: [user@company.com]          │
│ 이름: [홍길동]                       │
│ 역할: [▼ ESG팀]                     │
│   - 최종 승인권자                    │
│   - ESG팀                           │
│   - 현업팀                          │
│   - 일반 사용자                      │
│ 부서: [▼ ESG팀]                     │
│   - ESG팀                           │
│   - 환경안전팀                      │
│   - 인사팀                          │
│   - 재무팀                          │
│ 직급: [▼ 팀원]                      │
│   - 대표이사                        │
│   - 팀장                            │
│   - 팀원                            │
│ 초기 비밀번호: [TempPass123!]       │
│   (특수문자, 영문, 숫자 포함, 8~14자)│
│                                     │
│ [등록] [취소]                       │
└─────────────────────────────────────┘
```

### 3.2 사용자 등록 프로세스

```
[관리자] 사용자 등록 화면 접속
  ↓
[관리자] 사용자 정보 입력
  - 이메일: user@company.com
  - 이름: 홍길동
  - 역할: ESG팀 (관리자가 선택)
  - 부서: ESG팀 (관리자가 선택)
  - 직급: 팀원 (관리자가 선택)
  - 초기 비밀번호: TempPass123! (관리자가 설정)
  ↓
[관리자] "등록" 버튼 클릭
  ↓
[시스템] 사용자 등록 처리
  1. email 중복 확인
  2. password_hash 생성 (초기 비밀번호 암호화)
  3. users 테이블에 저장
  4. initial_password 저장 (평문, 최초 로그인 후 삭제)
  5. must_change_password = TRUE 설정
  6. is_first_login = TRUE 설정
  ↓
[시스템] 등록 완료 메시지
  - "사용자가 등록되었습니다."
  - "초기 비밀번호: TempPass123!"
  - "사용자에게 초기 비밀번호를 안전하게 전달하세요."
  ↓
[관리자] 사용자에게 초기 비밀번호 전달
  - 이메일 또는 안전한 채널로 전달
```

### 3.3 사용자 등록 SQL 예시

```sql
-- 관리자가 사용자 등록
INSERT INTO users (
  company_id,
  email,
  password_hash,  -- 초기 비밀번호 해시
  name,
  role,  -- 관리자가 설정
  department,  -- 관리자가 설정
  position,  -- 관리자가 설정
  initial_password,  -- 초기 비밀번호 (평문, 최초 로그인 후 삭제)
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
  'TempPass123!',  -- 초기 비밀번호
  TRUE,
  TRUE,
  'admin_user_id'
);
```

---

## 4. 로그인 프로세스

### 4.1 로그인 화면

**화면 구성**:
```
┌─────────────────────────────────────┐
│ 로그인                              │
├─────────────────────────────────────┤
│ 이메일: [name@company.com]          │
│ 비밀번호: [••••••••]                │
│                                     │
│ [이메일로 로그인]                   │
│                                     │
│ (선택) 소셜 로그인                  │
│ [Google로 시작하기]                 │
│ [카카오로 시작하기]                 │
│ [네이버로 시작하기]                 │
│                                     │
│ [비밀번호를 잊으셨나요?]            │
└─────────────────────────────────────┘
```

**변경 사항**:
- ❌ "회원가입" 버튼 삭제
- ❌ "회사 등록" 버튼 삭제
- ❌ "아직 계정이 없으신가요?" 링크 삭제
- ✅ "비밀번호를 잊으셨나요?" 링크 유지 (관리자에게 문의 안내)

### 4.2 로그인 프로세스

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

### 4.3 로그인 검증 로직

```python
async def login(email: str, password: str) -> Dict:
    """온프레미스 환경 로그인"""
    
    # 1. 사용자 조회
    user = await db.query(users).filter(
        users.email == email,
        users.is_active == True
    ).first()
    
    if not user:
        raise AuthenticationError("등록되지 않은 사용자입니다.")
    
    # 2. 비밀번호 검증
    if not verify_password(password, user.password_hash):
        raise AuthenticationError("비밀번호가 일치하지 않습니다.")
    
    # 3. JWT 토큰 발급
    access_token = generate_jwt_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
        company_id=user.company_id
    )
    
    # 4. 마지막 로그인 시각 업데이트
    user.last_login_at = datetime.now()
    await db.commit()
    
    # 5. 최초 로그인 여부 확인
    if user.is_first_login:
        return {
            "success": True,
            "access_token": access_token,
            "must_change_password": True,
            "message": "최초 로그인입니다. 비밀번호를 변경해주세요."
        }
    
    return {
        "success": True,
        "access_token": access_token,
        "must_change_password": False,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "department": user.department
        }
    }
```

---

## 5. 최초 로그인 시 비밀번호 변경

### 5.1 비밀번호 변경 화면

**화면 구성**:
```
┌─────────────────────────────────────┐
│ 비밀번호 변경 (필수)                 │
├─────────────────────────────────────┤
│ 최초 로그인입니다. 비밀번호를 변경해주세요.
│                                     │
│ 현재 비밀번호: [••••••••]           │
│   (초기 비밀번호 입력)              │
│                                     │
│ 새 비밀번호: [••••••••]             │
│   (특수문자, 영문, 숫자 포함, 8~14자)│
│                                     │
│ 새 비밀번호 확인: [••••••••]        │
│                                     │
│ 비밀번호 강도: [●●●○○] (중간)       │
│                                     │
│ [비밀번호 변경]                      │
└─────────────────────────────────────┘
```

### 5.2 비밀번호 변경 프로세스

```
[사용자] 최초 로그인 (is_first_login = TRUE)
  ↓
[시스템] 비밀번호 변경 화면으로 리다이렉트
  ↓
[사용자] 현재 비밀번호 + 새 비밀번호 입력
  ↓
[시스템] 비밀번호 검증
  1. 현재 비밀번호가 initial_password와 일치하는지 확인
  2. 새 비밀번호 강도 검증 (특수문자, 영문, 숫자 포함, 8~14자)
  3. 새 비밀번호와 확인 일치 여부 확인
  ↓
[시스템] 비밀번호 업데이트
  - password_hash 업데이트 (새 비밀번호 해시)
  - is_first_login = FALSE
  - must_change_password = FALSE
  - password_changed_at = NOW()
  - initial_password 삭제 (NULL로 설정)
  ↓
[시스템] 메인 화면으로 리다이렉트
```

### 5.3 비밀번호 변경 로직

```python
async def change_password(
    user_id: UUID,
    current_password: str,
    new_password: str
) -> Dict:
    """비밀번호 변경 (최초 로그인 또는 일반 변경)"""
    
    user = await db.query(users).filter(users.id == user_id).first()
    
    # 1. 현재 비밀번호 검증
    if user.is_first_login:
        # 최초 로그인: initial_password와 비교
        if current_password != user.initial_password:
            raise AuthenticationError("현재 비밀번호가 일치하지 않습니다.")
    else:
        # 일반 변경: password_hash와 비교
        if not verify_password(current_password, user.password_hash):
            raise AuthenticationError("현재 비밀번호가 일치하지 않습니다.")
    
    # 2. 새 비밀번호 강도 검증
    if not validate_password_strength(new_password):
        raise ValidationError("비밀번호는 특수문자, 영문, 숫자를 포함하여 8~14자여야 합니다.")
    
    # 3. 비밀번호 업데이트
    user.password_hash = hash_password(new_password)
    user.is_first_login = False
    user.must_change_password = False
    user.password_changed_at = datetime.now()
    user.initial_password = None  # 초기 비밀번호 삭제
    user.updated_at = datetime.now()
    
    await db.commit()
    
    return {
        "success": True,
        "message": "비밀번호가 변경되었습니다."
    }
```

---

## 6. 소셜 로그인 처리 (온프레미스)

### 6.1 옵션 1: 소셜 로그인 비활성화 (권장)

```
[사용자] Google/카카오/네이버 로그인 시도
  ↓
[시스템] "온프레미스 환경에서는 소셜 로그인이 지원되지 않습니다" 메시지
  ↓
[사용자] 이메일/비밀번호 로그인으로 안내
```

**화면 구성**:
```
┌─────────────────────────────────────┐
│ 로그인                              │
├─────────────────────────────────────┤
│ 이메일: [name@company.com]          │
│ 비밀번호: [••••••••]                │
│                                     │
│ [이메일로 로그인]                   │
│                                     │
│ (소셜 로그인 버튼 숨김)             │
│                                     │
│ [비밀번호를 잊으셨나요?]            │
└─────────────────────────────────────┘
```

### 6.2 옵션 2: 등록된 사용자만 소셜 로그인 허용

```
[사용자] Google 로그인 시도
  ↓
[시스템] Google OAuth 처리
  ↓
[시스템] email로 users 테이블 조회
  ↓
[시스템] 등록된 사용자인지 확인
  ├─ 등록됨 → 로그인 성공
  └─ 미등록 → "등록되지 않은 사용자입니다. 관리자에게 문의하세요" 메시지
```

**소셜 로그인 검증 로직**:
```python
async def social_login(provider: str, email: str) -> Dict:
    """소셜 로그인 (등록된 사용자만)"""
    
    # 1. 등록된 사용자인지 확인
    user = await db.query(users).filter(
        users.email == email,
        users.is_active == True
    ).first()
    
    if not user:
        raise AuthenticationError(
            "등록되지 않은 사용자입니다. 관리자에게 문의하세요."
        )
    
    # 2. JWT 토큰 발급
    access_token = generate_jwt_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
        company_id=user.company_id
    )
    
    # 3. 마지막 로그인 시각 업데이트
    user.last_login_at = datetime.now()
    await db.commit()
    
    return {
        "success": True,
        "access_token": access_token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role
        }
    }
```

---

## 7. 관리자 사용자 관리 기능

### 7.1 사용자 목록 조회

**화면 구성**:
```
┌─────────────────────────────────────────────────────────┐
│ 사용자 관리                                              │
├─────────────────────────────────────────────────────────┤
│ [사용자 등록] [엑셀 일괄 등록] [검색]                   │
├─────────────────────────────────────────────────────────┤
│ 이메일          이름    역할      부서      상태    최종로그인│
│ user1@...      홍길동  ESG팀    ESG팀     활성    2025-01-15│
│ user2@...      김철수  현업팀   환경안전팀 활성    2025-01-14│
│ user3@...      이영희  일반     -         비활성  -         │
│                                     │
│ [수정] [비활성화] [삭제]                                │
└─────────────────────────────────────────────────────────┘
```

**SQL 쿼리**:
```sql
-- 회사별 사용자 목록 조회
SELECT 
  id,
  email,
  name,
  role,
  department,
  position,
  is_active,
  last_login_at,
  created_at
FROM users
WHERE company_id = ?
ORDER BY created_at DESC;
```

### 7.2 사용자 수정

**화면 구성**:
```
┌─────────────────────────────────────┐
│ 사용자 수정                          │
├─────────────────────────────────────┤
│ 이메일: user@company.com (수정 불가)│
│ 이름: [홍길동]                       │
│ 역할: [▼ ESG팀]                     │
│ 부서: [▼ ESG팀]                     │
│ 직급: [▼ 팀원]                      │
│ 상태: [▼ 활성]                      │
│   - 활성                            │
│   - 비활성                          │
│                                     │
│ [저장] [취소]                       │
└─────────────────────────────────────┘
```

### 7.3 사용자 비활성화

```sql
-- 사용자 비활성화
UPDATE users
SET is_active = FALSE,
    updated_at = NOW()
WHERE id = ?;
```

### 7.4 비밀번호 재설정 (관리자)

**화면 구성**:
```
┌─────────────────────────────────────┐
│ 비밀번호 재설정                      │
├─────────────────────────────────────┤
│ 사용자: user@company.com            │
│                                     │
│ 새 비밀번호: [NewPass123!]          │
│   (특수문자, 영문, 숫자 포함, 8~14자)│
│                                     │
│ [비밀번호 재설정]                   │
│                                     │
│ ※ 사용자에게 새 비밀번호를 안전하게 │
│   전달하세요.                       │
└─────────────────────────────────────┘
```

**비밀번호 재설정 로직**:
```python
async def admin_reset_password(
    admin_user_id: UUID,
    target_user_id: UUID,
    new_password: str
) -> Dict:
    """관리자가 사용자 비밀번호 재설정"""
    
    # 1. 관리자 권한 확인
    admin = await db.query(users).filter(users.id == admin_user_id).first()
    if admin.role not in ['final_approver', 'esg_team']:
        raise PermissionError("비밀번호 재설정 권한이 없습니다.")
    
    # 2. 대상 사용자 조회
    target_user = await db.query(users).filter(users.id == target_user_id).first()
    
    # 3. 비밀번호 업데이트
    target_user.password_hash = hash_password(new_password)
    target_user.initial_password = new_password  # 초기 비밀번호로 설정
    target_user.is_first_login = True  # 최초 로그인으로 설정
    target_user.must_change_password = True
    target_user.updated_at = datetime.now()
    
    await db.commit()
    
    return {
        "success": True,
        "message": f"비밀번호가 재설정되었습니다. 사용자에게 '{new_password}'를 안전하게 전달하세요."
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
if check_permission(current_user, 'esg_team'):
    # ESG팀 이상 권한만 접근 가능
    approve_environmental_data(...)
else:
    raise PermissionError("승인 권한이 없습니다.")
```

---

## 9. 전체 프로세스 다이어그램

### 9.1 사용자 등록 → 로그인 플로우

```
┌─────────────────────────────────────────┐
│ [관리자] 사용자 등록                     │
│                                          │
│ 1. 사용자 정보 입력                      │
│    - 이메일: user@company.com           │
│    - 이름: 홍길동                       │
│    - 역할: ESG팀 (관리자가 선택)         │
│    - 부서: ESG팀 (관리자가 선택)         │
│    - 초기 비밀번호: TempPass123!         │
│                                          │
│ 2. users 테이블에 저장                   │
│    - password_hash 생성                 │
│    - initial_password 저장              │
│    - is_first_login = TRUE              │
│    - must_change_password = TRUE        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ [사용자] 로그인                          │
│                                          │
│ 1. 이메일 + 비밀번호 입력                │
│    - 이메일: user@company.com           │
│    - 비밀번호: TempPass123!             │
│                                          │
│ 2. 시스템 검증                           │
│    - email 존재 확인                     │
│    - password_hash 검증                 │
│    - is_active = TRUE 확인              │
│                                          │
│ 3. 로그인 성공                           │
│    - JWT 토큰 발급                       │
│    - is_first_login 확인                │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ [조건 분기]                              │
│                                          │
│ is_first_login = TRUE?                   │
│                                          │
│  YES → 비밀번호 변경 화면                │
│   ↓                                      │
│  [사용자] 새 비밀번호 입력               │
│   ↓                                      │
│  [시스템] 비밀번호 업데이트              │
│   - password_hash 업데이트              │
│   - is_first_login = FALSE              │
│   - initial_password 삭제                │
│                                          │
│  NO → 메인 화면 (권한별 메뉴 표시)       │
└─────────────────────────────────────────┘
```

---

## 10. 요약

### 10.1 온프레미스 환경의 핵심 변경사항

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

### 10.2 데이터베이스 테이블

- `users` 테이블에 다음 필드 추가:
  - `initial_password`: 초기 비밀번호 (평문, 최초 로그인 후 삭제)
  - `is_first_login`: 최초 로그인 여부
  - `must_change_password`: 비밀번호 변경 필수 여부
  - `password_changed_at`: 비밀번호 변경 시각
  - `created_by`: 등록한 관리자

### 10.3 권한 분배

- **관리자가 미리 설정**: 사용자 등록 시 `role`, `department`, `position` 설정
- **로그인 후 권한 확인**: JWT 토큰에 권한 정보 포함, 메뉴 및 기능 접근 제어

---

## 참조 문서

- `JOURNEYMAP_LOGIN.md` - SaaS 환경 로그인 저니맵 (참고용)
- `DATABASE_TABLES_STRUCTURE.md` - 데이터베이스 테이블 구조
- `USER_JOURNEY_MAP.md` - 사용자 저니맵
