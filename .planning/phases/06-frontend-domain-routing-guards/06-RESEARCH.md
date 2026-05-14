# Phase 6: Frontend Domain Routing Guards - Research

**Researched:** 2026-05-13
**Domain:** React Router v6 guard components, Vite environment variables, hostname-based routing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use a root guard component approach (`<DomainGuard>`) — not a bootstrap-time router split. Single router file preserved; DomainGuard wraps the relevant route subtrees and reads hostname at render time.
- **D-02:** DomainGuard lives at `frontend/src/components/common/guards/DomainGuard.tsx` — consistent with the existing `ProtectedRoute.tsx` location in `guards/`.
- **D-03:** Domain detection is a standalone pure utility function `isMainDomain(): boolean` at `frontend/src/helpers/domain.ts`. Reads `import.meta.env.VITE_MAIN_DOMAIN` vs `window.location.hostname`. Reusable across any future guard without coupling to React.
- **D-04:** Create a new dedicated `frontend/src/containers/errorPage/NotFound.tsx` component — separate from the existing `ErrorPage` (which handles React Router errors and shows raw error details).
- **D-05:** NotFound page is generic: "Page not found" — no CTA, no link to `/create`. Minimal, clean.
- **D-06:** On brokerage subdomains, navigating to `/create` (or any `/create/*` sub-path) uses a silent React Router `<Navigate to="/" replace />`. No toast, no delay. History entry is replaced so the back button doesn't loop.
- **D-07:** `VITE_MAIN_DOMAIN` must be added to `frontend/.env` and `.env.example` as part of this phase (DOM-01). Backend already has `APP_BASE_DOMAIN` — this is the frontend parallel.

### Claude's Discretion
None stated — all decisions locked.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOM-01 | Frontend reads main domain from `VITE_MAIN_DOMAIN` env var and detects whether `window.location.hostname` matches the main domain at runtime | `isMainDomain()` helper in `helpers/domain.ts` reads `import.meta.env.VITE_MAIN_DOMAIN`; verified Vite env var pattern is correct |
| DOM-02 | On the main domain, all routes except `/create/*` render a 404 page; authenticated app routes are inaccessible from the main domain | DomainGuard wraps all non-create routes; on main domain it renders `<NotFound />` instead of `<Outlet />`; create route is left unwrapped |
| DOM-03 | On brokerage subdomains, navigating to `/create` or any `/create/*` sub-path redirects to `/` | DomainGuard wraps the createBrokerage route; on non-main-domain it renders `<Navigate to="/" replace />` |
</phase_requirements>

---

## Summary

Phase 6 is a pure frontend routing change. All work lives in four files: one new utility, one new guard component, one new page component, two env files, and edits to the existing router. No backend changes, no API calls, no new dependencies.

The existing codebase has a mature guard pattern established by `ProtectedRoute.tsx` (Outlet-based, no hooks beyond the guard condition) and `RequireRole.tsx` (children-based with redirect). DomainGuard follows the ProtectedRoute shape exactly: reads a condition, either renders `<Outlet />` or a fallback element. The only twist is that DomainGuard has two modes depending on which side of the domain boundary is being guarded — main-domain guard blocks all routes except `/create`, and subdomain guard blocks `/create` specifically.

The router currently uses a flat `createBrowserRouter` array with a wildcard `* → ErrorPage` catch-all. The integration requires two DomainGuard insertions: one wrapping `[dashboard, admin, account, auth, joinBrokerage]` for the main-domain block, and one inside or wrapping `createBrokerage` for the subdomain redirect. The wildcard catch-all must be replaced with a DomainGuard-aware NotFound rendering.

**Primary recommendation:** Write DomainGuard as a single component that accepts a `mode` prop (`"main-domain-only" | "subdomain-only"`) — or implement two focused usages of the same guard — then integrate into `main.tsx` at the route level. The utility function `isMainDomain()` keeps all hostname logic out of both the guard and router.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Domain detection (hostname vs env var) | Browser / Client | — | `window.location.hostname` is a browser API; pure JS, no server involved |
| Route guard rendering (Outlet vs redirect vs 404) | Browser / Client (React Router) | — | React Router runs entirely client-side in this Vite SPA |
| Environment variable injection | CDN / Static (Vite build) | — | `VITE_*` vars are injected at build time via `import.meta.env`; no runtime server |
| NotFound page UI | Browser / Client | — | Pure presentational component |

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router-dom | ^6.4.3 (installed) | `<Navigate>`, `<Outlet>`, route config | Project's existing router; all guard patterns use it |
| vite | ^6.4.1 (installed) | `VITE_*` env vars via `import.meta.env` | Project's existing build tool; `VITE_MAIN_DOMAIN` follows established pattern |

**No new packages required.** This phase is entirely within the existing dependency graph.

[VERIFIED: package.json inspection — react-router-dom ^6.4.3, vite ^6.4.1, vitest ^4.1.5]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single router with DomainGuard | Two separate router definitions bootstrapped by hostname | Creates two router files to maintain, more test surface; D-01 explicitly rejects this |
| `<Navigate>` for main-domain block | `window.location.href` redirect | `window.location.href` causes full page reload, breaks React tree; D-01 guard pattern requires React Router primitives |

---

## Architecture Patterns

### System Architecture Diagram

```
Browser request
      │
      ▼
window.location.hostname
      │
      ├─ isMainDomain() == true
      │         │
      │         ├─ route is /create/*  ─────────▶  CreateBrokerage wizard (renders)
      │         │
      │         └─ any other route  ─────────────▶  NotFound (renders, no redirect)
      │
      └─ isMainDomain() == false (subdomain)
                │
                ├─ route is /create/*  ─────────▶  <Navigate to="/" replace /> (redirect)
                │
                └─ any other route  ─────────────▶  Existing route tree (dashboard/admin/account/auth)
```

### Recommended Project Structure

No new directories. Files slot into existing structure:

```
frontend/src/
├── helpers/
│   ├── DateFormat.ts          (existing)
│   ├── Encryption.ts          (existing)
│   └── domain.ts              ← NEW: isMainDomain()
├── components/common/guards/
│   ├── ProtectedRoute.tsx     (existing)
│   ├── RequireRole.tsx        (existing)
│   └── DomainGuard.tsx        ← NEW: guard component
├── containers/errorPage/
│   ├── ErrorPage.tsx          (existing — React Router error page)
│   └── NotFound.tsx           ← NEW: 404 page (no useRouteError)
└── router/
    └── main.tsx               ← EDIT: insert DomainGuard wrappers
frontend/
├── .env                       ← EDIT: add VITE_MAIN_DOMAIN
└── .env.example               ← NEW: create with VITE_MAIN_DOMAIN placeholder
```

### Pattern 1: isMainDomain() Utility

**What:** Pure function, no React, no hooks. Reads build-time env var vs runtime hostname.
**When to use:** Called inside DomainGuard only. Can be imported anywhere hostname check is needed in future.

```typescript
// Source: Vite docs — import.meta.env pattern [CITED: vitejs.dev/guide/env-and-mode]
// frontend/src/helpers/domain.ts

export function isMainDomain(): boolean {
    return window.location.hostname === import.meta.env.VITE_MAIN_DOMAIN
}
```

**Key detail:** `window.location.hostname` returns the hostname without port (e.g., `realtybase.ca` not `realtybase.ca:3000`). In local dev where `VITE_MAIN_DOMAIN=localhost` this works correctly. If the env var includes a port, comparison will fail — the env var must be hostname-only.

[VERIFIED: MDN — window.location.hostname strips port; confirmed by React Router community patterns]

### Pattern 2: DomainGuard Component

**What:** Route guard that reads `isMainDomain()` and either allows or blocks based on which route tree it's wrapping.
**When to use:** Inserted at the route element level in `createBrowserRouter` config.

The guard needs two behavioral modes because the two guarded subtrees have opposite requirements:
- **Main-domain subtree** (dashboard/admin/account/auth/join): block on main domain, allow on subdomains
- **Create subtree** (/create): allow on main domain, redirect on subdomains

Two separate guard usages, each with a simple condition, is cleaner than a prop-driven switch.

```typescript
// Source: follows ProtectedRoute.tsx pattern [VERIFIED: codebase inspection]
// frontend/src/components/common/guards/DomainGuard.tsx

import { Navigate, Outlet } from 'react-router-dom'
import { isMainDomain } from '@/helpers/domain'
import NotFound from '@/containers/errorPage/NotFound'

// Use on the route wrapping dashboard/admin/account/auth/joinBrokerage
// On main domain: render NotFound. On subdomain: pass through.
export const SubdomainOnly = () => {
    if (isMainDomain()) return <NotFound />
    return <Outlet />
}

// Use on the createBrokerage route element
// On main domain: pass through. On subdomain: redirect to /.
export const MainDomainOnly = () => {
    if (!isMainDomain()) return <Navigate to="/" replace />
    return <Outlet />
}
```

Alternatively, a single named export with a `mode` prop is equally valid. The above two-export approach matches how `ProtectedRoute` and `RequireRole` are separate files for separate concerns. **Recommended: single file with two named exports** — both are domain guards, separation within the file is sufficient.

[VERIFIED: codebase inspection — ProtectedRoute.tsx uses Outlet pattern; RequireRole.tsx uses children+Navigate pattern]

### Pattern 3: Router Integration

**What:** Wrap route subtrees in DomainGuard elements inside `createBrowserRouter`.
**When to use:** In `frontend/src/router/main.tsx`.

```typescript
// Source: React Router v6 nested route pattern [CITED: reactrouter.com/en/main/route/route]
// frontend/src/router/main.tsx

import { SubdomainOnly, MainDomainOnly } from '@/components/common/guards/DomainGuard'

const router = createBrowserRouter([
    // Subdomain-only: authenticated app routes blocked on main domain
    {
        element: <SubdomainOnly />,
        children: [
            {
                element: <ProtectedRoute />,
                children: [dashboard, admin, account],
            },
            auth,
            joinBrokerage,
        ],
    },
    // Main-domain-only: /create blocked on subdomains
    {
        element: <MainDomainOnly />,
        children: [createBrokerage],
    },
    // Wildcard catch-all — NotFound for unmatched routes on any domain
    {
        path: '*',
        element: <NotFound />,
    },
])
```

**Critical note on the wildcard route:** The current wildcard `* → ErrorPage` catches unmatched routes. After this change, it changes to `* → NotFound`. The `ErrorPage` component uses `useRouteError()` which is React Router's error boundary hook — it only works as an `errorElement`, not a regular `element`. `NotFound` must be a plain component without `useRouteError()`.

[VERIFIED: React Router v6 docs — errorElement vs element are distinct; useRouteError() only works in errorElement context]

### Pattern 4: NotFound Component

**What:** Minimal "Page not found" page. No CTA. No link to `/create`. Clean.
**When to use:** Rendered by `SubdomainOnly` guard on main domain, and by wildcard catch-all.

```typescript
// frontend/src/containers/errorPage/NotFound.tsx
// No useRouteError — this is a regular element, not an errorElement

const NotFound = () => {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
                <h1 className="text-2xl font-semibold text-gray-900">Page not found</h1>
                <p className="mt-2 text-gray-500">The page you're looking for doesn't exist.</p>
            </div>
        </div>
    )
}

export default NotFound
```

D-05 specifies minimal and clean — no CTA, no link. Visual polish (centering, typography) aligns with CLAUDE.md senior UI/UX standard. [VERIFIED: CLAUDE.md — design quality non-negotiable, empty states must not look broken or unfinished]

### Anti-Patterns to Avoid

- **`window.location.href` in guard:** Causes full page reload, destroys React tree. Always use `<Navigate>` from react-router-dom.
- **Hostname check inside component render logic instead of utility:** Makes the guard untestable in isolation. `isMainDomain()` being a standalone pure function allows direct unit testing.
- **Using `useRouteError()` in NotFound:** That hook only works inside `errorElement` route configs. NotFound is a regular `element` — calling `useRouteError()` there returns undefined and the component silently renders nothing.
- **Wrapping the wildcard `*` route in a DomainGuard:** The wildcard is the fallback for both domains — it should always show NotFound regardless of domain. Only route subtrees with domain-specific behavior need a guard.
- **Hardcoding the domain string in DomainGuard:** The utility function must read `import.meta.env.VITE_MAIN_DOMAIN`, never a literal string. DOM-01 requires env var approach.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Route-level conditional rendering | Custom wrapper with useState/useEffect for hostname | React Router `<Outlet />` + guard element pattern | Guards with Outlet are synchronous and don't cause a render cycle or flash |
| Redirect without replacing history | `window.location.href = '/'` or `<Navigate to="/" />` (without replace) | `<Navigate to="/" replace />` | Without `replace`, browser back button returns to `/create` and re-triggers the redirect loop |
| 404 handling | Separate router for each domain | Single router + DomainGuard wrapping | D-01 explicitly rejects router splitting; single router is simpler to maintain |

**Key insight:** React Router v6's route element model is the right abstraction for this. A guard is just a route element that conditionally renders either `<Outlet />` (pass through) or a fallback. There is no need for any state, side effects, or async work.

---

## Common Pitfalls

### Pitfall 1: `import.meta.env.VITE_MAIN_DOMAIN` is undefined in tests

**What goes wrong:** Vitest runs in jsdom environment. `import.meta.env` in Vitest is populated from `.env.test` or via `vi.stubEnv`. If the env var is not set, `isMainDomain()` compares `window.location.hostname` against `undefined`, which always returns `false`.

**Why it happens:** Vite replaces `import.meta.env.VITE_*` at build time, but Vitest injects them differently. Test files that test DomainGuard need to stub the env var explicitly.

**How to avoid:** In DomainGuard tests, use `vi.stubEnv('VITE_MAIN_DOMAIN', 'realtybase.ca')` before running assertions. Restore with `vi.unstubAllEnvs()` in afterEach. [VERIFIED: Vitest docs pattern — vi.stubEnv is the correct API]

**Warning signs:** Guard always shows `<Outlet />` content in tests regardless of the mocked hostname — means `VITE_MAIN_DOMAIN` is undefined and the comparison is `hostname === undefined` (always false).

### Pitfall 2: `window.location.hostname` is always `localhost` in tests

**What goes wrong:** jsdom sets `window.location.hostname` to `localhost` by default. Tests that verify "main domain" behavior must override this — otherwise all tests behave as if on main domain when `VITE_MAIN_DOMAIN=localhost`.

**Why it happens:** jsdom initializes with `about:blank` or the test's memory router URL. The hostname doesn't automatically come from `MemoryRouter` — MemoryRouter controls the React Router location, not `window.location`.

**How to avoid:** For DomainGuard tests that need to simulate a subdomain, use `Object.defineProperty(window, 'location', { value: { hostname: 'acme.realtybase.ca' }, writable: true })` or `vi.stubGlobal('location', { hostname: 'acme.realtybase.ca' })`. Reset after each test.

**Warning signs:** The subdomain redirect (`<Navigate to="/" replace />`) never fires in tests, even when the test intends to simulate a subdomain.

### Pitfall 3: Route order matters — specific routes before wildcard

**What goes wrong:** If the wildcard `path: '*'` appears before other routes in the `createBrowserRouter` array, it matches everything and no other route renders.

**Why it happens:** React Router v6 uses ranked route matching for nested routes, but at the top level, order of `createBrowserRouter` array entries can interact with the ranking algorithm unexpectedly when combining path-based routes with element-only wrapper routes.

**How to avoid:** Keep wildcard as the absolute last entry in the top-level router array. Verify by testing that `/create` route renders the wizard (not NotFound) on main domain.

### Pitfall 4: `.env.example` not created — missing documentation for new env var

**What goes wrong:** Another developer (or CI environment) clones the repo and the app fails at runtime with the domain guard always blocking because `VITE_MAIN_DOMAIN` is not set.

**Why it happens:** `.env` is git-ignored; `.env.example` is the discovery mechanism for required vars.

**How to avoid:** Create `frontend/.env.example` with `VITE_MAIN_DOMAIN=your-main-domain.com` as part of this phase. D-07 requires this.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Vite env var access pattern

```typescript
// Source: Vite docs — import.meta.env [CITED: vitejs.dev/guide/env-and-mode]
// All VITE_* vars are strings. Undefined vars return undefined (not throw).
const mainDomain: string | undefined = import.meta.env.VITE_MAIN_DOMAIN
```

### React Router Navigate with replace

```typescript
// Source: React Router v6 docs [CITED: reactrouter.com/en/main/components/navigate]
// replace=true: replaces current history entry, back button skips /create
<Navigate to="/" replace />
```

### Route wrapping with guard element

```typescript
// Source: React Router v6 — layout routes [CITED: reactrouter.com/en/main/start/concepts#layout-routes]
// A route with only `element` and `children` (no `path`) is a layout/wrapper route.
// The element renders, calls <Outlet /> for children — or doesn't, acting as a guard.
{
    element: <SubdomainOnly />,
    children: [auth, dashboard, admin, account, joinBrokerage],
}
```

### Vitest env stubbing for guard tests

```typescript
// Source: Vitest docs — vi.stubEnv [CITED: vitest.dev/api/vi#vi-stubenv]
import { vi, describe, it, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
    vi.stubEnv('VITE_MAIN_DOMAIN', 'realtybase.ca')
})
afterEach(() => {
    vi.unstubAllEnvs()
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bootstrap-time router selection (`if (isMain) createRouter(mainRoutes) else createRouter(subRoutes)`) | Single router + guard elements at render time | React Router v6.4+ layout routes | Single router file, guards compose naturally with existing ProtectedRoute |
| `errorElement` for 404 pages | Dedicated `element` component with `path: '*'` | React Router v6 | ErrorBoundary vs 404 are separate concerns; `useRouteError()` only works in errorElement |

**Deprecated/outdated:**
- Using React Router v5 `<Switch>` patterns: v6 replaced `<Switch>` with `<Routes>` and nested route configs. Not applicable here — project already uses v6 `createBrowserRouter`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `.env.example` does not exist yet and must be created | Standard Stack / Code Examples | File already exists → task becomes "edit" not "create"; low risk, easily caught |
| A2 | `VITE_MAIN_DOMAIN` in `.env` should be set to `localhost` for local dev | Code Examples | Wrong value → guard always blocks wrong domain in dev; developer must know correct value |

---

## Open Questions

1. **What is the production value of `VITE_MAIN_DOMAIN`?**
   - What we know: Backend uses `APP_BASE_DOMAIN`; presumably the same domain (e.g., `realtybase.ca`)
   - What's unclear: Whether the production `.env` already has this set elsewhere, or if it needs to be added to CI/CD secrets
   - Recommendation: Plan task for "add VITE_MAIN_DOMAIN=localhost to .env for dev" + note in plan that production value must be set in deployment environment

2. **Does the main domain need the `auth` and `joinBrokerage` routes?**
   - What we know: CONTEXT.md says main domain shows only `/create`; all other routes 404
   - What's unclear: `/invite/:token` (joinBrokerage) — does a user clicking a brokerage invite link land on a subdomain or main domain? The router currently has this as a top-level route.
   - Recommendation: Based on D-02 ("all routes except /create/* render 404"), joinBrokerage should be under SubdomainOnly guard. Plan should implement this and let the human confirm during execution.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build, Vitest | ✓ | (WSL2 env) | — |
| react-router-dom | Guard components, Navigate, Outlet | ✓ | ^6.4.3 | — |
| vite | VITE_* env vars | ✓ | ^6.4.1 | — |
| vitest | Test execution | ✓ | ^4.1.5 | — |

[VERIFIED: package.json — all dependencies present, no new installs required]

**Missing dependencies with no fallback:** None.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a |
| V3 Session Management | no | n/a |
| V4 Access Control | yes (partial) | Client-side routing guard — NOT a security boundary; DOM-04/05 in Phase 7 provides the real enforcement |
| V5 Input Validation | no | n/a |
| V6 Cryptography | no | n/a |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| URL manipulation bypassing client-side guard | Spoofing | Client-side guards are UX, not security. Phase 7 (DOM-04/05) adds backend 403 enforcement. Document this explicitly in plan comments. |
| Direct API calls to `/v1/onboarding/*` from a subdomain | Tampering | Out of scope for Phase 6 — Phase 7 backend guard handles this. |

**Security note:** `DomainGuard` is a UX routing enforcement layer, not a security boundary. A user who knows the API can POST to `/v1/onboarding/brokerage` from any domain. Phase 7 closes this gap. The plan should include a comment in DomainGuard source code noting this distinction.

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/components/common/guards/ProtectedRoute.tsx` — Outlet+Navigate guard pattern
- `frontend/src/components/common/guards/RequireRole.tsx` — children guard pattern with redirect
- `frontend/src/components/common/guards/ProtectedRoute.test.tsx` — test pattern for guards using renderWithProviders + MemoryRouter
- `frontend/src/components/common/guards/RequireRole.test.tsx` — test pattern for guards using preloadedState
- `frontend/src/router/main.tsx` — current router structure, integration target
- `frontend/src/router/createBrokerage/createBrokerage.tsx` — createBrokerage route config
- `frontend/package.json` — confirmed react-router-dom ^6.4.3, vite ^6.4.1, vitest ^4.1.5
- `frontend/.env` — current env vars; VITE_MAIN_DOMAIN not yet present
- `frontend/vitest.config.ts` — jsdom environment, execArgv flag, passWithNoTests

### Secondary (MEDIUM confidence)
- [React Router v6 Layout Routes](https://reactrouter.com/en/main/start/concepts#layout-routes) — element-only wrapper routes as guards
- [Vite env vars](https://vitejs.dev/guide/env-and-mode) — `import.meta.env.VITE_*` pattern
- [React Router Navigate](https://reactrouter.com/en/main/components/navigate) — `replace` prop behavior

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json; no new dependencies
- Architecture: HIGH — DomainGuard pattern directly derived from existing ProtectedRoute.tsx pattern in codebase
- Integration points: HIGH — router file read directly; createBrokerage and joinBrokerage route configs verified
- Pitfalls: HIGH — Vitest env stubbing and window.location.hostname behavior are well-known jsdom constraints; confirmed by test infrastructure inspection

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable; React Router v6 and Vite patterns are stable APIs)
