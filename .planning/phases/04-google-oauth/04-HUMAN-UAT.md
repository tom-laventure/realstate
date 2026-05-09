---
status: partial
phase: 04-google-oauth
source: [04-VERIFICATION.md]
started: 2026-05-09T19:00:00Z
updated: 2026-05-09T19:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end Google sign-in
expected: Click "Continue with Google" on a live brokerage tenant subdomain, complete Google OAuth consent screen, confirm redirect to dashboard with an active session. Requires auth-callback/index.html deployed to https://auth.realtybase.ca/oauth/callback and Cognito app client registering that callback URL.
result: [pending]

### 2. Account linking — Google sign-in with existing email/password account
expected: Sign in with Google using an email already registered via email/password. The PreSignUp Lambda links the Google identity to the existing Cognito user. User lands on their existing account (same user record, same brokerage memberships) rather than creating a duplicate account. Requires Lambda deployed to AWS with cognito-idp:AdminLinkProviderForUser IAM permission set as the Cognito PreSignUp trigger.
result: [pending]

### 3. "Connected via Google" badge visible on MemberDetailCard
expected: View MemberDetailCard for a user who authenticated via Google OAuth. A "Connected via Google" badge (Shield icon, sky-500 color) is visible in the card. Depends on test #1 succeeding first.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
