# OCR 기반 문서 레이아웃 분석 도구 (2026)

PDF에서 텍스트/표를 추출할 때 PyMuPDF 같은 구조 기반 파서가 실패하는 경우, **이미지로 변환 후 OCR + 레이아웃 분석**을 수행하는 도구들이 효과적입니다. 특히 스택 오버플로우, 손상된 PDF 구조, 스캔 문서 등에서 유용합니다.

---

## 1. 주요 도구 비교

| 도구 | 타입 | 특징 | 용도 | 설치 |
|------|------|------|------|------|
| **PaddleOCR (PP-Structure)** | OCR + 레이아웃 분석 | 중국 Baidu 개발, 표·텍스트·이미지 영역 구분, Excel 출력 지원 | 스캔 문서, 복잡한 레이아웃 | `pip install paddleocr paddlepaddle` |
| **LayoutParser** | 딥러닝 레이아웃 분석 | 문서 구조(표·헤더·본문) 감지 후 영역별 OCR 적용 | 스캔 PDF, 구조 분석 필요 시 | `pip install layoutparser` + Tesseract |
| **Docling (현재 사용 중)** | 하이브리드 | PyMuPDF + OCR 조합, 표 구조 추출 강화 | 일반 PDF, 일부 스캔 문서 | `pip install docling` |
| **LlamaParse (현재 폴백)** | 클라우드 API | 이미지 렌더링 후 마크다운 변환, 표 인식 강화 | 복잡한 표, 구조적 결함 PDF | API 키 필요 (유료) |
| **pdfplumber** | 구조 기반 | 텍스트 좌표 분석, 표 추출 강점 | 정상 PDF, 빠른 처리 | `pip install pdfplumber` |
| **quanta-pdf** | 고급 레이아웃 분석 | 2025년 신규, 도표·표·구조 추출 특화 | 연구 논문, 복잡한 레이아웃 | `pip install quanta-pdf` |

---

## 2. PaddleOCR (PP-Structure) - 추천 ⭐

### 장점
- **레이아웃 분석 + 표 인식 + OCR 통합**: 문서를 이미지로 변환하여 텍스트/표/이미지 영역 구분 후 각각 처리
- **Excel 출력 지원**: 표를 `.xlsx`로 직접 저장 가능
- **오픈소스**: 무료, 중국어/영어/한글 등 다국어 지원
- **구조적 결함 회피**: PDF 내부 구조가 아닌 렌더링 결과를 분석하므로 MuPDF 스택 오버플로우 등 우회

### 설치
```bash
pip install paddleocr paddlepaddle
```

### 사용 예시
```python
from paddleocr import PPStructure, save_structure_res

# 이미지 렌더링 + 레이아웃 분석 + 표 추출
engine = PPStructure(show_log=True, lang='korean')
result = engine('path/to/pdf_page.jpg')  # PDF → 이미지로 변환 후 전달

# 표 영역 추출
for region in result:
    if region['type'] == 'table':
        # region['res'] 에 표 데이터 포함
        print(region['res'])
```

### 한계
- **속도**: 딥러닝 모델 사용으로 LlamaParse보다 느릴 수 있음
- **정확도**: 복잡한 표(셀 병합 많음)에서는 LlamaParse가 더 나을 수 있음

---

## 3. LayoutParser + Tesseract

### 장점
- **정밀한 레이아웃 감지**: 표·헤더·단락 등 영역별 딥러닝 분류
- **OCR 엔진 선택 가능**: Tesseract, EasyOCR 등과 조합
- **학습 가능**: 특정 문서 유형에 맞춰 모델 fine-tuning 가능

### 설치
```bash
pip install layoutparser torchvision
pip install 'layoutparser[ocr]'  # Tesseract 통합
sudo apt install tesseract-ocr tesseract-ocr-kor  # Linux
```

### 사용 예시
```python
import layoutparser as lp
from PIL import Image

# 레이아웃 분석 모델 로드
model = lp.Detectron2LayoutModel('lp://PubLayNet/faster_rcnn_R_50_FPN_3x/config')

# PDF → 이미지 변환 후
image = Image.open('page.jpg')
layout = model.detect(image)

# 표 영역만 추출
table_blocks = lp.Layout([b for b in layout if b.type == 'Table'])

# Tesseract OCR 적용
ocr_agent = lp.TesseractAgent(languages='kor')
for block in table_blocks:
    segment_image = block.crop_image(image)
    text = ocr_agent.detect(segment_image)
    print(text)
```

### 한계
- **설정 복잡도**: 모델 다운로드, Tesseract 설치 등 초기 세팅 필요
- **표 구조 재구성**: 표 영역은 감지하지만, 셀 단위 파싱은 별도 로직 필요

---

## 4. pdfplumber (구조 기반, 참고용)

### 장점
- **빠름**: OCR 없이 텍스트 좌표 분석
- **표 추출 강점**: 선 기반 표, 텍스트 정렬 표 모두 지원
- **디버깅 도구**: 시각적 디버깅 기능 (`page.to_image()`)

### 설치
```bash
pip install pdfplumber
```

### 사용 예시
```python
import pdfplumber

with pdfplumber.open('report.pdf') as pdf:
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            print(table)
```

### 한계
- **OCR 미지원**: 스캔 문서나 이미지 기반 PDF에서는 텍스트 추출 불가
- **구조 의존**: PyMuPDF처럼 PDF 내부 구조가 손상되면 실패 가능성 있음

---

## 5. quanta-pdf (최신 도구, 2025년)

### 장점
- **고급 레이아웃 분석**: 도표, 표, 수식 등 구조화된 요소 추출 특화
- **최신 기술**: 2025년 12월 출시, 최신 PDF 형식 지원

### 설치
```bash
pip install quanta-pdf
```

### 사용 예시
```python
from quanta_pdf import extract_tables

tables = extract_tables('report.pdf', pages=[1, 2, 3])
for table in tables:
    print(table.to_dataframe())
```

### 한계
- **신규 도구**: 커뮤니티/문서가 아직 적음
- **안정성 미검증**: 프로덕션 사용 사례가 적음

---

## 6. 현재 시스템 적용 시나리오

### 현재 구조 (Docling → LlamaParse 폴백)
```
PDF → Docling (PyMuPDF 기반) → 실패 시 → LlamaParse (클라우드 API)
                                    ↓
                              MuPDF 스택 오버플로우
                                    ↓
                              페이지 추출 실패
                                    ↓
                              LlamaParse 폴백 불가
```

### 개선안 1: pypdf 폴백 (이미 적용)
```
PDF → Docling (PyMuPDF) → 실패 시 → pypdf로 페이지 추출 → LlamaParse
```

### 개선안 2: PaddleOCR 폴백 추가 (제안)
```
PDF → Docling → 실패 시 → pypdf로 페이지 추출 → LlamaParse
                              ↓ (LlamaParse도 실패 시)
                         PaddleOCR (이미지 렌더링 + OCR)
```

### 구현 예시
```python
def _paddleocr_fallback(pdf_path, page_numbers):
    """PDF → 이미지 → PaddleOCR로 표 추출"""
    from paddleocr import PPStructure
    import fitz  # 이미지 렌더링은 fitz가 가능 (페이지 추출과 다름)
    
    engine = PPStructure(lang='korean')
    results = []
    
    doc = fitz.open(pdf_path)
    for page_num in page_numbers:
        page = doc[page_num - 1]
        # 페이지를 이미지로 렌더링 (스택 오버플로우 영향 적음)
        pix = page.get_pixmap(dpi=300)
        img_path = f"/tmp/page_{page_num}.jpg"
        pix.save(img_path)
        
        # PaddleOCR로 레이아웃 분석
        ocr_result = engine(img_path)
        # 표 영역만 필터링 후 sr_report_index 형식으로 변환
        # ...
    
    return results
```

---

## 7. 권장 사항

### 즉시 적용 가능
- ✅ **pypdf 폴백** (이미 구현됨): PyMuPDF 스택 오버플로우 해결

### 단계적 확장
1. **LlamaParse 실패 시 PaddleOCR 추가**: 삼성SDS 2025처럼 구조적 결함이 심한 PDF 대비
2. **pdfplumber 1차 파서로 테스트**: Docling보다 빠르고 단순한 PDF에 효과적

### 장기 전략
- **Schema-driven parsing**: JSON 스키마 정의 후 LLM으로 추출 (2026년 트렌드)
- **Hybrid 방식**: 구조 파싱(pdfplumber) + OCR(PaddleOCR) 조합

---

## 8. 비용/성능 고려

| 도구 | 비용 | 속도 | 정확도 (복잡한 표) | 설치 복잡도 |
|------|------|------|-------------------|-------------|
| **Docling** | 무료 | 빠름 | 중 | 낮음 |
| **LlamaParse** | 유료 (API) | 느림 | 높음 | 낮음 (API 키만) |
| **PaddleOCR** | 무료 | 중간 | 중상 | 중 (모델 다운로드) |
| **LayoutParser** | 무료 | 느림 | 중 | 높음 (모델+Tesseract) |
| **pdfplumber** | 무료 | 매우 빠름 | 중 (구조 의존) | 낮음 |
| **pypdf** | 무료 | 빠름 | - (추출만) | 낮음 |

---

*문서 작성일: 2026-03-17. 실제 적용 시 각 도구의 최신 버전 확인 필요.*
