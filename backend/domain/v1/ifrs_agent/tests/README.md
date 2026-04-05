# IFRS 에이전트 통합 테스트

## 실행 방법

### 전체 테스트 실행

```bash
cd backend
pytest domain/v1/ifrs_agent/tests/ -v
```

### 특정 테스트만 실행

```bash
# DP 라우팅 테스트
pytest domain/v1/ifrs_agent/tests/test_orchestrator_dp_routing_integration.py -v

# 특정 시나리오만
pytest domain/v1/ifrs_agent/tests/test_orchestrator_dp_routing_integration.py::test_quantitative_dp_routing -v
```

### 수동 실행 (pytest 없이)

```bash
cd backend
python -m domain.v1.ifrs_agent.tests.test_orchestrator_dp_routing_integration
```

---

## 사전 준비

### 1. DB 마이그레이션

```bash
cd backend
alembic upgrade head
```

### 2. 시드 데이터 적재

```bash
# 회사·사용자 정보
python backend/domain/v1/ifrs_agent/data/login/load_login_seed_data.py

# Governance 데이터
python backend/scripts/seeds/load_governance_data_dummy.py

# 계열사 데이터
python backend/scripts/seeds/load_subsidiary_data_contributions_dummy.py

# SR 본문·이미지 (data_integration 쪽)
# TODO: SR 샘플 적재 스크립트
```

### 3. 환경 변수

`.env` 파일:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/ifrs_agent
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key  # c_rag LLM 재선택용
```

---

## 테스트 시나리오

| 테스트 | 설명 | 검증 항목 |
|--------|------|----------|
| `test_quantitative_dp_routing` | 정량 DP 라우팅 체크 | `is_quantitative=True` |
| `test_qualitative_dp_routing_ucm` | 정성 DP (UCM) 라우팅 | `is_quantitative=False` |
| `test_qualitative_dp_routing_data_points` | 정성 DP (data_points) 라우팅 | `dp_type=qualitative` |
| `test_parallel_collect_with_quantitative_dp` | 정량 DP 전체 수집 | `fact_data.value` 존재 |
| `test_parallel_collect_with_qualitative_dp` | 정성 DP 전체 수집 | `narrative_data` 존재 |
| `test_gen_node_with_fact_data` | gen_node 수치 처리 | 텍스트에 value 포함 |
| `test_gen_node_with_narrative_data` | gen_node 서술 처리 | 텍스트에 SR 본문 포함 |
| `test_gen_node_with_suitability_warning` | gen_node 경고 처리 | 텍스트에 "주의" 포함 |
| `test_e2e_create_with_quantitative_dp` | E2E (정량) | orchestrate 성공 |
| `test_e2e_create_with_qualitative_dp` | E2E (정성) | orchestrate 성공 |

---

## 알려진 제한사항

1. **aggregation_node 스텁**: 계열사·외부 데이터 빈 dict 반환.
2. **gen_node 스텁**: 간단한 텍스트만 생성 (실제 LLM 프롬프트 필요).
3. **validator_node 스텁**: 항상 통과.
4. **SR 본문·이미지**: 시드 데이터 필요 (현재 스크립트 미완 가능성).

---

## 다음 단계

- [ ] 실 DB 환경에서 전체 테스트 실행
- [ ] 실패 케이스 디버깅
- [ ] gen_node 실구현 (Gemini 프롬프트)
- [ ] aggregation_node 실구현
- [ ] validator_node 실구현

---

**최종 수정**: 2026-04-05
