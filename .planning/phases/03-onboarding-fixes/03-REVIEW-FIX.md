---
phase: 03-onboarding-fixes
fixed_at: 2026-05-03T00:00:00Z
review_path: .planning/phases/03-onboarding-fixes/03-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 1
skipped: 10
status: partial
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-05-03
**Source review:** .planning/phases/03-onboarding-fixes/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (5 Critical + 6 Warning)
- Fixed: 1
- Skipped: 10 (all already resolved in current code)

## Fixed Issues

### WR-06: `invitations_controller#index` — `per_page` not capped at 100

**Files modified:** `backend/app/controllers/v1/dashboard/invitations_controller.rb`
**Commit:** 33ef32b
**Applied fix:** Replaced the uncapped `if per_page > 0` branch with a single `items = per_page.positive? ? [per_page, 100].min : 10` expression, then passed `items:` to `pagy`. This matches the CLAUDE.md convention exactly and removes the 5-line conditional.

## Skipped Issues

### CR-01: Soft-delete bypass in `CognitoAuth` membership gate

**File:** `backend/app/controllers/concerns/cognito_auth.rb:23`
**Reason:** Already fixed — line 23 already reads `BrokerageMembership.without_deleted.exists?(user_id: Current.user.id, brokerage_id: Current.brokerage.id)`. No change needed.
**Original issue:** Plain `BrokerageMembership.exists?` bypassed soft-delete guard.

---

### CR-02: Open redirect in `SuccessStep`

**File:** `frontend/src/containers/createBrokerage/steps/SuccessStep.tsx:95`
**Reason:** Already fixed — the file already defines `BASE_DOMAIN` and `isSafeRedirectHost()` at the top, and all `window.location.href` assignments are guarded with `if (isSafeRedirectHost(...))`. No change needed.
**Original issue:** Unvalidated domain navigated to via `window.location.href`.

---

### CR-03: Unvalidated base64 favicon injected before sanitization

**File:** `backend/app/controllers/v1/onboarding/brokerages_controller.rb:37-48`
**Reason:** Already fixed — the controller already defines `ALLOWED_FAVICON_MIME_TYPES`, `MAX_FAVICON_BASE64_BYTES`, and validates both before calling `S3UploadService`. No change needed.
**Original issue:** No MIME type or size validation on favicon base64 input.

---

### CR-04: N+1 query — `show_welcome_banner` fires a DB query per user

**File:** `backend/app/serializers/user_serializer.rb:37-45`
**Reason:** Already fixed — `show_welcome_banner` is guarded with `attribute :show_welcome_banner, if: :include_welcome_banner?` and `include_welcome_banner?` checks `@instance_options[:include_welcome_banner] == true`. No change needed.
**Original issue:** Unconditional attribute triggered DB query for every serialized user.

---

### CR-05: `accept_token` — `find_or_create_by!` did not set role on existing membership and lacked `without_deleted`

**File:** `backend/app/controllers/v1/dashboard/invitations_controller.rb:89-91`
**Reason:** Already fixed — the `accept_token` action uses `BrokerageMembership.without_deleted.find_or_initialize_by(...)` followed by `membership.role ||= invitation.role` and `membership.save!`. No change needed.
**Original issue:** Role only set inside `find_or_create_by!` block (create path only); no `without_deleted` guard.

---

### WR-01: `submit` in `CreateBrokerageContext` — unhandled error and no toast on failure

**File:** `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx:111-119`
**Reason:** Already fixed — the `submit` callback wraps `mutateAsync` in a try/catch that calls `toast.error(...)` before re-throwing. The `if (data.error)` soft-error path is also present. No change needed.
**Original issue:** Missing try/catch and toast on network/HTTP failure.

---

### WR-02: `JoinBrokerage` — `handleAccept` not wrapped in try/catch

**File:** `frontend/src/containers/auth/joinBrokerage/JoinBrokerage.tsx:41-50`
**Reason:** Already fixed — `handleAccept` is wrapped in try/catch with `toast.error(...)` in the catch block. No change needed.
**Original issue:** Unhandled rejection on network error silently swallowed for CreateAccount flow.

---

### WR-03: `JoinBrokerage` — 4xx response body never read, generic error shown

**File:** `frontend/src/containers/auth/joinBrokerage/JoinBrokerage.tsx:74-117`
**Reason:** Already fixed — `validateInviteToken` catches Axios errors and returns `axiosErr.response.data` as the resolved value, so `validationQuery.data?.error` is populated for 4xx responses. The component renders the specific error card when `data?.error` is set. No change needed.
**Original issue:** `data?.error` check unreachable for non-2xx responses.

---

### WR-04: `useFetchDashboardBrokerage` uses deprecated TanStack Query v5 `onError` option

**File:** `frontend/src/store/hooks/Dashboard/useFetchDashboardBrokerage.ts:11-13`
**Reason:** Already fixed — the hook does not pass `onError` to `useQuery`; it uses the returned `error` value and logs it with `if (error) console.error(...)`. No change needed.
**Original issue:** `onError` silently ignored in TanStack Query v5.

---

### WR-05: `CreateBrokerageContext` — `createMutation.isLoading` uses removed TanStack Query v5 API

**File:** `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx:133`
**Reason:** Already fixed — line 141 reads `isSubmitting: createMutation.isPending`. No change needed.
**Original issue:** `isLoading` always `undefined` in v5, preventing submit button disable.

---

_Fixed: 2026-05-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
