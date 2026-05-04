---
phase: 03-onboarding-fixes
plan: "02"
subsystem: auth
tags: [invitations, navigation, react-router, rails, onboarding]

# Dependency graph
requires:
  - phase: 02-test-suite
    provides: "TEST-06 invitation integration tests passing (accept_token, validate_token)"
provides:
  - "Backend returns group.uid (UUID) as next_step for group-scoped invitations"
  - "Backend returns 'dashboard' sentinel for brokerage-level invitations"
  - "JoinBrokerage navigates to absolute paths after accept"
  - "Invitation.tsx guards 'dashboard' sentinel before navigating"
affects: [03-onboarding-fixes, 04-google-oauth]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "next_step = group.uid pattern (UUID-based post-accept routing)"
    - "dashboard sentinel string guards nextStep !== 'dashboard' before navigate"

key-files:
  created: []
  modified:
    - backend/app/controllers/v1/dashboard/invitations_controller.rb
    - frontend/src/containers/auth/joinBrokerage/JoinBrokerage.tsx
    - frontend/src/containers/auth/Invitation.tsx

key-decisions:
  - "D-09: accept action returns group.uid not group.id.to_s — UUID is the canonical public identifier for groups"
  - "D-10: accept_token brokerage-level branch returns next_step = 'dashboard' sentinel unchanged"
  - "D-11: JoinBrokerage.handleAccept uses absolute paths: navigate('/\${nextStep}') for group UID, navigate('/') for 'dashboard' or absent"
  - "D-12: Invitation.tsx onSuccess guards nextStep !== 'dashboard' so sentinel value routes to root instead of /dashboard (which has no route)"

patterns-established:
  - "Post-accept navigation: always use absolute leading-slash paths; never relative dashboard/... paths"
  - "dashboard sentinel: server signals 'go to root' via literal string 'dashboard' — frontend guards !== 'dashboard' before interpolating into path"

requirements-completed: [ONB-02]

# Metrics
duration: 10min
completed: 2026-05-03
---

# Phase 3 Plan 02: Invitation Navigation Fix Summary

**Backend now returns group.uid (UUID) as next_step for group invitations; both frontend invitation flows navigate to absolute paths and handle the 'dashboard' sentinel, landing users on real routes after accept.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-03T19:10:00Z
- **Completed:** 2026-05-03T23:57:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Fixed root cause: `invitations_controller#accept` and `#accept_token` now return `group.uid` (UUID string) instead of `group.id.to_s` (integer string) so the frontend router's `/:groupUid` route can match
- Fixed JoinBrokerage: `handleAccept` uses `navigate(\`/\${nextStep}\`, { replace: true })` for group UIDs and `navigate('/', { replace: true })` for the 'dashboard' sentinel — no more relative `dashboard/...` paths
- Fixed Invitation.tsx: `onSuccess` adds `nextStep !== 'dashboard'` guard so the sentinel routes to root (`/`) rather than the non-existent `/dashboard` route; `brokerage-contact` branch preserved unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend — replace group.id.to_s with group.uid** - `23c71ac` (fix) — backend sub-repo
2. **Task 2: Frontend — fix JoinBrokerage and Invitation navigation** - `223fed3` (fix) — frontend sub-repo

**Plan metadata:** (committed below with SUMMARY.md)

## Files Created/Modified

- `backend/app/controllers/v1/dashboard/invitations_controller.rb` — Two `group.id.to_s` → `group.uid` replacements (lines 106 and 173)
- `frontend/src/containers/auth/joinBrokerage/JoinBrokerage.tsx` — handleAccept body replaced: absolute paths, dashboard sentinel guard
- `frontend/src/containers/auth/Invitation.tsx` — onSuccess: added `&& nextStep !== 'dashboard'` to the truthy-nextStep branch

## Changes in Detail

### backend/app/controllers/v1/dashboard/invitations_controller.rb

**accept_token action (line ~106):**
```ruby
# Before
next_step = group.id.to_s

# After
next_step = group.uid
```

**accept action (line ~173):**
```ruby
# Before
render json: { message: "Invitation accepted", next_step: group.id.to_s }, status: :ok

# After
render json: { message: "Invitation accepted", next_step: group.uid }, status: :ok
```

The brokerage-level (no group_id) default `next_step = "dashboard"` on line 86 was already correct — unchanged.

### frontend/src/containers/auth/joinBrokerage/JoinBrokerage.tsx

**handleAccept body (lines ~41-51):**
```tsx
// Before
if (nextStep) {
    navigate(`dashboard/${nextStep}`, { replace: true })
    return
}
navigate('dashboard', { replace: true })

// After
if (nextStep && nextStep !== 'dashboard') {
    navigate(`/${nextStep}`, { replace: true })
    return
}
navigate('/', { replace: true })
```

### frontend/src/containers/auth/Invitation.tsx

**onSuccess callback (lines ~25-36):**
```tsx
// Before
if (nextStep) {
    navigate(`/${nextStep}`)
    return
}

// After
if (nextStep && nextStep !== 'dashboard') {
    navigate(`/${nextStep}`)
    return
}
```

## Decisions Made

- D-09 and D-10: Backend UID change — `group.uid` is the UUID column generated by `SecureRandom.uuid` on create, confirmed present in `app/models/group.rb`. It's the canonical public group identifier used in routes. The test assertions in `invitations_test.rb` check response keys (not values), so changing the value type from integer-string to UUID-string does not break existing tests.
- D-11 and D-12: Frontend absolute paths — react-router's `navigate()` treats strings without a leading slash as relative (relative to the current URL segment), so `navigate('dashboard/123')` from `/join/:token` would produce `/join/dashboard/123`. Adding the leading slash makes navigation absolute and correct.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- **Backend test runner crash (pre-existing):** `bin/rails test test/integration/invitations_test.rb` exits 134 with a Ruby 4.0.2 GC segfault during test framework bootstrap (`rb_gc_mark(): unknown data type`). This crash is pre-existing and unrelated to our changes — it occurs before any test code runs. The standardrb check passed cleanly, and the grep acceptance criteria (0 occurrences of `group.id.to_s`, 2 occurrences of `group.uid`, 1 occurrence of `"dashboard"`) are all satisfied.
- **TypeScript check pre-existing failure:** `npx tsc --noEmit` fails with `TS6046: Argument for '--moduleResolution' option must be: 'node', 'classic', 'node16', 'nodenext'` — TS 4.9.5 does not support `moduleResolution: "bundler"` (requires TS 5.0+). This is a pre-existing environment mismatch documented in important_notes, not caused by our changes.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- ONB-02 resolved: invitation accept flows land users on valid routes (`/:groupUid` or `/`)
- No blockers introduced for subsequent Phase 3 plans (03-03, 03-04)

## Self-Check: PASSED

- FOUND: .planning/phases/03-onboarding-fixes/03-02-SUMMARY.md
- FOUND: backend/app/controllers/v1/dashboard/invitations_controller.rb
- FOUND: frontend/src/containers/auth/joinBrokerage/JoinBrokerage.tsx
- FOUND: frontend/src/containers/auth/Invitation.tsx
- FOUND: 23c71ac (backend — fix invitations_controller group.uid)
- FOUND: 223fed3 (frontend — fix invitation navigation paths)

---
*Phase: 03-onboarding-fixes*
*Completed: 2026-05-03*
