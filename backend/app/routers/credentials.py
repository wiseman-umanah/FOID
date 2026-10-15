"""Credentials router — GET /credentials/me, POST /credentials/trigger, GET /credentials/qr."""

from __future__ import annotations
import io
import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..config import get_db
from ..core.dependencies import get_current_user
from ..models.credential import Credential
from ..models.user import User
from ..schemas.credential import CredentialOut, TriggerRequest, TriggerResponse
from ..schemas.notification import NotificationOut
from ..services.credential_service import apply_trigger

router = APIRouter(prefix="/credentials", tags=["credentials"])


async def _get_credential_or_404(user: User, db: AsyncSession) -> Credential:
    result = await db.exec(select(Credential).where(Credential.user_id == user.id))
    credential = result.first()
    if credential is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")
    return credential


@router.get("/me", response_model=CredentialOut)
async def get_my_credential(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CredentialOut:
    """Return the authenticated user's FOID credential."""
    credential = await _get_credential_or_404(current_user, db)
    return CredentialOut.model_validate(credential)


@router.post("/trigger", response_model=TriggerResponse)
async def trigger_event(
    body: TriggerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TriggerResponse:
    """Apply a trigger event to the credential.

    Returns HTTP 409 if the current state does not satisfy the event's
    requiredState guard.
    """
    credential = await _get_credential_or_404(current_user, db)

    updated_cred, notif = await apply_trigger(
        credential=credential,
        event=body.event,  # type: ignore[arg-type]
        db=db,
    )

    await db.commit()
    await db.refresh(updated_cred)
    await db.refresh(notif)

    return TriggerResponse(
        credential=CredentialOut.model_validate(updated_cred),
        notification=NotificationOut.model_validate(notif),
    )


@router.get("/qr")
async def credential_qr(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Return a QR code PNG encoding a compact JSON summary of the user's credential.

    The QR payload contains only non-sensitive claims — no PII.
    """
    import qrcode  # type: ignore[import-untyped]
    import qrcode.constants  # type: ignore[import-untyped]

    credential = await _get_credential_or_404(current_user, db)

    payload = json.dumps({
        "foid": True,
        "id": credential.id[:16],
        "holder": credential.holder,
        "state": credential.state,
        "claims": {
            "identity_verified":     credential.claims.get("identity_verified", False),
            "bvn_validated":         credential.claims.get("bvn_validated", False),
            "age_over_18":           credential.claims.get("age_over_18", False),
            "income_band":           credential.claims.get("income_band", ""),
            "account_stability":     credential.claims.get("account_stability", ""),
            "repayment_reliability": credential.claims.get("repayment_reliability", ""),
        },
        "issued": credential.issued_at.strftime("%Y-%m-%d"),
    }, separators=(",", ":"))

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=3,
    )
    qr.add_data(payload)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#18181b", back_color="white")
    buf = io.BytesIO()
    img.save(buf)  # type: ignore[call-arg]
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="image/png",
        headers={"Cache-Control": "no-store"},
    )
