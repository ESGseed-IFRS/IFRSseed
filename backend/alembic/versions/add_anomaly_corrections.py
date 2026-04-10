"""Add anomaly_corrections table for audit trail

Revision ID: add_anomaly_corrections
Revises: 042_extend_emission_factors
Create Date: 2026-04-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "add_anomaly_corrections"
down_revision = "042_extend_emission_factors"
branch_labels = None
depends_on = None


def upgrade():
    # Create anomaly_corrections table
    op.create_table(
        'anomaly_corrections',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('rule_code', sa.Text(), nullable=False),
        sa.Column('severity', sa.Text(), nullable=True),
        sa.Column('staging_system', sa.Text(), nullable=False),
        sa.Column('staging_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('facility', sa.Text(), nullable=True),
        sa.Column('metric', sa.Text(), nullable=True),
        sa.Column('year_month', sa.Text(), nullable=True),
        sa.Column('original_value', sa.Float(), nullable=False),
        sa.Column('corrected_value', sa.Float(), nullable=False),
        sa.Column('unit', sa.Text(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('anomaly_context', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('corrected_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('corrected_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('status', sa.Text(), nullable=False, server_default='applied'),
        sa.Column('validation_result', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('ix_anomaly_corrections_company_id', 'anomaly_corrections', ['company_id'])
    op.create_index('ix_anomaly_corrections_rule_code', 'anomaly_corrections', ['rule_code'])
    op.create_index('ix_anomaly_corrections_corrected_at', 'anomaly_corrections', ['corrected_at'])
    op.create_index('ix_anomaly_corrections_status', 'anomaly_corrections', ['status'])


def downgrade():
    # Drop indexes
    op.drop_index('ix_anomaly_corrections_status', table_name='anomaly_corrections')
    op.drop_index('ix_anomaly_corrections_corrected_at', table_name='anomaly_corrections')
    op.drop_index('ix_anomaly_corrections_rule_code', table_name='anomaly_corrections')
    op.drop_index('ix_anomaly_corrections_company_id', table_name='anomaly_corrections')
    
    # Drop table
    op.drop_table('anomaly_corrections')
