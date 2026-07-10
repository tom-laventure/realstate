---
phase: 31-agent-dashboard-access-group-management
reviewed: 2026-07-10T07:04:24Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - backend/app/controllers/v1/account/admin_brokerages_controller.rb
  - backend/test/controllers/v1/account/admin_brokerages_controller_test.rb
  - backend/test/integration/admin_brokerages_test.rb
  - frontend/src/assets/rbac/permissions.ts
  - frontend/src/components/common/guards/RequireRole.test.tsx
  - frontend/src/components/common/shells/appShellAdmin/AppShellAdmin.tsx
  - frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx
  - frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.test.tsx
  - frontend/src/components/sidenav/SideNav.tsx
  - frontend/src/components/sidenav/SideNav.test.tsx
  - frontend/src/components/sidenav/useSideNavContext.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-07-10T07:04:24Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

The backend change (`admin_brokerages_controller.rb`) correctly widens the membership filter to include `agent` and is well covered by both unit and integration tests. The permission map and `RequireRole`/nav changes correctly implement this phase's stated goal in isolation (agent gets `access_admin_panel` + `manage_groups`, and the two sidenav components correctly hide non-Groups links for `agent`).

However, tracing the cross-file consequence the phase itself flags as a discovery item (D-01/D-03 in `31-CONTEXT.md`) surfaces a real gap: nav-link hiding is the *only* enforcement mechanism for restricting `agent` to Groups on the main-domain portal path, and it provides no actual route protection. Combined with Phase 30's already-permissive backend read endpoints, this lets any `agent` — a role this phase's own design intentionally scopes to "Groups only" for now — reach full user PII, brokerage contact details, domain configuration, and board registrations by typing a URL, with no additional tooling required. This is flagged as **Critical** below, with full reasoning on why the "it's just UX polish, backend enforces the boundary" framing in `31-CONTEXT.md` does not fully hold. Several secondary quality issues (role-string duplication against documented project convention, label-based filtering, a stale bypass in `RequireRole.tsx`) are flagged as Warnings.

## Critical Issues

### CR-01: Agent role can reach non-Groups admin pages (Users/Brokerage/Boards/Domains/Settings) via direct URL, on both main domain and subdomain — nav-link hiding provides no actual route enforcement

**Files:**
- `frontend/src/components/common/shells/portalAdminShell/PortalAdminShell.tsx` (not in this phase's file list, but directly implicated by `AdminDomainShell.tsx`'s domain branch and by this phase's backend change)
- `frontend/src/components/common/shells/appShellAdmin/AppShellAdmin.tsx:29`
- `frontend/src/router/admin/admin.tsx` (route tree, `/admin/*` children)
- `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx:19`
- `frontend/src/components/sidenav/useSideNavContext.ts:12`

**Issue:**

This phase's stated design intent (`31-CONTEXT.md`, D-03) is that agents should see a **Groups-only** admin nav this phase, specifically to avoid exposing "full create/edit/delete UI that 403s on submit — an unfinished-looking state" before Phase 32 builds proper read-only views. Both `PortalAdminSideNav.tsx` (main domain) and `SideNav.tsx`/`useSideNavContext.ts` (subdomain) correctly implement this narrowing — but **only at the level of which links are rendered**, not which routes are reachable:

- `PortalAdminShell.tsx` wraps its `<Outlet />` in **no role/permission gate at all**:
  ```tsx
  <main className="flex flex-1 flex-col overflow-hidden">
      <Outlet />
  </main>
  ```
  Compare to `AppShellAdmin.tsx:29-31`, which at least wraps its `Outlet` in `RequireRole roles={['owner', 'admin', 'agent']}`.

- Even `AppShellAdmin`'s gate is coarse: it's applied once at the shell level for the entire `/admin/*` subtree, not per-route. `router/admin/admin.tsx` registers `brokerage`, `boards`, `users`, `groups`, `domains`, `settings` (and their sub-routes, e.g. `users/members/:memberId/edit`, `brokerage/add-agent`) as flat siblings under the same `AdminDomainShell` parent, with no per-route `RequireRole`/`Can` wrapper. Since this phase widened the shell-level roles array to include `agent`, an agent's browser session is now authorized (client-side) to render *any* of those routes, not just `/admin/groups`.

- The two nav components (`PortalAdminSideNav.tsx:19`, `useSideNavContext.ts:12`) only decide *what link to show*; they do not gate the routes themselves. An agent who types `/admin/users`, `/admin/brokerage`, `/admin/boards`, `/admin/domains`, or `/admin/settings` directly into the address bar — or simply hits Back/Forward, a bookmark, or a shared link — lands on the real page.

- Critically, the pages that render are **not just broken/403 write UI**. Backend confirms (per `31-CONTEXT.md`'s own reference to Phase 30, and independently verified in `backend/app/controllers/v1/admin/base_controller.rb`, `users_controller.rb`, `brokerages_controller.rb`, `domains_controller.rb`, `boards_controller.rb`) that `require_agent_or_above!` is the *default* gate on `V1::Admin::BaseController`, and only specific mutating actions add `require_admin!`/`require_owner!`:
  - `GET /v1/admin/users` (index) and `GET /v1/admin/users/:id` (show) have **no** `require_admin!` — agent gets a 200 with the full `UserSerializer` payload, which includes `email`, `first_name`, `last_name`, `membership.role` for every user in the brokerage (`users_controller.rb:4`, `user_serializer.rb:4`).
  - `GET /v1/admin/brokerage` (show) has no additional gate — agent gets full `BrokerageSerializer` output: `address`, `mls_id`, `website`, `contact_email`, `contact_phone`, `plan`, `color_scheme` (`brokerages_controller.rb:7-15`).
  - `GET /v1/admin/boards` and `GET /v1/admin/domains` are similarly open to agent by default.
  - `domains_controller.rb`'s `verify` action (`POST /v1/admin/domains/:id/verify`) is **not** in the `require_owner!` allowlist (`before_action :require_owner!, only: %i[subdomain custom destroy set_primary]` — `verify` is absent), despite the code comment at line 132 claiming it's "Accessible to admin + owner (default require_admin!)". The actual base-controller default is `require_agent_or_above!`, not `require_admin!` — so this is an actual mutating action (it can flip a domain from `pending`/`phasing_out` to `active` and reassign `is_primary`) that an agent can trigger today, contradicting both the code comment and the "agents can only read, not write" assumption underpinning D-03's rationale.

**Why this matters now, not just "Phase 32's problem":** `31-CONTEXT.md` frames this as acceptable because "frontend guards are UX-only; backend 403 is the real security boundary" and because Phase 30 already made agent-read access to these endpoints a deliberate decision. That's true as a historical fact, but it undersells the actual change this phase makes: before this phase, an ordinary agent had **no way to reach these pages through normal use of the product** — reaching them required knowing the API well enough to hand-craft an authenticated request (e.g., via curl/Postman) with the right headers. This phase's own backend change (including `agent` in `admin_brokerages`, D-01) plus the widened `AppShellAdmin` gate (D-02) is what makes these same already-open backend endpoints reachable by *any* agent, on both domains, using nothing but the browser's address bar. That is a material increase in practical exposure of user PII and brokerage configuration data to a population (agents) this very phase's own design explicitly intends to restrict to Groups-only. Test coverage reinforces the false sense of security: `PortalAdminSideNav.test.tsx` and `SideNav.test.tsx` only assert that non-Groups *links* are absent from the DOM — no test asserts that the corresponding *routes* are actually blocked for an agent.

**Fix:**
Enforce role/permission checks at the route level, not just the nav-visibility level. E.g., in `router/admin/admin.tsx`, wrap each non-Groups child element in a permission gate:
```tsx
{
    element: <RequireRole roles={['owner', 'admin']}><UsersAdminBoard /></RequireRole>,
    path: 'users'
},
```
or introduce a `<Can permission="manage_users">` wrapper consistent with the existing `Can` pattern. Do this for `brokerage`, `boards`, `users` (+ sub-routes), `domains`, and `settings`; leave `groups` (+ sub-routes) ungated for `agent`.

For the main-domain path specifically, note that naively wrapping `PortalAdminShell`'s `<Outlet />` in `<RequireRole roles={[...]}>` **will not work** as-is — see WR-01 below; `RequireRole` unconditionally bypasses all checks when `isMainDomain()` is true. Either fix `RequireRole` first, or use `useRole()`/`usePermission()` directly in `PortalAdminShell`/per-route wrappers (both already resolve correctly on the main domain via `activeBrokerage.role`).

Also correct the `domains_controller.rb:132` comment and decide deliberately whether `verify` should require `require_admin!`/`require_owner!` — as written, the code contradicts its own documentation.

## Warnings

### WR-01: `RequireRole.tsx`'s main-domain bypass is stale and will silently defeat any future fix

**File:** `frontend/src/components/common/guards/RequireRole.tsx:19`
**Issue:** `RequireRole` unconditionally returns `children` when `isMainDomain()` is true, with a comment claiming `account.membership?.role` "is never populated on the main domain." That was true when this bypass was added (Phase 18, commit `a59f19c`), but `useRole()` (which `RequireRole` itself calls one line above, at line 14) was later fixed in Phase 24 (commit `44850f8`) to fall back to `activeBrokerage?.role` on the main domain — a value that *is* populated for portal users. The bypass at line 19 ignores this and short-circuits before the role check ever runs, making `RequireRole` a no-op on the main domain today. This isn't exercised by any current call site (only `AppShellAdmin`, which is subdomain-only, uses `RequireRole`), so it's latent — but it means the "obvious" fix for CR-01 (wrap `PortalAdminShell`'s `Outlet` in `RequireRole`) will appear to work in code review but silently do nothing at runtime. `RequireRole.test.tsx` doesn't cover this path either — every test stubs a subdomain hostname specifically to route around this bypass.
**Fix:** Remove the `isMainDomain()` early return (or make it conditional on whether `role` resolved), since `useRole()` now handles both domains correctly:
```tsx
const { role, isUserLoaded } = useRole()
if (!isUserLoaded) return null
if (!role || !roles.includes(role)) return <Navigate to={redirectTo} replace />
return <>{children}</>
```
Add a test case that stubs a main-domain hostname with an `activeBrokerage.role` that doesn't match `roles` and asserts the redirect fires.

### WR-02: Role gating implemented via direct string comparison, duplicated across two files, contradicting documented project convention

**Files:** `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx:19`, `frontend/src/components/sidenav/useSideNavContext.ts:12`
**Issue:** Both files independently implement `role === 'agent'` to decide "Groups-only" visibility. `.planning/ROLES.md` (canonical reference read by this project explicitly before role-gated work) states under "Gating a new feature": *"Avoid comparing `role` strings directly in components — that bypasses the permission map and makes the mapping harder to audit."* Two independent implementations of the same concept also means Phase 32 (which per `31-CONTEXT.md` D-03 is expected to expand nav visibility further) has to find and update both places in sync, or the two navs will drift out of parity again.
**Fix:** Add a permission (or a small shared helper/constant, e.g. `isGroupsOnlyRole(role)` exported from `assets/rbac/permissions.ts`) and use it in both places instead of independently re-deriving `role === 'agent'`.

### WR-03: `PortalAdminSideNav`'s agent filter matches on the display label string, coupling copy to access logic

**File:** `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx:19`
**Issue:** `items.filter(i => i.label === 'Groups')` ties role-based filtering to the exact copy string `'Groups'`. Per CLAUDE.md's frontend philosophy ("Copy matters... clear, concise, and human"), label text is expected to be revisited/iterated on. A future rename or i18n pass on this label (with no corresponding update to the filter) would silently make the agent's Admin nav render zero items, with no test failure catching it unless the test also happens to search by the same string (which `PortalAdminSideNav.test.tsx` does, masking the coupling).
**Fix:** Filter on `path` (a stable identifier) instead of `label`:
```tsx
const visibleItems = role === 'agent' ? items.filter(i => i.path === '/admin/groups') : items
```

### WR-04: `domains_controller.rb` `verify` action is not owner/admin-gated despite being a mutating action, contradicting its own doc comment

**File:** `backend/app/controllers/v1/admin/domains_controller.rb:131-132` (not in this phase's file list, but directly relevant to the CR-01 investigation)
**Issue:** See CR-01 for full detail — the comment says `verify` is "Accessible to admin + owner (default require_admin!)" but the actual `V1::Admin::BaseController` default is `require_agent_or_above!`, and `verify` is absent from the `require_owner!` allowlist (`only: %i[subdomain custom destroy set_primary]`). This means `agent` can currently call this mutating endpoint, which the comment implies should not be possible.
**Fix:** Either add `verify` to the `require_owner!`/`require_admin!` allowlist if the comment reflects the intended behavior, or correct the comment if agent access is intentional. Flag this explicitly to whoever picks up Phase 32's read-only/write-gating work, since it's exactly the kind of "write button UI that 403s on submit" case Phase 32 is meant to close — except this one doesn't 403.

## Info

### IN-01: Brief full-nav flash for agent while role is still resolving

**Files:** `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx:19`, `frontend/src/components/sidenav/useSideNavContext.ts:12`
**Issue:** Both filters treat any role other than the literal string `'agent'` as "show everything," including the transient `null`/`undefined` state before `account`/`activeBrokerage` finishes loading. An agent will briefly see the full 6-item admin nav (Brokerage, Boards, Users, Groups, Domains, Settings) before it narrows down to Groups-only once the role resolves. Low severity — cosmetic flicker only, and moot in practice given CR-01 (routes aren't blocked either way today) — but worth tightening once CR-01 is fixed, so the flash doesn't imply route access that no longer exists.
**Fix:** Default to the most restrictive nav (or render nothing) until `isUserLoaded`/role is known, mirroring the pattern already used in `RequireRole` (`if (!isUserLoaded) return null`).

### IN-02: Missing test coverage for `staff` role exclusion in `admin_brokerages` filter

**File:** `backend/test/integration/admin_brokerages_test.rb`
**Issue:** The controller's role filter is `%w[admin owner agent]`, explicitly excluding `staff` (a role that exists in `BROKERAGE_ROLES` per `.planning/ROLES.md`). The test suite covers the `client`-exclusion case (`"excludes a brokerage where the user is only a client"` in the controller test) but has no equivalent case for `staff`, even though `staff` is arguably more likely to be added to this filter by mistake in a future edit (it's grouped with `agent` in `member_roles` a few lines below, at controller line 41, which could tempt a future author into assuming it belongs in the eligibility filter too).
**Fix:** Add a test mirroring the client-exclusion test, using `create(:brokerage_membership, :staff, ...)`, asserting the brokerage is excluded from `admin_brokerages`.

---

_Reviewed: 2026-07-10T07:04:24Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
