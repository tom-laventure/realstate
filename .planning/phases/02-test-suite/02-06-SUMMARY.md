---
phase: 02-test-suite
plan: "06"
subsystem: testing
tags: [vitest, testing-library, react, aws-amplify, redux, react-router, jsdom, frontend]

# Dependency graph
requires:
  - phase: 02-05
    provides: Vitest 4.x + jsdom + renderWithProviders + MSW server infrastructure
provides:
  - GoogleSignInButton minimal skeleton component (TEST-09 target)
  - ProtectedRoute auth guard test suite (2 tests)
  - RequireRole RBAC guard test suite (3 tests)
  - GoogleSignInButton OAuth flow test suite (2 tests)
  - 7/7 frontend tests passing via npm run test --run
affects:
  - Phase 4: GoogleSignInButton is a known stub — Phase 4 will replace with polished UI
  - frontend test suite: all subsequent test plans build on this test base

# Tech tracking
tech-stack:
  added: []
  patterns:
    - vi.hoisted for pre-declaring mock functions referenced in vi.mock factories
    - aws-amplify/auth and aws-amplify/utils mocked as separate sub-paths (v6 pattern)
    - Hub.listen callback captured via vi.hoisted closure for Hub event simulation
    - execArgv --experimental-require-module for jsdom 27.x ESM compatibility in Node 22

key-files:
  created:
    - frontend/src/components/auth/GoogleSignInButton.tsx
    - frontend/src/components/auth/GoogleSignInButton.test.tsx
    - frontend/src/components/common/guards/ProtectedRoute.test.tsx
    - frontend/src/components/common/guards/RequireRole.test.tsx
  modified:
    - frontend/vitest.config.ts

key-decisions:
  - "02-06: vi.hoisted used for mock function declarations — vi.mock factories are hoisted before const declarations, causing ReferenceError without vi.hoisted"
  - "02-06: execArgv: ['--experimental-require-module'] in vitest.config.ts — Node 22.9+ flag enables require() of ESM modules; jsdom 27.x depends on @csstools/css-calc (ESM-only) via cssstyle → @asamuzakjp/css-color"

patterns-established:
  - "ESM-only dependency in jsdom test environment: add --experimental-require-module to vitest execArgv"
  - "vi.mock with hoisted closures: use vi.hoisted to create mutable refs for Hub.listen callback capture"
  - "Amplify v6 mocking: always mock 'aws-amplify/auth' and 'aws-amplify/utils' as sub-paths, never root 'aws-amplify'"

requirements-completed:
  - TEST-08
  - TEST-09

# Metrics
duration: 10min
completed: 2026-05-03
tasks_completed: 2
files_created: 4
files_modified: 1
---

# Phase 2 Plan 06: Auth Guard + GoogleSignInButton Tests Summary

**GoogleSignInButton minimal component + 7 tests (ProtectedRoute, RequireRole, GoogleSignInButton) with vi.hoisted mock pattern and --experimental-require-module ESM compatibility fix**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-03T00:00:00Z
- **Completed:** 2026-05-03T00:10:31Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `GoogleSignInButton.tsx` minimal skeleton: `signInWithRedirect({ provider: 'Google' })` on click, Hub listener calls `fetchAuthSession` on `signInWithRedirect` event
- Wrote `ProtectedRoute.test.tsx` (2 tests): unauthenticated localStorage triggers redirect to `/auth/login`; valid JWT token renders protected outlet
- Wrote `RequireRole.test.tsx` (3 tests): matching role renders children; non-matching role redirects to `redirectTo`; `account.id = ''` renders null (unloaded user guard)
- Wrote `GoogleSignInButton.test.tsx` (2 tests): click calls `signInWithRedirect({ provider: 'Google' })`; Hub `signInWithRedirect` event triggers `fetchAuthSession`
- All 7 frontend tests pass: `npm run test -- --run` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GoogleSignInButton component** - `72b358b` (feat)
2. **Task 2: Write ProtectedRoute, RequireRole, GoogleSignInButton tests** - `1ab55c3` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/components/auth/GoogleSignInButton.tsx` - Minimal testable OAuth button skeleton; Phase 4 replacement target
- `frontend/src/components/auth/GoogleSignInButton.test.tsx` - 2 tests: click and Hub event
- `frontend/src/components/common/guards/ProtectedRoute.test.tsx` - 2 tests: unauthenticated redirect, authenticated render
- `frontend/src/components/common/guards/RequireRole.test.tsx` - 3 tests: role match, role mismatch, unloaded user
- `frontend/vitest.config.ts` - Added `execArgv: ['--experimental-require-module']` for jsdom 27.x ESM compatibility

## Decisions Made

1. **vi.hoisted for mock declarations**: `vi.mock` calls are hoisted to the top of the file before `const`/`let` declarations. Using `const mockFn = vi.fn()` outside `vi.hoisted` causes `ReferenceError: Cannot access before initialization`. Fix: wrap all mock function declarations and Hub callback state in `vi.hoisted(() => ({ ... }))`.

2. **execArgv: ['--experimental-require-module'] for Node 22.9+**: jsdom 27.x depends on `@csstools/css-calc` (ESM-only, no CJS build) via `cssstyle → @asamuzakjp/css-color`. The Vitest `forks` pool launches Node child processes that try to `require()` this package, throwing `ERR_REQUIRE_ESM`. Node 22.9+ ships `--experimental-require-module` which allows `require()` of ES modules. This is the minimal fix — no package downgrade or lockfile manipulation needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vi.hoisted mock pattern for GoogleSignInButton test**
- **Found during:** Task 2 verification (running `npm run test -- --run`)
- **Issue:** `vi.mock` factory is hoisted to top of file before `const mockSignInWithRedirect = vi.fn()` is initialized; throws `ReferenceError: Cannot access 'mockSignInWithRedirect' before initialization`
- **Fix:** Rewrote `GoogleSignInButton.test.tsx` to use `vi.hoisted(() => ({ ... }))` for all mock function declarations. Hub callback is stored via a closure with getter/setter functions to avoid closure capture issues.
- **Files modified:** `frontend/src/components/auth/GoogleSignInButton.test.tsx`
- **Verification:** `npm run test -- --run` passes 7/7 tests
- **Committed in:** `1ab55c3` (Task 2 commit)

**2. [Rule 3 - Blocking] execArgv --experimental-require-module for jsdom 27.x ESM**
- **Found during:** Task 2 verification (first test run)
- **Issue:** jsdom 27.x pulls `@csstools/css-calc` (ESM-only) through `cssstyle → @asamuzakjp/css-color`. Vitest `forks` pool spawns Node child processes which call `require()` on this ESM-only package, throwing `ERR_REQUIRE_ESM` before any test runs.
- **Fix:** Added `execArgv: ['--experimental-require-module']` to `vitest.config.ts` test block. This top-level Vitest 4 option passes the Node flag to all fork workers. Node 22.9+ supports this flag natively.
- **Files modified:** `frontend/vitest.config.ts`
- **Verification:** Workers start successfully; experimental warning appears in output but tests run
- **Committed in:** `1ab55c3` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking)
**Impact on plan:** Both auto-fixes necessary for tests to run. No scope creep. GoogleSignInButton test file was rewritten with vi.hoisted pattern (plan example used plain `const` which is incompatible with vi.mock hoisting).

## Issues Encountered

- jsdom 27.x + Vitest 4.x ESM incompatibility: `@csstools/css-calc` is ESM-only, `@asamuzakjp/css-color` CJS dist tries to `require()` it. Fixed via `--experimental-require-module`.
- `vi.mock` hoisting: plan test code used `const mockFn = vi.fn()` outside `vi.hoisted`, incompatible with Vitest's hoisting behavior. Fixed via `vi.hoisted`.

## Known Stubs

`frontend/src/components/auth/GoogleSignInButton.tsx` is an intentional stub. The TODO Phase 4 comment is in the file. It has no visual polish, no loading state, no error handling, and no POST /v1/sessions integration. Phase 4 will replace it entirely. The component exists solely to satisfy TEST-09 automated testing requirements.

## Threat Flags

None — no new network endpoints or auth paths introduced. `GoogleSignInButton` is test infrastructure; aws-amplify OAuth flow is Cognito-managed.

## Self-Check

- [x] `frontend/src/components/auth/GoogleSignInButton.tsx` exists
- [x] `frontend/src/components/auth/GoogleSignInButton.test.tsx` exists
- [x] `frontend/src/components/common/guards/ProtectedRoute.test.tsx` exists
- [x] `frontend/src/components/common/guards/RequireRole.test.tsx` exists
- [x] Commit `72b358b` exists (Task 1)
- [x] Commit `1ab55c3` exists (Task 2)
- [x] `npm run test -- --run` exits 0 with 7 tests passing

## Self-Check: PASSED

---
*Phase: 02-test-suite*
*Completed: 2026-05-03*
