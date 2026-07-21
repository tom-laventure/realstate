# Phase 37: Free Tier Gating - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 13 (6 backend modify, 1 backend model modify, 6 frontend modify/new)
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `backend/app/controllers/v1/admin/boards_controller.rb` | controller | CRUD (read/filter) | `backend/app/controllers/v1/admin/domains_controller.rb#custom` (403 shape) + own file (filter scope) | role-match |
| `backend/app/controllers/v1/admin/board_credentials_controller.rb#create` | controller | CRUD (create) | `backend/app/controllers/v1/admin/domains_controller.rb#custom` | exact (403 shape) |
| `backend/app/controllers/v1/admin/group/invitations_controller.rb#create` | controller | CRUD (create) | `backend/app/controllers/v1/admin/domains_controller.rb#custom` (403 shape) + `backend/app/controllers/v1/admin/invitations_controller.rb` (role validation precedent) | exact (403 shape) |
| `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb#authorize` | controller | request-response (OAuth redirect) | `backend/app/controllers/v1/admin/domains_controller.rb#custom` (403 shape, cross-cutting) | partial (different scope: user not brokerage) |
| `backend/app/controllers/v1/account/calendar/connections_controller.rb#create_apple` | controller | CRUD (create) | same as above | partial |
| `backend/app/models/user.rb` | model | CRUD (query) | `backend/app/models/brokerage.rb#plan_config` (single accessor method pattern) | role-match |
| `frontend/src/components/common/FreeTierBanner.tsx` | component | request-response (presentational) | `ConnectBoardDialog.tsx`'s `test-board-info` info-notice block (lines 130-133) | role-match (new file, styling analog) |
| `frontend/src/assets/rbac/planPermissions.ts` (or similar, planner's call) | utility | transform (pure lookup) | `frontend/src/assets/rbac/permissions.ts` | exact (structural mirror) |
| `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` | component | request-response | itself (existing file, add banner) | exact |
| `frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx` | component | request-response | itself (no change needed — renders `boards` prop as-is) | exact |
| `frontend/src/components/view/admin/listingGroupsAdminView/addUserToGroupView/AddUserToGroupView.tsx` | component | request-response | itself (existing file, hide "Invite New User" form block) | exact |
| `frontend/src/components/view/admin/domainsAdminView/DomainCardList.tsx` | component | request-response | itself (existing file, add banner — no prior banner exists, see Pitfall 3 in RESEARCH.md) | exact |
| `frontend/src/components/view/account/calendar/CalendarTab.tsx` | component | request-response | itself (existing file, conditional banner-vs-grid render) | exact |

## Pattern Assignments

### `backend/app/controllers/v1/admin/boards_controller.rb` (controller, CRUD/read)

**Analog:** itself (current unfiltered version) + `domains_controller.rb` for the plan-read idiom

**Current full file** (`backend/app/controllers/v1/admin/boards_controller.rb:1-17`):
```ruby
module V1
  module Admin
    class BoardsController < V1::Admin::BaseController
      # GET /v1/admin/boards
      def index
        boards = RealEstateBoard.active.order(:name)
        render json: {
          boards: ActiveModelSerializers::SerializableResource.new(
            boards,
            each_serializer: RealEstateBoardSerializer,
            adapter: :attributes
          ).as_json
        }
      end
    end
  end
end
```

**Plan-read idiom to apply** (mirrors `Brokerage#plan_config`, see Shared Patterns below):
```ruby
scope = RealEstateBoard.active
scope = scope.test_boards unless Current.brokerage.plan_config.real_boards
boards = scope.order(:name)
```
`RealEstateBoard.test_boards` / `.real_boards` scopes already exist verbatim at `backend/app/models/real_estate_board.rb:10-12` — do not re-derive with `where(is_test_board: ...)` inline.

No 403 needed here — this is a read-filter, not a rejection (D-01 first half).

---

### `backend/app/controllers/v1/admin/board_credentials_controller.rb#create` (controller, CRUD/create)

**Analog:** `backend/app/controllers/v1/admin/domains_controller.rb#custom` (lines 57-60) — the canonical 403 shape

**Analog excerpt** (`domains_controller.rb:57-60`):
```ruby
def custom
  unless Current.brokerage.plan_config.custom_domain
    return render json: {error: "Custom domains require a plan with custom domain access", code: "plan_required"}, status: :forbidden
  end
  ...
```

**Current `create` action to modify** (`board_credentials_controller.rb:24-39`):
```ruby
def create
  board = RealEstateBoard.active.find_by(id: board_credential_params[:real_estate_board_id])
  return render json: {error: "Board not found"}, status: :not_found unless board

  username = board_credential_params[:rets_username]
  password = board_credential_params[:rets_password]

  result = if board.is_test_board?
    RetsAuthService::Result.new(success: true, error: nil)
  else
    RetsAuthService.new(board: board, username: username, password: password).call
  end
  ...
```
Insert the plan guard immediately after the `board` `find_by`/`not_found` check and before the `RetsAuthService` branch — `board.is_test_board?` is already loaded at that point, so the guard is a single boolean check, no extra query:
```ruby
unless Current.brokerage.plan_config.real_boards || board.is_test_board?
  return render json: {error: "Real board connections require a plan with board access", code: "plan_required"}, status: :forbidden
end
```

---

### `backend/app/controllers/v1/admin/group/invitations_controller.rb#create` (controller, CRUD/create)

**Analog 1 (403 shape):** `domains_controller.rb:57-60` (same as above)
**Analog 2 (role validation precedent):** `backend/app/controllers/v1/admin/invitations_controller.rb:40-45`
```ruby
return render_unprocessable(["Invalid role"], brokerage) unless AppConstants::BROKERAGE_ROLES.include?(role)
return render_unprocessable(["Client-level users must be invited at the group level"], brokerage) if role == "client"
...
return render json: {error: "The owner role cannot be assigned via invitation"}, status: :forbidden if role == "owner"
```
(This is the sibling controller's existing role-guard pattern — RESEARCH.md's Open Question 2 flags that `group/invitations_controller.rb` currently has zero role validation; the plan check is an exact-match `role == "client"` string comparison per D-03, consistent with how this sibling checks `role == "owner"`.)

**Current `create` action to modify** (`group/invitations_controller.rb:30-48`):
```ruby
def create
  invitee = User.find_by(email: invitation_params[:email])

  invitation = Invitation.create!(
    brokerage: Current.brokerage,
    group: @group,
    inviter: Current.user,
    invitee: invitee,
    email: invitation_params[:email],
    role: invitation_params[:role],
    token: SecureRandom.hex(16),
    expires_at: invitation_params[:expires_at]
  )

  SendInvitationEmailJob.perform_later(invitation.id)
  render json: invitation, serializer: InvitationSerializer, status: :created
rescue ActiveRecord::RecordInvalid => e
  render json: {error: "Failed to create invitation", details: e.record.errors.full_messages}, status: :unprocessable_entity
end
```
Insert guard as the first line of `create`, before `invitee = User.find_by(...)`:
```ruby
if invitation_params[:role] == "client" && !Current.brokerage.plan_config.clients
  return render json: {error: "Client invites require a plan with client access", code: "plan_required"}, status: :forbidden
end
```
**Scope boundary (D-03, confirmed by reading `group/users_controller.rb:6-23`):** do NOT add any plan check to `Group::UsersController#create` — it only adds existing brokerage members (`User.for_brokerage` scope), unrelated to this gate.

---

### `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb#authorize` (controller, request-response / OAuth)

**Analog:** `domains_controller.rb`'s 403 shape (error/code convention only — the query itself is a NEW pattern, not copied from any existing controller, since no user-scoped-cross-brokerage gate exists yet)

**Current `authorize` action** (`google_oauth_controller.rb:14-35`):
```ruby
def authorize
  state = SecureRandom.hex(32)
  Rails.cache.write(
    "cal_oauth_state:#{state}",
    {user_id: Current.user.id, frontend_origin: request.headers["Origin"]},
    expires_in: 10.minutes
  )

  params_hash = {
    client_id: ENV.fetch("GOOGLE_CALENDAR_CLIENT_ID"),
    ...
  }

  redirect_url = "https://accounts.google.com/o/oauth2/v2/auth?" + params_hash.to_query

  render json: {redirect_url: redirect_url}, status: :ok
end
```
Insert guard as the first line, before `state = SecureRandom.hex(32)`:
```ruby
unless Current.user.any_paid_brokerage_membership?
  return render json: {error: "Calendar sync requires a paid plan", code: "plan_required"}, status: :forbidden
end
```
**Do NOT use `Current.brokerage.plan_config.calendar_sync` here** — `Current.brokerage` is resolved per-request from Origin/Host (`BrokerageAuth#resolve_brokerage`), not the user's full membership set. This is the one gate in this phase that is architecturally different from the other three (see Shared Patterns → "Cross-brokerage user gate").

---

### `backend/app/controllers/v1/account/calendar/connections_controller.rb#create_apple` (controller, CRUD/create)

**Current `create_apple` action** (`connections_controller.rb:34-65`):
```ruby
def create_apple
  email = params[:email].to_s.strip
  app_specific_password = params[:app_specific_password].to_s.strip

  if email.blank? || app_specific_password.blank?
    return render json: {error: "Email and app_specific_password are required"}, status: :unprocessable_entity
  end
  ...
```
Insert guard as the first line, before `email = params[:email]...`, identical shape to `google_oauth_controller.rb#authorize`:
```ruby
unless Current.user.any_paid_brokerage_membership?
  return render json: {error: "Calendar sync requires a paid plan", code: "plan_required"}, status: :forbidden
end
```
`microsoft_oauth_controller.rb` exists but is dormant per RESEARCH.md — skip it.

---

### `backend/app/models/user.rb` (model, CRUD/query — new method)

**Analog:** `backend/app/models/brokerage.rb#plan_config` (lines 34-36) — single-method config-accessor convention, and its comment style
```ruby
# PLAN-02, PLAN-03, D-07: Single config-driven accessor for this brokerage's
# tier config. Fails loud (KeyError) on an unrecognized plan value rather
# than silently degrading to Free's capability set.
def plan_config
  AppConstants::PLAN_TIERS.fetch(plan)
end
```

**Current `User` model** (`backend/app/models/user.rb:1-48`) — has `has_many :brokerages, through: :brokerage_memberships` (line 8) already, which is the association the new method queries. Add near the other scopes/methods, e.g. after `full_name`:
```ruby
# D-06: a user retains calendar sync access account-wide if ANY of their
# brokerage memberships is on a paid tier — do not scope to Current.brokerage.
def any_paid_brokerage_membership?
  brokerages.without_deleted.where(plan: %w[independent growth]).exists?
end
```
Note: `brokerages.without_deleted` is required per CLAUDE.md's soft-delete convention (the `brokerages` association is `acts_as_paranoid`, confirmed via `Brokerage < ApplicationRecord; acts_as_paranoid`). Do not iterate `brokerages.map(&:plan_config)` in Ruby — this must stay a single indexed SQL query per RESEARCH.md Pattern 2.

---

### `frontend/src/assets/rbac/planPermissions.ts` (utility, transform — NEW file)

**Analog:** `frontend/src/assets/rbac/permissions.ts` (full file, 22 lines) — exact structural mirror
```typescript
import UserRole from '@/assets/types/roleType'

export type Permission =
    | 'access_admin_panel'
    | 'manage_brokerage_settings'
    | 'manage_users'
    | 'manage_groups'
    | 'manage_ownership'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    owner: ['access_admin_panel', 'manage_brokerage_settings', 'manage_users', 'manage_groups', 'manage_ownership'],
    admin: ['access_admin_panel', 'manage_users', 'manage_groups'],
    agent: ['access_admin_panel', 'manage_groups'],
    staff: [],
    client: [],
}

export const hasPermission = (role: UserRole, permission: Permission): boolean =>
    ROLE_PERMISSIONS[role]?.includes(permission) ?? false

export default ROLE_PERMISSIONS
```
Mirror this shape exactly for plan capabilities — a `Record<plan, capability[]>` or `Record<plan, Record<capability, boolean>>` (RESEARCH.md's Pattern 3 example uses the latter shape; either is consistent with this file's spirit, planner's call). Suggested paired consumer (mirrors `usePermission.ts` / `Can.tsx` below) if the planner opts for the fuller parallel structure:

**`usePermission.ts` analog** (`frontend/src/store/hooks/Auth/usePermission.ts:1-11`, full file):
```typescript
import { hasPermission, type Permission } from '@/assets/rbac/permissions'
import useRole from './useRole'

const usePermission = (permission: Permission): boolean => {
    const { role, isUserLoaded } = useRole()
    if (!isUserLoaded || !role) return false
    return hasPermission(role, permission)
}

export default usePermission
```

**`Can.tsx` analog** (`frontend/src/components/common/guards/Can.tsx:1-17`, full file):
```tsx
import { ReactNode } from 'react'
import { type Permission } from '@/assets/rbac/permissions'
import usePermission from '@/store/hooks/Auth/usePermission'

interface CanProps {
    permission: Permission
    children: ReactNode
    fallback?: ReactNode
}

const Can = ({ permission, children, fallback = null }: CanProps) => {
    const allowed = usePermission(permission)
    return <>{allowed ? children : fallback}</>
}

export default Can
```
`brokerage.plan` is already frontend-visible and fetched: `frontend/src/assets/types/brokerageType.ts:13` declares `plan?: string`, and `frontend/src/store/hooks/Admin/Brokerage/useFetchBrokerage.ts` fetches it with a 1-hour `staleTime` keyed by `activeBrokerageId`. Any plan-capability helper/hook consumes `brokerage.plan` from this existing hook — no new fetch needed for the 3 brokerage-scoped gates (board dialog, invite form, domains banner). The calendar gate is the one exception — it needs the cross-brokerage `any_paid_brokerage_membership?` boolean, which per RESEARCH.md's Open Question resolution is NOT safely derivable from the existing `admin_brokerages` endpoint (role-scope gap) — planner must decide whether to expose it via a new field/endpoint or a dedicated request.

---

### `frontend/src/components/common/FreeTierBanner.tsx` (component, presentational — NEW file)

**Analog:** `ConnectBoardDialog.tsx`'s existing info-notice block (`frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx:130-133`):
```tsx
<div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800 flex items-start gap-2">
    <Info className="h-4 w-4 mt-0.5 shrink-0" />
    <span>This board contains sample listings for development — no real credentials required.</span>
</div>
```
This is the only existing "explanatory notice" visual pattern in the codebase (per UI-SPEC's Color contract, which mandates reusing `border-blue-200 bg-blue-50 text-blue-800` verbatim, no new blue). `Info` icon import: `import { Info } from 'lucide-react'` (already imported at `ConnectBoardDialog.tsx:2`).

Per 37-UI-SPEC.md's Copywriting Contract (resolved design), the new component takes `message: string` and optional `heading` (default `"Free plan"`), renders heading (16px/600, `text-base font-semibold`) + body (14px/400, `text-sm font-normal`) with `gap-2` icon row and `px-4` horizontal padding — see 37-UI-SPEC.md for the full signed-off skeleton (already checker-verified, do not deviate).

---

### `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` (component, modify)

**Current relevant excerpt** (`BoardRegistrations.tsx:56-67`, `CardHeader`/`CardContent` structure):
```tsx
<Card className="mt-6">
    <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-semibold">Realtor Board Registrations</CardTitle>
        <Can permission="manage_brokerage_settings">
            <Button size="sm" onClick={() => setIsConnectBoardOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Connect Board
            </Button>
        </Can>
    </CardHeader>
    <CardContent>
```
Per UI-SPEC placement contract: insert `FreeTierBanner` below the page `<h1>`("Board Registrations" — lives in a parent page component, not this Card itself; confirm exact `<h1>` location at plan time) and above the board-select list. Within this Card's own boundary, the natural insertion point is directly inside `CardContent`, before the `boardCredentials.length === 0` conditional (`BoardRegistrations.tsx:68`). Copy: "Only the TEST board is available on the Free plan — it's pre-loaded with sample listings so you can explore the platform. Upgrade to Independent or Growth to connect real MLS/RETS boards." (verbatim from UI-SPEC).

`ConnectBoardDialog.tsx` itself needs NO filtering logic change (D-02, Pitfall 4) — it already unconditionally `.map()`s the `boards` prop (lines 92-101); the backend `boards_controller.rb` filter is the only enforcement point.

---

### `frontend/src/components/view/admin/listingGroupsAdminView/addUserToGroupView/AddUserToGroupView.tsx` (component, modify)

**Target block to hide for Free-tier** (`AddUserToGroupView.tsx:230-267`, the "Invite New User" form — confirmed via Pitfall 2 in RESEARCH.md that this, not a bare group-detail button, is the real client-invite entry point):
```tsx
<form onSubmit={handleInvite} className="space-y-3">
    <div>
        <h2 className="text-sm font-semibold">Invite New User</h2>
    </div>

    {inviteError && (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {inviteError}
        </div>
    )}

    <div className="space-y-2">
        <Label>Email</Label>
        <Input ... />
    </div>

    <div className="flex justify-end gap-2">
        ...
        <Button type="submit" disabled={!canSubmitInvite || isSubmitting}>
            <Mail className="mr-2 h-4 w-4" />
            Create Invite
        </Button>
    </div>
</form>
```
This form is hardcoded to `role: 'client'` in this flow (`newUserRole` state defaults to `'client'` at line 74 and is never changed via UI — no role selector rendered). Per D-04, replace this entire `<form>` block with `FreeTierBanner` (heading "Free plan", body: "Inviting clients isn't available on the Free plan. Upgrade to Independent or Growth to give clients access to this group.") when the brokerage is Free-tier. The sibling "Add Existing User" `<form>` (lines 166-226) and the `h-px w-full bg-border` divider (line 228) stay untouched (D-03 — `Group::UsersController` path is unaffected). This component does not currently receive a `brokerage`/`plan` prop — plan-capability data must be threaded in from whatever container renders it (planner's call: prop vs. context read).

---

### `frontend/src/components/view/admin/domainsAdminView/DomainCardList.tsx` (component, modify)

**Confirmed: no existing banner to update** (Pitfall 3) — grepped `DomainCard.tsx` and found only a dead `/admin/plan` link gated `admin+`:
```tsx
{/* Frozen: Upgrade plan CTA, gated admin+ */}
{isFrozen && (
    <Can permission="manage_brokerage_settings">
        <Button size="sm" variant="outline" onClick={() => { window.location.href = '/admin/plan' }}>
            <ExternalLink className="h-4 w-4 mr-1.5" />
            Upgrade plan
        </Button>
    </Can>
)}
```
(`DomainCard.tsx:187-199` — this is Phase-38 downgrade/frozen-state territory, unrelated to the Free-tier gate this phase adds; do not replicate this dead-link pattern per UI-SPEC's explicit flag.)

**Insertion point in `DomainCardList.tsx`** — below `<h1>` "Domains" and its help popover (lines 44-94), above the "Add domain" action button area (line 84-92) per UI-SPEC placement contract, or immediately below the header block (line 95's `<p className="text-sm text-muted-foreground">Manage your brokerage domains.</p>`) and before the card list (line 113). Current header structure for reference (`DomainCardList.tsx:42-95`) shown in full above in Reusable Assets. Copy: "Custom domains aren't available on the Free plan — your brokerage runs on its subdomain. Upgrade to Independent or Growth to connect your own domain."

---

### `frontend/src/components/view/account/calendar/CalendarTab.tsx` (component, modify)

**Current unconditional render** (`CalendarTab.tsx:51-101`):
```tsx
return (
    <div className="space-y-6">
        <section>
            <div className="mb-1 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-base font-semibold">Connected Calendars</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
                Connect your calendar to sync property showing dates automatically.
            </p>
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-1 max-w-sm">
                {providerOrder.map((provider) => { ... <ProviderCard .../> ... })}
            </div>
        </section>
    </div>
)
```
Per D-08: tab stays visible; when the user is fully-Free (no paid membership), render `FreeTierBanner` in place of the `<div className="grid ...">` provider-card grid (lines 61-98), keeping the section heading/intro text above it unchanged. Copy: "Calendar sync isn't available on the Free plan. Upgrade to Independent or Growth to sync property showings to your calendar." `useCalendarContext()` (`frontend/src/containers/account/CalendarContext.tsx`, full file read — 53 lines) currently exposes no plan/capability boolean — `state.connections`, `state.isLoading`, `state.isConnecting*` only. The membership-check boolean must be added to this context's `state` (new query or derived value) before `CalendarTab.tsx` can branch on it — flagged as an integration gap for the planner, not solved by an existing analog.

---

## Shared Patterns

### Backend 403 shape (`plan_required`)
**Source:** `backend/app/controllers/v1/admin/domains_controller.rb:57-60`
**Apply to:** `boards_controller.rb` (create path only — index has no rejection), `board_credentials_controller.rb#create`, `group/invitations_controller.rb#create`, `google_oauth_controller.rb#authorize`, `connections_controller.rb#create_apple`
```ruby
unless Current.brokerage.plan_config.custom_domain
  return render json: {error: "Custom domains require a plan with custom domain access", code: "plan_required"}, status: :forbidden
end
```
Always `status: :forbidden` (HTTP 403), always `code: "plan_required"` in the body, human-readable `error` string describing the specific capability. This is now a 5-times-repeated shape across this phase — treat any deviation as a bug.

### Brokerage-scoped plan read
**Source:** `backend/app/models/brokerage.rb:34-36` (`plan_config` accessor) + `backend/app/constants/plan_tiers.rb` (`AppConstants::PLAN_TIERS`, full file, 50 lines — frozen `PlanTier` structs keyed by `"free"`/`"independent"`/`"growth"` with `real_boards`, `clients`, `custom_domain`, `calendar_sync` booleans)
**Apply to:** `boards_controller.rb`, `board_credentials_controller.rb`, `group/invitations_controller.rb` — always `Current.brokerage.plan_config.<flag>`, never a raw `Current.brokerage.plan == "free"` string comparison.

### Cross-brokerage user gate (calendar only — architectural outlier)
**Source:** new `User#any_paid_brokerage_membership?` (Pattern 2, no prior in-repo analog — first consumer of this shape)
**Apply to:** `google_oauth_controller.rb#authorize`, `connections_controller.rb#create_apple` only. Never substitute `Current.brokerage.plan_config.calendar_sync` here — confirmed wrong scope via `backend/app/controllers/concerns/brokerage_auth.rb` (Origin/Host tenant resolution, not user-identity scoped).

### Frontend RBAC-mirror pattern (`Can` / `usePermission` / `permissions.ts`)
**Source:** `frontend/src/assets/rbac/permissions.ts`, `frontend/src/store/hooks/Auth/usePermission.ts`, `frontend/src/components/common/guards/Can.tsx` (all 3 read in full above)
**Apply to:** the new `planPermissions.ts`/`hasPlanCapability` helper and its consumers in `BoardRegistrations.tsx`, `AddUserToGroupView.tsx`, `DomainCardList.tsx`, `CalendarTab.tsx` — same discipline: no inline `brokerage.plan === 'free'` string comparisons in JSX, route every check through the new helper.

### Info-notice / banner visual pattern
**Source:** `frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx:130-133`
**Apply to:** the new `FreeTierBanner.tsx` component — reuse `border-blue-200 bg-blue-50 text-blue-800` and the `Info` icon from `lucide-react` verbatim (per UI-SPEC's explicit "do not invent a new blue" instruction).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `User#any_paid_brokerage_membership?` | model method | CRUD (query) | First cross-brokerage user-scoped plan query in the codebase — every other plan check reads `Current.brokerage.plan_config`. Use RESEARCH.md's Pattern 2 code example directly as the template (no closer in-repo analog exists). |
| Calendar cross-brokerage capability boolean surfaced to frontend | integration (backend↔frontend contract) | request-response | No existing endpoint exposes "does this user have any paid brokerage membership" — `admin_brokerages` (`V1::Account::AdminBrokeragesController`) is role-scoped (`admin`/`owner`/`agent` only) and would under-report. Planner must design a new field/endpoint; RESEARCH.md's Open Question 1/Pitfall notes apply. |

## Metadata

**Analog search scope:** `backend/app/controllers/v1/admin/**`, `backend/app/controllers/v1/account/calendar/**`, `backend/app/models/**`, `backend/app/constants/**`, `frontend/src/components/view/admin/**`, `frontend/src/components/view/account/calendar/**`, `frontend/src/components/common/**`, `frontend/src/assets/rbac/**`, `frontend/src/store/hooks/Auth/**`, `frontend/src/containers/account/**`
**Files scanned:** 19 (13 target files + 6 pure analog/reference files: `plan_tiers.rb`, `brokerage.rb`, `real_estate_board.rb`, `brokerage_membership.rb`, `admin/invitations_controller.rb` grep, `brokerageType.ts`, `useFetchBrokerage.ts`)
**Pattern extraction date:** 2026-07-20
