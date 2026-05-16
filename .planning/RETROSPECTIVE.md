# Retrospective

## Milestone: v1.1 — Domain Access Control

**Shipped:** 2026-05-16
**Phases:** 2 | **Plans:** 2 | **Timeline:** 3 days (2026-05-13 → 2026-05-16)

### What Was Built

1. `isMainDomain()` + `DomainGuard` React components — `SubdomainOnly`/`MainDomainOnly` route wrappers, NotFound page, env-driven config
2. `MainDomainOnly` Rails concern — Origin-first extraction, ENV.fetch config, fires before Cognito auth, 5 integration tests

### What Worked

- Single-plan phases kept execution fast and reviewable — no cross-plan dependencies to coordinate
- Planning artifacts (RESEARCH.md, PATTERNS.md, code examples in PLAN.md) let executor work without codebase exploration
- Code review caught 2 pre-existing critical bugs surfaced by touching those files — good habit to keep

### What Was Inefficient

- Milestone had only 2 plans — could have been batched into one phase if scoped together earlier

### Patterns Established

- Guard ordering rule: `include MainDomainOnly` before `include CognitoAuth` — domain check fires before auth
- Frontend guard pattern: named exports, Outlet pass-through, no default exports
- Code review generates CR/WR/IN findings even for small phases — useful for catching pre-existing issues

### Key Lessons

- UX guards (frontend) and security boundaries (backend) must be treated as separate concerns with explicit handoff documentation; Phase 6 decision 06-01 made this explicit
- Small milestones close fast but may not justify full research/discuss overhead; consider lighter-weight planning for single-phase milestones

---

## Milestone: v1.0 — Security, OAuth & Calendar

**Shipped:** 2026-05-13
**Phases:** 5 | **Plans:** 30 | **Timeline:** 14 days (2026-04-29 → 2026-05-13)

### What Was Built

1. `Admin::BaseController#require_admin!` closed the RBAC gap across all 13 admin controllers; rack-attack rate limiting; BrokerageDomain CORS proc; N+1 elimination; per_page caps; tech debt cleanup (console.log, rename, dead component)
2. 17 backend integration tests (Minitest) + 7 frontend unit tests (Vitest 4.x + MSW 2.x) — tenant isolation, RBAC, FilterSets, GroupEstatesQuery, InvitationsController, ProtectedRoute, RequireRole, GoogleSignInButton
3. Domain wizard end-to-end; post-invite redirect to correct brokerage workspace; dismissible welcome banner
4. Google OAuth via Cognito federation + PreSignUp Lambda with `AdminLinkProviderForUser` + static intermediary callback page + "Sign in with Google" button + "Connected via Google" badge
5. `UserCalendarConnection` (AR Encryption) + `EstateDateCalendarEvent` + `CalendarSyncJob` (advisory lock, deterministic IDs) + Google Calendar adapter + CalendarTab settings UI

### What Worked

- **Wave-based parallel planning** — multi-plan phases ran in parallel waves (e.g., Phase 5 had 5 waves) without coordination overhead
- **Atomic "button + Lambda" constraint** — enforcing Phase 4 to ship GoogleSignInButton and PreSignUp Lambda together prevented a broken intermediate state
- **Fixed intermediary callback URL** — designing the `auth.realtybase.ca` strategy before Phase 4 planning eliminated the multi-tenant OAuth redirect problem entirely
- **Advisory lock pattern for CalendarSyncJob** — solved concurrent token refresh races upfront; no retries needed after deployment

### What Was Inefficient

- REQUIREMENTS.md checkboxes were never kept in sync with delivery — PROJECT.md Validated section became the live tracker, making the archive step require manual reconciliation
- The `04-05-SUMMARY.md` extra file in Phase 4 (5 summaries for 4 plans) suggests a stray file that should have been cleaned up at phase close
- Calendar migrations not applied to Render.com — required a separate out-of-band step after Phase 5 Plans were complete; could have been caught earlier with a deployment checklist

### Patterns Established

- `PROVIDERS = %w[google].freeze` + `providerOrder = ['google']` as the single activation point for new calendar providers — activate Microsoft/Apple by expanding these two constants
- `CalendarContext` co-located in `containers/account/` as a parallel hook to `AccountContext` — not extending it (separation of concerns)
- `useMutation` for OAuth authorize GET (not `useQuery`) — OAuth redirects are side effects, not data fetches
- Advisory lock on `UserCalendarConnection.id` for token refresh serialization

### Key Lessons

- Scope deferred work explicitly at the activation point (PROVIDERS constant) rather than just "not implementing it" — makes future activation a 1-line change, not a discovery task
- REQUIREMENTS.md needs a lightweight sync step at each phase close, not just at milestone close — consider a `gsd-check-requirements` pass after each plan
- Static OAuth callback pages (no React, just Amplify CDN) work well for the intermediary callback pattern — worth reusing for future provider additions

### Cost Observations

- Sessions: multiple across 14 days
- Model: Claude Sonnet 4.6 throughout
- Notable: wave-based parallel execution kept single-session context manageable; most phases completed in under 10 minutes per plan

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 5 |
| Plans | 30 |
| Days | 14 |
| Avg plans/day | 2.1 |
| Deferred items at close | 2 (CAL-04, CAL-05) |
