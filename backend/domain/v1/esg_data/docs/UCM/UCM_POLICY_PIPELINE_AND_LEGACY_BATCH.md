# UCM 정책 파이프라인(5단계)과 레거시 배치 경로

소스 `data_point` 한 건을 기준으로 **`UCMOrchestrator.run_ucm_policy_pipeline`** 및 구조가 동일한 **`run_ucm_nearest_pipeline`** 내부 흐름을 정리한다.  
상위 맥락은 [architecture.md](../architecture.md). FastAPI에서 `ucm_router`가 `prefix="/esg-data"` 아래에 마운트되므로 전체 경로는 **`POST /esg-data/ucm/pipeline/policy`** · **`POST /esg-data/ucm/pipeline/nearest`** 이다 (`main.py`의 `include_router`).

---

## 1. 적용 범위

| 오케스트레이터 메서드 | 차이 |
|----------------------|------|
| `run_ucm_policy_pipeline` | `source_standard` / `target_standard`로 타깃 표준을 고정해 후보를 찾는다. |
| `run_ucm_nearest_pipeline` | 표준 입력 없이, 임베딩 단계에서 `target_standard=None` 등으로 **다른 기준서 쪽 최근접** 후보를 쓴다. |

두 메서드 모두 **동일한 5단계 도구 체인**(임베딩 → 규칙 → 판정·조립 → 페이로드 → 저장)을 따른다.  
문서상 원래 6분절(임베딩 → 규칙 → 선택 LLM → 정책 → 페이로드 → upsert) 중, **LLM·정책 판정을 하나의「3단계: 판정」**으로 묶어 5단계로 표기한다.

---

## 2. 소스 DP 한 건당 5단계

### 2.1 1단계 — 임베딩·구조 점수로 후보 추출

**구성요소:** `EmbeddingCandidateTool.run(...)`

- DB 세션과 `mapping_service`로 소스 `dp_id`에 대해 타깃 표준(또는 nearest에서는 `target_standard=None`) 쪽 **후보 리스트**를 만든다.
- 벡터 유사도·구조 점수 등으로 **hybrid_score**가 붙은 `candidates`가 반환된다.

```260:269:backend/domain/v1/esg_data/hub/orchestrator/ucm_orchestrator.py
                emb = embedding_tool.run(
                    db,
                    self.mapping_service,
                    source_dp_id=src_id,
                    target_standard=target_standard,
                    top_k=top_k,
                    vector_threshold=vector_threshold,
                    structural_threshold=structural_threshold,
                    final_threshold=final_threshold,
                )
```

(`run_ucm_nearest_pipeline` 루프에서는 같은 호출에 `target_standard=None`이 넘어간다.)

---

### 2.2 2단계 — 규칙 검증(후보별)

**구성요소:** `RuleValidationTool.run(...)`

- 1단계의 `candidates`에 대해 룰북·요건 관점의 점수·위반을 붙인 `per_candidate`를 만든다.

```282:287:backend/domain/v1/esg_data/hub/orchestrator/ucm_orchestrator.py
                rv = rule_tool.run(
                    db,
                    self.mapping_service,
                    source_dp_id=src_id,
                    candidates=emb["candidates"],
                )
```

---

### 2.3 3단계 — 최적 쌍 선택 + (선택) LLM + 정책 최종 판정

- `UCMCreationAgent.policy_pick_best`로 후보·규칙 행 **한 쌍** `(candidate, rule_row)`를 고른다.
- `use_llm_in_mapping_service`가 참이고 `ucm_policy.should_call_llm`이 참이면 `llm_refinement`를 호출한다.
- `policy_finalize_decision`으로 **accept / review / reject**와 confidence 등 **최종 decision**을 확정한다.

```300:341:backend/domain/v1/esg_data/hub/orchestrator/ucm_orchestrator.py
                best = self.creation_agent.policy_pick_best(emb["candidates"], rv["per_candidate"])
                if best is None:
                    decision = {"decision": "reject", "confidence": 0.0, "reason_codes": ["no_valid_pair"]}
                    stats["reject"] += 1
                    items.append({"source_dp_id": src_id, "decision": decision})
                    continue

                candidate, rule_row = best
                tentative = ucm_policy.tentative_decision_from_scores(
                    ucm_policy.compute_final_score(
                        float(candidate["hybrid_score"]),
                        float(rule_row["rule_score"]),
                        float(rule_row["structure_score"]),
                        float(rule_row["requirement_score"]),
                        ucm_policy.compute_penalty(rule_row["violations"]),
                    ),
                    any(v["severity"] == "critical" for v in rule_row["violations"]),
                )
                llm_result = None
                if use_llm_in_mapping_service and ucm_policy.should_call_llm(
                    float(candidate["hybrid_score"]),
                    bool(rule_row["rule_pass"]),
                    tentative,
                ):
                    llm_result = self.creation_agent.llm_refinement(
                        {
                            "source_dp_id": src_id,
                            "target_dp_id": candidate["target_dp_id"],
                            "candidate": candidate,
                            "rule_row": rule_row,
                            "tentative_decision": tentative,
                            "model": llm_model,
                        }
                    )

                decision = self.creation_agent.policy_finalize_decision(
                    source_dp_id=src_id,
                    candidate=candidate,
                    rule_row=rule_row,
                    llm_result=llm_result,
                    policy_version="ucm_pipeline_v1",
                )
```

---

### 2.4 4단계 — UCM 행 페이로드 조립

**구성요소:** `SchemaMappingTool.build_payload(...)`

- 소스·타깃 `DataPoint` 행, `decision`, (가능하면) `primary_rulebook_id`로 **`unified_column_mappings`에 넣을 dict**를 만든다.

```365:370:backend/domain/v1/esg_data/hub/orchestrator/ucm_orchestrator.py
                payload_result = schema_tool.build_payload(
                    source_dp=source,
                    target_dp=target,
                    decision=decision,
                    primary_rulebook_id=_primary_rulebook_id_for_dp(db, src_id),
                )
```

---

### 2.5 5단계 — DB 저장(upsert)

**구성요소:** `UCMMappingService.upsert_ucm_from_payload`

- `dry_run=True`이면 저장을 하지 않고 스킵한다.
- `persist_mode == "per_item"`이면 **해당 건마다** 즉시 upsert한다.
- `persist_mode == "batch_end"`이면 루프 안에서는 `_batch_payload`로만 모았다가, **루프 종료 후** 각 건마다 upsert한다.

```374:414:backend/domain/v1/esg_data/hub/orchestrator/ucm_orchestrator.py
                if payload_result["status"] == "success":
                    if dry_run:
                        upsert_result = {"status": "skipped", "message": "dry_run"}
                    elif persist_mode == "per_item":
                        upsert_result = self.mapping_service.upsert_ucm_from_payload(payload_result["payload"])
                        if upsert_result.get("status") == "success":
                            stats["upsert_ok"] += 1
                        else:
                            stats["upsert_error"] += 1
                            stats["errors"] += 1
                    else:
                        batch_payload = payload_result["payload"]
                        upsert_result = {"status": "pending", "message": "batch_end"}
                else:
                    stats["errors"] += 1
                ...
            if persist_mode == "batch_end" and not dry_run:
                for it in items:
                    pl = it.pop("_batch_payload", None)
                    if pl is None:
                        continue
                    upsert_result = self.mapping_service.upsert_ucm_from_payload(pl)
                    it["upsert_result"] = upsert_result
                    if upsert_result.get("status") == "success":
                        stats["upsert_ok"] += 1
                    else:
                        stats["upsert_error"] += 1
                        stats["errors"] += 1
```

---

## 3. 레거시 배치형 생성이란

코드·주석상 **「레거시 equivalent_dps 배치 매핑」**은 과거 `MappingSuggestionService` 등으로 소스·타깃 표준 간 UCM을 **한 번에(batch)** 채우던 경로를 가리킨다.  
현재는 그 **구현 본문이 제거**되어 있고, MCP 툴 이름과 에이전트 진입 메서드만 남아 있다.

### 3.1 호출 체인(의도된 경로)

1. **진입:** `run_ucm_workflow`의 생성 노드 → `UCMCreationAgent.create_mappings` / `acreate_mappings`, 또는 MCP에서 `create_unified_column_mapping` 직접 호출.
2. **에이전트:** 임베딩·룰 툴을 직접 쓰지 않고 `DirectEsgToolRuntime.call_tool("create_unified_column_mapping", {...})`만 호출한다.

```126:148:backend/domain/v1/esg_data/spokes/agents/ucm_creation_agent.py
    def create_mappings(
        self,
        source_standard: str,
        target_standard: str,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        batch_size: int = 40,
        dry_run: bool = False,
    ) -> UCMWorkflowCreateResult:
        """레거시 equivalent_dps 배치 매핑 — MCP 툴 `create_unified_column_mapping`과 동일 경로."""
        return self._tool_runtime.call_tool(
            "create_unified_column_mapping",
            {
                "source_standard": source_standard,
                "target_standard": target_standard,
                "vector_threshold": vector_threshold,
                "structural_threshold": structural_threshold,
                "final_threshold": final_threshold,
                "batch_size": batch_size,
                "dry_run": dry_run,
            },
        )
```

3. **MCP 툴 핸들러:** `handle_create_unified_column_mapping` → `UCMMappingService.create_mappings(...)`.

```10:30:backend/domain/v1/esg_data/spokes/infra/esg_ucm_tool_handlers.py
def handle_create_unified_column_mapping(
    *,
    _mapping_service: UCMMappingService | None = None,
    source_standard: str,
    target_standard: str,
    vector_threshold: float = 0.70,
    structural_threshold: float = 0.50,
    final_threshold: float = 0.75,
    batch_size: int = 40,
    dry_run: bool = False,
) -> dict[str, Any]:
    svc = _mapping_service or UCMMappingService()
    return svc.create_mappings(
        source_standard=source_standard,
        target_standard=target_standard,
        vector_threshold=vector_threshold,
        structural_threshold=structural_threshold,
        final_threshold=final_threshold,
        batch_size=batch_size,
        dry_run=dry_run,
    )
```

4. **서비스(현재 실제 동작):** `create_mappings`는 경고 로그 후 **항상 `status: "error"`**를 반환한다. 메시지에 배치 제거 및 esg_data 쪽 하이브리드 매핑 재연결 안내가 있다.

```26:42:backend/domain/v1/esg_data/hub/services/ucm_mapping_service.py
    def create_mappings(
        self,
        source_standard: str,
        target_standard: str,
        vector_threshold: float = 0.70,
        structural_threshold: float = 0.50,
        final_threshold: float = 0.75,
        batch_size: int = 40,
        dry_run: bool = False,
    ) -> UCMWorkflowCreateResult:
        logger.warning(_MAPPING_BATCH_REMOVED_MSG)
        return {
            "status": "error",
            "message": _MAPPING_BATCH_REMOVED_MSG,
            "source_standard": source_standard,
            "target_standard": target_standard,
        }
```

`acreate_mappings`가 원격 MCP에서 툴을 찾지 못해 `mapping_service.create_mappings`로 폴백할 때도 **동일한 스텁 결과**가 된다.

---

## 4. 정책 파이프라인 vs 레거시 배치

| 구분 | 레거시 배치 경로 | 정책 파이프라인 (`run_ucm_policy_pipeline` / nearest) |
|------|------------------|--------------------------------------------------------|
| 진입 | 툴 `create_unified_column_mapping` / 에이전트 `create_mappings` | 오케스트레이터가 직접 소스 행 루프 |
| 임베딩·룰·스키마 툴 | 이 경로 안에서는 사용하지 않음(배치 구현 제거됨) | `EmbeddingCandidateTool` → `RuleValidationTool` → `SchemaMappingTool` |
| DB 저장 | 원래는 배치 생성 내부에서 처리(현재는 에러만) | `upsert_ucm_from_payload` |

---

## 5. 한 줄 요약

- **정책(nearest) 파이프라인:** 오케스트레이터가 **공유 UCM 툴 3종 + 정책/선택 LLM + upsert**로 한 건씩(또는 batch_end 모드로 모아서) DB에 반영한다.
- **레거시 배치:** 설계상 MCP 툴 + `UCMMappingService.create_mappings` 한 방이었으나, **현재는 스텁**이므로 실데이터 반영은 **정책 파이프라인 쪽**을 사용해야 한다.

---

**작성:** 구현 기준 스냅샷. 줄 번호는 리팩터 시 [ucm_orchestrator.py](../../hub/orchestrator/ucm_orchestrator.py) 등과 함께 갱신할 것.
