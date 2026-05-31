---
phase: 24-domain-ui-overhaul
plan: "02"
subsystem: frontend-domains
tags: [domains, types, hooks, tooltip, verify, typescript]
dependency_graph:
  requires:
    - POST /v1/admin/domains/:id/verify (Plan 24-01)
    - frozen domains in backend index scope (Plan 24-01)
  provides:
    - DomainStatus union with pending and frozen values
    - BrokerageDomain interface with lastCheckedAt, consecutiveFailures, verified, verifiedAt
    - VerifyDomainResponse interface
    - useVerifyDomain with rescue detection (phasing_out -> active)
    - useAddCustomDomain with no callback parameters
    - useRemoveCustomDomain with no callback parameters
    - shadcn Tooltip component (TooltipProvider, TooltipTrigger, TooltipContent)
  affects:
    - frontend/src/assets/types/domainType.ts
    - frontend/src/assets/api/admin/domains/verifyDomain.ts
    - frontend/src/store/hooks/Admin/Domains/useVerifyDomain.ts
    - frontend/src/store/hooks/Admin/Domains/useAddCustomDomain.ts
    - frontend/src/store/hooks/Admin/Domains/useRemoveCustomDomain.ts
    - frontend/src/components/ui/tooltip.tsx
tech_stack:
  added:
    - "@radix-ui/react-tooltip (via shadcn Tooltip install)"
  patterns:
    - onMutate snapshot for pre-mutation cache state capture
    - Rescue detection via previousStatus comparison in onSuccess
    - VerifyDomainResponse with optional domain object (serialized backend response)
key_files:
  created:
    - frontend/src/components/ui/tooltip.tsx
  modified:
    - frontend/src/assets/types/domainType.ts
    - frontend/src/assets/api/admin/domains/verifyDomain.ts
    - frontend/src/store/hooks/Admin/Domains/useVerifyDomain.ts
    - frontend/src/store/hooks/Admin/Domains/useAddCustomDomain.ts
    - frontend/src/store/hooks/Admin/Domains/useRemoveCustomDomain.ts
    - frontend/package.json
    - frontend/package-lock.json
decisions:
  - "useVerifyDomain uses onMutate snapshot (not response comparison only) to detect phasing_out -> active rescue per D-11"
  - "FetchDomainsResponse type used in getQueryData generic for type-safe cache access"
  - "verifyDomain.ts drops the old local VerifyDomainResponse type — uses the canonical type from domainType.ts"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-31T06:15:00Z"
  tasks_completed: 3
  files_changed: 8
---

# Phase 24 Plan 02: Frontend Type Contract and Hook Layer Summary

**One-liner:** Extended DomainStatus/BrokerageDomain types with pending/frozen/verification fields, repointed verifyDomain to the admin endpoint with phasing_out-to-active rescue detection, removed slot-warning callbacks from add/remove hooks, and installed shadcn Tooltip.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend domainType.ts and install shadcn Tooltip | 13eea40 | domainType.ts, tooltip.tsx, package.json, package-lock.json |
| 2 | Repoint verifyDomain API module + add rescue detection to useVerifyDomain | 8575257 | verifyDomain.ts, useVerifyDomain.ts |
| 3 | Remove slot-warning callbacks from useAddCustomDomain and useRemoveCustomDomain | bbdc284 | useAddCustomDomain.ts, useRemoveCustomDomain.ts |

## What Was Built

### Task 1: Types and Tooltip

- Extended `DomainStatus` union from `'active' | 'phasing_out' | 'decommissioned'` to include `'pending' | 'frozen'` — covering all Phase 24 lifecycle states.
- Added four fields to `BrokerageDomain`: `lastCheckedAt: string | null`, `consecutiveFailures: number`, `verified: boolean`, `verifiedAt: string | null` — mirroring the backend serializer output from Phase 22.
- Added `VerifyDomainResponse` interface with optional `verified`, `domain`, `domains`, and `error` fields — matching both success and failure shapes from the verify endpoint.
- Installed shadcn Tooltip via `npx --yes shadcn@latest add tooltip` — generates `tooltip.tsx` with `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` exports; adds `@radix-ui/react-tooltip` to `package.json`.

### Task 2: verifyDomain API Module + useVerifyDomain Hook

- Rewrote `verifyDomain.ts`: removed the old local `VerifyDomainResponse` type (was `{ verified: boolean; domain?: string; ... }`), now imports `VerifyDomainResponse` from `domainType.ts` and posts to `/v1/admin/domains/${domainId}/verify`. No `camelcaseKeys` call (Axios interceptor handles this).
- Rewrote `useVerifyDomain.ts` with `onMutate` snapshot pattern: captures `previousStatus` from the TanStack Query cache before the mutation fires.
- `onSuccess` implements three-path rescue detection:
  1. `phasing_out` → `active` transition: fires rescue toast "Domain rescued — phase-out has been cancelled" (D-11, D-12)
  2. `active` status or `verified: true`: fires "Domain verified successfully"
  3. Otherwise: fires error toast with `data.error` or fallback message
- Cache invalidation via `queryClient.invalidateQueries({ queryKey: domainsKeys.all })` on all success paths.

### Task 3: Add/Remove Hook Cleanup

- `useAddCustomDomain`: removed `onPhaseOutWarning` callback parameter and `PhaseOutWarning` import; updated success toast from "Custom domain added." to "Domain added — verification pending" (D-10).
- `useRemoveCustomDomain`: removed `onPhaseOutWarning` callback parameter and `PhaseOutWarning` import; kept existing "Domain removed." toast and `removeDomain` import name unchanged.
- Both hooks now take no parameters — slot-warning coupling is fully removed from the hook layer.

## Verification Results

```
Task 1: grep checks for 'pending', 'frozen', consecutiveFailures, VerifyDomainResponse in domainType.ts — OK
Task 1: tooltip.tsx exists and contains TooltipProvider — OK
Task 1: @radix-ui/react-tooltip in package.json — OK
Task 2: verifyDomain.ts posts to /v1/admin/domains/${domainId}/verify — OK
Task 2: useVerifyDomain contains onMutate, phasing_out detection, rescue toast — OK
Task 3: no onPhaseOutWarning in add or remove hooks — OK
Task 3: 'Domain added — verification pending' in useAddCustomDomain — OK
tsc --noEmit: 0 errors in modified files (2 pre-existing tsconfig config errors, unrelated) — OK
```

## Deviations from Plan

### Auto-fixed Issues

None.

### Notes

- The pre-existing tsconfig.json has 2 configuration errors (`moduleResolution` and `resolveJsonModule` arguments) that exist before and after this plan — these are pre-existing issues, not introduced by this plan. No errors originate in the five modified files.
- `useVerifyDomain` uses `FetchDomainsResponse` (from `domainType.ts` via `fetchDomains.ts` re-export) as the `getQueryData` generic — this is more type-safe than the inline shape specified in the plan, which matches the actual cache shape exactly.

## Known Stubs

None — all type definitions mirror real backend serializer output from Phase 22 and Phase 24 Plan 01.

## Threat Flags

No new network endpoints or trust boundaries beyond the plan's threat model (T-24-05 through T-24-07). All client-side mitigations are structural:
- T-24-05: `domainId` sourced from server-rendered domain list (TanStack cache); backend re-scopes via `Current.brokerage.brokerage_domains`.
- T-24-07: Axios interceptor attaches Cognito idToken automatically on all requests including verify.

## Self-Check: PASSED

- `frontend/src/assets/types/domainType.ts` contains 'pending', 'frozen', consecutiveFailures, VerifyDomainResponse — FOUND
- `frontend/src/components/ui/tooltip.tsx` exists and contains TooltipProvider — FOUND
- `frontend/src/assets/api/admin/domains/verifyDomain.ts` posts to admin endpoint — FOUND
- `frontend/src/store/hooks/Admin/Domains/useVerifyDomain.ts` contains onMutate and rescue detection — FOUND
- `frontend/src/store/hooks/Admin/Domains/useAddCustomDomain.ts` has no onPhaseOutWarning — CONFIRMED
- `frontend/src/store/hooks/Admin/Domains/useRemoveCustomDomain.ts` has no onPhaseOutWarning — CONFIRMED
- Commits 13eea40, 8575257, bbdc284 all exist in git log — FOUND
