from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from backend.domain.shared.auth.hub.repositories.auth_repository import AuthRepository
from backend.domain.shared.auth.models.states import (
    LoginRequestState,
    LoginResultState,
    LogoutResultState,
    UserIdentityState,
    UserSessionState,
)

try:
    import bcrypt  # type: ignore
except ImportError:  # pragma: no cover - 런타임 환경 의존
    bcrypt = None


class AuthService:
    """인증 비즈니스 로직 레이어"""

    def __init__(self, repository: Optional[AuthRepository] = None) -> None:
        self.repository = repository or AuthRepository()

    def login(self, payload: LoginRequestState) -> LoginResultState:
        user_row = self.repository.get_user_with_company_by_email(payload.email)
        if not user_row:
            return LoginResultState(success=False, message="등록되지 않은 이메일입니다.")

        company_login_id = str(user_row.get("company_login_id") or "").strip()
        if not company_login_id or payload.login_id.strip() != company_login_id:
            return LoginResultState(success=False, message="아이디가 일치하지 않습니다.")

        company_password_hash = str(user_row.get("company_password_hash") or "")
        if not company_password_hash:
            return LoginResultState(success=False, message="회사 계정 비밀번호가 설정되지 않았습니다.")

        if not self._verify_password(payload.password, company_password_hash):
            return LoginResultState(success=False, message="비밀번호가 일치하지 않습니다.")

        session_token = self._generate_session_token()
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        session_id = self.repository.create_session(
            user_id=str(user_row["id"]),
            company_id=str(user_row["company_id"]),
            session_token=session_token,
            expires_at=expires_at,
            ip_address=payload.ip_address,
            user_agent=payload.user_agent,
        )
        self.repository.update_last_login(str(user_row["id"]))

        user_state = UserIdentityState(
            user_id=str(user_row["id"]),
            company_id=str(user_row["company_id"]),
            email=str(user_row["email"]),
            name=user_row.get("name"),
            role=str(user_row.get("role") or "viewer"),
            department=None,
            position=None,
            company_name_ko=user_row.get("company_name_ko"),
            group_entity_type=(
                str(user_row["group_entity_type"]).strip()
                if user_row.get("group_entity_type")
                else None
            ),
            is_first_login=False,
            must_change_password=False,
        )
        session_state = UserSessionState(
            session_id=session_id,
            session_token=session_token,
            expires_at=expires_at,
        )

        return LoginResultState(
            success=True,
            message="로그인에 성공했습니다.",
            user=user_state,
            session=session_state,
        )

    def logout(self, session_token: Optional[str]) -> LogoutResultState:
        """쿠키 세션을 DB에서 비활성화. 토큰이 없어도 성공(멱등)으로 처리."""
        token = (session_token or "").strip()
        if token:
            self.repository.deactivate_session_by_token(token)
        return LogoutResultState(success=True, message="로그아웃되었습니다.")

    @staticmethod
    def _generate_session_token() -> str:
        return secrets.token_urlsafe(48)

    @staticmethod
    def _verify_password(plain_password: str, stored_password_hash: str) -> bool:
        if stored_password_hash.startswith("$2"):
            if not bcrypt:
                return False
            try:
                return bcrypt.checkpw(
                    plain_password.encode("utf-8"),
                    stored_password_hash.encode("utf-8"),
                )
            except ValueError:
                return False
        # 데모/초기 데이터 호환: 평문 저장 시 직접 비교
        return plain_password == stored_password_hash
