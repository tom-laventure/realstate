# RealState SaaS Platform — Milestone 2

## What This Is

A multi-tenant real estate SaaS platform serving brokerages via domain-based isolation. Brokerages manage property listings, organize agents into groups, and collaborate through shared tools: comments, documents, ratings, tags, and calendar dates. This milestone hardens the platform's security posture, adds Google social login, fixes broken onboarding flows, introduces personal calendar sync for listing dates, and establishes a test suite.

## Core Value

Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.

## Requirements

### Validated

- ✓ Multi-tenant brokerage isolation via domain → `BrokerageDomain` resolution — existing
- ✓ User authentication via AWS Cognito (email/password) + HS256 JWT — existing
- ✓ Property listing management backed by RETS/MLS board credentials — existing
- ✓ Group-based listing organization with `GroupEstate` pivot model — existing
- ✓ Per-listing engagement: ratings, comments, documents, dates, likes, rejections — existing
- ✓ Notification fanout to group members via SolidQueue background jobs — existing
- ✓ Admin dashboard: user management, group management, invitations — existing
- ✓ Role-based UI guards (`ProtectedRoute`, `RequireRole`, `Can`) — existing
- ✓ Filter sets with listing filtering and preview counts — existing
- ✓ S3 document storage, CloudFront CDN for photos — existing
- ✓ Brokerage creation wizard and invitation-based join flow — existing

### Active

**Security & Authorization**
- [ ] Server-side role enforcement on all `/v1/admin/**` endpoints via `Admin::BaseController#require_admin!`
- [ ] Remove hardcoded test credentials (`defaultValue` email/password) from sign-in component
- [ ] Restrict CORS `origins` from wildcard to brokerage domain allowlist
- [ ] Add rate limiting to `POST /v1/sessions` via `rack-attack`
- [ ] Remove SQL injection risk: delete dead `Group#order_estates` and related methods
- [ ] Fix `InvitationsController` crash: replace `current_user` calls with `Current.user`
- [ ] Scope `GroupEstate` cleanup in `FilterSetsController#create` to `group: @group`

**Google OAuth**
- [ ] Add Google as a federated identity provider in Cognito user pool
- [ ] Frontend: "Sign in with Google" button on login screen integrated with Amplify social login flow
- [ ] User account linking: existing email/password accounts can connect Google identity

**Onboarding Fixes**
- [ ] Fix brokerage domain setup step: domain validation, save, and confirmation work end-to-end
- [ ] Fix post-join experience: user lands on correct dashboard after accepting invitation with no dead ends

**Calendar Sync**
- [ ] OAuth connection flow for Google Calendar (Google Identity + Calendar API)
- [ ] OAuth connection flow for Apple Calendar (CalDAV via iCloud)
- [ ] OAuth connection flow for Microsoft Calendar (Microsoft Graph API)
- [ ] Per-user calendar connection stored in DB (`UserCalendarConnection` model)
- [ ] Sync `EstateDate` records to connected calendars on create/update/delete
- [ ] UI: calendar connection management panel (connect, disconnect, sync status)
- [ ] Background job to handle calendar write failures with retry

**Performance Fixes**
- [ ] Fix `EstateLike` N+1: bulk-precompute `liked_ge_ids` in both estates index actions
- [ ] Fix `EstateEventSerializer` N+1: add `.includes(rsvps: :user)` to event query scope
- [ ] Enforce `per_page` cap at 100 across all 6 uncapped controllers
- [ ] Remove unused `paginate` lambda from `Pagination` concern

**Tech Debt Cleanup**
- [ ] Remove all `console.log` statements from production code; add ESLint `no-console` rule
- [ ] Rename `usersAminView` directory to `usersAdminView` and update all imports
- [ ] Add `BrokerageBoardCredential#status` enum definition
- [ ] Migrate `GroupEstatesQuery` price filtering to use `price_numeric` column
- [ ] Delete dead `FilterByPopup` component (imports non-existent `framer-motion`)
- [ ] Lower brokerage domain log from `info` to `debug` in `BrokerageAuth`

**Unit Testing**
- [ ] Backend: tenant isolation — confirm cross-brokerage data access is blocked
- [ ] Backend: admin authorization — confirm `agent`/`client` roles rejected from admin endpoints
- [ ] Backend: `FilterSetsController` create/update transitions — estate cleanup correctness
- [ ] Backend: `GroupEstatesQuery` filter combinations — price/sort returns correct results
- [ ] Backend: `InvitationsController` create and accept actions
- [ ] Frontend: `ProtectedRoute` and `RequireRole` guard behavior
- [ ] Frontend: core context hooks (`GeneralDashboardContext`, `useGeneralDashboardContext`)
- [ ] Frontend: Google OAuth login flow (Amplify social sign-in)
- [ ] Frontend: calendar sync connection flow and UI states

### Out of Scope

- Apple / Microsoft social login — only Google OAuth for this milestone; others in a future auth milestone
- JWT → HttpOnly cookies migration — architectural change requiring significant backend/frontend coordination; separate security milestone
- Redux → Context migration — 3 slices, low-risk but high churn; separate cleanup milestone
- SCSS → Tailwind migration — incremental only; do not migrate proactively in this milestone
- Admin directory restructure (`adminBoard/` vs `view/admin/`) — separate refactor milestone
- TanStack Query v4 → v5 upgrade — breaking API changes; separate upgrade milestone
- `ActivityQuery` SQL UNION optimization — performance improvement deferred; acceptable at current scale
- `User#current_brokerage_membership` job-context fix — low impact; document constraint and defer

## Context

- **Stack:** Ruby 4.0.2 / Rails 7.1 JSON API + Vite/React 18 SPA. Monorepo with `backend/` and `frontend/` as separate git repos.
- **Auth:** AWS Cognito + Amplify for identity; custom HS256 JWT (`TokenService`) issued on sign-in, stored in `localStorage`. `CognitoAuth` concern verifies per-request.
- **Multi-tenancy:** `BrokerageAuth` concern resolves `Current.brokerage` from Host header on every request. All queries must scope to `Current.brokerage`.
- **Soft deletes:** `acts_as_paranoid` on all user-facing models. Every query must call `.without_deleted`; joins require explicit `where(table: { deleted_at: nil })`.
- **No test suite exists today** — the entire backend and frontend are untested. This milestone establishes the foundation.
- **Calendar model:** `EstateDate` is the existing listing event model. `EstateEventSerializer` and `estate_dates_controller` already exist for dashboard reads.
- **Background jobs:** SolidQueue (DB-backed, no Redis). Calendar sync writes should go through a job for retry resilience.
- **Onboarding:** The `createBrokerage` wizard and `joinBrokerage` invitation flow exist in frontend. The domain setup step and post-join redirect are the broken parts.

## Constraints

- **Tech Stack:** Must use existing Rails + React stack; no new backend framework introductions
- **Auth Provider:** Google OAuth must integrate via Cognito federated identity (not a direct OAuth implementation) to maintain single token issuance point
- **Calendar APIs:** Google Calendar (REST), Apple Calendar (CalDAV), Microsoft (Graph API) — each requires per-user OAuth tokens stored server-side
- **Soft Deletes:** Every new query must call `.without_deleted`; joined models must add explicit `deleted_at: nil` where clauses
- **Serializer N+1:** New collection endpoints must bulk-compute per-record data in the controller; serializers must never query per-record
- **Testing:** Backend uses Minitest (not RSpec); Frontend uses `@testing-library/react`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Google OAuth via Cognito federated identity | Keeps token issuance centralized in `TokenService`; avoids parallel auth path | — Pending |
| Per-user `UserCalendarConnection` model | Calendar tokens are personal; users may connect different calendars | — Pending |
| SolidQueue job for calendar sync writes | Calendar APIs can fail; retry resilience needed without blocking request cycle | — Pending |
| Fix onboarding bugs in-place (not rewrite) | Flows exist; specific steps are broken — surgical fixes preferred over rewrite | — Pending |
| Full bug audit in single phase | All documented concerns addressed together to avoid accumulating further debt | — Pending |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-30 after initialization*
