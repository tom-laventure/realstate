---
phase: 03-onboarding-fixes
verified: 2026-05-04T00:00:00Z
status: human_needed
score: 12/13 must-haves verified
overrides_applied: 0
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

**Phase Goal:** Fix three onboarding bugs — domain wizard error handling (ONB-01), invitation post-accept navigation (ONB-02), and dismissible welcome banner (ONB-03).
**Verified:** 2026-05-04
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Brokerage create response includes `subdomain_id` and `custom_domain_id` | VERIFIED | `brokerages_controller.rb` lines 79-87: `subdomain_id: subdomain_domain.id`, `custom_domain_id: custom_domain_record&.id`; variables declared before transaction and assigned inside it |
| 2 | Wizard does NOT advance past DomainStep when create-brokerage POST fails | NEEDS HUMAN | `handleContinue` has try/catch that sets `errors.subdomain` (line 73-79 DomainStep.tsx); no step change inside catch block; step advancement only occurs inside `submit()` which is not called on catch — but step-gate behavior requires manual smoke |
| 3 | DomainStep shows inline server error under SubdomainInput (not toast) | VERIFIED | `DomainStep.tsx` lines 71-79: catch block sets `errors.subdomain` from err message; `SubdomainInput error={errors.subdomain}` at line 98; no toast in catch path |
| 4 | `useCreateBrokerage` removes `onError` toast — throws to caller | VERIFIED | `useCreateBrokerage.ts`: `useMutation` with only `mutationFn`, no `onError` handler present |
| 5 | `CreateBrokerageContext.submit()` throws `new Error(detail)` on `data.error` | VERIFIED | `CreateBrokerageContext.tsx` lines 113-115: `if (data.error) { const detail = ...; throw new Error(detail) }` |
| 6 | SuccessStep uses `window.location.href` (not `useNavigate`) for cross-domain navigation | VERIFIED | `SuccessStep.tsx`: no `useNavigate` import, no `navigate()` call; three `window.location.href` assignments (lines 95, 101, 110); `useVerifyDomain` hook called at top level |
| 7 | SuccessStep renders "Check DNS status", "Domain verified" badge, "Not yet verified" message, two-CTA verified layout | VERIFIED | `SuccessStep.tsx`: all four strings present; `dnsState` state machine with `idle\|checking\|verified\|not_yet`; Loader2 spinner on checking; two-button layout on verified |
| 8 | Backend `accept` and `accept_token` return `group.uid` (not `group.id.to_s`) | VERIFIED | `invitations_controller.rb` line 106: `next_step = group.uid` (accept_token); line 173: `next_step: group.uid` (accept); zero occurrences of `group.id.to_s` |
| 9 | `JoinBrokerage` and `Invitation.tsx` navigate to absolute paths with dashboard sentinel guard | VERIFIED | `JoinBrokerage.tsx` lines 44-49: `navigate(\`/${nextStep}\`)` when not 'dashboard', `navigate('/')` fallback; `Invitation.tsx` lines 31-33: `nextStep !== 'dashboard'` guard before navigating |
| 10 | `brokerage_memberships` has `welcomed_at` nullable datetime column; schema version advanced | VERIFIED | Migration `20260503000001_add_welcomed_at_to_brokerage_memberships.rb` adds column; `schema.rb` line 64: `t.datetime "welcomed_at"` in brokerage_memberships; schema version `2026_05_03_000001` |
| 11 | `POST /v1/account/profile/dismiss_welcome` exists, uses `.without_deleted`, sets `welcomed_at`, rescues RecordNotFound | VERIFIED | `profile_controller.rb` lines 47-57: `def dismiss_welcome`; `BrokerageMembership.without_deleted.find_by!`; `membership.update!(welcomed_at: Time.current)`; `rescue ActiveRecord::RecordNotFound` returning 404 |
| 12 | `UserSerializer` exposes `show_welcome_banner` boolean via `.without_deleted` membership lookup | VERIFIED | `user_serializer.rb` lines 9, 37-44: `attribute :show_welcome_banner`; method uses `BrokerageMembership.without_deleted.find_by`; returns `false` when no `Current.brokerage`; `membership.welcomed_at.nil?` |
| 13 | WelcomeBanner renders above SummaryCards; context wires bannerVisible, dismissBanner, brokerage/group data via hooks | VERIFIED | `GeneralDashboard.tsx` lines 34-40: `{state.bannerVisible && <WelcomeBanner ... />}` as first child before `<SummaryCards />`; `GeneralDashboardContext.tsx`: four new hooks wired, `bannerHydrated` guard, `dismissBanner` callback, `brokerageName`/`groupNames` derived |

**Score:** 12/13 truths verified (1 requires human testing for runtime step-gate behavior)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---------|---------|--------|---------|
| `backend/app/controllers/v1/onboarding/brokerages_controller.rb` | Extended create response with subdomain_id/custom_domain_id | VERIFIED | Lines 51-52: nil declarations; lines 57-70: capturing assignments; lines 79-87: response with both IDs |
| `frontend/src/assets/api/onboarding/createBrokerage.ts` | CreateBrokerageResponse with subdomainId/customDomainId | VERIFIED | Lines 28-32: `subdomainId?: number`, `customDomainId?: number \| null` |
| `frontend/src/store/hooks/Auth/useCreateBrokerage.ts` | No onError toast; mutation throws | VERIFIED | File is 13 lines; only `mutationFn: createBrokerage`; no `onError` |
| `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx` | submit() throws on data.error | VERIFIED | Lines 113-115: `throw new Error(detail)` |
| `frontend/src/containers/createBrokerage/steps/DomainStep.tsx` | try/catch sets errors.subdomain | VERIFIED | Lines 71-79: try/catch with `setErrors((prev) => ({ ...prev, subdomain: message }))` |
| `frontend/src/containers/createBrokerage/steps/SuccessStep.tsx` | window.location.href + useVerifyDomain hook + DNS state machine | VERIFIED | No useNavigate; useVerifyDomain at top level; full DNS state machine |
| `backend/app/controllers/v1/dashboard/invitations_controller.rb` | Returns group.uid in next_step | VERIFIED | Two occurrences of `next_step = group.uid` (lines 106, 173); zero `group.id.to_s` |
| `frontend/src/containers/auth/joinBrokerage/JoinBrokerage.tsx` | Absolute paths with dashboard sentinel | VERIFIED | Lines 44-49: dashboard sentinel guard + absolute path |
| `frontend/src/containers/auth/Invitation.tsx` | nextStep !== 'dashboard' guard | VERIFIED | Lines 31-33: guard present before navigate |
| `backend/db/migrate/20260503000001_add_welcomed_at_to_brokerage_memberships.rb` | Migration with welcomed_at datetime | VERIFIED | File exists; `add_column :brokerage_memberships, :welcomed_at, :datetime` present (also adds deleted_at for acts_as_paranoid) |
| `backend/db/schema.rb` | welcomed_at in brokerage_memberships; schema version 2026_05_03_000001 | VERIFIED | Both confirmed |
| `backend/app/controllers/v1/account/profile_controller.rb` | dismiss_welcome action with without_deleted | VERIFIED | Lines 47-57: full action present |
| `backend/config/routes.rb` | POST dismiss_welcome inside resource block | VERIFIED | Lines 30-31: `resource :profile ... do; post :dismiss_welcome; end` |
| `backend/app/serializers/user_serializer.rb` | show_welcome_banner attribute + method with without_deleted | VERIFIED | Lines 9, 37-44: both present |
| `frontend/src/assets/api/account/dismissWelcome.ts` | Axios POST wrapper | VERIFIED | File exists; POSTs to `/v1/account/profile/dismiss_welcome` |
| `frontend/src/store/hooks/Account/useDismissWelcome.ts` | useMutation invalidates accountProfileKeys.all | VERIFIED | File exists; `invalidateQueries({ queryKey: accountProfileKeys.all })` |
| `frontend/src/store/hooks/Dashboard/useFetchDashboardBrokerage.ts` | useQuery wrapping fetchBrokerageContact | VERIFIED | File exists; uses `dashboardBrokerageKeys.all` |
| `frontend/src/store/hooks/queryKeys.tsx` | dashboardBrokerageKeys namespace | VERIFIED | Line 143: `export const dashboardBrokerageKeys = { all: ['dashboard', 'brokerage'] as const }` |
| `frontend/src/assets/types/userType.ts` | showWelcomeBanner?: boolean on User | VERIFIED | Line 17: `showWelcomeBanner?: boolean` |
| `frontend/src/components/dashboard/general/WelcomeBanner.tsx` | Pure presentational; no hooks/state | VERIFIED | File exists; no useState/useEffect; props only; Badge chips + ghost X button |
| `frontend/src/containers/dashboard/general/GeneralDashboardContext.tsx` | bannerVisible + dismissBanner + hook wiring | VERIFIED | Lines 80-103: all four hooks, bannerHydrated guard, dismissBanner callback, brokerageName/groupNames derived |
| `frontend/src/containers/dashboard/general/GeneralDashboard.tsx` | WelcomeBanner rendered above SummaryCards | VERIFIED | Lines 9, 34-40: import and conditional render before SummaryCards |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| DomainStep.tsx | CreateBrokerageContext.tsx | `await actions.submit(domain)` in try/catch | VERIFIED | Line 72: `await actions.submit(domain)` inside try block |
| CreateBrokerageContext.tsx | useCreateBrokerage.ts | `createMutation.mutateAsync(payload)` | VERIFIED | Line 111: `const data = await createMutation.mutateAsync(payload)` |
| SuccessStep.tsx | useVerifyDomain hook | `useVerifyDomain()` at top level; `triggerVerify(customDomainId, ...)` in handler | VERIFIED | Lines 6, 16, 26: import, hook call, mutate invocation |
| SuccessStep.tsx | window.location.href | Three assignments for cross-domain nav | VERIFIED | Lines 95, 101, 110 |
| invitations_controller.rb#accept | group.uid | `next_step: group.uid` | VERIFIED | Line 173 |
| invitations_controller.rb#accept_token | group.uid | `next_step = group.uid` | VERIFIED | Line 106 |
| JoinBrokerage.tsx | react-router navigate | absolute path `/${nextStep}` or `/` | VERIFIED | Lines 45-49 |
| Invitation.tsx | react-router navigate | `nextStep !== 'dashboard'` guard | VERIFIED | Lines 31-35 |
| routes.rb | ProfileController#dismiss_welcome | `post :dismiss_welcome` inside resource block | VERIFIED | Lines 30-31 |
| profile_controller.rb#dismiss_welcome | BrokerageMembership.without_deleted | find_by! + update! | VERIFIED | Lines 49-53 |
| user_serializer.rb | BrokerageMembership.welcomed_at | `.without_deleted.find_by` | VERIFIED | Lines 40-44 |
| GeneralDashboardContext.tsx | useGetAccountProfile | `profileQuery.data?.showWelcomeBanner` | VERIFIED | Lines 80, 90 |
| GeneralDashboardContext.tsx | useFetchDashboardBrokerage | `brokerageQuery.data?.brokerage?.name` | VERIFIED | Lines 82, 102 |
| GeneralDashboardContext.tsx | useDismissWelcome | `dismissMutation.mutate()` in dismissBanner | VERIFIED | Lines 83, 99 |
| GeneralDashboard.tsx | WelcomeBanner component | `{state.bannerVisible && <WelcomeBanner ... />}` | VERIFIED | Lines 34-40 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---------|--------------|--------|-------------------|--------|
| WelcomeBanner.tsx | `brokerageName` prop | Context → `useFetchDashboardBrokerage` → `GET /v1/dashboard/brokerage` | Yes — real API endpoint | FLOWING |
| WelcomeBanner.tsx | `groupNames` prop | Context → `useFetchAccountGroups` → `GET /v1/account/groups` | Yes — real API endpoint | FLOWING |
| WelcomeBanner.tsx | visibility (`bannerVisible`) | Context → `useGetAccountProfile` → `GET /v1/account/profile` → `show_welcome_banner` | Yes — real DB column + serializer method | FLOWING |
| WelcomeBanner.tsx | `onDismiss` callback | Context → `useDismissWelcome` → `POST /v1/account/profile/dismiss_welcome` | Yes — real DB write to welcomed_at | FLOWING |
| SuccessStep.tsx | `subdomain`, `customDomainId` | `state.result.domains` from `createMutation.mutateAsync` response | Yes — backend now returns subdomain_id/custom_domain_id | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — cannot test without running Rails server and seeded DB.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|---------|
| ONB-01 | 03-01-PLAN | Domain wizard error handling + SuccessStep redirect + DNS verify button | SATISFIED | Backend response extended; DomainStep try/catch; useVerifyDomain hook wired; window.location.href |
| ONB-02 | 03-02-PLAN | Invitation post-accept navigation lands on valid route | SATISFIED | group.uid in backend; absolute paths in both frontend components; dashboard sentinel guard |
| ONB-03 | 03-03-PLAN + 03-04-PLAN | Dismissible welcome banner with server-side persistence | SATISFIED | welcomed_at migration + dismiss endpoint + serializer flag + WelcomeBanner component + context wiring |

All three phase requirements (ONB-01, ONB-02, ONB-03) are accounted for across the four plans. No orphaned requirements found for Phase 3 in REQUIREMENTS.md.

Note from REQUIREMENTS.md traceability: ONB-01 is marked `[ ]` (not checked off) while ONB-02 and ONB-03 are marked `[x]`. This may reflect an incomplete requirements file update rather than a missing implementation, since full ONB-01 implementation is verified in the codebase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `CreateBrokerageContext.tsx` | 2 | `import toast from 'react-hot-toast'` still present; used only for the "Please select a plan" guard on line 90 | INFO | Toast is used for one remaining non-error case (missing plan); this is not a stub — it's legitimate use |
| `GeneralDashboard.tsx` | 3 | `import toast from 'react-hot-toast'` used for filter card clicks | INFO | Pre-existing usage, not introduced in this phase |

No stub implementations, no `return null` / `return {}` patterns, no placeholder text found in phase-modified files.

### Post-Phase Code Review Findings (03-REVIEW.md)

The 03-REVIEW.md documents 5 critical issues discovered after execution. Per the verification instructions, these are post-phase findings and do not block `status=passed` unless they directly contradict a must_have truth. Assessment:

- **CR-01** (soft-delete bypass in `CognitoAuth` membership gate): Does NOT contradict phase must-haves — the must-haves only required `.without_deleted` in `dismiss_welcome` and `UserSerializer`, both of which are VERIFIED. CR-01 is a pre-existing concern in `cognito_auth.rb` aggravated by adding `acts_as_paranoid` to `BrokerageMembership`. Not a phase deliverable failure.
- **CR-02** (open redirect in SuccessStep `window.location.href`): The must-have requires `window.location.href` navigation — that is present. The review flags missing origin validation. Not a must-have failure; it's a hardening concern.
- **CR-03** (base64 favicon injection): Pre-existing code path in the brokerage controller; not a phase-specific must-have.
- **CR-04** (N+1 from `show_welcome_banner` in UserSerializer): The must-have requires `show_welcome_banner` to exist and work correctly — it does. The N+1 is a performance issue, not a correctness failure.
- **CR-05** (soft-delete leak in `current_brokerage_membership`): Pre-existing association definition concern. The phase-specific `.without_deleted` in `dismiss_welcome` and `show_welcome_banner` are both VERIFIED.

All 5 critical review findings are noted but do not contradict verified must-have truths. They represent hardening work appropriate for future phases.

### Human Verification Required

#### 1. Wizard step-gate on duplicate subdomain (ONB-01)

**Test:** Run `cd backend && rails server` and `cd frontend && npm run dev`. Visit the create-brokerage wizard, proceed to DomainStep, enter a subdomain that already exists in the database. Click "Create brokerage".
**Expected:** Error message appears under the SubdomainInput field. Wizard remains on DomainStep — does NOT advance to SuccessStep. No toast fires.
**Why human:** The step-gate behavior (wizard not advancing) is a React state flow outcome that cannot be confirmed by static grep — the code structure supports it (no `setStep('success')` in the catch path) but the actual navigation must be observed.

#### 2. Group-scoped invitation: UUID in redirect URL (ONB-02)

**Test:** Create a group-scoped invitation in dev. Open the invite link in a browser. Sign in or create an account. Click Accept.
**Expected:** Browser navigates to `/{groupUid}` where the path segment is a UUID (e.g. `/3f9a1c2d-...`), not an integer. The group page renders correctly.
**Why human:** The UUID value in the URL and the route matching require the running app. The backend code sends `group.uid` and the frontend constructs `/${nextStep}` — both are verified — but confirming the correct page renders requires end-to-end execution.

#### 3. Welcome banner dismiss persistence across sessions (ONB-03)

**Test:** Sign in as a user whose `BrokerageMembership.welcomed_at` is NULL. Visit the dashboard. Confirm banner appears. Click X. Refresh the page.
**Expected:** Banner disappears immediately on click. After full page refresh, banner does NOT reappear (server returns `show_welcome_banner: false`).
**Why human:** Cross-session persistence requires an active backend with the migration applied and a user with `welcomed_at IS NULL`. Requires database state and network calls.

### Gaps Summary

No automated gaps found. All 13 must-have truths have either been verified by code inspection (12/13) or require human testing (1/13 — the step-gate behavior). The three post-phase code review findings (CR-01 through CR-05) are noted as hardening concerns for future phases, not deliverable failures for Phase 3.

---

_Verified: 2026-05-04_
_Verifier: Claude (gsd-verifier)_
