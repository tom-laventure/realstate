---
phase: 21
status: findings
findings_count: 7
severity_breakdown: {critical: 0, high: 2, medium: 3, low: 2}
---

# Phase 21: Code Review Report

**Reviewed:** 2026-05-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** findings

## Summary

Phase 21 introduces a `PrimaryDomainRedirect` layout-route guard and a full domain management admin UI (subdomain editing, custom domain add/remove, set-primary, decommission). The overall architecture is sound — the data flow follows project conventions, the context/hook/API layers are correctly separated, and the slug validation logic is well-structured.

Two high-priority defects were found:

1. The `lookupDomain` fallback for `VITE_BE_ENDPOINT` creates an open redirect: the guard will `window.location.replace` to any origin returned by the backend with no validation that the target is an expected domain, and the domain being passed to the endpoint is taken directly from `window.location.hostname` with no sanitisation check.
2. `AddCustomDomainForm` submits after resetting its local state to `''` while the mutation is still in flight — because `disabled` is never wired to the hook's `isPending` state, the user can submit the same domain multiple times before the first request completes.

Three medium-priority issues address incorrect/missing slot-blocking behaviour for custom domains, a blank-screen UX regression in the guard, and a subtle redundant-`onCancel` double-call in `RemoveNowDialog`. Two low-priority items cover a hardcoded base-domain string and a missing `React` import declaration.

---

## High Issues

### HR-01: Open redirect in PrimaryDomainRedirect — response domain accepted without validation

**File:** `frontend/src/components/common/guards/PrimaryDomainRedirect.tsx:29-32`

**Issue:** The guard calls `window.location.replace(\`https://${data.domain}...\`)` using `data.domain` returned directly from the API with no validation that the value is a known/expected hostname. If the `/v1/domains/lookup` endpoint is ever compromised, returns unexpected data, or a misconfigured CORS-exempt network path is exploited to supply a crafted response, the browser will navigate to an arbitrary origin. The comment correctly notes this is "UX-only — not a security boundary," but an unvalidated `window.location.replace` still constitutes a client-side open redirect that could be used for phishing.

The `domain` parameter sent to the endpoint also comes straight from `window.location.hostname` with no sanitisation, but because it is a query param on a GET request to the app's own backend, the actual injection risk is low — the hostname is browser-controlled. The response side is the real concern.

**Fix:** Validate that `data.domain` belongs to the same root domain as the app before redirecting. The expected domains are already constrained by `VITE_MAIN_DOMAIN` and the brokerage subdomain pattern. A minimal guard:

```ts
const ALLOWED_SUFFIX = import.meta.env.VITE_MAIN_DOMAIN as string // e.g. "realstate.app"

if (
    data?.domain &&
    data.domain !== hostname &&
    (data.domain === ALLOWED_SUFFIX || data.domain.endsWith(`.${ALLOWED_SUFFIX}`))
) {
    const primaryUrl = `https://${data.domain}${window.location.pathname}${window.location.search}`
    window.location.replace(primaryUrl)
} else {
    setReady(true)
}
```

---

### HR-02: Double-submit possible — AddCustomDomainForm clears state and re-enables before mutation completes

**File:** `frontend/src/components/view/admin/domainsAdminView/AddCustomDomainForm.tsx:20-25` and `frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx` / `useDomainsAdminContext.ts`

**Issue:** `handleSubmit` calls `setValue('')` immediately after `onSubmit(trimmed)` (line 23-24). `onSubmit` fires `addCustomMutation` (a TanStack Query mutation). Because the form's `disabled` prop only reflects what the parent passes in, and `DomainsAdminView` / `DomainsAdminBoard` never passes `disabled={true}` during the mutation's pending state, the form reverts to an empty-but-enabled state instantly. A user who types a second domain and clicks "Add domain" again before the first request resolves will fire two concurrent `POST /v1/admin/domains/custom` requests. The second may succeed (adding a duplicate or consuming a slot unexpectedly) or cause a 422 that the user sees as an error with no explanation.

**Fix:** Thread `isPending` from the mutation back through to the form's `disabled` prop, or close the add form until `onSuccess`/`onError` fires:

In `useDomainsAdminContext.ts`:
```ts
const { mutate: addCustomMutation, isPending: isAddingCustom } = useAddCustomDomain(setSlotWarning)
```
Expose `isAddingCustom` in the state object and pass it as `disabled` to `AddCustomDomainForm`. Alternatively, move `setIsAddingCustom(false)` to the mutation's `onSuccess`/`onError` callbacks (in the hook or via a callback prop) rather than calling it synchronously in `handleAddCustomSubmit`.

---

## Medium Issues

### MR-01: customSlotsBlocked does not gate the "Add domain" button correctly when slots are consumed by active domains

**File:** `frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts:38-41`

**Issue:** `customSlotsBlocked` counts only `phasing_out` custom domains (≥ 2 means blocked). However, based on the same slot logic applied to subdomains (Pitfall 5 comment in the file), the backend enforces a per-type slot cap across both active and phasing-out domains — the phasing-out count specifically represents consumed slots that haven't freed yet. If the intent is that `customSlotsBlocked` prevents adding new custom domains when no slots remain, and the slot cap is defined as "2 phasing-out custom domains", then the current logic is correct as-written. But the `subdomainSlotsBlocked` flag also gates the subdomain Edit button — for custom domains there is no analogous UI block on the "Remove" button (which triggers a phase-out that consumes a slot). The "Add domain" button is hidden when `customSlotsBlocked`, but a user with 2 phasing-out customs can still see the "Remove" button on active custom domains in `DomainCard`, which calls `onRemoveCustom` → backend phase-out → backend 422 slot error → generic toast "Something went wrong." The user gets no contextual explanation.

**Fix:** When `customSlotsBlocked`, disable or hide the "Remove" button on active custom domains in `DomainCard`, similar to how Edit is disabled for subdomains when `slotsBlocked`. Pass `customSlotsBlocked` down through `CustomDomainList` → `DomainCard` analogously to how `slotsBlocked` is passed for subdomains.

---

### MR-02: Blank screen on slow networks — PrimaryDomainRedirect renders null with no timeout bound

**File:** `frontend/src/components/common/guards/PrimaryDomainRedirect.tsx:44-46`

**Issue:** The component renders `null` (blank screen) for the entire duration of the `lookupDomain` request (comment D-02 confirms this is intentional). There is no timeout: if the backend is slow or unreachable, the user sees a blank page indefinitely. `lookupDomain` uses the bare `axios` instance with no timeout configured, and the `catch` block only fires on network error or non-2xx — a stalled connection will hang for the browser's default timeout (typically 2 minutes on some browsers). The `fetch` / `axios` default is no timeout at all in some environments.

**Fix:** Add a timeout to the `lookupDomain` call so the guard always fails open within a bounded time:

```ts
const response = await axios.get<LookupDomainResponse>(`${baseUrl}/v1/domains/lookup`, {
    params: { domain },
    timeout: 3000,  // 3 s — fail open after this
})
```

---

### MR-03: RemoveNowDialog fires onCancel twice when the user clicks "Keep domain"

**File:** `frontend/src/components/view/admin/domainsAdminView/RemoveNowDialog.tsx:22,31`

**Issue:** The `onOpenChange` handler on line 22 calls `onCancel()` whenever `next` is `false`. The `AlertDialogCancel` button on line 31 also calls `onClick={onCancel}`. When the user clicks "Keep domain", both fire: shadcn/ui's `AlertDialogCancel` closes the dialog (triggering `onOpenChange(false)`) and the explicit `onClick` handler also runs. This means `onCancel` (which in `DomainCard` sets `removeDialogOpen(false)` and in `FreeSlotAccordion` sets `confirmId(null)`) is called twice per cancel. The double-call is harmless today because setting state to its current value is a no-op in React, but it is fragile: any future `onCancel` with a side effect (API call, navigation) would fire twice.

**Fix:** Remove the redundant `onClick={onCancel}` from `AlertDialogCancel` — `onOpenChange` already handles closure:

```tsx
<AlertDialogCancel>Keep domain</AlertDialogCancel>
```

---

## Low Issues

### LR-01: `baseDomain` hardcoded to `'realstate.app'` in two components

**File:** `frontend/src/components/view/admin/domainsAdminView/DomainSlugInput.tsx:18` and `frontend/src/components/view/admin/domainsAdminView/SubdomainCardEditForm.tsx:10`

**Issue:** Both components default `baseDomain` to the string `'realstate.app'`. If the base domain changes or the app is white-labeled, these defaults silently display the wrong suffix. The backend-derived `domain` field on existing `BrokerageDomain` records would show the correct suffix, but the edit form preview would show an incorrect one until the prop is explicitly threaded through.

**Fix:** Source the base domain from `import.meta.env.VITE_MAIN_DOMAIN` or derive it from the existing subdomain's suffix (split the current domain on the first `.` and take the remainder) rather than hardcoding it.

---

### LR-02: Missing `React` import in `AddCustomDomainForm.tsx`

**File:** `frontend/src/components/view/admin/domainsAdminView/AddCustomDomainForm.tsx:1`

**Issue:** The file uses JSX (`<form>`, `<Input>`, `<Button>`) but does not import `React`. This works in React 17+ with the automatic JSX transform, which Vite enables by default — so it will not cause a runtime error in the current build. However, it is inconsistent with several other files in the same directory (e.g., `DomainCard.tsx`, `SubdomainsSection.tsx`, `FreeSlotAccordion.tsx`) which all explicitly import `React`. The project convention is mixed, but consistency within the same feature directory matters for maintainability.

**Fix:**
```ts
import React, { FormEvent, useState } from 'react'
```

---

_Reviewed: 2026-05-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
