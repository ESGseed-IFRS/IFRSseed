# 버그 수정: NoneType 에러 및 Gemini 패키지 마이그레이션

**최종 수정**: 2026-04-06  
**작성자**: AI Assistant  
**문서 버전**: 1.0

---
aaㅁㅁㅁㅁ
## 1. 문제 상황

### 1.1 NoneType 에러

스크린샷에서 확인된 여러 `'NoneType' object has no attribute 'get'` 에러:

```
File "orchestrator.py", line 396, in _merge_and_filter_data
    selection=selection
             ^^^^^^^^^
AttributeError: 'NoneType' object has no attribute 'get'

File "orchestrator.py", line 651, in _build_gen_input
    "rulebook_title": rulebook.get("rulebook_title"),
                      ^^^^^^^^
AttributeError: 'NoneType' object has no attribute 'get'
```

**원인**: Gemini API 실패 시 (429 quota exceed 등) `None` 값이 반환되거나, 데이터 구조에서 중첩된 딕셔너리가 `None`일 때 `.get()` 호출 시 에러 발생.

### 1.2 Deprecation 경고

```
All support for the `google.generativeai` package has ended.
Please switch to the `google.genai` package as soon as possible.
```

**원인**: `google-generativeai` 패키지가 deprecated되어 `google-genai`로 마이그레이션 필요.

---

## 2. 해결 방법

### 2.1 None 방어 코드 추가

#### 2.1.1 `_build_gen_input` 메서드

**위치**: `backend/domain/v1/ifrs_agent/hub/orchestrator/orchestrator.py:605`

```python
def _build_gen_input(
    self,
    ref_data: dict,
    fact_data: dict,
    agg_data: dict,
    user_input: dict,
    selection: dict
) -> dict:
    # 모든 입력 파라미터에 대한 None 방어
    ref_data = ref_data or {}
    fact_data = fact_data or {}
    agg_data = agg_data or {}
    user_input = user_input or {}
    selection = selection or {}
    
    # ref_data 접근 시 None 방어
    result = {
        "category": user_input.get("category"),
        "report_year": 2025,
        "ref_2024": self._extract_sr_essentials((ref_data.get("2024") or {})),
        "ref_2023": self._extract_sr_essentials((ref_data.get("2023") or {})),
    }
    
    # fact_data 중첩 딕셔너리 접근 시 None 방어
    if selection.get("include_dp_metadata"):
        dp_meta = fact_data.get("dp_metadata") or {}
        # ...
    
    if selection.get("include_company_profile"):
        profile = fact_data.get("company_profile") or {}
        # ...
    
    if selection.get("include_ucm"):
        ucm = fact_data.get("ucm") or {}
        # ...
    
    if selection.get("include_rulebook"):
        rulebook = fact_data.get("rulebook") or {}
        # ...
```

#### 2.1.2 `_extract_sr_essentials` 메서드

**위치**: `backend/domain/v1/ifrs_agent/hub/orchestrator/orchestrator.py:669`

```python
def _extract_sr_essentials(self, year_data: dict) -> dict:
    """SR 데이터에서 gen_node에 필요한 필드만 추출"""
    if not year_data or not isinstance(year_data, dict):
        return {}
    
    # sr_images 리스트 타입 검증
    sr_images = year_data.get("sr_images")
    if not isinstance(sr_images, list):
        sr_images = []
    
    return {
        "page_number": year_data.get("page_number"),
        "body_text": year_data.get("sr_body", ""),
        "images": [
            {
                "image_type": (img or {}).get("image_type"),
                "caption": (img or {}).get("caption"),
                "image_url": (img or {}).get("image_url")
            }
            for img in sr_images
            if isinstance(img, dict)  # None 또는 비-dict 필터링
        ]
    }
```

#### 2.1.3 `_extract_agg_essentials` 메서드

**위치**: `backend/domain/v1/ifrs_agent/hub/orchestrator/orchestrator.py:687`

```python
def _extract_agg_essentials(
    self,
    agg_data: dict,
    include_subsidiary: bool = True,
    include_external: bool = True
) -> dict:
    """aggregation 데이터에서 gen_node에 필요한 필드만 추출"""
    if not agg_data or not isinstance(agg_data, dict):
        return {}
    
    result = {}
    for year, year_data in agg_data.items():
        if not isinstance(year_data, dict):
            continue
        
        year_result = {}
        
        if include_subsidiary:
            # 리스트 타입 검증
            sub_list = year_data.get("subsidiary_data")
            if not isinstance(sub_list, list):
                sub_list = []
            year_result["subsidiary_data"] = [
                {
                    "subsidiary_name": (sub or {}).get("subsidiary_name"),
                    # ... (sub or {}) 패턴으로 None 방어
                }
                for sub in sub_list
                if isinstance(sub, dict)
            ]
        
        if include_external:
            # 리스트 타입 검증
            ext_list = year_data.get("external_company_data")
            if not isinstance(ext_list, list):
                ext_list = []
            year_result["external_company_data"] = [
                {
                    "title": (ext or {}).get("title"),
                    # ... (ext or {}) 패턴으로 None 방어
                }
                for ext in ext_list
                if isinstance(ext, dict)
            ]
        
        result[year] = year_result
    
    return result
```

### 2.2 Gemini 패키지 마이그레이션

#### 2.2.1 `requirement.txt` 업데이트

**위치**: `backend/requirement.txt:31`

```diff
- google-generativeai>=0.8.0
+ google-genai>=0.1.0
```

#### 2.2.2 Orchestrator 초기화 코드 변경

**위치**: `backend/domain/v1/ifrs_agent/hub/orchestrator/orchestrator.py:__init__`

```python
# 기존 (deprecated)
import google.generativeai as genai
genai.configure(api_key=self.settings.gemini_api_key)
self._gemini_client = genai.GenerativeModel(model_id)

# 신규 (google.genai)
from google import genai
client = genai.Client(api_key=self.settings.gemini_api_key)
self._gemini_client = client
self._gemini_model_id = model_id
```

#### 2.2.3 LLM 호출 코드 변경

**위치**: `backend/domain/v1/ifrs_agent/hub/orchestrator/orchestrator.py:_select_data_for_gen`

```python
# 기존 (deprecated)
response = self._gemini_client.generate_content(
    prompt,
    generation_config={
        "temperature": 0.1,
        "response_mime_type": "application/json"
    }
)

# 신규 (google.genai)
response = self._gemini_client.models.generate_content(
    model=self._gemini_model_id,
    contents=prompt,
    config={
        "temperature": 0.1,
        "response_mime_type": "application/json"
    }
)
```

---

## 3. 설치 및 적용

### 3.1 패키지 재설치

```bash
# 가상환경 활성화
source venv/bin/activate  # Linux/Mac
# 또는
.\venv\Scripts\activate  # Windows

# 기존 패키지 제거
pip uninstall google-generativeai -y

# 신규 패키지 설치
pip install -r backend/requirement.txt
```

### 3.2 서버 재시작

```bash
# 기존 서버 종료 (Ctrl+C)

# 서버 재시작
uvicorn backend.main:app --host 0.0.0.0 --port 9005 --reload
```

---

## 4. 검증 방법

### 4.1 Deprecation 경고 확인

서버 시작 로그에서 더 이상 다음 경고가 나타나지 않아야 함:

```
All support for the `google.generativeai` package has ended.
```

### 4.2 NoneType 에러 재현 테스트

이전에 에러가 발생했던 요청을 다시 실행:

```bash
POST http://localhost:9005/ifrs-agent/reports/create
{
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "category": "이사회 구성",
  "dp_id": "ESRS2-GOV-1-21-b",
  "max_retries": 3
}
```

**예상 결과**:
- Gemini API 실패 시에도 `rule-based fallback` 로그가 나타나며 에러 없이 처리됨
- `gen_input`과 `data_selection` 필드가 정상적으로 응답에 포함됨

### 4.3 로그 확인

```
INFO: Gemini gemini-2.5-pro initialized (google.genai)
INFO: Data selection result: <rationale 내용>
```

또는 fallback 시:

```
WARNING: Data selection was not a dict (NoneType), using rule-based fallback
ERROR: LLM data selection failed: <에러 메시지>, using rule-based fallback
INFO: Data selection result: rule-based fallback applied
```

---

## 5. 영향 범위

### 5.1 변경된 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/requirement.txt` | `google-generativeai` → `google-genai` |
| `backend/domain/v1/ifrs_agent/hub/orchestrator/orchestrator.py` | Gemini 클라이언트 초기화 및 호출 코드 변경, None 방어 코드 추가 |
| `backend/domain/v1/ifrs_agent/docs/orchestrator/PHASE2_DATA_SELECTION.md` | 패키지 의존성 섹션 추가 |
| `backend/domain/v1/ifrs_agent/docs/IMPLEMENTATION_SUMMARY_2026_04_06_PHASE2.md` | 패키지 마이그레이션 내용 추가 |
| `backend/domain/v1/ifrs_agent/docs/BUGFIX_2026_04_06_NONE_HANDLING.md` | 본 문서 (신규) |

### 5.2 하위 호환성

- **Breaking Change 없음**: API 인터페이스 변경 없음
- **내부 구현만 변경**: LLM 호출 방식 변경, 방어 코드 추가
- **기존 동작 유지**: 정상 케이스에서는 동일한 결과 반환
- **에러 처리 개선**: 예외 상황에서 더 안정적으로 동작

---

## 6. 추가 권장 사항

### 6.1 Gemini API 할당량 모니터링

429 에러가 자주 발생한다면:

1. **Google Cloud Console**에서 Gemini API 할당량 확인
2. 필요시 할당량 증가 요청
3. 또는 `orchestrator_gemini_model` 설정을 더 가벼운 모델로 변경:
   ```bash
   # .env
   ORCHESTRATOR_GEMINI_MODEL=gemini-2.5-flash  # 더 빠르고 저렴
   ```

### 6.2 로깅 레벨 조정

디버깅이 필요한 경우:

```python
# backend/core/config/settings.py
LOG_LEVEL = "DEBUG"  # 기본값: INFO
```

### 6.3 테스트 커버리지 확장

향후 유사한 에러 방지를 위해:

- `_build_gen_input` 메서드에 대한 단위 테스트 추가
- `None` 입력에 대한 테스트 케이스 추가
- Gemini API 실패 시나리오 모킹 테스트

---

## 7. 요약

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| Gemini 패키지 | `google-generativeai` (deprecated) | `google-genai` (최신) |
| None 처리 | 일부 누락 → 런타임 에러 | 모든 경로에 방어 코드 추가 |
| 에러 복구 | 크래시 | Rule-based fallback으로 graceful degradation |
| 안정성 | Gemini API 실패 시 서비스 중단 | Gemini API 실패 시에도 서비스 계속 |

**결론**: 이번 수정으로 Orchestrator의 Phase 2 데이터 선택 로직이 더욱 견고해지고, 최신 Gemini SDK를 사용하여 장기적인 유지보수성도 확보되었습니다.
