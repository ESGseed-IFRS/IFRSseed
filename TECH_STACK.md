# IFRSseed 기술 스택 명세서

## 📋 개요
IFRSseed는 ESG/IFRS 보고서 생성 및 온실가스 배출량 계산을 위한 AI 기반 엔터프라이즈 플랫폼입니다.

---

## 🏗️ 아키텍처

### 시스템 구성
- **Multi-Domain Architecture**: 도메인별 모듈화된 마이크로서비스 아키텍처
- **Agent-based Workflow**: LangGraph 기반 멀티 에이전트 오케스트레이션
- **Event-driven Pipeline**: MCP(Model Context Protocol) 기반 비동기 처리

---

## 💻 Backend

### 1️⃣ IFRS Agent (`backend/domain/v1/ifrs_agent`)
> AI 에이전트 기반 IFRS/ESG 보고서 자동 생성

#### 프레임워크 & 런타임
- **Python**: 3.11+
- **FastAPI**: 비동기 REST API 서버
- **LangGraph**: 멀티 에이전트 워크플로우 오케스트레이션
- **LangChain**: LLM 통합 및 체인 관리

#### AI/LLM 모델
- **Google Gemini**:
  - `gemini-3-flash-preview`: SR 문단 생성 (Gen Node)
  - `gemini-2.5-pro`: Phase 2 데이터 선택 (Orchestrator)
  - `gemini-2.5-flash`: DP 적합성 판단 (Phase 1.5)
- **OpenAI GPT**: 
  - `gpt-5-mini`: C-RAG 벡터 후보 재선택
- **Groq LLaMA**: 
  - `llama-3.3-70b-versatile`: RAG/Supervisor 기본 모델

#### 임베딩 & 벡터 검색
- **Embedding Model**: `BAAI/bge-m3` (1024차원)
- **Vector Store**: PostgreSQL + pgvector
- **검색 전략**: 
  - Hybrid Search (벡터 + 키워드)
  - Semantic Similarity Matching
  - Contextual Retrieval

#### 주요 에이전트 구성
1. **C-RAG Agent**: 절(clause) 검색 및 문맥 추출
2. **DP-RAG Agent**: 데이터포인트 메타데이터 및 실데이터 매핑
3. **Aggregation Node**: 계열사/외부 기업 데이터 통합
4. **Gen Node**: Gemini 기반 SR 문단 생성
5. **Validator Node**: 규칙 기반 + LLM 검증

#### 데이터베이스
- **PostgreSQL**: 메인 데이터 저장소
- **asyncpg**: 비동기 PostgreSQL 드라이버
- **SQLAlchemy**: ORM 및 쿼리 빌더
- **Alembic**: 데이터베이스 마이그레이션
- **pgvector**: 벡터 유사도 검색 확장

---

### 2️⃣ GHG Calculation (`backend/domain/v1/ghg_calculation`)
> ISO 14064-1 / GHG Protocol 기반 온실가스 배출량 계산

#### 핵심 기능
- **배출량 계산 엔진**: 
  - TJ 변환 및 배출량 산정
  - Scope 1/2/3 계산
  - GWP(AR5/AR6) 적용
- **배출계수 검증**: 
  - 배출계수 유효성 검증
  - 단위 변환 및 정규화
- **이상치 탐지**: 
  - 원시 데이터 이상치 스캔
  - 배출 강도 이상치 분석
  - 데이터 품질 검증

#### 프레임워크
- **Python**: 3.11+
- **Pydantic**: 데이터 검증 및 직렬화
- **Loguru**: 구조화된 로깅

#### 알고리즘
- 열량계수 기반 TJ 변환
- 복합/가스별 배출계수 적용
- 냉매 누출 배출량 계산
- 전력 배출량 직접 계산

---

### 3️⃣ ESG Data (`backend/domain/v1/esg_data`)
> ESG 데이터 통합 및 UCM(Unified Column Mapping) 자동 생성

#### 주요 기능
- **UCM 자동 매핑**: 
  - 크로스 스탠다드 데이터포인트 매핑
  - 벡터 유사도 + 구조적 매칭
  - LLM 기반 정교화 (경계 구간)
- **LangGraph Workflow**: 
  - Phase 1: 벡터 검색
  - Phase 2: 정책 필터링
  - Phase 3: LLM 보정 및 최종 결정

#### AI/LLM 모델
- **OpenAI**:
  - `gpt-5-mini`: UCM 매핑 보정 (경계 구간 재평가)

#### MCP Tools
- `create_unified_column_mapping`: 배치 매핑 생성
- `suggest_mappings`: 후보 추천 (저장 없음)

#### 저장소
- **UCM Repository**: 매핑 데이터 CRUD
- **Ghg Activity Repository**: 활동 데이터 관리
- **Environmental/Social Data Repositories**: ESG 데이터 통합

---

### 4️⃣ Data Integration (`backend/domain/v1/data_integration`)
> 외부 SR 보고서 수집, 파싱, 임베딩 파이프라인

#### 주요 기능
- **SR Agent**: 
  - Tavily 웹 검색 기반 SR PDF 자동 수집
  - 도메인 가드레일 (허용 도메인 필터링)
  - PDF bytes 다운로드 및 저장
- **SR Parsing Workflow**:
  - PDF → 목차 추출 (Index Agent)
  - 본문 파싱 (Body Agent)
  - 이미지 추출 및 VLM 캡션 생성 (Images Agent)
- **Embedding Pipeline**:
  - 본문 메타데이터 임베딩
  - 이미지 캡션 임베딩
  - 문맥 기반 검색 최적화

#### 프레임워크 & 라이브러리
- **LangChain**: 
  - `langchain_openai.ChatOpenAI`: OpenAI 통합
  - `langchain_groq.ChatGroq`: Groq LLaMA 통합
  - `langchain_core.tools.BaseTool`: MCP Tool 어댑터
- **LangGraph**: SR 파싱 워크플로우
- **MCP (Model Context Protocol)**:
  - `langchain-mcp-adapters`: MCP ↔ LangChain 브리지
  - In-process / HTTP / stdio 트랜스포트 지원

#### 외부 API
- **Tavily API**: 웹 검색
- **DART API**: 전자공시 데이터
- **VLM API**: 이미지 캡션 생성

#### 저장소
- **SR Report Index/Body/Images Repositories**: 보고서 데이터 관리
- **External Company Data Repository**: 외부 기업 정보

---

## 🎨 Frontend

### 기술 스택
- **Framework**: Next.js 16.2+ (App Router)
- **Language**: TypeScript 6.0+
- **Runtime**: Node.js 20.9+
- **Package Manager**: pnpm

### UI 라이브러리
- **React**: 19.0+
- **Radix UI**: Headless UI 컴포넌트 (Accordion, Dialog, Dropdown, Tabs 등)
- **Tailwind CSS**: 유틸리티 퍼스트 CSS
- **Shadcn/ui**: Radix + Tailwind 조합 컴포넌트
- **Lucide React**: 아이콘 라이브러리

### 상태 관리 & 데이터 페칭
- **Zustand**: 경량 전역 상태 관리
- **TanStack React Query**: 서버 상태 관리 및 캐싱
- **React Hook Form**: 폼 관리
- **Zod**: 스키마 검증

### 기타
- **@dnd-kit**: 드래그 앤 드롭
- **Recharts**: 차트 시각화
- **date-fns**: 날짜 처리
- **Axios**: HTTP 클라이언트
- **Supabase JS**: 인증 및 실시간 데이터

---

## 🗄️ 데이터베이스

### PostgreSQL
- **버전**: 14+ (Supabase/Neon 등 관리형 서비스 사용)
- **확장**: 
  - `pgvector`: 벡터 유사도 검색
  - `uuid-ossp`: UUID 생성
- **연결 풀링**: 
  - asyncpg (비동기)
  - Min: 5, Max: 20 (설정 가능)
  - 타임아웃: 획득 120초, 쿼리 150초

### 주요 테이블
- **sr_report_body**: 보고서 본문 + 임베딩 벡터
- **sr_report_images**: 이미지 메타데이터 + VLM 캡션
- **data_points**: IFRS/ESG 데이터포인트
- **rulebooks**: 규칙 및 조항
- **unified_column_mappings**: 크로스 스탠다드 매핑
- **ghg_emission_results**: 온실가스 배출량 결과
- **staging_raw_data**: 원시 데이터 스테이징

---

## 🚀 DevOps & Infrastructure

### CI/CD
- **GitHub Actions**: 
  - Lint (Ruff) + Test (Pytest) + Compile
  - EC2 자동 배포 (rsync + systemd)
  - ALB idle timeout 설정

### 배포
- **서버**: AWS EC2 (Ubuntu)
- **Python 환경**: venv (Python 3.12)
- **프로세스 관리**: systemd
- **역방향 프록시**: Nginx
- **HTTPS**: Let's Encrypt (Certbot)

### GPU 지원
- **PyTorch**: CUDA 12.4 빌드
- **GPU 드라이버**: NVIDIA 550+
- **추론 가속**: GPU 기반 임베딩 (선택)

### 모니터링 & 로깅
- **Loguru**: 구조화된 로깅
- **systemd journald**: 시스템 로그
- **Nginx access/error logs**: 프록시 로그

---

## 📦 주요 의존성

### Backend Core
```
fastapi
uvicorn[standard]
sqlalchemy
asyncpg
alembic
pydantic
pydantic-settings
python-dotenv
loguru
```

### AI/LLM
```
langchain
langchain-core
langchain-openai
langchain-groq
langchain-mcp-adapters
langgraph
google-generativeai
openai
```

### ML/Embedding
```
torch
torchvision
sentence-transformers
```

### 개발/테스트
```
pytest
pytest-asyncio
ruff
```

---

## 🔐 보안 & 인증

### 환경 변수 관리
- `.env` 파일 (로컬/개발)
- GitHub Secrets (CI/CD)
- systemd EnvironmentFile (프로덕션)

### API 키 관리
- `GROQ_API_KEY`: Groq LLaMA
- `OPENAI_API_KEY`: OpenAI GPT
- `GEMINI_API_KEY`: Google Gemini
- `TAVILY_API_KEY`: Tavily 웹 검색
- `DART_API_KEY`: DART 전자공시
- `DATABASE_URL`: PostgreSQL 연결 문자열

### CORS
- 환경 변수 `FRONT_URL`로 허용 Origin 설정
- 쉼표 구분 다중 Origin 지원

---

## 📊 성능 최적화

### 데이터베이스
- **연결 풀링**: asyncpg pool (min 5, max 20)
- **인덱스 전략**: 
  - 벡터 인덱스 (pgvector IVFFlat/HNSW)
  - 복합 인덱스 (company_id, year, standard 등)
- **쿼리 타임아웃**: 150초 (장시간 임베딩 쿼리 대응)

### AI 추론
- **배치 처리**: 
  - LLM 호출 마이크로배치 (40개 단위)
  - 임베딩 배치 생성
- **캐싱**: 
  - DP-RAG 캐시 (메모리 기반)
  - React Query 캐싱 (프론트엔드)
- **비동기 처리**: 
  - asyncio 기반 동시 실행
  - LangGraph 병렬 노드

### 프론트엔드
- **코드 스플리팅**: Next.js 자동 최적화
- **이미지 최적화**: Next.js Image 컴포넌트
- **SSR/SSG**: 하이브리드 렌더링

---

## 🔄 버전 관리

### Git Workflow
- **Main Branch**: 프로덕션 배포
- **Feature Branches**: 기능 개발
- **PR CI**: backend 경로 변경 시 자동 린트/테스트

### 데이터베이스 마이그레이션
- **Alembic**: 스키마 버전 관리
- **Revision Scripts**: `backend/alembic/versions/`
- **자동 생성**: `alembic revision --autogenerate`

---

## 📝 코드 품질

### Linting
- **Ruff**: Python 린터/포매터
  - 타겟: Python 3.11
  - 라인 길이: 120
  - 룰셋: E9, F821, F822, F823 (치명적 오류만)

### Testing
- **Pytest**: 단위/통합 테스트
- **pytest-asyncio**: 비동기 테스트 지원
- **Coverage**: 테스트 커버리지 추적

### Type Checking
- **TypeScript**: strict 모드 (프론트엔드)
- **Pydantic**: 런타임 타입 검증 (백엔드)

---

## 🌐 외부 통합

### API 통합
- **Tavily**: 웹 검색 (SR 보고서 수집)
- **DART**: 금융감독원 전자공시
- **OpenAI**: GPT-4/GPT-5 LLM
- **Google Gemini**: Gemini 2.5/3.0 LLM
- **Groq**: LLaMA 3.3 추론 가속

### MCP Servers
- **web_search**: Tavily 검색 래퍼
- **sr_tools**: SR 다운로드/링크 추출
- **sr_body_tools**: 본문 파싱
- **sr_images_tools**: 이미지 추출/VLM
- **esg_data_tools**: UCM 매핑 툴

---

## 📈 확장성

### 수평 확장
- **Stateless API**: 세션 상태 없음
- **DB 연결 풀**: 다중 인스턴스 지원
- **Load Balancer**: ALB idle timeout 설정 (SSE 대응)

### 모듈 확장
- **플러그인 아키텍처**: 
  - Agent Registry (동적 에이전트 등록)
  - Tool Registry (동적 툴 등록)
  - MCP Transport (inprocess/http/stdio)

---

## 📚 문서화

### 프로젝트 문서
- `backend/domain/v1/ifrs_agent/docs/`: 아키텍처 가이드
- `backend/domain/v1/ifrs_agent/DEPENDENCIES.md`: 의존성 명세
- `README.md`: 프로젝트 개요 (필요 시 생성)

### API 문서
- **FastAPI Swagger**: `/docs` (자동 생성)
- **FastAPI ReDoc**: `/redoc` (자동 생성)

---

## 🎯 핵심 차별점

1. **Multi-Agent Orchestration**: LangGraph 기반 복잡한 워크플로우 자동화
2. **Cross-Standard Mapping**: AI 기반 ESG 스탠다드 간 자동 매핑
3. **Hybrid RAG**: 벡터 + 키워드 + 구조적 매칭 결합
4. **Enterprise-grade**: 비동기 처리, 연결 풀링, 타임아웃 관리
5. **Extensible Architecture**: MCP 기반 툴 확장, 에이전트 플러그인

---

**작성일**: 2026-04-11  
**버전**: 1.0.0
