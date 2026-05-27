# Requirements — v1.5 Domain Management

**Milestone:** v1.5 — Domain Management
**Status:** Active

---

## DMOD — Domain Model & Backend API

- [x] **DMOD-01**: `brokerage_domains` extended with `domain_type` (enum: subdomain/custom), `status` (enum: active/phasing_out/decommissioned), `is_primary` (boolean, not null, default false), `phase_out_at` (datetime, nullable)
- [x] **DMOD-02**: Data migration backfills all existing rows as `domain_type: subdomain`, `status: active`, `is_primary: true`
- [x] **DMOD-03**: API uniqueness check covers all records with `status != decommissioned`; error messages do not reveal which brokerage owns a claimed domain
- [x] **DMOD-04**: Subdomain slug validated: alphanumeric and hyphens only; cannot match a reserved word (app, admin, api, www, mail, smtp, ftp, staging, dev, test — full list enumerated during implementation)
- [ ] **DMOD-05**: Custom domain endpoints require `plan == 'premium'`; basic-tier brokerages receive HTTP 403 with an upgrade message
- [ ] **DMOD-06**: `GET /v1/admin/domains` returns all active and phasing-out domains for the brokerage with `id`, `domain`, `domain_type`, `status`, `is_primary`, `phase_out_at`
- [ ] **DMOD-07**: `PATCH /v1/admin/domains/subdomain` transitions the current active subdomain to 30-day phase-out and creates a new active subdomain; blocked when 2 phasing-out subdomains already exist
- [ ] **DMOD-08**: `POST /v1/admin/domains/custom` adds a custom domain (Pro only); transitions any existing active custom domain to 30-day phase-out; blocked when 2 phasing-out custom domains already exist
- [ ] **DMOD-09**: `DELETE /v1/admin/domains/:id` on an active custom domain transitions it to 30-day phase-out; blocked when 2 phasing-out custom domains already exist
- [ ] **DMOD-10**: `PATCH /v1/admin/domains/:id/set_primary` designates an active domain as primary; rejects phasing-out or decommissioned domains with HTTP 422
- [ ] **DMOD-11**: When an action would land at exactly 2 phasing-out domains of the same type, the action proceeds but the response includes a `phase_out_warning` with the date the earliest slot opens
- [ ] **DMOD-12**: When 2 phasing-out domains of the same type already exist, the action returns HTTP 422 with `earliest_slot_available_at` in the error body
- [ ] **DMOD-13**: `GET /v1/domains/lookup?domain=X` — public, unauthenticated; returns the primary domain for the brokerage owning domain X (active or phasing-out); 404 if not found
- [ ] **DMOD-14**: `DELETE /v1/admin/domains/:id` on a phasing-out domain immediately decommissions it (`status: decommissioned`, `deleted_at: now`), freeing the phase-out slot and releasing the uniqueness claim

## DINT — System Integration

- [ ] **DINT-01**: On app init, frontend detects if `window.location.hostname` ≠ brokerage's primary domain and redirects to `https://{primary_domain}/{same_path+query}`
- [ ] **DINT-02**: `InvitationMailer#primary_domain` updated to query `is_primary: true` instead of `first`
- [x] **DINT-03**: `BrokerageAuth` resolves brokerage from domains with `status: active` or `status: phasing_out`; decommissioned domains return 404
- [x] **DINT-04**: `V1::DomainsController#check` (Caddy TLS endpoint) updated to filter by `status: active` instead of `deleted_at: nil`

## DUI — Admin Domains Page

- [ ] **DUI-01**: `/admin/domains` route added to both the subdomain admin router and the main-domain portal admin; "Domains" nav item added to both sidebars (PortalAdminSideNav and AppShellAdmin)
- [ ] **DUI-02**: Domain cards display: name, type badge (Subdomain / Custom Domain), status badge (Active / Phasing Out), and a countdown for phasing-out domains showing days remaining and decommission date
- [ ] **DUI-03**: Primary domain card has a "Primary" badge; active non-primary domain cards have a "Set as primary" action
- [ ] **DUI-04**: Subdomain card has an "Edit" action opening an inline form with client-side slug validation (format + reserved-word list) before submit
- [ ] **DUI-05**: Custom domain section (Pro): "Add domain" button opens a form; existing active custom domain has a "Remove" action with a confirmation dialog
- [ ] **DUI-06**: When an action succeeds but would leave exactly 1 slot remaining, the success state shows a yellow warning: "Next change will be your last until [date]"
- [ ] **DUI-07**: When 0 phase-out slots remain, the relevant action button is disabled with an inline message: "Unavailable until [date]"; force-removing a phasing-out domain is surfaced as a way to free a slot immediately
- [ ] **DUI-08**: Non-Pro brokerage: custom domain section shows a locked card with an upgrade prompt; no management controls visible
- [ ] **DUI-09**: Phasing-out domain cards have a "Remove now" action that opens a confirmation dialog warning the domain stops resolving immediately and cannot be undone

---

## Future Requirements (carried to v1.6+)

- DNS verification for custom domains — without it, uniqueness is best-effort at input time; a user can claim a domain they do not own; DNS verification milestone enforces true ownership
- Multi-domain round-robin / load balancing
- Server-side HTTP 301 redirect at the Caddy layer (current implementation is a client-side redirect on app init; true 301 requires Caddy config changes)
- Microsoft Calendar sync (CAL-04) — adapter built in v1.0; activate by expanding `PROVIDERS`
- Apple CalDAV sync (CAL-05) — adapter built in v1.0; activate by expanding `PROVIDERS`

## Out of Scope

- DNS verification — explicitly deferred; document the gap so future milestone can close it
- Multi-domain round-robin / load balancing
- Server-side 301 at the Caddy/proxy layer — client-side redirect on app init is sufficient for this milestone
- Apple / Microsoft social login
- Two-way calendar sync

---

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| DMOD-01 | Phase 19 | — | ⬜ Pending |
| DMOD-02 | Phase 19 | — | ⬜ Pending |
| DMOD-03 | Phase 19 | — | ⬜ Pending |
| DMOD-04 | Phase 19 | — | ⬜ Pending |
| DMOD-05 | Phase 20 | — | ⬜ Pending |
| DMOD-06 | Phase 20 | — | ⬜ Pending |
| DMOD-07 | Phase 20 | — | ⬜ Pending |
| DMOD-08 | Phase 20 | — | ⬜ Pending |
| DMOD-09 | Phase 20 | — | ⬜ Pending |
| DMOD-10 | Phase 20 | — | ⬜ Pending |
| DMOD-11 | Phase 20 | — | ⬜ Pending |
| DMOD-12 | Phase 20 | — | ⬜ Pending |
| DMOD-13 | Phase 20 | — | ⬜ Pending |
| DMOD-14 | Phase 20 | — | ⬜ Pending |
| DINT-01 | Phase 21 | — | ⬜ Pending |
| DINT-02 | Phase 20 | — | ⬜ Pending |
| DINT-03 | Phase 19 | — | ⬜ Pending |
| DINT-04 | Phase 19 | — | ⬜ Pending |
| DUI-01 | Phase 21 | — | ⬜ Pending |
| DUI-02 | Phase 21 | — | ⬜ Pending |
| DUI-03 | Phase 21 | — | ⬜ Pending |
| DUI-04 | Phase 21 | — | ⬜ Pending |
| DUI-05 | Phase 21 | — | ⬜ Pending |
| DUI-06 | Phase 21 | — | ⬜ Pending |
| DUI-07 | Phase 21 | — | ⬜ Pending |
| DUI-08 | Phase 21 | — | ⬜ Pending |
| DUI-09 | Phase 21 | — | ⬜ Pending |
