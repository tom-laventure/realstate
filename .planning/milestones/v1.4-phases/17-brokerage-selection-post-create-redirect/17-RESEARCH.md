# Phase 17: Brokerage Selection & Post-Create Redirect — Research

**Researched:** 2026-05-25
**Domain:** React Router v6, Redux Toolkit slices, post-wizard redirect, brokerage selection UI
**Confidence:** HIGH — all claims verified against codebase source files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** New Redux slice (`activeBrokerage` or similar) — matches `createBrokerageWizard` and `tempBrokerage` slice pattern.
- **D-02:** Slice stores full `AdminBrokerage` object `{ id, name, role }` — not just the ID.
- **D-03:** Slice also stores `adminBrokerages: AdminBrokerage[]` list. `LoginSuccessful` dispatches the list after fetching; selection screen reads from Redux (no second API call).
- **D-04:** `/dashboard` (index route) = brokerage selection screen.
- **D-05:** `/dashboard/:brokerageId` = portal shell — Phase 18 builds content here. Phase 17 creates a minimal shell placeholder.
- **D-06:** Portal shell reads `:brokerageId` from URL params on mount and dispatches to Redux as the active brokerage.
- **D-07:** `BrokerageSelection` handles the single-brokerage auto-redirect check on mount — not a route guard. If `adminBrokerages.length === 1`, dispatch `setActiveBrokerage` and navigate to `/dashboard/:id`; if `> 1`, render cards.
- **D-08:** Card design: centered column layout (max-w-sm), cards stacked vertically. Each card: brokerage name + role badge. Click anywhere on card navigates to `/dashboard/:id`. Raw `div` card pattern — NOT shadcn `<Card>`.
- **D-09:** Page heading: "Select a brokerage" with subtitle "Choose the brokerage you want to manage."
- **D-10:** Raw `div` card pattern consistent with Phase 16 portal pages per UI-SPEC.md contract.
- **D-11:** `SuccessStep` redirects to `https://{VITE_MAIN_DOMAIN}/dashboard/{newBrokerageId}` — brokerage ID from `state.result` in `CreateBrokerageContext`.
- **D-12:** Portal shell validates `:brokerageId` against `adminBrokerages[]` in Redux on mount. If not found, redirect to `/dashboard`.
- **D-13:** If `adminBrokerages` empty in Redux on portal shell mount, fetch via `fetchAdminBrokerages`, show loading spinner. On resolve: validate and dispatch. On error: redirect to `/dashboard`.

### Claude's Discretion

None declared — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

None declared.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BROK-01 | User can see a card per brokerage they admin (with brokerage name and role) on the brokerage selection screen | `BrokerageSelection` component reads `adminBrokerages[]` from Redux (D-03); renders one `<button>` card per entry; `AdminBrokerage` type provides `{ id, name, role }` |
| BROK-02 | User admining exactly one brokerage bypasses the selection screen and lands directly on the dashboard | `BrokerageSelection` on-mount check: `adminBrokerages.length === 1` → dispatch + `navigate('/dashboard/:id', { replace: true })` (D-07) |
| ONB-04 | User completing the brokerage creation wizard is redirected to the main domain dashboard with the newly created brokerage auto-selected | `SuccessStep` "Go to dashboard" button target changes from `https://${subdomain}` to `https://${VITE_MAIN_DOMAIN}/dashboard/${brokerageId}` (D-11); brokerage ID is in `state.result.brokerage.id` |

</phase_requirements>

---

## Summary

Phase 17 is a pure frontend phase with three logical workstreams: (1) create the `activeBrokerage` Redux slice and wire it into the root store and `renderWithProviders` test helper; (2) implement `BrokerageSelection` and `PortalShell` components and expand the portal route in `router/portal/portal.tsx`; and (3) modify two existing components — `LoginSuccessful` (dispatch list to Redux) and `SuccessStep` (change redirect target).

All implementation decisions are locked in CONTEXT.md with exact component contracts in UI-SPEC.md. The codebase has clear, consistent patterns to follow — the Redux slice, route registration, and card layout patterns are all directly readable from existing files. No new libraries are needed; all dependencies are installed. The only gotcha is that `SuccessStep` currently references `VITE_APP_BASE_DOMAIN` (not in `.env` or `.env.example`) — this must be updated to use `VITE_MAIN_DOMAIN` for the new redirect.

**Primary recommendation:** Build in 3 tasks matching the 3 workstreams. Start with the Redux slice (foundation for everything else), then routing + new components, then the two existing-component modifications.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Brokerage selection screen | Frontend Client (React) | Redux Store | Component reads from Redux; no API call needed (D-03) |
| Single-brokerage auto-redirect | Frontend Client (React) | — | Pure client-side navigate() call on mount |
| Active brokerage state | Redux Store | — | Slice persists across navigation; Phase 18 reads it for nav bar display |
| Admin brokerages list state | Redux Store | — | LoginSuccessful populates once; BrokerageSelection reads; PortalShell may re-fetch |
| Post-wizard redirect | Frontend Client (React) | — | window.location.href to VITE_MAIN_DOMAIN/dashboard/:id from SuccessStep |
| Portal shell validation | Frontend Client (React) | Redux Store + API | Reads Redux; falls back to API fetch if empty |
| Route registration | Router (react-router-dom) | — | Add `/dashboard/:brokerageId` child route to portal.tsx |

---

## Standard Stack

All dependencies are already installed. No new packages required.

### Core (all already in package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@reduxjs/toolkit` | ^1.9.1 | Redux slice creation | Already used for `createBrokerageWizard` and `tempBrokerage` slices |
| `react-redux` | ^8.0.5 | `useDispatch`, `useSelector` typed hooks | Already used via `useAppDispatch` / `useAppSelector` |
| `react-router-dom` | ^6.4.3 | `useNavigate`, `useParams`, route objects | Already used throughout router |
| `lucide-react` | ^0.555.0 | Icons (spinner, etc.) | Project standard for all icons |

[VERIFIED: /home/tomlaventure/projects/realstate/frontend/package.json]

### No New Packages Needed

All required capabilities (Redux Toolkit slices, React Router navigation, Tailwind styling) are already available. No `npm install` step required for this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
Sign-in flow:
  LoginSuccessful
    → fetchAdminBrokerages() API call
    → dispatch setAdminBrokerages(list)     ← NEW in Phase 17
    → navigate('/dashboard', { replace })

  BrokerageSelection (at /dashboard)        ← NEW component
    → reads adminBrokerages[] from Redux
    → if length === 1: dispatch setActiveBrokerage + navigate('/dashboard/:id', replace)
    → if length > 1: render card buttons

  Card click → dispatch setActiveBrokerage + navigate('/dashboard/:id')

Wizard flow:
  SuccessStep (at /create/success)
    → "Go to dashboard" button
    → window.location.href = https://${VITE_MAIN_DOMAIN}/dashboard/${brokerageId}  ← CHANGED

Direct URL entry:
  PortalShell (at /dashboard/:brokerageId)  ← NEW component
    → reads adminBrokerages[] from Redux
    → if non-empty: find match by :brokerageId → dispatch setActiveBrokerage (or redirect)
    → if empty: fetchAdminBrokerages() → show spinner → validate → dispatch (or redirect)
```

### Redux Slice Pattern

Follow `tempBrokerage.tsx` exactly — it is the simpler of the two existing slices:

```typescript
// src/store/reducers/activeBrokerage.ts
// [VERIFIED: pattern from /home/tomlaventure/projects/realstate/frontend/src/store/reducers/tempBrokerage.tsx]
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { AdminBrokerage } from '@/assets/types/adminBrokerageType'

export interface ActiveBrokerageState {
    activeBrokerage: AdminBrokerage | null
    adminBrokerages: AdminBrokerage[]
}

const initialState: ActiveBrokerageState = {
    activeBrokerage: null,
    adminBrokerages: [],
}

const activeBrokerageSlice = createSlice({
    name: 'activeBrokerage',
    initialState,
    reducers: {
        setActiveBrokerage: (state, action: PayloadAction<AdminBrokerage>) => {
            state.activeBrokerage = action.payload
        },
        setAdminBrokerages: (state, action: PayloadAction<AdminBrokerage[]>) => {
            state.adminBrokerages = action.payload
        },
        clearActiveBrokerage: (state) => {
            state.activeBrokerage = null
            state.adminBrokerages = []
        },
    },
})

export const { setActiveBrokerage, setAdminBrokerages, clearActiveBrokerage } = activeBrokerageSlice.actions
export default activeBrokerageSlice.reducer
```

### Root Store Registration

Add the reducer to the `reducer` map in `index.tsx`:

```typescript
// [VERIFIED: pattern from /home/tomlaventure/projects/realstate/frontend/src/store/reducers/index.tsx]
import activeBrokerageReducer from './activeBrokerage'

const reducer = {
    account: accountReducer,
    createBrokerageWizard: createBrokerageWizardReducer,
    tempBrokerage: tempBrokerageReducer,
    activeBrokerage: activeBrokerageReducer,   // NEW
}
```

### renderWithProviders Update (Required for Tests)

`renderWithProviders.tsx` manually enumerates reducers — it must be updated alongside the root store or tests that render components using the `activeBrokerage` slice will fail with unknown state shape:

```typescript
// [VERIFIED: /home/tomlaventure/projects/realstate/frontend/src/test/renderWithProviders.tsx]
// Add to existing reducer map inside renderWithProviders:
activeBrokerage: activeBrokerageReducer,
```

### Route Registration Pattern

The portal route object is exported from `router/portal/portal.tsx` and imported by `main.tsx`. Add `:brokerageId` as a child route:

```typescript
// [VERIFIED: pattern from /home/tomlaventure/projects/realstate/frontend/src/router/portal/portal.tsx]
import PortalShell from '@/containers/portal/PortalShell'

export const portalDashboard = {
    path: '/dashboard',
    element: <ProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
        { index: true, element: <BrokerageSelection /> },        // replaces DashboardPlaceholder
        { path: ':brokerageId', element: <PortalShell /> },      // NEW
        { path: '*', element: <BrokerageSelection /> },           // catch-all stays
    ]
}
```

The `path: '*'` catch-all currently renders `DashboardPlaceholder` — it should render `BrokerageSelection` after the swap, since any unmatched path under `/dashboard/` that is not `/:brokerageId` should show selection.

### BrokerageSelection Component Pattern

```tsx
// [VERIFIED: D-07, D-08 from 17-CONTEXT.md + UI-SPEC.md card pattern]
// src/containers/portal/BrokerageSelection.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/store/hooks/useDispatch'
import { setActiveBrokerage } from '@/store/reducers/activeBrokerage'

const BrokerageSelection = () => {
    const navigate = useNavigate()
    const dispatch = useAppDispatch()
    const adminBrokerages = useAppSelector((s) => s.activeBrokerage.adminBrokerages)

    useEffect(() => {
        if (adminBrokerages.length === 1) {
            dispatch(setActiveBrokerage(adminBrokerages[0]))
            navigate(`/dashboard/${adminBrokerages[0].id}`, { replace: true })
        }
    }, [adminBrokerages, dispatch, navigate])

    if (adminBrokerages.length === 1) return null  // avoid flash during redirect

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6 w-full">
            <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <div>
                    <div className="text-lg font-semibold text-foreground">Select a brokerage</div>
                    <div className="text-sm text-muted-foreground">Choose the brokerage you want to manage.</div>
                </div>
                <div className="flex flex-col gap-3 w-full">
                    {adminBrokerages.map((brokerage) => (
                        <button
                            key={brokerage.id}
                            className="w-full rounded-xl border border-border bg-card px-5 py-4 text-left shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
                            onClick={() => {
                                dispatch(setActiveBrokerage(brokerage))
                                navigate(`/dashboard/${brokerage.id}`)
                            }}
                        >
                            <div className="text-lg font-semibold text-foreground">{brokerage.name}</div>
                            <div className="mt-1">
                                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
                                    {brokerage.role}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
```

### PortalShell Component Pattern

```tsx
// [VERIFIED: D-06, D-12, D-13 from 17-CONTEXT.md + UI-SPEC.md screen contracts]
// src/containers/portal/PortalShell.tsx
// Key behaviors:
// 1. Read :brokerageId from useParams()
// 2. Read adminBrokerages from Redux
// 3. If non-empty: find match → dispatch setActiveBrokerage or redirect to /dashboard
// 4. If empty: fetchAdminBrokerages() → show spinner → validate → dispatch or redirect
```

### LoginSuccessful Modification Pattern

```tsx
// [VERIFIED: /home/tomlaventure/projects/realstate/frontend/src/containers/auth/LoginSuccessful.tsx]
// Add import:
import { useAppDispatch } from '@/store/hooks/useDispatch'
import { setAdminBrokerages } from '@/store/reducers/activeBrokerage'

// Inside component:
const dispatch = useAppDispatch()

// Inside the fetchAdminBrokerages().then() block, BEFORE navigate:
dispatch(setAdminBrokerages(data.adminBrokerages))
navigate('/dashboard', { replace: true })
```

### SuccessStep Modification Pattern

```tsx
// [VERIFIED: /home/tomlaventure/projects/realstate/frontend/src/containers/createBrokerage/steps/SuccessStep.tsx]
// Current (line 9): const BASE_DOMAIN = import.meta.env.VITE_APP_BASE_DOMAIN || 'realstate.ca'
// CRITICAL: VITE_APP_BASE_DOMAIN is NOT defined in .env or .env.example — only VITE_MAIN_DOMAIN is.
// The existing BASE_DOMAIN is used ONLY for isSafeRedirectHost (subdomain validation).
// The new redirect should use VITE_MAIN_DOMAIN explicitly:

const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'realstate.ca'
const brokerageId = state.result?.brokerage?.id

// New CTA redirect (replace the subdomain-only button):
<Button
    className="w-full"
    onClick={() => {
        if (MAIN_DOMAIN && brokerageId) {
            window.location.href = `https://${MAIN_DOMAIN}/dashboard/${brokerageId}`
        }
    }}
>
    Go to dashboard
</Button>
```

### AdminBrokerage Type (existing — no changes needed)

```typescript
// [VERIFIED: /home/tomlaventure/projects/realstate/frontend/src/assets/types/adminBrokerageType.ts]
import UserRole from './roleType'

export interface AdminBrokerage {
    id: string
    name: string
    role: UserRole
}

// UserRole = 'owner' | 'admin' | 'agent' | 'staff' | 'client'
// [VERIFIED: /home/tomlaventure/projects/realstate/frontend/src/assets/types/roleType.ts]
```

### Recommended Project Structure (new files only)

```
frontend/src/
├── store/
│   └── reducers/
│       └── activeBrokerage.ts      # NEW — Redux slice
├── containers/
│   └── portal/
│       ├── BrokerageSelection.tsx  # NEW — replaces DashboardPlaceholder at /dashboard index
│       └── PortalShell.tsx         # NEW — /dashboard/:brokerageId placeholder
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Typed Redux dispatch / selector | Custom hooks | `useAppDispatch` / `useAppSelector` from `store/hooks/useDispatch.ts` | Already typed to `AppDispatch` and `RootState` |
| Admin brokerages API call | Inline fetch | `fetchAdminBrokerages` from `assets/api/account/fetchAdminBrokerages.ts` | Already built in Phase 16; camelcaseKeys handled by Axios interceptor |
| Domain safety check | Custom validation | `VITE_MAIN_DOMAIN` env var directly | `isSafeRedirectHost` in SuccessStep was for subdomain validation against `VITE_APP_BASE_DOMAIN` — the new redirect to MAIN_DOMAIN doesn't need the same guard since VITE_MAIN_DOMAIN is a single known domain, not a pattern |

**Key insight:** All API, typing, and state infrastructure is already in place from Phases 15 and 16. This phase is pure composition.

---

## Common Pitfalls

### Pitfall 1: VITE_APP_BASE_DOMAIN vs VITE_MAIN_DOMAIN in SuccessStep

**What goes wrong:** `SuccessStep.tsx` currently reads `import.meta.env.VITE_APP_BASE_DOMAIN` (line 9). This env var is **not defined** in `.env` or `.env.example` — only `VITE_MAIN_DOMAIN` exists. The variable defaults to `'realstate.ca'` via the `||` fallback, which is why it works in production but would be wrong for local dev if MAIN_DOMAIN is `localhost`.

**Why it happens:** `VITE_APP_BASE_DOMAIN` was used for `isSafeRedirectHost()` to validate subdomain patterns. The new redirect target is the main domain — a single known value, not a pattern.

**How to avoid:** Use `import.meta.env.VITE_MAIN_DOMAIN` directly for the new "Go to dashboard" redirect. Keep the existing `BASE_DOMAIN`/`isSafeRedirectHost` logic intact for any remaining subdomain redirect buttons (custom domain + subdomain buttons) to avoid regressions.

[VERIFIED: .env, .env.example, SuccessStep.tsx line 9]

### Pitfall 2: renderWithProviders Not Updated with New Slice

**What goes wrong:** Tests for `BrokerageSelection` or `PortalShell` that call `renderWithProviders` will fail if `activeBrokerage` is not in the test store — Redux throws "No reducer provided for key activeBrokerage" or the selector returns `undefined`.

**Why it happens:** `renderWithProviders.tsx` manually lists reducers; it is not imported from the root store — it must be kept in sync.

**How to avoid:** Update `renderWithProviders.tsx` to include `activeBrokerageReducer` alongside the root store change. The `preloadedState` parameter already supports `activeBrokerage` initialization once the reducer is registered.

[VERIFIED: /home/tomlaventure/projects/realstate/frontend/src/test/renderWithProviders.tsx]

### Pitfall 3: Auto-Redirect Flash on BrokerageSelection

**What goes wrong:** When `adminBrokerages.length === 1`, the component renders briefly before `useEffect` fires and calls `navigate()`. On slow clients or high-rerender scenarios, the user may see the selection screen flash before being redirected.

**Why it happens:** React renders before `useEffect` runs.

**How to avoid:** Add an early `if (adminBrokerages.length === 1) return null` before the JSX return — the component returns nothing while the redirect is pending. The UI-SPEC.md screen contract explicitly calls for this: "Nothing rendered — immediate navigate."

[VERIFIED: 17-UI-SPEC.md Interaction 2]

### Pitfall 4: Portal Route catch-all Renders Wrong Component

**What goes wrong:** The existing portal route has `{ path: '*', element: <DashboardPlaceholder /> }` — if left as-is after adding `:brokerageId`, paths like `/dashboard/some-uuid` that don't match the named route would fall through to `DashboardPlaceholder` instead of `PortalShell`.

**Why it happens:** In React Router v6, named dynamic segments (`path: ':brokerageId'`) take priority over catch-alls, so `/dashboard/some-uuid` DOES match `:brokerageId` correctly. The `*` catch-all only matches paths like `/dashboard/a/b/c` (multiple segments). The concern is replacing `DashboardPlaceholder` with `BrokerageSelection` in the catch-all.

**How to avoid:** Update the catch-all to render `BrokerageSelection` (consistent with the index route) so any unrecognized sub-path still lands on the selection screen rather than the old placeholder.

[VERIFIED: router/portal/portal.tsx current structure]

### Pitfall 5: PortalShell — `adminBrokerages` Empty Race Condition

**What goes wrong:** If the user navigates directly to `/dashboard/:brokerageId` (wizard redirect, bookmark, or back-nav after Redux is cleared), `adminBrokerages` in Redux is empty. Without the D-13 fetch-on-empty logic, the portal shell immediately redirects to `/dashboard` — the wizard user who just created a brokerage never lands on the shell.

**Why it happens:** `LoginSuccessful` populates `adminBrokerages` in Redux, but the wizard redirect (`SuccessStep`) uses `window.location.href` which causes a full page reload, clearing Redux state.

**How to avoid:** Implement D-13 exactly: check `adminBrokerages.length === 0` on mount → fetch → validate → dispatch. Show the loading spinner during fetch. This is the only async path in `PortalShell`.

[VERIFIED: D-13 in 17-CONTEXT.md; window.location.href confirmed in SuccessStep.tsx]

### Pitfall 6: SuccessStep — brokerageId Type Safety

**What goes wrong:** `CreateBrokerageResponse.brokerage.id` is typed as `string | number` (see `createBrokerage.ts` line 22). Interpolating it into a URL with `${brokerageId}` works in JavaScript but TypeScript may warn, and a `number` ID would render as a numeric string in the URL.

**Why it happens:** The API response type allows both string and number for `id`.

**How to avoid:** Use `String(state.result?.brokerage?.id)` for the URL interpolation, or add a null check before the redirect. The planner should include a TypeScript safety note in the task.

[VERIFIED: /home/tomlaventure/projects/realstate/frontend/src/assets/api/onboarding/createBrokerage.ts line 22]

---

## Code Examples

### Verified: Using useParams in React Router v6

```tsx
// [CITED: React Router v6 pattern — useParams hook]
import { useParams } from 'react-router-dom'

const PortalShell = () => {
    const { brokerageId } = useParams<{ brokerageId: string }>()
    // brokerageId is string | undefined when route is optional; string when required
}
```

### Verified: useFetchAdminBrokerages imperative pattern (Phase 16 output)

```typescript
// [VERIFIED: /home/tomlaventure/projects/realstate/frontend/src/store/hooks/Account/useFetchAdminBrokerages.ts]
// This hook returns the module-level fetchAdminBrokerages function directly.
// It is an imperative fire-once hook — NOT a useQuery wrapper.
// Call it at component top level; invoke the returned function inside useEffect.
const fetchAdminBrokerages = useFetchAdminBrokerages()

useEffect(() => {
    fetchAdminBrokerages().then((data) => { ... }).catch(() => { ... })
}, []) // empty deps — stable reference
```

### Verified: Navigate with replace to avoid history pollution

```tsx
// [VERIFIED: LoginSuccessful.tsx — established pattern in this codebase]
navigate('/dashboard', { replace: true })
// Use replace:true for redirects caused by auth/routing decisions
// so Back button doesn't re-trigger the redirect
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DashboardPlaceholder at /dashboard index | BrokerageSelection component | Phase 17 | The placeholder is replaced; import references in portal.tsx must update |
| SuccessStep redirects to https://${subdomain} | Redirects to https://${VITE_MAIN_DOMAIN}/dashboard/${id} | Phase 17 | Post-wizard flow lands on portal instead of brokerage subdomain |
| LoginSuccessful navigates only | LoginSuccessful dispatches list before navigating | Phase 17 | Redux has adminBrokerages when BrokerageSelection mounts from sign-in flow |

---

## Open Questions

1. **`VITE_APP_BASE_DOMAIN` — keep or remove?**
   - What we know: It is used in `SuccessStep` for `isSafeRedirectHost()` with a hardcoded fallback `'realstate.ca'`. It is not in `.env` or `.env.example`.
   - What's unclear: Should the planner remove `VITE_APP_BASE_DOMAIN` references entirely and replace with `VITE_MAIN_DOMAIN`, or keep the existing guard for the non-primary CTA buttons (custom domain / subdomain redirect)?
   - Recommendation: Keep `BASE_DOMAIN`/`isSafeRedirectHost` for the secondary CTA buttons (custom domain + subdomain). Only the primary "Go to dashboard" CTA changes to use `VITE_MAIN_DOMAIN`. This is the smallest safe change.

2. **PortalShell useEffect dependency array**
   - What we know: `fetchAdminBrokerages` is a module-level stable function (per decision 16-01-A in STATE.md). Empty deps `[]` is correct.
   - What's unclear: If `brokerageId` from `useParams` changes (client-side navigation to a different `:brokerageId`), the effect should re-run.
   - Recommendation: Include `brokerageId` in the PortalShell useEffect deps array so re-validation triggers on route param change. The fetch only runs when `adminBrokerages` is empty, so the dep on a stable function is not needed.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 17 is pure frontend code/component changes with no external service dependencies beyond the already-running backend.

The only env var referenced by new code is `VITE_MAIN_DOMAIN`, which is present in `.env` (value: `localhost` for local dev) and `.env.example`.

[VERIFIED: /home/tomlaventure/projects/realstate/frontend/.env]

---

## Validation Architecture

nyquist_validation is explicitly `false` in `.planning/config.json` — this section is skipped.

[VERIFIED: /home/tomlaventure/projects/realstate/.planning/config.json]

**Current test suite status:** 13/15 tests pass. 2 pre-existing failures in `GoogleSignInButton.test.tsx` are unrelated to Phase 17 and existed before this phase.

---

## Security Domain

Phase 17 has no new auth boundaries, API endpoints, or data persistence. The existing `ProtectedRoute` guard on the `/dashboard` tree (established in Phase 16) covers unauthenticated access. No ASVS categories are newly applicable — `SuccessStep` uses `window.location.href` with a domain check against a known env var, which is sufficient for a client-side routing signal.

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies to Phase 17 |
|-----------|---------------------|
| Icons: `lucide-react` only | Yes — spinner in PortalShell uses lucide or Tailwind CSS animation (no icon needed for spinner) |
| Styling: Tailwind CSS utility classes only | Yes — all new classes from UI-SPEC.md are Tailwind utilities |
| Never call axios or API functions directly inside a component — always go through a hook | Yes — PortalShell uses `useFetchAdminBrokerages` hook |
| Define domain interfaces in `assets/types/` before creating hooks or contexts | No new types needed — `AdminBrokerage` already defined |
| Use `@` alias for all frontend imports | Yes — all imports use `@/` prefix |
| `useState(() => searchParams.get(...))` is one-shot — use useEffect with isHydratedFromUrl guard | Not applicable — no URL search params in this phase (`:brokerageId` is a path param, not a query param) |
| Raw `div` card pattern (not shadcn Card) for portal pages | Yes — confirmed by D-10 and UI-SPEC.md |
| Never blindly cast URL strings to union types | Applicable to `useParams<{ brokerageId: string }>()` — the brokerageId is validated against Redux list, not cast to a typed ID without check |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `{ path: '*', element: <DashboardPlaceholder /> }` catch-all in portal.tsx should become `BrokerageSelection` after the swap | Architecture Patterns — Route Registration | If left as DashboardPlaceholder, deep-link paths under /dashboard that don't match :brokerageId will show the old placeholder instead of the selection screen |

All other claims in this research were directly verified from source files.

---

## Sources

### Primary (HIGH confidence — verified from codebase)
- `/home/tomlaventure/projects/realstate/frontend/src/store/reducers/createBrokerageWizard.ts` — Redux slice pattern
- `/home/tomlaventure/projects/realstate/frontend/src/store/reducers/tempBrokerage.tsx` — Redux slice pattern (simpler reference)
- `/home/tomlaventure/projects/realstate/frontend/src/store/reducers/index.tsx` — Root store registration pattern
- `/home/tomlaventure/projects/realstate/frontend/src/router/portal/portal.tsx` — Portal route structure to extend
- `/home/tomlaventure/projects/realstate/frontend/src/router/main.tsx` — How domain guards and portal routes compose
- `/home/tomlaventure/projects/realstate/frontend/src/containers/auth/LoginSuccessful.tsx` — Existing dispatch + navigate pattern to extend
- `/home/tomlaventure/projects/realstate/frontend/src/containers/createBrokerage/steps/SuccessStep.tsx` — Redirect logic to modify; VITE_APP_BASE_DOMAIN vs VITE_MAIN_DOMAIN finding
- `/home/tomlaventure/projects/realstate/frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx` — `state.result.brokerage.id` shape
- `/home/tomlaventure/projects/realstate/frontend/src/assets/api/onboarding/createBrokerage.ts` — `brokerage.id` typed as `string | number`
- `/home/tomlaventure/projects/realstate/frontend/src/assets/api/account/fetchAdminBrokerages.ts` — API module for imperative fetch
- `/home/tomlaventure/projects/realstate/frontend/src/store/hooks/Account/useFetchAdminBrokerages.ts` — Hook pattern (stable module-level fn reference)
- `/home/tomlaventure/projects/realstate/frontend/src/assets/types/adminBrokerageType.ts` — `AdminBrokerage` interface
- `/home/tomlaventure/projects/realstate/frontend/src/assets/types/roleType.ts` — `UserRole` union type
- `/home/tomlaventure/projects/realstate/frontend/src/test/renderWithProviders.tsx` — Test helper requiring update
- `/home/tomlaventure/projects/realstate/frontend/.env` — Confirmed `VITE_MAIN_DOMAIN=localhost`; no `VITE_APP_BASE_DOMAIN`
- `/home/tomlaventure/projects/realstate/frontend/.env.example` — Confirmed `VITE_MAIN_DOMAIN` is the canonical env var
- `/home/tomlaventure/projects/realstate/.planning/phases/17-brokerage-selection-post-create-redirect/17-CONTEXT.md` — All locked decisions D-01 through D-13
- `/home/tomlaventure/projects/realstate/.planning/phases/17-brokerage-selection-post-create-redirect/17-UI-SPEC.md` — Exact Tailwind classes, component inventory, screen contracts
- `/home/tomlaventure/projects/realstate/.planning/config.json` — nyquist_validation: false confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json
- Architecture: HIGH — all patterns verified from existing source files
- Pitfalls: HIGH — all verified from exact file contents (esp. VITE_APP_BASE_DOMAIN finding)
- Route structure: HIGH — verified from router/portal/portal.tsx and main.tsx

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (stable — no external dependencies; all findings are codebase-internal)
