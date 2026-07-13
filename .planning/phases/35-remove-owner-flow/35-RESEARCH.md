# Phase 35: Remove Owner Flow - Research

**Researched:** 2026-07-13
**Domain:** React/TypeScript frontend — multi-step Dialog UX, TanStack Query mutation, Redux session-state staleness
**Confidence:** HIGH

## Summary

This phase is frontend-only. The backend demote endpoint (`PATCH /v1/admin/settings/owners/:id`) was read directly and confirmed correct: it re-validates the target is currently an `owner`, validates the new role against an allowlist (`admin`/`agent`/`client`), and enforces the last-owner guard via a live `COUNT` query before any write — this single guard covers both OWN-09 (self-demotion) and OWN-10 (last-owner block) server-side. No backend changes are needed or should be proposed.

The codebase already contains an exact precedent for everything this phase needs to build: `AddDomainWizard.tsx` is a complete, working multi-step `Dialog` with `useState<number>` step state, a `StepDots` indicator, `goNext`/`goBack` helpers, and full state reset on close — this is the convention to reuse for both the new `RemoveOwnerDialog` and the amended `AddOwnerDialog`, rather than inventing a new step-management pattern. `usePromoteOwner.ts`/`promoteOwner.ts` is an equally exact precedent for the new `useDemoteOwner.ts`/`demoteOwner.ts` pair. `tooltip.tsx` exists and has two real usage precedents (`DomainCard.tsx`, `DomainCardList.tsx`) showing the `TooltipProvider`-wraps-the-list convention. `radio-group.tsx` does **not** exist and must be created — see Package Legitimacy Audit below (already installed as part of this research session).

The single substantive risk in this phase is real and was fully traced: on the main-domain "portal" path (`PortalAdminShell` → `PortalNavBar`), `useGetCurrentUser` is **never called anywhere in the render tree**, so Redux `state.account.id` remains the empty-string `initialState` value for the entire session. Self-demotion detection (`owner.id === currentUserId`) as specified in D-06 will silently and permanently fail to detect self-demotion for every owner who reaches `/admin/settings` via the main-domain/portal path — this is not a staleness edge case, it is a total failure of the feature on that path. The fix is straightforward and is detailed in Common Pitfalls and Code Examples below.

**Primary recommendation:** Build `RemoveOwnerDialog.tsx` as a new component that copies `AddDomainWizard.tsx`'s step-state/`StepDots` scaffold (3 steps, not 4); create `demoteOwner.ts`/`useDemoteOwner.ts` as direct mirrors of `promoteOwner.ts`/`usePromoteOwner.ts`; call `useGetCurrentUser()` unconditionally inside `useSettingsAdminContext` so `account.id` is reliably populated regardless of which shell rendered the page; and on a successful self-demote, synchronously patch both `account.membership.role` and `activeBrokerage.role` in Redux from the mutation response (no extra network round-trip) so `usePermission('manage_ownership')` reflects the change immediately instead of waiting for a future refetch.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Remove action button + visibility gate | Browser/Client | — | Pure UI + `Can` guard (RBAC UX-only per API-05) |
| Three-step Remove Owner dialog (steps 1-3) | Browser/Client | — | Local component state, no server round-trip until Step 3 confirm |
| Role picker (RadioGroup) | Browser/Client | — | Controlled form input, three fixed options |
| Self-demotion detection | Browser/Client | — | Compares `owner.id` (from API) to `account.id` (Redux) — pure client comparison |
| Last-owner disabled state + tooltip | Browser/Client | API/Backend | Client renders `owners.length <= 1` disabled state (UX); backend `owner_count <= 1` 422 is the real gate (already shipped, Phase 33) |
| Demote API call | API/Backend | Browser/Client | `PATCH /v1/admin/settings/owners/:id` already implemented (Phase 33); client only calls it |
| Post-self-demote session refresh | Browser/Client | — | Redux (`account`, `activeBrokerage` slices) patch — no backend involvement |
| Add Owner review step | Browser/Client | — | UI-only addition; `usePromoteOwner`/`promoteOwner.ts` contract unchanged |

## Project Constraints (from CLAUDE.md)

- Data flow is strictly `Component → Context (Brain) → TanStack Hook → API module → Axios instance`. Neither `RemoveOwnerDialog` nor `AddOwnerDialog` may call `useDemoteOwner`/`usePromoteOwner` directly — both must go through `useSettingsAdminContext`'s `handleDemoteOwner`/`handlePromoteOwner` actions, matching the existing `handlePromoteOwner` pattern.
- Icons: `lucide-react` only. `UserMinus` confirmed present in the installed `lucide-react@0.555.0` (`node_modules/lucide-react/dist/esm/icons/user-minus.js`) — safe to use for the Remove button (D-01).
- Styling: Tailwind utility classes; shadcn/ui components only, `new-york` style, Radix-based primitives (not the newer Base UI shadcn variant — see Package Legitimacy Audit).
- Never call axios/API functions directly inside a component — always through a hook, called from the Brain.
- Define domain interfaces in `assets/types/` before creating hooks/contexts — `OwnerType`/`EligibleOwnerUserType` already exist in `assets/types/ownerType.ts`; a `DemoteOwnerPayload` type should be added there alongside `PromoteOwnerPayload`.
- API params: snake_case (`{ user: { role: "admin" } }`); frontend responses: camelCase (global axios interceptor via `camelcaseKeys`) — never call `camelcaseKeys` again inside hooks.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OWN-06 | Remove action visible to owners only, per owner row | `Can permission="manage_ownership"` guard pattern confirmed identical to Add Owner's gate in `OwnershipManagementSection.tsx`; `UserMinus` icon verified present |
| OWN-07 | Three-step Remove Owner modal (warning → role picker → review) | `AddDomainWizard.tsx` step-state scaffold is the direct precedent; `radio-group.tsx` component design provided below; role picker options exactly `admin`/`agent`/`client` matching backend `DEMOTE_TARGET_ROLES` |
| OWN-08 | Confirm calls demote API + invalidates owners query | `demoteOwner.ts`/`useDemoteOwner.ts` designed as exact mirror of `promoteOwner.ts`/`usePromoteOwner.ts`; backend contract confirmed by direct file read |
| OWN-09 | Self-demotion allowed if ≥1 other owner remains; extra warning | Backend already enforces via `owner_count <= 1` guard (no special-casing needed server-side); frontend self-detection risk fully traced (see Common Pitfalls) with concrete fix |
| OWN-10 | Disabled Remove + tooltip when target is only owner | `tooltip.tsx` + two real usage precedents found; critical disabled-button + Radix Tooltip pitfall documented with fix |
| OWN-13 | Add Owner gains matching final review step | `AddOwnerDialog.tsx` read in full; exact insertion point identified (after existing amber warning block, before `DialogFooter`) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-radio-group` | `^1.4.3` | Underlying primitive for the new `radio-group.tsx` shadcn component | Matches every other Radix primitive already used in this repo (`@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-tooltip`, etc.) — the repo predates shadcn's newer "Base UI" component variant, so the Base UI version of `RadioGroup` (returned by the current shadcn docs) would be inconsistent with every other installed primitive and must NOT be used |
| `@tanstack/react-query` | already installed | `useDemoteOwner` mutation | Existing pattern (`usePromoteOwner`) |
| `react-hot-toast` | already installed | Success/failure toasts | Existing pattern |

No other new runtime dependencies are required — `Dialog`, `Button`, `Tooltip`, `Label` all already exist in `frontend/src/components/ui/`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn `RadioGroup` (Radix-based, hand-added) | shadcn `RadioGroup` (Base UI-based, via `pnpm dlx shadcn@latest add radio-group`) | Base UI version is the current shadcn default per official docs, but installing it would pull in `@base-ui/react` (a package not present anywhere else in this repo) and produce a component with a different internal API/import surface than every other primitive here — rejected for consistency (D-03 does not require this specific implementation, only "shadcn RadioGroup" behaviorally) |
| Redux-side session patch after self-demote | Full page reload / forced re-login | Explicitly rejected by D-07 ("No special post-confirm redirect or forced navigation") — a synchronous Redux patch achieves the same correctness without violating that decision |
| AlertDialog for RemoveOwnerDialog | Dialog (plain) | `AlertDialog` is reserved in this codebase for single-action destructive confirmations (`DeleteDomainDialog.tsx`); multi-step flows (`AddDomainWizard.tsx`, `AddOwnerDialog.tsx`) use plain `Dialog` — only `DeleteDomainDialog`'s destructive button *className* should be borrowed, not the `AlertDialog` primitive itself |

**Installation:**
```bash
# Already run during this research session (see Package Legitimacy Audit) —
# @radix-ui/react-radio-group is present in frontend/package.json and node_modules.
# No further install command needed; the plan should commit the resulting
# package.json / package-lock.json diff as part of its first task.
```

**Version verification:** `npm view @radix-ui/react-radio-group version` → `1.4.3` [VERIFIED: npm registry]. `npm view @radix-ui/react-radio-group repository.url` → `git+https://github.com/radix-ui/primitives.git` [VERIFIED: npm registry]. `npm view @radix-ui/react-radio-group scripts.postinstall` → empty (no postinstall script) [VERIFIED: npm registry].

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@radix-ui/react-radio-group` | npm | first published 2020-12-15 (5+ yrs) | part of the widely-used Radix Primitives suite (sibling packages already installed: `react-dialog`, `react-select`, `react-tooltip`, `react-popover`) | github.com/radix-ui/primitives | `[OK]` | Approved — already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none. (Note: the first `slopcheck install` invocation defaulted to checking PyPI and incorrectly flagged the package `[SLOP]` — this is the exact cross-ecosystem confusion pitfall the verification protocol warns about. Re-running with `--ecosystem npm` produced `[OK]`. This is documented here so the planner does not misread a stale terminal scrollback as a real hallucination finding.)
**Packages flagged as suspicious [SUS]:** none.

`slopcheck` (`v0.6.1`) installed successfully in this session; the audit above reflects a real npm-registry check, not a graceful-degradation fallback. No package in this table needs a `checkpoint:human-verify` task on legitimacy grounds — however, since `radio-group.tsx` itself must be hand-authored (no CLI generator run — see Architecture Patterns), the planner should still gate that specific file behind a visual/lint review step, not because the dependency is suspect but because the component source below was reconstructed from training knowledge of the pre-Base-UI shadcn convention rather than fetched fresh from an authoritative source (see Assumptions Log A1).

## Architecture Patterns

### System Architecture Diagram

```
CurrentOwnersList (row)                    AddOwnerDialog (existing, amended)
   │ Remove icon click                          │ user selected → warning shown
   ▼                                             ▼
OwnershipManagementSection                  OwnershipManagementSection
   │ setDemoteTarget(owner)                      │ (unchanged: setIsAddOwnerOpen)
   ▼                                             ▼
useSettingsAdminContext (Brain)  ◄───────────────┘
   │  handleDemoteOwner(role)          handlePromoteOwner(userId)
   ▼                                             │
useDemoteOwner (TanStack mutation)    usePromoteOwner (existing, unchanged)
   │  demoteOwner(userId, role)                  │
   ▼                                             ▼
axios PATCH /v1/admin/settings/owners/:id   axios POST /v1/admin/settings/owners
   │                                             │
   ▼ on success: {id,name,email,role}            ▼ on success
   ├─► invalidate ownersKeys.all ──────► refetch Current Owners list (both flows)
   ├─► invalidate eligibleOwnerUsersKeys.all
   └─► IF response.id === account.id (self-demote):
           dispatch(updateUser({ membership: { ...membership, role } }))   // subdomain path
           dispatch(setActiveBrokerage({ ...activeBrokerage, role }))      // portal path
                   │
                   ▼
           usePermission('manage_ownership') re-evaluates on next render
           with fresh Redux state — no page reload, no forced navigation (D-07)
```

### Recommended Project Structure
```
frontend/src/
├── assets/api/admin/settings/owners/
│   ├── promoteOwner.ts        # existing, unchanged
│   ├── fetchOwners.ts         # existing, unchanged
│   ├── fetchEligibleOwnerUsers.ts  # existing, unchanged
│   └── demoteOwner.ts         # NEW — mirrors promoteOwner.ts
├── store/hooks/Admin/Settings/Owners/
│   ├── usePromoteOwner.ts     # existing, unchanged
│   ├── useFetchOwners.ts      # existing, unchanged
│   ├── useFetchEligibleOwnerUsers.ts  # existing, unchanged
│   └── useDemoteOwner.ts      # NEW — mirrors usePromoteOwner.ts
├── components/ui/
│   └── radio-group.tsx        # NEW — hand-authored, Radix-based (see below)
└── components/view/admin/settingsAdminView/
    ├── CurrentOwnersList.tsx      # AMENDED — add Remove icon button per row
    ├── OwnershipManagementSection.tsx  # AMENDED — wire RemoveOwnerDialog + state
    ├── AddOwnerDialog.tsx         # AMENDED — add review step (OWN-13)
    └── RemoveOwnerDialog.tsx      # NEW — 3-step dialog (OWN-07)
```

### Pattern 1: Multi-step Dialog via single component + numeric step state

**What:** One `<Dialog>` component, `useState<1 | 2 | 3>(1)` for step, conditional JSX blocks per step inside `<DialogContent>`, `goNext`/`goBack` helpers, full state reset in `handleOpenChange` when `nextOpen === false`.
**When to use:** Any sequential, linear wizard-style flow in this codebase — this is the established convention (`AddDomainWizard.tsx`, 4 steps), not a per-step-subcomponent pattern.
**Example (adapted from `frontend/src/components/view/admin/domainsAdminView/AddDomainWizard.tsx`, lines 57-144):**
```typescript
// Source: frontend/src/components/view/admin/domainsAdminView/AddDomainWizard.tsx (existing repo code)
const [step, setStep] = useState<1 | 2 | 3>(1)

const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
        setStep(1)
        setSelectedRole('admin')
    }
    onOpenChange(nextOpen)
}

const goNext = () => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))
const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))
```
A lightweight `StepDots` indicator component (`AddDomainWizard.tsx` lines 35-55) is available to reuse verbatim for a "Step X of 3" polish touch — optional per D-09/Claude's Discretion.

### Pattern 2: `useDemoteOwner` mirrors `usePromoteOwner` exactly

**What:** New mutation hook with no `onError` — failure toast lives in the Brain's `try/catch`, matching the established TOCTOU-safety pattern from Phase 34 (34-CONTEXT.md: "handlePromoteOwner's try/catch is the sole surface for the OWN-05/TOCTOU promote-failure toast since usePromoteOwner intentionally has no onError handler").
**Example:**
```typescript
// Source: frontend/src/store/hooks/Admin/Settings/Owners/usePromoteOwner.ts (existing repo code, adapted)
// NEW FILE: frontend/src/store/hooks/Admin/Settings/Owners/useDemoteOwner.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import demoteOwner from '@/assets/api/admin/settings/owners/demoteOwner'
import { ownersKeys, eligibleOwnerUsersKeys } from '@/store/hooks/queryKeys'
import toast from 'react-hot-toast'

const useDemoteOwner = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: demoteOwner,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ownersKeys.all })
            // Demoting to admin/agent makes the user newly eligible for re-promotion;
            // demoting to client is filtered server-side either way — safe to invalidate always.
            queryClient.invalidateQueries({ queryKey: eligibleOwnerUsersKeys.all })
            toast.success('Owner role updated successfully')
        }
    })
}

export default useDemoteOwner
```
```typescript
// NEW FILE: frontend/src/assets/api/admin/settings/owners/demoteOwner.ts
import axiosInstance from '@/assets/axios/axios'
import { OwnerType, DemoteOwnerPayload } from '@/assets/types/ownerType'

const demoteOwner = async (payload: DemoteOwnerPayload): Promise<OwnerType & { role: string }> => {
    const { userId, role } = payload
    const response = await axiosInstance.patch(`/v1/admin/settings/owners/${userId}`, { user: { role } })
    return response.data
}

export default demoteOwner
```
```typescript
// ADD to frontend/src/assets/types/ownerType.ts, alongside PromoteOwnerPayload
export type DemoteTargetRole = 'admin' | 'agent' | 'client'   // matches backend DEMOTE_TARGET_ROLES exactly

export interface DemoteOwnerPayload {
    userId: string
    role: DemoteTargetRole
}
```

### Pattern 3: `radio-group.tsx` — hand-authored, Radix-based (matches repo convention)

`npx shadcn@latest add radio-group` was NOT run because the current shadcn CLI generates the newer Base UI-backed component (confirmed via WebFetch of the official docs during this research — see Assumptions Log), which does not match this repo's Radix-based component set. `@radix-ui/react-radio-group@1.4.3` was installed directly and verified [VERIFIED: npm registry]; the wrapper file below reconstructs the classic Radix-based shadcn `new-york`-style `RadioGroup` from training knowledge, following this repo's exact `React.forwardRef` + `cn()` + `displayName` convention seen in `frontend/src/components/ui/tooltip.tsx` and `frontend/src/components/ui/select.tsx`. **This file's source was not fetched from an authoritative source in this session — tag `[ASSUMED]`, flag for a quick visual check once rendered (Assumptions Log A1).**

```typescript
// NEW FILE: frontend/src/components/ui/radio-group.tsx  [ASSUMED — verify visually]
import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    className={cn("grid gap-2", className)}
    {...props}
    ref={ref}
  />
))
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <Circle className="h-2.5 w-2.5 fill-primary" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
))
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

export { RadioGroup, RadioGroupItem }
```

Usage in Step 2 of `RemoveOwnerDialog.tsx` (paired with `Label`, matching `frontend/src/components/ui/label.tsx` already present):
```tsx
<RadioGroup value={selectedRole} onValueChange={(v) => setSelectedRole(v as DemoteTargetRole)}>
  {(['admin', 'agent', 'client'] as const).map((role) => (
    <div key={role} className="flex items-center space-x-2">
      <RadioGroupItem value={role} id={`role-${role}`} />
      <Label htmlFor={`role-${role}`} className="capitalize font-normal">{role}</Label>
    </div>
  ))}
</RadioGroup>
```

### Pattern 4: Tooltip on a disabled Button — the pointer-events pitfall (see Common Pitfalls for full detail)

`frontend/src/components/ui/button.tsx`'s `buttonVariants` base class includes `disabled:pointer-events-none`. A `disabled` native `<button>` never receives hover/focus events, so `<TooltipTrigger asChild><Button disabled>...</Button></TooltipTrigger>` silently never shows the tooltip. Wrap in a focusable `<span>` instead:
```tsx
// Source: pattern adapted from frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx
// (existing repo code uses a bare <span> as TooltipTrigger for a similar reason — no disabled Button there,
// but same underlying Radix Tooltip requirement that the trigger element must receive pointer events)
<Tooltip>
  <TooltipTrigger asChild>
    <span tabIndex={0} className="inline-block">
      <Button variant="ghost" size="icon" disabled className="pointer-events-none">
        <UserMinus className="h-4 w-4" />
      </Button>
    </span>
  </TooltipTrigger>
  <TooltipContent>
    <p>This is the only owner. Promote another user before removing owner access.</p>
  </TooltipContent>
</Tooltip>
```
Remember `TooltipProvider` must wrap the list (matches `DomainCardList.tsx`'s convention) — add it around `CurrentOwnersList`'s render, not globally.

### Anti-Patterns to Avoid
- **Calling `useDemoteOwner`/`usePromoteOwner` directly from `RemoveOwnerDialog.tsx`/`AddOwnerDialog.tsx`:** violates the Component → Context → Hook data flow (CLAUDE.md). Both dialogs must receive `onConfirm` callbacks from `OwnershipManagementSection`, which gets them from `useSettingsAdminContext`.
- **Wrapping `RemoveOwnerDialog` in `AlertDialog`:** this repo reserves `AlertDialog` for single-step destructive confirmations; multi-step flows use plain `Dialog` (see Alternatives Considered).
- **Adding an `onError` handler to `useDemoteOwner`:** breaks the established TOCTOU-toast pattern where the Brain's `try/catch` is the sole error-toast surface (mirrors `usePromoteOwner`'s intentional omission).
- **Deriving self-demotion from `useRole()`'s `role` value:** `useRole()` returns the *current user's own role*, not their id — comparing roles cannot detect self-demotion (two different owners both have `role === 'owner'`). Must compare `owner.id` to `state.account.id` directly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Radio button styling/accessibility | Custom `<input type="radio">` + manual ARIA | `@radix-ui/react-radio-group` (via new `radio-group.tsx` wrapper) | Radix handles keyboard nav (arrow keys), focus management, and `aria-checked` correctly; every other selection control in this repo (`select.tsx`) already delegates to Radix |
| Tooltip positioning/portal logic | Custom `position: absolute` + mouseenter/mouseleave | `@radix-ui/react-tooltip` (already installed, `tooltip.tsx` exists) | Already solved in this repo with two working usages to copy from |
| Step-wizard navigation state | New generic `useWizard()` hook or step-array abstraction | Plain `useState<1|2|3>` + conditional JSX, matching `AddDomainWizard.tsx` | Introducing a generic wizard abstraction for a 3-step flow when the codebase has zero existing generic wizard hooks would be inventing a new pattern the user's "Claude's Discretion" note explicitly says to avoid unless it "reads cleaner across both dialogs" — a 3-step case does not meet that bar |

**Key insight:** Every piece of this phase already has a working, in-repo precedent. The main risk is not "what library to use" but "did you find the existing pattern before writing a new one" — all four Patterns above cite exact existing files.

## Common Pitfalls

### Pitfall 1: `account.id` is never populated on the main-domain/portal path — self-demotion detection silently fails

**What goes wrong:** D-06 requires comparing `owner.id` (from the `/v1/admin/settings/owners` response, backend `user.uid`) against the current user's own id to detect self-demotion and show the extra warning sentence. The current user's id is read from Redux `state.account.id` (`useAppSelector((state) => state.account.id)`, per `useRole.ts`'s existing pattern). Tracing every path that can populate `state.account`:
  - `useSignIn.ts` (`dispatch(updateUser(user))`) — only fires for the legacy `useSignIn` mutation, not for the actual login flow used by this app.
  - `useGetCurrentUser.ts` (`dispatch(updateUser({...user, nextStep}))`) — this IS the real, live path that populates `account.id` in production. It's called from exactly one place: `NavBarContext.ts` → `NavBar.tsx` → `AppShellAdmin.tsx` (the **subdomain** shell).
  - `AdminDomainShell.tsx` renders `PortalAdminShell` (not `AppShellAdmin`) when `isMainDomain()` is true. `PortalAdminShell.tsx` renders `PortalNavBar.tsx`, which does **not** call `useGetCurrentUser` anywhere — it only calls `useAdminBrokeragesQuery`, `useFetchBrokerage`, `useFetchDomains`.
  - Confirmed by direct read of `LoginSuccessful.tsx` and `Login.tsx`: the main-domain branch of both only calls `fetchAdminBrokerages()` and never dispatches `updateUser`.

  Net result: for any owner who reaches `/admin/settings` via the main domain (portal path — e.g. `yourapp.com/admin/settings` as opposed to `brokerage.yourapp.com/admin/settings`), `state.account.id === ''` for the entire session. `owner.id === currentUserId` is therefore always `false` on that path, even when the row genuinely belongs to the logged-in user — self-demotion warning (D-06) never shows, and the "compare id" approach for detecting who to patch in Redux after a self-demote (see Pitfall 2) also silently fails.

**Why it happens:** The app has two parallel shell trees (`AppShellAdmin` for subdomains, `PortalAdminShell` for the main domain) that were built at different times with different assumptions about what state each needs, and `useGetCurrentUser`'s wiring was only ever added to the subdomain `NavBar`.

**How to avoid:** Call `useGetCurrentUser()` unconditionally inside `useSettingsAdminContext` (the Brain for this exact page). It is a `useQuery` keyed on `['getCurrentUser']`, so if `NavBarContext` has already fetched it (subdomain path), TanStack Query dedupes and this is a no-op cache hit; on the portal path it becomes the first and only call, correctly populating `account.id` before the page needs it. One caveat to verify during implementation: `useGetCurrentUser` also contains a `navigate('/auth/brokerage-contact')` side effect when `nextStep === 'brokerage-contact'` — this should never fire for a user who has already passed `RequireRole`'s owner/admin/agent gate to reach `/admin/settings`, but confirm this during manual verification since it's a side effect being newly introduced onto this page.

**Warning signs:** Self-demotion warning sentence never appears when testing via the main-domain/portal URL even though it correctly appears on the subdomain URL for the identical account/row.

### Pitfall 2: Redux permission state goes stale after a successful self-demote (the flagged D-07 risk)

**What goes wrong:** `usePermission('manage_ownership')` derives from `useRole()`, which reads `account.membership?.role ?? activeBrokerage?.role`. Neither field auto-refreshes after the demote mutation succeeds. A user who just demoted themselves from `owner` to e.g. `admin` will still see the Add Owner button and other Remove buttons rendered (client-side check still says `true`) until something refetches their session — clicking those buttons will then correctly 403 server-side (API-05), producing a confusing "why did that just fail" UX rather than a security hole.

**Why it happens:** No existing hook in this codebase refetches/patches account or membership state after an in-session role-changing mutation — this pattern genuinely does not exist yet (confirmed: grepped every usage of `updateUser`/`setActiveBrokerage` across the frontend; both are only ever dispatched at login/brokerage-switch time, never after a mutation).

**How to avoid:** In `handleDemoteOwner` (the Brain), after `demoteOwnerMutation` resolves, compare the mutation response's `id` to `account.id` (guaranteed populated per Pitfall 1's fix). If they match, synchronously dispatch two patches using data already available — no extra network round trip:
```typescript
// Inside useSettingsAdminContext.ts, after mutateAsync resolves with { id, name, email, role }
if (response.id === account.id) {
    if (account.membership) {
        dispatch(updateUser({ membership: { ...account.membership, role: response.role as UserRole } }))
    }
    if (activeBrokerage) {
        dispatch(setActiveBrokerage({ ...activeBrokerage, role: response.role as UserRole }))
    }
}
```
This patches whichever Redux field `useRole()` is actually reading (`account.membership?.role` on the subdomain path, `activeBrokerage?.role` on the portal path) — patching both is cheap and correct regardless of which shell rendered the page, and requires no forced redirect or reload, honoring D-07.

**Warning signs:** After self-demoting in a manual test, the Add Owner button and other rows' Remove buttons are still visible and clickable without a page refresh; clicking them produces a 403 toast instead of the button simply being gone.

### Pitfall 3: Tooltip never appears on a `disabled` shadcn `Button` (OWN-10)

**What goes wrong:** `buttonVariants` (`frontend/src/components/ui/button.tsx`) includes `disabled:pointer-events-none` in its base class string. Radix `Tooltip` shows on hover/focus of its trigger element; a `disabled` native `<button>` receives neither pointer nor focus events in most browsers, so `<TooltipTrigger asChild><Button disabled>Remove</Button></TooltipTrigger>` silently never opens — no error, the tooltip just never appears, easy to miss in a quick manual check.
**Why it happens:** This is a well-known Radix + native-disabled-element interaction, not specific to this codebase, but this codebase has zero existing precedent for "tooltip explaining a disabled button" specifically (the one existing Tooltip-on-icon precedent in `DomainCard.tsx` wraps a plain non-interactive `<span>`, not a disabled `Button`).
**How to avoid:** Wrap the disabled `Button` in a focusable `<span tabIndex={0}>` and make that span the actual `TooltipTrigger`, as shown in Pattern 4 above.
**Warning signs:** Hovering the disabled Remove button on the sole-remaining-owner row shows nothing.

### Pitfall 4: Installing the wrong `radio-group.tsx` variant

**What goes wrong:** Running the current shadcn CLI (`pnpm dlx shadcn@latest add radio-group`) generates a Base UI-backed component (`import * as RadioGroupPrimitive from "@base-ui/react/radio-group"`) — confirmed via WebFetch of the live shadcn docs during this research session. This is inconsistent with every other primitive already installed in this repo (all `@radix-ui/react-*`), would add a net-new dependency family (`@base-ui/react`) not used anywhere else, and its component API surface differs subtly from the Radix version other files import against.
**How to avoid:** Do not run the shadcn CLI for this component. Hand-author `radio-group.tsx` against the already-installed `@radix-ui/react-radio-group` following Pattern 3 above, matching the `React.forwardRef` + `cn()` convention visible in every other file in `components/ui/`.
**Warning signs:** `npm ls @base-ui/react` reports a new top-level dependency that doesn't match any sibling `components/ui/*.tsx` import style.

## Code Examples

### Wiring the demote dialog open/target state into the Brain

```typescript
// Source: adapted from existing frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts
// pattern for isAddOwnerOpen/handlePromoteOwner
import { useAppSelector, useAppDispatch } from '@/store/hooks/useDispatch'
import { updateUser } from '@/store/reducers/account'
import { setActiveBrokerage } from '@/store/reducers/activeBrokerage'
import useGetCurrentUser from '@/store/hooks/Users/useGetCurrentUser'
import useDemoteOwner from '@/store/hooks/Admin/Settings/Owners/useDemoteOwner'
import { OwnerType } from '@/assets/types/ownerType'

// ...inside useSettingsAdminContext:
const account = useAppSelector((state) => state.account)
const activeBrokerage = useAppSelector((state) => state.activeBrokerage.activeBrokerage)
const dispatch = useAppDispatch()

useGetCurrentUser() // guarantees account.id is populated on BOTH subdomain and portal paths (Pitfall 1)

const [demoteTarget, setDemoteTarget] = useState<OwnerType | null>(null)
const { mutateAsync: demoteOwnerMutation, isPending: isDemoting } = useDemoteOwner()

const handleDemoteOwner = useCallback(async (role: DemoteTargetRole) => {
    if (!demoteTarget) return
    try {
        const response = await demoteOwnerMutation({ userId: demoteTarget.id, role })
        if (response.id === account.id) {
            if (account.membership) dispatch(updateUser({ membership: { ...account.membership, role: response.role as UserRole } }))
            if (activeBrokerage) dispatch(setActiveBrokerage({ ...activeBrokerage, role: response.role as UserRole }))
        }
        setDemoteTarget(null)
    } catch {
        toast.error(`Couldn't update ${demoteTarget.name}'s role. They may no longer be an owner — refresh and try again.`)
    }
}, [demoteTarget, demoteOwnerMutation, account, activeBrokerage, dispatch])
```

### CurrentOwnersList amendment — Remove button + self/last-owner logic

```tsx
// Source: adapted from existing frontend/src/components/view/admin/settingsAdminView/CurrentOwnersList.tsx
interface CurrentOwnersListProps {
    owners: OwnerType[]
    onRemove: (owner: OwnerType) => void
}

const CurrentOwnersList = ({ owners, onRemove }: CurrentOwnersListProps) => {
    const isOnlyOwner = owners.length <= 1
    // ...
    return (
        <TooltipProvider>
            <div className="divide-y divide-border">
                {owners.map((owner) => (
                    <div key={owner.id} className="flex items-center justify-between py-3 text-sm">
                        <span className="font-medium text-foreground">{owner.name}</span>
                        <span className="text-muted-foreground">{owner.email}</span>
                        <Can permission="manage_ownership">
                            {isOnlyOwner ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span tabIndex={0} className="inline-block">
                                            <Button variant="ghost" size="icon" disabled className="pointer-events-none text-muted-foreground">
                                                <UserMinus className="h-4 w-4" />
                                            </Button>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent><p>This is the only owner. Promote another user before removing owner access.</p></TooltipContent>
                                </Tooltip>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => onRemove(owner)}
                                >
                                    <UserMinus className="h-4 w-4" />
                                </Button>
                            )}
                        </Can>
                    </div>
                ))}
            </div>
        </TooltipProvider>
    )
}
```
`currentUserId` is NOT threaded through `CurrentOwnersList` (unused there — the list only branches on `owners.length`). It is passed directly from `OwnershipManagementSection` (sourced from `state.account.id` in the Brain) to `RemoveOwnerDialog`, which uses it for the D-06 extra warning sentence when `demoteTarget.id === currentUserId`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| shadcn `RadioGroup` on Radix primitives | shadcn `RadioGroup` on Base UI primitives | Current shadcn docs (fetched live during this research) now show a Base UI-backed implementation by default | Do not use the CLI-generated version for this repo — see Pitfall 4 |

**Deprecated/outdated:** None relevant — all other primitives used in this phase (`Dialog`, `Tooltip`, `Button`, `Label`) are unchanged from what's already installed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The hand-authored `radio-group.tsx` source in Pattern 3 (Radix `RadioGroupPrimitive.Root`/`Item`/`Indicator` + `Circle` icon + `cn()` styling) is training-knowledge reconstruction of the classic pre-Base-UI shadcn `new-york` RadioGroup, not fetched from an authoritative source in this session (WebFetch of the live shadcn docs returned the newer Base UI variant instead, which was explicitly rejected — see Pitfall 4) | Architecture Patterns, Pattern 3 | Low-to-medium: if the styling/API is slightly off from the exact classic shadcn output, the component will still function (Radix primitives are correctly named and imported) but may need minor className/indicator tweaks during visual review — does not block functionality, only polish |
| A2 | `useGetCurrentUser`'s `nextStep === 'brokerage-contact'` navigate side effect will never fire when invoked from `useSettingsAdminContext`, because `RequireRole` already gates `/admin/settings` to owner/admin/agent | Common Pitfalls, Pitfall 1 fix / Code Examples | Low: if somehow a stale/edge-case `nextStep` value is returned for an already-onboarded owner, calling `useGetCurrentUser()` from the Settings page could trigger an unexpected navigation away from the page the user is trying to use — worth a quick manual check during implementation, not a redesign |

## Open Questions (RESOLVED)

1. **Should `useGetCurrentUser()`'s navigation side effect be split out into a narrower hook before reuse?**
   - What we know: `useGetCurrentUser` couples "fetch + populate `account.id`/`membership`" with "navigate to onboarding if incomplete." Reusing it as-is in `useSettingsAdminContext` is the minimal-diff fix (reuses an existing pattern, per project convention) and should be safe given the `RequireRole` gate already in place.
   - What's unclear: whether there's any edge case (e.g. a race during an in-progress onboarding flow accessed via a bookmarked `/admin/settings` URL) where `nextStep` could be non-null for a role-gated user.
   - RESOLVED: use `useGetCurrentUser()` as-is (Pattern/Pitfall 1 fix) since it matches "reuse existing patterns" over inventing a new one; flag A2 for a 30-second manual check during Phase 35 execution (log in as an owner via both subdomain and portal URLs, confirm no unexpected redirect on the Settings page).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@radix-ui/react-radio-group` | OWN-07 Step 2 role picker | ✓ (installed during this research session) | 1.4.3 | — |
| Node/npm toolchain | Build/lint/vitest | ✓ (used throughout this research session) | npm 10.8.3, Node v22.9.0 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Unchanged — Cognito JWT handled by existing axios interceptor |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes | Frontend `Can permission="manage_ownership"` gate is UX-only (API-05); server-side `require_owner!` before_action + last-owner `COUNT` guard in `owners_controller.rb#update` is the real enforcement — already shipped in Phase 33, confirmed by direct file read this session, no changes proposed |
| V5 Input Validation | Yes | Role picker is a closed `RadioGroup` (3 fixed values: `admin`/`agent`/`client`) — no free-text input on this phase's forms; backend independently validates against `DEMOTE_TARGET_ROLES` allowlist regardless of what the client sends |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Client sends a role value outside the picker's UI options (e.g. `owner`, arbitrary string) via direct API call | Elevation of Privilege | Already mitigated server-side: `DEMOTE_TARGET_ROLES = %w[admin agent client].freeze` allowlist check in `owners_controller.rb#update` rejects anything else with 422 — confirmed by direct read, no frontend-only defense should be relied upon |
| Non-owner directly calls `PATCH /v1/admin/settings/owners/:id` bypassing the disabled/hidden UI | Elevation of Privilege | `before_action :require_owner!, only: [:create, :update]` already enforced server-side (Phase 33) |
| Stale client permits a just-demoted owner to still see/click Remove/Add buttons | Elevation of Privilege (UX-level only, not a real bypass since server re-validates) | Addressed by Pitfall 2's Redux patch — reduces confusing 403s but is not itself a security control; the security control is entirely server-side and already shipped |

## Sources

### Primary (HIGH confidence)
- Direct file reads (this session): `backend/app/controllers/v1/admin/settings/owners_controller.rb`, `frontend/src/components/view/admin/settingsAdminView/{AddOwnerDialog,CurrentOwnersList,OwnershipManagementSection}.tsx`, `frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts`, `frontend/src/store/hooks/Admin/Settings/Owners/{usePromoteOwner,useFetchOwners}.ts`, `frontend/src/assets/api/admin/settings/owners/{promoteOwner,fetchEligibleOwnerUsers}.ts`, `frontend/src/store/hooks/queryKeys.tsx`, `frontend/src/store/hooks/Auth/{useRole,usePermission}.ts`, `frontend/src/store/reducers/{account,activeBrokerage}.ts`, `frontend/src/store/hooks/Users/useGetCurrentUser.ts`, `frontend/src/store/hooks/Account/useUpdateAccountProfile.tsx`, `frontend/src/store/hooks/Auth/useSignIn.ts`, `frontend/src/containers/portal/{PortalShell,PortalNavBar}.tsx`, `frontend/src/containers/auth/{Login,LoginSuccessful}.tsx`, `frontend/src/router/admin/AdminDomainShell.tsx`, `frontend/src/components/common/shells/{portalAdminShell/PortalAdminShell,appShellAdmin/AppShellAdmin}.tsx`, `frontend/src/components/navbar/NavBarContext.ts`, `frontend/src/components/view/admin/domainsAdminView/{AddDomainWizard,DomainCard,DomainCardList,DeleteDomainDialog}.tsx`, `frontend/src/components/ui/{tooltip,button}.tsx`, `frontend/src/assets/rbac/permissions.ts`, `frontend/src/components/common/guards/Can.tsx`, `frontend/src/assets/types/{ownerType,userType,membershipType,roleType,adminBrokerageType}.ts`, `frontend/components.json`, `frontend/package.json`
- `npm view @radix-ui/react-radio-group version|repository.url|scripts.postinstall` — package legitimacy, version, postinstall check [VERIFIED: npm registry]
- `slopcheck install @radix-ui/react-radio-group --ecosystem npm` — legitimacy scan, result `[OK]` [VERIFIED: npm registry]
- `node_modules/lucide-react/dist/esm/icons/user-minus.js` presence check on installed `lucide-react@0.555.0` — icon existence [VERIFIED: filesystem]

### Secondary (MEDIUM confidence)
- WebFetch of `https://ui.shadcn.com/docs/components/radio-group` — confirmed current shadcn CLI generates a Base UI-backed component, informing the decision to hand-author instead [CITED: ui.shadcn.com]

### Tertiary (LOW confidence)
- `radio-group.tsx` component source in Pattern 3 — reconstructed from training knowledge of the pre-Base-UI shadcn `new-york` style convention, not independently fetched this session [ASSUMED — see A1]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — single new dependency, verified via npm registry + slopcheck against the correct ecosystem
- Architecture: HIGH — every pattern cites an exact existing file read in full this session
- Pitfalls: HIGH — Pitfall 1 (self-demotion detection failure) and Pitfall 2 (session staleness) were traced through actual render trees and route wiring, not inferred; Pitfall 3 (Tooltip+disabled) is a well-documented Radix interaction confirmed against this repo's actual `button.tsx` base classes

**Research date:** 2026-07-13
**Valid until:** 2026-08-12 (30 days — stable internal codebase, low churn risk; re-verify `@radix-ui/react-radio-group` version if not implemented within that window)
