# FOID — Financial & Open Identity

**FOID** is a full-stack digital identity and financial management platform built for Nigeria's open banking ecosystem. Verify your identity once, link your bank accounts, manage your business ledger with AI, and share only what's needed — wherever you go.

---

## What FOID Does

1. **Verified Identity** — Complete Tier-2 KYC once and receive a single FOID credential that replaces re-uploading documents everywhere.
2. **Open Banking, Read-Only** — Link accounts from any major Nigerian bank via Mono Connect in under a minute. Approvals are explicit and revocable anytime.
3. **AI-Kept Ledger** — Upload receipts for Groq-powered OCR, get auto-categorised entries, tax estimates, and exportable reports (CSV + PDF).
4. **AI Credit Wallet** — Purchase AI credits via Paystack to power ledger scans and in-app chat with your financial data.

---

## Credential State Machine

The FOID credential moves through four states driven by rule-based Open Banking events:

| State | Meaning |
|---|---|
| `active` | Fully verified, all claims valid |
| `under_review` | Flagged event detected (e.g. missed repayment) |
| `downgraded` | Sustained negative signal (e.g. >40% income drop) |
| `revoked` | Credential permanently halted |

---

## Architecture

```
frontend/   — Vite + React + TypeScript (pnpm)      — port 5173
backend/    — FastAPI + SQLModel + Alembic (uv)      — port 8000
```

The frontend communicates with the backend via a versioned REST API (`/api/v1`). Auth uses short-lived JWT access tokens + rotating refresh tokens.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 + TypeScript |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| Charts | Recharts |
| Package Manager | pnpm |
| Backend | FastAPI + Uvicorn |
| ORM | SQLModel (SQLAlchemy 2 + Pydantic v2) |
| Migrations | Alembic |
| Database | SQLite (dev) · PostgreSQL (production) |
| AI | Groq (receipt OCR + chat) |
| Open Banking | Mono Connect |
| Payments | Paystack |
| Rate Limiting | slowapi |
| Cache | Redis (optional) |
| Package Manager | uv |

---

## Getting Started

### Backend

```bash
cd backend
uv sync
cp .env.example .env   # fill in SECRET_KEY, GROQ_API_KEY, MONO_*, PAYSTACK_*
uv run alembic upgrade head
uv run foid-dev        # dev server with reload → http://localhost:8000
```

API docs: http://localhost:8000/docs  
Health check: http://localhost:8000/health

### Frontend

```bash
cd frontend
pnpm install
cp .env.example .env   # set VITE_MONO_PUBLIC_KEY and VITE_API_BASE_URL
pnpm dev               # → http://localhost:5173
```

See [`backend/README.md`](backend/README.md) for full backend documentation.

---

## Key Pages

| Route | Page |
|---|---|
| `/` | Landing page |
| `/signup` | Create FOID account |
| `/login` | Sign in |
| `/dashboard` | Overview — stats, credential card, charts |
| `/dashboard/identity` | My Identity — KYC status, trust ring |
| `/dashboard/credentials` | Verification Credentials — per-platform sharing |
| `/dashboard/banks` | Connected Banks — Open Banking links |
| `/dashboard/consents` | Consent Requests — data sharing approvals |
| `/dashboard/ledger` | Business Ledger — AI-categorised transactions |
| `/dashboard/wallet` | AI Credit Wallet |
| `/dashboard/reports` | Reports & Insights |
| `/dashboard/settings` | Profile & Settings |

---

&copy; 2025 FOID. Built for Nigerian founders and freelancers.
