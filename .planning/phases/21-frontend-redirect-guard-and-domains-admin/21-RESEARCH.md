# Phase 21: Frontend — Redirect Guard & Domains Admin Page - Research

**Researched:** 2026-05-28
**Domain:** React / TanStack Query / shadcn/ui / React Router v6 — Frontend CRUD + guard
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Redirect Guard (DINT-01)**
- D-01: Guard fires before auth on subdomain visits only. Uses `isMainDomain()` to skip on main domain entirely.
- D-02: New `PrimaryDomainRedirect` component placed inside the `SubdomainOnly` block in `src/router/main.tsx`, wrapping the `ProtectedRoute` + children subtree. Renders `null` while in flight; renders children once check passes.
- D-03: Fail open — if lookup API fails (network error, 404, any error), render the app normally.
- D-04: Redirect uses `window.location.replace(primaryUrl)` so phasing-out domain URL is not left in browser history.

**Domains Page Structure (DUI-01, DUI-02, DUI-03)**
- D-05: Two named sections: "Subdomains" and "Custom Domains". Each has its own heading and card list. Custom Domains shows locked upgrade prompt for non-Pro brokerages.
- D-06: Domain cards display: name + type badge + status badge in card header. Phasing-out domains: countdown footer.
- D-07: Primary domain card shows "Primary" badge. Active non-primary cards show "Set as primary" button.
- D-08: Action buttons (Edit, Set as primary, Remove now) in button row at bottom of each card — always visible, no kebab menu.

**Inline Edit (DUI-04)**
- D-09: Clicking "Edit" toggles card into edit mode in place — card display replaced by inline form. Save/Cancel shown. Card stays in grid position.
- D-10: Input shows slug only ("acme") with non-editable ".realstate.app" suffix rendered visually alongside. Reuse or mirror `SubdomainInput.tsx`.
- D-11: Validation on-change. Save button disabled while invalid. Rules: alphanumeric + hyphens only, no leading/trailing hyphens, no reserved words (mirror `BrokerageDomain::RESERVED_SLUGS`).

**Slot Management UI (DUI-06, DUI-07, DUI-09)**
- D-12: DUI-06 warning — yellow inline banner below Subdomains section header after mutation response includes `phase_out_warning`.
- D-13: DUI-07 blocked — Edit button disabled with tooltip. Red banner below section header. Collapsed accordion lists phasing-out subdomains with "Remove now" button.
- D-14: DUI-09 confirmation — destructive AlertDialog with specific copy.

**Data Layer**
- D-15: Update `BrokerageDomain` type to new schema: `id`, `domain`, `domainType` (`subdomain` | `custom`), `status` (`active` | `phasing_out` | `decommissioned`), `isPrimary`, `phaseOutAt` (nullable string). Move to `src/assets/types/domainType.ts`.
- D-16: New mutation hooks: `useUpdateSubdomain`, `useAddCustomDomain`, `useRemoveCustomDomain`, `useSetPrimaryDomain`, `useDecommissionDomain`. All in `store/hooks/Admin/Domains/`.
- D-17: New API module `src/assets/api/domains/lookupDomain.ts` — plain Axios call, no auth needed. Used only by the redirect guard.
- D-18: Mutation responses return `{ domain, domains }` — hooks should update cache from `domains` array or invalidate `domainsKeys.all`.

**Navigation (DUI-01)**
- D-19: Add "Domains" nav item to both sidebars using `Globe` icon from `lucide-react`.
- D-20: Add `/admin/domains` route to `src/router/admin/admin.tsx`.

### Claude's Discretion
None specified — all decisions locked.

### Deferred Ideas (OUT OF SCOPE)
- DNS verification flow for custom domains (v1.6)
- Server-side 301 redirect at Caddy/proxy layer (v1.6)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DINT-01 | On app init, frontend detects if hostname differs from primary domain and redirects to primary domain same path+query | PrimaryDomainRedirect component pattern, lookup endpoint shape, `isMainDomain()` helper, `window.location.replace` |
| DUI-01 | `/admin/domains` route + "Domains" nav item in both sidebars | Router structure verified, both sidenav files read, exact insertion points identified |
| DUI-02 | Domain cards with name, type badge, status badge, phasing-out countdown | shadcn Card/Badge pattern verified; countdown format specified in UI-SPEC |
| DUI-03 | Primary badge on primary card; "Set as primary" on active non-primary cards | Backend `set_primary` endpoint verified; `useSetPrimaryDomain` mutation hook pattern |
| DUI-04 | "Edit" action on subdomain card — inline form with client-side slug validation | `SubdomainInput.tsx` reuse pattern verified; RESERVED_SLUGS list confirmed from model |
| DUI-05 | Custom domain section: "Add domain" button + inline form; "Remove" with confirmation | `useAddCustomDomain`, `useRemoveCustomDomain` hooks; AlertDialog already installed |
| DUI-06 | Yellow warning banner after mutation leaves 1 slot remaining (`phase_out_warning` in response) | Backend confirmed to emit `phase_out_warning` key; local state pattern documented |
| DUI-07 | 0 slots: Edit disabled + tooltip; red banner + "Free a slot?" accordion | Accordion must be installed; disabled button + title tooltip pattern; `useDecommissionDomain` reuse |
| DUI-08 | Non-Pro: locked card with upgrade prompt in Custom Domains section | `BrokerageType.plan` field verified (`plan?: string`); Pro gate renders when `plan !== 'premium'` |
| DUI-09 | Phasing-out domains: "Remove now" action with destructive confirmation dialog | AlertDialog already installed; `useDecommissionDomain` maps to `DELETE /v1/admin/domains/:id` on phasing_out record |
</phase_requirements>

---

## Summary

Phase 21 is a pure frontend phase delivering two self-contained deliverables: a redirect guard component (`PrimaryDomainRedirect`) and a full domains admin page (`/admin/domains`). Both deliverables are well-specified in CONTEXT.md and UI-SPEC.md. The backend API (Phase 20) is complete and the endpoint shapes are verified from source code.

The existing codebase provides all necessary scaffolding: the router structure, guard component pattern, hook/API/type layering, and admin board container pattern are all established. The planner needs to thread new code through existing integration points rather than invent new patterns. The primary implementation risk is state management for the "edit in place" card toggle and the `phase_out_warning` local-state lifecycle — neither is complex, but they require careful wiring.

One missing shadcn component needs installation before implementation: `accordion` is not yet in `frontend/src/components/ui/`. The `Accordion` component is required for the DUI-07 "Free a slot now?" panel. All other shadcn components (`AlertDialog`, `Badge`, `Button`, `Card`, `Input`, `Label`) are already installed and confirmed present.

**Primary recommendation:** Build bottom-up: types first → API modules → mutation hooks → context → container → view components. Install `accordion` in Wave 0 before touching any UI.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Redirect guard (DINT-01) | Browser/Client | — | Client-side hostname check on app init; guard runs before auth in browser |
| Primary domain lookup | API/Backend | — | `GET /v1/domains/lookup` — public unauthenticated backend call |
| Domains page data fetch | API/Backend | Browser/Client (TanStack) | Authenticated `GET /v1/admin/domains`; TanStack Query caches in browser |
| Domain mutations (subdomain edit, set primary, remove) | API/Backend | Browser/Client (TanStack) | Server owns state; optimistic or invalidation update in client cache |
| Inline edit form state | Browser/Client | — | Per-card local React state (`editingId`, `slugValue`, `validationError`) |
| Slot warning banner visibility | Browser/Client | — | Local state derived from mutation response `phase_out_warning` key; dismissed on page reload |
| Pro gate check | Browser/Client | — | `brokerage.plan === 'premium'` evaluated client-side; no separate API call |
| Navigation item rendering | Browser/Client | — | Static config objects/JSX in sidenav components |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^18.2.0 | Component rendering | Project standard [VERIFIED: package.json] |
| React Router DOM | ^6.4.3 | Routing, `<Outlet>` guard pattern | Project router uses v6 patterns [VERIFIED: package.json] |
| TanStack Query | ^4.22.0 | Data fetching + cache invalidation for mutations | Established hook layer [VERIFIED: package.json] |
| axios | ^1.2.3 | HTTP client (with camelcaseKeys interceptor) | Project standard Axios instance [VERIFIED: package.json] |
| react-hot-toast | ^2.6.0 | Mutation success/error toasts | Used in all existing mutation hooks [VERIFIED: package.json] |
| lucide-react | ^0.555.0 | Icons only (`Globe`, `Lock`) | Project icon library — no alternatives [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui (new-york) | — | AlertDialog, Accordion, Badge, Button, Card, Input, Label | All UI surfaces in this phase |
| dayjs | ^1.11.7 | Date formatting for countdown ("decommissions May 30") | Already installed; use for phase_out_at formatting |
| camelcase-keys | ^10.0.1 | Automatic snake_case → camelCase on responses | Applied by Axios interceptor — never call manually |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline edit state (local useState) | Context-owned edit state | Local state is correct here — card edit state is ephemeral and per-card |
| `window.location.replace` in guard | React Router `<Navigate replace>` | Cannot use Navigate for cross-origin redirects; `window.location.replace` required |
| TanStack `invalidateQueries` | Optimistic update from `domains` array in mutation response | Both valid; D-18 says use the `domains` array from response for direct cache update or invalidate |

**Installation (Wave 0):**
```bash
# From frontend/ directory
npx shadcn add accordion
```

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (app init)
  └─ PrimaryDomainRedirect (mounts inside SubdomainOnly block)
       └─ isMainDomain()? → skip, render children
       └─ fetch GET /v1/domains/lookup?domain={hostname} (no auth)
            ├─ success: hostname = primary_domain → render children
            ├─ success: hostname ≠ primary_domain → window.location.replace(primaryUrl)
            └─ error (any) → fail open, render children

User navigates to /admin/domains
  └─ DomainsAdminBoard (container)
       └─ useDomainsAdminContext (brain)
            └─ useFetchDomains → GET /v1/admin/domains (authenticated)
            └─ useUpdateSubdomain   → PATCH /v1/admin/domains/subdomain
            └─ useSetPrimaryDomain  → PATCH /v1/admin/domains/:id/set_primary
            └─ useDecommissionDomain → DELETE /v1/admin/domains/:id (phasing_out)
            └─ useAddCustomDomain   → POST /v1/admin/domains/custom
            └─ useRemoveCustomDomain → DELETE /v1/admin/domains/:id (active custom)
       └─ DomainsAdminView (pure UI)
            ├─ SubdomainsSection
            │    ├─ [SlotBanner — yellow/red — conditional]
            │    ├─ [FreeSlotAccordion — conditional, DUI-07]
            │    └─ DomainCard × N
            │         └─ [inline edit form — conditional, DUI-04]
            └─ CustomDomainsSection
                 ├─ [ProGateLocked — if not premium]
                 └─ [DomainCard × N + AddDomainForm — if premium]

Mutation response flow:
  Backend → { domain, domains, phase_out_warning? }
  Hook → setQueryData(domainsKeys.all, { domains }) OR invalidate
  Hook → if phase_out_warning → callback to context → set slotWarning state
```

### Recommended Project Structure

```
frontend/src/
├─ assets/
│   ├─ api/
│   │   └─ domains/
│   │       └─ lookupDomain.ts          # NEW — public lookup, no auth
│   │   └─ admin/domains/
│   │       ├─ fetchDomains.ts          # UPDATE type only (or remove type, import from types/)
│   │       ├─ updateSubdomain.ts       # NEW
│   │       ├─ addCustomDomain.ts       # NEW
│   │       ├─ removeDomain.ts          # NEW (shared for remove + decommission)
│   │       └─ setPrimaryDomain.ts      # NEW
│   └─ types/
│       └─ domainType.ts                # NEW — BrokerageDomain, RESERVED_SLUGS
├─ components/
│   ├─ common/guards/
│   │   └─ PrimaryDomainRedirect.tsx   # NEW — mirrors DomainGuard.tsx pattern
│   └─ ui/
│       └─ accordion.tsx                # ADD via npx shadcn add accordion
├─ containers/
│   └─ adminBoard/
│       └─ domainsAdminBoard/
│           ├─ DomainsAdminBoard.tsx    # NEW — container
│           └─ useDomainsAdminContext.ts # NEW — brain
├─ components/view/admin/
│   └─ domainsAdminView/
│       ├─ DomainsAdminView.tsx         # NEW — pure UI shell
│       ├─ DomainCard.tsx              # NEW — single card (read + edit modes)
│       ├─ DomainSlugInput.tsx         # NEW — mirrors SubdomainInput.tsx
│       └─ FreeSlotAccordion.tsx       # NEW — DUI-07 accordion panel
└─ store/hooks/Admin/Domains/
    ├─ useFetchDomains.ts              # UPDATE — type only
    ├─ useUpdateSubdomain.ts           # NEW
    ├─ useAddCustomDomain.ts           # NEW
    ├─ useRemoveCustomDomain.ts        # NEW (active custom → phase_out)
    ├─ useDecommissionDomain.ts        # NEW (phasing_out → immediate decommission)
    └─ useSetPrimaryDomain.ts          # NEW
```

### Pattern 1: PrimaryDomainRedirect Guard (mirrors DomainGuard.tsx)

**What:** Null-render guard component that resolves primary domain on mount; redirects or renders children.
**When to use:** Wrap inside `SubdomainOnly` block only; no-op on main domain.

```tsx
// Source: VERIFIED from DomainGuard.tsx and CONTEXT.md D-01 through D-04
import { useEffect, useState } from 'react'
import { isMainDomain } from '@/helpers/domain'
import lookupDomain from '@/assets/api/domains/lookupDomain'

const PrimaryDomainRedirect = ({ children }: { children: React.ReactNode }) => {
    const [ready, setReady] = useState(false)

    useEffect(() => {
        // D-01: skip entirely on main domain
        if (isMainDomain()) { setReady(true); return }

        const hostname = window.location.hostname
        lookupDomain(hostname)
            .then((data) => {
                if (data.domain && data.domain !== hostname) {
                    // D-04: replace so phasing-out URL not in history
                    const primaryUrl = `https://${data.domain}${window.location.pathname}${window.location.search}`
                    window.location.replace(primaryUrl)
                    // Don't setReady — page is navigating away
                } else {
                    setReady(true)
                }
            })
            .catch(() => {
                // D-03: fail open
                setReady(true)
            })
    }, [])

    if (!ready) return null   // Blank screen while in flight
    return <>{children}</>
}
```

### Pattern 2: Lookup API Module (unauthenticated, no Axios instance)

**What:** Plain axios call (not the project's authenticated `api` instance) for the public lookup endpoint.
**When to use:** Only for `PrimaryDomainRedirect`. Must NOT attach auth headers.

```ts
// Source: VERIFIED from axios.ts (auth interceptor attaches token) and CONTEXT.md D-17
// Use plain axios or a base axios instance without auth interceptor.
// The authenticated api instance always attaches Authorization — not appropriate here.
import axios from 'axios'

const lookupDomain = async (domain: string): Promise<{ domain: string }> => {
    const baseUrl = import.meta.env.VITE_BE_ENDPOINT || window.location.origin
    const response = await axios.get(`${baseUrl}/v1/domains/lookup`, { params: { domain } })
    return response.data
}

export default lookupDomain
```

**Critical note:** The project's `api` instance (`assets/axios/axios.ts`) attaches `Authorization: Bearer {token}` and `X-Brokerage-Id` headers via interceptors. The lookup endpoint is unauthenticated and fires before auth. Using the authenticated `api` instance here would attach tokens prematurely and misuse the public endpoint.

### Pattern 3: Mutation Hook with Cache Update (mirrors useVerifyDomain.ts + useCreateAdminUser.tsx)

**What:** `useMutation` with `onSuccess` cache update + toast + optional warning state callback.
**When to use:** All five new domain mutation hooks.

```ts
// Source: VERIFIED from useCreateAdminUser.tsx and useVerifyDomain.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { domainsKeys } from './useFetchDomains'

const useUpdateSubdomain = (onPhaseOutWarning?: (warning: PhaseOutWarning) => void) => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (slug: string) => updateSubdomain(slug),
        onSuccess: (data) => {
            // D-18: update cache directly from domains array in response
            queryClient.setQueryData(domainsKeys.all, { domains: data.domains })
            toast.success('Subdomain updated.')
            if (data.phaseOutWarning && onPhaseOutWarning) {
                onPhaseOutWarning(data.phaseOutWarning)
            }
        },
        onError: () => {
            toast.error('Something went wrong. Please try again.')
        },
    })
}
```

**Note on `phase_out_warning` propagation:** The backend returns `phase_out_warning: { earliest_slot_available_at: string }` in the mutation response payload. After the Axios camelcaseKeys interceptor, this becomes `phaseOutWarning.earliestSlotAvailableAt`. The hook passes it via callback to the context, which stores it in local state (`slotWarning`). The view renders the yellow banner conditionally on that state. This state is deliberately ephemeral — reset on next page load per D-12.

### Pattern 4: Type File Structure (new domainType.ts)

**What:** Central type file for domain-related types and constants.
**When to use:** Create before hooks or contexts — CLAUDE.md architecture requirement.

```ts
// Source: VERIFIED from brokerage_domain.rb RESERVED_SLUGS + serializer + CONTEXT.md D-15, D-11

export const RESERVED_SLUGS = [
    'admin', 'api', 'www', 'mail', 'smtp', 'ftp', 'staging',
    'dev', 'test', 'app', 'auth', 'login', 'signup', 'dashboard',
    'static', 'assets', 'cdn', 'docs', 'help', 'support', 'status',
] as const

export type DomainType = 'subdomain' | 'custom'
export type DomainStatus = 'active' | 'phasing_out' | 'decommissioned'

export interface BrokerageDomain {
    id: string | number
    domain: string
    domainType: DomainType
    status: DomainStatus
    isPrimary: boolean
    phaseOutAt: string | null    // ISO 8601 string, camelCased by interceptor
}

export interface PhaseOutWarning {
    earliestSlotAvailableAt: string   // camelCased from phase_out_warning.earliest_slot_available_at
}

export interface FetchDomainsResponse {
    domains: BrokerageDomain[]
}

export interface MutationDomainsResponse {
    domain: BrokerageDomain
    domains: BrokerageDomain[]
    phaseOutWarning?: PhaseOutWarning
}
```

### Pattern 5: Inline Card Edit Toggle

**What:** Per-card local state for edit mode — card renders either display or form based on `editingId`.
**When to use:** `DomainCard` component or parent card list component; editingId lifted to the section level so only one card edits at a time.

```tsx
// Source: ASSUMED — project does not have a prior example of inline card edit
// Derived from D-09 decision and React state patterns

const [editingId, setEditingId] = useState<string | number | null>(null)

// In card render:
if (editingId === domain.id) {
    return <DomainCardEditForm domain={domain} onCancel={() => setEditingId(null)} onSave={...} />
}
return <DomainCardDisplay domain={domain} onEdit={() => setEditingId(domain.id)} />
```

### Pattern 6: Router Integration (SubdomainOnly wrapping)

**What:** `PrimaryDomainRedirect` wraps the `ProtectedRoute` + children subtree inside the `SubdomainOnly` block.
**When to use:** Exactly one insertion point in `main.tsx`.

```tsx
// Source: VERIFIED from main.tsx structure and CONTEXT.md D-02
{
    element: <SubdomainOnly />,
    children: [
        {
            element: <PrimaryDomainRedirect>,   // ← wrap here
                children: [
                    {
                        element: <ProtectedRoute />,
                        children: [dashboard, account],
                    },
                    joinBrokerage,
                ]
            </PrimaryDomainRedirect>,
        },
    ],
},
```

**Alternative (React Router v6 compatible):** Since React Router v6 doesn't support wrapping `children` arrays in arbitrary JSX, `PrimaryDomainRedirect` must use the layout route pattern (element + `<Outlet />`):

```tsx
// Correct React Router v6 pattern
{
    element: <SubdomainOnly />,
    children: [
        {
            element: <PrimaryDomainRedirect />,  // uses <Outlet /> inside
            children: [
                {
                    element: <ProtectedRoute />,
                    children: [dashboard, account],
                },
                joinBrokerage,
            ]
        }
    ],
},
```

This means `PrimaryDomainRedirect` renders `<Outlet />` (not `{children}`) when the check passes, matching the `SubdomainOnly` / `MainDomainOnly` guard pattern.

### Anti-Patterns to Avoid

- **Calling camelcaseKeys manually:** The `api` Axios instance already applies this on every response. Calling again produces double-transformation (no-op on already-camel strings but adds confusion). Return `response.data` directly from API modules.
- **Using the authenticated `api` instance for the lookup endpoint:** The interceptor attaches auth tokens. The lookup endpoint is public and fires before auth. Use plain `axios` in `lookupDomain.ts`.
- **Putting domain types in `fetchDomains.ts`:** CLAUDE.md requires domain types in `assets/types/` before hooks or contexts. Move `BrokerageDomain` to `domainType.ts` and import it in `fetchDomains.ts`.
- **Rendering a spinner while the redirect guard is in flight:** UI-SPEC specifies `null` (blank screen) — no spinner, no flash per D-02.
- **Using `window.location.href` for the redirect:** Must be `window.location.replace` so the phasing-out domain is not retained in back-navigation history per D-04.
- **Direct subdomain deletion:** The backend rejects `DELETE /v1/admin/domains/:id` on active subdomains with error code `subdomain_not_deletable`. Subdomain edits use `PATCH /v1/admin/domains/subdomain` only.
- **Blindly casting `brokerage.plan` to boolean:** `BrokerageType.plan` is typed as `string | undefined`. Pro gate check: `brokerage.plan === 'premium'` (strict equality).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation dialogs | Custom modal component | `AlertDialog` (shadcn, already installed) | Focus trap, keyboard nav, accessibility — Radix handles all of it |
| Collapsible "Free a slot" panel | Custom accordion with visibility toggle | `Accordion` (shadcn, install via `npx shadcn add accordion`) | Animation, keyboard nav, ARIA — Radix handles all of it |
| Slug composite input with suffix | Custom flex layout + custom input | Mirror `SubdomainInput.tsx` as `DomainSlugInput.tsx` | Existing pattern: border focus ring, normalized input, accessible label |
| Date formatting for countdown | Manual date math strings | `dayjs` (already installed) — `dayjs(phaseOutAt).diff(dayjs(), 'day')` + `dayjs(phaseOutAt).format('MMM D')` | Edge cases (timezone, negative days, plural) |
| Toast notifications | Custom toast state | `react-hot-toast` (already installed), used in all hooks | Consistent positioning, stacking, dismissal |
| Cache invalidation after mutations | Manual state reset | `queryClient.setQueryData` or `queryClient.invalidateQueries` with `domainsKeys.all` | TanStack handles re-render and loading states automatically |

**Key insight:** Every infrastructure problem in this phase (dialogs, accordions, toasts, caching) already has a vetted solution installed or easily added via `npx shadcn add`. The plan should contain zero custom implementations of these patterns.

---

## Backend API Contract (Verified)

### GET /v1/admin/domains
Returns: `{ domains: BrokerageDomain[] }` (authenticated, requires admin role)

Serializer fields (snake_case from backend, auto-camelCased by interceptor):
- `id` → `id`
- `domain` → `domain`
- `domain_type` → `domainType` (`"subdomain"` | `"custom"`)
- `status` → `status` (`"active"` | `"phasing_out"` | `"decommissioned"`)
- `is_primary` → `isPrimary`
- `phase_out_at` → `phaseOutAt` (nullable ISO string)

[VERIFIED: `backend/app/serializers/brokerage_domain_serializer.rb`]

### GET /v1/domains/lookup?domain=X
Returns: `{ domain: "<primary_domain_string>" }` — public, no auth required
404 if domain not found or no primary domain exists.
[VERIFIED: `backend/app/controllers/v1/domains_controller.rb`]

### PATCH /v1/admin/domains/subdomain
Params: `{ slug: "new-slug" }` — slug only, base domain appended server-side
Returns: `MutationDomainsResponse` — `{ domain, domains, phase_out_warning? }`
Owner role required.
[VERIFIED: `backend/app/controllers/v1/admin/domains_controller.rb`]

### PATCH /v1/admin/domains/:id/set_primary
Returns: `MutationDomainsResponse`
422 if domain is phasing_out or decommissioned.
Owner role required.
[VERIFIED: `backend/app/controllers/v1/admin/domains_controller.rb`]

### DELETE /v1/admin/domains/:id
- If `status: phasing_out` (any type) → immediate decommission (frees slot) → returns `MutationDomainsResponse`
- If `status: active, domain_type: custom` → phase out (slot check applies) → returns `MutationDomainsResponse`
- If `status: active, domain_type: subdomain` → 422 with `code: "subdomain_not_deletable"` — do not offer this in UI
Owner role required.
[VERIFIED: `backend/app/controllers/v1/admin/domains_controller.rb`]

### POST /v1/admin/domains/custom
Params: `{ domain: "app.acme.com" }` — full custom domain
Returns: `MutationDomainsResponse`
403 if brokerage plan is not `"premium"`.
422 if 2 phasing-out custom domains already exist, includes `earliest_slot_available_at`.
Owner role required.
[VERIFIED: `backend/app/controllers/v1/admin/domains_controller.rb`]

### Slot block error shape (DMOD-12)
```json
{
  "error": "Phase-out slot limit reached",
  "earliest_slot_available_at": "<ISO datetime>"
}
```
After camelCase interceptor: `earliestSlotAvailableAt`.
Hooks should extract this for display in DUI-07 red banner and disabled button tooltip.

### Phase-out warning shape (DMOD-11)
```json
{
  "phase_out_warning": { "earliest_slot_available_at": "<ISO datetime>" }
}
```
After camelCase interceptor: `phaseOutWarning.earliestSlotAvailableAt`.

---

## Common Pitfalls

### Pitfall 1: Layout Route vs. JSX Children Wrapping
**What goes wrong:** Developer writes `<PrimaryDomainRedirect>{children}</PrimaryDomainRedirect>` pattern inside React Router's route config object — React Router v6 does not accept arbitrary React wrappers as route elements.
**Why it happens:** `children` prop works in plain React but React Router ignores it in route config.
**How to avoid:** `PrimaryDomainRedirect` must be a layout route — render `<Outlet />` (from `react-router-dom`) when the check passes, placed as a parent route with nested children. Match the `SubdomainOnly` / `MainDomainOnly` pattern exactly.
**Warning signs:** Guard renders but children routes are 404 or don't mount.

### Pitfall 2: Authenticated Axios for Public Lookup
**What goes wrong:** Using `import api from '@/assets/axios/axios'` in `lookupDomain.ts` — this instance attaches `Authorization` and `X-Brokerage-Id` headers. On the main domain, it also injects `X-Brokerage-Id` from Redux store.
**Why it happens:** Convenience — `api` is the default import for all other API modules.
**How to avoid:** `lookupDomain.ts` must use `import axios from 'axios'` (base library) and construct the URL manually from `VITE_BE_ENDPOINT`.
**Warning signs:** Lookup returns 401 or gets routing errors because `X-Brokerage-Id` is attached on main domain.

### Pitfall 3: camelCase Key Divergence — `phase_out_warning` nesting
**What goes wrong:** `phase_out_warning` is a nested object `{ earliest_slot_available_at: string }`. After `camelcaseKeys({ deep: true })`, this becomes `{ phaseOutWarning: { earliestSlotAvailableAt: string } }`. Accessing `response.phaseOutWarning.earliest_slot_available_at` fails silently.
**Why it happens:** camelcaseKeys transforms all levels with `deep: true`.
**How to avoid:** Always access `data.phaseOutWarning?.earliestSlotAvailableAt` (full camelCase chain).
**Warning signs:** Slot warning banner never appears; `undefined` comparisons in date formatting.

### Pitfall 4: Slug Validation — Missing Minimum-Length Check
**What goes wrong:** Regex `/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/` requires at least 1 character but accepts a single character as valid. The Save button enables prematurely on empty string if the empty check runs after the regex.
**Why it happens:** Validation order matters — empty check must run first.
**How to avoid:** Validation order per UI-SPEC: (1) minimum 1 character check, (2) pattern check, (3) reserved word check, (4) unchanged check (disable Save, no error).
**Warning signs:** Save button enabled on empty slug field.

### Pitfall 5: `domainType === 'subdomain'` vs Slot State for Edit Button
**What goes wrong:** Edit button disabled state for DUI-07 (0 slots) is computed at the section level but applied to each card. If the disabled check is per-card using the domain object alone, it cannot know the global slot count.
**Why it happens:** Slot count is a global property of the current brokerage, not the individual domain.
**How to avoid:** Compute `subdomainSlotsBlocked: boolean` in the context from the count of phasing-out subdomains (`domains.filter(d => d.domainType === 'subdomain' && d.status === 'phasing_out').length >= 2`). Pass it as a prop to the Subdomains section and to each DomainCard.
**Warning signs:** Edit button is enabled even when 2 phasing-out subdomains exist.

### Pitfall 6: BrokerageType.plan — undefined vs null vs missing
**What goes wrong:** Pro gate check `brokerage.plan === 'premium'` returns `false` when `plan` is `undefined` (not yet set on old brokerages), causing all brokerages to see the locked card.
**Why it happens:** `BrokerageType.plan` is typed as `string | undefined` — it may not be present.
**How to avoid:** The Pro gate should lock when `plan !== 'premium'` (already correct). Ensure the brokerage data is fully loaded before rendering the custom domains section — only render when `!isLoading && !!brokerage`.
**Warning signs:** All brokerages see the "upgrade" prompt including premium ones.

### Pitfall 7: Redirect Guard Flicker on Direct Render
**What goes wrong:** `PrimaryDomainRedirect` returns `null` while lookup is in flight, causing a brief blank flash on initial load for subdomain users whose hostname already matches primary.
**Why it happens:** Guard always fetches before rendering.
**How to avoid:** This is by design per D-02 ("renders null while in flight"). The blank screen is the specified UX. Do not add a spinner or delay render — the lookup should be fast (single DB read).
**Warning signs:** Attempts to add loading skeleton or spinner to the guard component — do not do this.

---

## Code Examples

### lookupDomain.ts (public endpoint, no project axios instance)
```ts
// Source: VERIFIED from v1/domains_controller.rb#lookup + axios.ts interceptor analysis
import axios from 'axios'

export interface LookupDomainResponse {
    domain: string
}

const lookupDomain = async (domain: string): Promise<LookupDomainResponse> => {
    const baseUrl = (import.meta.env.VITE_BE_ENDPOINT as string | undefined)?.trim() || window.location.origin
    const response = await axios.get<LookupDomainResponse>(`${baseUrl}/v1/domains/lookup`, {
        params: { domain },
    })
    return response.data
}

export default lookupDomain
```

### updateSubdomain.ts API module
```ts
// Source: VERIFIED from v1/admin/domains_controller.rb#subdomain
import api from '@/assets/axios/axios'
import { MutationDomainsResponse } from '@/assets/types/domainType'

const updateSubdomain = async (slug: string): Promise<MutationDomainsResponse> => {
    const response = await api.patch('/v1/admin/domains/subdomain', { slug })
    return response.data as MutationDomainsResponse
}

export default updateSubdomain
```

### setPrimaryDomain.ts API module
```ts
// Source: VERIFIED from v1/admin/domains_controller.rb#set_primary
import api from '@/assets/axios/axios'
import { MutationDomainsResponse } from '@/assets/types/domainType'

const setPrimaryDomain = async (id: string | number): Promise<MutationDomainsResponse> => {
    const response = await api.patch(`/v1/admin/domains/${id}/set_primary`)
    return response.data as MutationDomainsResponse
}

export default setPrimaryDomain
```

### removeDomain.ts API module (shared for active custom → phase_out AND phasing_out → decommission)
```ts
// Source: VERIFIED from v1/admin/domains_controller.rb#destroy
import api from '@/assets/axios/axios'
import { MutationDomainsResponse } from '@/assets/types/domainType'

const removeDomain = async (id: string | number): Promise<MutationDomainsResponse> => {
    const response = await api.delete(`/v1/admin/domains/${id}`)
    return response.data as MutationDomainsResponse
}

export default removeDomain
```

### Countdown formatting with dayjs
```ts
// Source: VERIFIED — dayjs@1.11.7 in package.json; format per UI-SPEC
import dayjs from 'dayjs'

const formatCountdown = (phaseOutAt: string): string => {
    const days = dayjs(phaseOutAt).diff(dayjs(), 'day')
    const date = dayjs(phaseOutAt).format('MMM D')
    return `${days} days remaining · decommissions ${date}`
}
```

### SideNav.tsx — Domains nav item insertion (after Listing Groups)
```tsx
// Source: VERIFIED from SideNav.tsx lines 224-232 (after Listing Groups NavButton)
// Import Globe from lucide-react (add to existing import)
<NavButton
    label="Domains"
    icon={<Globe className="h-4 w-4" />}
    path="/admin/domains"
    onNavigate={handleNavigate}
/>
```

### PortalAdminSideNav.tsx — items array addition
```ts
// Source: VERIFIED from PortalAdminSideNav.tsx items array (after Groups entry)
// Import Globe from lucide-react (add to existing import)
{ label: 'Domains', icon: Globe, path: '/admin/domains' },
```

### admin.tsx — Route addition
```ts
// Source: VERIFIED from admin.tsx structure
{
    element: <DomainsAdminBoard />,
    path: 'domains'
}
```

---

## Integration Points (Exact)

| File | Change | Location |
|------|--------|----------|
| `src/router/main.tsx` | Add `PrimaryDomainRedirect` layout route inside `SubdomainOnly` children | Wrap `ProtectedRoute` + `joinBrokerage` as children of new layout route |
| `src/router/admin/admin.tsx` | Add `{ element: <DomainsAdminBoard />, path: 'domains' }` | Inside `children` array of the admin route config |
| `src/components/sidenav/SideNav.tsx` | Add `<NavButton label="Domains" icon={<Globe />} path="/admin/domains" .../>` | Inside `{adminOpen && <div>}` block, after Listing Groups NavButton (line ~232) |
| `src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` | Add `{ label: 'Domains', icon: Globe, path: '/admin/domains' }` to `items` array | After `{ label: 'Groups', ... }` (line ~8) |
| `src/assets/api/admin/domains/fetchDomains.ts` | Remove old `BrokerageDomain` type export; import from `domainType.ts` | Type definition section |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `BrokerageDomain` type with `verified`, `verifiedAt`, `verificationToken` | New schema: `domainType`, `status`, `isPrimary`, `phaseOutAt` | Phase 20 (serializer updated) | Old type in `fetchDomains.ts` is wrong — must be replaced |
| No domain admin page | Full Domains admin page at `/admin/domains` | Phase 21 | New route, both sidebars need nav item |

**Deprecated/outdated:**
- Old `BrokerageDomain` type in `fetchDomains.ts`: fields `verified`, `verifiedAt`, `verificationToken` — backend serializer no longer returns these; they exist only in old frontend type. Replace with new schema.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `PrimaryDomainRedirect` should use `<Outlet />` not `{children}` prop (layout route pattern) | Pattern 6 | Guard mounts but children don't render — routes 404. Fix: switch to layout route. |
| A2 | `lookupDomain.ts` should use base `axios` (not project `api` instance) to avoid auth header injection | Pattern 2, Pitfall 2 | Lookup may fail if backend rejects unexpected headers; on main domain `X-Brokerage-Id` would be injected inappropriately |
| A3 | `editingId` slot state lifted to Subdomains section level (not global context) so only one card edits at a time | Pattern 5 | If lifted too high, edit state resets on any context re-render. If too low (per-card), two cards could edit simultaneously. Section level is the right scope. |
| A4 | `subdomainSlotsBlocked` boolean computed from `domains.filter(...).length >= 2` in context | Pitfall 5 | Incorrect slot block detection would either wrongly disable or wrongly enable Edit buttons |

---

## Open Questions

1. **`useAddCustomDomain` inline form placement**
   - What we know: CONTEXT.md D-05 says "Add domain" button opens inline form below section header (not a modal). UI-SPEC confirms this.
   - What's unclear: Whether the inline add form replaces the "Add domain" button or appears below it.
   - Recommendation: Per UI-SPEC interaction spec ("Button 'Add domain' opens an inline form below the section header"), button disappears when form is open; re-appears on Discard. Implement with local boolean `isAddingCustom` state.

2. **`useRemoveCustomDomain` vs `useDecommissionDomain` — same API call, different hook names**
   - What we know: Both map to `DELETE /v1/admin/domains/:id`. The difference is in the status of the domain: `active custom` → phase out; `phasing_out` → immediate decommission.
   - What's unclear: Whether to use one shared hook or two separate hooks.
   - Recommendation: One shared `useRemoveDomain` hook is simpler. The backend handles the branching. Toast message should differ — "Domain removed." vs "Domain decommissioned." — detect by checking the response `domain.status`.

---

## Environment Availability

Step 2.6: Relevant tooling already available in this project. This is a pure frontend phase with no new external dependencies beyond what's already installed.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node / npm | shadcn accordion install | ✓ | — | — |
| `npx shadcn add accordion` | DUI-07 accordion panel | ✓ (shadcn CLI available, official registry) | shadcn new-york | — |
| dayjs | Countdown date formatting | ✓ | ^1.11.7 | Manual `new Date()` math |

**Missing shadcn component (must be Wave 0):**
- `accordion` — not in `frontend/src/components/ui/`. Install: `npx shadcn add accordion` from `frontend/` directory.

---

## Security Domain

Phase 21 is a pure frontend phase. The backend auth enforcement (owner role requirement on mutations) was implemented in Phase 20 and is not touched here. Frontend-side considerations:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Yes — subdomain slug validation | Client-side: format regex + reserved word list. Server-side validation in Phase 20 backend is the authoritative gate. |
| V4 Access Control | Partial — Pro gate for custom domains | Client-side check `brokerage.plan === 'premium'` is UX only; backend returns 403 if called without premium plan. Do not rely on client check for security. |
| V2 Authentication | No | Guard fires before auth check but fails open; auth is enforced by ProtectedRoute for protected content |

**Key:** The redirect guard (DINT-01) is explicitly a UX mechanism, not a security boundary. The backend's `BrokerageAuth` resolves brokerage from domain on every request, making the guard purely an ergonomic improvement.

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/router/main.tsx` — exact SubdomainOnly block structure verified
- `frontend/src/components/common/guards/DomainGuard.tsx` — guard pattern verified
- `frontend/src/helpers/domain.ts` — `isMainDomain()` implementation verified
- `frontend/src/assets/api/admin/domains/fetchDomains.ts` — old type confirmed (needs replacement)
- `frontend/src/store/hooks/Admin/Domains/useFetchDomains.ts` — hook pattern and `domainsKeys` verified
- `frontend/src/store/hooks/Admin/Users/useCreateAdminUser.tsx` — mutation hook pattern verified
- `frontend/src/store/hooks/Admin/Domains/useVerifyDomain.ts` — mutation hook with invalidate pattern
- `frontend/src/components/sidenav/SideNav.tsx` — exact NavButton pattern and insertion point verified
- `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` — items array pattern verified
- `frontend/src/router/admin/admin.tsx` — route config structure verified
- `frontend/src/components/createBrokerage/SubdomainInput.tsx` — slug input component verified
- `backend/app/models/brokerage_domain.rb` — RESERVED_SLUGS list verified
- `backend/app/serializers/brokerage_domain_serializer.rb` — exact field names verified
- `backend/app/controllers/v1/admin/domains_controller.rb` — mutation payload shape and slot logic verified
- `backend/app/controllers/v1/domains_controller.rb` — lookup endpoint response shape verified
- `frontend/src/assets/axios/axios.ts` — auth interceptor confirmed (reason for plain axios in lookupDomain)
- `frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoard.tsx` — container pattern
- `frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts` — context/brain pattern
- `frontend/src/components/ui/` directory listing — confirms accordion NOT installed, AlertDialog IS installed
- `frontend/package.json` — all dependency versions confirmed
- `frontend/components.json` — shadcn new-york style, zinc base color, cssVariables confirmed
- `.planning/phases/21-frontend-redirect-guard-and-domains-admin/21-CONTEXT.md` — all locked decisions
- `.planning/phases/21-frontend-redirect-guard-and-domains-admin/21-UI-SPEC.md` — component inventory and interaction states

### Tertiary (LOW confidence — assumptions)
- Layout route pattern for `PrimaryDomainRedirect` (A1) — derived from React Router v6 behavior, not a specific project file

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified from package.json and component files
- Architecture: HIGH — all integration points traced to actual source files with line references
- Backend API contract: HIGH — read directly from controller and serializer source
- Pitfalls: HIGH for P1-P4 (verified from code), MEDIUM for P5-P7 (derived from patterns)
- Assumptions: LOW — 4 assumptions logged, all mitigatable

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (stable stack; assumptions should be confirmed during planning)
