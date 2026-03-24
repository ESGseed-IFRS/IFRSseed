"""extend mapping_type enum

Revision ID: 008_extend_mapping_type_enum
Revises: 007_add_related_dp_ids
Create Date: 2024-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '008_extend_mapping_type_enum'
down_revision = '007_add_related_dp_ids'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 기존 ENUM 타입에 새 값 추가
    # PostgreSQL에서는 ALTER TYPE으로 새 값을 추가할 수 있음
    op.execute("ALTER TYPE mapping_type_enum ADD VALUE IF NOT EXISTS 'no_mapping'")
    op.execute("ALTER TYPE mapping_type_enum ADD VALUE IF NOT EXISTS 'pending'")
    op.execute("ALTER TYPE mapping_type_enum ADD VALUE IF NOT EXISTS 'auto_suggested'")
    
    # confidence 컬럼을 NULL 허용으로 변경 (pending 상태일 때 NULL 가능)
    op.alter_column('standard_mappings', 'confidence',
                    existing_type=sa.Float(),
                    nullable=True,
                    existing_nullable=False)


def downgrade() -> None:
    # 주의: PostgreSQL ENUM에서 값을 제거하는 것은 복잡함
    # 실제로는 새 ENUM 타입을 생성하고 컬럼을 변경해야 함
    # 여기서는 간단히 원래 상태로 되돌림
    
    # confidence 컬럼을 NOT NULL로 변경 (기본값 0.0 설정)
    op.execute("""
        UPDATE standard_mappings 
        SET confidence = 0.0 
        WHERE confidence IS NULL
    """)
    
    op.alter_column('standard_mappings', 'confidence',
                    existing_type=sa.Float(),
                    nullable=False,
                    existing_nullable=True)
    
    # ENUM 값 제거는 복잡하므로 주석 처리
    # 실제로는 새 ENUM 타입을 생성하고 마이그레이션해야 함
    # op.execute("ALTER TYPE mapping_type_enum DROP VALUE 'no_mapping'")
    # op.execute("ALTER TYPE mapping_type_enum DROP VALUE 'pending'")
    # op.execute("ALTER TYPE mapping_type_enum DROP VALUE 'auto_suggested'")
