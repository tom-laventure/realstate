# Coding Conventions

**Analysis Date:** 2026-04-29

## Overview

This is a monorepo: Ruby on Rails 7.1 JSON API in `backend/` and Vite/React 18 SPA in `frontend/`. Conventions differ by layer — follow each section carefully.

---

## Ruby / Rails Backend

### Linting

**Tool:** StandardRB (`standard` gem ~1.52)
**Run:** `bundle exec standardrb` from `backend/`
**Key rules:** Ruby Standard Style — no RuboCop overrides in project root; StandardRB enforces consistent double-quoted strings, 2-space indent, no trailing commas.

No `.rubocop.yml` in project root. StandardRB is the sole linter.

### Naming Patterns

**Files:**
- Snake_case for all Ruby files: `estate_serializer.rb`, `group_estates_query.rb`
- Service namespaces map to subdirectories: `app/services/groups/create.rb` → `Groups::Create`
- Admin serializers namespaced: `app/serializers/admin/listing_group_serializer.rb` → `Admin::ListingGroupSerializer`

**Classes:**
- PascalCase: `GroupEstatesQuery`, `EstateSerializer`, `BrokerageAuth`
- Concern modules use PascalCase: `AssociationLoader`, `CognitoAuth`, `BrokerageAuth`
- Namespaced controllers use module nesting: `V1::Admin::GroupsController`, `V1::Dashboard::Group::EstatesController`

**Methods:**
- Snake_case: `authenticate_cognito_user!`, `filter_by_rejection`, `resolve_brokerage`
- Bang methods (`!`) for operations that raise on failure: `group.destroy!`, `Group.create!`
- Predicate methods (`?`) for boolean checks: `success?`, `users_loaded?`, `groups_loaded?`

**Variables:**
- Snake_case: `current_user`, `group_estate_map`, `estate_ids`
- Instance variables: `@group`, `@pagy`, `@current_user`, `@params`

### Controller Structure

All controllers follow this structure:

```ruby
module V1
  module Admin   # or Dashboard, Dashboard::Group
    class ThingsController < ApplicationController
      include CognitoAuth
      include BrokerageAuth
      include Pagy::Backend

      before_action :authenticate_cognito_user!
      before_action :set_thing, only: [:show, :update, :destroy]

      def index
        # Use Query objects for complex filtering
        scope = ThingQuery.new(Current.brokerage, params).call
        # Always cap per_page at 100
        per_page = params[:per_page].to_i
        items = per_page.positive? ? [per_page, 100].min : 10
        @pagy, records = pagy(scope, items: items)
        render json: { things: ..., meta: pagy_metadata(@pagy) }, status: :ok
      end

      private

      def set_thing
        @thing = Current.brokerage.things.find_by!(uid: params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Thing not found" }, status: :not_found
      end

      def thing_params
        params.require(:thing).permit(:name, :active)
      end
    end
  end
end
```

**Key rules:**
- Always include both `CognitoAuth` and `BrokerageAuth`
- Always call `before_action :authenticate_cognito_user!`
- `BrokerageAuth` adds `before_action :resolve_brokerage` automatically on include
- Use `Current.brokerage` and `Current.user` — never pass these as arguments through the call chain unless required by query objects

### Soft Deletes (Critical)

All user-facing models use `acts_as_paranoid` (paranoia gem ~3.0). Always scope with `.without_deleted`:

```ruby
# CORRECT
Group.without_deleted.where(brokerage_id: id)
Current.brokerage.groups.without_deleted

# WRONG — deleted records leak through
Group.where(brokerage_id: id)
```

When joining across associations, guard **every model** in the join:

```ruby
# WRONG — deleted estates leak through joined table
EstateDocument.without_deleted.joins(group_estate: :estate)

# CORRECT — guard the joined model too
EstateDocument.without_deleted
  .joins(group_estate: :estate)
  .where(estates: { deleted_at: nil })
```

Files: `backend/app/models/estate.rb`, `backend/app/models/group.rb`, `backend/app/models/user.rb`

### Query Objects

Complex filtering lives exclusively in `backend/app/queries/`. Never put filter logic in controllers.

**Pattern:**

```ruby
# app/queries/group_estates_query.rb
class GroupEstatesQuery
  def initialize(group, current_user, params = {})
    @group = group
    @current_user = current_user
    @params = params
  end

  def call
    scope = base_scope
    scope = filter_by_x(scope)
    scope = filter_by_y(scope)
    apply_sort(scope)
  end

  private

  def filter_by_x(scope)
    return scope unless @params[:x].present?
    scope.where(...)
  end
end
```

**Constructor rule:** Only include `current_user` in the initializer if the query actually uses it. Omit unused parameters — an unused parameter signals missing logic.

```ruby
# CORRECT — only what the query needs
def initialize(group, params = {}); end

# WRONG — accepts current_user but never uses @current_user
def initialize(group, current_user, params = {}); end
```

Existing query objects: `backend/app/queries/group_estates_query.rb`, `backend/app/queries/group_query.rb`, `backend/app/queries/invitation_query.rb`, `backend/app/queries/group_documents_query.rb`

### Serializers

All serializers extend `ActiveModel::Serializer`. Use the `:json` adapter for root-key wrapping.

**Rules:**
- Include `AssociationLoader` concern when serializing optional associations
- Use `if: :association_loaded?` guard for conditional attributes
- Never query the database inside a serializer method — use `@instance_options` for precomputed data

```ruby
class GroupSerializer < ActiveModel::Serializer
  include AssociationLoader

  attributes :name, :id

  attribute :member_count, if: :users_loaded?

  def users_loaded?
    association_loaded?(:users)
  end

  def member_count
    # Safe: uses already-loaded association
    object.users.without_deleted.count
  end
end
```

For collection endpoints, bulk-compute per-record data in the controller and pass via `instance_options`:

```ruby
render json: {
  estates: ActiveModelSerializers::SerializableResource.new(
    estates,
    each_serializer: EstateSerializer,
    adapter: :attributes,
    current_user: Current.user,
    user_ratings: user_ratings,       # Hash keyed by group_estate_id
    comment_counts: comment_counts,   # Hash keyed by group_estate_id
  ).as_json
}, status: :ok
```

Reference: `backend/app/serializers/estate_serializer.rb`, `backend/app/serializers/concerns/association_loader.rb`

### Service Objects

Namespace services under `app/services/` with module hierarchy:

```ruby
# app/services/groups/create.rb
module Groups
  class Create
    Result = Struct.new(:success, :group, :errors) do
      alias_method :success?, :success
    end

    def self.call(brokerage:, params:, inviter:)
      new(brokerage: brokerage, params: params, inviter: inviter).call
    end

    def call
      ActiveRecord::Base.transaction do
        create_group!
        # ...
      end
      Result.new(true, group, nil)
    rescue => e
      Result.new(false, group, [e.message])
    end
  end
end
```

**Result object pattern:** Return `Result.new(success, record, errors)` with `success?` predicate.

Reference: `backend/app/services/groups/create.rb`

### Pagination

Always use Pagy gem. Always cap `per_page` at 100:

```ruby
per_page = params[:per_page].to_i
items = per_page.positive? ? [per_page, 100].min : 10
@pagy, records = pagy(scope, items: items)
render json: { records: ..., meta: pagy_metadata(@pagy) }
```

For filter-dropdown endpoints (need full list), support `paginate=false`:

```ruby
@pagy, records = params[:paginate] == "false" ? [nil, scope] : pagy(scope, items: items)
render json: { records: ..., meta: { pagination: @pagy ? pagy_metadata(@pagy) : nil } }
```

Reference: `backend/app/controllers/v1/admin/groups_controller.rb`

### Error Handling

**Controller pattern:**
- `render json: { error: "Message" }, status: :not_found` for 404s
- `render json: { error: "Message", details: record.errors.full_messages }, status: :unprocessable_entity` for validation failures
- `rescue ActiveRecord::RecordNotFound` in `before_action` set methods
- Custom `AuthenticationError` class in `backend/app/errors/authentication_error.rb`
- Always include `next_step` key for frontend routing hints on 403s: `{ error: "...", next_step: "no-access" }`

### Model Conventions

- UIDs (UUIDs) used as public IDs exposed through API — never expose integer `id`
- `before_validation :generate_uid, on: :create` for UID generation
- `acts_as_paranoid` on all user-facing models
- Scopes defined with lambda syntax: `scope :for_brokerage, ->(brokerage_id) { ... }`
- Delegations for convenience: `delegate :address, :price, to: :listing_detail, allow_nil: true`

### API Response Shape

```json
{
  "groups": [...],
  "meta": {
    "total_groups": 10,
    "pagination": { ... }
  }
}
```

Single records use the resource name as root key:
```json
{ "group": { ... }, "meta": { ... } }
```

Stats go in `meta`, not at root level.

---

## TypeScript / React Frontend

### Linting & Formatting

**ESLint:** `frontend/.eslintrc.js` — extends `plugin:react/recommended`; no indent rule enforced
**TypeScript:** Strict mode enabled (`tsconfig.json` — `"strict": true`)
**No Prettier config found** — formatting is not enforced by tooling; follow existing code style

### Naming Patterns

**Files:**
- PascalCase for React components: `EstateDetailsSection.tsx`, `ListingsFilterBar.tsx`
- camelCase for hooks: `useFetchGroupEstates.tsx`, `useToggleFavorite.ts`
- camelCase for API modules: `fetchGroupEstates.ts`, `toggleFavorite.ts`
- PascalCase for Context files: `GeneralDashboardContext.tsx`, `AccountContext.tsx`
- camelCase for type files: `estateType.ts`, `groupType.ts`, `axiosErrorType.ts`
- SCSS modules: camelCase with `.module.scss`: `appShell.module.scss`

**Directories:**
- PascalCase for domain groupings in `store/hooks/`: `Admin/`, `Dashboard/`, `Auth/`
- lowercase for feature groupings in `containers/`: `dashboard/`, `adminBoard/`, `account/`
- lowercase for `assets/api/` domains: `admin/`, `dashboard/`, `auth/`

**Variables & Functions:**
- camelCase for variables and functions: `groupEstatesData`, `setListingsPage`
- PascalCase for React components and interfaces: `EstateType`, `GroupDashboardData`
- Prefix interfaces with no `I`: `interface estate { ... }` (lowercase interface names for domain types)

### Import Organization

**Order:**
1. React and framework imports: `import { useEffect, useMemo, useState } from 'react'`
2. Third-party libraries: `import { useQuery } from '@tanstack/react-query'`
3. Internal imports using `@/` alias: `import useFetchGroupEstates from '@/store/hooks/...'`
4. Type imports: `import { AxiosErrorType } from '@/assets/types/axiosErrorType'`

**Path alias:** Always use `@/` for all internal imports — never use relative paths like `../../`. Exception: same-directory SCSS modules may use relative paths.

### Data Flow Architecture

```
Component → Context (Brain) → TanStack Hook → API module → Axios instance
```

**Rules:**
- Never call axios or API functions directly inside a component
- Always go through a hook
- Context functions return `{ state, actions }` memoized with `useMemo`
- Define domain interfaces in `assets/types/` before creating hooks or contexts — never define them locally in component files

### Context Pattern

```tsx
export default function useGeneralDashboardContext() {
    const [page, setPage] = useState(1)
    const estatesQuery = useFetchGroupEstates(enabled, { groupId, pagination: { page } })

    return useMemo(
        () => ({
            state: {
                estates: estatesQuery.data?.estates || [],
                meta: estatesQuery.data?.meta,
                isLoading: estatesQuery.isLoading,
            },
            actions: {
                setPage: (p: number) => setPage(p),
            },
        }),
        [estatesQuery, page]
    )
}
```

Reference: `frontend/src/containers/dashboard/general/GeneralDashboardContext.tsx`

### Hook Pattern (TanStack Query)

```tsx
const useFetchGroupEstates = (enabled: boolean, props?: FetchGroupEstatesPayload) => {
    const { isLoading, data, isError, error, refetch } = useQuery({
        queryKey: props ? dashboardGroupEstatesKeys.list(props) : dashboardGroupEstatesKeys.all,
        queryFn: async () => fetchGroupEstates(props as FetchGroupEstatesPayload),
        retry: false,
        enabled,
        onError: (err: AxiosErrorType) => {
            console.error('Failed to fetch ...:', err)
        },
        keepPreviousData: true,
    })
    return { isLoading, data, isError, error, refetch }
}
```

For mutations, call `queryClient.invalidateQueries` on success and show toast:

```tsx
return useMutation({
    mutationFn: toggleFavorite,
    onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: dashboardGroupEstatesKeys.all })
        toast.success(data.liked ? 'Added to favorites' : 'Removed from favorites')
    },
    onError: (err) => {
        toast.error('Failed to update favorite')
    },
})
```

Reference: `frontend/src/store/hooks/Dashboard/estates/useToggleFavorite.ts`

### Query Keys

All query keys are defined in `frontend/src/store/hooks/queryKeys.tsx`. Use the factory pattern:

```tsx
export const dashboardGroupEstatesKeys = {
    all: ['dashboard', 'groups', 'estates'] as const,
    list: (params: FetchDashboardGroupEstatesPayload) =>
        [...dashboardGroupEstatesKeys.all, params] as const,
}
```

**Never define query keys inline in a hook.** Always import from `queryKeys.tsx`.

### API Module Pattern

```typescript
// frontend/src/assets/api/dashboard/groups/fetchGroupEstates.ts
import api from '@/assets/axios/axios'
import EstateType from '@/assets/types/estateType'

interface FetchGroupEstatesPayload { ... }
interface FetchGroupEstatesResponse { estates: EstateType[]; meta: PaginationMetaType }

const fetchGroupEstates = async (payload: FetchGroupEstatesPayload): Promise<FetchGroupEstatesResponse> => {
    const response = await api.get(`/v1/dashboard/groups/${payload.groupId}/estates`, {
        params: { ...payload.pagination, ... }
    })
    return response.data  // camelcaseKeys already applied by axios interceptor
}

export type { FetchGroupEstatesPayload, FetchGroupEstatesResponse }
export default fetchGroupEstates
```

**Rules:**
- The global Axios interceptor (`assets/axios/axios.ts`) applies `camelcaseKeys(response.data, { deep: true })` automatically. **Never call `camelcaseKeys` again in hooks.** Return `response.data` directly.
- API params to the backend must use `snake_case`: `{ min_price: '200000' }` not `{ minPrice: '200000' }`
- When sending request bodies, use `snakecase-keys` to convert: `snakecaseKeys(payload)` or `snakecaseKeys(data, { deep: true })`

### URL Search Param Hydration

When reading filter state from `searchParams`, use `useEffect` with `isHydratedFromUrl` guard:

```tsx
const [filter, setFilter] = useState<FilterType>('default')
const [isHydratedFromUrl, setIsHydratedFromUrl] = useState(false)

useEffect(() => {
    if (isHydratedFromUrl) return
    const allowed: FilterType[] = ['default', 'option-a', 'option-b']
    const val = searchParams.get('filter')
    if (val && allowed.includes(val as FilterType)) setFilter(val as FilterType)
    setIsHydratedFromUrl(true)
}, [isHydratedFromUrl, searchParams])
```

Never blindly cast URL strings to union types (`as SortType`). Always validate against an allowlist.

### Component Conventions

**Icons:** `lucide-react` only — no other icon libraries
**UI Primitives:** `shadcn/ui` components from `frontend/src/components/ui/` only — no raw Radix or other UI libs for primitives (shadcn/ui wraps Radix)
**Styling:** Tailwind CSS utility classes. SCSS modules (`*.module.scss`) used for legacy layout containers; new code should use Tailwind.
**shadcn config:** Style `new-york`, base color `zinc`, CSS variables enabled (`frontend/components.json`)

### Error Handling (Frontend)

**API errors:** Typed as `AxiosErrorType` = `AxiosError<{ error?: string }>` from `frontend/src/assets/types/axiosErrorType.ts`
**HTTP 401:** Axios interceptor auto-redirects to `/auth/login`
**HTTP 403 with `next_step: no-access`:** Redirected to `/auth/brokerage-contact`
**User-facing errors:** `toast.error('message')` via `react-hot-toast` in hooks, never in components

### TypeScript Rules

- `strict: true` enforced
- No `any` casts without justification
- Define domain interfaces in `assets/types/` with `Type` suffix in filename: `estateType.ts`, `groupType.ts`
- Export interfaces as named exports: `export type { FetchGroupEstatesPayload }`
- Default export for the function/component: `export default fetchGroupEstates`

### Pagination State in Contexts

Contexts own page state locally and pass it to hooks:

```tsx
const [estatePage, setEstatePage] = useState(1)
const estatesQuery = useFetchEstates({ groupId, pagination: { page: estatePage } })
// Expose setEstatePage in actions
```

---

*Convention analysis: 2026-04-29*
