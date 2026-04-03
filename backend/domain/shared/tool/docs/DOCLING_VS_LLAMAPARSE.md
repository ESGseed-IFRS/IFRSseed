# Docling 마크다운/텍스트 내보내기 API 출처 & Docling vs LlamaParse

## 1. Docling에서 마크다운/텍스트 내보내기 API는 어디서 제공하나?

Docling은 변환 결과 문서(`result.document`)에 대해 **여러 내보내기 메서드**를 제공합니다. 공식 문서 출처는 아래와 같습니다.

### 공식 문서 URL

| 항목 | URL |
|------|-----|
| **Docling 문서(DoclingDocument) API** | https://docling-project.github.io/docling/reference/docling_document/ |
| **Document Converter 사용법** | https://docling-project.github.io/docling/reference/document_converter/ |
| **다중 포맷 변환 예제 (export_to_markdown 사용)** | https://docling-project.github.io/docling/examples/run_with_formats/ |
| **직렬화(Serialization) 개념** | https://docling-project.github.io/docling/concepts/serialization/ |
| **GitHub 저장소** | https://github.com/docling-project/docling |

### 제공 API 요약

- **`result.document.export_to_markdown()`**  
  문서 전체(제목, 본문, 표 등)를 **마크다운 문자열**로 반환.  
  LLM 입력·가독성용으로 설계됨.

- **`result.document.export_to_text()`**  
  문서를 **텍스트**로 반환 (일부 버전에서는 마크다운 마크업이 섞여 나올 수 있음).

- **`result.document.export_to_dict()`**  
  문서를 dict로 반환 (JSON/YAML 직렬화용).

- **`result.document.export_to_html()`**  
  HTML 문자열로 반환.

사용 예시는 Document Converter 문서와 **run_with_formats** 예제에 나와 있습니다.

```python
result = converter.convert(pdf_path)
md = result.document.export_to_markdown()  # 전체 문서(제목·표 포함) 마크다운
```

---

## 2. Docling과 LlamaParse의 차이

| 구분 | Docling | LlamaParse |
|------|---------|------------|
| **제공 형태** | 오픈소스 라이브러리 (Python, 로컬/서버 설치) | 상용 클라우드 API (LlamaCloud, API 키 필요) |
| **실행 위치** | 사용자 환경에서 실행 (CPU/GPU) | LlamaIndex 측 서버에서 실행 |
| **핵심 방식** | 딥러닝 기반 (TableFormer, 레이아웃 분석, OCR 등) 파이프라인 | 에이전트형 OCR, 여러 전문 에이전트가 협업해 문서 분해 |
| **표 추출** | 복잡한 표에서 정확도 높음 (벤치마크 상 97.9% 등) | 표·레이아웃 인식 지원, 문서 복잡도에 따라 적합 |
| **출력** | `doc.tables`(구조화 표) + `export_to_markdown()`(전체 마크다운) 등 **로컬에서 즉시** 사용 | API 호출 결과로 **마크다운/텍스트** 전달 (파일 또는 응답 본문) |
| **비용** | 설치·연산 비용만 (인프라 비용) | API 호출 비용 (LlamaCloud 요금제) |
| **확장성** | 직접 스케일·파이프라인 구성 필요 | 엔터프라이즈 스케일·다중 포맷(90+ 파일 형식) 지원 |
| **추가 기능** | 표/텍스트/구조 중심 | 폼·체크박스·손글씨·스키마 기반 추출·인용 등 추가 기능 많음 |

### 요약

- **Docling**: 같은 머신에서 **표 구조(`doc.tables`)와 전체 문서 마크다운(`export_to_markdown()`)** 을 모두 쓸 수 있고, “IFRS S2 INDEX” 같은 제목은 마크다운/텍스트에 포함되어 나옵니다.
- **LlamaParse**: PDF를 **업로드 → API가 파싱 → 마크다운/텍스트를 결과로 받는** 방식이라, 제목·본문·표가 한 덩어리 마크다운로 오는 점은 비슷하지만, 실행 위치·비용·운영 방식이 다릅니다.

즉, “Docling 문서는 전체를 마크다운/텍스트로 내보내는 API”는 **Docling 공식 문서의 DoclingDocument 레퍼런스 및 run_with_formats 예제**에서 제공합니다.
