# Next.js 프로젝트 구조 개선안 - 옵션 B (하이브리드 전략)

## 목표
- **Next.js App Router의 강점** (loading.tsx, error.tsx, route.ts, streaming 등)을 최대한 활용
- **비즈니스 로직·컴포넌트·훅**은 features 폴더에 모아 유지 (현재 구조 최대한 존중)
- import 경로를 너무 길게 만들지 않으면서도 유지보수성 확보
- 팀원들이 직관적으로 이해하기 쉬운 구조

## 핵심 원칙 (Option B)
1. **페이지 파일(page.tsx, layout.tsx 등)** → `src/app/` 아래에 둔다  
   → Next.js가 강제하는 co-location 이점을 포기하지 않음
2. **실제 UI 컴포넌트, 폼, 훅, 유틸, 로직** → `src/features/` 아래에 유지  
   → 도메인별로 깔끔하게 분리
3. **import alias** 적극 활용  
   `@/features/...` 또는 `@features/...` 등으로 경로 단축

## 제안된 최종 구조 (2026년 2월 기준)

```text
src/
├── app/                        # Next.js가 인식하는 라우팅 영역 (페이지·레이아웃만 최소화)
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   └── login/
│   │       └── page.tsx        # /login
│   │
│   ├── main/                 # 또는 (app), (protected), (dashboard)로 변경 가능
│   │   ├── layout.tsx          # 공통 네비게이션, 헤더, 사이드바 등
│   │   ├── page.tsx            # /
│   │   │
│   │   ├── company-info/
│   │   │   └── page.tsx
│   │   │
│   │   ├── ghg-calculation/
│   │   │   ├── page.tsx                  # /ghg-calculation (대시보드/개요)
│   │   │   ├── scope1/
│   │   │   │   └── page.tsx              # /ghg-calculation/scope1
│   │   │   ├── scope2/
│   │   │   │   └── page.tsx
│   │   │   └── scope3/
│   │   │       └── page.tsx
│   │   │
│   │   ├── report/
│   │   │   ├── page.tsx                  # /report (목록 등)
│   │   │   └── final/
│   │   │       └── page.tsx              # /report/final
│   │   │
│   │   └── cdp-response/
│   │       └── page.tsx
│   │
│   └── layout.tsx              # Root Layout (html, body, 폰트 등)
│
├── features/                   # 도메인/기능별 모든 컴포넌트·로직 모음
│   ├── ghg-calculation/
│   │   ├── components/
│   │   │   ├── EMSDataLoader.tsx
│   │   │   ├── ExcelUploader.tsx
│   │   │   ├── GHGFilters.tsx
│   │   │   └── Receipt1Attachment.tsx
│   │   │
│   │   ├── scope1/
│   │   │   ├── Scope1Form.tsx
│   │   │   ├── Scope1FormPage.tsx        # 또는 Scope1Content.tsx 등
│   │   │   └── index.ts                  # barrel file
│   │   │
│   │   ├── scope2/
│   │   │   ├── Scope2Form.tsx
│   │   │   ├── Scope2FormPage.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── scope3/
│   │   │   ├── Scope3Form.tsx
│   │   │   ├── Scope3FormPage.tsx
│   │   │   └── index.ts
│   │   │
│   │   └── hooks/                # (선택) useScope1Data, useEmissionCalc 등
│   │
│   ├── company-info/             # 필요 시 다른 기능들도 동일 패턴
│   └── report/                   # ...
│
├── components/                   # 전역 공통 UI (Button, Modal, Card 등)
├── lib/                          # 유틸, api client, constants 등
└── types/                        # 전역 타입 정의