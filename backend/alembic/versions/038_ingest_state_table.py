"""ingest_state table for crawl change detection

Revision ID: 038_ingest_state_table
Revises: 037_subs_ext_company_data
Create Date: 2026-04-03

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "038_ingest_state_table"
down_revision = "037_subs_ext_company_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create ingest_state table for tracking crawl state and change detection."""
    op.execute("""
        CREATE TABLE ingest_state (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            task_key VARCHAR(100) NOT NULL UNIQUE,
            last_etag TEXT,
            last_modified TEXT,
            last_content_hash TEXT,
            last_fetch_at TIMESTAMPTZ,
            last_ingest_batch_id UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX idx_ingest_state_task_key ON ingest_state (task_key)")
    
    # Add comment
    op.execute("""
        COMMENT ON TABLE ingest_state IS 
        '크롤·적재 상태 추적 (변경 감지용 ETag/Last-Modified 저장)'
    """)


def downgrade() -> None:
    """Drop ingest_state table."""
    op.execute("DROP TABLE IF EXISTS ingest_state CASCADE")
