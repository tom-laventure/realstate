---
phase: 37-free-tier-gating
reviewed: 2026-07-21T04:48:02Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - backend/app/controllers/v1/account/calendar/connections_controller.rb
  - backend/app/controllers/v1/account/calendar/google_oauth_controller.rb
  - backend/app/controllers/v1/admin/board_credentials_controller.rb
  - backend/app/controllers/v1/admin/boards_controller.rb
  - backend/app/controllers/v1/admin/group/invitations_controller.rb
  - backend/app/models/user.rb
  - backend/test/factories/user_calendar_connections.rb
  - backend/test/integration/admin_authorization_test.rb
  - backend/test/integration/free_tier_board_gate_test.rb
  - backend/test/integration/free_tier_calendar_gate_test.rb
  - backend/test/integration/free_tier_domain_gate_test.rb
  - backend/test/integration/free_tier_engagement_test.rb
  - backend/test/integration/free_tier_invite_gate_test.rb
  - backend/test/integration/free_tier_seats_test.rb
  - backend/test/models/user_paid_membership_test.rb
  - frontend/src/assets/rbac/planPermissions.test.ts
  - frontend/src/assets/rbac/planPermissions.ts
  - frontend/src/assets/types/calendarConnectionType.ts
  - frontend/src/components/common/FreeTierBanner.test.tsx
  - frontend/src/components/common/FreeTierBanner.tsx
  - frontend/src/components/view/account/calendar/CalendarTab.test.tsx
  - frontend/src/components/view/account/calendar/CalendarTab.tsx
  - frontend/src/components/view/admin/brokerageView/BoardRegistrations.test.tsx
  - frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx
  - frontend/src/components/view/admin/domainsAdminView/DomainCardList.test.tsx
  - frontend/src/components/view/admin/domainsAdminView/DomainCardList.tsx
  - frontend/src/components/view/admin/listingGroupsAdminView/addUserToGroupView/AddUserToGroupView.test.tsx
  - frontend/src/components/view/admin/listingGroupsAdminView/addUserToGroupView/AddUserToGroupView.tsx
  - frontend/src/containers/account/CalendarContext.tsx
  - frontend/src/containers/adminBoard/boardsAdminBoard/BoardsAdminBoard.tsx
  - frontend/src/containers/adminBoard/boardsAdminBoard/useBoardsAdminContext.ts
  - frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx
  - frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts
  - frontend/src/containers/adminBoard/listingGroupAdminBoard/listingGroupDetailsAdminBoard/addUserToListingGroupAdminBoard/AddUserToListingGroupAdminBoard.tsx
  - frontend/src/containers/adminBoard/listingGroupAdminBoard/listingGroupDetailsAdminBoard/addUserToListingGroupAdminBoard/useAddUsersToGroupContext.tsx
  - frontend/src/store/hooks/Account/useFetchCalendarConnections.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-07-21T04:48:02Z
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

This phase adds free-tier plan gating across calendar sync, real-board connections, custom
domains, and client invitations, on both backend (imperative `Current.brokerage.plan_config` /
`Current.user.any_paid_brokerage_membership?` checks) and frontend (`hasPlanCapability` +
`FreeTierBanner`). The core gates (`google_oauth_controller#authorize`,
`connections_controller#create_apple`, `boards_controller#index`,
`board_credentials_controller#create`, `domains_controller#custom`,
`group/invitations_controller#create`) are implemented correctly and are backed by focused
integration tests that pin the intended behavior per plan tier.

However, the client-invite gate added in this phase (PLAN-05 / D-03 / D-05) only covers the
`create` action of `Group::InvitationsController`. The sibling `update` action accepts the same
`role` parameter with no plan check at all, which lets a Free-tier caller create an ordinary
(e.g. `agent`) invitation and then `PATCH` its role to `client`, fully bypassing the restriction
this phase was built to enforce. This is a direct, provable regression against the phase's own
stated requirement and is filed as a Critical finding below (with the reproduction path spelled
out against the existing pre-existing `admin_authorization_test.rb` case that inadvertently
demonstrates it).

Several lower-severity issues were also found: a fail-open default in the calendar-connections
data hook, a pre-existing but in-scope mismatch between the calendar-connections controller's
`PROVIDERS` allowlist and the model's, a soft-delete scoping gap on the calendar resync sweep
query (per this repo's own `CLAUDE.md` convention), an unvalidated `Origin`-derived OAuth
redirect target, and dead/incorrect code in the domains admin context (`isPremium` comparing
against a plan value that can never occur for a persisted brokerage).

## Critical Issues

### CR-01: Free-tier client-invite gate is bypassable via the invitation `update` endpoint

**File:** `backend/app/controllers/v1/admin/group/invitations_controller.rb:56-63` (and `:88-94`)

**Issue:** The plan gate added in this phase only guards `create`:

```ruby
def create
  if invitation_params[:role] == "client" && !Current.brokerage.plan_config.clients
    return render json: {error: "Client invites require a plan with client access", code: "plan_required"}, status: :forbidden
  end
  ...
```

`update` performs no equivalent check, yet `invitation_update_params` permits `:role`:

```ruby
def update
  if @invitation.update(invitation_update_params)
    render json: @invitation, serializer: InvitationSerializer, status: :ok
  ...

def invitation_update_params
  params.require(:invitation).permit(:email, :role, :expires_at, :revoked_at, :accepted_at)
end
```

Any caller with `agent`/`admin`/`owner` role on a Free-tier brokerage can:
1. `POST /v1/admin/groups/:group_id/invitations` with `role: "agent"` (allowed — not gated).
2. `PATCH /v1/admin/groups/:group_id/invitations/:id` with `{invitation: {role: "client"}}`.

Step 2 succeeds unconditionally, producing a `client`-role invitation on a Free-tier brokerage —
exactly what PLAN-05/D-03/D-05 says must be blocked "regardless of caller role." There is no
model-level validation (`grep plan_config app/` shows the check exists nowhere else) backing this
up, so `update` is a full bypass, not defense-in-depth.

This is independently confirmed by the test suite: `admin_authorization_test.rb`'s
`"agent role receives success on PATCH /v1/admin/groups/:group_uid/invitations/:id"` (lines
194-201) PATCHes an invitation's `role` to `"client"` on `@brokerage`, which is created via
`create(:brokerage)` with no `plan:` override — i.e. the DB default `plan: "free"`
(`db/schema.rb:90`) — and asserts `:success`. The test passes today, which is only possible
because `update` has no gate.

**Fix:** Mirror the `create` guard in `update` (or centralize it), keyed off the role the
invitation *will have* after the update:

```ruby
def update
  new_role = invitation_update_params[:role] || @invitation.role
  if new_role == "client" && !Current.brokerage.plan_config.clients
    return render json: {error: "Client invites require a plan with client access", code: "plan_required"}, status: :forbidden
  end

  if @invitation.update(invitation_update_params)
    render json: @invitation, serializer: InvitationSerializer, status: :ok
  else
    render json: {error: "Failed to update invitation", details: @invitation.errors.full_messages}, status: :unprocessable_entity
  end
end
```

Add a regression test to `free_tier_invite_gate_test.rb` covering `PATCH .../invitations/:id`
with `role: "client"` on a Free-tier brokerage, and update `admin_authorization_test.rb`'s
PATCH-role-to-client case to use a paid plan (matching the fix already applied to the adjacent
`create` case in the same file), or assert `:forbidden` if the intent is for that test to stay on
the default Free-tier brokerage.

## Warnings

### WR-01: `useFetchCalendarConnections` fails open (`true`) instead of fail-closed while loading/erroring

**File:** `frontend/src/store/hooks/Account/useFetchCalendarConnections.ts:20`

**Issue:**
```ts
calendarSyncAvailable: data?.calendarSyncAvailable ?? true,
```
Before the query resolves, and whenever it errors (`isError`), `data` is `undefined`, so this
defaults to `true`. `CalendarTab.tsx` only checks `state.isLoading` (not `isError`) before
rendering the provider grid vs. the `FreeTierBanner`, so on a failed fetch a Free-tier user is
shown the full "connect your calendar" UI instead of the banner or an error state. The backend
still enforces the real gate on connect (`any_paid_brokerage_membership?`), so this is a UX
inconsistency rather than a security hole, but it directly contradicts the "safe-false" intent
documented on `PlanCapability` in `planPermissions.ts` and will confuse Free-tier users who click
"Connect" only to get a 403.

**Fix:** Default to `false` (fail-closed) and let `CalendarTab` render an explicit error state on
`isError` rather than silently falling through to the "available" branch:
```ts
calendarSyncAvailable: data?.calendarSyncAvailable ?? false,
```

### WR-02: `connections_controller#PROVIDERS` only lists `google`, breaking disconnect/resync for Apple connections

**File:** `backend/app/controllers/v1/account/calendar/connections_controller.rb:10,75,92,15`

**Issue:**
```ruby
PROVIDERS = %w[google].freeze
```
`UserCalendarConnection::PROVIDERS` (the model) is `%w[google microsoft apple]`, and this same
controller has a live `create_apple` action that creates/updates an `apple`-provider connection
row. But:
- `index` only `find_or_create_by!`s a row for each entry in the controller's `PROVIDERS`
  (i.e. only `google`), so an existing `apple` connection is silently omitted from the response
  the frontend renders from.
- `destroy` and `resync` both guard with `unless PROVIDERS.include?(params[:provider])` — calling
  either with `provider: "apple"` returns `422 Invalid provider`, even for a connection that was
  successfully created seconds earlier via `create_apple`.

Net effect: once a user connects Apple calendar, there is no way to disconnect or re-sync it
through this controller. Pre-existing (introduced before this phase in commit `e981f72`), but
this file is squarely in this phase's diff (the `create_apple` guard and `calendar_sync_available`
key were added here), so it's a real defect surfaced by reviewing the file as submitted.

**Fix:** Either widen the controller's `PROVIDERS` to match the model (`%w[google apple]` at
minimum, given `create_apple` is live) or, if Apple is deliberately out of scope for now, remove/
gate `create_apple` until `destroy`/`resync`/`index` support it symmetrically.

### WR-03: Calendar resync sweep query doesn't guard every soft-deletable joined model

**File:** `backend/app/controllers/v1/account/calendar/connections_controller.rb:113-119`

**Issue:**
```ruby
future_estate_dates = EstateDate.without_deleted
  .joins(group_estate: {group: :brokerage})
  .joins(group_estate: :estate)
  .where(groups: {brokerage_id: Current.brokerage.id})
  .where("estate_dates.date >= ?", Time.current)
  .where(estates: {deleted_at: nil})
```
`Group` and `GroupEstate` (both `acts_as_paranoid`, confirmed in `app/models/group.rb` and
`app/models/group_estate.rb`) are joined but never scoped to `deleted_at: nil`. Per this
repository's own `CLAUDE.md` convention ("every model touched by a query" must be scoped,
"including joined tables"), a soft-deleted `Group` or `GroupEstate` whose child `EstateDate` rows
are still present would still be swept into `future_estate_dates`, enqueuing
`CalendarSyncJob` for a group/membership that's supposed to be gone. Pre-existing (from commit
`5b50150`, before this phase), but in-scope as a reviewed file.

**Fix:**
```ruby
.where(groups: {brokerage_id: Current.brokerage.id, deleted_at: nil})
.where(group_estates: {deleted_at: nil})
.where(estates: {deleted_at: nil})
```

### WR-04: OAuth callback redirect trusts an unvalidated `Origin`-derived value with `allow_other_host: true`

**File:** `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb:77-78`

**Issue:**
```ruby
frontend_origin = state_data[:frontend_origin] || ENV.fetch("FRONTEND_URL", "https://realtybase.ca")
redirect_to "#{frontend_origin}/account", allow_other_host: true
```
`frontend_origin` is whatever `request.headers["Origin"]` was on the earlier `authorize` call,
cached verbatim and later used, with `allow_other_host: true`, as the final browser redirect
target after a completed Google OAuth exchange. Since `authorize` only requires a valid Cognito
session (no origin allowlist), a user can call `authorize` directly (e.g. via curl) with an
arbitrary `Origin` header, obtain the resulting Google consent URL (which embeds the `state`
token bound to that cached origin), and send that URL to a third party. If the third party
completes the Google consent flow, their browser is redirected — with no sensitive data in the
URL, but still an open redirect — to the attacker-chosen origin at the end of the flow. This is
pre-existing (from commit `6888506`/`e981f72`, before this phase) but is a genuine gap in a file
this phase modified.

**Fix:** Validate `frontend_origin` against an allowlist derived from `BrokerageDomain` (or the
configured `FRONTEND_URL`) before using it, rather than trusting the raw cached header value:
```ruby
allowed_origin = BrokerageDomain.routable.exists?(domain: URI.parse(frontend_origin).host) ? frontend_origin : ENV.fetch("FRONTEND_URL", "https://realtybase.ca")
redirect_to "#{allowed_origin}/account", allow_other_host: true
```

### WR-05: `isPremium` in `useDomainsAdminContext` compares against a plan value that can never occur

**File:** `frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts:36`

**Issue:**
```ts
const isPremium = brokerage?.plan === 'premium'
```
`brokerage` here comes from `useFetchBrokerage()`, i.e. a persisted `Brokerage` record. The
backend only ever validates/persists `plan` as `free`, `independent`, or `growth`
(`backend/app/models/brokerage.rb:15`, mirrored by `PLAN_CAPABILITIES` in
`planPermissions.ts`). `'premium'` is a distinct concept used only in the brokerage-creation
wizard's local state (`DomainStep.tsx`, `PlanBadge.tsx`) and is never a value `useFetchBrokerage`
can return. `isPremium` is therefore always `false` for every real brokerage — dead/broken code
that is exposed on the returned context `state` (though not currently read by any consumer in
this file set; `DomainsAdminBoard.tsx` uses `state.customDomainAvailable` instead, which is
correctly derived via `hasPlanCapability`).

**Fix:** Remove `isPremium` (superseded by `customDomainAvailable`), or if it must stay, derive it
via `hasPlanCapability(brokerage?.plan, 'customDomain')` like the rest of this phase's gates.

## Info

### IN-01: Invitation `create` sets a `token` param that is immediately discarded

**File:** `backend/app/controllers/v1/admin/group/invitations_controller.rb:46`

**Issue:** `Invitation.create!` is called with `token: SecureRandom.hex(16)`, but
`Invitation#create_token` (a `before_create` callback, unconditional — unlike `expires_at` which
uses `||=`) always overwrites `self.token = SecureRandom.urlsafe_base64(32)`. The explicit value
passed by the controller is dead code and misleading to readers who might assume it's used.

**Fix:** Drop the `token:` kwarg from the `Invitation.create!` call in the controller.

### IN-02: `hasPlanCapability` can return `""` instead of `false` for falsy-but-not-nullish input

**File:** `frontend/src/assets/rbac/planPermissions.ts:43-44`

**Issue:**
```ts
export const hasPlanCapability = (plan: string | undefined, capability: PlanCapability): boolean =>
    (plan && PLAN_CAPABILITIES[plan]?.[capability]) ?? false
```
`??` only substitutes on `null`/`undefined`, not on other falsy values. If `plan` is an empty
string, `plan && ...` short-circuits to `""`, and `"" ?? false` is `""` (not `false`), violating
the declared `boolean` return type at runtime (though `tsc --noEmit` does not currently flag this
due to type widening). No current caller passes `""` for `plan`, so real-world impact is
negligible today, but a strict-equality check (`hasPlanCapability(...) === false`) against this
edge case would fail.

**Fix:** `Boolean(plan && PLAN_CAPABILITIES[plan]?.[capability])` or `!!(plan && ...)`.

### IN-03: Invitation `update` permits direct mass-assignment of `accepted_at`/`revoked_at`

**File:** `backend/app/controllers/v1/admin/group/invitations_controller.rb:92-94`

**Issue:** `invitation_update_params` permits `:revoked_at` and `:accepted_at` alongside `:role`,
letting any `agent`-or-above caller fabricate an invitation's acceptance/revocation timestamp via
a generic `PATCH` rather than going through the dedicated accept-token flow or the `destroy`
(soft-revoke) action. Combined with CR-01, this is the same action that also allows the
undocumented role escalation to `client`; tightening `update` per CR-01's fix is a good place to
also reconsider whether `accepted_at`/`revoked_at` belong in this whitelist at all.

**Fix:** Remove `:accepted_at`/`:revoked_at` from `invitation_update_params` and route those
transitions through dedicated actions/endpoints if they're needed outside of `destroy`.

---

_Reviewed: 2026-07-21T04:48:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
