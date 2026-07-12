# Requirements: RealState SaaS Platform — v1.11 Brokerage Ownership Management

**Defined:** 2026-07-12
**Core Value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.

## v1.11 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Settings Page

- [ ] **SET-01**: `/admin/settings` page exists with Ownership Management as the first (and currently only functional) section; a Billing section is stubbed below it with a `# TODO: Add billing management section` comment, not rendered as user-facing UI
- [ ] **SET-02**: Owners have full access to the Ownership Management section (view + all add/remove actions); admins and agents have read-only access (owner list + role descriptions, no action buttons); clients have no access to `/admin/settings` at all (existing route guard handles this — no new guard needed)

### Current Owners

- [ ] **OWN-01**: Current Owners section lists all brokerage owners, each entry showing full name + email (no avatars, no timestamps)

### Add Owner

- [ ] **OWN-02**: "Add Owner" action is visible to owners only
- [ ] **OWN-03**: Add Owner opens a modal (Dialog/AlertDialog) containing a searchable dropdown filtered to brokerage users whose current role is `admin` or `agent` (clients excluded); each option shows name + current role; a note beneath the dropdown reads "Only admins and agents can be promoted to owner."
- [ ] **OWN-04**: Add Owner modal displays clear warning copy explaining what owner-level permissions grant, before the confirm action
- [ ] **OWN-05**: Confirming Add Owner calls the promote API; the promoted user's previous role is fully replaced by `owner` (no memory of prior role stored); on success, the owners query key is invalidated to refetch the list

### Remove Owner

- [ ] **OWN-06**: Each owner entry has a Remove action, visible to owners only
- [ ] **OWN-07**: Remove Owner opens a two-step modal: Step 1 is a warning explaining what removing this user's owner access means, recommending reassignment to `client` only if the goal is to fully remove the user's admin privileges; Step 2 is a required role picker (radio or select) with options `admin`, `agent`, `client`, defaulting to `admin`. A single confirm button on Step 2 triggers the API.
- [ ] **OWN-08**: Confirming step 2 calls the demote API to reassign the owner to the selected role; on success, the owners query key is invalidated to refetch the list
- [ ] **OWN-09**: Self-demotion is allowed as long as at least one other owner remains after the change
- [ ] **OWN-10**: If the target is the only owner, the Remove button is disabled with a tooltip explaining why removal is blocked

### Backend API

- [ ] **API-01**: `GET /admin/settings/owners` returns the list of current brokerage owners (name, email)
- [ ] **API-02**: `GET /admin/settings/owners/eligible` returns brokerage users with role `admin` or `agent`, for the Add Owner dropdown
- [ ] **API-03**: `POST /admin/settings/owners` promotes a user to owner; requires the caller to have the `owner` role
- [ ] **API-04**: `PATCH /admin/settings/owners/:id` demotes an owner and reassigns their role to `admin`/`agent`/`client`; requires the caller to have the `owner` role; rejects the request if the target is the last owner
- [ ] **API-05**: All new endpoints validate the caller's role via JWT claims server-side — frontend role gates are UX-only and must not be the sole enforcement

### Lockdown (existing add-agent endpoint)

- [ ] **LOCK-01**: `POST /admin/brokerage/add-agent` rejects `owner` role assignment with HTTP 403 Forbidden — owner role can only be assigned via the new settings endpoint
- [ ] **LOCK-02**: The role selector on the `/admin/brokerage/add-agent` frontend page no longer offers "owner" as an option (only `admin` and `agent` assignable there)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Ownership Management

- **OWN-11**: Audit log of ownership changes (who promoted/demoted whom, when)
- **OWN-12**: Email notifications sent on role change (promotion/demotion)
- **BILL-01**: Full Billing management section on `/admin/settings`

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Super admin actions (cross-brokerage) | Handled separately, outside brokerage-scoped admin settings |
| Billing section functionality | Stubbed as `# TODO` placeholder only this milestone |
| Audit log of ownership changes | Deferred to v2 — not required for the security gap this milestone closes |
| Email notifications on role change | Deferred to v2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SET-01 | Phase 34 | Pending |
| SET-02 | Phase 34 | Pending |
| OWN-01 | Phase 34 | Pending |
| OWN-02 | Phase 34 | Pending |
| OWN-03 | Phase 34 | Pending |
| OWN-04 | Phase 34 | Pending |
| OWN-05 | Phase 34 | Pending |
| OWN-06 | Phase 35 | Pending |
| OWN-07 | Phase 35 | Pending |
| OWN-08 | Phase 35 | Pending |
| OWN-09 | Phase 35 | Pending |
| OWN-10 | Phase 35 | Pending |
| API-01 | Phase 33 | Pending |
| API-02 | Phase 33 | Pending |
| API-03 | Phase 33 | Pending |
| API-04 | Phase 33 | Pending |
| API-05 | Phase 33 | Pending |
| LOCK-01 | Phase 33 | Pending |
| LOCK-02 | Phase 33 | Pending |

**Coverage:**
- v1.11 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-12*
*Traceability updated: 2026-07-12 after ROADMAP.md creation (Phases 33–35)*
*Last updated: 2026-07-12 after milestone v1.11 kickoff*
