---
phase: 26-root-route-fix
reviewed: 2026-06-03T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - frontend/src/router/main.tsx
  - frontend/src/components/common/guards/PrimaryDomainRedirect.tsx
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-06-03
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Phase 26 made two surgical changes: (1) an index route added inside the `MainDomainOnly` block to redirect main-domain `/` to `/dashboard`, and (2) an `isAuthenticated()` early-return added to `PrimaryDomainRedirect.useEffect` to skip the async domain lookup for unauthenticated subdomain users.

Both changes have defects. The index route fix (ROUTE-01) likely has no effect because React Router's matching algorithm selects Block 1 (`SubdomainOnly`) before Block 2 (`MainDomainOnly`) for the URL `/` — the fix was placed in an unreachable branch. The auth-guard change (ROUTE-02) invalidates every existing subdomain test in `PrimaryDomainRedirect.test.tsx`: because `isAuthenticated()` returns `false` in all test runs (localStorage is empty), the new early-return fires in every subdomain test case, preventing `lookupDomain` from ever being called, and all tests pass for the wrong reason.

## Critical Issues

### CR-01: ROUTE-01 index route is likely unreachable — main domain `/` still resolves via Block 1

**File:** `frontend/src/router/main.tsx:46`

**Issue:** The fix places `{ index: true, element: <Navigate to="/dashboard" replace /> }` inside Block 2 (`MainDomainOnly`). However, Block 1 (`SubdomainOnly`) contains `dashboard` at `path: '/'` as a nested child, which also matches `/`. React Router v6 evaluates top-level route entries in array order; when Block 1's children produce a full match for `/`, Block 2 is not evaluated. On the main domain, Block 1 does match — `SubdomainOnly` renders `<NotFound />` instead of `<Outlet />`, but the route is already selected by the router. The index route in Block 2 never fires.

The stated pre-fix behaviour ("main domain `/` falls through to the `*` wildcard") is consistent with the component-level `NotFound` render from `SubdomainOnly`, not with a route-level miss that would allow Block 2 to take over. Adding the fix to Block 2 does not change what Block 1 renders. ROUTE-01 appears to have no runtime effect.

**Fix:** The redirect needs to be placed where Block 1 (`SubdomainOnly`) can act on it for main-domain users — the guard itself must detect the main domain and redirect rather than render `NotFound`. One correct approach is to modify `SubdomainOnly` in `DomainGuard.tsx`:

```tsx
export const SubdomainOnly = () => {
    if (isMainDomain()) return <Navigate to="/dashboard" replace />
    return <Outlet />
}
```

Alternatively, add the index route inside Block 1's children alongside `dashboard` and `joinBrokerage`, and add a main-domain check inside the index route's element that performs the redirect. Either way, the fix must live inside the route tree that actually matches `/` on the main domain (Block 1), not Block 2.

---

### CR-02: Existing subdomain tests in `PrimaryDomainRedirect.test.tsx` now pass vacuously — domain lookup logic is untested

**File:** `frontend/src/components/common/guards/PrimaryDomainRedirect.tsx:23`
**Related:** `frontend/src/components/common/guards/PrimaryDomainRedirect.test.tsx:52–114`

**Issue:** The new guard condition is `if (isMainDomain() || !isAuthenticated())`. In every test in `PrimaryDomainRedirect.test.tsx`, `localStorage` is empty (the test file does not set `auth_token`, and `setup.ts` clears it after each test). Therefore `isAuthenticated()` returns `false` in every test run, and the new early-return fires — `setReady(true)` is called immediately, bypassing `lookupDomain`.

This affects four of the five existing subdomain tests:

- **"renders Outlet when current hostname equals lookup primary"** (line 52): `mockLookup.mockResolvedValueOnce(...)` is set but `lookupDomain` is never called. The test passes because `ready` is set via the early-return, not because the lookup returned the same hostname.
- **"calls window.location.replace when primary differs"** (line 67): `replaceMock` is never called because the lookup is never triggered. The test assertion `expect(replaceMock).toHaveBeenCalledWith(...)` would fail. (This test may now be the only one that actually catches the problem, depending on `waitFor` timing.)
- **"fails open on lookup error"** (line 84): lookup is never called; `setReady(true)` fires via early-return. Passes vacuously.
- **"renders null while the lookup is pending"** (line 99): lookup is never called; `setReady(true)` fires synchronously. The component renders `<Outlet />` immediately, so `container.textContent` is not empty. This test likely fails.

The net result is that the domain lookup code path — the core logic of this component — is completely untested after ROUTE-02. A regression in `lookupDomain` integration would go undetected.

**Fix:** Mock `@/lib/auth` in the test file and set the authenticated state explicitly per test. For subdomain tests that exercise the lookup path, stub `isAuthenticated` to return `true`. For the new unauthenticated fast-path, add a dedicated test:

```typescript
// At the top of the describe block:
vi.mock('@/lib/auth', () => ({
    isAuthenticated: vi.fn(),
}))
const mockIsAuthenticated = isAuthenticated as unknown as ReturnType<typeof vi.fn>

// In each existing subdomain test's beforeEach or inline:
mockIsAuthenticated.mockReturnValue(true)  // simulate authenticated user

// New test for ROUTE-02 behavior:
it('skips lookup for unauthenticated users and renders Outlet immediately', async () => {
    stubLocation('acme.realtybase.ca', '/dashboard', '')
    mockIsAuthenticated.mockReturnValue(false)
    renderWithProviders(...)
    await waitFor(() => expect(screen.getByText('Protected')).toBeInTheDocument())
    expect(mockLookup).not.toHaveBeenCalled()
})
```

## Warnings

### WR-01: `useEffect` captures `isAuthenticated` result at mount only — stale closure on token change within session

**File:** `frontend/src/components/common/guards/PrimaryDomainRedirect.tsx:20–44`

**Issue:** The `useEffect` has an empty dependency array `[]`. `isAuthenticated()` reads `localStorage` synchronously at mount time. If a user arrives unauthenticated (early-return fires, `ready=true`, Outlet renders, ProtectedRoute redirects to login), then logs in and navigates back to a subdomain route without a full page reload, the component may already have `ready=true` from the first mount and skip the domain lookup entirely — meaning an authenticated user bypasses the primary-domain check.

In practice, React Router unmounts and remounts layout routes on full navigations, so this race is unlikely in normal usage. However, relying on remount-triggered re-execution of effects is an implicit coupling. The dependency array omitting `isAuthenticated` (or a token value) is a correctness gap that could surface in future architectural changes (e.g., if the component is kept mounted across navigations).

**Fix:** If `isAuthenticated` is expected to be stable (no reactive reads needed), document the assumption explicitly in the component. If reactive behavior is desired, use a stable auth state value as a dependency:

```typescript
const authenticated = isAuthenticated()  // computed once, outside effect

useEffect(() => {
    if (isMainDomain() || !authenticated) {
        setReady(true)
        return
    }
    // ... lookup logic
}, [authenticated])  // re-runs if auth state changes between renders
```

Note: this would require `authenticated` to be a value (boolean) derived before the effect, which is the pattern already implied by the current code — the warning is about making the implicit explicit and guarding against future breakage.

---

_Reviewed: 2026-06-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
