# Phase 32: Agent Read-Only Access & Access Gating - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 32-Agent Read-Only Access & Access Gating
**Areas discussed:** Add User dropdown visibility, ACCESS-08 fix scope, Nav expansion

---

## Add User dropdown visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Show "Add User to Group" | Hide only "Add Admin to Brokerage"; keep "Add User to Group" visible since it maps to `manage_groups`, which agent already has | ✓ |
| Hide both | Entire "Add User" dropdown disappears for agent on the Users page | |

**User's choice:** Show "Add User to Group" (recommended option)
**Notes:** Consequence captured as D-02 in CONTEXT.md — `/admin/users/add-to-group` route must move to the agent-accessible tier too, since the visible dropdown item would otherwise 403/redirect.

---

## ACCESS-08 fix scope

| Option | Description | Selected |
|--------|-------------|----------|
| Both buttons | Move "Verify now" and "Upgrade plan" from `access_admin_panel` to `manage_brokerage_settings` | ✓ |
| Only "Verify now" | Leave "Upgrade plan" on `access_admin_panel` since it's just a navigation link, not a data mutation | |

**User's choice:** Both buttons (recommended option)
**Notes:** Rationale: ACCESS-05 says agent gets "no mutation actions" on Domains at all — even though the backend technically permits the verify call, showing a button that re-triggers DNS verification reads as a mutation control regardless of the button's backend permissiveness.

---

## Nav expansion

| Option | Description | Selected |
|--------|-------------|----------|
| Expand to full nav | Agent sees all 6 Admin sections (Brokerage, Boards, Users, Groups, Domains, Settings) | ✓ |
| Keep Groups-only nav | Agent keeps minimal nav, reaches new read-only pages only via direct URL | |

**User's choice:** Expand to full nav (recommended option)
**Notes:** Matches Phase 31 D-03's explicit rationale ("Phase 32 will expand the nav... once read-only views exist"). Consequence: `isGroupsOnlyRole`/`isGroupsOnlyAdmin` become dead code and should be deleted (D-06).

---

## Claude's Discretion

- Exact mechanism for splitting `admin.tsx`'s route gating into read-tier vs write-only-tier (e.g. two named role-list constants replacing the single `ownerAdminOnly` helper).
- Whether to keep `ownerAdminOnly` as a name for the write-only tier or rename it.
- Exact prop/component wiring for how `MemberAdminBoard.tsx` gates the `onRemoveUserFromGroup` callback passed to `MemberGroupsList` based on `manage_users`.
- `InvitationsView.tsx`'s "Revoke invitation" button was identified during scouting as having the same zero-gating issue as the Users list controls, not explicitly asked about — gated the same way (`manage_users`) for consistency; noted in CONTEXT.md as a scouting finding, not a separate question.

## Deferred Ideas

None — discussion stayed within phase scope.
