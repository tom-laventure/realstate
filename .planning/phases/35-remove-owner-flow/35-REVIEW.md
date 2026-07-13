---
phase: 35-remove-owner-flow
reviewed: 2026-07-13T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - frontend/package.json
  - frontend/src/assets/api/admin/settings/owners/demoteOwner.ts
  - frontend/src/assets/types/ownerType.ts
  - frontend/src/components/ui/radio-group.tsx
  - frontend/src/components/view/admin/common/StepDots.tsx
  - frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx
  - frontend/src/components/view/admin/settingsAdminView/CurrentOwnersList.tsx
  - frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx
  - frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx
  - frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx
  - frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.test.tsx
  - frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts
  - frontend/src/store/hooks/Admin/Settings/Owners/useDemoteOwner.test.tsx
  - frontend/src/store/hooks/Admin/Settings/Owners/useDemoteOwner.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
resolution: critical_fixed
---

## Resolution

Applied manually (not via `/gsd:code-review --fix`) in commit `c8297c6`:

- **CR-01, CR-02 (fixed):** Both dialogs now reset wizard state via a `useEffect` on every transition to `open`, covering parent-driven closes (`setDemoteTarget(null)` / `setIsAddOwnerOpen(false)`) as well as user-driven cancels.
- **WR-01 (fixed):** Both dialogs now ignore Escape/outside-click while `isSubmitting`.
- **WR-02 (fixed):** `RemoveOwnerDialog` requires an explicit role selection before "Continue to Review" enables (no more silent default to Admin).
- **WR-03 (partially addressed):** Added `RemoveOwnerDialog.test.tsx` / `AddOwnerDialog.test.tsx` covering the CR-01/CR-02 regression specifically (reopen resets to step 1) and the WR-02 gate. Broader component test coverage beyond these two behaviors was not added.
- **WR-04 (fixed):** `StepDots` now has `role="img"` + `aria-label="Step X of Y"`.
- **WR-05 (deferred):** `useDemoteOwner.test.tsx`'s `toString()`-based onError assertion was left as-is.
- **IN-01 (deferred):** `<Can>` inverted-usage pattern in `OwnershipManagementSection.tsx` left as-is.
- **IN-02 (fixed):** Softened the self-demote copy in `RemoveOwnerDialog` step 3 from "redirected to the permissions available to {role}s" to "immediately... limited to the permissions available to {role}s" — verified the Settings route (`readTierRoles`, `roles={['owner','admin']}`) does NOT redirect on demote-to-admin, so the original copy overpromised.
- **IN-03 (no action needed):** Billing TODO is an intentional forward-looking placeholder; no roadmap gap.

# Phase 35: Code Review Report

**Reviewed:** 2026-07-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the Remove Owner flow (multi-step `RemoveOwnerDialog`, retrofitted `AddOwnerDialog`, `CurrentOwnersList`, `OwnershipManagementSection`, the demote API/mutation hook, and the settings admin context/tests). The backend contract (`DemoteTargetRole`, uid-based id matching, last-owner guard) is consistent with `owners_controller.rb`, and the `manage_ownership` permission gating matches the backend's `require_owner!` restriction, so no authorization gap was found.

However, I traced the actual runtime behavior of Radix's controlled `Dialog` (via `useControllableState`, confirmed directly in `node_modules/@radix-ui/react-use-controllable-state`) and found that **both multi-step dialogs never reset their internal wizard state when the parent programmatically closes them after a successful mutation**, because `onOpenChange` is only invoked by Radix in response to internal user interactions (Escape, outside click, close button) — not when the controlling `open` prop is flipped externally by the parent. This defeats the entire purpose of the deliberate, multi-step confirmation flow the phase was built to deliver: on the next open, the dialog can resume mid-wizard with stale selections, skipping the informational/review steps. This is classified as two BLOCKER findings (one per dialog). Several supporting warnings (no submit-time close guard, no default-role forcing, missing component tests, missing a11y semantics on `StepDots`) compound the risk that this bug shipped undetected, since no component-level tests exist for either dialog.

## Critical Issues

### CR-01: RemoveOwnerDialog does not reset wizard state after a successful demote (stale step/role shown on reopen)

**File:** `frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx:28-46`
**Issue:** `step` and `selectedRole` are only reset inside the component's own `handleOpenChange` (lines 33-39), which is wired to Radix's `onOpenChange`. Radix's `Dialog.Root` (confirmed in `node_modules/@radix-ui/react-use-controllable-state/dist/index.js`) only invokes `onChange`/`onOpenChange` when its *internal* `setValue` is called (Escape, outside click, Close button) — never when the parent re-renders with a new controlled `open` value. The success path lives entirely in the parent: `useSettingsAdminContext.ts:50` calls `setDemoteTarget(null)` on success, and `OwnershipManagementSection.tsx:87` derives `open={demoteTarget !== null}`. This transition closes the dialog by flipping the `open` prop directly — `RemoveOwnerDialog`'s own `handleOpenChange` (and thus the `setStep(1)` / `setSelectedRole('admin')` reset) never runs.

Because `RemoveOwnerDialog` is always mounted (rendered unconditionally inside `OwnershipManagementSection`, not `{condition && <RemoveOwnerDialog/>}`), its `useState` persists across opens. The next time an admin clicks "Remove owner access" for a *different* owner, the dialog reopens already at `step === 3` ("Confirm Role Change") with the previously selected role, silently skipping the "What this means" and "Choose a new role" steps. An admin could confirm a destructive, hard-to-reverse role change without ever reviewing the explanation or actively picking a role for the new target.

**Fix:**
```tsx
import { useEffect, useState } from 'react'
// ...
const RemoveOwnerDialog = ({ open, onOpenChange, target, currentUserId, onConfirm, isSubmitting }: RemoveOwnerDialogProps) => {
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [selectedRole, setSelectedRole] = useState<DemoteTargetRole>('admin')

    // Reset whenever the dialog transitions open (covers both user-driven
    // cancels AND parent-driven closes after a successful mutation).
    useEffect(() => {
        if (open) {
            setStep(1)
            setSelectedRole('admin')
        }
    }, [open])
    // ...
}
```

### CR-02: AddOwnerDialog does not reset wizard state after a successful promotion (stale step/user shown on reopen)

**File:** `frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx:34-45`
**Issue:** Same root cause as CR-01. `selectedUser` and `step` are only reset in `handleOpenChange` (lines 39-45), wired to Radix's `onOpenChange`. On success, `useSettingsAdminContext.ts:35` calls `setIsAddOwnerOpen(false)` directly (parent-controlled close), which never triggers `AddOwnerDialog`'s own `handleOpenChange`. Since `AddOwnerDialog` is always mounted, the next time "Add Owner" is clicked, the dialog can reopen at `step === 2` ("Confirm Owner Promotion") showing the *previously promoted* user, instead of starting fresh at the search step.

**Fix:**
```tsx
import { useEffect, useState } from 'react'
// ...
const AddOwnerDialog = ({ open, onOpenChange, eligibleUsers, isLoadingEligible, onConfirm, isSubmitting }: AddOwnerDialogProps) => {
    const [comboOpen, setComboOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState<EligibleOwnerUserType | null>(null)
    const [step, setStep] = useState<1 | 2>(1)

    useEffect(() => {
        if (open) {
            setSelectedUser(null)
            setStep(1)
        }
    }, [open])
    // ...
}
```

## Warnings

### WR-01: Dialogs can be dismissed mid-submission with no guard

**File:** `frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx:51-52`, `frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx:53-54`
**Issue:** Neither dialog passes `onEscapeKeyDown`/`onPointerDownOutside`/`onInteractOutside` handlers to `DialogContent`. While `isSubmitting` is true (a demote/promote request in flight), a user can press Escape or click outside to close the modal mid-request. The mutation still completes and Redux/toast state update correctly, but the user loses visual continuity of the action they just triggered, and (for `RemoveOwnerDialog`) can immediately reopen the dialog for another target while the prior request is still resolving.
**Fix:** Guard the close handlers while submitting, e.g. on `DialogContent`:
```tsx
<DialogContent
  className="sm:max-w-md"
  onEscapeKeyDown={(e) => { if (isSubmitting) e.preventDefault() }}
  onPointerDownOutside={(e) => { if (isSubmitting) e.preventDefault() }}
>
```

### WR-02: RemoveOwnerDialog preselects "Admin" without requiring a deliberate choice

**File:** `frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx:29`
**Issue:** `selectedRole` defaults to `'admin'` and "Continue to Review" (step 2 → 3) is never disabled based on an explicit selection. An admin can tab/click through steps 1 → 2 → 3 without ever touching the radio group and confirm demoting an owner to Admin by default. Given CLAUDE.md's mandate that "Interactions must be deliberate" and this is an irreversible, security-sensitive role change, no role should be silently preselected.
**Fix:** Initialize `selectedRole` to a sentinel (e.g. `null`), require an explicit `RadioGroupItem` selection before enabling the "Continue to Review" button, and only default to a real `DemoteTargetRole` once the user picks one.

### WR-03: No component-level tests for AddOwnerDialog or RemoveOwnerDialog

**File:** `frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx`, `frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx`
**Issue:** Test coverage for this phase exists only at the hook (`useDemoteOwner.test.tsx`) and context (`useSettingsAdminContext.test.tsx`) level. Neither dialog component has a dedicated test file, so the stale-wizard-state bug (CR-01/CR-02) — a defect in component-local state management, not in the hooks/context — was not, and could not have been, caught by the existing test suite.
**Fix:** Add `AddOwnerDialog.test.tsx` / `RemoveOwnerDialog.test.tsx` covering: (a) reopening after a simulated successful `onConfirm` resets to step 1, and (b) reopening for a different `target`/eligible user does not resume mid-wizard.

### WR-04: StepDots has no accessible semantics

**File:** `frontend/src/components/view/admin/common/StepDots.tsx:10-29`
**Issue:** The step indicator is purely visual (`<span>` elements with only background-color differences). There is no `aria-label`, `role="progressbar"`, or equivalent text alternative conveying "Step X of Y" to screen reader users navigating what is otherwise a fully keyboard/label-accessible wizard (`RadioGroup`/`Label` pairing is done correctly elsewhere). This conflicts with the project's stated accessibility baseline.
**Fix:**
```tsx
<div className="flex items-center gap-2 mt-2" role="img" aria-label={`Step ${currentStep} of ${totalSteps}`}>
```

### WR-05: Fragile `toString()`-based test assertion

**File:** `frontend/src/store/hooks/Admin/Settings/Owners/useDemoteOwner.test.tsx:67-70`
**Issue:** `expect(source).not.toMatch(/onError/)` asserts against the stringified source of the hook function rather than its observable behavior (e.g., dispatching a duplicate error toast, or verifying `mutation.isError` handling). This is brittle — a harmless rename (e.g. a comment mentioning "onError") produces a false failure, while restructuring the mutation to add error handling through a differently-named wrapper would produce a false pass without ever exercising real error behavior.
**Fix:** Replace with a behavioral test, e.g. trigger a failing PATCH via MSW and assert `toast.error` was *not* called by this hook (since the Brain owns it), rather than string-matching source code.

## Info

### IN-01: `<Can>` used only to render an empty span, real content lives in `fallback`

**File:** `frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx:71-73`
**Issue:** `<Can permission="manage_ownership" fallback={<RolePermissions ... />}><span /></Can>` renders nothing when the user has the permission and only ever surfaces content via the `fallback` prop. This inverted usage is confusing to read/maintain — a future editor is likely to "clean up" the apparently-dead `<span />` without realizing the `fallback` is the intended path.
**Fix:** Express the intent directly, e.g. `{!usePermission('manage_ownership') && <RolePermissions roles={['owner', 'admin', 'agent']} />}`, or add a comment explaining the inversion.

### IN-02: Self-demote copy promises a "redirect" that this diff does not implement

**File:** `frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx:106-110`
**Issue:** The step-3 copy states "You will lose owner access and be redirected to the permissions available to {selectedRole}s," but `useSettingsAdminContext.ts`'s `handleDemoteOwner` only patches Redux state (`account.membership`, `activeBrokerage`) — there is no `navigate()` call in this diff. If no other route guard reactively redirects on this Redux change, the copy overpromises actual behavior (user stays on the same admin settings page with stale action buttons until Redux propagates through permission checks).
**Fix:** Verify the existing route guard (`RequireRole`/`ProtectedRoute`, outside this diff's scope) actually reacts to the Redux patch and navigates away when the demoted role no longer has `access_admin_panel`; otherwise soften the copy to avoid promising navigation that doesn't happen.

### IN-03: Billing section placeholder TODO

**File:** `frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx:30`
**Issue:** `{/* TODO: Add billing management section */}` is a fine forward-looking placeholder (consistent with `AddOwnerDialog`'s "They will also manage billing once that section becomes available" copy), but flagging per standard TODO-scan practice to ensure it's tracked in the roadmap rather than forgotten.
**Fix:** Confirm a roadmap/backlog item exists for the billing section; no code change required.

---

_Reviewed: 2026-07-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
