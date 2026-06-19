# AI 멀티 에이전트로 ESG 보고서를 자동 생성하다 — IFRSseed 개발기

> "지속가능경영보고서(SR) 한 권을 쓰려면 데이터 수집부터 표준 매핑, 문단 작성, 검증까지 수십 시간이 든다. 이걸 AI 에이전트들이 협업해서 자동으로 끝낼 수 있을까?"
>
> 이 질문에서 **IFRSseed** 프로젝트가 시작됐습니다.

---

## 0. TL;DR

- **무엇을 만들었나**: ESG/IFRS 지속가능경영보고서를 AI가 자동 생성하고, ISO 14064-1 기준 온실가스(GHG) 배출량을 계산하는 엔터프라이즈 플랫폼
- **핵심 기술**: LangGraph 멀티 에이전트, 하이브리드 RAG(pgvector), FastAPI 비동기, Next.js 16 / React 19
- **규모**: Backend 약 25,000 LOC, Frontend 약 15,000 LOC, 6개월 개발(4인 팀: BE 2 / FE 1 / AI 1)
- **성과**: 보고서 작성 공수 10시간 → 1시간(자동화율 85%), 전문가 검수 대비 정확도 94%, LLM 비용 65% 절감

---

## 1. 왜 이 프로젝트인가

상장사·대기업은 매년 ESG 공시 의무가 강화되고 있습니다. 그런데 실제 보고서 작성 현장은 이렇습니다.

- 사내 EMS/ERP/HR 시스템에 흩어진 데이터를 손으로 모으고
- GRI · ESRS · IFRS S2 같은 **서로 다른 공시 표준**에 맞춰 항목을 일일이 매핑하고
- 온실가스 배출량은 ISO 14064-1 공식에 맞춰 엑셀로 계산하고
- 마지막엔 사람이 문단을 직접 써 내려갑니다.

표준이 다르면 같은 "Scope 1 배출량"도 항목 코드(GRI 305-1 ↔ ESRS E1-6)가 달라집니다. 이 반복적이고 오류가 잦은 과정을 **AI 에이전트 협업 + RAG**로 자동화하는 것이 IFRSseed의 목표였습니다.

---

## 2. 시스템 아키텍처

도메인별로 책임을 쪼갠 **레이어드 모놀리식** 구조를 택했습니다. 마이크로서비스의 운영 복잡도 없이, 도메인 경계만 명확히 가져가는 절충안입니다.

```
┌──────────────────────────────────────────────┐
│           Frontend (Next.js 16 / React 19)    │
│   Dashboard · SR Report · GHG Calc · Admin    │
└──────────────────────────────────────────────┘
                     │ REST + SSE
┌──────────────────────────────────────────────┐
│              Backend (FastAPI)                │
│   API Layer   →   Core Layer   →  Domain Layer │
│                                                │
│   Domain(v1):                                  │
│   ifrs_agent · ghg_calculation                 │
│   esg_data   · data_integration                │
│   (각 도메인 = Hub / Spokes / Models)          │
└──────────────────────────────────────────────┘
                     │
        PostgreSQL + pgvector (Vector Store)
```

각 도메인은 **Hub**(오케스트레이터·서비스·리포지토리)와 **Spokes**(에이전트·툴·인프라)로 나뉩니다. 비즈니스 로직과 외부 연동을 분리해, 에이전트나 툴을 플러그인처럼 갈아 끼울 수 있게 설계했습니다.

---

## 3. 4개의 핵심 도메인

### 3-1. `ifrs_agent` — SR 보고서 자동 생성

이 프로젝트의 심장입니다. **LangGraph `StateGraph`** 위에서 5개 전문 에이전트가 순차/조건부로 협업합니다.

| Phase | 노드 | 역할 | 모델 |
|-------|------|------|------|
| 0 | 프롬프트 해석 | 보고서 생성 의도 파악 | Gemini 2.5-pro |
| 1 | C-RAG / DP-RAG | 절(clause) 검색 + 데이터포인트 매핑 | pgvector + GPT-5-mini |
| 1.5 | 적합성 판단 | "이 DP가 요청과 맞는가?" | Gemini 2.5-flash |
| 2 | Aggregation | 내부 DB + 계열사 + 외부 뉴스(Tavily) 통합 | Gemini 2.5-pro |
| 3 | Gen Node | 한국어 SR 문단 생성 | Gemini 3-flash |
| 4 | Validator | 규칙 + LLM 검증 | — |

**왜 단일 LLM 호출이 아니라 멀티 에이전트인가?** 프롬프트가 길어질수록 품질이 떨어지고 컨텍스트가 손실됩니다. 각 에이전트가 좁은 역할만 맡고 결과를 상태(state)로 넘기니, 중간 결과를 체크포인트에 저장해 **실패 지점부터 재시작**할 수 있고 독립 노드는 병렬 처리됩니다.

```python
workflow = StateGraph(WorkflowState)
workflow.add_node("c_rag", c_rag_handler)
workflow.add_node("dp_rag", dp_rag_handler)
workflow.add_node("gen", gen_handler)

# 데이터포인트가 없으면 조기 종료
workflow.add_conditional_edges(
    "dp_rag",
    lambda s: "aggregation" if s["dps"] else END,
)
```

### 3-2. `ghg_calculation` — ISO 14064-1 배출량 엔진

엑셀/CSV 원시 데이터를 받아 **Scope 1/2/3** 배출량을 계산합니다. 단위가 제각각(kWh, 천Nm³, L…)이라 먼저 열량계수 기반으로 **TJ로 정규화**한 뒤 가스별 배출계수와 GWP(AR5/AR6)를 적용합니다.

```python
def calculate_emissions(activity_tj, co2_f, ch4_f, n2o_f):
    co2      = activity_tj * co2_f
    ch4_co2eq = activity_tj * ch4_f * 28   # CH4 GWP(AR5)
    n2o_co2eq = activity_tj * n2o_f * 265  # N2O GWP(AR5)
    return co2 + ch4_co2eq + n2o_co2eq
```

계산 전 **이상치 탐지**(z-score / IQR)로 전년 대비 급증·급감과 배출 강도 이상을 잡아내고, 프론트에서 빨간색 + 툴팁("Z-score 3.2, 평균 대비 320%")으로 강조합니다. 데이터 신뢰성이 곧 보고서 신뢰성이기 때문입니다.

### 3-3. `esg_data` — 크로스 스탠다드 UCM 자동 매핑

GRI ↔ ESRS ↔ IFRS 데이터포인트를 자동 매핑하는 **3단계 파이프라인**입니다. 핵심은 "전부 LLM에 맡기지 않는다"는 비용 전략입니다.

1. **벡터 유사도**(pgvector 코사인) — 후보 K-NN 추출
2. **정책 기반 필터링**(Python) — topic·unit 구조 매칭 + 검증 규칙 일관성
3. **LLM 보정** — 애매한 **경계 구간(0.35~0.75)만** GPT-5-mini가 재평가, 40개씩 마이크로배치

명확한 건 규칙으로, 애매한 것만 LLM으로 — 이 분리가 정확도와 비용을 동시에 잡았습니다.

### 3-4. `data_integration` — 외부 SR 수집·파싱

경쟁사·벤치마크 보고서를 자동 수집합니다. **Tavily 웹 검색**(도메인 가드레일로 공식 사이트만 허용) → **MCP 툴**로 PDF 다운로드 → LangGraph 파싱 워크플로(목차 / 본문 / 이미지 VLM 캡션) → BGE-M3 임베딩 → pgvector 저장.

여기서 **MCP(Model Context Protocol)**를 도입해, 로컬 개발은 in-process 트랜스포트, 프로덕션은 HTTP 트랜스포트로 같은 툴을 그대로 재사용할 수 있게 했습니다.

---

## 4. 기술적으로 공들인 지점

### 하이브리드 RAG

단순 벡터 검색은 "배출량 증가"와 "배출량 감소 목표"처럼 **의도가 반대인데 표현이 비슷한** 문장을 구분하지 못합니다. 그래서 **벡터 + 키워드(PostgreSQL FTS) + LLM 재선택**을 결합했고, 정확도가 82% → 94%로 올랐습니다.

### 엔터프라이즈급 비동기

`asyncio` + `asyncpg` 연결 풀(min 5 / max 20) + 비동기 LLM 배치 호출로 동기 대비 처리량을 끌어올렸습니다. SR 생성처럼 수십 초 걸리는 작업은 **SSE(Server-Sent Events)**로 진행 상황을 실시간 스트리밍합니다.

### GPU 가속 임베딩

BGE-M3 임베딩을 CPU로 돌리면 1,000문장에 30초. PyTorch CUDA + 배치(batch_size=64)로 T4 GPU에서 **2초**로 줄였습니다.

### LLM 비용 최적화

작업 난이도에 따라 **계층적 모델 선택**(분류→flash, 생성→flash, 추론→pro)에 캐싱·배치를 더해 월 LLM 비용을 65% 절감했습니다.

---

## 5. 배포 & 운영

```
[Vercel: Next.js] → HTTPS → [EC2: Nginx → Uvicorn(FastAPI, :9001)] → [Neon/Supabase: PostgreSQL]
```

- **CI/CD**: GitHub Actions로 Ruff 린트 + Pytest + compile 후 EC2에 rsync, systemd 재시작
- **서버**: AWS EC2 `g4dn.xlarge`(NVIDIA T4 GPU), Nginx 리버스 프록시 + Let's Encrypt
- **DB**: 관리형 PostgreSQL(Neon/Supabase) + pgvector

---

## 6. 가장 기억에 남는 트러블슈팅: SSE 스트리밍이 끊긴다

배포 후 프론트(Vercel)에서 백엔드(EC2)의 SR 생성 스트리밍을 호출하면 중간에 `net::ERR_INCOMPLETE_CHUNKED_ENCODING`이 터졌습니다.

처음엔 DB 연결 오류를 의심했지만, **DB 레이어와 스트림 끊김은 별개**라는 걸 분리해냈습니다. 워크플로가 길어지면(45초+) 프록시 단의 타임아웃·버퍼링이 SSE 연결을 끊는 게 진짜 원인이었습니다.

```nginx
location / {
    proxy_pass http://127.0.0.1:9001;
    proxy_http_version 1.1;        # chunked 전송
    proxy_read_timeout 3600s;      # 긴 워크플로 대응
    proxy_buffering off;           # SSE 필수
    proxy_set_header X-Accel-Buffering "no";
}
```

이 경험으로 배운 것: **스트리밍은 애플리케이션 코드만의 문제가 아니다.** 브라우저 ↔ 프록시 ↔ 앱 전 구간의 타임아웃·버퍼링을 함께 봐야 하고, 프론트에는 스트림 중단 시 동기 API로 떨어지는 폴백을 반드시 둬야 합니다.

---

## 7. 회고

**잘한 선택**
- 도메인을 Hub/Spokes로 쪼개 에이전트·툴을 독립적으로 교체할 수 있게 한 것
- "규칙으로 거를 건 규칙으로, 애매한 것만 LLM으로" — 정확도와 비용을 동시에 잡은 분리 전략
- MCP 도입으로 로컬/프로덕션 툴 실행 방식을 통일한 것

**아쉬운 점 & 다음 계획**
- 멀티모달 확장(표·그래프 이미지 OCR)
- 도메인 특화 LLM 파인튜닝(ESG 보고서 코퍼스)
- WebSocket 기반 실시간 다중 사용자 편집

---

## 8. 한 줄 요약

> 흩어진 ESG 데이터를, 여러 표준을 넘나들며, 사람이 며칠 걸리던 보고서로 — **AI 에이전트들이 협업해 한 시간 만에** 만들어내는 플랫폼.

기술 스택: `LangGraph` · `FastAPI` · `pgvector` · `Next.js 16` · `React 19` · `PostgreSQL` · `MCP` · `AWS EC2(GPU)`
