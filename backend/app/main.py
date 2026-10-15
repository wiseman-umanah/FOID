#!/usr/bin/python3

from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .config import check_db, get_settings, init_db
from .routers import *
from .utils.cache import ping as redis_ping
from .utils.limiter import limiter


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    # In dev, auto-create tables for convenience.
    # In production, schema is managed by Alembic — skip create_all.
    if settings.ENV != "production":
        await init_db()
    db_ok = await check_db()
    redis_ok = await redis_ping()
    print(f"  Database : {'✓ connected' if db_ok else '✗ unreachable'}")
    print(f"  Redis    : {'✓ connected' if redis_ok else '✗ unreachable (cache disabled)'}")
    yield


settings = get_settings()

app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler,  # pyright: ignore[reportArgumentType]
)

allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def read_root():
    return {"message": "Hello world"}


@app.get("/health")
async def health_check():
    """Health check endpoint for production monitoring."""
    ok = await check_db()
    if ok:
        return {"status": "healthy", "database": "connected"}
    return {"status": "unhealthy", "database": "unreachable"}


# ---------------------------------------------------------------------------
# API Version 1 Router — all feature routers attach here
# ---------------------------------------------------------------------------
v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(auth_router)
v1_router.include_router(banks_router)
v1_router.include_router(consents_router)
v1_router.include_router(credentials_router)
v1_router.include_router(ledger_router)
v1_router.include_router(notifications_router)
v1_router.include_router(preferences_router)
v1_router.include_router(reports_router)
v1_router.include_router(wallet_router)

app.include_router(v1_router)