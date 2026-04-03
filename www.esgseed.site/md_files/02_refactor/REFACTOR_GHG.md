# 온실가스 산정 페이지 리팩토링 & 기능 확장 작업 지시 (프론트엔드)

## 현재 상황
- 온실가스 산정 페이지가 너무 길어서 (Scope 1 + 2 + 3 모두 한 페이지에 있음)
- UX가 매우 안 좋고, 코드도 복잡해서 유지보수 어려움
- 목표: Scope 1, 2, 3을 별도 페이지/폴더로 분리
- Scope 1, 2는 데이터 입력 편의성 대폭 강화
- Scope 3는 최소 변경 (영수증 첨부 기능만 추가)

## 목표 폴더 구조 (제안)
src/features/ghg-calculation/
├── components/               # Scope 간 공통으로 쓸 컴포넌트
│   ├── GHGFilterPanel.tsx
│   ├── ExcelUploader.tsx
│   ├── EMSDataLoader.tsx
│   └── ReceiptAttachment.tsx
├── scope1/
│   ├── Scope1Page.tsx
│   ├── Scope1Form.tsx
│   ├── Scope1Filters.tsx
│   └── index.ts
├── scope2/
│   ├── Scope2Page.tsx
│   ├── Scope2Form.tsx
│   ├── Scope2Filters.tsx
│   └── index.ts
├── scope3/
│   ├── Scope3Page.tsx
│   ├── Scope3Form.tsx
│   ├── ReceiptAttachmentSection.tsx
│   └── index.ts
├── types/
│   └── ghg.types.ts          # 공통 타입 (EmissionData, FilterState 등)
└── index.ts                  # 메인 진입점 (Scope 선택 탭/네비게이션)

## 라우팅 구조 (예시)
- /ghg/scope1
- /ghg/scope2
- /ghg/scope3
또는 탭 형태로 한 페이지 안에 두는 것도 가능하지만, 분리된 페이지 추천

## Scope 1 & Scope 2에 반드시 넣어야 할 기능
1. 필터 패널 (상단 고정 또는 사이드바)
   - 년/월 선택 (단일 월 또는 범위 선택 가능)
   - 사업장 (multi-select)
   - 에너지원/연료 종류 (multi-select)
   - 적용 버튼 + 초기화 버튼

2. EMS 연동 버튼
   - "EMS 데이터 가져오기" 버튼
   - 클릭 시 현재 필터 조건으로 내부 EMS API 호출
   - 성공 시 자동으로 폼에 값 채움
   - 실패 시 토스트 알림 + 수동 입력 유도

3. 엑셀 업로드 기능
   - 드래그 앤 드롭 + 파일 선택 버튼
   - .xlsx 파일만 허용
   - 업로드 후 SheetJS(xlsx)로 파싱
   - 필수 컬럼 검증 (월, 사업장, 에너지원, 사용량 등)
   - 검증 통과 시 데이터 미리보기 테이블 보여주고 확인 버튼
   - 확인 시 form state에 반영 또는 바로 API로 전송

## Scope 3에 추가할 기능 (최소 변경)
- 기존 입력 폼 유지
- 각 항목(또는 섹션)마다 "영수증 첨부" 버튼/드롭존 추가
- 첨부된 파일 미리보기 (이미지/PDF)
- 파일은 FormData로 백엔드에 업로드 (별도 API 엔드포인트 예상)
- 업로드 완료 후 파일명 또는 링크를 form 데이터에 저장

## 기술 스택 가정 (없으면 맞춰서 제안해줘)
- React 18 + TypeScript
- 상태관리: Zustand 또는 Redux Toolkit (선호: Zustand)
- UI: shadcn/ui + tailwindcss (또는 MUI, Ant Design 등 기존에 쓰는 것)
- 라우팅: react-router-dom v6
- 파일 업로드: xlsx (SheetJS), react-dropzone
- API: axios + react-query 또는 tanstack-query

## 작업 순서 제안
1. 폴더 구조 생성 & 기존 코드 분할 (Scope1/2/3 페이지 각각 생성)
2. 공통 필터 컴포넌트 (GHGFilterPanel) 먼저 구현
3. Scope1Page와 Scope2Page에 필터 연결
4. 엑셀 업로드 기능 구현 (공통 컴포넌트로)
5. EMS 연동 버튼 & 로직 추가
6. Scope3에 영수증 첨부 영역 추가
7. 라우팅 또는 탭 네비게이션 연결
8. 기존 데이터 flow가 깨지지 않도록 주의 (가능하면 같은 API 그대로 사용)

## 추가 요청 사항
- 코드 작성 시 최대한 타입 안전하게 (TypeScript)
- 각 컴포넌트는 재사용성 고려
- 로딩 상태, 에러 처리, 토스트 알림 필수
- 주석은 한국어로 달아줘
- 가능하면 이전 온실가스 배출량 디자인을 유지해줘 @src/components/GhgCalculationPage22.tsx-참고해서서

지금 이 구조와 요구사항대로 리팩토링 시작해줘.
가장 먼저 만들어줘야 할 파일부터 순서대로 보여주면서 진행하면 좋겠어.
(예: 먼저 types → 공통 컴포넌트 → scope1 페이지 순 등)

