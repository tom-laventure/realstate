# Phase 35: Remove Owner Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 35-remove-owner-flow
**Areas discussed:** Remove button styling, Self-demotion handling, Role picker UI, Step navigation, Final review step (raised by user)

---

## Remove button styling

| Option | Description | Selected |
|--------|-------------|----------|
| Icon button, destructive on hover | Small icon-only button per row, neutral by default, red on hover | ✓ |
| Text link "Remove" | Plain text button, muted-foreground, destructive-red on hover | |
| Always-visible destructive button | Small outlined destructive-variant button, always visible | |

**User's choice:** Icon button, destructive on hover
**Notes:** Keeps the Current Owners list minimal, consistent with Phase 34's no-avatar/no-badge styling.

---

## Self-demotion handling

| Option | Description | Selected |
|--------|-------------|----------|
| Same flow, extra warning line | Identical modal, Step 1 adds a self-specific warning sentence | ✓ |
| Same flow, no special-casing | Treat self exactly like any other owner row | |
| Same flow + redirect after confirm | Extra warning line AND redirect away from /admin/settings after self-demote | |

**User's choice:** Same flow, extra warning line
**Notes:** No forced redirect after self-demote (D-07 in CONTEXT.md) — but this surfaced a real risk (Redux role state going stale after self-demote) that's flagged for the researcher rather than decided here.

---

## Role picker UI

| Option | Description | Selected |
|--------|-------------|----------|
| Radio group | All 3 options visible at once (shadcn RadioGroup) | ✓ |
| Select dropdown | Compact shadcn Select, consistent with add-agent page | |

**User's choice:** Radio group

---

## Step navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Back button on Step 2/3, Cancel closes entirely | Back returns to previous step; Cancel/X always fully closes and resets | ✓ |
| No back — Cancel only | No way to return to a previous step short of canceling and reopening | |

**User's choice:** Back button on Step 2/3, Cancel closes entirely

---

## Final review step (raised by user, not an original gray area)

User requested an additional confirmation step at the end of both the Remove Owner and Add Owner modals — a final review of the action before it fires.

This directly conflicted with REQUIREMENTS.md's original OWN-07 text ("A single confirm button on Step 2 triggers the API"), and the Add Owner half touches Phase 34 code already marked complete. Both were raised explicitly before proceeding:

**Remove modal — two options presented:**
| Option | Description | Selected |
|--------|-------------|----------|
| Real 3rd step (type name / final Are you sure) | Genuine third step before the API call fires; amends OWN-07 | ✓ (via free text: "a 3rd step where the user reviews one last time the action that is about to take place") |
| Just a stronger Step 2 confirm | Two steps stay, but Step 2's confirm carries more friction; no requirement change | |

**Add Owner modal — two options presented:**
| Option | Description | Selected |
|--------|-------------|----------|
| Defer it — new follow-up phase | Note as a deferred idea; Phase 35 stays Remove-Owner-only | |
| Fold it into Phase 35 now | Add the matching review step to AddOwnerDialog.tsx as part of this phase | ✓ |

**Resulting action:** `.planning/REQUIREMENTS.md` OWN-07 was amended in place (two-step → three-step) and a new requirement OWN-13 was added for the Add Owner review step. `.planning/ROADMAP.md` Phase 35's Goal, Requirements list, and Success Criteria were updated to match. See CONTEXT.md D-02 through D-09.

---

## Claude's Discretion

- Exact wording of the Step 1 self-demotion warning sentence
- Exact wording/layout of the Step 3 (Remove) and new Add Owner review screens
- Single-component-with-step-state vs subcomponents for the multi-step dialogs
- Whether to add a "Step 2 of 3" style step indicator to either modal

## Deferred Ideas

None — the Add Owner review-step idea was explicitly folded into this phase's scope rather than deferred (see "Final review step" above). The one reviewed-but-unfolded todo (`arch-brokerage-listing-access.md`) is unrelated to this phase's domain and was already reviewed identically during Phase 34's discussion.
