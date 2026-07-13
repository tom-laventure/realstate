# Phase 34: Ownership Management UI — Settings Page & Add Owner - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 34-ownership-management-ui-settings-page-add-owner
**Areas discussed:** Current Owners list style, Add Owner warning copy, Read-only view for admin/agent, Settings page shell

---

## Current Owners list style

| Option | Description | Selected |
|--------|-------------|----------|
| Simple stacked list | Plain rows, name + email, subtle borders | ✓ |
| Table rows | Formal table with Name / Email columns | |
| Cards | One card per owner, like BrokerageCard | |

**User's choice:** Simple stacked list

| Option | Description | Selected |
|--------|-------------|----------|
| Mark "You" | Small badge next to the caller's own row | |
| No self-indicator | All owner rows render identically | ✓ |

**User's choice:** No self-indicator
**Notes:** All owner entries look the same regardless of who's viewing.

---

## Add Owner warning copy

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse RolePermissions' description as-is | "Full access to all brokerage settings and data." | |
| Expand with ownership-specific consequences | New, longer copy spelling out concrete owner powers | ✓ |
| Short custom warning, no role description | Brief one-line caution | |

**User's choice:** Expand with ownership-specific consequences

| Option | Description | Selected |
|--------|-------------|----------|
| Can remove or demote other owners | Most consequential power | ✓ |
| Full access to all brokerage data and settings | Broader framing across all admin sections | ✓ |
| Mention future billing access | Forward-looking, even though stubbed this milestone | ✓ |

**User's choice:** All three (multiSelect)
**Notes:** Exact phrasing left to implementation; all three points must appear in the warning copy.

---

## Read-only view for admin/agent

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, reuse RolePermissions | Same component used on add-agent page | ✓ |
| New, ownership-specific description block | Custom explainer for this page's context | |

**User's choice:** Yes, reuse RolePermissions

| Option | Description | Selected |
|--------|-------------|----------|
| Owner, Admin, Agent only | Matches who can actually view this page | ✓ |
| All four roles (including Client) | Full reference, matches AddAgentView default | |

**User's choice:** Owner, Admin, Agent only

| Option | Description | Selected |
|--------|-------------|----------|
| Admin/agent only | Owners get the action UI instead | ✓ |
| Show to everyone | Owners see both actions and descriptions | |

**User's choice:** Admin/agent only
**Notes:** The RolePermissions block is exclusively for the read-only audience; owners never see it.

---

## Settings page shell

| Option | Description | Selected |
|--------|-------------|----------|
| Own card/section header | Labeled "Ownership Management" section, consistent with other admin pages | ✓ |
| Fill the page directly | No section chrome, page IS the content | |

**User's choice:** Own card/section header
**Notes:** Leaves a natural slot for Billing to slide in later without restructuring.

---

## Claude's Discretion

- Exact wording of the expanded Add Owner warning copy (the three required points are fixed; phrasing is not).
- Whether the owner-only gate is implemented via a new `Permission` value in `permissions.ts` + `<Can>`, or a direct `role === 'owner'` check via `useRole()`.
- Loading/error/empty states for owners-list and eligible-list queries (standard project conventions).
- Exact component/file naming for the new Ownership Management section.

## Deferred Ideas

None raised during this discussion — stayed within phase scope.

One pending todo (`arch-brokerage-listing-access.md`) was flagged by the automated cross-reference as a weak keyword match ("access", "brokerage") but is about listing/board access architecture, unrelated to ownership management UI. Not folded in; noted in CONTEXT.md's Reviewed Todos.
