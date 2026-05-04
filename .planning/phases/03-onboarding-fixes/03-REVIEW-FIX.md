---
phase: 03-onboarding-fixes
fixed_at: 2026-05-03T00:00:00Z
review_path: .planning/phases/03-onboarding-fixes/03-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-05-03
**Source review:** .planning/phases/03-onboarding-fixes/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (5 Critical + 6 Warning)
- Fixed: 11
- Skipped: 0 (all 11 findings verified fixed in current codebase)

## Fixed Issues

All 11 in-scope findings are confirmed fixed in the current codebase. Each finding was verified by reading the actual source file.

### CR-01: Soft-delete bypass in `CognitoAuth` membership gate

**File:** `backend/app/controllers/concerns/cognito_auth.rb:23`
**Status:** Already fixed in current code
**Verified fix:** `BrokerageMembership.without_deleted.exists?(user_id: Current.user.id, brokerage_id: Current.brokerage.id)` — soft-delete guard present.

### CR-02: Open redirect in `SuccessStep`

**File:** `frontend/src/containers/createBrokerage/steps/SuccessStep.tsx`
**Status:** Already fixed in current code
**Verified fix:** `BASE_DOMAIN` constant and `isSafeRedirectHost()` function defined at lines 8-12. All `window.location.href` assignments are gated with `if (isSafeRedirectHost(...))`.

### CR-03: Unvalidated base64 favicon injected before sanitization

**File:** `backend/app/controllers/v1/onboarding/brokerages_controller.rb`
**Status:** Already fixed in current code
**Verified fix:** `ALLOWED_FAVICON_MIME_TYPES` and `MAX_FAVICON_BASE64_BYTES` constants defined; MIME type and byte-size checks run before any upload. SVG excluded from allowlist.

### CR-04: N+1 query — `show_welcome_banner` fires a DB query per user

**File:** `backend/app/serializers/user_serializer.rb`
**Status:** Already fixed in current code
**Verified fix:** `attribute :show_welcome_banner, if: :include_welcome_banner?` with `include_welcome_banner?` predicate checking `@instance_options[:include_welcome_banner] == true`. DB query only runs when explicitly requested.

### CR-05: `accept_token` — soft-delete bypass + role not set on existing membership

**File:** `backend/app/controllers/v1/dashboard/invitations_controller.rb`
**Status:** Already fixed in current code
**Verified fix:** `BrokerageMembership.without_deleted.find_or_initialize_by(...)` with `membership.role ||= invitation.role` + `membership.save!`. Role set on create only (never downgrades), with code comment documenting the decision.

### WR-01: `submit` in `CreateBrokerageContext` — unhandled error, no toast on failure

**File:** `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx`
**Status:** Already fixed in current code
**Verified fix:** `mutateAsync` wrapped in try/catch at lines 112-120; `toast.error(...)` fires on HTTP errors before re-throwing. Soft `data.error` check present at line 122.

### WR-02: `JoinBrokerage` — `handleAccept` unhandled rejection

**File:** `frontend/src/containers/auth/joinBrokerage/JoinBrokerage.tsx`
**Status:** Already fixed in current code
**Verified fix:** `handleAccept` wrapped in try/catch at lines 43-56 with `toast.error('Failed to accept invitation. Please try again.')` in the catch block.

### WR-03: `JoinBrokerage` — 4xx response body never read

**File:** `frontend/src/assets/api/dashboard/invitations/validateInviteToken.ts`
**Status:** Already fixed in current code
**Verified fix:** `validateInviteToken` catches Axios errors and returns `axiosErr.response.data` as the resolved value, making `next_step` (`"expired"`, `"revoked"`, `"already-accepted"`) and `error` fields available to the component via `validationQuery.data`.

### WR-04: `useFetchDashboardBrokerage` uses deprecated TanStack Query v5 `onError`

**File:** `frontend/src/store/hooks/Dashboard/useFetchDashboardBrokerage.ts`
**Status:** Already fixed in current code
**Verified fix:** No `onError` option passed to `useQuery`. Error handled via returned `error` value with `if (error) console.error('Failed to fetch dashboard brokerage:', error)`.

### WR-05: `CreateBrokerageContext` — `createMutation.isLoading` removed in TanStack Query v5

**File:** `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx`
**Status:** Already fixed in current code
**Verified fix:** `isSubmitting: createMutation.isPending` at line 141. Correct v5 mutation pending API used; submit button disable and "Creating..." label will work correctly.

### WR-06: `invitations_controller#index` — `per_page` not capped at 100

**File:** `backend/app/controllers/v1/dashboard/invitations_controller.rb`
**Status:** Fixed in prior run (commit 33ef32b)
**Verified fix:** `per_page = params[:per_page].to_i` and `items = per_page.positive? ? [per_page, 100].min : 10` at lines 134-135, matching the CLAUDE.md convention exactly.

---

_Fixed: 2026-05-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
