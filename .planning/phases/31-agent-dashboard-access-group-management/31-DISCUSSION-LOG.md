# Phase 31: Agent Dashboard Access & Group Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 31-Agent Dashboard Access & Group Management
**Areas discussed:** Main-domain portal access, Admin nav exposure sequencing, First-time agent experience, Group management scope

---

## Main-domain portal access

| Option | Description | Selected |
|--------|-------------|----------|
| Include main-domain portal | Update `V1::Account::AdminBrokeragesController#index` to include `agent` in its role filter alongside admin/owner. Agents signing in from the main domain reach `/dashboard` like any other admin role. | ✓ |
| Subdomain-only for this phase | Leave `AdminBrokeragesController` untouched. Agents signing in on the main domain still hit `/no-access`; only subdomain admin access opens. | |

**User's choice:** Include main-domain portal (Recommended option)
**Notes:** Scouting found this endpoint (`V1::Account`, not `V1::Admin`) was not touched by Phase 30's RBAC work — a net-new backend change for this phase.

---

## Admin nav exposure sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Groups-only nav for now | Agent's Admin nav section shows only "Groups" in Phase 31. Other links appear in Phase 32 once read-only gating exists. | ✓ |
| Full nav immediately | Agent sees the same Admin nav as admin/owner right away; other pages render full write UI that will 403 on submit until Phase 32 ships. | |

**User's choice:** Groups-only nav for now (Recommended option)
**Notes:** Applies to both subdomain `SideNav.tsx` (currently ungated once `canAccessAdmin` is true) and main-domain `PortalAdminSideNav.tsx` (currently has zero permission gating at all — needs new agent-aware filtering).

---

## First-time agent experience

| Option | Description | Selected |
|--------|-------------|----------|
| Identical to admin/owner | Same `ListingGroupAdminBoard`, same empty state, same "Create Group" CTA, same copy — no agent-specific branching. | ✓ |
| Tailor something for agents | Different empty-state copy, welcome tooltip, or restricted default view. | |

**User's choice:** Identical to admin/owner (Recommended option)
**Notes:** None.

---

## Group management scope

| Option | Description | Selected |
|--------|-------------|----------|
| Brokerage-wide, same as admin/owner | `GroupQuery` is already brokerage-scoped with no membership filter for admin/owner; agent gets identical visibility. | ✓ |
| Restrict to agent's own groups | Agent only sees/manages groups they're a member of; requires new membership-based filtering in `GroupQuery`. | |

**User's choice:** Brokerage-wide, same as admin/owner (Recommended option)
**Notes:** Confirmed via `backend/app/queries/group_query.rb` and `V1::Admin::GroupsController#index` — no filtering logic exists today, none needed.

---

## Claude's Discretion

- Exact mechanism for scoping `PortalAdminSideNav.tsx` to Groups-only for agent (inline filtering vs. per-item permission map).
- Exact mechanism for narrowing subdomain `SideNav.tsx`'s Admin section to Groups-only for agent.
- Whether `AdminBrokeragesController`'s naming/response shape needs adjustment now that `agent` is included — cosmetic, not a user decision.

## Deferred Ideas

None — discussion stayed within phase scope. Read-only access (ACCESS-02–06), blocking brokerage-level invitations (ACCESS-07), and domain-mutation button gating (ACCESS-08) are already scoped to Phase 32 in ROADMAP.md, not raised as new ideas here.
