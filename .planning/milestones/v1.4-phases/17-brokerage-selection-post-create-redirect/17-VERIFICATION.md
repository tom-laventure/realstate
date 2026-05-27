---
phase: 17-brokerage-selection-post-create-redirect
verified: 2026-05-26T00:00:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to /dashboard while logged in with multiple brokerages"
    expected: "One selection card per brokerage renders with brokerage name and capitalized role badge (Owner, Admin, etc.)"
    why_human: "Visual rendering of card list from Redux state cannot be verified without a running browser session"
  - test: "Navigate to /dashboard while logged in with exactly one brokerage"
    expected: "No selection card flashes — browser immediately redirects to /dashboard/:brokerageId (replace navigation, no back-button return to /dashboard)"
    why_human: "Anti-flash guard (return null + useEffect redirect) requires live rendering to confirm there is no visible flash"
  - test: "Complete the create-brokerage wizard end-to-end, then click 'Go to dashboard'"
    expected: "Browser navigates to https://{VITE_MAIN_DOMAIN}/dashboard/{new-brokerage-id}; PortalShell mounts with empty Redux, shows loading spinner briefly, then renders the Admin Portal placeholder card"
    why_human: "Full end-to-end wizard flow with window.location.href cross-origin redirect cannot be verified programmatically"
  - test: "Navigate directly to /dashboard/<invalid-uuid> in URL bar"
    expected: "Browser redirects to /dashboard (selection screen) via replace navigation"
    why_human: "Runtime routing behavior of PortalShell's D-12 validation path requires a live browser session"
---

# Phase 17: Brokerage Selection & Post-Create Redirect Verification Report

**Phase Goal:** Users land on the right brokerage context after sign-in and after completing the creation wizard — one-brokerage admins skip the selection screen, multi-brokerage admins choose from cards.
**Verified:** 2026-05-26T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria + PLAN frontmatter)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin with multiple brokerages sees one card per brokerage showing name and role badge | ✓ VERIFIED | `BrokerageSelection.tsx` maps `adminBrokerages` array from `s.activeBrokerage.adminBrokerages` in Redux, renders a `<button>` per entry with `{brokerage.name}` and `{brokerage.role}` inside a `capitalize` span |
| 2 | Admin managing exactly one brokerage is auto-redirected without seeing the selection screen | ✓ VERIFIED | `BrokerageSelection.tsx` line 12 checks `adminBrokerages.length === 1`, dispatches `setActiveBrokerage`, navigates with `replace: true`, and returns `null` before JSX (anti-flash guard at line 19) |
| 3 | Post-wizard user lands on main domain dashboard with newly created brokerage selected | ✓ VERIFIED | `SuccessStep.tsx` line 128: `window.location.href = \`https://${MAIN_DOMAIN}/dashboard/${String(brokerageId)}\``; `MAIN_DOMAIN` reads `VITE_MAIN_DOMAIN` env var (confirmed in `.env`); `brokerageId` sourced from `state.result?.brokerage?.id` |
| 4 | Root Redux store exposes `activeBrokerage` slice with correct state shape and 3 action creators | ✓ VERIFIED | `activeBrokerage.ts`: `createSlice` with `name: 'activeBrokerage'`, `initialState: { activeBrokerage: null, adminBrokerages: [] }`, exports `setActiveBrokerage`, `setAdminBrokerages`, `clearActiveBrokerage` |
| 5 | Root store and test helper both wire `activeBrokerageReducer` | ✓ VERIFIED | `index.tsx` line 4+12: `import activeBrokerageReducer from './activeBrokerage'` and `activeBrokerage: activeBrokerageReducer`; `renderWithProviders.tsx` line 10+35: same pattern |
| 6 | LoginSuccessful dispatches `setAdminBrokerages` to Redux BEFORE navigating to /dashboard | ✓ VERIFIED | `LoginSuccessful.tsx` line 51: `dispatch(setAdminBrokerages(data.adminBrokerages))` fires at line 51, `navigate('/dashboard', ...)` fires at line 53 — confirmed correct order via awk |
| 7 | PortalShell validates `:brokerageId` against Redux, re-fetches when Redux is empty, redirects on invalid | ✓ VERIFIED | `PortalShell.tsx`: D-12 branch at line 21 (`adminBrokerages.find((b) => b.id === brokerageId)`); D-13 branch at lines 34-50 (re-fetch via `useFetchAdminBrokerages`); 4 total `navigate('/dashboard', { replace: true })` invocations |
| 8 | Portal route tree registers index → BrokerageSelection, `:brokerageId` → PortalShell, `*` → BrokerageSelection | ✓ VERIFIED | `portal.tsx` lines 12-14: three children in correct React Router v6 order (`:brokerageId` at line 13, `*` catch-all at line 14); `DashboardPlaceholder` fully removed (grep count = 0) |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/store/reducers/activeBrokerage.ts` | activeBrokerage Redux slice | ✓ VERIFIED | 32 lines, `createSlice`, 3 named action exports, default reducer export, imports `AdminBrokerage` from `@/assets/types/adminBrokerageType` |
| `frontend/src/store/reducers/index.tsx` | Root store wired with activeBrokerageReducer | ✓ VERIFIED | Contains `import activeBrokerageReducer from './activeBrokerage'` and `activeBrokerage: activeBrokerageReducer` |
| `frontend/src/test/renderWithProviders.tsx` | Test store including activeBrokerage reducer | ✓ VERIFIED | Contains `import activeBrokerageReducer from '@/store/reducers/activeBrokerage'` and `activeBrokerage: activeBrokerageReducer` in `configureStore` call |
| `frontend/src/containers/portal/BrokerageSelection.tsx` | Multi-brokerage card list + single-brokerage auto-redirect | ✓ VERIFIED | 52 lines (min 35 required), maps `adminBrokerages` to `<button>` cards, `adminBrokerages.length === 1` guard, `return null` anti-flash, no shadcn Card imports |
| `frontend/src/containers/portal/PortalShell.tsx` | /dashboard/:brokerageId shell with D-12 and D-13 logic | ✓ VERIFIED | 85 lines (min 60 required), `useParams`, `useFetchAdminBrokerages`, loading spinner with `role="status"` and `aria-label`, 4 redirect paths |
| `frontend/src/router/portal/portal.tsx` | Route map with index, :brokerageId, catch-all | ✓ VERIFIED | 3 children registered, `DashboardPlaceholder` removed (0 occurrences), `:brokerageId` route at line 13 before `*` catch-all at line 14 |
| `frontend/src/containers/auth/LoginSuccessful.tsx` | Dispatches adminBrokerages before /dashboard navigate | ✓ VERIFIED | `useAppDispatch` and `setAdminBrokerages` imported and used; dispatch at line 51 precedes navigate at line 53 |
| `frontend/src/containers/createBrokerage/steps/SuccessStep.tsx` | Go to dashboard redirects to main domain /dashboard/:id | ✓ VERIFIED | `MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN`, `brokerageId = state.result?.brokerage?.id`, `window.location.href = \`https://${MAIN_DOMAIN}/dashboard/${String(brokerageId)}\``, `disabled={!brokerageId}` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `activeBrokerage.ts` | `adminBrokerageType.ts` | `import { AdminBrokerage }` | ✓ WIRED | Line 2: `import { AdminBrokerage } from '@/assets/types/adminBrokerageType'` |
| `index.tsx` | `activeBrokerage.ts` | default reducer import | ✓ WIRED | Line 4: `import activeBrokerageReducer from './activeBrokerage'` |
| `renderWithProviders.tsx` | `activeBrokerage.ts` | default reducer import | ✓ WIRED | Line 10: `import activeBrokerageReducer from '@/store/reducers/activeBrokerage'` |
| `BrokerageSelection.tsx` | `activeBrokerage.ts` | `setActiveBrokerage` import + dispatch | ✓ WIRED | Line 4 import, lines 13 and 34 dispatch |
| `BrokerageSelection.tsx` | Redux store | `useAppSelector(s => s.activeBrokerage.adminBrokerages)` | ✓ WIRED | Line 9: reads from `s.activeBrokerage.adminBrokerages` |
| `PortalShell.tsx` | `useFetchAdminBrokerages.ts` | imperative hook | ✓ WIRED | Line 5 import, line 12 hook call, line 35 invocation |
| `PortalShell.tsx` | `activeBrokerage.ts` | `setActiveBrokerage` + `setAdminBrokerages` | ✓ WIRED | Line 4 import, dispatched at lines 24, 37, 40 |
| `portal.tsx` | `BrokerageSelection.tsx` | default import + JSX element | ✓ WIRED | Line 3 import, `<BrokerageSelection />` at lines 12 and 14 |
| `portal.tsx` | `PortalShell.tsx` | default import + JSX element | ✓ WIRED | Line 4 import, `<PortalShell />` at line 13 |
| `LoginSuccessful.tsx` | `activeBrokerage.ts` | `setAdminBrokerages` import + dispatch | ✓ WIRED | Lines 7-8 imports, line 51 dispatch before line 53 navigate |
| `SuccessStep.tsx` | `VITE_MAIN_DOMAIN` env var | `import.meta.env.VITE_MAIN_DOMAIN` | ✓ WIRED | Line 10: `const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'realstate.ca'`; confirmed present in `.env` |
| `SuccessStep.tsx` | `state.result?.brokerage?.id` | CreateBrokerageContext result | ✓ WIRED | Line 27: `const brokerageId = state.result?.brokerage?.id`; used in onClick at line 128 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `BrokerageSelection.tsx` | `adminBrokerages` | `useAppSelector(s => s.activeBrokerage.adminBrokerages)` populated by `LoginSuccessful.tsx` via `fetchAdminBrokerages` → `dispatch(setAdminBrokerages(...))` | Yes — live API call to `/v1/account/admin_brokerages` via `axiosInstance.get` | ✓ FLOWING |
| `PortalShell.tsx` | `adminBrokerages` (D-13 empty case) | `useFetchAdminBrokerages()` → `fetchAdminBrokerages()` → `axiosInstance.get('/v1/account/admin_brokerages')` | Yes — live API call | ✓ FLOWING |
| `SuccessStep.tsx` | `brokerageId` | `state.result?.brokerage?.id` from `CreateBrokerageContext` (populated after successful POST to create brokerage) | Yes — server-authoritative response | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `activeBrokerage.ts` exports all 3 action creators | `grep -c "export const { setActiveBrokerage, setAdminBrokerages, clearActiveBrokerage }"` | 1 | ✓ PASS |
| Root store has `activeBrokerage` key | `grep -c "activeBrokerage: activeBrokerageReducer" frontend/src/store/reducers/index.tsx` | 1 | ✓ PASS |
| Test helper has `activeBrokerage` key | `grep -c "activeBrokerage: activeBrokerageReducer" frontend/src/test/renderWithProviders.tsx` | 1 | ✓ PASS |
| BrokerageSelection has anti-flash guard | `grep -c "if (adminBrokerages.length === 1) return null"` | 1 | ✓ PASS |
| PortalShell has ≥3 redirect paths | `grep -c "navigate('/dashboard', { replace: true })"` | 4 | ✓ PASS |
| Route order: `:brokerageId` before `*` | awk line-number check | :brokerageId=13, `*`=14 | ✓ PASS |
| dispatch before navigate in LoginSuccessful | awk line-number check | dispatch=51, navigate=53 | ✓ PASS |
| `VITE_MAIN_DOMAIN` present in .env | `grep VITE_MAIN_DOMAIN frontend/.env` | `VITE_MAIN_DOMAIN=your-main-domain.com` | ✓ PASS |
| No shadcn Card imports in portal components | `grep "from '@/components/ui/card'"` in BrokerageSelection.tsx, PortalShell.tsx | 0 matches | ✓ PASS |
| All 8 Phase 17 commits exist in git log | `git log --oneline -15` | 006ed3c, d43a233, 9afa082, a1ddab5, ca60c02, 7009aff, 3427ede, 9d0149d all present | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BROK-01 | 17-02 | User can see a card per brokerage they admin (with brokerage name and role) on the brokerage selection screen | ✓ SATISFIED | `BrokerageSelection.tsx` maps `adminBrokerages` to `<button>` cards with `{brokerage.name}` and `{brokerage.role}` in capitalize span |
| BROK-02 | 17-02 | User admining exactly one brokerage bypasses the selection screen and lands directly on the dashboard | ✓ SATISFIED | `BrokerageSelection.tsx` `useEffect` dispatches `setActiveBrokerage` and replace-navigates when `adminBrokerages.length === 1`; `return null` prevents flash |
| ONB-04 | 17-03 | User completing the brokerage creation wizard is redirected to the main domain dashboard with the newly created brokerage auto-selected | ✓ SATISFIED | `SuccessStep.tsx` "Go to dashboard" button: `window.location.href = \`https://${MAIN_DOMAIN}/dashboard/${String(brokerageId)}\`` — routes to `PortalShell` which dispatches `setActiveBrokerage` via D-13 re-fetch |

No orphaned requirements — all three IDs (BROK-01, BROK-02, ONB-04) mapped to Phase 17 in REQUIREMENTS.md traceability table are covered by the plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `PortalShell.tsx` (resolved state) | 71-82 | Placeholder card "Admin Portal / Your brokerage dashboard is being prepared." | INFO | Intentional — explicitly documented as Phase 18 replacement content; not a stub blocking Phase 17 goal |

No blocking anti-patterns found. No TODO/FIXME/PLACEHOLDER comments in any Phase 17 files. The PortalShell resolved state is an intentional scaffold per the plan's known stubs declaration.

### Human Verification Required

#### 1. Multi-Brokerage Card Rendering

**Test:** Sign in on the main domain with an account that has admin roles in 2+ brokerages. Navigate to `/dashboard`.
**Expected:** Selection screen renders with one card per brokerage, each showing the brokerage name (semibold foreground text) and a role badge (muted background, capitalize applied — "Owner", "Admin", etc.)
**Why human:** Visual rendering of JSX from Redux state cannot be verified by grep or static analysis.

#### 2. Single-Brokerage Auto-Redirect (No Flash)

**Test:** Sign in on the main domain with an account that has exactly one admin brokerage.
**Expected:** The user is taken directly to `/dashboard/:brokerageId` without ever seeing a selection card. The browser back button does not return to `/dashboard` (replace navigation).
**Why human:** The `return null` anti-flash guard and `{ replace: true }` navigation behavior require a live browser session to confirm no UI flash occurs.

#### 3. Post-Wizard Dashboard Redirect (ONB-04 End-to-End)

**Test:** Complete the create-brokerage wizard through to `SuccessStep`. Click "Go to dashboard".
**Expected:** Browser navigates to `https://{VITE_MAIN_DOMAIN}/dashboard/{new-brokerage-id}`. The PortalShell mounts, shows the loading spinner briefly (D-13 empty-Redux re-fetch), then renders the "Admin Portal" placeholder card. Active brokerage is set in Redux.
**Why human:** Requires the full wizard flow, a live backend, and cross-origin navigation from the wizard domain to the main domain.

#### 4. Invalid URL Direct Entry (D-12 Validation)

**Test:** Manually enter `/dashboard/00000000-0000-0000-0000-000000000000` in the URL bar (an ID not in the user's admin list).
**Expected:** PortalShell loads briefly (D-13 re-fetch if Redux is empty), then redirects to `/dashboard` (selection screen) via replace navigation.
**Why human:** Runtime routing and redirect behavior requires a live browser and an authenticated session.

### Gaps Summary

No gaps found. All 8 must-have truths verified against the actual codebase. All artifacts exist, are substantive, are wired into the consuming files, and have real data flowing through them. All three requirement IDs are satisfied by the implementation. The 4 human verification items represent UI/UX and end-to-end runtime behaviors that cannot be verified programmatically — they do not indicate missing implementation, only the need for manual smoke testing to confirm the correct runtime behavior.

---

_Verified: 2026-05-26T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
