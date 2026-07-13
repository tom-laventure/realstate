# Phase 35: Remove Owner Flow - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a Remove action to each row in the Current Owners list (`CurrentOwnersList.tsx`, shipped Phase 34) that opens a guided, three-step demote modal, always leaving the brokerage with at least one owner. The backend demote endpoint (`PATCH /v1/admin/settings/owners/:id`) already exists and is fully implemented (Phase 33) — this phase is frontend-only: new dialog component(s), a `useDemoteOwner` hook/API module mirroring the existing `usePromoteOwner`/`promoteOwner` pair, and wiring into `useSettingsAdminContext`/`OwnershipManagementSection`.

Also in scope (added during this discussion, amends OWN-03/OWN-04, tracked as new requirement OWN-13): `AddOwnerDialog.tsx` (Phase 34) gains a matching final review step after its existing inline warning, so both Add Owner and Remove Owner follow the same "warning → decision → final review → confirm" shape.

In scope: OWN-06 (Remove action), OWN-07 (three-step modal — amended from two-step during this discussion), OWN-08 (demote API call + query invalidation), OWN-09 (self-demotion with extra warning), OWN-10 (disabled state + tooltip for last owner), OWN-13 (Add Owner review-step addition).

Out of scope: Billing functionality (stubbed), audit logging / email notifications on role change (v2, OWN-11/OWN-12), any change to the promote API contract or the demote API contract (both already shipped and correct in Phase 33), any change to who can see the Settings page (SET-02 unchanged).

**Note on requirement amendment:** OWN-07 originally specified a two-step modal with a single confirm button on Step 2. During this discussion the user asked for a third, final-review step before the API call fires. `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` Phase 35 entry have both been updated in place to reflect three steps — treat those files, not this note, as the source of truth for exact wording.

</domain>

<decisions>
## Implementation Decisions

### Remove button (OWN-06)
- **D-01:** Icon-only button per owner row (e.g. `UserMinus` or similar from `lucide-react`, per CLAUDE.md icon convention), neutral/muted by default, destructive-red on hover. Keeps `CurrentOwnersList` visually minimal, consistent with Phase 34's D-01/D-02 (no avatars, no badges, no self-indicator).

### Three-step Remove Owner modal (OWN-07, amended)
- **D-02:** Step 1 — warning explaining what removing owner access means, recommending `client` reassignment when the goal is full privilege removal (same intent as the original two-step design).
- **D-03:** Step 2 — role picker as a **radio group** (shadcn `RadioGroup`, not a `Select`), all three options (`admin`/`agent`/`client`) visible at once, defaulting to `admin`. Chosen over a dropdown because the picker is a consequential, deliberate choice worth surfacing fully rather than compressing into a closed dropdown.
- **D-04:** Step 3 — final review screen summarizing the target user (name/email) and the selected new role, with the single confirm button that actually triggers the demote API living on this step (not Step 2).
- **D-05:** Step 2 → Step 3 → confirm has a **Back** button on Step 3 (and, symmetrically, Step 2) to return to the previous step. The dialog's Cancel/X always fully closes the modal and resets it back to Step 1 the next time it's opened — there is no "resume mid-flow" state.

### Self-demotion (OWN-09)
- **D-06:** Self-demotion uses the identical three-step flow — no structurally different path. Step 1's warning copy adds one extra explicit sentence when the target row belongs to the current user (e.g., "You are removing your own owner access — you will immediately lose owner-level permissions."). Detected by comparing the owner row's `id` (backend `user.uid`) against the current user's id.
- **D-07:** No special post-confirm redirect or forced navigation after a successful self-demote — see Code Context below for the real risk this creates and what research must resolve before planning locks an approach.

### Add Owner modal review step (OWN-13, new)
- **D-08:** `AddOwnerDialog.tsx` gets the same "final review" step added after its existing inline warning block (the amber warning shown once a user is selected, lines ~101-110 of the current file). The dropdown-select + warning stays as today's first screen; a new final screen shows the selected user's name/email and the destination role ("owner") before the existing "Confirm Add Owner" button (which still calls `usePromoteOwner`) fires. This is a UI-only addition — `usePromoteOwner`/`promoteOwner.ts` API contract is unchanged.
- **D-09:** Keep Add Owner's overall step count at two screens' worth of content reorganized into the same "decision → review → confirm" shape as Remove Owner, i.e. don't add a redundant third "are you sure" beyond the review screen itself — the review screen IS the final confirmation for both dialogs.

### Claude's Discretion
- Exact wording of the Step 1 self-demotion warning sentence (D-06 fixes the required content, not phrasing).
- Exact wording/layout of the Step 3 (Remove) and new Add Owner review screens.
- Whether Remove Owner's three steps live in one component with internal step state, or three subcomponents — follow whatever keeps `AddOwnerDialog.tsx`'s existing single-component-with-`useState`-step pattern consistent if reused, or introduce a shared step-indicator pattern if that reads cleaner across both dialogs.
- Whether to add a lightweight step indicator (e.g. "Step 2 of 3") to either modal — not required by any locked criterion, purely a polish call at implementation time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap (both amended during this discussion — read the live files, not this summary)
- `.planning/REQUIREMENTS.md` — OWN-06–OWN-10 (Remove Owner), OWN-13 (new, Add Owner review step)
- `.planning/ROADMAP.md` — Phase 35 entry, Success Criteria 1-6 (amended)

### Backend API this phase consumes (shipped in Phase 33 — do not re-implement, do not change contract)
- `backend/app/controllers/v1/admin/settings/owners_controller.rb#update` — `PATCH /v1/admin/settings/owners/:id`, body `{ user: { role: "admin"|"agent"|"client" } }`, response `{id, name, email, role}`. Already implements the last-owner guard (`owner_count <= 1` → 422) which covers OWN-09/OWN-10 server-side — the frontend's disabled-button/tooltip (OWN-10) and self-demotion messaging (OWN-09) are UX layers on top of an already-safe backend, not the only safety net.
- `.planning/phases/33-backend-owner-api-endpoint-lockdown/33-CONTEXT.md` — D-06 (unpaginated lists), D-05 (server re-validates current role)

### Phase 34 code this phase extends
- `.planning/phases/34-ownership-management-ui-settings-page-add-owner/34-CONTEXT.md` — full prior decisions (D-01/D-02 list styling, D-05/D-06/D-07 RolePermissions usage)
- `frontend/src/components/view/admin/settingsAdminView/CurrentOwnersList.tsx` — add the Remove icon button per row here (D-01)
- `frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx` — owns dialog open/close state today for Add Owner; will need equivalent state + a new demote dialog wired in
- `frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx` — gets the new review step (D-08/D-09); existing Command/Popover combobox and amber warning block stay as-is
- `frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts` — the Brain; add demote mutation + demote dialog state here, following the exact `handlePromoteOwner` try/catch pattern for `handleDemoteOwner`

### Existing patterns to follow
- `frontend/src/assets/api/admin/settings/owners/promoteOwner.ts` + `frontend/src/store/hooks/Admin/Settings/Owners/usePromoteOwner.ts` — direct template for the new `demoteOwner.ts` API module + `useDemoteOwner.ts` hook (mutate, invalidate `ownersKeys.all` on success, toast)
- `frontend/src/components/ui/tooltip.tsx` — shadcn Tooltip, needed for OWN-10's disabled-button explanation
- `frontend/src/components/ui/radio-group.tsx` if present, else standard shadcn RadioGroup install — needed for D-03's Step 2 role picker
- `frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx` — destructive-action AlertDialog styling precedent (`bg-destructive text-destructive-foreground hover:bg-destructive/90`) for the Remove button hover state and Step 3's confirm button

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `usePromoteOwner`/`promoteOwner.ts` pair — mirror exactly for demote (same mutation → invalidate → toast shape)
- `AddOwnerDialog.tsx`'s Dialog/step-content structure — reusable scaffold for the Remove Owner dialog's own step state
- Button `destructive` variant (`frontend/src/components/ui/button.tsx`) — already defined, use for Remove icon hover + Step 3 confirm

### Established Patterns
- Query keys centralized in `frontend/src/store/hooks/queryKeys.tsx` (`ownersKeys`) — demote mutation invalidates the same key promote already does, no new key needed
- Data flow: Component → Context (Brain) → TanStack Hook → API module → Axios instance (CLAUDE.md) — `useSettingsAdminContext` is the single Brain for this page; do not call the demote hook directly from a component

### Integration Points
- No new route — Remove Owner lives inside the existing `/admin/settings` page, triggered from `CurrentOwnersList` rows already rendered by `OwnershipManagementSection`
- `manage_ownership` permission (`frontend/src/assets/rbac/permissions.ts`) already gates Add Owner via `<Can permission="manage_ownership">` — reuse the identical guard around the new Remove buttons (OWN-06's "visible to owners only")

### Risk flagged for research (not a locked decision — needs investigation before planning)
- **Self-demotion session staleness:** `useRole()` (`frontend/src/store/hooks/Auth/useRole.ts`) derives the current user's role from Redux (`account.membership?.role ?? activeBrokerage?.role`), which is populated at login/fetch time — not automatically refreshed after a role-mutating API call. If an owner demotes themselves, the backend correctly changes their `BrokerageMembership.role`, but the frontend's own `manage_ownership` permission check may keep evaluating `true` against stale Redux state until a refetch/relogin, meaning the just-demoted owner could still see Add/Remove buttons that will now 403 on click (backend re-validates server-side per API-05, so this is a UX staleness bug, not a security hole). The researcher should identify the existing pattern (if any) for refreshing `account`/`activeBrokerage` role after an in-session role change, or confirm none exists and recommend one (e.g., refetch current user after a successful self-demote) — this directly affects OWN-09's real-world correctness even though D-07 above says no forced redirect is required.

</code_context>

<specifics>
## Specific Ideas

- Remove button: icon (e.g. `UserMinus`), muted by default, red/destructive on hover — matches the minimal row style, no visual clutter until the user intends to act.
- Self-demotion Step 1 gets one added sentence making it unmistakable the user is affecting their own access — not a separate flow, just stronger copy.
- Both Add Owner and Remove Owner end on a final review/summary screen before the mutating API call — this is the core new pattern introduced this phase and retrofitted onto Phase 34's Add Owner dialog.

</specifics>

<deferred>
## Deferred Ideas

None beyond what's now folded into OWN-13 above — the Add Owner review-step request was explicitly pulled into this phase's scope rather than deferred, per the user's choice during discussion.

### Reviewed Todos (not folded)
- `arch-brokerage-listing-access.md` ("Rethink listing access model — BrokerageEstate vs board credential JOIN") — same low-relevance keyword match (`listing`, `access`) surfaced and already rejected during Phase 34's discussion; still unrelated to ownership management. Not folded.

</deferred>

---

*Phase: 35-remove-owner-flow*
*Context gathered: 2026-07-13*
