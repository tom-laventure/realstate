---
phase: 29-navbar-brand-unification
fixed_at: 2026-06-06T00:00:00Z
review_path: .planning/phases/29-navbar-brand-unification/29-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 29: Code Review Fix Report

**Fixed at:** 2026-06-06
**Source review:** `.planning/phases/29-navbar-brand-unification/29-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: `BrokerageSelection` dispatches and navigates inside render — React render side-effect

**Files modified:** `frontend/src/containers/portal/BrokerageSelection.tsx`
**Commit:** `2a6052d`
**Applied fix:** Removed the render-body `if (adminBrokerages.length === 1)` block that called `dispatch(setActiveBrokerage(...))` and `navigate(...)` directly. Replaced with a `useEffect` that depends on `adminBrokerages`, executing the same dispatch + navigate after render. The `return null` early exit was also removed since the effect now handles the redirect asynchronously. A comment explains the rationale (double-dispatch in Strict Mode, concurrent-mode safety).

---

### WR-02: `DashboardNavBar` uses `navigate('/account')` alongside `window.location.href` for sign-out without explanation

**Files modified:** `frontend/src/containers/portal/DashboardNavBar.tsx`
**Commit:** `54793d9`
**Applied fix:** Added a four-line comment directly above `handleSignOut` documenting the intentional asymmetry: `window.location.href = '/auth/login'` triggers a hard reload to clear all in-memory Redux/Amplify state post sign-out, while `navigate('/account')` is a SPA navigation that correctly preserves app state for the account settings flow. The `useNavigate` hook and its usage for `/account` are retained as correct.

---

### WR-03: `PortalNavBar` brokerage switcher has no visual anchor when `VITE_BRAND_LOGO_URL` is absent

**Files modified:** `frontend/src/containers/portal/PortalNavBar.tsx`
**Commit:** `c7e642d`
**Applied fix:** Added `pl-1` to the left-side wrapper div (`<div className="flex items-center gap-2 pl-1">`). This gives the brokerage switcher `DropdownMenu` a stable minimum left offset regardless of whether the brand logo is present. A comment on the adjacent line explains why the padding exists.

---

_Fixed: 2026-06-06_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
