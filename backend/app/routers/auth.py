"""Auth router — /api/v1/auth/*

Endpoints
---------
POST /api/v1/auth/signup              Register a new user
POST /api/v1/auth/login               Exchange credentials for tokens
POST /api/v1/auth/refresh             Exchange a refresh token for a new access token
POST /api/v1/auth/logout              Revoke the supplied refresh token
GET  /api/v1/auth/me                  Return the authenticated user's profile
POST /api/v1/auth/me/utility-bill     Upload a utility bill for address verification
"""

from pathlib import Path
from typing import Annotated, cast

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession  # has .exec() unlike sqlalchemy's AsyncSession

from app.config import get_db
from app.core.dependencies import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token_expiry,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models import (
    Consent,
    Credential,
    CredentialClaims,
    DEFAULT_CLAIMS,
    RefreshToken,
    User,
    Wallet,
)
from app.schemas.auth import (
    AddressRequest,
    BvnRequest,
    ChangePasswordRequest,
    LoginRequest,
    PhoneRequest,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    UserOut,
)
from app.utils.limiter import limiter

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# POST /auth/signup
# ---------------------------------------------------------------------------

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
async def signup(
    request: Request,  # pyright: ignore[reportUnusedParameter] — slowapi requires this name
    body: SignupRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Register a new user and return access + refresh tokens.

    Also seeds:
    - A ``Credential`` row (state=active, full claims)
    - A ``Wallet`` row (balance=0)
    - Three demo ``Consent`` rows (pending) so the dashboard is not empty
    """
    # Check email uniqueness
    existing = await db.exec(select(User).where(User.email == body.email))
    if existing.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Pre-hash the password before opening the write transaction so that a
    # slow hash (Argon2) doesn't hold the DB connection idle.
    hashed = hash_password(body.password)
    raw_refresh = generate_refresh_token()

    # --- Single atomic transaction: User + Credential + Wallet + RefreshToken ---
    # get_db yields an AsyncSession whose context manager rolls back on any exception.
    user = User(
        first_name=body.first_name,
        last_name=body.last_name,
        middle_name=body.middle_name,
        nin=body.nin,
        email=body.email,
        hashed_password=hashed,
    )
    db.add(user)
    await db.flush()  # assigns user.id without committing; still inside the transaction

    db.add(Credential(
        user_id=user.id,
        holder=f"{user.first_name} {user.last_name}",
        state="active",
        claims=cast(CredentialClaims, cast(object, dict(DEFAULT_CLAIMS))),
    ))
    db.add(Wallet(user_id=user.id, balance=0))

    # Seed demo consent requests so new users see real data immediately
    from .consents import _seed_demo_consents
    for consent in _seed_demo_consents(user.id):
        db.add(consent)

    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh),
        expires_at=create_refresh_token_expiry(),
    ))

    await db.commit()
    # Tokens are generated AFTER a successful commit — the user is guaranteed
    # to exist in the DB before we hand the client credentials for them.
    access_token = create_access_token(user.id)

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
async def login(
    request: Request,  # pyright: ignore[reportUnusedParameter] — slowapi requires this name
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Validate credentials and return tokens."""
    result = await db.exec(select(User).where(User.email == body.email))
    user = result.first()

    # Constant-time-ish: always verify even if user not found to prevent timing attacks
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(user.id)
    raw_refresh = generate_refresh_token()
    refresh_row = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh),
        expires_at=create_refresh_token_expiry(),
    )
    db.add(refresh_row)
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


# ---------------------------------------------------------------------------
# POST /auth/refresh
# ---------------------------------------------------------------------------

@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
async def refresh(
    request: Request,  # pyright: ignore[reportUnusedParameter] — slowapi requires this name
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Exchange a valid refresh token for a new access token.

    The old refresh token is revoked and a new one is issued (rotation).
    """
    token_hash = hash_refresh_token(body.refresh_token)
    result = await db.exec(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,  # noqa: E712
        )
    )
    row = result.first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked refresh token",
        )

    from datetime import datetime, timezone
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)  # SQLite stores naive datetimes
    if row.expires_at < now_utc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
        )

    # Revoke the old token (rotation)
    row.revoked = True
    db.add(row)

    # Issue new pair
    access_token = create_access_token(row.user_id)
    raw_refresh = generate_refresh_token()
    new_row = RefreshToken(
        user_id=row.user_id,
        token_hash=hash_refresh_token(raw_refresh),
        expires_at=create_refresh_token_expiry(),
    )
    db.add(new_row)
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


# ---------------------------------------------------------------------------
# POST /auth/logout
# ---------------------------------------------------------------------------

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Revoke the supplied refresh token (client should discard both tokens)."""
    token_hash = hash_refresh_token(body.refresh_token)
    result = await db.exec(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    row = result.first()
    if row is not None and not row.revoked:
        row.revoked = True
        db.add(row)
        await db.commit()


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserOut)
async def me(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Return the profile of the currently authenticated user."""
    return user


# ---------------------------------------------------------------------------
# PATCH /auth/me/bvn  — save BVN and flip bvn_validated claim
# ---------------------------------------------------------------------------

@router.patch("/me/bvn", response_model=UserOut)
async def submit_bvn(
    body: BvnRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Store the user's BVN (mocked verification) and mark bvn_validated=True."""
    current_user.bvn = body.bvn
    db.add(current_user)

    # Flip bvn_validated on the credential
    cred_result = await db.exec(
        select(Credential).where(Credential.user_id == current_user.id)
    )
    cred = cred_result.first()
    if cred is not None:
        cred.claims = {**cred.claims, "bvn_validated": True}  # type: ignore[assignment]
        db.add(cred)

    await db.commit()
    await db.refresh(current_user)
    return current_user


# ---------------------------------------------------------------------------
# PATCH /auth/me/phone  — save phone number
# ---------------------------------------------------------------------------

@router.patch("/me/phone", response_model=UserOut)
async def submit_phone(
    body: PhoneRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Store the user's phone number."""
    current_user.phone = body.phone
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user


# ---------------------------------------------------------------------------
# GET /auth/me/identity-summary — server-generated PDF download
# ---------------------------------------------------------------------------

@router.get("/me/identity-summary")
async def identity_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StreamingResponse:
    """Generate and stream a PDF identity summary for the authenticated user."""
    from datetime import datetime, timezone
    from io import BytesIO

    from fpdf import FPDF

    from app.models.connected_bank import ConnectedBank
    from app.models.consent import Consent

    now = datetime.now(timezone.utc)

    # ── Fetch data ────────────────────────────────────────────────────
    cred_result = await db.exec(select(Credential).where(Credential.user_id == current_user.id))
    cred = cred_result.first()

    banks_result = await db.exec(select(ConnectedBank).where(ConnectedBank.user_id == current_user.id))
    banks = banks_result.all()

    consents_result = await db.exec(
        select(Consent).where(Consent.user_id == current_user.id, Consent.status == "approved")
    )
    consents = consents_result.all()

    claims: dict[str, object] = dict(cred.claims) if cred else {}

    nin_masked   = ("****" + current_user.nin[-4:])  if len(current_user.nin or "") >= 4 else "****"
    bvn_masked   = ("****" + (current_user.bvn or "")[-4:]) if current_user.bvn else "Not submitted"
    phone_masked = (current_user.phone[:4] + "****" + current_user.phone[-2:]) if current_user.phone else "Not submitted"

    # ── Build PDF ─────────────────────────────────────────────────────
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    pdf.set_margins(20, 20, 20)

    # ── Header band ───────────────────────────────────────────────────
    pdf.set_fill_color(22, 163, 74)   # brand-500 green
    pdf.rect(0, 0, 210, 28, "F")
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(20, 8)
    pdf.cell(0, 10, "IDRA Identity Summary", ln=False)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_xy(20, 18)
    pdf.cell(0, 6, f"Generated {now.strftime('%d %B %Y, %H:%M UTC')}")

    pdf.set_text_color(31, 35, 40)   # neutral-900
    pdf.set_y(38)

    def section(title: str) -> None:
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_fill_color(243, 244, 246)   # neutral-100
        pdf.cell(0, 8, f"  {title}", ln=True, fill=True)
        pdf.ln(2)

    def row(label: str, value: str) -> None:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(107, 114, 128)   # neutral-500
        pdf.cell(55, 7, label)
        pdf.set_text_color(31, 35, 40)
        pdf.cell(0, 7, value, ln=True)

    # ── Personal details ──────────────────────────────────────────────
    section("Personal Details")
    row("Full name",     f"{current_user.first_name} {current_user.last_name}")
    row("Email",         current_user.email)
    row("NIN",           nin_masked)
    row("BVN",           bvn_masked)
    row("Phone",         phone_masked)
    row("Member since",  current_user.created_at.strftime("%d %B %Y"))
    pdf.ln(4)

    # ── Credential ────────────────────────────────────────────────────
    section("Credential")
    state_label = (cred.state if cred else "unknown").replace("_", " ").title()
    row("State",                state_label)
    row("Identity verified",    "Yes" if claims.get("identity_verified") else "No")
    row("BVN validated",        "Yes" if claims.get("bvn_validated") else "No")
    row("Account stability",    str(claims.get("account_stability", "-")).title())
    row("Repayment reliability", str(claims.get("repayment_reliability", "-")).title())
    if cred:
        row("Issued",           cred.issued_at.strftime("%d %B %Y"))
        row("Last updated",     cred.updated_at.strftime("%d %B %Y"))
    pdf.ln(4)

    # ── Connected banks ───────────────────────────────────────────────
    if banks:
        section("Connected Banks")
        for b in banks:
            acct = f" ({b.account_type})" if b.account_type else ""
            row(b.name + acct, b.status.title())
        pdf.ln(4)

    # ── Approved consents ─────────────────────────────────────────────
    if consents:
        section("Approved Consents")
        for c in consents:
            row(c.platform, c.scope)
        pdf.ln(4)

    # ── Footer ────────────────────────────────────────────────────────
    pdf.set_y(-20)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(156, 163, 175)
    pdf.cell(0, 6, "This document is system-generated by IDRA · Identity & Digital Risk Assessment", align="C")

    # ── Stream bytes ──────────────────────────────────────────────────
    buf = BytesIO(pdf.output())
    filename = f"IDRA_Identity_{current_user.first_name}_{current_user.last_name}.pdf"

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# PATCH /auth/me/address  — save residential address
# ---------------------------------------------------------------------------

@router.patch("/me/address", response_model=UserOut)
async def update_address(
    body: AddressRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Store the user's residential address."""
    current_user.address = body.address
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user


# ---------------------------------------------------------------------------
# PATCH /auth/me/password  — change password
# ---------------------------------------------------------------------------

@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Verify current password then hash and store the new one."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.hashed_password = hash_password(body.new_password)
    db.add(current_user)
    await db.commit()


# ---------------------------------------------------------------------------
# POST /auth/me/utility-bill  — upload address-verification document
# ---------------------------------------------------------------------------

_UTILITY_DIR = Path("uploads/utility_bills")
_MAX_UTILITY_BYTES = 10 * 1024 * 1024  # 10 MB
_ALLOWED_UTILITY_MIME = {"image/jpeg", "image/png", "image/webp", "application/pdf"}


@router.post("/me/utility-bill", status_code=status.HTTP_204_NO_CONTENT)
async def upload_utility_bill(
    file: Annotated[UploadFile, File(description="Utility bill image or PDF, max 10 MB")],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Accept and store a utility bill for address verification.

    The file is saved to disk; a manual review step would follow in production.
    Returns 204 on success — no body.
    """
    import uuid as _uuid

    if file.content_type not in _ALLOWED_UTILITY_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: JPEG, PNG, WebP, PDF",
        )

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_UTILITY_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large — maximum 10 MB",
        )

    _UTILITY_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "bill").suffix or ".bin"
    dest = _UTILITY_DIR / f"{current_user.id}_{_uuid.uuid4()}{ext}"
    dest.write_bytes(file_bytes)
