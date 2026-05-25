# Phase 16: Main Domain Routing & Auth Guards - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire up the frontend `/dashboard/*` route tree on the main domain with auth guards covering three user states: (1) unauthenticated users redirected to sign-in, (2) authenticated users with ≥1 admin/owner role routed to `/dashboard` (placeholder shell), and (3) authenticated users with no admin roles shown a no-access screen at `/no-access`. Also move shared auth routes (`/auth/login`, `/auth/login-success`) outside domain guards so they work on all domains.

</domain>

<decisions>
## Implementation Decisions

### Auth Route Strategy
- **D-01:** Move `/auth/login` and `/auth/login-success` outside both `SubdomainOnly` and `MainDomainOnly` guards — shared routes accessible on all domains (main domain + subdomains). No new login component needed.
- **D-02:** The existing `LoginSuccessful` component is modified to be domain-aware: on main domain (`isMainDomain()`), fetch `GET /v1/account/admin_brokerages` after setting the token and route based on the result; on subdomain, current behavior unchanged (redirect to `destination || '/'`).

### Post-Login Routing on Main Domain
- **D-03:** While the `admin_brokerages` API call is in flight, show the existing loading spinner in `LoginSuccessful` ("Finalizing your sign-in") — no separate loading page needed.
- **D-04:** If the `admin_brokerages` API call fails (network error, 500), show the existing error state in `LoginSuccessful` ("Something went wrong") — user can retry sign-in. Do not route to no-access.
- **D-05:** If `admin_brokerages` returns ≥1 entry, route the user to `/dashboard`. Phase 17 will replace the placeholder shell with the real brokerage selection screen.
- **D-06:** If `admin_brokerages` returns an empty array, route the user to `/no-access`.

### No-Access Screen
- **D-07:** Minimal design: a simple card with the message "Your account doesn't have admin access to any brokerage. Please sign in directly at your brokerage URL." and a Sign Out button.
- **D-08:** Route: `/no-access` under `MainDomainOnly` — a dedicated top-level route, not nested inside `/dashboard`. This avoids any redirect loop from auth guards on the dashboard tree.

### Dashboard Shell (Phase 16 Scope)
- **D-09:** `/dashboard/*` renders a minimal placeholder page for this phase (e.g., "Admin Portal — coming soon" card or loading skeleton). Phase 18 replaces this with the real portal shell and navigation.
- **D-10:** Unauthenticated users navigating directly to any `/dashboard/*` URL on the main domain are redirected to `/auth/login` with `state={{ from: location }}`. The existing `ProtectedRoute` component (or a new `MainProtectedRoute` if domain scoping is needed) handles this redirect.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Router & Domain Guards
- `frontend/src/router/main.tsx` — Root router: `SubdomainOnly`, `MainDomainOnly` guards and where auth/dashboard routes currently live. This is the primary file to modify.
- `frontend/src/components/common/guards/DomainGuard.tsx` — `SubdomainOnly` and `MainDomainOnly` implementations using `isMainDomain()`
- `frontend/src/components/common/guards/ProtectedRoute.tsx` — Current auth guard: checks `isAuthenticated()`, redirects to `/auth/login` with location state
- `frontend/src/helpers/domain.ts` — `isMainDomain()` utility (checks `VITE_MAIN_DOMAIN`)

### Auth Callback
- `frontend/src/containers/auth/LoginSuccessful.tsx` — The component to extend with domain-aware routing. Currently reads token from hash, sets it, then navigates to `destination || '/'`.
- `frontend/src/router/auth/auth.tsx` — Current auth routes definition (lives inside `SubdomainOnly` today — must be moved out)

### API (Phase 15 output — must read)
- `backend/app/controllers/v1/account/admin_brokerages_controller.rb` — The endpoint being called: `GET /v1/account/admin_brokerages` returns `{ admin_brokerages: [{ id, name, role }] }`
- `.planning/phases/15-backend-api-brokerage-auth-extension/15-CONTEXT.md` — Phase 15 decisions: D-10, D-11, D-12 define the response shape

### Requirements
- `.planning/REQUIREMENTS.md` §PORTAL and §Auth — PORTAL-01, AUTH-05, AUTH-06, AUTH-07 are the 4 requirements for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LoginSuccessful.tsx` — Extend in-place: the loading spinner + error state UI is already built; only the navigation logic after token set needs a main-domain branch
- `ProtectedRoute.tsx` — Can be reused as-is for the `/dashboard` tree on the main domain if `isAuthenticated()` is sufficient, or wrapped with a `MainDomainOnly` guard
- `isMainDomain()` — Already implemented in `helpers/domain.ts`; use this for the domain check inside `LoginSuccessful`
- `MainDomainOnly` guard — Already wraps `createBrokerage`; reuse to wrap `/no-access` and `/dashboard` tree

### Established Patterns
- Auth route definition pattern: `router/auth/auth.tsx` exports a route object imported by `main.tsx` — follow the same pattern for main-domain portal routes
- Domain guard composition: `SubdomainOnly` and `MainDomainOnly` are layout components using `<Outlet />` — wrap new portal routes the same way
- Post-auth redirect with `state={{ from: location }}` is established in `ProtectedRoute` — follow same pattern for the portal guard

### Integration Points
- `frontend/src/router/main.tsx` — primary integration point: move `auth` routes out of `SubdomainOnly`, add `MainDomainOnly` wrapper for `/dashboard` and `/no-access`
- `frontend/src/containers/auth/LoginSuccessful.tsx` — add `isMainDomain()` branch after token is set
- New API call: `GET /v1/account/admin_brokerages` — create `frontend/src/assets/api/account/fetchAdminBrokerages.ts` following the existing api module pattern

</code_context>

<specifics>
## Specific Ideas

No specific design references beyond what's in decisions above. No-access screen follows the minimal card style already used in LoginSuccessful's error state.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 16-Main Domain Routing & Auth Guards*
*Context gathered: 2026-05-24*
