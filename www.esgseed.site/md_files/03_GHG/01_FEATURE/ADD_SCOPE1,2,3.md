# 온실가스 산정 페이지 기능 추가 & 디자인 유지 전략
## 1. 핵심 목표 (디자인 변경 최소화)
- GhgCalculationPage.tsx의 **기존 UI/레이아웃/스타일 100% 유지** (Tailwind 클래스, 색상, 폰트, 간격, 테이블 구조 등 그대로)
- 파일 쪼개기/대규모 리팩토링 금지 → 기존 return 구조 안에서 기능만 추가
- 새 기능 추가 시 기존 컴포넌트 위/아래/옆에 **비슷한 스타일로 끼워넣기** (기존 클래스 복사·붙여넣기 우선)
- @src/components/GhgCalculationPage.tsx (또는 GhgCalculationPage22.tsx) 참고: 기존 디자인 느낌 그대로 유지
- UI가 "이상하게 바뀌는" 문제 방지 → shadcn/ui 등 새 컴포넌트 사용 시 커스터마이징해서 기존 느낌 맞춤 (rounded-md 이하, flat/high-contrast)

## 2. 추가 기능 목록 (순서대로 구현 추천)
### 공통 기능 (Scope 1 & 2)
1. **상단 필터 패널 (GHGFilterPanel)**
   - 위치: 페이지 최상단 또는 Scope1/2 섹션 직전에 삽입 (기존 <div className="..."> 안에)
   - 내용: 년/월 (DatePicker or Select), 사업장 (MultiSelect), 에너지원/연료 (MultiSelect)
   - 스타일: 기존 테이블/카드와 동일한 border, bg, padding 사용 (e.g. bg-white border-gray-200 rounded-md shadow-sm)
   - 버튼: "적용" (primary 색상), "초기화" (gray)
   - 상태: 로컬 useState로 관리 (Zustand는 아직 안 써도 OK)

2. **EMS 데이터 가져오기 버튼**
   - 위치: 필터 패널 옆 또는 각 Scope 입력 폼 상단에 작은 버튼으로 추가
   - 텍스트: "EMS 데이터 불러오기"
   - 스타일: 기존 Button 클래스 그대로 (e.g. bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded)
   - 로직: 필터 값으로 axios.get('/api/ems?...') 호출 → 성공 시 입력 필드 자동 채움
   - 에러: useToast()로 "불러오기 실패" 알림 (shadcn/ui toast 사용 시 기존 색상 맞춤)

3. **엑셀 업로드 기능 (ExcelUploader)**
   - 위치: 필터 패널 아래 또는 각 Scope 입력 영역 상단에 삽입
   - UI: 기존 스타일의 <Button> + 숨겨진 <input type="file" accept=".xlsx"> 또는 react-dropzone + shadcn Button 조합
     - 드래그 영역: border-dashed border-2 border-gray-300 rounded-md p-6 text-center (기존 디자인과 유사하게)
     - 버튼 텍스트: "엑셀 업로드" 또는 "파일 끌어오기 / 선택"
   - 파싱: xlsx 라이브러리 사용 → SheetJS로 데이터 읽기
   - 검증: 필수 컬럼 체크 → 미리보기 테이블 (기존 테이블 스타일 복사)
   - 적용: 확인 시 form 입력값 업데이트
   - 스타일 팁: 테이블 미리보기는 기존 <table className="..."> 그대로 복사해서 사용

### Scope 3 전용 기능 (최소 변경)
4. **영수증 첨부 기능 (ReceiptAttachment)**
   - 위치: 기존 Scope3 각 항목(행/섹션) 오른쪽 또는 아래에 버튼/드롭존 추가
   - UI: 작은 버튼 "영수증 첨부" (기존 버튼 스타일) + 첨부 후 미리보기 (img or <a> 링크)
   - 로직: react-dropzone + File 업로드 → FormData로 /api/receipt/upload POST → URL 반환 → form state에 저장
   - 미리보기: 이미지/PDF 썸네일 (기존 이미지 스타일 맞춤, rounded-sm shadow-sm 등)
   - 최소 변경: 기존 입력 폼 구조 깨지 않게 옆에만 추가

## 3. 디자인 유지 원칙 (꼭 지켜야 함)
- Tailwind 클래스 변경 금지: 기존 클래스 그대로 복사 (e.g. px-4 py-3 bg-white border border-gray-200 rounded-md text-sm)
- 새 컴포넌트 추가 시 rounded-xl 이상, shadow-lg, gradient 등 피함 → rounded-md, shadow-sm 수준 유지
- 색상 팔레트: 기존 primary/accent 색상 그대로 사용 (e.g. bg-blue-600 → 변경 금지)
- 간격/레이아웃: space-y-4, gap-4 등 기존 패턴 유지
- shadcn/ui 사용 시: 기본 테마 오버라이드해서 flat/minimal하게 (border-radius: 0.375rem 이하, no heavy shadow)
- 로딩/에러: 기존 spinner 또는 skeleton 스타일 복사 (새 spinner 추가 금지)

## 4. 작업 순서 (Cursor Plan mode 추천, 하나씩 Apply)
1. **필터 패널 추가** (상단에 GHGFilterPanel JSX 삽입)
   - 기존 return 최상단에 <div className="mb-6">...</div> 형태로 끼워넣기
2. **EMS 버튼 + 로직** (필터 옆에 버튼 추가 → onClick fetch)
3. **엑셀 업로드 영역** (필터 아래에 드래그 존 + 파싱 로직)
   - react-dropzone + Button 조합 → 기존 스타일에 맞춤
4. **Scope3 영수증 첨부** (각 항목에 버튼/미리보기 추가)
5. **전체 테스트** (기존 디자인 깨지지 않았는지, 기능 동작 확인)

## 5. Cursor 프롬프트 예시 (이대로 복사해서 사용)
"@refactor-ghg-features-only.md 따라 GhgCalculationPage.tsx에 상단 필터 패널만 추가해줘. 기존 UI 클래스 그대로 유지하고, 새 div에 mb-6 p-4 bg-white border-gray-200 rounded-md 넣어서 자연스럽게. shadcn Select/DatePicker 사용 시 기존 색상/스타일 맞춰."

각 단계 끝날 때 "추가 완료. 디자인 변화 없음 확인. 다음 기능으로?" 출력 요청.