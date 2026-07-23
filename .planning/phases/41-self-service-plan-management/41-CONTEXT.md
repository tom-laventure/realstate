# Phase 41: Self-Service Plan Management - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Brokerage owners can change their own brokerage's plan tier directly from `/admin/settings`, via a new "Plan" section. The change is wired to the real `ApplyPlanTransitionJob` cascade (proven in v1.12 Phases 37-39) through a new brokerage-scoped, owner-gated backend endpoint — not the existing internal `Ops::PlanController` testing tool. Downgrades (paid → Free) get a confirmation step explaining the freeze/suspend consequences before applying. Admin/agent see the current tier read-only.

</domain>

<decisions>
## Implementation Decisions

### Downgrade Confirmation Flow
- **D-01:** Single warning dialog, generic copy — explains in general terms that the custom domain will be frozen and real board credentials/client memberships will be suspended (not itemized counts). No preview/specifics endpoint needed.
- **D-02:** Plain Confirm/Cancel buttons — no type-to-confirm friction. The change is reversible (re-upgrade restores exactly what was suspended, per Phase 38), so the lighter Remove-Owner-style warning dialog is sufficient.

### 3-Way Selector UI
- **D-03:** Compact segmented control (Free | Independent | Growth), not the onboarding wizard's full price/feature cards. Current tier highlighted. Settings pages favor density over the onboarding wizard's marketing-card treatment.
- **D-04:** Admin/agent read-only view renders the *same* segmented control, disabled/non-interactive, with the current tier still highlighted — not a plain text/badge replacement. Keeps visual consistency between the owner and non-owner views.

### Upgrade & Lateral-Change UX
- **D-05:** Only downgrades (paid → Free) show the confirmation dialog. Upgrades (Free → paid) and lateral paid ↔ paid changes (Independent ↔ Growth) apply immediately on selection, no confirmation step — matches the roadmap's literal scope and keeps the common-case interaction fast.

### Async Job Feedback
- **D-06:** `ApplyPlanTransitionJob` runs via `perform_later` — the UI does not poll for job completion. On confirming a plan change, optimistically show the new tier as selected and fire a success toast (e.g. "Plan updated to Growth"), mirroring how `Ops::PlanController`'s synchronous-looking "transitioning" response already behaves and how Ownership Management's mutations are handled (no pending/spinner state, no polling infrastructure).
- **D-07:** After a plan change, invalidate only the plan/brokerage query — not Domains or Boards query keys. Those pages refresh independently on next visit/navigation; proactively invalidating them is out of this phase's scope.

### Claude's Discretion
- Exact query key names, hook file layout, and component decomposition within the "Plan" section are left to the planner/executor to match existing `useSettingsAdminContext` conventions.
- Whether the new backend endpoint lives under `V1::Admin::Settings::` (sibling to `OwnersController`) or a dedicated `V1::Admin::PlanController` is an implementation detail for the planner to resolve against existing routing conventions.

### Folded Todos
None — no pending todos matched this phase's scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plan tier model & transition cascade
- `.planning/PLAN-TIERS.md` — v1.12's full design rationale for the three-tier plan model and `ApplyPlanTransitionJob` cascade
- `backend/app/constants/plan_tiers.rb` (via `AppConstants::PLAN_TIERS`) — single source of truth for seat caps, prices, overage rates
- `backend/app/jobs/apply_plan_transition_job.rb` — the existing cascade this phase's endpoint must enqueue, not reimplement
- `backend/app/controllers/ops/plan_controller.rb` — the internal, non-owner-gated testing endpoint this phase's new endpoint replaces functionally (but does NOT reuse — new endpoint must be brokerage-scoped + owner-gated, unlike this one)

### Ownership Management pattern (structural analog)
- `backend/app/controllers/v1/admin/settings/owners_controller.rb` — analog for the new owner-gated, brokerage-scoped controller (`require_owner!` before_action pattern, DB-backed `current_membership` re-validation)
- `frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts` — the Brain this phase's Plan section state/actions extend
- `frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx` — insertion point (currently has `{/* TODO: Add billing management section */}` placeholder below `OwnershipManagementSection`)
- `frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx` — component-level analog, including its `<Can permission="manage_ownership">` gating pattern
- `frontend/src/assets/rbac/permissions.ts` — `Permission` union + `ROLE_PERMISSIONS` map; a new permission (e.g. `manage_plan`) likely needs to be added here, owner-only

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSettingsAdminContext.ts` — existing Brain pattern (state/actions via `useMemo`) that the Plan section's data/actions should extend, not duplicate
- `Can` guard component (`@/components/common/guards/Can`) — used for `manage_ownership`; same pattern applies to gating the plan selector's edit control
- `ApplyPlanTransitionJob` — fully proven cascade (TEST-board purge, domain freeze/restore, credential/membership suspend, billing snapshot) from Phases 37-39; this phase only needs to enqueue it correctly, no new transition logic
- shadcn segmented-control-equivalent primitives (Tabs or ToggleGroup) available for the 3-way selector — planner to confirm which shadcn primitive best fits "3 options, one active, some disabled"

### Established Patterns
- Owner-gated backend actions: `skip_before_action :require_agent_or_above!` + `before_action :require_owner!` on specific actions only (see `OwnersController`), not a whole-controller gate — read/current-plan endpoint should stay `require_agent_or_above!` (visible to admin/agent too), only the change action needs `require_owner!`
- DB-backed `current_membership`, never JWT role claim, for authorization checks (established v1.11 Phase 33, reinforced every phase since)
- Frontend: gate the fetch AND the render for permission-scoped data (`{ enabled }` options arg + `<Can>` JSX gate) — this exact pattern has held across v1.10/v1.11/v1.12 and should continue here
- Self-state patch after a mutation affecting the current user/brokerage's own record, rather than a full page reload (see `useSettingsAdminContext`'s self-demote Redux patch) — likely relevant if the plan section needs to reflect the new tier elsewhere in the UI (e.g. nav bar plan badge, if one exists)

### Integration Points
- `frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx` line 30 — the `{/* TODO: Add billing management section */}` comment marks where the new Plan section slots in, below Ownership Management
- `backend/config/routes.rb` lines 79-85 — `namespace :settings do resources :owners ... end` inside the admin namespace is the direct routing analog for a sibling `resources :plan` (or similar) route
- `frontend/src/assets/rbac/permissions.ts` — `ROLE_PERMISSIONS` map needs a new owner-only permission entry for gating the plan-change control (paralleling `manage_ownership`)

</code_context>

<specifics>
## Specific Ideas

No specific visual references beyond what's captured in decisions above — user deferred exact component/hook naming to Claude's discretion, staying focused on the four discussed behavioral decisions (downgrade dialog weight, selector density, upgrade immediacy, no-polling job feedback).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 41-self-service-plan-management*
*Context gathered: 2026-07-23*
