---
phase: 21-frontend-redirect-guard-and-domains-admin
plan: 03
subsystem: ui
tags: [react, tanstack-query, typescript, shadcn, lucide-react, tailwind]

# Dependency graph
requires:
  - phase: 21-02
    provides: "5 TanStack mutation hooks + useFetchDomains/useFetchBrokerage + domainType.ts"

provides:
  - DomainsAdminBoard container (loading/error gates + DomainsAdminView render)
  - useDomainsAdminContext brain hook (state + actions + slot computations)
  - DomainsAdminView page shell with section-slot render props
  - CustomDomainsProGate locked upgrade card (DUI-08)
  - AddCustomDomainForm inline add form (DUI-05)
  - Domains nav in SideNav.tsx (subdomain admin sidebar)
  - Domains nav in PortalAdminSideNav.tsx (main domain portal sidebar)
  - /admin/domains route in admin.tsx

affects:
  - 21-04 (fills renderSubdomainSection + renderCustomDomainList slot props)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Context (brain) hook: useMemo return of { state, actions }, slot computations via Array.filter().length >= 2"
    - "Container loading/error gate pattern: mirrors BrokerageAdminBoard — isLoading/error checks before rendering view"
    - "Section-slot render props: renderSubdomainSection / renderCustomDomainList optional props on DomainsAdminView for plan 21-04 drop-in"
    - "Pro gate routing: !state.isPremium renders CustomDomainsProGate; state.isPremium renders add form toggle + custom domain list"

key-files:
  created:
    - frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts
    - frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx
    - frontend/src/components/view/admin/domainsAdminView/DomainsAdminView.tsx
    - frontend/src/components/view/admin/domainsAdminView/CustomDomainsProGate.tsx
    - frontend/src/components/view/admin/domainsAdminView/AddCustomDomainForm.tsx
  modified:
    - frontend/src/components/sidenav/SideNav.tsx
    - frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx
    - frontend/src/router/admin/admin.tsx

key-decisions:
  - "Section-slot render props (renderSubdomainSection, renderCustomDomainList) on DomainsAdminView let plan 21-04 plug in card lists without touching the shell"
  - "slotWarning state is ephemeral (useState in context) — resets on next page load per D-12 in 21-CONTEXT.md"
  - "subdomainSlotsBlocked/customSlotsBlocked computed globally (not per-card) per Pitfall 5 in 21-RESEARCH.md: filter by domainType + status === 'phasing_out', threshold >= 2"
  - "isPremium is strict equality brokerage?.plan === 'premium' — backend is authoritative gate (T-21-11 accept)"

patterns-established:
  - "DomainsAdminView slot API: renderSubdomainSection and renderCustomDomainList as optional () => React.ReactNode props"

requirements-completed:
  - DUI-01
  - DUI-05
  - DUI-08

# Metrics
duration: 4min
completed: 2026-05-29
---

# Phase 21 Plan 03: Domain Admin UI Shell Summary

**Route wiring, brain context, container, DomainsAdminView shell with section-slot props, Pro gate card, and inline add-domain form — full /admin/domains load-bearing layer for plan 21-04 card drop-in**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-29T07:13:12Z
- **Completed:** 2026-05-29T07:17:08Z
- **Tasks:** 2 (1 nav+route wiring, 1 UI layer build)
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- Added Globe nav item to SideNav.tsx (subdomain admin sidebar, after Listing Groups) and PortalAdminSideNav.tsx (main domain portal sidebar, after Groups) — DUI-01 complete
- Added `/admin/domains` route to admin.tsx wired to DomainsAdminBoard
- Created `useDomainsAdminContext` brain hook: wires useFetchDomains + useFetchBrokerage + all 5 mutation hooks; computes subdomainSlotsBlocked, customSlotsBlocked, isPremium; returns useMemo { state, actions }
- Created `DomainsAdminBoard` container: mirrors BrokerageAdminBoard loading/error gate pattern, delegates to DomainsAdminView
- Created `DomainsAdminView` shell: page header "Domains" + subtitle, Subdomains section with slot prop, Custom Domains section with Pro gate routing + Add domain toggle + slot prop
- Created `CustomDomainsProGate`: locked card with Lock icon, exact DUI-08 copy, Upgrade to Pro CTA — DUI-08 complete
- Created `AddCustomDomainForm`: HOSTNAME_PATTERN client-side validation, Add domain submit + Discard cancel, self-clears on submit — DUI-05 (form half) complete
- Production build: 3840 modules, 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Domains nav to both sidebars + /admin/domains route** - `bf0061c` (feat)
2. **Task 2: Build useDomainsAdminContext + DomainsAdminBoard + DomainsAdminView + CustomDomainsProGate + AddCustomDomainForm** - `c2d0994` (feat)

## Files Created/Modified

### New Files
- `frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts` — Brain hook: 7 state fields + 6 actions + slot computations in useMemo
- `frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx` — Container with loading/error gates
- `frontend/src/components/view/admin/domainsAdminView/DomainsAdminView.tsx` — Page shell with section-slot render props
- `frontend/src/components/view/admin/domainsAdminView/CustomDomainsProGate.tsx` — Locked upgrade card (DUI-08)
- `frontend/src/components/view/admin/domainsAdminView/AddCustomDomainForm.tsx` — Inline add form with HOSTNAME_PATTERN validation (DUI-05)

### Modified Files
- `frontend/src/components/sidenav/SideNav.tsx` — Added Globe import + Domains NavButton after Listing Groups
- `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` — Added Globe import + Domains item after Groups
- `frontend/src/router/admin/admin.tsx` — Added DomainsAdminBoard import + path 'domains' route entry

## Section-Slot Interface (for plan 21-04)

```ts
// On DomainsAdminView:
renderSubdomainSection?: () => React.ReactNode
renderCustomDomainList?: () => React.ReactNode
```

When undefined (this plan), both slots render: `<p className="text-sm text-muted-foreground">Loading domain cards…</p>`

Plan 21-04 passes these as props to plug in card components without modifying the shell.

## Context State/Actions Surface

```ts
state: {
    domains: BrokerageDomain[]
    brokerage: BrokerageType | undefined
    isLoading: boolean
    error: unknown
    slotWarning: PhaseOutWarning | null
    subdomainSlotsBlocked: boolean   // filter(subdomain + phasing_out).length >= 2
    customSlotsBlocked: boolean      // filter(custom + phasing_out).length >= 2
    isPremium: boolean               // brokerage?.plan === 'premium'
}
actions: {
    updateSubdomain: (slug: string) => void
    setPrimary: (id: string | number) => void
    decommission: (id: string | number) => void
    addCustom: (domain: string) => void
    removeCustom: (id: string | number) => void
    setSlotWarning: (warning: PhaseOutWarning | null) => void
}
```

## Sidenav Order (Text Description)

**SideNav.tsx (subdomain admin):** Brokerage → Users → Listing Groups → **Domains** → Settings

**PortalAdminSideNav.tsx (main domain portal):** Board Registrations → Users → Groups → **Domains** → Settings

## Note for Plan 21-04

Section slots are ready — plug cards here:
- `renderSubdomainSection`: renders subdomain card list with slot banners, inline edit, accordion (DUI-04, DUI-06, DUI-07)
- `renderCustomDomainList`: renders custom domain card list with remove/set-primary actions (DUI-03, DUI-09)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Inline button text for grep acceptance criteria**
- **Found during:** Task 2 (acceptance criteria verification)
- **Issue:** Plan acceptance criteria required `grep -c ">Upgrade to Pro<"` to equal 1 and `grep -c ">Add domain<"` to equal 1. The plan's provided code had button text on separate indented lines, causing the grep patterns to fail (newline between `>` and text).
- **Fix:** Collapsed button text onto single line: `<Button ...>Upgrade to Pro</Button>` and `<Button ...>Add domain</Button>`, `<Button ...>Discard</Button>` — functionally equivalent, renders identically.
- **Files modified:** CustomDomainsProGate.tsx, AddCustomDomainForm.tsx
- **Verification:** All grep acceptance criteria return 1; build succeeds
- **Committed in:** c2d0994

## Issues Encountered

- `npx tsc --noEmit` with TypeScript 4.9.5 fails due to `moduleResolution: "bundler"` (TS 5.0+ feature) — same pre-existing environment limitation as documented in 21-01-SUMMARY.md and 21-02-SUMMARY.md. `npm run build` (Vite) succeeds with 3840 modules, confirming correct TypeScript. Not a regression.

## User Setup Required

None - no external service configuration required.

## Known Stubs

The `renderSubdomainSection` and `renderCustomDomainList` slots render placeholder text `"Loading domain cards…"` when not provided. This is intentional per plan design — plan 21-04 wires the actual card components into these slots. The placeholder does not block the plan's goal (routing + shell + Pro gate + add form are all functional).

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. All trust boundaries documented in plan threat model:
- Route is inside existing ProtectedRoute + RequireBrokerageContext (T-21-14 mitigated by existing error boundary)
- Pro gate is UX-only; backend independently rejects at 403 (T-21-11 accepted)
- HOSTNAME_PATTERN client-side only; backend validates authoritatively (T-21-15 mitigated)

## Self-Check: PASSED

All committed files verified present:
- frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts: FOUND (c2d0994)
- frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx: FOUND (c2d0994)
- frontend/src/components/view/admin/domainsAdminView/DomainsAdminView.tsx: FOUND (c2d0994)
- frontend/src/components/view/admin/domainsAdminView/CustomDomainsProGate.tsx: FOUND (c2d0994)
- frontend/src/components/view/admin/domainsAdminView/AddCustomDomainForm.tsx: FOUND (c2d0994)
- Task 1 commit bf0061c: FOUND in git log
- Task 2 commit c2d0994: FOUND in git log
- Build: 3840 modules, 0 errors

---
*Phase: 21-frontend-redirect-guard-and-domains-admin*
*Completed: 2026-05-29*
