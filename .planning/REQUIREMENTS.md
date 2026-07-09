# Requirements: RealState SaaS Platform — v1.10 Agent Admin Permissions

**Defined:** 2026-07-09
**Core Value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.

## v1 Requirements

Requirements for the v1.10 milestone. Each maps to roadmap phases.

### Admin Access

- [ ] **ACCESS-01**: Agent role can access the admin dashboard shell (previously `owner`/`admin` only)
- [ ] **ACCESS-02**: Agent has read-only access to the Users list and user detail view (no edit/delete)
- [ ] **ACCESS-03**: Agent has read-only access to Brokerage settings (info, branding, board registrations) — no edit
- [ ] **ACCESS-04**: Agent has read-only access to Boards and board credentials — no create/update/delete
- [ ] **ACCESS-05**: Agent has read-only access to Domains — no mutation actions
- [ ] **ACCESS-06**: Agent has read-only access to the brokerage Settings page
- [ ] **ACCESS-07**: Agent is fully blocked (no view, no create) from brokerage-level staff/agent invitations
- [ ] **ACCESS-08**: Domain-mutation buttons gated by `manage_brokerage_settings` only — fixes a gap where some mutation buttons are gated by the broader `access_admin_panel` and would incorrectly render for agents

### Group Management

- [ ] **GROUP-01**: Agent can create, edit, and delete groups
- [ ] **GROUP-02**: Agent can add existing brokerage users to a group
- [ ] **GROUP-03**: Agent can invite new (unregistered) clients to a group via email
- [ ] **GROUP-04**: Agent can manage group filter sets (create, edit, delete)
- [ ] **GROUP-05**: Agent can manage listings within a group (add, remove, search)

### Backend Enforcement

- [ ] **RBAC-01**: All group-scoped endpoints (`groups`, `group/users`, `group/invitations`, `group/filter_sets`, `group/estates`) accept `agent` role
- [ ] **RBAC-02**: Read-only admin endpoints (`users#index/show`, `brokerages#show`, `domains#index/verify`, `boards#index`, `board_credentials#index`, `activity#stats/index`) accept `agent` role
- [ ] **RBAC-03**: All write endpoints outside Groups scope (`users#update/destroy`, `brokerages#update`, domain mutations, `board_credentials#create/update/destroy`, brokerage-level invitations) continue to reject `agent` with HTTP 403

## v2 Requirements

None deferred — full scope committed to v1.10.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| `staff` role permissions | Only `agent` was in scope for this milestone; `staff` remains permissionless until requirements are defined |
| New granular `Permission` values beyond what's needed (e.g. separate `view_users` vs `view_brokerage`) | Existing 4-permission model (`access_admin_panel`, `manage_brokerage_settings`, `manage_users`, `manage_groups`) already produces the desired read/write split when combined with the shell-level role gate — introducing new permission types is unnecessary churn |
| Agent visibility into brokerage-level pending invitations (read-only) | The only UI for brokerage invitations is the creation form itself (`/admin/brokerage/add-agent`); no separate read-only view exists, so this is blocked entirely rather than split into partial access |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACCESS-01 | TBD | Pending |
| ACCESS-02 | TBD | Pending |
| ACCESS-03 | TBD | Pending |
| ACCESS-04 | TBD | Pending |
| ACCESS-05 | TBD | Pending |
| ACCESS-06 | TBD | Pending |
| ACCESS-07 | TBD | Pending |
| ACCESS-08 | TBD | Pending |
| GROUP-01 | TBD | Pending |
| GROUP-02 | TBD | Pending |
| GROUP-03 | TBD | Pending |
| GROUP-04 | TBD | Pending |
| GROUP-05 | TBD | Pending |
| RBAC-01 | TBD | Pending |
| RBAC-02 | TBD | Pending |
| RBAC-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 0
- Unmapped: 16 ⚠️ (roadmap creation pending)

---
*Requirements defined: 2026-07-09*
*Last updated: 2026-07-09 after initial definition*
