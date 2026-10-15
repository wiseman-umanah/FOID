"""E2E tests — User Preferences.

Covers:
  GET   /preferences
  PATCH /preferences
"""

import pytest


class TestGetPreferences:
    async def test_get_preferences_defaults(self, auth_client):
        r = await auth_client.get("/api/v1/preferences")
        assert r.status_code == 200
        data = r.json()
        # All boolean fields must be present
        for field in (
            "two_fa_enabled",
            "biometric_enabled",
            "login_alerts_enabled",
            "notif_verification_alerts",
            "notif_consent_alerts",
            "notif_ai_nudges",
            "notif_weekly_digest",
        ):
            assert field in data, f"Missing field: {field}"
            assert isinstance(data[field], bool)

    async def test_preferences_unauthenticated(self, anon_client):
        r = await anon_client.get("/api/v1/preferences")
        assert r.status_code == 401

    async def test_get_creates_defaults_idempotent(self, auth_client):
        """Calling GET twice must not error — _get_or_create is idempotent."""
        r1 = await auth_client.get("/api/v1/preferences")
        r2 = await auth_client.get("/api/v1/preferences")
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json() == r2.json()


class TestUpdatePreferences:
    async def test_patch_single_field(self, auth_client):
        r = await auth_client.patch("/api/v1/preferences", json={"two_fa_enabled": True})
        assert r.status_code == 200
        assert r.json()["two_fa_enabled"] is True

    async def test_patch_multiple_fields(self, auth_client):
        r = await auth_client.patch("/api/v1/preferences", json={
            "biometric_enabled": True,
            "notif_weekly_digest": False,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["biometric_enabled"] is True
        assert data["notif_weekly_digest"] is False

    async def test_patch_persisted(self, auth_client):
        """Value written via PATCH must be visible on subsequent GET."""
        await auth_client.patch("/api/v1/preferences", json={"login_alerts_enabled": False})
        r = await auth_client.get("/api/v1/preferences")
        assert r.json()["login_alerts_enabled"] is False
        # Restore default
        await auth_client.patch("/api/v1/preferences", json={"login_alerts_enabled": True})

    async def test_patch_empty_body_is_noop(self, auth_client):
        """An empty PATCH must return 200 and leave values unchanged."""
        before = (await auth_client.get("/api/v1/preferences")).json()
        r = await auth_client.patch("/api/v1/preferences", json={})
        assert r.status_code == 200
        assert r.json() == before
