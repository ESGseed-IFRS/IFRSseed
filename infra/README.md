# Infrastructure Configuration

이 디렉터리는 배포 및 인프라 설정 파일을 포함합니다.

## Nginx Configuration

### `nginx/ifrs-api.conf`

IFRS Agent API용 Nginx 리버스 프록시 설정 파일입니다.

**주요 기능**:
- **SSE 스트리밍 지원**: `/ifrs-agent/reports/create/stream` 엔드포인트는 10분 타임아웃
- **일반 API**: `/ifrs-agent` 엔드포인트는 2분 타임아웃
- **버퍼링 비활성화**: 실시간 스트리밍을 위한 최적화

**타임아웃 설정**:
```
/ifrs-agent/reports/create/stream  → 600초 (10분)
/ifrs-agent                        → 120초 (2분)
/                                  → 기본값 (60초)
```

**배포 방식**:
1. GitHub Actions가 `infra/` 폴더를 EC2로 전송
2. `envsubst`로 `${API_DOMAIN}` 변수 치환
3. `/etc/nginx/sites-available/ifrs-api.conf`에 적용
4. Certbot으로 HTTPS 인증서 자동 발급 (Let's Encrypt)

**로컬 테스트**:
```bash
# 변수 치환 테스트
export API_DOMAIN="api.yeotaeho.kr"
envsubst '${API_DOMAIN}' < infra/nginx/ifrs-api.conf

# Nginx 설정 검증
sudo nginx -t
```

**수정 후 배포**:
1. `infra/nginx/ifrs-api.conf` 수정
2. Git commit & push to main
3. GitHub Actions가 자동으로 EC2에 배포 및 Nginx 재시작

## 문제 해결

### ERR_INCOMPLETE_CHUNKED_ENCODING
- **원인**: Nginx 타임아웃으로 SSE 스트림 중단
- **해결**: 이 설정 파일이 자동으로 해결 (proxy_read_timeout 600s)

### 설정 적용 안 됨
```bash
# EC2에서 확인
sudo cat /etc/nginx/sites-available/ifrs-api.conf | grep timeout

# 수동 적용
cd /home/ubuntu/app  # 또는 EC2_DEPLOY_PATH
export API_DOMAIN="api.yeotaeho.kr"
envsubst '${API_DOMAIN}' < infra/nginx/ifrs-api.conf \
  | sudo tee /etc/nginx/sites-available/ifrs-api.conf
sudo nginx -t
sudo systemctl reload nginx
```
