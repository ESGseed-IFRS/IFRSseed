# DB 연결 불안정 문제 세세 분석

## 📊 현상 요약

터미널 로그에서 반복적으로 나타나는 오류:
- `ConnectionResetError` / `WinError 10053`
- `asyncio.TimeoutError` / `CancelledError`
- `Authentication timed out`
- `connection was closed in the middle of operation`

일부 DP 조회만 실패하고 워크플로는 `success`로 마무리되나, 경고가 누적됨.

---

## 🔍 근본 원인 분석

### 1. **연결 풀 없음 - 매번 새 연결 생성**

#### 현재 구조
```python
# asyncpg_connect.py (라인 65-89)
async def connect_ifrs_asyncpg() -> asyncpg.Connection:
    # 매 호출마다 새 연결 생성
    return await asyncpg.connect(dsn, ssl=ctx)
```

#### 호출 패턴 (dp_query.py)
```python
async def query_dp_metadata(params):
    conn = await connect_ifrs_asyncpg()  # 새 연결
    row = await conn.fetchrow(query, dp_id)
    await conn.close()  # 즉시 종료
```

**8개 함수** 모두 동일 패턴:
- `query_dp_metadata`
- `query_ucm_by_dp`
- `query_rulebook_by_primary_dp_id`
- `query_dp_real_data`
- `query_ucm_direct`
- `query_rulebook`
- `query_unmapped_dp`
- `query_company_info`

#### 문제점
1. **동시 요청 시 연결 폭주**
   - 보고서 생성 1건에 DP 10개 조회 → 10개 연결 동시 생성
   - Orchestrator가 병렬로 c_rag + dp_rag + aggregation 실행 → 수십 개 연결
   
2. **연결 생성 비용**
   - TCP 핸드셰이크 + SSL/TLS 협상 + PostgreSQL 인증
   - Neon 같은 원격 DB: 왕복 지연(RTT) × 3~5회
   - 매 쿼리마다 반복 → 누적 지연 수 초

3. **서버 부하**
   - PostgreSQL `max_connections` 제한 (기본 100)
   - Neon 무료/프로 티어: 동시 연결 제한 더 엄격
   - 연결 생성 속도 > 종료 속도 → 고갈 → `Authentication timed out`

---

### 2. **예외 시 연결 누수**

#### 현재 코드 (dp_query.py 라인 43-75)
```python
async def query_dp_metadata(params):
    try:
        conn = await connect_ifrs_asyncpg()
        row = await conn.fetchrow(query, dp_id)
        await conn.close()  # ← 정상 경로에만 있음
        return dict(row) if row else None
    except Exception as e:
        logger.error("query_dp_metadata failed: %s", e, exc_info=True)
        raise  # ← conn.close() 없이 예외 전파
```

#### 문제점
- `connect_ifrs_asyncpg()` 성공 후 `fetchrow` 실패 시 → 연결 열린 채로 예외 전파
- `finally` 블록 없음 → 연결 누수
- 누적되면 서버 연결 슬롯 고갈

**영향받는 함수**: 9개 중 **9개 전부** (finally 블록 0개)

---

### 3. **타임아웃 계층 중첩**

#### 계층 구조
```
1. asyncpg.connect() 내부 타임아웃 (기본 60초)
   └─ 2. InfraLayer.call_tool() 타임아웃 (120초)
      └─ 3. Orchestrator 병렬 실행 (heavy_timeout 300초)
```

#### 설정 값 (settings.py)
```python
ifrs_infra_timeout_sec: int = 120  # InfraLayer 기본
ifrs_infra_heavy_timeout_sec: int = 300  # Orchestrator 병렬 작업용
```

#### 문제 시나리오
1. **DB 연결이 느려지면** (네트워크 지연, 서버 부하)
   - `asyncpg.connect()` 내부 타임아웃 (60초) 먼저 터짐
   - 또는 SSL 핸드셰이크 중 `CancelledError`
   
2. **InfraLayer 타임아웃 (120초) 발동**
   - `asyncio.wait_for`가 작업 취소
   - 진행 중이던 `connect` 작업이 `CancelledError` 받음
   - 로그: `call_tool timeout`

3. **연결 상태 불명확**
   - 취소된 연결이 서버 쪽에는 살아있을 수 있음
   - 다음 연결 시도 시 서버가 "이미 인증 중" 상태 → `Authentication timed out`

---

### 4. **Windows 특유 이슈**

#### WinError 10053
```
ConnectionAbortedError: [WinError 10053] 
현재 연결은 사용자의 호스트 시스템의 소프트웨어의 의해 중단되었습니다
```

**가능한 원인**:
1. Windows 방화벽/백신이 장시간 유휴 연결 끊기
2. ProactorEventLoop (Windows asyncio 기본) 버그
3. VPN/프록시 중간 타임아웃

#### asyncpg SSL 처리 (asyncpg_connect.py)
- `asyncpg_force_default_ssl: bool = True` (기본값)
- URL의 `sslrootcert` 제거 + 시스템 CA 사용
- **의도**: Windows 비ASCII 경로 문제 회피
- **부작용**: SSL 협상이 더 오래 걸릴 수 있음 (CA 체인 검증)

---

## 🎯 구체적 문제 지점

### 파일별 이슈

#### 1. `asyncpg_connect.py` (라인 65-89)
```python
async def connect_ifrs_asyncpg() -> asyncpg.Connection:
    # ❌ 문제: 연결 풀 없음, 매번 새 연결
    # ❌ 문제: asyncpg.connect() 내부 타임아웃 제어 불가
    return await asyncpg.connect(dsn, ssl=ctx)
```

**개선 필요**:
- 연결 풀 도입 (`asyncpg.create_pool`)
- 명시적 `timeout` 파라미터 전달
- 재시도 로직

---

#### 2. `dp_query.py` (8개 함수)
```python
async def query_rulebook_by_primary_dp_id(params):
    try:
        conn = await connect_ifrs_asyncpg()  # ← 새 연결
        row = await conn.fetchrow(query, dp_id)
        await conn.close()  # ← 정상 경로만
        return dict(row) if row else None
    except Exception as e:
        logger.error(...)
        raise  # ← 연결 누수
```

**개선 필요**:
- `try-finally`로 연결 보장 종료
- 또는 `async with` 컨텍스트 매니저
- 풀 사용 시 `acquire()`/`release()` 패턴

---

#### 3. `infra_layer.py` (라인 131-210)
```python
async def call_tool(self, tool_name, params, timeout=None):
    timeout = timeout or self.default_timeout  # 120초
    result = await asyncio.wait_for(
        handler(params),  # ← query_* 함수 호출
        timeout=timeout
    )
```

**문제**:
- 120초 타임아웃 안에 `connect` + `query` + `close` 완료해야 함
- 연결 생성만 60초 걸리면 쿼리 시간 60초만 남음
- 병렬 요청 10개 → 연결 대기 큐 → 순차 처리 → 타임아웃 연쇄

**개선 필요**:
- 연결 풀로 대기 시간 제거
- 또는 `connect` 전용 짧은 타임아웃 + 재시도

---

#### 4. `dp_rag/agent.py` (라인 620-642, 865-886)
```python
async def _query_rulebook_by_primary_dp_id(self, dp_id):
    try:
        rb = await self.infra.call_tool(
            "query_rulebook_by_primary_dp_id",
            {"dp_id": dpid},
            # ← timeout 명시 안 함 → 기본 120초
        )
        return rb if isinstance(rb, dict) else None
    except Exception as e:
        logger.warning(...)
        return None  # ← 예외 삼킴 (정상 동작)
```

**현재 동작**:
- 예외 발생 시 `None` 반환 → 워크플로 계속
- 로그에 `dp_rag: query_rulebook_by_primary_dp_id failed` 남김
- 최종 응답의 `validation.warnings`에 누적

**문제 아님**: 예외 처리는 적절함. 근본 원인은 연결 생성 실패.

---

## 📈 로그 패턴 분석

### 실패 순서 (터미널 2.txt 기준)

1. **초반**: 정상 처리
2. **중반**: `ConnectionResetError` 시작
   ```
   query_rulebook_by_primary_dp_id failed: connection was closed
   ```
3. **후반**: 타임아웃 연쇄
   ```
   call_tool timeout
   Authentication timed out
   ```
4. **말미**: 일부 DP 스킵
   ```
   Skipping DP ESRSE1-E1-6-51 due to error
   Skipping DP GRI305-2-a due to error
   ```

### 추론
- 초반 연결들이 정상 종료 안 됨 (누수)
- 서버 연결 슬롯 고갈
- 새 연결 시도 → 대기 → 타임아웃
- 일부 요청은 성공, 일부는 실패 (경쟁 상태)

---

## 🛠️ 해결 방안 (우선순위순)

### 우선순위 1: 연결 풀 도입 ⭐⭐⭐

#### asyncpg_connect.py 수정
```python
# 전역 풀 (모듈 레벨)
_pool: Optional[asyncpg.Pool] = None
_pool_lock = asyncio.Lock()

async def get_or_create_pool() -> asyncpg.Pool:
    global _pool
    if _pool is not None:
        return _pool
    
    async with _pool_lock:
        if _pool is not None:
            return _pool
        
        s = get_settings()
        dsn = _dsn_without_ssl_query(s.database_url)
        ctx = ssl.create_default_context()
        
        _pool = await asyncpg.create_pool(
            dsn,
            ssl=ctx,
            min_size=5,      # 최소 연결 유지
            max_size=20,     # 최대 연결 (Neon 제한 고려)
            timeout=30,      # 풀에서 연결 획득 타임아웃
            command_timeout=60,  # 쿼리 실행 타임아웃
        )
        return _pool

async def connect_ifrs_asyncpg() -> asyncpg.Connection:
    """레거시 호환용 - 풀에서 연결 획득"""
    pool = await get_or_create_pool()
    return await pool.acquire()
```

#### dp_query.py 수정 (8개 함수 전부)
```python
async def query_rulebook_by_primary_dp_id(params):
    dp_id = params.get("dp_id", "").strip()
    if not dp_id:
        return None
    
    logger.info("query_rulebook_by_primary_dp_id: dp_id=%s", dp_id)
    
    pool = await get_or_create_pool()
    async with pool.acquire() as conn:  # ← 자동 반환
        try:
            row = await conn.fetchrow(query, dp_id)
            if not row:
                return None
            out = dict(row)
            # ... 후처리
            return out
        except Exception as e:
            logger.error("query_rulebook_by_primary_dp_id failed: %s", e)
            raise
```

**효과**:
- 연결 재사용 → 생성 비용 제거 (RTT × 5회 → 0회)
- 풀 크기로 동시 연결 제어 → 서버 부하 감소
- `async with` → 예외 시에도 자동 반환 (누수 방지)

---

### 우선순위 2: 예외 시 연결 보장 종료 ⭐⭐

#### 현재 (dp_query.py 전체)
```python
try:
    conn = await connect_ifrs_asyncpg()
    row = await conn.fetchrow(...)
    await conn.close()  # ← 정상 경로만
    return dict(row)
except Exception as e:
    raise  # ← 연결 열린 채로 예외
```

#### 수정 (풀 없이도 적용 가능)
```python
conn = None
try:
    conn = await connect_ifrs_asyncpg()
    row = await conn.fetchrow(...)
    return dict(row) if row else None
except Exception as e:
    logger.error(...)
    raise
finally:
    if conn:
        await conn.close()  # ← 항상 실행
```

**효과**:
- 예외 발생해도 연결 누수 방지
- 서버 슬롯 빠르게 회수

---

### 우선순위 3: 타임아웃 세분화 ⭐

#### asyncpg.connect() 명시적 타임아웃
```python
# asyncpg_connect.py
async def connect_ifrs_asyncpg(timeout: int = 30) -> asyncpg.Connection:
    # asyncpg.connect()는 timeout 파라미터 지원
    return await asyncpg.connect(
        dsn,
        ssl=ctx,
        timeout=timeout,  # ← 연결 생성 타임아웃
        command_timeout=60,  # ← 쿼리 실행 타임아웃
    )
```

#### InfraLayer 타임아웃 분리
```python
# infra_layer.py
async def call_tool(self, tool_name, params, timeout=None):
    # DB 조회 툴은 짧은 타임아웃
    if tool_name.startswith("query_"):
        timeout = timeout or 30  # ← 120초 → 30초
    else:
        timeout = timeout or self.default_timeout
    
    result = await asyncio.wait_for(handler(params), timeout=timeout)
```

**효과**:
- 느린 연결 조기 감지 → 재시도 기회
- 전체 워크플로 블로킹 감소

---

### 우선순위 4: 재시도 로직 추가 ⭐

#### asyncpg_connect.py에 재시도
```python
async def connect_ifrs_asyncpg(
    timeout: int = 30,
    max_retries: int = 3
) -> asyncpg.Connection:
    for attempt in range(max_retries):
        try:
            return await asyncpg.connect(dsn, ssl=ctx, timeout=timeout)
        except (asyncpg.ConnectionDoesNotExistError, TimeoutError) as e:
            if attempt == max_retries - 1:
                raise
            logger.warning(
                f"Connection attempt {attempt+1}/{max_retries} failed: {e}, retrying..."
            )
            await asyncio.sleep(1 * (attempt + 1))  # 지수 백오프
```

**효과**:
- 일시적 네트워크 장애 극복
- 서버 재시작 중 자동 복구

---

### 우선순위 5: 연결 풀 헬스 체크

#### 주기적 연결 검증
```python
async def ensure_pool_healthy():
    """주기적으로 풀 연결 상태 확인"""
    global _pool
    if _pool:
        try:
            async with _pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
        except Exception as e:
            logger.warning(f"Pool unhealthy, recreating: {e}")
            await _pool.close()
            _pool = None
```

---

## 📊 현재 설정 vs 권장 설정

| 항목 | 현재 | 권장 | 이유 |
|------|------|------|------|
| **연결 방식** | 매번 새 연결 | 연결 풀 (5-20) | 생성 비용 제거 |
| **연결 종료** | 정상 경로만 | `finally` 보장 | 누수 방지 |
| **connect 타임아웃** | 60초 (asyncpg 기본) | 15-30초 | 조기 감지 |
| **call_tool 타임아웃** | 120초 (모든 툴) | 30초 (query_*) | 블로킹 감소 |
| **재시도** | 없음 | 3회 (지수 백오프) | 일시 장애 극복 |
| **풀 헬스 체크** | 없음 | 주기적 (5분) | 좀비 연결 제거 |

---

## 🚀 즉시 적용 가능한 Quick Fix

### 최소 변경 (연결 풀 없이)

#### dp_query.py 8개 함수 패턴 통일
```python
async def query_rulebook_by_primary_dp_id(params):
    dp_id = params.get("dp_id", "").strip()
    if not dp_id:
        return None
    
    logger.info("query_rulebook_by_primary_dp_id: dp_id=%s", dp_id)
    
    conn = None
    try:
        conn = await connect_ifrs_asyncpg()
        row = await conn.fetchrow(query, dp_id)
        if not row:
            return None
        out = dict(row)
        ed = out.get("effective_date")
        if ed and hasattr(ed, "isoformat"):
            out["effective_date"] = ed.isoformat()
        return out
    except Exception as e:
        logger.error("query_rulebook_by_primary_dp_id failed: %s", e, exc_info=True)
        raise
    finally:
        if conn:
            try:
                await conn.close()
            except Exception:
                pass  # 이미 닫혔거나 연결 실패 시 무시
```

**효과**: 예외 시 연결 누수 50% 감소 예상

---

## 🎬 권장 구현 순서

1. **즉시** (Quick Fix): `dp_query.py` 8개 함수에 `finally` 추가
2. **단기** (1-2일): 연결 풀 도입 (`asyncpg.create_pool`)
3. **중기** (1주): 타임아웃 세분화 + 재시도 로직
4. **장기** (2주): 풀 헬스 체크 + 모니터링

---

## 📝 추가 조사 필요 사항

1. **Neon 연결 제한**
   - 현재 플랜의 `max_connections` 확인
   - 동시 연결 수 모니터링 (Neon 대시보드)

2. **네트워크 환경**
   - VPN 사용 여부
   - 방화벽 유휴 타임아웃 설정
   - DNS 응답 시간

3. **서버 부하**
   - PostgreSQL `log_connections` 활성화
   - 연결 생성/종료 로그 분석
   - `pg_stat_activity` 쿼리로 좀비 연결 확인

---

## 🔧 테스트 방법

### 1. 연결 누수 확인
```sql
-- PostgreSQL에서 실행
SELECT count(*), state, wait_event_type 
FROM pg_stat_activity 
WHERE datname = 'your_db_name'
GROUP BY state, wait_event_type;
```

### 2. 부하 테스트
```python
# 동시 요청 10개
import asyncio
async def test():
    tasks = [query_dp_metadata({"dp_id": f"GRI305-{i}"}) for i in range(10)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    print(f"성공: {sum(1 for r in results if not isinstance(r, Exception))}")
    print(f"실패: {sum(1 for r in results if isinstance(r, Exception))}")
```

---

## 결론

**핵심 문제**: 연결 풀 없이 매번 새 연결 + 예외 시 누수 → 서버 연결 고갈 → 타임아웃 연쇄

**최우선 조치**: 
1. `dp_query.py` 8개 함수에 `finally` 블록 추가 (30분 작업)
2. `asyncpg.create_pool` 도입 (2시간 작업)

**예상 효과**: 연결 실패율 90% 감소, 응답 속도 2-3배 개선
