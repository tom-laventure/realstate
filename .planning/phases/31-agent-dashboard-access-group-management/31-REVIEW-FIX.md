---
phase: 31-agent-dashboard-access-group-management
fixed_at: 2026-07-10T10:40:00Z
review_path: .planning/phases/31-agent-dashboard-access-group-management/31-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 31: Code Review Fix Report

**Fixed at:** 2026-07-10T10:40:00Z
**Source review:** .planning/phases/31-agent-dashboard-access-group-management/31-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04)
- Fixed: 5
- Skipped: 0

All fixes were applied and committed inside isolated git worktrees (one per sub-repo, since `backend/` and `frontend/` are separate repos), then fast-forward merged back onto `main`/`master` respectively. `IN-01` and `IN-02` were out of scope (`fix_scope: critical_warning`) and left untouched.

## Fixed Issues

### WR-01: `RequireRole.tsx`'s main-domain bypass is stale and will silently defeat any future fix

**Files modified:** `frontend/src/components/common/guards/RequireRole.tsx`, `frontend/src/components/common/guards/RequireRole.test.tsx`
**Commit:** `a04e75d` (frontend)
**Applied fix:** Removed the `if (isMainDomain()) return <>{children}</>` early return. `useRole()` (called one line above) already resolves the role correctly on both domains — `account.membership?.role` on the subdomain, falling back to `activeBrokerage?.role` on the main domain — so the bypass was dead weight that silently defeated any role check on the main domain. Added a `describe('on the main domain', ...)` block to `RequireRole.test.tsx` with two new cases: one asserting a redirect when `activeBrokerage.role` doesn't match the allowed roles, and one asserting children render when it does. Fixed this first, as required, since CR-01's route-gating fix depends on `RequireRole` actually enforcing checks on the main domain.

### CR-01: Agent role can reach non-Groups admin pages via direct URL, on both main domain and subdomain

**Files modified:** `frontend/src/router/admin/admin.tsx`, `frontend/src/components/common/shells/portalAdminShell/PortalAdminShell.tsx`, `backend/app/controllers/v1/admin/domains_controller.rb`, `backend/test/integration/admin_domains_test.rb`, `backend/test/integration/admin_authorization_test.rb`
**Commits:** `9ccdc77` (frontend — route gating), `5ad1896` (backend — `verify` action gating)
**Applied fix:**
- In `admin.tsx`, wrapped the element for every non-Groups child route (`brokerage`, `brokerage/add-agent`, `boards`, `users`, `users/add-to-group`, `users/members/:memberId`, `users/members/:memberId/edit`, `domains`, `settings`) in `<RequireRole roles={['owner', 'admin']}>`. `groups` and its sub-routes are left ungated for `agent`. Since both `AppShellAdmin` (subdomain) and `PortalAdminShell` (main domain) render the same route tree via their own `<Outlet />`, this single per-route change enforces the boundary on both domains — contingent on the WR-01 fix already being in place.
- Also added a coarse shell-level gate to `PortalAdminShell.tsx`, wrapping its `<Outlet />` in `<RequireRole roles={['owner', 'admin', 'agent']}>`, mirroring the existing pattern in `AppShellAdmin.tsx`. Previously `PortalAdminShell` had zero gating, meaning any authenticated role (not just agent) could reach `/admin/*` on the main domain.
- In `domains_controller.rb`, added `before_action :require_admin!, only: %i[verify]` and corrected the stale comment (previously claimed `verify` was "admin + owner (default require_admin!)" when the actual `BaseController` default is `require_agent_or_above!`, leaving `verify` open to agent). `verify` is a genuine mutating action — it can flip a domain to `active` and reassign `is_primary`.
- Updated `test/integration/admin_domains_test.rb`'s `"POST verify is allowed for agent role"` test to `"POST verify is forbidden for agent role"` (now asserts `:forbidden`), and added a new `"POST verify is allowed for admin role"` test to cover the newly-intended-positive case.
- Updated `test/integration/admin_authorization_test.rb`: removed `"agent role receives success on POST /v1/admin/domains/:id/verify"` from the agent allow-list section and added `"agent role receives 403 on POST /v1/admin/domains/:id/verify"` to the agent deny-list section, consistent with the file's existing pattern for other write endpoints.

### WR-02: Role gating implemented via direct string comparison, duplicated across two files

**Files modified:** `frontend/src/assets/rbac/permissions.ts`, `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx`, `frontend/src/components/sidenav/useSideNavContext.ts`
**Commit:** `fe9adc4` (frontend)
**Applied fix:** Added `export const isGroupsOnlyRole = (role: UserRole | null | undefined): boolean => role === 'agent'` to `permissions.ts`, and replaced the two independent `role === 'agent'` comparisons in `PortalAdminSideNav.tsx` and `useSideNavContext.ts` with calls to this shared helper.

### WR-03: `PortalAdminSideNav`'s agent filter matches on the display label string

**File modified:** `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx`
**Commit:** `fe9adc4` (frontend — combined with WR-02 since both changes land on the same `visibleItems` line)
**Applied fix:** Changed `items.filter(i => i.label === 'Groups')` to `items.filter(i => i.path === '/admin/groups')`, decoupling the role-based filter from the display copy.

### WR-04: `domains_controller.rb` `verify` action is not owner/admin-gated despite its own doc comment

**Status:** Covered by CR-01's fix above (backend commit `5ad1896`) — no duplicate work performed.

## Skipped Issues

None — all in-scope findings were fixed.

## Deviations / Notes

- **WR-01 and CR-01 were split into two commits** (frontend `a04e75d` then `9ccdc77`) even though the REVIEW.md's CR-01 "Fix" section describes the WR-01 change as step 1 of CR-01's fix. Kept them separate for traceability against their distinct finding IDs, since WR-01 is independently fixable/revertible and CR-01's route-gating change builds on top of it.
- **WR-02 and WR-03 were combined into a single commit** (`fe9adc4`) because both land on the same line in `PortalAdminSideNav.tsx` (`visibleItems = isGroupsOnlyRole(role) ? items.filter(i => i.path === '/admin/groups') : items`); splitting them into two commits would have required an artificial intermediate state on that line.
- **Test verification:** Backend `rails test` could not be run end-to-end in the review-fix worktree due to a pre-existing, unrelated environment issue — `db/schema.rb` contains PostgreSQL-specific DDL (`enable_extension "plpgsql"`, `::text`/`::numeric` casts in index/check-constraint definitions, `jsonb` columns) that the configured `test` environment's `sqlite3` adapter cannot load, and running raw migrations instead hits a `GREATEST()` (Postgres-only function) call in an unrelated data migration. This reproduces identically on the pre-existing `master`/`main` code (confirmed by reproducing the same failure against the original repo, unmodified) — it is not something introduced by this fix. Verification for the backend commit therefore relied on: `ruby -c` syntax check (passed for all three touched files), `bundle exec standardrb` (no new lint violations — the only reported offenses are pre-existing, at unchanged line offsets), and manual review of the updated test assertions for logical correctness.
- **Frontend verification:** `npx tsc --noEmit` could not run due to a pre-existing TypeScript/tsconfig version mismatch in the environment (`moduleResolution: "bundler"` unsupported by the installed `tsc`), reproduced identically on unmodified `master`. Verification instead relied on `npx vitest run`, which passed for all touched/added test files (`RequireRole.test.tsx`, `PortalAdminSideNav.test.tsx`, `SideNav.test.tsx` — 12 tests + 3 tests, all green) and for the full suite (29/31 passing; the 2 pre-existing failures in `GoogleSignInButton.test.tsx` are unrelated to this fix and reproduce identically on unmodified `master`).
- Fixes were developed in isolated git worktrees (`backend` on branch `review-fix-31-backend`, `frontend` on branch `review-fix-31-frontend`) and fast-forward merged onto `main`/`master` after verification, then the worktrees and temporary branches were removed.

---

_Fixed: 2026-07-10T10:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
