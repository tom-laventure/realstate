---
status: partial
phase: 37-free-tier-gating
source: [37-VERIFICATION.md]
started: 2026-07-21T04:58:46Z
updated: 2026-07-21T04:58:46Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Board Registrations banner rendering
expected: Load a Free-tier brokerage's Board Registrations page (/admin/boards) — the blue info-notice FreeTierBanner renders cleanly in context (no clipping/overflow, spacing matches surrounding cards), exactly per UI-SPEC, with the TEST board still shown as connectable.
result: [pending]

### 2. Client-invite form banner replacement
expected: Open the "Invite New User" area of AddUserToGroupView on a Free-tier brokerage — the banner replaces the invite form without layout jank. Switching to a paid-tier brokerage restores the full invite form. No visual regression to the adjacent "Add Existing User" form or Members/Invites tabs.
result: [pending]

### 3. Calendar tab banner-vs-grid transition
expected: Visit the account Calendar tab as a fully-Free user and as a paid-membership user — heading/intro text stays visible in both states, and the banner-vs-grid switch feels intentional, not jarring. FreeTierBanner on Free, provider-card grid on paid, per UI-SPEC.
result: [pending]

### 4. Domains page banner, no dead-code artifact
expected: Visit the Domains admin page as a Free-tier brokerage — only the customDomainAvailable-gated banner is visible, with no stray/dead "isPremium" affordance leaking into the UI (WR-05 is informational-only, confirmed unread by any consumer at the source level, but not yet confirmed at runtime).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
