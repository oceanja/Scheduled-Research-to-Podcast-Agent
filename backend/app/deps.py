from __future__ import annotations

from uuid import UUID

import jwt
from fastapi import Header, HTTPException, status
from jwt import PyJWKClient

from app.config import get_settings


class CurrentUser:
    """A verified Supabase user, extracted from the Authorization header."""

    def __init__(self, user_id: UUID, email: str | None) -> None:
        self.id = user_id
        self.email = email


_jwks_client: PyJWKClient | None = None


def _jwks() -> PyJWKClient:
    """Lazy JWKS client for ES256-signed tokens (newer Supabase projects)."""
    global _jwks_client
    if _jwks_client is None:
        settings = get_settings()
        url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(url, cache_jwk_set=True, lifespan=3600)
    return _jwks_client


async def current_user(
    authorization: str | None = Header(default=None),
) -> CurrentUser:
    """Verify a Supabase JWT and return the user.

    Supabase has two flavours of JWT:
      - Legacy symmetric (HS256) signed with the project's JWT secret.
      - Modern asymmetric (ES256/RS256) with keys exposed at JWKS.
    We auto-detect from the token header and verify either way.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    settings = get_settings()

    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if alg == "HS256":
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        else:
            signing_key = _jwks().get_signing_key_from_jwt(token).key
            payload = jwt.decode(
                token,
                signing_key,
                algorithms=[alg],
                audience="authenticated",
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token expired")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid token: {exc}")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token missing sub")

    try:
        user_id = UUID(sub)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "sub is not a UUID")

    return CurrentUser(user_id=user_id, email=payload.get("email"))
