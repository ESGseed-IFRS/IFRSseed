# IFRS 탭 제거 → SR 보고서만 작성되게 변경 전략

## 목표
- **현재:** 리포트 화면에 세부 탭 2개 (SR 보고서 작성 | IFRS 보고서 작성)
- **변경 후:** SR 보고서만 작성되는 단일 화면 (탭 없음)

---

## 1. 삭제할 파일 (완전 삭제)

| 순서 | 경로 | 설명 |
|------|------|------|
| 1 | `src/app/(main)/report/ifrs/page.tsx` | IFRS 보고서 전용 페이지 컴포넌트 |
| 2 | `src/features/report/data/ifrs-data.ts` | IFRS/KSSB 목차·페이지별 공시 기준 매핑 데이터 |
| 3 | `src/features/report/components/ifrs/IFREditor.tsx` | IFRS 전용 에디터 컴포넌트 |
| 4 | `src/app/(main)/report/sr/page.tsx` | (선택) SR 전용 라우트 페이지 — 아래 2번에서 report/page.tsx로 통합 시 삭제 |

**참고:** `components/ifrs/` 폴더에 `IFREditor.tsx`만 있다면 폴더 전체 삭제.

---

## 2. 수정할 파일 및 변경 내용

### 2-1. `src/app/(main)/report/page.tsx` (핵심 변경)

**삭제할 부분**
- 탭 상태·타입: `ReportTab`, `useState<ReportTab>('sr')`, `setActiveTab`
- 상단 탭 바 UI 전체 (SR 보고서 작성 / IFRS 보고서 작성 버튼이 있는 `sticky` 영역)
- `IFRSReportPage` import 및 `activeTab === 'ifrs'` 블록
- `SRReportPage`를 조건부 렌더하던 `activeTab === 'sr'` 블록의 조건·hidden 처리

**유지·변경**
- `SRReportPage`만 풀페이지로 렌더 (탭 없이 바로 SR 콘텐츠만 표시)

**결과 예시 (수정 후):**
- `import SRReportPage from './sr/page';` 유지 시:  
  `return ( <div className="min-h-screen bg-background"><SRReportPage /></div> );`
- 또는 `sr/page.tsx`를 제거하고 그 내용을 `report/page.tsx`에 인라인 (한 파일로 통합).

---

### 2-2. `src/features/report/hooks/useReportLogic.ts`

**삭제할 부분**
- `import { ifrsPageStandardMappings } from '../data/ifrs-data';`  
  (hook 내부에서 미사용이면 제거)

**선택**
- `import { srPageStandardMappings } from '../data/sr-data';` 도 hook 본문에서 사용하지 않으면 제거 (dead code 정리).

---

### 2-3. 기타 참조 정리

- **`RightChecklist`**  
  IFRS 페이지에서만 `relevantStandards.filter((s) => s.type === 'IFRS' || s.type === 'KSSB')` 사용.  
  SR만 남기면 해당 호출부가 사라지므로 **RightChecklist.tsx 수정 불필요**.

- **`disclosureStandards.ts`**  
  `IFRS S1-78`, `ESRS BP-2` 등은 SR 데이터에서도 사용할 수 있으므로 **유지**.

- **`features/report/types.ts`**  
  `DisclosureStandard.type`에 `'IFRS' | 'KSSB'`가 있어도 SR만 있어도 타입 호환상 **유지 가능**.  
  (나중에 IFRS 전용 필드를 완전히 정리할 때만 타입에서 제거 검토.)

---

## 3. 삭제·수정 순서 권장

1. **수정:** `report/page.tsx`  
   - 탭 제거, SR만 렌더하도록 변경 후 동작 확인.
2. **삭제:** `report/ifrs/page.tsx`
3. **삭제:** `features/report/data/ifrs-data.ts`
4. **삭제:** `features/report/components/ifrs/IFREditor.tsx` (또는 `ifrs` 폴더 전체)
5. **수정:** `useReportLogic.ts`  
   - `ifrs-data` import 제거 (필요 시 `sr-data` 미사용 import도 제거).
6. **(선택)** `report/sr/page.tsx` 삭제 후, 그 내용을 `report/page.tsx`로 이전해 SR을 한 파일에서만 관리.

---

## 4. 건드리지 않는 부분

- **GHG 산정** (`ghg-calculation`, `IFRSAuditView`, `Step4Results` 등):  
  “IFRS 감사대응” 등은 **리포트 탭**과 별도 기능이므로 이번 작업 범위에서 제외.
- **네비게이션** (“SR 작성” → `/report`):  
  그대로 두면 됨. 라벨/경로 변경 없음.
- **최종보고서·콘텐츠·로그인·메인 페이지**의 “IFRSseed”, “IFRS 기준” 등 문구:  
  제품/브랜드·설명용이므로 이번 전략에서 제외.
- **reportStore**의 `PreviewSection.ifrsCode`, **content 페이지**의 IFRS S2 관련 로직:  
  SR 보고서 “작성” 플로우와 별개이므로 유지.

---

## 5. 요약 체크리스트

| 단계 | 작업 | 대상 |
|------|------|------|
| 1 | 탭 제거, SR만 렌더 | `report/page.tsx` |
| 2 | 파일 삭제 | `report/ifrs/page.tsx` |
| 3 | 파일 삭제 | `features/report/data/ifrs-data.ts` |
| 4 | 파일/폴더 삭제 | `features/report/components/ifrs/` (IFREditor.tsx) |
| 5 | import 정리 | `useReportLogic.ts` (ifrs-data 제거) |
| 6 | (선택) SR 단일 진입점 | `report/sr/page.tsx` 삭제 후 내용을 `report/page.tsx`로 통합 |

이 순서대로 진행하면 세부 탭 없이 **SR 보고서만 작성**되도록 변경할 수 있습니다.
