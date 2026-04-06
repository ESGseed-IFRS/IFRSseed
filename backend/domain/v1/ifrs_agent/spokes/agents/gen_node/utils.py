"""
Gen Node 유틸리티 함수
"""
import re
import logging
from typing import Any, Dict, Tuple

logger = logging.getLogger("ifrs_agent.gen_node.utils")

# orchestrator가 gen_input을 중첩해 넘기지 않고 펼친 레거시 페이로드와 구분
_GEN_INPUT_RESERVED_KEYS = frozenset(
    {
        "runtime_config",
        "feedback",
        "mode",
        "state",
        "user_instruction",
        "previous_text",
    }
)


def resolve_gen_input_from_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    gen_node 입력에서 Phase 2 `gen_input` dict를 얻는다.

    - 정상: payload["gen_input"] = { category, report_year, ref_*, dp_data, ... }
    - 레거시/직접 호출: 동일 필드가 payload 최상위에 펼쳐진 경우
    """
    gi = payload.get("gen_input")
    if isinstance(gi, dict) and gi.get("category"):
        return gi

    flat = {
        k: v
        for k, v in payload.items()
        if k not in _GEN_INPUT_RESERVED_KEYS
    }
    if flat.get("category"):
        return flat

    if isinstance(gi, dict) and gi:
        return gi

    return {}


def estimate_token_count(text: str) -> int:
    """
    대략적인 토큰 수 추정 (한·영 혼합 SR 본문용 보수적 상한).

    Gemini 입력은 문자 수 기준으로도 제한이 있으므로, 너무 낮게 잡지 않는다.
    """
    if not text:
        return 0
    return int(len(text) * 1.2)


# Gemini 2.5 Pro는 긴 컨텍스트를 지원. 6000 토큰은 SR 2개년+메타에서 쉽게 초과되어
# 불필요한 잘림·빈 응답을 유발하므로 기본 한도를 크게 둔다.
DEFAULT_MAX_PROMPT_TOKENS = 180_000


def _truncate_ref_year_block(body: str, max_body_chars: int) -> str:
    if len(body) <= max_body_chars:
        return body
    return body[:max_body_chars] + "\n\n... (이하 생략)"


def _shrink_reference_sections(prompt: str, max_body_chars: int) -> str:
    """
    prompts.py 형식: ## 2024년 보고서 (페이지 N)\\n\\n 본문 ...
    """
    out = prompt

    def repl_2024(m: re.Match) -> str:
        header, body, tail = m.group(1), m.group(2), m.group(3)
        return header + _truncate_ref_year_block(body, max_body_chars) + tail

    def repl_2023(m: re.Match) -> str:
        header, body, tail = m.group(1), m.group(2), m.group(3)
        return header + _truncate_ref_year_block(body, max_body_chars) + tail

    # 헤더에 (페이지 …) 포함
    out = re.sub(
        r"(## 2024년 보고서[^\n]*\n\n)([\s\S]*?)(\n\n(?:## |# |\Z))",
        repl_2024,
        out,
        count=1,
    )
    out = re.sub(
        r"(## 2023년 보고서[^\n]*\n\n)([\s\S]*?)(\n\n(?:## |# |\Z))",
        repl_2023,
        out,
        count=1,
    )
    return out


def truncate_if_needed(
    prompt: str, max_tokens: int = DEFAULT_MAX_PROMPT_TOKENS
) -> Tuple[str, bool]:
    """
    프롬프트가 너무 길면 참조(연도별 SR) 본문을 단계적으로 축약한 뒤,
    그래도 넘치면 문자 단위로 하드 캡한다.

    Args:
        prompt: 원본 사용자 프롬프트 (시스템 프롬프트 제외)
        max_tokens: 추정 토큰 상한 (기본 18만 — Gemini 2.5 Pro 입력 여유)
    """
    estimated = estimate_token_count(prompt)

    if estimated <= max_tokens:
        return prompt, False

    logger.warning(
        "Prompt too long (%s est. tokens > %s), shrinking reference sections",
        estimated,
        max_tokens,
    )

    work = prompt
    for max_body_chars in (12000, 8000, 5000, 3000, 2000, 1200):
        work = _shrink_reference_sections(work, max_body_chars)
        if estimate_token_count(work) <= max_tokens:
            return work, True

    # 참조 축약만으로도 부족하면(메타·룰북만으로도 큰 경우) 문자 하드 캡
    max_chars = max(12_000, int(max_tokens / 1.2))
    if len(work) > max_chars:
        logger.warning(
            "Prompt still long after reference shrink; hard cap at %s chars",
            max_chars,
        )
        work = work[:max_chars] + "\n\n... [프롬프트 길이 상한으로 잘림]"

    return work, True


def postprocess_generated_text(text: str) -> str:
    """
    생성된 텍스트 정제
    
    Args:
        text: LLM이 생성한 원본 텍스트
    
    Returns:
        정제된 텍스트
    """
    if not text:
        return ""
    
    # 1. 앞뒤 공백 제거
    text = text.strip()
    
    # 2. 연속 공백 정리
    text = re.sub(r'\n{3,}', '\n\n', text)  # 3개 이상 줄바꿈 → 2개
    text = re.sub(r' {2,}', ' ', text)      # 2개 이상 공백 → 1개
    
    # 3. 메타 설명 제거 (LLM이 가끔 추가하는 경우)
    # 예: "다음은 작성된 문단입니다:" 같은 문구
    meta_patterns = [
        r'^다음은.*?입니다[:.]\s*',
        r'^아래는.*?입니다[:.]\s*',
        r'^작성된.*?입니다[:.]\s*',
        r'^요청하신.*?입니다[:.]\s*',
        r'^\*\*.*?:\*\*\s*',  # **제목:** 형태
    ]
    
    for pattern in meta_patterns:
        text = re.sub(pattern, '', text, flags=re.MULTILINE)
    
    # 4. 마크다운 코드 블록 정리 (불필요한 경우)
    # ```markdown ... ``` 같은 래퍼 제거
    if text.startswith('```') and text.endswith('```'):
        lines = text.split('\n')
        if len(lines) > 2:
            # 첫 줄과 마지막 줄 제거
            text = '\n'.join(lines[1:-1])
    
    return text.strip()


def validate_generated_text(text: str) -> Tuple[bool, str]:
    """
    생성된 텍스트 기본 검증
    
    Args:
        text: 생성된 텍스트
    
    Returns:
        (유효 여부, 에러 메시지)
    """
    if not text or not text.strip():
        return False, "Generated text is empty"
    
    # 최소 길이 체크 (너무 짧으면 의미 없음)
    if len(text.strip()) < 50:
        return False, f"Generated text too short ({len(text)} chars)"
    
    # 최대 길이 체크 (비정상적으로 길면 문제)
    if len(text) > 10000:
        return False, f"Generated text too long ({len(text)} chars)"
    
    return True, ""
