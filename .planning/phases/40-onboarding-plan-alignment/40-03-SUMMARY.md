---
phase: 40-onboarding-plan-alignment
plan: 03
subsystem: ui
tags: [react, typescript, tanstack-query, onboarding, plan-tiers, radio-group]

# Dependency graph
requires:
  - phase: 40-onboarding-plan-alignment (plan 01)
    provides: "GET /v1/onboarding/plan_tiers backend endpoint serializing AppConstants::PLAN_TIERS"
  - phase: 40-onboarding-plan-alignment (plan 02)
    provides: "Plan-tiers fetch stack (planTierType.ts / getPlanTiers.ts / useFetchPlanTiers.ts) and the widened CreateBrokeragePlan union"
provides:
  - "3-card plan-selection UI (Free/Independent/Growth) with price/seat/flag-derived features, Growth recommended, loading + error states"
  - "Plan-based custom-domain gating in DomainStep with an optional Yes/No ownership toggle, no required-field validation for any tier"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Formula-derived PlanCard feature rows (seat wording + 4 boolean flags + always-included subdomain row) instead of hardcoded per-tier copy arrays"
    - "RadioGroup as a binary Yes/No toggle gating a reveal/hide input block, mirroring RemoveOwnerDialog.tsx"

key-files:
  created: []
  modified:
    - frontend/src/components/createBrokerage/PlanCard.tsx
    - frontend/src/containers/createBrokerage/steps/PlanSelectionStep.tsx
    - frontend/src/containers/createBrokerage/steps/DomainStep.tsx

key-decisions:
  - "PlanCard feature rows follow the plan's literal derivation formula (seat wording, realBoards, clients, customDomain, calendarSync, always-included subdomain) rather than the UI-SPEC's slightly differently-worded per-tier bullet lists (e.g. Free's 'Demo TEST board with sample listings' line has no backing flag) — keeps every bullet traceable to a fetched boolean, per D-02's anti-hardcoding intent"
  - "Every isPremium occurrence in DomainStep.tsx (gating, check-enable condition, error attribution, description copy, field visibility) re-scoped to showCustomDomain = state.plan !== 'free', confirmed via grep -c isPremium returning 0"
  - "Required-field validation for custom domain removed entirely; only format + already-registered checks run, and only when a value is present — no tier can block signup on a missing custom domain"

requirements-completed: [ONB-05, ONB-06]

# Metrics
duration: 8min
completed: 2026-07-22
---

# Phase 40 Plan 03: Plan-Selection & Domain Step UI Rebuild Summary

**Rebuilt the plan-selection step into a real 3-card fetch (Free/Independent/Growth, price/seat/flag-derived features, Growth recommended, loading/error states) and replaced DomainStep's isPremium-gated required custom-domain field with a plan-based Yes/No ownership toggle where a custom domain is optional for every tier.**

## Performance

- **Duration:** ~8 min (git commit timestamps: 20:06:13 → 20:07:01 PDT, plus upstream reading/planning time)
- **Started:** 2026-07-22T20:06:13-07:00 (Task 1 commit)
- **Completed:** 2026-07-22T20:07:01-07:00 (Task 2 commit)
- **Tasks:** 2/2 completed
- **Files modified:** 3

## Accomplishments
- `PlanCard.tsx` gained a required `price` prop rendered as `text-2xl font-semibold` below the title; every other part of the card (feature list, recommended badge, CTA button) unchanged.
- `PlanSelectionStep.tsx` no longer renders a static 2-card `basic`/`premium` grid — it calls `useFetchPlanTiers()`, shows a `Loader2` spinner while loading, an error block with a working `Retry` button on failure (or on an empty tier list, treated as failure per UI-SPEC), and otherwise a `sm:grid-cols-3` grid of `PlanCard`s built from the fetched tiers.
- Feature bullets and seat-cap wording are derived entirely from `PlanTier` fields (`seatCap`, `realBoards`, `clients`, `customDomain`, `calendarSync`) plus an always-included subdomain row — zero hardcoded feature arrays remain.
- `DomainStep.tsx`'s `isPremium` (all occurrences — gating, check-enable, error attribution, description copy, field visibility) is fully replaced by `showCustomDomain = state.plan !== 'free'`.
- Required-field validation for custom domain is gone; only format/availability checks run, and only against a non-empty value. No tier can be blocked from completing signup over a missing custom domain.
- New "Do you currently own a custom domain?" `RadioGroup` (Yes/No, defaults to No) gates reveal of the existing custom-domain `Input` + availability check; selecting No shows a reassurance line instead.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add price to PlanCard and rebuild PlanSelectionStep as a 3-card fetch** - `a22712f` (feat)
2. **Task 2: Rebuild DomainStep gating and add the Yes/No custom-domain toggle** - `4a1cbea` (feat)

**Plan metadata:** committed as part of this SUMMARY (docs commit, see below)

## Files Created/Modified
- `frontend/src/components/createBrokerage/PlanCard.tsx` - Added required `price: string` prop, rendered at display-size typography below the title; no other structural change.
- `frontend/src/containers/createBrokerage/steps/PlanSelectionStep.tsx` - Full rewrite: removed hardcoded `BASIC_FEATURES`/`PREMIUM_FEATURES` and the static 2-card grid; now fetches via `useFetchPlanTiers`, with explicit loading (`Loader2` spinner) and error (`Retry` button) states, rendering a 3-card grid mapped from the fetched tiers with per-tier copy from a local title/description map and formula-derived feature rows.
- `frontend/src/containers/createBrokerage/steps/DomainStep.tsx` - Replaced all `isPremium` occurrences with `showCustomDomain = state.plan !== 'free'`; removed the required-custom-domain validation branch; added `ownsCustomDomain` local state driving a new `RadioGroup` Yes/No toggle (subheader + reassurance line + existing Input block gated on Yes); re-scoped the error-attribution branch (`isDomainError`) and the `customDomainCheckEnabled` condition to the new gating variables.

## Decisions Made
- Followed the plan's literal task-action derivation formula for PlanCard feature rows (seat wording → realBoards → clients → customDomain → calendarSync → always-included subdomain row) rather than UI-SPEC's slightly different per-tier bullet wording (e.g., Free's "Demo TEST board with sample listings" line, which has no corresponding `PlanTier` flag) — every bullet stays traceable to a fetched boolean, matching D-02's explicit "not hardcoded text divorced from flags" requirement. The plan's `<action>` block is the more specific/authoritative instruction here since it defines the exact derivation mechanics the acceptance criteria check against.
- Confirmed via `grep -c isPremium` returning `0` that every one of the 7 occurrences noted in 40-RESEARCH.md's Pitfall 4 (lines 15, 35, 59, 61, 80, 95, 119 in the pre-refactor file) was re-scoped, including the easy-to-miss error-attribution line.
- No required-field validation remains anywhere in `DomainStep.tsx` for custom domain on any tier — verified via `grep -ci "custom domain is required"` returning `0`.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<verify>` and `<acceptance_criteria>` gates passed on the first implementation pass with no auto-fixes needed.

## Issues Encountered

None. All plan-level verification commands passed cleanly:
- `grep -rni "basic\|premium" src/containers/createBrokerage/steps/PlanSelectionStep.tsx src/containers/createBrokerage/steps/DomainStep.tsx` → no matches (exit 1, empty output)
- `grep -c isPremium src/containers/createBrokerage/steps/DomainStep.tsx` → `0`
- `npx vitest run src/containers/createBrokerage src/components/createBrokerage` → "No test files found, exiting with code 0"
- Scoped `npx tsc --noEmit` output filtered to the three touched files → no errors reported (repo-wide `tsc` failure is the pre-existing, documented `moduleResolution` vs. installed TypeScript mismatch per STATE.md, not a regression from this plan)

## User Setup Required

None - no external service configuration required. This plan is pure frontend UI wiring against an already-shipped backend endpoint and already-shipped fetch stack.

## Next Phase Readiness

Phase 40 (onboarding-plan-alignment) is now complete: the plan-selection step (ONB-05) and domain step (ONB-06) both operate on the real three-tier model end to end, with the backend's Growth-requires-custom-domain check already removed in Plan 01. No blockers for Phase 41 (self-service plan management), which is an independent half of the v1.13 milestone per STATE.md's Decisions log.

---
*Phase: 40-onboarding-plan-alignment*
*Completed: 2026-07-22*

## Self-Check: PASSED

All 3 modified files verified present on disk; both task commits (`a22712f`, `4a1cbea`) verified present in `frontend`'s git history.
