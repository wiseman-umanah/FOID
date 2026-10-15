"""E2E tests — Consents.

Covers:
  GET    /consents              (no filter, ?status= filter)
  POST   /consents              (create new consent)
  PATCH  /consents/{id}         (approve / revoke)
"""

import pytest


class TestListConsents:
    async def test_list_consents_seeded(self, auth_client):
        """Signup seeds 3 pending consents."""
        r = await auth_client.get("/api/v1/consents")
        assert r.status_code == 200
        data = r.json()
        # At least the 3 seeded consents from signup are there
        assert len(data) >= 3

    async def test_filter_pending(self, auth_client):
        r = await auth_client.get("/api/v1/consents?status=pending")
        assert r.status_code == 200
        assert all(c["status"] == "pending" for c in r.json())

    async def test_filter_approved_empty_initially(self, auth_client):
        r = await auth_client.get("/api/v1/consents?status=approved")
        assert r.status_code == 200
        # No consents have been approved yet
        assert r.json() == []

    async def test_consents_unauthenticated(self, anon_client):
        r = await anon_client.get("/api/v1/consents")
        assert r.status_code == 401


class TestCreateConsent:
    async def test_create_consent(self, auth_client):
        r = await auth_client.post("/api/v1/consents", json={
            "platform": "TestBank",
            "scope": "Identity verification",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["platform"] == "TestBank"
        assert data["scope"] == "Identity verification"
        assert data["status"] == "pending"
        assert "id" in data

    async def test_create_consent_with_expiry(self, auth_client):
        r = await auth_client.post("/api/v1/consents", json={
            "platform": "ExpiryBank",
            "scope": "BVN check",
            "expires_at": "2030-12-31T00:00:00Z",
        })
        assert r.status_code == 201
        assert r.json()["expires_at"] is not None


class TestUpdateConsent:
    async def test_approve_consent(self, auth_client):
        # Create a fresh consent to approve
        create = await auth_client.post("/api/v1/consents", json={
            "platform": "ApproveMe",
            "scope": "Income band",
        })
        assert create.status_code == 201
        consent_id = create.json()["id"]

        r = await auth_client.patch(f"/api/v1/consents/{consent_id}", json={"status": "approved"})
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

    async def test_revoke_consent(self, auth_client):
        create = await auth_client.post("/api/v1/consents", json={
            "platform": "RevokeMe",
            "scope": "Age verification",
        })
        assert create.status_code == 201
        consent_id = create.json()["id"]

        r = await auth_client.patch(f"/api/v1/consents/{consent_id}", json={"status": "revoked"})
        assert r.status_code == 200
        assert r.json()["status"] == "revoked"

    async def test_update_nonexistent_consent_404(self, auth_client):
        r = await auth_client.patch(
            "/api/v1/consents/00000000-0000-0000-0000-000000000000",
            json={"status": "approved"},
        )
        assert r.status_code == 404

    async def test_filter_approved_after_approval(self, auth_client):
        """After approving a consent, the approved filter should return it."""
        create = await auth_client.post("/api/v1/consents", json={
            "platform": "FilterCheck",
            "scope": "Identity",
        })
        consent_id = create.json()["id"]
        await auth_client.patch(f"/api/v1/consents/{consent_id}", json={"status": "approved"})

        r = await auth_client.get("/api/v1/consents?status=approved")
        assert r.status_code == 200
        assert any(c["id"] == consent_id for c in r.json())
