"""cleanup_drop_lost_025_026_artifacts

Revision ID: 2dde0dc639ba
Revises: 39da351c83b6
Create Date: 2026-03-31 23:00:32.715183

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '2dde0dc639ba'
down_revision = '024_user_permission_chk_arv'
branch_labels = None
depends_on = None


def upgrade() -> None:

    op.drop_table("staging_mdg_data")

    op.drop_column("staging_hr_data", "ghg_raw_category")
    op.drop_column("staging_srm_data", "ghg_raw_category")
    op.drop_column("staging_ems_data", "ghg_raw_category")
    op.drop_column("staging_ehs_data", "ghg_raw_category")
    op.drop_column("staging_plm_data", "ghg_raw_category")
    op.drop_column("staging_erp_data", "ghg_raw_category")

    pass


def downgrade() -> None:
    # 1) 테이블 복구 (최소 스키마라도)
    op.create_table(
        "staging_mdg_data",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("source_file_name", sa.Text(), nullable=True),
        sa.Column("ghg_raw_category", sa.Text(), nullable=True),
        sa.Column("raw_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("import_status", sa.Text(), server_default=sa.text("'pending'::text"), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("staging_mdg_data_pkey")),
    )
    op.create_index(op.f("idx_staging_mdg_status"), "staging_mdg_data", ["company_id", "import_status"], unique=False)
    op.create_index(op.f("idx_staging_mdg_imported"), "staging_mdg_data", ["imported_at"], unique=False)
    # 2) 컬럼 복구
    op.add_column("staging_hr_data", sa.Column("ghg_raw_category", sa.Text(), nullable=True))
    op.add_column("staging_srm_data", sa.Column("ghg_raw_category", sa.Text(), nullable=True))
    op.add_column("staging_ems_data", sa.Column("ghg_raw_category", sa.Text(), nullable=True))
    op.add_column("staging_ehs_data", sa.Column("ghg_raw_category", sa.Text(), nullable=True))
    op.add_column("staging_plm_data", sa.Column("ghg_raw_category", sa.Text(), nullable=True))
    op.add_column("staging_erp_data", sa.Column("ghg_raw_category", sa.Text(), nullable=True))

    pass
