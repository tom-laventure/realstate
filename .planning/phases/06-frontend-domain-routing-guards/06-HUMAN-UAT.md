---
status: partial
phase: 06-frontend-domain-routing-guards
source: [06-VERIFICATION.md]
started: 2026-05-14T06:29:26Z
updated: 2026-05-14T06:29:26Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SubdomainOnly blocks app routes on main domain

expected: Visit `http://localhost:3000/dashboard` with `VITE_MAIN_DOMAIN=localhost` — renders "Page not found" (not the dashboard)
result: [pending]

### 2. MainDomainOnly passes /create on main domain

expected: Visit `http://localhost:3000/create` with `VITE_MAIN_DOMAIN=localhost` — renders the brokerage creation wizard (not a 404)
result: [pending]

### 3. MainDomainOnly redirects /create on subdomain

expected: Temporarily set `VITE_MAIN_DOMAIN=realtybase.ca` in `frontend/.env`, restart dev server, visit `http://localhost:3000/create` — browser redirects to `http://localhost:3000/` without rendering the wizard. Revert env after testing.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
