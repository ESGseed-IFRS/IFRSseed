"""ingest_state: 목록 소스(html vs news.txt) — ETag 비교 대상 URL 정합

Revision ID: 039_ingest_state_list_source
Revises: 038_ingest_state_table
Create Date: 2026-04-03

HEAD는 목록 index.html 과 news.txt 각각에 대해 받고, 저장된 last_list_source 에 맞춰
이전 last_etag 와 비교한다. (이전에는 news.txt ETag 를 저장해 두고 index HEAD 만 비교하는
불일치로 매 폴링마다 전체 크롤이 도는 경우가 있었음.)
"""

from alembic import op

revision = "039_ingest_state_list_source"
down_revision = "038_ingest_state_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE ingest_state
        ADD COLUMN IF NOT EXISTS last_list_source VARCHAR(20)
        """
    )
    op.execute(
        """
        COMMENT ON COLUMN ingest_state.last_list_source IS
        '목록 출처: html | news_txt (ETag 비교 시 HEAD 대상 URL 선택)'
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE ingest_state DROP COLUMN IF EXISTS last_list_source")
