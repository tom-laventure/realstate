# Requirements — v1.4 Main Domain Admin Portal

**Milestone:** v1.4 — Main Domain Admin Portal
**Status:** Active
**Created:** 2026-05-24

---

## Portal — Main Domain Dashboard Shell

- [ ] **PORTAL-01**: User can access `/dashboard/*` on the main domain (routes exist alongside `/create/*`)
- [x] **PORTAL-02**: User can reach board registrations, user management, group management, and invitations from the main domain dashboard
- [ ] **PORTAL-03**: User can see the active brokerage name and their role displayed in the dashboard nav bar

## Auth — Authentication Routing & Access Control

- [ ] **AUTH-05**: User signing in on the main domain with ≥1 admin role is redirected to the brokerage selection screen
- [ ] **AUTH-06**: User signing in on the main domain with no admin roles anywhere sees a no-access screen explaining they must use their brokerage subdomain
- [ ] **AUTH-07**: Unauthenticated user accessing `/dashboard/*` is redirected to sign-in

## Brok — Brokerage Selection & Switching

- [x] **BROK-01**: User can see a card per brokerage they admin (with brokerage name and role) on the brokerage selection screen
- [x] **BROK-02**: User admining exactly one brokerage bypasses the selection screen and lands directly on the dashboard
- [ ] **BROK-03**: User can switch the active brokerage via a dropdown in the nav bar without leaving the current page
- [ ] **BROK-04**: Switching brokerage via the nav dropdown updates all visible admin panel data to the newly selected brokerage

## BE — Backend API

- [ ] **BE-01**: Admin user can call `GET /v1/account/admin_brokerages` and receive a list of all brokerages where they hold an admin or owner role
- [ ] **BE-02**: Backend resolves `Current.brokerage` from `X-Brokerage-Id` request header when the request Host is the main domain, enabling existing `/v1/admin/**` endpoints to serve main-domain requests
- [ ] **BE-03**: Admin endpoint called from main domain without a valid `X-Brokerage-Id` header returns HTTP 400 Bad Request

## ONB — Post-Create Flow

- [x] **ONB-04**: User completing the brokerage creation wizard is redirected to the main domain dashboard with the newly created brokerage auto-selected

---

## Future Requirements

- Brokerage switch data refreshes while preserving active tab position (UX polish, defer to v1.5)
- Deep-link into specific admin panel by URL (e.g. `/dashboard/boards`) while preserving brokerage context across navigation

## Out of Scope

- Non-admin users managing profile from main domain — main domain portal is admin-only; agents use their brokerage subdomain
- Main domain showing listing data — /dashboard is admin-management only, not a listing discovery interface
- Creating additional brokerages from the dashboard — creation wizard lives at /create, not from within the portal
- Invitation accept flows on main domain — invitations resolve to brokerage subdomains (existing ONB-02)

---

## Traceability

| REQ-ID | Phase | Plan |
|--------|-------|------|
| BE-01 | Phase 15 | TBD |
| BE-02 | Phase 15 | TBD |
| BE-03 | Phase 15 | TBD |
| PORTAL-01 | Phase 16 | TBD |
| AUTH-05 | Phase 16 | TBD |
| AUTH-06 | Phase 16 | TBD |
| AUTH-07 | Phase 16 | TBD |
| BROK-01 | Phase 17 | TBD |
| BROK-02 | Phase 17 | TBD |
| ONB-04 | Phase 17 | TBD |
| PORTAL-02 | Phase 18 | 18-02 |
| PORTAL-03 | Phase 18 | TBD |
| BROK-03 | Phase 18 | TBD |
| BROK-04 | Phase 18 | TBD |
