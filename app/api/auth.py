from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.schemas.user import UserResponse
from app.services.auth_service import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_or_create_user,
    get_or_create_cf_user,
)
from app.api.deps import get_current_user

from authlib.integrations.starlette_client import OAuth
from jose import JWTError, ExpiredSignatureError

router = APIRouter(prefix="/auth", tags=["auth"])

# OAuth client setup
oauth = OAuth()


def _oauth_callback_url(provider: str) -> str:
    """Build the OAuth callback URL.

    When PUBLIC_URL includes a port (direct backend access), uses /api/v1/ path.
    When PUBLIC_URL has no port (nginx reverse proxy), uses /api/ path (nginx rewrites to /api/v1/).
    Falls back to direct backend URL.
    """
    if settings.PUBLIC_URL:
        base = settings.PUBLIC_URL.rstrip("/")
        from urllib.parse import urlparse
        parsed = urlparse(base)
        if parsed.port:
            # Direct backend access (e.g. http://localhost:8000) — use full /api/v1/ path
            return f"{base}{settings.API_V1_STR}/auth/{provider}/callback"
        # Through nginx (e.g. http://localhost) — /api/auth/ is rewritten to /api/v1/auth/
        return f"{base}/api/auth/{provider}/callback"
    # No PUBLIC_URL — direct backend access
    return f"http://localhost:8000{settings.API_V1_STR}/auth/{provider}/callback"

if settings.GOOGLE_CLIENT_ID:
    oauth.register(
        name="google",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

if settings.GITHUB_CLIENT_ID:
    oauth.register(
        name="github",
        client_id=settings.GITHUB_CLIENT_ID,
        client_secret=settings.GITHUB_CLIENT_SECRET,
        authorize_url="https://github.com/login/oauth/authorize",
        access_token_url="https://github.com/login/oauth/access_token",
        api_base_url="https://api.github.com/",
        client_kwargs={"scope": "user:email"},
    )


def _set_refresh_cookie(response: Response, token: str):
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/api/v1/auth",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


@router.get("/google")
async def google_login(request: Request):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.")
    redirect_uri = _oauth_callback_url("google")
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo", {})
    if not userinfo:
        userinfo = await oauth.google.userinfo(token=token)

    user = await get_or_create_user(
        db,
        email=userinfo["email"],
        name=userinfo.get("name"),
        avatar_url=userinfo.get("picture"),
        oauth_provider="google",
        oauth_id=str(userinfo["sub"]),
    )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    response = Response(status_code=status.HTTP_302_FOUND)
    response.headers["location"] = f"{settings.FRONTEND_URL}/auth/callback?access_token={access_token}"
    _set_refresh_cookie(response, refresh_token)
    return response


@router.get("/github")
async def github_login(request: Request):
    if not settings.GITHUB_CLIENT_ID:
        raise HTTPException(status_code=501, detail="GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.")
    redirect_uri = _oauth_callback_url("github")
    return await oauth.github.authorize_redirect(request, redirect_uri)


@router.get("/github/callback")
async def github_callback(request: Request, db: AsyncSession = Depends(get_db)):
    token = await oauth.github.authorize_access_token(request)
    resp = await oauth.github.get("user", token=token)
    profile = resp.json()

    # Get email (may need separate call if profile email is null)
    email = profile.get("email")
    if not email:
        emails_resp = await oauth.github.get("user/emails", token=token)
        emails = emails_resp.json()
        primary = next((e for e in emails if e.get("primary")), emails[0] if emails else None)
        email = primary["email"] if primary else f"{profile['id']}@github.noreply.com"

    user = await get_or_create_user(
        db,
        email=email,
        name=profile.get("name") or profile.get("login"),
        avatar_url=profile.get("avatar_url"),
        oauth_provider="github",
        oauth_id=str(profile["id"]),
    )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    response = Response(status_code=status.HTTP_302_FOUND)
    response.headers["location"] = f"{settings.FRONTEND_URL}/auth/callback?access_token={access_token}"
    _set_refresh_cookie(response, refresh_token)
    return response


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


@router.post("/refresh")
async def refresh_tokens(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    try:
        payload = decode_token(refresh_token)
    except (JWTError, ExpiredSignatureError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = int(payload["sub"])
    new_access = create_access_token(user_id)
    new_refresh = create_refresh_token(user_id)
    _set_refresh_cookie(response, new_refresh)
    return {"access_token": new_access, "token_type": "bearer"}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="refresh_token", path="/api/v1/auth")
    return {"message": "Logged out"}


@router.post("/cloudflare-access")
async def cloudflare_access_login(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate via Cloudflare Access JWT.

    Reads the Cf-Access-Jwt-Assertion header injected by Cloudflare,
    validates it against Cloudflare's JWKS, and returns app tokens.
    """
    if not settings.CF_ACCESS_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Cloudflare Access authentication is not enabled",
        )

    cf_token = request.headers.get("Cf-Access-Jwt-Assertion")
    if not cf_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Cf-Access-Jwt-Assertion header",
        )

    from app.services.cf_access_service import validate_cf_access_token

    try:
        payload = await validate_cf_access_token(cf_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Cloudflare Access token",
        )

    email = payload.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No email in Cloudflare Access token",
        )

    user = await get_or_create_cf_user(db, email)

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    _set_refresh_cookie(response, refresh_token)

    return {"access_token": access_token, "token_type": "bearer"}
