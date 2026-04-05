# IFRS Agent Dependencies

## 필수 패키지 설치

### 1. 핵심 의존성

```bash
# LangGraph 워크플로우
pip install langgraph

# PostgreSQL 비동기 연결
pip install asyncpg

# 임베딩 모델 (BGE-M3)
pip install sentence-transformers

# LLM API (선택)
pip install google-generativeai  # dp_rag: Gemini 2.5 Flash 등 (generateContent)
pip install openai                # GPT-5 mini
```

### 2. 한 번에 설치

```bash
pip install langgraph asyncpg sentence-transformers google-generativeai openai
```

### 3. requirements.txt에 추가 (권장)

`backend/requirements.txt`에 다음 내용 추가:

```txt
# IFRS Agent 의존성
langgraph>=0.0.1
asyncpg>=0.29.0
sentence-transformers>=2.2.0
google-generativeai>=0.3.0
openai>=1.0.0
```

설치:
```bash
pip install -r backend/requirements.txt
```

---

## BGE-M3 모델 다운로드

### 자동 다운로드
- 최초 실행 시 HuggingFace에서 자동 다운로드 (~2GB)
- 경로: `~/.cache/huggingface/hub/models--BAAI--bge-m3/`
- 이후 실행은 로컬 캐시 사용 (빠름)

### 수동 다운로드 (선택)

```python
from sentence_transformers import SentenceTransformer

# 모델 다운로드 및 캐싱
model = SentenceTransformer('BAAI/bge-m3')
print("모델 다운로드 완료!")
```

---

## 임베딩 모델 테스트

```python
from sentence_transformers import SentenceTransformer

# 모델 로드
model = SentenceTransformer('BAAI/bge-m3')

# 임베딩 생성
text = "기후 변화 대응 전략"
embedding = model.encode(text, normalize_embeddings=True)

print(f"텍스트: {text}")
print(f"임베딩 차원: {len(embedding)}")  # 1024
print(f"임베딩 샘플: {embedding[:5]}")
```

**예상 출력**:
```
텍스트: 기후 변화 대응 전략
임베딩 차원: 1024
임베딩 샘플: [ 0.0234 -0.0156  0.0891 -0.0423  0.0167]
```

---

## 환경 변수 설정

`.env` 파일에 다음 추가:

```env
# LLM API Keys
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

---

## 시스템 요구사항

- **Python**: 3.11+
- **메모리**: 최소 4GB (BGE-M3 모델 로드 시)
- **디스크**: 3GB 이상 (모델 캐시)
- **PostgreSQL**: 14+ (pgvector 확장 필요)

---

**작성**: AI Assistant  
**일자**: 2026-04-04

