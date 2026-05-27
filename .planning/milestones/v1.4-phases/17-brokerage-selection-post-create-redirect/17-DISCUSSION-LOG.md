# Phase 17: Brokerage Selection & Post-Create Redirect - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 17-Brokerage Selection & Post-Create Redirect
**Areas discussed:** Brokerage context storage, Selection screen vs. auto-redirect, Post-wizard redirect (ONB-04), Selection screen design

---

## Brokerage context storage

| Option | Description | Selected |
|--------|-------------|----------|
| Redux slice | New `activeBrokerage` slice. Matches existing wizard/tempBrokerage pattern. Survives navigation, resets on hard refresh. | ✓ |
| localStorage | Persist brokerage ID to localStorage. Survives refresh. Needs validation against adminBrokerages list on load. | |
| URL param /dashboard?brokerage=123 | Brokerage ID in URL. Transparent but complex to propagate across portal routes. | |

**User's choice:** Redux slice
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Full AdminBrokerage object { id, name, role } | Stores complete object so Phase 18 nav bar (PORTAL-03) can read name/role without extra API call. | ✓ |
| ID only | Simpler slice, requires lookup for name/role in Phase 18. | |

**User's choice:** Full AdminBrokerage object
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Also in Redux (same slice) | adminBrokerages list stored in same slice. LoginSuccessful writes it, selection screen reads from Redux. | ✓ |
| Re-fetch in selection screen | Selection screen calls fetchAdminBrokerages itself. Simple but adds a second API call. | |

**User's choice:** Also in Redux (same slice)
**Notes:** —

---

## Selection screen vs. auto-redirect

| Option | Description | Selected |
|--------|-------------|----------|
| Selection screen component | BrokerageSelection reads adminBrokerages from Redux. If length===1: auto-dispatch + navigate. If >1: render cards. | ✓ |
| Route-level guard | Wrapper component around /dashboard checks list before rendering children. Adds a layer. | |

**User's choice:** Selection screen component
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| /dashboard (same route) | Stay at /dashboard after selection. Phase 18 adds shell content there. | |
| /dashboard/:brokerageId | Brokerage ID in URL. Bookmarkable, transparent, deep-linkable. | ✓ |

**User's choice:** /dashboard/:brokerageId
**Notes:** User chose URL-based routing despite earlier Redux decision — resolved by using both: URL is canonical, Redux mirrors it. Portal shell reads URL param on mount and dispatches to Redux.

| Option | Description | Selected |
|--------|-------------|----------|
| Redux slice mirrors URL param | Portal shell reads :brokerageId from URL and dispatches to Redux on mount. Axios interceptor reads Redux. Best of both. | ✓ |
| localStorage mirrors URL param | Shell writes brokerage ID to localStorage on mount. Adds another persistence layer. | |

**User's choice:** Redux slice mirrors URL param
**Notes:** —

---

## Post-wizard redirect (ONB-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to /dashboard/:brokerageId on main domain | SuccessStep redirects to https://{mainDomain}/dashboard/{id}. ID from state.result. | ✓ |
| Redirect to /dashboard — let auto-select handle it | Works only if user has 1 brokerage. Doesn't satisfy ONB-04 for multi-brokerage admins. | |
| Redirect with ?select=id URL param | Flexible but adds param-handling complexity to the selection screen. | |

**User's choice:** Redirect to /dashboard/:brokerageId on main domain
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Portal shell validates against Redux list | Fast, no extra API call. Invalid ID redirects to /dashboard. | ✓ |
| Backend validates via X-Brokerage-Id | No frontend check. Worse UX — renders briefly before 403. | |

**User's choice:** Portal shell validates against Redux list
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Portal shell fetches if Redux list is empty | Handles wizard redirect case (no LoginSuccessful path). Loading spinner during fetch. | ✓ |
| Store new brokerage in wizard submit | CreateBrokerageContext.submit() dispatches new brokerage to Redux. Tighter coupling. | |

**User's choice:** Portal shell fetches if Redux list is empty
**Notes:** —

---

## Selection screen design

| Option | Description | Selected |
|--------|-------------|----------|
| Centered column, cards stacked vertically | Same max-w-sm layout as LoginSuccessful/NoAccess. Simple, consistent. | ✓ |
| Centered grid of cards | 2-column grid. Richer but over-engineered for typical 1-4 brokerage admins. | |

**User's choice:** Centered column, cards stacked vertically
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Name + role badge, click card to select | Minimal card. Name prominent, role badge. Click card → navigate to /dashboard/:id. | ✓ |
| Name + role + subdomain + Enter button | More info, explicit button. Heavier UX. | |

**User's choice:** Name + role badge, click card to select
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| "Select a brokerage" with subtitle | Direct, clean heading. "Choose the brokerage you want to manage." | ✓ |
| "Welcome back" with name personalization | Warmer but requires pulling user name from Cognito JWT — added complexity. | |

**User's choice:** "Select a brokerage" with short subtitle
**Notes:** —

---

## Claude's Discretion

None — user made explicit choices in all areas.

## Deferred Ideas

None — discussion stayed within phase scope.
