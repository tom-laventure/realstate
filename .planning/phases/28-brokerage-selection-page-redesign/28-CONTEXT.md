# Phase 28: Brokerage Selection Page Redesign - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current narrow centered card panel at `/dashboard` (index route) with a full-width page layout. Each brokerage card surfaces the enriched data delivered by Phase 27: `clientCount`, `memberCount`, and `owners`. Single-brokerage users are auto-redirected to `/dashboard/:id`.

No backend changes. No navbar changes (Phase 29 handles navbar). Frontend-only: `BrokerageSelection.tsx` redesign.

</domain>

<decisions>
## Implementation Decisions

### Card Layout

- **D-01:** Card layout is a single section (no `CardHeader`/`CardContent` split). Structure per card:
  - Row 1: brokerage name (large, bold) + role badge aligned right
  - Row 2: `{clientCount} clients · {memberCount} members` (muted text)
  - Row 3: owner full names comma-separated (e.g., `Alice Smith, Bob Jones`) — omitted entirely when `owners` is empty
- **D-02:** Click anywhere on the card navigates to `/dashboard/:id` (same behavior as current button).
- **D-03:** Use the existing shadcn `Card` component from `@/components/ui/card` and `Badge` from `@/components/ui/badge` for the role badge.

### Owners Display

- **D-04:** All owner full names shown inline, comma-separated: `Alice Smith, Bob Jones, Carol Lee`. No truncation at a fixed count.
- **D-05:** When `owners` is empty (`[]`), the owners row is not rendered — no placeholder text, no dash. Cleaner card with variable height.

### Page Layout

- **D-06:** Responsive grid: 1 column on mobile, 2 columns on `md` breakpoint, 3 columns on `lg` breakpoint. Standard Tailwind `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.
- **D-07:** Content wrapped in a `max-w-7xl` container, centered with horizontal padding (`px-6` or `px-8`). Vertical padding above the grid.
- **D-08:** Page title `Your Brokerages` displayed above the card grid as a heading. A brief subtitle is optional (implementer discretion).

### Single-Brokerage Auto-Redirect

- **D-09:** When `adminBrokerages.length === 1` after the list is loaded (either from Redux store or re-fetched on mount), immediately navigate to `/dashboard/${adminBrokerages[0].id}` with `{ replace: true }`. The user never sees the selection screen.
- **D-10:** The auto-redirect fires in the same `useEffect` or in a derived check after the fetch completes — not as a separate effect. Guard: only redirect when length is exactly 1 and loading is complete.

### Claude's Discretion

- Exact Tailwind spacing tokens for card internal padding, gap between cards, and vertical padding above the grid.
- Whether the role badge uses `shadcn Badge` variant `secondary` or `outline` (either is consistent with the existing codebase).
- Loading state appearance (spinner position/size) — can reuse the current loading UI or update it to match the new full-width layout.
- Whether to extract the brokerage card into a separate `BrokerageCard.tsx` component or keep it inline in `BrokerageSelection.tsx`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DASH-03 (full-width layout), DASH-04 (card fields: name, role badge, client count, member count, owner names)

### Current Component (to be redesigned)
- `frontend/src/containers/portal/BrokerageSelection.tsx` — current implementation; read before rewriting to preserve re-fetch on mount logic and navigation behavior

### Types (from Phase 27)
- `frontend/src/assets/types/adminBrokerageType.ts` — `AdminBrokerage` interface with 6 required fields: `id`, `name`, `role`, `clientCount`, `memberCount`, `owners`

### UI Patterns
- `frontend/src/components/createBrokerage/PlanCard.tsx` — existing shadcn `Card` usage pattern (CardHeader, CardTitle, Badge, Button)
- `frontend/src/components/ui/card.tsx` — shadcn Card component
- `frontend/src/components/ui/badge.tsx` — shadcn Badge component (use for role badge)

### Routing
- `frontend/src/router/portal/portal.tsx` — `/dashboard` index route mounts `BrokerageSelection`; `:brokerageId` route mounts `PortalShell`

### Architecture Constraints
- `CLAUDE.md` §"Frontend Philosophy" — polished UI, intentional spacing, consistent with existing shadcn/Tailwind patterns
- `CLAUDE.md` §"Data Flow" — component → context → hook → API. If a context is added, it must return `{ state, actions }` via `useMemo`
- `CLAUDE.md` §"Key Constraints" — icons: `lucide-react` only; styling: Tailwind only; never call API functions directly in components

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BrokerageSelection.tsx` — keep the re-fetch-on-mount logic (the `useEffect` with `cancelled` flag) and the `isLoading` state; only replace the JSX layout
- `useFetchAdminBrokerages` hook — already in use; returns `{ adminBrokerages: AdminBrokerage[] }`
- `setActiveBrokerage` / `setAdminBrokerages` reducers — already dispatched on selection/fetch; keep as-is
- shadcn `Card`, `Badge` — already installed and used in `PlanCard.tsx`
- `lucide-react` — already installed for icons

### Established Patterns
- `useNavigate` + `navigate('/dashboard/:id')` — existing navigation pattern in `BrokerageSelection.tsx`
- Tailwind responsive grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` — standard project grid pattern
- Role badge: `inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs` — existing pattern in current BrokerageSelection; can switch to shadcn `Badge` instead
- `useAppSelector` + `useAppDispatch` — existing Redux hooks in use in the component

### Integration Points
- **Auto-redirect**: add a check after `adminBrokerages` is populated: if `length === 1`, call `dispatch(setActiveBrokerage(...))` + `navigate(..., { replace: true })` before rendering the grid
- **Phase 29 dependency**: Phase 29 will add a dedicated navbar above this page. Phase 28 must not add a navbar — the layout shell at the `/dashboard` route does not currently inject one for the index route, and Phase 29 handles that.

</code_context>

<specifics>
## Specific Ideas

- The page title should be `Your Brokerages` — conversational, not `Select a Brokerage` (imperative) or `Brokerage Dashboard` (internal jargon).
- Stats line uses a centered dot separator: `12 clients · 5 members` — same pattern already used in the current codebase's muted stat lines.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 28-Brokerage-Selection-Page-Redesign*
*Context gathered: 2026-06-06*
