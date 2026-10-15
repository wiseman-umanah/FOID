"""Shared pytest fixtures for the FOID backend test suite.

Strategy
--------
- Each test *session* gets a fresh in-memory SQLite database (not the dev foid.db).
- The FastAPI app's `get_db` dependency is overridden to use that DB.
- `get_settings()` is cleared before the session so the in-memory URL takes effect.
- A module-scoped `async_client` fixture provides an authenticated HTTP client
  (signed up + logged in) for tests that need auth.
- `anon_client` provides a bare client with no auth headers.
"""

import os
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

# Point at in-memory SQLite BEFORE the app is imported so get_settings() picks it up.
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["ENV"] = "test"
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-only"

# Now import the app (after env is set)
import app.config as _cfg  # noqa: E402

# Clear the lru_cache so the test settings are used
_cfg.get_settings.cache_clear()
_cfg._engine = None
_cfg._session_factory = None

from app.main import app  # noqa: E402  — imported after env override


# ---------------------------------------------------------------------------
# DB fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="session")
async def test_engine():
    """One shared in-memory engine for the whole test session."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    # Import all models so their tables are registered on SQLModel.metadata
    import app.models  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture(scope="session")
def test_session_factory(test_engine):
    return async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


@pytest.fixture(autouse=True, scope="session")
def override_get_db(test_session_factory):
    """Replace get_db with the test session factory for the whole session."""
    async def _get_test_db():
        async with test_session_factory() as session:
            yield session

    app.dependency_overrides[_cfg.get_db] = _get_test_db
    yield
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# HTTP client fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
async def anon_client(test_engine):  # noqa: ARG001 — ensures DB is ready
    """Unauthenticated async client. Never carries an Authorization header."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


_SIGNUP_PAYLOAD = {
    "first_name": "Test",
    "last_name": "User",
    "nin": "12345678901",
    "email": "test@foid.ng",
    "password": "Secure@123",
}


@pytest.fixture(scope="session")
async def auth_client(test_engine):  # noqa: ARG001 — ensures DB is ready
    """Separate client pre-loaded with a valid Bearer token (signup → login).

    Uses its own AsyncClient so that anon_client never gets an auth header.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/v1/auth/signup", json=_SIGNUP_PAYLOAD)
        assert r.status_code == 201, r.text
        token = r.json()["access_token"]
        c.headers.update({"Authorization": f"Bearer {token}"})
        yield c
