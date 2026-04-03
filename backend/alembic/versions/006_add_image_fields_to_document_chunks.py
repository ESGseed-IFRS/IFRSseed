"""Add image fields to document_chunks table

Revision ID: 006_add_image_fields
Revises: 005_add_document_chunks
Create Date: 2024-01-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '006_add_image_fields'
down_revision = '005_add_document_chunks'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # image_path 컬럼 추가
    op.add_column('document_chunks', 
        sa.Column('image_path', sa.String(length=500), nullable=True))
    
    # image_description 컬럼 추가
    op.add_column('document_chunks', 
        sa.Column('image_description', sa.Text(), nullable=True))
    
    # image_type 컬럼 추가
    op.add_column('document_chunks', 
        sa.Column('image_type', sa.String(length=50), nullable=True))


def downgrade() -> None:
    # 컬럼 삭제 (역순)
    op.drop_column('document_chunks', 'image_type')
    op.drop_column('document_chunks', 'image_description')
    op.drop_column('document_chunks', 'image_path')
