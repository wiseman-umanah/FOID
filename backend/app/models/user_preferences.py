# pyright: ignore[reportImportCycles]
"""UserPreferences model — one row per user, stores notification and security toggles.

ON DELETE CASCADE: deleting a User removes this row.
"""

from typing import TYPE_CHECKING, ClassVar, Optional

from sqlalchemy import ForeignKey, String
from sqlmodel import Column, Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .user import User  # pyright: ignore[reportImportCycles]


class UserPreferences(SQLModel, table=True):
    __tablename__: ClassVar[str] = "user_preferences"  # pyright: ignore[reportIncompatibleVariableOverride]

    # One row per user — user_id is both PK and FK
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        )
    )

    # ── Security ──────────────────────────────────────────────────────────
    two_fa_enabled: bool = Field(default=True)
    biometric_enabled: bool = Field(default=True)
    login_alerts_enabled: bool = Field(default=True)

    # ── Notification preferences ──────────────────────────────────────────
    notif_verification_alerts: bool = Field(default=True)
    notif_consent_alerts: bool = Field(default=True)
    notif_ai_nudges: bool = Field(default=True)
    notif_weekly_digest: bool = Field(default=False)

    # ── Relationship ──────────────────────────────────────────────────────
    user: Optional["User"] = Relationship(
        back_populates="preferences",
        sa_relationship_kwargs={"lazy": "selectin"},
    )
