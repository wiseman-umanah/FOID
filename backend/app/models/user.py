# pyright: ignore[reportImportCycles]
"""User account model."""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, ClassVar, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .connected_bank import ConnectedBank  # pyright: ignore[reportImportCycles]
    from .consent import Consent  # pyright: ignore[reportImportCycles]
    from .credential import Credential  # pyright: ignore[reportImportCycles]
    from .ledger_entry import LedgerEntry  # pyright: ignore[reportImportCycles]
    from .notification import Notification  # pyright: ignore[reportImportCycles]
    from .refresh_token import RefreshToken  # pyright: ignore[reportImportCycles]
    from .wallet import Wallet  # pyright: ignore[reportImportCycles]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    __tablename__: ClassVar[str] = "users"  # pyright: ignore[reportIncompatibleVariableOverride]

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        primary_key=True,
    )
    first_name: str
    last_name: str
    middle_name: str | None = Field(default=None)
    # Nigerian National Identification Number — required at signup
    nin: str = Field(index=True)
    # Bank Verification Number — collected at KYC (optional until verified)
    bvn: str | None = Field(default=None, index=True)
    # Phone number — collected post-signup (optional until verified)
    phone: str | None = Field(default=None)
    # Residential address — editable by the user
    address: str | None = Field(default=None)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=_now)

    # ── Relationships (navigate from User → children) ──────────────────────
    # Use lazy="selectin" so async sessions can load these without extra awaits.
    credential: Optional["Credential"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"lazy": "selectin"},
    )
    wallet: Optional["Wallet"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"lazy": "selectin"},
    )
    refresh_tokens: list["RefreshToken"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"lazy": "selectin", "cascade": "all, delete-orphan"},
    )
    notifications: list["Notification"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"lazy": "selectin", "cascade": "all, delete-orphan"},
    )
    connected_banks: list["ConnectedBank"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"lazy": "selectin", "cascade": "all, delete-orphan"},
    )
    consents: list["Consent"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"lazy": "selectin", "cascade": "all, delete-orphan"},
    )
    ledger_entries: list["LedgerEntry"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"lazy": "selectin", "cascade": "all, delete-orphan"},
    )
