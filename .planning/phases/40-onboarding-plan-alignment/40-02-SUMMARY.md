---
phase: 40-onboarding-plan-alignment
plan: 02
subsystem: ui
tags: [react, typescript, tanstack-query, redux, onboarding, plan-tiers]

# Dependency graph
requires:
  - phase: 40-onboarding-plan-alignment (plan 01)
    provides: "GET /v1/onboarding/plan_tiers backend endpoint serializing AppConstants::PLAN_TIERS"
provides:
  - "Plan-tiers fetch stack (type + pure axios GET + useQuery hook) ready for PlanSelectionStep consumption"
  - "CreateBrokeragePlan as a single-source-of-truth 3-value union ('free'|'independent'|'growth')"
  - "Corrected submit() custom_domain gate (plan !== 'free', not the retired 'premium' literal)"
  - "3-way PlanBadge with per-tier label/variant lookup maps"
affects: [40-03 (plan-selection/domain-step UI rebuild), 41 (self-service plan management)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure axios GET (assets/api) -> useQuery wrapper (store/hooks) -> Context/Component, modeled on checkDomain.ts/useCheckDomainAvailability.ts"
    - "Record<CreateBrokeragePlan, T> lookup maps instead of binary boolean derivation for per-tier UI variants"

key-files:
  created:
    - frontend/src/assets/types/planTierType.ts
    - frontend/src/assets/api/onboarding/getPlanTiers.ts
    - frontend/src/store/hooks/Auth/useFetchPlanTiers.ts
  modified:
    - frontend/src/store/reducers/createBrokerageWizard.ts
    - frontend/src/assets/api/onboarding/createBrokerage.ts
    - frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx
    - frontend/src/components/createBrokerage/PlanBadge.tsx

key-decisions:
  - "createBrokerage.ts imports/re-exports CreateBrokeragePlan from the reducer instead of independently re-declaring the union (single source of truth, per Pitfall 1 in 40-RESEARCH.md)"
  - "submit() gates custom_domain on `wizard.plan !== 'free'` (send whenever present, for any paid tier), replacing the retired `wizard.plan === 'premium'` check"
  - "PlanBadge uses two Record<CreateBrokeragePlan, ...> lookup maps (label + variant) instead of a binary isPremium boolean; growth gets the accent 'default' variant per D-03"

requirements-completed: [ONB-05, ONB-07]

# Metrics
duration: 9min
completed: 2026-07-22
---

# Phase 40 Plan 02: Frontend Plan-Tier Contract & Plumbing Summary

**Widened `CreateBrokeragePlan` to the real 3-tier union from one source of truth, fixed the wizard's `submit()` custom_domain gate off the retired `premium` literal, built a 3-way `PlanBadge`, and shipped the plan-tiers fetch stack (type/api/hook) that Plan 03's UI will consume.**

## Performance

- **Duration:** 9 min (git commit timestamps: 19:51:15 → 19:59:53 PDT)
- **Started:** 2026-07-22T19:51:15-07:00 (Task 1, rescued commit)
- **Completed:** 2026-07-22T19:59:53-07:00 (Task 3)
- **Tasks:** 3/3 completed
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- Plan-tiers fetch stack (`planTierType.ts` → `getPlanTiers.ts` → `useFetchPlanTiers.ts`) exists end-to-end, following the `checkDomain.ts`/`useCheckDomainAvailability.ts` precedent exactly — no `camelcaseKeys` calls, correct `queryKey: ['planTiers']`.
- `CreateBrokeragePlan` is now a single 3-value union (`'free' | 'independent' | 'growth'`) declared once in `createBrokerageWizard.ts`; `createBrokerage.ts` imports and re-exports it rather than independently re-declaring `'basic' | 'premium'`.
- `submit()` in `CreateBrokerageContext.tsx` sends `custom_domain` whenever present AND `plan !== 'free'` — correct for both paid tiers, no longer gated on the retired `'premium'` literal.
- `PlanBadge.tsx` renders a distinct label for each of the three tiers via `Record<CreateBrokeragePlan, string>`/`Record<CreateBrokeragePlan, 'default' | 'secondary'>` lookup maps; Growth gets the accent `default` variant per D-03.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the plan-tiers fetch stack (type, api, hook)** - `d9fcb3b` (feat) — completed in a prior (aborted worktree) attempt, rescued into `frontend/`'s real history before this execution began; verified present and correct at the start of this run, not redone.
2. **Task 2: Widen CreateBrokeragePlan across both declarations** - `592a8ff` (feat)
3. **Task 3: Fix submit() custom_domain gate + 3-way PlanBadge** - `74997ac` (fix)

**Plan metadata:** committed as part of this SUMMARY (docs commit, see below)

_Note: Task 1 was executed and committed in an earlier, separately-aborted worktree attempt (see context_note in this executor's prompt); it is documented here as already-complete per the resume instructions, not as new work performed in this session._

## Files Created/Modified
- `frontend/src/assets/types/planTierType.ts` - `PlanTierKey` union + `PlanTier` interface (7 fields, camelCase-annotated) + `FetchPlanTiersResponse` wrapper
- `frontend/src/assets/api/onboarding/getPlanTiers.ts` - Pure axios GET returning `response.data.planTiers`, no `camelcaseKeys` call
- `frontend/src/store/hooks/Auth/useFetchPlanTiers.ts` - `useQuery` wrapper, `queryKey: ['planTiers']`, 5-minute `staleTime`
- `frontend/src/store/reducers/createBrokerageWizard.ts` - `CreateBrokeragePlan` widened to `'free' | 'independent' | 'growth'` (single source of truth)
- `frontend/src/assets/api/onboarding/createBrokerage.ts` - Removed independent `'basic' | 'premium'` re-declaration; now imports + re-exports `CreateBrokeragePlan` from the reducer
- `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx` - `submit()` custom_domain spread now gated on `wizard.plan !== 'free' && domain.customDomain`
- `frontend/src/components/createBrokerage/PlanBadge.tsx` - Replaced binary `isPremium` boolean with `labelMap`/`variantMap` `Record<CreateBrokeragePlan, ...>` lookups covering all three tiers

## Decisions Made
- Imported/re-exported `CreateBrokeragePlan` in `createBrokerage.ts` rather than keeping two independent literal declarations in lockstep — closes Pitfall 1 from 40-RESEARCH.md permanently (a future tier addition only requires editing the reducer file).
- No changes made to `DomainStep.tsx` in this plan — its `isPremium` occurrences (including the untracked error-attribution branch at line ~80 flagged by Pitfall 4) remain out of scope per this plan's `files_modified` list and are explicitly Plan 03's responsibility (UI rebuild wave). Confirmed via grep that `DomainStep.tsx:15` still reads `state.plan === 'premium'` — this is expected, not a stub or regression, since Plan 03 owns that file.

## Deviations from Plan

None - plan executed exactly as written. Task 1 was already complete and verified via the rescued commit `d9fcb3b`; Tasks 2 and 3 were executed and verified against all `<verify>`/`<acceptance_criteria>` gates in the plan with no auto-fixes needed.

## Issues Encountered

None. All three plan-scoped verification commands passed cleanly:
- `grep -rn "'basic'\|'premium'" src/store/reducers/createBrokerageWizard.ts src/assets/api/onboarding/createBrokerage.ts src/components/createBrokerage/PlanBadge.tsx` → no matches
- `node -e "require('fs').accessSync('src/store/hooks/Auth/useFetchPlanTiers.ts')"` → succeeded
- Per 40-RESEARCH.md Pitfall 2, repo-wide `tsc --noEmit` was not used as a gate (pre-existing `moduleResolution` mismatch, documented in STATE.md); the grep gates and file-existence checks above are the plan's designated verification method.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03 can now safely rebuild `PlanSelectionStep.tsx` (consuming `useFetchPlanTiers`) and `DomainStep.tsx` (3-way plan gating + Yes/No custom-domain-ownership toggle) against a stable, single-source-of-truth `CreateBrokeragePlan` type and a working plan-tiers data fetch. No blockers.

---
*Phase: 40-onboarding-plan-alignment*
*Completed: 2026-07-22*

## Self-Check: PASSED

All 7 created/modified files verified present on disk; all 3 task commits (`d9fcb3b`, `592a8ff`, `74997ac`) verified present in `frontend`'s git history.
