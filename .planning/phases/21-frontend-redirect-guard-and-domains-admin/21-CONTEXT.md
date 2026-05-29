# Phase 21: Frontend — Redirect Guard & Domains Admin Page - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Frontend-only phase. Two deliverables:
1. **Redirect guard** (`PrimaryDomainRedirect` component): on app init for subdomain visitors, calls `GET /v1/domains/lookup?domain={hostname}`, compares the returned primary domain to current hostname, and silently redirects (same path + query) if they differ.
2. **Domains admin page** (`/admin/domains`): full CRUD UI for subdomain editing and custom domain management, with lifecycle-aware state (phase-out countdowns, slot management, Pro gate).

Requirements in scope: DINT-01, DUI-01, DUI-02, DUI-03, DUI-04, DUI-05, DUI-06, DUI-07, DUI-08, DUI-09.

</domain>

<decisions>
## Implementation Decisions

### Redirect Guard (DINT-01)
- **D-01:** Guard fires **before auth** on subdomain visits only. Uses existing `isMainDomain()` helper to skip the guard on the main domain entirely.
- **D-02:** Implementation: a new `PrimaryDomainRedirect` component placed **inside the `SubdomainOnly` block** in `src/router/main.tsx`, wrapping the `ProtectedRoute` + children subtree. On mount, calls the lookup API; renders `null` (blank screen) while in flight; renders children once the check passes.
- **D-03:** **Fail open**: if the lookup API call fails (network error, 404, or any error), render the app normally — do not block the user on a guard failure.
- **D-04:** Redirect uses `window.location.replace(primaryUrl)` so the phasing-out domain URL is not left in browser history.

### Domains Page Structure (DUI-01, DUI-02, DUI-03)
- **D-05:** Page organized into **two named sections**: "Subdomains" and "Custom Domains". Each section has its own heading and manages its own card list. The Custom Domains section shows a locked upgrade prompt for non-Pro brokerages (DUI-08).
- **D-06:** Domain cards display: name + type badge (Subdomain / Custom Domain) + status badge (Active / Phasing Out) in the card header. For phasing-out domains: "X days remaining, decommissions [date]" in small text at the card footer (DUI-02).
- **D-07:** Primary domain card shows a "Primary" badge. Active non-primary domain cards show a "Set as primary" button in the card action row (DUI-03).
- **D-08:** Action buttons (Edit, Set as primary, Remove now) live in a **button row at the bottom of each card** — always visible, no kebab menu.

### Inline Edit (DUI-04)
- **D-09:** Clicking "Edit" on a subdomain card **toggles the card into edit mode in place** — the card's display content is replaced by the inline form. Save/Cancel buttons are shown. The card stays in its grid position.
- **D-10:** The input shows **slug only** (e.g., "acme") with a non-editable ".realstate.app" suffix rendered visually alongside it. Reuse or closely mirror `SubdomainInput.tsx` from `src/components/createBrokerage/SubdomainInput.tsx`.
- **D-11:** Validation runs **on-change**; error text appears inline below the input. Save button is disabled while invalid. Rules: alphanumeric + hyphens only, no leading/trailing hyphens, no reserved words (mirror `BrokerageDomain::RESERVED_SLUGS` from the backend model — hardcode the same list client-side).

### Slot Management UI (DUI-06, DUI-07, DUI-09)
- **D-12:** DUI-06 warning (1 slot left after a successful edit): a **yellow inline banner below the Subdomains section header** reading "Next change will be your last until [date]". Appears after the mutation response includes `phase_out_warning`. Visible until next page load.
- **D-13:** DUI-07 blocked state (0 slots): Edit button is disabled with tooltip "Unavailable until [date]". A **red banner below the Subdomains section header** reads "No slots available until [date]". A collapsed **"Free a slot now?" accordion** below the banner lists each phasing-out subdomain with a "Remove now" button — this surfaces the escape hatch (DUI-07 requirement).
- **D-14:** DUI-09 Remove now confirmation dialog: destructive dialog with title "Remove [domain]?", body "This domain will stop resolving immediately and cannot be undone. Any links using this domain will break.", destructive red confirm button.

### Data Layer
- **D-15:** Update `BrokerageDomain` type definition in `src/assets/api/admin/domains/fetchDomains.ts` (or move to `src/assets/types/domainType.ts`) to the new schema: `id`, `domain`, `domainType` (`subdomain` | `custom`), `status` (`active` | `phasing_out` | `decommissioned`), `isPrimary`, `phaseOutAt` (nullable string).
- **D-16:** New mutation hooks needed (TanStack mutations with toast feedback): `useUpdateSubdomain`, `useAddCustomDomain`, `useRemoveCustomDomain`, `useSetPrimaryDomain`, `useDecommissionDomain`. All follow the project hook pattern (store/hooks/Admin/Domains/).
- **D-17:** New API module for the lookup endpoint: `src/assets/api/domains/lookupDomain.ts` — plain Axios call, no auth header needed (public endpoint). Used only by the redirect guard, not by TanStack Query.
- **D-18:** Mutation responses from Phase 20 (D-04 in 20-CONTEXT.md) return `{ domain, domains }` — hooks should invalidate `domainsKeys.all` or update cache directly from the `domains` array in the response.

### Navigation (DUI-01)
- **D-19:** Add "Domains" nav item to **both** sidebars: `SideNav.tsx` (admin section, after "Listing Groups") and `PortalAdminSideNav.tsx` (after "Groups"). Use `Globe` icon from `lucide-react`.
- **D-20:** Add `/admin/domains` route to `src/router/admin/admin.tsx`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §DINT-01, §DUI-01 through §DUI-09 — Full requirement text for all Phase 21 requirements

### Backend API (built in Phase 20)
- `.planning/phases/20-backend-domain-api/20-CONTEXT.md` — Phase 20 decisions, especially D-04 (mutation response shape `{ domain, domains }`) and D-06 (`phase_out_at` = 30 days)
- `backend/app/serializers/brokerage_domain_serializer.rb` — Exact field names returned by the API (`id`, `domain`, `domain_type`, `status`, `is_primary`, `phase_out_at`) — verify camelCase via Axios interceptor
- `backend/app/models/brokerage_domain.rb` — `RESERVED_SLUGS` constant (must be mirrored client-side for DUI-04 validation)

### Router & Guards
- `frontend/src/router/main.tsx` — Where `PrimaryDomainRedirect` is inserted (inside `SubdomainOnly` block)
- `frontend/src/components/common/guards/DomainGuard.tsx` — Existing `SubdomainOnly` / `MainDomainOnly` guard pattern to follow

### Admin Shell & Nav
- `frontend/src/components/sidenav/SideNav.tsx` — Subdomain admin sidenav; add "Domains" nav item in the admin section
- `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` — Main domain portal sidenav; add "Domains" nav item
- `frontend/src/router/admin/admin.tsx` — Add `/admin/domains` route here

### Reusable Components
- `frontend/src/components/createBrokerage/SubdomainInput.tsx` — Slug-only input with static suffix; reuse or closely mirror for DUI-04 inline edit form

### Existing Domain Hooks & API
- `frontend/src/store/hooks/Admin/Domains/useFetchDomains.ts` — Existing hook; needs type update
- `frontend/src/assets/api/admin/domains/fetchDomains.ts` — Existing API file; `BrokerageDomain` type needs to be replaced with new schema

### Domain Helper
- `frontend/src/helpers/domain.ts` — `isMainDomain()` utility used by the redirect guard

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SubdomainInput.tsx`: slug-only input with `.realstate.app` suffix — reuse or mirror for subdomain inline edit (D-10)
- `isMainDomain()` in `helpers/domain.ts`: already checks `window.location.hostname === VITE_MAIN_DOMAIN` — use as the guard condition in `PrimaryDomainRedirect`
- `useFetchDomains` + `domainsKeys.all`: existing TanStack Query setup — extend with mutation hooks that invalidate the same key
- `DomainGuard.tsx` (`SubdomainOnly` / `MainDomainOnly`): existing guard component pattern — `PrimaryDomainRedirect` follows the same structure (null-render while checking, render children when safe)
- shadcn/ui `AlertDialog` — for the Remove now confirmation dialog (DUI-09)
- shadcn/ui `Accordion` — for the "Free a slot?" collapsed panel (DUI-07)

### Established Patterns
- Context (Brain) → TanStack Hook → API module: all new domain CRUD follows this chain
- Types in `assets/types/` before hooks or contexts: create `domainType.ts` first
- Mutation hooks: `useMutation` + `toast` on success/error (see `useCreateAdminUser.tsx` as reference)
- Admin page container pattern: container file + context file side by side (e.g., `BrokerageAdminBoard.tsx` + `useBrokerageAdminContext`)

### Integration Points
- `src/router/main.tsx`: add `PrimaryDomainRedirect` wrapper inside the `SubdomainOnly` block
- `src/router/admin/admin.tsx`: add `{ path: 'domains', element: <DomainsAdminBoard /> }`
- `SideNav.tsx` admin section: add `<NavButton label="Domains" icon={<Globe />} path="/admin/domains" />`
- `PortalAdminSideNav.tsx` items array: add `{ label: 'Domains', icon: Globe, path: '/admin/domains' }`
- `fetchDomains.ts` → update `BrokerageDomain` type; or move type to `assets/types/domainType.ts` and import from there

</code_context>

<specifics>
## Specific Ideas

- Redirect guard uses `window.location.replace(primaryUrl)` not `window.location.href = primaryUrl` — replaces history entry so the phasing-out domain URL is not retained in back-navigation.
- "Free a slot?" accordion (DUI-07): the phasing-out domains listed inside it each have a "Remove now" button that triggers the same decommission mutation as the main DUI-09 action.
- Phase-out countdown format: "12 days remaining · decommissions May 30" — readable, specific.
- The `phase_out_warning` field in the Phase 20 mutation response signals when DUI-06 banner should appear — the hook/context reads this from the mutation result and sets local state accordingly.
- `BrokerageDomain.RESERVED_SLUGS` in the backend: hardcode the same list in a constant in `domainType.ts` or a dedicated `domainConstants.ts` file for client-side DUI-04 validation.

</specifics>

<deferred>
## Deferred Ideas

- DNS verification flow for custom domains — explicitly out of scope for v1.5; v1.6 milestone
- Server-side 301 redirect at the Caddy/proxy layer — client-side redirect on app init is the v1.5 approach; true 301 requires Caddy config changes (carried to v1.6)

</deferred>

---

*Phase: 21-frontend-redirect-guard-and-domains-admin*
*Context gathered: 2026-05-28*
