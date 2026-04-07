# Holding Editor ↔ reports/create 연동 확정 명세

본 문서는 `HoldingPageByPageEditor.tsx`에서 사용자 입력(`category`, `prompt`, `dp_ids`)을 조합해  
`POST /ifrs-agent/reports/create`를 호출하고, 응답(특히 멀티모달 추천)을 화면에 안정적으로 반영하는 **구현 확정안**이다.

연관 설계 문서:
- `IMAGE_LAYOUT_RECOMMENDATION_DESIGN.md` (레이아웃/이미지 추천 출력 정책)

---

## 1) 목표

1. 프론트 입력을 아래 payload로 일관되게 전송한다.

```json
{
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "category": "임직원 채용",
  "prompt": "위 카테고리을 기준으로 ...",
  "dp_ids": ["GRI3-3-3-a", "GRI3-3-3-c"],
  "ref_pages": {},
  "max_retries": 3
}
```

2. 응답 `generated_text`와 `layout.blocks`(있을 때)를 분리 렌더한다.
3. 기존 편집 UX(페이지별 본문/블록 편집)와 충돌 없이 점진적으로 통합한다.

---

## 2) 현재 UI 요소 ↔ API 필드 매핑 (확정)

대상 파일: `frontend/src/app/(main)/sr-report/components/holding/HoldingPageByPageEditor.tsx`

### 2.1 `category`

- 현재 표시 위치: `PAGE {selectedPage.page} · {selectedPage.section}` 근처 헤더 영역
- 확정: `category`는 **페이지 title 또는 별도 입력값(categoryInput)** 사용
  - 기본값: `selectedPage.title`
  - 사용자가 수정 가능해야 함 (input 1개 추가)

권장 우선순위:
1) `categoryInput.trim()`이 있으면 사용  
2) 없으면 `selectedPage.title.trim()`  
3) 최종 fallback: `selectedPage.section`

### 2.2 `dp_ids`

- 현재 위치: standards 칩 편집 영역(추가/삭제/수정 지원)
- 확정: `selectedPage.standards`를 그대로 `dp_ids`로 전송
- 전송 전 정규화:
  - trim
  - 빈 문자열 제거
  - 중복 제거

### 2.3 `prompt`

- 현재 위치: 본문 편집 textarea
- 확정: 본문 편집과 충돌 방지를 위해 **프롬프트 입력 상태(promptInput)** 를 분리
  - 초기값: `currentText`를 복사하지 않음 (서로 의미 다름)
  - 플레이스홀더: “보고서 작성 지시를 입력하세요”

### 2.4 `company_id`

- 확정: 로그인/세션에서 주입
- 금지: 컴포넌트 하드코딩

### 2.5 `ref_pages`

- 1차 구현: `{}` 고정
- 2차 확장: 페이지 선택 기반 참조 전달 (`{ "2024": selectedPage.page }` 등)

### 2.6 `max_retries`

- 1차 구현: `3` 고정
- 2차 확장: 설정 UI(숫자 입력)로 노출

---

## 3) API 호출 규약

## 3.1 Endpoint

- `POST http://localhost:9005/ifrs-agent/reports/create`
- 권장: `NEXT_PUBLIC_IFRS_AGENT_BASE_URL` 기반으로 구성
  - 예: `${baseUrl}/ifrs-agent/reports/create`

## 3.2 Request body 생성 로직

```ts
const body = {
  company_id,
  category: resolvedCategory,
  prompt: promptInput.trim(),
  dp_ids: uniqueDpIds,
  ref_pages: {},
  max_retries: 3,
};
```

## 3.3 사전 검증

- `company_id` 없으면 호출 금지 + 사용자 안내
- `category` 비어 있으면 호출 금지
- `prompt` 비어 있으면 호출 금지
- `dp_ids.length === 0`이면 경고 배지 표시(호출은 허용 가능)

---

## 4) 응답 스키마 수용 전략

백엔드는 확장 중이므로, 프론트는 **관대한 파서**를 사용한다.

```ts
type CreateReportResponse = {
  workflow_id?: string;
  status?: string;
  generated_text?: string;
  validation?: { is_valid?: boolean; errors?: string[]; warnings?: string[] };
  metadata?: Record<string, unknown>;
  references?: Record<string, unknown>;
  layout?: {
    version?: number;
    blocks?: Array<
      | { kind: "paragraph"; text?: string }
      | { kind: "table"; markdown?: string; note?: string }
      | {
          kind: "image_recommendation";
          image_ref?: string;
          role?: string;
          placement_hint?: string;
          rationale_ko?: string;
        }
    >;
  };
  image_recommendations?: Array<{
    image_ref?: string;
    role?: string;
    placement_hint?: string;
    rationale_ko?: string;
  }>;
  error?: string | null;
};
```

### 4.1 화면 반영 규칙

1. `generated_text`가 있으면:
   - 본문 편집 상태(`currentText` 해당 page key)에 반영
2. 에이전트 응답칸에는:
   - `generated_text` 요약 + `validation` 상태 + `workflow_id`/`status` 노출
3. `layout.blocks` 또는 `image_recommendations`가 있으면:
   - 별도 추천 패널에 구조화 렌더
   - 없으면 기존 텍스트 영역만 표시

---

## 5) 멀티모달 추천 렌더 규칙 (DESIGN 문서 정합)

`IMAGE_LAYOUT_RECOMMENDATION_DESIGN.md`의 옵션 B 기준:

- `kind: table`
  - 제목: “표 추천”
  - 본문: `markdown`
  - 보조: `note`

- `kind: image_recommendation`
  - 제목: `role`
  - 항목:
    - `image_ref`
    - `placement_hint`
    - `rationale_ko`

### 5.1 렌더 위치

- 현재 “문단생성 에이전트 응답” 박스 아래에 `추천 레이아웃` 섹션 추가
- `generated_text`와 추천 블록을 분리해서 보여야 사용자가 수정하기 쉽다

---

## 6) 상태 모델(프론트) 제안

```ts
type AgentUiState = {
  loading: boolean;
  error: string | null;
  rawResponse: CreateReportResponse | null;
  layoutBlocks: NonNullable<CreateReportResponse["layout"]>["blocks"];
};
```

페이지별 보관 권장:
- `pageTexts[pageKey]` (기존)
- `agentReplies[pageKey]` (기존 확장)
- `agentLayouts[pageKey]` (신규)

---

## 7) 구현 순서 (실수 방지 체크리스트)

1. 입력 분리
   - `promptInput`, `categoryInput` 상태 추가
2. payload 생성 함수 분리
   - `buildCreatePayload(selectedPage, promptInput, companyId)`
3. API 호출 함수 분리
   - `requestCreateReport(payload): Promise<CreateReportResponse>`
4. 응답 파싱 함수 분리
   - `extractLayoutBlocks(resp)` + `extractAgentSummary(resp)`
5. UI 반영
   - 본문/응답/추천 패널 각각 업데이트
6. 예외 처리
   - 네트워크 실패 / 4xx / 5xx / malformed JSON
7. 로딩 상태
   - 생성 버튼 disabled + spinner + 중복 클릭 방지

---

## 8) 오류/예외 정책

- 서버 에러 응답(`error`) 존재:
  - 본문 덮어쓰지 않음
  - 응답칸에 에러 표시

- `generated_text` 없음 + `layout`만 존재:
  - 추천 패널만 렌더
  - 본문은 기존 유지

- 추천 블록에 알 수 없는 `kind`:
  - 무시 + `console.warn` (개발 모드)

---

## 9) 검증 항목 (QA)

1. `category/prompt/dp_ids`가 payload에 정확히 담기는가
2. 페이지 변경 시 입력/응답 상태가 페이지별로 분리되는가
3. 생성 성공 시:
   - 본문 반영 OK
   - 응답칸 반영 OK
   - 추천 패널 반영 OK
4. 생성 실패 시:
   - 기존 본문 유지
   - 에러 메시지 노출
5. 빈 DP / 긴 프롬프트 / ref_pages 공백에서 예외 없이 동작하는가

---

## 10) 향후 확장

- `ref_pages` 선택 UI 연결
- `max_retries` 사용자 설정 노출
- 이미지 추천 클릭 시 에디터 블록 자동 삽입(인포그래픽/이미지 placeholder)
- 추천 레이아웃을 실제 페이지 배치 모델(`blocks`)로 변환하는 단축 액션

---

## 결론

현재 `HoldingPageByPageEditor`는 이미 `dp_ids` 편집과 응답 표시 베이스가 있으므로,  
**입력 분리(category/prompt)** + **API 연동 함수 분리** + **layout 블록 렌더 추가** 3가지를 적용하면  
`/ifrs-agent/reports/create` 연동과 멀티모달 추천 출력을 안정적으로 완성할 수 있다.

