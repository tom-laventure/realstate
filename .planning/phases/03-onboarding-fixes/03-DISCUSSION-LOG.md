# Phase 3: Onboarding Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 3-Onboarding Fixes
**Areas discussed:** Domain wizard (ONB-01), Invite redirect (ONB-02), Welcome banner (ONB-03)

---

## Domain Wizard (ONB-01)

### Q1: After brokerage creation, where should "Go to dashboard" take the owner?

| Option | Description | Selected |
|--------|-------------|----------|
| window.location.href to subdomain | Full page redirect to https://{subdomain}.realstate.ca/ — crosses domain boundary | ✓ |
| navigate('/') same domain | Stay on realstate.ca — wrong, onboarding is on root domain | |
| Show URL, let owner click | Display link manually, no auto-redirect | |

**User's choice:** window.location.href to subdomain
**Notes:** None.

### Q2: How should server-side errors (e.g., 409 conflict) surface in the wizard?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline form error on subdomain field | Parse server message, set as SubdomainInput error | ✓ |
| Toast only (current) | Generic "Failed to create brokerage" toast | |
| Toast + inline error | Both signals for the same error | |

**User's choice:** Inline form error on subdomain field
**Notes:** None.

### Q3: For Premium users, DNS verification UX scope

| Option | Description | Selected |
|--------|-------------|----------|
| SuccessStep only | Enhance SuccessStep with DNS instructions + manual verify button + status. Admin dashboard DNS page deferred. | ✓ |
| SuccessStep + Admin DNS page | Both wizard enhancement and admin domain management page in Phase 3 | |
| Skip DNS verification | Static DNS text only, no verify button | |

**User's choice:** SuccessStep only
**Notes:** User explicitly requested a "Check DNS status" button with manual (not polling) verification, a status indicator showing verified/pending, and a "Go to subdomain" fallback. Also asked about effort level for admin DNS page — deferred to backlog.

### Q4: After DNS verification confirmed, what happens?

| Option | Description | Selected |
|--------|-------------|----------|
| Verified badge + offer redirect | Green badge + two CTA buttons: custom domain and subdomain | ✓ |
| Auto-redirect to custom domain | Immediately navigate to custom domain on verification | |
| Verified badge only | Show status, leave existing link unchanged | |

**User's choice:** Show verified badge + offer redirect (two CTA buttons)
**Notes:** None.

---

## Invite Redirect (ONB-02)

### Q1: For brokerage-level invitations (no group), where to navigate after accept?

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to / (brokerage dashboard root) | Most logical starting point for new member | ✓ |
| Navigate to /welcome | Dedicated getting-started page — new component needed | |
| You decide | | |

**User's choice:** Navigate to brokerage dashboard root (/)
**Notes:** None.

### Q2: Unauthenticated user auth flow in JoinBrokerage

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve token in URL through auth | JoinBrokerage renders CreateAccount inline; token stays in URL param — no sessionStorage needed | ✓ |
| Redirect back to invite URL after login | Store URL in sessionStorage, restore post-login | |
| You decide | | |

**User's choice:** Preserve token in URL through auth
**Notes:** Confirmed the existing JoinBrokerage architecture handles this correctly; only the post-accept navigate needs fixing.

### Q3: After accepting a group invitation, which route?

| Option | Description | Selected |
|--------|-------------|----------|
| /{groupUid} — group dashboard | Navigate to /{group.uid} matching /:groupId route | ✓ |
| / — brokerage root | Safer but less direct | |
| You decide | | |

**User's choice:** /{groupUid} — the group dashboard
**Notes:** None.

---

## Welcome Banner (ONB-03)

### Q1: Where to persist "banner dismissed"?

| Option | Description | Selected |
|--------|-------------|----------|
| DB column on BrokerageMembership | welcomed_at datetime column — server-authoritative, cross-device | ✓ |
| localStorage | No backend changes, but resets on cache clear | |
| You decide | | |

**User's choice:** DB column on BrokerageMembership (welcomed_at)
**Notes:** None.

### Q2: What group information in the banner?

| Option | Description | Selected |
|--------|-------------|----------|
| Group names as pill list | Fetch from GET /v1/account/groups; show names as chips | ✓ |
| Group count only | "You've been added to 3 groups" — lighter | |
| No group info | Brokerage name only | |

**User's choice:** Group names as a list (pill chips)
**Notes:** If no groups yet, show "You haven't been added to any groups yet".

### Q3: Banner placement in the dashboard?

| Option | Description | Selected |
|--------|-------------|----------|
| Top of main content, below nav | Dismissible with X. Optimistic dismiss. | ✓ |
| Modal / dialog | Blocks interaction — higher visibility, more disruptive | |
| Sticky bottom bar | Less intrusive but easy to miss | |

**User's choice:** Top of main dashboard content
**Notes:** X button dismisses immediately (optimistic); PATCH fires in background.

---

## Claude's Discretion

- Backend endpoint design for `dismiss_welcome` — either extend `PATCH /v1/account/profile` with `{ welcomed: true }` or add dedicated `POST /v1/account/profile/dismiss_welcome`; planner picks lower-friction option.
- Whether to remove or suppress the existing generic `onError` toast in `useCreateBrokerage` — inline error is the primary signal, toast suppression is an implementation detail.

## Deferred Ideas

- **Brokerage Admin DNS configuration page** — Admin panel for domain management and verification status. Explicitly out of Phase 3 scope. Goes to roadmap backlog.
