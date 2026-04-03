"""Add back validation_rules/value_range to data_points.

Revision ID: 021_add_validation_rules_back
Revises: 020_add_ucm_standard_metadata
Create Date: 2026-03-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "021_add_validation_rules_back"
down_revision = "020_add_ucm_standard_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "data_points",
        sa.Column(
            "validation_rules",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "data_points",
        sa.Column(
            "value_range",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("data_points", "value_range")
    op.drop_column("data_points", "validation_rules")

