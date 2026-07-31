# Phase 45: Vercel Project Setup + Preview Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 45-Vercel Project Setup + Preview Verification
**Areas discussed:** Execution mode, Ignored Build Step scope, Preview deployment protection, Analytics toggle timing

---

## Execution mode

| Option | Description | Selected |
|--------|-------------|----------|
| I write a runbook, you click | Claude produces exact step-by-step dashboard instructions; user executes; Claude verifies content/CTAs against the live URL afterward | ✓ |
| I drive the Vercel CLI | User runs `npx vercel login` once, then Claude uses the authenticated CLI to link/create/deploy | |

**User's choice:** Runbook + manual execution (recommended option).
**Notes:** Confirmed during investigation that the Vercel CLI is installed (`npx vercel`, v58.4.4) but not authenticated in this environment — `vercel whoami` hung on an interactive OAuth prompt and was stopped.

---

## Ignored Build Step scope

| Option | Description | Selected |
|--------|-------------|----------|
| landing/ only | Scope stays tight to this phase's success criteria; frontend/auth-callback untouched | ✓ |
| All three projects | Also retrofit frontend/ and auth-callback/ while in the dashboard | |

**User's choice:** landing/ only (recommended option).
**Notes:** Retrofit of the other two projects noted as a deferred idea.

---

## Preview deployment protection

| Option | Description | Selected |
|--------|-------------|----------|
| Skip Deployment Protection | Phase 44's noindex already covers crawlability; keeps preview URL fetchable by Claude for verification | ✓ |
| Enable it anyway | Extra defense-in-depth, but requires a bypass token or human-relayed verification | |

**User's choice:** Skip (recommended option).

---

## Vercel Web Analytics dashboard toggle

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, enable it in this phase | Natural place to flip it on since the project is first created here | |
| No, out of scope | Keeps Phase 45 focused strictly on DEPLOY-02 criteria; track as follow-up | ✓ |

**User's choice:** Out of scope (non-default pick — user chose the narrower-scope option over the recommended one).
**Notes:** Noted as a deferred idea so the Phase 44 `<Analytics />` code doesn't stay silently inert indefinitely.

---

## Claude's Discretion

- Exact wording/formatting of the runbook steps handed to the user.
- Whether build-log verification happens via user-pasted/screenshotted dashboard output or `vercel inspect` (if CLI gets authenticated later) — decided at execution time.

## Deferred Ideas

- Enable Vercel Web Analytics dashboard toggle for `landing/` (soon, as a quick follow-up — not blocking DEPLOY-02).
- Retrofit Ignored Build Step onto `frontend/` and `auth-callback/` for build-minute hygiene across all three projects.
