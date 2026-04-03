from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.core.db import get_session


class AuthRepository:
    """인증 관련 DB 접근 레이어"""

    def __init__(self, db: Optional[Session] = None) -> None:
        self._external_db = db

    def _session(self) -> Session:
        return self._external_db or get_session()

    def get_user_with_company_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        db = self._session()
        try:
            row = db.execute(
                text(
                    """
                    SELECT
                      u.id,
                      u.company_id,
                      u.email,
                      u.name,
                      COALESCE(u.permission, 'viewer') AS role,
                      c.name AS company_name_ko,
                      c.group_entity_type,
                      c.company_login_id,
                      c.company_password_hash
                    FROM users u
                    LEFT JOIN companies c ON c.id = u.company_id
                    WHERE lower(u.email) = lower(:email)
                    LIMIT 1
                    """
                ),
                {"email": email},
            ).mappings().first()
            return dict(row) if row else None
        finally:
            if not self._external_db:
                db.close()

    def update_last_login(self, user_id: str) -> None:
        db = self._session()
        try:
            db.execute(
                text(
                    """
                    UPDATE users
                    SET last_login_at = NOW(), updated_at = NOW()
                    WHERE id = :user_id
                    """
                ),
                {"user_id": user_id},
            )
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            if not self._external_db:
                db.close()

    def create_session(
        self,
        *,
        user_id: str,
        company_id: str,
        session_token: str,
        expires_at: datetime,
        ip_address: Optional[str],
        user_agent: Optional[str],
        device_type: str = "desktop",
    ) -> str:
        db = self._session()
        session_id = str(uuid4())
        try:
            db.execute(
                text(
                    """
                    INSERT INTO user_sessions (
                      id, user_id, company_id, session_token, refresh_token,
                      is_active, expires_at, ip_address, user_agent, device_type,
                      created_at, last_activity_at
                    ) VALUES (
                      :id, :user_id, :company_id, :session_token, NULL,
                      TRUE, :expires_at, :ip_address, :user_agent, :device_type,
                      NOW(), NOW()
                    )
                    """
                ),
                {
                    "id": session_id,
                    "user_id": user_id,
                    "company_id": company_id,
                    "session_token": session_token,
                    "expires_at": expires_at,
                    "ip_address": ip_address,
                    "user_agent": user_agent,
                    "device_type": device_type,
                },
            )
            db.commit()
            return session_id
        except Exception:
            db.rollback()
            raise
        finally:
            if not self._external_db:
                db.close()

    def deactivate_session_by_token(self, session_token: str) -> int:
        """세션 토큰에 해당하는 활성 세션을 비활성화. 반환: 갱신된 행 수."""
        if not (session_token or "").strip():
            return 0
        db = self._session()
        try:
            result = db.execute(
                text(
                    """
                    UPDATE user_sessions
                    SET is_active = FALSE, last_activity_at = NOW()
                    WHERE session_token = :session_token AND is_active = TRUE
                    """
                ),
                {"session_token": session_token.strip()},
            )
            db.commit()
            return int(result.rowcount or 0)
        except Exception:
            db.rollback()
            raise
        finally:
            if not self._external_db:
                db.close()
