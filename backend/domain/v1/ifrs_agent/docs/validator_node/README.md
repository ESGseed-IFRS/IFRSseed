# validator_node 문서

`validator_node`는 오케스트레이터 Phase 3에서 `gen_node` 출력을 검증하고, 실패 시 **`errors`를 `feedback`으로 넘겨 재생성 루프**에 참여합니다.

| 문서 | 설명 |
|------|------|
| [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) | 계약 정리, 단계별 구현 로드맵, 실수 방지·유연한 설계 가이드 |
| [LOGIC_SPEC.md](./LOGIC_SPEC.md) | **로직 구현서** — 파일 배치, 함수·파이프라인, 규칙/LLM 단계, 반환 스키마까지 바로 코딩 가능한 명세 |
| [ACCURACY_FEEDBACK_DESIGN.md](./ACCURACY_FEEDBACK_DESIGN.md) | **정확도·구조화 피드백 확장** — 로직 설계(판단 축, 응답 모델, 원칙, 비목표) |
| [ACCURACY_FEEDBACK_IMPLEMENTATION.md](./ACCURACY_FEEDBACK_IMPLEMENTATION.md) | 동 확장의 **구현서** — 파일별 변경, 병합 알고리즘, 테스트, 플래그 |

구현 위치: `backend/domain/v1/ifrs_agent/spokes/agents/validator_node/`  
등록: `hub/bootstrap.py`에서 `make_validator_node_handler(infra)`로 등록.
