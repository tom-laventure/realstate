# Deferred Items — Phase 31

Items discovered during execution that are out of scope for the current plan's task files and were not fixed.

## Plan 31-02

- **`frontend/src/components/auth/GoogleSignInButton.test.tsx`** — 2 pre-existing test failures (`calls signInWithRedirect...` and `calls fetchAuthSession when Hub fires signInWithRedirect event`), confirmed present on `master` (`29a8387`) before any Plan 31-02 changes via `git stash` isolation test. Unrelated to `permissions.ts`, `AppShellAdmin.tsx`, or `RequireRole.test.tsx` — out of scope per Scope Boundary rule. Not fixed.
