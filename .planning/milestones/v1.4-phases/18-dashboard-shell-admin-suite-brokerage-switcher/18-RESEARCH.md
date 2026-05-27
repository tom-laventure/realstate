# Phase 18: Dashboard Shell, Admin Suite & Brokerage Switcher — Research

**Researched:** 2026-05-26
**Domain:** React / React Router / Redux / Axios interceptors — pure frontend phase
**Confidence:** HIGH (all findings verified by direct codebase inspection)

---

## Summary

Phase 18 is a pure frontend phase with four concrete deliverables: (1) replace the `PortalShell` placeholder with a real landing page, (2) create a new `PortalNavBar` component with a brokerage switcher, (3) register the `/admin/` route tree on the main domain, and (4) inject `X-Brokerage-Id` into the Axios request interceptor scoped to `/v1/admin/**` on the main domain.

All implementation decisions are locked in CONTEXT.md. No library additions are needed — every required shadcn component (`DropdownMenu`, `Button`) and every Lucide icon (`Building2`, `Users`, `Layers`, `Settings`, `Check`, `ChevronDown`) is already installed. The Redux slice shape, sign-out flow, and portal card visual language are all established from previous phases.

**Primary recommendation:** This phase is three surgical edits to existing files plus one new file. The implementation is low-risk but has one significant pitfall: `AppShellAdmin` uses `RequireRole` which reads `account.membership?.role` — this will be `null` on the main domain because `/v1/user` is a subdomain endpoint. The `RequireRole` guard will redirect to `/` instead of rendering admin panel content. The plan must address this before linking to `/admin/*` from `PortalShell`.

**Primary recommendation:** Implement in order: (1) Axios interceptor, (2) main router admin registration with `RequireRole` bypass strategy, (3) `PortalNavBar` new component, (4) `PortalShell` resolved-state replacement.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**X-Brokerage-Id Header Injection:**
- D-01: Modify the existing `axios.ts` request interceptor. When `isMainDomain()` is true AND the request URL contains `/v1/admin/`, read `activeBrokerage.id` from `store.getState()` and add the `X-Brokerage-Id` header.
- D-02: Header scope is surgical — only `/v1/admin/**` routes on the main domain. Not all requests.
- D-03: If `activeBrokerage` is `null` when the interceptor runs, skip the header silently. The backend returns 400, which surfaces as an error in the UI. No blocking logic.
- D-04: Access the Redux store directly via `store.getState()` — the interceptor is outside the React component tree and cannot use `useSelector`.

**Admin Panels Strategy:**
- D-05: Register the full existing `/admin/` route tree on the main domain router (alongside `/dashboard/*`). No new portal-specific admin panel components needed.
- D-06: `PortalShell` dashboard card links navigate to `/admin/brokerage`, `/admin/users`, `/admin/groups`, `/admin/settings`. Existing `AppShellAdmin` handles the layout when users drill into admin sub-pages.
- D-07: The brokerage switcher is only visible on the `/dashboard/:brokerageId` portal landing page. When the user is on `/admin/*`, `AppShellAdmin` nav is active. This is acceptable for Phase 18.

**Portal Shell Layout:**
- D-08: `PortalShell` is replaced with a real landing page: `PortalNavBar` at the top + a centered dashboard card with 4 section links.
- D-09: Layout follows the centered column pattern from `BrokerageSelection` and `LoginSuccessful` — `max-w-lg`, centered, raw `div` card (not shadcn `Card`), consistent with portal conventions.

**Portal Nav Bar:**
- D-10: New `PortalNavBar` component (not extending existing `NavBar`). No notifications.
- D-11: Nav bar content: left side — brokerage name as a `DropdownMenuTrigger` (the switcher); right side — role badge + sign-out button.
- D-12: `PortalNavBar` reads `activeBrokerage` from Redux (`useAppSelector`). If `activeBrokerage` is null, it renders nothing.

**Brokerage Switcher:**
- D-13: Brokerage switcher is a `DropdownMenu` in `PortalNavBar`. Options are `adminBrokerages` from Redux.
- D-14: On selection: dispatch `setActiveBrokerage(selected)` then `navigate('/dashboard/:newId')`. PortalShell re-validates the new ID on mount.
- D-15: If user has only one brokerage, switcher dropdown still renders but shows only one option (no special case needed).

### Claude's Discretion

None specified — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

- Persistent portal nav bar on `/admin/*` sub-pages (brokerage switcher visible while drilling into admin panels) — requires wrapping `AppShellAdmin`. Deferred to v1.5.
- Notification access from main domain portal — requires X-Brokerage-Id on notification endpoints. Deferred to future phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PORTAL-02 | User can reach board registrations, user management, group management, and invitations from the main domain dashboard | Addressed by: section link cards in `PortalShell` + `/admin/` route registration in `main.tsx` (D-05/D-06) |
| PORTAL-03 | User can see the active brokerage name and their role displayed in the dashboard nav bar | Addressed by: `PortalNavBar` reads `activeBrokerage.name` and `activeBrokerage.role` from Redux (D-10/D-11/D-12) |
| BROK-03 | User can switch the active brokerage via a dropdown in the nav bar without leaving the current page | Addressed by: `DropdownMenu` switcher in `PortalNavBar` (D-13/D-14) |
| BROK-04 | Switching brokerage via the nav dropdown updates all visible admin panel data to the newly selected brokerage | Addressed by: `dispatch(setActiveBrokerage)` + `navigate('/dashboard/:newId')` + Axios interceptor reading updated Redux state for all `/v1/admin/**` calls (D-01/D-14) |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dashboard landing page UI | Frontend (React component) | — | Pure render of Redux state — no API call at this layer |
| Brokerage context display (name/role) | Frontend (Redux slice) | — | `activeBrokerage` already populated by `PortalShell` mount effect from Phase 17 |
| Brokerage switching | Frontend (Redux + router) | — | Client-side dispatch + navigate; backend doesn't need a switch API call |
| X-Brokerage-Id injection | Frontend (Axios interceptor) | Backend (reads header) | Interceptor is the single injection point; backend reads it to resolve `Current.brokerage` |
| Admin panel rendering on main domain | Frontend (router registration) | Backend (X-Brokerage-Id) | Route tree already exists; registration in `MainDomainOnly` block makes it reachable |
| Sign-out | Frontend (Amplify/session) | Backend (`DELETE /v1/sessions`) | Follows established `signOut.ts` pattern |

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React Router DOM | Already installed | `useNavigate`, `useParams` | Existing |
| Redux Toolkit | Already installed | `store.getState()`, `useAppSelector`, `useAppDispatch` | Existing |
| shadcn/ui `DropdownMenu` | Already installed | Brokerage switcher dropdown | Existing — confirmed in `NavBar.tsx` |
| shadcn/ui `Button` | Already installed | Sign-out + switcher trigger | Existing |
| lucide-react | Already installed | `Building2`, `Users`, `Layers`, `Settings`, `Check`, `ChevronDown` | Existing |
| Axios | Already installed | Request interceptor | Existing — `frontend/src/assets/axios/axios.ts` |

**Installation:** No new packages. Zero `npm install` steps.

[VERIFIED: direct codebase inspection of `frontend/package.json` imports and existing component usage]

---

## Architecture Patterns

### System Architecture Diagram

```
User on main domain (/dashboard/:brokerageId)
         │
         ▼
  MainDomainOnly guard (passes through)
         │
         ▼
  PortalShell (existing Phase 17 mount effect — validates brokerageId, dispatches activeBrokerage)
         │
         ├──► isLoading=true → Loading spinner (unchanged)
         ├──► brokerageId invalid → navigate('/dashboard') (unchanged)
         └──► activeBrokerage set → Resolved state (Phase 18 NEW)
                    │
                    ▼
         ┌─────────────────────────────┐
         │  PortalNavBar (NEW)         │
         │  Redux: activeBrokerage     │
         │  Left: DropdownMenu         │──► dispatch(setActiveBrokerage) + navigate('/dashboard/:newId')
         │  Right: role badge + SignOut│──► signOut() + clearToken() + redirect /auth/login
         └─────────────────────────────┘
         ┌─────────────────────────────┐
         │  <main> content area        │
         │  Heading + 4 section cards  │──► navigate('/admin/brokerage|users|groups|settings')
         └─────────────────────────────┘
                    │
                    ▼ (user clicks section card)
         /admin/* — registered in MainDomainOnly block
                    │
                    ▼
         AppShellAdmin → NavBar (subdomain-style) + SideNav + RequireRole
                    │
                    ▼
         All /v1/admin/** API calls
                    │
                    ▼
         Axios interceptor: isMainDomain() && url.includes('/v1/admin/')
         → reads store.getState().activeBrokerage.activeBrokerage?.id
         → sets X-Brokerage-Id header
                    │
                    ▼
         Backend: resolves Current.brokerage from header (Phase 15 BE-02)
```

### Recommended Project Structure (no new directories)

```
frontend/src/
├── containers/portal/
│   ├── PortalShell.tsx          # MODIFY — replace placeholder return
│   └── PortalNavBar.tsx         # NEW — portal nav bar component
├── assets/axios/
│   └── axios.ts                 # MODIFY — add X-Brokerage-Id injection
└── router/
    └── main.tsx                 # MODIFY — register admin in MainDomainOnly
```

### Pattern 1: Axios Request Interceptor X-Brokerage-Id Injection

**What:** Add a conditional header to an existing request interceptor.
**When to use:** Interceptor runs outside React tree — must read store directly.

```typescript
// Source: verified against frontend/src/assets/axios/axios.ts + frontend/src/store/reducers/index.tsx
import { store } from '@/store/reducers'
import { isMainDomain } from '@/helpers/domain'

api.interceptors.request.use((config) => {
    const token = getToken()
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    // D-01: Inject X-Brokerage-Id for admin calls on main domain only
    if (isMainDomain() && config.url?.includes('/v1/admin/')) {
        const activeBrokerage = store.getState().activeBrokerage.activeBrokerage
        if (activeBrokerage) {
            config.headers['X-Brokerage-Id'] = activeBrokerage.id
        }
    }
    return config
}, (error) => Promise.reject(error))
```

**Note on circular import risk:** `axios.ts` already imports from `@/router/main` (for `router.navigate`). Adding `@/store/reducers` import for `store` should not create a cycle because the store does not import axios. Verify the import chain: `store/reducers/index.tsx` → `store/reducers/*.ts` → no axios import. [VERIFIED: inspected all reducer files]

### Pattern 2: PortalNavBar Sign-Out

**What:** Sign out follows `NoAccess.tsx` pattern exactly — no `useCognitoAuth`, uses `signOut` from `aws-amplify/auth` directly.

```typescript
// Source: verified against frontend/src/containers/portal/NoAccess.tsx
import { signOut } from 'aws-amplify/auth'
import { clearToken } from '@/lib/auth'

const handleSignOut = async () => {
    await signOut({ global: true }).catch(() => null)
    clearToken()
    window.location.href = '/auth/login'
}
```

**Why not `useCognitoAuth`?** `useCognitoAuth` is a hook requiring React context. `NoAccess.tsx` and `NavBarContext.ts` both ultimately call `signOut` and `clearToken()`. The portal nav bar should mirror `NoAccess.tsx` since it's a portal-context component, not a subdomain-shell component.

### Pattern 3: Redux State Read for Brokerage Switching

**What:** `PortalNavBar` reads both `activeBrokerage` and `adminBrokerages` from the same Redux slice.

```typescript
// Source: verified against frontend/src/store/reducers/activeBrokerage.ts
const activeBrokerage = useAppSelector((s) => s.activeBrokerage.activeBrokerage)
const adminBrokerages = useAppSelector((s) => s.activeBrokerage.adminBrokerages)
```

**Slice shape confirmed:**
```typescript
// State shape: ActiveBrokerageState
{
    activeBrokerage: AdminBrokerage | null,  // { id: string, name: string, role: UserRole }
    adminBrokerages: AdminBrokerage[]
}
```

### Pattern 4: Admin Route Registration on Main Domain

**What:** Add the `admin` route object inside the `MainDomainOnly` block in `main.tsx`.

```typescript
// Source: verified against frontend/src/router/main.tsx current state
// CURRENT (admin only under SubdomainOnly):
{
    element: <SubdomainOnly />,
    children: [
        { element: <ProtectedRoute />, children: [dashboard, admin, account] },
        joinBrokerage,
    ],
},
{
    element: <MainDomainOnly />,
    children: [createBrokerage, portalDashboard, noAccess],
},

// AFTER PHASE 18 (admin also registered under MainDomainOnly):
{
    element: <MainDomainOnly />,
    children: [createBrokerage, portalDashboard, noAccess, admin],
},
```

The `admin` route object is already imported at line 6 of `main.tsx`. Only the children array changes.

### Anti-Patterns to Avoid

- **Using `<Card>` shadcn component for section cards:** UI-SPEC.md explicitly requires raw `<button>` elements (not shadcn Card). The portal uses a raw div card pattern established across Phases 16–17.
- **Calling `useSelector` inside the Axios interceptor:** The interceptor runs outside the React tree — use `store.getState()` directly (D-04).
- **Adding `isMainDomain()` check inside `PortalNavBar`:** The nav bar is already only rendered by `PortalShell` which lives inside the `MainDomainOnly` route guard. No need for domain checks inside the component.
- **Importing `store` in a way that creates circular dependencies:** `store/reducers/index.tsx` does not import axios or router. The import is safe.
- **Dispatching `setActiveBrokerage` with a new brokerage BEFORE navigating:** D-14 specifies dispatch first, then navigate. `PortalShell`'s mount effect reads `adminBrokerages` from Redux (already populated) and redispatches `activeBrokerage` based on the new URL param. Both operations should happen.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown menu | Custom positioned div | `DropdownMenu` from shadcn | Radix handles focus trap, keyboard nav, and positioning |
| Role display badge | Custom badge component | Inline `<span>` with `bg-muted text-muted-foreground capitalize` | No `Badge` component installed; pattern established in BrokerageSelection.tsx (Phase 17) |
| Sign-out logic | Custom session invalidation | `signOut({ global: true })` from `aws-amplify/auth` + `clearToken()` | Established pattern across NoAccess.tsx — consistent behavior |

---

## Critical Pitfall: RequireRole Blocks Admin Panels on Main Domain

### What Goes Wrong

`AppShellAdmin` wraps its content in `<RequireRole roles={['owner', 'admin']}>`. `RequireRole` reads `account.membership?.role` via `useRole`. The `account` Redux slice is populated by `useGetCurrentUser` → `GET /v1/user` → a subdomain-scoped endpoint. On the main domain, this endpoint is not called (the subdomain `NavBar` + its context trigger `useGetCurrentUser`), so `account.membership` remains `undefined`. `RequireRole` sees `role === null` and redirects to `/`.

**Result:** Users arriving at `/admin/brokerage` from the portal dashboard immediately get redirected to `/` (NotFound on main domain since `/` is not registered for main domain), creating a broken experience.

### Why It Happens

The admin route tree was designed exclusively for subdomain use. On subdomains, `AppShellAdmin` is mounted inside `<ProtectedRoute>` → `SubdomainOnly`, and `Navbar` (inside `AppShellAdmin`) calls `useNavBarContext` which calls `useGetCurrentUser` (enabled by default). On the main domain, none of this setup occurs before the user lands on `/admin/brokerage`.

### The Full Dependency Chain

```
AppShellAdmin
├── NavBar (calls useNavBarContext)
│   └── useNavBarContext → useGetCurrentUser (enabled: !disableAuth)
│       └── GET /v1/user → populates account.membership.role
├── SideNav → useSideNavContext → usePermission → useRole
│   └── reads account.membership?.role (null on main domain)
└── RequireRole roles={['owner', 'admin']}
    └── useRole → account.membership?.role (null → redirects to /)
```

### How to Avoid

**Option A (Recommended): Wrap the admin route in a `ProtectedRoute` inside `MainDomainOnly` and skip `RequireRole` at the route level.** The `RequireRole` guard inside `AppShellAdmin` is what blocks content. The planner must decide whether to:
1. Pass `disableAuth={true}` to `Navbar` inside `AppShellAdmin` when on main domain (suppresses `useGetCurrentUser` and notifications — but this requires modifying `AppShellAdmin` or adding a prop)
2. Remove `RequireRole` from `AppShellAdmin` and rely on `PortalShell` pre-validation (simpler but reduces defense-in-depth)
3. Trigger `useGetCurrentUser` earlier in the main domain portal flow (complex — requires adding a hook call somewhere in `PortalShell` or a parent)

**Simplest viable approach:** The portal landing page validates brokerage access via `adminBrokerages` from the Phase 15 backend (BE-01). Since only users in `adminBrokerages` reach `/admin/*` via the portal nav, removing `RequireRole` within `AppShellAdmin` on the main domain path is defensible. However, a minimal approach is: wrap the admin route in `MainDomainOnly` inside a `ProtectedRoute`, and also pass a `mainDomain` prop (or use context) to suppress `RequireRole`. The planner must pick a strategy.

**Note:** This pitfall is not mentioned in CONTEXT.md — it was discovered during codebase inspection. The planner should define the exact resolution strategy.

[VERIFIED: inspected `RequireRole.tsx`, `useRole.ts`, `AppShellAdmin.tsx`, `NavBarContext.ts`, `useGetCurrentUser.ts`]

---

## Common Pitfalls

### Pitfall 1: Circular Import Between `axios.ts` and `store/reducers`

**What goes wrong:** `axios.ts` already imports from `@/router/main`. Adding a store import could create a cycle if `store/reducers` imported axios indirectly.
**Why it happens:** Reducers, hooks, and API modules are interconnected.
**How to avoid:** Verify the chain: `store/reducers/index.tsx` → `store/reducers/*.ts` → none import axios. The import is safe. [VERIFIED: all reducer files inspected — no axios import]
**Warning signs:** TypeScript compilation error "circular dependency" or runtime `undefined` on module import.

### Pitfall 2: `config.url` May Be Undefined in Interceptor

**What goes wrong:** `config.url?.includes('/v1/admin/')` must use optional chaining — `config.url` can be undefined in some Axios versions.
**Why it happens:** Axios types define `url` as `string | undefined`.
**How to avoid:** Always use `config.url?.includes(...)` not `config.url.includes(...)`.

### Pitfall 3: Brokerage Switch Dispatches Stale ID

**What goes wrong:** If `dispatch(setActiveBrokerage(selected))` is called but `navigate` is omitted (or the URL doesn't update), `PortalShell`'s `useEffect([brokerageId])` won't re-run, but Redux has the new brokerage. Subsequent admin panel API calls will use the new brokerage ID via the interceptor (correct), but the URL will show the old brokerage ID (stale).
**Why it happens:** Redux and URL get out of sync.
**How to avoid:** D-14 is explicit: dispatch first, then navigate. Both must execute. Don't make navigate conditional.

### Pitfall 4: `PortalNavBar` Rendered Before `activeBrokerage` Is Set

**What goes wrong:** `PortalNavBar` is rendered as part of `PortalShell`'s resolved state. If it renders before `activeBrokerage` is set in Redux, it will throw on `activeBrokerage.name` access.
**Why it happens:** React renders synchronously — if the loading guard is bypassed, null dereference occurs.
**How to avoid:** D-12 specifies `return null` in `PortalNavBar` if `activeBrokerage` is null. Additionally, `PortalShell` only renders the resolved state AFTER `activeBrokerage` is dispatched in its `useEffect`. But the null guard in `PortalNavBar` is the safety net.

### Pitfall 5: The Admin Route Is Already Imported — But Under SubdomainOnly

**What goes wrong:** A planner might see `admin` imported in `main.tsx` and assume it's already registered for the main domain. It's registered only under `SubdomainOnly` (line 24), which renders `NotFound` on the main domain.
**Why it happens:** The import exists but the route object appears in the wrong guard block.
**How to avoid:** Add `admin` to `MainDomainOnly`'s `children` array. The import statement does not need to change.

---

## Code Examples

Verified patterns from direct codebase inspection:

### Role Badge (from BrokerageSelection.tsx — exact pattern to reuse)

```tsx
// Source: frontend/src/containers/portal/BrokerageSelection.tsx:73-75
<span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
    {brokerage.role}
</span>
```

### Section Card Button Pattern (from UI-SPEC.md)

```tsx
// Source: 18-UI-SPEC.md card pattern section
<button
    className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 w-full"
    onClick={() => navigate('/admin/users')}
>
    <Users className="h-5 w-5 text-muted-foreground" />
    <div className="text-sm font-semibold text-foreground">Users</div>
</button>
```

### PortalShell Outer Structure (from UI-SPEC.md)

```tsx
// Source: 18-UI-SPEC.md Screen 1
<div className="flex min-h-screen flex-col bg-background">
    <PortalNavBar />
    <main className="flex flex-1 items-start justify-center px-6 py-8">
        <div className="flex w-full max-w-lg flex-col gap-6">
            {/* heading block */}
            {/* 2x2 section cards grid */}
        </div>
    </main>
</div>
```

### PortalNavBar Outer Structure (mirrors NavBar.tsx exactly)

```tsx
// Source: frontend/src/components/navbar/NavBar.tsx:30-32
<header className="border-b border-sidebar-border bg-sidebar">
    <div className="flex h-16 items-center justify-between gap-3 px-4">
        {/* left: brokerage switcher */}
        {/* right: role badge + sign-out */}
    </div>
</header>
```

### AdminBrokerage Type (confirmed shape)

```typescript
// Source: frontend/src/assets/types/adminBrokerageType.ts
interface AdminBrokerage {
    id: string
    name: string
    role: UserRole  // 'owner' | 'admin' (confirmed from roleType.ts)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Placeholder `PortalShell` | Real landing page with `PortalNavBar` + 4 section cards | Phase 18 | Users can now actually navigate to admin panels from main domain |
| Admin route only on subdomain | Admin route registered on both subdomain and main domain | Phase 18 | Enables main domain → `/admin/*` navigation |
| No X-Brokerage-Id in axios | Surgical header injection for `/v1/admin/**` on main domain | Phase 18 | Backend `Current.brokerage` resolves correctly on main domain admin calls |

---

## Environment Availability

Step 2.6: SKIPPED — phase is pure frontend code changes with no external tool, service, or CLI dependencies. All required libraries are pre-installed in `frontend/node_modules`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `signOut` from `aws-amplify/auth` is the correct import for portal sign-out (not `useCognitoAuth`) | Pattern 2 | Sign-out could fail if Amplify is configured differently; mitigated by `NoAccess.tsx` using exact same pattern |
| A2 | `UserRole` type includes `'owner'` and `'admin'` (not verified by reading roleType.ts directly) | Code Examples | Role badge `capitalize` display would be unaffected; `RequireRole` might reject valid roles if type is wider | [ASSUMED] |

---

## Open Questions (RESOLVED)

1. **RequireRole blocking admin panels on main domain (CRITICAL)**
   - What we know: `RequireRole` reads `account.membership?.role`. This is `null` on main domain because `GET /v1/user` is never called in the main domain portal flow.
   - What's unclear: Which approach the planner selects — suppress `RequireRole` for the main domain admin path, add `useGetCurrentUser` to the portal flow, or accept that only portal-entry users reach `/admin/*` and remove the guard.
   - Recommendation: The simplest fix is to wrap the `admin` route in `MainDomainOnly` without `RequireRole`, relying on `PortalShell`'s existing brokerage validation as the access gate. This matches D-05's intent ("register the full route tree") without requiring `AppShellAdmin` modification. The planner must decide.
   - **RESOLVED:** Plan 18-01 Task 2 adds `if (isMainDomain()) return <>{children}</>` as the first check in `RequireRole.tsx`, bypassing the role guard on the main domain. Defense-in-depth preserved via `ProtectedRoute` in main.tsx, `PortalShell` brokerage validation, and backend re-validation (Phase 15 BE-02) on every `/v1/admin/**` request.

2. **`AppShellAdmin` NavBar on main domain — missing brokerage data**
   - What we know: `AppShellAdmin` calls `useFetchBrokerage` → `GET /v1/admin/brokerage`. On the main domain, this call now goes through the interceptor and gets `X-Brokerage-Id`. After Phase 18, this should work correctly — `brokerageData.name` and `brokerageData.logoUrl` will be populated from the main domain API call.
   - What's unclear: Whether the color scheme (`applyColorScheme`) applied from `useFetchBrokerage` causes visual conflicts when the user switches brokerages.
   - Recommendation: Acceptable for Phase 18. Color scheme re-application when navigating between brokerages' admin panels is a v1.5 polish item.
   - **RESOLVED:** Accepted for Phase 18. Color scheme re-application on brokerage switch is deferred to v1.5 as documented in CONTEXT.md Deferred section.

---

## Security Domain

`security_enforcement` key not present in `config.json` → treated as enabled.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 18 adds no new auth paths |
| V3 Session Management | No | Sign-out follows established pattern |
| V4 Access Control | Yes | `ProtectedRoute` wraps portal routes (AUTH-07). `RequireRole` in `AppShellAdmin` is the open question above. |
| V5 Input Validation | Yes | Brokerage ID from URL is validated against `adminBrokerages[]` in `PortalShell` (existing Phase 17 logic — preserved) |
| V6 Cryptography | No | No new crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| URL tampering (`/dashboard/EVIL_ID`) | Spoofing | Existing Phase 17 logic validates `brokerageId` against `adminBrokerages[]` — already implemented |
| X-Brokerage-Id header injection from client | Tampering | Backend (Phase 15, BE-02) validates the ID and user's role before serving data — not a frontend concern |
| Unauthenticated access to `/admin/*` on main domain | Elevation of privilege | `ProtectedRoute` in `MainDomainOnly` wraps `portalDashboard`; the planner must also ensure `/admin/*` under `MainDomainOnly` is protected by `ProtectedRoute` (currently NOT in the proposed `admin` registration) |

**Security note for planner:** The current decision D-05 says "register the full `/admin/` route tree on the main domain." The current subdomain registration wraps admin in `ProtectedRoute`. The proposed main domain registration (`children: [createBrokerage, portalDashboard, noAccess, admin]`) adds `admin` without `ProtectedRoute`. The `admin` route object itself has no authentication guard. Unauthenticated users could potentially access `/admin/brokerage` on the main domain without a token. The planner should add `ProtectedRoute` wrapping for the admin route on the main domain, consistent with how it's protected on the subdomain.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `frontend/src/containers/portal/PortalShell.tsx` — current implementation verified
- `frontend/src/assets/axios/axios.ts` — interceptor structure verified (line 21)
- `frontend/src/helpers/domain.ts` — `isMainDomain()` implementation verified
- `frontend/src/store/reducers/activeBrokerage.ts` — slice shape verified
- `frontend/src/store/reducers/index.tsx` — `store` export verified (import path confirmed)
- `frontend/src/router/main.tsx` — `admin` is imported (line 6) but only registered under `SubdomainOnly` (line 24), NOT under `MainDomainOnly`
- `frontend/src/router/admin/admin.tsx` — full route tree verified
- `frontend/src/components/common/shells/appShellAdmin/AppShellAdmin.tsx` — `RequireRole` pitfall verified
- `frontend/src/components/common/guards/RequireRole.tsx` — redirects on null role
- `frontend/src/store/hooks/Auth/useRole.ts` — reads `account.membership?.role`
- `frontend/src/containers/portal/BrokerageSelection.tsx` — role badge pattern verified
- `frontend/src/components/navbar/NavBar.tsx` — DropdownMenu pattern verified
- `frontend/src/containers/portal/NoAccess.tsx` — sign-out pattern verified
- `.planning/phases/18-dashboard-shell-admin-suite-brokerage-switcher/18-CONTEXT.md` — all decisions
- `.planning/phases/18-dashboard-shell-admin-suite-brokerage-switcher/18-UI-SPEC.md` — design contract

### Secondary (HIGH confidence — planning artifacts)
- `.planning/REQUIREMENTS.md` — PORTAL-02, PORTAL-03, BROK-03, BROK-04
- `.planning/STATE.md` — accumulated decisions from prior phases

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified as already installed; no new dependencies
- Architecture: HIGH — all files read directly; data flow traced through actual code
- Pitfalls: HIGH — `RequireRole` pitfall discovered through direct code inspection, not assumed
- UI patterns: HIGH — exact class strings sourced from live files and signed-off UI-SPEC.md

**Research date:** 2026-05-26
**Valid until:** 2026-06-26 (stable codebase; no planned changes to adjacent systems)
