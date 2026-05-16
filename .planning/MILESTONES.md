# Milestones

## v1.1 — Domain Access Control

**Shipped:** 2026-05-16
**Phases:** 2 | **Plans:** 2
**Timeline:** 2026-05-13 → 2026-05-16 (3 days)

### Delivered

Full-stack domain enforcement: frontend `DomainGuard` React components enforce main-domain-only (`/create`) and subdomain-only routes via `VITE_MAIN_DOMAIN` env var (Phase 6). Backend `MainDomainOnly` Rails concern rejects non-main-domain requests on all four `/v1/onboarding/*` endpoints with HTTP 403 before Cognito auth runs (Phase 7). Both layers read domain config from env vars — no hardcoded strings. All 5 DOM requirements validated.

### Key Accomplishments

1. `isMainDomain()` utility + `SubdomainOnly`/`MainDomainOnly` guard components wired into React router — DOM-01/02/03
2. `NotFound` page per UI-SPEC — renders on all non-`/create` routes from main domain
3. `MainDomainOnly` Rails concern: Origin-first extraction, `URI::InvalidURIError` rescue, `APP_BASE_DOMAIN` env config — DOM-04/05
4. Guard runs before Cognito auth — wrong-domain requests return 403, not 401 (correct security ordering)
5. 22 backend integration tests (17 prior + 5 new), 0 failures; 8 frontend unit tests (all passing)
6. Code review surfaced 2 pre-existing critical issues (soft-delete filter gap, S3 orphan) — logged for v1.2

### Known Deferred Items at Close: 2

| Category | Item | Status |
|----------|------|--------|
| CR-01 | `BrokerageDomain.exists?` missing `.active` scope in `DomainsController#check` | Pre-existing; address in v1.2 |
| CR-02 | S3 favicon upload outside transaction — orphaned on DB failure | Pre-existing; address in v1.2 |

### Archive

- Roadmap: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- Requirements: [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)
- Tag: `v1.1`

---

## v1.0 — Security, OAuth & Calendar

**Shipped:** 2026-05-13
**Phases:** 5 | **Plans:** 30
**Timeline:** 2026-04-29 → 2026-05-13 (14 days)

### Delivered

Server-side RBAC enforcement, rack-attack rate limiting, CORS hardening, N+1 fixes, and tech debt cleanup (Phase 1) — followed immediately by a backend + frontend test suite proving the fixes (Phase 2). Onboarding flows fixed: domain wizard, post-invite redirect, and welcome banner (Phase 3). Google social login shipped atomically with PreSignUp Lambda account linking and intermediary callback page (Phase 4). Google Calendar sync with advisory-lock job, encrypted credential storage, and settings UI (Phase 5).

### Key Accomplishments

1. `Admin::BaseController#require_admin!` closed the RBAC gap across all 13 admin controllers — SEC-01
2. Backend integration test suite: 17 tests covering tenant isolation, RBAC, FilterSets, GroupEstatesQuery, InvitationsController
3. Frontend test suite: Vitest 4.x + MSW 2.x, 7 tests covering ProtectedRoute, RequireRole, GoogleSignInButton
4. Google OAuth federation via Cognito + PreSignUp Lambda with `AdminLinkProviderForUser` email linking
5. `CalendarSyncJob` with PostgreSQL advisory lock, deterministic event IDs, and token refresh — wired to EstateEventsController fan-out
6. Calendar settings UI: CalendarTab + ProviderCard + CalendarContext, Google provider connected and verified

### Known Deferred Items at Close: 2

| Category | Item | Status |
|----------|------|--------|
| CAL-04 | Microsoft Calendar sync | Adapter built, activate in v2 by expanding PROVIDERS |
| CAL-05 | Apple CalDAV sync | Adapter built, activate in v2 by expanding PROVIDERS |

### Archive

- Roadmap: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- Requirements: [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
- Tag: `v1.0`
