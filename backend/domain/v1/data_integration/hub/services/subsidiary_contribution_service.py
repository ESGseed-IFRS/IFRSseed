"""계열사 기여 데이터(subsidiary_data_contributions) 저장."""
from __future__ import annotations

import json
from datetime import date
from typing import Any, Dict, List, Optional
from uuid import UUID

from loguru import logger
from sqlalchemy import text

from backend.core.db import get_session

SR_DP_DATA_SOURCE = "sr_report_dp"


def _normalize_related_codes(raw: Optional[List[str]], dp_id: str) -> List[str]:
    """연결된 공시 기준 코드 목록(중복 제거·공백 제거). 비어 있으면 UI DP id만."""
    out: List[str] = []
    seen: set[str] = set()
    for x in raw or []:
        s = (x or "").strip()
        if not s or s in seen:
            continue
        if len(s) > 200:
            s = s[:200]
        seen.add(s)
        out.append(s)
    return out if out else [dp_id]


class SubsidiaryContributionService:
    """SR·기타 계열사 기여 행을 subsidiary_data_contributions에 기록."""

    def submit_sr_dp_narrative(
        self,
        subsidiary_company_id: str,
        year: int,
        dp_id: str,
        dp_title: str,
        narrative_text: str,
        submitted_by: Optional[str] = None,
        related_dp_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        SR 표준형 에디터의 DP 서술을 subsidiary_data_contributions에 저장(동일 키면 갱신).

        - company_id: 지주(모회사) ID — aggregation_node 조회와 동일한 축
        - subsidiary_name: 실제 작성 법인명
        - category: sr_dp:{contributor_uuid}:{dp_id} 로 유일성 확보
        """
        sub_uid = UUID(subsidiary_company_id)
        session = get_session()
        try:
            crow = session.execute(
                text(
                    """
                    SELECT c.name AS name, c.parent_company_id AS parent_company_id
                    FROM companies c
                    WHERE c.id = :cid
                    """
                ),
                {"cid": sub_uid},
            ).mappings().first()
            if not crow:
                raise ValueError(f"회사를 찾을 수 없습니다: {subsidiary_company_id}")

            sub_name = (crow["name"] or "").strip() or "미상"
            parent = crow["parent_company_id"]
            if parent is None:
                hold_uid = sub_uid
            else:
                hold_uid = UUID(str(parent))

            title = (dp_title or "").strip() or dp_id
            narr = narrative_text if narrative_text is not None else ""
            category_key = f"sr_dp:{subsidiary_company_id}:{dp_id}"
            codes = _normalize_related_codes(related_dp_ids, dp_id)
            codes_json = json.dumps(codes, ensure_ascii=False)

            qd = json.dumps(
                {
                    "dp_id": dp_id,
                    "dp_title": title,
                    "contributor_company_id": subsidiary_company_id,
                    "related_standard_codes": codes,
                },
                ensure_ascii=False,
            )

            existing_id = session.execute(
                text(
                    """
                    SELECT id FROM subsidiary_data_contributions
                    WHERE company_id = :hold
                      AND report_year = :yr
                      AND category = :cat
                      AND data_source = :ds
                    LIMIT 1
                    """
                ),
                {
                    "hold": hold_uid,
                    "yr": year,
                    "cat": category_key,
                    "ds": SR_DP_DATA_SOURCE,
                },
            ).scalar()

            if existing_id:
                session.execute(
                    text(
                        """
                        UPDATE subsidiary_data_contributions
                        SET subsidiary_name = :sname,
                            description = :desc,
                            related_dp_ids = COALESCE(
                                (SELECT ARRAY(SELECT jsonb_array_elements_text(CAST(:cj AS jsonb)))),
                                ARRAY[]::text[]
                            ),
                            quantitative_data = CAST(:qd AS jsonb),
                            submitted_by = :sby,
                            submission_date = :sdate,
                            updated_at = NOW()
                        WHERE id = :eid
                        """
                    ),
                    {
                        "sname": sub_name,
                        "desc": narr,
                        "cj": codes_json,
                        "qd": qd,
                        "sby": (submitted_by or "").strip() or None,
                        "sdate": date.today(),
                        "eid": existing_id,
                    },
                )
                session.commit()
                rid = str(existing_id)
                logger.info(
                    "SR DP 기여 갱신: id=%s, subsidiary=%s, year=%s, dp_id=%s",
                    rid,
                    subsidiary_company_id,
                    year,
                    dp_id,
                )
                return {"contribution_id": rid, "status": "updated"}

            ins = session.execute(
                text(
                    """
                    INSERT INTO subsidiary_data_contributions (
                        company_id,
                        subsidiary_name,
                        facility_name,
                        report_year,
                        category,
                        description,
                        related_dp_ids,
                        quantitative_data,
                        data_source,
                        submitted_by,
                        submission_date
                    )
                    VALUES (
                        :hold,
                        :sname,
                        :fname,
                        :yr,
                        :cat,
                        :desc,
                        COALESCE(
                            (SELECT ARRAY(SELECT jsonb_array_elements_text(CAST(:cj AS jsonb)))),
                            ARRAY[]::text[]
                        ),
                        CAST(:qd AS jsonb),
                        :ds,
                        :sby,
                        :sdate
                    )
                    RETURNING id
                    """
                ),
                {
                    "hold": hold_uid,
                    "sname": sub_name,
                    "fname": None,
                    "yr": year,
                    "cat": category_key,
                    "desc": narr,
                    "cj": codes_json,
                    "qd": qd,
                    "ds": SR_DP_DATA_SOURCE,
                    "sby": (submitted_by or "").strip() or None,
                    "sdate": date.today(),
                },
            ).scalar()
            session.commit()
            if not ins:
                raise RuntimeError("INSERT subsidiary_data_contributions returned no row")
            rid = str(ins)
            logger.info(
                "SR DP 기여 저장: id=%s, subsidiary=%s, year=%s, dp_id=%s",
                rid,
                subsidiary_company_id,
                year,
                dp_id,
            )
            return {"contribution_id": rid, "status": "created"}
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def list_contributions_for_holding(
        self,
        holding_company_id: str,
        report_year: int,
    ) -> List[Dict[str, Any]]:
        """
        지주 산하(지주 본사 + parent_company_id = 지주) 회사가 주체인
        subsidiary_data_contributions 행을 보고연도 기준으로 조회합니다.

        - 시드/일반 적재: company_id = 계열사 UUID
        - SR 제출(sr_report_dp): company_id = 지주 UUID, quantitative_data에 contributor_company_id
        """
        hid = UUID(holding_company_id)
        yr = int(report_year)
        session = get_session()
        try:
            rows = session.execute(
                text(
                    """
                    SELECT
                        sdc.id,
                        sdc.company_id,
                        sdc.subsidiary_name,
                        sdc.facility_name,
                        sdc.report_year,
                        sdc.category,
                        sdc.description,
                        sdc.related_dp_ids,
                        sdc.quantitative_data,
                        sdc.data_source,
                        sdc.submitted_by,
                        sdc.submission_date
                    FROM subsidiary_data_contributions sdc
                    WHERE sdc.report_year = :yr
                      AND (
                        sdc.company_id = :hid
                        OR sdc.company_id IN (
                            SELECT c.id FROM companies c
                            WHERE c.parent_company_id = :hid
                        )
                      )
                    ORDER BY sdc.subsidiary_name NULLS LAST, sdc.category NULLS LAST
                    """
                ),
                {"hid": hid, "yr": yr},
            ).mappings().all()

            out: List[Dict[str, Any]] = []
            for r in rows:
                qd_raw = r["quantitative_data"]
                if qd_raw is None:
                    qd_dict: Dict[str, Any] = {}
                elif isinstance(qd_raw, dict):
                    qd_dict = qd_raw
                elif isinstance(qd_raw, str):
                    try:
                        qd_dict = json.loads(qd_raw) if qd_raw.strip() else {}
                    except json.JSONDecodeError:
                        qd_dict = {}
                else:
                    try:
                        qd_dict = dict(qd_raw)
                    except (TypeError, ValueError):
                        qd_dict = {}
                out.append(
                    {
                        "id": str(r["id"]),
                        "company_id": str(r["company_id"]),
                        "subsidiary_name": (r["subsidiary_name"] or "").strip() or None,
                        "facility_name": (r["facility_name"] or "").strip() or None,
                        "report_year": int(r["report_year"]),
                        "category": r["category"],
                        "description": r["description"],
                        "related_dp_ids": list(r["related_dp_ids"] or []),
                        "quantitative_data": qd_dict,
                        "data_source": r["data_source"],
                        "submitted_by": r["submitted_by"],
                        "submission_date": r["submission_date"].isoformat()
                        if r["submission_date"]
                        else None,
                    }
                )
            return out
        finally:
            session.close()
