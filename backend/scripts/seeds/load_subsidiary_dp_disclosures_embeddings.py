"""generate_subsidiary_dp_disclosures.json → subsidiary_data_contributions (BGE-M3 임베딩).

일회용/반복 적재용. ``load_subsidiary_data_contributions_dummy.py`` 와 동일한 INSERT·임베딩 파이프라인을 사용하며,
기본 JSON 경로만 ``generate_subsidiary_dp_disclosures.json`` 으로 둡니다.

JSON 의 ``id`` 가 UUID 가 아니면(예: ``dp-disclosure-001-mc``) 동일 문자열에 대해 항상 같은
UUID 가 되도록 ``uuid5`` 로 정규화합니다(재실행 시 ON CONFLICT 로 동일 행 갱신).

사전 조건: DATABASE_URL, companies 에 JSON 의 company_id 존재, 마이그레이션 037 적용.
임베딩: EMBEDDING_MODEL (기본 BAAI/bge-m3), FlagEmbedding 또는 sentence-transformers.

실행 예:
    python backend/scripts/seeds/load_subsidiary_dp_disclosures_embeddings.py
    python backend/scripts/seeds/load_subsidiary_dp_disclosures_embeddings.py --dry-run
    python backend/scripts/seeds/load_subsidiary_dp_disclosures_embeddings.py --no-embed
    python backend/scripts/seeds/load_subsidiary_dp_disclosures_embeddings.py --truncate
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import uuid
from pathlib import Path
from typing import Any

from psycopg2.extras import execute_batch

import load_subsidiary_data_contributions_dummy as base

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_JSON = SCRIPT_DIR / "generate_subsidiary_dp_disclosures.json"

# 동일 비UUID id 문자열 → 항상 같은 UUID (재적재·갱신용)
_ROW_ID_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "IFRSseed/subsidiary_dp_disclosures/v1")

logger = logging.getLogger(__name__)


def _normalize_row_id(raw: Any) -> str:
    if raw is None:
        raise ValueError("JSON 행에 id 가 없습니다.")
    s = str(raw).strip()
    if not s:
        raise ValueError("JSON 행 id 가 비어 있습니다.")
    try:
        return str(uuid.UUID(s))
    except ValueError:
        return str(uuid.uuid5(_ROW_ID_NAMESPACE, s))


def _rows_with_uuid_ids(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for r in rows:
        rid = r.get("id")
        normalized = _normalize_row_id(rid)
        if normalized != str(rid):
            logger.debug("id 정규화: %s → %s", rid, normalized)
        row = dict(r)
        row["id"] = normalized
        out.append(row)
    return out


def main() -> int:
    base._configure_logging()
    p = argparse.ArgumentParser(
        description="generate_subsidiary_dp_disclosures.json → subsidiary_data_contributions (임베딩)"
    )
    p.add_argument(
        "--json-path",
        type=Path,
        default=DEFAULT_JSON,
        help=f"기본: {DEFAULT_JSON}",
    )
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--no-embed", action="store_true")
    p.add_argument(
        "--embed-batch-size",
        type=int,
        default=int(os.getenv("SUBS_SEED_EMBED_BATCH_SIZE", "32")),
        help="임베딩 배치 크기 (기본 32, 환경변수 SUBS_SEED_EMBED_BATCH_SIZE)",
    )
    p.add_argument("--truncate", action="store_true")
    args = p.parse_args()

    path = args.json_path.resolve()
    rows = base.load_rows(path)
    rows = _rows_with_uuid_ids(rows)

    model_name = (os.getenv("EMBEDDING_MODEL") or "BAAI/bge-m3").strip()
    logger.info("JSON %s 행 수: %s (id UUID 정규화 완료), 임베딩 모델: %s", path.name, len(rows), model_name)

    if args.dry_run:
        logger.info("dry-run: 임베딩·DB 쓰기 생략")
        return 0

    cat_lit: dict[str | None, str | None] = {None: None}
    desc_lits: list[str | None] = [None] * len(rows)

    if not args.no_embed:
        embedder, mtype = base.load_embedding_model(model_name)
        cat_lit, desc_lits = base.build_embedding_maps(
            rows,
            embedder,
            mtype,
            batch_size=max(1, args.embed_batch_size),
        )

    batch = [base.row_to_tuple(r, cat_lit, desc_lits[i]) for i, r in enumerate(rows)]

    conn = base._connect()
    try:
        with conn:
            with conn.cursor() as cur:
                if args.truncate:
                    cur.execute("TRUNCATE TABLE subsidiary_data_contributions")
                    logger.info("TRUNCATE subsidiary_data_contributions 완료")
                execute_batch(cur, base.INSERT_SQL, batch, page_size=50)
        logger.info("적재 완료: %s 행 (ON CONFLICT 시 갱신)", len(batch))
    except base.psycopg2.Error as e:
        logger.exception("DB 오류: %s", e)
        return 1
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
