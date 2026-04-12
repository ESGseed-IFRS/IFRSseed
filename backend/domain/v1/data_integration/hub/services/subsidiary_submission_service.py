"""계열사 데이터 제출 서비스 (SQLAlchemy 동기 세션)"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from loguru import logger
from sqlalchemy import text

from backend.core.db import get_session


class SubsidiarySubmissionService:
    """계열사 → 지주사 데이터 제출 서비스"""

    def submit_data(
        self,
        subsidiary_company_id: str,
        holding_company_id: str,
        year: int,
        quarter: Optional[int],
        scope_1: bool,
        scope_2: bool,
        scope_3: bool,
    ) -> Dict[str, Any]:
        """
        계열사 데이터를 지주사에게 제출합니다.

        Returns:
            submission_id, status, total_emission_tco2e, staging_row_count
        """
        sub_uid = UUID(subsidiary_company_id)
        hold_uid = UUID(holding_company_id)
        session = get_session()
        try:
            row_count = session.execute(
                text(
                    """
                    SELECT COUNT(*) AS cnt
                    FROM staging_ems_data
                    WHERE company_id = :cid
                      AND EXTRACT(YEAR FROM imported_at)::int = :yr
                    """
                ),
                {"cid": sub_uid, "yr": year},
            ).scalar()
            staging_row_count = int(row_count or 0)

            er = session.execute(
                text(
                    """
                    SELECT scope1_total_tco2e, scope2_location_tco2e, scope2_market_tco2e,
                           scope3_total_tco2e
                    FROM ghg_emission_results
                    WHERE company_id = :cid
                      AND period_year = :yr
                      AND period_month IS NULL
                      AND calculation_basis = 'location'
                    LIMIT 1
                    """
                ),
                {"cid": sub_uid, "yr": year},
            ).mappings().first()

            total_emission = 0.0
            if er:
                if scope_1:
                    total_emission += float(er["scope1_total_tco2e"] or 0)
                if scope_2:
                    total_emission += float(er["scope2_location_tco2e"] or 0) + float(
                        er["scope2_market_tco2e"] or 0
                    )
                if scope_3:
                    total_emission += float(er["scope3_total_tco2e"] or 0)

            result = session.execute(
                text(
                    """
                    INSERT INTO subsidiary_data_submissions
                    (subsidiary_company_id, holding_company_id, submission_year, submission_quarter,
                     scope_1_submitted, scope_2_submitted, scope_3_submitted,
                     status, staging_row_count, total_emission_tco2e)
                    VALUES (:sub, :hold, :yr, :q, :s1, :s2, :s3, 'submitted', :srcnt, :tot)
                    RETURNING id, status
                    """
                ),
                {
                    "sub": sub_uid,
                    "hold": hold_uid,
                    "yr": year,
                    "q": quarter,
                    "s1": scope_1,
                    "s2": scope_2,
                    "s3": scope_3,
                    "srcnt": staging_row_count,
                    "tot": total_emission,
                },
            ).mappings().first()

            session.commit()

            if not result:
                raise RuntimeError("INSERT subsidiary_data_submissions returned no row")

            submission_id = str(result["id"])
            status = result["status"]

            logger.info(
                f"계열사 데이터 제출 완료: submission_id={submission_id}, "
                f"subsidiary={subsidiary_company_id}, year={year}, emission={total_emission:.2f} tCO2e"
            )

            return {
                "submission_id": submission_id,
                "status": status,
                "total_emission_tco2e": total_emission,
                "staging_row_count": staging_row_count,
            }
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def list_submissions(
        self,
        holding_company_id: Optional[str] = None,
        subsidiary_company_id: Optional[str] = None,
        status: Optional[str] = None,
        year: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """계열사 데이터 제출 이력 조회."""
        session = get_session()
        try:
            clauses: List[str] = ["1=1"]
            params: Dict[str, Any] = {}

            if holding_company_id:
                clauses.append("s.holding_company_id = :hid")
                params["hid"] = UUID(holding_company_id)
            if subsidiary_company_id:
                clauses.append("s.subsidiary_company_id = :sid")
                params["sid"] = UUID(subsidiary_company_id)
            if status:
                clauses.append("s.status = :st")
                params["st"] = status
            if year is not None:
                clauses.append("s.submission_year = :yr")
                params["yr"] = year

            where_sql = " AND ".join(clauses)
            query = text(
                f"""
                SELECT
                    s.id,
                    s.subsidiary_company_id,
                    sc.name AS subsidiary_company_name,
                    s.holding_company_id,
                    hc.name AS holding_company_name,
                    s.submission_year,
                    s.submission_quarter,
                    s.submission_date,
                    s.scope_1_submitted,
                    s.scope_2_submitted,
                    s.scope_3_submitted,
                    s.status,
                    s.reviewed_by,
                    s.reviewed_at,
                    s.rejection_reason,
                    s.staging_row_count,
                    s.total_emission_tco2e
                FROM subsidiary_data_submissions s
                JOIN companies sc ON s.subsidiary_company_id = sc.id
                JOIN companies hc ON s.holding_company_id = hc.id
                WHERE {where_sql}
                ORDER BY s.submission_date DESC
                """
            )
            rows = session.execute(query, params).mappings().all()
            out: List[Dict[str, Any]] = []
            for r in rows:
                d = dict(r)
                for k, v in list(d.items()):
                    if isinstance(v, UUID):
                        d[k] = str(v)
                    elif isinstance(v, datetime):
                        d[k] = v.isoformat()
                out.append(d)
            return out
        finally:
            session.close()

    def approve_submission(self, submission_id: str, reviewed_by: str) -> Dict[str, Any]:
        """지주사 승인."""
        session = get_session()
        try:
            result = session.execute(
                text(
                    """
                    UPDATE subsidiary_data_submissions
                    SET status = 'approved',
                        reviewed_by = :reviewer,
                        reviewed_at = NOW(),
                        updated_at = NOW()
                    WHERE id = :sub_id
                    RETURNING id, status
                    """
                ),
                {"sub_id": UUID(submission_id), "reviewer": UUID(reviewed_by)},
            ).mappings().first()
            session.commit()
            if not result:
                raise ValueError(f"Submission not found: {submission_id}")
            logger.info(f"계열사 데이터 승인 완료: submission_id={submission_id}")
            return {"submission_id": str(result["id"]), "status": result["status"]}
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def reject_submission(
        self,
        submission_id: str,
        reviewed_by: str,
        rejection_reason: str,
    ) -> Dict[str, Any]:
        """지주사 반려."""
        session = get_session()
        try:
            result = session.execute(
                text(
                    """
                    UPDATE subsidiary_data_submissions
                    SET status = 'rejected',
                        reviewed_by = :reviewer,
                        reviewed_at = NOW(),
                        rejection_reason = :reason,
                        updated_at = NOW()
                    WHERE id = :sub_id
                    RETURNING id, status
                    """
                ),
                {
                    "sub_id": UUID(submission_id),
                    "reviewer": UUID(reviewed_by),
                    "reason": rejection_reason,
                },
            ).mappings().first()
            session.commit()
            if not result:
                raise ValueError(f"Submission not found: {submission_id}")
            logger.info(
                f"계열사 데이터 반려 완료: submission_id={submission_id}, reason={rejection_reason}"
            )
            return {"submission_id": str(result["id"]), "status": result["status"]}
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
