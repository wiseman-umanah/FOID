"""User preferences router.

Endpoints:
  GET   /preferences   — get current user's preferences (creates defaults if not yet seeded)
  PATCH /preferences   — update one or more preference fields
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..config import get_db
from ..core.dependencies import get_current_user
from ..models.user import User
from ..models.user_preferences import UserPreferences

router = APIRouter(prefix="/preferences", tags=["preferences"])


class PreferencesOut(BaseModel):
    two_fa_enabled: bool
    biometric_enabled: bool
    login_alerts_enabled: bool
    notif_verification_alerts: bool
    notif_consent_alerts: bool
    notif_ai_nudges: bool
    notif_weekly_digest: bool


class PreferencesUpdate(BaseModel):
    two_fa_enabled: bool | None = None
    biometric_enabled: bool | None = None
    login_alerts_enabled: bool | None = None
    notif_verification_alerts: bool | None = None
    notif_consent_alerts: bool | None = None
    notif_ai_nudges: bool | None = None
    notif_weekly_digest: bool | None = None


async def _get_or_create(user: User, db: AsyncSession) -> UserPreferences:
    """Return existing prefs row, or create one with defaults."""
    result = await db.exec(
        select(UserPreferences).where(UserPreferences.user_id == user.id)
    )
    prefs = result.first()
    if prefs is None:
        prefs = UserPreferences(user_id=user.id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
    return prefs


@router.get("", response_model=PreferencesOut)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PreferencesOut:
    """Return the authenticated user's preferences."""
    prefs = await _get_or_create(current_user, db)
    return PreferencesOut.model_validate(prefs, from_attributes=True)


@router.patch("", response_model=PreferencesOut)
async def update_preferences(
    body: PreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PreferencesOut:
    """Update one or more preference fields."""
    prefs = await _get_or_create(current_user, db)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(prefs, field, value)

    db.add(prefs)
    await db.commit()
    await db.refresh(prefs)
    return PreferencesOut.model_validate(prefs, from_attributes=True)
