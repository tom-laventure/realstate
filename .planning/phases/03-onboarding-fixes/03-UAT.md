---
status: complete
phase: 03-onboarding-fixes
source:
  - .planning/phases/03-onboarding-fixes/03-01-SUMMARY.md
  - .planning/phases/03-onboarding-fixes/03-02-SUMMARY.md
  - .planning/phases/03-onboarding-fixes/03-03-SUMMARY.md
  - .planning/phases/03-onboarding-fixes/03-04-SUMMARY.md
started: 2026-05-03T00:00:00Z
updated: 2026-05-04T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Kill any running backend/frontend server. Start backend fresh from backend/ with
  `rails server`. Run `rails db:migrate` — migration 20260503000001 applies cleanly
  (adds welcomed_at, deleted_at, index to brokerage_memberships). Start frontend with
  `npm run dev`. Both servers boot without errors. A basic API call (e.g., open the
  app in browser) returns live data without crashes.
result: pass

### 2. Domain wizard inline error on invalid subdomain
expected: |
  In the brokerage creation wizard, submit an already-taken or invalid subdomain.
  An error message appears inline below the subdomain input field — NOT as a toast.
  The wizard stays on the domain step; the user can correct the field and resubmit.
result: pass

### 3. SuccessStep DNS verification (Premium / custom domain)
expected: |
  After creating a brokerage with a custom domain, the SuccessStep shows a
  "Check DNS status" button. Clicking it shows a loading spinner while the check
  runs. If the domain resolves: a green "Domain verified" badge appears. If not:
  "Not yet verified — DNS may still be propagating." is shown. The button is
  manually triggered (no auto-polling).
result: pass

### 4. SuccessStep cross-domain navigation
expected: |
  After brokerage creation the SuccessStep renders two CTAs:
  "Go to your custom domain" (primary, if custom domain present) and
  "Go to subdomain" (outline). Clicking either navigates the browser to the
  respective https:// URL (full page navigation, not React Router). If only a
  subdomain was created, only "Go to subdomain" appears.
result: issue
reported: "on focus of the subdomain, the input borders disappear"
severity: cosmetic

### 5. Group invitation post-accept navigation
expected: |
  A user who accepts a group-scoped invitation (via join link or email invite) is
  redirected to the group page at /<groupUid> (the group's UUID slug) after accepting.
  The group page loads correctly — not a 404.
result: pass

### 6. Brokerage invitation post-accept navigation
expected: |
  A user who accepts a brokerage-level invitation (not scoped to a specific group)
  is redirected to the root dashboard (/) after accepting. They land on the general
  dashboard — not a /dashboard path (which has no route) and not a 404.
result: pass

### 7. Welcome banner appears for new users
expected: |
  Log in as a user who has never dismissed the banner (welcomed_at IS NULL on their
  brokerage_membership). Open the general dashboard. A welcome banner appears above
  the summary cards. It displays the brokerage name and the user's group names as
  badge chips. If the user has no groups, appropriate empty-state copy is shown.
result: issue
reported: "did not see a welcome banner for the user with email tom.laventure42@gmail.com when I first logged in"
severity: major

### 8. Welcome banner dismisses immediately (optimistic)
expected: |
  On the general dashboard with the welcome banner visible, click the X button.
  The banner disappears instantly — no confirmation dialog, no loading spinner,
  no toast. The dismiss fires silently in the background.
result: skipped
reason: banner not visible (blocked by Test 7 failure)

### 9. Banner stays dismissed after page refresh
expected: |
  After dismissing the banner (Test 8), reload the page. The welcome banner does
  NOT reappear — the dismissal was persisted (POST /v1/account/profile/dismiss_welcome
  set welcomed_at on the membership record). The general dashboard shows only the
  summary cards.
result: skipped
reason: banner not visible (blocked by Test 7 failure)

## Summary

total: 9
passed: 5
issues: 2
pending: 0
skipped: 2
blocked: 0

## Gaps

- truth: "Welcome banner appears on the general dashboard for users with welcomed_at IS NULL"
  status: failed
  reason: "User reported: did not see a welcome banner for the user with email tom.laventure42@gmail.com when I first logged in"
  severity: major
  test: 7
  artifacts: []
  missing: []

- truth: "Subdomain input border remains visible when the input is focused"
  status: failed
  reason: "User reported: on focus of the subdomain, the input borders disappear"
  severity: cosmetic
  test: 4
  root_cause: "focus-visible:ring-offset-2 (Input default) fires even with ring-0, creating a 2px background-colored box-shadow that covers the outer wrapper's 1px border. Fixed by adding focus-visible:ring-offset-0 to SubdomainInput.tsx."
  artifacts:
    - path: "src/components/createBrokerage/SubdomainInput.tsx"
      issue: "Missing focus-visible:ring-offset-0 on inner Input"
  missing: []

## Pre-test fixes applied (not UAT test failures — bugs found during env setup)

- fix: BrokerageContact "Back to login" never called clearToken() — Cognito signOut cleared the Cognito session but the localStorage auth_token remained valid. ProtectedRoute saw a live token, redirected to '/', API returned 403, brokerage-contact loop. Fixed by adding clearToken() before window.location.href in BrokerageContact.tsx.
- fix: postcss.config.js renamed to postcss.config.cjs — package.json "type":"module" (added for Vitest) made Node treat postcss.config.js as ESM, breaking the CommonJS module.exports syntax.
- fix: seeds missing uid on users and groups — uid NOT NULL columns added in migrations but seed data never populated them. Added SecureRandom.uuid to both 01_users.rb and 03_groups.rb.
