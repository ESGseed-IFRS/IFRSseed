"""Add 6 staging tables (EMS, ERP, EHS, PLM, SRM, HR) — DATABASE_TABLES_STRUCTURE.md

Revision ID: 014_staging_six
Revises: 013_company_id_nullable
Create Date: 2026-03-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '014_staging_six'
down_revision = '013_company_id_nullable'
branch_labels = None
depends_on = None


def _staging_columns() -> list:
    """공통 컬럼: id, company_id, source_file_name, raw_data, import_status, error_message, imported_at, processed_at"""
    return [
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('source_file_name', sa.Text(), nullable=True),
        sa.Column('raw_data', postgresql.JSONB(), nullable=False),
        sa.Column('import_status', sa.Text(), server_default='pending', nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('imported_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('processed_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    ]


def upgrade() -> None:
    # EMS: 전력·열·스팀, 에너지, 폐기물 등
    op.create_table(
        'staging_ems_data',
        *_staging_columns(),
    )
    op.create_index('idx_staging_ems_status', 'staging_ems_data', ['company_id', 'import_status'], unique=False)
    op.create_index('idx_staging_ems_imported', 'staging_ems_data', ['imported_at'], unique=False)

    # ERP: 연료·차량, 구매 등
    op.create_table(
        'staging_erp_data',
        *_staging_columns(),
    )
    op.create_index('idx_staging_erp_status', 'staging_erp_data', ['company_id', 'import_status'], unique=False)
    op.create_index('idx_staging_erp_imported', 'staging_erp_data', ['imported_at'], unique=False)

    # EHS: 냉매, 안전·보건 등
    op.create_table(
        'staging_ehs_data',
        *_staging_columns(),
    )
    op.create_index('idx_staging_ehs_status', 'staging_ehs_data', ['company_id', 'import_status'], unique=False)
    op.create_index('idx_staging_ehs_imported', 'staging_ehs_data', ['imported_at'], unique=False)

    # PLM: 제품, BOM 등
    op.create_table(
        'staging_plm_data',
        *_staging_columns(),
    )
    op.create_index('idx_staging_plm_status', 'staging_plm_data', ['company_id', 'import_status'], unique=False)
    op.create_index('idx_staging_plm_imported', 'staging_plm_data', ['imported_at'], unique=False)

    # SRM: 물류, 원료, 협력회사 등
    op.create_table(
        'staging_srm_data',
        *_staging_columns(),
    )
    op.create_index('idx_staging_srm_status', 'staging_srm_data', ['company_id', 'import_status'], unique=False)
    op.create_index('idx_staging_srm_imported', 'staging_srm_data', ['imported_at'], unique=False)

    # HR: 출장·통근, 인력 등
    op.create_table(
        'staging_hr_data',
        *_staging_columns(),
    )
    op.create_index('idx_staging_hr_status', 'staging_hr_data', ['company_id', 'import_status'], unique=False)
    op.create_index('idx_staging_hr_imported', 'staging_hr_data', ['imported_at'], unique=False)


def downgrade() -> None:
    # 역순 제거: 인덱스 드롭 후 테이블 드롭
    pairs = [
        ('staging_hr_data', 'hr'),
        ('staging_srm_data', 'srm'),
        ('staging_plm_data', 'plm'),
        ('staging_ehs_data', 'ehs'),
        ('staging_erp_data', 'erp'),
        ('staging_ems_data', 'ems'),
    ]
    for table_name, prefix in pairs:
        op.drop_index('idx_staging_' + prefix + '_imported', table_name=table_name, if_exists=True)
        op.drop_index('idx_staging_' + prefix + '_status', table_name=table_name, if_exists=True)
        op.drop_table(table_name)
