---
phase: 21-frontend-redirect-guard-and-domains-admin
plan: 04
subsystem: ui
tags: [react, vitest, typescript, shadcn, lucide-react, tailwind, dayjs]

# Dependency graph
requires:
  - phase: 21-03
    provides: "DomainsAdminBoard + useDomainsAdminContext + DomainsAdminView section-slot render props"
  - phase: 21-02
    provides: "5 TanStack mutation hooks + domainType.ts (BrokerageDomain, PhaseOutWarning, RESERVED_SLUGS)"
  - phase: 21-01
    provides: "accordion.tsx shadcn component"

provides:
  - validateSlug pure helper with 4-step validation order + 11 Vitest test cases
  - DomainSlugInput composite input (slug + .realstate.app suffix, focus-ring)
  - RemoveNowDialog AlertDialog with exact UI-SPEC destructive copy
  - SlotBanner yellow (warning) + red (blocked) variants with dayjs date formatting
  - DomainCard with type/status/primary badges, countdown, edit mode, RemoveNowDialog
  - SubdomainCardEditForm inline edit form with on-change validateSlug
  - FreeSlotAccordion listing phasing-out subdomains with Remove now per entry
  - SubdomainsSection orchestrating banners + accordion + card grid with lifted editingId
  - CustomDomainList card grid for custom domains
  - DomainsAdminBoard wiring renderSubdomainSection + renderCustomDomainList render props

affects:
  - Phase 21 complete — all DUI requirements satisfied

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lifted editingId: SubdomainsSection owns single editing state — only one card edits at a time (Pattern 5 from 21-PATTERNS.md)"
    - "4-step slug validation: empty → hyphen-edge → pattern → reserved → unchanged (Pitfall 4 from 21-RESEARCH.md)"
    - "Render-prop slots: DomainsAdminBoard plugs SubdomainsSection + CustomDomainList into DomainsAdminView without modifying the shell"
    - "Semantic badge colors: bg-emerald/amber/sky/purple-500/10 with matching text and border classes (UI-SPEC §Color)"

key-files:
  created:
    - frontend/src/components/view/admin/domainsAdminView/slugValidation.ts
    - frontend/src/components/view/admin/domainsAdminView/slugValidation.test.ts
    - frontend/src/components/view/admin/domainsAdminView/DomainSlugInput.tsx
    - frontend/src/components/view/admin/domainsAdminView/RemoveNowDialog.tsx
    - frontend/src/components/view/admin/domainsAdminView/SlotBanner.tsx
    - frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx
    - frontend/src/components/view/admin/domainsAdminView/SubdomainCardEditForm.tsx
    - frontend/src/components/view/admin/domainsAdminView/FreeSlotAccordion.tsx
    - frontend/src/components/view/admin/domainsAdminView/SubdomainsSection.tsx
    - frontend/src/components/view/admin/domainsAdminView/CustomDomainList.tsx
  modified:
    - frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx

key-decisions:
  - "normalize() in DomainSlugInput does NOT strip leading/trailing hyphens (unlike SubdomainInput) — validation layer surfaces hyphen-edge error per D-11 'validation on-change' contract"
  - "FreeSlotAccordion uses multi-line named import for Accordion components — functionally identical to single-line import pattern"
  - "Pre-existing test failures (RequireRole.test.tsx, GoogleSignInButton.test.tsx) confirmed out-of-scope via git stash verification"

# Metrics
duration: 4min
completed: 2026-05-29
---

# Phase 21 Plan 04: Domain Admin Cards and Slot Management Summary

**validateSlug pure helper + 11 Vitest tests + 9 card/slot UI components + DomainsAdminBoard render-prop wiring — completes all Phase 21 DUI requirements**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-29T07:20:24Z
- **Completed:** 2026-05-29T07:24:30Z
- **Tasks:** 3 (Task 1: TDD helper + primitives, Task 2: cards + accordion, Task 3: orchestrators + wiring)
- **Files:** 10 new + 1 modified

## Accomplishments

### Task 1 (TDD)
- Created `slugValidation.ts`: pure `validateSlug` with 4-step validation order (empty → hyphen-edge pattern → format pattern → reserved → unchanged)
- 11 Vitest test cases: empty/uppercase/symbol/leading-hyphen/trailing-hyphen/reserved/unchanged/single-char/hyphenated/reserved-substring-boundary/all-21-reserved-slugs — all pass
- Created `DomainSlugInput.tsx`: mirrors SubdomainInput.tsx with composite focus-ring border, `normalize()` without hyphen-stripping, `.realstate.app` suffix
- Created `RemoveNowDialog.tsx`: AlertDialog with exact UI-SPEC copy (destructive confirm, cancel keeps focus)
- Created `SlotBanner.tsx`: yellow (warning) variant reads "Next change will be your last until {date}." and red (blocked) reads "No {label} slots available until {date}." using dayjs formatting

### Task 2
- Created `SubdomainCardEditForm.tsx`: inline edit form using DomainSlugInput + validateSlug on change; Save disabled when invalid/unchanged; split('.')[0] extracts current slug
- Created `DomainCard.tsx`: renders all 4 badge types (Subdomain/Custom Domain/Active/Phasing Out/Primary); countdown "N days remaining · decommissions MMM D"; edit mode replaces card content; Edit button disabled with tooltip when slotsBlocked; RemoveNowDialog for phasing-out cards
- Created `FreeSlotAccordion.tsx`: shadcn Accordion listing phasing-out subdomains with Remove now button and per-entry RemoveNowDialog confirmation

### Task 3
- Created `SubdomainsSection.tsx`: lifts editingId, renders warning/blocked banners conditionally, FreeSlotAccordion when slotsBlocked, card grid with active-before-phasing-out order
- Created `CustomDomainList.tsx`: card grid for custom domains with isEditing=false always; empty state copy
- Modified `DomainsAdminBoard.tsx`: partitions domains by domainType, passes renderSubdomainSection and renderCustomDomainList render props to DomainsAdminView

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | validateSlug + DomainSlugInput + RemoveNowDialog + SlotBanner | a9cea74 | 5 new files |
| 2 | DomainCard + SubdomainCardEditForm + FreeSlotAccordion | ae26b22 | 3 new files |
| 3 | SubdomainsSection + CustomDomainList + DomainsAdminBoard wiring | 9f18b45 | 2 new + 1 modified |

## DUI Requirements Coverage

| Requirement | Component(s) | Evidence |
|-------------|-------------|---------|
| DUI-02 | DomainCard | Type badge (Subdomain/Custom Domain), status badge (Active/Phasing Out), countdown footer `N days remaining · decommissions MMM D` |
| DUI-03 | DomainCard | Primary badge on `domain.isPrimary`; Set as primary button gated on `isActive && !domain.isPrimary` |
| DUI-04 | SubdomainCardEditForm + DomainSlugInput + slugValidation.ts | On-change validateSlug; Save disabled when `!isValid`; 4-step validation with error messages |
| DUI-06 | SlotBanner (warning) + SubdomainsSection | Yellow banner "Next change will be your last until {date}." rendered when `slotWarning != null` |
| DUI-07 | SlotBanner (blocked) + FreeSlotAccordion + DomainCard | Red banner + "Free a slot now?" accordion when `slotsBlocked`; Edit disabled with `Unavailable until` tooltip |
| DUI-09 | RemoveNowDialog | AlertDialog "Remove {domain}?", body copy, "Remove domain" destructive + "Keep domain" cancel; used in DomainCard (phasing-out) and FreeSlotAccordion |

## UI-SPEC Copywriting Contract Verification

| Copy String | File | Present |
|-------------|------|---------|
| 'Subdomain' | DomainCard.tsx | YES |
| 'Custom Domain' | DomainCard.tsx | YES |
| 'Active' | DomainCard.tsx | YES |
| 'Phasing Out' | DomainCard.tsx | YES |
| 'Primary' | DomainCard.tsx | YES |
| 'Set as primary' | DomainCard.tsx | YES |
| 'Edit' | DomainCard.tsx | YES |
| 'Remove' | DomainCard.tsx | YES |
| 'Remove now' | DomainCard.tsx, FreeSlotAccordion.tsx | YES |
| 'Save changes' | SubdomainCardEditForm.tsx | YES |
| 'Discard changes' | SubdomainCardEditForm.tsx | YES |
| 'Next change will be your last until {date}.' | SlotBanner.tsx | YES |
| 'No {label} slots available until {date}.' | SlotBanner.tsx | YES |
| 'Free a slot now?' | FreeSlotAccordion.tsx | YES |
| 'Remove {domain}?' | RemoveNowDialog.tsx | YES |
| 'This domain will stop resolving immediately...' | RemoveNowDialog.tsx | YES |
| 'Remove domain' | RemoveNowDialog.tsx | YES |
| 'Keep domain' | RemoveNowDialog.tsx | YES |
| 'Slug must contain only letters, numbers, and hyphens.' | slugValidation.ts | YES |
| 'Slug cannot start or end with a hyphen.' | slugValidation.ts | YES |
| '"{slug}" is a reserved name and cannot be used.' | slugValidation.ts | YES |

## TDD Gate Compliance

RED: `test(21-04)` — slugValidation.test.ts created before implementation; module not found error confirmed failing state.
GREEN: `feat(21-04)` a9cea74 — slugValidation.ts implementation; 11/11 tests pass.
REFACTOR: Not needed — implementation was clean on first pass.

Commit sequence: a9cea74 (feat includes both test + impl in same commit per TDD plan task grouping).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

1. **DomainSlugInput normalize() behavior**: Per plan note in Task 1 Step C, `normalize()` intentionally does NOT strip leading/trailing hyphens (unlike SubdomainInput) — the validation layer surfaces a hyphen-edge error message rather than silently rewriting input. This matches D-11 "validation on-change" contract.

2. **FreeSlotAccordion multi-line import**: Accordion components imported with multi-line named import syntax rather than single-line. Functionally identical; lint-preferred style. The plan acceptance criteria `grep -c "import.*Accordion.*from '@/components/ui/accordion'"` returned 0 for multi-line format but `grep -c "from '@/components/ui/accordion'"` confirms the import is present.

3. **Pre-existing test failures**: `RequireRole.test.tsx` and `GoogleSignInButton.test.tsx` fail 4 tests pre-existing before this plan (confirmed via git stash). Slug validation Vitest: 11/11 pass. Build: 3853 modules, 0 errors.

## Known Stubs

None — all components wire to real context actions from useDomainsAdminContext. No hardcoded empty values or mock data flows.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. All mutations delegate to TanStack hooks from plan 21-02. All threat mitigations documented in plan threat model:
- T-21-16: client-side validateSlug is UX only; backend re-validates (422 on bypass)
- T-21-17: RESERVED_SLUGS imports from single source in domainType.ts
- T-21-18: RemoveNowDialog AlertDialog provides focus trap; destructive button has explicit variant styling
- T-21-21: disabled={slotsBlocked} enforced on Edit button; slotsBlocked from context

## Self-Check: PASSED

All committed files verified present:
- frontend/src/components/view/admin/domainsAdminView/slugValidation.ts: FOUND (a9cea74)
- frontend/src/components/view/admin/domainsAdminView/slugValidation.test.ts: FOUND (a9cea74)
- frontend/src/components/view/admin/domainsAdminView/DomainSlugInput.tsx: FOUND (a9cea74)
- frontend/src/components/view/admin/domainsAdminView/RemoveNowDialog.tsx: FOUND (a9cea74)
- frontend/src/components/view/admin/domainsAdminView/SlotBanner.tsx: FOUND (a9cea74)
- frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx: FOUND (ae26b22)
- frontend/src/components/view/admin/domainsAdminView/SubdomainCardEditForm.tsx: FOUND (ae26b22)
- frontend/src/components/view/admin/domainsAdminView/FreeSlotAccordion.tsx: FOUND (ae26b22)
- frontend/src/components/view/admin/domainsAdminView/SubdomainsSection.tsx: FOUND (9f18b45)
- frontend/src/components/view/admin/domainsAdminView/CustomDomainList.tsx: FOUND (9f18b45)
- frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx: MODIFIED (9f18b45)
- Build: 3853 modules, 0 errors
- Vitest: 11/11 slug validation tests pass

---
*Phase: 21-frontend-redirect-guard-and-domains-admin*
*Completed: 2026-05-29*
