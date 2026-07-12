# Phase 33: Backend Owner API & Endpoint Lockdown - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 33-backend-owner-api-endpoint-lockdown
**Areas discussed:** Endpoint lockdown scope, Promote mechanism (Add Owner), List endpoint shape

---

## Endpoint lockdown scope

**Q1: Should Phase 33 close the `users#destroy` gap (any admin can delete an owner's membership, no guard)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — require_owner! + last-owner guard on destroy | Add owner-only guard when target holds role owner, plus reject if target is the last owner | ✓ |
| No — defer to Phase 35 | Leave users#destroy as-is, revisit in the Remove Owner flow phase | |
| Partial — require_owner! only, no last-owner check | Stop non-owners from destroying an owner, skip the last-owner check | |

**User's choice:** Yes — require_owner! + last-owner guard on destroy
**Notes:** Matches the phase goal's explicit citation of CR-02/CR-03; leaving it open would make the new demote endpoint's last-owner guard pointless since destroy would bypass it.

---

**Q2: Should `users#update` reject `role: owner` entirely, in both directions, once the dedicated promote/demote endpoints exist?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — users#update rejects role: owner outright (403) | Even an owner can't set or remove role=owner via the generic endpoint anymore | ✓ |
| No — leave users#update as-is | Keep only the existing owner-only assign-guard | |

**User's choice:** Yes — users#update rejects role: owner outright (403)
**Notes:** Otherwise an owner could demote another owner via the generic endpoint and skip the new endpoint's last-owner check.

---

**Q3: Should the LOCK-01 fix on `InvitationsController#create` be a role-value check (reject "owner" for everyone) rather than upgrading the whole action to require_owner!?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — reject role: owner as a value, keep require_admin! for the action | Admins can still invite agent/admin users; only "owner" as invited role is blocked | ✓ |
| Upgrade the whole create action to require_owner! | Only owners could send any brokerage-level invitation | |

**User's choice:** Yes — reject role: owner as a value, keep require_admin! for the action
**Notes:** Keeps invitations#create's existing purpose (inviting new admin/agent users) intact; owner promotion for existing members is a fully separate concern.

---

## Promote mechanism (Add Owner)

**Q1: Should promoting an existing member to owner be an instant direct role update, with no invitation/acceptance step?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — instant direct role update | Confirming immediately updates BrokerageMembership.role to "owner", no Invitation record | ✓ |
| No — route through the Invitation model | Create an Invitation with role=owner requiring acceptance | |

**User's choice:** Yes — instant direct role update
**Notes:** Matches OWN-05's "previous role fully replaced" wording; mirrors the existing users#update immediate-update pattern.

---

**Q2: Should the promote endpoint validate the target's current role server-side, rather than trusting the frontend eligible-list?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — validate current role server-side | Reject if target's current role isn't admin or agent | ✓ |
| No — trust the target_id, just require caller to be owner | Any target_id gets promoted regardless of current role | |

**User's choice:** Yes — validate current role server-side
**Notes:** Consistent with API-05's explicit "frontend role gates are UX-only" language.

---

## List endpoint shape

**Q1: Should both new list endpoints (owners, eligible) use the unpaginated paginate=false-style convention?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — unpaginated array for both | Plain array response, no Pagy meta, for both endpoints | ✓ |
| Standard Pagy pagination for both | Follow the default admin index pattern with meta.pagination | |

**User's choice:** Yes — unpaginated array for both
**Notes:** Both lists are inherently small and bounded per brokerage.

---

**Q2: Should the eligible-users endpoint support server-side search (?q=), or is client-side filtering sufficient?**

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side search — no ?q= param needed | Frontend dropdown filters the already-fetched full array locally | ✓ (Claude's recommendation, user deferred) |
| Support ?q= server-side, mirroring User.search | Add the same LOWER(...) LIKE search scope as users#index | |

**User's choice:** "whatever you recommend" — went with client-side search, no ?q= param
**Notes:** User explicitly deferred to Claude's recommendation on this one.

---

## Claude's Discretion

- Exact HTTP status code for last-owner rejection (422 vs 403) on demote/destroy
- Route/controller naming for the new owner-management endpoints
- Eligible-users search implementation (client-side, per Claude's recommendation, user-approved)

## Deferred Ideas

None raised during discussion.
