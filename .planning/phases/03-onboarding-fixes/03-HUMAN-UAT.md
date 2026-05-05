---
status: partial
phase: 03-onboarding-fixes
source: [03-VERIFICATION.md]
started: 2026-05-05T06:30:00Z
updated: 2026-05-05T06:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Duplicate subdomain submission stays on DomainStep
expected: Submit a known duplicate subdomain in the wizard — DomainStep should NOT advance to the next step; inline error under SubdomainInput; no toast
result: [pending]

### 2. Post-accept navigation — group-scoped invitation
expected: Accept a group-scoped invitation and confirm the browser URL becomes /{groupUid} (a UUID path), not /dashboard/{integer}
result: [pending]

### 3. Welcome banner dismiss persists across sessions
expected: Click X on the welcome banner, refresh the page, confirm banner does NOT reappear (server-returned show_welcome_banner=false after dismiss)
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
