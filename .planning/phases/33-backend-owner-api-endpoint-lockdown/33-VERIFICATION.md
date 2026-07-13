---
phase: 33-backend-owner-api-endpoint-lockdown
verified: 2026-07-13T00:12:16Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
---

# Phase 33: Backend Owner API & Endpoint Lockdown Verification Report

**Phase Goal:** Backend enforces owner-only ownership changes and exposes the new owner-management API surface — closing the admin-takeover security gap (30-REVIEW.md CR-02/CR-03) flagged at v1.10 close, before any new frontend surface depends on it.
**Verified:** 2026-07-13T00:12:16Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A non-owner attempting to promote a user to `owner` via `POST /admin/brokerage/add-agent` (→ `InvitationsController#create`) receives HTTP 403 | ✓ VERIFIED | `backend/app/controllers/v1/admin/invitations_controller.rb:45` rejects `role == "owner"` with 403 for any caller; integration tests `admin_owner_lockdown_test.rb:32-50` prove both admin and owner callers get 403 |
| 2 | The role selector on `/admin/brokerage/add-agent` no longer lists "owner" | ✓ VERIFIED | `frontend/.../AddAgentView.tsx` — `<SelectItem value="owner">` removed (only `agent`/`admin` remain, lines 97-99); `RolePermissions roles={['agent','admin']}` (line 106) — confirmed by direct file read, owner description no longer rendered |
| 3 | `GET /admin/settings/owners` returns the brokerage's current owners (name + email) | ✓ VERIFIED | `owners_controller.rb#index` queries `BrokerageMembership.without_deleted.where(role: "owner")`, renders `{id, name, email}`; test `admin_settings_owners_test.rb:26-39` passes |
| 4 | `GET /admin/settings/owners/eligible` returns brokerage users with role `admin` or `agent` | ✓ VERIFIED | `owners_controller.rb#eligible` queries `role: %w[admin agent]`, renders `{id, name, email, role}`, excludes owner/client; test lines 53-68 passes (asserts inclusion/exclusion) |
| 5 | `POST /admin/settings/owners` (promote) and `PATCH /admin/settings/owners/:id` (demote, rejecting last owner) require the caller to hold the `owner` role, enforced server-side — not frontend gates alone | ✓ VERIFIED (see note) | `before_action :require_owner!, only: [:create, :update]` gated by `current_membership` (DB-backed `BrokerageMembership` lookup, `base_controller.rb:24-28`); non-owner callers get 403 (tests lines 91-98, 114-119); last-owner guard (422) at `owners_controller.rb:75-78`, test lines 135-147 |

**Note on Truth 5 wording:** REQUIREMENTS.md/ROADMAP.md literally say "enforced server-side via JWT claims." The actual implementation deliberately does **not** read the JWT `role` claim — it re-derives the caller's role from a fresh `BrokerageMembership` DB lookup (`current_membership`) on every request. This is documented as an intentional, stronger mitigation in the plan's own threat model (T-33-05, T-33-11: stale-JWT privilege retention). The observable truth — "enforcement is server-side, independent of any frontend gate" — is fully satisfied and the mechanism used is more robust than a literal JWT-claims read (a demoted user's still-valid 24h JWT cannot regain owner access). Confirmed no `claims["role"]` read exists anywhere in the three touched/created controllers. Treated as VERIFIED, not a gap — the literal requirement wording is imprecise, not the implementation.

**Score:** 5/5 ROADMAP success criteria verified

### Plan-Level Must-Haves (from PLAN frontmatter, 33-01/02/03)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | Non-owner (admin) cannot promote to owner via `PATCH /v1/admin/users/:id` — 403 | ✓ VERIFIED | `users_controller.rb:110-114`; test line 62-70 |
| 7 | Owner cannot demote another owner via `PATCH /v1/admin/users/:id` — 403 | ✓ VERIFIED | Same guard (`membership.role == "owner"` branch); test line 82-90 |
| 8 | `POST /v1/admin/invitations` with role "owner" — 403 for any caller | ✓ VERIFIED | `invitations_controller.rb:45`; tests line 32-50 |
| 9 | Admin can still invite agent/admin via `POST /v1/admin/invitations` — 201 | ✓ VERIFIED | Unchanged create-flow logic; test line 52-58 (`assert_response :created`) |
| 10 | Non-owner cannot destroy an owner's membership via `DELETE /v1/admin/users/:id` — 403 | ✓ VERIFIED | `users_controller.rb:143-145` inline `require_owner!`; test line 102-107 |
| 11 | Last remaining owner cannot be destroyed via `DELETE /v1/admin/users/:id` — 422 | ✓ VERIFIED | `owner_count <= 1` guard, `users_controller.rb:147-150`; test line 109-119 |
| 12 | Default selected role remains 'agent'; submission still works for agent/admin | ✓ VERIFIED | `useState<UserRole>('agent')` unchanged (`AddAgentView.tsx:19`); `<SelectItem value="agent">`/`value="admin"` both present |

**Score:** 12/12 total must-haves verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/controllers/v1/admin/users_controller.rb` | Owner-transition lockdown on `#update`, owner-target/last-owner guard on `#destroy` | ✓ VERIFIED | Both guards present, `.without_deleted` scoping added on both membership lookups (lines 100, 139) |
| `backend/app/controllers/v1/admin/invitations_controller.rb` | Owner-role rejection on `#create` | ✓ VERIFIED | Value-level 403 guard at line 45, `before_action :require_admin!` unchanged |
| `backend/test/integration/admin_owner_lockdown_test.rb` | Integration coverage for all lockdown bypass paths | ✓ VERIFIED | 9 tests, all pass |
| `backend/app/controllers/v1/admin/settings/owners_controller.rb` | `V1::Admin::Settings::OwnersController` with index/eligible/create/update | ✓ VERIFIED | Class exists with correct nesting, all 4 actions implemented, D-05 re-validation, `DEMOTE_TARGET_ROLES` allowlist, last-owner COUNT guard |
| `backend/config/routes.rb` | `namespace :settings { resources :owners }` | ✓ VERIFIED | Present at lines 78-84; `bin/rails routes -g settings/owners` lists all 4 expected routes |
| `backend/test/integration/admin_settings_owners_test.rb` | Integration coverage for API-01..05 | ✓ VERIFIED | 15 tests, all pass |
| `frontend/.../AddAgentView.tsx` | Role selector limited to agent/admin | ✓ VERIFIED | Owner `SelectItem` removed; `RolePermissions roles={['agent','admin']}` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `users_controller.rb#update` | `current_membership` / role value | value-level owner-transition rejection | ✓ WIRED | `role == "owner" \|\| membership.role == "owner"` → 403 |
| `users_controller.rb#destroy` | `require_owner!` + last-owner COUNT | conditional inline guard | ✓ WIRED | `require_owner!` + `return if performed?` + `owner_count <= 1` → 422 |
| `invitations_controller.rb#create` | 403 rejection | role == "owner" value guard | ✓ WIRED | Placed after `role == "client"` check, before pending-invite lookup |
| `routes.rb` | `V1::Admin::Settings::OwnersController` | nested namespace | ✓ WIRED | `bin/rails routes -g settings/owners` resolves all 4 routes to the controller |
| `owners_controller.rb` | `require_owner!` + `current_membership` | `before_action ..., only: [:create, :update]` | ✓ WIRED | Confirmed present, `skip_before_action :require_agent_or_above!` paired correctly so index/eligible stay agent-readable |
| `owners_controller.rb#update` | `BrokerageMembership.without_deleted` owner COUNT | last-owner guard before demote | ✓ WIRED | `owner_count <= 1` evaluated before `membership.update!` |

### Behavioral Spot-Checks / Test Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Lockdown + owner-settings integration suites pass | `RAILS_ENV=test bin/rails test test/integration/admin_owner_lockdown_test.rb test/integration/admin_settings_owners_test.rb` | 24 runs, 66 assertions, 0 failures, 0 errors, 0 skips | ✓ PASS |
| Routes resolve correctly | `bin/rails routes -g settings/owners` | Lists index/eligible/create/update mapping to `v1/admin/settings/owners` | ✓ PASS |
| Standardrb lint on all 3 touched/created controllers | `bundle exec standardrb app/controllers/v1/admin/{users_controller.rb,invitations_controller.rb,settings/owners_controller.rb}` | Exit 0, no output | ✓ PASS |
| No JWT role-claim reads introduced | `grep -n 'claims\["role"\]' <controllers>` | No matches (grep exit 1) | ✓ PASS |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in touched files | `grep -niE 'TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER\|placeholder\|coming soon\|not yet implemented' <files>` | Only HTML `placeholder="..."` input attributes matched (not stub markers) | ✓ PASS |
| Sub-repo commit hashes from all 3 SUMMARYs exist | `git cat-file -t <hash>` for f64ab73, 7f081f9, 5d1982e, a995199, 9131583, 69efb3d (backend), 52513c7 (frontend) | All resolve to `commit` | ✓ PASS |
| Working trees clean (no uncommitted phase work) | `git status --short` in backend/ and frontend/ | Both clean | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LOCK-01 | 33-01 | `POST /admin/brokerage/add-agent` rejects owner role assignment, 403 | ✓ SATISFIED | `invitations_controller.rb:45` + tests |
| LOCK-02 | 33-03 | Add-agent role selector no longer offers "owner" | ✓ SATISFIED | `AddAgentView.tsx` edit confirmed |
| API-01 | 33-02 | `GET /admin/settings/owners` returns current owners (name, email) | ✓ SATISFIED | `owners_controller.rb#index` + test |
| API-02 | 33-02 | `GET /admin/settings/owners/eligible` returns admin/agent users | ✓ SATISFIED | `owners_controller.rb#eligible` + test |
| API-03 | 33-02 | `POST /admin/settings/owners` promotes user to owner, owner-only | ✓ SATISFIED | `owners_controller.rb#create` + D-05 re-validation + test |
| API-04 | 33-02 | `PATCH /admin/settings/owners/:id` demotes, owner-only, rejects last-owner | ✓ SATISFIED | `owners_controller.rb#update` + `DEMOTE_TARGET_ROLES` + COUNT guard + test |
| API-05 | 33-02 | Server-side role enforcement, not frontend-only | ✓ SATISFIED (see Truth 5 note) | `current_membership` DB-backed guard used in place of literal JWT-claims read; stronger mitigation, same intent |

No orphaned requirements — all 7 phase-declared requirement IDs (LOCK-01, LOCK-02, API-01..05) are covered by the three plans and cross-referenced in REQUIREMENTS.md (all marked `[x]` Complete, Phase 33).

### Anti-Patterns Found

None. No debt markers, no stub returns, no empty handlers, no hardcoded-empty data flows in any of the 6 backend/frontend files touched by this phase.

### Human Verification Required

None. This phase is backend-API + a mechanical frontend option-removal; all must-haves are verifiable via grep, route inspection, and integration test execution. No new visual UI, real-time behavior, or external service integration was introduced (LOCK-02's change is a trivial `<SelectItem>` removal with existing test/lint coverage already conventionally sufficient — the plan itself notes `tsc --noEmit` is pre-existing broken and intentionally not used as a gate here, which does not block verification since the grep-verified JSX change is unambiguous).

### Gaps Summary

None. All 5 ROADMAP success criteria and all 12 plan-level must-haves are verified against actual, executed code: two integration test suites (24 tests total) pass with 0 failures/errors, lint is clean, routes resolve correctly, and no JWT-claims authorization anti-pattern was introduced. The one wording discrepancy (API-05 requirement text says "via JWT claims" while the implementation uses a DB-backed membership lookup) is a documented, deliberate, and stronger security choice — not a functional gap — and is called out above rather than hidden.

---

*Verified: 2026-07-13T00:12:16Z*
*Verifier: Claude (gsd-verifier)*
