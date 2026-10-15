# IDRA — Identity & Digital Risk Assessment

**IDRA** is a reusable, self-updating digital identity layer for Nigeria's open banking ecosystem. Verify your identity once, stay current automatically, and share only what's needed — wherever you go.



---

## What IDRA Does

IDRA combines three things into a single, always-current financial identity:

1. **Verified Identity** — Complete Tier-2 KYC once and receive a single IDRA credential that replaces re-uploading documents everywhere.
2. **Open Banking, Read-Only** — Link accounts from any major Nigerian bank or fintech in under a minute. You approve exactly what's shared, and it's revocable anytime.
3. **AI-Kept Ledger** — Every receipt, invoice, and bank transaction is auto-categorised, tax is set aside automatically, and reports are always ready.

---

## Credential State Machine

The IDRA credential moves through four states driven by rule-based Open Banking events — no ML, no credit scoring:

| State | Meaning |
|---|---|
| `active` | Fully verified, all claims valid |
| `under_review` | Flagged event detected (e.g. missed repayment) |
| `downgraded` | Sustained negative signal (e.g. >40% income drop) |
| `revoked` | Credential permanently halted |

---

## Architecture

```
frontend/      — Vite + React + TypeScript (pnpm)   — port 5173
```

The frontend is a fully self-contained simulation — all auth, KYC, and credential state logic runs in-browser using `localStorage`. No backend required to run the demo.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 + TypeScript |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| Charts | Recharts |
| Icons | Remix Icon |
| Fonts | CreatoDisplay, NeueMachina |
| Package Manager | pnpm |

---

## Getting Started

See [`frontend/README.md`](frontend/README.md) for setup and run instructions.

---

## Key Pages

| Route | Page |
|---|---|
| `/` | Landing page |
| `/signup` | Create IDRA account |
| `/login` | Sign in |
| `/dashboard` | Overview — stats, credential card, charts |
| `/dashboard/identity` | My Identity — KYC status, trust ring |
| `/dashboard/credentials` | Verification Credentials — per-platform sharing |
| `/dashboard/banks` | Connected Banks — Open Banking links |
| `/dashboard/consents` | Consent Requests — data sharing approvals |
| `/dashboard/ledger` | Business Ledger — AI-categorised transactions |
| `/dashboard/history` | Ledger History |
| `/dashboard/wallet` | AI Credit Wallet |
| `/dashboard/reports` | Reports & Insights |
| `/dashboard/settings` | Profile & Settings |

---


&copy; 2025 IDRA. Built for Nigerian founders and freelancers.
