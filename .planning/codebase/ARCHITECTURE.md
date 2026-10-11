<!-- refreshed: 2026-04-29 -->
# Architecture

**Analysis Date:** 2026-04-29

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     React SPA (frontend/)                            │
│   Router → AppShell → Container (Context) → Components              │
│   `src/router/main.tsx`  `src/containers/`   `src/components/`      │
└─────────────────────┬───────────────────────────────────────────────┘
                      │  HTTPS — Axios (Bearer JWT)
                      │  camelcaseKeys applied on response interceptor
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Rails JSON API (backend/, port 8080)                │
│   BrokerageAuth → CognitoAuth → Controller → Query / Service        │
│   `app/controllers/concerns/`    `app/controllers/v1/`              │
│   `app/queries/`                 `app/services/`                     │
│                        ↓                                             │
│                   Serializers                                        │
│             `app/serializers/`                                       │
└─────────────────┬───────────────────┬───────────────────────────────┘
                  │                   │
                  ▼                   ▼
         PostgreSQL DB          AWS Services
    (acts_as_paranoid soft       S3, Cognito,
      deletes, AR encryption    SolidQueue jobs)
      on board credentials)
```

## Component Responsibilities

| Component | Responsibility | Path |
|-----------|----------------|------|
| `BrokerageAuth` concern | Resolves `Current.brokerage` from Host/Origin header via `BrokerageDomain` lookup | `backend/app/controllers/concerns/brokerage_auth.rb` |
| `CognitoAuth` concern | Verifies JWT via `TokenService`, sets `Current.user`; checks `BrokerageMembership` | `backend/app/controllers/concerns/cognito_auth.rb` |
| `Current` | Thread-local `ActiveSupport::CurrentAttributes` holding `brokerage` and `user` | `backend/app/models/current.rb` |
| `TokenService` | Issues and verifies HS256 JWTs using `Rails.application.secret_key_base` | `backend/app/services/token_service.rb` |
| `CognitoService` | Calls AWS Cognito `initiate_auth` and `admin_user_global_sign_out` | `backend/app/services/cognito_service.rb` |
| Query objects | Encapsulate all complex DB filtering; return AR scopes; live only in `app/queries/` | `backend/app/queries/` |
| Service objects | Encapsulate multi-step transactional writes; return a `Result` struct | `backend/app/services/` |
| Serializers | Shape JSON output; read bulk-precomputed data from `instance_options` hashes | `backend/app/serializers/` |
| Background jobs | Async work: photo syncing, notification fanout, invitation emails | `backend/app/jobs/` |
| `NotificationFanoutService` | Bulk-inserts `Notification` rows for group members after key events | `backend/app/services/notification_fanout_service.rb` |
| Context hooks | Orchestrate frontend state and network; return `{ state, actions }` via `useMemo` | `frontend/src/containers/{name}Context.tsx` |
| TanStack hooks | Centralize query keys; wrap API calls with `useQuery`/`useMutation` | `frontend/src/store/hooks/` |
| API modules | Pure Axios calls; no `camelcaseKeys` (interceptor handles it); return `response.data` directly | `frontend/src/assets/api/` |
| Redux store | Global auth account state and multi-step wizard state only | `frontend/src/store/reducers/` |

## Pattern Overview

**Overall:** Multi-tenant Rails API-only backend + React SPA frontend.

**Key Characteristics:**
- Multi-tenancy enforced at the HTTP request boundary: domain → brokerage resolved by `BrokerageAuth` before every action
- Authorization is imperative — no declarative gem; controllers check `Current.user` and `Current.brokerage` inline
- Soft deletes on all user-facing models via `acts_as_paranoid`; every query must call `.without_deleted`
- Frontend data flow is strictly unidirectional: Component → Context hook → TanStack hook → API module → Axios
- Serializer N+1 prevention via bulk-computed `instance_options` hashes passed from the controller

## Layers

**Controller Layer:**
- Purpose: HTTP routing, authentication, params parsing, response rendering
- Location: `backend/app/controllers/v1/`
- Contains: Namespace modules (`Admin`, `Dashboard`, `Account`, `Onboarding`), `ApplicationController`, concerns
- Depends on: Query objects, Service objects, Serializers, `Current` attributes
- Used by: HTTP requests from the frontend

**Query Layer:**
- Purpose: All complex DB filtering and sorting; returns AR scopes; never inlined in controllers
- Location: `backend/app/queries/`
- Files: `group_query.rb`, `group_estates_query.rb`, `activity_query.rb`, `invitation_query.rb`, `filter_set_estates_query.rb`, `group_conversations_query.rb`, `group_documents_query.rb`, `all_groups_comments_query.rb`, `all_groups_documents_query.rb`
- Pattern: `QueryClass.new(scope_owner, [current_user,] params).call` — returns chainable AR scope. Only include `current_user` if the query actually uses it for filtering.

**Service Layer:**
- Purpose: Multi-step transactional writes; external service integration; return `Result` struct
- Location: `backend/app/services/` and `backend/app/services/groups/`
- Files: `Groups::Create`, `NotificationFanoutService`, `CognitoService`, `RetsAuthService`, `RetsPhotoService`, `S3UploadService`, `TokenService`
- Pattern: `ServiceClass.call(named_keyword_args)` → `Result.new(success?, resource, errors)`

**Serializer Layer:**
- Purpose: Shape AR objects into JSON; must not perform per-record DB queries
- Location: `backend/app/serializers/`; admin-specific in `backend/app/serializers/admin/`
- Pattern: Computed attributes (ratings, counts, likes) read from `@instance_options[:hash_name][id]`; check `association_loaded?` via `AssociationLoader` concern before accessing associations
- Concern: `backend/app/serializers/concerns/association_loader.rb`

**Model Layer:**
- Purpose: AR persistence, validations, scopes, associations
- Location: `backend/app/models/`
- Soft deletes: All user-facing models use `acts_as_paranoid`
- Encrypted fields: `BrokerageBoardCredential` uses `encrypts :rets_username`, `encrypts :rets_password` (ActiveRecord Encryption, configured in `backend/config/initializers/active_record_encryption.rb`)
- Key join model: `GroupEstate` — all per-listing engagement (ratings, comments, documents, dates, likes, rejections) belongs to `GroupEstate`, not directly to `Estate`

**Job Layer:**
- Purpose: Async background processing via SolidQueue
- Location: `backend/app/jobs/`
- Files: `FanoutNotificationsJob`, `SyncListingPhotosJob`, `ResyncStalePhotosJob`, `SendInvitationEmailJob`
- Queue: `:default`; retry with `polynomially_longer` back-off; discard on `RecordNotFound`

**Frontend: Router Layer:**
- Purpose: Route definitions mapping paths to container components
- Location: `frontend/src/router/`
- Files: `main.tsx` (root router), `dashboard/dashboard.tsx`, `admin/admin.tsx`, `auth/auth.tsx`, `account/account.tsx`, `createBrokerage/createBrokerage.tsx`, `joinBrokerage/joinBrokerage.tsx`
- Guards: `ProtectedRoute` wraps all authenticated routes (`frontend/src/components/common/guards/ProtectedRoute.tsx`); checks `isAuthenticated()` from `frontend/src/lib/auth.ts`

**Frontend: Shell Layer:**
- Purpose: Page-level layout wrappers providing nav, sidebar, footer, and `<Outlet />`
- Location: `frontend/src/components/common/shells/`
- Files: `appShell.tsx` (dashboard routes), `appShellAdmin/AppShellAdmin.tsx` (admin routes), `appShellNoAuth.tsx`, `appShellCreateAccount/`

**Frontend: Container Layer:**
- Purpose: Orchestrate state and network; wrap UI in context logic; return `{ state, actions }` via `useMemo`
- Location: `frontend/src/containers/`
- Pattern: Named `use{Name}Context` hook, co-located with the page component in the same directory
- Depends on: TanStack hooks, `useState`, `useEffect`, `useMemo`
- Used by: Page-level components

**Frontend: Component Layer:**
- Purpose: Pure presentational UI; consume `{ state, actions }` from the context hook
- Location: `frontend/src/components/`
- Constraint: Never call axios or API functions directly; never define domain interfaces locally; use `shadcn/ui` and `lucide-react`

**Frontend: Hook Layer:**
- Purpose: TanStack Query wrappers; centralize query keys; handle toast errors
- Location: `frontend/src/store/hooks/`
- Query key registry: `frontend/src/store/hooks/queryKeys.tsx`
- Constraint: Return `response.data` directly — the axios interceptor applies `camelcaseKeys` globally; never call it again here

**Frontend: API Module Layer:**
- Purpose: Pure Axios calls to the backend; define request/response interfaces inline per file
- Location: `frontend/src/assets/api/`
- Subdirectories mirror backend namespaces: `admin/`, `dashboard/`, `account/`, `auth/`, `onboarding/`, `users/`, `brokerage/`
- Convention: Params to backend use `snake_case` query params; responses arrive as `camelCase` after interceptor

**Frontend: Type Layer:**
- Purpose: Domain interfaces shared across hooks, contexts, and components
- Location: `frontend/src/assets/types/`
- Rule: Define domain interfaces here **first** before creating hooks or contexts; never define them locally in a component or hook file

## Data Flow

### Authentication Flow (Login)

1. User submits credentials — rendered in `frontend/src/containers/auth/Login.tsx`
2. Axios call to `POST /v1/sessions` via `frontend/src/assets/api/auth/`
3. `SessionsController#create` calls `CognitoService.initiate_auth` (`backend/app/services/cognito_service.rb`)
4. JWT issued via `TokenService.issue(user)` (`backend/app/services/token_service.rb`)
5. Token stored in `localStorage` via `setToken()` (`frontend/src/lib/auth.ts`)
6. Subsequent requests attach token via Axios request interceptor (`frontend/src/assets/axios/axios.ts`)

### Dashboard Estate Listing (Primary Request Path)

1. User navigates to `/:groupId` — renders `GeneralDashboard` (`frontend/src/containers/dashboard/general/GeneralDashboard.tsx`)
2. `useGeneralDashboardContext()` (`frontend/src/containers/dashboard/general/GeneralDashboardContext.tsx`) calls `useFetchGroupEstates(enabled, props)` (`frontend/src/store/hooks/Dashboard/groups/useFetchGroupEstates.tsx`)
3. TanStack Query calls `fetchGroupEstates(payload)` (`frontend/src/assets/api/dashboard/groups/fetchGroupEstates.ts`)
4. Axios `GET /v1/dashboard/groups/:groupId/estates` — interceptor attaches JWT, applies `camelcaseKeys` on response
5. `BrokerageAuth` resolves `Current.brokerage` from Host/Origin header (`backend/app/controllers/concerns/brokerage_auth.rb`)
6. `CognitoAuth` verifies JWT, sets `Current.user`, checks brokerage membership (`backend/app/controllers/concerns/cognito_auth.rb`)
7. `GroupEstatesQuery.new(@group, Current.user, params).call` applies all filters and sorting (`backend/app/queries/group_estates_query.rb`)
8. Controller bulk-computes `user_ratings`, `group_avg_ratings`, `comment_counts`, `document_counts`, `rejected_ge_ids`, `group_estate_map` into hashes — no N+1 (`backend/app/controllers/v1/dashboard/group/estates_controller.rb`)
9. `EstateSerializer` reads computed values from `@instance_options` hashes (`backend/app/serializers/estate_serializer.rb`)
10. JSON response rendered: `{ estates: [...], meta: pagy_metadata }`
11. Context assembles `{ state, actions }` via `useMemo`; component re-renders

### Notification Fanout (Async Path)

1. Comment reply / document upload / event creation triggers controller action
2. Controller enqueues `FanoutNotificationsJob.perform_later(type, group_id:, estate_id:, **ids)` (`backend/app/jobs/fanout_notifications_job.rb`)
3. SolidQueue worker picks up job; calls appropriate `NotificationFanoutService` class method (`backend/app/services/notification_fanout_service.rb`)
4. Service bulk-inserts `Notification` rows for all group members minus the actor using `Notification.insert_all(rows)`
5. Frontend polls via `GET /v1/dashboard/notifications` through `frontend/src/containers/dashboard/notifications/`

**State Management (Frontend):**
- Per-page filter/pagination/sort state: owned locally in Context hooks via `useState`
- Global auth/account state: Redux Toolkit `account` slice (`frontend/src/store/reducers/account.ts`)
- Multi-step wizard state: `createBrokerageWizard` and `tempBrokerage` slices
- Server state (API data): TanStack Query cache — no manual Redux reducers for API responses

## Key Abstractions

**`GroupEstate` (pivot model):**
- Purpose: Represents a listing shared into a group. All per-listing engagement belongs to `GroupEstate`, not `Estate`
- File: `backend/app/models/group_estate.rb`
- Pattern: `group_estate_id` is the foreign key used throughout serializers and queries. Track `last_activity_at` via `after_create_commit :touch_activity`

**Query Objects:**
- Purpose: Encapsulate filtering/sorting logic out of controllers
- Examples: `backend/app/queries/group_estates_query.rb`, `backend/app/queries/group_query.rb`
- Pattern: `QueryClass.new(owner, params).call` returns AR scope; chain filters via private methods

**Service Objects:**
- Purpose: Wrap multi-step transactions with a `Result` struct
- Example: `backend/app/services/groups/create.rb` — `Groups::Create.call(brokerage:, params:, inviter:)` returns `Result.new(success?, group, errors)`

**`Current` attributes:**
- Purpose: Thread-local request context; always set by concerns before any controller action
- File: `backend/app/models/current.rb`
- Pattern: Read as `Current.brokerage` and `Current.user` anywhere in the request lifecycle

**Context hooks (frontend brain):**
- Purpose: Orchestrate page state and data fetching; return `{ state, actions }` via `useMemo`
- Example: `frontend/src/containers/dashboard/general/GeneralDashboardContext.tsx`
- Pattern: Custom hook `use{Name}Context` co-located with the page container

**RBAC `Can` guard:**
- Purpose: Role-based conditional rendering
- File: `frontend/src/components/common/guards/Can.tsx`
- Permissions: `frontend/src/assets/rbac/permissions.ts`
- Roles: `owner`, `admin`, `agent`, `staff`, `client`

## Entry Points

**Backend API:**
- Routes: `backend/config/routes.rb`
- Namespaces: `/v1/admin/**`, `/v1/dashboard/**`, `/v1/account/**`, `/v1/onboarding/**`, `/ops/**` (only when `OPS_ENABLED=true` — RB-67)
- App server: Puma, port 8080

**Frontend SPA:**
- Bootstrap: `frontend/src/main.jsx` — wraps app in `QueryClientProvider`, Redux `StoreProvider`, `RouterProvider`
- Router root: `frontend/src/router/main.tsx`
- Amplify configured at startup: `frontend/src/config/amplify.ts`

## Architectural Constraints

- **Multi-tenancy:** `BrokerageAuth` is included in every authenticated controller. `Current.brokerage` is set before any action runs. All queries must scope to `Current.brokerage` to prevent cross-tenant data leaks.
- **Soft deletes:** Every query touching a user-facing model must call `.without_deleted`. When joining across associations, guard each joined model explicitly with `where(table: { deleted_at: nil })` — the `without_deleted` scope on the primary model does not propagate through joins.
- **N+1 prevention:** Collection endpoints must bulk-compute per-record stats in the controller and pass them as `instance_options` hashes. Serializers read from these hashes; they never query the DB per record.
- **JWT auth:** HS256 JWTs signed with `secret_key_base`; 24-hour expiry; stored in `localStorage` by the frontend. `ProtectedRoute` checks expiry client-side on every navigation.
- **camelcaseKeys:** Applied once globally in the Axios response interceptor (`frontend/src/assets/axios/axios.ts`). Never call `camelcaseKeys` again in hooks — return `response.data` directly.
- **Threading:** Single-threaded request context via Puma + `CurrentAttributes`; SolidQueue runs jobs in separate processes.
- **Global state:** Redux slices for account/wizard; TanStack Query for all server state; no mixing of the two.

## Anti-Patterns

### Soft-delete join leak

**What happens:** `EstateDocument.without_deleted.joins(group_estate: :estate)` — `without_deleted` guards only `estate_documents`, not the joined `estates` table.
**Why it's wrong:** Deleted estates leak through, causing serializers to receive `nil` associations and raise `NoMethodError`.
**Do this instead:**
```ruby
EstateDocument.without_deleted
  .joins(group_estate: :estate)
  .where(estates: { deleted_at: nil })
```

### Per-record DB queries in serializers

**What happens:** A serializer method calls `EstateRating.where(...).average(:rating)` once per estate in a collection.
**Why it's wrong:** Produces N+1 queries; degrades linearly with collection size.
**Do this instead:** Bulk-compute in the controller with `group(:group_estate_id).average(:rating)`, pass hash as `instance_options[:group_avg_ratings]`, read in serializer: `@instance_options[:group_avg_ratings][ge_id]`.

### Unused `current_user` in query initializer

**What happens:** `QueryClass.new(scope, current_user, params)` accepts `current_user` but never references `@current_user` inside.
**Why it's wrong:** Makes the interface misleading and signals missing authorization logic.
**Do this instead:** Only include `current_user` in the initializer if the query actually uses it for filtering or authorization.

### Blind URL param casting on the frontend

**What happens:** `searchParams.get('sort') as SortType` — casts URL string to union type without validation.
**Why it's wrong:** Invalid URL values are silently accepted and passed to the API.
**Do this instead:** Validate against an allowlist in a `useEffect` with an `isHydratedFromUrl` guard before applying the value.

## Error Handling

**Strategy:** Render JSON error responses with appropriate HTTP status codes; no global `rescue_from` in `ApplicationController`.

**Patterns:**
- `ActiveRecord::RecordNotFound` rescued in individual controller actions → 404
- `ActiveRecord::RecordInvalid` / `RecordNotDestroyed` → 422 with `details: errors.full_messages`
- `AuthenticationError` / missing JWT → 401
- Brokerage membership missing → 403 with `next_step: "no-access"` (triggers frontend redirect to `/auth/brokerage-contact`)
- Frontend 401 interceptor: clears localStorage token, redirects to `/auth/login` (`frontend/src/assets/axios/axios.ts`)
- Frontend 403 + `no-access`: redirects to `/auth/brokerage-contact`

## Cross-Cutting Concerns

**Logging:** `Rails.logger` used inline in concerns (e.g., `BrokerageAuth` logs domain resolution).
**Validation:** AR model validations + strong parameters (`params.require.permit`) in controllers.
**Authentication:** JWT issued by `TokenService`, verified per-request by `CognitoAuth`. Frontend stores token in `localStorage`; `ProtectedRoute` checks expiry client-side.
**Pagination:** Pagy gem; default 10 or 6/page depending on endpoint; cap at 100 via `[per_page, 100].min`; always included in `meta.pagination`. Initializer: `backend/config/initializers/pagy.rb`.
**Serialization:** `active_model_serializers` with `:json` adapter (root key wrapping) globally configured in `backend/config/initializers/active_model_serializers.rb`. Admin serializers in `backend/app/serializers/admin/`.
**Background jobs:** SolidQueue; `MissionControl::Jobs::Engine` mounted at `/jobs` only when `OPS_ENABLED=true` (RB-67).
**Encryption:** ActiveRecord Encryption (`encrypts :field`) for RETS board credentials; configured in `backend/config/initializers/active_record_encryption.rb`.

---

*Architecture analysis: 2026-04-29*
