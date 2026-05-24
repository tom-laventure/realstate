# Phase 13: Board Connect Flow — Frontend — Research

**Researched:** 2026-05-23
**Domain:** React / TypeScript — multi-step dialog, conditional flow, shadcn/ui
**Confidence:** HIGH

---

## Summary

Phase 13 has already been executed once (13-01-PLAN.md + 13-01-SUMMARY.md). The implementation is substantively complete: both files (`boardType.ts` and `ConnectBoardDialog.tsx`) were modified correctly and the plan's 10 success criteria were satisfied per the verification report (5/5 must-have truths verified).

However, re-planning is required because a code review (`13-REVIEW.md`) discovered one critical defect: the `test-board-info` step silently swallows server errors — `handleSubmit` writes to `serverError` in its catch block but the `test-board-info` JSX has no `{serverError && ...}` render block. The credentials step renders errors correctly; only the new step is defective. The fix is a two-line addition: render the error paragraph before the button row, and clear `serverError` in the Back button's `onClick`.

Two human UAT tests remain pending (`13-HUMAN-UAT.md`): browser-based verification that (1) the test-board-info step renders with no credential fields, and (2) clicking Connect completes end-to-end. These cannot be resolved by static analysis.

**Primary recommendation:** Plan a single follow-up task to fix C-01 (silent server error in test-board-info step) by adding `{serverError && <p className="text-sm text-destructive">{serverError}</p>}` before the action row in the `test-board-info` JSX block, and clearing `serverError` in the Back button onClick. No other changes are needed to the implementation.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Test board detection (isTestBoard) | Frontend Client | — | `isTestBoard` is consumed from the boards[] prop, which comes from the backend API; detection logic lives in the dialog component |
| Conditional step routing | Frontend Client | — | Client-side state machine; `ConnectBoardStep` union and `setStep` calls are browser-side React state |
| Credential-free payload construction | Frontend Client | API/Backend | Client omits retsUsername/retsPassword; backend (BOARD-04, Phase 12) enforces server-side |
| Server error display | Frontend Client | — | `serverError` state drives `text-destructive` paragraph in the dialog JSX |

---

## Existing Implementation Inventory

This is not a greenfield phase. The following is a complete inventory of what was already implemented in plan 13-01.

### Files Already Modified

**`frontend/src/assets/types/boardType.ts`** — COMPLETE, no further changes needed

```ts
// Current state (verified by direct file read)
export interface RealEstateBoardType {
    id: string
    name: string
    shortCode: string
    region: string | null
    active: boolean
    isTestBoard: boolean   // added Phase 13
    createdAt: string
}

export interface CreateBoardCredentialPayload {
    realEstateBoardId: string
    retsUsername?: string   // optional — omitted for test boards
    retsPassword?: string   // optional — omitted for test boards
}
```

**`frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx`** — MOSTLY COMPLETE, one defect (C-01)

What is correctly implemented:
- `Info` icon imported from `lucide-react` alongside `CheckCircle, ChevronLeft, Loader2`
- `ConnectBoardStep` union expanded to `'select' | 'test-board-info' | 'credentials' | 'success'`
- Select step Next button branches on `selectedBoard?.isTestBoard`: true → `setStep('test-board-info')`, false → `setStep('credentials')`
- `handleSubmit` guard: checks `!selectedBoardId` first; then `!isTestBoard && (!username || !password)` so test boards bypass credential validation
- `handleSubmit` payload: `isTestBoard ? { realEstateBoardId } : { realEstateBoardId, retsUsername, retsPassword }`
- `test-board-info` JSX block: blue notice `border-blue-200 bg-blue-50 text-blue-800`, `Info` icon, exact copy "This board contains sample listings for development — no real credentials required."
- `test-board-info` Back button: clears `serverError` and sets step to `'select'` (implementation added a `setServerError(null)` call beyond the plan spec — this is correct defensive behaviour)
- `test-board-info` Connect button: calls `handleSubmit`, shows `Loader2` spinner when `isSubmitting`

What is DEFECTIVE (C-01 from 13-REVIEW.md):
- The `test-board-info` JSX block has **no `{serverError && ...}` render block** between the blue notice and the action row
- If `handleSubmit` throws (network error, backend 422/500), the catch block sets `serverError` but nothing renders it on this step
- The user sees the Connect button re-enable but receives zero feedback on what went wrong
- The `credentials` step renders `serverError` correctly at line 194 — the omission is specific to `test-board-info`

---

## The Single Defect: C-01 Fix Specification

**Source:** `13-REVIEW.md` — finding C-01

**Location:** `ConnectBoardDialog.tsx`, inside `{step === 'test-board-info' && (...)}` block

**Current JSX structure (test-board-info step body):**
```tsx
<div className="space-y-4 pt-2">
    <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800 flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>This board contains sample listings for development — no real credentials required.</span>
    </div>
    {/* serverError paragraph is MISSING here */}
    <div className="flex items-center justify-between pt-1">
        ...
    </div>
</div>
```

**Required fix — insert before the action row `<div className="flex...">`:**
```tsx
{serverError && (
    <p className="text-sm text-destructive">{serverError}</p>
)}
```

The Back button `onClick` already clears `serverError` (the implementation added `setServerError(null)` to the Back button — this pre-existing behaviour is correct and no change is needed there).

**Pattern match:** The credentials step at line 194 already has identical error rendering — copy the same pattern into the test-board-info step.

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React | 18.x | Component rendering | Installed [VERIFIED: package.json] |
| TypeScript | — | Type safety | Installed [VERIFIED: tsc run] |
| shadcn/ui | new-york/zinc | Dialog, Button, Input, Label, Select | Installed [VERIFIED: 13-UI-SPEC.md] |
| lucide-react | — | Icons (Info, ChevronLeft, Loader2, CheckCircle) | Installed [VERIFIED: ConnectBoardDialog.tsx imports] |
| Tailwind CSS | — | Utility classes | Installed [VERIFIED: class usage in component] |

**No new dependencies required for this phase.** All needed libraries are already installed.

---

## Architecture Patterns

### Dialog State Machine (established in 13-01)

```
'select' ──isTestBoard=true──► 'test-board-info' ──Connect──► 'success'
         ──isTestBoard=false──► 'credentials'     ──Connect──► 'success'
```

Reset on dialog close: `step → 'select'`, all input state cleared, `serverError → null`.

### Error Display Pattern (project-established)

```tsx
// Used in credentials step (line 194) — must be replicated in test-board-info step
{serverError && (
    <p className="text-sm text-destructive">{serverError}</p>
)}
```

This is the canonical error display pattern for this dialog. [VERIFIED: direct file read of ConnectBoardDialog.tsx line 194]

### Data Flow (already wired)

```
BoardRegistrations.tsx
  boards: RealEstateBoardType[]  ──prop──►  ConnectBoardDialog
                                              selectedBoard = boards.find(b => b.id === selectedBoardId)
                                              selectedBoard?.isTestBoard  ──drives──► step routing + payload
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error display styling | Custom error component | `text-sm text-destructive` pattern from credentials step | Already established in this file; consistency is the goal |
| Dialog state management | External state library | `useState` local to dialog | All dialog state is already local; no external store needed |

---

## Common Pitfalls

### Pitfall 1: Stale serverError on step navigation (already partially mitigated)

**What goes wrong:** User hits an error on test-board-info, clicks Back, selects a different board, clicks Next again — the old error message from the previous attempt is still visible.

**Why it happens:** `serverError` persists in component state across step transitions unless explicitly cleared.

**How to avoid:** The Back button in `test-board-info` already calls `setServerError(null)` (the implementation added this defensively). When adding the error render block, no additional clearing logic is needed.

**Warning signs:** If the error paragraph is visible immediately when arriving at a step (before any submit attempt).

### Pitfall 2: TypeScript tsconfig errors masking real errors

**What goes wrong:** The frontend tsconfig has two pre-existing errors (`moduleResolution` and `resolveJsonModule`) that appear in every `tsc --noEmit` run. A careless verification step may count output lines instead of inspecting which errors relate to the changed files.

**Why it happens:** Pre-existing tsconfig configuration issue, not a source file issue. Unrelated to Phase 13 changes.

**How to avoid:** When verifying `tsc --noEmit`, check that errors reference `tsconfig.json` (config issue), not source `.ts`/`.tsx` files. Zero source-file errors is the correct pass condition.

**Warning signs:** `tsconfig.json(13,25): error TS6046` in tsc output — this is the known pre-existing error; it does not indicate a Phase 13 regression.

---

## Code Examples

### Correct error render block (copy from credentials step)

```tsx
// Source: ConnectBoardDialog.tsx line 194 (credentials step)
{serverError && (
    <p className="text-sm text-destructive">{serverError}</p>
)}
```

Place this immediately before `<div className="flex items-center justify-between pt-1">` in the test-board-info step body.

### Final test-board-info body structure after fix

```tsx
<div className="space-y-4 pt-2">
    <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800 flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>This board contains sample listings for development — no real credentials required.</span>
    </div>
    {serverError && (
        <p className="text-sm text-destructive">{serverError}</p>
    )}
    <div className="flex items-center justify-between pt-1">
        <button
            type="button"
            onClick={() => { setStep('select'); setServerError(null) }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
            <ChevronLeft className="h-4 w-4" />
            Back
        </button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect
        </Button>
    </div>
</div>
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

All claims in this research were verified by direct file read, tsc output, or official project artifacts (REVIEW.md, VERIFICATION.md, SUMMARY.md). No assumed claims.

**This table is empty:** All claims verified or cited from project artifacts.

---

## Open Questions

1. **Human UAT tests remain pending**
   - What we know: Both browser-based UAT tests in `13-HUMAN-UAT.md` are status `[pending]`
   - What's unclear: Whether the user has run a browser session to verify the dialog renders correctly
   - Recommendation: The planner should include a note that the new plan's task will resolve C-01 but that browser UAT tests from `13-HUMAN-UAT.md` are still required post-execution

---

## Phase Requirements

<phase_requirements>

| ID | Description | Research Support |
|----|-------------|------------------|
| BOARD-05 | In the `ConnectBoardDialog`, selecting a test board skips the credentials step and shows an information notice ("This board contains sample listings for development — no real credentials required") | Implementation is 95% complete from 13-01. The defect (C-01) is the only gap: the notice exists and routing is correct, but server errors from the submit action are not displayed to the user. Fixing C-01 brings BOARD-05 to full satisfaction. |

</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- Icons: `lucide-react` only — `Info` is already imported in `ConnectBoardDialog.tsx`
- Styling: Tailwind CSS utility classes only — blue notice uses static Tailwind classes per UI-SPEC design decision
- Never call axios or API functions directly inside a component — `onSubmit` prop already abstracts this
- Define domain interfaces in `assets/types/` — `boardType.ts` is the correct location; already updated
- Use `@` alias for all frontend imports — all imports in ConnectBoardDialog use `@/...`
- Frontend work done as a senior UI/UX engineer: error states must never appear broken — C-01 violates this; silent failures are explicitly prohibited

---

## Environment Availability

Step 2.6: SKIPPED — this phase requires no external dependencies beyond the already-installed React/TypeScript/Tailwind/shadcn toolchain.

---

## Validation Architecture

`workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`. Validation Architecture section omitted per instructions.

---

## Security Domain

| ASVS Category | Applies | Control |
|---------------|---------|---------|
| V5 Input Validation | Yes — partial | `handleSubmit` guard checks `!selectedBoardId` before submit; isTestBoard conditional prevents credential bypass |
| V4 Access Control | Informational | `isTestBoard` sourced from authenticated API response (admin-only endpoint); client-side check is defense-in-depth only; backend enforces server-side (BOARD-04) |

No new attack surface introduced by the C-01 fix. Adding the error display paragraph is purely UI — it reads existing state, introduces no user input, and makes no network calls.

---

## Sources

### Primary (HIGH confidence)

- `frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx` — direct file read, current implementation state
- `frontend/src/assets/types/boardType.ts` — direct file read, current type definitions
- `.planning/phases/13-board-connect-flow-frontend/13-REVIEW.md` — code review findings, C-01 defect specification
- `.planning/phases/13-board-connect-flow-frontend/13-VERIFICATION.md` — verification report, must-have truth status
- `.planning/phases/13-board-connect-flow-frontend/13-01-SUMMARY.md` — execution summary, decisions made
- `.planning/phases/13-board-connect-flow-frontend/13-UI-SPEC.md` — UI design contract, component specs
- `.planning/phases/13-board-connect-flow-frontend/13-HUMAN-UAT.md` — UAT test status
- `.planning/config.json` — nyquist_validation: false confirmed

---

## Metadata

**Confidence breakdown:**
- Existing implementation state: HIGH — verified by direct file reads
- Defect identification (C-01): HIGH — confirmed in 13-REVIEW.md and cross-checked against file
- Fix specification: HIGH — pattern exists in same file at credentials step (line 194)
- Pitfalls: HIGH — tsconfig issue confirmed by tsc run; stale error confirmed by implementation inspection

**Research date:** 2026-05-23
**Valid until:** Stable — file contents confirmed by read; no external dependencies; no library version concerns
