---
phase: 33
slug: backend-owner-api-endpoint-lockdown
status: audited
threats_open: 0
asvs_level: 1
created: 2026-07-12
---

# SECURITY.md — Phase 33: Backend Owner API Endpoint Lockdown

**Audit date:** 2026-07-12
**ASVS Level:** 1
**Block on:** high
**Threats registered:** 15 (33-01: 6, 33-02: 7, 33-03: 2 — T-33-04 in 33-01 overlaps conceptually with 33-02 but is a distinct ID; total unique IDs = 15)
**Threats closed:** 15/15
**Threats open:** 0/15

Verification method: adversarial re-derivation. Every `mitigate` disposition was checked
by locating the actual guard/guard-clause in the cited implementation file (not inferred
from SUMMARY.md prose), and by running the plan's own integration test suites to confirm
the guards are exercised and passing, not merely present as dead code.

## Threat Verification

| Threat ID | Category | Component | Disposition | Evidence |
|-----------|----------|-----------|--------------|----------|
| T-33-01 | Elevation of Privilege | `UsersController#update` | mitigate | `backend/app/controllers/v1/admin/users_controller.rb:110-114` — `if role == "owner" \|\| membership.role == "owner"` → 403 nested `{error:{code:"forbidden",...}}`, unconditional on caller role. Test: `admin_owner_lockdown_test.rb:62-70,72-80` (admin and owner callers both get 403 assigning role owner). |
| T-33-02 | Elevation of Privilege | `InvitationsController#create` | mitigate | `backend/app/controllers/v1/admin/invitations_controller.rb:45` — `return render json: {error: "The owner role cannot be assigned via invitation"}, status: :forbidden if role == "owner"`, positioned after client-role check, before pending-invite lookup; `before_action :require_admin!` on line 6 unchanged (agent/admin invites still work — confirmed by test `admin caller can still invite a new agent`, line 52-58: `:created`). Test: `admin_owner_lockdown_test.rb:32-50`. |
| T-33-03 | Elevation of Privilege / DoS | `UsersController#destroy` | mitigate | `users_controller.rb:143-151` — when target membership role == "owner": inline `require_owner!` + `return if performed?`, then `owner_count = BrokerageMembership.without_deleted.where(brokerage_id:, role:"owner").count`; `owner_count <= 1` → 422 "Cannot remove the brokerage's last owner". Test: `admin_owner_lockdown_test.rb:102-107` (403 non-owner destroys owner), `109-119` (422 last-owner, built in an isolated single-owner brokerage). |
| T-33-04 | Elevation of Privilege | `UsersController#update` (owner-demotes-owner bypass) | mitigate | Same guard as T-33-01 (`membership.role == "owner"` branch of the OR) forces all owner-touching transitions — including owner-to-owner demotion — through `/admin/settings/owners`. Test: `admin_owner_lockdown_test.rb:82-90` — owner caller demoting another owner via the generic endpoint → 403. |
| T-33-05 | Elevation of Privilege | Stale-JWT role retention | mitigate | Grep across `backend/app/` for `claims["role"]` / `claims[:role]` → zero matches. All authorization in `users_controller.rb`, `invitations_controller.rb`, and `owners_controller.rb` resolves through `current_membership` (`base_controller.rb:32-37`), a fresh `BrokerageMembership.without_deleted.find_by` DB read on every request — no cached/JWT-derived role is consulted. |
| T-33-06 | Information Disclosure (defense-in-depth) | Soft-deleted membership resolution | mitigate | `users_controller.rb:100` (`#update`) and `:139` (`#destroy`) both use `user.brokerage_memberships.without_deleted.find_by(brokerage_id: brokerage.id)`. Hand-verified line-by-line; both lookups scoped. |
| T-33-07 | Elevation of Privilege | `OwnersController#create` (non-owner promotes) | mitigate | `backend/app/controllers/v1/admin/settings/owners_controller.rb:5-6` — `skip_before_action :require_agent_or_above!, only: [:create, :update]` + `before_action :require_owner!, only: [:create, :update]`. Test: `admin_settings_owners_test.rb:91-98` (admin caller → 403), `151-156` (client caller → 403), `158-163` (unauthenticated → 401). |
| T-33-08 | Elevation of Privilege | `OwnersController#create` (forged ineligible user_id) | mitigate | `owners_controller.rb:49-51` — `unless %w[admin agent].include?(membership.role) → 422 "Only admins and agents can be promoted to owner"`, evaluated against the target's live DB-read `membership.role`, not any client-submitted role value. Test: `admin_settings_owners_test.rb:84-89` (client target rejected 422). |
| T-33-09 | Elevation of Privilege / DoS | `OwnersController#update` (last-owner demotion) | mitigate | `owners_controller.rb:77-80` — `owner_count = BrokerageMembership.without_deleted.where(brokerage_id:, role:"owner").count; if owner_count <= 1 → 422`. Test: `admin_settings_owners_test.rb:135-147` (solo-owner brokerage, self-PATCH → 422 "last owner"); `128-133` (self-demotion allowed when a second owner exists — OWN-09). |
| T-33-10 | Elevation of Privilege | Non-owner demotes via settings endpoint | mitigate | Same `before_action :require_owner!, only: [:create, :update]` as T-33-07 covers `#update`. Test: `admin_settings_owners_test.rb:114-119` (admin caller PATCH → 403). |
| T-33-11 | Elevation of Privilege | Stale-JWT on new endpoints | mitigate | `owners_controller.rb` grepped for `claims["role"]` / `claims[:role]` → zero matches; guard chain is `require_owner!` → `current_membership` (DB read), identical mechanism verified for T-33-05. |
| T-33-12 | Tampering / Input Validation | Demote to arbitrary role string | mitigate | `owners_controller.rb:58` — `DEMOTE_TARGET_ROLES = %w[admin agent client].freeze`; `:73` — `unless DEMOTE_TARGET_ROLES.include?(new_role) → 422 "Invalid role"`. Test: `admin_settings_owners_test.rb:121-126` (role `"superadmin"` → 422). |
| T-33-13 | Information Disclosure | Read endpoints (index/eligible) readable by agent+ | accept | Accepted risk — see Accepted Risks Log below. Verified payload is limited to `id/name/email` (index) and `id/name/email/role` (eligible) — `owners_controller.rb:18,29` — no additional PII fields present beyond what `/admin/users` already exposes to the same agent+ audience. |
| T-33-14 | Tampering | Frontend-only bypass of removed "Owner" UI option | accept (mitigated elsewhere) | Accepted risk — see Accepted Risks Log below. Cross-verified the actual control (T-33-02's server-side 403) independently: confirmed present and test-covered regardless of this UI change. |
| T-33-15 | Elevation of Privilege | Accidental owner grant via add-agent form | mitigate | `frontend/src/components/view/admin/brokerageView/addAgentView/AddAgentView.tsx:96-99` — `<SelectContent>` contains only `<SelectItem value="agent">` and `<SelectItem value="admin">`, no `value="owner"` (grep confirms 0 matches); `:106` — `<RolePermissions roles={['agent', 'admin']} />`, owner description removed. |

## Cross-cutting verification (not threat-specific, run to validate evidence)

- `RAILS_ENV=test bin/rails test test/integration/admin_owner_lockdown_test.rb test/integration/admin_settings_owners_test.rb` → **24 runs, 66 assertions, 0 failures, 0 errors, 0 skips** (re-executed live during this audit, not taken from SUMMARY.md claims).
- `grep -rn 'claims\["role"\]\|claims\[:role\]' backend/app/` → no matches (repo-wide, not just the three cited controllers).
- `bin/rails routes -g settings/owners` structure confirmed via `config/routes.rb:78-84` — `namespace :settings { resources :owners, only: [:index,:create,:update] { collection { get :eligible } } }` nested correctly inside `namespace :admin`, matching `V1::Admin::Settings::OwnersController`.
- `grep -c 'current_role = Current.user' backend/app/controllers/v1/admin/users_controller.rb` → 0 (hand-derived role check fully removed per D-02 acceptance criteria).

## Accepted Risks Log

### T-33-13 — Owner/eligible-list read exposure to agent+ roles
**Disposition:** accept
**Rationale (from PLAN.md 33-02):** `index` and `eligible` are intentionally left under the
inherited `require_agent_or_above!` guard (not owner-gated) because Phase 34's SET-02
requirement mandates admin/agent read-only access to the owner-management UI. Payload is
capped at `id/name/email` (owners) and `id/name/email/role` (eligible) — no additional PII
beyond what the existing `/admin/users` endpoint already discloses to the same agent+
audience.
**Verified boundary:** confirmed the payload shape at `owners_controller.rb:18,29` matches
this description exactly; no extra fields (phone, address, etc.) are serialized.
**Accepted by:** phase plan author (33-02-PLAN.md threat_model), formalized in this log by
this audit.

### T-33-14 — Frontend-only enforcement is not a security boundary
**Disposition:** accept (mitigated elsewhere)
**Rationale (from PLAN.md 33-03):** Removing the "Owner" `<SelectItem>` from the add-agent
form is a UX/accidental-misuse guard only. A crafted HTTP request (e.g., via curl or a
modified client) could still submit `role: "owner"` to `POST /v1/admin/invitations`
regardless of what the React form offers.
**Verified boundary:** the actual control is T-33-02 (`InvitationsController#create`'s
value-level 403 rejection), confirmed present and covered by passing integration tests
independently of this UI change, per this same audit.
**Accepted by:** phase plan author (33-03-PLAN.md threat_model), formalized in this log by
this audit.

## Unregistered Flags

None. Only `33-02-SUMMARY.md` contains an explicit `## Threat Flags` section, and it
declares "None — this plan's new surface ... is fully covered by the plan's own
`<threat_model>`." `33-01-SUMMARY.md` and `33-03-SUMMARY.md` do not contain a `## Threat
Flags` section at all; no new unmapped attack surface was identified during this audit's
independent review of the diffs (`users_controller.rb`, `invitations_controller.rb`,
`owners_controller.rb`, `routes.rb`, `AddAgentView.tsx`) beyond what the three plans'
threat registers already account for.

## Notes on Audit Scope

- Implementation files listed in `<required_reading>` were read-only for this audit; no
  code was patched.
- `backend/app/controllers/v1/admin/users_controller.rb:159` (`user.brokerage_memberships.where(brokerage_id: brokerage.id).destroy_all`, the final hard-delete step after the owner-guard block) is not `.without_deleted`-scoped, but this is a destroy operation on an already-resolved, already-guarded membership — not a read/authorization path — and is out of scope for T-33-06 (which concerns the two `find_by` lookups feeding authorization decisions, both of which are correctly scoped). Noting for completeness; not a threat-register gap.
