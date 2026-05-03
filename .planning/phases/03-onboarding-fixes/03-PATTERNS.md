# Phase 3: Onboarding Fixes - Pattern Map

**Mapped:** 2026-05-03
**Files analyzed:** 12 new/modified files
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/controllers/v1/onboarding/brokerages_controller.rb` | controller | request-response | `backend/app/controllers/v1/account/profile_controller.rb` | role-match (same file, extend response) |
| `backend/app/controllers/v1/dashboard/invitations_controller.rb` | controller | request-response | same file — two one-liner fixes | exact |
| `backend/db/migrate/*_add_welcomed_at_to_brokerage_memberships.rb` | migration | batch | `backend/db/migrate/20260427035534_add_soft_delete_to_group_estates.rb` | exact |
| `backend/app/controllers/v1/account/profile_controller.rb` | controller | request-response | same file — new action added | exact |
| `frontend/src/containers/createBrokerage/steps/DomainStep.tsx` | component | request-response | same file — add try/catch | exact |
| `frontend/src/containers/createBrokerage/steps/SuccessStep.tsx` | component | request-response | same file — redirect fix + DNS button | exact |
| `frontend/src/store/hooks/Auth/useCreateBrokerage.ts` | hook | request-response | `frontend/src/store/hooks/Admin/Domains/useVerifyDomain.ts` | exact |
| `frontend/src/containers/auth/joinBrokerage/JoinBrokerage.tsx` | component | request-response | same file — navigate path fix | exact |
| `frontend/src/containers/auth/Invitation.tsx` | component | request-response | same file — nextStep guard fix | exact |
| `frontend/src/assets/api/account/dismissWelcome.ts` | api-module | request-response | `frontend/src/assets/api/dashboard/notifications/markNotificationRead.ts` | exact |
| `frontend/src/store/hooks/Account/useDismissWelcome.ts` | hook | request-response | `frontend/src/store/hooks/Dashboard/notifications/useMarkNotificationRead.tsx` | exact |
| `frontend/src/components/dashboard/WelcomeBanner.tsx` | component | event-driven | `frontend/src/containers/dashboard/notifications/Notifications.tsx` (Card + X button pattern) | role-match |

---

## Pattern Assignments

### `backend/app/controllers/v1/onboarding/brokerages_controller.rb` (controller, request-response)

**Change:** Extend the `render json:` in `#create` to include `subdomain_id` and `custom_domain_id`.

**Analog:** The file itself — lines 52-78. Extend the `domains:` hash in the render block.

**Current render pattern** (lines 67-78):
```ruby
render json: {
  brokerage: BrokerageSerializer.new(brokerage).as_json,
  domains: {
    subdomain: full_subdomain_host,
    custom_domain: custom_domain.presence
  }
}, status: :created
```

**Target pattern — extend domains hash:**
The two `BrokerageDomain.create!` calls return records. Capture them in variables inside the transaction block and reference their `.id` in the render:

```ruby
ActiveRecord::Base.transaction do
  brokerage = Brokerage.create!(brokerage_attrs)

  subdomain_domain = BrokerageDomain.create!(
    brokerage_id: brokerage.id,
    domain: full_subdomain_host,
    verified: true,
    verified_at: Time.current,
    verification_token: nil
  )

  custom_domain_record = if custom_domain.present?
    BrokerageDomain.create!(brokerage_id: brokerage.id, domain: custom_domain, verified: false)
  end

  BrokerageMembership.find_or_create_by!(user_id: Current.user.id, brokerage_id: brokerage.id) do |m|
    m.role = "owner"
    m.primary = true
  end
end

render json: {
  brokerage: BrokerageSerializer.new(brokerage).as_json,
  domains: {
    subdomain: full_subdomain_host,
    subdomain_id: subdomain_domain.id,
    custom_domain: custom_domain.presence,
    custom_domain_id: custom_domain_record&.id
  }
}, status: :created
```

**Note:** `subdomain_domain` and `custom_domain_record` must be declared before the transaction block with `= nil` so they are accessible in the render after the block.

---

### `backend/app/controllers/v1/dashboard/invitations_controller.rb` (controller, request-response)

**Change:** Two one-liner fixes — `group.id.to_s` → `group.uid` in `#accept` (line 172) and `#accept_token` (line 106).

**Analog:** The file itself.

**Current broken pattern** (lines 106 and 172):
```ruby
next_step = group.id.to_s
```

**Fixed pattern:**
```ruby
next_step = group.uid
```

Apply in both `#accept_token` (inside the `if invitation.group_id.present?` block, line ~106) and `#accept` (line ~172, last line before `render json:`).

**Brokerage-level invitation handling** (D-10): In `#accept_token`, the `next_step` is already initialized to `"dashboard"` before the `if invitation.group_id.present?` block. That default is correct — no change needed there.

---

### `backend/db/migrate/*_add_welcomed_at_to_brokerage_memberships.rb` (migration, batch)

**Analog:** `backend/db/migrate/20260427035534_add_soft_delete_to_group_estates.rb`

**Migration pattern** (lines 1-12):
```ruby
class AddSoftDeleteToGroupEstates < ActiveRecord::Migration[7.1]
  def change
    add_column :group_estates, :deleted_at, :datetime
    add_index  :group_estates, :deleted_at
    # ...
  end
end
```

**Target migration:**
```ruby
class AddWelcomedAtToBrokerageMemberships < ActiveRecord::Migration[7.1]
  def change
    add_column :brokerage_memberships, :welcomed_at, :datetime
  end
end
```

No index needed — this column is read once per session via profile query, not filtered/sorted.

---

### `backend/app/controllers/v1/account/profile_controller.rb` (controller, request-response)

**Change:** Add `#dismiss_welcome` action. New route `POST /v1/account/profile/dismiss_welcome`.

**Analog:** The file itself — the `#update` action pattern (lines 27-45).

**Existing update pattern** (lines 27-45):
```ruby
def update
  user = Current.user
  unless user.update(profile_params)
    return render json: {error: "Failed to update profile", errors: user.errors.messages}, status: :unprocessable_entity
  end
  # re-fetch and render user
  render json: { user: ... }
end
```

**Target dismiss_welcome action:**
```ruby
# POST /v1/account/profile/dismiss_welcome
def dismiss_welcome
  membership = BrokerageMembership.find_by!(
    user_id: Current.user.id,
    brokerage_id: Current.brokerage.id
  )
  membership.update!(welcomed_at: Time.current)
  render json: { welcomed_at: membership.welcomed_at }, status: :ok
rescue ActiveRecord::RecordNotFound
  render json: { error: "Membership not found" }, status: :not_found
end
```

**`show_welcome_banner` in profile response:** The `#show` action re-fetches the user with `includes(:current_brokerage_membership)`. The `UserSerializer` (or the controller render) should expose `show_welcome_banner: membership.welcomed_at.nil?`. Consult `UserSerializer` to find the correct place — add it as a computed attribute there or pass via `instance_options`.

**Router:** Add `post :dismiss_welcome, on: :collection` in the account routes block alongside the existing `show`/`update` actions.

---

### `frontend/src/containers/createBrokerage/steps/DomainStep.tsx` (component, request-response)

**Change:** Wrap `await actions.submit(domain)` in try/catch; on HTTP error set `errors.subdomain`.

**Analog:** The file itself — existing `errors` state and `setErrors` pattern (lines 17, 47-65).

**Existing errors state** (lines 17, 62-64):
```tsx
const [errors, setErrors] = useState<{ subdomain?: string; customDomain?: string }>({})
// ...
setErrors(next)
return Object.keys(next).length === 0
```

**Existing handleContinue** (lines 67-72):
```tsx
const handleContinue = async () => {
    if (!validate()) return
    const domain = { subdomain, customDomain: customDomain.trim().toLowerCase() }
    actions.saveDomain(domain)
    await actions.submit(domain)
}
```

**Target handleContinue with try/catch:**
```tsx
const handleContinue = async () => {
    if (!validate()) return
    const domain = { subdomain, customDomain: customDomain.trim().toLowerCase() }
    actions.saveDomain(domain)
    try {
        await actions.submit(domain)
    } catch (err: unknown) {
        const message =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error
            || 'Something went wrong. Please try again.'
        setErrors((prev) => ({ ...prev, subdomain: message }))
    }
}
```

**Error display** — the existing `SubdomainInput` already renders `{error && <p className="text-xs text-destructive">{error}</p>}` when `error` prop is set (line 46 of SubdomainInput.tsx). The existing `errors.subdomain` binding on line 90 of DomainStep already passes this prop — no new JSX needed.

---

### `frontend/src/containers/createBrokerage/steps/SuccessStep.tsx` (component, request-response)

**Change:** Replace `navigate('/')` with `window.location.href`; add DNS verify button for Premium.

**Analog:** The file itself (lines 1-44) + `frontend/src/store/hooks/Admin/Domains/useVerifyDomain.ts` for the verify mutation pattern.

**Existing imports** (lines 1-6):
```tsx
import React from 'react'
import { CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'  // remove this
import { Button } from '@/components/ui/button'
import DnsInstructions from '@/components/createBrokerage/DnsInstructions'
import { useCreateBrokerageContext } from '@/containers/createBrokerage/CreateBrokerageContext'
```

**Target imports:**
```tsx
import React, { useState } from 'react'
import { CheckCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DnsInstructions from '@/components/createBrokerage/DnsInstructions'
import { useCreateBrokerageContext } from '@/containers/createBrokerage/CreateBrokerageContext'
import verifyDomain from '@/assets/api/admin/domains/verifyDomain'
```

**State needed:**
```tsx
const [isVerifying, setIsVerifying] = useState(false)
const [verificationResult, setVerificationResult] = useState<'verified' | 'pending' | null>(null)

const subdomainId = state.result?.domains?.subdomainId
const customDomainId = state.result?.domains?.customDomainId
```

**Redirect fix** (replace line 37):
```tsx
// Before:
<Button className="w-full" onClick={() => navigate('/', { replace: true })}>
// After:
<Button className="w-full" onClick={() => { window.location.href = `https://${subdomain}` }}>
```

**DNS verify handler:**
```tsx
const handleCheckDns = async () => {
    if (!customDomainId) return
    setIsVerifying(true)
    try {
        const result = await verifyDomain(customDomainId)
        setVerificationResult(result.verified ? 'verified' : 'pending')
    } catch {
        setVerificationResult('pending')
    } finally {
        setIsVerifying(false)
    }
}
```

**DNS verify button (placed inside `{customDomain && <DnsInstructions ... />}` block):**
```tsx
<Button
    type="button"
    variant="outline"
    className="w-full"
    onClick={handleCheckDns}
    disabled={isVerifying}
>
    {isVerifying
        ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Checking…</>
        : <><RefreshCw className="mr-2 h-4 w-4" /> Check DNS status</>
    }
</Button>

{verificationResult === 'verified' && (
    <p className="text-sm text-green-600 font-medium">Domain verified</p>
)}
{verificationResult === 'pending' && (
    <p className="text-sm text-muted-foreground">Not yet verified — DNS may still be propagating</p>
)}
```

**Two CTA buttons when verified (replace single Go to dashboard button):**
```tsx
{verificationResult === 'verified' && customDomain ? (
    <div className="flex gap-3">
        <Button className="flex-1" onClick={() => { window.location.href = `https://${customDomain}` }}>
            Go to custom domain
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => { window.location.href = `https://${subdomain}` }}>
            Go to subdomain
        </Button>
    </div>
) : (
    <Button className="w-full" onClick={() => { window.location.href = `https://${subdomain}` }}>
        Go to dashboard
    </Button>
)}
```

**Type update needed in `CreateBrokerageResponse`** (`frontend/src/assets/api/onboarding/createBrokerage.ts` lines 19-33): Add `subdomainId` and `customDomainId` to the `domains` field:
```ts
domains?: {
    subdomain?: string
    subdomainId?: number
    customDomain?: string | null
    customDomainId?: number | null
}
```

---

### `frontend/src/store/hooks/Auth/useCreateBrokerage.ts` (hook, request-response)

**Change:** Remove/suppress `onError` toast so errors propagate to the DomainStep try/catch.

**Analog:** The file itself (lines 1-14).

**Current pattern** (lines 5-12):
```ts
return useMutation<CreateBrokerageResponse, Error, CreateBrokerageRequest>({
    mutationFn: createBrokerage,
    onError: () => {
        toast.error('Failed to create brokerage. Please try again.')
    },
})
```

**Target pattern — remove onError:**
```ts
const useCreateBrokerage = () => {
    return useMutation<CreateBrokerageResponse, Error, CreateBrokerageRequest>({
        mutationFn: createBrokerage,
        // onError removed: errors are caught inline in DomainStep.handleContinue
    })
}
```

Also verify `CreateBrokerageContext.submit()` (lines 88-122): The `const data = await createMutation.mutateAsync(payload)` on line 111 will throw on HTTP error — the existing `if (data.error)` branch on line 113 handles 2xx-with-error-field. Remove the `toast.error(detail)` on line 115 (or keep it — the DomainStep catch handles the HTTP throw). The cleanest approach: let the throw propagate from `mutateAsync` up through `submit()` to `handleContinue`'s catch, so remove the `toast.error` in the `if (data.error)` branch too and instead re-throw:
```ts
if (data.error) {
    const detail = data.details?.join(', ') || data.error
    throw new Error(detail)
}
```

---

### `frontend/src/containers/auth/joinBrokerage/JoinBrokerage.tsx` (component, request-response)

**Change:** Fix `navigate` path in `handleAccept` (lines 41-51).

**Analog:** The file itself.

**Current broken pattern** (lines 44-50):
```tsx
const handleAccept = useCallback(async () => {
    const accepted = await acceptMutation.mutateAsync()
    const nextStep = accepted?.nextStep

    if (nextStep) {
        navigate(`dashboard/${nextStep}`, { replace: true })  // relative path, wrong
        return
    }
    navigate('dashboard', { replace: true })  // wrong fallback
}, [acceptMutation, navigate])
```

**Target pattern (D-11):**
```tsx
const handleAccept = useCallback(async () => {
    const accepted = await acceptMutation.mutateAsync()
    const nextStep = accepted?.nextStep

    if (nextStep && nextStep !== 'dashboard') {
        navigate(`/${nextStep}`, { replace: true })
        return
    }
    navigate('/', { replace: true })
}, [acceptMutation, navigate])
```

---

### `frontend/src/containers/auth/Invitation.tsx` (component, request-response)

**Change:** Guard `nextStep === 'dashboard'` in `respondMutation.onSuccess` (lines 25-36).

**Analog:** The file itself.

**Current pattern** (lines 25-36):
```tsx
onSuccess: (data) => {
    const nextStep = data?.nextStep
    if (nextStep === 'brokerage-contact') {
        navigate('/auth/brokerage-contact')
        return
    }
    if (nextStep) {
        navigate(`/${nextStep}`)
        return
    }
    navigate('/')
}
```

**Target pattern (D-12):**
```tsx
onSuccess: (data) => {
    const nextStep = data?.nextStep
    if (nextStep === 'brokerage-contact') {
        navigate('/auth/brokerage-contact')
        return
    }
    if (nextStep && nextStep !== 'dashboard') {
        navigate(`/${nextStep}`)
        return
    }
    navigate('/')
}
```

The existing `navigate('/')` fallback (last line) already covers the `nextStep === 'dashboard'` case — the fix is adding `nextStep !== 'dashboard'` to the truthy-nextStep guard.

---

### `frontend/src/assets/api/account/dismissWelcome.ts` (api-module, request-response)

**Analog:** `frontend/src/assets/api/dashboard/notifications/markNotificationRead.ts`

**Analog pattern** (lines 1-17):
```ts
import api from '@/assets/axios/axios'
import { NotificationItem } from '@/assets/types/notificationType'

export interface MarkNotificationReadPayload {
    notificationId: string
}

export interface MarkNotificationReadResponse {
    notification: NotificationItem
}

const markNotificationRead = async ({ notificationId }: MarkNotificationReadPayload): Promise<MarkNotificationReadResponse> => {
    const response = await api.patch(`/v1/dashboard/notifications/${notificationId}/read`)
    return response.data
}

export default markNotificationRead
```

**Target file:**
```ts
import api from '@/assets/axios/axios'

export interface DismissWelcomeResponse {
    welcomedAt: string
}

const dismissWelcome = async (): Promise<DismissWelcomeResponse> => {
    const response = await api.post('/v1/account/profile/dismiss_welcome')
    return response.data
}

export default dismissWelcome
```

---

### `frontend/src/store/hooks/Account/useDismissWelcome.ts` (hook, request-response)

**Analog:** `frontend/src/store/hooks/Dashboard/notifications/useMarkNotificationRead.tsx` (fire-and-forget mutation) + `frontend/src/store/hooks/Account/useUpdateAccountProfile.tsx` (account namespace + queryKeys pattern).

**Analog pattern — fire-and-forget mutation** (useMarkNotificationRead lines 1-21):
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import markNotificationRead, { MarkNotificationReadPayload } from '@/assets/api/dashboard/notifications/markNotificationRead'
import { AxiosErrorType } from '@/assets/types/axiosErrorType'
import { dashboardNotificationsKeys } from '@/store/hooks/queryKeys'

const useMarkNotificationRead = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (payload: MarkNotificationReadPayload) => markNotificationRead(payload),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: dashboardNotificationsKeys.all })
        },
        onError: (err: AxiosErrorType) => {
            console.error('Failed to mark notification read:', err)
        },
    })
}
```

**Target file:**
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import dismissWelcome from '@/assets/api/account/dismissWelcome'
import { AxiosErrorType } from '@/assets/types/axiosErrorType'
import { accountProfileKeys } from '@/store/hooks/queryKeys'

const useDismissWelcome = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: dismissWelcome,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: accountProfileKeys.all })
        },
        onError: (err: AxiosErrorType) => {
            console.error('Failed to dismiss welcome banner:', err)
        },
    })
}

export default useDismissWelcome
```

**Note:** No toast on success or error — banner dismiss is silent (D-18, optimistic fire-and-forget).

---

### `frontend/src/components/dashboard/WelcomeBanner.tsx` (component, event-driven)

**Analog:** `frontend/src/containers/dashboard/notifications/Notifications.tsx` — Card layout + Button patterns. And `frontend/src/components/createBrokerage/SubdomainInput.tsx` — compact component with single-responsibility props.

**Available shadcn/ui components:** `card.tsx`, `badge.tsx`, `button.tsx` — all confirmed present in `/frontend/src/components/ui/`.

**Import pattern** (from Notifications.tsx lines 1-13):
```tsx
import { useState } from 'react'
import { X } from 'lucide-react'           // dismiss icon
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
```

**Props interface:**
```tsx
interface WelcomeBannerProps {
    brokerageName: string
    groupNames: string[]
    onDismiss: () => void  // called on X click — caller owns local visibility state
}
```

**Optimistic dismiss pattern** — the banner's visibility is controlled by local state in the parent context (HomepageContext or similar), not inside this component. The component only renders when the parent says to show it, and calls `onDismiss` which the parent handles by hiding immediately and firing the mutation in the background:

```tsx
// In parent context:
const [bannerVisible, setBannerVisible] = useState(true)  // set false once profile shows welcomed_at != null
const dismissMutation = useDismissWelcome()

const dismissBanner = useCallback(() => {
    setBannerVisible(false)                  // optimistic — hide immediately
    dismissMutation.mutate()                 // fire and forget
}, [dismissMutation])
```

**Badge pattern for group names** — use `badge.tsx` with `variant="secondary"`:
```tsx
import { Badge } from '@/components/ui/badge'
// ...
{groupNames.map((name) => (
    <Badge key={name} variant="secondary">{name}</Badge>
))}
```

**Full component structure:**
```tsx
const WelcomeBanner: React.FC<WelcomeBannerProps> = ({ brokerageName, groupNames, onDismiss }) => (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                    Welcome to {brokerageName}
                </p>
                {groupNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                        {groupNames.map((name) => (
                            <Badge key={name} variant="secondary">{name}</Badge>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        You haven't been added to any groups yet.
                    </p>
                )}
            </div>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 shrink-0 p-0"
                onClick={onDismiss}
                aria-label="Dismiss welcome banner"
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    </div>
)
```

**Placement:** Render at the top of `Homepage.tsx` content area (above `<ActivityStatsRow>`), inside `<div className="w-full space-y-6 p-6">`, gated on `bannerVisible`. Data sourced from `useGetAccountProfile` (for `show_welcome_banner` flag) and `useFetchAccountGroups` (for group names, `paginate=false` or first page).

---

## Shared Patterns

### Auth/Brokerage Resolution in Backend Controllers
**Source:** `backend/app/controllers/v1/account/profile_controller.rb` lines 1-8
**Apply to:** New `dismiss_welcome` action — same concerns and before_action stack
```ruby
module V1
  module Account
    class ProfileController < ApplicationController
      include CognitoAuth
      include BrokerageAuth

      before_action :authenticate_cognito_user!
```

### TanStack Mutation (fire-and-forget, no toast)
**Source:** `frontend/src/store/hooks/Dashboard/notifications/useMarkNotificationRead.tsx`
**Apply to:** `useDismissWelcome.ts`
```ts
return useMutation({
    mutationFn: ...,
    onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ... })
    },
    onError: (err: AxiosErrorType) => {
        console.error('...', err)  // silent — no toast
    },
})
```

### API Module Pattern
**Source:** `frontend/src/assets/api/account/updateAccountProfile.tsx` lines 1-25
**Apply to:** `dismissWelcome.ts`
```ts
import axiosInstance from '@/assets/axios/axios'

const apiCall = async (payload): Promise<ResponseType> => {
    const response = await axiosInstance.post('/v1/account/...', payload)
    return response.data as ResponseType
}
export default apiCall
```

### queryKeys Entry Pattern
**Source:** `frontend/src/store/hooks/queryKeys.tsx` lines 143-150
**Apply to:** Add `accountMembershipKeys` entry if banner needs its own key; otherwise reuse `accountProfileKeys.all` since profile query will include `show_welcome_banner`
```ts
export const accountProfileKeys = {
    all: ['account', 'profile'] as const,
}
// pattern for a new key:
export const accountMembershipKeys = {
    all: ['account', 'membership'] as const,
}
```

### Inline Form Error (Frontend)
**Source:** `frontend/src/containers/createBrokerage/steps/DomainStep.tsx` lines 17, 46-64; `frontend/src/components/createBrokerage/SubdomainInput.tsx` line 46
**Apply to:** DomainStep try/catch — reuse existing `errors` state; no new state needed
```tsx
// SubdomainInput already renders:
{error && <p className="text-xs text-destructive">{error}</p>}
// DomainStep already passes:
<SubdomainInput error={errors.subdomain} ... />
// Catch block adds:
setErrors((prev) => ({ ...prev, subdomain: message }))
```

### window.location.href Cross-Domain Navigation
**Source:** Decision D-03 — no existing analog in the codebase (first cross-domain nav). Standard Web API.
**Apply to:** SuccessStep "Go to dashboard" and post-verify CTAs
```ts
window.location.href = `https://${subdomain}`   // always include https://
```

---

## No Analog Found

All files have close analogs in the codebase. The only pattern with no existing project analog is cross-domain `window.location.href` navigation — use the standard Web API directly (no project wrapper exists).

---

## Metadata

**Analog search scope:** `backend/app/controllers/`, `frontend/src/assets/api/`, `frontend/src/store/hooks/`, `frontend/src/containers/`, `frontend/src/components/`, `backend/db/migrate/`
**Files scanned:** ~40
**Pattern extraction date:** 2026-05-03
