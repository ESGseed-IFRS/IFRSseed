# PDF 및 이미지 파싱 가이드

## 📚 관련 문서

이 문서를 읽기 전/후에 다음 문서를 함께 참고하세요:
- [DATA_COLLECTION.md](./DATA_COLLECTION.md) - 데이터 수집 전략
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 시스템 아키텍처 이해
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - 구현 가이드

---

## 1. 개요

SR 보고서와 기준서 PDF 문서를 벡터 DB에 저장하기 위해서는 다음 과정이 필요합니다:

1. **PDF 텍스트 추출**: PDF에서 텍스트를 추출
2. **청크 분할**: 긴 텍스트를 검색 가능한 크기로 분할
3. **임베딩 생성**: 텍스트를 벡터 임베딩으로 변환
4. **이미지 처리**: PDF의 이미지를 추출하고 설명 생성
5. **벡터 DB 저장**: 모든 청크를 벡터 DB에 저장

이 문서는 PDF 파싱부터 벡터 DB 저장까지의 전체 과정을 설명합니다.

### 1.1 목적

- **PDF 문서 인덱싱**: SR 보고서, 기준서 등을 벡터 DB에 저장
- **텍스트 검색 지원**: 벡터 유사도 검색을 통한 관련 문서 찾기
- **이미지 데이터 활용**: SR 보고서의 차트/그래프에서 데이터 추출
- **멀티모달 검색**: 텍스트와 이미지를 통합하여 검색
- **RAG Node 연동**: "온실가스 배출량 추이" 같은 쿼리로 관련 문서/차트 검색

### 1.2 전체 처리 흐름

```
PDF 파일 (report.pdf)
    ↓
┌─────────────────────────────────────────────────┐
│ 1. PDF 텍스트 파싱                               │
│    [PDFParserService.parse_pdf()]                │
│    - LlamaParse / Unstructured / PyMuPDF        │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ 2. 텍스트 청크 분할                              │
│    [PDFParserService.split_into_chunks()]       │
│    - chunk_size: 1000자                          │
│    - chunk_overlap: 200자                        │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ 3. 임베딩 생성                                   │
│    [EmbeddingService.generate_embeddings()]     │
│    - BGE-M3 모델 (1024차원)                      │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ 4. 이미지 추출 (선택적)                          │
│    [PDFParserService.extract_images()]          │
│    → images/report_p10_i0.png                   │
│    ↓                                            │
│    [ImageCaptionService.generate_caption()]      │
│    → "막대 그래프: 2022-2024년 배출량 추이"      │
│    ↓                                            │
│    [EmbeddingService.generate_embedding()]       │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ 5. 벡터 DB 저장                                  │
│    [VectorStoreRepository.save_chunks()]        │
│    - 텍스트 청크 + 이미지 청크 모두 저장          │
└─────────────────────────────────────────────────┘
    ↓
벡터 DB (PostgreSQL + pgvector)
```

---

## 2. PDF 텍스트 파싱

### 2.1 파서 종류

PDFParserService는 다음 3가지 파서를 순차적으로 시도합니다:

| 파서 | 우선순위 | 특징 | 요구사항 |
|------|---------|------|----------|
| **LlamaParse** | 1순위 | 표/구조화된 데이터 추출 우수 | `LLAMA_CLOUD_API_KEY` 필요 |
| **Unstructured** | 2순위 | 다양한 요소 타입 인식 | 로컬 실행 |
| **PyMuPDF** | 3순위 (Fallback) | 빠르고 안정적 | 로컬 실행 |

### 2.2 파싱 과정

```python
from ifrs_agent.service.pdf_parser_service import PDFParserService

parser = PDFParserService()

# PDF 텍스트 추출
text, parser_used = parser.parse_pdf(
    pdf_path="sr_report.pdf",
    parser_type="auto"  # "llamaparse", "unstructured", "pymupdf", "auto"
)

# 결과
# text: "전체 PDF 텍스트 내용..."
# parser_used: "llamaparse" (사용된 파서 이름)
```

**파서 선택 로직:**
1. `parser_type="auto"`인 경우, 사용 가능한 파서를 우선순위대로 시도
2. `parser_type`이 지정된 경우, 해당 파서만 사용
3. 모든 파서가 실패하면 `None` 반환

### 2.3 파서별 특징

#### **LlamaParse** (권장)
- **장점**: 표 추출, 구조화된 데이터 인식 우수
- **단점**: API 키 필요, 인터넷 연결 필요
- **사용 시나리오**: 표가 많은 SR 보고서, 데이터북

```python
# LlamaParse 사용
text, _ = parser.parse_pdf("report.pdf", parser_type="llamaparse")
```

#### **Unstructured**
- **장점**: 다양한 요소 타입 인식 (제목, 본문, 표 등)
- **단점**: 설치 복잡, 의존성 많음
- **사용 시나리오**: 복잡한 레이아웃의 PDF

```python
# Unstructured 사용
text, _ = parser.parse_pdf("report.pdf", parser_type="unstructured")
```

#### **PyMuPDF** (Fallback)
- **장점**: 빠르고 안정적, 추가 설정 불필요
- **단점**: 표/구조화된 데이터 추출 제한적
- **사용 시나리오**: 단순 텍스트 위주 PDF

```python
# PyMuPDF 사용
text, _ = parser.parse_pdf("report.pdf", parser_type="pymupdf")
```

---

## 3. 텍스트 청크 분할

### 3.1 청크 분할의 필요성

PDF 전체 텍스트를 그대로 벡터 DB에 저장하면:
- **임베딩 정확도 저하**: 너무 긴 텍스트는 의미가 희석됨
- **검색 정확도 저하**: 관련 없는 내용까지 검색됨
- **저장 효율성 저하**: 불필요한 데이터 저장

**해결책**: 텍스트를 의미 있는 단위로 분할 (청킹)

### 3.2 청크 분할 전략

```python
from ifrs_agent.service.pdf_parser_service import PDFParserService

parser = PDFParserService()

# 텍스트를 청크로 분할
chunks = parser.split_into_chunks(
    text="전체 PDF 텍스트...",
    chunk_size=1000,      # 청크 크기 (문자 수)
    chunk_overlap=200     # 청크 간 겹침 (문자 수)
)

# 결과 예시
# [
#     "첫 번째 청크 텍스트 (1000자)...",
#     "겹치는 부분 (200자) + 두 번째 청크 텍스트 (800자)...",
#     "겹치는 부분 (200자) + 세 번째 청크 텍스트 (800자)...",
#     ...
# ]
```

**청크 분할 특징:**
- **문장 경계 고려**: 문장 중간에서 자르지 않음
- **Overlap 적용**: 청크 간 200자 겹침으로 문맥 유지
- **최소 크기 보장**: 절반 이상이면 문장 경계에서 자름

### 3.3 청크 크기 설정

| 청크 크기 | 장점 | 단점 | 권장 사용 |
|----------|------|------|----------|
| **500자** | 세밀한 검색, 빠른 처리 | 문맥 부족 가능 | 짧은 문서 |
| **1000자** (기본) | 균형잡힌 검색 | - | 대부분의 경우 |
| **2000자** | 풍부한 문맥 | 검색 정확도 저하 가능 | 긴 문서 |

```python
# 설정 변경
chunks = parser.split_into_chunks(
    text=text,
    chunk_size=2000,  # 더 큰 청크
    chunk_overlap=400  # overlap도 비례하여 증가
)
```

---

## 4. 임베딩 생성

### 4.1 임베딩이란?

임베딩은 텍스트를 고차원 벡터로 변환한 것입니다. 의미적으로 유사한 텍스트는 벡터 공간에서 가까이 위치합니다.

**예시:**
```
"온실가스 배출량" → [0.123, 0.456, ..., 0.789] (1024차원)
"GHG emissions"   → [0.125, 0.458, ..., 0.791] (유사한 벡터)
"임직원 수"       → [0.789, 0.123, ..., 0.456] (다른 벡터)
```

### 4.2 BGE-M3 모델

현재 시스템은 **BGE-M3** 모델을 사용합니다:

- **차원**: 1024차원
- **특징**: 다국어 지원 (한국어 포함), Contrastive Learning 튜닝
- **모델**: `BAAI/bge-m3`

### 4.3 임베딩 생성 과정

```python
from ifrs_agent.service.embedding_service import EmbeddingService

embedding_service = EmbeddingService()

# 단일 텍스트 임베딩
embedding = embedding_service.generate_embedding(
    text="온실가스 배출량은 2024년 12,000 tCO2e를 기록했습니다.",
    normalize=True  # L2 정규화
)
# 결과: numpy array (1024차원)

# 여러 텍스트 배치 임베딩 (효율적)
embeddings = embedding_service.generate_embeddings(
    texts=["청크1", "청크2", "청크3"],
    normalize=True
)
# 결과: numpy array (3, 1024) - 3개 청크의 임베딩
```

**임베딩 생성 특징:**
- **L2 정규화**: 벡터 길이를 1로 정규화 (코사인 유사도 계산에 유리)
- **배치 처리**: 여러 텍스트를 한 번에 처리하여 효율성 향상
- **지연 로딩**: 모델은 최초 사용 시 로드 (메모리 절약)

### 4.4 임베딩 사용

임베딩은 벡터 유사도 검색에 사용됩니다:

```python
# 쿼리 임베딩 생성
query_embedding = embedding_service.generate_embedding("온실가스 배출량")

# 벡터 DB에서 유사한 청크 검색
results = vector_repository.search_by_vector(
    query_embedding.tolist(),
    top_k=10
)
# 결과: 유사도가 높은 상위 10개 청크
```

---

## 5. 아키텍처

### 5.1 서비스 구조

```
┌─────────────────────────────────────────────────────────┐
│              DocumentService (통합 서비스)               │
│         PDF 파싱부터 벡터 DB 저장까지 전체 프로세스 관리    │
└─────────────────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┬───────────┐
        │           │           │           │
        ▼           ▼           ▼           ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ PDFParser    │ │ ImageCaption │ │ Embedding    │ │ VectorStore  │
│ Service      │ │ Service      │ │ Service      │ │ Repository   │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
        │               │               │               │
        │               │               │               │
        ▼               ▼               ▼               ▼
  텍스트 추출      이미지 설명      임베딩 생성      벡터 DB 저장
  청크 분할        생성
  이미지 추출
```

### 5.2 서비스별 역할

#### **PDFParserService**
- **텍스트 파싱** (`parse_pdf`): PDF에서 텍스트 추출
- **청크 분할** (`split_into_chunks`): 텍스트를 검색 가능한 크기로 분할
- **이미지 추출** (`extract_images`): PDF에서 이미지 추출 및 파일 저장
- **기술**: LlamaParse, Unstructured, PyMuPDF

#### **EmbeddingService**
- **임베딩 생성** (`generate_embeddings`): 텍스트를 벡터 임베딩으로 변환
- **모델**: BGE-M3 (1024차원)
- **특징**: 배치 처리, L2 정규화

#### **ImageCaptionService**
- **이미지 설명 생성** (`generate_caption`): 이미지 파일을 텍스트 설명으로 변환
- **이미지 타입 분류** (`classify_image_type`): 차트/표/인포그래픽 등 분류
- **기술**: BLIP-2 (로컬 실행)

#### **VectorStoreRepository**
- **청크 저장** (`save_chunks`): DocumentChunk를 벡터 DB에 저장
- **벡터 검색** (`search_by_vector`): 유사도 기반 검색
- **기술**: PostgreSQL + pgvector

---

## 6. 이미지 파싱 구현 상세

### 6.1 이미지 추출 (PDFParserService)

```python
from ifrs_agent.service.pdf_parser_service import PDFParserService

parser = PDFParserService()

# PDF에서 이미지 추출
images = parser.extract_images(
    pdf_path="sr_report.pdf",
    output_dir="images",  # 선택적 (기본: PDF와 같은 디렉토리/images)
    min_size=1000  # 최소 이미지 크기 (픽셀, 기본값: 1000)
)

# 결과 예시
# [
#     {
#         "page": 10,
#         "index": 0,
#         "path": "images/sr_report_p10_i0.png",
#         "width": 800,
#         "height": 600,
#         "size_bytes": 125000
#     },
#     ...
# ]
```

**특징:**
- PyMuPDF를 사용하여 PDF에서 이미지 추출
- 너무 작은 이미지는 자동 필터링 (`min_size` 파라미터)
- 이미지 파일은 PNG 형식으로 저장
- 파일명 형식: `{pdf_name}_p{page}_i{index}.png`

### 6.2 이미지 설명 생성 (ImageCaptionService)

```python
from ifrs_agent.service.image_caption_service import ImageCaptionService

caption_service = ImageCaptionService()

# 이미지 설명 생성
description = caption_service.generate_caption(
    image_path="images/sr_report_p10_i0.png",
    model_type="auto"  # "blip", "auto"
)

# 결과 예시
# "막대 그래프로 2022년부터 2024년까지의 Scope 1 온실가스 배출량을 보여줍니다. 
#  2022년 15,000 tCO2e에서 2024년 12,000 tCO2e로 20% 감소 추세를 보입니다."

# 이미지 타입 분류
image_type = caption_service.classify_image_type("images/sr_report_p10_i0.png")
# 결과: "chart"
```

**지원 모델:**

1. **BLIP-2** (기본, 권장)
   - 로컬 실행 (GPU 사용 가능)
   - 오프라인 동작
   - 모델: `Salesforce/blip-image-captioning-base`
   - 초기 모델 로딩 시간 소요

2. **Fallback**
   - Vision 모델을 사용할 수 없을 때
   - 파일명에서 페이지 정보 추출
   - 기본 설명 생성 (예: "페이지 5의 이미지 또는 차트")

### 6.3 의미없는 이미지 필터링

SR 보고서에는 차트/그래프와 함께 사람 사진, 동물 사진 등 데이터와 무관한 이미지가 포함될 수 있습니다. 이러한 이미지는 벡터 DB에 저장하지 않도록 필터링합니다.

#### 6.3.1 필터링 로직

`ImageCaptionService.is_meaningful_image()` 메서드가 이미지 설명을 분석하여 의미있는 이미지인지 판단합니다:

```python
from ifrs_agent.service.image_caption_service import ImageCaptionService

caption_service = ImageCaptionService()

# 이미지 설명 생성
description = caption_service.generate_caption("image.png")

# 의미있는 이미지인지 확인
is_meaningful = caption_service.is_meaningful_image(description, "image.png")
```

#### 6.3.2 포함되는 이미지 (유용한 키워드)

다음 키워드가 포함된 이미지는 **포함**됩니다:

**데이터/분석 관련:**
- `chart`, `graph`, `table`, `diagram`, `figure`, `data`
- `statistics`, `statistic`, `trend`, `analysis`, `report`
- `metric`, `indicator`, `measurement`, `measure`, `value`
- `number`, `percentage`, `percent`, `ratio`, `comparison`
- `increase`, `decrease`, `growth`, `decline`, `change`

**ESG/지속가능성 관련:**
- `emission`, `carbon`, `energy`, `water`, `waste`, `recycle`
- `sustainability`, `esg`, `environmental`, `social`, `governance`
- `financial`, `performance`, `result`, `outcome`, `target`
- `goal`, `objective`, `strategy`, `plan`, `framework`

**구조/프로세스 관련:**
- `matrix`, `map`, `timeline`, `process`, `flow`, `structure`
- `organization`, `hierarchy`, `system`, `model`, `methodology`

**예시:**
- ✅ "A bar chart showing greenhouse gas emissions from 2022 to 2024"
- ✅ "Table displaying water consumption by region"
- ✅ "Sustainability framework diagram"
- ✅ "Timeline of ESG initiatives"

#### 6.3.3 제외되는 이미지

다음 키워드만 있고 유용한 키워드가 없는 이미지는 **제외**됩니다:

**제외 키워드:**
- `person`, `people`, `man`, `woman`, `child`, `children`
- `animal`, `dog`, `cat`, `bird`, `wildlife`
- `portrait`, `photo`, `picture`, `image`, `photograph`

**예시:**
- ❌ "A group of people standing together" (유용한 키워드 없음)
- ❌ "A portrait of a person" (유용한 키워드 없음)
- ❌ "Wildlife in nature" (유용한 키워드 없음)
- ✅ "People working on sustainability project" (sustainability 키워드 포함)

#### 6.3.4 필터링 사용법

`DocumentService.store_pdf_to_vector_db()`에서 필터링을 제어할 수 있습니다:

```python
from ifrs_agent.service.document_service import DocumentService

doc_service = DocumentService()

# 필터링 활성화 (기본값)
saved_count = doc_service.store_pdf_to_vector_db(
    pdf_path="sr_report.pdf",
    document_type="report",
    company_id="삼성전자",
    fiscal_year=2024,
    extract_images=True,
    filter_meaningless_images=True  # 기본값: True
)

# 필터링 비활성화 (모든 이미지 포함)
saved_count = doc_service.store_pdf_to_vector_db(
    pdf_path="sr_report.pdf",
    document_type="report",
    company_id="삼성전자",
    fiscal_year=2024,
    extract_images=True,
    filter_meaningless_images=False  # 필터링 비활성화
)
```

#### 6.3.5 최소 이미지 크기 필터링

너무 작은 이미지(아이콘, 로고 등)는 `image_min_size` 파라미터로 필터링합니다:

```python
# 최소 이미지 크기 설정 (width * height)
saved_count = doc_service.store_pdf_to_vector_db(
    pdf_path="sr_report.pdf",
    document_type="report",
    company_id="삼성전자",
    fiscal_year=2024,
    extract_images=True,
    image_min_size=1000  # 기본값: 1000 픽셀
    # 예: 30x30 = 900 픽셀 이미지는 제외됨
)
```

**권장 설정:**
- `image_min_size=1000`: 기본값, 작은 아이콘/로고 제외
- `image_min_size=500`: 더 많은 이미지 포함 (작은 차트도 포함)
- `image_min_size=5000`: 큰 이미지만 포함 (주요 차트/그래프만)

### 6.4 통합 사용 (DocumentService)

```python
from ifrs_agent.service.document_service import DocumentService

doc_service = DocumentService()

# PDF 저장 (이미지 포함)
saved_count = doc_service.store_pdf_to_vector_db(
    pdf_path="sr_report.pdf",
    document_type="report",
    company_id="삼성전자",
    fiscal_year=2024,
    extract_images=True  # 이미지 추출 활성화
)

# 자동 처리:
# 1. PDF에서 이미지 추출
# 2. 각 이미지에 대한 설명 생성
# 3. 설명 텍스트를 임베딩으로 변환
# 4. 벡터 DB에 저장
```

---

## 7. 전체 통합 프로세스

### 7.1 DocumentService.store_pdf_to_vector_db()

`DocumentService`는 PDF 파싱부터 벡터 DB 저장까지 전체 과정을 자동화합니다:

```python
from ifrs_agent.service.document_service import DocumentService

doc_service = DocumentService()

# PDF 저장 (텍스트 + 이미지)
saved_count = doc_service.store_pdf_to_vector_db(
    pdf_path="sr_report.pdf",
    document_type="report",
    company_id="삼성전자",
    fiscal_year=2024,
    chunk_size=1000,                # 청크 크기
    chunk_overlap=200,              # 청크 겹침
    parser_type="auto",              # 파서 타입
    extract_images=True,             # 이미지 추출 여부
    image_min_size=1000,             # 최소 이미지 크기 (픽셀)
    filter_meaningless_images=True  # 의미없는 이미지 필터링
)
```

**처리 단계:**

1. **PDF 텍스트 파싱**
   ```python
   text, parser_used = self.parser_service.parse_pdf(pdf_path, parser_type)
   ```

2. **텍스트 청크 분할**
   ```python
   chunks = self.parser_service.split_into_chunks(text, chunk_size, chunk_overlap)
   ```

3. **텍스트 임베딩 생성**
   ```python
   embeddings = self.embedding_service.generate_embeddings(chunks, normalize=True)
   ```

4. **텍스트 청크 객체 생성**
   ```python
   document_chunks = [
       DocumentChunk(
           chunk_text=chunk_text,
           embedding=embedding,
           ...
       )
       for chunk_text, embedding in zip(chunks, embeddings)
   ]
   ```

5. **이미지 추출 및 처리** (선택적)
   ```python
   if extract_images:
       # 이미지 추출 (크기 필터링)
       images = self.parser_service.extract_images(
           pdf_path,
           min_size=image_min_size
       )
       
       for img in images:
           # 이미지 설명 생성
           description = self.image_caption_service.generate_caption(img["path"])
           
           # 의미있는 이미지 필터링
           if filter_meaningless_images:
               if not self.image_caption_service.is_meaningful_image(description, img["path"]):
                   continue  # 제외
           
           # 임베딩 생성 및 청크 저장
           img_embedding = self.embedding_service.generate_embedding(description)
           image_chunks.append(DocumentChunk(...))
   ```

6. **벡터 DB 저장**
   ```python
   all_chunks = document_chunks + image_chunks
   saved_count = self.vector_repository.save_chunks(all_chunks)
   ```

### 7.2 처리 시간 예상

| 단계 | 시간 (100페이지 PDF 기준) |
|------|-------------------------|
| PDF 텍스트 파싱 | 5-10초 |
| 청크 분할 | <1초 |
| 텍스트 임베딩 생성 | 10-20초 (100개 청크) |
| 이미지 추출 | 2-5초 (20개 이미지) |
| 이미지 설명 생성 | 20-60초 (BLIP-2 모델) |
| 이미지 임베딩 생성 | 2-5초 |
| 벡터 DB 저장 | 5-10초 |
| **총 시간** | **약 1-2분** |

---

## 8. 데이터베이스 스키마

### 8.1 DocumentChunk 모델

이미지 관련 필드가 추가되었습니다:

```python
class DocumentChunk(Base):
    # 기존 필드
    chunk_text = Column(Text, nullable=False)  # 텍스트 또는 이미지 설명
    embedding = Column(Vector(1024))  # 텍스트 임베딩
    
    # 이미지 관련 필드 (선택적)
    image_path = Column(String(500), nullable=True)  # 이미지 파일 경로
    image_description = Column(Text, nullable=True)  # Vision 모델이 생성한 텍스트 설명
    image_type = Column(String(50), nullable=True)  # "chart", "table", "infographic", "photo", "diagram"
```

### 8.2 저장 형태

이미지는 다음 형태로 저장됩니다:

1. **텍스트 설명**: Vision 모델이 생성한 설명이 `chunk_text`에 저장
2. **이미지 경로**: `image_path`에 저장
3. **이미지 타입**: `image_type`에 저장 (chart, table 등)
4. **임베딩**: 설명 텍스트의 임베딩이 `embedding`에 저장 (기존 검색 활용)
5. **메타데이터**: `chunk_metadata`에 이미지 크기, 페이지 번호 등 저장

**예시 레코드:**

```json
{
    "chunk_id": 123,
    "document_path": "/path/to/sr_report.pdf",
    "chunk_text": "막대 그래프로 2022년부터 2024년까지의 Scope 1 온실가스 배출량을 보여줍니다...",
    "image_path": "images/sr_report_p10_i0.png",
    "image_description": "막대 그래프로 2022년부터 2024년까지의 Scope 1 온실가스 배출량을 보여줍니다...",
    "image_type": "chart",
    "page_number": 10,
    "chunk_metadata": {
        "content_type": "image",
        "image_width": 800,
        "image_height": 600,
        "image_size_bytes": 125000
    },
    "embedding": [0.123, 0.456, ...]  # 1024차원 벡터
}
```

---

## 9. 검색 활용

### 9.1 벡터 검색

이미지 설명이 텍스트로 저장되므로, 기존 텍스트 검색과 동일하게 사용할 수 있습니다:

```python
from ifrs_agent.service.document_service import DocumentService

doc_service = DocumentService()

# 이미지가 포함된 문서 검색
results = doc_service.search_documents(
    query_text="온실가스 배출량 추이",
    top_k=10
)

# 결과에는 텍스트 청크와 이미지 청크가 모두 포함됨
for chunk, score in results:
    if chunk.image_path:
        print(f"이미지 발견: {chunk.image_path}")
        print(f"설명: {chunk.image_description}")
    else:
        print(f"텍스트 청크: {chunk.chunk_text[:100]}")
```

### 9.2 RAG Node 연동

RAG Node에서 이미지가 포함된 검색 결과를 활용할 수 있습니다:

```python
# RAG Node 내부에서
vector_results = self._vector_repository.search_by_vector(
    query_embedding,
    top_k=20
)

# 이미지 청크 필터링
image_chunks = [
    chunk for chunk, score in vector_results
    if chunk.image_path and score > 0.7
]

# 이미지 설명을 팩트 시트에 포함
for chunk in image_chunks:
    fact_sheet.append({
        "type": "image",
        "description": chunk.image_description,
        "image_path": chunk.image_path,
        "page": chunk.page_number
    })
```

---

## 10. 이미지 타입 분류

### 10.1 지원 타입

| 타입 | 설명 | 예시 |
|------|------|------|
| `chart` | 차트/그래프 | 막대 그래프, 선 그래프, 파이 차트 |
| `table` | 표 이미지 | 데이터 표, 비교표 |
| `infographic` | 인포그래픽 | 시각화된 정보 그래픽 |
| `photo` | 사진 | 현장 사진, 제품 사진 |
| `diagram` | 다이어그램 | 프로세스 다이어그램, 구조도 |

### 10.2 분류 방법

현재는 파일명 기반 휴리스틱을 사용합니다. 향후 ML 모델로 개선 가능합니다:

```python
def classify_image_type(self, image_path: str) -> str:
    filename = Path(image_path).name.lower()
    
    if "chart" in filename or "graph" in filename:
        return "chart"
    elif "table" in filename or "표" in filename:
        return "table"
    # ...
    else:
        return "chart"  # ESG 보고서에서는 대부분 차트
```

---

## 11. 성능 및 제한사항

### 11.1 성능

- **이미지 추출**: PDF 크기에 비례 (일반적으로 빠름)
- **설명 생성**: BLIP-2 모델 로딩 시간 + 이미지당 1-3초
- **임베딩 생성**: 이미지당 약 0.1초

### 11.2 제한사항

1. **이미지 품질**: 저해상도 이미지는 설명 품질이 낮을 수 있음
2. **복잡한 차트**: 여러 데이터 시리즈가 있는 복잡한 차트는 일부 정보 누락 가능
3. **텍스트 포함 이미지**: 차트 내 텍스트는 OCR이 아닌 Vision 모델로 인식 (정확도 제한)
4. **모델 로딩**: BLIP-2 모델은 최초 로딩 시 시간 소요 (약 5-10초)

### 11.3 개선 방안

1. **OCR 통합**: 이미지 내 텍스트를 더 정확하게 추출
2. **표 이미지 구조화**: 표 이미지를 구조화된 데이터로 변환
3. **이미지 임베딩**: CLIP 등으로 이미지 임베딩 생성 (멀티모달 검색)
4. **배치 처리**: 여러 이미지를 병렬로 처리

---

## 12. 사용 예시

### 12.1 기본 사용 (통합)

```python
from ifrs_agent.service.document_service import DocumentService

# DocumentService 생성
doc_service = DocumentService()

# PDF 저장 (이미지 포함, 필터링 활성화)
saved_count = doc_service.store_pdf_to_vector_db(
    pdf_path="reports/samsung_sr_2024.pdf",
    document_type="report",
    company_id="삼성전자",
    fiscal_year=2024,
    extract_images=True,
    image_min_size=1000,             # 최소 이미지 크기
    filter_meaningless_images=True   # 의미없는 이미지 필터링
)

print(f"✅ {saved_count}개 청크 저장 완료 (텍스트 + 이미지)")
```

### 12.1.1 CLI 사용

```bash
# 기본 사용 (필터링 활성화)
python -m ifrs_agent.scripts.store_pdf_to_vector_db \
  --pdf-path "ai/ifrs_agent/data/report/Samsung_Electronics_Sustainability_Report_2024_KOR.pdf" \
  --document-type "report" \
  --company-id "samsung-electronics" \
  --fiscal-year 2024 \
  --standard "GRI"

# 더 많은 이미지 포함 (min_size 낮춤)
python -m ifrs_agent.scripts.store_pdf_to_vector_db \
  --pdf-path "ai/ifrs_agent/data/report/Samsung_Electronics_Sustainability_Report_2024_KOR.pdf" \
  --document-type "report" \
  --company-id "samsung-electronics" \
  --fiscal-year 2024 \
  --standard "GRI" \
  --image-min-size 500

# 필터링 비활성화 (모든 이미지 포함)
python -m ifrs_agent.scripts.store_pdf_to_vector_db \
  --pdf-path "ai/ifrs_agent/data/report/Samsung_Electronics_Sustainability_Report_2024_KOR.pdf" \
  --document-type "report" \
  --company-id "samsung-electronics" \
  --fiscal-year 2024 \
  --standard "GRI" \
  --no-filter-images
```

### 12.2 단계별 처리

```python
from ifrs_agent.service.pdf_parser_service import PDFParserService
from ifrs_agent.service.image_caption_service import ImageCaptionService

# 이미지 추출 (크기 필터링)
parser = PDFParserService()
images = parser.extract_images(
    "sr_report.pdf",
    min_size=1000  # 최소 이미지 크기
)

# 각 이미지 설명 생성 및 필터링
caption_service = ImageCaptionService()
meaningful_images = []

for img in images:
    description = caption_service.generate_caption(img["path"])
    
    if not description:
        continue
    
    # 의미있는 이미지인지 확인
    if caption_service.is_meaningful_image(description, img["path"]):
        image_type = caption_service.classify_image_type(img["path"])
        meaningful_images.append({
            "path": img["path"],
            "description": description,
            "type": image_type,
            "page": img["page"]
        })
        print(f"✅ 페이지 {img['page']}: {image_type} - {description[:50]}...")
    else:
        print(f"⚠️ 페이지 {img['page']}: 필터링됨 - {description[:50]}...")
    print(f"설명: {description}\n")
```

### 12.3 검색 활용

```python
from ifrs_agent.service.document_service import DocumentService

doc_service = DocumentService()

# "배출량 추이" 관련 이미지 검색
results = doc_service.search_documents(
    query_text="온실가스 배출량 추이 차트",
    top_k=10
)

# 이미지 청크만 필터링
image_results = [
    (chunk, score) for chunk, score in results
    if chunk.image_path
]

for chunk, score in image_results:
    print(f"유사도: {score:.2f}")
    print(f"이미지: {chunk.image_path}")
    print(f"설명: {chunk.image_description}\n")
```

---

## 13. 의존성

### 13.1 필수 패키지

```txt
# PDF Processing
PyMuPDF>=1.23.0

# Image Processing
Pillow>=10.0.0
torch>=2.0.0
transformers>=4.36.0
```

### 13.2 설치

```bash
pip install PyMuPDF Pillow torch transformers
```

### 13.3 모델 다운로드

BLIP-2 모델은 최초 사용 시 자동으로 다운로드됩니다:
- 모델 크기: 약 990MB
- 다운로드 위치: `~/.cache/huggingface/transformers/`

---

## 14. 트러블슈팅

### 14.1 PDF 파싱 실패

**문제**: `모든 파서로 PDF 파싱 실패`

**해결**:
1. PDF 파일이 손상되지 않았는지 확인
2. PDF가 암호화되어 있지 않은지 확인
3. PyMuPDF 설치 확인: `pip install PyMuPDF`
4. LlamaParse 사용 시 `LLAMA_CLOUD_API_KEY` 확인

### 14.2 임베딩 생성 실패

**문제**: `FlagEmbedding이 설치되지 않았습니다`

**해결**:
```bash
pip install FlagEmbedding
```

### 14.3 이미지 추출 실패

**문제**: `PyMuPDF가 설치되지 않았습니다.`

**해결**:
```bash
pip install PyMuPDF
```

### 14.4 설명 생성 실패

**문제**: `BLIP 모델 로딩 실패`

**해결**:
1. 인터넷 연결 확인 (모델 다운로드 필요)
2. 디스크 공간 확인 (약 1GB 필요)
3. Fallback 모드로 동작 (기본 설명 생성)

### 14.5 메모리 부족

**문제**: BLIP-2 모델 로딩 시 메모리 부족

**해결**:
1. GPU 사용 (CUDA 사용 가능 시)
2. 모델을 CPU로 강제 사용 (성능 저하)
3. 배치 크기 줄이기

---

## 15. 향후 개선 계획

### Phase 2: 이미지 임베딩 추가
- CLIP 모델로 이미지 임베딩 생성
- 멀티모달 검색 지원 (텍스트 + 이미지)

### Phase 3: 표 이미지 구조화
- OCR + 표 인식
- 구조화된 데이터 추출 (JSON/CSV)

### Phase 4: 고급 Vision 모델
- 더 정확한 차트 데이터 추출
- 다중 시리즈 차트 분석

---

## 16. 참고 자료

- [BLIP-2 Paper](https://arxiv.org/abs/2301.12597)
- [PyMuPDF Documentation](https://pymupdf.readthedocs.io/)
- [Transformers Library](https://huggingface.co/docs/transformers/)
