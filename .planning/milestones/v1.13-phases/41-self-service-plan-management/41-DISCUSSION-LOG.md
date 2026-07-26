# Phase 41: Self-Service Plan Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 41-self-service-plan-management
**Areas discussed:** Downgrade confirmation flow, 3-way selector UI, Upgrade & lateral-change UX, Async job feedback

---

## Downgrade Confirmation Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Single dialog, generic copy | One dialog explaining consequences in general terms (domain frozen, boards/clients suspended, restorable on re-upgrade). Matches Remove Owner's warning-step tone. | ✓ |
| Dialog with live specifics | Fetches and shows actual counts/domain affected before confirming — more reassuring but needs a new preview endpoint. | |

**User's choice:** Single dialog, generic copy.

| Option | Description | Selected |
|--------|-------------|----------|
| Plain Confirm/Cancel buttons | No typed confirmation needed — reversible action, matches Remove Owner pattern. | ✓ |
| Type-to-confirm | Requires typing brokerage name/phrase before enabling — more friction, reserved for true data-loss actions. | |

**User's choice:** Plain Confirm/Cancel buttons.
**Notes:** Reversibility (re-upgrade restores suspended data per Phase 38) was the deciding factor for keeping friction low.

---

## 3-Way Selector UI

| Option | Description | Selected |
|--------|-------------|----------|
| Compact segmented control | Three buttons/tabs in a row, current tier highlighted; price/seat info shown only for selected tier. | ✓ |
| Full price cards (reuse PlanCard) | Reuses onboarding wizard's 3-card layout — more visual weight, more implementation surface. | |

**User's choice:** Compact segmented control.

| Option | Description | Selected |
|--------|-------------|----------|
| Same control, disabled | Identical segmented control for admin/agent, disabled/non-interactive, current tier highlighted. | ✓ |
| Plain text/badge instead | Replace control entirely with a label/Badge for non-owners. | |

**User's choice:** Same control, disabled.
**Notes:** Chosen for visual consistency between owner and non-owner views.

---

## Upgrade & Lateral-Change UX

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate apply, no confirmation | Selecting Independent/Growth from any other tier applies right away. Matches roadmap's literal scope. | ✓ |
| Lightweight confirm for all changes | Every tier change shows a brief acknowledgment confirm, for consistency. | |

**User's choice:** Immediate apply, no confirmation.
**Notes:** Roadmap success criterion 3 only mandates confirmation for downgrades; upgrades stay frictionless.

---

## Async Job Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic update + toast | Show new tier immediately, success toast, no polling — mirrors Ops::PlanController's synchronous-looking response and existing Ownership Management mutation handling. | ✓ |
| Pending/processing state with polling | Show "Applying changes…" spinner, poll brokerage record until job completes. | |

**User's choice:** Optimistic update + toast.

| Option | Description | Selected |
|--------|-------------|----------|
| Invalidate plan query only | Refetch just brokerage/plan data; Domains/Boards refresh independently on next visit. | ✓ |
| Invalidate plan + domains + boards queries | Proactively invalidate related query keys too — broader blast radius, touches other admin sections. | |

**User's choice:** Invalidate plan query only.
**Notes:** Kept scoped to this phase's Plan section; cross-section invalidation deemed out of scope.

---

## Claude's Discretion

- Exact query key names, hook file layout, and component decomposition within the Plan section.
- Whether the new backend endpoint lives under `V1::Admin::Settings::` (sibling to `OwnersController`) or a dedicated `V1::Admin::PlanController`.

## Deferred Ideas

None — discussion stayed within phase scope.
