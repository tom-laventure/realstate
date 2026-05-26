---
phase: 17-brokerage-selection-post-create-redirect
plan: "03"
subsystem: frontend/auth,frontend/onboarding
tags: [frontend, auth, onboarding, redux, redirect]
dependency_graph:
  requires:
    - 17-01 (activeBrokerage Redux slice — setAdminBrokerages action)
  provides:
    - LoginSuccessful dispatches adminBrokerages list to Redux (D-03)
    - SuccessStep "Go to dashboard" redirects to https://{VITE_MAIN_DOMAIN}/dashboard/:brokerageId (D-11, ONB-04)
  affects:
    - frontend/src/containers/auth/LoginSuccessful.tsx
    - frontend/src/containers/createBrokerage/steps/SuccessStep.tsx
tech_stack:
  added: []
  patterns:
    - useAppDispatch + setAdminBrokerages dispatch pattern (mirrors existing Redux action usage)
    - VITE_MAIN_DOMAIN env var for cross-origin redirect (mirrors existing VITE_APP_BASE_DOMAIN pattern)
    - String() coercion for string | number union type
key_files:
  created: []
  modified:
    - frontend/src/containers/auth/LoginSuccessful.tsx
    - frontend/src/containers/createBrokerage/steps/SuccessStep.tsx
decisions:
  - dispatch(setAdminBrokerages) fires inside .then before navigate — guarantees Redux populated before BrokerageSelection reads the store
  - String(brokerageId) coercion handles string | number union from CreateBrokerageResponse without type assertion
  - disabled={!brokerageId} guard on SuccessStep primary CTA prevents click when result is missing (defensive, not blocking)
  - MAIN_DOMAIN module-level constant mirrors BASE_DOMAIN declaration style for consistency
metrics:
  duration: ~8min
  completed: "2026-05-26"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 17 Plan 03: LoginSuccessful Redux Dispatch + SuccessStep Redirect Summary

LoginSuccessful dispatches adminBrokerages list to Redux (D-03) before navigating to /dashboard; SuccessStep "Go to dashboard" button redirects to https://{VITE_MAIN_DOMAIN}/dashboard/{brokerageId} (ONB-04, D-11).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | LoginSuccessful — dispatch adminBrokerages to Redux before navigating to /dashboard (D-03) | ca60c02 | frontend/src/containers/auth/LoginSuccessful.tsx |
| 2 | SuccessStep — redirect to main domain /dashboard/:brokerageId (ONB-04, D-11) | 3427ede | frontend/src/containers/createBrokerage/steps/SuccessStep.tsx |

## What Was Built

### Task 1: LoginSuccessful Redux Dispatch (D-03)

`LoginSuccessful.tsx` now imports `useAppDispatch` and `setAdminBrokerages`, calls `dispatch(setAdminBrokerages(data.adminBrokerages))` inside the `.then` callback when `adminBrokerages.length > 0`, before calling `navigate('/dashboard', { replace: true })`. This populates the Redux store so the `BrokerageSelection` screen (Plan 02) can render brokerage cards from Redux without a second API call.

All existing behavior preserved:
- Empty-list branch (`navigate('/no-access')`) — unchanged
- Error catch branch (`setError(true)`) — unchanged
- Subdomain branch (`if (!isMainDomain()) { navigate(destination) }`) — unchanged
- `setToken(token)` / hash-clearing logic — unchanged
- Error card and loading card UI — unchanged

### Task 2: SuccessStep Main Domain Redirect (ONB-04, D-11)

`SuccessStep.tsx` has three targeted changes:

1. New module-level constant `const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'realstate.ca'` added immediately after the existing `BASE_DOMAIN` declaration.
2. New `const brokerageId = state.result?.brokerage?.id` declaration added alongside the existing state destructures.
3. Primary "Go to dashboard" `Button` onClick updated to redirect to `https://${MAIN_DOMAIN}/dashboard/${String(brokerageId)}`, with `disabled={!brokerageId}` defensive guard.

All existing behavior preserved:
- `BASE_DOMAIN` and `isSafeRedirectHost()` declarations — unchanged (still guard secondary subdomain/custom-domain buttons)
- Dual-button branch (`dnsState === 'verified' && customDomain`) — unchanged
- DNS verification flow (`handleCheckDns`, `triggerVerify`, `dnsState` state) — unchanged
- Subdomain card display — unchanged
- `DnsInstructions` component — unchanged

## Verification Results

- All grep acceptance checks passed for both files (counts and ordering)
- TypeScript compile: no new errors in either modified file
- `npm run build` exits 0 — production bundle builds cleanly
- Test suite: 13 passing, 2 failing (pre-existing GoogleSignInButton failures, predating Phase 17)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. Both modifications wire real data sources to real navigation targets. `VITE_MAIN_DOMAIN` is a build-time env var (no runtime stub). `state.result.brokerage.id` is server-authoritative (populated after successful POST).

## Threat Flags

No new security-relevant surface introduced beyond what the threat model already covers:
- T-17-08: `brokerageId` from server response, `String()` coercion neutralizes type union — mitigated per plan
- T-17-09: Brokerage ID in URL — accepted per plan (owner's own brokerage)
- T-17-12: `dispatch(setAdminBrokerages)` fires inside authenticated `.then` — mitigated per plan

## Self-Check

- [x] `frontend/src/containers/auth/LoginSuccessful.tsx` modified (imports + dispatch)
- [x] `frontend/src/containers/createBrokerage/steps/SuccessStep.tsx` modified (MAIN_DOMAIN, brokerageId, new onClick)
- [x] Commit ca60c02 exists: feat(17-03): dispatch adminBrokerages to Redux before navigating to /dashboard (D-03)
- [x] Commit 3427ede exists: feat(17-03): redirect 'Go to dashboard' to main domain /dashboard/:brokerageId (ONB-04, D-11)
- [x] Build passes: `npm run build` exits 0
- [x] Tests: 13 passing (pre-existing 2 failing GoogleSignInButton — not introduced by this plan)

## Self-Check: PASSED
