# 감사·검증 대응 탭 — UI/UX 디자인 전략

> **목적**: 글자 크기 확대, 가독성 개선, 네비게이션 바 디자인 통일, **전문적·세련된 비주얼**  
> **참조**: GHG 산정·공시 탭 좌측 사이드바(공시·보고 항목 + 필터) 디자인을 감사대응 네비게이션에 적용

---

## 0. 비주얼 톤: 전문성·세련됨 (지향점)

### 0.1 지양할 요소 (GPT/AI 슬롭 느낌)

| 지양 | 이유 |
|------|------|
| **이모지/캐릭터 아이콘** | 📋🔒📊 등 플랫폼·채팅 앱 느낌, 기업용 감사 화면과 부적합 |
| **과한 그라데이션·글래스모피즘** | 트렌디하지만 일시적, 감사·검증의 신뢰감 해침 |
| **밝은 파스텔/민트/라벤더** | AI 도구 전형적 팔레트, 전문성 약함 |
| **부풀린 카드·그림자** | 장식적, 정보 밀도 낮음 |
| **과한 둥근 모서리** | 놀이용·소비자 앱 느낌 |

### 0.2 지향할 요소 (전문적·세련됨)

| 지향 | 적용 |
|------|------|
| **미니멀 아이콘** | Lucide 등 선형 아이콘, stroke 1.5~2, 크기 16~18px. 필요 시 **텍스트만** 사용 |
| **절제된 컬러** | slate 계열, 소량의 primary. 포화도 낮고 중성적 |
| **타이포그래피 중심** | 아이콘 의존 최소화. 라벨·숫자로 정보 전달 |
| **여백·정돈** | 넉넉한 패딩, 정렬 일관. 정보 계층 명확 |
| **약한 테두리** | border-slate-200 수준. 그림자 대신 경계선으로 구분 |
| **일관된 둥근 모서리** | rounded-lg 수준 유지. rounded-2xl·3xl 지양 |

### 0.3 톤 키워드

- **Corporation / Enterprise**: Big4, 금융권, ESG 보고서 UI 수준
- **Restrained**: 화려함보다 절제
- **Trustworthy**: 감사·검증을 맡길 만한 인상

---

## 1. 현재 상태 vs 목표

| 구분 | 현재 | 목표 |
|------|------|------|
| **네비게이션** | 밝은 회색 배경(slate-50), 녹색 활성 강조 | **다크 테마** (slate-800), GHG 공시 사이드바와 동일 |
| **글자 크기** | 제목 text-lg, 본문 text-sm, 라벨 text-xs | 제목 확대, 본문 text-base, 라벨 text-sm |
| **대시보드 카드** | 숫자 text-2xl, 설명 text-xs | 숫자 text-3xl, 설명 text-sm |
| **가독성** | 작은 글씨, 대비 약함 | 대비 강화, 행간·자간 조정 |

---

## 2. 네비게이션 바 디자인 (참조: GHG 공시 사이드바)

### 2.1 디자인 기준

GHG 산정·공시 탭 좌측 사이드바(`bg-slate-800`, `border-slate-700`)와 **동일한 시각 계층**을 적용한다.

- **배경**: `bg-slate-800`, `border-slate-700`
- **섹션 헤더**: `text-slate-400`, `uppercase`, `tracking-widest`, `text-xs` → **text-sm** (가독성)
- **메뉴 버튼**: `text-sm` → **text-base**
  - 비활성: `text-slate-200`, `hover:bg-slate-700`
  - 활성: `bg-slate-600`, `text-white`
- **서브 메뉴**: 들여쓰기 유지, `text-slate-300`, `hover:text-white`

### 2.2 구조 및 아이콘 원칙

- **아이콘**: Lucide 선형 아이콘 16px, stroke 1.5. 또는 **텍스트만** (아이콘 생략)
- **이모지 미사용**: 📋🔒📊 등 이모지 대신 Lucide 아이콘 또는 텍스트로 표현

```
┌─ 감사·검증 대응 사이드바 ─────────────┐
│  감사·검증 대응          (섹션 헤더)   │
├──────────────────────────────────────┤
│  내부통제 요약 대시보드     (활성)     │
│  데이터 마감/확정 관리                 │
│  배출량별 감사 추적                    │
│    활동자료(Activity Data)            │
│    배출계수(Emission Factor)          │
│    산정결과(Calculated Emissions)    │
│  변경 이력(Audit Trail)               │
│  증빙자료(Evidence & Integrity)       │
│  산정 방법론 및 로직 계보              │
│  감사인 전용 뷰                       │
│  감사 대응 패키지(Export)             │
└──────────────────────────────────────┘
```

### 2.3 스타일 상세

| 요소 | 클래스 | 비고 |
|------|--------|------|
| 컨테이너 | `w-64 rounded-lg border border-slate-700 bg-slate-800` | GHG 공시와 동일 |
| 섹션 헤더 | `text-slate-400 uppercase tracking-widest text-sm font-semibold px-4 py-3 border-b border-slate-700` | text-xs → text-sm |
| 메뉴 버튼(일반) | `text-base px-3 py-2.5 rounded-md text-slate-200 hover:bg-slate-700 hover:text-white` | text-sm → text-base |
| 메뉴 버튼(활성) | `bg-slate-600 text-white font-medium` | 녹색 대신 slate-600 |
| 서브 메뉴 | `pl-5 text-slate-300 text-sm` | 들여쓰기 + 색상 구분 |

### 2.4 GHG 공시 사이드바와의 통일

- **너비**: `w-64` (256px)
- **모서리**: `rounded-lg`
- **구분선**: `border-slate-700`
- **스크롤**: `overflow-y-auto` (긴 메뉴 대응)

---

## 3. 글자 크기 및 가독성

### 3.1 타이포그래피 스케일

| 용도 | 현재 | 변경 | 적용 대상 |
|------|------|------|-----------|
| 페이지 제목 | text-lg | **text-xl** | "내부통제 요약 대시보드" 등 |
| 섹션 설명 | text-sm | **text-base** | "감사 질문을 사전에 방어하기..." |
| 카드 제목 | text-xs | **text-sm** | "증빙 구비율", "Lock / Snapshot" |
| 카드 숫자 | text-2xl | **text-3xl** | 0%, 0 등 핵심 수치 |
| 카드 설명 | text-xs | **text-sm** | "레코드 대비 증빙 연결" 등 |
| 보조 문구 | text-xs | **text-sm** | "Phase 2 백엔드 연동 예정" |
| 테이블 헤더 | text-sm | **text-base** | 배출량별 감사 추적 테이블 |
| 테이블 본문 | text-sm | **text-base** | 요건 항목, 상태 등 |

### 3.2 가독성 보강

- **행간**: `leading-relaxed` (1.625) 또는 `leading-loose` (2) 적용
- **자간**: 한글 본문 `tracking-normal`, 영문 라벨 `tracking-wide`
- **대비**: 본문 `text-slate-800`, 보조 `text-slate-600` (기존 text-slate-500보다 강화)
- **굵기**: 제목 `font-bold`, 카드 숫자 `font-extrabold`

### 3.3 대시보드 카드별 상세

| 카드 | 제목 | 숫자 | 설명 |
|------|------|------|------|
| 증빙 구비율 | text-sm font-semibold | text-3xl font-extrabold | text-sm |
| 주요 변경 요약 | text-sm font-semibold | - | text-sm (2줄) |
| 결재 완료율 | text-sm font-semibold | - | text-sm |
| Lock / Snapshot | text-sm font-semibold | text-3xl font-extrabold | text-sm |

---

## 4. 적용 범위

### 4.1 수정 대상 컴포넌트

| 파일 | 변경 내용 |
|------|-----------|
| `AuditNav.tsx` | 다크 테마, 글자 크기(text-base), GHG 공시 사이드바 스타일 |
| `AuditDashboard.tsx` | 제목 text-xl, 카드 text-sm/3xl, 설명 text-sm |
| `DataLockManager.tsx` | 섹션 제목 text-base, 본문 text-sm |
| `EmissionTrailViewer.tsx` | 테이블 text-base, 상세 패널 text-sm |
| `AuditTrailViewer.tsx` | 제목·설명 text-base |
| `EvidenceIntegrityView.tsx` | 제목·본문 text-base |
| `LineageViewer.tsx` | 제목·본문 text-base |
| `AuditorView.tsx` | 제목·설명 text-base |
| `AuditPackageExport.tsx` | 제목·설명 text-base |
| `IFRSAuditView.tsx` | 메인 콘텐츠 패딩·최소 폰트 유지 |

### 4.2 공통 원칙

- **최소 본문 크기**: text-sm (14px) 이상
- **라벨/보조**: text-xs 사용 지양, text-sm 권장
- **숫자 강조**: text-2xl 이상, font-bold 이상

### 4.3 아이콘 및 비주얼 (전문성)

| 항목 | 적용 | 비고 |
|------|------|------|
| **아이콘 스타일** | Lucide outline, stroke 1.5~2, 16~18px | 지나치게 굵거나 둥근 아이콘 지양 |
| **아이콘 사용** | 필요 최소한만. 네비는 텍스트 위주 가능 | GHG 공시 사이드바는 아이콘 없음 — 동일하게 |
| **대시보드 카드** | 숫자·라벨 중심. 아이콘은 작게, 또는 생략 | 장식용 아이콘 자제 |
| **색상** | slate, primary 최소 사용 | 밝은 파스텔·그라데이션 지양 |

---

## 5. 구현 순서

| 순서 | 작업 | 예상 변경량 |
|------|------|-------------|
| 1 | AuditNav 다크 테마 + 글자 크기 | 1파일 |
| 2 | AuditDashboard 카드 글자 크기 | 1파일 |
| 3 | 나머지 Audit 뷰 컴포넌트 글자 크기 | 7파일 |

---

## 6. 요약

1. **비주얼 톤**: **전문적·세련됨** 지향. 이모지·과한 장식·AI 슬롭 느낌 지양
2. **네비게이션**: GHG 공시 좌측 사이드바와 동일한 **다크 테마** (slate-800, slate-700, slate-600), 아이콘 최소 또는 텍스트만
3. **글자 크기**: 전반적으로 **1단계 확대** (text-xs → text-sm, text-sm → text-base, text-2xl → text-3xl)
4. **가독성**: 대비 강화, 행간·굵기 조정
5. **일관성**: GHG 산정·공시 탭과 시각적 통일, Corporation/Enterprise 수준
