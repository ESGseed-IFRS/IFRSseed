"""sr_report_images: 페이지 내 이미지 배치 좌표 placement_bboxes (JSONB)

Revision ID: 032_sr_images_placement_bboxes
Revises: 031_sr_body_subtitle
Create Date: 2026-04-02

각 항목은 PyMuPDF 페이지 좌표계의 사각형 [x0, y0, x1, y1] 리스트.
동일 xref가 여러 번 배치되면 배열 길이 > 1.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "032_sr_images_placement_bboxes"
down_revision = "031_sr_body_subtitle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sr_report_images",
        sa.Column("placement_bboxes", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sr_report_images", "placement_bboxes")
