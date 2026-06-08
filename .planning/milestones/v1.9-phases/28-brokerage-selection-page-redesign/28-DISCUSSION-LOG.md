# Phase 28: Brokerage Selection Page Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 28-brokerage-selection-page-redesign
**Areas discussed:** Card stats layout, Owners display, Page grid layout, Single-brokerage redirect

---

## Card Stats Layout

### Question 1: How should the three stats appear on the card?

| Option | Description | Selected |
|--------|-------------|----------|
| Stat row | Horizontal row below header: `12 clients · 5 members` + owners row | ✓ |
| Stat chips | Three separate badge chips per stat | |
| Two-section card | Divider + 3-column stat grid with numbers and labels | |

**User's choice:** Stat row  
**Notes:** Clean, scannable format. Stats and owners displayed as plain text rows below the name/role header.

### Question 2: Where should stats sit relative to other elements?

| Option | Description | Selected |
|--------|-------------|----------|
| Below role badge, same section | Name top, role badge inline/right, stats below | ✓ |
| CardHeader + CardContent split | Name/role in CardHeader, stats in CardContent | |

**User's choice:** Below role badge, same section  
**Notes:** Single-section card without shadcn structural split. Click anywhere on card to navigate.

---

## Owners Display

### Question 1: How to display multiple owners?

| Option | Description | Selected |
|--------|-------------|----------|
| All full names inline | Comma-separated: `Alice Smith, Bob Jones, Carol Lee` | ✓ |
| Cap at 2 + overflow | `Alice Smith, Bob Jones +2 more` | |
| You decide | Implementer picks | |

**User's choice:** All full names inline  
**Notes:** No truncation at a fixed count — show all names.

### Question 2: What to show when owners is empty?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide the owners line entirely | Don't render the owners row at all | ✓ |
| Show a dash or placeholder | Render `Owners: —` or `No owners listed` | |

**User's choice:** Hide the owners line entirely  
**Notes:** Cleaner card with no empty label when there are no owners.

---

## Page Grid Layout

### Question 1: How should cards be arranged?

| Option | Description | Selected |
|--------|-------------|----------|
| Responsive grid | 1 col mobile, 2 cols md, 3 cols lg | ✓ |
| Single full-width column | Cards stack vertically one per row | |

**User's choice:** Responsive grid  
**Notes:** Standard Tailwind `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.

### Question 2: Max-width cap and page title?

| Option | Description | Selected |
|--------|-------------|----------|
| max-w-7xl cap + page title | `Your Brokerages` heading, content capped at 1280px | ✓ |
| Truly full-width, no title | No max-width, no title | |
| You decide | Implementer picks | |

**User's choice:** max-w-7xl cap + page title  
**Notes:** Page title is `Your Brokerages`. Brief subtitle optional at implementer discretion.

---

## Single-Brokerage Redirect

### Question 1: Auto-redirect for single-brokerage users?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — auto-redirect | Navigate to `/dashboard/:id` when length === 1 after load | ✓ |
| No — always show selection page | Single-brokerage users still see the page | |

**User's choice:** Yes — auto-redirect  
**Notes:** Auto-redirect fires after load completes. Guard: only when `length === 1` and loading is complete. Navigate with `{ replace: true }`.

---

## Claude's Discretion

- Exact Tailwind spacing tokens for card padding and grid gaps
- Role badge variant (`secondary` or `outline`)
- Loading state appearance for the full-width layout
- Whether to extract brokerage card into a separate `BrokerageCard.tsx` component

## Deferred Ideas

None — discussion stayed within phase scope.
