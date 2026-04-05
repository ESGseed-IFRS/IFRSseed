# SR 인덱스 파일 재구조화 계획서

> **완료 (2026-03-23)**  
> - `sr_index_page_remap` → `index/mapping/` (구 `hub/sr_index_page_remap.py` 삭제됨)  
> - `sr_index_mapping` 구현 → `index/mapping/sr_index_mapping.py` (구 `mapping/sr_index_mapping.py` 삭제됨)  
> - `sr_index_plain_text` 구현 → `index/preprocessing/sr_index_plain_text.py` (구 `hub/sr_index_plain_text.py` 삭제됨)  
> - `test_sr_index_mapping.py` 직접 로드 경로를 신규 파일로 갱신함.

## 개요

현재 인덱스 관련 파일이 `hub/`, `mapping/`, `shared/tool/sr_report/index/` 에 분산되어 있어 **역할 경계가 모호**합니다.  
이 문서는 **3번·4번 제안(매핑/전처리 통합)**을 반영한 파일 이동 계획과 **import 일괄 수정 대상**, **순환 import 위험 지점**을 정리합니다.

---

## 이동 계획 요약

| 현재 경로 | 이동 후 경로 | 역할 |
|-----------|-------------|------|
| `backend/domain/v1/data_integration/hub/sr_index_page_remap.py` | `backend/domain/shared/tool/sr_report/index/mapping/sr_index_page_remap.py` | 슬라이스→원본 페이지 번호 보정 (매핑 단계) |
| `backend/domain/shared/tool/sr_report/mapping/sr_index_mapping.py` | `backend/domain/shared/tool/sr_report/index/mapping/sr_index_mapping.py` | 파싱 결과 → `sr_report_index` 스키마 매핑 |
| `backend/domain/v1/data_integration/hub/sr_index_plain_text.py` | `backend/domain/shared/tool/sr_report/index/preprocessing/sr_index_plain_text.py` | LLM 전 평문 인덱스 전처리 (줄 번호, 다단 처리 등) |

---

## 새 폴더 구조

```
backend/domain/shared/tool/sr_report/index/
├── __init__.py
├── multi_parser_merger.py          (기존)
├── sr_index_agent_tools.py         (기존)
├── mapping/
│   ├── __init__.py
│   ├── sr_index_mapping.py         (이동)
│   └── sr_index_page_remap.py      (이동)
└── preprocessing/
    ├── __init__.py
    └── sr_index_plain_text.py      (이동)
```

---

## import 수정 대상 (일괄 치환 필요)

### 1. `sr_index_page_remap` 관련

| 파일 | 변경 전 | 변경 후 |
|------|---------|---------|
| `backend/domain/v1/data_integration/spokes/agents/sr_index_agent.py` | `from backend.domain.v1.data_integration.hub.sr_index_page_remap import (...)` | `from backend.domain.shared.tool.sr_report.index.mapping.sr_index_page_remap import (...)` |
| `backend/domain/v1/data_integration/tests/test_sr_index_page_remap.py` | `from backend.domain.v1.data_integration.hub.sr_index_page_remap import (...)` | `from backend.domain.shared.tool.sr_report.index.mapping.sr_index_page_remap import (...)` |

**수정 대상 줄**:
- `sr_index_agent.py:25`
- `test_sr_index_page_remap.py:6`

---

### 2. `sr_index_mapping` 관련

| 파일 | 변경 전 | 변경 후 |
|------|---------|---------|
| `backend/domain/shared/tool/sr_report/mapping/__init__.py` | `from .sr_index_mapping import map_tables_to_sr_report_index` | (삭제 후 재배치 필요 여부 검토) |
| `backend/domain/shared/tool/sr_report/index/sr_index_agent_tools.py` | `from backend.domain.shared.tool.sr_report.mapping import map_tables_to_sr_report_index` | `from backend.domain.shared.tool.sr_report.index.mapping.sr_index_mapping import map_tables_to_sr_report_index` |

**수정 대상 줄**:
- `mapping/__init__.py:5`
- `sr_index_agent_tools.py:28`

**참고**: `mapping/__init__.py`에서 이 함수를 export하고 있으므로, **하위 호환을 위해 re-export 유지** 또는 **호출처 일괄 변경** 중 선택 필요.

---

### 3. `sr_index_plain_text` 관련

| 파일 | 변경 전 | 변경 후 |
|------|---------|---------|
| `backend/domain/v1/data_integration/hub/sr_llm_review.py` | `from backend.domain.v1.data_integration.hub.sr_index_plain_text import (...)` | `from backend.domain.shared.tool.sr_report.index.preprocessing.sr_index_plain_text import (...)` |
| `backend/domain/v1/data_integration/tests/test_plain_text_index_prep.py` | `from backend.domain.v1.data_integration.hub.sr_index_plain_text import (...)` | `from backend.domain.shared.tool.sr_report.index.preprocessing.sr_index_plain_text import (...)` |

**수정 대상 줄**:
- `sr_llm_review.py:99`
- `test_plain_text_index_prep.py:6`

---

## 순환 import 위험 분석

### 현재 의존 관계 (이동 전)

```
shared/tool/sr_report/index/sr_index_agent_tools.py
  └─→ hub/sr_llm_review.py (지연 import)
       ├─→ shared/tool/sr_report/index/multi_parser_merger.py
       └─→ hub/sr_index_plain_text.py

spokes/agents/sr_index_agent.py
  ├─→ hub/sr_llm_review.py
  └─→ hub/sr_index_page_remap.py
```

### 이동 후 예상 구조

```
shared/tool/sr_report/index/sr_index_agent_tools.py
  └─→ hub/sr_llm_review.py (지연 import, detect/correct 함수)
       ├─→ shared/.../index/multi_parser_merger.py
       └─→ shared/.../index/preprocessing/sr_index_plain_text.py

spokes/agents/sr_index_agent.py
  ├─→ hub/sr_llm_review.py
  └─→ shared/.../index/mapping/sr_index_page_remap.py
```

### 순환 참조 발생 조건 & 해결책

#### ⚠️ 위험 지점 1: `sr_index_agent_tools.py` ↔ `sr_llm_review.py`

**현재 상태**:
- `sr_index_agent_tools.py`가 `detect_anomalies_tool`, `correct_anomalous_rows_tool` 안에서 **지연 import**로 `sr_llm_review` 함수를 호출
- `sr_llm_review.py`는 `multi_parser_merger`를 **최상단 import**

**순환 위험**:
- `sr_llm_review`가 `sr_index_agent_tools` 모듈 수준에서 뭔가를 import하면 **순환 발생**
- 현재는 **안전** (역방향 참조 없음)

**해결책**: **현재 지연 import 패턴 유지** (라인 277, 343)

---

#### ⚠️ 위험 지점 2: `sr_llm_review` → `sr_index_plain_text` → (`sr_llm_review` 재참조?)

**현재 상태**:
- `sr_llm_review.py:99`에서 `sr_index_plain_text` import
- `sr_index_plain_text.py`는 현재 `sr_llm_review`를 참조하지 **않음**

**이동 후 검증 필요**:
- `preprocessing/sr_index_plain_text.py`가 LLM 호출 추가 시, **`sr_llm_review` 재참조하면 순환**
- 현재는 **안전**

**해결책**: `sr_index_plain_text`는 **순수 전처리만** (LLM 호출 금지)

---

#### ⚠️ 위험 지점 3: `mapping/__init__.py` export 정리

**현재**:
```python
# backend/domain/shared/tool/sr_report/mapping/__init__.py
from .sr_index_mapping import map_tables_to_sr_report_index
```

**이동 후 2가지 선택지**:

**A안: 하위 호환 유지 (re-export)**
```python
# mapping/__init__.py
from ..index.mapping.sr_index_mapping import map_tables_to_sr_report_index

__all__ = ["map_tables_to_sr_report_index"]
```
- 장점: 기존 `from backend.domain.shared.tool.sr_report.mapping import map_tables_to_sr_report_index` 코드가 그대로 동작
- 단점: import 경로가 복잡

**B안: 명시적 경로로 전환 (권장)**
```python
# mapping/__init__.py에서 sr_index_mapping 제거
# 호출처를 새 경로로 일괄 변경
from backend.domain.shared.tool.sr_report.index.mapping import map_tables_to_sr_report_index
```
- 장점: 명확한 경로
- 단점: 일괄 치환 1건 추가 (`sr_index_agent_tools.py:28`)

**권장**: **B안 (명시적 경로)**

---

## 패키지 인식용 `__init__.py` 정리

### 신규 생성 필요

1. `backend/domain/shared/tool/sr_report/index/mapping/__init__.py`
   ```python
   """인덱스 매핑: 파싱 결과 → sr_report_index 스키마 변환, 페이지 보정."""
   from .sr_index_mapping import map_tables_to_sr_report_index
   from .sr_index_page_remap import (
       remap_index_page_number_to_original,
       remap_slice_pages_to_original,
   )

   __all__ = [
       "map_tables_to_sr_report_index",
       "remap_index_page_number_to_original",
       "remap_slice_pages_to_original",
   ]
   ```

2. `backend/domain/shared/tool/sr_report/index/preprocessing/__init__.py`
   ```python
   """인덱스 LLM 전 전처리: 평문 다단, 줄 번호, 오른쪽 열 보충."""
   from .sr_index_plain_text import (
       prepare_index_page_markdown_for_llm,
       build_llm_index_context_prefix,
       build_right_column_plaintext_supplement,
       normalize_dp_id_ocr_confusables,
       normalize_gri_prefixed_dp_id,
   )

   __all__ = [
       "prepare_index_page_markdown_for_llm",
       "build_llm_index_context_prefix",
       "build_right_column_plaintext_supplement",
       "normalize_dp_id_ocr_confusables",
       "normalize_gri_prefixed_dp_id",
   ]
   ```

### 수정 필요

`backend/domain/shared/tool/sr_report/mapping/__init__.py`
```python
"""도메인 매핑: raw 파싱 결과 → DB 스키마 형태 (sr_report_body)."""
from .sr_body_mapping import map_body_pages_to_sr_report_body

# sr_index_mapping은 index/mapping/으로 이동
# 하위 호환 필요시 아래 re-export 추가
# from ..index.mapping.sr_index_mapping import map_tables_to_sr_report_index

__all__ = [
    "map_body_pages_to_sr_report_body",
]
```

---

## 작업 체크리스트

### Phase 1: 파일 이동
- [ ] `hub/sr_index_page_remap.py` → `index/mapping/sr_index_page_remap.py`
- [ ] `mapping/sr_index_mapping.py` → `index/mapping/sr_index_mapping.py`
- [ ] `hub/sr_index_plain_text.py` → `index/preprocessing/sr_index_plain_text.py`

### Phase 2: `__init__.py` 정비
- [ ] `index/mapping/__init__.py` 생성
- [ ] `index/preprocessing/__init__.py` 생성
- [ ] `mapping/__init__.py` 수정 (sr_index_mapping export 제거)

### Phase 3: import 일괄 치환 (6개 파일)
- [ ] `sr_index_agent.py:25` (sr_index_page_remap)
- [ ] `test_sr_index_page_remap.py:6` (sr_index_page_remap)
- [ ] `sr_index_agent_tools.py:28` (sr_index_mapping)
- [ ] `sr_llm_review.py:99` (sr_index_plain_text)
- [ ] `test_plain_text_index_prep.py:6` (sr_index_plain_text)
- [ ] `mapping/__init__.py:5` (삭제)

### Phase 4: 순환 import 검증
- [ ] `sr_index_agent_tools.py` 지연 import 유지 확인 (라인 277, 343)
- [ ] `sr_index_plain_text.py`가 `sr_llm_review` 참조하지 않음 확인
- [ ] `python -c "from backend.domain.shared.tool.sr_report.index.mapping import *; from backend.domain.shared.tool.sr_report.index.preprocessing import *"` 실행 → 순환 없음 확인

### Phase 5: 테스트 실행
- [ ] `pytest backend/domain/v1/data_integration/tests/test_sr_index_page_remap.py`
- [ ] `pytest backend/domain/v1/data_integration/tests/test_plain_text_index_prep.py`
- [ ] 전체 SR 파이프라인 smoke test (index 추출→저장)

---

## 예상 위험 & 완화

| 위험 | 발생 시점 | 완화책 |
|------|-----------|--------|
| import 경로 누락 | Phase 3 | `rg "sr_index_page_remap\|sr_index_mapping\|sr_index_plain_text"` 전수 검색 |
| 순환 import | Phase 4 | 모듈 로드 테스트 + 지연 import 패턴 유지 검증 |
| 테스트 실패 | Phase 5 | 각 테스트 파일 import 경로 수정 후 개별 실행 |
| `mapping/__init__.py` 역호환 | Phase 2 | 기존 `from .mapping import map_tables_to_sr_report_index` 코드 전수 검색 |

---

## 최종 구조 (이동 후)

```
backend/domain/
├── shared/tool/sr_report/
│   ├── index/
│   │   ├── __init__.py
│   │   ├── multi_parser_merger.py
│   │   ├── sr_index_agent_tools.py
│   │   ├── mapping/
│   │   │   ├── __init__.py
│   │   │   ├── sr_index_mapping.py       ← 이동
│   │   │   └── sr_index_page_remap.py    ← 이동
│   │   └── preprocessing/
│   │       ├── __init__.py
│   │       └── sr_index_plain_text.py    ← 이동
│   └── mapping/
│       ├── __init__.py                    (sr_body_mapping만 export)
│       ├── sr_body_mapping.py
│       └── sr_body_toc.py
└── v1/data_integration/
    ├── hub/
    │   ├── sr_llm_review.py              (유지, import만 수정)
    │   └── orchestrator/sr_workflow.py
    └── spokes/agents/
        └── sr_index_agent.py             (import만 수정)
```

---

## 승인 후 작업 순서

1. **백업**: 변경 대상 3개 파일 별도 백업
2. **파일 이동** (Phase 1)
3. **`__init__.py` 정비** (Phase 2)
4. **import 일괄 치환** (Phase 3) - VSCode replace all 또는 `sed`
5. **순환 검증** (Phase 4) - Python 직접 로드
6. **테스트 실행** (Phase 5)
7. **커밋**: `refactor(sr-index): reorganize index files into mapping/preprocessing`

---

## 문의/검토 포인트

- [ ] `mapping/__init__.py` re-export 여부 (A안 vs B안)
- [ ] `sr_llm_review`를 `hub/`에 유지 vs `shared/tool/`로 이동 여부 (별도 논의)
- [ ] `sr_index_agent_tools.py` 지연 import 패턴 표준화 필요 여부
