# Phase 15: Backend API & BrokerageAuth Extension - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the backend to serve main-domain admin requests: (1) teach `BrokerageAuth` to resolve brokerage context from the `X-Brokerage-Id` request header when the request originates from the main domain, returning 400 when the header is absent; (2) expose a new `GET /v1/account/admin_brokerages` endpoint that returns all brokerages where the authenticated user holds an admin or owner role, callable only from the main domain.

</domain>

<decisions>
## Implementation Decisions

### BrokerageAuth Extension
- **D-01:** Extend the existing `BrokerageAuth` concern inline — add a main-domain branch inside `resolve_brokerage`. No new concern, no changes to individual admin controllers.
- **D-02:** Main domain detection uses the same `APP_BASE_DOMAIN` env var logic already in `MainDomainOnly` concern (with dev-host allowlist for localhost/127.0.0.1).
- **D-03:** When request is from main domain and `X-Brokerage-Id` header is present: parse it as an integer ID, look up the brokerage by ID, set `Current.brokerage`. Normal subdomain path is unchanged.
- **D-04:** When request is from main domain and `X-Brokerage-Id` header is absent: render `{ error: "X-Brokerage-Id header required" }` with HTTP 400 immediately (in the concern, before reaching the controller).
- **D-05:** `BrokerageAuth` only resolves brokerage — it does not check admin/owner role. The membership check remains in `CognitoAuth`; admin role verification is the controller's responsibility.

### admin_brokerages Endpoint Auth
- **D-06:** New standalone controller `V1::Account::AdminBrokeragesController` — does NOT include `BrokerageAuth`. Calls `skip_before_action :resolve_brokerage` (or simply doesn't inherit a base class that includes it).
- **D-07:** Controller includes `CognitoAuth` with `skip_brokerage_membership? = true` — authenticates the user via JWT but skips per-brokerage membership check (since there is no single brokerage context).
- **D-08:** Controller includes `MainDomainOnly` concern — endpoint is restricted to main-domain requests only. Existing `/v1/admin/**` endpoints on subdomains are completely unaffected.
- **D-09:** Authorization logic: query `BrokerageMembership.without_deleted.where(user_id: Current.user.id, role: ["admin", "owner"])` to find all qualifying memberships.

### admin_brokerages Response Shape
- **D-10:** Response is minimal — `{ admin_brokerages: [{ id, name, role }, ...] }` — exactly what BE-01 requires. No subdomain URL, no logo.
- **D-11:** Root key: `admin_brokerages` (matches endpoint name; consistent with other collection endpoint naming).
- **D-12:** Render inline JSON in the controller — `render json: { admin_brokerages: [...] }`. No dedicated serializer needed for this simple flat structure.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Concerns
- `backend/app/controllers/concerns/brokerage_auth.rb` — The concern being extended today; understand its current `resolve_brokerage` and `extract_domain_from_request` methods
- `backend/app/controllers/concerns/cognito_auth.rb` — Auth pattern to follow in new controller; note `skip_brokerage_membership?` override hook
- `backend/app/controllers/concerns/main_domain_only.rb` — Main domain detection logic to reuse (`APP_BASE_DOMAIN`, dev-host allowlist)

### Routing
- `backend/config/routes.rb` — Add `resources :admin_brokerages, only: [:index]` (or custom `get :admin_brokerages`) under `namespace :account`

### Models
- `backend/app/models/brokerage_membership.rb` — Used for querying admin/owner memberships; has `role` string column, `acts_as_paranoid`
- `backend/app/models/brokerage.rb` — The brokerage record returned in the response (name, id)
- `backend/app/models/current.rb` — Thread-local `Current.brokerage` and `Current.user` — understand how they're set

### Requirements
- `.planning/REQUIREMENTS.md` §BE — BE-01, BE-02, BE-03 are the 3 requirements for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MainDomainOnly#require_main_domain!` — Extract the main-domain detection logic (APP_BASE_DOMAIN + dev hosts) as a shared private method or module — `BrokerageAuth` needs the same check
- `CognitoAuth#skip_brokerage_membership?` — Override hook already exists; new controller overrides to `true`
- `BrokerageMembership.without_deleted` — Standard soft-delete scope already in place for membership queries

### Established Patterns
- `BrokerageAuth` uses Origin header as canonical domain identifier (falls back to Host) — extend this same `extract_domain_from_request` method for main-domain detection
- All controllers that need no brokerage context (e.g., sessions, onboarding) don't include `BrokerageAuth` — `AdminBrokeragesController` follows this same opt-out pattern
- Inline `render json:` is used in controllers where the shape is simple and flat — appropriate here

### Integration Points
- `BrokerageAuth#resolve_brokerage` — The single method to extend; branch on `main_domain?` before the current `BrokerageDomain.find_by` lookup
- Routes: `namespace :account` block in `config/routes.rb` — add the new route here alongside profile/groups/calendar
- `ApplicationController` inheritance chain — understand which base controller `Account::` controllers inherit from to know what's already included

</code_context>

<specifics>
## Specific Ideas

No specific references beyond what's in decisions and canonical refs.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-Backend API & BrokerageAuth Extension*
*Context gathered: 2026-05-24*
