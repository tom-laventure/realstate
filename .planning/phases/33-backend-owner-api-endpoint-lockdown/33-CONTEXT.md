# Phase 33: Backend Owner API & Endpoint Lockdown - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend enforces owner-only ownership changes and exposes the new owner-management API surface — closing the admin-takeover security gap (chained CR-02/CR-03 from the v1.10 review, cited in `.planning/STATE.md` Blockers/Concerns) before any Phase 34/35 frontend surface depends on it. This phase is backend-only: no new frontend UI ships here beyond the LOCK-02 role-selector edit on the existing `add-agent` page.

In scope: `POST /admin/brokerage/add-agent` lockdown (LOCK-01/LOCK-02), four new owner-management endpoints (API-01–05), and closing the `users#destroy`/`users#update` bypass paths around owner-role changes (discovered during discussion, tied to the phase goal's explicit CR-02/CR-03 framing).

Out of scope: any `/admin/settings` frontend UI (Phase 34), Remove Owner two-step modal (Phase 35), audit logging or email notifications on role change (deferred to v2 per REQUIREMENTS.md).

</domain>

<decisions>
## Implementation Decisions

### Endpoint lockdown scope (CR-02/CR-03 closure)
- **D-01:** `UsersController#destroy` (`DELETE /v1/admin/users/:id`) gets a `require_owner!` guard when the target user's current role is `owner`, plus a last-owner rejection (cannot destroy the brokerage's only remaining owner). Non-owner targets keep the existing `require_admin!` behavior. This closes CR-03 (any admin could previously destroy an owner's membership with zero guard).
- **D-02:** `UsersController#update` (`PATCH /v1/admin/users/:id`) now rejects `role: "owner"` outright (403) in both directions — assigning owner OR demoting away from owner — regardless of caller role, including existing owners. All owner-role changes must go through the new `POST/PATCH /admin/settings/owners` endpoints, which are the only place with the last-owner guard. This closes the bypass where an owner could demote another owner via the generic endpoint and skip the last-owner check.
- **D-03:** `InvitationsController#create` (`POST /v1/admin/invitations`, the actual endpoint behind the `/admin/brokerage/add-agent` frontend route) keeps its existing `require_admin!` gate for the action as a whole, but adds a value-level rejection: `role: "owner"` is rejected (403) for any caller, admin or owner. Admins/owners can still invite new `agent`/`admin`-role users — this doesn't upgrade the whole action to owner-only. This is LOCK-01. Owner promotion for existing members is a fully separate path (API-03) that invitations never touch.

### Promote mechanism (Add Owner)
- **D-04:** `POST /admin/settings/owners` is an instant, direct `BrokerageMembership` role update — no `Invitation` record, no email, no acceptance step. The target is always an existing brokerage member (already `admin` or `agent`); this mirrors the existing `users#update` pattern (`membership.update!`) rather than the invitation flow, which exists only for onboarding people who aren't members yet.
- **D-05:** The promote endpoint validates server-side that the target's *current* role is `admin` or `agent` before promoting (422/403 otherwise) — it does not trust that the frontend only ever submits IDs from the eligible-list endpoint. Consistent with API-05 ("frontend role gates are UX-only") and the project's backend-is-the-trust-boundary pattern.

### List endpoint shape
- **D-06:** Both `GET /admin/settings/owners` and `GET /admin/settings/owners/eligible` return the full unpaginated array (no Pagy meta) — same `paginate=false`-style convention CLAUDE.md documents for filter-dropdown endpoints. Both lists are inherently small and bounded per brokerage.
- **D-07:** `GET /admin/settings/owners/eligible` does not accept a `?q=` search param. OWN-03's "searchable dropdown" is implemented as client-side filtering over the full returned array on the frontend (Phase 34 concern) — the backend endpoint stays simple.

### Claude's Discretion
- Exact HTTP status code for the last-owner rejection on demote/destroy (422 vs 403) — pick whichever matches the existing convention most closely at implementation time (existing `render_forbidden` uses 403; validation-style rejects in this codebase tend to use 422).
- Route/controller naming for the new owner-management endpoints (e.g., `Admin::Settings::OwnersController` vs `Admin::OwnersController`) — follow existing namespace conventions found in `backend/config/routes.rb`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Security gap being closed (source of truth — no review doc exists anymore)
- `.planning/STATE.md` §Blockers/Concerns — the only remaining written description of the CR-02/CR-03 chain (`30-REVIEW.md` itself no longer exists in `.planning/`; do not search for it)
- `backend/app/controllers/v1/admin/invitations_controller.rb` — `create` action (lines ~30-70), currently `require_admin!` only, no role-value guard — this is the actual endpoint behind the `/admin/brokerage/add-agent` frontend page (LOCK-01 target)
- `backend/app/controllers/v1/admin/users_controller.rb` — `update` action has a partial owner-assign guard already (`role == "owner" && current_role != "owner"` → 403); `destroy` action has `require_admin!` only, zero owner-specific guard (D-01/D-02 targets)

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — LOCK-01, LOCK-02, API-01–05 (full acceptance criteria for this phase)
- `.planning/ROADMAP.md` — Phase 33 entry, Success Criteria 1-5

### Existing patterns to follow
- `backend/app/controllers/v1/admin/base_controller.rb` — `require_owner!`, `require_admin!`, `require_agent_or_above!`, `current_membership` helpers already exist and should be reused, not reimplemented
- `backend/app/controllers/v1/admin/brokerages_controller.rb` — example of `skip_before_action :require_agent_or_above!` + `before_action :require_owner!, only: [:update]` pattern for an owner-only action
- `backend/app/controllers/v1/admin/users_controller.rb#index` — `paginate=false` bypass pattern (`params[:paginate] == "false" ? [nil, users] : pagy(users)`) to reuse for D-06

### Frontend surface affected by LOCK-02 (this phase only touches the role selector, not the rest of the page)
- `frontend/src/components/view/admin/brokerageView/addAgentView/AddAgentView.tsx` — line ~99, `<SelectItem value="owner">Owner</SelectItem>` must be removed from the role `<Select>`
- `frontend/src/containers/adminBoard/brokerageAdminBoard/addAgentAdminBoard/AddAgentAdminBoard.tsx` — no change expected; calls `useCreateAdminUser` unchanged
- `frontend/src/store/hooks/Admin/Users/useCreateAdminUser.tsx` / `frontend/src/assets/api/admin/users/createAdminUser.tsx` — posts to `/v1/admin/invitations`; will need to surface the new 403 (owner-role-rejected) error to the user via the existing `onError` toast, no structural change

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Admin::BaseController#require_owner!` / `#require_admin!` / `#current_membership` — already implement the exact role-check primitives this phase needs; new controller(s) should `include`/inherit from `Admin::BaseController`, not duplicate logic
- `AppConstants::BROKERAGE_ROLES` (`backend/app/constants/roles.rb`) — `%w[owner admin agent staff client]`, use for role-value validation on the new endpoints
- `UsersController#index`'s `paginate=false` branch — direct precedent for D-06

### Established Patterns
- Query objects live in `app/queries/`; if owners/eligible-list filtering grows beyond a simple `where(brokerage_memberships: {role: ...})`, follow the `QueryClass.new(scope_owner, params).call` pattern (see `backend/app/queries/`)
- Every model-touching query in this codebase uses `acts_as_paranoid` — `BrokerageMembership` and `User` both need `.without_deleted` scoping in the new endpoints
- Serializer pattern: a lightweight owner-list response (name + email only, per OWN-01) likely doesn't need a full `UserSerializer` — a minimal inline hash or a small dedicated serializer is appropriate; no computed/N+1-prone attributes are involved here

### Integration Points
- New routes belong under `namespace :admin do ... end` in `backend/config/routes.rb`, alongside the existing `resources :users`, `resource :brokerage` blocks
- `InvitationsController#create` and `UsersController#update`/`#destroy` are the three existing action bodies this phase edits in place — no new controller needed for the lockdown half of the phase, only for the new owners endpoints

</code_context>

<specifics>
## Specific Ideas

No specific UI/UX references — this phase is backend-only. See Decisions above for the concrete API contract choices (instant promote, unpaginated lists, dual-direction owner-role lockdown on `users#update`).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Audit logging and email notifications on ownership change are already tracked as v2 requirements OWN-11/OWN-12 in `.planning/REQUIREMENTS.md`, not raised fresh here.)

</deferred>

---

*Phase: 33-backend-owner-api-endpoint-lockdown*
*Context gathered: 2026-07-12*
