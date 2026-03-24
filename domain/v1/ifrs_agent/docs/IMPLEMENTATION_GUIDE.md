# 구현 가이드 및 단계별 계획

## 📚 관련 문서

이 문서를 읽기 전/후에 다음 문서를 함께 참고하세요:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 시스템 아키텍처 이해
- [NODES.md](./NODES.md) - 노드별 구현 방법
- [DATA_ONTOLOGY.md](./DATA_ONTOLOGY.md) - 데이터 구조 설계
- [DATA_COLLECTION.md](./DATA_COLLECTION.md) - 데이터 수집 전략

---

## 1. 개발 환경 설정

### 1.1 하드웨어 요구사항

| 구성 요소 | 최소 사양 | 권장 사양 |
|----------|----------|----------|
| **CPU** | 8코어 | 16코어 이상 |
| **RAM** | 32GB | 64GB 이상 |
| **GPU** | RTX 3080 (10GB) | RTX 4070 Super (12GB) 이상 |
| **Storage** | SSD 500GB | NVMe SSD 1TB 이상 |

### 1.2 소프트웨어 요구사항

```bash
# Python 버전
Python 3.10+

# 주요 프레임워크
langgraph>=0.0.40
langchain>=0.1.0
groq>=0.4.0
transformers>=4.36.0
sentence-transformers>=2.2.0

# 벡터 DB
chromadb>=0.4.0
# 또는
pymilvus>=2.3.0

# PDF 처리
llama-parse>=0.4.0
unstructured>=0.10.0
PyMuPDF>=1.23.0

# 크롤링
playwright>=1.40.0
beautifulsoup4>=4.12.0
aiohttp>=3.9.0

# 그래프 DB (선택)
neo4j>=5.0.0
```

### 1.3 환경 설정

```bash
# 1. 가상환경 생성
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 2. 의존성 설치
pip install -r requirements.txt

# 3. 환경 변수 설정
cp .env.example .env

# .env 파일 편집
GROQ_API_KEY=your-groq-api-key
DART_API_KEY=your-dart-api-key
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
```

### 1.4 requirements.txt

```txt
# Core
langgraph>=0.0.40
langchain>=0.1.0
langchain-groq>=0.0.3
pydantic>=2.5.0

# LLM
groq>=0.4.0
transformers>=4.36.0
accelerate>=0.25.0
bitsandbytes>=0.41.0

# Embedding
sentence-transformers>=2.2.0
FlagEmbedding>=1.2.0

# Vector DB
chromadb>=0.4.0

# PDF Processing
llama-parse>=0.4.0
unstructured[pdf]>=0.10.0
PyMuPDF>=1.23.0
pdfplumber>=0.10.0

# Crawling
playwright>=1.40.0
beautifulsoup4>=4.12.0
aiohttp>=3.9.0

# Data Processing
pandas>=2.1.0
numpy>=1.26.0
openpyxl>=3.1.0

# Graph DB (Optional)
neo4j>=5.0.0

# Utils
python-dotenv>=1.0.0
loguru>=0.7.0
tqdm>=4.66.0

# Testing
pytest>=7.4.0
pytest-asyncio>=0.21.0

# LoRA Training (Optional)
unsloth>=2024.1
peft>=0.7.0
trl>=0.7.0
```

---

## 2. 프로젝트 구조 상세

### 2.1 디렉토리 구조

```
ifrs_agent/
├── __init__.py
├── agent/                      # 에이전트 노드
│   ├── __init__.py
│   ├── supervisor.py           # Supervisor 오케스트레이터 (검증+감사 통합)
│   ├── rag_node.py             # RAG 검색/추출 노드
│   ├── gen_node.py             # 문단 생성 노드
│   └── workflow.py             # LangGraph 워크플로우 정의
├── base/                       # 기본 클래스
│   ├── __init__.py
│   ├── base_agent.py           # 에이전트 베이스 클래스
│   ├── state.py                # LangGraph 상태 정의
│   └── prompts.py              # 프롬프트 템플릿
├── config/                     # 설정
│   ├── __init__.py
│   ├── settings.py             # 환경 설정
│   └── prompts/                # 프롬프트 파일
│       ├── supervisor.txt
│       ├── rag_node.txt
│       └── gen_node.txt
├── model/                      # 데이터 모델
│   ├── __init__.py
│   ├── dp_schema.py            # Data Point 스키마
│   ├── ontology.py             # 온톨로지 모델
│   ├── fact_sheet.py           # 팩트 시트 모델
│   └── report.py               # 보고서 모델
├── repository/                 # 데이터 저장소
│   ├── __init__.py
│   ├── vector_store.py         # 벡터 DB 연동
│   ├── ontology_store.py       # 온톨로지 DB
│   └── cache.py                # 캐시 관리
├── service/                    # 비즈니스 로직
│   ├── __init__.py
│   ├── crawler/                # 크롤링 서비스
│   │   ├── __init__.py
│   │   ├── dart_crawler.py
│   │   ├── media_crawler.py
│   │   └── web_crawler.py
│   ├── parser/                 # 파싱 서비스
│   │   ├── __init__.py
│   │   ├── pdf_parser.py
│   │   └── excel_parser.py
│   ├── embedding_service.py    # 임베딩 서비스
│   ├── search_service.py       # 검색 서비스
│   ├── ontology_service.py     # 온톨로지 서비스
│   └── report_generator.py     # 보고서 생성
├── training/                   # 모델 학습 (선택)
│   ├── __init__.py
│   ├── lora_trainer.py         # LoRA 학습
│   ├── embedding_tuner.py      # 임베딩 튜닝
│   └── data/                   # 학습 데이터
├── api/                        # API 엔드포인트
│   ├── __init__.py
│   ├── main.py                 # FastAPI 앱
│   ├── routes/                 # 라우트
│   └── schemas/                # API 스키마
├── tests/                      # 테스트
│   ├── __init__.py
│   ├── test_agents/
│   ├── test_services/
│   └── fixtures/
├── docs/                       # 문서
├── scripts/                    # 유틸리티 스크립트
│   ├── init_ontology.py
│   ├── collect_standards.py
│   └── train_models.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

### 2.2 핵심 파일 구현

#### base/state.py

```python
"""LangGraph 상태 정의"""
from typing import TypedDict, List, Dict, Any, Optional, Literal
from pydantic import BaseModel

class IFRSAgentState(TypedDict):
    """IFRS 에이전트 공유 상태"""
    
    # === 입력 정보 ===
    query: str                          # 사용자 쿼리
    documents: List[str]                # 업로드된 문서 경로
    target_standards: List[str]         # 대상 기준서 (IFRS_S1, IFRS_S2)
    fiscal_year: int                    # 회계연도
    company_id: str                     # 기업 식별자
    
    # === 처리 상태 ===
    current_node: str                   # 현재 노드
    iteration_count: int                # 반복 횟수
    status: Literal[
        "initialized",
        "analyzing",
        "retrieving",
        "reviewing",
        "generating",
        "validating",
        "auditing",
        "completed",
        "failed"
    ]
    
    # === 추출 데이터 ===
    target_dps: List[str]               # 필요한 DP 목록
    fact_sheets: List[Dict[str, Any]]   # 추출된 팩트 시트
    yearly_data: Dict[int, Dict]        # 연도별 데이터
    
    # === 생성 결과 ===
    generated_sections: List[Dict[str, Any]]  # 생성된 섹션들
    
    # === 검증 결과 ===
    validation_results: List[Dict[str, Any]]
    
    # === 기업 아이덴티티 ===
    corporate_identity: Dict[str, Any]  # 컬러, 스타일 등
    
    # === 메타 정보 ===
    reference_sources: List[str]        # 참조 출처 목록
    audit_log: List[Dict[str, Any]]     # 감사 로그
    errors: List[str]                   # 에러 목록
```

#### base/base_agent.py

```python
"""에이전트 베이스 클래스"""
from abc import ABC, abstractmethod
from typing import Any, Dict
from loguru import logger

class BaseNode(ABC):
    """노드 베이스 클래스"""
    
    def __init__(self, name: str, config: Dict[str, Any] = None):
        self.name = name
        self.config = config or {}
        self.logger = logger.bind(node=name)
    
    @abstractmethod
    async def process(self, state: Dict) -> Dict:
        """노드 처리 로직"""
        pass
    
    def log_start(self, state: Dict):
        """처리 시작 로깅"""
        self.logger.info(f"Starting {self.name} processing")
    
    def log_end(self, state: Dict, result: Dict):
        """처리 완료 로깅"""
        self.logger.info(f"Completed {self.name} processing")
    
    def handle_error(self, error: Exception, state: Dict) -> Dict:
        """에러 처리"""
        self.logger.error(f"Error in {self.name}: {error}")
        state["errors"].append(str(error))
        return state
```

#### agent/workflow.py

```python
"""LangGraph 워크플로우 정의"""
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite import SqliteSaver

from ifrs_agent.base.state import IFRSAgentState
from ifrs_agent.agent.supervisor import SupervisorAgent
from ifrs_agent.agent.rag_node import RAGNode
from ifrs_agent.agent.gen_node import GenNode

class IFRSAgentWorkflow:
    """IFRS 에이전트 워크플로우
    
    Note: Validation Node는 Supervisor에 통합되었습니다 (하이브리드 접근).
    """
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.supervisor = SupervisorAgent(self.config.get("supervisor", {}))
        self.rag_node = RAGNode(self.config.get("rag", {}))
        self.gen_node = GenNode(self.config.get("gen", {}))
        
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """워크플로우 그래프 구성 (Star Topology)"""
        # 그래프 생성
        workflow = StateGraph(IFRSAgentState)
        
        # 노드 추가
        workflow.add_node("supervisor_analyze", self.supervisor.analyze)
        workflow.add_node("rag_node", self.rag_node.process)
        workflow.add_node("supervisor_review", self.supervisor.review)
        workflow.add_node("gen_node", self.gen_node.process)
        # Validation Node 제거: Supervisor에 통합됨
        workflow.add_node("supervisor_validate_and_audit", 
                         self.supervisor.validate_and_audit)
        
        # 엣지 추가
        workflow.set_entry_point("supervisor_analyze")
        
        workflow.add_edge("supervisor_analyze", "rag_node")
        workflow.add_edge("rag_node", "supervisor_review")
        
        # 조건부 엣지: 데이터 충분성 검토
        workflow.add_conditional_edges(
            "supervisor_review",
            self._check_data_sufficiency,
            {
                "rag_node": "rag_node",      # 재검색
                "gen_node": "gen_node"        # 생성 진행
            }
        )
        
        # Star Topology 완성: gen_node → supervisor 직접 연결
        workflow.add_edge("gen_node", "supervisor_validate_and_audit")
        
        # 조건부 엣지: 최종 감사
        workflow.add_conditional_edges(
            "supervisor_validate_and_audit",
            self._check_quality,
            {
                "gen_node": "gen_node",       # 재생성
                "end": END                     # 완료
            }
        )
        
        return workflow.compile()
    
    def _check_data_sufficiency(self, state: IFRSAgentState) -> str:
        """데이터 충분성 검토"""
        required = set(state["target_dps"])
        extracted = set(fs["dp_id"] for fs in state["fact_sheets"])
        missing = required - extracted
        
        if missing and state["iteration_count"] < 3:
            return "rag_node"
        return "gen_node"
    
    def _check_quality(self, state: IFRSAgentState) -> str:
        """품질 검토"""
        if not state["validation_results"]:
            return "end"
        
        latest = state["validation_results"][-1]
        
        if latest.get("greenwashing_risk", 0) > 0.7:
            return "end"  # 거부
        
        if latest.get("compliance_score", 1) < 0.8:
            if state["iteration_count"] < 3:
                return "gen_node"
        
        return "end"
    
    async def run(
        self,
        query: str,
        documents: List[str],
        target_standards: List[str],
        fiscal_year: int,
        company_id: str
    ) -> Dict:
        """워크플로우 실행"""
        initial_state: IFRSAgentState = {
            "query": query,
            "documents": documents,
            "target_standards": target_standards,
            "fiscal_year": fiscal_year,
            "company_id": company_id,
            "current_node": "entry",
            "iteration_count": 0,
            "status": "initialized",
            "target_dps": [],
            "fact_sheets": [],
            "yearly_data": {},
            "generated_sections": [],
            "validation_results": [],
            "corporate_identity": {},
            "reference_sources": [],
            "audit_log": [],
            "errors": []
        }
        
        # 체크포인트 설정 (선택)
        memory = SqliteSaver.from_conn_string(":memory:")
        
        # 실행
        result = await self.graph.ainvoke(
            initial_state,
            {"configurable": {"thread_id": "1"}}
        )
        
        return result
```

---

## 3. 단계별 구현 계획

### 3.1 Phase 1: 기반 구축 (2주)

#### Week 1: 프로젝트 셋업

| 작업 | 설명 | 산출물 |
|------|------|--------|
| 환경 설정 | 개발 환경 구성, 의존성 설치 | requirements.txt, .env |
| 프로젝트 구조 | 디렉토리 및 기본 파일 생성 | 프로젝트 스켈레톤 |
| 설정 관리 | 환경 변수, 설정 파일 구성 | config/settings.py |
| 로깅 설정 | 로그 시스템 구성 | loguru 설정 |

```python
# config/settings.py
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    """애플리케이션 설정"""
    
    # API Keys
    groq_api_key: str
    dart_api_key: str = ""
    
    # Database
    vector_db_path: str = "./data/vectordb"
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""
    
    # Model Settings
    supervisor_model: str = "llama-3.3-70b-versatile"
    rag_model: str = "llama-3.3-70b-versatile"
    gen_model_path: str = "./models/exaone-lora"
    embedding_model: str = "BAAI/bge-m3"
    
    # Processing
    max_retries: int = 3
    chunk_size: int = 1000
    chunk_overlap: int = 200
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

#### Week 2: 데이터 모델 및 온톨로지

| 작업 | 설명 | 산출물 |
|------|------|--------|
| DP 스키마 | Data Point 모델 정의 | model/dp_schema.py |
| 온톨로지 모델 | 온톨로지 구조 정의 | model/ontology.py |
| 온톨로지 저장소 | 저장소 구현 | repository/ontology_store.py |
| 초기 데이터 | IFRS/GRI 핵심 DP 입력 | scripts/init_ontology.py |

```bash
# 온톨로지 초기화 실행
python scripts/init_ontology.py
```

### 3.2 Phase 2: 핵심 노드 구현 (3주)

#### Week 3: RAG Node

| 작업 | 설명 | 산출물 |
|------|------|--------|
| 임베딩 서비스 | BGE-M3 임베딩 구현 | service/embedding_service.py |
| 벡터 저장소 | PostgreSQL + pgvector | repository/vector_store.py |
| 하이브리드 검색 | Dense + Sparse 검색 | service/search_service.py |
| PDF 파서 | PDF 텍스트/표 추출 | service/parser/pdf_parser.py |

```python
# service/embedding_service.py
from sentence_transformers import SentenceTransformer
import numpy as np

class EmbeddingService:
    """임베딩 서비스"""
    
    def __init__(self, model_name: str = "BAAI/bge-m3"):
        self.model = SentenceTransformer(model_name)
    
    def encode(
        self,
        texts: List[str],
        normalize: bool = True
    ) -> np.ndarray:
        """텍스트 임베딩"""
        return self.model.encode(
            texts,
            normalize_embeddings=normalize,
            show_progress_bar=True
        )
    
    def similarity(self, query: str, documents: List[str]) -> List[float]:
        """유사도 계산"""
        query_emb = self.encode([query])[0]
        doc_embs = self.encode(documents)
        
        return np.dot(doc_embs, query_emb).tolist()
```

#### Week 4: Supervisor Node

| 작업 | 설명 | 산출물 |
|------|------|--------|
| Groq 클라이언트 | Llama API 연동 | 클라이언트 구현 |
| 분석 로직 | 요청 분석, DP 식별 | agent/supervisor.py |
| 검토 로직 | 데이터 충분성 검토 | agent/supervisor.py |
| 감사 로직 | 최종 품질 검증 | agent/supervisor.py |

```python
# agent/supervisor.py
from groq import Groq
from ifrs_agent.base.base_agent import BaseNode

class SupervisorAgent(BaseNode):
    """Supervisor 오케스트레이터"""
    
    def __init__(self, config: Dict):
        super().__init__("supervisor", config)
        self.client = Groq(api_key=config["api_key"])
        self.model = config.get("model", "llama-3.3-70b-versatile")
    
    async def analyze(self, state: IFRSAgentState) -> IFRSAgentState:
        """요청 분석 및 DP 식별"""
        prompt = self._build_analysis_prompt(state)
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SUPERVISOR_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )
        
        result = self._parse_response(response.choices[0].message.content)
        
        state["target_dps"] = result["required_dps"]
        state["status"] = "analyzing"
        state["audit_log"].append({
            "action": "analyze",
            "result": result,
            "timestamp": datetime.now().isoformat()
        })
        
        return state
```

#### Week 5: Gen Node & Supervisor 검증 통합

| 작업 | 설명 | 산출물 |
|------|------|--------|
| Gen Node | 문단 생성 구현 | agent/gen_node.py |
| Supervisor 검증 통합 | 검증 로직을 Supervisor에 통합 (하이브리드 접근) | agent/supervisor.py |
| 그린워싱 탐지 | 패턴/LLM 기반 탐지 | 탐지 로직 |
| 워크플로우 통합 | LangGraph 워크플로우 완성 (Star Topology) | agent/workflow.py |

**주요 변경사항**:
- Validation Node 제거: 기능이 Supervisor에 통합됨
- Star Topology 완성: 모든 노드가 Supervisor를 통해서만 통신
- 코드 모듈화 유지: 검증 로직과 감사 로직을 메서드 단위로 분리

### 3.3 Phase 3: 데이터 수집 (2주)

#### Week 6: 크롤링 구현

| 작업 | 설명 | 산출물 |
|------|------|--------|
| DART 크롤러 | 전자공시 크롤링 | service/crawler/dart_crawler.py |
| 웹 크롤러 | 기업 홈페이지 크롤링 | service/crawler/web_crawler.py |
| 미디어 크롤러 | 뉴스 기사 크롤링 | service/crawler/media_crawler.py |

#### Week 7: 데이터 파이프라인

| 작업 | 설명 | 산출물 |
|------|------|--------|
| 파싱 서비스 | PDF/Excel 파싱 통합 | service/parser/ |
| 데이터 검증 | 품질 검증 로직 | 검증 서비스 |
| 파이프라인 | 수집 파이프라인 구현 | 파이프라인 서비스 |

### 3.4 Phase 4: 고도화 (2주)

#### Week 8: 모델 학습

| 작업 | 설명 | 산출물 |
|------|------|--------|
| 학습 데이터 준비 | GRI→IFRS 변환 데이터셋 | training/data/ |
| LoRA 학습 | EXAONE 파인튜닝 | training/lora_trainer.py |
| 임베딩 튜닝 | BGE-M3 Contrastive Learning | training/embedding_tuner.py |

```python
# training/lora_trainer.py
from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments

def train_lora():
    """EXAONE LoRA 학습"""
    # 모델 로드
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name="LGAI-EXAONE/EXAONE-3.0-7.8B-Instruct",
        max_seq_length=4096,
        dtype=None,
        load_in_4bit=True
    )
    
    # LoRA 설정
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none"
    )
    
    # 학습 데이터 로드
    dataset = load_training_data()
    
    # 학습 설정
    training_args = TrainingArguments(
        output_dir="./outputs",
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        num_train_epochs=3,
        learning_rate=2e-4,
        fp16=True,
        logging_steps=10,
        save_steps=100
    )
    
    # 학습
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        args=training_args,
        max_seq_length=4096
    )
    
    trainer.train()
    
    # 저장
    model.save_pretrained("./models/exaone-lora")
```

#### Week 9: API 및 테스트

| 작업 | 설명 | 산출물 |
|------|------|--------|
| FastAPI 구현 | REST API 엔드포인트 | api/ |
| 단위 테스트 | 각 모듈 테스트 | tests/ |
| 통합 테스트 | E2E 테스트 | tests/ |
| 문서화 | API 문서, 사용 가이드 | docs/ |

```python
# api/main.py
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel

app = FastAPI(title="IFRS Agent API")

class ReportRequest(BaseModel):
    query: str
    target_standards: List[str]
    fiscal_year: int
    company_id: str

@app.post("/generate")
async def generate_report(
    request: ReportRequest,
    documents: List[UploadFile] = File(...)
):
    """보고서 생성 API"""
    # 문서 저장
    doc_paths = await save_documents(documents)
    
    # 워크플로우 실행
    workflow = IFRSAgentWorkflow()
    result = await workflow.run(
        query=request.query,
        documents=doc_paths,
        target_standards=request.target_standards,
        fiscal_year=request.fiscal_year,
        company_id=request.company_id
    )
    
    return result
```

---

## 4. 테스트 전략

### 4.1 테스트 구조

```
tests/
├── unit/                       # 단위 테스트
│   ├── test_embedding.py
│   ├── test_search.py
│   ├── test_parser.py
│   └── test_ontology.py
├── integration/                # 통합 테스트
│   ├── test_rag_node.py
│   ├── test_gen_node.py
│   └── test_workflow.py
├── e2e/                        # E2E 테스트
│   └── test_full_pipeline.py
├── fixtures/                   # 테스트 데이터
│   ├── sample_reports/
│   └── expected_outputs/
└── conftest.py                 # pytest 설정
```

### 4.2 테스트 예시

```python
# tests/unit/test_ontology.py
import pytest
from ifrs_agent.repository.ontology_store import LightweightOntologyStore
from ifrs_agent.model.dp_schema import DataPoint

class TestOntologyStore:
    @pytest.fixture
    def store(self):
        return LightweightOntologyStore()
    
    def test_add_dp(self, store):
        dp = DataPoint(
            dp_id="TEST-001",
            dp_code="TEST_001",
            name_ko="테스트 DP",
            name_en="Test DP",
            description="테스트용 DP",
            standard="TEST",
            category="E",
            topic="테스트",
            dp_type="quantitative"
        )
        
        store.add_dp(dp)
        
        assert "TEST-001" in store.data_points
        assert store.data_points["TEST-001"].name_ko == "테스트 DP"
    
    def test_find_equivalent_dps(self, store):
        # Given
        dp1 = DataPoint(
            dp_id="GRI-305-1",
            equivalent_dps=["IFRS-S2-29-a"],
            # ... other fields
        )
        dp2 = DataPoint(
            dp_id="IFRS-S2-29-a",
            equivalent_dps=["GRI-305-1"],
            # ... other fields
        )
        
        store.add_dp(dp1)
        store.add_dp(dp2)
        
        # When
        equivalents = store.find_equivalent_dps("GRI-305-1")
        
        # Then
        assert "IFRS-S2-29-a" in equivalents
```

```python
# tests/integration/test_workflow.py
import pytest
from ifrs_agent.agent.workflow import IFRSAgentWorkflow

class TestWorkflow:
    @pytest.fixture
    async def workflow(self):
        return IFRSAgentWorkflow()
    
    @pytest.mark.asyncio
    async def test_full_workflow(self, workflow):
        result = await workflow.run(
            query="기후 리스크의 재무적 영향 섹션 작성",
            documents=["tests/fixtures/sample_reports/sr_2024.pdf"],
            target_standards=["IFRS_S2"],
            fiscal_year=2024,
            company_id="TEST_COMPANY"
        )
        
        assert result["status"] == "completed"
        assert len(result["generated_sections"]) > 0
        assert result["validation_results"][-1]["compliance_score"] >= 0.8
```

---

## 5. 배포 가이드

### 5.1 Docker 설정

```dockerfile
# Dockerfile
FROM python:3.10-slim

WORKDIR /app

# 시스템 의존성
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright 브라우저 설치
RUN playwright install chromium
RUN playwright install-deps

# 애플리케이션 코드
COPY . .

# 포트
EXPOSE 8000

# 실행
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  ifrs-agent:
    build: .
    ports:
      - "8000:8000"
    environment:
      - GROQ_API_KEY=${GROQ_API_KEY}
      - DART_API_KEY=${DART_API_KEY}
    volumes:
      - ./data:/app/data
      - ./models:/app/models
    depends_on:
      - postgres
      - neo4j
  
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=ifrs_agent
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=ifrs_agent
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  neo4j:
    image: neo4j:5.15
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD}
    volumes:
      - neo4j_data:/data

volumes:
  postgres_data:
  neo4j_data:
```

### 5.2 실행 명령

```bash
# 개발 환경
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# Docker 실행
docker-compose up -d

# 온톨로지 초기화
docker-compose exec ifrs-agent python scripts/init_ontology.py

# 기준서 수집
docker-compose exec ifrs-agent python scripts/collect_standards.py
```

---

## 6. 모니터링 및 운영

### 6.1 로깅 설정

```python
# config/logging.py
from loguru import logger
import sys

def setup_logging():
    """로깅 설정"""
    logger.remove()
    
    # 콘솔 출력
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
               "<level>{level: <8}</level> | "
               "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
               "<level>{message}</level>",
        level="INFO"
    )
    
    # 파일 출력
    logger.add(
        "logs/ifrs_agent_{time:YYYY-MM-DD}.log",
        rotation="1 day",
        retention="30 days",
        level="DEBUG"
    )
    
    # 에러 전용
    logger.add(
        "logs/errors_{time:YYYY-MM-DD}.log",
        rotation="1 day",
        retention="90 days",
        level="ERROR"
    )
```

### 6.2 메트릭 수집

```python
# monitoring/metrics.py
from prometheus_client import Counter, Histogram, Gauge

# 요청 카운터
requests_total = Counter(
    'ifrs_agent_requests_total',
    'Total requests',
    ['endpoint', 'status']
)

# 처리 시간
processing_time = Histogram(
    'ifrs_agent_processing_seconds',
    'Processing time',
    ['node']
)

# 활성 작업
active_jobs = Gauge(
    'ifrs_agent_active_jobs',
    'Active jobs'
)
```

---

## 7. 체크리스트

### 7.1 개발 완료 체크리스트

- [ ] 환경 설정 완료
- [ ] 데이터 모델 구현
- [ ] 온톨로지 저장소 구현
- [ ] RAG Node 구현
- [ ] Supervisor Node 구현 (검증+감사 통합)
- [ ] Gen Node 구현
- [ ] 워크플로우 통합 (Star Topology)
- [ ] 크롤링 서비스 구현
- [ ] 데이터 파이프라인 구현
- [ ] API 구현
- [ ] 테스트 작성
- [ ] 문서화

### 7.2 배포 전 체크리스트

- [ ] 환경 변수 설정 확인
- [ ] API 키 유효성 검증
- [ ] 벡터 DB 초기화
- [ ] 온톨로지 데이터 로드
- [ ] 모델 파일 배치
- [ ] 로깅 설정 확인
- [ ] 헬스체크 엔드포인트 테스트
- [ ] 부하 테스트 수행

---

## 8. 참고 자료

### 8.1 관련 문서

- [LangGraph 공식 문서](https://langchain-ai.github.io/langgraph/)
- [Groq API 문서](https://console.groq.com/docs)
- [IFRS S1/S2 기준서](https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/)
- [GRI Standards](https://www.globalreporting.org/standards/)

### 8.2 추가 학습 자료

- ESG 공시 트렌드 리포트
- TCFD 구현 가이드
- 한국 KSSB 지속가능성 공시기준 해설서

