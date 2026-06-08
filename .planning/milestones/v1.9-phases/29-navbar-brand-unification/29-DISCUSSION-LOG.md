# Phase 29: Navbar Brand Unification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 29-navbar-brand-unification
**Areas discussed:** Dashboard navbar component, PortalNavBar brokerage logo fate, Logo click behavior

---

## Dashboard Navbar Component

| Option | Description | Selected |
|--------|-------------|----------|
| New DashboardNavBar component | Fresh component with just logo + account dropdown. No notifications hook, no brokerage context. | ✓ |
| Adapt NavBar.tsx with props | Add hideNotifications prop to shared NavBar. More complex, feature-flag style. | |
| Inline in BrokerageSelection.tsx | Put header markup directly in BrokerageSelection. Quick but not reusable. | |

**User's choice:** New DashboardNavBar component

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inside BrokerageSelection.tsx | BrokerageSelection renders DashboardNavBar at top, then card grid below. | ✓ |
| In the portal router as a layout wrapper | /dashboard index route gets a layout shell. More indirection. | |

**User's choice:** Inside BrokerageSelection.tsx

---

| Option | Description | Selected |
|--------|-------------|----------|
| Match PortalNavBar exactly | signOut({ global: true }) + clearActiveBrokerage() + clearToken() + redirect to /auth/login | ✓ |
| Simpler via useCognitoAuth | Use existing useCognitoAuth().signOut() hook. Slightly less code. | |

**User's choice:** Match PortalNavBar exactly

---

## PortalNavBar Brokerage Logo Fate

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it — brand logo only | Brand logo sits outside the trigger. Inside trigger: just brokerage name + chevron. | ✓ |
| Keep it inside the trigger | Brand logo to the left AND brokerage logo stays inside the trigger. Two logos. | |

**User's choice:** Remove per-brokerage logo — brand logo only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone img before the DropdownMenu | img is not a button — purely visual branding next to the switcher. | ✓ |
| Wrapped in a button/link | Brand logo is clickable. | |

**User's choice:** Standalone img before the DropdownMenu
**Notes:** This was later revised — see Logo Click Behavior section below. The brand logo in PortalNavBar IS clickable (navigates to /dashboard).

---

## Logo Click Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| No action — static branding | img, not a button. User is already on /dashboard. | ✓ |
| Navigate to /dashboard | Clicking navigates to /dashboard. | |

**User's choice (DashboardNavBar):** No action — static branding (user is already on /dashboard)

---

| Option | Description | Selected |
|--------|-------------|----------|
| No action — static branding | Purely visual, consistent with DashboardNavBar. | |
| Navigate to /dashboard | Clicking takes user back to brokerage selection. | |

**User's choice (PortalNavBar):** Navigate to /dashboard — with clarification: "I want to always show the saas logo, not the brand logo on the portal nav, clicking it should redirect back to /dashboard"

**Notes:** User confirmed both navbars use the same `VITE_BRAND_LOGO_URL` source. "SaaS logo" = `VITE_BRAND_LOGO_URL`. In PortalNavBar the logo is clickable (navigates to /dashboard); in DashboardNavBar it is static.

---

## Claude's Discretion

- Exact Tailwind sizing for the brand logo img
- Whether PortalNavBar brand logo button uses shadcn Button variant="ghost" or plain button element
- Whether DashboardNavBar account menu trigger uses UserCircle icon or text

## Deferred Ideas

None
