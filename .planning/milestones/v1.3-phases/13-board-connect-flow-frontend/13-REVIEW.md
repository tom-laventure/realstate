---
phase: 13-board-connect-flow-frontend
status: clean
files_reviewed: 2
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
resolved:
  critical: 1
  resolved_in: "13-02"
---

# Phase 13 Code Review

## Critical

### C-01 — Server error silently discarded in test-board-info step ✓ RESOLVED in 13-02

**File:** `frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx`

`handleSubmit` writes to `serverError` in its `catch` block for all step paths, including the test-board path. The `test-board-info` step JSX contains no `{serverError && ...}` render block. If the credential POST fails — network error, backend 422/500 — `isSubmitting` resets to `false` and the Connect button re-enables, but the user sees no error message. Silent failure. The `credentials` step renders `serverError` correctly; the omission is specific to the new step.

**Fix:** Add `{serverError && <p className="text-sm text-destructive">{serverError}</p>}` to the `test-board-info` JSX before the button row. Also clear `serverError` in the Back button `onClick` to prevent stale errors persisting on re-navigation.

## Clean Areas

- `boardType.ts`: All changes correct. `isTestBoard: boolean` non-optional is the right choice. Optional credentials don't break the real-board flow. `BoardCredentialType` unchanged.
- `handleSubmit` guard: `selectedBoard?.isTestBoard ?? false` with fallback is defensive. Conditional payload correctly omits credential fields for test boards.
- Step routing: `select` Next button correctly branches on `isTestBoard`. `ConnectBoardStep` union expands correctly. Credentials step JSX is untouched.
- Import: `Info` correctly added to lucide-react import.
