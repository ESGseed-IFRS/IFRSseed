# Gen Node 구현 전략

**작성일**: 2026-04-06  
**버전**: 1.0  
**목적**: SR 보고서 문단 생성 노드의 구체적인 구현 전략 및 프롬프트 설계

---

## 📋 목차

1. [개요](#1-개요)
2. [아키텍처 설계](#2-아키텍처-설계)
3. [입력 데이터 구조](#3-입력-데이터-구조)
4. [프롬프트 전략](#4-프롬프트-전략)
5. [LLM 설정](#5-llm-설정)
6. [출력 구조](#6-출력-구조)
7. [에러 처리](#7-에러-처리)
8. [구현 체크리스트](#8-구현-체크리스트)

---

## 1. 개요

### 1.1 역할

`gen_node`는 **Orchestrator Phase 2**에서 필터링된 데이터(`gen_input`)를 받아 **IFRS/GRI/ESRS 기준서 스타일의 SR 보고서 문단**을 생성합니다.

### 1.2 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **형식 일관성** | 전년도 SR 본문의 문체·구조·톤 유지 |
| **데이터 최신성** | 최신 DP 값으로 업데이트 |
| **기준서 준수** | IFRS/GRI/ESRS 요구사항 반영 |
| **컨텍스트 효율** | Phase 2에서 필터링된 핵심 데이터만 사용 |
| **정성/정량 통합** | 정량 DP(수치), 정성 DP(서술), 카테고리 전용(SR 본문만) 모두 처리 |

### 1.3 모델 선택

**권장 모델**: **Gemini 2.5 Pro**

**선택 이유**:
- 긴 컨텍스트 처리 능력 (참조 데이터 + 최신 데이터)
- 한국어 생성 품질
- IFRS/GRI/ESRS 기준서 이해도
- 구조화된 문단 생성 능력

**대안**: 
- `GPT-5 mini` (빠른 응답, OpenAI 선호 시)
- `Gemini 2.5 Flash` (더 빠른 응답, 낮은 비용)
- `Claude 3.5 Haiku` (균형잡힌 성능)

---

## 2. 아키텍처 설계

### 2.1 호출 흐름

```
Orchestrator (Phase 3: 생성-검증 루프)
    ↓
    gen_input (Phase 2 필터링 결과)
    ↓
┌─────────────────────────────────────────┐
│  gen_node                               │
│                                         │
│  1. 입력 검증                            │
│     - gen_input 구조 확인               │
│     - 필수 필드 존재 여부                │
│                                         │
│  2. 프롬프트 구성                        │
│     - 시스템 프롬프트 (페르소나)         │
│     - 참조 데이터 (ref_2024, ref_2023)  │
│     - DP 데이터 (최신 값)                │
│     - 컨텍스트 (category, rulebook 등)  │
│                                         │
│  3. LLM 호출 (GPT-5 mini)               │
│     - temperature: 0.3                  │
│     - max_tokens: 2000                  │
│                                         │
│  4. 후처리                               │
│     - 텍스트 정제                        │
│     - 메타데이터 추가                    │
└─────────────────────────────────────────┘
    ↓
    generated_text + metadata
    ↓
validator_node (검증)
```

### 2.2 파일 구조

```
backend/domain/v1/ifrs_agent/spokes/agents/gen_node/
├── __init__.py
├── agent.py              # GenNodeAgent 클래스
├── prompts.py            # 프롬프트 템플릿
└── utils.py              # 유틸리티 함수 (텍스트 정제 등)
```

---

## 3. 입력 데이터 구조

### 3.1 `gen_input` 스키마 (Phase 2 출력)

```python
gen_input = {
    # 기본 정보
    "category": str,          # 예: "재생에너지"
    "report_year": int,       # 예: 2025
    
    # 참조 데이터 (전년도, 전전년도)
    "ref_2024": {
        "page_number": int,
        "body_text": str,     # SR 본문 전체
        "images": [           # 이미지 메타데이터
            {
                "image_type": str,
                "caption": str,
                "image_url": str
            }
        ]
    },
    "ref_2023": {
        # ref_2024와 동일 구조
    },
    
    # DP 데이터 (Phase 2 필터링 적용)
    "dp_data": {
        # 기본 필드 (항상 포함)
        "dp_id": str,
        "latest_value": Any,      # 정량: 수치, 정성: None
        "unit": str,
        "year": int,
        "suitability_warning": str,  # 정량 적합성 경고
        
        # 선택적 필드 (data_selection에 따라)
        "dp_name_ko": str,        # include_dp_metadata
        "dp_name_en": str,
        "description": str,
        "dp_type": str,           # "quantitative", "narrative", etc.
        "topic": str,
        "subtopic": str,
        
        "company_profile": {      # include_company_profile
            "company_name_ko": str,
            "company_name_en": str,
            "industry": str,
            "mission": str,
            "vision": str,
            "total_employees": int,
            "board_total_members": int,
            "board_independent_members": int,
            "board_female_members": int
        },
        
        "ucm": {                  # include_ucm
            "column_name_ko": str,
            "column_description": str,
            "validation_rules": dict,
            "disclosure_requirement": str
        },
        
        "rulebook": {             # include_rulebook
            "rulebook_title": str,
            "rulebook_content": str,
            "key_terms": list,
            "disclosure_requirement": str
        }
    },
    
    # 계열사/외부 데이터 (선택적)
    "agg_data": {
        "2024": {
            "subsidiary_data": [  # include_subsidiary_data
                {
                    "subsidiary_name": str,
                    "facility_name": str,
                    "description": str,
                    "quantitative_data": dict,
                    "category": str
                }
            ],
            "external_company_data": [  # include_external_data
                {
                    "title": str,
                    "body_text": str,
                    "source_url": str,
                    "published_date": str
                }
            ]
        },
        "2023": {
            # 2024와 동일 구조
        }
    }
}
```

### 3.2 입력 검증 로직

```python
def validate_gen_input(gen_input: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    gen_input 유효성 검증
    
    Returns:
        (is_valid, error_message)
    """
    # 필수 필드
    if not gen_input.get("category"):
        return False, "category is required"
    
    if not gen_input.get("report_year"):
        return False, "report_year is required"
    
    # ref_data 최소 1개년 필요
    ref_2024 = gen_input.get("ref_2024") or {}
    ref_2023 = gen_input.get("ref_2023") or {}
    
    if not ref_2024.get("body_text") and not ref_2023.get("body_text"):
        return False, "At least one reference year (2024 or 2023) must have body_text"
    
    # dp_data는 선택적 (카테고리 전용 생성 가능)
    
    return True, None
```

---

## 4. 프롬프트 전략

### 4.1 시스템 프롬프트 (페르소나)

```python
SYSTEM_PROMPT = """당신은 IFRS S1/S2, GRI, ESRS 기준서에 정통한 지속가능성 보고서(SR) 작성 전문가입니다.

## 역할
- 기업의 ESG 데이터를 기반으로 전문적이고 정확한 SR 보고서 문단을 작성합니다.
- 전년도 보고서의 문체, 구조, 톤을 유지하면서 최신 데이터로 업데이트합니다.

## 작성 원칙
1. **정확성**: 제공된 데이터만 사용하며, 추측하거나 과장하지 않습니다.
2. **일관성**: 전년도 보고서의 문체와 구조를 따릅니다.
3. **명확성**: 전문 용어를 사용하되, 이해하기 쉽게 작성합니다.
4. **객관성**: 그린워싱을 피하고, 사실에 기반한 서술을 합니다.
5. **기준서 준수**: IFRS/GRI/ESRS 요구사항을 반영합니다.

## 금지 사항
- 제공되지 않은 데이터를 임의로 생성하지 마세요.
- "예상", "추정", "약" 등 모호한 표현을 피하세요.
- 과장된 긍정적 표현(그린워싱)을 사용하지 마세요.
- 전년도 보고서의 문체를 크게 벗어나지 마세요.

## 출력 형식
- 한국어로 작성합니다.
- 문단 형식으로 작성하되, 필요시 소제목을 포함할 수 있습니다.
- 수치는 단위와 함께 명확히 표기합니다.
- 표나 목록이 필요한 경우 마크다운 형식을 사용합니다.
"""
```

### 4.2 사용자 프롬프트 구성 전략

#### 4.2.1 프롬프트 구조

```python
def build_user_prompt(gen_input: Dict[str, Any]) -> str:
    """
    gen_input을 기반으로 사용자 프롬프트 구성
    """
    sections = []
    
    # 1. 작성 요청 (카테고리, 연도)
    sections.append(_build_task_section(gen_input))
    
    # 2. 참조 데이터 (전년도, 전전년도 SR 본문)
    sections.append(_build_reference_section(gen_input))
    
    # 3. 최신 데이터 (DP 값, 회사 정보 등)
    sections.append(_build_latest_data_section(gen_input))
    
    # 4. 기준서 요구사항 (rulebook, 정성 DP)
    sections.append(_build_requirements_section(gen_input))
    
    # 5. 계열사/외부 데이터 (선택적)
    sections.append(_build_aggregation_section(gen_input))
    
    # 6. 작성 지시
    sections.append(_build_instruction_section(gen_input))
    
    return "\n\n".join(filter(None, sections))
```

#### 4.2.2 섹션별 상세 구현

**1. 작성 요청 섹션**

```python
def _build_task_section(gen_input: Dict[str, Any]) -> str:
    category = gen_input.get("category", "")
    year = gen_input.get("report_year", 2025)
    
    return f"""# 작성 요청

**카테고리**: {category}
**보고 연도**: {year}년

위 카테고리에 대한 {year}년 SR 보고서 문단을 작성해주세요."""
```

**2. 참조 데이터 섹션**

```python
def _build_reference_section(gen_input: Dict[str, Any]) -> str:
    """전년도/전전년도 SR 본문 제공"""
    parts = ["# 참조 데이터 (전년도 보고서)"]
    
    ref_2024 = gen_input.get("ref_2024") or {}
    ref_2023 = gen_input.get("ref_2023") or {}
    
    if ref_2024.get("body_text"):
        body = ref_2024["body_text"]
        # 너무 길면 앞부분만 (LLM 컨텍스트 고려)
        if len(body) > 3000:
            body = body[:3000] + "\n\n... (이하 생략)"
        
        parts.append(f"""
## 2024년 보고서 (페이지 {ref_2024.get('page_number', 'N/A')})

{body}
""")
        
        # 이미지 정보
        images = ref_2024.get("images", [])
        if images:
            parts.append("\n### 2024년 사용된 이미지")
            for idx, img in enumerate(images[:5], 1):  # 최대 5개
                parts.append(f"{idx}. {img.get('image_type', 'unknown')}: {img.get('caption', 'N/A')}")
    
    if ref_2023.get("body_text"):
        body = ref_2023["body_text"]
        if len(body) > 2000:  # 2023은 더 짧게
            body = body[:2000] + "\n\n... (이하 생략)"
        
        parts.append(f"""
## 2023년 보고서 (페이지 {ref_2023.get('page_number', 'N/A')})

{body}
""")
    
    return "\n".join(parts) if len(parts) > 1 else ""
```

**3. 최신 데이터 섹션**

```python
def _build_latest_data_section(gen_input: Dict[str, Any]) -> str:
    """최신 DP 값 및 회사 정보"""
    dp_data = gen_input.get("dp_data") or {}
    if not dp_data:
        return ""
    
    parts = ["# 최신 데이터 (업데이트 필요)"]
    
    # DP 기본 정보
    dp_id = dp_data.get("dp_id")
    dp_name = dp_data.get("dp_name_ko") or dp_id
    dp_type = dp_data.get("dp_type", "unknown")
    
    parts.append(f"\n## Data Point: {dp_name}")
    parts.append(f"- **DP ID**: {dp_id}")
    parts.append(f"- **유형**: {dp_type}")
    
    # 정량 DP: 최신 값
    latest_value = dp_data.get("latest_value")
    if latest_value is not None:
        unit = dp_data.get("unit", "")
        year = dp_data.get("year", "N/A")
        parts.append(f"- **{year}년 값**: {latest_value} {unit}")
        
        # 적합성 경고
        warning = dp_data.get("suitability_warning")
        if warning:
            parts.append(f"\n⚠️ **주의**: {warning}")
    
    # 정성 DP: 설명
    description = dp_data.get("description")
    if description and dp_type in ("narrative", "qualitative"):
        parts.append(f"\n**요구사항**: {description}")
    
    # 회사 프로필 (include_company_profile=true)
    profile = dp_data.get("company_profile")
    if profile:
        parts.append("\n## 회사 정보")
        parts.append(f"- **회사명**: {profile.get('company_name_ko', 'N/A')}")
        parts.append(f"- **산업**: {profile.get('industry', 'N/A')}")
        
        if profile.get("mission"):
            parts.append(f"- **미션**: {profile['mission']}")
        if profile.get("vision"):
            parts.append(f"- **비전**: {profile['vision']}")
        
        # 이사회 정보
        board_total = profile.get("board_total_members")
        if board_total:
            parts.append(f"- **이사회 구성**: 총 {board_total}명")
            if profile.get("board_independent_members"):
                parts.append(f"  - 사외이사: {profile['board_independent_members']}명")
            if profile.get("board_female_members"):
                parts.append(f"  - 여성 이사: {profile['board_female_members']}명")
    
    return "\n".join(parts)
```

**4. 기준서 요구사항 섹션**

```python
def _build_requirements_section(gen_input: Dict[str, Any]) -> str:
    """rulebook, UCM 검증 규칙 등"""
    dp_data = gen_input.get("dp_data") or {}
    
    parts = []
    
    # Rulebook (정성 DP 필수)
    rulebook = dp_data.get("rulebook")
    if rulebook and rulebook.get("rulebook_content"):
        parts.append("# 기준서 요구사항")
        parts.append(f"\n## {rulebook.get('rulebook_title', 'Rulebook')}")
        parts.append(f"\n{rulebook['rulebook_content']}")
        
        # 핵심 용어
        key_terms = rulebook.get("key_terms")
        if key_terms:
            parts.append("\n**핵심 용어**: " + ", ".join(key_terms))
    
    # UCM 검증 규칙
    ucm = dp_data.get("ucm")
    if ucm and ucm.get("validation_rules"):
        if not parts:
            parts.append("# 검증 규칙")
        parts.append(f"\n## UCM 검증")
        parts.append(f"- **컬럼**: {ucm.get('column_name_ko', 'N/A')}")
        parts.append(f"- **규칙**: {ucm['validation_rules']}")
    
    return "\n".join(parts) if parts else ""
```

**5. 계열사/외부 데이터 섹션**

```python
def _build_aggregation_section(gen_input: Dict[str, Any]) -> str:
    """subsidiary_data, external_company_data"""
    agg_data = gen_input.get("agg_data") or {}
    if not agg_data:
        return ""
    
    parts = ["# 추가 참고 데이터"]
    
    # 2024년 계열사 데이터
    data_2024 = agg_data.get("2024") or {}
    subsidiary = data_2024.get("subsidiary_data", [])
    
    if subsidiary:
        parts.append("\n## 계열사/사업장 상세 (2024년)")
        for idx, sub in enumerate(subsidiary[:3], 1):  # 최대 3개
            parts.append(f"\n### {idx}. {sub.get('facility_name', 'N/A')}")
            if sub.get("description"):
                desc = sub["description"]
                if len(desc) > 200:
                    desc = desc[:200] + "..."
                parts.append(desc)
            
            quant = sub.get("quantitative_data")
            if quant:
                parts.append(f"**정량 데이터**: {quant}")
    
    # 외부 보도
    external = data_2024.get("external_company_data", [])
    if external:
        parts.append("\n## 언론 보도/뉴스 (2024년)")
        for idx, ext in enumerate(external[:2], 1):  # 최대 2개
            parts.append(f"\n{idx}. **{ext.get('title', 'N/A')}**")
            if ext.get("body_text"):
                body = ext["body_text"]
                if len(body) > 150:
                    body = body[:150] + "..."
                parts.append(f"   {body}")
    
    return "\n".join(parts) if len(parts) > 1 else ""
```

**6. 작성 지시 섹션**

```python
def _build_instruction_section(gen_input: Dict[str, Any]) -> str:
    """최종 작성 지시"""
    category = gen_input.get("category", "")
    year = gen_input.get("report_year", 2025)
    
    dp_data = gen_input.get("dp_data") or {}
    dp_type = dp_data.get("dp_type", "quantitative")
    
    instruction = f"""# 작성 지시

위 참조 데이터와 최신 데이터를 바탕으로 **{year}년 "{category}"** 섹션의 SR 보고서 문단을 작성해주세요.

## 작성 가이드
"""
    
    if dp_type in ("narrative", "qualitative"):
        instruction += """
- **정성 DP**: 기준서 요구사항(rulebook)을 충족하는 서술형 답변을 작성하세요.
- 회사의 정책, 절차, 접근 방식을 구체적으로 설명하세요.
- 가능한 경우 사례나 예시를 포함하세요.
"""
    else:
        instruction += """
- **정량 DP**: 최신 수치 데이터를 명확히 표기하세요.
- 전년도 대비 변화가 있다면 언급하세요.
- 수치의 의미와 맥락을 설명하세요.
"""
    
    instruction += """
- 전년도 보고서의 **문체와 구조**를 최대한 유지하세요.
- 제공된 데이터만 사용하고, 추측하지 마세요.
- 표나 목록이 필요한 경우 마크다운 형식을 사용하세요.
- 그린워싱을 피하고 객관적으로 작성하세요.

**출력**: 완성된 문단만 반환하세요 (메타 설명 없이).
"""
    
    return instruction
```

### 4.3 프롬프트 길이 관리

```python
def estimate_token_count(text: str) -> int:
    """대략적인 토큰 수 추정 (한국어: 문자당 ~1.5 토큰)"""
    return int(len(text) * 1.5)

def truncate_if_needed(prompt: str, max_tokens: int = 6000) -> str:
    """프롬프트가 너무 길면 참조 데이터 축약"""
    if estimate_token_count(prompt) <= max_tokens:
        return prompt
    
    # 참조 본문을 더 짧게 자르는 등의 로직
    logger.warning("Prompt too long, truncating reference data")
    # ... 구현
    return prompt
```

---

## 5. LLM 설정

### 5.1 OpenAI Chat Completions 호출

```python
import openai
from typing import Dict, Any

async def generate_text(
    gen_input: Dict[str, Any],
    openai_api_key: str,
    model: str = "gpt-5-mini"
) -> Dict[str, Any]:
    """
    LLM을 호출하여 SR 문단 생성
    
    Args:
        gen_input: Phase 2 필터링된 입력
        openai_api_key: OpenAI API 키
        model: 모델명
    
    Returns:
        {
            "text": str,           # 생성된 문단
            "model": str,          # 사용된 모델
            "tokens": int,         # 사용된 토큰 수
            "finish_reason": str   # 완료 이유
        }
    """
    client = openai.AsyncOpenAI(api_key=openai_api_key)
    
    system_prompt = SYSTEM_PROMPT
    user_prompt = build_user_prompt(gen_input)
    
    # 프롬프트 길이 체크
    user_prompt = truncate_if_needed(user_prompt)
    
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,      # 일관성 중시
            max_tokens=2000,      # 문단 길이 제한
            top_p=0.9,
            frequency_penalty=0.0,
            presence_penalty=0.0
        )
        
        choice = response.choices[0]
        
        return {
            "text": choice.message.content.strip(),
            "model": response.model,
            "tokens": response.usage.total_tokens,
            "finish_reason": choice.finish_reason
        }
    
    except openai.APIError as e:
        logger.error(f"OpenAI API error: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in generate_text: {e}")
        raise
```

### 5.2 파라미터 설명

| 파라미터 | 값 | 설명 |
|---------|-----|------|
| `temperature` | 0.3 | 낮은 값 = 일관성 높음, 창의성 낮음 (SR 보고서에 적합) |
| `max_tokens` | 2000 | 한 문단 생성에 충분한 길이 |
| `top_p` | 0.9 | 누적 확률 샘플링 (기본값) |
| `frequency_penalty` | 0.0 | 반복 억제 없음 (전문 용어 반복 허용) |
| `presence_penalty` | 0.0 | 주제 다양성 억제 없음 |

### 5.3 대안 모델 설정

**Gemini 2.5 Flash 사용 시:**

```python
from google import genai

async def generate_text_gemini(
    gen_input: Dict[str, Any],
    gemini_api_key: str,
    model: str = "gemini-2.5-flash"
) -> Dict[str, Any]:
    """Gemini로 SR 문단 생성"""
    client = genai.Client(api_key=gemini_api_key)
    
    system_prompt = SYSTEM_PROMPT
    user_prompt = build_user_prompt(gen_input)
    
    response = client.models.generate_content(
        model=model,
        contents=f"{system_prompt}\n\n{user_prompt}",
        config={
            "temperature": 0.3,
            "max_output_tokens": 2000
        }
    )
    
    return {
        "text": response.text.strip(),
        "model": model,
        "tokens": None,  # Gemini는 usage 정보 제한적
        "finish_reason": "stop"
    }
```

---

## 6. 출력 구조

### 6.1 gen_node 반환 형식

```python
{
    "text": str,              # 생성된 SR 문단 (필수)
    "metadata": {
        "model": str,         # 사용된 LLM 모델
        "tokens": int,        # 사용된 토큰 수
        "finish_reason": str, # "stop", "length", etc.
        "generation_time_ms": int,
        "prompt_length": int  # 입력 프롬프트 길이 (디버깅용)
    },
    "warnings": [             # 경고 메시지 (선택적)
        "suitability_warning detected",
        "Reference data truncated due to length"
    ]
}
```

### 6.2 후처리

```python
def postprocess_generated_text(text: str) -> str:
    """생성된 텍스트 정제"""
    # 1. 앞뒤 공백 제거
    text = text.strip()
    
    # 2. 연속 공백 정리
    import re
    text = re.sub(r'\n{3,}', '\n\n', text)  # 3개 이상 줄바꿈 → 2개
    text = re.sub(r' {2,}', ' ', text)      # 2개 이상 공백 → 1개
    
    # 3. 메타 설명 제거 (LLM이 가끔 추가하는 경우)
    # 예: "다음은 작성된 문단입니다:" 같은 문구
    meta_patterns = [
        r'^다음은.*?입니다[:.]\s*',
        r'^아래는.*?입니다[:.]\s*',
        r'^작성된.*?입니다[:.]\s*'
    ]
    for pattern in meta_patterns:
        text = re.sub(pattern, '', text, flags=re.MULTILINE)
    
    return text.strip()
```

---

## 7. 에러 처리

### 7.1 에러 타입 및 처리 전략

| 에러 타입 | 처리 방법 |
|----------|-----------|
| **입력 검증 실패** | `ValueError` 발생, 오케스트레이터에 전달 |
| **LLM API 에러** | 재시도 (최대 2회), 실패 시 에러 반환 |
| **토큰 초과** | 참조 데이터 축약 후 재시도 |
| **빈 응답** | 경고 로그 + 기본 메시지 반환 |
| **타임아웃** | 30초 타임아웃 설정, 초과 시 에러 |

### 7.2 에러 처리 코드

```python
async def gen_node_handler(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    gen_node 진입점
    
    Args:
        payload: {
            "gen_input": Dict[str, Any],
            "runtime_config": Dict[str, Any]
        }
    
    Returns:
        {"text": str, "metadata": dict} or {"error": str}
    """
    try:
        # 1. 입력 검증
        gen_input = payload.get("gen_input") or {}
        is_valid, error_msg = validate_gen_input(gen_input)
        if not is_valid:
            logger.error(f"Invalid gen_input: {error_msg}")
            return {"error": f"Input validation failed: {error_msg}"}
        
        # 2. 런타임 설정
        runtime_config = payload.get("runtime_config") or {}
        openai_api_key = runtime_config.get("openai_api_key")
        if not openai_api_key:
            return {"error": "openai_api_key is required in runtime_config"}
        
        model = runtime_config.get("gen_node_model", "gpt-5-mini")
        
        # 3. 텍스트 생성 (재시도 로직 포함)
        max_retries = 2
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                result = await generate_text(
                    gen_input=gen_input,
                    openai_api_key=openai_api_key,
                    model=model
                )
                
                # 4. 후처리
                result["text"] = postprocess_generated_text(result["text"])
                
                # 5. 경고 추가
                warnings = []
                dp_data = gen_input.get("dp_data") or {}
                if dp_data.get("suitability_warning"):
                    warnings.append("suitability_warning detected")
                
                result["warnings"] = warnings
                
                return result
            
            except openai.APIError as e:
                last_error = str(e)
                logger.warning(f"LLM API error (attempt {attempt + 1}/{max_retries + 1}): {e}")
                if attempt < max_retries:
                    await asyncio.sleep(1)  # 재시도 전 대기
                continue
        
        # 재시도 실패
        return {"error": f"LLM generation failed after {max_retries + 1} attempts: {last_error}"}
    
    except Exception as e:
        logger.error(f"Unexpected error in gen_node: {e}", exc_info=True)
        return {"error": f"Internal error: {str(e)}"}
```

---

## 8. 구현 체크리스트

### 8.1 필수 구현 항목

- [ ] **파일 구조 생성**
  - [ ] `backend/domain/v1/ifrs_agent/spokes/agents/gen_node/__init__.py`
  - [ ] `backend/domain/v1/ifrs_agent/spokes/agents/gen_node/agent.py`
  - [ ] `backend/domain/v1/ifrs_agent/spokes/agents/gen_node/prompts.py`
  - [ ] `backend/domain/v1/ifrs_agent/spokes/agents/gen_node/utils.py`

- [ ] **agent.py 구현**
  - [ ] `GenNodeAgent` 클래스
  - [ ] `generate` 메서드 (진입점)
  - [ ] `validate_gen_input` 함수
  - [ ] `generate_text` 함수 (LLM 호출)
  - [ ] `postprocess_generated_text` 함수

- [ ] **prompts.py 구현**
  - [ ] `SYSTEM_PROMPT` 상수
  - [ ] `build_user_prompt` 함수
  - [ ] `_build_task_section` 함수
  - [ ] `_build_reference_section` 함수
  - [ ] `_build_latest_data_section` 함수
  - [ ] `_build_requirements_section` 함수
  - [ ] `_build_aggregation_section` 함수
  - [ ] `_build_instruction_section` 함수

- [ ] **utils.py 구현**
  - [ ] `estimate_token_count` 함수
  - [ ] `truncate_if_needed` 함수
  - [ ] `postprocess_generated_text` 함수

- [ ] **bootstrap.py 등록**
  - [ ] `make_gen_node_handler` 함수
  - [ ] `infra.agent_registry.register("gen_node", handler)`

- [ ] **settings.py 설정 추가**
  - [ ] `gen_node_model: str = "gpt-5-mini"`
  - [ ] 환경변수 `GEN_NODE_MODEL` 로드

### 8.2 테스트 항목

- [ ] **단위 테스트**
  - [ ] `validate_gen_input` 테스트
  - [ ] `build_user_prompt` 테스트 (각 섹션별)
  - [ ] `postprocess_generated_text` 테스트

- [ ] **통합 테스트**
  - [ ] 정량 DP 시나리오 (수치 데이터)
  - [ ] 정성 DP 시나리오 (rulebook 기반)
  - [ ] 카테고리 전용 시나리오 (DP 없음)
  - [ ] 계열사 데이터 포함 시나리오
  - [ ] 에러 처리 시나리오

- [ ] **E2E 테스트**
  - [ ] Orchestrator → gen_node 전체 플로우
  - [ ] 재시도 루프 (validator 피드백)

### 8.3 문서화

- [ ] **API 문서**
  - [ ] gen_node 입력/출력 스키마
  - [ ] 에러 코드 및 메시지

- [ ] **사용 예시**
  - [ ] 기본 사용법
  - [ ] 고급 설정 (모델 변경, 프롬프트 커스터마이징)

---

## 9. 참고 문서

- [REVISED_WORKFLOW.md](../REVISED_WORKFLOW.md) - 전체 워크플로우 설계
- [orchestrator/PHASE2_DATA_SELECTION.md](../orchestrator/PHASE2_DATA_SELECTION.md) - Phase 2 데이터 필터링
- [c_rag/c_rag.md](../c_rag/c_rag.md) - 참조 데이터 수집
- [dp_rag/dp_rag.md](../dp_rag/dp_rag.md) - DP 데이터 수집
- [NEW_CHAT_CONTEXT.md](../NEW_CHAT_CONTEXT.md) - 프로젝트 컨텍스트

---

**최종 수정**: 2026-04-06  
**다음 단계**: `agent.py` 구현 시작
