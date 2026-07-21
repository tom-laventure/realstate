# Phase 37: Free Tier Gating - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 37 builds the actual Free-tier enforcement wall on top of the plan config and `plan_config` accessor Phase 36 shipped. Four gates, all reading from `Current.brokerage.plan_config`:

1. Board-connect: Free-tier brokerages can only connect the seeded TEST board (PLAN-04)
2. Client-invite: Free-tier brokerages cannot invite/add clients to any group (PLAN-05)
3. Seats: Free-tier brokerages have unlimited agent/staff seats — no cap to build (PLAN-06)
4. Calendar sync: no calendar sync access without at least one paid-tier brokerage membership (PLAN-07)
5. Custom domain: Free-tier restricted to subdomain (PLAN-08) — backend gate already exists from Phase 36 (`Ops`/`domains_controller.rb` reads `plan_config.custom_domain`); this phase's job is the frontend treatment and verifying the existing gate is correct, not building new backend logic
6. All other engagement features (groups, comments, ratings, likes, documents, RSVP/dates, filter sets) work unchanged on Free, against TEST-board listings (PLAN-09)
7. Independent and Growth remain fully unrestricted on all of the above (PLAN-12) — verify no regression, not new work

Does NOT build: upgrade/downgrade lifecycle (Phase 38), paid-to-paid billing changes (Phase 39), or a payment processor (BILL-01, out of scope).

</domain>

<decisions>
## Implementation Decisions

### Board-connect gating (PLAN-04)
- **D-01:** Backend enforces at two points (defense-in-depth, matching the codebase's "frontend guards are UX-only, backend is the real boundary" convention from PROJECT.md): `GET /v1/admin/boards` filters the returned list to TEST board(s) only for Free-tier brokerages, AND `POST /v1/admin/board_credentials` independently 403s if a Free-tier brokerage submits a non-test `real_estate_board_id`.
- **D-02:** `ConnectBoardDialog` shows only the TEST board in its select list for Free — no "upgrade to unlock more boards" hint or locked/greyed-out real-board entries in the dialog itself. (Note: a page-level banner is added separately — see D-09.)

### Client-invite rejection (PLAN-05)
- **D-03:** Scope confirmed narrow — this only affects `POST /v1/admin/groups/:group_id/invitations` when `role: "client"` (`Group::InvitationsController#create`). It does NOT affect `Group::UsersController#create` (adding existing brokerage users/agents to a group), since that endpoint only adds users already in the brokerage (`User.for_brokerage` scope) and clients are never brokerage members per `ROLES.md`.
- **D-04:** The "Invite Client" action is hidden entirely from the group UI for Free-tier brokerages — no button shown that then fails on submit.
- **D-05:** Backend reject returns `403` with `{ error: "...", code: "plan_required" }` — same shape as the existing `custom` domain gate in `domains_controller.rb` (Phase 36). Applies regardless of the calling user's role (owner/admin/agent) per ROADMAP success criteria — the block is on the brokerage's plan, not the caller.

### Seats (PLAN-06)
- No cap exists today and none should be added for Free — this requirement is "verify nothing enforces a limit," not new logic. No open questions here.

### Calendar sync scope (PLAN-07)
- **D-06:** `UserCalendarConnection` is scoped to the **user**, not a brokerage — a user can hold memberships at multiple brokerages on different tiers. Gating rule: a user retains full calendar sync access account-wide if **any** of their brokerage memberships is paid (`independent`/`growth`). Only a user whose memberships are **all** Free loses access. (Rejected: gating strictly to "the brokerage currently being viewed" — would require making calendar sync brokerage-context-aware, which `UserCalendarConnection` doesn't support and is out of this phase's scope. Also rejected: gating on a "primary brokerage" concept — doesn't exist elsewhere in the codebase.)
- **D-07:** Calendar-connect API endpoints (Google/Apple connect, in `frontend/src/containers/account/CalendarContext.tsx` → backend calendar controllers) also reject server-side for fully-Free users — not just a UI-level hide. Consistent with D-01/D-05's backend-is-the-boundary pattern.
- **D-08 (supersedes an earlier answer in this same discussion):** The account-level Calendar tab (`CalendarTab.tsx`) stays **visible** for fully-Free users — it is NOT hidden. Instead it renders a banner (see D-09) in place of the connect/provider-card UI, explaining that calendar sync requires a paid plan. This was revised mid-discussion when the user asked for restriction banners across all gated surfaces, which is incompatible with a fully-hidden tab (nothing to put a banner on). The underlying membership-based gating logic in D-06/D-07 is unchanged — only the tab's visibility flipped from hidden to visible-with-banner.

### Upgrade messaging / banners (revisits an initial "no dedicated UI" answer)
- **D-09:** Add an explanatory banner on each of the following surfaces for Free-tier brokerages/users, stating the restriction and that it requires a paid plan:
  1. Board Registrations page (`BoardRegistrations.tsx`) — explains only the TEST board is connectable
  2. Group detail page — explains "Invite Client" isn't available
  3. Domains page — **note:** a "Pro gate" banner already exists here from v1.6 (DUI-09); this is a copy/tier-name update (old binary basic/premium language → free/independent/growth), not new banner UI
  4. Account Calendar tab — explains calendar sync requires a paid plan (replaces the connect UI per D-08, doesn't sit alongside it)
- **D-10:** No banner needed for the seat cap (PLAN-06) — there's no restriction to explain, seats are genuinely unlimited on Free.
- Banner copy/exact placement/component structure (new shared component vs. per-page) is left to planning — the requirement is "a banner explaining the restriction exists on these 4 surfaces," not a specific implementation.

### Claude's Discretion
- Exact banner component structure — a single reusable `FreeTierBanner`-style component vs. bespoke per-page markup. No strong precedent exists (the closest analog, DUI-09's Pro gate, predates the three-tier model).
- Exact wording/copy for each banner — should be clear, human, non-developer-speak per CLAUDE.md's frontend philosophy.
- Whether the calendar membership-check (D-06) is computed via a new backend endpoint/serializer field or derived frontend-side from the existing admin-brokerages list — implementation detail.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plan tiers design
- `.planning/PLAN-TIERS.md` — full tier design rationale, pricing table, Key Decisions, including "Gating a new feature by plan" guidance (backend config-driven, frontend mirrors `RequireRole`/`Can` pattern)
- `.planning/REQUIREMENTS.md` — PLAN-01 through PLAN-19; this phase covers PLAN-04 through PLAN-09, PLAN-12
- `.planning/ROADMAP.md` — Phase 37 success criteria and dependency chain (depends on Phase 36)
- `.planning/ROLES.md` — role definitions; specifically the `client` role section (group-scoped, not a brokerage member, invited only via `Group::InvitationsController`)
- `.planning/phases/36-plan-configuration-tier-migration/36-CONTEXT.md` — prior phase's decisions; flags that frontend plan-selection UI updates (`PlanBadge.tsx`, `PlanCard.tsx`, `createBrokerageWizard.ts`) were deferred here, and that the frontend still sends `basic`/`premium` at signup pending a coordinated deploy (D-08 in that file) — relevant if this phase's UI work touches shared plan-display components

### Existing plan-gated code (pattern to replicate, not duplicate)
- `backend/app/controllers/v1/admin/domains_controller.rb` (lines ~54-59) — `Current.brokerage.plan_config.custom_domain` check with `403` + `code: "plan_required"` response shape; this is the template for the board/client/calendar gates this phase adds
- `backend/app/constants/plan_tiers.rb` — `AppConstants::PLAN_TIERS` config (now with individually-frozen tier structs, fixed post-Phase-36 review) and `Brokerage#plan_config` accessor

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx` — existing board-connect UI; already has a `test-board-info` step with an info-notice pattern (blue box) that could inform new banner styling
- `frontend/src/components/view/account/calendar/CalendarTab.tsx` + `ProviderCard.tsx` — existing calendar UI; `CalendarTab` currently always renders the provider list unconditionally
- `frontend/src/components/common/guards/Can.tsx` + `frontend/src/assets/rbac/permissions.ts` — existing RBAC gating pattern (`RequireRole`/`Can`) that `PLAN-TIERS.md` explicitly says to mirror for plan-based frontend gating
- Existing Pro-gate banner on the Domains page (v1.6, DUI-09) — closest existing analog for the new banners; check its component before building a new one

### Established Patterns
- Backend: `Current.brokerage.plan_config.<capability>` is the established read pattern (Phase 36); this phase adds `real_boards`, `clients`, `calendar_sync` capability checks following the same shape as the existing `custom_domain` check
- Backend 403 shape: `{ error: "...", code: "plan_required" }` (from `domains_controller.rb`) is now the standard for all plan-gated rejections in this phase
- Frontend: mirror `RequireRole`/`Can` — gate UI on a plan-derived permission, not a raw `brokerage.plan === "free"` string comparison (per `PLAN-TIERS.md` "Gating a new feature by plan")

### Integration Points
- `backend/app/controllers/v1/admin/boards_controller.rb` (`RealEstateBoard.active` scope, line 6) — needs plan-aware filtering
- `backend/app/controllers/v1/admin/board_credentials_controller.rb#create` — needs the reject-on-real-board check for Free
- `backend/app/controllers/v1/admin/group/invitations_controller.rb#create` — needs the `role == "client"` + Free reject
- `backend/app/controllers/v1/admin/group/users_controller.rb` — confirmed NOT in scope (adds existing brokerage users only, not clients)
- Calendar backend controllers under `backend/app/controllers/v1/account/` (connect endpoints referenced by `frontend/src/assets/api/account/calendar/`) — need the membership-based reject
- `frontend/src/containers/account/CalendarContext.tsx` — orchestrates calendar state; will need the membership check to decide banner-vs-provider-list rendering
- `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` — banner target
- Group detail page (frontend) — banner target for client-invite restriction
- Domains page — banner copy update target (existing Pro-gate component, not new)

</code_context>

<specifics>
## Specific Ideas

The user's one concrete "I want it like X" moment: after initially agreeing that no dedicated upgrade-prompt UI was needed, the user asked specifically for **banners explaining the restriction** on pages where a Free-tier action is walled off — not a generic "upgrade to unlock" upsell interstitial, but an explanatory note in context. This reversed the initial hide-the-Calendar-tab decision (D-08).

</specifics>

<deferred>
## Deferred Ideas

- None new this discussion — frontend plan-selection UI updates (`PlanBadge.tsx`, `PlanCard.tsx`, `createBrokerageWizard.ts`) were already flagged as deferred-to-Phase-37 territory by 36-CONTEXT.md; confirmed here as in-scope-if-touched by the banner work, but not a separate requirement to chase down proactively unless the banner work needs them.

### Reviewed Todos (not folded)
- "Rethink listing access model — BrokerageEstate vs board credential JOIN" (`arch-brokerage-listing-access.md`) — surfaced again as a phase-37 match (score 0.6, keyword overlap on "board"). Not folded: it's a query-layer scale refactor for board access, orthogonal to which boards/tiers can connect — same call made in Phase 36.

</deferred>

---

*Phase: 37-Free Tier Gating*
*Context gathered: 2026-07-20*
