---
phase: 24-domain-ui-overhaul
plan: "04"
status: complete
completed_at: "2026-05-31T07:30:00Z"
---

# Plan 24-04 Summary — Frontend Wiring

## What was built

**Task 1 — Delete dialogs**
- `DeleteDomainDialog.tsx`: AlertDialog for non-primary custom domains. Shows 30-day decommission date computed via `dayjs().add(30, 'day')`. CTA: "Begin phase-out" (destructive).
- `DeletePrimaryDomainDialog.tsx`: Dialog (not AlertDialog — Select must live inside Dialog per Pitfall 4) for primary domain deletion. Replacement dropdown pre-selects subdomain. Confirm disabled until replacement chosen. Sequential `setPrimaryAsync` → `removeCustomAsync`; partial-failure toast "Domain deletion failed — {replacementName} is now your primary domain."

**Task 2 — Context brain + container wiring**
- `addCustomDomain.ts`: Extended to `(domain, setPrimaryOnVerify = false)` — sends `set_primary_on_verify` snake_case to Rails.
- `useAddCustomDomain.ts`: mutationFn takes `{ domain, setPrimaryOnVerify }` tuple.
- `useDomainsAdminContext.ts`: Removed slot state (`slotWarning`, `subdomainSlotsBlocked`, `customSlotsBlocked`, `PhaseOutWarning`). Added `useVerifyDomain`. Exposes `verify`, `verifyingDomainId`, `setPrimaryAsync`, `removeCustomAsync`, `addCustom(domain, setPrimaryOnVerify)`.
- `DomainsAdminBoard.tsx`: Simplified to render `DomainCardList` with `deletingDomain` local state. Mounts both delete dialogs conditionally on `deletingDomain.isPrimary`.

**Task 3 — Dead file removal**
Deleted 12 superseded Phase 21 split-section components. `vite build` passes with 0 errors.

**Task 4 — Human verification**
All 9 checkpoint checks passed (approved by user). Bug found and fixed during verification: `useRole` was not falling back to `activeBrokerage.role` on the main domain (PortalAdminShell never calls `useGetCurrentUser`), causing all `Can` permission checks to return false. Fixed by reading `activeBrokerage?.role` as a fallback.

## Files modified

- `frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx` (new)
- `frontend/src/components/view/admin/domainsAdminView/DeletePrimaryDomainDialog.tsx` (new)
- `frontend/src/assets/api/admin/domains/addCustomDomain.ts` (extended)
- `frontend/src/store/hooks/Admin/Domains/useAddCustomDomain.ts` (updated mutationFn)
- `frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts` (slot removal, verify wiring)
- `frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx` (simplified)
- `frontend/src/store/hooks/Auth/useRole.ts` (activeBrokerage fallback — bug fix during verification)
- 12 Phase 21 files deleted

## Decisions

- `useRole` fallback to `activeBrokerage.role`: PortalAdminShell does not call `useGetCurrentUser`; `activeBrokerage` is always populated for portal users via `fetchAdminBrokerages` — the correct source of truth for that context.
- Partial-failure in delete-primary is accepted (T-24-12): no rollback per D-06 product decision; user sees the new state via toast + refreshed list.
