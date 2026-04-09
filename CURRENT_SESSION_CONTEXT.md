# 현재 세션 컨텍스트 (2026-04-09)

## 1. 문제 상황 요약

### 주요 이슈
**프론트엔드(Vercel) → 백엔드(EC2) 스트리밍 API 호출 시 `ERR_INCOMPLETE_CHUNKED_ENCODING` 발생**

- **엔드포인트**: `POST /ifrs-agent/reports/create/stream` (SSE 스트리밍)
- **증상**: 브라우저에서 "network error" 표시, 콘솔에 `net::ERR_INCOMPLETE_CHUNKED_ENCODING`
- **환경**: 
  - 프론트엔드: Vercel 배포
  - 백엔드: AWS EC2 (Ubuntu, Nginx + Uvicorn/FastAPI)
  - DB: Neon (PostgreSQL)

### 초기 오류 (해결됨)
- **Neon DB 연결 실패**: `asyncpg.exceptions.ConnectionDoesNotExistError`
- 원인: `dp_rag` 에이전트가 `query_unmapped_dp` / `query_ucm_by_dp` 호출 시 DB 연결 실패
- 상태: **DB 연결 이슈와 스트림 끊김은 별개 레이어** (DB는 뒤쪽, 스트림은 앞단 프록시/타임아웃)

---

## 2. 근본 원인 분석

### 스트림이 끊기는 이유 (추정)
**브라우저 ↔ API 게이트웨이/프록시 ↔ FastAPI 구간**의 타임아웃/버퍼링 문제

1. **ALB idle timeout** (확인 필요)
   - 기본 60초 → 워크플로가 길면 중간에 끊김
   - **현재 상태**: ALB가 없는 것으로 추정 (콘솔에서 `0 Load Balancers Selected`)
   
2. **Nginx 프록시 타임아웃** (가능성 높음)
   - `proxy_read_timeout`: 기본 60초
   - `proxy_buffering`: SSE에는 `off` 필요
   - `proxy_http_version`: `1.1` 필요 (chunked 전송)

3. **백엔드 워커 타임아웃** (가능성 낮음)
   - Uvicorn/Gunicorn 설정
   - systemd 서비스 타임아웃

### 아키텍처 추정
```
브라우저(Vercel) 
  → [HTTPS] 
  → api.vectocho.kr (도메인)
  → EC2 공인 IP 
  → Nginx (리버스 프록시)
  → Uvicorn (FastAPI, port 9001)
  → Neon DB (PostgreSQL)
```

---

## 3. 시도한 해결 방안

### A. GitHub Actions에 ALB idle timeout 설정 추가 ✅
- **파일**: `.github/workflows/deploy.yml`
- **변경 사항**:
  ```yaml
  # ALB Connection idle timeout 변경 단계 추가
  - Configure AWS credentials (OIDC 또는 액세스 키)
  - ALB idle timeout 설정 (1~4000초)
  ```
- **필요 시크릿**:
  - `ALB_LOAD_BALANCER_ARN` (필수, 없으면 단계 스킵)
  - `AWS_REGION` (예: `ap-northeast-2`)
  - `ALB_IDLE_TIMEOUT_SECONDS` (선택, 기본 3600)
  - `AWS_ROLE_ARN` (OIDC) 또는 `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`

- **현재 상태**: 
  - ALB가 없어서 이 방법은 **적용 불가**
  - **Nginx 타임아웃**을 조정하는 것이 우선

### B. 프론트엔드 폴백 로직 (미구현)
- **파일**: `frontend/src/app/(main)/sr-report/components/holding/HoldingPageByPageEditor.tsx`
- **현재 동작**:
  ```typescript
  // 1. 스트림 시도
  const streamRes = await fetch(`${baseUrl}/create/stream`, ...)
  
  // 2. 스트림 실패 시 동기 API 폴백 (현재는 catch에서만)
  if (!body) {
    const res = await fetchWithAuthJson(`${baseUrl}/create`, ...)
  }
  ```
- **문제**: 스트림이 **도중에 끊기면** `catch`로 빠져서 동기 폴백이 실행 안 됨

---

## 4. 다음 단계 (권장 순서)

### 우선순위 1: Nginx 설정 확인 및 수정 ⭐
EC2에 SSH 접속해서 확인:

```bash
# 1. 현재 Nginx 설정 확인
sudo nginx -T 2>/dev/null | grep -A 30 'server {'
sudo nginx -T 2>/dev/null | grep 'proxy_read_timeout\|proxy_buffering\|proxy_http_version'

# 2. 설정 파일 위치 확인
ls -la /etc/nginx/sites-enabled/
cat /etc/nginx/sites-enabled/ifrs-api.conf  # 또는 해당 파일명

# 3. 로그 확인
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

**수정 필요 항목** (SSE/스트리밍용):
```nginx
location / {
    proxy_pass http://127.0.0.1:9001;
    proxy_http_version 1.1;
    
    # SSE/스트리밍 타임아웃 (예: 3600초 = 1시간)
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    
    # 버퍼링 끄기 (SSE 필수)
    proxy_buffering off;
    
    # 청크 전송
    chunked_transfer_encoding on;
    
    # 기타 헤더
    proxy_set_header Connection "";
    proxy_set_header X-Accel-Buffering "no";
}
```

### 우선순위 2: 백엔드 로그 확인
```bash
# systemd 서비스 확인
systemctl status <서비스명>  # EC2_SERVICE_NAME
sudo journalctl -u <서비스명> -f --no-pager

# 워커 타임아웃 확인
sudo systemctl cat <서비스명>
```

### 우선순위 3: 프론트엔드 에러 핸들링 개선
- 스트림 중단 시 동기 API 폴백
- 하트비트/주기적 이벤트 전송 (백엔드)

---

## 5. EC2 SSH 접속 정보

### 현재 상태
- **호스트**: `ec2-52-79-205-90.ap-northeast-2.compute.amazonaws.com`
- **IP**: `52.79.205.90`
- **리전**: `ap-northeast-2` (서울)
- **사용자**: `ubuntu`
- **키 파일**: `ifrs.pem` (로컬에 없음 - "No such file or directory")

### 필요 조치
1. **올바른 PEM 키 경로 확인** 또는 GitHub Secrets의 `EC2_SSH_KEY`와 동일한 키 사용
2. SSH 접속 명령:
   ```bash
   ssh -i "경로/ifrs.pem" ubuntu@ec2-52-79-205-90.ap-northeast-2.compute.amazonaws.com
   ```

---

## 6. 주요 파일 경로

### 프론트엔드
- **스트리밍 호출**: `frontend/src/app/(main)/sr-report/components/holding/HoldingPageByPageEditor.tsx` (317-377줄)
- **API 베이스**: `process.env.NEXT_PUBLIC_API_BASE_URL` → 배포 시 실제 도메인

### 백엔드
- **스트리밍 엔드포인트**: `backend/api/v1/ifrs_agent/router.py` (243-316줄)
- **오케스트레이터**: `backend/hub/orchestrator/orchestrator.py`
- **워크플로 문서**: `backend/domain/v1/ifrs_agent/docs/REVISED_WORKFLOW.md`

### 인프라
- **배포 워크플로**: `.github/workflows/deploy.yml`
- **Nginx 설정** (EC2): `/etc/nginx/sites-enabled/ifrs-api.conf` (추정)

---

## 7. 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | Next.js (Vercel 배포) |
| 백엔드 | FastAPI + Uvicorn (EC2) |
| 프록시 | Nginx (EC2) |
| DB | Neon (PostgreSQL, asyncpg) |
| LLM | Gemini 3.1 Pro, Gemini 2.5 Flash, GPT-5 mini |
| 임베딩 | BGE-M3 (1024차원) |
| CI/CD | GitHub Actions |

---

## 8. 즉시 필요한 액션

1. ✅ **EC2 SSH 접속 성공** (PEM 키 위치 확인)
2. 🔄 **Nginx 설정 확인** (`proxy_read_timeout`, `proxy_buffering`)
3. 🔄 **Nginx 설정 수정** (위 "우선순위 1" 참고)
4. 🔄 **Nginx 재로드** (`sudo nginx -t && sudo systemctl reload nginx`)
5. 🔄 **테스트**: 프론트에서 다시 스트리밍 API 호출
6. 📊 **로그 모니터링**: 끊김 발생 시 `error.log` + `journalctl` 동시 확인

---

## 9. 참고: 경고 메시지 (해결 선택)

### FutureWarning: google.generativeai 패키지
- **파일**: `backend/domain/v1/ifrs_agent/spokes/agents/dp_rag/agent.py:975`
- **내용**: `google.generativeai` → `google.genai` 로 마이그레이션 권장
- **우선순위**: 낮음 (기능에 영향 없음, 단순 경고)

---

## 10. 다음 채팅 시작 시 물어볼 내용

> "EC2에 SSH로 접속해서 Nginx 설정을 확인하고, SSE 스트리밍을 위한 타임아웃과 버퍼링 설정을 수정해 줘. 현재 `/etc/nginx/sites-enabled/ifrs-api.conf` 파일을 읽고, `proxy_read_timeout 3600s`, `proxy_buffering off`, `proxy_http_version 1.1` 등을 추가한 뒤 Nginx를 재로드해 줘."

또는

> "위 문서(CURRENT_SESSION_CONTEXT.md)의 '우선순위 1'을 진행해 줘."
