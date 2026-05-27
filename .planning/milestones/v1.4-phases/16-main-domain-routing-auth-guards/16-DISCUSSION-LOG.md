# Phase 16: Main Domain Routing & Auth Guards - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 16-main-domain-routing-auth-guards
**Areas discussed:** Auth route on main domain, Post-login routing logic, No-access screen, Dashboard shell for Phase 16

---

## Auth Route on Main Domain

| Option | Description | Selected |
|--------|-------------|----------|
| Shared auth routes | Move /auth/login and /auth/login-success outside both domain guards — accessible on all domains | ✓ |
| Duplicate main-domain login | Keep subdomain auth as-is, add a second /auth/login route under MainDomainOnly | |
| Main domain — different path | Use a different path (e.g. /sign-in) for main-domain login | |

**User's choice:** Shared auth routes (Recommended)
**Notes:** Simplest approach — reuses existing Login component. No new login component needed.

| Option | Description | Selected |
|--------|-------------|----------|
| Same LoginSuccessful, domain-aware | Modify existing LoginSuccessful with isMainDomain() branch for admin_brokerages fetch | ✓ |
| Separate main-domain callback page | New MainLoginSuccessful component, keep existing LoginSuccessful unchanged | |

**User's choice:** Same LoginSuccessful, domain-aware
**Notes:** One component with branching logic rather than duplication.

---

## Post-Login Routing Logic

| Option | Description | Selected |
|--------|-------------|----------|
| Show a loading spinner | Reuse existing LoginSuccessful spinner while admin_brokerages call is in flight | ✓ |
| Redirect to /dashboard then gate | Route immediately, let a PortalGate guard make the check | |

**User's choice:** Show a loading spinner (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Show error in LoginSuccessful | Reuse existing error state for API failures | ✓ |
| Redirect to no-access screen | Treat API failure same as no admin roles | |
| Redirect to /dashboard anyway | Let dashboard handle errors downstream | |

**User's choice:** Show error in LoginSuccessful (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| /dashboard (placeholder shell) | Route to /dashboard; Phase 16 creates minimal placeholder; Phase 17 replaces | ✓ |
| /dashboard/select (future route) | Route to /dashboard/select even though Phase 17 hasn't built it yet | |

**User's choice:** /dashboard (placeholder shell)

---

## No-Access Screen

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: message + sign-out | Simple card with message and Sign Out button | ✓ |
| Detailed: message + brokerage hint + support link | Same plus support contact or admin access request | |
| Redirect them out | Redirect to sign-in with toast/error message | |

**User's choice:** Minimal: message + sign-out (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| /no-access on main domain | Dedicated top-level route under MainDomainOnly | ✓ |
| Inside /dashboard route tree | /dashboard/no-access route (redirect loop risk) | |

**User's choice:** /no-access on main domain (Recommended)

---

## Dashboard Shell for Phase 16

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal placeholder page | Simple "Admin Portal — coming soon" card or skeleton | ✓ |
| Start building the shell skeleton | Build outer shell structure now for Phase 18 to fill | |
| Empty outlet (blank screen) | Just an Outlet with no UI | |

**User's choice:** Minimal placeholder page (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Same /auth/login redirect | ProtectedRoute redirects to /auth/login with state={{ from: location }} | ✓ |
| New main-domain-specific redirect | New guard redirecting to a different path on main domain | |

**User's choice:** Same /auth/login redirect (Recommended)

---

## Claude's Discretion

None — all key decisions were made by the user.

## Deferred Ideas

None — discussion stayed within phase scope.
