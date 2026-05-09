---
phase: 04-google-oauth
plan: "01"
subsystem: auth
tags: [jwt, google-oauth, cognito, cors, rails, serializer]

requires:
  - phase: 03-onboarding
    provides: UserSerializer pattern and BrokerageMembership structure

provides:
  - auth_provider string column on users table (migration 20260509000001)
  - POST /v1/sessions id_token branch for Google OAuth token exchange
  - CORS allowance for https://auth.realtybase.ca (exact origin match)
  - auth_provider field exposed via UserSerializer

affects: [04-02, 04-03, 04-04]

tech-stack:
  added: []
  patterns:
    - "JWT.decode(token, nil, false) for RS256 Cognito idToken decoding without signature verification — established in CognitoService, reused here"
    - "Branching on params[:id_token].present? before email/password check in SessionsController#create"
    - "CORS origin proc extended with OR condition using exact source string comparison"

key-files:
  created:
    - backend/db/migrate/20260509000001_add_auth_provider_to_users.rb
  modified:
    - backend/app/controllers/v1/sessions_controller.rb
    - backend/config/initializers/cors.rb
    - backend/app/serializers/user_serializer.rb

key-decisions:
  - "D-05 (CORS): auth.realtybase.ca compared as full source string, not host — prevents http:// or subdomain bypass"
  - "T-04-01-01 mitigation: email_verified=false rejected with 422 before find_or_initialize_by — prevents account takeover via unverified Google email"
  - "T-04-01-02 accept: JWT.decode(token, nil, false) skips RS256 verification — project-established pattern, Cognito has already authenticated the user"
  - "String-keyed claims used in id_token branch (claims[\"sub\"] not claims[:sub]) — JWT.decode returns string-keyed hash unlike CognitoService which transforms to symbol keys"

patterns-established:
  - "OAuth id_token branch: branch first, decode with JWT.decode(token, nil, false), verify email_verified, find_or_initialize_by cognito_sub, set auth_provider, save, issue app JWT"

requirements-completed: [AUTH-01, AUTH-04]

duration: 4min
completed: "2026-05-09"
---

# Phase 04 Plan 01: Backend OAuth Foundation Summary

**Cognito idToken exchange endpoint added to POST /v1/sessions with email_verified guard, auth_provider='google' column, and exact-origin CORS allowance for https://auth.realtybase.ca**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-09T13:47:53Z
- **Completed:** 2026-05-09T13:51:33Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Migration 20260509000001 adds `auth_provider string DEFAULT NULL` to users table — applied and up
- CORS origins proc extended with exact-origin check `source == "https://auth.realtybase.ca"` alongside the existing BrokerageDomain lookup
- UserSerializer exposes `:auth_provider` attribute unconditionally (null for email/password users, "google" for OAuth users)
- SessionsController#create branches on `params[:id_token].present?` first, decodes Cognito RS256 idToken via `JWT.decode(token, nil, false)`, rejects unverified emails with 422, upserts user with auth_provider='google', issues app JWT — existing email/password path moved to elsif, logic unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration + CORS + serializer** - `17e6f56` (feat)
2. **Task 2: SessionsController id_token branch** - `8c141cd` (feat)

## Files Created/Modified
- `backend/db/migrate/20260509000001_add_auth_provider_to_users.rb` - Adds auth_provider string column (default nil) to users
- `backend/db/schema.rb` - Updated by rails db:migrate
- `backend/config/initializers/cors.rb` - Extended origins proc with exact https://auth.realtybase.ca source match
- `backend/app/serializers/user_serializer.rb` - Added :auth_provider to attributes declaration
- `backend/app/controllers/v1/sessions_controller.rb` - Full id_token branch implementation

## Decisions Made
- CORS uses `source == "https://auth.realtybase.ca"` (full origin including scheme) not host-only — prevents http:// or subdomain spoofing (D-06 compliance)
- email_verified checked before find_or_initialize_by — prevents account takeover if Google delivers unverified email claim (T-04-01-01 mitigation, ASVS V2)
- JWT.decode third arg is `false` (no signature verify) — RS256 public key fetch would add HTTP round-trip with no security gain given Amplify trust chain; matches CognitoService precedent (T-04-01-02 accept)
- String-keyed claims throughout id_token branch — JWT.decode returns string keys; CognitoService.initiate_auth transforms to symbol keys; mixed usage would be a bug

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The smoke test `POST /v1/sessions` with `{"id_token":"invalid"}` returned `{"error":"Invalid token: Not enough or too many segments"}` confirming JWT::DecodeError rescue path works correctly.

## User Setup Required

None - no external service configuration required for this plan. The Google OAuth Hosted UI and Cognito app client configuration are covered in later plans (04-02, 04-03).

## Next Phase Readiness
- Backend session exchange endpoint is ready to accept Cognito idTokens from the static callback page (Wave 2)
- auth_provider column is migrated and serialized — frontend can read authProvider on login response
- CORS is open for auth.realtybase.ca — static callback page can POST without preflight rejection
- Plan 04-02 (callback page / static site deployment) can proceed immediately

---
*Phase: 04-google-oauth*
*Completed: 2026-05-09*

## Self-Check: PASSED

Files verified:
- FOUND: backend/db/migrate/20260509000001_add_auth_provider_to_users.rb
- FOUND: backend/config/initializers/cors.rb
- FOUND: backend/app/serializers/user_serializer.rb
- FOUND: backend/app/controllers/v1/sessions_controller.rb

Commits verified: 17e6f56 and 8c141cd present in backend git log
