# Phase 18: Dashboard Shell, Admin Suite & Brokerage Switcher - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 18-dashboard-shell-admin-suite-brokerage-switcher
**Areas discussed:** X-Brokerage-Id injection, Admin panels reuse, Portal nav bar design, Brokerage switcher behavior

---

## X-Brokerage-Id injection

| Option | Description | Selected |
|--------|-------------|----------|
| Interceptor reads Redux | Modify axios.ts request interceptor: isMainDomain() + URL includes '/v1/admin/' → read store.getState() and add header | ✓ |
| Per-call explicit header | Each portal API module passes brokerage ID as a hook argument | |
| Portal-specific Axios instance | New axiosPortal.ts instance that always includes X-Brokerage-Id from Redux | |

**User's choice:** Interceptor reads Redux (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Only on /v1/admin/** | Surgical check on URL — avoids adding header to unrelated calls | ✓ |
| All requests on main domain | Simpler; header ignored by endpoints that don't use it | |

**User's choice:** Only on /v1/admin/** (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Skip header silently | Interceptor adds header only when activeBrokerage.id is set; backend returns 400 on missing header | ✓ |
| Block the request until set | Cancel request and reject locally if activeBrokerage is null | |

**User's choice:** Skip header silently (Recommended)

---

## Admin panels reuse

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing panels | Mount existing BrokerageAdminBoard, UsersAdminBoard, etc. — API calls work with X-Brokerage-Id injected | ✓ |
| Build portal-specific panels | New portal versions of each panel — more duplication and dev time | |

**User's choice:** Reuse existing panels (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Register /admin/ on main domain | Main domain router also registers /admin/ route tree. Links from portal navigate to /admin/* | ✓ |
| Refactor panels to accept basePath | Update admin panel navigations to use configurable basePath | |
| Portal shows landing pages only | Embed only top-level list views, no internal sub-navigation | |

**User's choice:** Register /admin/ on main domain too (Recommended)
**Notes:** Existing admin panels have hardcoded `/admin/` navigate calls — cannot be mounted under `/dashboard/:brokerageId/` sub-routes without refactoring.

---

## Portal nav bar design

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard card with admin section links | Portal nav bar + centered card with links to 4 admin sections | ✓ |
| Full admin shell with side nav | Side nav listing all admin sections, like AppShellAdmin | |
| Redirect directly to first admin section | PortalShell validates and immediately navigates to /admin/brokerage | |

**User's choice:** Dashboard card with admin section links (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| New portal-specific nav | Dedicated PortalNavBar — no notifications, just brokerage name/role/switcher/sign-out | ✓ |
| Extend existing NavBar with props | Add portalMode prop to NavBar | |

**User's choice:** New portal-specific nav (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Brokerage name + role badge + sign-out | Left: brokerage name as dropdown trigger. Right: role badge + sign-out | ✓ |
| Brokerage name + role + user avatar + sign-out | Also shows user name/avatar — requires fetching user profile | |

**User's choice:** Brokerage name + role badge + sign-out (Recommended)

---

## Brokerage switcher behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to /dashboard/:newBrokerageId | Dispatch setActiveBrokerage + navigate to new URL. URL reflects active brokerage. | ✓ |
| Redux dispatch only, stay on current page | Dispatch + invalidate all queries. URL diverges from active brokerage. | |

**User's choice:** Navigate to /dashboard/:newBrokerageId (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Acceptable for Phase 18 | Switcher only visible on /dashboard/:brokerageId. AppShellAdmin handles nav on /admin/* | ✓ |
| Portal nav must persist on /admin/* | Wrap AppShellAdmin with portal nav — significantly more complex | |

**User's choice:** Acceptable for Phase 18 (Recommended)

---

## Claude's Discretion

None — user selected all recommended options.

## Deferred Ideas

- Persistent portal nav bar on `/admin/*` sub-pages — deferred to v1.5
- Notification access from main domain portal — deferred to future phase
