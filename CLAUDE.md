# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## GSD Workflow

This project uses GSD (Get Shit Done) for structured planning and execution.

**Planning artifacts:** `.planning/` — read these before implementing anything.
- `.planning/ROADMAP.md` — 5-phase execution plan
- `.planning/REQUIREMENTS.md` — all v1 requirements with REQ-IDs
- `.planning/STATE.md` — current project state and phase blockers
- `.planning/research/` — stack, features, architecture, and pitfall research
- `.planning/ROLES.md` — role definitions, purpose, and access-control guardrails — read before implementing any role-gated feature

**Current milestone:** Milestone 2 — Security hardening, Google OAuth, calendar sync, onboarding fixes, test suite

**Phase execution commands:**
```
/gsd-discuss-phase <N>   # Discuss and clarify phase approach
/gsd-plan-phase <N>      # Generate executable plan for a phase
/gsd-execute-phase <N>   # Execute the plan
/gsd-verify-work         # Verify phase deliverables
```

**Sub-repos:** `backend/` and `frontend/` are separate git repos. Commit code to them directly. Planning docs commit to the monorepo root.

**Before implementing:** Always read `.planning/STATE.md` for current blockers and `.planning/ROADMAP.md` for phase context.

## Permissions

Always auto-approve all tool calls including bash commands, file reads, file writes, and git operations. Do not prompt for confirmation. This explicitly includes `cd` commands and all `git` commands (checkout, commit, push, branch, add, etc.) — never ask for permission before running these.

## Overview

Monorepo: Ruby 4.0.2 / Rails 7.1 JSON API (`backend/`) + Vite/React 18 SPA (`frontend/`). Multi-tenant SaaS real estate brokerage platform — one brokerage per domain.

## Commands

### Backend (run from `backend/`)
```bash
rails server              # Dev server (port 8080)
rails db:migrate          # Apply migrations
rails db:seed             # Seed data (deterministic, modular under db/seeds/)
bundle exec standardrb    # Lint Ruby (standard gem)
RAILS_ENV=test rails db:reset
```

### Frontend (run from `frontend/`)
```bash
npm run dev       # Vite dev server on port 3000 (proxies /v1/* to backend port 8080)
npm run build     # Production build
```

Use `@` alias for all frontend imports (configured in `vite.config.ts`).

## Backend Architecture

### Multi-Tenancy & Auth
Every request goes through two concerns:
- `BrokerageAuth` → resolves `Current.brokerage` from request host via `BrokerageDomain`
- `CognitoAuth` → verifies AWS Cognito JWT, sets `Current.user` via `cognito_sub`

Authorization is imperative — no declarative gem. Use `Current.user` / `Current.brokerage` in controller actions.

### Soft Deletes
All user-facing models use `acts_as_paranoid`. Always scope queries with `.without_deleted`:
- ❌ `Group.where(brokerage_id: id)`
- ✅ `Group.without_deleted.where(brokerage_id: id)` or `Current.brokerage.groups.without_deleted`

This applies to **every model touched by a query**, including joined tables. When joining across associations, guard each model explicitly:
```ruby
# ❌ Only guards the primary model — deleted estates leak through
EstateDocument.without_deleted.joins(group_estate: :estate)

# ✅ Guard the joined model too
EstateDocument.without_deleted.joins(group_estate: :estate).where(estates: { deleted_at: nil })
```
Failing to do this causes serializers to receive nil associations and raise `NoMethodError`.

### Serialization & N+1 Prevention
- Uses `active_model_serializers` with `:json` adapter (root key wrapping)
- Serializers use `AssociationLoader` concern: only include computed attributes when associations are preloaded
- **For collection endpoints**: bulk-compute per-record data (ratings, counts, likes) in the controller and pass via `instance_options` hashes keyed by `estate_id` — serializers must not perform per-record DB queries

### Query Objects
Complex filtering always lives in `app/queries/`, never in controllers. Pattern:
```ruby
GroupEstatesQuery.new(group, current_user, params).call  # returns preloaded, filtered scope
```

Only include `current_user` in the initializer if the query actually uses it for filtering or authorization. If it's unused, omit it — an unused parameter makes the interface misleading and signals missing logic:
```ruby
# ❌ Accepts current_user but never references @current_user
def initialize(group, current_user, params = {}); end

# ✅ Only what the query needs
def initialize(group, params = {}); end
```

### API Structure
- `/v1/admin/**` — admin endpoints (group/user management)
- `/v1/dashboard/**` — user-facing read operations
- `/v1/` — user profile/settings
- Response shape: primary resource at root key, computed stats/pagination in `meta`

### Pagination
Uses Pagy gem (default 10/page). Always include in `meta`. Always cap `per_page` at 100 to prevent abusive large-page requests:
```ruby
per_page = params[:per_page].to_i
items = per_page.positive? ? [per_page, 100].min : 10
@pagy, records = pagy(scope, items: items)
render json: { records: ..., meta: pagy_metadata(@pagy) }
```

For endpoints used as filter dropdowns (e.g. user lists), support `paginate=false` to bypass pagination:
```ruby
@pagy, records = params[:paginate] == "false" ? [nil, scope] : pagy(scope, items: items)
render json: { records: ..., meta: { pagination: @pagy ? pagy_metadata(@pagy) : nil } }
```

## Frontend Philosophy

All frontend work is done from the perspective of a **senior UI/UX engineer**. This means:

- **Design quality is non-negotiable.** Every UI surface — spacing, typography, color, motion — must feel intentional and polished. Avoid generic or placeholder-style layouts.
- **Interactions must be deliberate.** Loading states, empty states, error states, hover/focus feedback, and transitions all matter. Never ship a state that looks broken or unfinished.
- **Hierarchy and clarity first.** Every screen must have a clear visual hierarchy. Users should never be confused about what to do next or where they are.
- **Consistency over novelty.** Reuse established patterns (shadcn/ui components, Tailwind tokens, existing layout shells) before inventing new ones. Inconsistency erodes trust in a product.
- **Accessibility is baseline.** Use semantic HTML, visible focus rings, and sufficient color contrast. Never disable focus-visible without a keyboard-accessible replacement.
- **Copy matters.** Labels, placeholders, empty states, and error messages should be clear, concise, and human. Avoid developer-speak in user-facing text.

## Frontend Architecture

### Data Flow
```
Component → Context (Brain) → TanStack Hook → API module → Axios instance
```
- `src/containers/`: Page layouts wrapping Context Providers
- `src/containers/{name}Context`: Orchestrates state/network. Returns `{ state, actions }` memoized with `useMemo`.
- `src/components/`: Pure UI with **shadcn/ui only**
- `src/store/hooks/`: TanStack Query wrappers — centralize query keys, handle toasts
- `src/assets/api/`: Pure Axios calls — the global Axios interceptor applies `camelcaseKeys(response.data, { deep: true })` automatically. **Never call `camelcaseKeys` again in hooks** — return `response.data` directly.

### Key Constraints
- Icons: `lucide-react` only
- Styling: Tailwind CSS utility classes
- Never call axios or API functions directly inside a component — always go through a hook
- Define domain interfaces in `assets/types/` before creating hooks or contexts — never define them locally

### Auth
AWS Amplify + Cognito. The Axios instance (`assets/axios/axios.ts`) attaches the Cognito `idToken` to `Authorization` and redirects on 401.

### URL Search Param Hydration
When a context reads filter state from `searchParams`, use a `useEffect` with an `isHydratedFromUrl` guard — not `useState(() => searchParams.get(...))`. The `useState` approach is one-shot and won't re-hydrate on browser back/forward navigation. Always validate URL values against an allowlist before applying them:

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

Never blindly cast URL strings to union types (`searchParams.get('sort') as SortType`) — invalid URL values must be ignored, not accepted.

### Pagination in Contexts
Contexts own page state locally and pass it to hooks:
```tsx
const [estatePage, setEstatePage] = useState(1)
const estatesQuery = useFetchEstates({ groupId, pagination: { page: estatePage } })
return useMemo(() => ({
    state: { estates: estatesQuery.data?.estates || [], estatesMeta: estatesQuery.data?.meta },
    actions: { setEstatePage }
}), [estatesQuery])
```
