# v1.9 Requirements — Dashboard & Navbar Enhancement

## Active Requirements

### Data Enrichment

- [x] **DASH-01**: User can see per-brokerage stats (client count, agent count, owner names) returned from the existing `GET /v1/account/admin_brokerages` endpoint without additional network requests
- [x] **DASH-02**: Frontend `AdminBrokerage` interface includes `clientCount`, `memberCount`, and `owners` (array of `{firstName, lastName}`) fields

### Brokerage Selection Page

- [x] **DASH-03**: User sees a full-width page layout on `/dashboard` — brokerage cards are no longer confined to a centered mini-panel
- [x] **DASH-04**: Each brokerage card on `/dashboard` displays the brokerage name, user's role badge, client count, agent count, and owner full names

### Navbar Unification

- [ ] **DASH-05**: `/dashboard` has a dedicated navbar showing the SaaS brand logo (from `VITE_BRAND_LOGO_URL`) on the left and an account menu (account settings + sign out) on the right — no brokerage selector or role badge
- [ ] **DASH-06**: `/dashboard/:brokerageId` navbar (`PortalNavBar`) shows the SaaS brand logo immediately left of the brokerage selector dropdown
- [ ] **DASH-07**: `VITE_BRAND_LOGO_URL` env var is read by the frontend and used in both navbar variants

---

## Future Requirements

- Brokerage card showing active listing count (deferred — not requested for v1.9)
- Clicking "Go to site" from the `/dashboard` selection page (deferred — no active brokerage context)
- Per-brokerage activity summary on selection cards (deferred)

---

## Out of Scope

- Notifications bell on `/dashboard` navbar — no active brokerage context on the selection page; adding it would require cross-brokerage notification aggregation (separate milestone)
- "Go to Site" link on `/dashboard` navbar — requires a primary domain lookup per brokerage; deferred to avoid N+1 and complexity on the selection screen
- Brokerage switch preserving active tab position — carry-forward from v1.4; separate UX milestone
- Deep-link into admin panel with brokerage context preserved — carry-forward from v1.4; separate UX milestone

---

## Traceability

| Requirement | Phase | Plan |
|-------------|-------|------|
| DASH-01 | 27 | 01 |
| DASH-02 | 27 | 02 |
| DASH-03 | 28 | 01 |
| DASH-04 | 28 | 01 |
| DASH-05 | 29 | — |
| DASH-06 | 29 | — |
| DASH-07 | 29 | — |
