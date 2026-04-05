# IFRS 보고서 작성 멀티모달 에이전트

## 📋 프로젝트 개요

IFRS S1/S2 기반 지속가능경영(SR) 보고서 자동 생성을 위한 멀티모달 AI 에이전트 시스템입니다.

### 목적

- **GRI/SASB/TCFD/ESRS/KCGS/MSCI** 기반 SR 보고서를 **IFRS S1/S2 (KSSB 적합)** 형식으로 전환
- **100페이지 수준**의 드래프트 문단 자동 생성
- 지표 메타화(DP 분해), 이전 년도 데이터 조합 추천, 입력 오류 방지
- 실무자 업무 부담 최소화

### 핵심 특징

| 특징 | 설명 |
|------|------|
| **Star Topology 워크플로우** | Supervisor(오케스트레이터) 중심의 노드 제어 |
| **멀티모달 입력** | PDF, Excel, 이미지 처리 지원 |
| **온톨로지 기반 지표 매핑** | 중복 제거 및 DP 분해 |
| **자동화 연동** | 크롤링(DART, 미디어) 및 원천계(EMS/EHS) 연동 |
| **그린워싱 방지** | 공시 데이터 vs 입력 데이터 비교 검증 |

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Input                               │
│            (SR 보고서 PDF/Excel, 쿼리 입력)                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supervisor (Orchestrator)                     │
│                    Gemini 3.1 Pro                                │
│         [요청 분석 → 노드 지시 → 데이터 검토 → Audit]              │
└──────┬──────────────────┬──────────────────┬────────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│   RAG Node   │  │   Gen Node   │  │   Supervisor     │
│ Gemini 2.5   │  │  GPT-5 mini  │  │ (검증·감사 통합) │
│    Pro       │  │              │  │ Gemini 3.1 Pro │
└──────────────┘  └──────────────┘  └──────────────────┘
       │                  │                  │
       └──────────────────┴──────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Output                                   │
│              (IFRS 준수 SR 보고서 PDF/Word)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 프로젝트 구조

```
ifrs_agent/
├── agent/              # 에이전트 노드 구현
│   ├── supervisor.py   # Supervisor 오케스트레이터 (검증+감사 통합)
│   ├── rag_node.py     # RAG 검색/추출 노드
│   └── gen_node.py     # 문단 생성 노드
├── base/               # 기본 클래스 및 인터페이스
│   ├── base_agent.py   # 에이전트 베이스 클래스
│   └── state.py        # LangGraph 상태 정의
├── config/             # 설정 파일
│   ├── settings.py     # 환경 설정
│   └── prompts/        # 프롬프트 템플릿
├── model/              # 데이터 모델
│   ├── dp_schema.py    # Data Point 스키마
│   └── ontology.py     # 온톨로지 모델
├── repository/         # 데이터 저장소
│   ├── vector_store.py # 벡터 DB 연동
│   └── ontology_store.py # 온톨로지 DB
├── service/            # 비즈니스 로직
│   ├── crawler.py      # 크롤링 서비스
│   ├── pdf_parser.py   # PDF 파싱 서비스
│   └── report_generator.py # 보고서 생성
├── docs/               # 문서
└── Dockerfile          # 컨테이너 설정
```

---

## 🚀 퀵스타트

### 1. 환경 설정

```bash
# 의존성 설치
pip install -r requirements.txt

# 환경 변수 설정 (배포 스택에 맞게)
# export GOOGLE_API_KEY="..."   # Gemini
# export OPENAI_API_KEY="..."   # GPT-5 mini
export DART_API_KEY="your-dart-api-key"
```

### 2. 온톨로지 초기화

```python
from ifrs_agent.service.ontology_builder import OntologyBuilder

builder = OntologyBuilder()
builder.initialize_from_standards()  # IFRS, GRI, SASB 등 로드
```

### 3. 에이전트 실행

```python
from ifrs_agent.agent.supervisor import IFRSAgentWorkflow

workflow = IFRSAgentWorkflow()
result = workflow.run(
    query="기후 리스크의 재무적 영향 섹션 작성",
    documents=["sr_report_2024.pdf"],
    target_standards=["IFRS_S2"]
)
```

---

## 📚 문서 목록

| 문서 | 설명 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 시스템 아키텍처 및 워크플로우 상세 |
| [REVISED_WORKFLOW.md](./REVISED_WORKFLOW.md) | 수정 워크플로우·노드별 LLM/임베딩(BGE-M3) 운영 기준 |
| [NODES.md](./NODES.md) | 오케스트레이터 및 노드별 상세 설계 |
| [DATA_ONTOLOGY.md](./DATA_ONTOLOGY.md) | 데이터 구조 및 온톨로지 설계 |
| [DATA_COLLECTION.md](./DATA_COLLECTION.md) | 데이터 수집 전략 및 출처 |
| [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) | 구현 가이드 및 단계별 계획 |
| [IMAGE_PARSING.md](./IMAGE_PARSING.md) | 이미지 파싱 및 처리 가이드 |

---

## 🛠️ 기술 스택

| 구분 | 기술 |
|------|------|
| **프레임워크** | LangGraph, LangChain |
| **LLM API** | Gemini 3.1 Pro / Gemini 2.5 Pro (Google AI), GPT-5 mini (OpenAI) — 상세 배치는 [REVISED_WORKFLOW.md](./REVISED_WORKFLOW.md) §3.1 |
| **임베딩** | **BGE-M3** (현행 운영, 1024차원·pgvector 정합) |
| **벡터 DB** | PostgreSQL + pgvector |
| **온톨로지** | Neo4j / Python Dict |
| **PDF 파싱** | LlamaParse, Unstructured |
| **크롤링** | Playwright, BeautifulSoup |

---

## 📞 연락처

프로젝트 관련 문의사항은 담당자에게 연락해 주세요.

