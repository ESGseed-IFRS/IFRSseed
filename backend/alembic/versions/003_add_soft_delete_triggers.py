"""Add soft delete triggers

Revision ID: 003_add_soft_delete_triggers
Revises: 002_add_indexes
Create Date: 2024-01-03 00:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '003_add_soft_delete_triggers'
down_revision = '002_add_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 트리거 함수 생성
    op.execute("""
        CREATE OR REPLACE FUNCTION soft_delete_trigger()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.is_active = FALSE AND OLD.is_active = TRUE THEN
                NEW.deleted_at = CURRENT_TIMESTAMP;
            ELSIF NEW.is_active = TRUE AND OLD.is_active = FALSE THEN
                NEW.deleted_at = NULL;
            END IF;
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # 트리거 적용
    op.execute("""
        CREATE TRIGGER data_points_soft_delete
        BEFORE UPDATE ON data_points
        FOR EACH ROW
        EXECUTE FUNCTION soft_delete_trigger();
    """)
    
    op.execute("""
        CREATE TRIGGER standard_mappings_soft_delete
        BEFORE UPDATE ON standard_mappings
        FOR EACH ROW
        EXECUTE FUNCTION soft_delete_trigger();
    """)
    
    op.execute("""
        CREATE TRIGGER rulebooks_soft_delete
        BEFORE UPDATE ON rulebooks
        FOR EACH ROW
        EXECUTE FUNCTION soft_delete_trigger();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS rulebooks_soft_delete ON rulebooks")
    op.execute("DROP TRIGGER IF EXISTS standard_mappings_soft_delete ON standard_mappings")
    op.execute("DROP TRIGGER IF EXISTS data_points_soft_delete ON data_points")
    op.execute("DROP FUNCTION IF EXISTS soft_delete_trigger()")
