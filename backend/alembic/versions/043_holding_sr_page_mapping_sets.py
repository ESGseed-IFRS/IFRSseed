"""지주 SR 페이지 ↔ sr_report_body·sr_report_images ID 매핑 (회사·카탈로그별 JSONB)

Revision ID: 043_holding_sr_map_sets
Revises: add_anomaly_corrections
Create Date: 2026-04-10
"""

from __future__ import annotations

from alembic import op

revision = "043_holding_sr_map_sets"
down_revision = "add_anomaly_corrections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE holding_sr_page_mapping_sets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
            catalog_key VARCHAR(64) NOT NULL DEFAULT 'sds_2024',
            schema_version SMALLINT NOT NULL DEFAULT 1,
            pages JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_holding_sr_map_company_catalog UNIQUE (company_id, catalog_key)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_holding_sr_map_company
        ON holding_sr_page_mapping_sets (company_id)
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS holding_sr_page_mapping_sets")
