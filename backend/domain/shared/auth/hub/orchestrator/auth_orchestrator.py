from __future__ import annotations

from typing import Optional

from backend.domain.shared.auth.hub.services.auth_service import AuthService
from backend.domain.shared.auth.models.states import (
    LoginRequestState,
    LoginResultState,
    LogoutResultState,
)


class AuthOrchestrator:
    """Auth 허브 오케스트레이션 레이어"""

    def __init__(self, service: Optional[AuthService] = None) -> None:
        self.service = service or AuthService()

    def execute_login(self, payload: LoginRequestState) -> LoginResultState:
        return self.service.login(payload)

    def execute_logout(self, session_token: Optional[str]) -> LogoutResultState:
        return self.service.logout(session_token)
