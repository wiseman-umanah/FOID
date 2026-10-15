"""E2E tests — Auth flow.

Covers:
  POST /auth/signup
  POST /auth/login
  POST /auth/refresh
  POST /auth/logout
  GET  /auth/me
  PATCH /auth/me/bvn
  PATCH /auth/me/phone
  PATCH /auth/me/address
  PATCH /auth/me/password
  GET  /auth/me/identity-summary  (PDF download)
"""

import pytest


# ---------------------------------------------------------------------------
# Signup
# ---------------------------------------------------------------------------

class TestSignup:
    async def test_signup_success(self, anon_client):
        r = await anon_client.post("/api/v1/auth/signup", json={
            "first_name": "Jane",
            "last_name": "Doe",
            "nin": "22233344455",
            "email": "jane@foid.ng",
            "password": "Secure@123",
        })
        assert r.status_code == 201
        data = r.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_signup_duplicate_email(self, anon_client):
        payload = {
            "first_name": "Dup",
            "last_name": "User",
            "nin": "99988877766",
            "email": "dup@foid.ng",
            "password": "Secure@123",
        }
        r1 = await anon_client.post("/api/v1/auth/signup", json=payload)
        assert r1.status_code == 201
        r2 = await anon_client.post("/api/v1/auth/signup", json=payload)
        assert r2.status_code == 409

    async def test_signup_weak_password(self, anon_client):
        r = await anon_client.post("/api/v1/auth/signup", json={
            "first_name": "Weak",
            "last_name": "Pass",
            "nin": "11122233344",
            "email": "weak@foid.ng",
            "password": "password",  # no uppercase, no special char
        })
        assert r.status_code == 422

    async def test_signup_seeds_credential_wallet_consents(self, anon_client):
        """A fresh signup should automatically create credential, wallet, and 3 demo consents."""
        r = await anon_client.post("/api/v1/auth/signup", json={
            "first_name": "Seed",
            "last_name": "Check",
            "nin": "55566677788",
            "email": "seed@foid.ng",
            "password": "Secure@123",
        })
        assert r.status_code == 201
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        cred_r = await anon_client.get("/api/v1/credentials/me", headers=headers)
        assert cred_r.status_code == 200
        assert cred_r.json()["state"] == "active"

        wallet_r = await anon_client.get("/api/v1/wallet", headers=headers)
        assert wallet_r.status_code == 200
        assert wallet_r.json()["balance"] == 0

        consents_r = await anon_client.get("/api/v1/consents", headers=headers)
        assert consents_r.status_code == 200
        assert len(consents_r.json()) == 3
        assert all(c["status"] == "pending" for c in consents_r.json())


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

class TestLogin:
    async def test_login_success(self, auth_client, anon_client):
        # auth_client fixture ensures test@foid.ng account exists
        r = await anon_client.post("/api/v1/auth/login", json={
            "email": "test@foid.ng",
            "password": "Secure@123",
        })
        assert r.status_code == 200
        assert "access_token" in r.json()

    async def test_login_wrong_password(self, auth_client, anon_client):
        r = await anon_client.post("/api/v1/auth/login", json={
            "email": "test@foid.ng",
            "password": "WrongPass@1",
        })
        assert r.status_code == 401

    async def test_login_unknown_email(self, anon_client):
        r = await anon_client.post("/api/v1/auth/login", json={
            "email": "nobody@foid.ng",
            "password": "Secure@123",
        })
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Refresh & Logout
# ---------------------------------------------------------------------------

class TestRefreshLogout:
    async def test_refresh_issues_new_tokens(self, auth_client, anon_client):
        login = await anon_client.post("/api/v1/auth/login", json={
            "email": "test@foid.ng",
            "password": "Secure@123",
        })
        old_refresh = login.json()["refresh_token"]

        r = await anon_client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert "refresh_token" in data
        # New refresh token must differ (rotation)
        assert data["refresh_token"] != old_refresh

    async def test_refresh_invalid_token_rejected(self, anon_client):
        r = await anon_client.post("/api/v1/auth/refresh", json={"refresh_token": "not-a-real-token"})
        assert r.status_code == 401

    async def test_refresh_used_token_rejected(self, auth_client, anon_client):
        """A used (rotated) refresh token must be rejected on second use."""
        login = await anon_client.post("/api/v1/auth/login", json={
            "email": "test@foid.ng",
            "password": "Secure@123",
        })
        old_refresh = login.json()["refresh_token"]

        # First use — OK
        r1 = await anon_client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
        assert r1.status_code == 200

        # Second use — must be rejected (token is now revoked)
        r2 = await anon_client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
        assert r2.status_code == 401

    async def test_logout_revokes_token(self, auth_client, anon_client):
        login = await anon_client.post("/api/v1/auth/login", json={
            "email": "test@foid.ng",
            "password": "Secure@123",
        })
        refresh = login.json()["refresh_token"]

        logout_r = await anon_client.post("/api/v1/auth/logout", json={"refresh_token": refresh})
        assert logout_r.status_code == 204

        # Revoked token must no longer work
        r = await anon_client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# /auth/me — profile reads & updates
# ---------------------------------------------------------------------------

class TestMe:
    async def test_me_returns_user(self, auth_client):
        r = await auth_client.get("/api/v1/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "test@foid.ng"
        assert data["first_name"] == "Test"
        assert "hashed_password" not in data

    async def test_me_unauthenticated(self, anon_client):
        r = await anon_client.get("/api/v1/auth/me")
        assert r.status_code == 401  # no Authorization header → 401

    async def test_submit_bvn(self, auth_client):
        r = await auth_client.patch("/api/v1/auth/me/bvn", json={"bvn": "12345678901"})
        assert r.status_code == 200
        assert r.json()["bvn"] == "12345678901"

    async def test_submit_bvn_wrong_length(self, auth_client):
        r = await auth_client.patch("/api/v1/auth/me/bvn", json={"bvn": "123"})
        assert r.status_code == 422

    async def test_submit_phone(self, auth_client):
        r = await auth_client.patch("/api/v1/auth/me/phone", json={"phone": "08012345678"})
        assert r.status_code == 200
        assert r.json()["phone"] == "08012345678"

    async def test_submit_address(self, auth_client):
        r = await auth_client.patch("/api/v1/auth/me/address", json={"address": "12 Lagos Street, Ikeja"})
        assert r.status_code == 200
        assert r.json()["address"] == "12 Lagos Street, Ikeja"

    async def test_change_password(self, auth_client):
        # Change from Secure@123 → NewPass@456
        r = await auth_client.patch("/api/v1/auth/me/password", json={
            "current_password": "Secure@123",
            "new_password": "NewPass@456",
        })
        assert r.status_code == 204

        # Restore original password so other tests keep working
        r2 = await auth_client.patch("/api/v1/auth/me/password", json={
            "current_password": "NewPass@456",
            "new_password": "Secure@123",
        })
        assert r2.status_code == 204

    async def test_change_password_wrong_current(self, auth_client):
        r = await auth_client.patch("/api/v1/auth/me/password", json={
            "current_password": "WrongCurrent@1",
            "new_password": "NewPass@456",
        })
        assert r.status_code == 400

    async def test_identity_summary_pdf(self, auth_client):
        r = await auth_client.get("/api/v1/auth/me/identity-summary")
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert len(r.content) > 1000  # sanity: PDF is non-trivial
