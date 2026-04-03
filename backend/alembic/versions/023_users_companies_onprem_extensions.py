"""Extend users and companies for on-prem tenant login and group structure.

- companies: company_login_id, company_password_hash, group_entity_type, parent_company_id
  (DATABASE_TABLES_STRUCTURE.md — 회사 계정, 지주사/계열사/자회사 구분)
- users: company_id, name, permission, password_hash (문서의 온프레미스 사용자 스키마 정합)

기존 019 부트스트랩의 최소 companies/users 행에 대해 백필 후 NOT NULL 적용.

Revision ID: 023_users_companies_onprem
Revises: 022_rulebooks_paragraph_ref_200
Create Date: 2026-03-30
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql

revision = "023_users_companies_onprem"
down_revision = "022_rulebooks_paragraph_ref_200"
branch_labels = None
depends_on = None

# bcrypt("password") — 마이그레이션 직후 반드시 운영 정책에 따라 재설정할 것
_PLACEHOLDER_PASSWORD_HASH = (
    "$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi"
)


def _cols(table: str) -> set[str]:
    bind = op.get_bind()
    insp = inspect(bind)
    if not insp.has_table(table):
        return set()
    return {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    c_companies = _cols("companies")
    c_users = _cols("users")

    # ----- companies -----
    if c_companies:
        if "group_entity_type" not in c_companies:
            op.add_column(
                "companies",
                sa.Column(
                    "group_entity_type",
                    sa.Text(),
                    server_default=sa.text("'subsidiary'"),
                    nullable=False,
                ),
            )
            chk_co = {x["name"] for x in inspect(bind).get_check_constraints("companies")}
            if "chk_companies_group_entity_type" not in chk_co:
                op.create_check_constraint(
                    "chk_companies_group_entity_type",
                    "companies",
                    "group_entity_type IN ('holding', 'affiliate', 'subsidiary')",
                )

        if "parent_company_id" not in c_companies:
            op.add_column(
                "companies",
                sa.Column("parent_company_id", postgresql.UUID(as_uuid=True), nullable=True),
            )
            op.create_foreign_key(
                "fk_companies_parent_company_id",
                "companies",
                "companies",
                ["parent_company_id"],
                ["id"],
                ondelete="SET NULL",
            )

        if "company_login_id" not in c_companies:
            op.add_column("companies", sa.Column("company_login_id", sa.Text(), nullable=True))
        if "company_password_hash" not in c_companies:
            op.add_column("companies", sa.Column("company_password_hash", sa.Text(), nullable=True))

        # 백필: 로그인 ID = co_{uuid_without_dashes}, 비밀번호는 플레이스홀더
        bind.execute(
            text(
                """
                UPDATE companies
                SET company_login_id = 'co_' || REPLACE(CAST(id AS TEXT), '-', '')
                WHERE company_login_id IS NULL
                """
            )
        )
        bind.execute(
            text(
                """
                UPDATE companies
                SET company_password_hash = :h
                WHERE company_password_hash IS NULL
                """
            ),
            {"h": _PLACEHOLDER_PASSWORD_HASH},
        )

        if "company_login_id" in _cols("companies"):
            op.alter_column("companies", "company_login_id", existing_type=sa.Text(), nullable=False)
        if "company_password_hash" in _cols("companies"):
            op.alter_column(
                "companies",
                "company_password_hash",
                existing_type=sa.Text(),
                nullable=False,
            )

        op.execute(text("ALTER TABLE companies ALTER COLUMN group_entity_type DROP DEFAULT"))

        # 인덱스·유니크 (이미 있으면 스킵)
        insp = inspect(bind)
        existing_ix = {ix["name"] for ix in insp.get_indexes("companies")}
        if "idx_companies_login" not in existing_ix:
            op.create_index("idx_companies_login", "companies", ["company_login_id"], unique=True)
        if "idx_companies_group_type" not in existing_ix:
            op.create_index("idx_companies_group_type", "companies", ["group_entity_type"], unique=False)
        if "idx_companies_parent" not in existing_ix:
            op.create_index("idx_companies_parent", "companies", ["parent_company_id"], unique=False)

    # ----- users -----
    if c_users:
        has_companies_tbl = inspect(bind).has_table("companies")

        if "company_id" not in c_users and has_companies_tbl:
            op.add_column(
                "users",
                sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
            )
            op.create_foreign_key(
                "fk_users_company_id",
                "users",
                "companies",
                ["company_id"],
                ["id"],
                ondelete="CASCADE",
            )

        if "password_hash" not in c_users:
            op.add_column("users", sa.Column("password_hash", sa.Text(), nullable=True))
        if "name" not in c_users:
            op.add_column("users", sa.Column("name", sa.Text(), nullable=True))
        if "permission" not in c_users:
            if "role" in c_users:
                op.add_column("users", sa.Column("permission", sa.Text(), nullable=True))
                bind.execute(
                    text(
                        """
                        UPDATE users SET permission = CASE
                          WHEN role = 'final_approver' THEN 'reviewer'
                          WHEN role = 'esg_team' THEN 'reviewer'
                          WHEN role = 'dept_user' THEN 'author'
                          WHEN role = 'viewer' THEN 'viewer'
                          ELSE 'viewer'
                        END
                        """
                    )
                )
                op.drop_column("users", "role")
            else:
                op.add_column(
                    "users",
                    sa.Column(
                        "permission",
                        sa.Text(),
                        server_default=sa.text("'viewer'"),
                        nullable=False,
                    ),
                )

        # company_id 백필: 회사가 있으면 첫 번째 회사에 연결
        if has_companies_tbl:
            bind.execute(
                text(
                    """
                    UPDATE users u
                    SET company_id = s.cid
                    FROM (SELECT id AS cid FROM companies ORDER BY created_at NULLS LAST LIMIT 1) s
                    WHERE u.company_id IS NULL
                      AND EXISTS (SELECT 1 FROM companies)
                    """
                )
            )

        bind.execute(
            text(
                """
                UPDATE users
                SET name = COALESCE(
                    NULLIF(TRIM(SPLIT_PART(COALESCE(email, ''), '@', 1)), ''),
                    'user_' || REPLACE(CAST(id AS TEXT), '-', '')
                )
                WHERE name IS NULL
                """
            )
        )

        bind.execute(
            text(
                """
                UPDATE users
                SET password_hash = :h
                WHERE password_hash IS NULL
                """
            ),
            {"h": _PLACEHOLDER_PASSWORD_HASH},
        )

        # permission: role에서 온 경우 이미 채움; 나머지 기본값
        if "permission" in _cols("users"):
            bind.execute(
                text(
                    """
                    UPDATE users
                    SET permission = 'viewer'
                    WHERE permission IS NULL
                    """
                )
            )

        c_users_after = _cols("users")
        if "name" in c_users_after:
            op.alter_column("users", "name", existing_type=sa.Text(), nullable=False)
        if "password_hash" in c_users_after:
            op.alter_column("users", "password_hash", existing_type=sa.Text(), nullable=False)
        if "permission" in c_users_after:
            op.alter_column("users", "permission", existing_type=sa.Text(), nullable=False)
            op.execute(text("ALTER TABLE users ALTER COLUMN permission DROP DEFAULT"))

        # company_id NOT NULL — 회사가 있고 모두 백필된 경우에만
        row = bind.execute(
            text(
                """
                SELECT
                  (SELECT COUNT(*) FROM companies) AS cc,
                  (SELECT COUNT(*) FROM users WHERE company_id IS NULL) AS unassigned
                """
            )
        ).mappings().first()
        if row and row["cc"] and row["unassigned"] == 0 and "company_id" in _cols("users"):
            op.alter_column("users", "company_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)

        insp = inspect(bind)
        existing_ix_u = {ix["name"] for ix in insp.get_indexes("users")}
        if "idx_users_company" not in existing_ix_u and "company_id" in _cols("users"):
            op.create_index("idx_users_company", "users", ["company_id"], unique=False)
        if "idx_users_email" not in existing_ix_u and "email" in _cols("users"):
            op.create_index("idx_users_email", "users", ["email"], unique=False)
        if "idx_users_name_company" not in existing_ix_u and "company_id" in _cols("users") and "name" in _cols("users"):
            op.create_index(
                "idx_users_name_company",
                "users",
                ["company_id", "name"],
                unique=False,
            )
        if "idx_users_permission" not in existing_ix_u and "company_id" in _cols("users") and "permission" in _cols("users"):
            op.create_index(
                "idx_users_permission",
                "users",
                ["company_id", "permission"],
                unique=False,
            )

        if "permission" in _cols("users"):
            u_chk = {x["name"] for x in inspect(bind).get_check_constraints("users")}
            if "chk_user_permission" not in u_chk:
                op.create_check_constraint(
                    "chk_user_permission",
                    "users",
                    "permission IN ('author', 'reviewer', 'viewer')",
                )


def downgrade() -> None:
    bind = op.get_bind()
    if not inspect(bind).has_table("users"):
        pass
    else:
        c = _cols("users")
        insp = inspect(bind)
        ix = {i["name"] for i in insp.get_indexes("users")}
        for name in (
            "idx_users_permission",
            "idx_users_name_company",
            "idx_users_email",
            "idx_users_company",
        ):
            if name in ix:
                op.drop_index(name, table_name="users")

        if "chk_user_permission" in {x["name"] for x in insp.get_check_constraints("users")}:
            op.drop_constraint("chk_user_permission", "users", type_="check")

        if "fk_users_company_id" in {f["name"] for f in insp.get_foreign_keys("users")}:
            op.drop_constraint("fk_users_company_id", "users", type_="foreignkey")

        for col in ("permission", "name", "password_hash", "company_id"):
            if col in c:
                op.drop_column("users", col)

        # role 복구는 데이터 복원 불가 — 필요 시 수동 마이그레이션

    if not inspect(bind).has_table("companies"):
        return

    c = _cols("companies")
    insp = inspect(bind)
    ix = {i["name"] for i in insp.get_indexes("companies")}
    for name in ("idx_companies_parent", "idx_companies_group_type", "idx_companies_login"):
        if name in ix:
            op.drop_index(name, table_name="companies")

    if "fk_companies_parent_company_id" in {f["name"] for f in insp.get_foreign_keys("companies")}:
        op.drop_constraint("fk_companies_parent_company_id", "companies", type_="foreignkey")

    if "chk_companies_group_entity_type" in {x["name"] for x in insp.get_check_constraints("companies")}:
        op.drop_constraint("chk_companies_group_entity_type", "companies", type_="check")

    for col in ("company_password_hash", "company_login_id", "parent_company_id", "group_entity_type"):
        if col in c:
            op.drop_column("companies", col)
