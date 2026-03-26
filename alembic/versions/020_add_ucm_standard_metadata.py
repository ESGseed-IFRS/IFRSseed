"""Add standard_metadata JSONB to unified_column_mappings.

Revision ID: 020_add_ucm_standard_metadata
Revises: 019_sr_unified_core
Create Date: 2026-03-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "020_add_ucm_standard_metadata"
down_revision = "019_sr_unified_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "unified_column_mappings",
        sa.Column("standard_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("unified_column_mappings", "standard_metadata")
