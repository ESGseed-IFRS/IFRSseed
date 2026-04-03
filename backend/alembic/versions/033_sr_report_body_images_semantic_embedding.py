"""sr_report_body / sr_report_images: 1024차원 벡터 + 임베딩에 사용한 원문 텍스트

Revision ID: 033_sr_body_images_embedding
Revises: 032_sr_images_placement_bboxes
Create Date: 2026-04-02

- content_embedding / content_embedding_text: 본문 행에 대한 시맨틱 임베딩
- image_embedding / image_embedding_text: 이미지 행(캡션·설명 등)에 대한 시맨틱 임베딩
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "033_sr_body_images_embedding"
down_revision = "032_sr_images_placement_bboxes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.execute("ALTER TABLE sr_report_body ADD COLUMN content_embedding vector(1024)")
    op.add_column(
        "sr_report_body",
        sa.Column("content_embedding_text", sa.Text(), nullable=True),
    )
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_sr_body_content_embedding
        ON sr_report_body
        USING hnsw (content_embedding vector_cosine_ops)
        WHERE content_embedding IS NOT NULL
    """)

    op.execute("ALTER TABLE sr_report_images ADD COLUMN image_embedding vector(1024)")
    op.add_column(
        "sr_report_images",
        sa.Column("image_embedding_text", sa.Text(), nullable=True),
    )
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_sr_images_image_embedding
        ON sr_report_images
        USING hnsw (image_embedding vector_cosine_ops)
        WHERE image_embedding IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_sr_images_image_embedding")
    op.drop_column("sr_report_images", "image_embedding_text")
    op.execute("ALTER TABLE sr_report_images DROP COLUMN IF EXISTS image_embedding")

    op.execute("DROP INDEX IF EXISTS idx_sr_body_content_embedding")
    op.drop_column("sr_report_body", "content_embedding_text")
    op.execute("ALTER TABLE sr_report_body DROP COLUMN IF EXISTS content_embedding")
