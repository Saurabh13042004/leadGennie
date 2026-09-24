from __future__ import annotations

import hashlib
import hmac
import time

from fastapi import Request

from app.config import Settings
from app.contracts.common import ErrorCode
from app.errors import EngineError


def sign(secret: str, timestamp: str, method: str, path: str, body: bytes) -> str:
    """HMAC-SHA256 over `timestamp.METHOD.path.body` (path includes the query string)."""
    message = b".".join([timestamp.encode(), method.upper().encode(), path.encode(), body])
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def _unauth(message: str) -> EngineError:
    return EngineError(ErrorCode.UNAUTHENTICATED, message)


async def require_auth(request: Request) -> None:
    """Bearer token + HMAC signature with a bounded clock skew. Two secrets are accepted during rotation."""
    settings: Settings = request.app.state.container.settings
    if not settings.intelligence_service_token or not settings.signing_secrets:
        # Fail closed: a deployment without credentials configured must not serve requests.
        raise EngineError(ErrorCode.UNAVAILABLE, "Service authentication is not configured")

    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(token, settings.intelligence_service_token):
        raise _unauth("Invalid credentials")

    timestamp = request.headers.get("x-lg-timestamp", "")
    signature = request.headers.get("x-lg-signature", "")
    try:
        skew = abs(time.time() - float(timestamp))
    except ValueError:
        raise _unauth("Invalid timestamp") from None
    if skew > settings.auth_max_skew_seconds:
        raise _unauth("Request timestamp outside the allowed window")

    body = await request.body()
    path = request.url.path + (f"?{request.url.query}" if request.url.query else "")
    for secret in settings.signing_secrets:
        expected = sign(secret, timestamp, request.method, path, body)
        if hmac.compare_digest(signature, expected):
            return
    raise _unauth("Invalid signature")
