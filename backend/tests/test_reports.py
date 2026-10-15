"""E2E tests — Reports & Insights.

Covers:
  GET  /reports/summary
  GET  /reports/export/csv
  GET  /reports/export/pdf
  GET  /reports/monthly-pdf
"""

import pytest


class TestReportsSummary:
    async def test_summary_empty(self, auth_client):
        """Fresh user with no ledger entries should get an empty list."""
        r = await auth_client.get("/api/v1/reports/summary")
        assert r.status_code == 200
        assert r.json() == []

    async def test_summary_unauthenticated(self, anon_client):
        r = await anon_client.get("/api/v1/reports/summary")
        assert r.status_code == 401


class TestReportsExportCSV:
    async def test_export_csv_empty_data(self, auth_client):
        r = await auth_client.get("/api/v1/reports/export/csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers["content-type"]
        # Header row must always be present
        assert "Month" in r.text
        assert "Income" in r.text

    async def test_export_csv_unauthenticated(self, anon_client):
        r = await anon_client.get("/api/v1/reports/export/csv")
        assert r.status_code == 401

    async def test_export_csv_content_disposition(self, auth_client):
        r = await auth_client.get("/api/v1/reports/export/csv")
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd
        assert ".csv" in cd


class TestReportsExportPDF:
    async def test_export_pdf(self, auth_client):
        r = await auth_client.get("/api/v1/reports/export/pdf")
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert len(r.content) > 500

    async def test_export_pdf_unauthenticated(self, anon_client):
        r = await anon_client.get("/api/v1/reports/export/pdf")
        assert r.status_code == 401

    async def test_export_pdf_content_disposition(self, auth_client):
        r = await auth_client.get("/api/v1/reports/export/pdf")
        cd = r.headers.get("content-disposition", "")
        assert "foid_report_" in cd
        assert ".pdf" in cd


class TestMonthlyPDF:
    async def test_monthly_pdf_valid_month(self, auth_client):
        r = await auth_client.get("/api/v1/reports/monthly-pdf?month=2025-01")
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert len(r.content) > 500

    async def test_monthly_pdf_invalid_month_format(self, auth_client):
        r = await auth_client.get("/api/v1/reports/monthly-pdf?month=notamonth")
        assert r.status_code == 400
        assert "YYYY-MM" in r.json()["detail"]

    async def test_monthly_pdf_missing_month_param(self, auth_client):
        """month is a required query param — missing should return 422."""
        r = await auth_client.get("/api/v1/reports/monthly-pdf")
        assert r.status_code == 422

    async def test_monthly_pdf_unauthenticated(self, anon_client):
        r = await anon_client.get("/api/v1/reports/monthly-pdf?month=2025-01")
        assert r.status_code == 401

    async def test_monthly_pdf_content_disposition(self, auth_client):
        r = await auth_client.get("/api/v1/reports/monthly-pdf?month=2025-06")
        cd = r.headers.get("content-disposition", "")
        assert "foid_audit_2025-06.pdf" in cd
