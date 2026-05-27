# Phase 18: Dashboard Shell, Admin Suite & Brokerage Switcher - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the `PortalShell` placeholder with a real admin dashboard landing page. The landing page renders a portal-specific nav bar (brokerage name/role/switcher, sign-out) and a centered dashboard card with links to the 4 admin sections. Register the existing `/admin/` route tree on the main domain so the linked admin panels work. Inject `X-Brokerage-Id` into the Axios interceptor for all `/v1/admin/**` calls on the main domain. The brokerage switcher in the nav bar navigates to `/dashboard/:newBrokerageId`, updating the active brokerage context.

</domain>

<decisions>
## Implementation Decisions

### X-Brokerage-Id Header Injection
- **D-01:** Modify the existing `axios.ts` request interceptor. When `isMainDomain()` is true AND the request URL contains `/v1/admin/`, read `activeBrokerage.id` from `store.getState()` and add the `X-Brokerage-Id` header.
- **D-02:** Header scope is surgical — only `/v1/admin/**` routes on the main domain. Not all requests.
- **D-03:** If `activeBrokerage` is `null` when the interceptor runs, skip the header silently. The backend returns 400, which surfaces as an error in the UI. No blocking logic.
- **D-04:** Access the Redux store directly via `store.getState()` — the interceptor is outside the React component tree and cannot use `useSelector`.

### Admin Panels Strategy
- **D-05:** Register the full existing `/admin/` route tree on the main domain router (alongside `/dashboard/*`). No new portal-specific admin panel components needed.
- **D-06:** `PortalShell` dashboard card links navigate to `/admin/brokerage`, `/admin/users`, `/admin/groups`, `/admin/settings`. Existing `AppShellAdmin` handles the layout when users drill into admin sub-pages.
- **D-07:** The brokerage switcher is only visible on the `/dashboard/:brokerageId` portal landing page. When the user is on `/admin/*`, `AppShellAdmin` nav is active. This is acceptable for Phase 18.

### Portal Shell Layout
- **D-08:** `PortalShell` is replaced with a real landing page: `PortalNavBar` at the top + a centered dashboard card with 4 section links (Board Registrations → `/admin/brokerage`, Users → `/admin/users`, Groups → `/admin/groups`, Settings → `/admin/settings`).
- **D-09:** Layout follows the centered column pattern from `BrokerageSelection` and `LoginSuccessful` — `max-w-lg`, centered, raw `div` card (not shadcn `Card`), consistent with portal conventions.

### Portal Nav Bar
- **D-10:** New `PortalNavBar` component (not extending existing `NavBar`). No notifications.
- **D-11:** Nav bar content: left side — brokerage name as a `DropdownMenuTrigger` (the switcher); right side — role badge (Owner/Admin, muted styling) + sign-out button.
- **D-12:** `PortalNavBar` reads `activeBrokerage` from Redux (`useAppSelector`). If `activeBrokerage` is null, it renders nothing (loading state is handled by `PortalShell`).

### Brokerage Switcher
- **D-13:** Brokerage switcher is a `DropdownMenu` in `PortalNavBar`. Options are `adminBrokerages` from Redux.
- **D-14:** On selection: dispatch `setActiveBrokerage(selected)` then `navigate('/dashboard/:newId')`. PortalShell re-validates the new ID on mount.
- **D-15:** If user has only one brokerage, switcher dropdown still renders but shows only one option (no special case needed — single-brokerage admins arrive here via auto-redirect from `BrokerageSelection` and can still see the name).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Axios & Main Domain Detection
- `frontend/src/assets/axios/axios.ts` — The interceptor to modify for X-Brokerage-Id injection (D-01). Also handles 401/403 redirects — do not break these.
- `frontend/src/helpers/domain.ts` — `isMainDomain()` utility used in the interceptor condition (D-01)

### Redux Store
- `frontend/src/store/reducers/activeBrokerage.ts` — `activeBrokerage` and `adminBrokerages` slice; `setActiveBrokerage` action used by switcher (D-13/14)
- `frontend/src/store/reducers/index.tsx` — Root store; import `store` from here for `store.getState()` in interceptor (D-04)

### Portal Shell & Routes
- `frontend/src/containers/portal/PortalShell.tsx` — Replace placeholder with real landing page (D-08/09)
- `frontend/src/router/portal/portal.tsx` — Portal routes; no structural change needed (routes already wired from Phase 17)
- `frontend/src/router/main.tsx` — Root router; register `/admin/` route here for main domain (D-05)

### Admin Routes (to register on main domain)
- `frontend/src/router/admin/admin.tsx` — Full `/admin/` route tree; mount at `/admin/` in main domain router (D-05/06)
- `frontend/src/components/common/shells/appShellAdmin/AppShellAdmin.tsx` — Shell used by admin routes; verify it doesn't break on main domain (no subdomain-only assumptions)

### Phase 17 Context (prior decisions)
- `.planning/phases/17-brokerage-selection-post-create-redirect/17-CONTEXT.md` — D-01 through D-13: Redux slice shape, route architecture, portal card conventions

### Existing Portal Components (visual reference)
- `frontend/src/containers/portal/BrokerageSelection.tsx` — Centered column + raw div card pattern (D-09 follows this exactly)
- `frontend/src/containers/portal/NoAccess.tsx` — Portal page visual reference

### Existing NavBar (visual reference only — NOT extending)
- `frontend/src/components/navbar/NavBar.tsx` — Reference for shadcn DropdownMenu patterns used in portal nav (D-11/13)

### Requirements
- `.planning/REQUIREMENTS.md` §PORTAL and §Brok — PORTAL-02, PORTAL-03, BROK-03, BROK-04 are the 4 requirements for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `activeBrokerage` Redux slice — Already stores `{ activeBrokerage: AdminBrokerage | null, adminBrokerages: AdminBrokerage[] }`. `PortalNavBar` reads both fields via `useAppSelector`.
- `isMainDomain()` (`helpers/domain.ts`) — Already implemented; use in the Axios interceptor condition.
- `BrokerageSelection.tsx` — Exact layout template for `PortalShell` landing page (centered column, max-w-sm, raw div cards, role badges).
- `NavBar.tsx` `DropdownMenu` pattern — Reference for implementing the brokerage switcher dropdown (`DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` from shadcn).
- `frontend/src/router/admin/admin.tsx` — Full admin route tree ready to register on main domain.
- `useFetchAdminBrokerages` hook — Available if `adminBrokerages` in Redux is empty and needs refreshing (edge case in switcher).

### Established Patterns
- Raw `div` card pattern (not shadcn `Card`) for portal pages — D-10 from Phase 16, confirmed through Phases 17 and 18.
- Redux slice reads via `useAppSelector` in React components; `store.getState()` for outside-React access (interceptor).
- Brokerage ID validated against `adminBrokerages[]` on `PortalShell` mount — already implemented in Phase 17; preserve this logic.

### Integration Points
- `frontend/src/assets/axios/axios.ts:21` — Request interceptor where `X-Brokerage-Id` logic is added.
- `frontend/src/router/main.tsx` — Where `/admin/` route object is imported and registered.
- `frontend/src/containers/portal/PortalShell.tsx` — Replace placeholder return value with real landing page + `PortalNavBar`.

</code_context>

<specifics>
## Specific Ideas

- Portal landing page card: 4 section links arranged as a 2×2 grid or vertical list — each link shows section name + a relevant lucide icon (e.g., `Building2` for Board Registrations, `Users` for Users, `Layers` for Groups, `Settings` for Settings).
- Brokerage name in nav bar acts as the switcher trigger — clicking it opens the dropdown. This is the established pattern from the existing `NavBar.tsx` (brokerage logo triggers dropdown).
- Role badge: small, subdued — consistent with the role badges on `BrokerageSelection` cards from Phase 17.
- Sign-out: right side of nav bar, ghost button variant, consistent with `NavBar.tsx` account menu.

</specifics>

<deferred>
## Deferred Ideas

- Persistent portal nav bar on `/admin/*` sub-pages (brokerage switcher visible while drilling into admin panels) — requires wrapping `AppShellAdmin`. Deferred to v1.5.
- Notification access from main domain portal — requires X-Brokerage-Id on notification endpoints. Deferred to future phase.

</deferred>

---

*Phase: 18-Dashboard Shell, Admin Suite & Brokerage Switcher*
*Context gathered: 2026-05-26*
