# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## GSD Workflow

GSD (Get Shit Done) is available in this project for structured planning and execution, but it is **opt-in, not default**. Do not invoke GSD commands, skills, or phase ceremony (discuss-phase/plan-phase/execute-phase/new-milestone/complete-milestone, etc.) on your own initiative when asked to implement a ticket or feature — implement it directly instead. Only use GSD when the user explicitly asks for it (e.g. names a `/gsd-*` command, says "use GSD", or asks to plan/execute a "phase" or "milestone").

**Planning artifacts:** `.planning/` — still worth reading for project history and context (past decisions, requirements, architecture notes) even when not running GSD commands.
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

## Feature Discussion Policy

Before discussing, scoping, or planning any new feature — whether raised ad-hoc in conversation or entering the formal GSD phase workflow (e.g. `/gsd-discuss-phase`) — invoke the `grill-me` skill first. Do not move on to implementation planning, phase discussion, or ticket creation until the grill-me interview has resolved the decision tree for that feature.

## Notion Ticket Status Sync

Tickets live in the "RealtyBase Tasks" Notion database (`Status`: `Backlog` → `In Progress` → `In Review` → `Done`). Every ticket has an `ID` property (Notion `unique_id`, prefix `RB` — e.g. `RB-42`) that auto-assigns on creation; use it to reference tickets in commits, PRs, and conversation instead of the page title. When creating a new ticket, the `ID` is assigned automatically — don't set it manually, just cite it (from the created page's properties) once the ticket exists.

When work traces back to a Notion ticket, keep its `Status` current at each checkpoint below without waiting to be asked — this is a standing instruction, not something the user needs to request each time:

- **Starting implementation** (code changes for that ticket begin landing, whether via GSD or direct implementation): set `Status` to `In Progress`.
- **Implementation complete, pending review/testing** (e.g. `/gsd-code-review`/`/gsd-verify-work` about to run, or `/code-review` for non-GSD work): set `Status` to `In Review`.
- **The feature's commit(s) land** (`git commit` succeeds in `backend/` and/or `frontend/` for that ticket's work): set `Status` to `Done` right after the commit — don't wait to be asked, and don't leave it sitting in `In Review` once the code is actually committed. If review/testing turns up more work first, land that work (and any of its own commits) before marking `Done`, updating the ticket's Description with whatever was found along the way (e.g. bugs fixed that weren't in the original scope).
- **New asks surface after a ticket is already `Done`**: don't reopen it or append unimplemented work to its Description. Create a new ticket referencing the original, and leave the original's Description reflecting only what actually shipped.

Before trusting a ticket's `Status` or `Description`, verify against the live codebase — planning docs and tickets can drift from what's actually implemented (this happened with the "Group Notes" ticket: it was still `Backlog` despite being fully built).

Note on automation: Notion updates happen through MCP tool calls, which only Claude can invoke — a shell-based hook can't make this API call on its own. So "automated" here means Claude applies this policy proactively at every checkpoint above, not a hook firing in the background. If a background hook could ever do this in the future (e.g. by shelling out to the Notion API on a git commit/push event), it would need to be wired up separately via the `update-config` skill.

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
