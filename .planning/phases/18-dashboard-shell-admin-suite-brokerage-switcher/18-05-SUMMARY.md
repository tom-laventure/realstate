---
phase: 18-dashboard-shell-admin-suite-brokerage-switcher
plan: "05"
subsystem: frontend/portal-admin-shell
tags: [portal, admin, shell, domain-routing, react-router]
dependency_graph:
  requires:
    - "18-01"  # Axios interceptor + RequireRole bypass
    - "18-02"  # admin route on main domain
    - "18-03"  # PortalNavBar brokerage switcher
    - "18-04"  # PortalShell real landing page
  provides:
    - domain-adaptive admin shell
    - PortalAdminShell (portal-native, PortalNavBar + Outlet)
    - AdminDomainShell (routes main domain to PortalAdminShell, subdomain to AppShellAdmin)
  affects:
    - frontend/src/router/admin/admin.tsx
tech_stack:
  added: []
  patterns:
    - domain-adaptive shell delegation via isMainDomain()
    - portal-native admin layout (PortalNavBar + Outlet, no subdomain chrome)
key_files:
  created:
    - frontend/src/components/common/shells/portalAdminShell/PortalAdminShell.tsx
    - frontend/src/router/admin/AdminDomainShell.tsx
  modified:
    - frontend/src/router/admin/admin.tsx
decisions:
  - "18-05-A: AdminDomainShell delegates to PortalAdminShell or AppShellAdmin based on isMainDomain() — one route definition avoids React Router path conflicts from domain-guarded duplicate /admin/ blocks"
  - "18-05-B: isMainDomain() called directly in render (not in useEffect/useMemo) — window.location.hostname is stable for page lifetime; no hook needed"
  - "18-05-C: PortalAdminShell omits RequireRole, useFetchBrokerage, useBrowserFavicon — RequireBrokerageContext in router guards access; brokerage logo/favicon are subdomain-only concerns"
metrics:
  duration: "~5 min"
  completed_date: "2026-05-26"
  tasks_completed: 3
  files_changed: 3
---

# Phase 18 Plan 05: Domain-Adaptive Admin Shell Summary

Domain-adaptive admin shell using PortalAdminShell (PortalNavBar + Outlet, no subdomain chrome) on the main domain and AppShellAdmin unchanged on subdomains, wired via a single AdminDomainShell element in admin.tsx.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create PortalAdminShell component | 67229f0 | portalAdminShell/PortalAdminShell.tsx (created) |
| 2 | Create AdminDomainShell domain-adaptive wrapper | b83c8db | router/admin/AdminDomainShell.tsx (created) |
| 3 | Update admin.tsx to use AdminDomainShell | 257ea08 | router/admin/admin.tsx (modified) |

## What Was Built

### PortalAdminShell.tsx
Clean portal-native admin shell: renders `<PortalNavBar />` at the top and `<Outlet />` below. No subdomain Navbar, SideNav, Footer, RequireRole wrapper, useFetchBrokerage, or useBrowserFavicon. Uses `flex min-h-screen flex-col bg-background` layout matching the PortalShell resolved state pattern.

### AdminDomainShell.tsx
Domain-adaptive wrapper that calls `isMainDomain()` directly in render (stable per page lifecycle) and delegates: main domain → `<PortalAdminShell />`, subdomain → `<AppShellAdmin />`. No hooks in this component — hooks run only in whichever shell is rendered.

### admin.tsx
Replaced `AppShellAdmin` import with `AdminDomainShell from './AdminDomainShell'`. Route element changed from `<AppShellAdmin />` to `<AdminDomainShell />`. All 15 child routes unchanged.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

1. PortalAdminShell.tsx: PortalNavBar + Outlet, no subdomain chrome — PASS
2. AdminDomainShell.tsx: isMainDomain, PortalAdminShell, AppShellAdmin all present — PASS
3. admin.tsx: AdminDomainShell in, AppShellAdmin out — PASS
4. TypeScript: no errors in modified/created files (`npx tsc --noEmit` shows only pre-existing tsconfig.json module resolution warnings, no code errors) — PASS

## Checkpoint Pending

Task 4 (`checkpoint:human-verify`) requires manual browser verification:
- Main domain: PortalNavBar persistent on all /admin/* pages, no subdomain Navbar/SideNav/Footer
- Subdomain: AppShellAdmin renders unchanged (no regression)
- Brokerage switcher navigates correctly from admin context

## Known Stubs

None — all components are fully wired. PortalNavBar reads activeBrokerage and adminBrokerages from Redux store (set by PortalShell). AdminDomainShell delegates to real shells.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced. isMainDomain() is a UX utility only; backend enforces brokerage scoping (documented in threat model as T-18-10: accept).

## Self-Check: PASSED

- frontend/src/components/common/shells/portalAdminShell/PortalAdminShell.tsx — FOUND
- frontend/src/router/admin/AdminDomainShell.tsx — FOUND
- frontend/src/router/admin/admin.tsx — FOUND (modified)
- Commit 67229f0 — FOUND (feat(18-05): create PortalAdminShell component)
- Commit b83c8db — FOUND (feat(18-05): create AdminDomainShell domain-adaptive wrapper)
- Commit 257ea08 — FOUND (feat(18-05): update admin.tsx to use AdminDomainShell)
