# Requirements — v1.1 Milestone

**Project:** RealState SaaS Platform
**Milestone:** v1.1 — Domain Access Control
**Created:** 2026-05-13
**Status:** Active

---

## v1.1 Requirements

### Domain Routing & Access Control (DOM)

- [x] **DOM-01**: Frontend reads main domain from `VITE_MAIN_DOMAIN` env var and detects whether `window.location.hostname` matches the main domain at runtime — Validated in Phase 6
- [x] **DOM-02**: On the main domain, all routes except `/create/*` render a 404 (not-found) page; authenticated app routes (dashboard, admin, account) are inaccessible from the main domain — Validated in Phase 6
- [x] **DOM-03**: On brokerage subdomains and custom domains, navigating to `/create` (or any `/create/*` sub-path) redirects to `/` (brokerage dashboard) — Validated in Phase 6
- [x] **DOM-04**: All `/v1/onboarding/*` backend endpoints reject requests not originating from the main domain with HTTP 403; applies to brokerage create, domain check/verify, and user profile update — Validated in Phase 7
- [x] **DOM-05**: Backend reads the main domain from the existing `APP_BASE_DOMAIN` env var for origin validation; no hardcoded domain strings in guard logic — Validated in Phase 7

---

## Future Requirements (Deferred)

- Microsoft Calendar sync (CAL-04) — adapter built in v1.0, activate by expanding `PROVIDERS`
- Apple CalDAV sync (CAL-05) — adapter built in v1.0, activate by expanding `PROVIDERS`
- Two-way calendar sync — requires webhooks and conflict resolution strategy
- Expanded test coverage: context hooks, calendar UI states
- JWT → HttpOnly cookies migration
- Redux → Context/TanStack Query migration

---

## Out of Scope

- Marketing/landing page on main domain — user explicitly excluded; `/create` is the only main-domain surface
- Sign-in page on main domain — `/create` flow embeds its own auth; no standalone `/auth/login` on main domain
- Subdomain creation during registration flow changes — wizard logic is out of scope; only routing guards change
- Apple / Microsoft social login — separate auth milestone

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DOM-01 | Phase 6 | Complete — 2026-05-14 |
| DOM-02 | Phase 6 | Complete — 2026-05-14 |
| DOM-03 | Phase 6 | Complete — 2026-05-14 |
| DOM-04 | Phase 7 | Complete — 2026-05-16 |
| DOM-05 | Phase 7 | Complete — 2026-05-16 |
