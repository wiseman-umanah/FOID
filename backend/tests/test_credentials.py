"""E2E tests — Credentials.

Covers:
  GET  /credentials/me
  POST /credentials/trigger
  GET  /credentials/qr
"""

import pytest


class TestGetCredential:
    async def test_get_my_credential(self, auth_client):
        r = await auth_client.get("/api/v1/credentials/me")
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert data["state"] == "active"
        assert "claims" in data
        assert "holder" in data

    async def test_credential_unauthenticated(self, anon_client):
        r = await anon_client.get("/api/v1/credentials/me")
        assert r.status_code == 401


class TestCredentialTrigger:
    async def test_trigger_missed_repayment(self, auth_client):
        """active → under_review via missed_repayment."""
        r = await auth_client.post("/api/v1/credentials/trigger", json={"event": "missed_repayment"})
        assert r.status_code == 200
        data = r.json()
        assert data["credential"]["state"] == "under_review"
        assert "notification" in data
        assert data["notification"]["change"] == "active → under_review"
        # Claims should be updated
        claims = data["credential"]["claims"]
        assert claims["account_stability"] == "variable"
        assert claims["repayment_reliability"] == "variable"

    async def test_trigger_review_cleared(self, auth_client):
        """under_review → active via review_cleared (state is under_review from previous test)."""
        r = await auth_client.post("/api/v1/credentials/trigger", json={"event": "review_cleared"})
        assert r.status_code == 200
        data = r.json()
        assert data["credential"]["state"] == "active"
        claims = data["credential"]["claims"]
        assert claims["account_stability"] == "stable"
        assert claims["repayment_reliability"] == "reliable"

    async def test_trigger_wrong_state_returns_409(self, auth_client):
        """income_drop requires under_review; credential is active → 409."""
        r = await auth_client.post("/api/v1/credentials/trigger", json={"event": "income_drop"})
        assert r.status_code == 409
        assert "under_review" in r.json()["detail"]

    async def test_trigger_unknown_event_returns_400(self, auth_client):
        r = await auth_client.post("/api/v1/credentials/trigger", json={"event": "does_not_exist"})
        assert r.status_code == 422  # Pydantic rejects the enum value

    async def test_trigger_manual_revoke_any_state(self, auth_client):
        """manual_revoke has no requiredState guard — should work from active."""
        r = await auth_client.post("/api/v1/credentials/trigger", json={"event": "manual_revoke"})
        assert r.status_code == 200
        assert r.json()["credential"]["state"] == "revoked"

    async def test_restore_credential_after_revoke(self, auth_client):
        """Restore to active via appeal_approved — but revoked has no direct path.
        manual_revoke → appeal_approved doesn't exist; use manual_revoke then verify 409
        for review_cleared (needs under_review).  Then restore with missed_repayment
        is also blocked (needs active).  The cleanest restore: manual_revoke → appeal_approved
        requires downgraded state, so a 409 should fire.
        """
        # Credential is revoked. appeal_approved needs downgraded → must 409
        r = await auth_client.post("/api/v1/credentials/trigger", json={"event": "appeal_approved"})
        assert r.status_code == 409


class TestCredentialQR:
    async def test_qr_returns_png(self, auth_client):
        # First restore credential to active via a roundabout: we need active state.
        # The credential may be revoked from the trigger tests above.  Use a fresh
        # signup to get a clean state for the QR test.
        import httpx
        from httpx import ASGITransport
        from app.main import app

        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            signup = await client.post("/api/v1/auth/signup", json={
                "first_name": "QR",
                "last_name": "Test",
                "nin": "44433322211",
                "email": "qr@foid.ng",
                "password": "Secure@123",
            })
            assert signup.status_code == 201
            token = signup.json()["access_token"]
            r = await client.get(
                "/api/v1/credentials/qr",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert r.status_code == 200
        assert r.headers["content-type"] == "image/png"
        assert len(r.content) > 100  # non-trivial PNG

    async def test_qr_unauthenticated(self, anon_client):
        r = await anon_client.get("/api/v1/credentials/qr")
        assert r.status_code == 401
