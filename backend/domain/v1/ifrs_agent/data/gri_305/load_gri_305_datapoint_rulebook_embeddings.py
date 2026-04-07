"""GRI 305 JSON(datapoint / rulebook)을 DB에 적재하고 BGE-M3 임베딩까지 저장하는 스크립트

대상 파일: 동일 디렉터리의 ``datapoint.json``, ``rulebook.json``
저장 테이블: ``data_points`` → ``rulebooks`` 순 (``rulebooks.primary_dp_id`` FK)

환경 변수 ``DATABASE_URL``(PostgreSQL) 필요. 모델은 ``BAAI/bge-m3`` (1024차원 pgvector).

사용 예:
    python load_gri_305_datapoint_rulebook_embeddings.py
    python load_gri_305_datapoint_rulebook_embeddings.py --force
    python load_gri_305_datapoint_rulebook_embeddings.py --dry-run
    python load_gri_305_datapoint_rulebook_embeddings.py --data-points-only
    python load_gri_305_datapoint_rulebook_embeddings.py --rulebooks-only
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import Json

SCRIPT_DIR = Path(__file__).resolve().parent
# backend/domain/v1 (…/ifrs_agent/data/gri_305 → 상위 3단계)
V1_ROOT = SCRIPT_DIR.parent.parent.parent

for candidate in (
    V1_ROOT.parent.parent.parent / ".env",
    V1_ROOT.parent.parent / ".env",
    V1_ROOT.parent / ".env",
    V1_ROOT / ".env",
):
    if candidate.exists():
        load_dotenv(candidate)
        break

logger = logging.getLogger(__name__)


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(message)s",
        datefmt="%H:%M:%S",
    )


def get_db_connection():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL 환경 변수가 설정되지 않았습니다.")
    return psycopg2.connect(database_url)


def load_json_data_points() -> List[Dict[str, Any]]:
    path = SCRIPT_DIR / "datapoint.json"
    if not path.exists():
        raise FileNotFoundError(f"데이터 포인트 JSON 없음: {path}")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and "data_points" in data:
        return data["data_points"]
    if isinstance(data, list):
        return data
    raise ValueError("datapoint JSON 형식이 올바르지 않습니다 (data_points 키 또는 배열).")


def load_json_rulebooks() -> List[Dict[str, Any]]:
    path = SCRIPT_DIR / "rulebook.json"
    if not path.exists():
        raise FileNotFoundError(f"룰북 JSON 없음: {path}")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and "rulebooks" in data:
        return data["rulebooks"]
    if isinstance(data, list):
        return data
    raise ValueError("rulebook JSON 형식이 올바르지 않습니다 (rulebooks 키 또는 배열).")


def map_dp_type(dp_type_str: Optional[str]) -> str:
    if not dp_type_str:
        return "narrative"
    mapping = {
        "quantitative": "quantitative",
        "qualitative": "qualitative",
        "narrative": "narrative",
        "binary": "binary",
    }
    return mapping.get(str(dp_type_str).lower(), "narrative")


def map_unit(unit_str: Optional[str]) -> Optional[str]:
    if not unit_str:
        return None
    mapping = {
        "percentage": "percentage",
        "count": "count",
        "currency_krw": "currency_krw",
        "currency_usd": "currency_usd",
        "tco2e": "tco2e",
        "tcfc11e": "tcfc11e",
        "kg": "kg",
        "mwh": "mwh",
        "cubic_meter": "cubic_meter",
        "text": "text",
    }
    return mapping.get(str(unit_str).lower())


def map_disclosure_requirement(req_str: Optional[str]) -> Optional[str]:
    if not req_str:
        return None
    mapping = {
        "필수": "필수",
        "권장": "권장",
        "권고": "권장",
        "선택": "선택",
        "조건부": "조건부",
        "required": "필수",
        "recommended": "권장",
        "optional": "선택",
    }
    return mapping.get(req_str, "필수")


def convert_validation_rules(rules: Any) -> Dict[str, Any]:
    if rules is None:
        return {}
    if isinstance(rules, dict):
        return rules
    if isinstance(rules, list):
        result: Dict[str, Any] = {}
        for i, rule in enumerate(rules):
            if isinstance(rule, str):
                if ": " in rule:
                    key, value = rule.split(": ", 1)
                    if value.lower() == "true":
                        result[key] = True
                    elif value.lower() == "false":
                        result[key] = False
                    else:
                        result[key] = value
                else:
                    result[f"rule_{i}"] = rule
            else:
                result[f"rule_{i}"] = rule
        return result
    return {"value": str(rules)}


def generate_dp_embedding_text(dp_data: Dict[str, Any]) -> str:
    """임베딩: name_ko, name_en, description, topic, subtopic 만 (`EmbeddingTextService`와 동일)."""
    parts: List[str] = []
    parts.append(dp_data.get("name_ko", "") or "")
    parts.append(dp_data.get("name_en", "") or "")
    if dp_data.get("description"):
        parts.append(str(dp_data["description"]))
    if dp_data.get("topic"):
        parts.append(str(dp_data["topic"]))
    if dp_data.get("subtopic"):
        parts.append(str(dp_data["subtopic"]))
    return " ".join(" ".join(parts).split())


def _rulebook_sidecars(validation_rules: Any) -> Tuple[Optional[str], Optional[List[str]], Optional[List[str]]]:
    if not isinstance(validation_rules, dict):
        return None, None, None
    para = validation_rules.get("paragraph_reference")
    if para is not None:
        para = str(para)
    kt = validation_rules.get("key_terms")
    if kt is not None and not isinstance(kt, list):
        kt = [str(kt)]
    if kt:
        kt = [str(x) for x in kt]
    rc = validation_rules.get("related_concepts")
    if rc is not None and not isinstance(rc, list):
        rc = [str(rc)]
    if rc:
        rc = [str(x) for x in rc]
    return para, kt, rc


def generate_rulebook_embedding_text(rb: Dict[str, Any]) -> str:
    parts: List[str] = []
    if rb.get("section_name"):
        parts.append(str(rb["section_name"]))
    if rb.get("standard_id"):
        parts.append(str(rb["standard_id"]))
    if rb.get("rulebook_title"):
        parts.append(str(rb["rulebook_title"]))
    if rb.get("section_content"):
        parts.append(str(rb["section_content"]))
    vr = rb.get("validation_rules")
    para, kt, rc = _rulebook_sidecars(vr)
    if para:
        parts.append(f"문단: {para}")
    if rb.get("disclosure_requirement"):
        parts.append(str(rb["disclosure_requirement"]))
    if kt:
        parts.extend(kt)
    if rc:
        parts.extend(rc)
    if vr:
        if isinstance(vr, dict):
            for key, value in vr.items():
                if value and key not in ("key_terms", "related_concepts", "paragraph_reference"):
                    if isinstance(value, list):
                        parts.append(f"{key}: {', '.join(str(v) for v in value)}")
                    else:
                        parts.append(f"{key}: {value}")
        elif isinstance(vr, list):
            parts.extend(str(r) for r in vr)
        else:
            parts.append(str(vr))
    return " ".join(" ".join(parts).split())


def load_embedding_model():
    try:
        from FlagEmbedding import FlagModel

        embedder = FlagModel("BAAI/bge-m3", use_fp16=True)
        logger.info("FlagEmbedding(BGE-M3) 로드 완료")
        return embedder, "flag"
    except Exception as e:
        logger.warning("FlagEmbedding 로드 실패: %s", e)
    try:
        from sentence_transformers import SentenceTransformer

        embedder = SentenceTransformer("BAAI/bge-m3")
        logger.info("sentence-transformers(BGE-M3) 로드 완료")
        return embedder, "sentence"
    except Exception as e:
        logger.warning("sentence-transformers 로드 실패: %s", e)
    raise RuntimeError(
        "임베딩 모델을 불러올 수 없습니다. FlagEmbedding 또는 sentence-transformers를 설치하세요."
    )


def embedding_vector(embedder: Any, model_type: str, text: str) -> List[float]:
    if model_type == "flag":
        raw = embedder.encode([text])
        if hasattr(raw, "ndim") and raw.ndim > 1:
            emb = raw[0]
        else:
            emb = raw[0] if len(raw) > 0 else raw
    elif model_type == "sentence":
        emb = embedder.encode(text, normalize_embeddings=True)
    else:
        raise ValueError(model_type)
    if isinstance(emb, np.ndarray):
        n = np.linalg.norm(emb)
        if n > 0:
            emb = emb / n
        return emb.tolist()
    return list(emb)


def parse_effective_date(val: Any) -> Optional[date]:
    if val is None or val == "":
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    s = str(val).strip()
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def check_existing_dp(cursor, dp_id: str) -> bool:
    cursor.execute("SELECT 1 FROM data_points WHERE dp_id = %s", (dp_id,))
    return cursor.fetchone() is not None


def insert_data_point(cursor, record: Dict[str, Any]) -> None:
    columns = list(record.keys())
    values = []
    placeholders = []
    for col in columns:
        val = record[col]
        if col == "embedding":
            placeholders.append("%s::vector")
            values.append(val)
        elif col in ("validation_rules", "value_range"):
            placeholders.append("%s")
            values.append(Json(val) if val else None)
        elif col in ("equivalent_dps", "child_dps", "financial_linkages"):
            placeholders.append("%s")
            values.append(val if val else None)
        else:
            placeholders.append("%s")
            values.append(val)
    sql = f"INSERT INTO data_points ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
    cursor.execute(sql, values)


def update_data_point(cursor, dp_id: str, record: Dict[str, Any]) -> None:
    set_clauses: List[str] = []
    values: List[Any] = []
    for col, val in record.items():
        if col == "dp_id":
            continue
        if col == "embedding":
            set_clauses.append(f"{col} = %s::vector")
            values.append(val)
        elif col in ("validation_rules", "value_range"):
            set_clauses.append(f"{col} = %s")
            values.append(Json(val) if val else None)
        elif col in ("equivalent_dps", "child_dps", "financial_linkages"):
            set_clauses.append(f"{col} = %s")
            values.append(val if val else None)
        else:
            set_clauses.append(f"{col} = %s")
            values.append(val)
    set_clauses.append("embedding_updated_at = NOW()")
    set_clauses.append("updated_at = NOW()")
    values.append(dp_id)
    sql = f"UPDATE data_points SET {', '.join(set_clauses)} WHERE dp_id = %s"
    cursor.execute(sql, values)


def check_existing_rulebook(cursor, rulebook_id: str) -> bool:
    cursor.execute("SELECT 1 FROM rulebooks WHERE rulebook_id = %s", (rulebook_id,))
    return cursor.fetchone() is not None


def insert_rulebook(cursor, record: Dict[str, Any]) -> None:
    columns = list(record.keys())
    values = []
    placeholders = []
    for col in columns:
        val = record[col]
        if col == "section_embedding":
            placeholders.append("%s::vector")
            values.append(val)
        elif col == "validation_rules":
            placeholders.append("%s")
            values.append(Json(val) if val else None)
        elif col in ("related_dp_ids", "key_terms", "related_concepts", "conflicts_with"):
            placeholders.append("%s")
            values.append(val if val else None)
        else:
            placeholders.append("%s")
            values.append(val)
    sql = f"INSERT INTO rulebooks ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
    cursor.execute(sql, values)


def update_rulebook(cursor, rulebook_id: str, record: Dict[str, Any]) -> None:
    set_clauses: List[str] = []
    values: List[Any] = []
    for col, val in record.items():
        if col == "rulebook_id":
            continue
        if col == "section_embedding":
            set_clauses.append(f"{col} = %s::vector")
            values.append(val)
        elif col == "validation_rules":
            set_clauses.append(f"{col} = %s")
            values.append(Json(val) if val else None)
        elif col in ("related_dp_ids", "key_terms", "related_concepts", "conflicts_with"):
            set_clauses.append(f"{col} = %s")
            values.append(val if val else None)
        else:
            set_clauses.append(f"{col} = %s")
            values.append(val)
    set_clauses.append("section_embedding_updated_at = NOW()")
    set_clauses.append("updated_at = NOW()")
    values.append(rulebook_id)
    sql = f"UPDATE rulebooks SET {', '.join(set_clauses)} WHERE rulebook_id = %s"
    cursor.execute(sql, values)


def ingest_data_points(
    cursor,
    items: List[Dict[str, Any]],
    embedder: Any,
    model_type: str,
    *,
    force: bool,
    dry_run: bool,
    batch_size: int,
) -> Dict[str, int]:
    stats = {"inserted": 0, "updated": 0, "skipped": 0, "errors": 0}
    total = len(items)
    for i, dp_data in enumerate(items, 1):
        dp_id = dp_data.get("dp_id", "")
        try:
            existing = check_existing_dp(cursor, dp_id) if cursor else False
            if existing and not force:
                stats["skipped"] += 1
                continue

            text = generate_dp_embedding_text(dp_data)
            if not text.strip():
                text = f"{dp_data.get('name_ko', '')} {dp_data.get('name_en', '')}"
            vec = embedding_vector(embedder, model_type, text)

            parent = dp_data.get("parent_indicator")
            if parent == "":
                parent = None

            record = {
                "dp_id": dp_id,
                "dp_code": dp_data.get("dp_code") or f"CODE_{dp_id}",
                "name_ko": dp_data.get("name_ko", ""),
                "name_en": dp_data.get("name_en", ""),
                "description": dp_data.get("description"),
                "standard": dp_data.get("standard", "GRI"),
                "category": dp_data.get("category", "G"),
                "topic": dp_data.get("topic"),
                "subtopic": dp_data.get("subtopic"),
                "dp_type": map_dp_type(dp_data.get("dp_type")),
                "unit": map_unit(dp_data.get("unit")),
                "validation_rules": convert_validation_rules(dp_data.get("validation_rules")),
                "value_range": dp_data.get("value_range"),
                "equivalent_dps": dp_data.get("equivalent_dps") or [],
                "parent_indicator": parent,
                "child_dps": dp_data.get("child_dps") or [],
                "financial_linkages": dp_data.get("financial_linkages") or [],
                "financial_impact_type": dp_data.get("financial_impact_type"),
                "disclosure_requirement": map_disclosure_requirement(dp_data.get("disclosure_requirement")),
                "reporting_frequency": dp_data.get("reporting_frequency"),
                "is_active": True,
                "embedding": vec,
                "embedding_text": text,
            }

            if dry_run:
                stats["updated" if existing else "inserted"] += 1
                logger.info("[%s/%s] data_points %s → %s (dry-run)", i, total, dp_id, "UPDATE" if existing else "INSERT")
                continue

            if existing:
                update_data_point(cursor, dp_id, record)
                stats["updated"] += 1
            else:
                insert_data_point(cursor, record)
                stats["inserted"] += 1

            if i % batch_size == 0:
                cursor.connection.commit()
                logger.info("data_points 진행 %s/%s", i, total)
        except Exception as e:
            logger.error("[%s/%s] data_points %s 실패: %s", i, total, dp_id, e)
            stats["errors"] += 1
            if cursor:
                cursor.connection.rollback()
    return stats


def ingest_rulebooks(
    cursor,
    items: List[Dict[str, Any]],
    embedder: Any,
    model_type: str,
    *,
    force: bool,
    dry_run: bool,
    batch_size: int,
) -> Dict[str, int]:
    stats = {"inserted": 0, "updated": 0, "skipped": 0, "errors": 0}
    total = len(items)
    for i, rb in enumerate(items, 1):
        rulebook_id = rb.get("rulebook_id", "")
        try:
            if not rulebook_id:
                logger.warning("[%s/%s] rulebook_id 비어 있음, 스킵", i, total)
                stats["errors"] += 1
                continue

            existing = check_existing_rulebook(cursor, rulebook_id) if cursor else False
            if existing and not force:
                stats["skipped"] += 1
                continue

            text = generate_rulebook_embedding_text(rb)
            if not text.strip():
                text = f"{rb.get('section_name', '')} {rb.get('standard_id', '')}"
            vec = embedding_vector(embedder, model_type, text)

            vr = rb.get("validation_rules") or {}
            para, key_terms, related_concepts = _rulebook_sidecars(vr if isinstance(vr, dict) else {})

            record = {
                "rulebook_id": rulebook_id,
                "standard_id": rb.get("standard_id", "GRI305"),
                "primary_dp_id": rb.get("primary_dp_id"),
                "section_name": rb.get("section_name", ""),
                "rulebook_title": rb.get("rulebook_title"),
                "rulebook_content": rb.get("section_content"),
                "paragraph_reference": para,
                "validation_rules": vr if isinstance(vr, dict) else convert_validation_rules(vr),
                "key_terms": key_terms,
                "related_concepts": related_concepts,
                "related_dp_ids": rb.get("related_dp_ids") or [],
                "disclosure_requirement": map_disclosure_requirement(rb.get("disclosure_requirement")),
                "is_primary": bool(rb.get("is_primary", False)),
                "version": rb.get("version"),
                "effective_date": parse_effective_date(rb.get("effective_date")),
                "conflicts_with": rb.get("conflicts_with") or [],
                "mapping_notes": rb.get("mapping_notes"),
                "is_active": rb.get("is_active", True),
                "section_embedding": vec,
                "section_embedding_text": text,
            }

            if dry_run:
                stats["updated" if existing else "inserted"] += 1
                logger.info(
                    "[%s/%s] rulebooks %s → %s (dry-run)", i, total, rulebook_id, "UPDATE" if existing else "INSERT"
                )
                continue

            if existing:
                update_rulebook(cursor, rulebook_id, record)
                stats["updated"] += 1
            else:
                insert_rulebook(cursor, record)
                stats["inserted"] += 1

            if i % batch_size == 0:
                cursor.connection.commit()
                logger.info("rulebooks 진행 %s/%s", i, total)
        except Exception as e:
            logger.error("[%s/%s] rulebooks %s 실패: %s", i, total, rulebook_id, e)
            stats["errors"] += 1
            if cursor:
                cursor.connection.rollback()
    return stats


def main() -> None:
    _configure_logging()
    parser = argparse.ArgumentParser(description="GRI 305 datapoint/rulebook JSON + 임베딩 적재")
    parser.add_argument("--force", action="store_true", help="기존 행도 임베딩·본문 포함 덮어쓰기")
    parser.add_argument("--dry-run", action="store_true", help="DB 반영 없이 건수만 확인")
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--data-points-only", action="store_true")
    parser.add_argument("--rulebooks-only", action="store_true")
    args = parser.parse_args()

    if args.data_points_only and args.rulebooks_only:
        parser.error("--data-points-only 와 --rulebooks-only 는 동시에 쓸 수 없습니다.")

    logger.info("=" * 60)
    logger.info("GRI 305 datapoint.json / rulebook.json → DB + 임베딩")
    logger.info("=" * 60)

    embedder, model_type = load_embedding_model()
    conn = get_db_connection()
    cursor = conn.cursor()

    started = datetime.now()
    all_stats: Dict[str, Dict[str, int]] = {}

    try:
        if not args.rulebooks_only:
            dps = load_json_data_points()
            logger.info("데이터 포인트 %s건 적재 시작", len(dps))
            all_stats["data_points"] = ingest_data_points(
                cursor,
                dps,
                embedder,
                model_type,
                force=args.force,
                dry_run=args.dry_run,
                batch_size=args.batch_size,
            )

        if not args.data_points_only:
            rbs = load_json_rulebooks()
            logger.info("룰북 %s건 적재 시작", len(rbs))
            all_stats["rulebooks"] = ingest_rulebooks(
                cursor,
                rbs,
                embedder,
                model_type,
                force=args.force,
                dry_run=args.dry_run,
                batch_size=args.batch_size,
            )

        if args.dry_run:
            conn.rollback()
        else:
            conn.commit()

    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

    elapsed = (datetime.now() - started).total_seconds()
    logger.info("=" * 60)
    for table, st in all_stats.items():
        logger.info(
            "[%s] 삽입 %s / 갱신 %s / 스킵 %s / 오류 %s",
            table,
            st["inserted"],
            st["updated"],
            st["skipped"],
            st["errors"],
        )
    logger.info("소요 시간: %.1f초", elapsed)
    logger.info("=" * 60)

    if any(st.get("errors", 0) > 0 for st in all_stats.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
