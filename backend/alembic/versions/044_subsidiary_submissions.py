"""계열사 데이터 제출 이력 및 staging_*_data에 source_company_id 추가

Revision ID: 044_subsidiary_submissions
Revises: 043_holding_sr_map_sets
Create Date: 2026-04-12
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "044_subsidiary_submissions"
down_revision = "043_holding_sr_map_sets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) subsidiary_data_submissions 테이블 생성
    op.execute(
        """
        CREATE TABLE subsidiary_data_submissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            subsidiary_company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
            holding_company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
            submission_year INT NOT NULL,
            submission_quarter INT,
            submission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            
            -- 제출 데이터 범위
            scope_1_submitted BOOLEAN NOT NULL DEFAULT FALSE,
            scope_2_submitted BOOLEAN NOT NULL DEFAULT FALSE,
            scope_3_submitted BOOLEAN NOT NULL DEFAULT FALSE,
            
            -- 승인 상태
            status VARCHAR(20) NOT NULL DEFAULT 'draft',
            
            -- 검토 정보
            reviewed_by UUID REFERENCES users (id) ON DELETE SET NULL,
            reviewed_at TIMESTAMPTZ,
            rejection_reason TEXT,
            
            -- 메타데이터
            staging_row_count INT NOT NULL DEFAULT 0,
            total_emission_tco2e NUMERIC(15, 4),
            
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            
            CONSTRAINT chk_submission_status 
                CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
            CONSTRAINT chk_submission_year 
                CHECK (submission_year >= 2020 AND submission_year <= 2100),
            CONSTRAINT chk_submission_quarter 
                CHECK (submission_quarter IS NULL OR (submission_quarter >= 1 AND submission_quarter <= 4))
        )
        """
    )
    
    # 인덱스
    op.execute(
        """
        CREATE INDEX idx_submissions_subsidiary 
        ON subsidiary_data_submissions (subsidiary_company_id, submission_year DESC)
        """
    )
    op.execute(
        """
        CREATE INDEX idx_submissions_holding 
        ON subsidiary_data_submissions (holding_company_id, status, submission_year DESC)
        """
    )
    op.execute(
        """
        CREATE INDEX idx_submissions_status 
        ON subsidiary_data_submissions (status, submission_date DESC)
        """
    )
    
    # 2) staging_*_data 테이블에 source_company_id 추가
    staging_tables = [
        "staging_ems_data",
        "staging_erp_data", 
        "staging_ehs_data",
        "staging_plm_data",
        "staging_srm_data",
        "staging_hr_data",
        "staging_mdg_data"
    ]
    
    for table in staging_tables:
        # source_company_id 컬럼 추가
        op.execute(
            f"""
            ALTER TABLE {table}
            ADD COLUMN IF NOT EXISTS source_company_id UUID REFERENCES companies (id) ON DELETE CASCADE
            """
        )
        
        # 기존 데이터 백필: company_id를 source_company_id로 복사
        op.execute(
            f"""
            UPDATE {table}
            SET source_company_id = company_id
            WHERE source_company_id IS NULL
            """
        )
        
        # 인덱스 생성 (스테이징 테이블 타임스탬프 컬럼명은 imported_at)
        op.execute(
            f"""
            CREATE INDEX IF NOT EXISTS idx_{table}_source_company 
            ON {table} (source_company_id, imported_at DESC)
            """
        )
    
    # 3) ghg_emission_results에도 source_company_id 추가 (선택적)
    op.execute(
        """
        ALTER TABLE ghg_emission_results
        ADD COLUMN IF NOT EXISTS source_company_id UUID REFERENCES companies (id) ON DELETE CASCADE
        """
    )
    op.execute(
        """
        UPDATE ghg_emission_results
        SET source_company_id = company_id
        WHERE source_company_id IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_ghg_emission_results_source_company
        ON ghg_emission_results (source_company_id, period_year DESC)
        """
    )


def downgrade() -> None:
    # ghg_emission_results
    op.execute("DROP INDEX IF EXISTS idx_ghg_emission_results_source_company")
    op.execute("ALTER TABLE ghg_emission_results DROP COLUMN IF EXISTS source_company_id")
    
    # staging_*_data
    staging_tables = [
        "staging_ems_data",
        "staging_erp_data",
        "staging_ehs_data",
        "staging_plm_data",
        "staging_srm_data",
        "staging_hr_data",
        "staging_mdg_data"
    ]
    
    for table in staging_tables:
        op.execute(f"DROP INDEX IF EXISTS idx_{table}_source_company")
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS source_company_id")
    
    # subsidiary_data_submissions
    op.execute("DROP TABLE IF EXISTS subsidiary_data_submissions")
