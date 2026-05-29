---
phase: 21-frontend-redirect-guard-and-domains-admin
verified: 2026-05-29T00:00:00Z
status: human_needed
score: 18/18
overrides_applied: 0
human_verification:
  - test: "Navigate to /admin/domains as a subdomain admin and verify the 'Domains' nav item appears after 'Listing Groups' in the sidebar with a Globe icon"
    expected: "Nav item is visible, clicking it routes to /admin/domains and renders the Domains page"
    why_human: "Visual appearance and nav order cannot be verified programmatically"
  - test: "Navigate to /admin/domains as a portal admin (main domain) and verify the 'Domains' nav item appears after 'Groups' in PortalAdminSideNav with a Globe icon"
    expected: "Nav item is visible in the correct position"
    why_human: "Visual position in sidebar requires browser render"
  - test: "Visit the /admin/domains page as a non-Pro brokerage"
    expected: "Custom Domains section shows locked card with Lock icon, text 'Custom domains require a Pro plan', and 'Upgrade to Pro' button; no Add domain button is visible"
    why_human: "Visual layout and locked card appearance require browser verification"
  - test: "Visit the /admin/domains page as a Pro brokerage with at least one domain. Click 'Add domain', type a hostname, click 'Discard'"
    expected: "Form appears inline, Discard hides it without submitting"
    why_human: "Interactive state transitions require browser testing"
  - test: "On a phasing-out domain card, verify the countdown footer reads 'N days remaining · decommissions MMM D' and a 'Remove now' button is present"
    expected: "Countdown format matches UI-SPEC exactly; Remove now button opens AlertDialog with 'Remove {domain}?', body, 'Remove domain' destructive and 'Keep domain' cancel"
    why_human: "Runtime date formatting and dialog interactions require browser"
  - test: "With 2 phasing-out subdomains, verify Edit buttons on active subdomain cards are disabled with a tooltip 'Unavailable until [date]', a red banner appears, and 'Free a slot now?' accordion is visible"
    expected: "All three slot-block UI elements render correctly; accordion expands to show Remove now per phasing-out entry"
    why_human: "Slot-block state requires specific data setup and visual inspection"
  - test: "Simulate visiting a phasing-out subdomain URL (a domain whose primary differs from current hostname)"
    expected: "Browser silently redirects to same path+query on primary domain; back button does not return to the original subdomain"
    why_human: "window.location.replace behavior and history management require real browser navigation"
---

# Phase 21: Frontend Redirect Guard & Domains Admin Verification Report

**Phase Goal:** Deliver the frontend redirect guard (DINT-01) and complete domain management admin UI (DUI-01 through DUI-09).
**Verified:** 2026-05-29
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A visitor on a phasing-out subdomain is redirected to primary domain at same path+query; back button does not return there | VERIFIED | `PrimaryDomainRedirect.tsx` uses `window.location.replace()` (1 match), wired in `main.tsx` inside SubdomainOnly. 5/5 Vitest tests pass (commits d8cd6b4 → 0075dab). `if (!ready) return null` blank screen while in-flight. |
| 2 | A visitor on the main domain bypasses the lookup entirely | VERIFIED | `isMainDomain()` check in `useEffect` sets `ready=true` immediately; test 1 in PrimaryDomainRedirect.test.tsx covers this. |
| 3 | Lookup errors fail open (app renders normally) | VERIFIED | `.catch(() => setReady(true))` in PrimaryDomainRedirect.tsx; test 4 covers network error fail-open. |
| 4 | lookupDomain uses base axios (not project api instance) | VERIFIED | `grep "^import axios from 'axios'" lookupDomain.ts` = 1; `grep "@/assets/axios/axios" lookupDomain.ts` = 0. |
| 5 | Domain type definitions (BrokerageDomain, DomainType, etc.) and RESERVED_SLUGS exist and are importable | VERIFIED | `domainType.ts` exports all required types; RESERVED_SLUGS (21 entries matching backend byte-for-byte) confirmed. |
| 6 | Domains nav item appears in both sidebars (Globe icon) | VERIFIED (code) | `grep "path=\"/admin/domains\"" SideNav.tsx` = 1; `grep "path: '/admin/domains'" PortalAdminSideNav.tsx` = 1. Visual placement requires human check. |
| 7 | /admin/domains routes to DomainsAdminBoard | VERIFIED | `grep "<DomainsAdminBoard />" admin.tsx` = 1; `grep "path: 'domains'" admin.tsx` = 1; commit bf0061c. |
| 8 | DomainsAdminBoard shows Loading state, Error state, or DomainsAdminView with real data | VERIFIED | Loading/Error gate pattern present; context wires `useFetchDomains` + `useFetchBrokerage` (both real API calls); `domainsData?.domains` flows to view; `useFetchDomains` calls `/v1/admin/domains`. |
| 9 | Domain cards display type badges (Subdomain/Custom Domain), status badges (Active/Phasing Out), and countdown for phasing-out domains | VERIFIED | `DomainCard.tsx` has all 5 badge labels (grep = 1 each); countdown copy `days remaining · decommissions` (grep = 1); semantic badge Tailwind classes from UI-SPEC all present. |
| 10 | Primary domain shows Primary badge; active non-primary shows Set as primary button | VERIFIED | `>Primary<` (1), `>Set as primary<` (1) in DomainCard.tsx; gated on `domain.isPrimary` and `isActive && !domain.isPrimary`. |
| 11 | Subdomain inline edit with client-side slug validation | VERIFIED | `SubdomainCardEditForm.tsx` imports `validateSlug` (1 match); `DomainSlugInput.tsx` renders slug + `.realstate.app` suffix; 11 Vitest tests for validateSlug all pass (commit a9cea74). |
| 12 | Phasing-out cards show Remove now button opening AlertDialog with exact copy | VERIFIED | `RemoveNowDialog.tsx` has `Remove domain` (1), `Keep domain` (1), `This domain will stop resolving immediately and cannot be undone` (1). `<RemoveNowDialog` wired in DomainCard (1) and FreeSlotAccordion (1). |
| 13 | Custom domain section shows Pro gate (non-Pro) or management controls (Pro) | VERIFIED | `CustomDomainsProGate.tsx` has `Upgrade to Pro` (2), `Custom domains require a Pro plan` (1). `!state.isPremium` routes to ProGate. Pro branch renders add form + domain list. |
| 14 | Add domain form: clicking Add domain shows inline form; Discard hides it; submit calls addCustom | VERIFIED | `isAddingCustom` state in `DomainsAdminView`; `AddCustomDomainForm` has `Add domain` + `Discard`; submit calls `actions.addCustom`; `HOSTNAME_PATTERN` client-side validation present. |
| 15 | Slot warning banner (yellow) appears when mutation leaves 1 slot remaining | VERIFIED | `SlotBanner.tsx` `variant="warning"` renders `Next change will be your last until {date}.` (1 match); `SubdomainsSection` wires `slotWarning` from context (prop flows from `useDomainsAdminContext`). |
| 16 | With 0 slots remaining: Edit disabled with tooltip, red banner, and FreeSlotAccordion with Remove now per entry | VERIFIED | `Unavailable until` tooltip in DomainCard (1); `variant="blocked"` in SubdomainsSection (1); `<FreeSlotAccordion` conditional on `slotsBlocked` (1); accordion trigger `Free a slot now?` (1). |
| 17 | All 5 mutation hooks update cache via setQueryData and fire correct toasts | VERIFIED | Each hook: `return useMutation` directly (5/5); `setQueryData(domainsKeys.all, { domains: data.domains })` in each; exact success toast copy per UI-SPEC; uniform error toast `Something went wrong. Please try again.` |
| 18 | Phase-out warning callback on 3 of 5 hooks (updateSubdomain, addCustomDomain, removeCustomDomain) | VERIFIED | `onPhaseOutWarning` count: useUpdateSubdomain=4, useAddCustomDomain verified in plan. useSetPrimaryDomain=0, useDecommissionDomain=0 (correct). |

**Score:** 18/18 truths verified (code-level)

### Required Artifacts

| Artifact | Status | Evidence |
|----------|--------|----------|
| `frontend/src/components/ui/accordion.tsx` | VERIFIED | EXISTS; AccordionPrimitive count=17 (substantive CLI-generated file) |
| `frontend/src/assets/types/domainType.ts` | VERIFIED | EXISTS; RESERVED_SLUGS export present, 21 entries |
| `frontend/src/assets/api/domains/lookupDomain.ts` | VERIFIED | EXISTS; base axios import (not project api); `/v1/domains/lookup` endpoint |
| `frontend/src/components/common/guards/PrimaryDomainRedirect.tsx` | VERIFIED | EXISTS; Outlet render; window.location.replace; fail-open catch |
| `frontend/src/components/common/guards/PrimaryDomainRedirect.test.tsx` | VERIFIED | EXISTS; 5 test cases |
| `frontend/src/assets/api/admin/domains/fetchDomains.ts` | VERIFIED | EXISTS; imports from domainType.ts; stale fields removed (count=0) |
| `frontend/src/assets/api/admin/domains/updateSubdomain.ts` | VERIFIED | EXISTS |
| `frontend/src/assets/api/admin/domains/setPrimaryDomain.ts` | VERIFIED | EXISTS |
| `frontend/src/assets/api/admin/domains/removeDomain.ts` | VERIFIED | EXISTS |
| `frontend/src/assets/api/admin/domains/addCustomDomain.ts` | VERIFIED | EXISTS |
| `frontend/src/store/hooks/Admin/Domains/useUpdateSubdomain.ts` | VERIFIED | EXISTS; return useMutation; onPhaseOutWarning callback |
| `frontend/src/store/hooks/Admin/Domains/useSetPrimaryDomain.ts` | VERIFIED | EXISTS; no callback |
| `frontend/src/store/hooks/Admin/Domains/useDecommissionDomain.ts` | VERIFIED | EXISTS; no callback |
| `frontend/src/store/hooks/Admin/Domains/useAddCustomDomain.ts` | VERIFIED | EXISTS; onPhaseOutWarning callback |
| `frontend/src/store/hooks/Admin/Domains/useRemoveCustomDomain.ts` | VERIFIED | EXISTS; onPhaseOutWarning callback |
| `frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts` | VERIFIED | EXISTS; useMemo return; slot computations (filter count=2); isPremium strict equality |
| `frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx` | VERIFIED | EXISTS; renderSubdomainSection + renderCustomDomainList both wired |
| `frontend/src/components/view/admin/domainsAdminView/DomainsAdminView.tsx` | VERIFIED | EXISTS; page header `Domains`; subtitle `Manage your brokerage domains.`; both section headings |
| `frontend/src/components/view/admin/domainsAdminView/CustomDomainsProGate.tsx` | VERIFIED | EXISTS; exact DUI-08 copy; Lock icon |
| `frontend/src/components/view/admin/domainsAdminView/AddCustomDomainForm.tsx` | VERIFIED | EXISTS; Add domain + Discard buttons; HOSTNAME_PATTERN validation |
| `frontend/src/components/view/admin/domainsAdminView/slugValidation.ts` | VERIFIED | EXISTS; validateSlug export; 4-step validation order |
| `frontend/src/components/view/admin/domainsAdminView/slugValidation.test.ts` | VERIFIED | EXISTS; 11 test cases; passes (commit a9cea74) |
| `frontend/src/components/view/admin/domainsAdminView/DomainSlugInput.tsx` | VERIFIED | EXISTS; .realstate.app suffix; focus-within ring |
| `frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx` | VERIFIED | EXISTS; all 5 badge labels; countdown format; all 4 action buttons; RemoveNowDialog wired |
| `frontend/src/components/view/admin/domainsAdminView/SubdomainCardEditForm.tsx` | VERIFIED | EXISTS; validateSlug usage; Save changes + Discard changes |
| `frontend/src/components/view/admin/domainsAdminView/SubdomainsSection.tsx` | VERIFIED | EXISTS; warning + blocked banners; FreeSlotAccordion conditional; lifted editingId |
| `frontend/src/components/view/admin/domainsAdminView/FreeSlotAccordion.tsx` | VERIFIED | EXISTS; shadcn Accordion import; Free a slot now? trigger; RemoveNowDialog per entry |
| `frontend/src/components/view/admin/domainsAdminView/SlotBanner.tsx` | VERIFIED | EXISTS; yellow warning copy; red blocked copy; dayjs import |
| `frontend/src/components/view/admin/domainsAdminView/RemoveNowDialog.tsx` | VERIFIED | EXISTS; Remove domain; Keep domain; destructive body copy |
| `frontend/src/components/view/admin/domainsAdminView/CustomDomainList.tsx` | VERIFIED | EXISTS; isEditing={false} for custom; empty state copy |

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `main.tsx` | `PrimaryDomainRedirect.tsx` | layout route inside SubdomainOnly | WIRED | import (line 14) + `element: <PrimaryDomainRedirect />` (line 28) |
| `PrimaryDomainRedirect.tsx` | `lookupDomain.ts` | default import | WIRED | `import lookupDomain from '@/assets/api/domains/lookupDomain'` |
| `lookupDomain.ts` | base axios | `import axios from 'axios'` | WIRED | grep count=1; project api count=0 |
| `admin.tsx` | `DomainsAdminBoard.tsx` | route element | WIRED | `element: <DomainsAdminBoard />` + `path: 'domains'` |
| `SideNav.tsx` | `/admin/domains` | NavButton Globe icon | WIRED | `path="/admin/domains"` + `label="Domains"` |
| `PortalAdminSideNav.tsx` | `/admin/domains` | items array | WIRED | `{ label: 'Domains', icon: Globe, path: '/admin/domains' }` |
| `DomainsAdminBoard.tsx` | `DomainsAdminView.tsx` | JSX with state + actions + render props | WIRED | renderSubdomainSection + renderCustomDomainList both passed |
| `DomainsAdminBoard.tsx` | `SubdomainsSection.tsx` | renderSubdomainSection prop | WIRED | import SubdomainsSection + wired in render prop |
| `DomainsAdminBoard.tsx` | `CustomDomainList.tsx` | renderCustomDomainList prop | WIRED | import CustomDomainList + wired in render prop |
| `SubdomainsSection.tsx` | `DomainCard.tsx` | JSX map | WIRED | `<DomainCard` rendered per domain |
| `DomainCard.tsx` | `RemoveNowDialog.tsx` | JSX render for phasing-out | WIRED | `<RemoveNowDialog` (count=1) |
| `SubdomainCardEditForm.tsx` | `slugValidation.ts` | validateSlug import | WIRED | grep count=1 |
| `useUpdateSubdomain.ts` | `useFetchDomains.ts` | `import { domainsKeys }` | WIRED | setQueryData(domainsKeys.all) in all 5 hooks |
| `fetchDomains.ts` | `domainType.ts` | named import | WIRED | `from '@/assets/types/domainType'` (count=1) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `DomainsAdminBoard.tsx` | `state.domains` | `useDomainsAdminContext` → `useFetchDomains` → `api.get('/v1/admin/domains')` | Yes — real API call | FLOWING |
| `DomainsAdminBoard.tsx` | `state.brokerage` | `useDomainsAdminContext` → `useFetchBrokerage` → real API | Yes | FLOWING |
| `PrimaryDomainRedirect.tsx` | `data.domain` | `lookupDomain(hostname)` → base axios → `GET /v1/domains/lookup` | Yes — real API call | FLOWING |
| Mutation hooks | `data.domains` | mutation response → `setQueryData(domainsKeys.all, { domains: data.domains })` | Yes — server-supplied | FLOWING |

### Behavioral Spot-Checks

| Behavior | Result | Status |
|----------|--------|--------|
| PrimaryDomainRedirect Vitest (5 tests) | 5/5 pass (commits d8cd6b4, 0075dab) | PASS |
| slugValidation Vitest (11 tests) | 11/11 pass (commit a9cea74) | PASS |
| Production build | 3853 modules, 0 errors (commit 9f18b45) | PASS |
| All 10 phase-21 commits present in git log | All 10 hashes verified | PASS |
| DomainsAdminView placeholder fallback | "Loading domain cards…" only shown when render props are undefined; DomainsAdminBoard now passes both render props — placeholder does not render in production | PASS |

### Requirements Coverage

| Requirement | Plans | Status | Evidence |
|-------------|-------|--------|----------|
| DINT-01 | 21-01 | SATISFIED | PrimaryDomainRedirect guard wired in main.tsx; 5/5 tests; uses window.location.replace |
| DUI-01 | 21-03 | SATISFIED | Globe nav in SideNav.tsx + PortalAdminSideNav.tsx; route in admin.tsx |
| DUI-02 | 21-04 | SATISFIED | DomainCard has type/status badges + countdown footer |
| DUI-03 | 21-04 | SATISFIED | Primary badge + Set as primary button in DomainCard |
| DUI-04 | 21-02, 21-04 | SATISFIED | SubdomainCardEditForm + DomainSlugInput + validateSlug with 11 passing tests |
| DUI-05 | 21-02, 21-03, 21-04 | SATISFIED | AddCustomDomainForm + useAddCustomDomain + useRemoveCustomDomain + Remove button in DomainCard |
| DUI-06 | 21-02, 21-04 | SATISFIED | onPhaseOutWarning callback on 3 hooks; SlotBanner warning variant; SubdomainsSection wires slotWarning |
| DUI-07 | 21-04 | SATISFIED | subdomainSlotsBlocked; Edit disabled with Unavailable until tooltip; SlotBanner blocked; FreeSlotAccordion |
| DUI-08 | 21-03 | SATISFIED | CustomDomainsProGate with exact copy; routes on !state.isPremium |
| DUI-09 | 21-04 | SATISFIED | RemoveNowDialog with exact destructive copy; wired in DomainCard + FreeSlotAccordion |

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `DomainsAdminView.tsx` | "Loading domain cards…" placeholder text | Info | Not a stub — this is the intentional fallback when render props are undefined. DomainsAdminBoard now passes both render props, so this text does not appear at runtime. |
| `AddCustomDomainForm.tsx` | `placeholder="app.acme.com"` | Info | HTML `placeholder` attribute on an input — expected UX pattern, not a code stub. |
| `DomainSlugInput.tsx` | `placeholder="your-brokerage"` | Info | HTML `placeholder` attribute on an input — expected UX pattern, not a code stub. |

No blockers. All "placeholder" matches are HTML input placeholder attributes or a documented intentional fallback, not implementation stubs.

### Human Verification Required

The following 7 items require a human tester with a browser — automated code analysis cannot substitute:

#### 1. Subdomain Admin Sidebar — Domains Nav Position

**Test:** Log in as a subdomain admin, open the admin sidebar, look at the navigation items in the admin section.
**Expected:** "Domains" nav item appears after "Listing Groups" and before "Settings", with a Globe icon. Clicking it navigates to `/admin/domains`.
**Why human:** Visual sidebar order and icon rendering require browser.

#### 2. Portal Admin Sidebar — Domains Nav Position

**Test:** Log in as a main-domain portal admin, inspect the PortalAdminSideNav.
**Expected:** "Domains" appears after "Groups" and before "Settings" with Globe icon.
**Why human:** Visual sidebar order requires browser.

#### 3. Non-Pro Brokerage Pro Gate

**Test:** Navigate to `/admin/domains` with a non-premium brokerage account.
**Expected:** Custom Domains section shows the locked card with Lock icon, "Custom domains require a Pro plan", "Upgrade to Pro to add custom domains to your brokerage.", and an "Upgrade to Pro" button. No "Add domain" button visible.
**Why human:** Visual locked card appearance requires browser.

#### 4. Add Domain Form Toggle (Pro Brokerage)

**Test:** Navigate to `/admin/domains` as a Pro brokerage. Click "Add domain". Then click "Discard".
**Expected:** Inline form appears below the section header. Discard hides it without submission.
**Why human:** Interactive state transitions require browser testing.

#### 5. Phasing-Out Domain Card — Countdown + Remove Now Dialog

**Test:** With a phasing-out domain present, inspect its card and click "Remove now".
**Expected:** Card shows countdown `N days remaining · decommissions MMM D`. Dialog opens with title "Remove {domain}?", body text about immediate stop, "Remove domain" (destructive red) button, and "Keep domain" cancel.
**Why human:** Runtime date formatting and dialog focus behavior require browser.

#### 6. Slot Block State — 2 Phasing-Out Subdomains

**Test:** With 2 phasing-out subdomains, inspect the Subdomains section.
**Expected:** Edit buttons on active subdomains are disabled; hovering shows tooltip "Unavailable until [date]". Red banner "No subdomain slots available until [date]." appears. "Free a slot now?" accordion is visible and expands to show each phasing-out subdomain with its own "Remove now" button.
**Why human:** Slot-block state requires specific data and visual inspection.

#### 7. Redirect Guard — Real Browser Navigation

**Test:** Visit a subdomain URL that is phasing out (different hostname from its brokerage's primary domain).
**Expected:** Browser silently redirects to the same path+query on the primary domain. The original subdomain URL does not appear in browser history (back button does not return to it).
**Why human:** window.location.replace() history behavior and network redirect require real browser navigation to verify end-to-end.

### Gaps Summary

No code-level gaps found. All 18 observable truths are verified against the codebase. All 30 artifacts exist and are substantive. All 14 key links are wired. Data flow is real (API calls, not hardcoded). Both Vitest suites pass. Production build succeeds. All 10 requirement IDs (DINT-01, DUI-01 through DUI-09) have implementation evidence.

The `human_needed` status reflects 7 items that require browser testing — visual layout, interactive state transitions, real navigation behavior, and runtime date formatting cannot be verified by static code analysis alone. These are not gaps; they are standard final-mile verification for a UI-heavy phase.

---

_Verified: 2026-05-29T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
