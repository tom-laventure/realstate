# Phase 21: Frontend — Redirect Guard & Domains Admin Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 21-frontend-redirect-guard-and-domains-admin
**Areas discussed:** Redirect guard UX, Domains page structure, Inline edit & validation, Slot management UI

---

## Redirect Guard UX

### When should the guard fire?

| Option | Description | Selected |
|--------|-------------|----------|
| Only on subdomains, before auth | Runs immediately on app load for any non-main-domain URL. isMainDomain() check already exists. | ✓ |
| Only on subdomains, after auth resolves | Waits until Cognito session confirmed. Adds latency and complicates guard logic. | |
| On all domains | Main domain has no brokerage domain to check — wasted API call. | |

**User's choice:** Only on subdomains, before auth

---

### Loading state while lookup is in-flight?

| Option | Description | Selected |
|--------|-------------|----------|
| Blank white screen | Simplest. Lookup is fast (single DB read). Avoids flashing app UI before redirect. | ✓ |
| Full-page loading spinner | More polish, but introduces a new spinner component for a sub-200ms call. | |
| Render normally, then redirect | User briefly sees page before redirect — jarring UX. | |

**User's choice:** Blank white screen

---

### If lookup fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Fail open — render app normally | Don't block the user. Failed lookup = can't confirm redirect needed. | ✓ |
| Fail closed — show error page | Too aggressive for a UX-layer guard. | |

**User's choice:** Fail open

---

### Where in the component tree?

| Option | Description | Selected |
|--------|-------------|----------|
| New PrimaryDomainRedirect wrapping SubdomainOnly children | Placed inside SubdomainOnly block in main.tsx. Clean isolation. | ✓ |
| Inside SubdomainOnly guard itself | Couples redirect logic to domain type guard. Harder to test. | |
| useEffect in main.jsx at root | Runs on all domains unless manually guarded. Wrong hierarchy. | |

**User's choice:** New PrimaryDomainRedirect component wrapping SubdomainOnly children

---

## Domains Page Structure

### Page organization?

| Option | Description | Selected |
|--------|-------------|----------|
| Two named sections: Subdomain + Custom Domain | Each section has heading, action button, card list. Pro gate is section-scoped. | ✓ |
| Flat card list sorted by type | All domains in one list. Less clear separation for Pro gate. | |

**User's choice:** Two named sections

---

### Status information display?

| Option | Description | Selected |
|--------|-------------|----------|
| Badges in card header + countdown in card footer | Type badge + status badge in header. Phasing-out countdown in footer text. | ✓ |
| Badges only, countdown in tooltip | Not discoverable on touch devices. | |
| Status-colored card border | Relies on color alone — not accessible. | |

**User's choice:** Badges inline on the card header + countdown in card footer

---

### Action button placement?

| Option | Description | Selected |
|--------|-------------|----------|
| Button row at bottom of each card | Always visible. Consistent with other admin board cards. | ✓ |
| Overflow/kebab menu | Hides actions. Less discoverable. | |

**User's choice:** Button row at bottom of each card

---

## Inline Edit & Validation

### How does the edit form appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Card expands / toggles into edit mode in place | Clicking Edit replaces card content with inline form. Matches DUI-04 wording. | ✓ |
| Slide-out panel (Sheet) | More space but heavyweight for single-field edit. | |
| Modal dialog | Excessive for a single-field form. | |

**User's choice:** Card expands / toggles into edit mode in place

---

### Subdomain input design?

| Option | Description | Selected |
|--------|-------------|----------|
| Slug-only input with static suffix | Input accepts slug only; '.realstate.app' appended visually. Same as SubdomainInput.tsx. | ✓ |
| Full domain input | User types entire subdomain — error-prone. | |

**User's choice:** Slug-only input with static suffix

---

### When/where are validation errors shown?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline below input, on-change | Error text appears as user types. Save disabled while invalid. | ✓ |
| On submit only, inline below input | User won't know about reserved-word errors until Save. | |
| Toast notification on submit | Not a good pattern for form field validation. | |

**User's choice:** Inline below the input, on-change

---

## Slot Management UI

### DUI-06 warning display (1 slot left)?

| Option | Description | Selected |
|--------|-------------|----------|
| Yellow inline banner below Subdomains section header | Appears after mutation returns phase_out_warning. Stays until page refresh. | ✓ |
| Toast notification only | Disappears — user could miss it. | |
| Inline warning badge on most-recent phasing-out card | Less clear it's section-scoped. | |

**User's choice:** Yellow inline banner below the Subdomains section header

---

### DUI-07 blocked state (0 slots)?

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled button + inline message + collapsed 'Free a slot?' accordion | Red banner + accordion listing phasing-out domains with Remove now buttons. | ✓ |
| Disabled button + tooltip only | Too minimal; DUI-07 explicitly requires surfacing force-remove. | |
| Red alert banner with inline Remove now buttons (always expanded) | More vertical space even when user doesn't want to act. | |

**User's choice:** Disabled button + inline message + collapsed 'Free a slot?' accordion

---

### Remove now confirmation dialog content (DUI-09)?

| Option | Description | Selected |
|--------|-------------|----------|
| Destructive dialog with explicit domain name + immediate effect warning | Title: 'Remove [domain]?', body with irreversibility warning, red confirm button. | ✓ |
| Simple 'Are you sure?' dialog | Too vague for an irreversible operation. | |

**User's choice:** Destructive dialog with explicit domain name + immediate effect warning

---

## Claude's Discretion

All options were decided by the user. No areas left to Claude's discretion.

## Deferred Ideas

- DNS verification flow for custom domains — deferred to v1.6
- Server-side 301 redirect at Caddy layer — deferred to v1.6 (client-side redirect sufficient for v1.5)
