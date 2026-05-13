# Phase 5: Calendar Sync - Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 28 (18 backend, 10 frontend)
**Analogs found:** 26 / 28

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/db/migrate/YYYYMMDD_create_user_calendar_connections.rb` | migration | CRUD | `backend/db/migrate/20260321000002_create_brokerage_board_credentials.rb` | exact |
| `backend/db/migrate/YYYYMMDD_create_estate_date_calendar_events.rb` | migration | CRUD | `backend/db/migrate/20260427035534_add_soft_delete_to_group_estates.rb` | role-match |
| `backend/db/migrate/YYYYMMDD_add_timezone_to_brokerages.rb` | migration | CRUD | `backend/db/migrate/20260509000001_add_auth_provider_to_users.rb` | exact |
| `backend/app/models/user_calendar_connection.rb` | model | CRUD | `backend/app/models/brokerage_board_credential.rb` | exact |
| `backend/app/models/estate_date_calendar_event.rb` | model | CRUD | `backend/app/models/estate_date_rsvp.rb` | role-match |
| `backend/app/jobs/calendar_sync_job.rb` | job | event-driven | `backend/app/jobs/fanout_notifications_job.rb` | exact |
| `backend/app/services/calendar/google_calendar_adapter.rb` | service | request-response | *(no analog — new external integration)* | none |
| `backend/app/services/calendar/microsoft_calendar_adapter.rb` | service | request-response | *(no analog — new external integration)* | none |
| `backend/app/services/calendar/apple_calendar_adapter.rb` | service | request-response | *(no analog — new external integration)* | none |
| `backend/app/controllers/v1/account/calendar/connections_controller.rb` | controller | CRUD | `backend/app/controllers/v1/account/profile_controller.rb` | role-match |
| `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb` | controller | request-response | `backend/app/controllers/v1/account/profile_controller.rb` | role-match |
| `backend/app/controllers/v1/account/calendar/microsoft_oauth_controller.rb` | controller | request-response | `backend/app/controllers/v1/account/profile_controller.rb` | role-match |
| `backend/app/serializers/user_calendar_connection_serializer.rb` | serializer | request-response | `backend/app/serializers/brokerage_board_credential_serializer.rb` | exact |
| `backend/config/routes.rb` (modify) | config | — | self | exact |
| `backend/app/controllers/v1/dashboard/group/estate_events_controller.rb` (modify) | controller | event-driven | self | exact |
| `frontend/src/assets/types/calendarConnectionType.ts` | type | — | `frontend/src/assets/types/estateEventType.ts` | role-match |
| `frontend/src/containers/account/CalendarContext.tsx` | provider/context | request-response | `frontend/src/containers/account/AccountContext.tsx` | exact |
| `frontend/src/components/view/account/calendar/CalendarTab.tsx` | component | request-response | `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` | role-match |
| `frontend/src/components/view/account/calendar/ProviderCard.tsx` | component | request-response | `frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx` | role-match |
| `frontend/src/store/hooks/Account/useFetchCalendarConnections.ts` | hook | request-response | `frontend/src/store/hooks/Account/useGetAccountProfile.tsx` | exact |
| `frontend/src/store/hooks/Account/useConnectGoogleCalendar.ts` | hook | request-response | `frontend/src/store/hooks/Account/useUpdateAccountProfile.tsx` | exact |
| `frontend/src/store/hooks/Account/useConnectMicrosoftCalendar.ts` | hook | request-response | `frontend/src/store/hooks/Account/useUpdateAccountProfile.tsx` | exact |
| `frontend/src/store/hooks/Account/useConnectAppleCalendar.ts` | hook | request-response | `frontend/src/store/hooks/Account/useUpdateAccountProfile.tsx` | exact |
| `frontend/src/store/hooks/Account/useDisconnectCalendar.ts` | hook | request-response | `frontend/src/store/hooks/Account/useUpdateAccountProfile.tsx` | exact |
| `frontend/src/store/hooks/Account/useResyncCalendar.ts` | hook | request-response | `frontend/src/store/hooks/Account/useUpdateAccountProfile.tsx` | exact |
| `frontend/src/assets/api/account/calendar/fetchCalendarConnections.ts` | api-module | request-response | `frontend/src/assets/api/account/getAccountProfile.tsx` | exact |
| `frontend/src/assets/api/account/calendar/connectAppleCalendar.ts` | api-module | request-response | `frontend/src/assets/api/account/updateAccountProfile.tsx` | exact |
| `frontend/src/assets/api/account/calendar/disconnectCalendar.ts` | api-module | request-response | `frontend/src/assets/api/account/updateAccountProfile.tsx` | role-match |
| `frontend/src/assets/api/account/calendar/resyncCalendar.ts` | api-module | request-response | `frontend/src/assets/api/account/updateAccountProfile.tsx` | role-match |
| `frontend/src/containers/account/Account.tsx` (modify) | component | request-response | self | exact |
| `frontend/src/store/hooks/queryKeys.tsx` (modify) | utility | — | self | exact |

---

## Pattern Assignments

### `backend/db/migrate/YYYYMMDD_create_user_calendar_connections.rb` (migration, CRUD)

**Analog:** `backend/db/migrate/20260321000002_create_brokerage_board_credentials.rb`

**Full migration pattern** (lines 1-25):
```ruby
class CreateBrokerageBoardCredentials < ActiveRecord::Migration[7.1]
  def change
    create_table :brokerage_board_credentials do |t|
      t.references :brokerage, null: false, foreign_key: true
      t.references :real_estate_board, null: false, foreign_key: true

      t.text :rets_username_ciphertext, null: false
      t.text :rets_password_ciphertext, null: false

      t.string :status, null: false, default: "active"
      t.datetime :last_verified_at

      t.datetime :deleted_at
      t.timestamps
    end

    add_index :brokerage_board_credentials,
      [:brokerage_id, :real_estate_board_id],
      unique: true,
      where: "deleted_at IS NULL",
      name: "index_bbc_on_brokerage_and_board_unique_active"

    add_index :brokerage_board_credentials, :deleted_at
  end
end
```

**Key conventions to copy:**
- Ciphertext column is `text`, named `{field}_ciphertext` (not `{field}`)
- `deleted_at` column for `acts_as_paranoid`
- Partial unique index with `where: "deleted_at IS NULL"` for soft-delete-aware uniqueness
- Separate `add_index :deleted_at` for query performance
- `add_foreign_key` called separately (not via `t.references` when using `bigint` explicitly)

**Adapt for `user_calendar_connections`:** single `credentials_ciphertext` text column; unique index on `[:user_id, :provider]` where `deleted_at IS NULL`; add `last_error`, `last_synced_at` columns.

---

### `backend/db/migrate/YYYYMMDD_create_estate_date_calendar_events.rb` (migration, CRUD)

**Analog:** `backend/db/migrate/20260427035534_add_soft_delete_to_group_estates.rb`

**Unique partial index pattern** (lines 7-11):
```ruby
add_index :group_estates, [:group_id, :estate_id],
          unique: true,
          where: "deleted_at IS NULL",
          name: "index_group_estates_on_group_id_and_estate_id_active"
```

**Key convention:** `estate_date_calendar_events` has NO soft delete (it's a sync record, not user-facing), so no `deleted_at`. The unique index on `[:estate_date_id, :user_id, :provider]` has no partial condition. Name the index explicitly: `"idx_edce_unique"`.

---

### `backend/db/migrate/YYYYMMDD_add_timezone_to_brokerages.rb` (migration, CRUD)

**Analog:** `backend/db/migrate/20260509000001_add_auth_provider_to_users.rb`

**Full pattern** (lines 1-5):
```ruby
class AddAuthProviderToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :auth_provider, :string, default: nil
  end
end
```

**Adapt:** `add_column :brokerages, :timezone, :string, default: "UTC", null: false`

---

### `backend/app/models/user_calendar_connection.rb` (model, CRUD)

**Analog:** `backend/app/models/brokerage_board_credential.rb`

**Full model pattern** (lines 1-18):
```ruby
class BrokerageBoardCredential < ApplicationRecord
  acts_as_paranoid

  belongs_to :brokerage
  belongs_to :real_estate_board

  encrypts :rets_username
  encrypts :rets_password

  enum :status, {active: "active", invalid: "invalid"}, prefix: :credential

  validates :rets_username, presence: true
  validates :rets_password, presence: true
  validates :brokerage_id, uniqueness: {
    scope: :real_estate_board_id,
    message: "is already registered with this board"
  }
end
```

**Key conventions to copy:**
- `acts_as_paranoid` at top
- `encrypts :field` uses the logical name (not `_ciphertext`) — AR Encryption provides the accessor
- `enum :status` with string values and prefix
- Uniqueness validation scoped to prevent duplicates

**Adapt for `UserCalendarConnection`:** single `encrypts :credentials`; enum status `{connected: "connected", error: "error", disconnected: "disconnected"}`, prefix `:connection`; `belongs_to :user`; `PROVIDERS = %w[google microsoft apple].freeze`; helper methods `credentials_hash` / `credentials_hash=`.

---

### `backend/app/models/estate_date_calendar_event.rb` (model, CRUD)

**Analog:** `backend/app/models/estate_date.rb` (join-table model pattern)

**Association pattern** (lines 1-14 of estate_date.rb):
```ruby
class EstateDate < ApplicationRecord
  acts_as_paranoid

  belongs_to :group_estate
  belongs_to :created_by_user, class_name: "User", optional: true

  has_many :rsvps, class_name: "EstateDateRsvp", dependent: :destroy
  has_many :rsvp_users, through: :rsvps, source: :user
```

**Key notes:** `EstateDateCalendarEvent` does NOT use `acts_as_paranoid` (sync record, not user-facing). It uses `belongs_to :estate_date` and `belongs_to :user`. No `has_many` associations needed.

---

### `backend/app/jobs/calendar_sync_job.rb` (job, event-driven)

**Analog:** `backend/app/jobs/fanout_notifications_job.rb`

**Full job pattern** (lines 1-25):
```ruby
class FanoutNotificationsJob < ApplicationJob
  queue_as :default
  retry_on StandardError, wait: :polynomially_longer, attempts: 3
  discard_on ActiveRecord::RecordNotFound

  def perform(notification_type, group_id:, estate_id:, **record_ids)
    group = Group.without_deleted.find(group_id)
    estate = Estate.without_deleted.find(estate_id)

    case notification_type
    when "comment_reply"
      comment = EstateComment.without_deleted.find(record_ids.fetch(:comment_id))
      reply = Subcomment.without_deleted.find(record_ids.fetch(:reply_id))
      NotificationFanoutService.comment_reply!(group:, estate:, comment:, reply:)
    when "event_created"
      event = EstateDate.without_deleted.find(record_ids.fetch(:event_id))
      NotificationFanoutService.event_created!(group:, estate:, event:)
    ...
    end
  end
end
```

**Copy verbatim:** `queue_as :default`, `retry_on StandardError, wait: :polynomially_longer, attempts: 3`, `discard_on ActiveRecord::RecordNotFound`.

**Adapt:** signature `perform(user_id:, provider:, estate_date_id:, action:)`; use named keyword arguments throughout; use `UserCalendarConnection.without_deleted.find_by!(...)` and `EstateDate.without_deleted.find(estate_date_id)`.

---

### `backend/app/controllers/v1/account/calendar/connections_controller.rb` (controller, CRUD)

**Analog:** `backend/app/controllers/v1/account/profile_controller.rb`

**Auth and include pattern** (lines 1-10):
```ruby
module V1
  module Account
    class ProfileController < ApplicationController
      include CognitoAuth
      include BrokerageAuth
      include Pagy::Backend

      before_action :authenticate_cognito_user!
```

**Error handling pattern** (lines 32-35):
```ruby
      unless user.update(profile_params)
        return render json: {error: "Failed to update profile", errors: user.errors.messages}, status: :unprocessable_entity
      end
```

**Render pattern** (lines 17-25):
```ruby
      render json: {
        user: ActiveModelSerializers::SerializableResource.new(
          user,
          serializer: UserSerializer,
          adapter: :attributes,
          current_brokerage_id: Current.brokerage.id,
        ).as_json
      }
```

**Key conventions for `ConnectionsController`:**
- Module path: `V1::Account::Calendar::ConnectionsController`
- Always scope to `Current.user` — never accept `user_id` from params
- `index` renders `connections` key with serializer collection
- `destroy` (disconnect) scopes: `Current.user.user_calendar_connections.without_deleted.find_by!(provider: params[:provider])`
- `create_apple` validates provider allowlist: `%w[google microsoft apple].include?(params[:provider])`
- `resync` enqueues `CalendarSyncJob` per future `EstateDate`

---

### `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb` (controller, request-response)

**Analog:** `backend/app/controllers/v1/account/profile_controller.rb`

**Auth pattern** (lines 3-9 of profile_controller.rb):
```ruby
      include CognitoAuth
      include BrokerageAuth

      before_action :authenticate_cognito_user!
```

**Key pattern for OAuth callback flow:**
- `authorize` action: generate `state = SecureRandom.hex(32)`, write to `Rails.cache` with 10-minute TTL, return `{redirect_url: url}` as JSON (frontend handles the window redirect)
- `callback` action: read `state` from cache to identify `Current.user` — do NOT trust `params[:user_id]`; exchange `code` for tokens; upsert `UserCalendarConnection`

---

### `backend/app/serializers/user_calendar_connection_serializer.rb` (serializer, request-response)

**Analog:** `backend/app/serializers/brokerage_board_credential_serializer.rb`

**Full serializer pattern** (lines 1-5):
```ruby
class BrokerageBoardCredentialSerializer < ActiveModel::Serializer
  attributes :id, :brokerage_id, :real_estate_board_id, :status, :last_verified_at, :created_at

  belongs_to :real_estate_board, serializer: RealEstateBoardSerializer
end
```

**Critical:** `UserCalendarConnectionSerializer` MUST NOT include `credentials` or `credentials_ciphertext` in `attributes`. Whitelist explicitly: `attributes :id, :provider, :status, :last_synced_at, :last_error, :created_at`.

---

### `backend/app/controllers/v1/dashboard/group/estate_events_controller.rb` (modify — add fanout)

**Analog:** self (existing file at `backend/app/controllers/v1/dashboard/group/estate_events_controller.rb`)

**Existing fanout enqueue pattern to mirror** (lines 58-63):
```ruby
          FanoutNotificationsJob.perform_later(
            "event_created",
            group_id: @group.id,
            estate_id: estate.id,
            event_id: event.id
          )
```

**Location in create action:** insert calendar fanout AFTER line 56 (`event.save!`) and BEFORE line 65 (`render json:`). Mirror the same position as `FanoutNotificationsJob`.

**Location in destroy action:** insert calendar fanout AFTER `@event.destroy` (line 77) and BEFORE `render json: {}` (line 78).

**Fanout query pattern** (from RESEARCH.md, Pattern 6 — uses CLAUDE.md soft-delete requirement):
```ruby
# Must use .without_deleted on brokerage.users per CLAUDE.md
user_ids = Current.brokerage.users.without_deleted.pluck(:id)
connections = UserCalendarConnection.without_deleted
  .where(user_id: user_ids, status: "connected")

connections.each do |conn|
  CalendarSyncJob.perform_later(
    user_id: conn.user_id,
    provider: conn.provider,
    estate_date_id: event.id,  # or @event.id in destroy
    action: "create"           # or "destroy"
  )
end
```

---

### `backend/config/routes.rb` (modify — add calendar namespace)

**Analog:** self, existing `namespace :account` block (lines 34-39)

**Existing account namespace pattern** (lines 34-39):
```ruby
    namespace :account do
      resource :profile, only: [:show, :update], controller: "profile" do
        post :dismiss_welcome
      end
      resources :groups, only: [:index]
    end
```

**New calendar namespace to add inside `namespace :account`:**
```ruby
      namespace :calendar do
        get :connections, to: "connections#index"
        delete ":provider", to: "connections#destroy", as: :disconnect_calendar
        post "apple/connect", to: "connections#create_apple"
        post ":provider/resync", to: "connections#resync"
        get "google/authorize",  to: "google_oauth#authorize"
        get "google/callback",   to: "google_oauth#callback"
        get "microsoft/authorize", to: "microsoft_oauth#authorize"
        get "microsoft/callback",  to: "microsoft_oauth#callback"
      end
```

---

### `frontend/src/assets/types/calendarConnectionType.ts` (type)

**Analog:** `frontend/src/assets/types/estateEventType.ts`

**Full type file pattern** (lines 1-21):
```typescript
export type EstateEventType = 'open-house' | 'offer-deadline' | 'private-showing' | 'inspection' | 'closing'
export type EstateEventAudience = 'agent' | 'client'
export type EstateEventRsvpStatus = 'going' | 'interested' | 'not-going'

interface EstateEvent {
    id: string
    type: EstateEventType
    ...
}

export default EstateEvent
```

**Conventions to copy:** named union types before the interface; interface uses camelCase (camelcase-keys transforms from snake_case); `export default` for the primary interface, named exports for union types.

---

### `frontend/src/containers/account/CalendarContext.tsx` (provider/context, request-response)

**Analog:** `frontend/src/containers/account/AccountContext.tsx`

**Full context pattern** (lines 1-24):
```typescript
import { useMemo, useState } from 'react'
import useGetAccountProfile from '@/store/hooks/Account/useGetAccountProfile'
import useFetchAccountGroups from '@/store/hooks/Account/useFetchAccountGroups'

const useAccountContext = () => {
    const [currentPage, setCurrentPage] = useState(1)

    const profileQuery = useGetAccountProfile()
    const groupsQuery = useFetchAccountGroups({ pagination: { page: currentPage } })

    return useMemo(() => ({
        state: {
            profile: profileQuery.data,
            groups: groupsQuery.data?.groups || [],
            groupsMeta: groupsQuery.data?.meta,
            isLoading: profileQuery.isLoading || groupsQuery.isLoading
        },
        actions: {
            handlePageChange: (newPage: number) => setCurrentPage(newPage)
        }
    }), [profileQuery.data, profileQuery.isLoading, groupsQuery.data, groupsQuery.isLoading])
}

export default useAccountContext
```

**Copy verbatim:** `useMemo` wrapper around `{ state, actions }` return; all query/mutation objects in `useMemo` deps array; no direct axios; `|| []` fallback on collection data.

---

### `frontend/src/components/view/account/calendar/CalendarTab.tsx` (component, request-response)

**Analog:** `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx`

**Imports pattern** (lines 1-7 of BoardRegistrations.tsx):
```typescript
import { Plus, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RealEstateBoardType, BoardCredentialType, ... } from '@/assets/types/boardType'
```

**Container layout pattern** — 3 provider cards side-by-side: use `<div className="grid gap-4 sm:grid-cols-3">` wrapping three `<ProviderCard>` components. Receives context via `useCalendarContext()`.

---

### `frontend/src/components/view/account/calendar/ProviderCard.tsx` (component, request-response)

**Analog:** `frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx` + `BoardRegistrations.tsx`

**Status badge pattern** (lines 66-75 of BoardRegistrations.tsx):
```typescript
                                {credential.status === 'active' ? (
                                    <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Active
                                    </Badge>
                                ) : (
                                    <Badge variant="destructive" className="gap-1">
                                        <XCircle className="h-3 w-3" />
                                        Invalid
                                    </Badge>
                                )}
```

**Form with loading state pattern** (lines 162-168 of ConnectBoardDialog.tsx):
```typescript
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || !username || !password}
                                >
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Connect
                                </Button>
```

**Error display pattern** (lines 151-153 of ConnectBoardDialog.tsx):
```typescript
                            {serverError && (
                                <p className="text-sm text-destructive">{serverError}</p>
                            )}
```

**Key conventions for `ProviderCard`:**
- Use `Card`, `CardContent`, `CardHeader`, `CardTitle` from `@/components/ui/card`
- Badge color by status: `connected` → green variant, `error` → destructive, `disconnected` → outline/muted
- `Loader2` from `lucide-react` for in-flight button state (`animate-spin`)
- Apple card shows inline `Input`/`Label` form; Google/Microsoft show button that triggers redirect
- Re-sync button only rendered when `status === 'error'`; disabled during mutation pending

---

### `frontend/src/store/hooks/Account/useFetchCalendarConnections.ts` (hook, request-response)

**Analog:** `frontend/src/store/hooks/Account/useGetAccountProfile.tsx`

**Full hook pattern** (lines 1-21):
```typescript
import { useQuery } from '@tanstack/react-query'
import getAccountProfile from '@/assets/api/account/getAccountProfile'
import { AxiosErrorType } from '@/assets/types/axiosErrorType'
import toast from 'react-hot-toast'
import { accountProfileKeys } from '@/store/hooks/queryKeys'

const useGetAccountProfile = () => {
    const { isLoading, data, isError, error, refetch } = useQuery({
        queryKey: accountProfileKeys.all,
        queryFn: getAccountProfile,
        retry: false,
        onError: (err: AxiosErrorType) => {
            toast.error('Failed to fetch profile')
            console.error('Failed to fetch profile:', err)
        }
    })

    return { isLoading, data: data?.user, isError, error, refetch }
}

export default useGetAccountProfile
```

**Copy verbatim:** `retry: false`; `onError` with `toast.error`; import query key from `queryKeys.tsx`; return destructured flat object (not the raw query object).

---

### `frontend/src/store/hooks/Account/useConnectAppleCalendar.ts` + `useDisconnectCalendar.ts` + `useResyncCalendar.ts` (hooks, request-response)

**Analog:** `frontend/src/store/hooks/Account/useUpdateAccountProfile.tsx`

**Full mutation hook pattern** (lines 1-22):
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import updateAccountProfile, { UpdateAccountProfilePayload } from '@/assets/api/account/updateAccountProfile'
import { AxiosErrorType } from '@/assets/types/axiosErrorType'
import toast from 'react-hot-toast'
import { accountProfileKeys } from '@/store/hooks/queryKeys'

const useUpdateAccountProfile = () => {
    const queryClient = useQueryClient()

    const { isLoading, mutate, isError, error, data } = useMutation({
        mutationFn: (body: UpdateAccountProfilePayload) => updateAccountProfile(body),
        retry: false,
        onSuccess: () => {
            toast.success('Profile updated successfully')
            queryClient.invalidateQueries({ queryKey: accountProfileKeys.all })
        },
        onError: (err: AxiosErrorType) => {
            toast.error('Failed to update profile')
            console.error('Failed to update profile:', err)
        }
    })

    return { isLoading, mutate, isError, error, data }
}
```

**Copy verbatim:** `useQueryClient()`; `queryClient.invalidateQueries` on success; `retry: false`; both `toast.success` and `toast.error`; typed `AxiosErrorType` on error handler.

**Invalidation target:** `calendarConnectionsKeys.all` (new key to be added to `queryKeys.tsx`).

**For `useConnectGoogleCalendar` / `useConnectMicrosoftCalendar`:** mutation calls the authorize endpoint and receives `{ redirect_url }` — the hook itself calls `window.location.href = data.redirectUrl` in `onSuccess` rather than invalidating queries (the connection is established via the OAuth callback, not the initial redirect response).

---

### `frontend/src/assets/api/account/calendar/fetchCalendarConnections.ts` (api-module, request-response)

**Analog:** `frontend/src/assets/api/account/getAccountProfile.tsx`

**Full API module pattern** (lines 1-13):
```typescript
import axiosInstance from '@/assets/axios/axios'
import user from '@/assets/types/userType'

interface GetAccountProfileResponse {
    user: user
}

const getAccountProfile = async (): Promise<GetAccountProfileResponse> => {
    const response = await axiosInstance.get('/v1/account/profile')
    return response.data as GetAccountProfileResponse
}

export default getAccountProfile
```

**Copy verbatim:** `axiosInstance` from `@/assets/axios/axios`; return `response.data` directly (camelcase-keys is applied by the global interceptor — never call it again here); typed return interface defined in the file.

---

### `frontend/src/assets/api/account/calendar/connectAppleCalendar.ts` + `disconnectCalendar.ts` + `resyncCalendar.ts` (api-modules, request-response)

**Analog:** `frontend/src/assets/api/account/updateAccountProfile.tsx`

**Full mutation API pattern** (lines 1-20):
```typescript
import axiosInstance from '@/assets/axios/axios'
import user from '@/assets/types/userType'

export interface UpdateAccountProfilePayload {
    firstName?: string
    ...
}

const updateAccountProfile = async (payload: UpdateAccountProfilePayload): Promise<UpdateAccountProfileResponse> => {
    const response = await axiosInstance.patch('/v1/account/profile', {
        user: {
            first_name: payload.firstName,
            ...
        }
    })
    return response.data as UpdateAccountProfileResponse
}
```

**Key conventions:**
- Export payload interface from same file
- Use snake_case in request body keys (sent to Rails backend); camelCase in response (transformed by interceptor)
- `disconnectCalendar`: `axiosInstance.delete('/v1/account/calendar/{provider}')`
- `resyncCalendar`: `axiosInstance.post('/v1/account/calendar/{provider}/resync')`
- `connectAppleCalendar`: `axiosInstance.post('/v1/account/calendar/apple/connect', { email, app_specific_password })`

---

### `frontend/src/containers/account/Account.tsx` (modify — add Tabs)

**Analog:** self (existing file)

**Full existing structure** (lines 1-54):
```typescript
const Account: React.FC = () => {
    const navigate = useNavigate()
    const { state, actions } = useAccountContext()

    if (state.isLoading) {
        return <div className="p-6 text-sm text-muted-foreground">Loading...</div>
    }

    return (
        <div className="w-full max-w-6xl p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                ...
            </div>

            <div className="grid gap-4 md:grid-cols-12">
                ...
            </div>
        </div>
    )
}
```

**Modification:** Wrap the inner content (below the header div) in `<Tabs defaultValue="profile">`. The existing `<div className="grid gap-4 md:grid-cols-12">` becomes the content of `<TabsContent value="profile">`. Add `<TabsContent value="calendar"><CalendarTab /></TabsContent>`. Import `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs` (already installed, confirmed in RESEARCH.md). The `CalendarTab` also needs its own context — import and render `useCalendarContext` inside `CalendarTab`, not in `Account.tsx` directly.

---

### `frontend/src/store/hooks/queryKeys.tsx` (modify — add calendar keys)

**Analog:** self (existing file, lines 147-154)

**Existing account keys pattern** (lines 147-154):
```typescript
export const accountProfileKeys = {
    all: ['account', 'profile'] as const,
}

export const accountGroupsKeys = {
    all: ['account', 'groups'] as const,
    list: (params: { page: number }) => [...accountGroupsKeys.all, params] as const,
}
```

**Add at end of file:**
```typescript
export const calendarConnectionsKeys = {
    all: ['account', 'calendar', 'connections'] as const,
}
```

---

## Shared Patterns

### Authentication (applies to all new backend controllers)

**Source:** `backend/app/controllers/v1/account/profile_controller.rb` (lines 3-8)
```ruby
      include CognitoAuth
      include BrokerageAuth

      before_action :authenticate_cognito_user!
```
**Apply to:** `connections_controller.rb`, `google_oauth_controller.rb`, `microsoft_oauth_controller.rb`

---

### Soft Delete Scoping (applies to all new backend queries)

**Source:** CLAUDE.md requirement + `backend/app/controllers/v1/dashboard/group/estate_events_controller.rb` (lines 103-107)
```ruby
        def set_group
          @group = ::Group.without_deleted
            .where(brokerage_id: Current.brokerage.id)
            .joins(:user_groups)
            .where(user_groups: {user_id: Current.user.id})
            .find_by!(uid: params[:group_id])
        end
```
**Apply to:** Every `UserCalendarConnection`, `EstateDate`, and `brokerage.users` query in controllers and jobs. Pattern: `.without_deleted` on every model, including joined tables.

---

### Job Structure (applies to `calendar_sync_job.rb`)

**Source:** `backend/app/jobs/fanout_notifications_job.rb` (lines 1-4)
```ruby
class FanoutNotificationsJob < ApplicationJob
  queue_as :default
  retry_on StandardError, wait: :polynomially_longer, attempts: 3
  discard_on ActiveRecord::RecordNotFound
```
**Apply to:** `CalendarSyncJob` — copy these 3 class-level declarations verbatim.

---

### AR Encryption (applies to `user_calendar_connection.rb`)

**Source:** `backend/app/models/brokerage_board_credential.rb` (lines 7-8)
```ruby
  encrypts :rets_username
  encrypts :rets_password
```
**Pattern:** `encrypts :credentials` in `UserCalendarConnection`. The DB column is `credentials_ciphertext` (text). The AR model exposes `credentials` as a plain string accessor. No changes needed to `backend/config/initializers/active_record_encryption.rb` — already configured.

---

### Error Handling (applies to all new backend controllers)

**Source:** `backend/app/controllers/v1/account/profile_controller.rb` (lines 32-34)
```ruby
      unless user.update(profile_params)
        return render json: {error: "Failed to update profile", errors: user.errors.messages}, status: :unprocessable_entity
      end
```
**Apply to:** All new controllers — use `render json: {error: "..."}, status: :unprocessable_entity` for validation errors; `render json: {error: "Forbidden"}, status: :forbidden` for authorization failures (mirror pattern from `estate_events_controller.rb` line 73).

---

### Provider Allowlist Validation (applies to all controllers accepting `params[:provider]`)

**Source:** RESEARCH.md Pattern 6 + CLAUDE.md security notes
```ruby
PROVIDERS = %w[google microsoft apple].freeze
unless PROVIDERS.include?(params[:provider])
  return render json: {error: "Invalid provider"}, status: :unprocessable_entity
end
```
**Apply to:** `connections_controller.rb` destroy, create_apple, resync actions — always validate `params[:provider]` against this allowlist before using it.

---

### Frontend Hook Pattern (applies to all new hooks)

**Source:** `frontend/src/store/hooks/Account/useGetAccountProfile.tsx` (queries) and `useUpdateAccountProfile.tsx` (mutations)

Common structure:
- Import from `@tanstack/react-query` (`useQuery` or `useMutation`)
- Import API function from `@/assets/api/...`
- Import `AxiosErrorType` from `@/assets/types/axiosErrorType`
- Import `toast` from `react-hot-toast`
- Import query keys from `@/store/hooks/queryKeys`
- `retry: false` always
- `onError` always logs to `console.error` and calls `toast.error`
- Return flat destructured object, not the raw TanStack object

---

### Frontend API Module Pattern (applies to all new API modules)

**Source:** `frontend/src/assets/api/account/getAccountProfile.tsx` (lines 1-13)
```typescript
import axiosInstance from '@/assets/axios/axios'

const apiFunction = async (payload?: Payload): Promise<Response> => {
    const response = await axiosInstance.get('/v1/...')
    return response.data as Response
}

export default apiFunction
```
**Critical:** `response.data` is returned directly — camelcase-keys is already applied by the global Axios interceptor. Never call `camelcaseKeys()` in API modules.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `backend/app/services/calendar/google_calendar_adapter.rb` | service | request-response | No external calendar API integrations exist yet; use RESEARCH.md Pattern 3 |
| `backend/app/services/calendar/microsoft_calendar_adapter.rb` | service | request-response | No external calendar API integrations exist yet; use RESEARCH.md Pattern 4 |
| `backend/app/services/calendar/apple_calendar_adapter.rb` | service | request-response | No external calendar API integrations exist yet; use RESEARCH.md Pattern 5 |

For these three files, the planner must use the code examples directly from RESEARCH.md Patterns 3, 4, and 5. The adapter pattern (class with `initialize(connection)` and `sync(estate_date:, action:, external_event_id:, timezone:, credentials:)`) is self-consistent across all three and defined entirely in RESEARCH.md.

---

## Metadata

**Analog search scope:** `backend/app/jobs/`, `backend/app/models/`, `backend/app/controllers/v1/account/`, `backend/app/controllers/v1/dashboard/group/`, `backend/app/serializers/`, `backend/db/migrate/`, `frontend/src/containers/account/`, `frontend/src/store/hooks/Account/`, `frontend/src/assets/api/account/`, `frontend/src/assets/types/`, `frontend/src/components/view/account/`, `frontend/src/components/view/admin/brokerageView/`
**Files scanned:** 24 source files read directly
**Pattern extraction date:** 2026-05-12
