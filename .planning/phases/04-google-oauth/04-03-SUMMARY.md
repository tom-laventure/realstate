---
phase: 04-google-oauth
plan: "03"
subsystem: auth
tags: [oauth, amplify, cognito, static-page, hash-token, react-router]

requires:
  - phase: 04-google-oauth
    plan: "01"
    provides: POST /v1/sessions id_token branch (backend session exchange endpoint)

provides:
  - auth-callback/index.html — static OAuth callback page for auth.realtybase.ca/oauth/callback
  - frontend/src/containers/auth/LoginSuccessful.tsx — hash-reading token storage component
  - frontend/src/router/auth/auth.tsx — /auth/login-success route

affects: [04-04]

tech-stack:
  added: []
  patterns:
    - "Amplify Hub listener for 'signInWithRedirect' event captures customState before fetchAuthSession completes — avoids raw state param parsing entirely (Pitfall 6 avoided)"
    - "brokerage domain validated with endsWith('.realtybase.ca') before window.location.href redirect (T-04-03-01 mitigation)"
    - "useEffect([]) for one-shot hash read on mount — token read, setToken, hash clear, navigate all in single invocation (Pitfall 5 avoided)"
    - "Cognito config values embedded directly in static HTML at development time — no runtime env vars in static files"

key-files:
  created:
    - auth-callback/index.html
  modified:
    - frontend/src/containers/auth/LoginSuccessful.tsx
    - frontend/src/router/auth/auth.tsx

key-decisions:
  - "D-CDN: Amplify imported via jsDelivr CDN (https://cdn.jsdelivr.net/npm/aws-amplify@6) — no build step for static callback page; CDN failure shows blank page (denial of service, not data exfiltration — T-04-03-04 accepted)"
  - "D-HUB: Hub.listen for 'signInWithRedirect' event used to capture customState — preferred over raw state query param parsing which would require Amplify prefix format knowledge (RESEARCH.md Pitfall 6 resolution)"
  - "D-DOMAIN-VAL: endsWith('.realtybase.ca') guard on brokerage domain — prevents open redirector vulnerability where attacker-controlled state param could redirect to arbitrary domain (T-04-03-01 mitigation, ASVS V5)"
  - "D-EMBED: Cognito config values (userPoolId, clientId, domain) embedded from frontend/.env values at creation time — static files have no runtime env resolution"
  - "D-HASH-CLEAR: window.location.hash = '' called before navigate() in LoginSuccessful.tsx — token removed from URL before React Router navigates; hash exists in browser for milliseconds only (T-04-03-02 accept)"

patterns-established:
  - "Static OAuth callback page: Hub.listen before fetchAuthSession, validate domain, POST /v1/sessions, redirect with hash token"
  - "Hash token reading: useEffect([]) reads once on mount, setToken, clear hash, replace-navigate"

requirements-completed: [AUTH-01, AUTH-03]

duration: 1min
completed: "2026-05-09"
---

# Phase 04 Plan 03: Token Handoff Infrastructure Summary

**Static OAuth callback page exchanges Cognito idToken for app JWT via POST /v1/sessions and hands off to correct tenant via URL hash; LoginSuccessful.tsx reads hash on mount, calls setToken(), and navigates to the authenticated app**

## Performance

- **Duration:** 1 min
- **Started:** 2026-05-09T13:57:52Z
- **Completed:** 2026-05-09T13:59:33Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `auth-callback/index.html` — fully static HTML/JS file for `auth.realtybase.ca/oauth/callback`
  - Amplify configured with actual Cognito values from `frontend/.env` (userPoolId, clientId, domain)
  - Hub listener captures `customState` (brokerage domain) from `signInWithRedirect` event before PKCE exchange
  - `fetchAuthSession()` completes PKCE code exchange automatically
  - Brokerage domain validated with `endsWith('.realtybase.ca')` before redirect (open redirector prevention)
  - Exchanges Cognito idToken for app JWT via `POST https://api.realtybase.ca/v1/sessions`
  - Redirects to `https://{brokerage}/auth/login-success#token={JWT}` on success
  - Error states for missing token, invalid state param, and session exchange failure
- Updated `frontend/src/containers/auth/LoginSuccessful.tsx`
  - Added `useEffect([])` that reads `window.location.hash` once on mount
  - Extracts token from hash params, calls `setToken(token)`, clears hash, calls `navigate('/', { replace: true })`
  - Error state with `AlertCircle` icon and "Back to sign in" link when hash is absent or malformed
  - Existing spinner JSX preserved verbatim
- Updated `frontend/src/router/auth/auth.tsx`
  - Added import for `LoginSuccessful`
  - Added `{ path: 'login-success', element: <LoginSuccessful /> }` to children array

## Task Commits

Each task was committed atomically:

1. **Task 1: Static OAuth callback page** — `3e65915` (feat, monorepo root repo)
2. **Task 2: LoginSuccessful.tsx + auth.tsx** — `81f510b` (feat, frontend sub-repo)

## Files Created/Modified

- `auth-callback/index.html` — Static OAuth callback page (monorepo root repo)
- `frontend/src/containers/auth/LoginSuccessful.tsx` — Hash-reading token storage component
- `frontend/src/router/auth/auth.tsx` — Added /auth/login-success route

## Decisions Made

- **CDN import:** Amplify loaded via jsDelivr CDN for the static callback page — avoids a build step. CDN failure results in blank page (denial of service), not a security risk. Risk accepted per T-04-03-04.
- **Hub listener approach:** `Hub.listen('auth', ...)` set up before `fetchAuthSession()` to capture `customState` — this avoids parsing Amplify's internal `state` query param format (RESEARCH.md Pitfall 6 resolution, confirmed by CONTEXT.md D-13).
- **Domain validation:** `endsWith('.realtybase.ca')` guard applied to decoded brokerage value before redirect — prevents open redirector attack from attacker-crafted state param (T-04-03-01 mitigation).
- **Config embedding:** Cognito values (userPoolId=`us-west-2_uYxUwf8nj`, clientId=`1enoejqc07arf31an928fgo0nf`, domain=`us-west-2uyxuwf8nj.auth.us-west-2.amazoncognito.com`) embedded from `frontend/.env` at file creation time — static hosting has no runtime env resolution.
- **Backend URL:** `BACKEND_URL` set to `https://api.realtybase.ca` in callback page — production backend API origin. Dev env uses VITE_BE_ENDPOINT but the static callback page has no dev/prod branching.
- **Hash clear timing:** `window.location.hash = ''` called before `navigate()` in LoginSuccessful.tsx — token cleared from URL as quickly as possible; hash change does not cause re-render because `useEffect([])` has empty deps and runs once.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Infrastructure required before auth flow is fully operational:**

1. **Host the callback page:** `auth-callback/index.html` must be deployed to a static hosting provider at `https://auth.realtybase.ca/oauth/callback` (Cloudflare Pages, S3+CloudFront, Netlify, or equivalent). DNS for `auth.realtybase.ca` must be configured to point to the static host.

2. **Cognito OAuth settings:** The Cognito user pool's app client must have `https://auth.realtybase.ca/oauth/callback` registered as an Allowed Callback URL for the OAuth flow to complete successfully.

3. **Amplify SPA config:** `frontend/src/config/amplify.ts` must include `https://auth.realtybase.ca/oauth/callback` in its `redirectSignIn` array (alongside the existing localhost URL) — this was noted in RESEARCH.md Pitfall 2 and is covered in Plan 04-04.

## Next Phase Readiness

- Token handoff infrastructure is complete: callback page → `/v1/sessions` → `login-success` route chain is wired
- Plan 04-04 (Google Sign-In button in CreateAccount.tsx) can proceed — it depends on the `/auth/login-success` route existing (now present)
- AUTH-01 and AUTH-03 requirements are fulfilled by this plan combined with 04-01

## Threat Flags

None — all threats were in the plan's threat model and have been mitigated or accepted per plan specification.

---
*Phase: 04-google-oauth*
*Completed: 2026-05-09*

## Self-Check: PASSED

Files verified:
- FOUND: auth-callback/index.html
- FOUND: frontend/src/containers/auth/LoginSuccessful.tsx
- FOUND: frontend/src/router/auth/auth.tsx

Commits verified: 3e65915 present in monorepo root git log, 81f510b present in frontend sub-repo git log
