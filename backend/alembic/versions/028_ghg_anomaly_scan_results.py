"""GHG 시계열 이상치 스캔 결과 최신본 저장 (회사당 1행).

Revision ID: 028_ghg_anomaly_scan_results
Revises: 027_staging_ingest_source
Create Date: 2026-04-01

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "028_ghg_anomaly_scan_results"
down_revision = "027_staging_ingest_source"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ghg_anomaly_scan_results",
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("company_id"),
    )


def downgrade() -> None:
    op.drop_table("ghg_anomaly_scan_results")
