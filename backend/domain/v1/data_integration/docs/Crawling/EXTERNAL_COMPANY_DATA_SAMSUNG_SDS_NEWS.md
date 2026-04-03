# 삼성SDS 언론보도 → `external_company_data` 크롤·적재 전략

> **범위**: `backend/domain/v1/data_integration` 에서 구현할 **배치 크롤** 파이프라인 설계·**구현 스펙**.  
> **기준 워크플로**: [ifrs_agent/docs/REVISED_WORKFLOW.md](../../../ifrs_agent/docs/REVISED_WORKFLOW.md) §2.2 `external_company_data`, §3.2.7.  
> **DB 스키마**: Alembic `037_subs_ext_company_data` (`external_company_data`, `subsidiary_data_contributions`).

> **범위 제외(본 문서·현재 스펙)**: 언론 기사 내 **이미지 파일 다운로드·객체 스토리지 저장·DB 바이너리 저장**은 하지 않는다. 본문·메타는 **텍스트·URL 중심**으로 적재한다.

> **LLM 컨텍스트·프롬프트 팩(별첨)**: [EXTERNAL_COMPANY_DATA_SAMSUNG_SDS_NEWS_LLM_BRIEF.md](EXTERNAL_COMPANY_DATA_SAMSUNG_SDS_NEWS_LLM_BRIEF.md) — 초보자용(부록 A/B), 스펙 심층(부록 C/D), **플로우·레이어·기술 스택(부록 E/F, 제미나이 등)**. 심층·구조 설명 시 **스펙 전문 + 브리프(아키텍처 절)** 를 함께 붙일 것.

---

## 1. 목적

- SR 자동작성 플랫폼(주체: 삼성SDS)에서 **`aggregation_node`가 조회할 보도·언론 스냅샷**을 `external_company_data`에 쌓는다.
- **SR 생성 요청 경로에서는 실시간 크롤링하지 않는다.** 수집은 **실행 경로 밖 배치 잡**(또는 Data Integration API 트리거)으로 수행하고, 생성 시에는 **DB 조회만** 한다.

---

## 1.5 개발자 관점 요약 (플로우·기술·배치·DB·임베딩)

이 절은 **코드의 식별자 이름을 열지 않고도** 파이프라인을 짐작할 수 있게 한 장으로 정리한 것이다. 세부 제어·경로는 **§8 설정**, **§7 코드 구조**, **§9 엔트리포인트**를 병행한다.

### 런타임 플로우 (한 번의 ingest가 하는 일)

1. **(선택)** 목록 URL에 대해 **HEAD**로 응답 헤더(ETag 등)를 받고, DB의 **수집 상태 테이블**에 저장된 이전 값과 비교해 **변경이 없으면 즉시 종료**한다.
2. **목록**: HTML 우선, 비어 있거나 구조가 맞지 않으면 **JSON 피드**(`news.txt` 경로)로 폴백해 1차 기사 URL 목록을 만든다.
3. **(선택)** 이번 실행에서 처리할 **목록 상한**이 설정돼 있으면 앞에서부터 잘라 낸다. `0`이면 제한 없음.
4. **2·3단계 크롤**(설정으로 끌 수 있음): 각 1차 상세 페이지를 받아 **외부 언론 URL**과 메타를 얻고, 가능하면 **외부 페이지에서 본문**을 받는다. 이 구간은 **I/O 위주**라 스레드 풀로 **동시 요청 수를 제한**해 병렬 처리한다. 항목 사이에 짧은 간격을 두어 상대 서버 부담을 줄인다.
5. 행 단위로 **`external_company_data`에 멱등 upsert**한다. 저장 시점에 **임베딩이 켜져 있으면** 아래 임베딩 전략에 따라 벡터 컬럼을 채운 뒤 같은 행에 반영한다.
6. 성공적으로 목록까지 진행했다면 **수집 상태 테이블**에 이번 실행의 ETag·배치 식별자 등을 **다시 기록**한다.

**트리거**: Data Integration **API(POST)** 로 수동 실행하거나, 서버 **lifespan 백그라운드**에서 **폴링 간격**마다 같은 ingest를 돌린다. **이전 실행이 아직 끝나지 않은 tick은 건너뛴다.**

### 계층 감각

- **API·폴링**: HTTP/앱 수명주기에서 ingest를 **한 번 호출**하는 얇은 진입.
- **도메인 서비스**: 0~6 단계를 **순서대로 조율**하고, HTTP·파싱·DB·임베딩을 호출한다.
- **저장소**: `external_company_data`용 upsert는 **호출마다 짧은 DB 세션**을 쓰는 패턴에 맞춘다. 수집 상태는 아래 **DB 연결** 절의 방식을 따른다.

### 사용 기술 (스택)

| 영역 | 선택 |
|------|------|
| 런타임·API | Python, **FastAPI**, lifespan 백그라운드 태스크 |
| HTTP | **httpx** (동기 클라이언트, 재시도·타임아웃·User-Agent 설정) |
| HTML | **BeautifulSoup** + **lxml**; 외부 기사는 `article`·`main` 등 **범용 셀렉터**와 `body` 폴백 |
| DB | **SQLAlchemy** ORM, **Alembic** 마이그레이션, **PostgreSQL** + **pgvector**(`vector(1024)`) |
| 임베딩 | 공통 **BGE-M3**(기본 모델명은 환경변수로 덮어씀), **FlagEmbedding** 경로로 로드하는 기존 임베딩 서비스와 동일 계열 |
| 병렬 | **스레드 풀**로 2·3단계 HTTP를 묶음 처리(동시성 상한은 설정) |

### 기본 숫자·배치 설정

`backend/core/config/settings.py` 및 환경변수 기준 **현재 기본값**은 아래와 같다. 운영에서는 §8 표와 `.env`를 단일 출처로 본다.

| 구분 | 환경변수(요지) | 기본값 | 의미 |
|------|----------------|--------|------|
| 폴링 주기 | `SDS_NEWS_POLL_INTERVAL_S` | **300**초 | 자동 ingest tick 간격 |
| HTTP 병렬도 | `SDS_NEWS_CONCURRENCY` | **6** | 2·3단계에서 동시에 날리는 요청 수 상한 |
| 목록 상한 | `SDS_NEWS_MAX_ITEMS_PER_RUN` | **0** | `0` = 무제한, 양수면 이번 실행 목록 앞쪽만 처리 |
| 임베딩 켜기/끄기 | `SDS_NEWS_EMBED` | **켬** | `false` 계열이면 벡터 채우기 생략 |
| 임베딩 배치 크기 | `SDS_NEWS_EMBED_BATCH_SIZE` | **16** | 제목·본문 벡터를 잘라서 모델에 넣는 배치 |
| 본문 임베딩 길이 | `SDS_NEWS_EMBED_BODY_MAX_CHARS` | **12000** | 본문이 더 길면 앞부분만 임베딩 입력에 사용 |
| 임베딩 모델 | `EMBEDDING_MODEL` | **BAAI/bge-m3** | 플랫폼 공통 텍스트 임베딩 모델 |

### 임베딩 전략 (무엇을 어디에 넣는지)

- **제목 우선**: 제목 텍스트가 있으면 그것을 **제목·헤드라인용 벡터 컬럼**(스키마상 `category_embedding`)에 넣는다. 제목이 비면 **카테고리 문자열**만이라도 같은 컬럼에 넣을 수 있게 한다.
- **본문**: 정리된 **본문 텍스트**를 **본문용 벡터 컬럼**(`body_embedding`)에 넣는다. 길이는 위 **최대 문자**로 자른다.
- **실행 방식**: 제목 후보들을 **한 배치**, 본문 후보들을 **한 배치** 식으로 나누어 모델에 태운다(배치 크기는 위 표). 벡터는 **L2 정규화**를 적용하는 쪽이 기본이다.
- **실패 허용**: 임베딩 단계가 실패해도 **행 적재 자체는 계속**하도록 하고, 로그로만 남긴다(운영에서 GPU·메모리 이슈 대비).

### DB 연결·세션 (장시간 크롤과의 분리, Neon 등)

문제: 한 번의 ingest가 **수십 분** 걸릴 수 있는데, 그동안 **하나의 DB 세션**을 열어 둔 채로 HTTP만 하고 있으면, **관리형 Postgres(Neon)·프록시**가 유휴 연결을 끊은 뒤 마지막에 상태를 쓰려다 **`SSL connection has been closed unexpectedly`** 류 오류가 날 수 있다.

대응:

- **`external_company_data` 적재**: upsert는 **짧은 세션**으로 처리하는 쪽과 맞춘다.
- **수집 상태(`ingest_state`)**: 크롤 **전후**에만 DB에 닿는다. 상태 전용 **별도 엔진**을 두고 **`pool_pre_ping`**, **`pool_recycle`을 유휴 타임아웃보다 짧게**(대략 수백 초 단위) 잡아 **끊긴 연결을 재사용하지 않도록** 한다. ETag 비교용 읽기·마지막 상태 기록용 쓰기는 **각각 짧게 열고 닫는 세션**으로 끝낸다.

이렇게 하면 **“무료 디스크 할당량 초과”**와 증상이 겹치기 어렵다. 할당량 문제는 보통 **quota·disk full** 등 **명시적** 메시지가 많다.

---

## 2. 수집 진입점·크롤 경로 (3단계)

### 2.0 개요: 목록 → 1차 상세 → 외부 기사

삼성SDS [언론보도 index.html](https://www.samsungsds.com/kr/news/index.html) 는 두 섹션(`#bThumbs` 보도자료, `#sThumbs` 언론이 본 삼성SDS)에 각 기사로 가는 **1차 링크**를 담는다.  
**1차 상세 페이지**(`/kr/news/xxx.html`)는 짧은 요약과 `p.txt a[href]`로 **외부 언론사 실제 기사**로 연결한다.  
**최종 수집 대상은 외부 기사의 본문 텍스트·메타**이다.

### 2.1 1단계: 목록 페이지 (index.html)

**진입 URL**: `Settings.sds_news_list_url` (기본 `https://www.samsungsds.com/kr/news/index.html`)

| 섹션 | DOM | 하위 구조 | 추출 |
|------|-----|----------|------|
| **보도자료** | `div#bThumbs` | `div.thumb` → `a[href]` | **1차 상세 URL** (상대 경로 → 절대화) |
| **언론이 본 삼성SDS** | `div#sThumbs` | `div.thumb` → `.thumb_title a[href]`, `.thumb_date` | **1차 URL**, 날짜 |

**실제 마크업**: JS로 비동기 채워짐. 정적 HTML에 `div.thumb`가 없으면 **`/kr/news/news.txt` JSON**을 폴백으로 파싱(`detailLink` 필드).

**날짜·언론사**: `#sThumbs`의 `.thumb_date` 또는 JSON `releaseDate` / `contact`.

### 2.2 2단계: 1차 상세 페이지 (`/kr/news/xxx.html`)

예: `https://www.samsungsds.com/kr/news/fn-251125.html`

| 요소 | 추출 |
|------|------|
| 제목 | `h1` 또는 페이지 타이틀 |
| 날짜·카테고리 | 상단 메타 또는 `.txt` 앞부분 |
| **외부 링크** | `p.txt a[href]` (예: `https://www.fnnews.com/news/202511241407166044`) — **이 링크가 실제 언론 기사** |

**구조 확인**: "언론이 본 삼성SDS" 성격 기사는 **짧은 안내문 + 외부 링크**, "보도자료"는 **전문이 해당 페이지에 있을 수도** 있음(실측 확인).

### 2.3 3단계: 외부 기사 본문 (언론사 사이트)

예: `https://www.fnnews.com/news/202511241407166044` (파이낸셜뉴스)

| 추출 항목 | 설명 |
|-----------|------|
| **본문 텍스트** | `article`, `#articleBody`, `.article_view` 등 언론사 DOM(각 사이트별로 다름, 범용 선택자 사용) |
| **메타** | 언론사명(`external_org_name`), 발행일(`as_of_date`) 재확인 |

**난이도**: 언론사마다 DOM·구조가 다르므로, **범용 파서** 또는 **LLM 기반 추출**을 고려.

---

## 3. 파싱 전략

### 3.1 구조화 파싱(파이썬)

- **목록·1차 상세(삼성SDS 페이지)**: `beautifulsoup4` + `lxml` 또는 `httpx` + BeautifulSoup로 셀렉터 기반 추출.  
- **외부 기사(언론사별)**: 범용 `article`, `main`, `#content` 등 선택자 또는 **readability** 라이브러리(`python-readability`, `trafilatura`) 검토.

### 3.2 LLM 기반 추출(보조·선택)

- **외부 언론사 본문**: DOM이 다양하면 **LLM으로 본문 추출** (OpenAI/Groq 등).
- **비용·감사**: URL·날짜·언론사 등 팩트는 **파이썬으로 확정**.

---

## 4. `external_company_data` 매핑 가이드

| DB 컬럼 | 보도(`press` / bThumbs) | 언론(`news` / sThumbs) |
|---------|-------------------------|-------------------------|
| `anchor_company_id` | 삼성SDS(모회사) `companies.id` | 동일 |
| `source_type` | `press` | `news` |
| `source_url` | **외부 기사 최종 URL** (또는 1차 상세 URL 정책) | 외부 언론 URL |
| `external_org_name` | (보도자료) `NULL` 또는 `"Samsung SDS"` | **언론사명** (파이낸셜뉴스 등) |
| `report_year` | `as_of_date.year` | 동일 |
| `as_of_date` | 기사 발행일 | 동일 |
| `title` | 기사 제목 | 동일 |
| `body_text` | **외부 기사 전문** (또는 1차 요약만 정책) | 동일 |
| `category` | 상단 카테고리(스마트 물류 등) | 동일 |
| `category_embedding` / `body_embedding` | (옵) 별도 임베딩 잡 | 동일 |
| `structured_payload` | `{"section": "bThumbs", "sds_detail_url": "...", "parser_version": "..."}` 등 | 동일 |
| `related_dp_ids` | (옵) 규칙 엔진 | 동일 |
| `fetched_at` | 배치 시작 시각(UTC) | 동일 |
| `ingest_batch_id` | 이번 실행 단일 UUID | 동일 |

**UPSERT 키**: `(anchor_company_id, source_url)` — **최종 외부 URL** 기준 또는 **1차 삼성SDS URL** 기준(팀 정책).

---

## 5. 자동 변경 감지·트리거 (폴링 기반)

### 5.1 `ingest_state` 테이블 (신규 마이그레이션 필요)

**목적**: 각 수집 태스크(SDS 뉴스 등)의 **마지막 수집 상태·ETag**를 저장, 변경 감지로 불필요한 크롤·DB 쓰기 스킵.

**스키마 (Alembic 039 예상)**

```sql
CREATE TABLE ingest_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_key VARCHAR(100) NOT NULL UNIQUE,  -- 예: "sds_news_list"
    last_etag TEXT,
    last_modified TEXT,
    last_content_hash TEXT,                  -- (옵) SHA-256(응답 body)
    last_fetch_at TIMESTAMPTZ,
    last_ingest_batch_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**키 예시**: `"sds_news_list"`, `"sds_news_detail_{url_hash}"` (1차 URL별 상태 필요 시).

### 5.2 변경 감지 로직 (의사코드)

```python
def should_fetch(task_key: str, current_etag: str | None) -> bool:
    """DB에서 이전 ETag 조회 후 비교."""
    prev = db.query(IngestState).filter(IngestState.task_key == task_key).first()
    if prev is None:
        return True  # 첫 실행
    if current_etag and prev.last_etag == current_etag:
        return False  # 변경 없음
    return True

def save_state(task_key: str, etag: str | None, batch_id: UUID):
    """수집 완료 후 상태 갱신."""
    row = db.query(IngestState).filter(...).first()
    if row:
        row.last_etag = etag
        row.last_ingest_batch_id = batch_id
        row.last_fetch_at = now()
    else:
        db.add(IngestState(task_key=task_key, last_etag=etag, ...))
    db.commit()
```

**`SdsNewsIngestService.run_ingest` 보강**:

1. 목록 페이지 **HEAD 요청**으로 ETag만 먼저 확인  
2. `should_fetch("sds_news_list", etag)` → `False`면 **early return** (`IngestResult.source = "cached"`)  
3. 크롤·저장 후 `save_state("sds_news_list", etag, batch_id)`

### 5.3 자동 폴링 (FastAPI lifespan)

**`backend/api/v1/data_integration/main.py`** 에 백그라운드 태스크 추가:

```python
@asynccontextmanager
async def _lifespan(app: FastAPI):
    # 기존 MCP 서버 ...
    
    polling_task = None
    if get_settings().sds_news_auto_poll:  # 기본 true, 끄려면 SDS_NEWS_AUTO_POLL=false
        polling_task = asyncio.create_task(_poll_sds_news())
    
    yield
    
    if polling_task:
        polling_task.cancel()
        try:
            await polling_task
        except asyncio.CancelledError:
            pass

async def _poll_sds_news():
    interval = get_settings().sds_news_poll_interval_s  # 기본 300 (5분)
    while True:
        await asyncio.sleep(interval)
        try:
            # HEAD로 ETag 확인
            async with httpx.AsyncClient() as client:
                r = await client.head(get_sds_news_list_url())
            etag = r.headers.get("etag")
            if should_fetch("sds_news_list", etag):
                logger.info("SDS 뉴스 변경 감지, ingest 시작")
                await asyncio.to_thread(
                    SdsNewsIngestOrchestrator().execute,
                    None  # Settings.sds_anchor_company_id 사용
                )
        except Exception as e:
            logger.exception("SDS 폴링 오류: {}", e)
```

**환경변수 추가 (Settings)**:
- `SDS_NEWS_AUTO_POLL`: `true` / `false` (기본 `true`, 끄려면 `false`)
- `SDS_NEWS_POLL_INTERVAL_S`: 초 (기본 `300`)

---

## 6. 배치·운영

| 항목 | 권장 |
|------|------|
| **주기(수동)** | API `POST .../ingest` 호출 또는 크론. |
| **주기(자동)** | 기본적으로 lifespan 백그라운드 폴링 (`SDS_NEWS_AUTO_POLL=false` 로 끔). |
| **재시도** | HTTP `429`/`503` 지수 백오프. |
| **동시성** | 외부 언론사 크롤 시 `asyncio.Semaphore(N)` (기본 4~8). |
| **법·약관** | `robots.txt`, 이용약관, 저작권(법무 검토). |

### 6.1 문제 해결·트러블슈팅

운영 로그에서 자주 보이는 현상과 대응입니다.

| 증상 | 원인 | 대응 |
|------|------|------|
| `2·3단계 크롤 … 건수=1000+` 로 오래 걸림 | `news.txt`가 **전체 아카이브**를 담아 한 번에 수천 건이 잡힘 | **`SDS_NEWS_MAX_ITEMS_PER_RUN`**(예: `80`~`200`) 설정 또는 API `max_items`. `0`(기본)은 무제한. |
| 폴링 주기마다 또 전체 크롤이 겹침 | 이전 배치가 끝나기 전 다음 `SDS_NEWS_POLL_INTERVAL_S` 가 도래 | 구현상 **이전 ingest가 끝나지 않으면 해당 주기는 스킵**한다. 근본적으로는 **목록 상한**·**ETag 스킵**으로 배치 시간을 줄인다. |
| `getaddrinfo failed` | 도메인 폐기·DNS 실패 | 정상. 해당 행은 외부 본문 없이 upsert될 수 있음. |
| `404 Not Found` | 기사 삭제·URL 구조 변경·오래된 링크 | 정상. 아카이브 뉴스에서 흔함. |
| `WinError 10060` / 타임아웃 | 방화벽·VPN·상대 서버 무응답·**내부망 전용 URL**을 외부에서 호출 | 네트워크 경로·프록시 확인. 내부 전용 링크는 수집 대상에서 제외하는 정책 검토. |
| `SSL: CERTIFICATE_VERIFY_FAILED` | 상대 사이트 인증서 문제·**회사 SSL 검사 프록시** | OS/파이썬 CA 번들·프록시 루트 인증서 설치(보안 정책 준수 하에). |
| 외부 fetch 실패 로그가 너무 많음 | 건별 실패가 `DEBUG`로 기록됨 | 기본은 **DEBUG** 수준. 상세를 보려면 로그 레벨을 DEBUG로. |
| ETag가 같아도 매번 크롤하고 싶음 | 변경 감지 우회 | API `check_etag: false` 또는 동등한 서비스 인자. |
| 로컬 개발 시 부담 | 자동 폴링·무제한 목록 | **`SDS_NEWS_AUTO_POLL=false`**, **`fetch_full_content: false`**(목록만), **`max_items`** 소량. |

**권장 운영 조합(예시)**  
- 초기 적재: `max_items` 또는 `SDS_NEWS_MAX_ITEMS_PER_RUN`로 **소량 검증** 후 점진 확대.  
- 상시: `SDS_NEWS_POLL_INTERVAL_S`를 배치 **예상 소요 시간보다 길게**(예: 1~6시간) 두거나, 스케줄러로 일 1회 등.

---

## 7. 코드 구조(확장 후)

```
backend/domain/v1/data_integration/
  models/
    bases/
      external_company_data.py
      ingest_state.py              # (신규) 수집 상태 추적
    states/
      sds_news_state.py            # ParsedNewsItem(+sds_detail/external URL), IngestResult
  hub/
    orchestrator/
      sds_news_ingest_orchestrator.py
    services/external_company/
      sds_news_constants.py
      sds_news_fetch.py            # fetch_list, fetch_sds_detail, fetch_external_article
      sds_news_parse.py            # parse_index, parse_sds_detail, parse_external_article
      sds_news_ingest_service.py   # 3단계 조율·상태 체크
    repositories/
      external_company_data_repository.py
      ingest_state_repository.py   # (신규) 상태 CRUD
```

### 7.1 타입 확장(필요)

```python
# models/states/sds_news_state.py
@dataclass
class ParsedNewsItem:
    section: Literal["bThumbs", "sThumbs"]
    sds_detail_url: str                # 1차 (삼성SDS /kr/news/xxx.html)
    external_article_url: str | None   # 최종 외부 URL (p.txt a[href])
    title: str
    body_text: str | None              # 외부 기사 전문
    external_org_name: str | None
    as_of_date: date | None
    report_year: int | None
    category: str | None
    sds_article_id: str | None
```

### 7.2 처리 흐름(3단계 + 상태 체크)

**변경 감지 포함**:

0. **(옵) HEAD 요청** → 목록 ETag 비교 → `ingest_state` 에서 이전 값과 같으면 **early return**  
1. **목록 수집**: `index.html` (또는 `news.txt`) → `#bThumbs` / `#sThumbs` 내 `div.thumb` / `.thumb_title` 파싱 → 1차 URL 리스트  
1.5. **목록 상한(옵)**: `SDS_NEWS_MAX_ITEMS_PER_RUN` 또는 API `max_items` → 리스트 앞에서 N건만 유지 (`0` = 무제한)  
2. **1차 상세 반복** (각 1차 URL, 병렬/제한):
   - GET `/kr/news/xxx.html`
   - `p.txt a[href]` 추출 → **외부 URL**  
     (없으면 1차 페이지 자체가 전문 → 본문 직접 파싱)
   - 제목·날짜·카테고리 수집
3. **외부 기사 수집** (외부 URL):
   - GET 외부 언론사 페이지
   - 본문: `trafilatura.extract` 또는 범용 선택자
4. **DB 저장**: `external_company_data` upsert (`source_url` = 외부 URL 또는 1차 URL 정책)  
5. **상태 커밋**: `ingest_state` 에 `last_etag`, `last_ingest_batch_id` 기록

### 7.3 HTTP·동시성

- `httpx.AsyncClient` 또는 `ThreadPoolExecutor`로 **1차 상세·외부 기사** 병렬 (Semaphore로 동시 요청 수 제한, 기본 4~8).
- 외부 사이트 크롤 간격: `asyncio.sleep(0.5~1)`.
- User-Agent: `Settings.sds_news_user_agent`.

---

## 8. 설정(환경변수)

`backend/core/config/settings.py` `Settings`:

| 변수 | 필드 | 설명 | 기본값 |
|------|------|------|--------|
| `SDS_NEWS_LIST_URL` | `sds_news_list_url` | 목록 URL | `https://...index.html` |
| `SDS_NEWS_TXT_PATH` | `sds_news_txt_path` | 피드 경로 | `/kr/news/news.txt` |
| `SDS_NEWS_USER_AGENT` | `sds_news_user_agent` | HTTP UA | `ifrsseedr-...` |
| `SDS_ANCHOR_COMPANY_ID` | `sds_anchor_company_id` | 앵커 UUID | (필수) |
| `SDS_NEWS_AUTO_POLL` | `sds_news_auto_poll` | 자동 폴링 | `true` |
| `SDS_NEWS_POLL_INTERVAL_S` | `sds_news_poll_interval_s` | 폴링 주기(초) | `300` |
| `SDS_NEWS_CONCURRENCY` | `sds_news_concurrency` | 병렬 요청 수 | `6` |
| `SDS_NEWS_MAX_ITEMS_PER_RUN` | `sds_news_max_items_per_run` | 이번 실행 목록 상한 (`0`=무제한) | `0` |
| `SDS_NEWS_EMBED` | `sds_news_embed` | 적재 시 BGE-M3로 `category_embedding`·`body_embedding` 채움. `false`로 끔 | `true` |
| `SDS_NEWS_EMBED_BATCH_SIZE` | `sds_news_embed_batch_size` | 임베딩 배치 크기 | `16` |
| `SDS_NEWS_EMBED_BODY_MAX_CHARS` | `sds_news_embed_body_max_chars` | 본문 임베딩 전 최대 문자(초과 시 앞부분만) | `12000` |

`EMBEDDING_MODEL`은 플랫폼 공통(기본 `BAAI/bge-m3`)으로 임베딩 서비스에 전달된다.

---

## 9. 엔트리포인트

### 9.1 수동 트리거 (API)

`POST /data-integration/external-company/sds-news/ingest`  
본문(JSON, 필드는 모두 선택): `anchor_company_id`, `dry_run`, `fetch_full_content`, `check_etag`, `max_items`.  
응답에 `list_items_total`, `list_items_processed`(캡 적용 전·후 건수), `unchanged` 등 포함.

### 9.2 자동 트리거 (폴링, FastAPI lifespan)

기본적으로 **백그라운드 태스크**가 `SDS_NEWS_POLL_INTERVAL_S`마다 SDS 뉴스 ingest를 호출한다. 서비스 내부에서 HEAD·ETag로 변경 없으면 early return. **이전 ingest가 아직 끝나지 않은 주기는 스킵**한다. 비활성화는 `SDS_NEWS_AUTO_POLL=false`.

### 9.3 진단: 저장된 ETag·목록 소스 조회 (GET)

`GET /data-integration/external-company/sds-news/ingest-state`  
응답의 `row.last_etag`, `row.last_list_source`(`html` \| `news_txt`)로 DB에 남은 변경 감지 값을 확인한다. ingest 한 사이클 직전 로그의 `[ETag]` 줄(목록 index HEAD·news.txt HEAD·`should_fetch` 사유)과 대조하면 된다.

---

## 10. 테스트 전략

| 종류 | 내용 |
|------|------|
| **단위** | 목록 HTML → 1차 URL / 1차 → 외부 URL 추출 / 외부 본문 파싱 / `should_fetch_with_heads` 로직 |
| **픽스처** | `fixtures/sds_detail_sample.html`, `fixtures/external_article_sample.html` |
| **통합** | 실 URL 크롤, 폴링 시뮬 (`@pytest.mark.integration`) |

---

## 11. 의존성

- **필수**: `httpx`, `beautifulsoup4`, `lxml`, `trafilatura`.
- **선택**: `playwright`, `aiohttp`.

`backend/domain/v1/data_integration/requirement.txt`.

---

## 12. Alembic 마이그레이션 (`ingest_state`)

**`ingest_state` 테이블** (revision: `038_ingest_state_table`, 부모: `037_subs_ext_company_data`):

```python
def upgrade() -> None:
    op.execute("""
        CREATE TABLE ingest_state (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            task_key VARCHAR(100) NOT NULL UNIQUE,
            last_etag TEXT,
            last_modified TEXT,
            last_content_hash TEXT,
            last_fetch_at TIMESTAMPTZ,
            last_ingest_batch_id UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX idx_ingest_state_task_key ON ingest_state (task_key)")

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ingest_state")
```

**039** (`039_ingest_state_list_source`): 컬럼 `last_list_source` (`html` \| `news_txt`). 목록이 HTML에서 왔을 때와 `news.txt`에서 왔을 때 **서로 다른 URL의 ETag**를 저장·비교하므로, 변경 감지 시 **두 URL 모두 HEAD**로 받아 `last_list_source`에 맞는 쪽과 `last_etag`를 맞춘다.

**키 예시**: `"sds_news_list"`, `"sds_news_detail_{md5(url)[:8]}"` (URL별 상태 필요 시).

**SQL 예시** (DB 콘솔):

```sql
SELECT task_key, last_etag, last_list_source, last_modified, last_fetch_at
FROM ingest_state
WHERE task_key = 'sds_news_list';
```

---

## 13. 로드맵·현재 구현 상태

| 항목 | 현재(v1.0) | v2.0 목표 |
|------|------------|-----------|
| **목록 수집** | `news.txt` JSON 또는 HTML 폴백 | 동일 |
| **1차 상세 파싱** | 없음 (목록 메타만) | `p.txt a[href]` 외부 URL 추출 |
| **외부 기사 본문** | `_enrich_body_from_detail`(1차만, 선택) | 외부 언론사 본문(텍스트) |
| **이미지** | 없음·비범위 | (의도적 제외) |
| **병렬 처리** | 순차 | `asyncio.Semaphore` |
| **변경 감지 early return** | ETag만 기록 | `ingest_state` + HEAD 비교 |
| **자동 폴링** | lifespan + 중복 실행 스킵 | `SDS_NEWS_AUTO_POLL`, 주기·상한·ETag와 함께 조정 |
| **목록 상한** | — | `SDS_NEWS_MAX_ITEMS_PER_RUN` / API `max_items` |
| **Playwright** | 미연결 | (로드맵) |

---

**문서 버전**: 2.3  
**최종 수정**: 2026-04-03 — 문제 해결(트러블슈팅)·목록 상한·폴링 중복 방지·설정/API 반영
