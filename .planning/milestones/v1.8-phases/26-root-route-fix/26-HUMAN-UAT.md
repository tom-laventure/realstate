---
status: partial
phase: 26-root-route-fix
source: [26-VERIFICATION.md]
started: 2026-06-04T06:17:14Z
updated: 2026-06-04T06:17:14Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Main domain root redirect
expected: Visit `/` while signed out on the main domain — no NotFound flash, land on `/auth/login`
result: [pending]

### 2. Subdomain blank-screen elimination
expected: Visit subdomain `/` while signed out — immediate redirect to `/auth/login` with no perceptible delay or blank screen
result: [pending]

### 3. Authenticated user regression
expected: Sign in and verify `/` renders correctly on both domain types — no unexpected redirects
result: [pending]

### 4. joinBrokerage invite link
expected: Visit `/invite/:token` on subdomain while signed out — JoinBrokerage page renders (not a login redirect)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
