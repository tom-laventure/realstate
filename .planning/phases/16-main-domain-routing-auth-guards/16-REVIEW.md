---
phase: 16
depth: standard
files_reviewed: 9
status: has_findings
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
---

# Code Review — Phase 16: Main Domain Routing & Auth Guards

## Summary

Phase 16 correctly wires main-domain routing, auth guards, and domain-aware post-login branching across all nine files. The type, API module, hook, components, and router structure are all sound. Two warnings are present exclusively in `Login.tsx` and the global axios interceptor: the catch-block fallback navigates to a route that does not exist on the main domain, and the global axios interceptor fires a generic permission toast and navigation during the login flow before the component's own error handling can suppress it.

## Findings

### WR-001 — Main-domain catch fallback navigates to unmatched route (warning)

**File:** `frontend/src/containers/auth/Login.tsx:24`

**Issue:** When `fetchAdminBrokerages()` rejects on the main domain, `.catch(() => navigate(from, { replace: true }))` navigates to `from`, which defaults to `'/'` when there is no router location state (direct navigation to `/auth/login`). The main domain router has no route at `/` — top-level routes are `/auth/*`, `/create/`, `/dashboard/*`, `/no-access`, and the `*` wildcard that renders `NotFound`. A direct-login API failure on the main domain drops the user on NotFound.

On a subdomain this fallback works correctly because subdomains serve a dashboard at `/`. The `isMainDomain()` guard was applied to the `.then()` path but not carried through to `.catch()`.

**Fix:**
```tsx
.catch(() => {
    if (isMainDomain()) {
        navigate('/auth/login', { replace: true })
    } else {
        navigate(from, { replace: true })
    }
})
```
Alternatively, lift an `error` state into `Login.tsx` and render an inline error message (consistent with the `setError(true)` pattern in `LoginSuccessful.tsx`).

---

### WR-002 — Global 403 interceptor fires spurious toast inside the login flow (warning)

**Files:** `frontend/src/assets/axios/axios.ts:46-52`, `frontend/src/containers/auth/Login.tsx:23-25`, `frontend/src/containers/auth/LoginSuccessful.tsx:54-57`

**Issue:** The global response interceptor handles any 403 without `next_step === 'no-access'` by calling `toast.error("You don't have permission to do that")` and `router.navigate('/')`, then returning `Promise.reject(error)`. There is no pathname guard on this branch (unlike the 401 branch which guards `pathname !== '/auth/login'`).

If `fetchAdminBrokerages()` returns a 403 from either auth component:

1. The interceptor fires the "permission denied" toast — semantically wrong during a login flow.
2. The interceptor calls `router.navigate('/')` — on the main domain this navigates to NotFound (compounding WR-001).
3. The promise still rejects, so the component's `.catch()` also runs — producing double navigation in `Login.tsx` and a contradictory toast + error card in `LoginSuccessful.tsx`.

A 403 from `GET /v1/account/admin_brokerages` is unlikely in normal flow (the endpoint returns 200 with an empty array for users with no admin roles, not 403), but the interceptor is reached unconditionally when it does occur.

**Fix:** Add a pathname guard to the generic 403 branch in `axios.ts`, matching the 401 guard pattern:
```ts
if (
    error.response?.status === 403 &&
    error.response?.data?.next_step !== 'no-access' &&
    !window.location.pathname.startsWith('/auth/')
) {
    toast.error("You don't have permission to do that")
    router.navigate('/')
}
```
This prevents the interceptor from overriding auth-screen error handling. The auth screens own their post-failure UX.

---

## Files With No Issues

- `frontend/src/assets/types/adminBrokerageType.ts`
- `frontend/src/assets/api/account/fetchAdminBrokerages.ts`
- `frontend/src/store/hooks/Account/useFetchAdminBrokerages.ts`
- `frontend/src/containers/portal/NoAccess.tsx`
- `frontend/src/containers/portal/DashboardPlaceholder.tsx`
- `frontend/src/router/portal/portal.tsx`
- `frontend/src/router/main.tsx`
- `frontend/src/containers/auth/LoginSuccessful.tsx`

## Deliberate Decisions — Not Flagged

- **`useFetchAdminBrokerages` as imperative passthrough:** CLAUDE.md mandates going through a hook. The "fire-once" wrapper satisfies the rule while avoiding TanStack Query lifecycle issues for a component that navigates away immediately after resolution. Documented in plan.
- **`/no-access` unprotected by ProtectedRoute:** Intentional per D-08. Adding ProtectedRoute would create an unauthenticated redirect loop. `MainDomainOnly` is the only guard needed.
- **Empty `useEffect` deps in `LoginSuccessful.tsx`:** Safe — `useFetchAdminBrokerages` returns a stable module-level reference. Documented in comments.
