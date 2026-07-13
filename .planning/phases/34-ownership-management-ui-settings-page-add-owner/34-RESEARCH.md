# Phase 34: Ownership Management UI — Settings Page & Add Owner - Research

**Researched:** 2026-07-13
**Domain:** React/TypeScript admin UI (RBAC-gated settings page, searchable-dropdown modal, TanStack Query mutation flow) on top of an already-shipped Rails API
**Confidence:** HIGH

## Summary

This phase is a pure frontend build on top of a backend that already exists and is already merged (Phase 33). All four backend endpoints (`GET /v1/admin/settings/owners`, `GET /v1/admin/settings/owners/eligible`, `POST /v1/admin/settings/owners`, `PATCH /v1/admin/settings/owners/:id`) are live, tested, and enforce owner-only writes server-side via `require_owner!`. Nothing in this phase touches Ruby code except possibly reading it for contract confirmation — every task is TypeScript/TSX.

The codebase has three directly-reusable patterns that map almost one-to-one onto this phase's requirements: `AddUserToGroupView`'s Command/Popover combobox (for OWN-03's searchable dropdown), `BoardRegistrations.tsx`'s Card+CardHeader section shell combined with `DeleteDomainDialog.tsx`'s AlertDialog warning-before-confirm shell (for OWN-04's Add Owner confirmation), and the existing `Component → Context → TanStack Hook → API module → Axios` four-layer data flow used identically across every other admin domain (Boards, Domains, Users). No new libraries, no new architectural patterns — this is an assembly job following established conventions.

**Primary recommendation:** Build one new admin domain slice — `Admin/Settings/Owners` — following the exact `Boards`/`Domains` file-layout template (api modules → TanStack hooks → queryKeys entries → context hook → view components → board container), gate the Add Owner action with a new `manage_ownership` permission added to `permissions.ts`, and reuse `RolePermissions` verbatim for the read-only admin/agent audience per D-05/D-06/D-07.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Owner list rendering (OWN-01) | Frontend Server (SPA component tier) | API / Backend | List data is fetched read-only from `GET /admin/settings/owners`; rendering/formatting is pure client-side |
| Owner-only action gating (SET-02, OWN-02) | Frontend Server (SPA component tier) | API / Backend | UX-layer gate via `Can`/`useRole` is required for a good client experience, but per API-05 (already shipped) the backend `require_owner!` is the actual enforcement boundary — frontend gating is cosmetic only |
| Eligible-user search/filter (OWN-03) | Frontend Server (SPA component tier) | — | Per Phase 33 D-07, filtering is client-side over the full unpaginated `/eligible` response — no backend search param exists or is needed |
| Promote-to-owner mutation (OWN-05) | API / Backend | Frontend Server | Backend performs the actual role mutation + re-validation (D-05); frontend only triggers the call and invalidates its query cache |
| Route-level access control (client exclusion) | Frontend Server (SPA component tier) | — | Already implemented via `RequireRole` on the `/admin/settings` route — no new work required this phase |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SET-01 | `/admin/settings` renders with Ownership Management as first functional section, Billing as invisible `# TODO` | `SettingsAdminBoard.tsx` replacement pattern documented below; `# TODO` must be a code comment, not rendered JSX |
| SET-02 | Owners: full access; admin/agent: read-only; clients: no access | Route guard already exists (`readTierRoles` wraps `SettingsAdminBoard`); new `manage_ownership` permission + `Can`/`RolePermissions` split documented below |
| OWN-01 | Current Owners list: name + email, no avatars/timestamps | `GET /admin/settings/owners` contract confirmed; stacked-list pattern documented below |
| OWN-02 | Add Owner button visible to owners only | `Can permission="manage_ownership"` pattern documented below |
| OWN-03 | Modal with searchable dropdown (admin/agent only), role shown, note copy | `AddUserToGroupView` Command/Popover combobox is a direct analog; `GET /admin/settings/owners/eligible` contract confirmed |
| OWN-04 | Warning copy before confirm, covering 3 required points (D-04) | `DeleteDomainDialog`/`BoardRegistrations` AlertDialog pattern documented; copy requirements enumerated below |
| OWN-05 | Confirm calls promote API, replaces role, refetches owners list | `POST /admin/settings/owners` contract confirmed; TanStack mutation + `invalidateQueries` pattern documented below |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

- **D-01:** Current Owners list renders as a simple stacked list — plain rows (name + email) divided by subtle borders, not a table and not cards.
- **D-02:** No self-indicator. All owner rows render identically — do not add a "You" badge or any marker distinguishing the viewing owner's own entry.
- **D-03:** Do NOT reuse `RolePermissions`' generic "owner" description verbatim for the Add Owner warning. Write expanded, ownership-specific copy instead.
- **D-04:** The expanded warning must cover all three of: (1) the promoted user will be able to remove or demote other owners, (2) they gain full access to all brokerage data and settings (not just their current admin/agent scope), and (3) a forward-looking mention that owners will eventually manage billing too, even though that section is stubbed/invisible this milestone. Exact wording is Claude's discretion.
- **D-05:** Reuse the existing `RolePermissions` component (`frontend/src/components/view/admin/common/RolePermissions.tsx`) to satisfy the "role descriptions" requirement — do not build a new, ownership-specific description block.
- **D-06:** Pass `roles={['owner', 'admin', 'agent']}` — exclude `client` from the displayed set.
- **D-07:** The `RolePermissions` block is shown ONLY to admin/agent viewers. Owners do NOT see it — they get the full action UI instead.
- **D-08:** Ownership Management gets its own card/section header on `/admin/settings`, consistent with how Brokerage/Boards/Domains admin pages present content in labeled sections. Leaves a natural slot for Billing to slide in later.

### Claude's Discretion

- Exact wording of the expanded Add Owner warning copy (D-04 fixes the three required points, not the phrasing).
- Whether the owner-only gate on Add Owner (OWN-02) is implemented via a new `Permission` value (e.g. `manage_ownership`) added to `frontend/src/assets/rbac/permissions.ts` and gated with the existing `<Can>` component, or via a direct `role === 'owner'` check through `useRole()`.
- Loading/error/empty states for the owners list and eligible-list queries (standard project conventions apply).
- Exact component/file naming for the new Ownership Management section, following `frontend/src/containers/{domain}/{pageName}/` and `frontend/src/components/view/admin/{domain}/` conventions already established.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Remove Owner (OWN-06–OWN-10), Billing functionality, and audit logging/email notifications are explicitly out of scope for Phase 34 (Remove Owner ships in Phase 35).

</user_constraints>

## Project Constraints (from CLAUDE.md)

- Data flow MUST follow `Component → Context (Brain) → TanStack Hook → API module → Axios instance`. `src/containers/{name}Context` orchestrates state/network and returns `{ state, actions }` memoized with `useMemo`.
- UI components in `src/components/` must be pure and use **shadcn/ui only**. Icons: `lucide-react` only.
- Never call axios or API functions directly inside a component — always go through a hook.
- Define domain interfaces in `assets/types/` before creating hooks or contexts — never define them locally.
- Query keys must be centralized in `frontend/src/store/hooks/queryKeys.tsx`, not inlined.
- The global Axios interceptor already applies `camelcaseKeys(response.data, { deep: true })` — never call `camelcaseKeys` again in hooks; return `response.data` directly from API modules.
- Frontend Philosophy (non-negotiable): polished loading/empty/error states, deliberate transitions, clear hierarchy, accessible (semantic HTML, visible focus rings), human-quality copy.
- Backend: soft deletes via `acts_as_paranoid` — N/A this phase (no new backend queries), but `owners_controller.rb` already correctly scopes `BrokerageMembership.without_deleted`.
- Backend: imperative authorization via `Current.user`/`Current.brokerage` — already implemented in `owners_controller.rb`.

## Standard Stack

No new libraries are required for this phase. All UI primitives, data-fetching, and RBAC infrastructure already exist in the codebase and are actively used by directly analogous features.

### Core (existing, reused)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | (already installed) | Data fetching, caching, mutation + invalidation | Used by every existing Admin hook (`useFetchBoardCredentials`, `useCreateBoardCredential`, etc.) |
| `cmdk` (via shadcn `Command`) | (already installed) | Searchable combobox filtering | Powers `AddUserToGroupView`'s existing searchable dropdown — direct precedent for OWN-03 |
| `@radix-ui/react-dialog` / `@radix-ui/react-alert-dialog` (via shadcn `Dialog`/`AlertDialog`) | (already installed) | Add Owner modal + warning-before-confirm | `ConnectBoardDialog.tsx` (Dialog) and `DeleteDomainDialog.tsx` (AlertDialog) are both established precedents |
| `react-hot-toast` | (already installed) | Success/error toasts on mutation | Used in every existing mutation hook (e.g. `useCreateBoardCredential`) |
| `lucide-react` | (already installed) | Icons | Project-wide standard, no exceptions |

### Supporting
None — no new supporting libraries needed.

### Alternatives Considered
Not applicable — this phase deliberately reuses existing infrastructure per CLAUDE.md's "Consistency over novelty" directive and D-05's explicit instruction not to build new description components.

**Installation:**
No installation required — zero new dependencies for this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs no new packages (backend or frontend). All required UI primitives and data-fetching infrastructure are already present in `package.json` and actively used elsewhere in the codebase (confirmed via direct reads of `AddUserToGroupView.tsx`, `BoardRegistrations.tsx`, `ConnectBoardDialog.tsx`, `useCreateBoardCredential.ts`). The Package Legitimacy Gate protocol is skipped for this phase.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  /admin/settings  (route already guarded: readTierRoles → owner/    │
│                     admin/agent only; client redirected by          │
│                     RequireRole before this tree ever mounts)       │
└───────────────────────────────┬───────────────────────────────────┘
                                 │
                    SettingsAdminBoard.tsx (container)
                                 │
                useOwnershipAdminContext() ── Context (Brain)
                    │                    │
        ┌───────────┴──────┐   ┌─────────┴──────────┐
        │ useFetchOwners()  │   │ useFetchEligible-  │
        │ (TanStack useQuery)│   │  Users()           │
        └───────────┬──────┘   └─────────┬──────────┘
                    │                    │
          fetchOwners()        fetchEligibleOwnerUsers()
          (API module)          (API module)
                    │                    │
                    └─────────┬──────────┘
                          Axios instance
                    (auto camelcaseKeys, JWT header)
                               │
              GET /v1/admin/settings/owners
              GET /v1/admin/settings/owners/eligible
                               │
                    Rails: Admin::Settings::OwnersController
              (require_agent_or_above! → index/eligible readable
               by owner/admin/agent; require_owner! → create/update
               owner-only, enforced server-side — API-05)
                               │
                        BrokerageMembership
                     (scoped .without_deleted,
                      role: "owner" | %w[admin agent])

── Add Owner flow (owner-only branch) ──────────────────────────────
  <Can permission="manage_ownership">
    "Add Owner" Button → AddOwnerDialog (Dialog)
      1. Command/Popover searchable dropdown over eligible users
         (client-side filter, per Phase 33 D-07 — no backend ?q= param)
      2. Warning copy (D-04: 3 required points)
      3. Confirm → usePromoteOwner() mutation
           → POST /v1/admin/settings/owners  { user: { user_id } }
           → onSuccess: queryClient.invalidateQueries(ownerKeys.all)
                         + toast.success(...)
── Read-only flow (admin/agent branch) ─────────────────────────────
  <Can permission="manage_ownership" fallback={<RolePermissions
        roles={['owner','admin','agent']} />}>
    (Add Owner UI hidden; description card shown instead — D-07)
```

### Recommended Project Structure
```
frontend/src/
├── assets/
│   ├── types/
│   │   └── ownerType.ts                          # OwnerType, EligibleOwnerUserType
│   ├── api/admin/settings/owners/
│   │   ├── fetchOwners.ts                         # GET /v1/admin/settings/owners
│   │   ├── fetchEligibleOwnerUsers.ts              # GET /v1/admin/settings/owners/eligible
│   │   └── promoteOwner.ts                         # POST /v1/admin/settings/owners
├── store/hooks/Admin/Settings/Owners/
│   ├── useFetchOwners.ts
│   ├── useFetchEligibleOwnerUsers.ts
│   └── usePromoteOwner.ts
├── store/hooks/queryKeys.tsx                       # add ownersKeys, eligibleOwnerUsersKeys
├── assets/rbac/permissions.ts                       # add 'manage_ownership' Permission
├── containers/adminBoard/settingsAdminBoard/
│   ├── SettingsAdminBoard.tsx                       # replace stub — renders OwnershipManagementSection
│   └── useSettingsAdminContext.ts                   # or useOwnershipAdminContext.ts — Context/Brain
├── components/view/admin/settingsAdminView/          # new domain folder (mirrors domainsAdminView/)
│   ├── OwnershipManagementSection.tsx                # Card+CardHeader shell (D-08), owner-only branch vs read-only branch (D-07)
│   ├── CurrentOwnersList.tsx                         # stacked list, name+email (D-01/D-02)
│   └── AddOwnerDialog.tsx                            # searchable dropdown + warning + confirm (OWN-03/OWN-04/OWN-05)
```

### Pattern 1: Card+CardHeader labeled section shell (D-08)
**What:** Wrap each settings sub-feature in its own `Card` with a `CardHeader`/`CardTitle`, matching how `BoardRegistrations.tsx` labels "Realtor Board Registrations" as its own section.
**When to use:** For the Ownership Management section on `/admin/settings`, so Billing can slot in below without restructuring.
**Example:**
```tsx
// Source: frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx (existing pattern)
<Card className="mt-6">
    <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-semibold">Ownership Management</CardTitle>
        <Can permission="manage_ownership">
            <Button size="sm" onClick={() => setIsAddOwnerOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Owner
            </Button>
        </Can>
    </CardHeader>
    <CardContent>
        {/* CurrentOwnersList always renders; RolePermissions only for read-only audience */}
    </CardContent>
</Card>
{/* # TODO: Add billing management section */}
```

### Pattern 2: Searchable combobox over an unpaginated list (OWN-03)
**What:** `Popover` + `Command`/`CommandInput`/`CommandItem` combo, client-side filtered.
**When to use:** Add Owner's eligible-user picker. This is the exact structure already proven in `AddUserToGroupView.tsx`.
**Example:**
```tsx
// Source: frontend/src/components/view/admin/listingGroupsAdminView/addUserToGroupView/AddUserToGroupView.tsx
<Popover open={comboOpen} onOpenChange={setComboOpen}>
    <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={comboOpen} className="w-full justify-between font-normal">
            {selectedUser ? `${selectedUser.name} — ${selectedUser.role}` : 'Search admins and agents...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
    </PopoverTrigger>
    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
            <CommandInput placeholder="Search by name..." />
            <CommandList>
                <CommandEmpty>No eligible users found.</CommandEmpty>
                <CommandGroup>
                    {eligibleUsers.map((u) => (
                        <CommandItem key={u.id} value={`${u.name}`} onSelect={() => handleSelect(u.id)}>
                            <Check className={cn('mr-2 h-4 w-4', selectedUser?.id === u.id ? 'opacity-100' : 'opacity-0')} />
                            <span className="truncate">{u.name}<span className="ml-1 text-muted-foreground">({u.role})</span></span>
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </Command>
    </PopoverContent>
</Popover>
<p className="text-sm text-muted-foreground mt-2">Only admins and agents can be promoted to owner.</p>
```
Note: OWN-03's exact copy requirement — "Only admins and agents can be promoted to owner." — must appear beneath the dropdown verbatim per REQUIREMENTS.md.

### Pattern 3: Warning-before-confirm modal (OWN-04/OWN-05)
**What:** `Dialog` (not `AlertDialog`, since this modal contains an interactive form element — the combobox — not just static warning text; `AlertDialog` is reserved in this codebase for pure confirm/cancel with no other interactive controls, per `DeleteDomainDialog`/`BoardRegistrations`'s delete-credential flow). Requirements text explicitly allows either (Dialog/AlertDialog) — Dialog is the better fit here because of the embedded combobox.
**When to use:** Add Owner modal.
**Example:**
```tsx
// Source: frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx (Dialog step pattern)
//         frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx (warning copy structure)
<Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogContent className="sm:max-w-md">
        <DialogHeader>
            <DialogTitle>Add Owner</DialogTitle>
            <DialogDescription>Promote an existing admin or agent to owner.</DialogDescription>
        </DialogHeader>
        {/* combobox + "Only admins and agents..." note from Pattern 2 */}
        {selectedUser && (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 p-4 text-amber-900 text-sm space-y-2">
                <p className="font-semibold">This will give {selectedUser.name} full owner access:</p>
                <ul className="list-disc pl-4 space-y-1">
                    <li>They will be able to remove or demote other owners, including you.</li>
                    <li>They will gain full access to all brokerage data and settings — not just their current {selectedUser.role} scope.</li>
                    <li>They will also manage billing once that section becomes available.</li>
                </ul>
            </div>
        )}
        <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={!selectedUser || isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Add Owner
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
```

### Pattern 4: Mutation with query invalidation (OWN-05)
**What:** `useMutation` + `queryClient.invalidateQueries` + toast, mirroring `useCreateBoardCredential.ts` exactly.
**Example:**
```tsx
// Source: frontend/src/store/hooks/Admin/Boards/useCreateBoardCredential.ts (existing pattern)
const usePromoteOwner = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (userId: string) => promoteOwner(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ownersKeys.all })
            toast.success('Owner added successfully')
        }
    })
}
```

### Anti-Patterns to Avoid
- **Comparing `role === 'owner'` directly in components:** ROLES.md explicitly warns against this — "Avoid comparing `role` strings directly in components — that bypasses the permission map and makes the mapping harder to audit." Prefer adding `manage_ownership` to `permissions.ts` + `<Can>` (see Open Questions for the tradeoff either way — this is Claude's Discretion per CONTEXT.md, but the codebase's own documented convention leans permission-based).
- **Trusting the frontend `/eligible` list as the source of truth:** The backend already re-validates (`Phase 33 D-05`) — do not skip loading states or optimistic-update the owners list without waiting for the mutation response, since a stale eligible list could reference a user whose role changed concurrently.
- **Building a new role-description component:** D-05 explicitly forbids this — reuse `RolePermissions`.
- **Rendering the Billing stub as JSX (even hidden/disabled):** SET-01 requires a `# TODO` *code comment*, not a rendered (even if visually hidden) UI element.
- **Backend `AlertDialog` misuse:** Do not use `AlertDialog` for the Add Owner modal if it needs to contain the interactive combobox — Radix's `AlertDialog` is designed for non-dismissible pure-confirmation content; embedding complex interactive form controls inside it is non-standard usage in this codebase (every existing `AlertDialog` here — `DeleteDomainDialog`, `BoardRegistrations`'s delete flow — contains only static text + Cancel/Confirm).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Searchable user picker | Custom filtered `<input>` + manual list filtering | `Command`/`CommandInput`/`CommandItem` (cmdk via shadcn) | Already handles keyboard nav, empty state, ARIA — `AddUserToGroupView` proves it works for this exact "pick a user from a list" use case |
| Role-description text | New "OwnershipRoleInfo" component | `RolePermissions` (existing) | D-05 explicit instruction; also avoids drift between two role-description sources |
| Permission gating | Inline `role === 'owner'` checks scattered through JSX | `Permission` union + `ROLE_PERMISSIONS` map + `<Can>` | ROLES.md's own documented convention; keeps the permission surface auditable in one file |
| Query cache invalidation | Manual refetch calls or local state sync after mutation | `queryClient.invalidateQueries({ queryKey: ownersKeys.all })` | Standard TanStack pattern already used in every existing Admin mutation hook |

**Key insight:** Every piece of UI infrastructure this phase needs already exists in the codebase in a directly-analogous form. The risk in this phase isn't missing library knowledge — it's deviating from established file-layout and permission-model conventions under time pressure. Treat `Boards`/`Domains` as the two closest full-featured templates to copy structurally.

## Common Pitfalls

### Pitfall 1: Forgetting the eligible-list re-fetch race after promotion
**What goes wrong:** After promoting a user to owner, if the eligible-users query isn't also invalidated, a user who was just promoted could still appear in a stale "eligible" dropdown if the Add Owner dialog is reopened without a page refresh.
**Why it happens:** OWN-05 only explicitly requires invalidating the *owners* query key; it's easy to forget the eligible-users query also needs invalidation since the promoted user should disappear from that list (their role is no longer admin/agent).
**How to avoid:** In `usePromoteOwner`'s `onSuccess`, invalidate both `ownersKeys.all` and the eligible-users query key.
**Warning signs:** QA finds a just-promoted owner still selectable in a second Add Owner attempt.

### Pitfall 2: `RolePermissions` role list drift
**What goes wrong:** Passing the default `roles` prop (all four roles including `client`) instead of the required `['owner', 'admin', 'agent']` (D-06).
**Why it happens:** `RolePermissions`'s default prop value is `['client', 'agent', 'admin', 'owner']` — easy to forget to override it since it "just works" without an explicit prop.
**How to avoid:** Always pass `roles={['owner', 'admin', 'agent']}` explicitly at the call site; do not rely on the default.
**Warning signs:** Client role description card appears on a page clients can never reach.

### Pitfall 3: Gating on `manage_ownership` without adding it to `ROLE_PERMISSIONS` for `owner` only
**What goes wrong:** If the new permission is accidentally added to `admin`'s permission array too (copy-paste from an adjacent permission), admins would see the Add Owner button despite SET-02's read-only requirement.
**Why it happens:** `permissions.ts`'s `ROLE_PERMISSIONS` map has `admin` inheriting most of `owner`'s permissions already (`manage_brokerage_settings` is the one exception) — easy to over-generalize.
**How to avoid:** `manage_ownership` must appear ONLY in `owner`'s array, mirroring how `manage_brokerage_settings` is owner-exclusive today.
**Warning signs:** Admin-role QA account sees an "Add Owner" button.

### Pitfall 4: Trusting frontend-only enforcement
**What goes wrong:** Assuming the `<Can>` gate is sufficient security and skipping verification that the backend still rejects non-owner calls.
**Why it happens:** The backend enforcement (API-05, `require_owner!`) already shipped in Phase 33 and is easy to forget about since this phase's tasks are all frontend.
**How to avoid:** No new backend work needed, but plan verification steps should include one negative-path check (e.g., confirm an admin-role JWT still gets 403 from `POST /admin/settings/owners`, even though the button doesn't render) to close the loop per LOCK-01/LOCK-02 precedent.
**Warning signs:** N/A for this phase's build — this is a verification-step reminder, not a build risk, since backend already enforces this.

### Pitfall 5: `# TODO` Billing stub rendering as visible text
**What goes wrong:** Writing something like `{/* TODO: billing */}` is fine, but writing a disabled-looking `<Card>Billing (coming soon)</Card>` violates SET-01's "not rendered as user-facing UI" requirement.
**Why it happens:** It's tempting to show users a visual placeholder for discoverability.
**How to avoid:** SET-01 is explicit — literal code comment (`# TODO: Add billing management section`, mirroring the Ruby-style comment example given in REQUIREMENTS.md, adapted to `// TODO:` for TSX), zero rendered output.
**Warning signs:** Any Billing-related string appears in the rendered DOM.

## Code Examples

### Owners list fetch (API module)
```tsx
// Follows: frontend/src/assets/api/admin/boards/fetchBoardCredentials.ts
import axiosInstance from '@/assets/axios/axios'
import { OwnerType } from '@/assets/types/ownerType'

export interface FetchOwnersResponse {
    owners: OwnerType[]
}

const fetchOwners = async (): Promise<FetchOwnersResponse> => {
    const response = await axiosInstance.get('/v1/admin/settings/owners')
    return response.data
}

export default fetchOwners
```
Backend response shape confirmed from `owners_controller.rb#index`: `{ owners: [{ id, name, email }] }` — the interceptor camelCases automatically (already flat/camelCase-safe keys, no transformation needed beyond the default).

### Eligible users fetch
```tsx
// GET /v1/admin/settings/owners/eligible
// Backend response: { eligible_users: [{ id, name, email, role }] } → camelCased to { eligibleUsers: [...] }
export interface FetchEligibleOwnerUsersResponse {
    eligibleUsers: EligibleOwnerUserType[]  // role: 'admin' | 'agent'
}
```

### Promote mutation (API module)
```tsx
// POST /v1/admin/settings/owners  body: { user: { user_id: <uid> } }
// Backend response: { id, name, email } (the newly promoted owner)
const promoteOwner = async (userId: string): Promise<OwnerType> => {
    const response = await axiosInstance.post('/v1/admin/settings/owners', { user: { user_id: userId } })
    return response.data
}
```

## State of the Art

Not applicable — this is an internal feature build with no external framework version drift concerns. All dependencies are already pinned and in active use elsewhere in the codebase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Backend response field for promote mutation's confirmation payload is `{ id, name, email }` without a `role` key (unlike `update`'s response, which includes `role`) | Code Examples | Low — TypeScript type would need a minor adjustment; verified directly from `owners_controller.rb` source, so actually `[VERIFIED: codebase]`, not truly assumed. Listed here for completeness only. |
| A2 | `Dialog` (not `AlertDialog`) is the better primitive for Add Owner given the embedded combobox, based on codebase convention rather than an explicit rule in REQUIREMENTS.md (which allows either) | Pattern 3 | Low — purely a component-choice preference; either satisfies OWN-03's literal requirement text. If the planner/executor prefers `AlertDialog` with the combobox embedded via `asChild`-style composition, that also technically satisfies REQUIREMENTS.md's "Dialog/AlertDialog" wording. |

**All other claims in this research are `[VERIFIED: codebase]`** — every controller endpoint, response shape, route path, component, hook, and permission-map entry cited was read directly from the repository during this research session, not drawn from training-data assumptions.

## Open Questions

1. **Permission-based gate (`manage_ownership`) vs. direct `useRole()` check for Add Owner visibility**
   - What we know: CONTEXT.md explicitly leaves this to Claude's discretion. ROLES.md's own documented convention discourages direct role-string comparison in components ("Avoid comparing `role` strings directly in components — that bypasses the permission map").
   - What's unclear: Whether the planner should treat ROLES.md's stated convention as effectively locking this decision despite CONTEXT.md calling it discretionary.
   - Recommendation: Add `manage_ownership` to `Permission` union + `ROLE_PERMISSIONS['owner']` only, then gate with `<Can permission="manage_ownership">`. This matches the codebase's own documented best practice and keeps a single audit point (`permissions.ts`) rather than introducing a second gating mechanism.

2. **Exact TSX comment syntax for the Billing stub**
   - What we know: REQUIREMENTS.md's example comment (`# TODO: Add billing management section`) uses Ruby-style `#` syntax, but this is a `.tsx` file.
   - What's unclear: Whether the `#` prefix is meant literally (unlikely — it's not valid outside a string in TSX) or just illustrative of "a TODO comment with this text."
   - Recommendation: Use `// TODO: Add billing management section` (standard JS/TS comment syntax) placed where the Billing section would eventually render, preserving the required text content.

## Environment Availability

Not applicable — this phase has no external tool/service dependencies beyond the already-running Rails/Vite dev stack, which prior phases (30–33) have already confirmed functional.

## Validation Architecture

Skipped — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.

## Security Domain

`security_enforcement` is not present in `.planning/config.json`, so per the default-enabled rule this section is included. However, the actual security-sensitive work (server-side owner-only enforcement, last-owner guard, role re-validation) was already implemented and is out of scope for Phase 34 — it shipped in Phase 33 (API-01 through API-05, LOCK-01, LOCK-02, all marked Complete in REQUIREMENTS.md traceability).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Unchanged — Cognito JWT handling untouched this phase |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes (verification only) | Server-side `require_owner!`/`require_agent_or_above!` already enforced (Phase 33); this phase's frontend gates (`<Can>`, `RequireRole`) are UX-layer only, not the security boundary — must not be mistaken for one |
| V5 Input Validation | Yes (verification only) | Backend already validates target role server-side (D-05, "never trust that the frontend only submits IDs from the /eligible endpoint's response") — no new input-handling code needed this phase beyond passing the selected `user_id` through |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Client-side-only enforcement bypass (an admin-role user crafting a direct `POST /v1/admin/settings/owners` request despite no visible button) | Elevation of Privilege | Already mitigated server-side via `require_owner!` (Phase 33) — this phase's plan should include a verification task confirming this still holds, not new mitigation code |
| Stale `/eligible` list used to promote a user whose role changed between fetch and submit (TOCTOU) | Tampering | Already mitigated server-side via D-05's re-validation of `membership.role` at promote time — frontend should still surface a clear error toast if the backend rejects due to `422 Only admins and agents can be promoted to owner` |

## Sources

### Primary (HIGH confidence — direct codebase reads, this session)
- `backend/app/controllers/v1/admin/settings/owners_controller.rb` — endpoint contracts, response shapes, server-side validation
- `backend/config/routes.rb` — confirmed route paths (`GET /owners`, `GET /owners/eligible`, `POST /owners`, `PATCH /owners/:id`)
- `backend/app/controllers/v1/admin/base_controller.rb` — `require_agent_or_above!`/`require_owner!` enforcement mechanics
- `frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx` — current stub to replace
- `frontend/src/components/view/admin/listingGroupsAdminView/addUserToGroupView/AddUserToGroupView.tsx` — Command/Popover combobox precedent
- `frontend/src/components/view/admin/common/RolePermissions.tsx` — reusable role-description component, confirmed default `roles` prop
- `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` — Card+CardHeader labeled-section pattern, `Can`-gated action button
- `frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx` — AlertDialog warning-before-confirm pattern
- `frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx` — Dialog multi-step modal pattern with combobox-adjacent Select
- `frontend/src/assets/rbac/permissions.ts`, `frontend/src/components/common/guards/Can.tsx`, `frontend/src/components/common/guards/RequireRole.tsx`, `frontend/src/store/hooks/Auth/useRole.ts`, `frontend/src/store/hooks/Auth/usePermission.ts` — full RBAC primitive chain
- `frontend/src/store/hooks/queryKeys.tsx` — query key centralization convention
- `frontend/src/store/hooks/Admin/Boards/{useFetchBoardCredentials,useCreateBoardCredential}.ts`, `frontend/src/assets/api/admin/boards/fetchBoardCredentials.ts` — TanStack hook + API module + mutation/invalidation template
- `frontend/src/containers/adminBoard/boardsAdminBoard/{BoardsAdminBoard.tsx,useBoardsAdminContext.ts}`, `frontend/src/containers/adminBoard/domainsAdminBoard/{DomainsAdminBoard.tsx,useDomainsAdminContext.ts}` — Context ("Brain") pattern templates
- `frontend/src/router/admin/admin.tsx` — confirmed `/admin/settings` already wired to `readTierRoles(<SettingsAdminBoard />)`, no new route needed
- `frontend/src/assets/types/{roleType,userType,membershipType}.ts` — existing type shapes
- `.planning/ROLES.md` — role-gating conventions and documented anti-pattern warning
- `.planning/phases/33-backend-owner-api-endpoint-lockdown/33-CONTEXT.md` (via CONTEXT.md canonical refs) — D-04 through D-07 backend decisions this phase depends on

### Secondary (MEDIUM confidence)
None required — this phase needed no external documentation lookups; it is entirely an internal-codebase-pattern-matching exercise.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all infrastructure directly confirmed via source reads
- Architecture: HIGH — every pattern cited was read from an existing, working, analogous feature in this exact codebase
- Pitfalls: HIGH — derived directly from explicit CONTEXT.md decisions (D-04, D-05, D-06) and codebase conventions (ROLES.md), not speculative

**Research date:** 2026-07-13
**Valid until:** No external expiry — internal codebase research remains valid until the referenced files change. Re-verify if Phase 33's backend contract changes before Phase 34 execution begins.
