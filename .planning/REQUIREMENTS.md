# Requirements: RealState SaaS Platform — v1.10 Agent Admin Permissions

**Defined:** 2026-07-09
**Core Value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.

## v1 Requirements

Requirements for the v1.10 milestone. Each maps to roadmap phases.

### Admin Access

- [x] **ACCESS-01**: Agent role can access the admin dashboard shell (previously `owner`/`admin` only)
- [x] **ACCESS-02**: Agent has read-only access to the Users list and user detail view (no edit/delete)
- [x] **ACCESS-03**: Agent has read-only access to Brokerage settings (info, branding, board registrations) — no edit
- [x] **ACCESS-04**: Agent has read-only access to Boards and board credentials — no create/update/delete
- [x] **ACCESS-05**: Agent has read-only access to Domains — no mutation actions
- [x] **ACCESS-06**: Agent has read-only access to the brokerage Settings page
- [x] **ACCESS-07**: Agent is fully blocked (no view, no create) from brokerage-level staff/agent invitations
- [x] **ACCESS-08**: Domain-mutation buttons gated by `manage_brokerage_settings` only — fixes a gap where some mutation buttons are gated by the broader `access_admin_panel` and would incorrectly render for agents

### Group Management

- [x] **GROUP-01**: Agent can create, edit, and delete groups
- [x] **GROUP-02**: Agent can add existing brokerage users to a group
- [x] **GROUP-03**: Agent can invite new (unregistered) clients to a group via email
- [x] **GROUP-04**: Agent can manage group filter sets (create, edit, delete)
- [x] **GROUP-05**: Agent can manage listings within a group (add, remove, search)

### Backend Enforcement

- [x] **RBAC-01**: All group-scoped endpoints (`groups`, `group/users`, `group/invitations`, `group/filter_sets`, `group/estates`) accept `agent` role
- [x] **RBAC-02**: Read-only admin endpoints (`users#index/show`, `brokerages#show`, `domains#index/verify`, `boards#index`, `board_credentials#index`, `activity#stats/index`) accept `agent` role
- [x] **RBAC-03**: All write endpoints outside Groups scope (`users#update/destroy`, `brokerages#update`, domain mutations, `board_credentials#create/update/destroy`, brokerage-level invitations) continue to reject `agent` with HTTP 403

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
| ACCESS-01 | Phase 31 | Complete |
| ACCESS-02 | Phase 32 | Complete |
| ACCESS-03 | Phase 32 | Complete |
| ACCESS-04 | Phase 32 | Complete |
| ACCESS-05 | Phase 32 | Complete |
| ACCESS-06 | Phase 32 | Complete |
| ACCESS-07 | Phase 32 | Complete |
| ACCESS-08 | Phase 32 | Complete |
| GROUP-01 | Phase 31 | Complete |
| GROUP-02 | Phase 31 | Complete |
| GROUP-03 | Phase 31 | Complete |
| GROUP-04 | Phase 31 | Complete |
| GROUP-05 | Phase 31 | Complete |
| RBAC-01 | Phase 30 | Complete |
| RBAC-02 | Phase 30 | Complete |
| RBAC-03 | Phase 30 | Complete |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-09*
*Last updated: 2026-07-09 after roadmap creation (Phases 30–32)*
