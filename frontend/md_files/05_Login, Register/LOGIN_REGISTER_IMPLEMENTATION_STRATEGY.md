# IFRSseed — 로그인·서브계정 등록 구현 전략

작성일: 2026-03-26  
참고 소스: `md_files/05_Login, Register/LoginPage.jsx`, `RegisterPage.jsx`  
대상 앱: `src/app/…`, `src/components/…` (Next.js App Router)  
브랜딩: 문서·UI 문구의 **「SR Report」→「IFRSseed」** 통일 (로고명, 서브카피, 메타 설명)

---

## 1. 목표

1. **법인(지주사 발급) 아이디·비밀번호 로그인** UI/흐름을 참고 JSX 수준으로 맞춘다.  
2. **서브계정(담당자) 등록**: 마스터가 발급한 **등록 코드** → 정보 입력 → 가입 신청 → 승인 대기 → 로그인 복귀.  
3. **비밀번호 찾기**(이메일 재설정 링크) 1차 UX는 참고 JSX와 동일하게 둔다(백엔드 연동은 API 확정 후).  
4. 기존 `LoginPage.tsx`의 **소셜(OAuth) 로그인**은 제품 정책에 따라 **유지·병행·분리** 중 하나로 결정한다(아래 4-3).

---

## 2. 참고 파일 기능 매핑

### 2-1. `LoginPage.jsx`

| 구역 | 내용 |
|------|------|
| 좌측 패널 | 다크 그라데이션 + 그리드, 로고/히어로 카피, 통계(데모 숫자) |
| 우측 카드 | 로그인 폼: 아이디·비밀번호, 표시/숨김, 에러, 로딩, 실패 5회 잠금 카운트(클라이언트 데모) |
| 비밀번호 찾기 | 2단계: 아이디+이메일 입력 → “발송 완료” 안내 |
| 하단 | “계정 등록” CTA → 등록 화면으로 `onRegister` |
| 데모 로그인 | `master` / `1234` → `onLogin({ role, company })` |

**브랜딩 변경 시 수정 위치(참고 JSX 기준)**  
- `logoName`: `SR Report` → `IFRSseed`  
- `logoSub`: 예) `지속가능경영·공시 보고 플랫폼` 등 IFRSseed 톤으로 재작성

### 2-2. `RegisterPage.jsx`

| Step | 내용 |
|------|------|
| 0 | 등록 코드 입력·검증 → 성공 시 법인 정보(`company`) 세팅 |
| 1 | 이름, 이메일, 아이디(소문자/숫자/_), 비밀번호·확인, 비밀번호 강도 UI, 권한(작성자/검토자/조회) |
| 2 | 가입 신청 완료 + 승인 대기 안내 + 로그인으로 `onBack` |

**데모**: 코드 `CODE-2024` → `(주)계열사A` / `SUB-001`

---

## 3. 현재 코드베이스와의 차이

- `src/components/LoginPage.tsx`는 **카드 단일 열 + 이메일/비밀번호(미연동) + Google·Kakao·Naver** 중심이다.  
- 참고 JSX는 **풀스크린 2열(브랜드 + 폼)** 이고 **등록 코드 기반 서브계정** 플로우가 있다.  
→ 구현 시 **(A) 로그인 라우트를 참고 레이아웃으로 교체**하거나, **(B) “법인 로그인” / “소셜 로그인” 탭으로 분리**하는 방식 중 선택한다.

---

## 4. 라우팅·레이아웃 전략

### 4-1. 권장 라우트

| 경로 | 용도 |
|------|------|
| `/login` | 참고 `LoginPage`에 해당 (비밀번호 찾기·등록 CTA 포함) |
| `/register` | 참고 `RegisterPage`에 해당 (3단계 위저드) |

- 로그인 카드의 **「계정 등록 →」** → `router.push('/register')`  
- 등록 완료/취소 **「로그인으로」** → `router.push('/login')`

### 4-2. 글로벌 네비게이션

- 로그인·등록은 **집중 UX**를 위해 **상단 `AppLayoutShell` 네비를 숨기는 전용 레이아웃**을 권장한다.  
  - 예: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx` + `(auth)/layout.tsx`에서 `AppLayoutShell` 미사용 또는 `minimal` 헤더만.

### 4-3. 소셜 로그인과의 관계

- **정책 1**: 법인 계정만 사용 → 기존 OAuth 블록은 제거하거나 `/login` 하단 “또는” 섹션으로 축소.  
- **정책 2**: B2C·내부용 소셜 유지 → `/login` 내 **탭**: `법인 계정` | `소셜 계정` 으로 분리해 참고 JSX와 충돌 없게 배치.

---

## 5. 컴포넌트 분해(구현 단위)

```
(auth)/
  layout.tsx              # 풀뷰포트, Pretendard/Noto Serif는 layout 또는 globals
  login/page.tsx
  register/page.tsx

components/auth/
  AuthSplitLayout.tsx     # 좌 브랜드 패널 + 우 콘텐츠 슬롯 (공통)
  AuthLogoBlock.tsx      # LogoMark + IFRSseed + 서브카피
  LoginForm.tsx          # 아이디/비밀번호, 에러, 제출
  LoginForgotPanel.tsx   # 비밀번호 찾기 1·2단계
  RegisterCodeStep.tsx
  RegisterProfileStep.tsx
  RegisterCompleteStep.tsx
```

- 참고 JSX의 **인라인 `S` 스타일 객체**는 단계적으로 **Tailwind + 기존 `globals.css` 토큰(`primary`, `seed-*`)** 으로 옮기면 유지보수에 유리하다.  
- 아이콘은 참고처럼 인라인 SVG 유지 또는 `lucide-react`로 치환(일관성).

---

## 6. 상태·검증 규칙 (참고 JSX 그대로 이관)

### 6-1. 로그인

- 빈 값: “아이디와 비밀번호를 모두 입력해주세요.”  
- 실패 카운트: N회(참고: 5회) 시 잠금 메시지 — **실제 잠금은 서버에서만 신뢰**; 클라이언트는 표시용·보조.  
- 성공 시: 세션/쿠키/`sessionStorage` 등 **기존 앱의 `user` 모델**에 맞게 `setUser` 후 `/` 또는 `callbackUrl` 리다이렉트.

### 6-2. 등록

- 코드: trim, 대소문자 정규화(참고: `toUpperCase()`).  
- 이메일: 단순 정규식(참고 JSX) 또는 라이브러리(zod)로 강화 가능.  
- 아이디: 4자 이상, `a-z0-9_` 필터.  
- 비밀번호: 8자 이상, 확인 일치, 강도 바(참고 로직).  
- 권한: `writer` | `reviewer` | `viewer` — **최종 권한은 마스터 승인 시 서버에서 확정** 문구 유지.

### 6-3. 비밀번호 찾기

- 1단계: 아이디 + 이메일 → API `POST /auth/forgot-password` 등(가칭)  
- 2단계: 성공 UI만 먼저 구현, 실제 메일은 백엔드 연동 후.

---

## 7. 백엔드 API 가정 (스펙 확정 후 치환)

| API | 용도 |
|-----|------|
| `POST /api/auth/login` | loginId + password → 토큰/세트쿠키 |
| `POST /api/auth/register/verify-code` | 등록 코드 → 법인 메타 반환 |
| `POST /api/auth/register` | 가입 신청 페이로드(이름, 이메일, loginId, password 해시 전송은 서버 정책 따름) |
| `POST /api/auth/forgot-password` | 재설정 메일 트리거 |

환경 변수: `NEXT_PUBLIC_API_BASE` 등으로 `localhost:8080` 하드코딩 제거 권장.

---

## 8. IFRSseed 브랜딩 체크리스트

- [ ] 로그인·등록 좌측 **로고 텍스트**: `IFRSseed`  
- [ ] 서브카피: SR 전용 문구가 있으면 **IFRSseed·IFRS/ESG 범위**에 맞게 수정  
- [ ] 히어로 제목/설명: “지속가능경영보고서” 등 **제품명 일관**  
- [ ] 브라우저 탭 `metadata`: `title`/`description`에 IFRSseed  
- [ ] 참고 JSX 내 `관리자 로그인 → /admin` 는 **실제 정책 있을 때만** 노출 (없으면 삭제)

---

## 9. 구현 단계(권장 순서)

1. **(auth) 레이아웃** + `AuthSplitLayout` + **IFRSseed** 카피 반영  
2. **`/login`**: 폼 + 비밀번호 찾기 + 등록 링크 (API는 mock → 실연동)  
3. **`/register`**: 3스텝 위저드 + 검증 로직  
4. **기존 `Navigation`의 로그인 링크**는 `/login` 유지, 필요 시 **로그아웃 후 `/login`**  
5. OAuth 유지 시 탭/섹션 정리 및 중복 필드 제거  
6. E2E 스모크: 등록 → 로그인 → 홈 진입

---

## 10. 보안·운영 메모

- 비밀번호는 **프론트에 평문 장기 저장 금지**; 토큰은 **httpOnly 쿠키** 권장.  
- 등록 코드는 **일회용·만료** 정책을 백엔드와 맞출 것.  
- 로그인 실패 메시지는 **“아이디 또는 비밀번호가 올바르지 않습니다”** 로 통일(계정 존재 여부 노출 최소화).  
- 데모용 `master`/`1234`, `CODE-2024`는 **개발 환경에서만** 활성화하거나 빌드 시 제거.

---

## 11. 관련 파일(작업 시 터치 예상)

| 파일 | 비고 |
|------|------|
| `src/app/login/page.tsx` | 현재 `LoginPage` 임포트 구조를 (auth)로 이전 가능 |
| `src/components/LoginPage.tsx` | 참고 JSX 기반으로 재작성 또는 `components/auth/`로 분리 |
| `src/components/Navigation.tsx` | `/login`, `/register` 링크 |
| `src/components/AppLayoutShell.tsx` | (auth) 경로에서 숨김 처리 |

---

문서 개정 시 **작성일**과 **변경 요약**을 상단에 남긴다.
