---
phase: 04-google-oauth
plan: "04"
subsystem: auth
tags: [google-oauth, amplify, react, frontend, cognito, badge, ui]

requires:
  - phase: 04-google-oauth
    plan: "01"
    provides: auth_provider column + UserSerializer :auth_provider attribute
  - phase: 04-google-oauth
    plan: "03"
    provides: /auth/login-success route for post-OAuth redirect landing

provides:
  - GoogleSignInButton full implementation with Google G SVG, 500ms spinner, customState brokerage encoding
  - CreateAccount.tsx with "or" divider + GoogleSignInButton in form stage (both login and create modes)
  - MemberDetailCard.tsx with "Connected via Google" badge row when authProvider === 'google'
  - amplify.ts with https://auth.realtybase.ca/oauth/callback in redirectSignIn
  - userType.ts with authProvider?: string on user interface

affects: []

tech-stack:
  added: []
  patterns:
    - "customState encoding: btoa(JSON.stringify({ brokerage: window.location.hostname })) — encodes current hostname for tenant-aware callback routing"
    - "500ms spinner delay before signInWithRedirect — visual feedback window before browser navigates away (component unmounts after redirect, no further state management needed)"
    - "Hub.listen removed from GoogleSignInButton — callback page (auth-callback/index.html) handles all session exchange; button only initiates redirect"
    - "Conditional badge row: member?.authProvider === 'google' renders Sign-in method row with Shield icon and sky-blue outline badge"

key-files:
  created: []
  modified:
    - frontend/src/components/auth/GoogleSignInButton.tsx
    - frontend/src/config/amplify.ts
    - frontend/src/assets/types/userType.ts
    - frontend/src/containers/auth/CreateAccount.tsx
    - frontend/src/components/view/admin/usersAdminView/memberAdminView/MemberDetailCard.tsx

key-decisions:
  - "Hub.listen useEffect removed entirely from GoogleSignInButton — per D-07 and CONTEXT.md, the static callback page (04-03) handles session exchange; the button's sole responsibility is initiating the redirect"
  - "customState = btoa(JSON.stringify({ brokerage: window.location.hostname })) — current hostname is the brokerage domain; callback page decodes this to redirect to correct tenant after OAuth"
  - "GoogleSignInButton renders in BOTH login and create modes in stage === form — single button handles both auth paths since Google account lookup is email-based"
  - "amplify.ts redirectSignIn: auth.realtybase.ca callback URL is first entry — Cognito uses first matching registered URL; production URL must be in the array for OAuth flow to complete"
  - "Badge uses border-sky-500/40 text-sky-700 — matches existing agent role badge style in MemberDetailCard, establishing visual coherence between agent identity and Google identity"
  - "Shield icon chosen for Connected via Google row — conveys identity/auth without using Google brand color in icon slot; consistent with muted-foreground icon pattern"

metrics:
  duration: 2min
  completed: "2026-05-09"
  tasks: 2
  files_modified: 5
---

# Phase 04 Plan 04: Google OAuth Frontend Summary

**Polished GoogleSignInButton with Google G SVG, 500ms spinner, and customState brokerage encoding wired into CreateAccount.tsx with an "or" divider, plus a "Connected via Google" badge in MemberDetailCard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-09T14:03:22Z
- **Completed:** 2026-05-09T14:05:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Rewrote `GoogleSignInButton.tsx` completely:
  - Removed `Hub.listen` useEffect (now handled by static callback page from 04-03)
  - Removed `fetchAuthSession`, `Hub` imports — component is now a lean 75-line file
  - Added official 4-color Google G SVG (inline, 16x16) — blue #4285F4, green #34A853, yellow #FBBC05, red #EA4335
  - Loading state: spinner replaces G icon on click, button disabled, `aria-busy={isLoading}`, `aria-label="Continue with Google"`
  - 500ms delay before `signInWithRedirect` fires for visual feedback (D-12)
  - `customState = btoa(JSON.stringify({ brokerage: window.location.hostname }))` encodes tenant for callback routing (D-13)
  - Error state: inline `text-destructive role="alert"` div below button on OAuth failure
- Updated `amplify.ts` `redirectSignIn` to add `https://auth.realtybase.ca/oauth/callback` as first entry alongside the dev localhost URL
- Added `authProvider?: string` to `user` interface in `userType.ts` — optional because existing users have null from the API (becomes undefined after camelcase-keys)
- Updated `CreateAccount.tsx`:
  - Import `GoogleSignInButton` from `@/components/auth/GoogleSignInButton`
  - Inserted `or` divider + `<GoogleSignInButton />` after the submit button, inside the `stage === 'form'` block — visible in both `mode === 'create'` and `mode === 'login'`; hidden in `stage === 'confirm'` and `stage === 'authenticated'`
- Updated `MemberDetailCard.tsx`:
  - Added `Shield` to lucide-react imports
  - Inserted conditional badge row after the Email row and before the Role row: renders only when `member?.authProvider === 'google'`
  - Row: `Shield` icon + "Sign-in method" label + `Badge variant="outline" className="mt-0.5 border-sky-500/40 text-sky-700 text-xs"` with "Connected via Google" text

## Task Commits

Each task was committed atomically:

1. **Task 1: GoogleSignInButton + amplify.ts + userType.ts** — `1854666` (feat, frontend sub-repo)
2. **Task 2: CreateAccount.tsx + MemberDetailCard.tsx** — `c314b4c` (feat, frontend sub-repo)

## Files Created/Modified

- `frontend/src/components/auth/GoogleSignInButton.tsx` — Complete rewrite: Hub.listen removed, Google SVG, spinner, customState, error state
- `frontend/src/config/amplify.ts` — redirectSignIn array expanded with production callback URL
- `frontend/src/assets/types/userType.ts` — authProvider?: string added to user interface
- `frontend/src/containers/auth/CreateAccount.tsx` — GoogleSignInButton import + divider + button in form stage
- `frontend/src/components/view/admin/usersAdminView/memberAdminView/MemberDetailCard.tsx` — Shield import + conditional Google badge row

## Decisions Made

- **Hub.listen removed:** The skeleton's Hub.listen useEffect was a placeholder for session exchange logic. Per D-07 (CONTEXT.md) and Plan 04-03, the static callback page (auth-callback/index.html) handles all Cognito session exchange and token handoff. GoogleSignInButton's sole job is initiating the OAuth redirect.
- **customState encoding:** `btoa(JSON.stringify({ brokerage: window.location.hostname }))` uses the actual current hostname — cannot be tampered with client-side since the user is already on that domain. The callback page validates the decoded domain ends with `.realtybase.ca` before redirecting (T-04-04-01 accepted per threat model).
- **amplify.ts first entry:** Cognito OAuth uses the first matching URL from the app client's registered callback list. Production URL placed first; dev localhost URL retained for local development.
- **Badge sky color:** `border-sky-500/40 text-sky-700` matches the existing agent role badge style, not the admin (`destructive`) or client (default) styles. This creates coherence between agent identity and Google identity — Google users are typically agents in this SaaS.
- **Shield icon:** Chosen over a Google-branded icon because lucide-react has no Google icon; Shield conveys "identity/authentication" without misrepresenting Google's brand. Consistent with `muted-foreground` icon pattern used throughout MemberDetailCard.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All wired data paths are live:
- `authProvider` flows from the backend `UserSerializer` (added in 04-01) via the admin member detail endpoint → `MemberDetailCard` renders the badge
- `signInWithRedirect` initiates real Cognito OAuth (no mocks)
- `customState` uses `window.location.hostname` (real hostname, not hardcoded)

## Threat Flags

None — all threats were in the plan's threat model and have been accepted or mitigated per plan specification (T-04-04-01 accept, T-04-04-02 accept, T-04-04-03 accept).

---
*Phase: 04-google-oauth*
*Completed: 2026-05-09*

## Self-Check: PASSED

Files verified:
- FOUND: frontend/src/components/auth/GoogleSignInButton.tsx
- FOUND: frontend/src/config/amplify.ts
- FOUND: frontend/src/assets/types/userType.ts
- FOUND: frontend/src/containers/auth/CreateAccount.tsx
- FOUND: frontend/src/components/view/admin/usersAdminView/memberAdminView/MemberDetailCard.tsx

Commits verified: 1854666 and c314b4c present in frontend sub-repo git log
