---
phase: 03-onboarding-fixes
reviewed: 2026-05-03T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - backend/app/controllers/v1/onboarding/brokerages_controller.rb
  - frontend/src/assets/api/onboarding/createBrokerage.ts
  - frontend/src/store/hooks/Auth/useCreateBrokerage.ts
  - frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx
  - frontend/src/containers/createBrokerage/steps/DomainStep.tsx
  - frontend/src/containers/createBrokerage/steps/SuccessStep.tsx
  - backend/app/controllers/v1/dashboard/invitations_controller.rb
  - frontend/src/containers/auth/joinBrokerage/JoinBrokerage.tsx
  - frontend/src/containers/auth/Invitation.tsx
  - backend/db/migrate/20260503000001_add_welcomed_at_to_brokerage_memberships.rb
  - backend/app/models/brokerage_membership.rb
  - backend/app/controllers/v1/account/profile_controller.rb
  - backend/config/routes.rb
  - backend/app/serializers/user_serializer.rb
  - frontend/src/assets/api/account/dismissWelcome.ts
  - frontend/src/store/hooks/Account/useDismissWelcome.ts
  - frontend/src/store/hooks/Dashboard/useFetchDashboardBrokerage.ts
  - frontend/src/components/dashboard/general/WelcomeBanner.tsx
  - frontend/src/store/hooks/queryKeys.tsx
  - frontend/src/assets/types/userType.ts
  - frontend/src/containers/dashboard/general/GeneralDashboardContext.tsx
  - frontend/src/containers/dashboard/general/GeneralDashboard.tsx
findings:
  critical: 5
  warning: 6
  info: 3
  total: 14
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-03
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

This phase adds brokerage onboarding (multi-step wizard), invitation acceptance flow, and a welcome banner with dismiss tracking. The general structure is sound, but there are five critical issues: a soft-delete bypass in the membership existence check that allows deleted members to accept invitations, an open redirect vulnerability in the SuccessStep navigation, base64 favicon content injected directly into brokerage attributes before model-level sanitization, an N+1 query introduced by `show_welcome_banner` being computed in the serializer for every user in a collection, and a `BrokerageMembership` model that declares `acts_as_paranoid` but whose `current_brokerage_membership` association and membership existence checks do not consistently guard `deleted_at`, creating a soft-delete leak. Several warnings cover missing error handling on the wizard submit, unsafe URL casting, and a stale `onError` API in TanStack Query v5.

---

## Critical Issues

### CR-01: Soft-delete bypass in `CognitoAuth` membership gate — deleted members pass through

**File:** `backend/app/controllers/concerns/cognito_auth.rb:23`

**Issue:** The brokerage membership existence check uses plain `BrokerageMembership.exists?`, which does **not** call `without_deleted`. Because `BrokerageMembership` now declares `acts_as_paranoid` (added in the migration), a soft-deleted membership record still satisfies this check and the user is allowed through. A user who was removed from a brokerage (soft-deleted membership) can still authenticate against that brokerage's endpoints.

**Fix:**
```ruby
unless BrokerageMembership.without_deleted.exists?(
  user_id: Current.user.id,
  brokerage_id: Current.brokerage.id
)
```

---

### CR-02: Open redirect in `SuccessStep` — user-controlled domain navigated to via `window.location.href`

**File:** `frontend/src/containers/createBrokerage/steps/SuccessStep.tsx:95`

**Issue:** `window.location.href = \`https://${customDomain}\`` and `window.location.href = \`https://${subdomain}\`` navigate to values that come directly from API response data (`state.result?.domains?.customDomain`, `state.result?.domains?.subdomain`). If the API response is tampered with (MITM, compromised CDN, or a future bug that returns attacker-controlled data), this is an open redirect to an arbitrary `https://` URL. At minimum there is no allowlist validation that the domains end with the expected base domain before navigation.

**Fix:** Validate the domain against the expected base domain before navigating:
```tsx
const BASE_DOMAIN = import.meta.env.VITE_APP_BASE_DOMAIN || 'realstate.ca'

function isSafeRedirect(host: string): boolean {
    return host === BASE_DOMAIN || host.endsWith(`.${BASE_DOMAIN}`)
}

// Before navigating:
if (subdomain && isSafeRedirect(subdomain)) {
    window.location.href = `https://${subdomain}`
}
```

---

### CR-03: Unvalidated base64 favicon injected into model attributes before sanitization

**File:** `backend/app/controllers/v1/onboarding/brokerages_controller.rb:37-48`

**Issue:** `brokerage_attrs["favicon_url"]` is set from `brokerage_params`, which permits `favicon_url` via strong parameters. The check `start_with?("data:")` is the only guard before the full base64 string is passed to `S3UploadService#upload_base64`. There is no validation of:
1. **Maximum size** — a client can send an arbitrarily large base64 string, consuming server memory and S3 bandwidth.
2. **Allowed MIME types** — `extract_content_type` falls back to `application/octet-stream`, and `mime_type_to_extension` falls back to `.bin`. A malicious client can upload arbitrary binary content (e.g., an executable) with a `.bin` extension to S3.

An SVG (`image/svg+xml`) is also accepted, which can contain embedded scripts and be served as an active document if the S3 bucket or CDN does not force-download content-disposition headers.

**Fix:**
```ruby
ALLOWED_FAVICON_MIME_TYPES = %w[image/png image/jpeg image/gif image/webp image/x-icon image/vnd.microsoft.icon].freeze
MAX_FAVICON_BASE64_BYTES = 512_000 # ~375 KB decoded

content_type = extract_content_type(brokerage_attrs["favicon_url"])
unless ALLOWED_FAVICON_MIME_TYPES.include?(content_type)
  return render json: { error: "Unsupported favicon type" }, status: :unprocessable_entity
end

if brokerage_attrs["favicon_url"].bytesize > MAX_FAVICON_BASE64_BYTES
  return render json: { error: "Favicon too large" }, status: :unprocessable_entity
end
```
Remove `image/svg+xml` from allowed types entirely, or ensure the S3 bucket policy sets `Content-Disposition: attachment` for SVG objects.

---

### CR-04: N+1 query — `show_welcome_banner` fires a DB query per user in every collection serialization

**File:** `backend/app/serializers/user_serializer.rb:37-45`

**Issue:** `show_welcome_banner` is declared as a plain `attribute` (not guarded with an `if:` proc), so it executes unconditionally on every serialized user. It runs `BrokerageMembership.without_deleted.find_by(...)` — one query per user record. Any collection endpoint that serializes users (admin users list, group users list, etc.) now issues N membership queries per response. The project's `AssociationLoader` pattern exists explicitly to prevent this, but was not applied here.

**Fix:** Either guard behind an `if:` conditional that is false for collection contexts, or pass membership data via `instance_options` from the controller and read it in the serializer without hitting the DB:
```ruby
attribute :show_welcome_banner, if: :show_welcome_banner?

def show_welcome_banner?
  @instance_options[:include_welcome_banner] == true
end

def show_welcome_banner
  @instance_options[:welcomed_at_by_user_id]&.fetch(object.id, nil).nil?
end
```
The profile controller (the only place the banner matters) can pass `welcomed_at` pre-loaded; all other serialization paths set `include_welcome_banner: false`.

---

### CR-05: `accept_token` — `skip_brokerage_membership?` override is named but never used; membership role is not set when record already exists

**File:** `backend/app/controllers/v1/dashboard/invitations_controller.rb:11-13, 89-91`

**Issue 1 — dead override:** `skip_brokerage_membership?` returns `true` for `"accept_token"` (line 11-13), which bypasses the membership existence check in `CognitoAuth`. This is correct intent — the user may not yet be a member. However the method name is `skip_brokerage_membership?` and it is defined on the controller, but `CognitoAuth` only calls `skip_brokerage_membership?` inside `authenticate_cognito_user!`, and `accept_token` calls `before_action :authenticate_cognito_user!` through the default `except: [:validate_token]` filter — so it IS applied. The logic is fine, but it needs a test; silently removing this override would be a security regression with no compile-time warning.

**Issue 2 — BLOCKER:** `find_or_create_by!` on line 89 sets `m.role = invitation.role` **only inside the block**, which runs only when the record is *created*. If a `BrokerageMembership` already exists (e.g., user previously accepted a different invitation to the same brokerage), the role from the new invitation is silently ignored and the user keeps their old role. This means an invitation for `role: "owner"` does nothing if the user is already a member with `role: "agent"`.

```ruby
# Current (role only set on create):
BrokerageMembership.find_or_create_by!(user_id: user.id, brokerage_id: brokerage.id) do |m|
  m.role = invitation.role
end
```

This is an inconsistency/logic error. Whether it is a bug depends on product intent, but no comment documents the decision. If the intent is "never downgrade role," that logic must be explicit:

```ruby
membership = BrokerageMembership.without_deleted.find_or_initialize_by(
  user_id: user.id, brokerage_id: brokerage.id
)
# Only set role if creating, or if the new role is a promotion
membership.role ||= invitation.role
membership.save!
```

Also: `find_or_create_by!` does not call `.without_deleted`, so a soft-deleted membership record will not be found and a duplicate will be created, violating the unique index.

---

## Warnings

### WR-01: `submit` in `CreateBrokerageContext` — unhandled error swallows wizard state, no toast on failure

**File:** `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx:111-119`

**Issue:** `createMutation.mutateAsync(payload)` throws on a non-2xx HTTP response. The `await` on line 111 is not wrapped in try/catch. If `mutateAsync` rejects (network error, 500, etc.), the exception propagates up to the caller (`DomainStep.handleContinue`). `DomainStep` does catch it (line 73-79), but maps all errors onto `errors.subdomain`, which is confusing when the root cause is unrelated to the subdomain (e.g., a server 500).

More critically: the error check `if (data.error)` on line 113 is executed only for 2xx responses that contain an `{ error: "..." }` body. A genuine 4xx/5xx response never reaches line 113, so `throw new Error(detail)` on line 115 is never reached for real HTTP errors. The error classification in `DomainStep` is therefore unreliable.

**Fix:** Wrap the mutateAsync call and distinguish HTTP errors from app-level errors. Show a toast for non-domain errors:
```tsx
const data = await createMutation.mutateAsync(payload)
// data.error here is only a 2xx soft error; real HTTP errors already threw
if (data.error) {
    const detail = data.details?.join(', ') || data.error
    throw new Error(detail)
}
```
At minimum, add a toast in the `catch` block of `CreateBrokerageContext.submit` so the user gets feedback independent of the calling component.

---

### WR-02: `JoinBrokerage` — `handleAccept` is not wrapped in try/catch; unhandled rejection on network error

**File:** `frontend/src/containers/auth/joinBrokerage/JoinBrokerage.tsx:41-50`

**Issue:** `handleAccept` calls `acceptMutation.mutateAsync()` without try/catch. If the network request fails, the promise rejects and produces an unhandled rejection. The component does display `acceptMutation.isError` for the signed-in case (line 159), but for the `CreateAccount` flow at line 179 (`onAuthenticated={handleAccept}`), any rejection after account creation is silently swallowed — the user sees no feedback and does not reach the dashboard.

**Fix:**
```tsx
const handleAccept = useCallback(async () => {
    try {
        const accepted = await acceptMutation.mutateAsync()
        const nextStep = accepted?.nextStep
        if (nextStep && nextStep !== 'dashboard') {
            navigate(`/${nextStep}`, { replace: true })
            return
        }
        navigate('/', { replace: true })
    } catch {
        // acceptMutation.isError will be true; the signed-in UI renders the error.
        // For the CreateAccount flow, surface a toast:
        toast.error('Failed to accept invitation. Please try again.')
    }
}, [acceptMutation, navigate])
```

---

### WR-03: `JoinBrokerage` — `data?.error` check occurs after `validationQuery.isError` branch, but a 4xx response body `{ error: "..." }` is never reached

**File:** `frontend/src/containers/auth/joinBrokerage/JoinBrokerage.tsx:74-117`

**Issue:** When `validate_token` returns a non-2xx status (e.g., 404 for invalid token, 410 for expired), Axios throws an error, `validationQuery.isError` becomes true, and the generic "Unable to validate invite" card is shown. The check `if (data?.error)` at line 97 is unreachable for any non-2xx response — `data` will be `undefined` in the error path. This means the specific `next_step` values (`"expired"`, `"revoked"`, `"already-accepted"`) returned in the 4xx body are never read, and the user always sees the same generic error card regardless of the failure reason.

**Fix:** In `validateInviteToken`, catch Axios errors and return the response body (which contains `{ error, next_step, contact }`) as the resolved value rather than rejecting, so `validationQuery.data` is populated for error cases:
```ts
const validateInviteToken = async (token: string) => {
    try {
        const response = await api.post('/v1/dashboard/invitations/validate_token', { invite_token: token })
        return response.data
    } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: unknown } }
        if (axiosErr.response?.data) return axiosErr.response.data
        throw err
    }
}
```

---

### WR-04: `useFetchDashboardBrokerage` uses deprecated TanStack Query v5 `onError` option

**File:** `frontend/src/store/hooks/Dashboard/useFetchDashboardBrokerage.ts:11-13`

**Issue:** The `onError` callback passed to `useQuery` was removed in TanStack Query v5. In v5, `onError` on `useQuery` is silently ignored — the error is not logged. The correct v5 approach is to handle errors via the `error` return value or a global `QueryCache` error handler.

**Fix:** Remove `onError` from the options and handle the error via the returned `error` value:
```ts
const { isLoading, data, isError, error, refetch } = useQuery({
    queryKey: dashboardBrokerageKeys.all,
    queryFn: fetchBrokerageContact,
    retry: false,
})
if (error) console.error('Failed to fetch dashboard brokerage:', error)
```

---

### WR-05: `CreateBrokerageContext` — `createMutation.isLoading` uses removed TanStack Query v5 API

**File:** `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx:133`

**Issue:** `createMutation.isLoading` was renamed to `createMutation.isPending` in TanStack Query v5. `isLoading` on mutations is no longer defined in v5 and will always be `undefined` (falsy). This means `state.isSubmitting` is always `false`, the submit button is never disabled during the mutation, and the "Creating…" label never appears — the user can double-submit.

**Fix:**
```tsx
isSubmitting: createMutation.isPending,
```

---

### WR-06: `invitations_controller#index` — `per_page` not capped at 100

**File:** `backend/app/controllers/v1/dashboard/invitations_controller.rb:131-135`

**Issue:** The `index` action accepts `per_page` from params and passes it directly to Pagy without capping at 100. CLAUDE.md explicitly requires: "Always cap `per_page` at 100 to prevent abusive large-page requests." A client can request `per_page=100000` to dump the entire invitations table in one response.

**Fix:**
```ruby
per_page = params[:per_page].to_i
items = per_page.positive? ? [per_page, 100].min : 10
@pagy, invitations = pagy(invitations_scope, items: items)
```

---

## Info

### IN-01: `dismissWelcome` API module — `response.data` cast to interface that will already be camelCased

**File:** `frontend/src/assets/api/account/dismissWelcome.ts:9`

**Issue:** `return response.data as DismissWelcomeResponse` is fine. The interface correctly uses `welcomedAt` (camelCase) matching the Axios interceptor's `camelcaseKeys` transform. No functional issue, but worth noting the backend sends `welcomed_at` and the cast is only safe because the interceptor runs first.

---

### IN-02: Migration adds `deleted_at` column to `brokerage_memberships` but prior queries are not audited

**File:** `backend/db/migrate/20260503000001_add_welcomed_at_to_brokerage_memberships.rb`

**Issue:** Adding `acts_as_paranoid` to `BrokerageMembership` and the `deleted_at` column means all pre-existing queries on `brokerage_memberships` throughout the codebase now silently filter out soft-deleted records — or do not, depending on whether `without_deleted` was being called. Any code that was previously relying on `BrokerageMembership.where(...)` now gets a default scope that excludes deleted records, but `BrokerageMembership.exists?` in `CognitoAuth` (CR-01) now includes them. A full audit of every `BrokerageMembership` query is warranted.

---

### IN-03: `GeneralDashboard` — `onCardClick` for `newListings` sets `showRejected: true` unconditionally

**File:** `frontend/src/containers/dashboard/general/GeneralDashboard.tsx:44-51`

**Issue:** Every `onCardClick` handler calls `actions.setShowRejected(true)` before applying the card-specific filter. This means clicking "New Listings" (or any summary card) always activates the `showRejected` filter. This appears unintentional — users clicking "New Listings" do not expect to see rejected properties.

**Fix:** Remove the unconditional `actions.setShowRejected(true)` call from the `onCardClick` handler, or only set it for the card type that intends to show rejected listings.

---

_Reviewed: 2026-05-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
