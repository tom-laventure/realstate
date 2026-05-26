---
phase: 17
status: all_fixed
findings_in_scope: 2
fixed: 2
skipped: 0
iteration: 1
fixed_at: 2026-05-25T00:00:00Z
review_path: .planning/phases/17-brokerage-selection-post-create-redirect/17-REVIEW.md
---

## Code Review Fix — Phase 17

**Fixed at:** 2026-05-25
**Source review:** `.planning/phases/17-brokerage-selection-post-create-redirect/17-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 2
- Fixed: 2
- Skipped: 0

### Fixes Applied

### CR-001: BrokerageSelection renders broken empty UI on direct URL navigation

**File modified:** `frontend/src/containers/portal/BrokerageSelection.tsx`
**Commit:** `43c86b1`
**Applied fix:** Added `isLoading` state and a `length === 0` branch to the `useEffect` that mirrors the D-13 pattern from `PortalShell`. On direct URL / bookmark / hard reload, the component now re-fetches admin brokerages via `useFetchAdminBrokerages`, dispatches `setAdminBrokerages`, auto-redirects if only one brokerage is returned, and falls back to `/no-access` on error. A spinner is returned whenever `isLoading`, `length === 0`, or `length === 1` so the empty selection card can never appear.

### CR-002: PortalShell async fetch has no cleanup — stale dispatch fires on rapid brokerageId change

**File modified:** `frontend/src/containers/portal/PortalShell.tsx`
**Commit:** `393fc26`
**Applied fix:** Added `let cancelled = false` before `setIsLoading(true)`, guarded all three callbacks (`.then`, `.catch`, `.finally`) with `if (cancelled) return` / `if (!cancelled)` checks, and added `return () => { cancelled = true }` as the effect cleanup function. If `brokerageId` changes while a fetch is in-flight the stale callbacks are silenced, preventing wrong-brokerage dispatch and spurious navigation.

### Skipped

None

---

_Fixed: 2026-05-25_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
