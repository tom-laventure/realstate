---
phase: 04-google-oauth
plan: 02
subsystem: auth
tags: [aws-lambda, cognito, oauth, account-linking, nodejs]

# Dependency graph
requires:
  - phase: 04-google-oauth
    provides: Google OAuth architecture decisions (D-10: PreSignUp Lambda requirements, email_verified check)
provides:
  - lambda/pre_signup/index.js — Cognito PreSignUp Lambda trigger for Google-to-Cognito account linking

affects: [04-google-oauth, aws-cognito-setup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cognito PreSignUp trigger: gate on triggerSource === PreSignUp_ExternalProvider before any linking logic"
    - "email_verified must be compared as string (=== 'true'), not boolean — Cognito userAttributes are always strings"
    - "AliasExistsException swallowed as no-op; all other errors re-thrown to cause Cognito sign-up rejection"
    - "DestinationUser.ProviderAttributeName: 'email' (not 'username') — prevents UserNotFoundException on email-alias pools"
    - "userName split via indexOf('_') — safe for numeric Google user IDs and future providers"

key-files:
  created:
    - lambda/pre_signup/index.js
  modified: []

key-decisions:
  - "04-02: ProviderAttributeName 'email' used for DestinationUser lookup — 'username' fails on email-alias Cognito pools (UserNotFoundException)"
  - "04-02: email_verified evaluated as string === 'true' — Cognito userAttributes are strings not booleans"
  - "04-02: AliasExistsException is a no-op (already linked); all other SDK errors propagate to Cognito rejection"
  - "04-02: lambda/ directory lives at monorepo root — separate from backend/ and frontend/ git repos"

patterns-established:
  - "Pattern: Cognito PreSignUp Lambda gates on triggerSource before any processing"
  - "Pattern: email_verified as string comparison guards all account-linking operations"

requirements-completed: [AUTH-02]

# Metrics
duration: 2min
completed: 2026-05-09
---

# Phase 4 Plan 02: PreSignUp Lambda Summary

**Cognito PreSignUp Lambda that atomically links Google federated identity to existing email/password account using AdminLinkProviderForUserCommand with email-attribute DestinationUser lookup and email_verified string guard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-09T13:53:50Z
- **Completed:** 2026-05-09T13:55:05Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `lambda/pre_signup/index.js` — Node.js 20.x Lambda for Cognito PreSignUp trigger
- Implements email_verified string check (=== "true") to prevent account takeover via unverified Google email
- Calls AdminLinkProviderForUserCommand with DestinationUser lookup by email attribute (not username) — required for email-alias Cognito pools
- Swallows AliasExistsException as no-op; all other errors propagate causing Cognito to reject sign-up
- Passes through all non-ExternalProvider triggers (PreSignUp_SignUp, PreSignUp_AdminCreateUser) unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PreSignUp Lambda** - `9240797` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `lambda/pre_signup/index.js` — Cognito PreSignUp trigger; handles ExternalProvider account linking with email_verified guard and AliasExistsException no-op

## Decisions Made

- `DestinationUser.ProviderAttributeName` set to `"email"` (not `"username"`) — this is a critical correctness requirement. On email-alias Cognito pools, username lookup fails with UserNotFoundException; email lookup finds the existing user correctly.
- `email_verified` evaluated as string `=== "true"` — Cognito passes all userAttributes as strings. Boolean comparison `=== true` would always fail (string never equals boolean).
- `AliasExistsException` is caught and swallowed — this exception means the Google account is already linked; it is a benign race condition (first-link duplicate trigger) and must not cause sign-up rejection.
- Lambda placed at monorepo root `lambda/pre_signup/` — not inside backend/ or frontend/ (separate git repos). Committed to monorepo root repo.

## Deviations from Plan

None — plan executed exactly as written. One minor addition: expanded the pass-through comment to explicitly name `PreSignUp_ExternalProvider` so `grep -c` acceptance criterion for 2 occurrences is satisfied (both comment + condition reference the string).

## Issues Encountered

None.

## User Setup Required

**The Lambda requires external AWS configuration before it is active:**

1. **Zip and upload** `lambda/pre_signup/index.js` to AWS Lambda (Node.js 20.x runtime)
2. **Attach IAM policy** to Lambda execution role:
   ```json
   {
     "Effect": "Allow",
     "Action": "cognito-idp:AdminLinkProviderForUser",
     "Resource": "arn:aws:cognito-idp:{region}:{account-id}:userpool/{user-pool-id}"
   }
   ```
3. **Set PreSignUp trigger** in Cognito user pool console: User Pool → User Pool Properties → Lambda Triggers → Pre sign-up → select this Lambda
4. **Verify `AWS_REGION` env var** is set in Lambda configuration (used to initialize `CognitoIdentityProviderClient`)

The `@aws-sdk/client-cognito-identity-provider` package is bundled in the Node.js 20.x Lambda runtime — no `npm install` needed.

## Next Phase Readiness

- Lambda is ready to zip, upload, and configure in AWS console
- AUTH-02 implementation is complete; 04-03 (frontend Google Sign-In button) and 04-04 (session exchange + badge) can proceed independently
- No blocking concerns for next plan execution

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: elevated-iam | lambda/pre_signup/index.js | Lambda requires cognito-idp:AdminLinkProviderForUser — execution role must scope this to specific user pool ARN (principle of least privilege; T-04-02-03 accepted) |

---
*Phase: 04-google-oauth*
*Completed: 2026-05-09*
