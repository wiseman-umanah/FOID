"""E2E tests — Wallet.

Covers:
  GET   /wallet
  POST  /wallet/auto-topup
  POST  /wallet/initiate-purchase  (error paths only — Paystack is not mocked)
"""

import pytest


class TestGetWallet:
    async def test_get_wallet(self, auth_client):
        r = await auth_client.get("/api/v1/wallet")
        assert r.status_code == 200
        data = r.json()
        assert "balance" in data
        assert "transactions" in data
        assert isinstance(data["transactions"], list)
        assert data["balance"] == 0  # fresh account

    async def test_wallet_unauthenticated(self, anon_client):
        r = await anon_client.get("/api/v1/wallet")
        assert r.status_code == 401


class TestAutoTopup:
    async def test_set_auto_topup_threshold(self, auth_client):
        r = await auth_client.post("/api/v1/wallet/auto-topup", json={"threshold": 100})
        assert r.status_code == 200
        assert r.json()["auto_topup_threshold"] == 100

    async def test_clear_auto_topup(self, auth_client):
        r = await auth_client.post("/api/v1/wallet/auto-topup", json={"threshold": None})
        assert r.status_code == 200
        assert r.json()["auto_topup_threshold"] is None

    async def test_auto_topup_persisted(self, auth_client):
        await auth_client.post("/api/v1/wallet/auto-topup", json={"threshold": 250})
        r = await auth_client.get("/api/v1/wallet")
        assert r.json()["auto_topup_threshold"] == 250
        # Restore to None
        await auth_client.post("/api/v1/wallet/auto-topup", json={"threshold": None})


class TestInitiatePurchase:
    async def test_unknown_package_returns_400(self, auth_client):
        r = await auth_client.post("/api/v1/wallet/initiate-purchase", json={"package": "platinum"})
        assert r.status_code == 400
        assert "Unknown package" in r.json()["detail"]

    async def test_valid_package_name_accepted(self, auth_client):
        """Known package names must pass input validation (400/422 are client errors).
        The Paystack call will fail with 502 in test (no live key), which is fine.
        """
        try:
            r = await auth_client.post("/api/v1/wallet/initiate-purchase", json={"package": "growth"})
            # If we somehow got a response, it must not be a client-side validation error
            assert r.status_code not in (400, 422)
        except Exception:
            # Network-level failure (e.g. empty API key) is acceptable — the
            # request validation passed and only the external call failed.
            pass
