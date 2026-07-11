---
phase: 32-agent-read-only-access-access-gating
verified: 2026-07-10T18:25:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "Agent-role user loading /admin/users triggers NO GET /v1/admin/invitations request (structurally fixed: useFetchBrokerageInvitations now accepts { enabled }, useUsersAdminContext passes enabled: usePermission('manage_users'))"
    - "On /admin/users, no Invitations section appears for agent (already closed in 32-03, unaffected by 32-04, defense-in-depth confirmed)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Sign in as a real `agent` user (Cognito), open devtools Network tab, and navigate directly to /admin/users"
    expected: "No GET /v1/admin/invitations request appears in the network tab (no 403), the Users list renders normally, and no Invitations section is visible anywhere on the page"
    why_human: "32-04's fix is proven at the hook boundary by a unit test (renderHook, mocked leaf hooks, unmocked usePermission/useRole against a synthetic redux preloadedState) asserting useFetchBrokerageInvitations is called with { enabled: false } for role 'agent'. This is strong evidence the gating decision is correct, but it does not execute a real TanStack Query against a live network layer, does not exercise the real useRole() resolution path (subdomain vs main-domain role source, JWT claims, activeBrokerage lookup) that a live Cognito session uses, and does not cover the 'role not yet loaded' transient render (flagged as untested in 32-04-REVIEW.md IN-02) which is the actual fail-closed path protecting against a flash of the enabled fetch on first paint. The prior human UAT round found a live bug that the equivalent class of automated test (JSX-level render assertions) missed entirely — the same caution applies here until a human confirms it live."
  - test: "Sign in as an `admin` or `owner` user and open /admin/users"
    expected: "GET /v1/admin/invitations fires normally (200), the Invitations section renders and functions (list, pagination, revoke) exactly as before 32-04"
    why_human: "Confirms the enabled:true default path is unaffected by this change in a live session; only unit-tested with a mocked hook today."
---

# Phase 32: Agent Read-Only Access & Access Gating Verification Report

**Phase Goal:** An `agent` has correctly scoped read-only visibility into brokerage-wide admin surfaces, is fully blocked from brokerage-level staff invitations, and never sees a mutation control that would 403.
**Verified:** 2026-07-10T18:25:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap-closure plan 32-04, addressing 2 issues reported in 32-HUMAN-UAT.md

## Context

The prior verification pass (2026-07-10T12:35:00Z) marked the phase `human_needed` with 5/5 automated truths passing, pending live-browser confirmation. A human UAT round was then run against that build and found 2 issues (both traced to a single root cause):

1. Agent visiting `/admin/users` triggered `GET /v1/admin/invitations?status=accepted&page=1` → 403 Forbidden, visible in devtools.
2. The Invitations section was correctly hidden from render (32-03's `<Can>` gate), but the underlying data fetch still fired unconditionally from the ancestor `useBrokerageUsersAdminContext` hook, because `<Can>` is a JSX-level guard that cannot prevent a parent's hooks from executing.

Root cause was diagnosed (`.planning/debug/admin-users-invitations-403-for-agent.md`) and a gap-closure plan (32-04) was written and executed: `useFetchBrokerageInvitations` gained an `options?: { enabled?: boolean }` arg wired into `useQuery` as `enabled: options?.enabled ?? true`, and `useUsersAdminContext` now passes `{ enabled: canManageUsers }` where `canManageUsers = usePermission('manage_users')`. This is a structural, code-level fix — verified below against the actual files, not the SUMMARY's claims.

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Agent can view Users list and user detail pages but sees no edit/delete controls | ✓ VERIFIED | Unchanged since prior pass. `UsersListView.tsx:94,206` wraps Edit/Delete + "Add Admin to Brokerage" in `<Can permission="manage_users">`; `MemberAdminBoard.tsx:42,64` wraps "Manage Account" and withholds `onRemoveUserFromGroup`. `agent` lacks `manage_users` in `permissions.ts:12` (`agent: ['access_admin_panel','manage_groups']`). Tests: `UsersListView.test.tsx`, `MemberAdminBoard.test.tsx` pass. |
| 2 | Agent can view Brokerage settings and Boards/board credentials but sees no create/update/delete controls | ✓ VERIFIED | Unchanged since prior pass. Pre-existing `manage_brokerage_settings` gates on `BrokerageInformation.tsx`, `BrokerageBranding.tsx`, `BoardRegistrations.tsx` confirmed by direct read. Route access via `readTierRoles` in `admin.tsx` (7 usages incl. helper def). |
| 3 | Agent can view Domains and brokerage Settings page but sees no mutation actions | ✓ VERIFIED | `DomainCard.tsx`: `grep -c 'permission="access_admin_panel"'` = 0, `grep -c 'permission="manage_brokerage_settings"'` = 4 (re-confirmed this pass, unchanged). `SettingsAdminBoard.tsx` remains a static placeholder with no controls. |
| 4 | Agent has no way to view or reach the brokerage-level staff/agent invitation flow — no nav entry, no direct route access, **and no network request is issued** | ✓ VERIFIED (structurally) | Two-layer gate now confirmed: (a) `UsersAdminBoard.tsx:33-43` — entire `<InvitationsView>` wrapped in `<Can permission="manage_users">` (render gate, from 32-03, unchanged). (b) `useUsersAdminContext.tsx:24,33-39` — `canManageUsers = usePermission('manage_users')` passed as `{ enabled: canManageUsers }` to `useFetchBrokerageInvitations`, which now threads it into `useQuery({ enabled: options?.enabled ?? true })` (`useFetchBrokerageInvitations.tsx:8-21`, from 32-04, this pass). `usePermission` fails closed (`!isUserLoaded \|\| !role → false`), so there is no window where an unresolved role yields `enabled:true`. New test `useUsersAdminContext.test.tsx` (2 tests, RED-then-GREEN per SUMMARY) directly asserts the hook is called with `{ enabled: false }` for `agent` and `{ enabled: true }` for `admin` — both pass. This closes the exact bug reported in `32-HUMAN-UAT.md` at the code level. Live network-tab re-confirmation still recommended (see Human Verification). Route `/admin/brokerage/add-agent` remains on `ownerAdminOnly`. |
| 5 | Domain-mutation buttons are gated by `manage_brokerage_settings` only, so agent never sees an action button that would 403 on click | ✓ VERIFIED | Re-confirmed this pass: 0 `access_admin_panel`, 4 `manage_brokerage_settings` gates in `DomainCard.tsx`. |

**Score:** 5/5 truths verified at the code level (truth 4 upgraded from "render-only" to "render + fetch" gating this pass)

### Plan-Level Must-Haves (32-04, from PLAN frontmatter)

| Must-have | Status | Evidence |
|-----------|--------|----------|
| "An agent-role user loading /admin/users triggers NO GET /v1/admin/invitations request — no 403 appears in the network tab" | ✓ VERIFIED (structural) | `enabled: canManageUsers` → `false` for agent → React Query's documented `enabled:false` behavior means `queryFn` never executes, no network call issued. Confirmed at the hook-call boundary by test; browser network-tab confirmation still pending (see Human Verification). |
| "useFetchBrokerageInvitations is invoked with enabled:false whenever the current user lacks manage_users (agent/staff/client)" | ✓ VERIFIED for agent and admin (not staff/client) | `useUsersAdminContext.test.tsx` tests `agent`→false and `admin`→true. `staff`/`client` are not directly tested (flagged in 32-04-REVIEW.md IN-02), but `usePermission('manage_users')` is role-driven from the same `ROLE_PERMISSIONS` map used everywhere else in the phase — `staff`/`client` are not in `permissions.ts`'s `manage_users` grant list, so the same code path applies. Direct test coverage gap noted as WARNING, not a functional gap. |
| "An admin/owner still fetches invitations normally (enabled:true) and the Invitations section renders unchanged" | ✓ VERIFIED | `{ enabled: options?.enabled ?? true }` preserves default-enabled behavior; `admin` test asserts `{ enabled: true }`; `UsersAdminBoard.test.tsx` (32-03's render-gate tests) still passes unaffected — confirms no regression to the render path. `owner` not directly tested (same permission grant as `admin`, same code path). |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/store/hooks/Admin/Invitations/useFetchBrokerageInvitations.tsx` | Optional `{ enabled?: boolean }` arg wired into `useQuery` as `enabled: options?.enabled ?? true` | ✓ VERIFIED | Read in full — matches exactly (lines 8-21) |
| `frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.tsx` | `usePermission('manage_users')` gate passed as `enabled` | ✓ VERIFIED | Read in full — `canManageUsers` at line 24, passed at line 38 |
| `frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.test.tsx` | Hook test proving agent→false, admin→true | ✓ VERIFIED | Read in full — both assertions present and passing |
| (carried forward, unchanged) `admin.tsx`, `DomainCard.tsx`, `SideNav.tsx`, `PortalAdminSideNav.tsx`, `UsersListView.tsx`, `UsersAdminBoard.tsx`, `MemberAdminBoard.tsx` | Gates from 32-01/02/03 | ✓ VERIFIED (regression check) | Re-grepped this pass: `readTierRoles`=7, `ownerAdminOnly`=2, `access_admin_panel` in DomainCard=0, `manage_brokerage_settings`=4, `isGroupsOnlyRole/Admin`=0 matches repo-wide, `Can permission="manage_users"` present at all previously-confirmed wrap points |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `useUsersAdminContext.tsx` | `usePermission.ts` | `const canManageUsers = usePermission('manage_users')` | ✓ WIRED | Confirmed by direct read, line 24 |
| `useUsersAdminContext.tsx` | `useFetchBrokerageInvitations.tsx` | `{ enabled: canManageUsers }` second arg | ✓ WIRED | Confirmed by direct read, line 38 |
| `useFetchBrokerageInvitations.tsx` | `useQuery` (TanStack) | `enabled: options?.enabled ?? true` | ✓ WIRED | Confirmed by direct read, line 16; uses `??` not `\|\|` (correctly preserves explicit `false`, per 32-04-REVIEW.md) |
| `UsersAdminBoard.tsx` | `InvitationsView.tsx` | `<Can permission="manage_users">` wraps element | ✓ WIRED | Unchanged from 32-03, re-confirmed |
| (all 32-01/02/03 links) | — | — | ✓ WIRED (regression check) | Re-confirmed via grep, no changes detected |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `useUsersAdminContext.tsx` invitations state | `invitationsQuery.data` | `useFetchBrokerageInvitations` → `fetchBrokerageInvitations` (real API call) → backend `InvitationsController#index` (real DB query, `require_admin!` guarded) | Yes, when enabled | ✓ FLOWING — for admin/owner the fetch is real and DB-backed; for agent the fetch is suppressed entirely (`enabled:false`), which is the correct behavior per ACCESS-07, not a hollow/disconnected state |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 32-04 hook test proves gating decision | `npx vitest run useUsersAdminContext.test.tsx UsersAdminBoard.test.tsx` | 2 files, 4 tests, all passed | ✓ PASS |
| No regression across all Phase 32 test files | `npx vitest run` on 7 touched test files (UsersAdminBoard, useUsersAdminContext, MemberAdminBoard, UsersListView, DomainCard, SideNav, PortalAdminSideNav) | 7 files, 21 tests, all passed | ✓ PASS |
| `enabled` gate uses `??` not `\|\|` (fails closed, doesn't coerce `false`→`true`) | Direct read of `useFetchBrokerageInvitations.tsx:16` | `enabled: options?.enabled ?? true` | ✓ PASS |
| No dead-code references remain (regression) | `grep -rn "isGroupsOnlyRole\|isGroupsOnlyAdmin" frontend/src` | empty | ✓ PASS |
| DomainCard gates fully migrated (regression) | `grep -c 'permission="access_admin_panel"' DomainCard.tsx` | 0 | ✓ PASS |
| 32-04 commits exist in frontend sub-repo | `git cat-file -e a620720`, `git cat-file -e 71dd548` | both present | ✓ PASS |
| Frontend submodule pointer at monorepo root advanced to 32-04's final commit | `git log --oneline -3` (monorepo root) | `5bf418e chore(32-04): update frontend submodule pointer` present | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| ACCESS-02 | 32-01, 32-03 | Agent read-only Users list/detail, no edit/delete | ✓ SATISFIED | Unchanged, re-confirmed |
| ACCESS-03 | 32-01 | Agent read-only Brokerage settings | ✓ SATISFIED | Unchanged, re-confirmed |
| ACCESS-04 | 32-01 | Agent read-only Boards/credentials | ✓ SATISFIED | Unchanged, re-confirmed |
| ACCESS-05 | 32-01 | Agent read-only Domains, no mutation actions | ✓ SATISFIED | Unchanged, re-confirmed |
| ACCESS-06 | 32-01 | Agent read-only Settings page | ✓ SATISFIED | Unchanged, re-confirmed |
| ACCESS-07 | 32-03, 32-04 | Agent fully blocked (no view, no create) from brokerage invitations | ✓ SATISFIED (structurally, at both render and fetch layers) | 32-03's `<Can>` render gate + 32-04's `enabled` fetch gate. This is the requirement the UAT gap directly concerned — now closed at the code level per both the render path and the network-request path. |
| ACCESS-08 | 32-01 | Domain-mutation buttons gated by manage_brokerage_settings only | ✓ SATISFIED | Unchanged, re-confirmed |

All 8 requirement IDs referenced across the 4 plans (32-01: 7 IDs; 32-02: ACCESS-02–06; 32-03: ACCESS-02, ACCESS-07; 32-04: ACCESS-07) cross-reference cleanly against `.planning/REQUIREMENTS.md` lines 12-19 and 55-62 — all 8 (ACCESS-01 through ACCESS-08) marked Complete, with ACCESS-01 correctly attributed to Phase 31 (not this phase's scope) and ACCESS-02 through ACCESS-08 attributed to Phase 32. No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `useUsersAdminContext.tsx` | 60 | `useMemo` dependency array omits `groupsQuery`, `invitationsQuery`, `inviteFilter` (pre-existing, adjacent to this pass's change; documented in `32-04-REVIEW.md` WR-01) | ⚠️ Warning | Currently masked by `query`'s unstable object-literal identity forcing recomputation on every render. Does not cause agent to see stale/wrong data today, but is a latent staleness bug if any sibling hook is ever memoized. Not a regression introduced by 32-04's `enabled` gate itself (the gate value `canManageUsers` is read fresh on every render regardless of the memo), but the invitations data it feeds is technically excluded from the recompute trigger list. Recommend fixing in a follow-up, not blocking. |
| `PortalAdminSideNav.tsx` | 14-45 | No `access_admin_panel`/role check gating the nav itself (carried forward from prior verification's WR-01) | ⚠️ Warning | Unchanged since prior pass — out of scope for 32-04, does not affect any of the 5 roadmap truths (nav items are links, not mutation controls). |
| `useUsersAdminContext.test.tsx` | — | Only `agent`/`admin` tested; `owner`, `staff`/`client`, and the "role not yet loaded" transient state are untested (`32-04-REVIEW.md` IN-02) | ⚠️ Warning | The untested "role not loaded" state is specifically the fail-closed path that protects against a flash of `enabled:true` on first paint before `useRole()` resolves — `usePermission`'s `!isUserLoaded → false` logic covers this in principle, but there is no regression test locking it down. Recommend adding before this is considered fully hardened. |

No blocker-level anti-patterns (TODO/FIXME/stub/placeholder, hollow data flow) found in any of the 3 files touched by 32-04, nor regressed in the 10 files from 32-01/02/03.

### Human Verification Required

### 1. Live agent session — /admin/users network + visual re-test (closes UAT gaps 1 & 2)

**Test:** Sign in as a real `agent` user, open devtools Network tab, and navigate directly to `/admin/users`.
**Expected:** No `GET /v1/admin/invitations` request appears (no 403), the Users list renders normally, and no Invitations section is visible anywhere on the page.
**Why human:** 32-04's fix is proven at the hook-call boundary by a unit test using mocked leaf hooks and a synthetic redux `preloadedState`, not a live TanStack Query execution against the real network layer, nor the real `useRole()` resolution path (subdomain-vs-main-domain source, JWT claims, `activeBrokerage` lookup) that a live Cognito session exercises. The prior UAT round demonstrated exactly this class of gap — a JSX-level fix that unit tests validated but a live browser exposed as incomplete — so the same caution applies to this fetch-level fix until confirmed live. This is the single most important re-test to close the loop on the actual reported bug.

### 2. Live admin/owner session — no-regression check

**Test:** Sign in as `admin` or `owner` and open `/admin/users`.
**Expected:** `GET /v1/admin/invitations` fires (200), the Invitations section renders, and pagination/revoke/filter actions still work.
**Why human:** Confirms the `enabled: options?.enabled ?? true` default-preserving change didn't regress the admin/owner path in a live session; currently only unit-tested with a mocked hook.

**Note:** The broader human-verification items from the prior verification round (direct URL access to all 6 read routes, visual absence of mutation controls on Users list / member detail / Domains) were already exercised in the human UAT round that produced `32-HUMAN-UAT.md`, and the UAT report explicitly states "other pages look good" — only `/admin/users` failed, and only due to the now-fixed invitations-fetch bug. Those items do not need to be re-tested; only the two items above (both scoped to `/admin/users`) remain open.

### Gaps Summary

No code-level gaps found. The two issues reported in `32-HUMAN-UAT.md` — both stemming from a single root cause (the invitations data fetch firing unconditionally from an ancestor hook, unreachable by the 32-03 JSX-only `<Can>` render gate) — are structurally closed by 32-04: `useFetchBrokerageInvitations` now accepts an `{ enabled }` option, and `useUsersAdminContext` drives it from the same `usePermission('manage_users')` primitive used by `<Can>` elsewhere in the phase, applying the fail-closed default (`!isUserLoaded || !role → false`). This was independently confirmed by direct file reads (not SUMMARY claims), the `??` (not `||`) operator choice was verified to correctly preserve an explicit `false`, and all 21 tests across the 7 touched/regression-checked test files pass, including a new 2-test file that RED-then-GREEN-proved the exact gating decision at the hook boundary.

Status remains `human_needed` rather than `passed` — not because of any known defect, but because the exact failure mode this gap-closure plan fixes (a JSX-level gate looking correct in tests while a live browser exposed the real bug) is the same category of risk that a fetch-level `enabled` gate could, in principle, still have at the live-network layer (e.g., a real `useRole()` timing edge case against actual Cognito JWT resolution that the synthetic redux `preloadedState` in the unit test cannot reproduce). Given that the prior UAT round already disproved an equivalently "fully-tested" claim once in this exact phase, a second live-browser pass focused narrowly on `/admin/users` (both as agent and as admin/owner) is warranted before declaring this phase fully closed. This is a WARNING-level item, not a BLOCKER — the code fix is correct, complete, and matches its plan exactly; only the final live confirmation is outstanding.

Two pre-existing WARNING-level anti-patterns are carried forward for awareness (not blocking): the `useUsersAdminContext` `useMemo` dependency gap (32-04-REVIEW.md WR-01) and `PortalAdminSideNav.tsx`'s missing independent permission check (prior verification's WR-01). Neither affects any of the 5 roadmap success criteria.

---

_Verified: 2026-07-10T18:25:00Z_
_Verifier: Claude (gsd-verifier)_
