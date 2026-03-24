"""sr_report_body: 목차(Contents) 계층 경로 toc_path (JSONB)

Revision ID: 015_sr_body_toc_path
Revises: 014_staging_six
Create Date: 2026-03-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "015_sr_body_toc_path"
down_revision = "014_staging_six"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sr_report_body",
        sa.Column(
            "toc_path",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.execute(
        "CREATE INDEX idx_body_toc_path ON sr_report_body USING GIN (toc_path)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_body_toc_path")
    op.drop_column("sr_report_body", "toc_path")
