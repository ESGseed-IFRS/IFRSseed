from __future__ import annotations

from dataclasses import asdict
from datetime import timedelta
import logging
from typing import Optional

from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel, Field

from backend.domain.shared.auth.hub.orchestrator.auth_orchestrator import AuthOrchestrator
from backend.domain.shared.auth.models.states import LoginRequestState, LogoutResultState

router = APIRouter(prefix="/auth", tags=["Auth"])
orchestrator = AuthOrchestrator()
logger = logging.getLogger(__name__)


class LoginRequestBody(BaseModel):
    loginId: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=200)


@router.post("/login")
def login(body: LoginRequestBody, request: Request, response: Response) -> dict:
    logger.info(
        "POST /auth/login payload=%s",
        {
            "loginId": body.loginId,
            "email": body.email,
            "password": body.password,
        },
    )

    if "@" not in body.email:
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {"success": False, "message": "올바른 이메일 형식이 아닙니다."}

    client_host: Optional[str] = request.client.host if request.client else None
    payload = LoginRequestState(
        login_id=body.loginId,
        email=body.email,
        password=body.password,
        ip_address=client_host,
        user_agent=request.headers.get("user-agent"),
    )
    result = orchestrator.execute_login(payload)
    if not result.success or not result.user or not result.session:
        response.status_code = status.HTTP_401_UNAUTHORIZED
        return {"success": False, "message": result.message}

    max_age = int(timedelta(days=7).total_seconds())
    response.set_cookie(
        key="session_token",
        value=result.session.session_token,
        max_age=max_age,
        httponly=True,
        secure=False,  # 로컬 개발 편의. HTTPS 운영에서는 True 권장
        samesite="lax",
        path="/",
    )
    return {
        "success": True,
        "message": result.message,
        "user": asdict(result.user),
        "session": {
            "session_id": result.session.session_id,
            "expires_at": result.session.expires_at.isoformat(),
        },
    }


@router.post("/logout")
def logout(request: Request, response: Response) -> dict:
    """세션 쿠키 무효화 및 DB에서 user_sessions 비활성화."""
    token = request.cookies.get("session_token")
    try:
        result = orchestrator.execute_logout(token)
    except Exception:
        logger.exception("POST /auth/logout DB 처리 실패 — 쿠키는 제거합니다")
        result = LogoutResultState(success=True, message="로그아웃되었습니다.")

    response.delete_cookie(
        key="session_token",
        path="/",
        secure=False,
        httponly=True,
        samesite="lax",
    )
    logger.info("POST /auth/logout session_in_cookie=%s", bool(token and token.strip()))
    return {"success": result.success, "message": result.message}
