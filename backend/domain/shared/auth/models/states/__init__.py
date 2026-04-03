from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class LoginRequestState:
    """로그인 요청 DTO"""

    login_id: str
    email: str
    password: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


@dataclass
class UserIdentityState:
    """인증된 사용자 정보 DTO"""

    user_id: str
    company_id: str
    email: str
    name: Optional[str]
    role: str
    department: Optional[str]
    position: Optional[str]
    company_name_ko: Optional[str]
    # companies.group_entity_type: holding | subsidiary | affiliate
    group_entity_type: Optional[str] = None
    is_first_login: bool = False
    must_change_password: bool = False


@dataclass
class UserSessionState:
    """세션 토큰 DTO"""

    session_id: str
    session_token: str
    expires_at: datetime


@dataclass
class LoginResultState:
    """로그인 응답 DTO"""

    success: bool
    message: str
    user: Optional[UserIdentityState] = None
    session: Optional[UserSessionState] = None


@dataclass
class LogoutResultState:
    """로그아웃 응답 DTO"""

    success: bool
    message: str
