# Phase 37: Free Tier Gating - Research

**Researched:** 2026-07-20
**Domain:** Multi-tenant SaaS plan-based authorization (Rails API + React SPA), imperative gating (no declarative authz gem)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Board-connect gating (PLAN-04)**
- **D-01:** Backend enforces at two points (defense-in-depth): `GET /v1/admin/boards` filters the returned list to TEST board(s) only for Free-tier brokerages, AND `POST /v1/admin/board_credentials` independently 403s if a Free-tier brokerage submits a non-test `real_estate_board_id`.
- **D-02:** `ConnectBoardDialog` shows only the TEST board in its select list for Free — no "upgrade to unlock more boards" hint or locked/greyed-out real-board entries in the dialog itself. (A page-level banner is added separately — see D-09.)

**Client-invite rejection (PLAN-05)**
- **D-03:** Scope confirmed narrow — this only affects `POST /v1/admin/groups/:group_id/invitations` when `role: "client"` (`Group::InvitationsController#create`). It does NOT affect `Group::UsersController#create` (adding existing brokerage users/agents to a group), since that endpoint only adds users already in the brokerage (`User.for_brokerage` scope) and clients are never brokerage members.
- **D-04:** The "Invite Client" action is hidden entirely from the group UI for Free-tier brokerages — no button shown that then fails on submit.
- **D-05:** Backend reject returns `403` with `{ error: "...", code: "plan_required" }` — same shape as the existing `custom` domain gate in `domains_controller.rb` (Phase 36). Applies regardless of the calling user's role (owner/admin/agent) — the block is on the brokerage's plan, not the caller.

**Seats (PLAN-06)**
- No cap exists today and none should be added for Free — this requirement is "verify nothing enforces a limit," not new logic. No open questions here.

**Calendar sync scope (PLAN-07)**
- **D-06:** `UserCalendarConnection` is scoped to the **user**, not a brokerage — a user can hold memberships at multiple brokerages on different tiers. Gating rule: a user retains full calendar sync access account-wide if **any** of their brokerage memberships is paid (`independent`/`growth`). Only a user whose memberships are **all** Free loses access. (Rejected: gating strictly to "the brokerage currently being viewed" — out of scope. Also rejected: gating on a "primary brokerage" concept — doesn't exist elsewhere in the codebase.)
- **D-07:** Calendar-connect API endpoints (Google/Apple connect, in `frontend/src/containers/account/CalendarContext.tsx` → backend calendar controllers) also reject server-side for fully-Free users — not just a UI-level hide.
- **D-08 (supersedes an earlier answer):** The account-level Calendar tab (`CalendarTab.tsx`) stays **visible** for fully-Free users — it is NOT hidden. Instead it renders a banner (see D-09) in place of the connect/provider-card UI, explaining that calendar sync requires a paid plan.

**Upgrade messaging / banners**
- **D-09:** Add an explanatory banner on each of the following surfaces for Free-tier brokerages/users, stating the restriction and that it requires a paid plan:
  1. Board Registrations page (`BoardRegistrations.tsx`) — explains only the TEST board is connectable
  2. Group detail page — explains "Invite Client" isn't available
  3. Domains page — copy/tier-name update (old binary basic/premium language → free/independent/growth) — **NOTE: research found no existing banner to update; see Pitfall "Domains banner assumption is wrong" below.**
  4. Account Calendar tab — explains calendar sync requires a paid plan (replaces the connect UI per D-08, doesn't sit alongside it)
- **D-10:** No banner needed for the seat cap (PLAN-06) — there's no restriction to explain, seats are genuinely unlimited on Free.
- Banner copy/exact placement/component structure (new shared component vs. per-page) is left to planning — the requirement is "a banner explaining the restriction exists on these 4 surfaces," not a specific implementation. **RESOLVED by 37-UI-SPEC.md: single reusable `FreeTierBanner` component, props `message: string`, optional `heading` (default `"Free plan"`).**

### Claude's Discretion
- Exact banner component structure — a single reusable `FreeTierBanner`-style component vs. bespoke per-page markup. **Resolved by UI-SPEC: one shared component.**
- Exact wording/copy for each banner — **resolved verbatim by UI-SPEC's Copywriting Contract, see below.**
- Whether the calendar membership-check (D-06) is computed via a new backend endpoint/serializer field or derived frontend-side from the existing admin-brokerages list — implementation detail. **Research finding: neither existing endpoint currently exposes what's needed; see Architecture Patterns section.**

### Deferred Ideas (OUT OF SCOPE)
- Upgrade/downgrade lifecycle (Phase 38), paid-to-paid billing changes (Phase 39), payment processor (BILL-01) — none of this phase's work.
- Frontend plan-selection UI updates (`PlanBadge.tsx`, `PlanCard.tsx`, `createBrokerageWizard.ts`) — in-scope only if the banner work happens to touch them; not a separate requirement to chase.
- "Rethink listing access model — BrokerageEstate vs board credential JOIN" — orthogonal query-layer refactor, not this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAN-04 | Free-tier brokerages can only connect the seeded TEST board (backend + frontend) | `RealEstateBoard.test_boards`/`.real_boards` scopes already exist (unused elsewhere) — filter `boards_controller.rb#index` with them; `board_credentials_controller.rb#create` gains a plan check before the existing `RetsAuthService`/`is_test_board?` branch |
| PLAN-05 | Free-tier brokerages cannot invite/add clients to any group | `Group::InvitationsController#create` gains `if invitation_params[:role] == "client" && !Current.brokerage.plan_config.clients` → 403; confirmed narrow scope via `Group::UsersController` code read |
| PLAN-06 | Free-tier brokerages have unlimited seats | Verified: zero seat-cap enforcement exists anywhere in `app/` today — this is a verification/regression-test task, not new code |
| PLAN-07 | Free-tier brokerages have no calendar sync access | `UserCalendarConnection` is `belongs_to :user` only (no brokerage FK) — gate must query `Current.user.brokerages` cross-brokerage, NOT `Current.brokerage.plan_config` (see Pitfall) |
| PLAN-08 | Free-tier brokerages restricted to subdomain | Already built in Phase 36 (`domains_controller.rb#custom`, `Current.brokerage.plan_config.custom_domain`) — this phase only needs the frontend banner + verification |
| PLAN-09 | All other engagement features unchanged on Free, against TEST-board listings | No gating needed — verify via existing group/comment/rating/like/document/RSVP/filter-set code paths, all of which are plan-agnostic today |
| PLAN-12 | Independent/Growth remain fully unrestricted | `plan_config` for `independent`/`growth` already has `real_boards: true, clients: true, custom_domain: true, calendar_sync: true` (Phase 36) — verification/regression-test task |
</phase_requirements>

## Summary

This phase adds four new plan-gated checks on top of Phase 36's `AppConstants::PLAN_TIERS` config and `Brokerage#plan_config` accessor, plus one frontend-only banner rollout. Three of the four gates (board-connect, client-invite, and the already-shipped custom-domain gate) follow one identical shape: `Current.brokerage.plan_config.<capability>` read inside a controller action, returning `403 { error: "...", code: "plan_required" }` on failure — this is now a well-established, three-times-repeated pattern in this codebase and the fourth (calendar) should reuse its error shape even though its query is structurally different.

The calendar-sync gate (PLAN-07) is the one architectural outlier: `UserCalendarConnection` belongs to `User`, not `Brokerage`, and the locked decision (D-06) requires evaluating **all** of a user's brokerage memberships, not `Current.brokerage`. This must NOT be implemented as `Current.brokerage.plan_config.calendar_sync` — that would silently gate on the wrong scope (the brokerage the request happens to be tenant-resolved to, which for account-level endpoints resolved via Origin/Host header is somewhat arbitrary) and violate D-06. The correct query is `Current.user.brokerages.without_deleted.where(plan: %w[independent growth]).exists?`, evaluated fresh on the backend at each calendar-connect call, and mirrored (or served) to the frontend for the tab's banner-vs-content decision.

Frontend-side, the codebase already has the exact building blocks the plan calls for: `Can`/`usePermission`/`ROLE_PERMISSIONS` (role-based) is the established pattern to mirror for plan-based permissions, and `brokerage.plan` is already serialized and already flows into the frontend today via `useFetchBrokerage()` (`BrokerageType.plan`) — but there is currently zero plan-capability derivation logic on the frontend (no `planConfig`, no `hasPlanCapability`, no mirrored `PLAN_TIERS` constant). This phase must introduce that mirrored frontend capability map from scratch, consistent with PLAN-TIERS.md's explicit instruction not to do raw `brokerage.plan === "free"` string comparisons inline.

Two research findings materially change what the planner should assume beyond CONTEXT.md/UI-SPEC: (1) the "Group detail page" banner target described in UI-SPEC does not correspond to a literal button on the group detail page — the actual client-invite entry point is the "Invite New User" form inside `AddUserToGroupView.tsx`, reached via the group detail page's "Add User" button, and that form has no role selector (it's hardcoded to invite role `client` in this UI flow); and (2) UI-SPEC's own research already flagged, and this research independently confirms, that no "Pro gate" banner currently exists anywhere in `DomainCardList.tsx`/`DomainCard.tsx`/`AddDomainWizard.tsx` — the Domains page needs the full new `FreeTierBanner` treatment, not a copy-only update.

**Primary recommendation:** Implement all three new backend gates (board list filter, board-credential-create reject, client-invite reject) as one-line `Current.brokerage.plan_config.<capability>` checks matching `domains_controller.rb`'s existing 403 shape exactly; implement the calendar gate as a new `User` model method (`User#any_paid_brokerage_membership?`) queried fresh per-request, not via `plan_config`; build one shared frontend `FreeTierBanner` component plus one small frontend plan-capability helper module (mirroring `permissions.ts`), and wire it into the four UI-SPEC-identified surfaces (with the group-detail banner placed inside `AddUserToGroupView.tsx`, not a bare group detail page).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Board list filtering (TEST-only) | API / Backend | Browser / Client | `GET /v1/admin/boards` is the real boundary (D-01); `ConnectBoardDialog` only ever renders what the API returns, no separate frontend filtering logic needed |
| Board-credential creation reject | API / Backend | — | `POST /v1/admin/board_credentials` is the actual mutation boundary — must reject independently of what the GET returned (defense-in-depth per D-01) |
| Client-invite reject | API / Backend | Browser / Client | `Group::InvitationsController#create` is the real boundary (D-05); frontend hides the "Invite New User" form entirely (D-04) as UX, not security |
| Calendar sync capability check | API / Backend | Browser / Client | Backend rejects at OAuth-authorize/connect/apple-connect endpoints (D-07); frontend needs the same boolean to decide banner-vs-provider-card rendering in `CalendarTab.tsx` |
| Custom domain gate | API / Backend | Browser / Client | Already built (Phase 36, `domains_controller.rb#custom`) — this phase only touches the frontend banner |
| Seat cap | N/A (verify absence) | N/A | No tier owns this — the requirement is confirming no tier enforces a cap |
| `FreeTierBanner` rendering | Browser / Client | — | Pure presentational — reads a plan-capability boolean already resolved by a parent hook/query, renders informational markup only |
| Plan-capability derivation (frontend) | Browser / Client | — | New: a frontend-side mirror of `AppConstants::PLAN_TIERS`, analogous to `ROLE_PERMISSIONS`, consumed by `Can`-style checks — client tier, not SSR (this app has no SSR layer) |

## Standard Stack

No new libraries are introduced by this phase. All work is business logic added to the existing Rails 7.1 API and Vite/React 18 SPA, using patterns and components already present in the codebase.

### Core (existing, reused)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Rails / `ActiveModelSerializers` | 7.1 (project-pinned) | Serializes `Brokerage#plan` (already exposed) into frontend-visible JSON | Existing convention — `BrokerageSerializer` already includes `:plan` |
| `active_support` `Struct`/`Hash` config (`AppConstants::PLAN_TIERS`) | n/a (in-repo, Phase 36) | Single source of truth for tier capability flags | Already built and frozen in Phase 36; this phase reads it, does not modify it |
| React 18 / TanStack Query | project-pinned | `useFetchBrokerage()` already fetches `brokerage.plan` on every admin page load (1hr staleTime) | Existing data-fetching convention — no new query needed for the 3 brokerage-scoped gates |
| shadcn/ui (`Badge`, `Button`, `Card`, `Dialog`, `Select`, `Popover`, `Tooltip`) | already installed | Banner markup, existing dialogs | Per UI-SPEC: no new shadcn components needed |
| lucide-react | already installed | `Info` icon for `FreeTierBanner` (matches `ConnectBoardDialog`'s existing info-notice icon) | Project-wide icon convention |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Frontend plan-capability map mirroring `ROLE_PERMISSIONS` | Raw `brokerage.plan === 'free'` string comparisons scattered across components | Explicitly rejected by `PLAN-TIERS.md`'s "Gating a new feature by plan" guidance — string comparisons aren't auditable in one place and drift silently |
| New backend field for calendar D-06 check | Deriving from `admin_brokerages` list frontend-side | `admin_brokerages` endpoint (`V1::Account::AdminBrokeragesController`) only includes brokerages where the user is `admin`/`owner`/`agent` — it would silently miss a `staff`/`client` membership at a paid brokerage, understating access. A dedicated backend-computed boolean is safer than reusing this endpoint as-is (see Pitfalls). |

**Installation:** None — no `npm install` / `bundle add` required for this phase.

## Package Legitimacy Audit

Not applicable — this phase adds no external packages to either `backend/Gemfile` or `frontend/package.json`. All work uses already-installed dependencies.

## Architecture Patterns

### System Architecture Diagram

```
FREE-TIER GATING — 4 independent enforcement points, all defense-in-depth
(backend = boundary, frontend = UX only, per repo convention)

┌─────────────────────────────────────────────────────────────────────┐
│ 1. BOARD CONNECT (PLAN-04)                                          │
│                                                                       │
│  ConnectBoardDialog ──GET /v1/admin/boards──▶ BoardsController#index│
│  (renders whatever                              │                    │
│   boards[] comes back,                          ▼                    │
│   no client-side filtering)          RealEstateBoard.active          │
│                                       + IF Free: .test_boards        │
│                                       + IF paid: (unfiltered)        │
│                                                                       │
│  onSubmit(payload) ──POST /v1/admin/board_credentials──▶            │
│                                       BoardCredentialsController#create│
│                                         │                             │
│                                         ▼                             │
│                              IF Free && board.is_test_board? == false│
│                                  → 403 {code: "plan_required"}       │
│                              ELSE → existing RetsAuthService flow    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 2. CLIENT INVITE (PLAN-05)                                          │
│                                                                       │
│  AddUserToGroupView "Invite New User" form (role hardcoded 'client')│
│  ──POST /v1/admin/groups/:id/invitations──▶                         │
│                              Group::InvitationsController#create     │
│                                  │                                    │
│                                  ▼                                    │
│                    IF role == "client" && !plan_config.clients       │
│                        → 403 {code: "plan_required"}                 │
│                    ELSE → existing Invitation.create! flow           │
│                                                                       │
│  Frontend: form is hidden entirely for Free (D-04), replaced by      │
│  FreeTierBanner in the same visual slot                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 3. CALENDAR SYNC (PLAN-07) — outlier: USER-scoped, not brokerage    │
│                                                                       │
│  CalendarTab.tsx ──GET /v1/account/calendar/connections──▶          │
│                              ConnectionsController#index             │
│                                                                       │
│  actions.connectGoogle() ──GET /v1/account/calendar/google/authorize│
│                              GoogleOauthController#authorize         │
│                                  │                                    │
│                                  ▼                                    │
│              IF !Current.user.any_paid_brokerage_membership?         │
│                  → 403 {code: "plan_required"}   (NEW check, D-07)   │
│              ELSE → existing OAuth redirect flow                     │
│                                                                       │
│  Same check added to: create_apple, (microsoft — dormant, skip)      │
│                                                                       │
│  Frontend: CalendarTab stays visible; banner replaces the            │
│  provider-card grid when the boolean is false (D-08)                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 4. CUSTOM DOMAIN (PLAN-08) — backend already shipped in Phase 36     │
│                                                                       │
│  DomainCardList.tsx ──POST /v1/admin/domains/custom──▶              │
│                              DomainsController#custom                │
│                                  │                                    │
│                                  ▼                                    │
│              IF !Current.brokerage.plan_config.custom_domain         │
│                  → 403 {code: "plan_required"}   (EXISTING, Phase 36)│
│                                                                       │
│  This phase's only work here: add FreeTierBanner above "Add domain"  │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

Backend — modify existing files, no new directories:
```
backend/app/
├── controllers/v1/admin/
│   ├── boards_controller.rb                    # MODIFY: filter by plan_config.real_boards
│   ├── board_credentials_controller.rb          # MODIFY: reject non-test board on create
│   └── group/invitations_controller.rb          # MODIFY: reject role=="client" on Free
├── controllers/v1/account/calendar/
│   ├── connections_controller.rb                # MODIFY: reject create_apple on Free-everywhere user
│   └── google_oauth_controller.rb                # MODIFY: reject authorize on Free-everywhere user
└── models/
    └── user.rb                                   # MODIFY: add any_paid_brokerage_membership?
```

Frontend — one new shared component + one new small helper module, modify existing pages:
```
frontend/src/
├── components/common/
│   └── FreeTierBanner.tsx                        # NEW: shared banner (per UI-SPEC contract)
├── assets/rbac/
│   └── planPermissions.ts                        # NEW: mirrors permissions.ts pattern for plan capabilities
│   # OR: extend permissions.ts directly — planner's call, see Open Questions
├── components/view/admin/brokerageView/
│   ├── ConnectBoardDialog.tsx                     # MODIFY: no dead-end change needed if boards[] already filtered server-side (D-02)
│   └── BoardRegistrations.tsx                     # MODIFY: add FreeTierBanner above board list
├── components/view/admin/listingGroupsAdminView/addUserToGroupView/
│   └── AddUserToGroupView.tsx                     # MODIFY: hide "Invite New User" form for Free, add FreeTierBanner in its place
├── components/view/admin/domainsAdminView/
│   └── DomainCardList.tsx                         # MODIFY: add FreeTierBanner above "Add domain" button
└── components/view/account/calendar/
    └── CalendarTab.tsx                            # MODIFY: render FreeTierBanner instead of provider grid when gated
```

### Pattern 1: Backend plan-gate check (brokerage-scoped)
**What:** A single `unless Current.brokerage.plan_config.<flag>` guard clause at the top of the mutating action, returning the standardized 403 shape.
**When to use:** Any of the three brokerage-scoped gates (board-credential create, client-invite create; custom-domain is the existing template).
**Example:**
```ruby
# Source: backend/app/controllers/v1/admin/domains_controller.rb:57-60 (existing, Phase 36)
def custom
  unless Current.brokerage.plan_config.custom_domain
    return render json: {error: "Custom domains require a plan with custom domain access", code: "plan_required"}, status: :forbidden
  end
  # ...
end
```
Apply the identical shape in `board_credentials_controller.rb#create`:
```ruby
def create
  board = RealEstateBoard.active.find_by(id: board_credential_params[:real_estate_board_id])
  return render json: {error: "Board not found"}, status: :not_found unless board

  unless Current.brokerage.plan_config.real_boards || board.is_test_board?
    return render json: {error: "Real board connections require a plan with board access", code: "plan_required"}, status: :forbidden
  end
  # ... existing RetsAuthService flow unchanged
end
```
And in `group/invitations_controller.rb#create`:
```ruby
def create
  if invitation_params[:role] == "client" && !Current.brokerage.plan_config.clients
    return render json: {error: "Client invites require a plan with client access", code: "plan_required"}, status: :forbidden
  end
  # ... existing Invitation.create! flow unchanged
end
```

### Pattern 2: Backend plan-gate check (user-scoped, cross-brokerage)
**What:** Query all of the user's brokerage memberships for at least one paid tier, independent of `Current.brokerage`.
**When to use:** Calendar sync only (D-06) — the one gate that is explicitly NOT tenant-scoped.
**Example:**
```ruby
# NEW — add to backend/app/models/user.rb
def any_paid_brokerage_membership?
  brokerages.without_deleted.where(plan: %w[independent growth]).exists?
end
```
```ruby
# In google_oauth_controller.rb#authorize and connections_controller.rb#create_apple
def authorize
  unless Current.user.any_paid_brokerage_membership?
    return render json: {error: "Calendar sync requires a paid plan", code: "plan_required"}, status: :forbidden
  end
  # ... existing OAuth flow unchanged
end
```
Note: `plan` is a plain DB column on `brokerages` (`t.string "plan", default: "free"`), so this is a single indexed-join SQL query (`brokerage_memberships.brokerage_id` is already indexed) — do **not** iterate `User#brokerages` in Ruby and call `.plan_config` per row; that defeats the purpose of a DB-level check and is needlessly slow.

### Pattern 3: Frontend plan-capability mirror (new)
**What:** A small, auditable frontend map from plan name → capability booleans, mirroring `AppConstants::PLAN_TIERS`, consumed the same way `ROLE_PERMISSIONS`/`usePermission` are consumed for roles.
**When to use:** Any UI decision point (D-02 board dialog, D-04 hide invite form, D-08 calendar tab banner, Domains page banner).
**Example (new file, mirrors existing `permissions.ts` shape):**
```typescript
// Source: pattern mirrors frontend/src/assets/rbac/permissions.ts (existing, role-based)
// NEW file — frontend/src/assets/plan/planCapabilities.ts (name is planner's call)
export type PlanCapability = 'realBoards' | 'clients' | 'customDomain' | 'calendarSync'

const PLAN_CAPABILITIES: Record<string, Record<PlanCapability, boolean>> = {
    free: { realBoards: false, clients: false, customDomain: false, calendarSync: false },
    independent: { realBoards: true, clients: true, customDomain: true, calendarSync: true },
    growth: { realBoards: true, clients: true, customDomain: true, calendarSync: true },
}

export const hasPlanCapability = (plan: string | undefined, capability: PlanCapability): boolean =>
    (plan && PLAN_CAPABILITIES[plan]?.[capability]) ?? false
```
This mirrors `backend/app/constants/plan_tiers.rb` by hand (duplication is unavoidable without a shared codegen step across the Ruby/TS boundary — flag as an Open Question below on whether the planner wants to formalize this duplication risk with a test).

### Anti-Patterns to Avoid
- **Using `Current.brokerage.plan_config.calendar_sync` for the calendar gate:** Wrong scope per D-06 — `Current.brokerage` is whichever brokerage the request's Origin/Host resolves to (`BrokerageAuth#resolve_brokerage`), not necessarily reflective of the user's other paid memberships. Always use the new `User#any_paid_brokerage_membership?` for calendar checks.
- **Raw `brokerage.plan === 'free'` string comparisons inline in components:** Explicitly called out as wrong in `PLAN-TIERS.md`. Route all frontend plan checks through the new capability-map helper (Pattern 3), same discipline as `Can`/`usePermission` for roles.
- **Filtering boards client-side after fetching the full list:** D-01 requires the `GET /v1/admin/boards` response itself to already be filtered for Free — don't fetch everything and filter in `ConnectBoardDialog`; that leaks real board names/regions to a Free-tier admin even if unselectable.
- **Treating `admin_brokerages` (V1::Account::AdminBrokeragesController) as authoritative for the D-06 cross-brokerage check:** It only includes memberships with role `admin`/`owner`/`agent` (line 22 of that controller) — a user with only a `staff` or `client` role at a paid brokerage would be incorrectly excluded. Do not repurpose this endpoint's data for the calendar gate without accounting for that gap.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Determining if brokerage is Free/paid | A new per-controller `brokerage.plan == "free"` check | `Current.brokerage.plan_config.<flag>` (Phase 36 accessor) | Already centralized, frozen, fails loud on bad plan values — reinventing it reintroduces the scattered-hardcoded-tier-name problem PLAN-02/03 exist to prevent |
| 403 error response shape | A new ad-hoc error JSON shape per controller | `{error: "...", code: "plan_required"}`, `status: :forbidden` | Already the established shape (`domains_controller.rb`); a fourth different shape would fragment frontend error-handling logic for no benefit |
| Frontend role/plan gating | Inline `if (role === 'owner' || role === 'admin')` or `if (plan === 'free')` checks scattered in JSX | `Can permission="..."` / new `hasPlanCapability(plan, capability)` helper | Auditability — single source of truth for "what can this role/plan see," per both `ROLES.md` and `PLAN-TIERS.md` |
| TEST board identification | A hardcoded `short_code === 'TEST'` string check in a new location | `RealEstateBoard.test_boards` / `.real_boards` scopes (already defined on the model, currently unused elsewhere in `app/`) or the `is_test_board` boolean column directly | These scopes already exist and are exactly what PLAN-04's filtering needs — no reason to duplicate the query logic |

**Key insight:** Nearly every piece of infrastructure this phase needs (`plan_config`, the 403 shape, `RealEstateBoard.test_boards`/`.real_boards`, `Can`/`usePermission`) already exists in the codebase from Phase 36 or earlier work. This phase is almost entirely "wire the existing pattern into 3 new call sites + build 1 new cross-brokerage user query + build 1 new frontend banner component" — very little genuinely new logic.

## Common Pitfalls

### Pitfall 1: Calendar gate implemented with the wrong scope
**What goes wrong:** Implementing PLAN-07 as `Current.brokerage.plan_config.calendar_sync` (copy-pasting the domain/board pattern) instead of a cross-brokerage `Current.user` query.
**Why it happens:** The other three gates all use `Current.brokerage.plan_config`, making it the "obvious" pattern to copy — but D-06 explicitly rejected brokerage-scoping for calendar.
**How to avoid:** Use `Current.user.any_paid_brokerage_membership?` (new `User` model method, Pattern 2). Never read `plan_config` off `Current.brokerage` inside the calendar controllers.
**Warning signs:** A test asserting "user is on a Free brokerage, calendar sync is blocked" passes but a test asserting "user has a Free brokerage AND a paid brokerage, calendar sync is allowed" fails — that's the tell that brokerage-scoping crept in.

### Pitfall 2: "Group detail page" banner placed on the wrong component
**What goes wrong:** Assuming (per UI-SPEC's literal wording) there's a bare "Invite Client" button directly on the group detail page to hide/replace with a banner.
**Why it happens:** UI-SPEC and CONTEXT.md both describe the surface as "Group detail page," but the actual codebase has no such button there — group detail (`UsersSection.tsx`) has a generic "Add User" button that navigates to a separate route/view (`AddUserToListingGroupAdminBoard` → `AddUserToGroupView.tsx`), which contains BOTH an "Add Existing User" form (unaffected by this phase, D-03) and an "Invite New User" form (the actual client-invite entry point, hardcoded to `role: 'client'` in this UI, no role selector present).
**How to avoid:** Target `AddUserToGroupView.tsx`'s "Invite New User" `<form>` block specifically — hide it (D-04) and render `FreeTierBanner` in its place for Free-tier brokerages. Leave "Add Existing User" and the Members/Invites tabs untouched.
**Warning signs:** Grepping for "Invite Client" text turns up nothing in the group detail component tree — that's expected; the correct target is the "Invite New User" heading in `AddUserToGroupView.tsx`.

### Pitfall 3: Domains-page banner treated as a copy-only update
**What goes wrong:** Following CONTEXT.md D-09 literally ("copy/tier-name update, not new UI") and skipping building `FreeTierBanner` on the Domains page because "the Pro-gate banner already exists."
**Why it happens:** CONTEXT.md's decision log references a v1.6 DUI-09 "Pro gate" banner as prior art. Both this research and 37-UI-SPEC.md independently checked `DomainCardList.tsx`, `DomainCard.tsx`, and `AddDomainWizard.tsx` and found no such banner currently renders anywhere — the only related artifact is a dead "Upgrade plan" button (`DomainCard.tsx` ~line 193) that appears only on individually-frozen domain cards and links to a nonexistent `/admin/plan` route.
**How to avoid:** Build the full `FreeTierBanner` on the Domains page like the other three surfaces — do not skip it as "already done." Do not replicate the dead `/admin/plan` link pattern in the new banner (UI-SPEC explicitly flags this).
**Warning signs:** If a plan review says "Domains page: copy update only, 1-line change," that's a signal the plan under-scoped this surface.

### Pitfall 4: Board-connect UI trusts the frontend list instead of relying on backend filtering
**What goes wrong:** Adding a second, redundant frontend-side filter (`boards.filter(b => b.isTestBoard)`) inside `ConnectBoardDialog.tsx` in addition to the backend filter.
**Why it happens:** Defensive instinct, but D-01/D-02 already specify the backend does the filtering and the dialog "shows only the TEST board... no locked/greyed-out real-board entries" — meaning the dialog should just render whatever `boards` prop it's given, unmodified.
**How to avoid:** No frontend filtering logic in `ConnectBoardDialog.tsx` — verify the `GET /v1/admin/boards` response is already correctly scoped upstream (in the hook/context that calls `fetchBoards`), and let the existing unconditional `.map()` render whatever comes back.
**Warning signs:** Two independent places computing "is this board visible" (backend query + frontend `.filter()`) is a sign of drift risk, not defense-in-depth — defense-in-depth here means backend GET + backend POST, not backend + frontend duplication of the same read-only list.

### Pitfall 5: Missing test factory/fixture support for calendar + plan-tier test scenarios
**What goes wrong:** Writing tests for D-06/D-07 (calendar cross-brokerage gating) without a `user_calendar_connections` FactoryBot factory, or writing plan-tier tests without an explicit `plan:` trait on the `brokerage` factory.
**Why it happens:** `test/factories/brokerages.rb` currently has no `plan` attribute at all (relies on the DB default `"free"`), and there is no `test/factories/user_calendar_connections.rb` file yet — this phase is the first to need multi-brokerage-membership + plan-varying test setups at this depth.
**How to avoid:** Add `trait :independent` / `trait :growth` (or a `plan { "free" }` transient + traits) to `test/factories/brokerages.rb`, and add a new `user_calendar_connections` factory before writing calendar-gate tests. Also be aware of the pre-existing STATE.md-documented issue: the `real_estate_board` factory's `:test_board` trait (`short_code: "TEST"`) can collide with a live seeded `TEST` row in the shared test-environment Postgres DB if `DATABASE_URL` leaks into `RAILS_ENV=test` — this is a pre-existing, unrelated flake, not something this phase needs to fix, but tests touching `RealEstateBoard.test_boards`/`.real_boards` should be aware of it.
**Warning signs:** `NoMethodError: undefined factory` or duplicate-`short_code` uniqueness violations in CI for any new board/calendar tests.

### Pitfall 6: Client-invite gate placed on the wrong controller action or wrong field
**What goes wrong:** Gating `Group::InvitationsController#create` on brokerage plan unconditionally (rejecting ALL group invites on Free, not just `role: "client"` ones), or gating `Group::UsersController#create` instead.
**Why it happens:** Both controllers superficially look like "add a user to a group" — easy to conflate.
**How to avoid:** The gate is strictly `invitation_params[:role] == "client"` inside `Group::InvitationsController#create` only. `Group::UsersController#create` (adding an existing brokerage user, scoped via `User.for_brokerage`) is explicitly out of scope per D-03 — clients are never brokerage members so they can never appear in that endpoint's candidate list anyway, but the code must not add a plan check there regardless.
**Warning signs:** A test asserting "Free-tier owner cannot add an existing agent to a group" — that should NOT be true; if a plan makes it true, the gate was placed on the wrong controller.

## Code Examples

### Board list filtering (PLAN-04, backend)
```ruby
# Source: pattern extends backend/app/controllers/v1/admin/boards_controller.rb (existing file, currently unfiltered)
module V1
  module Admin
    class BoardsController < V1::Admin::BaseController
      def index
        scope = RealEstateBoard.active
        scope = scope.test_boards unless Current.brokerage.plan_config.real_boards
        boards = scope.order(:name)
        render json: {
          boards: ActiveModelSerializers::SerializableResource.new(
            boards, each_serializer: RealEstateBoardSerializer, adapter: :attributes
          ).as_json
        }
      end
    end
  end
end
```
`RealEstateBoard.test_boards` (`where(is_test_board: true)`) and `.real_boards` (`where(is_test_board: false)`) already exist on the model (`backend/app/models/real_estate_board.rb`) and are currently unused elsewhere in the codebase — this is their first real consumer.

### FreeTierBanner component skeleton (frontend, per UI-SPEC contract)
```tsx
// Source: derives from 37-UI-SPEC.md Copywriting/Color/Typography/Spacing contract
// and the existing info-notice pattern in ConnectBoardDialog.tsx (test-board-info step)
import { Info } from 'lucide-react'

interface FreeTierBannerProps {
    message: string
    heading?: string
}

const FreeTierBanner = ({ message, heading = 'Free plan' }: FreeTierBannerProps) => (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-blue-800">
        <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="text-base font-semibold">{heading}</p>
        </div>
        <p className="text-sm font-normal mt-1">{message}</p>
    </div>
)

export default FreeTierBanner
```
Note: UI-SPEC's spacing contract specifies `gap-2` (8px) for the icon+heading row and `px-4` for horizontal padding — both reflected above. The blue notice classes (`border-blue-200 bg-blue-50 text-blue-800`) are copied verbatim from `ConnectBoardDialog.tsx`'s existing `test-board-info` step per UI-SPEC's explicit "do not invent a new blue" instruction.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Binary `basic`/`premium` plan enum, single custom-domain gate only | Three-tier `free`/`independent`/`growth` enum, centralized `PLAN_TIERS` config with 4 capability flags | Phase 36 (this milestone, 2026-07-14) | This phase is the first consumer of 3 of those 4 flags (`real_boards`, `clients`, `calendar_sync`) — `custom_domain` was already wired to a real gate |
| N/A — no frontend plan-capability concept existed | This phase introduces the first frontend plan-capability derivation (mirrors `ROLE_PERMISSIONS`) | This phase | Frontend previously only had `brokerage.plan` as a raw string (used in `createBrokerageWizard.ts`'s deferred `isPremium` checks) — no gating logic consumed it |

**Deprecated/outdated:**
- `isPremium`-style checks in `createBrokerageWizard.ts`/`DomainStep.tsx`/`CreateBrokerageContext.tsx` (onboarding wizard) still reference the old `basic`/`premium` binary — confirmed out of scope for this phase per 36-CONTEXT.md D-08 (deferred, frontend still sends `basic`/`premium` at signup pending a coordinated deploy). Do not "fix" these as a side effect of this phase's work unless the banner work directly touches them.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The frontend plan-capability helper should live in a new file (e.g. `assets/plan/planCapabilities.ts`) rather than being folded into `assets/rbac/permissions.ts` | Architecture Patterns, Pattern 3 | Low — either location works; if the planner prefers one file for both role and plan gating, that's a naming/organization choice, not a correctness issue. Flagged as Open Question below rather than a hard recommendation. |
| A2 | `Current.user.brokerages.without_deleted.where(plan: %w[independent growth]).exists?` is performant enough to call synchronously per calendar-connect request (no caching needed) | Pattern 2 | Low-Medium — for a user with a handful of brokerage memberships this is a trivial indexed query; if a future power-user scenario has hundreds of memberships this could warrant caching, but no evidence that's a real scenario today (each brokerage requires an invitation/onboarding to join) |
| A3 | `AppConstants::PLAN_TIERS`'s 4 capability flags (`real_boards`, `clients`, `custom_domain`, `calendar_sync`) are the complete and final set needed for this phase — no 5th flag needs to be added to the Phase 36 config | Standard Stack, Summary | Low — PLAN-04 through PLAN-09 map cleanly onto the existing 4 flags plus PLAN-06's "verify no cap" (no flag needed) and PLAN-09's "everything else works" (no flag needed) |

## Open Questions (RESOLVED)

> Both questions below were resolved during planning. Resolution notes and the plan/threat-register that closed each are inline under **RESOLVED**.

1. **Where should the new frontend plan-capability helper module live, and should it be named to parallel `permissions.ts` exactly?**
   - What we know: The pattern to mirror is `assets/rbac/permissions.ts` + `usePermission.ts` + `Can.tsx`. No existing plan-equivalent exists anywhere in `frontend/src/`.
   - What's unclear: Whether the planner wants a fully parallel `assets/rbac/planPermissions.ts` + `usePlanPermission.ts` + a `<Can>`-like `<CanPlan>` wrapper (maximum consistency with existing RBAC), or a lighter single-file helper (`hasPlanCapability(plan, capability)`) consumed directly in the 4 banner-target components without a new hook/component layer.
   - Recommendation: Given only 4 call sites need this in this phase (not dozens, unlike roles), a single lightweight helper module is proportionate — but if the planner anticipates PLAN-14 through PLAN-19 (Phases 38-39) needing more plan-gated UI, building the fuller parallel structure now may pay off sooner. Either is defensible; flag for planner decision, not a blocking unknown.
   - **RESOLVED (Plan 37-04, Task 1):** Ship the lighter single-file helper `assets/rbac/planPermissions.ts` exporting `hasPlanCapability(plan, capability)` — no `usePlanPermission` hook and no `<CanPlan>` wrapper this phase (4 call sites do not justify the fuller layer). The capability boolean is resolved in each surface's **container** and threaded to the pure component as a prop (Plans 37-05, 37-06); presentational components never call the helper or `useFetchBrokerage` directly. See Plan 37-04 action text ("RESEARCH Open Q1 resolution").

2. **Should `Group::InvitationsController#create`'s plan check also validate that `invitation_params[:role]` is a recognized role at all (mirroring `admin/invitations_controller.rb`'s `AppConstants::BROKERAGE_ROLES.include?(role)` check), or should this phase touch only the plan-gate line and leave the pre-existing lack of role validation as-is?**
   - What we know: `Group::InvitationsController#create` currently has zero role validation — any string can be passed to `Invitation.create!(role: ...)`. The sibling `admin/invitations_controller.rb#create` does validate.
   - What's unclear: Whether adding a plan check "on top of" unvalidated input is safe (i.e., could a Free-tier caller bypass the client-block by sending a role value that isn't exactly the string `"client"`, like `"Client"` or `" client"`, and still end up creating a client-equivalent invitation?).
   - Recommendation: The plan check should do an exact-match comparison against the frontend-sent value (`role == "client"`), consistent with D-03's literal wording — but the planner/executor should verify at implementation time whether case/whitespace normalization is needed given the pre-existing lack of role validation on this endpoint. This is a narrow, contained edge case, not a blocker.
   - **RESOLVED (Plan 37-01, threat register T-37-04):** The Free-tier client-invite gate uses an exact-match `role == "client"` comparison per D-03/D-05, which server-side rejects regardless of caller role. Broader enum/role validation on this endpoint is pre-existing debt and explicitly out of this phase's scope; that residual is dispositioned **accept** as T-37-04 in Plan 37-01's `<threat_model>`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V4 Access Control | yes | Server-side authorization checks on every mutating/gated endpoint (`plan_config.<flag>` / `any_paid_brokerage_membership?`), never trusting client-supplied plan assumptions — matches this phase's entire scope |
| V2 Authentication | no (unchanged) | Existing `CognitoAuth`/`BrokerageAuth` concerns untouched by this phase |
| V5 Input Validation | partial | `Group::InvitationsController#create`'s `role` param has no enum validation today (pre-existing gap, see Open Question 2) — this phase's new plan check should not be the only thing standing between a malformed `role` value and a created client invitation |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Client bypasses hidden UI and calls the API directly to invite a client / connect a real board / connect calendar on a Free-tier brokerage | Elevation of Privilege | Backend-side `plan_config`/`any_paid_brokerage_membership?` checks on every gated endpoint (D-01, D-05, D-07) — this is the entire "backend is the boundary, frontend is UX" convention already established by `domains_controller.rb` and explicitly re-confirmed for this phase in CONTEXT.md |
| Tenant confusion — a request resolved to Brokerage A's plan is used to gate a resource actually belonging to the user's Brokerage B membership | Tampering / Elevation of Privilege | This is precisely the calendar-gate pitfall (Pitfall 1) — `Current.brokerage` is resolved per-request from Origin/Host (`BrokerageAuth#resolve_brokerage`), so any endpoint whose true authorization scope is the user (not the tenant) must query `Current.user`'s memberships directly, never assume `Current.brokerage` reflects the right plan |
| Role-string injection into `Group::InvitationsController#create`'s unvalidated `role` param | Tampering | Out of this phase's core scope but flagged (Open Question 2) — recommend the planner add a minimal `AppConstants::BROKERAGE_ROLES.include?(role)` guard alongside the new plan check, since both changes touch the same lines |

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `backend/app/constants/plan_tiers.rb` — `AppConstants::PLAN_TIERS` config (Phase 36)
- `backend/app/models/brokerage.rb` — `plan_config` accessor
- `backend/app/controllers/v1/admin/domains_controller.rb` — existing plan-gate template (`custom` action)
- `backend/app/controllers/v1/admin/boards_controller.rb`, `board_credentials_controller.rb` — current (unfiltered) board-connect flow
- `backend/app/controllers/v1/admin/group/invitations_controller.rb`, `group/users_controller.rb` — client-invite vs. add-existing-user scope confirmation
- `backend/app/controllers/v1/admin/invitations_controller.rb` — brokerage-level invite controller's existing `role == "client"` rejection precedent (ROLES.md-referenced)
- `backend/app/models/real_estate_board.rb` — confirmed `test_boards`/`real_boards` scopes already exist
- `backend/app/models/user_calendar_connection.rb`, `backend/app/models/user.rb`, `backend/app/models/brokerage_membership.rb` — confirmed user-scoped (not brokerage-scoped) calendar model and cross-brokerage query path
- `backend/app/controllers/v1/account/calendar/connections_controller.rb`, `google_oauth_controller.rb` — calendar connect entry points
- `backend/app/controllers/concerns/brokerage_auth.rb` — confirmed `Current.brokerage` is resolved per-request from Origin/Host, not user-identity-scoped
- `backend/app/controllers/v1/account/admin_brokerages_controller.rb` — confirmed this endpoint's role scope (`admin`/`owner`/`agent` only) makes it unsuitable as-is for the D-06 cross-brokerage check
- `backend/db/schema.rb`, `backend/db/seeds/09_real_estate_boards.rb` — confirmed `brokerages.plan` column + default, confirmed only TEST board is seeded
- `backend/app/serializers/brokerage_serializer.rb`, `real_estate_board_serializer.rb`, `user_calendar_connection_serializer.rb` — confirmed `plan` and `is_test_board` are already frontend-visible
- `backend/test/factories/brokerages.rb`, `real_estate_boards.rb`, `brokerage_memberships.rb` — confirmed no `plan` trait exists yet, confirmed no `user_calendar_connections` factory exists yet
- `frontend/src/components/common/guards/Can.tsx`, `assets/rbac/permissions.ts`, `store/hooks/Auth/usePermission.ts` — role-gating pattern to mirror
- `frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx`, `BoardRegistrations.tsx` — board-connect UI, existing info-notice styling
- `frontend/src/components/view/admin/listingGroupsAdminView/listingGroupDetailsAdminBoard/sections/UsersSection.tsx`, `addUserToGroupView/AddUserToGroupView.tsx`, `addUserToListingGroupAdminBoard/useAddUsersToGroupContext.tsx` — confirmed the real client-invite UI location and its "role hardcoded to client" behavior
- `frontend/src/components/view/account/calendar/CalendarTab.tsx`, `ProviderCard.tsx`, `containers/account/CalendarContext.tsx` — calendar UI, confirmed unconditional rendering today
- `frontend/src/components/view/admin/domainsAdminView/DomainCardList.tsx`, `DomainCard.tsx` — confirmed no existing Pro-gate banner, confirmed dead `/admin/plan` link
- `frontend/src/assets/types/brokerageType.ts`, `store/hooks/Admin/Brokerage/useFetchBrokerage.ts` — confirmed `brokerage.plan` already flows to frontend via existing query
- `.planning/PLAN-TIERS.md`, `.planning/REQUIREMENTS.md`, `.planning/ROLES.md`, `.planning/STATE.md` — project design docs
- `.planning/phases/37-free-tier-gating/37-CONTEXT.md`, `37-UI-SPEC.md`, `37-DISCUSSION-LOG.md` — locked decisions and UI contract for this phase
- `.planning/phases/36-plan-configuration-tier-migration/36-CONTEXT.md` — prior-phase decisions (D-07 fail-loud, D-08 deferred frontend plan-selection UI)

No Context7/external documentation lookups were needed for this phase — it is pure in-repo business logic extending an already-built internal config system, not a new third-party library integration.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns directly read from the codebase
- Architecture: HIGH — every controller/model/component referenced was read directly, not inferred
- Pitfalls: HIGH — Pitfalls 1-4, 6 are derived from direct code contradictions with CONTEXT.md/UI-SPEC assumptions found during this research session, not speculative; Pitfall 5 is directly evidenced by absent factory files and a documented STATE.md issue

**Research date:** 2026-07-20
**Valid until:** 30 days (stable internal codebase, no external dependency drift risk)
