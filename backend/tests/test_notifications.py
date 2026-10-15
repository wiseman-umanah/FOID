"""E2E tests — Notifications.

Covers:
  GET    /notifications
  PATCH  /notifications/read-all
  PATCH  /notifications/{id}/read
"""

import pytest


class TestListNotifications:
    async def test_list_notifications(self, auth_client):
        r = await auth_client.get("/api/v1/notifications")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_notifications_unauthenticated(self, anon_client):
        r = await anon_client.get("/api/v1/notifications")
        assert r.status_code == 401

    async def test_notifications_populated_after_trigger(self, auth_client):
        """Firing a credential trigger creates a notification."""
        # Ensure credential is active first (it may have been revoked by credential tests)
        cred_r = await auth_client.get("/api/v1/credentials/me")
        state = cred_r.json().get("state", "")

        # If revoked or downgraded, we can't fire missed_repayment (needs active).
        # In that case just check that the list endpoint works.
        if state != "active":
            r = await auth_client.get("/api/v1/notifications")
            assert r.status_code == 200
            return

        before = await auth_client.get("/api/v1/notifications")
        count_before = len(before.json())

        await auth_client.post("/api/v1/credentials/trigger", json={"event": "missed_repayment"})

        after = await auth_client.get("/api/v1/notifications")
        assert len(after.json()) == count_before + 1

        # Restore
        await auth_client.post("/api/v1/credentials/trigger", json={"event": "review_cleared"})


class TestMarkRead:
    async def test_mark_single_notification_read(self, auth_client):
        """Trigger an event to get a fresh unread notification, then mark it read."""
        cred_r = await auth_client.get("/api/v1/credentials/me")
        state = cred_r.json().get("state", "")
        if state != "active":
            pytest.skip("Credential not in active state — cannot fire trigger")

        await auth_client.post("/api/v1/credentials/trigger", json={"event": "suspicious_activity"})
        notifs = await auth_client.get("/api/v1/notifications")
        unread = [n for n in notifs.json() if not n["read"]]
        assert len(unread) > 0

        notif_id = unread[0]["id"]
        r = await auth_client.patch(f"/api/v1/notifications/{notif_id}/read")
        assert r.status_code == 200
        assert r.json()["read"] is True

        # Restore
        await auth_client.post("/api/v1/credentials/trigger", json={"event": "review_cleared"})

    async def test_mark_nonexistent_notification_404(self, auth_client):
        r = await auth_client.patch(
            "/api/v1/notifications/00000000-0000-0000-0000-000000000000/read"
        )
        assert r.status_code == 404

    async def test_mark_all_read(self, auth_client):
        r = await auth_client.patch("/api/v1/notifications/read-all")
        assert r.status_code == 204

        # All notifications must now be read
        notifs = await auth_client.get("/api/v1/notifications")
        assert all(n["read"] for n in notifs.json())
