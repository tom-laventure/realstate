---
status: passed
phase: 03-onboarding-fixes
source: [03-VERIFICATION.md]
started: 2026-05-05T06:30:00Z
updated: 2026-05-05T06:35:00Z
---

## Current Test

[completed]

## Tests

### 1. Duplicate subdomain submission stays on DomainStep
expected: Submit a known duplicate subdomain in the wizard — DomainStep should NOT advance to the next step; inline error under SubdomainInput; no toast
result: passed

### 2. Post-accept navigation — group-scoped invitation
expected: Accept a group-scoped invitation and confirm the browser URL becomes /{groupUid} (a UUID path), not /dashboard/{integer}
result: passed

### 3. Welcome banner dismiss persists across sessions
expected: Click X on the welcome banner, refresh the page, confirm banner does NOT reappear (server-returned show_welcome_banner=false after dismiss)
result: passed

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
