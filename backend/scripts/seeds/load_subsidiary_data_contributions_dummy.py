"""subsidiary_data_contributions_dummy.json → PostgreSQL subsidiary_data_contributions 일회 적재.

스키마: alembic 037_subs_ext_company_data. JSON의 contributor_company_id 는 DB 컬럼이 없어 무시.

임베딩: 프로젝트 기본과 동일하게 BGE-M3 (``EMBEDDING_MODEL`` / 기본 ``BAAI/bge-m3``, 1024차원 pgvector).
``load_ifrs_2_datapoint_rulebook_embeddings.py`` 와 같은 방식으로 FlagEmbedding 우선, 실패 시 sentence-transformers.

사전 조건: DATABASE_URL, companies 에 JSON 내 company_id 존재, 마이그레이션 037 적용.
임베딩 적재 시: sentence-transformers 또는 FlagEmbedding + torch (backend/requirement.txt).

실행 예:
    python backend/scripts/seeds/load_subsidiary_data_contributions_dummy.py
    python backend/scripts/seeds/load_subsidiary_data_contributions_dummy.py --dry-run
    python backend/scripts/seeds/load_subsidiary_data_contributions_dummy.py --no-embed
    python backend/scripts/seeds/load_subsidiary_data_contributions_dummy.py --truncate
    python backend/scripts/seeds/load_subsidiary_data_contributions_dummy.py --json-path "C:/Users/.../subsidiary_data_contributions.json"
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any, Sequence

import numpy as np
import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import Json, execute_batch

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent.parent

for candidate in (REPO_ROOT / ".env", SCRIPT_DIR.parent.parent / ".env"):
    if candidate.exists():
        load_dotenv(candidate)
        break

logger = logging.getLogger(__name__)

DEFAULT_JSON = SCRIPT_DIR / "subsidiary_data_contributions_dummy.json"

INSERT_SQL = """
INSERT INTO subsidiary_data_contributions (
    id,
    company_id,
    subsidiary_name,
    facility_name,
    report_year,
    category,
    category_embedding,
    description,
    description_embedding,
    related_dp_ids,
    quantitative_data,
    data_source,
    submitted_by,
    submission_date
) VALUES (
    %s::uuid,
    %s::uuid,
    %s,
    %s,
    %s,
    %s,
    %s::vector,
    %s,
    %s::vector,
    %s,
    %s,
    %s,
    %s,
    %s
)
ON CONFLICT (id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    subsidiary_name = EXCLUDED.subsidiary_name,
    facility_name = EXCLUDED.facility_name,
    report_year = EXCLUDED.report_year,
    category = EXCLUDED.category,
    category_embedding = EXCLUDED.category_embedding,
    description = EXCLUDED.description,
    description_embedding = EXCLUDED.description_embedding,
    related_dp_ids = EXCLUDED.related_dp_ids,
    quantitative_data = EXCLUDED.quantitative_data,
    data_source = EXCLUDED.data_source,
    submitted_by = EXCLUDED.submitted_by,
    submission_date = EXCLUDED.submission_date,
    updated_at = now()
"""


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(message)s",
        datefmt="%H:%M:%S",
    )


def _connect():
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise SystemExit("DATABASE_URL 이 비어 있습니다. .env 또는 환경 변수를 설정하세요.")
    return psycopg2.connect(url)


def _truncate_field(value: str | None, max_len: int) -> str | None:
    if value is None:
        return None
    s = str(value)
    return s if len(s) <= max_len else s[:max_len]


def _parse_submission_date(raw: str | None) -> date | None:
    if not raw:
        return None
    return date.fromisoformat(str(raw).strip()[:10])


def _norm_text(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def _vector_literal(embedding: Sequence[float]) -> str:
    return "[" + ",".join(str(float(x)) for x in embedding) + "]"


def load_embedding_model(model_name: str):
    try:
        from FlagEmbedding import FlagModel

        embedder = FlagModel(model_name, use_fp16=True)
        logger.info("임베딩: FlagEmbedding(%s)", model_name)
        return embedder, "flag"
    except Exception as e:
        logger.warning("FlagEmbedding 로드 실패: %s", e)
    try:
        from sentence_transformers import SentenceTransformer

        embedder = SentenceTransformer(model_name)
        logger.info("임베딩: sentence-transformers(%s)", model_name)
        return embedder, "sentence"
    except Exception as e:
        logger.warning("sentence-transformers 로드 실패: %s", e)
    raise RuntimeError(
        "임베딩 모델을 불러올 수 없습니다. FlagEmbedding 또는 sentence-transformers 설치 후 재시도하거나 "
        "`--no-embed` 로 스킵하세요."
    )


def _normalize_vec(emb: Any) -> list[float]:
    if isinstance(emb, np.ndarray):
        v = emb.astype(np.float64)
        n = np.linalg.norm(v)
        if n > 0:
            v = v / n
        return v.tolist()
    v = np.array(emb, dtype=np.float64)
    n = np.linalg.norm(v)
    if n > 0:
        v = v / n
    return v.tolist()


def embedding_vector(embedder: Any, model_type: str, text: str) -> list[float]:
    if model_type == "flag":
        raw = embedder.encode([text])
        if hasattr(raw, "ndim") and raw.ndim > 1:
            emb = raw[0]
        else:
            emb = raw[0] if len(raw) > 0 else raw
    elif model_type == "sentence":
        emb = embedder.encode(text, normalize_embeddings=True, show_progress_bar=False)
    else:
        raise ValueError(model_type)
    return _normalize_vec(emb)


def embed_texts_batched(
    embedder: Any,
    model_type: str,
    texts: list[str],
    *,
    batch_size: int,
) -> list[list[float]]:
    if not texts:
        return []
    out: list[list[float]] = []
    for start in range(0, len(texts), batch_size):
        chunk = texts[start : start + batch_size]
        if model_type == "flag":
            raw = embedder.encode(chunk)
            if hasattr(raw, "ndim") and raw.ndim == 2:
                for i in range(raw.shape[0]):
                    out.append(_normalize_vec(raw[i]))
            else:
                for row in raw:
                    out.append(_normalize_vec(row))
        elif model_type == "sentence":
            embs = embedder.encode(
                chunk,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            for i in range(len(chunk)):
                out.append(_normalize_vec(embs[i]))
        else:
            raise ValueError(model_type)
    return out


def build_embedding_maps(
    rows: list[dict[str, Any]],
    embedder: Any,
    model_type: str,
    *,
    batch_size: int,
) -> tuple[dict[str | None, str | None], list[str | None]]:
    """category 문자열 → pgvector 리터럴(또는 None), 행 순서별 description 임베딩 리터럴(또는 None)."""
    unique_cats: list[str] = []
    seen: set[str] = set()
    for r in rows:
        c = _norm_text(r.get("category"))
        if c is None:
            continue
        if c not in seen:
            seen.add(c)
            unique_cats.append(c)

    cat_vec_lit: dict[str | None, str | None] = {None: None}
    if unique_cats:
        logger.info("category 임베딩: 고유 %s건, batch_size=%s", len(unique_cats), batch_size)
        vecs = embed_texts_batched(embedder, model_type, unique_cats, batch_size=batch_size)
        for c, v in zip(unique_cats, vecs, strict=True):
            cat_vec_lit[c] = _vector_literal(v)

    desc_literals: list[str | None] = []
    nonempty_idx: list[int] = []
    nonempty_texts: list[str] = []
    for i, r in enumerate(rows):
        d = _norm_text(r.get("description"))
        if d is None:
            desc_literals.append(None)
        else:
            desc_literals.append("")  # placeholder
            nonempty_idx.append(i)
            nonempty_texts.append(d)

    if nonempty_texts:
        logger.info("description 임베딩: %s건, batch_size=%s", len(nonempty_texts), batch_size)
        vecs = embed_texts_batched(embedder, model_type, nonempty_texts, batch_size=batch_size)
        for idx, v in zip(nonempty_idx, vecs, strict=True):
            desc_literals[idx] = _vector_literal(v)

    return cat_vec_lit, desc_literals


def row_to_tuple(
    row: dict[str, Any],
    cat_vec_lit: dict[str | None, str | None],
    desc_lit: str | None,
) -> tuple[Any, ...]:
    related = row.get("related_dp_ids") or []
    if not isinstance(related, list):
        related = list(related) if related else []
    qd = row.get("quantitative_data")
    cat_key = _norm_text(row.get("category"))
    return (
        row["id"],
        row["company_id"],
        _truncate_field(row.get("subsidiary_name"), 200),
        _truncate_field(row.get("facility_name"), 200),
        int(row["report_year"]),
        row.get("category"),
        cat_vec_lit.get(cat_key),
        row.get("description"),
        desc_lit,
        related,
        Json(qd) if qd is not None else None,
        _truncate_field(row.get("data_source"), 100),
        _truncate_field(row.get("submitted_by"), 200),
        _parse_submission_date(row.get("submission_date")),
    )


def load_rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"JSON 없음: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("JSON 최상위는 객체 배열이어야 합니다.")
    return data


def main() -> int:
    _configure_logging()
    p = argparse.ArgumentParser(description="subsidiary_data_contributions JSON DB 적재 (BGE-M3 임베딩 옵션)")
    p.add_argument(
        "--json-path",
        type=Path,
        default=DEFAULT_JSON,
        help=f"기본: {DEFAULT_JSON}",
    )
    p.add_argument("--dry-run", action="store_true", help="DB 쓰기·임베딩 생략, JSON 행 수만 확인")
    p.add_argument(
        "--no-embed",
        action="store_true",
        help="category_embedding / description_embedding 을 NULL 로 적재",
    )
    p.add_argument(
        "--embed-batch-size",
        type=int,
        default=int(os.getenv("SUBS_SEED_EMBED_BATCH_SIZE", "32")),
        help="임베딩 배치 크기 (기본 32, 환경변수 SUBS_SEED_EMBED_BATCH_SIZE)",
    )
    p.add_argument(
        "--truncate",
        action="store_true",
        help="적재 전 subsidiary_data_contributions 전체 삭제(TRUNCATE)",
    )
    args = p.parse_args()
    path = args.json_path.resolve()
    rows = load_rows(path)
    model_name = (os.getenv("EMBEDDING_MODEL") or "BAAI/bge-m3").strip()
    logger.info("JSON %s 행 수: %s, 임베딩 모델: %s", path.name, len(rows), model_name)

    if args.dry_run:
        logger.info("dry-run: 임베딩·DB 쓰기 생략")
        return 0

    cat_lit: dict[str | None, str | None] = {None: None}
    desc_lits: list[str | None] = [None] * len(rows)

    if not args.no_embed:
        embedder, mtype = load_embedding_model(model_name)
        cat_lit, desc_lits = build_embedding_maps(
            rows,
            embedder,
            mtype,
            batch_size=max(1, args.embed_batch_size),
        )

    batch = [
        row_to_tuple(r, cat_lit, desc_lits[i])
        for i, r in enumerate(rows)
    ]

    conn = _connect()
    try:
        with conn:
            with conn.cursor() as cur:
                if args.truncate:
                    cur.execute("TRUNCATE TABLE subsidiary_data_contributions")
                    logger.info("TRUNCATE subsidiary_data_contributions 완료")
                execute_batch(cur, INSERT_SQL, batch, page_size=50)
        logger.info("적재 완료: %s 행 (ON CONFLICT 시 갱신)", len(batch))
    except psycopg2.Error as e:
        logger.exception("DB 오류: %s", e)
        return 1
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
