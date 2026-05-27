# Phase 17: Brokerage Selection & Post-Create Redirect - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the `/dashboard` placeholder with a real brokerage selection screen, implement single-brokerage auto-redirect (BROK-02), and update `SuccessStep` to redirect to the main domain portal with the newly created brokerage auto-selected (ONB-04). Introduces a new Redux slice for active brokerage state and splits the dashboard route into `/dashboard` (selection screen) and `/dashboard/:brokerageId` (portal shell — Phase 18 fills content).

</domain>

<decisions>
## Implementation Decisions

### Active Brokerage Redux Slice
- **D-01:** New Redux slice (`activeBrokerage` or similar) for active brokerage state — matches existing `createBrokerageWizard` and `tempBrokerage` slice pattern.
- **D-02:** Slice stores full `AdminBrokerage` object `{ id, name, role }` — not just the ID. Phase 18 can read name and role from Redux for nav bar display (PORTAL-03) without extra API calls.
- **D-03:** Slice also stores `adminBrokerages: AdminBrokerage[]` list. `LoginSuccessful` dispatches the list after fetching; the selection screen reads it from Redux (no second API call needed).

### Route Architecture
- **D-04:** `/dashboard` (index route) = brokerage selection screen.
- **D-05:** `/dashboard/:brokerageId` = portal shell — Phase 18 builds the content here. Phase 17 creates a minimal shell placeholder at this route.
- **D-06:** Portal shell reads `:brokerageId` from URL params on mount and dispatches to Redux as the active brokerage. The Phase 18 Axios interceptor reads the Redux store for `X-Brokerage-Id` header on portal API calls.

### Brokerage Selection Screen Logic (BROK-01, BROK-02)
- **D-07:** `BrokerageSelection` component handles the single-brokerage auto-redirect check — not a route guard. On mount: if `adminBrokerages.length === 1`, dispatch `setActiveBrokerage` and navigate to `/dashboard/:id`; if `> 1`, render the cards.
- **D-08:** Card design: centered column layout (max-w-sm, matching `LoginSuccessful` and `NoAccess`), cards stacked vertically. Each card: brokerage name (prominent) + role badge. Click anywhere on card → navigate to `/dashboard/:id`.
- **D-09:** Page heading: "Select a brokerage" with subtitle "Choose the brokerage you want to manage." No user-name personalization.
- **D-10:** Raw `div` card pattern (not shadcn `Card`) — consistent with Phase 16 portal pages per UI-SPEC.md contract.

### Post-Wizard Redirect (ONB-04)
- **D-11:** `SuccessStep` redirects to `https://{VITE_MAIN_DOMAIN}/dashboard/{newBrokerageId}` — the new brokerage ID is available in `state.result` from `CreateBrokerageContext` at the point `SuccessStep` renders.
- **D-12:** Portal shell validates `:brokerageId` against `adminBrokerages[]` in Redux on mount. If the ID is not found (e.g., URL tampering), redirect to `/dashboard` (selection screen).
- **D-13:** If `adminBrokerages` is empty in Redux on portal shell mount (wizard redirect case — `LoginSuccessful` was not the entry point), fetch it first via `fetchAdminBrokerages`, then validate and dispatch. Show a loading spinner during fetch.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Router & Portal Routes
- `frontend/src/router/main.tsx` — Root router; add `/dashboard/:brokerageId` route alongside the existing `/dashboard` index route
- `frontend/src/router/portal/portal.tsx` — Current portal route definitions; extend with `:brokerageId` child route and new shell placeholder
- `frontend/src/components/common/guards/DomainGuard.tsx` — `MainDomainOnly` guard wrapping portal routes

### Auth Flow & API
- `frontend/src/containers/auth/LoginSuccessful.tsx` — Dispatch adminBrokerages list to Redux after fetching (D-03); navigate to `/dashboard` (selection screen, not shell) after ≥1 brokerage check
- `frontend/src/assets/api/account/fetchAdminBrokerages.ts` — Existing API module (already built in Phase 16)
- `frontend/src/store/hooks/Account/useFetchAdminBrokerages.ts` — Existing hook (Phase 16 output)
- `frontend/src/assets/types/adminBrokerageType.ts` — `AdminBrokerage` type `{ id, name, role }` — used for Redux slice shape

### Redux Store
- `frontend/src/store/reducers/createBrokerageWizard.ts` — Pattern to follow for new `activeBrokerage` slice
- `frontend/src/store/reducers/tempBrokerage.tsx` — Second Redux slice example; follow same structure

### Post-Wizard Redirect
- `frontend/src/containers/createBrokerage/steps/SuccessStep.tsx` — Modify to redirect to main domain `/dashboard/:id` instead of subdomain (D-11)
- `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx` — `state.result` structure — contains `brokerage.id` after successful creation

### Phase 16 Context (prior decisions)
- `.planning/phases/16-main-domain-routing-auth-guards/16-CONTEXT.md` — D-01 through D-10: auth route strategy, raw div card pattern, portal component conventions

### Requirements
- `.planning/REQUIREMENTS.md` §Brok and §ONB — BROK-01, BROK-02, ONB-04 are the 3 requirements for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LoginSuccessful.tsx` — Extend to dispatch `adminBrokerages` list to Redux after fetch (currently only calls `navigate`). Also update navigation from `/dashboard` to `/dashboard` (no change needed — selection screen now lives there per D-04).
- `fetchAdminBrokerages` / `useFetchAdminBrokerages` — Already built; use from the portal shell for the empty-Redux-list case (D-13).
- `AdminBrokerage` type — Already defined in `adminBrokerageType.ts`; use as the shape for both slice fields.
- `NoAccess.tsx` + `DashboardPlaceholder.tsx` — Visual reference for the raw div card + centered column layout style.
- `isSafeRedirectHost()` in `SuccessStep.tsx` — Already validates redirect targets against `VITE_APP_BASE_DOMAIN`; reuse or adapt for main domain redirect.

### Established Patterns
- Raw `div` card pattern (not shadcn `Card`) for portal pages — established in Phase 16 per UI-SPEC.md (D-10 above)
- Redux slice structure: `createSlice({ name, initialState, reducers })` — follow `tempBrokerage.tsx` exactly
- `VITE_MAIN_DOMAIN` (or `VITE_APP_BASE_DOMAIN`) env var — already used in `SuccessStep` and `DomainGuard` for domain-safe redirects

### Integration Points
- `frontend/src/router/portal/portal.tsx` — Add `/dashboard/:brokerageId` child route with portal shell component
- `frontend/src/store/reducers/` — Add new `activeBrokerageReducer` and wire into root store
- `frontend/src/containers/portal/DashboardPlaceholder.tsx` — Replace with `BrokerageSelection` component at `/dashboard` index; add new `PortalShell` placeholder at `/dashboard/:brokerageId`
- `frontend/src/containers/createBrokerage/steps/SuccessStep.tsx` — Change primary redirect from subdomain to `https://{mainDomain}/dashboard/{id}`

</code_context>

<specifics>
## Specific Ideas

- Selection screen page title: "Select a brokerage" / subtitle: "Choose the brokerage you want to manage."
- Role badge on each card (e.g., "Owner", "Admin") — small, subdued styling consistent with existing badge patterns.
- Click-the-whole-card interaction (not a separate button inside the card).
- Centered column layout, max-w-sm, matching `LoginSuccessful` page structure exactly.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-Brokerage Selection & Post-Create Redirect*
*Context gathered: 2026-05-25*
