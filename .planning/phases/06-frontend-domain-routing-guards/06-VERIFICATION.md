---
phase: 06-frontend-domain-routing-guards
verified: 2026-05-13T23:28:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "On main domain (VITE_MAIN_DOMAIN=localhost), open npm run dev, visit http://localhost:3000/dashboard"
    expected: "Page renders 'Page not found' — SubdomainOnly guard fires, NotFound displayed"
    why_human: "Requires a running dev server; cannot verify browser rendering via grep"
  - test: "On main domain, visit http://localhost:3000/create"
    expected: "Brokerage creation wizard renders correctly — MainDomainOnly passes through"
    why_human: "Requires a running dev server to confirm wizard renders rather than being redirected"
  - test: "Simulate subdomain: temporarily set VITE_MAIN_DOMAIN=realtybase.ca, restart dev server, visit http://localhost:3000/create"
    expected: "Browser redirects to http://localhost:3000/ without rendering the wizard"
    why_human: "Requires env var change + live dev server; redirect behavior is browser-level"
---

# Phase 6: Frontend Domain Routing Guards Verification Report

**Phase Goal:** React router conditionally enforces main-domain-only and subdomain-only route trees based on hostname.
**Verified:** 2026-05-13T23:28:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On the main domain (VITE_MAIN_DOMAIN), visiting any route other than /create/* renders 'Page not found' | ✓ VERIFIED | `SubdomainOnly` in router wraps all non-create routes; when `isMainDomain()` is true it returns `<NotFound />`; unit test "renders NotFound on main domain" passes |
| 2 | On the main domain, visiting /create renders the brokerage creation wizard | ✓ VERIFIED | `MainDomainOnly` wraps `createBrokerage` in router; when `isMainDomain()` is true it returns `<Outlet />`; unit test "renders Outlet children on main domain" passes |
| 3 | On a brokerage subdomain, visiting /create redirects to / without rendering the wizard | ✓ VERIFIED | `MainDomainOnly` returns `<Navigate to="/" replace />` when `!isMainDomain()`; unit test "redirects to / on subdomain" passes |
| 4 | isMainDomain() returns true when window.location.hostname equals VITE_MAIN_DOMAIN, false otherwise | ✓ VERIFIED | `domain.ts` line 6: `window.location.hostname === import.meta.env.VITE_MAIN_DOMAIN`; all 4 domain unit tests pass including undefined-env case |
| 5 | DomainGuard components are UX enforcement only — documented as non-security boundary | ✓ VERIFIED | Both `SubdomainOnly` and `MainDomainOnly` carry JSDoc comments stating "UX enforcement only — not a security boundary. Phase 7 adds backend 403 enforcement." (`grep -c "UX enforcement only"` = 2) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/helpers/domain.ts` | exports `isMainDomain()` comparing hostname to VITE_MAIN_DOMAIN | ✓ VERIFIED | File exists, 7 lines, exports `isMainDomain(): boolean`, exact comparison `window.location.hostname === import.meta.env.VITE_MAIN_DOMAIN` |
| `frontend/src/helpers/domain.test.ts` | 4 unit tests with vi.stubEnv + vi.stubGlobal pattern | ✓ VERIFIED | File exists, 4 tests all passing, uses vi.stubEnv/vi.stubGlobal/afterEach cleanup correctly |
| `frontend/src/components/common/guards/DomainGuard.tsx` | exports SubdomainOnly and MainDomainOnly | ✓ VERIFIED | File exists, both named exports present, no default export, imports isMainDomain and NotFound |
| `frontend/src/components/common/guards/DomainGuard.test.tsx` | 4 guard integration tests | ✓ VERIFIED | File exists, 4 tests all passing (2 SubdomainOnly, 2 MainDomainOnly), uses vi.stubEnv + vi.stubGlobal + renderWithProviders |
| `frontend/src/containers/errorPage/NotFound.tsx` | UI-SPEC exact layout, text-foreground/text-muted-foreground tokens, no useRouteError | ✓ VERIFIED | File exists, uses `text-foreground` and `text-muted-foreground` (no gray- classes), no `useRouteError`, no CTA, text matches spec exactly |
| `frontend/src/router/main.tsx` | SubdomainOnly wraps protected routes, MainDomainOnly wraps createBrokerage, wildcard path='*' renders NotFound last | ✓ VERIFIED | SubdomainOnly at line 19 (import + JSX = 2 occurrences), MainDomainOnly at line 32 (import + JSX = 2 occurrences), `path: '*'` at line 38 — last before export default |
| `frontend/.env` | contains VITE_MAIN_DOMAIN=localhost | ✓ VERIFIED | `grep "VITE_MAIN_DOMAIN=localhost" .env` matches exactly one line |
| `frontend/.env.example` | contains VITE_MAIN_DOMAIN=your-main-domain.com | ✓ VERIFIED | `grep "VITE_MAIN_DOMAIN=your-main-domain.com" .env.example` matches exactly one line |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `DomainGuard.tsx` | `helpers/domain.ts` | `import { isMainDomain } from '@/helpers/domain'` | ✓ WIRED | Import confirmed at line 2; isMainDomain called in both guard bodies (total 3 occurrences: 1 import + 2 calls) |
| `DomainGuard.tsx` | `errorPage/NotFound.tsx` | `import NotFound from '@/containers/errorPage/NotFound'` | ✓ WIRED | Import confirmed at line 3; `<NotFound />` returned in SubdomainOnly body |
| `router/main.tsx` | `guards/DomainGuard.tsx` | `import { SubdomainOnly, MainDomainOnly } from '@/components/common/guards/DomainGuard'` | ✓ WIRED | Import at line 12; `<SubdomainOnly />` at line 19, `<MainDomainOnly />` at line 32 |

### Data-Flow Trace (Level 4)

Level 4 data-flow trace not applicable — this phase produces guard/utility components that render static UI or redirects. No dynamic data is fetched or rendered. `isMainDomain()` reads from `window.location.hostname` (runtime browser value) and `import.meta.env.VITE_MAIN_DOMAIN` (build-time env injection) — both are real, non-stub sources.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| isMainDomain() unit tests (4 tests) | `npx vitest run src/helpers/domain.test.ts` | 4 passed | ✓ PASS |
| DomainGuard component tests (4 tests) | `npx vitest run src/components/common/guards/DomainGuard.test.tsx` | 4 passed | ✓ PASS |
| Full test suite — phase 6 files | `npx vitest run` (8 new tests) | 8 passed; 2 pre-existing failures in GoogleSignInButton.test.tsx unrelated to Phase 6 | ✓ PASS (pre-existing failures confirmed from commit `1ab55c3`, Phase 2) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DOM-01 | 06-01-PLAN.md | Frontend reads VITE_MAIN_DOMAIN and detects hostname match at runtime | ✓ SATISFIED | `domain.ts` exports `isMainDomain()` reading `import.meta.env.VITE_MAIN_DOMAIN`; `.env` sets `VITE_MAIN_DOMAIN=localhost` |
| DOM-02 | 06-01-PLAN.md | On main domain, all routes except /create/* render 404 page | ✓ SATISFIED | `SubdomainOnly` wraps all non-create routes in router; renders `<NotFound />` when `isMainDomain()` is true |
| DOM-03 | 06-01-PLAN.md | On brokerage subdomains, navigating to /create redirects to / | ✓ SATISFIED | `MainDomainOnly` wraps `createBrokerage` routes; returns `<Navigate to="/" replace />` when `!isMainDomain()` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

No TODO/FIXME/placeholder comments, no hardcoded empty returns, no gray- utility classes, no useRouteError, no default export on DomainGuard. All files are substantive implementations.

### Human Verification Required

The automated test suite fully verifies unit-level behavior (guard logic, isMainDomain edge cases). The following require a running dev server for end-to-end confirmation:

#### 1. SubdomainOnly blocks main domain access to app routes

**Test:** With `VITE_MAIN_DOMAIN=localhost` in `.env` (already set), run `npm run dev` from `frontend/`, then visit `http://localhost:3000/dashboard` in a browser.
**Expected:** Page displays "Page not found" with the centered layout — SubdomainOnly guard fires because localhost matches VITE_MAIN_DOMAIN.
**Why human:** Requires a running Vite dev server; React Router rendering cannot be verified by grep or CLI commands.

#### 2. MainDomainOnly passes through /create on main domain

**Test:** Same dev server. Visit `http://localhost:3000/create`.
**Expected:** Brokerage creation wizard renders (or redirects to auth login if unauthenticated — but does NOT show "Page not found").
**Why human:** Requires browser rendering confirmation that the wizard route is accessible, not blocked.

#### 3. MainDomainOnly redirects /create on subdomain

**Test:** Temporarily change `VITE_MAIN_DOMAIN=realtybase.ca` in `frontend/.env`, restart dev server (`npm run dev`), visit `http://localhost:3000/create`.
**Expected:** Browser lands on `http://localhost:3000/` (home/root) — the wizard does not render.
**Why human:** Requires env var change + server restart + browser-level redirect observation. Revert `VITE_MAIN_DOMAIN=localhost` after testing.

### Gaps Summary

No gaps. All 5 observable truths verified, all 8 required artifacts exist and are substantive, all 3 key links are wired, DOM-01 through DOM-03 are fully satisfied. The 2 failing tests in `GoogleSignInButton.test.tsx` are pre-existing failures from Phase 2 (commit `1ab55c3`) and are completely unrelated to Phase 6 deliverables — Phase 6 did not touch that file.

Status is `human_needed` because browser-level routing behavior (React Router rendering at runtime) cannot be verified programmatically without a running dev server.

---

_Verified: 2026-05-13T23:28:00Z_
_Verifier: Claude (gsd-verifier)_
