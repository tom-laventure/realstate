# Retrospective

## Milestone: v1.2 — Listing Map View

**Shipped:** 2026-05-18
**Phases:** 3 | **Plans:** 7 | **Timeline:** 2 days (2026-05-16 → 2026-05-18)

### What Was Built

1. Nominatim geocoding pipeline — `GeocodingService` + `GeocodeListingsJob` (retry/discard) + `geocode:backfill` rake task; `decimal(10,6)` lat/lng columns on `listing_details`
2. `GET /coordinates` endpoint — filter-forwarding, null-coord-excluding lightweight projection; 6 integration tests
3. `GroupMapPanel` (react-map-gl + use-supercluster, clustering, popups) wired into GeneralDashboard with `keepPreviousData` filter sync
4. `EstateLocationMap` single-pin listing detail map — conditional on coordinates, outside tab system

### What Worked

- **Mapbox migration mid-phase** — discovering that Mapbox was the better fit (Plan 03 revision) before Plan 04 executed avoided a painful rewrite; CONTEXT.md made the rationale clear for Phase 10 to follow
- **Custom Marker child pattern** — react-map-gl v8 childless Marker click issue was caught during human verification and fixed immediately; the fix is now documented in the SUMMARY as a reusable pattern
- **`fitBounds` guard** — identifying the re-centering UX problem early (RESEARCH.md Pitfall) and solving it with a simple ref avoided a latent user complaint
- **Phase 10 followed Phase 9 patterns exactly** — same entry point, same cooperativeGestures, same fill-primary pin; zero new decisions needed

### What Was Inefficient

- REQUIREMENTS.md checkbox sync — MAP-02/03/05/06 were never checked off during Phase 9 close; required manual reconciliation at milestone archive (same lesson as v1.0, still not resolved)
- Google Maps libs installed in Plan 03, then migrated to Mapbox in Plan 03 revised — adding one exploratory research step before Plan 03 would have caught this before any npm installs

### Patterns Established

- `react-map-gl/mapbox` entry point (not `react-map-gl`) — always use for Mapbox GL JS v3 compatibility
- Custom `<button>` child on `<Marker>` with `e.stopPropagation()` — required for reliable click events in react-map-gl v8
- `hasFitBoundsRef` + `fitBounds` on first load only — standard pattern for map panels that filter-sync
- `hero_image_url || images[0]` fallback in coordinates SELECT — defensive against seed data gaps

### Key Lessons

- REQUIREMENTS.md checkbox sync needs to happen at each phase close, not just at milestone close — the same gap appeared in v1.0 and v1.2; worth adding a reminder to the phase close checklist
- Migration from one mapping library to another mid-phase is cheap when done before implementation starts, expensive after — spike/research should explicitly evaluate library fit before installation
- `decimal(10,6)` for coordinates is settled — this is the project standard; no need to revisit

### Cost Observations

- Sessions: 3–4 across 2 days
- Model: Claude Sonnet 4.6 throughout
- Notable: 2 days for 7 plans including human verification; fast because Phase 9's patterns made Phase 10 a copy-and-simplify exercise

---

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

| Metric | v1.0 | v1.1 | v1.2 |
|--------|------|------|------|
| Phases | 5 | 2 | 3 |
| Plans | 30 | 2 | 7 |
| Days | 14 | 3 | 2 |
| Avg plans/day | 2.1 | 0.7 | 3.5 |
| Deferred items at close | 2 (CAL-04, CAL-05) | 2 (CR-01, CR-02) | 0 |

**Trend:** Velocity accelerating — v1.2 averaged 3.5 plans/day vs 2.1 in v1.0. REQUIREMENTS.md sync gap is a recurring issue across all three milestones.
