"""계열사 기여·외부 기업 스냅샷 테이블 (REVISED_WORKFLOW §2).

Revision ID: 037_subs_ext_company_data (≤32자)
Revises: 036_ghg_act_sds_cols
Create Date: 2026-04-02

- subsidiary_data_contributions: 모회사 기준 계열사/사업장별 서술·정량·임베딩
- external_company_data: 배치 적재 외부 공시·뉴스 등 스냅샷 (anchor_company_id 필터)
"""

from __future__ import annotations

from alembic import op

revision = "037_subs_ext_company_data"
down_revision = "036_ghg_act_sds_cols"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.execute(
        """
        CREATE TABLE subsidiary_data_contributions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            company_id UUID NOT NULL REFERENCES companies (id),
            subsidiary_name VARCHAR(200),
            facility_name VARCHAR(200),
            report_year INTEGER NOT NULL,
            category TEXT,
            category_embedding vector(1024),
            description TEXT,
            description_embedding vector(1024),
            related_dp_ids TEXT[],
            quantitative_data JSONB,
            data_source VARCHAR(100),
            submitted_by VARCHAR(200),
            submission_date DATE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )

    op.execute(
        """
        CREATE TABLE external_company_data (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            anchor_company_id UUID NOT NULL REFERENCES companies (id),
            external_org_name VARCHAR(300),
            source_type VARCHAR(50) NOT NULL,
            source_url TEXT,
            report_year INTEGER,
            as_of_date DATE,
            category TEXT,
            category_embedding vector(1024),
            title TEXT,
            body_text TEXT,
            body_embedding vector(1024),
            structured_payload JSONB,
            related_dp_ids TEXT[],
            fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            ingest_batch_id UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_subsidiary_company_year_cat
        ON subsidiary_data_contributions (company_id, report_year, category)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_subsidiary_related_dp_ids
        ON subsidiary_data_contributions USING GIN (related_dp_ids)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_subsidiary_category_embedding
        ON subsidiary_data_contributions
        USING hnsw (category_embedding vector_cosine_ops)
        WHERE category_embedding IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_subsidiary_description_embedding
        ON subsidiary_data_contributions
        USING hnsw (description_embedding vector_cosine_ops)
        WHERE description_embedding IS NOT NULL
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_ext_company_anchor_year_source
        ON external_company_data (anchor_company_id, report_year, source_type)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_ext_company_related_dp_ids
        ON external_company_data USING GIN (related_dp_ids)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_ext_company_category_embedding
        ON external_company_data
        USING hnsw (category_embedding vector_cosine_ops)
        WHERE category_embedding IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_ext_company_category_embedding")
    op.execute("DROP INDEX IF EXISTS idx_ext_company_related_dp_ids")
    op.execute("DROP INDEX IF EXISTS idx_ext_company_anchor_year_source")

    op.execute("DROP INDEX IF EXISTS idx_subsidiary_description_embedding")
    op.execute("DROP INDEX IF EXISTS idx_subsidiary_category_embedding")
    op.execute("DROP INDEX IF EXISTS idx_subsidiary_related_dp_ids")
    op.execute("DROP INDEX IF EXISTS idx_subsidiary_company_year_cat")

    op.execute("DROP TABLE IF EXISTS external_company_data")
    op.execute("DROP TABLE IF EXISTS subsidiary_data_contributions")
