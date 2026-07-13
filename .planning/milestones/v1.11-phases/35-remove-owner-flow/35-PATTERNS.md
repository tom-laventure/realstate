# Phase 35: Remove Owner Flow - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 9 (4 amended, 5 new)
**Analogs found:** 9 / 9 (1 with no direct in-repo analog — hand-authored primitive, see "No Analog Found")

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx` (new) | component (multi-step dialog) | request-response | `frontend/src/components/view/admin/domainsAdminView/AddDomainWizard.tsx` (step scaffold) + `frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx` (domain/props shape) | exact (structural + domain) |
| `frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx` (amended — add review step) | component (multi-step dialog) | request-response | itself (Phase 34, current single-step version) + `AddDomainWizard.tsx` step pattern | exact |
| `frontend/src/components/view/admin/settingsAdminView/CurrentOwnersList.tsx` (amended — add Remove button) | component (list row) | CRUD (row action) | itself (Phase 34 version) + `frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx` (Tooltip-on-icon pattern) | exact |
| `frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx` (amended — wire demote dialog state) | component (section container) | request-response | itself (Phase 34 version, `AddOwnerDialog` wiring block) | exact |
| `frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts` (amended — add demote mutation + state) | provider / Brain (context hook) | request-response | itself (`handlePromoteOwner` block) | exact |
| `frontend/src/assets/api/admin/settings/owners/demoteOwner.ts` (new) | service (API module) | request-response | `frontend/src/assets/api/admin/settings/owners/promoteOwner.ts` | exact |
| `frontend/src/store/hooks/Admin/Settings/Owners/useDemoteOwner.ts` (new) | hook (TanStack mutation wrapper) | request-response | `frontend/src/store/hooks/Admin/Settings/Owners/usePromoteOwner.ts` | exact |
| `frontend/src/assets/types/ownerType.ts` (amended — add `DemoteOwnerPayload`, `DemoteTargetRole`, `role` field) | model (type definitions) | — | itself (existing `PromoteOwnerPayload` block) | exact |
| `frontend/src/components/ui/radio-group.tsx` (new) | component (shadcn UI primitive) | — | `frontend/src/components/ui/tooltip.tsx` / `frontend/src/components/ui/select.tsx` (forwardRef + Radix + `cn()` convention) | role-match (no radio-group precedent exists; convention match only) |

## Pattern Assignments

### `frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx` (new)

**Analogs:** `AddDomainWizard.tsx` (step-state scaffold, read in full) + `AddOwnerDialog.tsx` (dialog/props shape, read in full)

**Imports pattern** (from `AddOwnerDialog.tsx` lines 1-22, extend with `RadioGroup`):
```typescript
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { OwnerType, DemoteTargetRole } from '@/assets/types/ownerType'
```

**Step-state + reset pattern** (`AddDomainWizard.tsx` lines 57-94, adapt from 4 steps to 3, default role `'admin'` instead of domain string):
```typescript
// Source: frontend/src/components/view/admin/domainsAdminView/AddDomainWizard.tsx lines 58-87
const [step, setStep] = useState<1 | 2 | 3>(1)
const [selectedRole, setSelectedRole] = useState<DemoteTargetRole>('admin')

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
Note D-05: unlike `AddDomainWizard.tsx`'s `handleOpenChange`, there is no conditional/skippable step here (all 3 steps always run) — simpler than the 4-step domain wizard's `hasOtherActiveDomain` branch, do not port that conditional-step logic.

**`StepDots` reuse** (`AddDomainWizard.tsx` lines 35-55) — copy verbatim into a shared location or duplicate locally per UI-SPEC's "adopt for both dialogs" decision; UI-SPEC calls for 3 dots here, 2 dots in `AddOwnerDialog.tsx`.

**Confirm handler + submitting state pattern** (`AddOwnerDialog.tsx` lines 42-45, adapted to call `onConfirm(selectedRole)` instead of `onConfirm(selectedUser.id)`):
```typescript
const handleConfirm = async () => {
    await onConfirm(selectedRole)
}
```

**Props interface pattern** (`AddOwnerDialog.tsx` lines 24-31, adapted):
```typescript
interface RemoveOwnerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    target: OwnerType | null
    currentUserId: string
    onConfirm: (role: DemoteTargetRole) => Promise<void>
    isSubmitting: boolean
}
```

**Destructive confirm button pattern** (`DeleteDomainDialog.tsx` lines 36-39 — borrow only the className, not the `AlertDialog` primitive per UI-SPEC's explicit "Dialog primitive choice" note):
```typescript
// Source: frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx lines 36-39
<Button
    onClick={handleConfirm}
    disabled={isSubmitting}
    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
>
    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
    Confirm Role Change
</Button>
```

**Radio group step 2 usage** — see `radio-group.tsx` pattern below; wire `RadioGroup value={selectedRole} onValueChange={(v) => setSelectedRole(v as DemoteTargetRole)}` per RESEARCH.md Pattern 3's usage example (`admin`/`agent`/`client`, `capitalize font-normal` labels).

**Error handling:** No local try/catch inside the dialog — `onConfirm` is awaited from the Brain, which owns the try/catch (see `useSettingsAdminContext.ts` pattern below). This matches `AddOwnerDialog.tsx`'s `handleConfirm` which also has no try/catch of its own.

---

### `frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx` (amended — add review step, OWN-13)

**Analog:** itself (current Phase 34 version, read in full above) + `AddDomainWizard.tsx` step pattern for the `useState<1 | 2>` addition

**Current structure to preserve exactly** (lines 1-110 unchanged — combobox, warning callout): the entire `Popover`/`Command` block and the amber warning block (lines 101-110) stay as-is per D-08.

**Insertion point:** wrap the current single-screen JSX (lines 47-121) in `{step === 1 && (...)}`, insert a new `{step === 2 && (...)}` review block before `DialogFooter`'s current `onConfirm` call moves there. The existing footer buttons need retargeting:
- Current Step-1 footer (`AddOwnerDialog.tsx` lines 112-118): "Keep Looking" stays a close/reset button; "Confirm Add Owner" becomes "Continue to Review" and calls `goNext` (disabled condition unchanged: `!selectedUser`).
- New Step-2 footer: "Back" (`goBack`) + "Confirm Add Owner" (moves here, still calls `handleConfirm` → `onConfirm(selectedUser.id)`, unchanged `usePromoteOwner` contract).

**State reset pattern to extend** (`AddOwnerDialog.tsx` lines 37-40, add `step` reset alongside existing `selectedUser` reset):
```typescript
// Source: frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx lines 37-40 (existing)
const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
        setSelectedUser(null)
        setStep(1)   // NEW — per D-05/UI-SPEC "no resume mid-flow" requirement
    }
    onOpenChange(nextOpen)
}
```

**Review screen summary line pattern** (new, follows UI-SPEC copy contract): `"{selectedUser.name} ({selectedUser.email}) will be changed from {selectedUser.role} to Owner."` — reuses the already-available `selectedUser.role` field from `EligibleOwnerUserType` (`assets/types/ownerType.ts` line 13), no new data needed.

---

### `frontend/src/components/view/admin/settingsAdminView/CurrentOwnersList.tsx` (amended — Remove button, OWN-06/OWN-10)

**Analog:** itself (current Phase 34 version, read in full above, 28 lines) + `DomainCard.tsx` Tooltip-on-icon pattern (lines 85-109, read above)

**Current row structure to preserve** (`CurrentOwnersList.tsx` lines 16-25 — `divide-y divide-border`, `flex items-center justify-between py-3 text-sm`, no avatars/badges): unchanged per Phase 34 D-01/D-02, Remove button is appended to the existing row only.

**Props interface extension:**
```typescript
// Source: adapted from frontend/src/components/view/admin/settingsAdminView/CurrentOwnersList.tsx lines 3-5 (existing)
interface CurrentOwnersListProps {
    owners: OwnerType[]
    onRemove: (owner: OwnerType) => void   // NEW
}
```
Note: `currentUserId` is NOT added here — self-demotion detection happens inside `RemoveOwnerDialog`, which receives `currentUserId` directly from `OwnershipManagementSection` (resolved during planning; see 35-02/35-04 PLAN.md).

**Tooltip-on-disabled-button pattern** (adapted from `DomainCard.tsx` lines 95-104 — note: existing precedent wraps a non-interactive `<span>` icon, NOT a disabled `Button`; the `tabIndex={0}` + `pointer-events-none` combination for a genuinely disabled `Button` is new but follows the same `TooltipTrigger asChild` + `<span>` wrapper shape):
```tsx
// Source: pattern shape from frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx lines 95-104
<Tooltip>
    <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-block">
            <Button variant="ghost" size="icon" disabled className="pointer-events-none text-muted-foreground">
                <UserMinus className="h-4 w-4" />
            </Button>
        </span>
    </TooltipTrigger>
    <TooltipContent>
        <p>This is the only owner. Promote another user before removing owner access.</p>
    </TooltipContent>
</Tooltip>
```

**`TooltipProvider` wrap-the-list convention** — confirmed in `DomainCardList.tsx` (not read in full this session, but cited consistently in CONTEXT.md/RESEARCH.md/UI-SPEC.md as the established pattern: wrap the list's render, not global). Apply the same shape here: `<TooltipProvider><div className="divide-y divide-border">{...}</div></TooltipProvider>`.

**Active Remove button (non-disabled row):**
```tsx
<Button
    variant="ghost"
    size="icon"
    aria-label={`Remove owner access for ${owner.name}`}
    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
    onClick={() => onRemove(owner)}
>
    <UserMinus className="h-4 w-4" />
</Button>
```

**Guard pattern** — reuse `Can permission="manage_ownership"` exactly as `OwnershipManagementSection.tsx` line 36-41 does for the "Add Owner" button; wrap the Remove button (or the whole trailing action cell) per row.

---

### `frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx` (amended — wire RemoveOwnerDialog)

**Analog:** itself (current Phase 34 version, read in full above, 77 lines)

**Existing wiring pattern to mirror exactly** (`OwnershipManagementSection.tsx` lines 64-73 — the `AddOwnerDialog` wiring block):
```tsx
// Source: frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx lines 64-73 (existing)
<Can permission="manage_ownership">
    <AddOwnerDialog
        open={isAddOwnerOpen}
        onOpenChange={setIsAddOwnerOpen}
        eligibleUsers={eligibleUsers}
        isLoadingEligible={isLoadingEligible}
        onConfirm={onPromoteOwner}
        isSubmitting={isPromoting}
    />
</Can>
```
Add an equivalent block below it:
```tsx
<Can permission="manage_ownership">
    <RemoveOwnerDialog
        open={demoteTarget !== null}
        onOpenChange={(open) => { if (!open) setDemoteTarget(null) }}
        target={demoteTarget}
        currentUserId={currentUserId}
        onConfirm={onDemoteOwner}
        isSubmitting={isDemoting}
    />
</Can>
```
Note: unlike `isAddOwnerOpen` (a plain boolean), the demote dialog's open state is derived from `demoteTarget !== null` (the Brain owns which owner is targeted) — this is a deliberate deviation from the Add Owner boolean-flag pattern because the dialog needs to know *which* owner, not just whether it's open; `CurrentOwnersList`'s `onRemove` callback should call `setDemoteTarget(owner)` via a new prop threaded down from this component.

**Props interface extension** — add `owners`-adjacent props (`onRemoveOwner`/`setDemoteTarget`, `currentUserId`, `onDemoteOwner`, `isDemoting`) following the existing prop-drilling shape already used for `onPromoteOwner`/`isPromoting` (lines 10-20).

---

### `frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts` (amended — demote mutation + state)

**Analog:** itself (current Phase 34 version, read in full above, 43 lines) — the `handlePromoteOwner` block (lines 16-24) is the exact template for `handleDemoteOwner`.

**Existing try/catch pattern to mirror exactly** (lines 16-24):
```typescript
// Source: frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts lines 16-24 (existing)
const handlePromoteOwner = useCallback(async (userId: string) => {
    try {
        await promoteOwnerMutation(userId)
        setIsAddOwnerOpen(false)
    } catch {
        const name = eligibleUsers.find((u) => u.id === userId)?.name ?? 'this user'
        toast.error(`Couldn't add owner. ${name} may no longer be eligible — refresh and try again.`)
    }
}, [promoteOwnerMutation, eligibleUsers])
```

**New `handleDemoteOwner` pattern** (per RESEARCH.md Code Examples, verified against the actual Redux slices this session — `updateUser` action confirmed in `frontend/src/store/reducers/account.ts` line 18, `setActiveBrokerage` confirmed in `frontend/src/store/reducers/activeBrokerage.ts` line 16):
```typescript
import { useAppSelector, useAppDispatch } from '@/store/hooks/useDispatch'
import { updateUser } from '@/store/reducers/account'
import { setActiveBrokerage } from '@/store/reducers/activeBrokerage'
import useGetCurrentUser from '@/store/hooks/Users/useGetCurrentUser'
import useDemoteOwner from '@/store/hooks/Admin/Settings/Owners/useDemoteOwner'
import { OwnerType, DemoteTargetRole } from '@/assets/types/ownerType'
import UserRole from '@/assets/types/roleType'

// ...inside useSettingsAdminContext:
const account = useAppSelector((state) => state.account)
const activeBrokerage = useAppSelector((state) => state.activeBrokerage.activeBrokerage)
const dispatch = useAppDispatch()

useGetCurrentUser() // Pitfall 1 fix — guarantees account.id populated on both subdomain and portal shells

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
Return this alongside `owners`, `currentUserId: account.id`, `demoteTarget`, `setDemoteTarget`, `isDemoting`, `handleDemoteOwner` in the existing `useMemo` return block (`useSettingsAdminContext.ts` lines 26-40), matching the existing `state`/`actions` split.

**IMPORTANT dependency verification:** `account.membership` type is `MembershipType | undefined` (`assets/types/userType.ts` line 12) — confirm `MembershipType` has a `role` field before writing the spread (`{...account.membership, role: ...}`); not read this session, flag for a quick check during planning/execution.

---

### `frontend/src/assets/api/admin/settings/owners/demoteOwner.ts` (new)

**Analog:** `frontend/src/assets/api/admin/settings/owners/promoteOwner.ts` (read in full, 9 lines — exact mirror target)

**Full existing file for reference:**
```typescript
// Source: frontend/src/assets/api/admin/settings/owners/promoteOwner.ts (existing, complete file)
import axiosInstance from '@/assets/axios/axios'
import { OwnerType } from '@/assets/types/ownerType'

const promoteOwner = async (userId: string): Promise<OwnerType> => {
    const response = await axiosInstance.post('/v1/admin/settings/owners', { user: { user_id: userId } })
    return response.data
}

export default promoteOwner
```

**New file, adapted (PATCH instead of POST, payload object instead of bare userId, response includes `role`):**
```typescript
import axiosInstance from '@/assets/axios/axios'
import { OwnerType, DemoteOwnerPayload } from '@/assets/types/ownerType'

const demoteOwner = async ({ userId, role }: DemoteOwnerPayload): Promise<OwnerType> => {
    const response = await axiosInstance.patch(`/v1/admin/settings/owners/${userId}`, { user: { role } })
    return response.data
}

export default demoteOwner
```
Note: response type is plain `OwnerType` — `role?: UserRole` is added directly to `OwnerType` (see `ownerType.ts` amendment below) rather than intersected at the call site, per the resolved plan for 35-01 Task 1.

---

### `frontend/src/store/hooks/Admin/Settings/Owners/useDemoteOwner.ts` (new)

**Analog:** `frontend/src/store/hooks/Admin/Settings/Owners/usePromoteOwner.ts` (read in full, 19 lines — exact mirror target)

**Full existing file for reference:**
```typescript
// Source: frontend/src/store/hooks/Admin/Settings/Owners/usePromoteOwner.ts (existing, complete file)
import { useMutation, useQueryClient } from '@tanstack/react-query'
import promoteOwner from '@/assets/api/admin/settings/owners/promoteOwner'
import { ownersKeys, eligibleOwnerUsersKeys } from '@/store/hooks/queryKeys'
import toast from 'react-hot-toast'

const usePromoteOwner = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (userId: string) => promoteOwner(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ownersKeys.all })
            queryClient.invalidateQueries({ queryKey: eligibleOwnerUsersKeys.all })
            toast.success('Owner added successfully')
        }
    })
}

export default usePromoteOwner
```

**New file, adapted (mutationFn takes the payload object directly, no destructuring needed since `demoteOwner` already accepts it):**
```typescript
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
            queryClient.invalidateQueries({ queryKey: eligibleOwnerUsersKeys.all })
            toast.success('Owner role updated successfully')
        }
    })
}

export default useDemoteOwner
```
**Deliberately omit `onError`** — matches `usePromoteOwner`'s intentional omission; the Brain's `try/catch` (`handleDemoteOwner` in `useSettingsAdminContext.ts`) is the sole error-toast surface, per the established Phase 34 TOCTOU-toast convention.

**Query keys used** — both `ownersKeys` and `eligibleOwnerUsersKeys` confirmed present in `frontend/src/store/hooks/queryKeys.tsx` lines 236-242:
```typescript
// Source: frontend/src/store/hooks/queryKeys.tsx lines 236-242 (existing, no new key needed)
export const ownersKeys = {
    all: ['admin', 'settings', 'owners'] as const,
}

export const eligibleOwnerUsersKeys = {
    all: ['admin', 'settings', 'owners', 'eligible'] as const,
}
```

---

### `frontend/src/assets/types/ownerType.ts` (amended)

**Analog:** itself (existing file, read in full, 18 lines)

**Full existing file for reference:**
```typescript
// Source: frontend/src/assets/types/ownerType.ts (existing, complete file)
import UserRole from '@/assets/types/roleType'

export interface OwnerType {
    id: string
    name: string
    email: string
}

export interface EligibleOwnerUserType {
    id: string
    name: string
    email: string
    role: UserRole   // 'admin' | 'agent' only, per backend eligible scope
}

export interface PromoteOwnerPayload {
    user: { user_id: string }   // snake_case body key — matches backend contract verbatim (CLAUDE.md: snake_case params in API)
}
```

**Additions needed (append below `PromoteOwnerPayload`, following its existing style/comment convention):**
```typescript
export type DemoteTargetRole = 'admin' | 'agent' | 'client'   // matches backend DEMOTE_TARGET_ROLES exactly

export interface DemoteOwnerPayload {
    userId: string
    role: DemoteTargetRole
}
```
Note: `demoteOwner.ts`'s response type is `OwnerType` — `role?: UserRole` is added directly to `OwnerType` (resolved during planning; no intersection type at call sites).

---

### `frontend/src/components/ui/radio-group.tsx` (new — hand-authored)

**No exact analog** — this is the first `RadioGroup` component in the codebase. Closest structural analogs for the `forwardRef` + Radix + `cn()` + `displayName` convention: `frontend/src/components/ui/tooltip.tsx` (read in full above, 30 lines) and `select.tsx` (cited in RESEARCH.md, not re-read this session — `tooltip.tsx`'s pattern is sufficient and was read in full this session).

**Convention to follow** (`tooltip.tsx` lines 12-28 — `React.forwardRef` wrapping a Radix primitive, `cn()` for className merge, `displayName` assignment):
```typescript
// Source: frontend/src/components/ui/tooltip.tsx lines 12-28 (existing, convention reference)
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn("...", className)}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName
```

**Full source to hand-author** (per RESEARCH.md Pattern 3, tagged `[ASSUMED]` — reconstructed from training knowledge, not fetched fresh; flag for a visual/behavioral check once rendered, not a legitimacy concern since `@radix-ui/react-radio-group@1.4.3` itself is npm-verified and already installed):
```typescript
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

**Do NOT run** `npx shadcn@latest add radio-group` — generates a Base UI-backed component (`@base-ui/react`), inconsistent with every other `@radix-ui/react-*`-based primitive in `components/ui/`.

## Shared Patterns

### Data flow: Component → Context (Brain) → Hook → API module → Axios
**Source:** `frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts` (whole file structure)
**Apply to:** `RemoveOwnerDialog.tsx`, `AddOwnerDialog.tsx`, `CurrentOwnersList.tsx`, `OwnershipManagementSection.tsx` — none of these call `useDemoteOwner`/`usePromoteOwner` directly; all go through `onConfirm`/`onRemove`/`onPromoteOwner` callback props sourced from the Brain.

### `manage_ownership` permission guard
**Source:** `frontend/src/components/common/guards/Can.tsx` (read in full, 17 lines) + `frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx` lines 36-41 (usage precedent)
```tsx
// Source: frontend/src/components/common/guards/Can.tsx (existing, complete file)
const Can = ({ permission, children, fallback = null }: CanProps) => {
    const allowed = usePermission(permission)
    return <>{allowed ? children : fallback}</>
}
```
**Apply to:** Remove icon buttons in `CurrentOwnersList.tsx` (wrap identically to how the existing "Add Owner" button is wrapped at `OwnershipManagementSection.tsx` line 36-41) and the new `RemoveOwnerDialog` wiring block.

### Destructive button styling
**Source:** `frontend/src/components/ui/button.tsx` lines 14-15 (`destructive` variant, `bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90`) and `frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx` lines 36-39 (real usage of the same class string on an `AlertDialogAction`)
**Apply to:** Remove icon button hover state (`hover:text-destructive hover:bg-destructive/10` — a lighter hover treatment than the full destructive button variant, per D-01/UI-SPEC) and `RemoveOwnerDialog` Step 3's "Confirm Role Change" button (full `bg-destructive` treatment, per UI-SPEC's single-destructive-button-in-the-flow rule).

### Tooltip-wraps-disabled-element via focusable `<span>`
**Source:** `frontend/src/components/ui/tooltip.tsx` (primitive) + `frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx` lines 95-104 (closest existing usage, though on a non-disabled `<span>` icon, not a disabled `Button` — the `tabIndex={0}` + wrapper-span technique for the disabled-`Button` case specifically is new to this phase, required because `buttonVariants` includes `disabled:pointer-events-none` (`button.tsx` line 8), which silently prevents Radix `Tooltip` hover/focus detection on a genuinely disabled native `<button>`).
**Apply to:** `CurrentOwnersList.tsx`'s disabled Remove button for the sole-remaining-owner row (OWN-10).

### Multi-step Dialog via single component + numeric step state
**Source:** `frontend/src/components/view/admin/domainsAdminView/AddDomainWizard.tsx` (whole file, read in full — `useState<1|2|3|4>`, `goNext`/`goBack`, full reset on close, `StepDots`)
**Apply to:** `RemoveOwnerDialog.tsx` (new, 3 steps) and `AddOwnerDialog.tsx` (amended, 2 steps) — both should use plain `useState<N>` + inline `goNext`/`goBack`, not a generic `useWizard()` abstraction (RESEARCH.md "Don't Hand-Roll" explicitly rejects introducing one for a 2-3 step case).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/src/components/ui/radio-group.tsx` | component (shadcn UI primitive) | — | No `RadioGroup` exists anywhere in this codebase yet — this is the first. Convention (forwardRef + Radix + `cn()`) is well-established via `tooltip.tsx`/`select.tsx`, but the component's own source is hand-authored per RESEARCH.md Pattern 3, not copied from an existing local file. Use the full source block above as-is; it is already vetted (Radix package npm-verified, `[ASSUMED]` tag applies only to exact className/structure fidelity, not functional correctness). |

## Metadata

**Analog search scope:** `frontend/src/components/view/admin/settingsAdminView/`, `frontend/src/components/view/admin/domainsAdminView/`, `frontend/src/containers/adminBoard/settingsAdminBoard/`, `frontend/src/store/hooks/Admin/Settings/Owners/`, `frontend/src/assets/api/admin/settings/owners/`, `frontend/src/assets/types/`, `frontend/src/components/ui/`, `frontend/src/components/common/guards/`, `frontend/src/store/hooks/Auth/`, `frontend/src/store/reducers/`, `frontend/src/store/hooks/Users/`
**Files scanned:** 18 (all read in full this session — none exceeded 320 lines, no offset/limit truncation was needed)
**Pattern extraction date:** 2026-07-13
