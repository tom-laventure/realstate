# Phase 6: Frontend Domain Routing Guards - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

React router conditionally enforces main-domain-only and subdomain-only route trees based on `window.location.hostname` compared against `VITE_MAIN_DOMAIN`.

- On the main domain: only `/create/*` renders the wizard; all other routes render a generic 404 page
- On brokerage subdomains: `/create` (and sub-paths) silently redirects to `/`; all existing authenticated routes function normally

</domain>

<decisions>
## Implementation Decisions

### Guard Architecture
- **D-01:** Use a root guard component approach (`<DomainGuard>`) — not a bootstrap-time router split. Single router file preserved; DomainGuard wraps the relevant route subtrees and reads hostname at render time.
- **D-02:** DomainGuard lives at `frontend/src/components/common/guards/DomainGuard.tsx` — consistent with the existing `ProtectedRoute.tsx` location in `guards/`.
- **D-03:** Domain detection is a standalone pure utility function `isMainDomain(): boolean` at `frontend/src/helpers/domain.ts`. Reads `import.meta.env.VITE_MAIN_DOMAIN` vs `window.location.hostname`. Reusable across any future guard without coupling to React.

### Not-Found Page
- **D-04:** Create a new dedicated `frontend/src/containers/errorPage/NotFound.tsx` component — separate from the existing `ErrorPage` (which handles React Router errors and shows raw error details). The two surfaces are distinct.
- **D-05:** NotFound page is generic: "Page not found" — no CTA, no link to `/create`. Minimal, clean.

### Subdomain /create Redirect
- **D-06:** On brokerage subdomains, navigating to `/create` (or any `/create/*` sub-path) uses a silent React Router `<Navigate to="/" replace />`. No toast, no delay. History entry is replaced so the back button doesn't loop.

### Environment Variable
- **D-07:** `VITE_MAIN_DOMAIN` must be added to `frontend/.env` and `.env.example` as part of this phase (DOM-01). Backend already has `APP_BASE_DOMAIN` — this is the frontend parallel.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DOM-01, DOM-02, DOM-03 (the three requirements this phase implements)
- `.planning/ROADMAP.md` §Phase 6 — success criteria and plan 06-01 scope

### Existing Guards (pattern reference)
- `frontend/src/components/common/guards/ProtectedRoute.tsx` — established guard component pattern to follow
- `frontend/src/router/main.tsx` — current router structure where DomainGuard integrates

### Error Page (context for NotFound)
- `frontend/src/containers/errorPage/ErrorPage.tsx` — existing developer-facing error page; NotFound.tsx must be separate

### Environment
- `frontend/.env` — current env vars; `VITE_MAIN_DOMAIN` must be added here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProtectedRoute.tsx`: Layout outlet pattern — `DomainGuard` follows the same shape (wraps children via `<Outlet />`, conditionally renders or redirects)
- `ErrorPage.tsx`: Exists at `containers/errorPage/` — NotFound.tsx co-located there
- `frontend/src/helpers/`: Existing utilities directory — `domain.ts` goes here

### Established Patterns
- Guard components use React Router `<Outlet />` for children and `<Navigate>` for redirects — no `window.location.href` in guards
- Env vars accessed via `import.meta.env.VITE_*` (Vite convention)
- Guards are pure components — no hooks beyond what's needed for the guard logic itself

### Integration Points
- `frontend/src/router/main.tsx`: DomainGuard inserted as a route element wrapping the appropriate subtrees
- `/create` route (`router/createBrokerage/createBrokerage.tsx`): needs DomainGuard applied at subdomain side
- Wildcard `* → ErrorPage` route: replace or supplement with DomainGuard-aware 404 on main domain

</code_context>

<specifics>
## Specific Ideas

No specific references — open to standard React Router patterns for guard implementation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 6-Frontend Domain Routing Guards*
*Context gathered: 2026-05-13*
