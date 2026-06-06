---
phase: 28
plan: 01
status: findings
depth: standard
files_reviewed: 2
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
reviewed: 2026-06-06
---

# Code Review: Phase 28 — Brokerage Selection Page Redesign

## Summary

Both files implement the spec correctly in structure, styling, and data rendering. One critical React anti-pattern was found: imperative `navigate()` and `dispatch()` calls in the render body instead of inside a `useEffect` or via `<Navigate>`. Two warnings cover a statically unreachable empty-state branch and a missing `type="button"` attribute inconsistent with project convention.

## Findings

### CR-01 — Imperative navigate() and dispatch() called during render body (critical)

**File:** `frontend/src/containers/portal/BrokerageSelection.tsx:52-55`
**Confidence:** 85

**Issue:** The auto-redirect block calls `dispatch()` and `navigate()` directly in the render function body, outside any effect:

```tsx
if (adminBrokerages.length === 1) {
    dispatch(setActiveBrokerage(adminBrokerages[0]))
    navigate(`/dashboard/${adminBrokerages[0].id}`, { replace: true })
    return null
}
```

React requires render to be pure with no side effects. Calling the imperative `navigate()` hook during render is a side effect — React Router v6's documented pattern for render-time redirects is the declarative `<Navigate replace />` JSX element. The `dispatch()` call during render will trigger a React warning: "Cannot update a component while rendering a different component," because Redux notifies subscribers synchronously and those subscribers may initiate React state updates during the current render cycle. In React 18 Strict Mode (double render invocation in development), both calls fire twice per mount.

**Fix — Option A (declarative, recommended):** Use `<Navigate>` for the render-time redirect and isolate the dispatch into a `useEffect`:

```tsx
useEffect(() => {
    if (!isLoading && adminBrokerages.length === 1) {
        dispatch(setActiveBrokerage(adminBrokerages[0]))
    }
}, [isLoading, adminBrokerages])

if (!isLoading && adminBrokerages.length === 1) {
    return <Navigate to={`/dashboard/${adminBrokerages[0].id}`} replace />
}
```

**Fix — Option B (minimal, co-located with fetch):** Move the single-brokerage redirect into the `.then()` handler of the existing fetch `useEffect`, where `navigate()` is safe:

```tsx
.then((data) => {
    if (cancelled) return
    dispatch(setAdminBrokerages(data.adminBrokerages))
    if (data.adminBrokerages.length === 1) {
        dispatch(setActiveBrokerage(data.adminBrokerages[0]))
        navigate(`/dashboard/${data.adminBrokerages[0].id}`, { replace: true })
    }
})
```

---

### CR-02 — Unreachable empty-state branch in main render (warning)

**File:** `frontend/src/containers/portal/BrokerageSelection.tsx:64-68`
**Confidence:** 87

**Issue:** The ternary `{adminBrokerages.length === 0 ? <empty-state> : <grid>}` inside the main return has a branch that is statically unreachable. Control flow at the main return guarantees `adminBrokerages.length >= 2`:

- `length === 0` is caught by the loading guard (returns spinner JSX)
- `length === 1` is caught by the auto-redirect (returns null / navigates)
- Only `length >= 2` reaches the main return

The "No brokerages found. Contact your administrator." message will never render. This dead code misleads maintainers into thinking a zero-brokerage post-load state is handled in the grid path.

**Fix:** Remove the ternary and render the grid unconditionally:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
    {adminBrokerages.map((brokerage) => (
        <BrokerageCard
            key={String(brokerage.id)}
            brokerage={brokerage}
            onClick={(b) => {
                dispatch(setActiveBrokerage(b))
                navigate(`/dashboard/${b.id}`)
            }}
        />
    ))}
</div>
```

---

### CR-03 — Missing type="button" on BrokerageCard button element (warning)

**File:** `frontend/src/containers/portal/BrokerageCard.tsx:11`
**Confidence:** 80

**Issue:** The `<button>` element has no `type` attribute. Per the HTML spec, `<button>` without `type` defaults to `type="submit"`. The project consistently applies `type="button"` to all non-submit interactive buttons (confirmed in `BrokerageInfoStep.tsx`, `BrandingStep.tsx`, `SuccessStep.tsx`, `DomainStep.tsx`). This is inconsistent with project convention and creates a submit foot-gun if the component is ever composed inside a form.

**Fix:**

```tsx
<button
    type="button"
    onClick={() => onClick(brokerage)}
    className="w-full text-left rounded-xl border ..."
>
```

---

## Files Reviewed

- `frontend/src/containers/portal/BrokerageCard.tsx`
- `frontend/src/containers/portal/BrokerageSelection.tsx`
