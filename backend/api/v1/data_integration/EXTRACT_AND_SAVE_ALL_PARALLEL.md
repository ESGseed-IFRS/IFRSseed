# 통합 병렬 저장 API 가이드

## 엔드포인트

```
POST /api/v1/data-integration/sr-agent/extract-and-save/all-parallel
```

## 개요

단일 API 호출로 SR(지속가능경영보고서)의 모든 데이터를 병렬로 추출·저장합니다.

### 워크플로우

```
1. PDF 다운로드 (SRAgent)
   ↓
2. 메타데이터 저장 (historical_sr_reports)
   ↓
3. 병렬 저장 (asyncio.gather)
   ├─ 인덱스 (sr_report_index)
   ├─ 본문 (sr_report_body)
   └─ 이미지 (sr_report_images)
   ↓
4. VLM 보강 (선택적, enable_vlm_enrichment=true)
```

### 장점

- ✅ **1회 PDF 다운로드**: 동일한 PDF bytes를 재사용
- ✅ **병렬 처리**: index/body/images 동시 저장으로 성능 향상
- ✅ **완전한 결과**: 4개 테이블에 모든 데이터 저장
- ✅ **에러 추적**: 각 에이전트별 성공/실패 상태 개별 반환

---

## 요청 (Request)

### 스키마

```json
{
  "company_id": "string (필수)",
  "company": "string (필수)",
  "year": "integer (필수, 2015-2030)",
  "image_output_dir": "string (선택)",
  "enable_vlm_enrichment": "boolean (선택, 기본: false)"
}
```

### 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `company_id` | string | ✅ | companies 테이블의 UUID |
| `company` | string | ✅ | 회사명 (예: "삼성에스디에스") |
| `year` | integer | ✅ | 보고서 연도 (2015-2030) |
| `image_output_dir` | string | ❌ | 이미지 저장 경로 (SR_IMAGE_STORAGE=disk일 때만) |
| `enable_vlm_enrichment` | boolean | ❌ | true면 이미지 저장 후 자동 VLM 보강 (OPENAI_API_KEY 필요) |

### 예시

```bash
curl -X POST "http://localhost:8000/api/v1/data-integration/sr-agent/extract-and-save/all-parallel" \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "550e8400-e29b-41d4-a716-446655440000",
    "company": "삼성에스디에스",
    "year": 2024,
    "enable_vlm_enrichment": false
  }'
```

---

## 응답 (Response)

### 스키마

```json
{
  "success": "boolean",
  "message": "string",
  "report_id": "string | null",
  
  "fetch_success": "boolean",
  "fetch_message": "string | null",
  
  "historical_sr_reports": "object | null",
  
  "index_saved_count": "integer",
  "body_saved_count": "integer",
  "images_saved_count": "integer",
  
  "index_agent_success": "boolean | null",
  "body_agent_success": "boolean | null",
  "images_agent_success": "boolean | null",
  
  "index_errors": "array",
  "body_errors": "array",
  "images_errors": "array",
  
  "images_vlm_auto_success": "boolean | null",
  "images_vlm_auto_message": "string | null",
  "images_vlm_auto_updated": "integer | null",
  "images_vlm_auto_skipped": "integer | null"
}
```

### 필드 설명

#### 전체 상태
- `success`: 모든 단계(fetch + meta + index + body + images)가 성공했는지
- `message`: 전체 결과 요약 메시지
- `report_id`: 생성된 보고서 UUID (historical_sr_reports.id)

#### PDF 다운로드
- `fetch_success`: PDF 다운로드 성공 여부
- `fetch_message`: 다운로드 단계 메시지

#### 메타데이터
- `historical_sr_reports`: 저장된 메타데이터 객체

#### 저장 결과
- `index_saved_count`: sr_report_index에 저장된 행 수
- `body_saved_count`: sr_report_body에 저장된 행 수
- `images_saved_count`: sr_report_images에 저장된 행 수

#### 에이전트 상태
- `index_agent_success`: 인덱스 에이전트 성공 여부
- `body_agent_success`: 본문 에이전트 성공 여부
- `images_agent_success`: 이미지 에이전트 성공 여부

#### 에러 목록
- `index_errors`: 인덱스 저장 중 발생한 에러 배열
- `body_errors`: 본문 저장 중 발생한 에러 배열
- `images_errors`: 이미지 저장 중 발생한 에러 배열

#### VLM 보강 (선택적)
- `images_vlm_auto_success`: VLM 보강 성공 여부
- `images_vlm_auto_message`: VLM 보강 메시지
- `images_vlm_auto_updated`: VLM으로 갱신된 행 수
- `images_vlm_auto_skipped`: 스킵된 행 수

### 성공 응답 예시

```json
{
  "success": true,
  "message": "모든 테이블 저장 완료 | report_id=abc-123-def, index=45건, body=120건, images=23건",
  "report_id": "abc-123-def-456-ghi",
  
  "fetch_success": true,
  "fetch_message": "PDF 다운로드 완료",
  
  "historical_sr_reports": {
    "id": "abc-123-def-456-ghi",
    "company_id": "550e8400-e29b-41d4-a716-446655440000",
    "report_year": 2024,
    "report_name": "삼성에스디에스 2024 지속가능경영보고서",
    "source": "web_search",
    "total_pages": 150,
    "index_page_numbers": [138, 139, 140]
  },
  
  "index_saved_count": 45,
  "body_saved_count": 120,
  "images_saved_count": 23,
  
  "index_agent_success": true,
  "body_agent_success": true,
  "images_agent_success": true,
  
  "index_errors": [],
  "body_errors": [],
  "images_errors": [],
  
  "images_vlm_auto_success": null,
  "images_vlm_auto_message": null,
  "images_vlm_auto_updated": null,
  "images_vlm_auto_skipped": null
}
```

### 부분 실패 응답 예시

```json
{
  "success": false,
  "message": "본문 실패(페이지 파싱 오류) | report_id=abc-123, index=45건, body=0건, images=23건",
  "report_id": "abc-123-def-456-ghi",
  
  "fetch_success": true,
  "fetch_message": "PDF 다운로드 완료",
  
  "historical_sr_reports": { ... },
  
  "index_saved_count": 45,
  "body_saved_count": 0,
  "images_saved_count": 23,
  
  "index_agent_success": true,
  "body_agent_success": false,
  "images_agent_success": true,
  
  "index_errors": [],
  "body_errors": [
    {
      "detail": "Docling 파싱 실패: PDF 손상"
    }
  ],
  "images_errors": [],
  
  "images_vlm_auto_success": null,
  "images_vlm_auto_message": null,
  "images_vlm_auto_updated": null,
  "images_vlm_auto_skipped": null
}
```

---

## 기존 엔드포인트와의 비교

### 기존 방식 (순차 호출)

```bash
# 1단계: 메타데이터
POST /extract-and-save/metadata
→ report_id 획득

# 2단계: 인덱스
POST /extract-and-save/index
→ PDF 다시 다운로드

# 3단계: 본문
POST /extract-and-save/body
→ PDF 다시 다운로드

# 4단계: 이미지
POST /extract-and-save/images
→ PDF 다시 다운로드
```

**문제점**:
- ❌ PDF를 4번 다운로드 (네트워크 비용, 시간 낭비)
- ❌ 순차 처리로 전체 소요 시간 길어짐
- ❌ 각 단계마다 API 호출 필요 (클라이언트 복잡도 증가)

### 새 방식 (병렬 처리)

```bash
# 1회 호출로 모든 테이블 저장
POST /extract-and-save/all-parallel
```

**장점**:
- ✅ PDF 1회만 다운로드
- ✅ index/body/images 병렬 저장
- ✅ 단일 API 호출로 완료
- ✅ 전체 소요 시간 최소화

---

## 성능

### 예상 소요 시간 (150페이지 SR 보고서 기준)

| 단계 | 소요 시간 | 비고 |
|------|----------|------|
| PDF 다운로드 | 5-10초 | 네트워크 속도 의존 |
| 메타데이터 저장 | 1-2초 | PyMuPDF 파싱 + LLM 검토 |
| **병렬 저장** | **30-60초** | **index/body/images 동시 실행** |
| - 인덱스 파싱 | 10-20초 | Docling 표 추출 |
| - 본문 파싱 | 30-60초 | Docling/LlamaParse/PyMuPDF 폴백 |
| - 이미지 추출 | 5-10초 | PyMuPDF xref 기반 |
| VLM 보강 (선택) | 20-40초 | OpenAI API 호출 수 의존 |

**총 소요 시간**: 약 1-2분 (기존 순차 방식의 1/3 수준)

---

## 에러 처리

### 병렬 실행 전략

- `asyncio.gather(return_exceptions=True)` 사용
- **하나의 에이전트가 실패해도 나머지는 계속 실행**
- 각 에이전트의 성공/실패 상태를 개별 추적

### 예시: 본문 파싱만 실패한 경우

```json
{
  "success": false,
  "message": "본문 실패(Docling 오류) | report_id=..., index=45건, body=0건, images=23건",
  
  "index_agent_success": true,
  "body_agent_success": false,  // 본문만 실패
  "images_agent_success": true,
  
  "index_saved_count": 45,  // 인덱스는 저장됨
  "body_saved_count": 0,     // 본문은 0건
  "images_saved_count": 23,  // 이미지는 저장됨
  
  "body_errors": [
    {"detail": "Docling parsing failed"}
  ]
}
```

이 경우:
- ✅ `historical_sr_reports`, `sr_report_index`, `sr_report_images`는 정상 저장
- ❌ `sr_report_body`만 비어있음
- 🔄 본문만 다시 시도하려면: `POST /extract-and-save/body-agentic` (pdf_bytes_b64 필요)

---

## 환경 변수

### 필수
- `GROQ_API_KEY`: SRAgent에서 웹 검색용 LLM 사용
- `TAVILY_API_KEY`: 웹 검색 API

### 선택
- `OPENAI_API_KEY`: LLM 검토(메타데이터) 및 VLM 보강(이미지)
- `LLAMAPARSE_API_KEY`: 본문 파싱 폴백용 (Docling 실패 시)
- `SR_IMAGE_STORAGE`: `memory`(기본) | `disk` | `s3`
- `SR_IMAGE_OUTPUT_DIR`: disk 모드일 때 이미지 저장 경로

---

## 사용 시나리오

### 1. 최소 구성 (VLM 없음)

```json
{
  "company_id": "...",
  "company": "삼성에스디에스",
  "year": 2024
}
```

결과: 메타 + 인덱스 + 본문 + 이미지(메타만) 저장

### 2. VLM 보강 포함

```json
{
  "company_id": "...",
  "company": "삼성에스디에스",
  "year": 2024,
  "enable_vlm_enrichment": true
}
```

결과: 위 + 이미지에 caption_text, image_type 자동 입력

### 3. 디스크 이미지 저장

```json
{
  "company_id": "...",
  "company": "삼성에스디에스",
  "year": 2024,
  "image_output_dir": "/data/images/sr_reports"
}
```

결과: 이미지 파일도 디스크에 저장 (환경변수 `SR_IMAGE_STORAGE=disk` 필요)

---

## 참고 문서

- [PDF_PARSING_IN_MEMORY.md](../../../domain/v1/data_integration/docs/PDF_PARSING_IN_MEMORY.md)
- [SR_BODY_PARSING_DESIGN.md](../../../domain/v1/data_integration/docs/body/SR_BODY_PARSING_DESIGN.md)
- [SR_INDEX_PARSING_LLM_BRIEF.md](../../../domain/v1/data_integration/docs/index/SR_INDEX_PARSING_LLM_BRIEF.md)
- [SR_IMAGES_PARSING_DESIGN.md](../../../domain/v1/data_integration/docs/images/SR_IMAGES_PARSING_DESIGN.md)
