# Phase 29: Navbar Brand Unification - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Add the SaaS platform brand logo (`VITE_BRAND_LOGO_URL`) to both main-domain navbars and give the `/dashboard` brokerage selection screen its own dedicated navbar.

Two deliverables:
1. **New `DashboardNavBar` component** — rendered inside `BrokerageSelection.tsx` at the top of the page. Contains: brand logo on the left (static, no click action), account dropdown on the right (Account Settings → `/account`, Sign Out).
2. **PortalNavBar update** — replace the per-brokerage `brokerageData.logoUrl` img inside the switcher trigger with a standalone brand logo img placed to the left of the entire `DropdownMenu`. The brand logo is clickable and navigates to `/dashboard`.

No backend changes. Frontend-only. `VITE_BRAND_LOGO_URL` is a new env var to add to `.env.example`.

</domain>

<decisions>
## Implementation Decisions

### DashboardNavBar Component

- **D-01:** New `DashboardNavBar` component — do **not** adapt `NavBar.tsx` with props. NavBar includes notifications bell and auth context hooks that are irrelevant for the `/dashboard` selection screen.
- **D-02:** `DashboardNavBar` renders inside `BrokerageSelection.tsx` at the top (not as a router-level layout wrapper).
- **D-03:** Left side: `<img src={import.meta.env.VITE_BRAND_LOGO_URL} />` — static, no click handler. When `VITE_BRAND_LOGO_URL` is empty/undefined, hide the img element entirely (no broken image).
- **D-04:** Right side: account dropdown with two items — "Account Settings" (navigate to `/account`) and "Sign Out".
- **D-05:** Sign-out flow matches `PortalNavBar` exactly: `signOut({ global: true })` + `dispatch(clearActiveBrokerage())` + `clearToken()` + `window.location.href = '/auth/login'`. User may not have an `activeBrokerage` at this point — `clearActiveBrokerage()` is safe even when the store is null.
- **D-06:** No notifications bell. No brokerage switcher. No role badge.

### PortalNavBar Logo Update

- **D-07:** The per-brokerage logo (`brokerageData?.logoUrl`) currently rendered inside the switcher trigger is **removed**. Only brokerage name + chevron remain inside the trigger.
- **D-08:** A standalone `<img src={import.meta.env.VITE_BRAND_LOGO_URL} />` is placed to the left of the `<DropdownMenu>` element in the left `<div>`. It is **not** inside the trigger button.
- **D-09:** The brand logo in PortalNavBar is **clickable** — wrapped in a button or rendered as a `<button>` that calls `navigate('/dashboard')`. Clicking it takes the user back to the brokerage selection screen.
- **D-10:** When `VITE_BRAND_LOGO_URL` is empty/undefined, hide the img (and its click wrapper) in PortalNavBar too.

### Env Var

- **D-11:** Add `VITE_BRAND_LOGO_URL=` (blank default) to `frontend/.env.example`. No backend changes needed.

### Claude's Discretion

- Exact Tailwind sizing for the brand logo img (`h-7`, `h-8`, etc.) — match the visual weight of the existing brokerage logo that was in the trigger.
- Whether the PortalNavBar brand logo button uses `variant="ghost"` Button or a plain `<button>` element — either is consistent with the codebase.
- Whether `DashboardNavBar` uses an account icon button (`UserCircle`) or a text button for the dropdown trigger — follow the existing `NavBar.tsx` account menu pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DASH-05 (`/dashboard` navbar with logo + account menu), DASH-06 (PortalNavBar brand logo left of switcher), DASH-07 (`VITE_BRAND_LOGO_URL` as single env var source)

### Components to Modify
- `frontend/src/containers/portal/BrokerageSelection.tsx` — add `DashboardNavBar` at top
- `frontend/src/containers/portal/PortalNavBar.tsx` — remove brokerage logo from trigger, add standalone brand logo img + click handler

### Components to Create
- `frontend/src/containers/portal/DashboardNavBar.tsx` — new component (peer to `PortalNavBar.tsx`)

### Reference Patterns
- `frontend/src/containers/portal/PortalNavBar.tsx` — sign-out flow (`signOut({ global: true })` + Redux clear + `clearToken()` + redirect). Mirror exactly in `DashboardNavBar`.
- `frontend/src/components/navbar/NavBar.tsx` — account dropdown pattern (UserCircle trigger, Account Settings + Sign Out items)
- `frontend/.env.example` — add `VITE_BRAND_LOGO_URL=` entry

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `clearToken()` from `@/lib/auth` — used by PortalNavBar sign-out, reuse in DashboardNavBar
- `clearActiveBrokerage` Redux action from `@/store/reducers/activeBrokerage` — safe to dispatch even when `activeBrokerage` is null
- `signOut` from `aws-amplify/auth` — direct import in PortalNavBar, same pattern for DashboardNavBar
- shadcn `DropdownMenu`, `DropdownMenuItem`, `DropdownMenuTrigger`, `DropdownMenuContent` — already used in both NavBar.tsx and PortalNavBar.tsx

### Established Patterns
- Logo absence = conditional render: `{logoUrl && <img src={logoUrl} ... />}` — already used in NavBar.tsx (`displayLogoUrl`) and PortalNavBar (`brokerageData?.logoUrl`). Apply same pattern to `import.meta.env.VITE_BRAND_LOGO_URL`.
- `window.location.href` redirect (not `navigate`) for sign-out — established in PortalNavBar to clear browser history after auth logout.

### Integration Points
- `BrokerageSelection.tsx` imports `DashboardNavBar` and renders it at the top, before the card grid `<div>`
- `PortalNavBar.tsx` left `<div>`: replace `<DropdownMenu>` with `{brandLogo && <button onClick={() => navigate('/dashboard')}><img .../></button>} <DropdownMenu>`

</code_context>

<specifics>
## Specific Ideas

- User confirmed: both navbars use the same `VITE_BRAND_LOGO_URL` source
- In `DashboardNavBar`: brand logo is **static** (no click action) — user is already on `/dashboard`
- In `PortalNavBar`: brand logo is **clickable** and navigates to `/dashboard` (back to brokerage selection)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 29-navbar-brand-unification*
*Context gathered: 2026-06-06*
