# Milestones

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
