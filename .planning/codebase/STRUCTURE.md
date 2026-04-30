# Codebase Structure

**Analysis Date:** 2026-04-29

## Directory Layout

```
realstate/                          # Monorepo root
├── CLAUDE.md                       # Project-level coding instructions
├── backend/                        # Ruby on Rails JSON API
│   ├── app/
│   │   ├── constants/              # Shared Ruby constants
│   │   ├── controllers/
│   │   │   ├── application_controller.rb  # Base: includes Pagination
│   │   │   ├── concerns/           # BrokerageAuth, CognitoAuth, Pagination
│   │   │   ├── ops/                # Internal ops UI controllers (brokerage setup)
│   │   │   └── v1/                 # Versioned API controllers
│   │   │       ├── sessions_controller.rb     # POST/DELETE /v1/sessions
│   │   │       ├── users_controller.rb
│   │   │       ├── brokerages_controller.rb
│   │   │       ├── domains_controller.rb
│   │   │       ├── account/        # /v1/account/profile, /v1/account/groups
│   │   │       ├── admin/          # /v1/admin/** (brokerage management)
│   │   │       │   └── group/      # /v1/admin/groups/:id/users|filter_sets|estates|invitations
│   │   │       ├── dashboard/      # /v1/dashboard/** (agent-facing reads)
│   │   │       │   └── group/      # /v1/dashboard/groups/:id/estates|comments|documents|dates|…
│   │   │       └── onboarding/     # /v1/onboarding/brokerage|user|domains
│   │   ├── errors/                 # Custom error classes (AuthenticationError)
│   │   ├── jobs/                   # SolidQueue background jobs
│   │   ├── mailers/                # InvitationMailer
│   │   ├── models/
│   │   │   ├── application_record.rb
│   │   │   ├── current.rb          # Thread-local CurrentAttributes
│   │   │   ├── concerns/           # Model-level shared modules
│   │   │   ├── brokerage.rb
│   │   │   ├── brokerage_domain.rb
│   │   │   ├── brokerage_membership.rb
│   │   │   ├── brokerage_estate.rb
│   │   │   ├── brokerage_board_credential.rb  # Encrypted RETS credentials
│   │   │   ├── estate.rb           # Core listing; accessible_by scope
│   │   │   ├── group.rb
│   │   │   ├── group_estate.rb     # Key pivot: estate in group context
│   │   │   ├── group_filter.rb
│   │   │   ├── group_filter_set.rb
│   │   │   ├── estate_comment.rb
│   │   │   ├── estate_date.rb
│   │   │   ├── estate_date_rsvp.rb
│   │   │   ├── estate_document.rb
│   │   │   ├── estate_like.rb
│   │   │   ├── estate_rating.rb
│   │   │   ├── estate_rejection.rb
│   │   │   ├── estate_tag.rb
│   │   │   ├── invitation.rb
│   │   │   ├── listing_detail.rb   # MLS data for an estate
│   │   │   ├── notification.rb
│   │   │   ├── real_estate_board.rb
│   │   │   ├── subcomment.rb
│   │   │   ├── tag.rb
│   │   │   ├── user.rb
│   │   │   └── user_group.rb
│   │   ├── queries/                # Query objects — all complex filtering
│   │   ├── serializers/            # ActiveModelSerializers
│   │   │   ├── concerns/           # AssociationLoader, SerializerCollectionHelper
│   │   │   └── admin/              # Admin-specific serializers
│   │   ├── services/               # Service objects and external integrations
│   │   │   └── groups/             # Groups::Create service
│   │   └── views/                  # ERB for ops UI and mailer templates
│   ├── config/
│   │   ├── routes.rb               # All route definitions
│   │   ├── environments/           # development.rb, production.rb, test.rb
│   │   └── initializers/           # active_model_serializers, cognito, cors, pagy, etc.
│   ├── db/
│   │   ├── schema.rb               # Source of truth for DB schema
│   │   ├── migrate/                # Migrations
│   │   └── seeds/                  # Numbered modular seed files (00–09)
│   └── lib/tasks/                  # Custom Rake tasks
└── frontend/                       # Vite + React SPA
    ├── src/
    │   ├── main.jsx                 # App entry: QueryClientProvider, StoreProvider, RouterProvider
    │   ├── index.css                # Global CSS
    │   ├── router/
    │   │   ├── main.tsx             # Root router (createBrowserRouter)
    │   │   ├── dashboard/           # Dashboard routes
    │   │   ├── admin/               # Admin routes
    │   │   ├── auth/                # Auth routes
    │   │   ├── account/             # Account routes
    │   │   ├── createBrokerage/     # Brokerage wizard routes
    │   │   └── joinBrokerage/       # Invitation flow routes
    │   ├── containers/              # Page-level smart components + context hooks
    │   │   ├── account/             # Account editing
    │   │   ├── activity/            # Activity feed pages (comments, docs, calendar, reviews)
    │   │   ├── adminBoard/          # Admin board pages (brokerage, groups, users, settings)
    │   │   ├── auth/                # Auth flows (login, join, create brokerage)
    │   │   ├── createBrokerage/     # Brokerage creation wizard
    │   │   ├── dashboard/           # Dashboard pages (estate, general, home, notifications)
    │   │   └── errorPage/           # Error boundary page
    │   ├── components/              # Pure presentational components
    │   │   ├── common/              # Shared UI primitives
    │   │   │   ├── buttons/         # Button variants
    │   │   │   ├── footer/          # Footer
    │   │   │   ├── form/            # Form components (sign-in, sign-up, filter forms)
    │   │   │   ├── frames/          # Layout frames
    │   │   │   ├── guards/          # ProtectedRoute, Can (RBAC)
    │   │   │   ├── labels/          # Label components
    │   │   │   ├── pagination/      # Pagination controls
    │   │   │   ├── popups/          # Confirm dialogs, filter popups
    │   │   │   └── shells/          # AppShell layouts (dashboard, admin, no-auth)
    │   │   ├── dashboard/           # Dashboard-specific UI
    │   │   ├── navbar/              # NavBar and SideNav variants
    │   │   ├── sidenav/             # SideNav component
    │   │   ├── table/               # Table components
    │   │   ├── ui/                  # shadcn/ui component library
    │   │   └── view/                # View-level component sections (admin, auth, etc.)
    │   ├── store/
    │   │   ├── hooks/               # TanStack Query hooks (organized by domain)
    │   │   │   ├── queryKeys.tsx    # Centralized query key factory
    │   │   │   ├── Account/
    │   │   │   ├── Admin/           # Admin hooks (Brokerage, Domains, Estates, Users, etc.)
    │   │   │   ├── Auth/
    │   │   │   ├── Dashboard/       # Dashboard hooks (estates, groups, notifications, activity)
    │   │   │   ├── Helper/
    │   │   │   ├── Users/
    │   │   │   └── brokerage/
    │   │   └── reducers/            # Redux Toolkit slices
    │   │       ├── index.tsx        # configureStore
    │   │       ├── account.ts       # Auth user state
    │   │       ├── createBrokerageWizard.ts
    │   │       └── tempBrokerage.tsx
    │   ├── assets/
    │   │   ├── api/                 # Pure Axios API call modules
    │   │   │   ├── admin/           # Admin API calls
    │   │   │   ├── dashboard/       # Dashboard API calls
    │   │   │   ├── account/
    │   │   │   ├── auth/
    │   │   │   ├── brokerage/
    │   │   │   ├── onboarding/
    │   │   │   └── users/
    │   │   ├── axios/
    │   │   │   └── axios.ts         # Axios instance: auth interceptor + camelcaseKeys transform
    │   │   ├── characters/          # Static character/avatar assets
    │   │   ├── config/              # Static frontend config
    │   │   ├── images/              # Static image assets
    │   │   ├── rbac/
    │   │   │   └── permissions.ts   # Role → Permission mapping
    │   │   └── types/               # Domain TypeScript interfaces
    │   ├── config/
    │   │   ├── amplify.ts           # AWS Amplify initialization
    │   │   └── toaster.tsx          # react-hot-toast config
    │   ├── data/                    # Static data / fixtures
    │   ├── helpers/                 # Pure utility functions
    │   └── lib/
    │       ├── auth.ts              # JWT token localStorage helpers
    │       └── utils.ts             # Tailwind cn() utility
    └── amplify/                     # AWS Amplify backend config
        └── backend/auth/            # Cognito user pool config
```

## Directory Purposes

**`backend/app/controllers/concerns/`:**
- Contains: `BrokerageAuth`, `CognitoAuth`, `Pagination`, `RackSessionsFix`
- Key files: `brokerage_auth.rb`, `cognito_auth.rb`
- These are included per-controller; `BrokerageAuth` always runs; `CognitoAuth` opts in via `before_action :authenticate_cognito_user!`

**`backend/app/queries/`:**
- Contains: All query objects for complex filtering
- Key files: `group_estates_query.rb` (15+ filter methods), `group_query.rb`, `activity_query.rb`
- Pattern: `QueryClass.new(owner, params).call` — returns chainable AR scope

**`backend/app/services/`:**
- Contains: External service wrappers and transactional write services
- Key files: `groups/create.rb`, `notification_fanout_service.rb`, `token_service.rb`, `cognito_service.rb`, `s3_upload_service.rb`

**`backend/app/serializers/`:**
- Contains: AMS serializers; admin-specific in `admin/`
- Key files: `estate_serializer.rb` (reads from `instance_options` hashes), `group_serializer.rb`, `user_serializer.rb`
- Concerns: `concerns/association_loader.rb`

**`backend/db/seeds/`:**
- Contains: Numbered modular seed files (`00_constants.rb` through `09_real_estate_boards.rb`)
- Seeding is deterministic and modular; run in numeric order

**`frontend/src/containers/`:**
- Contains: Page-level containers paired with their context hook
- Pattern: `{Name}.tsx` (page component) + `{name}Context.tsx` or `use{Name}Context.tsx` (brain hook)
- Each context hook owns local state, invokes TanStack hooks, returns `{ state, actions }` via `useMemo`

**`frontend/src/assets/types/`:**
- Contains: All domain TypeScript interfaces
- Key files: `estateType.ts`, `groupType.ts`, `userType.ts`, `paginationType.ts`, `roleType.ts`, `permissions.ts`
- Rule: Define interfaces here before writing hooks or contexts

**`frontend/src/store/hooks/`:**
- Contains: TanStack Query wrappers organized by domain
- Subdirectories: `Admin/`, `Dashboard/`, `Account/`, `Auth/`, `Users/`, `brokerage/`, `Helper/`
- Key file: `queryKeys.tsx` — centralized query key factory for cache invalidation

**`frontend/src/assets/api/`:**
- Contains: Pure Axios call functions; one file per API endpoint
- Pattern: Named export `fetchXxx` or `postXxx`; exports payload/response interfaces
- Convention: Query params use `snake_case`; responses arrive as `camelCase` after interceptor

**`frontend/src/components/ui/`:**
- Contains: shadcn/ui component library
- Use exclusively for UI primitives (Button, Input, Dialog, etc.); do not add custom components here

## Key File Locations

**Entry Points:**
- `backend/config/routes.rb`: All API routes
- `frontend/src/main.jsx`: Frontend bootstrap
- `frontend/src/router/main.tsx`: Router root

**Configuration:**
- `backend/config/initializers/active_model_serializers.rb`: `:json` adapter config
- `backend/config/initializers/pagy.rb`: Pagination defaults
- `backend/config/initializers/cors.rb`: CORS origins
- `backend/config/initializers/active_record_encryption.rb`: AR Encryption for board credentials
- `frontend/src/assets/axios/axios.ts`: Axios instance with auth + camelcaseKeys interceptor
- `frontend/src/config/amplify.ts`: AWS Amplify / Cognito config
- `frontend/src/assets/rbac/permissions.ts`: Role/permission definitions

**Core Logic:**
- `backend/app/controllers/concerns/brokerage_auth.rb`: Domain → brokerage resolution
- `backend/app/controllers/concerns/cognito_auth.rb`: JWT verification + membership check
- `backend/app/models/current.rb`: Thread-local request context
- `backend/app/queries/group_estates_query.rb`: Estate filtering logic (15+ filter methods)
- `backend/app/services/groups/create.rb`: Group creation transaction
- `backend/app/serializers/estate_serializer.rb`: Estate JSON shape with N+1-safe computed fields
- `frontend/src/store/hooks/queryKeys.tsx`: TanStack Query key factory

**Schema:**
- `backend/db/schema.rb`: Authoritative DB schema (PostgreSQL, schema version 2026_04_27_035534)

## Naming Conventions

**Backend files:**
- Controllers: `snake_case_controller.rb`, namespaced by directory (e.g., `v1/admin/groups_controller.rb`)
- Models: `snake_case.rb` (e.g., `group_estate.rb`)
- Queries: `{resource}_query.rb` or `{context}_{resource}_query.rb`
- Services: `{action}_service.rb` or `groups/{action}.rb`
- Serializers: `{resource}_serializer.rb`; admin versions in `admin/`

**Frontend files:**
- Components: `PascalCase.tsx` (e.g., `GeneralDashboard.tsx`)
- Context hooks: `use{Name}Context.tsx` or `{Name}Context.tsx`
- TanStack hooks: `use{Verb}{Resource}.ts` or `use{Verb}{Resource}.tsx` (e.g., `useFetchGroupEstates.tsx`)
- API modules: `{verb}{Resource}.ts` (e.g., `fetchGroupEstates.ts`)
- Types: `{resource}Type.ts` (e.g., `estateType.ts`)
- SCSS modules: `{Component}.module.scss`

**Directories:**
- Backend: `snake_case`
- Frontend containers/components: `camelCase` for directories, `PascalCase` for files within

## Where to Add New Code

**New backend API endpoint:**
1. Add route to `backend/config/routes.rb` under the appropriate namespace
2. Create controller in `backend/app/controllers/v1/{namespace}/`
3. Include `BrokerageAuth` and `CognitoAuth`; add `before_action :authenticate_cognito_user!`
4. If filtering logic is complex, create a query object in `backend/app/queries/`
5. If multi-step write, create a service in `backend/app/services/`
6. Create/extend serializer in `backend/app/serializers/`

**New frontend page:**
1. Define domain types in `frontend/src/assets/types/`
2. Add API call in `frontend/src/assets/api/{namespace}/`
3. Add TanStack hook in `frontend/src/store/hooks/{Domain}/`; add query key to `queryKeys.tsx`
4. Create container directory in `frontend/src/containers/{domain}/{pageName}/`
5. Write context hook: `use{PageName}Context.tsx`
6. Write page component: `{PageName}.tsx` (consumes context hook)
7. Add route to appropriate `frontend/src/router/{domain}/{domain}.tsx`

**New shared UI component:**
- Reusable across routes: `frontend/src/components/common/`
- Domain-specific: `frontend/src/components/{domain}/`
- Never add to `frontend/src/components/ui/` (reserved for shadcn/ui)

**New model:**
1. Create migration in `backend/db/migrate/`
2. Create model in `backend/app/models/` — include `acts_as_paranoid` if user-facing
3. Add to seed files in `backend/db/seeds/` if applicable

**New background job:**
- Job class: `backend/app/jobs/{action}_job.rb` extending `ApplicationJob`
- Service: `backend/app/services/{action}_service.rb` (job calls service)

## Special Directories

**`backend/vendor/bundle/`:**
- Purpose: Vendored gems
- Generated: Yes
- Committed: Yes (bundler vendor install)

**`frontend/dist/`:**
- Purpose: Vite production build output
- Generated: Yes
- Committed: No (gitignored in production builds)

**`frontend/amplify/`:**
- Purpose: AWS Amplify backend config for Cognito user pool
- Generated: Partially (Amplify CLI managed)
- Committed: Yes

**`frontend/src/components/ui/`:**
- Purpose: shadcn/ui component library (auto-generated from CLI)
- Generated: Yes (via shadcn CLI)
- Committed: Yes — treat as source; do not modify directly

**`backend/db/seeds/`:**
- Purpose: Modular, numbered seed files for deterministic test data
- Pattern: `00_constants.rb`, `01_users.rb` … `09_real_estate_boards.rb`
- Committed: Yes

---

*Structure analysis: 2026-04-29*
