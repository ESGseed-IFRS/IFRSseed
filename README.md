# IFRSseed
IFRS 지속가능경영보고서 작성 프로그램

---

ESGseed 팀이 개발한 **IFRS S1·S2 기반 ESG 공시 자동화 플랫폼**의 공식 저장소입니다. 본 프로젝트는 기업의 기존 TCFD 기반 자료와 ESG 데이터를 AI가 자동으로 구조화·매핑하여 **IFRS S2 기준에 완전히 부합하는 보고서 초안**을 생성하는 것을 목표로 합니다.

---

## 🚀 프로젝트 개요

**IFRSseed AI**는 기업의 PDF·Word·Excel 등 비정형 ESG 문서를 자동 파싱하고, 기준서(조문)와 매핑하여 **전문가 수준의 IFRS S2 보고서를 자동 생성하는 AI 서비스**입니다.

본 서비스는 단순 텍스트 생성기가 아닌, 전문 ESG 컨설턴트의 일처리 방식을 그대로 복제한 **멀티 에이전트 기반 생성 시스템**입니다.

---

## ✨ 주요 기능

### 1. **문서 자동 구조화(OCR + Parsing)**

* PDF(스캔본 포함), Word, Excel 자동 분석
* 레이아웃 인식, 표 추출, 문단 단위 청킹
* 슬라이딩 윈도우 기반 벡터 저장

### 2. **근거 기반 보고서 생성(RAG + pgvector)**

* 기업 문서 및 IFRS 기준서를 벡터 DB(pgvector)에 저장
* 검색 기반 Retrieval 후 문단 생성 → 모든 문장에 **출처·기준 조문·페이지 정보 자동 첨부**
* 회계법인·규제기관 감사 대응 수준 확보

### 3. **규정 준수 생성 모델(LoRA + LangChain)**

* IFRS S1/S2 기준서를 LoRA 방식으로 학습한 Skeleton Extractor 탑재
* LangChain 기반 멀티 에이전트 구조로 전문가 판단 프로세스 재현
* MCP(Multi-Context Protocol) 기반 도구 호출 시스템 지원

### 4. **전문가 상담형 보고서 작성 UX**

* AI가 부족한 데이터를 먼저 질문하는 구조
* 사용자는 필요한 정보에만 응답 → 문단 자동 업데이트
* 실시간 보고서 미리보기 제공

### 5. **최종 보고서 조합 기능**

* 섹션별 생성 문단 자동 병합
* 문체·용어 통일, 흐름 보정, 중복 제거
* PDF/Word 파일로 다운로드

---

## 🧱 시스템 아키텍처

```
React(프론트엔드)
     ↓
Spring Boot(Java 백엔드)
     ↓
Python AI Server (LangChain + MCP + LoRA)
     ↓
PostgreSQL + pgvector (벡터 DB)
```

### 🔧 구성 요소

* **UI (React)**: 상담형 인터페이스 + 실시간 보고서 프리뷰
* **Backend (Java Spring)**: 세션 관리, 사용자 입력 저장, 에이전트 호출
* **AI Server (Python)**: LangChain 멀티 에이전트 오케스트레이션
* **pgvector**: 기준서·보고서·데이터 임베딩 저장

---

## 🧠 AI 멀티 에이전트 구조

* **ESG Expert Agent**: 사용자 질문 분석, 규정 해석
* **Information Requester Agent**: 누락 데이터 확인
* **Evidence Retriever Agent**: 기준서·기존 보고서 근거 검색
* **Report Writer Agent**: IFRS S2 문단 생성
* **Report Combiner Agent**: 최종 보고서 조합

모든 생성 과정은 **역할 프롬프트 + 기준서 + 사용자 입력 + DB 검색 결과**로 구성된 자동 프롬프트를 기반으로 이루어집니다.

---

## 📄 데이터 구성

* **IFRS S1/S2 기준서** (ISSB, KSSB)
* **TCFD 가이드라인**
* **GRI / K-ESG 기준**
* **기업 ESG 보고서(2022~2024)**
* **국가 온실가스 데이터**
* **사용자 입력 데이터** (실제 기업 데이터)

데이터는 모두 문단 단위로 구조화되어 벡터 DB에 저장됩니다.

---

## 🛠️ 개발 환경

### Backend

* Java 21
* Spring Boot 3.5.x
* Spring WebFlux
* JPA/Hibernate 6 + QueryDSL
* Gradle 8.x

### Frontend

* React 18 / Next.js 14
* TypeScript 5
* TailwindCSS

### AI

* Python 3.10
* LangChain, LangGraph
* pgvector (PostgreSQL 16)
* LoRA (Skeleton Extractor)

### Infrastructure

* Docker Compose 기반 멀티 컨테이너 구조
* Eureka + Config Server + Gateway Server

---

## 📦 저장소 구조 예시

```
📦 ifrsseed-ai
 ┣ 📂 ui-server
 ┣ 📂 gateway-server
 ┣ 📂 config-server
 ┣ 📂 common-service
 ┣ 📂 ifrs-service
 ┣ 📂 rag-service
 ┣ 📂 ai-server-python
 ┗ 📂 vector-db
```

---

## 🧪 MVP 목표

* TCFD 기반 기존 보고서 업로드 → AI 자동 분석
* IFRS S2 기준서 매핑 정확도 80% 이상
* 완성도 있는 전체 보고서 초안 자동 생성
* PDF/Word 출력 구현

---

## 📌 향후 발전 방향

* ESRS, SEC 공시 기준 자동 대응
* 기업별 맞춤형 기후전략 추천
* 배출량 계산 모델 자동화
* 기업 ESG 데이터 거버넌스 플랫폼으로 확장

---

## 📚 참고 자료

본 README는 제출된 해커톤 기획서 내용을 기반으로 작성되었습니다.

해당 기획서:

fileciteturn0file0

---

## 🏷️ 라이선스

본 프로젝트는 해커톤 제출용으로 개발되었으며, 라이선스 정책은 추후 공개됩니다.

---

## 👥 팀 ESGseed

* 서은진
* 여태호

문의: (프로젝트 페이지 또는 GitHub Issues 활용)
