# 빌드 단계
FROM node:20-alpine AS builder

WORKDIR /app

# package 파일들 복사
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# pnpm이 있으면 pnpm 사용, 없으면 npm 사용
RUN if [ -f pnpm-lock.yaml ]; then \
  npm install -g pnpm && \
  pnpm install --frozen-lockfile; \
  else \
  npm ci; \
  fi

# 소스 코드 복사
COPY . .

# public 디렉토리가 없으면 생성
RUN mkdir -p ./public

# Next.js 빌드
RUN if [ -f pnpm-lock.yaml ]; then \
  pnpm build; \
  else \
  npm run build; \
  fi

# 프로덕션 단계
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# package 파일들 복사
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# 프로덕션 의존성만 설치
RUN if [ -f pnpm-lock.yaml ]; then \
  npm install -g pnpm && \
  pnpm install --prod --frozen-lockfile; \
  else \
  npm ci --only=production; \
  fi

# 빌드된 파일들 복사
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.mjs ./
# public 디렉토리 복사 (없으면 빈 디렉토리)
COPY --from=builder /app/public ./public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]

