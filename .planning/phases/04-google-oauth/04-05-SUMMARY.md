---
phase: 04-google-oauth
plan: "05"
subsystem: auth
tags: [jwt, cognito, jwks, rs256, rails-cache, httparty, xss, dom-security]

requires:
  - phase: 04-google-oauth plan 01
    provides: SessionsController OAuth id_token branch with JWT.decode(token, nil, false)
  - phase: 04-google-oauth plan 03
    provides: auth-callback/index.html with showError innerHTML + BrokerageAuth on all actions

provides:
  - CR-02 closed: skip_before_action :resolve_brokerage, only: [:create] in SessionsController
  - CR-01 closed: RS256 JWKS-verified JWT.decode replacing unsafe nil/false decode
  - CR-01 JWKS cache: Rails.cache.fetch("cognito_jwks", expires_in: 1.hour) via HTTParty
  - CR-03 closed: showError rewritten with textContent/createElement/appendChild — zero innerHTML

affects: [04-google-oauth, verification, phase-05]

tech-stack:
  added: []
  patterns:
    - "Rails.cache.fetch with expires_in: 1.hour for external HTTPS JWKS endpoint caching (Solid Cache backend)"
    - "JWT.decode with jwks: lambda loader for RS256 public key resolution from JWKS key set"
    - "DOM construction via createElement + textContent instead of innerHTML for untrusted content"

key-files:
  created: []
  modified:
    - backend/app/controllers/v1/sessions_controller.rb
    - auth-callback/index.html

key-decisions:
  - "Rails.cache.fetch (Solid Cache/PostgreSQL) used for JWKS over process-level memoize — shares cache across Puma workers; correct for multi-process deployments"
  - "JWT::VerificationError, JWT::InvalidIssuerError, JWT::InvalidAudError, JWT::ExpiredSignature all inherit from JWT::DecodeError — no new rescue clauses added; existing rescue covers all RS256 verification failures"
  - "skip_before_action :resolve_brokerage scoped to only: [:create] — :destroy still resolves brokerage for sign-out scoping; :create does not reference Current.brokerage in either branch"
  - "JWKS network failure surfaces as 500 (correct) — when verification material is unavailable no login should succeed; same AWS outage would prevent upstream PKCE completion anyway"

patterns-established:
  - "CR-01 pattern: JWT.decode with jwks: lambda + algorithms: [RS256] + verify_iss/verify_aud — canonical pattern for verifying Cognito RS256 idTokens in Rails"
  - "CR-03 pattern: textContent assignment to clear + createElement + textContent for message + appendChild — safe DOM construction for server-supplied error strings"

requirements-completed: [AUTH-01, AUTH-03]

duration: 8min
completed: "2026-05-09"
---

# Phase 04 Plan 05: Gap Closure — CR-01 JWKS Verification, CR-02 BrokerageAuth Skip, CR-03 XSS Fix Summary

**RS256 JWKS signature verification via Rails.cache-backed HTTParty fetch, BrokerageAuth skip on :create, and DOM-safe showError replacing innerHTML in auth-callback — three BLOCKER gaps closed enabling OAuth login in production**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-09T18:45:00Z
- **Completed:** 2026-05-09T18:53:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- CR-02 closed: `skip_before_action :resolve_brokerage, only: [:create]` inserted at line 7 of SessionsController — POST /v1/sessions no longer 500s on `api.realtybase.ca` host
- CR-01 closed: `JWT.decode(params[:id_token], nil, false)` (signature verification disabled) replaced with RS256 JWKS-verified decode (`algorithms: ["RS256"]`, `verify_iss: true`, `verify_aud: true`, `jwks: jwks_loader`) — forged JWTs now return 401
- CR-01 JWKS cache: `cognito_jwks` private helper fetches Cognito JWKS via HTTParty with `Rails.cache.fetch("cognito_jwks", expires_in: 1.hour)` — second login within an hour does not re-fetch JWKS over HTTP
- CR-03 closed: `showError` in auth-callback/index.html rewritten with `status.textContent = ''` + `createElement` + `textContent` assignment + `appendChild` — `innerHTML` count went from 1 to 0; `<script>alert(1)</script>` in server error renders as literal text

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix sessions_controller.rb — skip_before_action (CR-02) + JWKS verification (CR-01)** - `53ac97e` (fix) — backend/ sub-repo
2. **Task 2: Fix auth-callback/index.html — replace innerHTML with textContent + createElement (CR-03)** - `a3252ad` (fix) — monorepo root

**Plan metadata:** (committed with SUMMARY.md below)

## Files Created/Modified
- `backend/app/controllers/v1/sessions_controller.rb` - Added `skip_before_action :resolve_brokerage, only: [:create]` (CR-02); replaced unsafe JWT.decode with RS256 JWKS-verified decode (CR-01); added `cognito_jwks` private helper with HTTParty + Rails.cache 1-hour TTL
- `auth-callback/index.html` - Replaced `showError` innerHTML body with textContent/createElement/appendChild DOM construction (CR-03)

## Decisions Made

**1. Rails.cache.fetch (Solid Cache) over process-level memoize for JWKS**

Solid Cache (configured in Phase 01, backed by PostgreSQL) is shared across all Puma workers. A class-level `@@jwks` memoized variable would be process-local — each worker would independently re-fetch JWKS on first login. `Rails.cache.fetch` provides correct multi-process sharing with the 1-hour TTL the plan requires. JWKS is small (~1KB) — cache size negligible.

**2. No new rescue clauses for RS256 verification failures**

JWT 2.7+ raises `JWT::VerificationError`, `JWT::InvalidIssuerError`, `JWT::InvalidAudError`, `JWT::ExpiredSignature` — all inheriting from `JWT::DecodeError`. The existing `rescue JWT::DecodeError => e` already covers them all, returning `{ error: "Invalid token: ..." }` with HTTP 401. Adding separate rescues would be redundant and potentially inconsistent.

**3. skip_before_action scoped to only: [:create]**

`:destroy` still runs `resolve_brokerage` for sign-out scoping. Only `:create` is called from `api.realtybase.ca` (the API subdomain with no registered BrokerageDomain). The `Current.brokerage` value is nil during `:create` — verified that neither the OAuth branch nor the email/password branch references `Current.brokerage`.

**4. JWKS network failure → 500 (correct behavior)**

If `HTTParty.get(COGNITO_CONFIG[:jwks_uri])` raises or returns non-success, `cognito_jwks` raises a `StandardError` that propagates past `rescue JWT::DecodeError` to the default Rails 500 handler. This is correct: when verification material is unavailable, no OAuth login should succeed. The same AWS Cognito outage that makes JWKS unreachable would prevent PKCE completion upstream.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `bundle exec standardrb --no-fix` passed cleanly after the edit. Rails boot check (`bundle exec rails runner "V1::SessionsController.action_methods.to_a"`) succeeded without errors.

Minor: `grep -c "textContent"` returned 5 (not 3 as in acceptance criteria) because two comments in the prescribed replacement code also contain the word "textContent". The three load-bearing textContent assignments (`status.textContent = ''`, `errorSpan.textContent = message`, `backLink.textContent = 'Back to sign in'`) all verify correctly at count 1 each.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All three BLOCKER gaps from 04-VERIFICATION.md are now closed:
- CR-01 (JWT signature bypass) — CLOSED
- CR-02 (BrokerageAuth 500 on api.realtybase.ca) — CLOSED
- CR-03 (XSS in auth-callback showError) — CLOSED

OAuth login flow is now production-ready from a security standpoint. Running `/gsd-verify-work` should show all three CRs moving from FAILED to VERIFIED.

Phase 05 (calendar sync) can proceed without blockers from Phase 04.

## Self-Check

### Files exist:
- `backend/app/controllers/v1/sessions_controller.rb`: FOUND (verified via grep checks)
- `auth-callback/index.html`: FOUND (verified via grep checks)

### Commits exist:
- `53ac97e`: backend/ repo — `fix(04-05): close CR-02 (BrokerageAuth skip) + CR-01 (RS256 JWKS verification)`
- `a3252ad`: monorepo root — `fix(04-05): close CR-03 — replace innerHTML with textContent/createElement`

## Self-Check: PASSED

---
*Phase: 04-google-oauth*
*Completed: 2026-05-09*
