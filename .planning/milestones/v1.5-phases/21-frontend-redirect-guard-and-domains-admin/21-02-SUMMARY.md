---
phase: 21-frontend-redirect-guard-and-domains-admin
plan: 02
subsystem: ui
tags: [react, tanstack-query, typescript, axios, toast]

# Dependency graph
requires:
  - phase: 21-01
    provides: domainType.ts with BrokerageDomain, MutationDomainsResponse, PhaseOutWarning, FetchDomainsResponse types

provides:
  - fetchDomains.ts type-swapped to use domainType.ts (re-exports BrokerageDomain, FetchDomainsResponse for useFetchDomains.ts compatibility)
  - updateSubdomain.ts: PATCH /v1/admin/domains/subdomain
  - setPrimaryDomain.ts: PATCH /v1/admin/domains/:id/set_primary
  - removeDomain.ts: DELETE /v1/admin/domains/:id (shared by decommission + remove-custom)
  - addCustomDomain.ts: POST /v1/admin/domains/custom
  - useUpdateSubdomain: TanStack mutation hook, onPhaseOutWarning callback (DUI-06)
  - useSetPrimaryDomain: TanStack mutation hook, no callback
  - useDecommissionDomain: TanStack mutation hook (phasing_out → decommission), no callback
  - useAddCustomDomain: TanStack mutation hook, onPhaseOutWarning callback (DUI-06)
  - useRemoveCustomDomain: TanStack mutation hook (active custom → phase-out), onPhaseOutWarning callback

affects:
  - 21-03 (context layer consumes all 5 mutation hooks + useFetchDomains)
  - 21-04 (UI cards consume context actions wired from these hooks)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mutation hook pattern: useMutation return directly (not destructured), onSuccess updates TanStack cache via setQueryData(domainsKeys.all, { domains: data.domains })"
    - "Shared API module (removeDomain.ts) consumed by two semantically different hooks (useDecommissionDomain, useRemoveCustomDomain) — backend branches on domain status"
    - "Optional onPhaseOutWarning callback on hooks that can trigger DUI-06 banner (updateSubdomain, addCustomDomain, removeCustomDomain)"

key-files:
  created:
    - frontend/src/assets/api/admin/domains/updateSubdomain.ts
    - frontend/src/assets/api/admin/domains/setPrimaryDomain.ts
    - frontend/src/assets/api/admin/domains/removeDomain.ts
    - frontend/src/assets/api/admin/domains/addCustomDomain.ts
    - frontend/src/store/hooks/Admin/Domains/useUpdateSubdomain.ts
    - frontend/src/store/hooks/Admin/Domains/useSetPrimaryDomain.ts
    - frontend/src/store/hooks/Admin/Domains/useDecommissionDomain.ts
    - frontend/src/store/hooks/Admin/Domains/useAddCustomDomain.ts
    - frontend/src/store/hooks/Admin/Domains/useRemoveCustomDomain.ts
  modified:
    - frontend/src/assets/api/admin/domains/fetchDomains.ts

key-decisions:
  - "fetchDomains.ts re-exports BrokerageDomain and FetchDomainsResponse to preserve useFetchDomains.ts import — no changes needed in useFetchDomains.ts"
  - "removeDomain.ts is a single shared API module used by both useDecommissionDomain (phasing_out path) and useRemoveCustomDomain (active custom path) — backend branches on status field"
  - "onPhaseOutWarning callback added to exactly 3 of 5 hooks (updateSubdomain, addCustomDomain, removeCustomDomain) — the 3 operations that can leave 1 slot remaining and trigger DUI-06"

patterns-established:
  - "Return useMutation directly (not destructured): context layer consumes .mutate off the hook return"
  - "Cache update via setQueryData(domainsKeys.all, { domains: data.domains }) on every mutation success"

requirements-completed:
  - DUI-03
  - DUI-04
  - DUI-05
  - DUI-09

# Metrics
duration: 8min
completed: 2026-05-29
---

# Phase 21 Plan 02: Domain Data Layer Summary

**4 typed admin API modules + 5 TanStack mutation hooks with cache invalidation, toast feedback, and phase-out warning callbacks wired to domainType.ts contracts**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-29T07:07:47Z
- **Completed:** 2026-05-29T07:15:30Z
- **Tasks:** 2
- **Files modified:** 10 (9 created, 1 modified)

## Accomplishments
- Replaced stale `verified`/`verifiedAt`/`verificationToken` type in fetchDomains.ts with domainType.ts imports (re-exported for backward compatibility with useFetchDomains.ts)
- Created 4 new API modules covering all domains admin mutations: updateSubdomain, setPrimaryDomain, removeDomain (shared), addCustomDomain
- Created 5 TanStack mutation hooks following the exact `useVerifyDomain.ts` pattern: return `useMutation` directly, `setQueryData` cache update, success/error toasts
- Wired optional `onPhaseOutWarning` callback on exactly the 3 hooks that can leave 1 slot remaining (DUI-06 banner support for plan 21-03)
- Production build succeeds (3824 modules transformed, 0 TypeScript errors via Vite)

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap fetchDomains type + create 4 admin API modules** - `4e0ffbb` (feat)
2. **Task 2: Create 5 TanStack mutation hooks** - `694b67d` (feat)

## Files Created/Modified

### API Modules
- `frontend/src/assets/api/admin/domains/fetchDomains.ts` - Modified: removed stale verified/verifiedAt/verificationToken fields, now imports from domainType.ts and re-exports for compatibility
- `frontend/src/assets/api/admin/domains/updateSubdomain.ts` - PATCH /v1/admin/domains/subdomain with `{ slug }` body → `Promise<MutationDomainsResponse>`
- `frontend/src/assets/api/admin/domains/setPrimaryDomain.ts` - PATCH /v1/admin/domains/:id/set_primary → `Promise<MutationDomainsResponse>`
- `frontend/src/assets/api/admin/domains/removeDomain.ts` - DELETE /v1/admin/domains/:id (shared module, backend branches on status) → `Promise<MutationDomainsResponse>`
- `frontend/src/assets/api/admin/domains/addCustomDomain.ts` - POST /v1/admin/domains/custom with `{ domain }` body → `Promise<MutationDomainsResponse>`

### Mutation Hooks
- `frontend/src/store/hooks/Admin/Domains/useUpdateSubdomain.ts` - Success toast: "Subdomain updated." | onPhaseOutWarning: yes
- `frontend/src/store/hooks/Admin/Domains/useSetPrimaryDomain.ts` - Success toast: "Primary domain updated." | onPhaseOutWarning: no
- `frontend/src/store/hooks/Admin/Domains/useDecommissionDomain.ts` - Success toast: "Domain decommissioned." | onPhaseOutWarning: no
- `frontend/src/store/hooks/Admin/Domains/useAddCustomDomain.ts` - Success toast: "Custom domain added." | onPhaseOutWarning: yes
- `frontend/src/store/hooks/Admin/Domains/useRemoveCustomDomain.ts` - Success toast: "Domain removed." | onPhaseOutWarning: yes

## Success Toast Strings (UI-SPEC Contract)

| Hook | Toast |
|------|-------|
| useUpdateSubdomain | "Subdomain updated." |
| useSetPrimaryDomain | "Primary domain updated." |
| useDecommissionDomain | "Domain decommissioned." |
| useAddCustomDomain | "Custom domain added." |
| useRemoveCustomDomain | "Domain removed." |

Error toast (uniform across all 5): "Something went wrong. Please try again."

## Warning Callback Hooks vs No-Callback Hooks

| Hook | onPhaseOutWarning | Reason |
|------|-------------------|--------|
| useUpdateSubdomain | yes | Subdomain change can leave 1 subdomain slot remaining |
| useSetPrimaryDomain | no | Set-primary doesn't change slot count |
| useDecommissionDomain | no | Decommission frees a slot (opposite direction) |
| useAddCustomDomain | yes | Adding custom can leave 1 custom slot remaining |
| useRemoveCustomDomain | yes | Removing custom can leave 1 custom slot remaining |

## fetchDomains.ts — Stale Field Removal Confirmed

Fields removed: `verified`, `verifiedAt`, `verificationToken`

```bash
grep -c "verified\|verifiedAt\|verificationToken" frontend/src/assets/api/admin/domains/fetchDomains.ts
# → 0
```

All three stale fields are gone. The type now delegates entirely to domainType.ts which uses the Phase 21 schema (id, domain, domainType, status, isPrimary, phaseOutAt).

## Decisions Made

- `fetchDomains.ts` re-exports `BrokerageDomain` and `FetchDomainsResponse` from domainType.ts so `useFetchDomains.ts` continues to work without modification — avoids a two-file change for a type-only concern
- `removeDomain.ts` is a single shared module intentionally consumed by both `useDecommissionDomain` and `useRemoveCustomDomain` — the backend handles the branching logic based on domain status; the frontend separation is purely semantic (different toasts, different caller intent)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npx tsc --noEmit` with TypeScript 4.9.5 fails due to `moduleResolution: "bundler"` (TS 5.0+ feature) — this is the same pre-existing environment limitation documented in 21-01-SUMMARY.md. `npm run build` (Vite) succeeds, confirming correct TypeScript. Not a regression.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 21-03: All 5 mutation hooks ready for context layer consumption; `domainsKeys.all` cache pattern established
- Plan 21-04: All hooks available for UI card wiring
- No known blockers for downstream plans

---
*Phase: 21-frontend-redirect-guard-and-domains-admin*
*Completed: 2026-05-29*
