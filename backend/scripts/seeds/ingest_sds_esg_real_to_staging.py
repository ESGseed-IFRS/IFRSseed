"""
SDS_ESG_DATA_REAL/{holding|subsidiary}_{회사명} 폴더의 CSV → staging_* 테이블 일괄 적재.

Scope 산정은 디스크 CSV를 읽지 않고 DB(스테이징·배출계수)만 사용하므로,
데모/로컬에서는 이 스크립트(또는 POST /data-integration/staging/ingest)로
먼저 스테이징에 넣은 뒤 재계산을 실행합니다.

실행 (저장소 루트에서):
  python backend/scripts/seeds/ingest_sds_esg_real_to_staging.py
"""

from __future__ import annotations

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from sqlalchemy import text  # noqa: E402

from backend.core.db import get_session  # noqa: E402
from backend.domain.v1.data_integration.hub.orchestrator.staging_orchestrator import (  # noqa: E402
    StagingIngestionOrchestrator,
)


def main() -> None:
    backend_dir = Path(__file__).resolve().parents[2]
    data_root = backend_dir / "SDS_ESG_DATA_REAL"
    if not data_root.is_dir():
        print(f"[SKIP] 폴더 없음: {data_root}")
        return

    orch = StagingIngestionOrchestrator()
    session = get_session()
    try:
        rows = session.execute(
            text("SELECT id::text AS cid, name, parent_company_id FROM companies ORDER BY name")
        ).mappings().all()
    finally:
        session.close()

    total_ingested = 0
    for r in rows:
        cid = r["cid"]
        name = (r["name"] or "").strip()
        parent = r["parent_company_id"]
        if not name:
            continue
        subdir = f"holding_{name}" if parent is None else f"subsidiary_{name}"
        company_base = data_root / subdir
        if not company_base.is_dir():
            continue
        print(f"[INGEST] {subdir} → company_id={cid}")
        result = orch.execute(company_base, cid, None)
        total_ingested += int(result.get("total_rows_imported") or 0)
        print(f"         rows={result.get('total_rows_imported')}, success={result.get('success')}")

    print(f"[DONE] 총 스테이징 행(파일 단위 합계): {total_ingested}")


if __name__ == "__main__":
    main()
