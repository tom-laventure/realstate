# Phase 4: Google OAuth — Discussion Log

**Date:** 2026-05-05
**Status:** Complete — CONTEXT.md written

---

## Areas Discussed

### Area 1: Intermediary Callback URL

**Background:** Cognito OAuth redirect URIs must be pre-configured fixed URLs. Dynamic brokerage subdomains can't be used as redirect targets. A fixed intermediary URL is required.

| Question | Options Presented | Decision |
|----------|------------------|----------|
| What domain/URL receives the OAuth callback? | auth.realtybase.ca/oauth/callback / realtybase.ca/oauth/callback / app.realtybase.ca/oauth/callback | **auth.realtybase.ca/oauth/callback** |
| What does the state parameter encode? | Brokerage subdomain only / Full redirect URL / Opaque server-side token | **Brokerage subdomain only** |
| What hosts the callback page? | Minimal static HTML page / React SPA / Rails endpoint | **Minimal static HTML page** |
| How does the token reach the brokerage domain? | localStorage then redirect / URL hash #token=JWT / query param | *User asked clarifying question: how does localStorage work for custom domains?* |
| (Follow-up) Clarification on localStorage cross-origin limitation | Explained: localStorage is per-origin, doesn't work cross-domain. Presented: URL hash vs one-time code exchange vs query param | **URL hash — #token=JWT** |

**Notes:** User surfaced the custom domain cross-origin question — confirmed localStorage is off the table for cross-domain handoff. URL hash chosen as the cleanest approach that works for both subdomains and custom domains.

---

### Area 2: Session Exchange

| Question | Options Presented | Decision |
|----------|------------------|----------|
| How should backend accept the Cognito idToken? | Extend POST /v1/sessions with id_token param / New POST /v1/sessions/oauth endpoint / Reuse CognitoAuth concern | **Extend POST /v1/sessions with id_token param** |
| How to CORS-allow auth.realtybase.ca? | Special-case allowed origin in proc / Add as BrokerageDomain seed / Separate CORS policy for /v1/sessions | **Special-case allowed origin** |
| Which component handles /auth/login-success and stores the token? | New /auth/login-success route reads hash / Extend existing /auth/login / Handle in App.tsx root | **New /auth/login-success route** |

**Notes:** LoginSuccessful.tsx already exists as a polished spinner — identified as a reusable asset for the login-success route.

---

### Area 3: Connected via Google Badge

| Question | Options Presented | Decision |
|----------|------------------|----------|
| Where is auth provider stored? | auth_provider column on users table / Derived from Cognito identities claim / Separate user_identities join table | **auth_provider column on users table** |
| Where in account settings does badge appear? | Profile section below name/email / Dedicated 'Sign-in methods' section / Inline on email field | **Profile section — below user's name/email** |

---

### Area 4: Button UX in Login Flow

| Question | Options Presented | Decision |
|----------|------------------|----------|
| Where in CreateAccount does the button appear? | Below email/password form with divider / Above the form / Separate tab | **Below form with divider** |
| Does button appear in login and/or signup mode? | Login mode only / Both modes / Standalone login page | **Both modes** |
| What does the button show during redirect? | Spinner state before redirect / No loading state / Disabled with 'Redirecting...' text | **Spinner state before redirect** |

---

## Claude's Discretion Items

These were identified during the discussion but left to Claude to decide during planning/implementation:

- Exact base64/JSON encoding format for the state param
- Google logo treatment in the button (no lucide-react Google icon; SVG or text-only)
- Lambda runtime (Node.js 20.x is the de-facto standard for Cognito triggers)
- Badge chip styling in account settings
- Error handling on the callback page if fetchAuthSession fails

## Deferred Ideas

- **"Connect Google from profile settings"** (frontend-initiated linking for existing users) — v2 per REQUIREMENTS.md
- **Microsoft / Apple social login** — v2 per roadmap
- **Full error page at auth.realtybase.ca** — Claude's discretion for Phase 4; a minimal inline error is sufficient

---

*Discussion completed: 2026-05-05*
