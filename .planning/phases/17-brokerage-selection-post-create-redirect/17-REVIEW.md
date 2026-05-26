---
phase: 17
status: has_findings
files_reviewed: 8
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
---

## Code Review — Phase 17

### Summary

Phase 17 introduces a Redux slice for active brokerage state, a brokerage selection screen, a portal shell placeholder, and a post-create redirect from `SuccessStep`. The overall architecture is sound: the Redux slice correctly follows the `createBrokerageWizard` pattern, auth token handling in `LoginSuccessful` is correct (token written to localStorage before the API fetch, hash cleared before navigate), `isSafeRedirectHost` in `SuccessStep` correctly validates redirect targets, and the `renderWithProviders` test helper is properly wired. Two logic bugs exist at the boundary between Redux state and direct URL navigation: `BrokerageSelection` renders a broken empty card when `adminBrokerages` is not yet populated (any path that bypasses `LoginSuccessful` triggers this), and `PortalShell` has no inflight-fetch cleanup, leaving a race condition where stale dispatches can fire if `brokerageId` changes while a fetch is pending.

### Findings

### CR-001 (warning): BrokerageSelection renders broken empty UI on direct URL navigation
**File:** `frontend/src/containers/portal/BrokerageSelection.tsx`
**Confidence:** 90

**Issue:** `BrokerageSelection` handles only two cases: `adminBrokerages.length === 1` (auto-redirect via `useEffect`) and `length > 1` (render cards). When `length === 0` — which occurs on any direct navigation to `/dashboard` that bypasses `LoginSuccessful` (bookmark, hard reload, browser back after session expiry, or CI test render) — the `useEffect` is a no-op and the component falls through to render the selection card shell with an empty list. The user sees "Select a brokerage" with no cards and no actionable path forward. Unlike `PortalShell`, which explicitly handles the empty-Redux case via a fetch-and-validate pattern (D-13), `BrokerageSelection` has no equivalent recovery.

**Fix:** Add an explicit `length === 0` branch that mirrors the D-13 pattern from `PortalShell`. Introduce a `isLoading` state and return a spinner during fetch so the empty card never appears:

```tsx
const [isLoading, setIsLoading] = useState(false)

useEffect(() => {
    if (adminBrokerages.length === 0) {
        setIsLoading(true)
        fetchAdminBrokerages()
            .then((data) => {
                dispatch(setAdminBrokerages(data.adminBrokerages))
                if (data.adminBrokerages.length === 1) {
                    dispatch(setActiveBrokerage(data.adminBrokerages[0]))
                    navigate(`/dashboard/${data.adminBrokerages[0].id}`, { replace: true })
                }
            })
            .catch(() => navigate('/no-access', { replace: true }))
            .finally(() => setIsLoading(false))
    } else if (adminBrokerages.length === 1) {
        dispatch(setActiveBrokerage(adminBrokerages[0]))
        navigate(`/dashboard/${adminBrokerages[0].id}`, { replace: true })
    }
}, [adminBrokerages, dispatch, navigate])

if (isLoading || adminBrokerages.length === 0 || adminBrokerages.length === 1) return <LoadingSpinner />
```

---

### CR-002 (warning): PortalShell async fetch has no cleanup — stale dispatch fires on rapid brokerageId change
**File:** `frontend/src/containers/portal/PortalShell.tsx`
**Confidence:** 82

**Issue:** The `fetchAdminBrokerages()` call in the D-13 empty-Redux path has no abort or stale-check guard. If `brokerageId` changes while a fetch is in-flight, both `.then()` handlers fire. The first resolves with stale data for the old `brokerageId` captured in the closure and may call `navigate('/dashboard', { replace: true })` incorrectly, or dispatch `setActiveBrokerage` for the wrong brokerage. Phase 18 will wire `activeBrokerage.id` into API request headers for brokerage-scoped calls; a one-render corruption of that value will send requests to the wrong brokerage.

**Fix:** Add a `cancelled` boolean in the effect's cleanup return:

```tsx
useEffect(() => {
    let cancelled = false

    if (!brokerageId) {
        navigate('/dashboard', { replace: true })
        return
    }

    if (adminBrokerages.length > 0) {
        const match = adminBrokerages.find((b) => b.id === brokerageId)
        if (match) dispatch(setActiveBrokerage(match))
        else navigate('/dashboard', { replace: true })
        return
    }

    setIsLoading(true)
    fetchAdminBrokerages()
        .then((data) => {
            if (cancelled) return
            dispatch(setAdminBrokerages(data.adminBrokerages))
            const match = data.adminBrokerages.find((b) => b.id === brokerageId)
            if (match) dispatch(setActiveBrokerage(match))
            else navigate('/dashboard', { replace: true })
        })
        .catch(() => { if (!cancelled) navigate('/dashboard', { replace: true }) })
        .finally(() => { if (!cancelled) setIsLoading(false) })

    return () => { cancelled = true }
}, [brokerageId])
```

---

### CR-003 (info): PortalShell useEffect omits adminBrokerages from dependency array without a suppression comment
**File:** `frontend/src/containers/portal/PortalShell.tsx`
**Confidence:** 80

**Issue:** The dependency array `[brokerageId]` intentionally omits `adminBrokerages`, which is read inside the effect. The omission is architecturally correct — re-running on every Redux list update would cause a dispatch loop — but it is undocumented. Without a comment, a future `react-hooks/exhaustive-deps` ESLint rule will flag the omission and a maintainer may add `adminBrokerages` to the array, introducing a re-render loop.

**Fix:** Add an inline suppression comment:

```tsx
// eslint-disable-next-line react-hooks/exhaustive-deps -- brokerageId is the only trigger.
// adminBrokerages intentionally excluded: the effect runs once per brokerageId change,
// not on every Redux list mutation. The D-13 fetch branch populates adminBrokerages itself.
}, [brokerageId])
```

---

## Self-Check: PASSED
