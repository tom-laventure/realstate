# Phase 37: Free Tier Gating - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 37-Free Tier Gating
**Areas discussed:** Board-connect gating, Client-invite rejection, Calendar sync scope, Upgrade-prompt pattern

---

## Board-connect gating

| Option | Description | Selected |
|--------|-------------|----------|
| Both: filter list + reject create | GET filters TEST-only for Free, POST also 403s if bypassed | ✓ |
| Filter list only | GET filters; POST trusts the UI | |
| Reject at create only | GET returns everything; POST 403s | |

**User's choice:** Both — filter list + reject create
**Notes:** Matches the codebase convention that backend is the real security boundary, frontend is UX-only.

| Option | Description | Selected |
|--------|-------------|----------|
| Show TEST board only, no upgrade hint | Free-tier dialog just shows the TEST board like it's the only option | ✓ |
| Show real boards greyed out with lock icon + upgrade CTA | More aggressive upsell, new locked-item UI state | |

**User's choice:** Show TEST board only, no upgrade hint
**Notes:** Matches PLAN-TIERS.md framing of Free as a full demo experience, not a deliberately frustrating paywall.

---

## Client-invite rejection

| Option | Description | Selected |
|--------|-------------|----------|
| Hide the action entirely | No "Invite Client" button shown on Free | ✓ |
| Show it, fail on submit with upgrade message | Button shown, fails on submit | |

**User's choice:** Hide the action entirely

| Option | Description | Selected |
|--------|-------------|----------|
| 403 with plan_required code | Matches domains_controller.rb precedent from Phase 36 | ✓ |
| 422 unprocessable_entity | Validation-failure framing instead | |

**User's choice:** 403 with plan_required code
**Notes:** Scope confirmed narrow during discussion — only `Group::InvitationsController#create` with `role: "client"`; `Group::UsersController#create` (adding existing brokerage users) is unaffected since clients are never brokerage members.

---

## Calendar sync scope

| Option | Description | Selected |
|--------|-------------|----------|
| Gate off brokerage memberships, any paid membership keeps access | User keeps calendar sync if ANY brokerage membership is paid | ✓ |
| Gate strictly on the brokerage currently being viewed | Requires brokerage-context-aware sync, out of scope | |
| Gate on primary/first brokerage only | Arbitrary, no "primary brokerage" concept exists | |

**User's choice:** Gate off brokerage memberships, any paid membership keeps access
**Notes:** Discovered during discussion that `UserCalendarConnection` is user-scoped, not brokerage-scoped — this was not previously flagged as a decision point.

| Option | Description | Selected |
|--------|-------------|----------|
| Backend rejects too | API-level reject for fully-Free users, consistent with board/client | ✓ |
| UI-only gate | Just hide the tab, no backend enforcement | |

**User's choice:** Backend rejects too

---

## Upgrade-prompt pattern

| Option | Description | Selected |
|--------|-------------|----------|
| No dedicated upgrade-prompt UI this phase | Gated features hidden/absent, no upsell interstitial | ✓ (initial answer) |
| Still want a subtle one-line note somewhere | Low-key mention, not per-feature interstitials | |

**User's choice (initial):** No dedicated upgrade-prompt UI
**Notes:** This was **reopened** at the "Done" checkpoint — see below.

**User's free-text reopening:** "I would like to include banners for free tier members on the pages with restricted actions for the free tier explaining the restriction"

| Option | Description | Selected |
|--------|-------------|----------|
| Board Registrations page | Explains TEST-only board restriction | ✓ |
| Group detail page (client invites) | Explains client-invite restriction | ✓ |
| Domains page | Existing Pro-gate banner (v1.6, DUI-09) — copy update, not new UI | ✓ |
| Account Calendar tab | Flagged as likely non-applicable since the tab was to be hidden entirely | ✓ |

**User's choice:** All four pages

**Follow-up conflict resolved:** Selecting "Account Calendar tab" for a banner directly conflicted with the earlier decision to hide the tab entirely for fully-Free users (nothing to banner if there's no tab).

| Option | Description | Selected |
|--------|-------------|----------|
| Keep tab visible, show banner instead of hiding it | Reverses the earlier hide decision | ✓ |
| Keep tab hidden; banner goes elsewhere in Account settings | Tab stays hidden, general account-level note instead | |

**User's choice:** Keep tab visible, show banner instead of hiding it
**Notes:** This formally supersedes the Calendar sync scope area's tab-visibility answer. The membership-based gating logic (who gets sync access) is unchanged — only the tab's visibility flipped from "hidden for fully-Free" to "visible with a banner for fully-Free."

---

## Claude's Discretion

- Exact banner component structure (shared reusable component vs. bespoke per page)
- Exact banner copy/wording
- Whether the calendar membership-check is a new backend field or derived frontend-side from existing data

## Deferred Ideas

- Frontend plan-selection UI updates (`PlanBadge.tsx`, `PlanCard.tsx`, `createBrokerageWizard.ts`) — previously flagged by 36-CONTEXT.md as likely Phase 37 territory; confirmed in-scope only if the banner work touches them, not chased proactively as a separate requirement.
- "Rethink listing access model — BrokerageEstate vs board credential JOIN" (todo, reviewed not folded) — query-layer scale refactor, orthogonal to plan-tier gating.
