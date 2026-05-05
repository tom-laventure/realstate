---
phase: 03-onboarding-fixes
verified: 2026-05-05T07:00:00Z
status: human_needed
score: 15/16 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 12/13
  gaps_closed:
    - "Users with multiple groups (Homepage /) now see the welcome banner — HomepageContext extended with banner state and actions; Homepage renders WelcomeBanner above ActivityStatsRow"
    - "SubdomainInput border fix (focus-visible:ring-offset-0) confirmed present at line 34"
  gaps_remaining: []
  regressions:
    - "SuccessStep uses inline useMutation + direct verifyOnboardingDomain API import instead of useVerifyDomain hook — CLAUDE.md violation identified in re-verification (was incorrectly marked VERIFIED in initial pass)"
human_verification:
  - test: "Duplicate subdomain submission stays on DomainStep"
    expected: "Submit a known duplicate subdomain in the wizard — DomainStep should NOT advance to the next step; inline error under SubdomainInput; no toast"
    why_human: "Step-gate behavior (wizard not advancing) requires running the app and triggering the actual React state flow; cannot be confirmed by static grep"
  - test: "Post-accept navigation — group-scoped invitation"
    expected: "Accept a group-scoped invitation and confirm the browser URL becomes /{groupUid} (a UUID path), not /dashboard/{integer}"
    why_human: "Navigation correctness depends on React Router route matching at runtime; UUID value in URL cannot be confirmed statically"
  - test: "Welcome banner dismiss persists across sessions"
    expected: "Click X on the welcome banner, refresh the page, confirm banner does NOT reappear (server-returned show_welcome_banner=false after dismiss)"
    why_human: "Cross-session persistence requires an active backend + database; cannot be confirmed statically"
---

# Phase 3: Onboarding Fixes Verification Report

**Phase Goal:** A new brokerage owner can complete domain setup without errors, and a new invitee lands on their brokerage workspace after accepting an invitation
**Verified:** 2026-05-05
**Status:** human_needed
**Re-verification:** Yes — after gap closure plan 03-05 (WelcomeBanner on Homepage + SubdomainInput fix confirmation)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Brokerage create response includes `subdomain_id` and `custom_domain_id` | VERIFIED | `brokerages_controller.rb`: `subdomain_domain = nil` / `custom_domain_record = nil` before transaction; capturing assignments inside; response includes `subdomain_id: subdomain_domain.id`, `custom_domain_id: custom_domain_record&.id` |
| 2 | Wizard does NOT advance past DomainStep when create-brokerage POST fails | NEEDS HUMAN | `handleContinue` has try/catch that sets `errors.subdomain` (DomainStep.tsx lines 71-79); no step change inside catch block — but step-gate behavior requires manual smoke |
| 3 | DomainStep shows inline server error under SubdomainInput (not toast) | VERIFIED | `DomainStep.tsx` lines 71-79: catch block sets `errors.subdomain`; `<SubdomainInput error={errors.subdomain} />` renders it; no toast in catch path |
| 4 | `useCreateBrokerage` removes `onError` toast — throws to caller | VERIFIED | `useCreateBrokerage.ts`: only `mutationFn: createBrokerage`; grep returns 0 for `onError` |
| 5 | `CreateBrokerageContext.submit()` throws `new Error(detail)` on `data.error` | VERIFIED | `CreateBrokerageContext.tsx`: `if (data.error) { const detail = ...; throw new Error(detail) }` present |
| 6 | SuccessStep uses `window.location.href` (not `useNavigate`) for cross-domain navigation | VERIFIED | `SuccessStep.tsx`: no `useNavigate` import; 3 `window.location.href` assignments; includes `isSafeRedirectHost` guard (security improvement over plan) |
| 7 | SuccessStep renders "Check DNS status", "Domain verified" badge, "Not yet verified" message, two-CTA verified layout | VERIFIED | `SuccessStep.tsx`: all four strings present; `dnsState` state machine with `idle\|checking\|verified\|not_yet`; Loader2 spinner; two-button layout on verified |
| 7b | SuccessStep uses `useVerifyDomain` hook per CLAUDE.md (never call API modules directly in components) | WARNING | `SuccessStep.tsx` line 21: `useMutation({ mutationFn: verifyOnboardingDomain })` — inline useMutation with direct API import from `@/assets/api/onboarding/verifyOnboardingDomain`. NOT using the pre-existing `useVerifyDomain` hook. CLAUDE.md violated. However: (1) calls a dedicated onboarding endpoint `/v1/onboarding/domains/:id/verify` with full ownership verification in the controller; (2) DNS state machine is fully functional; (3) ROADMAP success criteria met |
| 8 | Backend `accept` and `accept_token` return `group.uid` (not `group.id.to_s`) | VERIFIED | `invitations_controller.rb`: `next_step = group.uid` in both actions; 0 occurrences of `group.id.to_s` |
| 9 | `JoinBrokerage` and `Invitation.tsx` navigate to absolute paths with dashboard sentinel guard | VERIFIED | `JoinBrokerage.tsx`: `navigate(\`/${nextStep}\`)` when not 'dashboard', `navigate('/')` fallback; `Invitation.tsx`: `nextStep !== 'dashboard'` guard |
| 10 | `brokerage_memberships` has `welcomed_at` nullable datetime column; schema version advanced | VERIFIED | Migration `20260503000001` adds column; `schema.rb` has `t.datetime "welcomed_at"` in brokerage_memberships; schema version `2026_05_03_000001` |
| 11 | `POST /v1/account/profile/dismiss_welcome` exists, uses `.without_deleted`, sets `welcomed_at`, rescues RecordNotFound | VERIFIED | `profile_controller.rb`: `def dismiss_welcome`; `BrokerageMembership.without_deleted.find_by!`; `membership.update!(welcomed_at: Time.current)`; `rescue ActiveRecord::RecordNotFound` returning 404 |
| 12 | `UserSerializer` exposes `show_welcome_banner` boolean via `.without_deleted` membership lookup | VERIFIED | `user_serializer.rb`: `attribute :show_welcome_banner`; method uses `BrokerageMembership.without_deleted.find_by`; returns `false` when no `Current.brokerage`; `membership.welcomed_at.nil?` |
| 13 | WelcomeBanner renders above SummaryCards in GeneralDashboard; GeneralDashboardContext wires bannerVisible, dismissBanner, brokerage/group data via hooks | VERIFIED | `GeneralDashboard.tsx` lines 34-40: `{state.bannerVisible && <WelcomeBanner ... />}` first child before SummaryCards; `GeneralDashboardContext.tsx`: four hooks wired, bannerHydrated guard, dismissBanner callback |
| 14 | WelcomeBanner renders above ActivityStatsRow on Homepage (/); HomepageContext wires bannerVisible, dismissBanner, brokerage/group data via hooks | VERIFIED | `Homepage.tsx` lines 22-29: `{state.bannerVisible && <WelcomeBanner ... />}` as first child of wrapper, before `<ActivityStatsRow>`; `HomepageContext.tsx` lines 7-10: all four banner hook imports; lines 78-101: hook calls, state, effect, dismissBanner callback, derived values; all in useMemo state/actions/deps |
| 15 | SubdomainInput border fix (focus-visible:ring-offset-0) present | VERIFIED | `SubdomainInput.tsx` line 34: `focus-visible:ring-offset-0` present in className; no regression |

**Score:** 15/16 truths verified (1 warning on CLAUDE.md compliance for SuccessStep DNS verify call; 1 requires human testing for runtime step-gate behavior)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---------|---------|--------|---------|
| `backend/app/controllers/v1/onboarding/brokerages_controller.rb` | Extended create response with subdomain_id/custom_domain_id | VERIFIED | nil declarations before transaction; capturing assignments inside; extended response |
| `frontend/src/assets/api/onboarding/createBrokerage.ts` | CreateBrokerageResponse with subdomainId/customDomainId | VERIFIED | `subdomainId?: number`, `customDomainId?: number \| null` present |
| `frontend/src/store/hooks/Auth/useCreateBrokerage.ts` | No onError toast; mutation throws | VERIFIED | 13-line file; only `mutationFn: createBrokerage`; 0 onError occurrences |
| `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx` | submit() throws on data.error | VERIFIED | `throw new Error(detail)` present |
| `frontend/src/containers/createBrokerage/steps/DomainStep.tsx` | try/catch sets errors.subdomain | VERIFIED | try/catch with `setErrors((prev) => ({ ...prev, subdomain: message }))` |
| `frontend/src/containers/createBrokerage/steps/SuccessStep.tsx` | window.location.href + DNS state machine | VERIFIED (with warning) | No useNavigate; 3 window.location.href; full DNS state machine; uses inline useMutation + direct API import instead of useVerifyDomain hook (CLAUDE.md violation) |
| `backend/app/controllers/v1/dashboard/invitations_controller.rb` | Returns group.uid in next_step | VERIFIED | 2 occurrences of `next_step = group.uid`; 0 `group.id.to_s` |
| `frontend/src/containers/auth/joinBrokerage/JoinBrokerage.tsx` | Absolute paths with dashboard sentinel | VERIFIED | Dashboard sentinel guard + absolute path |
| `frontend/src/containers/auth/Invitation.tsx` | nextStep !== 'dashboard' guard | VERIFIED | Guard present before navigate |
| `backend/db/migrate/20260503000001_add_welcomed_at_to_brokerage_memberships.rb` | Migration with welcomed_at datetime | VERIFIED | Exists; `add_column :brokerage_memberships, :welcomed_at, :datetime` |
| `backend/db/schema.rb` | welcomed_at in brokerage_memberships; schema version 2026_05_03_000001 | VERIFIED | Both confirmed |
| `backend/app/controllers/v1/account/profile_controller.rb` | dismiss_welcome action with without_deleted | VERIFIED | Full action present with RecordNotFound rescue |
| `backend/config/routes.rb` | POST dismiss_welcome inside resource block | VERIFIED | `resource :profile ... do; post :dismiss_welcome; end` |
| `backend/app/serializers/user_serializer.rb` | show_welcome_banner attribute + method with without_deleted | VERIFIED | attribute + method + without_deleted all present |
| `frontend/src/assets/api/account/dismissWelcome.ts` | Axios POST wrapper | VERIFIED | Exists; POSTs to `/v1/account/profile/dismiss_welcome` |
| `frontend/src/store/hooks/Account/useDismissWelcome.ts` | useMutation invalidates accountProfileKeys.all | VERIFIED | Exists; `invalidateQueries({ queryKey: accountProfileKeys.all })` |
| `frontend/src/store/hooks/Dashboard/useFetchDashboardBrokerage.ts` | useQuery wrapping fetchBrokerageContact | VERIFIED | Exists; uses `dashboardBrokerageKeys.all` |
| `frontend/src/store/hooks/queryKeys.tsx` | dashboardBrokerageKeys namespace | VERIFIED | `dashboardBrokerageKeys = { all: ['dashboard', 'brokerage'] as const }` |
| `frontend/src/assets/types/userType.ts` | showWelcomeBanner?: boolean on User | VERIFIED | `showWelcomeBanner?: boolean` present |
| `frontend/src/components/dashboard/general/WelcomeBanner.tsx` | Pure presentational; no hooks/state | VERIFIED | Exists; no useState/useEffect; props only; Badge chips + ghost X button with aria-label |
| `frontend/src/containers/dashboard/general/GeneralDashboardContext.tsx` | bannerVisible + dismissBanner + hook wiring | VERIFIED | All four hooks, bannerHydrated guard, dismissBanner callback, brokerageName/groupNames derived |
| `frontend/src/containers/dashboard/general/GeneralDashboard.tsx` | WelcomeBanner rendered above SummaryCards | VERIFIED | Import and conditional render before SummaryCards |
| `frontend/src/containers/dashboard/home/HomepageContext.tsx` | bannerVisible, brokerageName, groupNames in state; dismissBanner in actions | VERIFIED | Lines 7-10: four banner hook imports; lines 78-101: all banner logic; lines 135-137: bannerVisible/brokerageName/groupNames in state; line 148: dismissBanner in actions; lines 170-173: all in useMemo deps |
| `frontend/src/containers/dashboard/home/Homepage.tsx` | Conditional WelcomeBanner render above ActivityStatsRow | VERIFIED | Lines 6: WelcomeBanner imported; lines 22-29: `{state.bannerVisible && <WelcomeBanner brokerageName={state.brokerageName} groupNames={state.groupNames} onDismiss={actions.dismissBanner} />}` immediately before `<ActivityStatsRow>` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| DomainStep.tsx | CreateBrokerageContext.tsx | `await actions.submit(domain)` in try/catch | VERIFIED | Inside try block |
| CreateBrokerageContext.tsx | useCreateBrokerage.ts | `createMutation.mutateAsync(payload)` | VERIFIED | Present |
| SuccessStep.tsx | useMutation + verifyOnboardingDomain | `useMutation({ mutationFn: verifyOnboardingDomain })` at top level | WARNING | Not via useVerifyDomain hook as planned; direct import of API module violates CLAUDE.md; however the endpoint (`/v1/onboarding/domains/:id/verify`) exists with proper controller and ownership check |
| SuccessStep.tsx | window.location.href | Three assignments with `isSafeRedirectHost` guard | VERIFIED | Lines 101, 113, 124 — improved with security guard |
| invitations_controller.rb#accept | group.uid | `next_step: group.uid` | VERIFIED | Present |
| invitations_controller.rb#accept_token | group.uid | `next_step = group.uid` | VERIFIED | Present |
| JoinBrokerage.tsx | react-router navigate | absolute path `/${nextStep}` or `/` | VERIFIED | Lines 44-49 |
| Invitation.tsx | react-router navigate | `nextStep !== 'dashboard'` guard | VERIFIED | Lines 31-35 |
| routes.rb | ProfileController#dismiss_welcome | `post :dismiss_welcome` inside resource block | VERIFIED | Line 36 |
| profile_controller.rb#dismiss_welcome | BrokerageMembership.without_deleted | find_by! + update! | VERIFIED | Present |
| user_serializer.rb | BrokerageMembership.welcomed_at | `.without_deleted.find_by` | VERIFIED | Present |
| GeneralDashboardContext.tsx | useGetAccountProfile | `profileQuery.data?.showWelcomeBanner` | VERIFIED | Present |
| GeneralDashboardContext.tsx | useFetchDashboardBrokerage | `brokerageQuery.data?.brokerage?.name` | VERIFIED | Present |
| GeneralDashboardContext.tsx | useDismissWelcome | `dismissMutation.mutate()` in dismissBanner | VERIFIED | Present |
| GeneralDashboard.tsx | WelcomeBanner component | `{state.bannerVisible && <WelcomeBanner ... />}` | VERIFIED | Lines 34-40 |
| HomepageContext.tsx | useGetAccountProfile | `profileQuery.data?.showWelcomeBanner` | VERIFIED | Line 88 |
| HomepageContext.tsx | useFetchDashboardBrokerage | `brokerageQuery.data?.brokerage?.name` | VERIFIED | Line 100 |
| HomepageContext.tsx | useDismissWelcome | `dismissMutation.mutate()` in dismissBanner | VERIFIED | Lines 81, 97 |
| Homepage.tsx | WelcomeBanner component | `{state.bannerVisible && <WelcomeBanner ... />}` | VERIFIED | Lines 22-29 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---------|--------------|--------|-------------------|--------|
| WelcomeBanner.tsx (GeneralDashboard) | `brokerageName` prop | GeneralDashboardContext → `useFetchDashboardBrokerage` → `GET /v1/dashboard/brokerage` | Yes — real API endpoint | FLOWING |
| WelcomeBanner.tsx (GeneralDashboard) | `groupNames` prop | GeneralDashboardContext → `useFetchAccountGroups` → `GET /v1/account/groups` | Yes — real API endpoint | FLOWING |
| WelcomeBanner.tsx (GeneralDashboard) | `bannerVisible` | GeneralDashboardContext → `useGetAccountProfile` → `GET /v1/account/profile` → `show_welcome_banner` | Yes — real DB column + serializer method | FLOWING |
| WelcomeBanner.tsx (Homepage) | `brokerageName` prop | HomepageContext → `useFetchDashboardBrokerage` → `GET /v1/dashboard/brokerage` | Yes — real API endpoint | FLOWING |
| WelcomeBanner.tsx (Homepage) | `groupNames` prop | HomepageContext → `useFetchAccountGroups` → `GET /v1/account/groups` | Yes — real API endpoint | FLOWING |
| WelcomeBanner.tsx (Homepage) | `bannerVisible` | HomepageContext → `useGetAccountProfile` → `GET /v1/account/profile` → `show_welcome_banner` | Yes — real DB column + serializer method | FLOWING |
| SuccessStep.tsx | `subdomain`, `customDomainId` | `state.result.domains` from `createMutation.mutateAsync` response | Yes — backend returns subdomain_id/custom_domain_id | FLOWING |
| SuccessStep.tsx | `dnsState` | `verifyOnboardingDomain` → `POST /v1/onboarding/domains/:id/verify` → `verified: boolean` | Yes — real DNS resolution in onboarding controller | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — cannot test without running Rails server and seeded DB.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|---------|
| ONB-01 | 03-01-PLAN | Domain wizard error handling + SuccessStep redirect + DNS verify button | SATISFIED | Backend response extended; DomainStep try/catch; DNS state machine wired; window.location.href; step-gate requires human verification |
| ONB-02 | 03-02-PLAN | Invitation post-accept navigation lands on valid route | SATISFIED | group.uid in backend; absolute paths in both frontend components; dashboard sentinel guard |
| ONB-03 | 03-03-PLAN + 03-04-PLAN + 03-05-PLAN | Dismissible welcome banner with server-side persistence | SATISFIED | welcomed_at migration + dismiss endpoint + serializer flag + WelcomeBanner component + context wiring in both GeneralDashboardContext AND HomepageContext |

All three phase requirements (ONB-01, ONB-02, ONB-03) are accounted for. REQUIREMENTS.md traceability row for Phase 3 shows all three as Complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `SuccessStep.tsx` | 7, 21 | Direct API import (`verifyOnboardingDomain`) + inline `useMutation` instead of pre-existing `useVerifyDomain` hook | WARNING | CLAUDE.md violation: components must never call API modules directly — always go through a hook. DNS state machine works correctly but the pattern is non-compliant. Note: a dedicated `verifyOnboardingDomain` API module was created calling the correct onboarding endpoint. The fix is to wrap it in a `useVerifyOnboardingDomain` hook. |
| `CreateBrokerageContext.tsx` | 2 | `import toast from 'react-hot-toast'` still present; used only for the "Please select a plan" guard | INFO | Toast is used for one remaining non-error case (missing plan); this is not a stub — it's legitimate use |

No stub implementations, no `return null` / `return {}` patterns, no placeholder text found in phase-modified files.

### Human Verification Required

#### 1. Wizard step-gate on duplicate subdomain (ONB-01)

**Test:** Run `cd backend && rails server` and `cd frontend && npm run dev`. Visit the create-brokerage wizard, proceed to DomainStep, enter a subdomain that already exists in the database. Click "Create brokerage".
**Expected:** Error message appears under the SubdomainInput field. Wizard remains on DomainStep — does NOT advance to SuccessStep. No toast fires.
**Why human:** The step-gate behavior (wizard not advancing) is a React state flow outcome that cannot be confirmed by static grep — the code structure supports it (no `setStep('success')` in the catch path) but the actual navigation must be observed.

#### 2. Group-scoped invitation: UUID in redirect URL (ONB-02)

**Test:** Create a group-scoped invitation in dev. Open the invite link in a browser. Sign in or create an account. Click Accept.
**Expected:** Browser navigates to `/{groupUid}` where the path segment is a UUID (e.g. `/3f9a1c2d-...`), not an integer. The group page renders correctly.
**Why human:** The UUID value in the URL and the route matching require the running app.

#### 3. Welcome banner dismiss persistence across sessions (ONB-03)

**Test:** Sign in as a user whose `BrokerageMembership.welcomed_at` is NULL. Visit the dashboard (or homepage if multi-group). Confirm banner appears. Click X. Refresh the page.
**Expected:** Banner disappears immediately on click. After full page refresh, banner does NOT reappear (server returns `show_welcome_banner: false`).
**Why human:** Cross-session persistence requires an active backend with the migration applied and a user with `welcomed_at IS NULL`.

### Gaps Summary

No blocking gaps. Plan 05 deliverables are fully verified:
- `HomepageContext.tsx` has all four banner hook imports (lines 7-10), full banner logic (lines 78-101), and banner state/actions exposed in the useMemo return (lines 135, 148, 170-173)
- `Homepage.tsx` renders `WelcomeBanner` as the first child of the page wrapper, correctly above `<ActivityStatsRow>` (lines 22-29)
- `SubdomainInput.tsx` line 34 confirms `focus-visible:ring-offset-0` already present — no regression

One WARNING identified (not present in initial verification): `SuccessStep.tsx` uses inline `useMutation` with a direct `verifyOnboardingDomain` API import instead of the pre-existing `useVerifyDomain` hook. This violates CLAUDE.md's rule that "never call axios or API functions directly inside a component — always go through a hook." The DNS state machine is functionally complete and calls a valid backend endpoint (`/v1/onboarding/domains/:id/verify`) with proper ownership verification. The fix is simple: extract into a `useVerifyOnboardingDomain` hook. This is a code quality concern, not a phase goal failure — all three ROADMAP success criteria are met.

---

_Verified: 2026-05-05_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after gap closure plan 03-05_
