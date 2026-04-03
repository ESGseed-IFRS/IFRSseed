# 스테이징 수집(Staging Ingestion) 보강 사항

추후 확정성을 위해, 현재 스테이징 수집 로직의 개선·보강 포인트를 정리한 문서입니다.

---

## 1. 현재 구조 요약

- **API**: `POST /data-integration/staging/ingest`  
  Body: `{ "base_path": "...", "company_id": "uuid", "systems": ["ems", "erp", ...] }`
- **데이터 소스**: `base_path` 아래 `EMS/`, `ERP/`, … 폴더의 `*.csv` 파일 (로컬 디스크)
- **파싱**: CSV → `{"items": [...], "source_file": "파일명"}` (문서 ETL `raw_data->'items'` 호환)
- **저장**: `StagingRepository.save(system, company_id, raw_data, ...)` → `staging_*_data` 6개 테이블

저장 레이어(`raw_data` JSONB)는 **데이터 출처(CSV/API)에 무관**하게 동작합니다.

---

## 2. 보안

| 항목 | 현황 | 보강 방안 |
|------|------|------------|
| **base_path 검증** | 클라이언트가 임의 경로 전달 시 해당 경로의 파일을 서버가 읽음 | 허용 루트(예: `SDS_ESG_DATA` 전용 디렉터리)를 설정하고, `Path(base_path).resolve()`가 그 하위인지 검사. 아니면 400 반환 |
| **경로 조작** | `../` 등으로 다른 디렉터리 접근 가능성 | 위 허용 루트 하위 검사로 차단 |
| **인증/권한** | 스테이징 수집 API에 인증·역할 제어 미구현 가능 | 운영 시 API Gateway 또는 미들웨어에서 인증·권한 처리 권장 |

---

## 3. 안정성·동작 방식

| 항목 | 현황 | 보강 방안 |
|------|------|------------|
| **대용량 CSV** | `list(reader)`로 전체를 메모리에 로드 | 파일/요청당 행 수 상한 또는 스트리밍·청크 처리 검토 |
| **요청당 크기** | 파일 수·총 행 수 제한 없음 | 파일 수·총 행 수 상한 설정으로 DoS 완화 |
| **재실행(idempotency)** | 동일 `base_path` + `company_id`로 재호출 시 매번 **추가** insert | 정책에 따라 “같은 회사·기간이면 기존 삭제 후 재적재” 옵션(예: `replace: true`) 및 해당 로직 추가 검토 |

---

## 4. 확장성(API 등 다른 소스)

| 항목 | 현황 | 보강 방안 |
|------|------|------------|
| **데이터 소스** | 로컬 CSV 전용 (경로 + 파일 시스템에 결합) | Fetcher 추상화: `(system, company_id) → raw_data` 반환. 구현체: `CsvFetcher`(현재), `ApiFetcher`(추후). 서비스는 `raw_data`만 받아 기존 `repo.save()` 호출 |
| **raw_data 검증** | DB 저장 전 형식 검증 없음 | `items`가 리스트인지, 요소가 dict인지 등 최소 검증 후 저장하여 잘못된 API 응답·파싱 오류 조기 차단 |

---

## 5. 운영·관리

| 항목 | 현황 | 보강 방안 |
|------|------|------------|
| **실패 상세** | 일부 파일만 실패해도 `success: true`, 상세는 로그에만 존재 | 응답에 `failed_files: [{ "file": "...", "error": "..." }]` 등 실패 목록 포함 |
| **company_id 검증** | UUID 형식만 검사, DB에 해당 company 존재 여부는 미검사 | 선택적으로 company 존재 여부 조회 후 없으면 400/404 반환하여 데이터 정합성 확보 |

---

## 6. 우선 적용 권장

1. **base_path 허용 루트 제한** (보안)
2. **(선택) company_id 존재 여부 검사**
3. **(선택) 실패한 파일 목록을 응답에 포함**

나머지는 API 연동, 대용량·재실행 정책 등 요구가 생길 때 단계적으로 반영하면 됩니다.

---

## 7. 참고 파일

- 서비스: `backend/domain/v1/data_integration/hub/services/staging_ingestion_service.py`
- 리포지토리: `backend/domain/v1/data_integration/hub/repositories/staging_repository.py`
- 오케스트레이터: `backend/domain/v1/data_integration/hub/orchestrator/staging_orchestrator.py`
- API: `backend/api/v1/data_integration/staging_router.py`
- 테이블 정의: `backend/domain/v1/ifrs_agent/docs/DATABASE_TABLES_STRUCTURE.md` (옵션 1: 스테이징 테이블 패턴)
