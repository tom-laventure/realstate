# Phase 5: Calendar Sync - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the full calendar sync stack: `UserCalendarConnection` model (credential storage, status tracking) + `CalendarSyncJob` (SolidQueue, per-user-per-provider-per-event) + provider adapters for Google (OAuth2), Microsoft (Azure AD v2.0 + Graph), and Apple (CalDAV + app-specific password) + calendar management panel in user account settings (new Calendar tab with 3 provider cards).

After this phase: users can connect/disconnect any of the three calendar providers from their account settings; `EstateDate` create/update/delete events sync automatically to connected calendars; sync failures show per-provider in the settings panel; Re-sync re-enqueues the job without requiring reconnection.

</domain>

<decisions>
## Implementation Decisions

### Event ID Storage

- **D-01:** External calendar event IDs are stored in a dedicated join table `estate_date_calendar_events` — NOT as columns on `estate_dates`. Schema: `(estate_date_id, user_id, provider, external_event_id, status, last_synced_at)`. Each row represents one (EstateDate × User × Provider) sync record.
- **D-02:** Each row in `estate_date_calendar_events` tracks sync state: `status` (e.g., `synced`, `error`) and `last_synced_at`. This gives per-event failure visibility and supports future per-event re-sync without requiring per-provider columns on `EstateDate`.

### Timezone Handling

- **D-03:** Add a `timezone` string column to the `brokerages` table, defaulting to `'UTC'`. Migration only in this phase — no UI for brokerage timezone editing.
- **D-04:** `CalendarSyncJob` reads timezone as `estate_date.group_estate.group.brokerage.timezone.presence || 'UTC'` when constructing calendar event datetimes. The `date` datetime from `EstateDate` is interpreted in the brokerage timezone.

### Sync Trigger

- **D-05:** `CalendarSyncJob` is enqueued at the **controller level** in `EstateDatesController` after each create, update, and destroy action — matching the existing `FanoutNotificationsJob` enqueue pattern. Model callbacks are not used (would fire on seeds/console; model should not depend on external calendar services).
- **D-06:** One job per `(user_id, provider, estate_date_id, action)`. Signature: `CalendarSyncJob.perform_later(user_id:, provider:, estate_date_id:, action:)`. `action` is `'create'`, `'update'`, or `'destroy'`. Failures are isolated per user and provider.
- **D-07:** The controller enqueues one job per (user × provider) for each connected user in the brokerage who has a `connected` `UserCalendarConnection` for that provider. The controller fans out to all relevant connections before returning the HTTP response.

### Settings UI

- **D-08:** The calendar management panel is a new **Calendar tab** added to the existing Account page (`Account.tsx` / `AccountContext.tsx`). No new route needed — it lives alongside the existing profile and groups sections under the account settings shell.
- **D-09:** The Calendar tab shows **3 vertical cards**, one per provider (Google, Microsoft, Apple). Each card displays: provider logo/name, connection status badge (`connected` / `error` / `disconnected`), last sync time, Connect/Disconnect action button, and a Re-sync button that appears when `status === 'error'`.

### Credential Storage

- **D-10:** `UserCalendarConnection` stores credentials via ActiveRecord Encryption (`encrypts :credentials`) matching the `BrokerageBoardCredential` pattern. For Google/Microsoft: credentials is a JSON blob with `access_token`, `refresh_token`, `expires_at`. For Apple: credentials is `{ app_specific_password: "..." }`. Single encrypted `credentials` text column with JSON payload.

### Re-sync Behavior

- **D-11:** The Re-sync button (CAL-07) enqueues `CalendarSyncJob` for each `EstateDate` accessible to the user in any of their brokerage groups — scoped to the single failing provider. It does a full sweep (all future events), not just the last-failed event. The job uses deterministic provider event IDs (derived from `EstateDate.id`) so re-syncing is idempotent.

### Claude's Discretion

- Exact column set and indexes for `estate_date_calendar_events` and `user_calendar_connections`
- Advisory lock implementation (`with_advisory_lock` gem vs. raw `pg_try_advisory_xact_lock`) for token refresh serialization (CAL-06)
- Exact provider event ID derivation formula (e.g., `"realstate-#{estate_date_id}"` prefix)
- CalDAV library choice for Apple (e.g., `dav4rack`, `caldav` gem, or raw Net::HTTP with XML)
- Google/Microsoft OAuth2 client gem choice
- Spinner/loading state on Connect button during OAuth redirect
- Error message copy on sync failure cards

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §Calendar Sync — CAL-01 through CAL-07 with exact acceptance criteria
- `.planning/ROADMAP.md` §Phase 5 — success criteria (4 must-be-true conditions)

### Existing Job Pattern (reference before writing CalendarSyncJob)
- `backend/app/jobs/fanout_notifications_job.rb` — canonical SolidQueue job pattern: `queue_as :default`, `retry_on StandardError, wait: :polynomially_longer, attempts: 3`, `discard_on ActiveRecord::RecordNotFound`
- `backend/app/jobs/application_job.rb` — base job class

### Credential Encryption Pattern (reference before writing UserCalendarConnection)
- `backend/app/models/brokerage_board_credential.rb` — canonical `encrypts :field` pattern using ActiveRecord Encryption
- `backend/config/initializers/active_record_encryption.rb` — encryption config

### EstateDate Model (sync target)
- `backend/app/models/estate_date.rb` — the model being synced; has `date` (datetime, UTC), `time` (string), `event_type`, `location`, `title`, `notes`, `group_estate_id`
- `backend/db/schema.rb` — current schema; `estate_dates` table definition; `brokerages` table (add `timezone` column here)

### Account Settings UI (where Calendar tab goes)
- `frontend/src/containers/account/AccountContext.tsx` — existing AccountContext; Calendar tab gets its own CalendarContext or extends this
- `frontend/src/containers/account/Account.tsx` — page shell where Calendar tab is added
- `frontend/src/router/account/account.tsx` — account router (check if tab routing is needed)

### Controller to extend for sync enqueue
- `backend/app/controllers/v1/dashboard/group/estate_dates_controller.rb` (or similar path) — add `CalendarSyncJob.perform_later(...)` after create/update/destroy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FanoutNotificationsJob` — copy job structure verbatim for `CalendarSyncJob`; same queue, retry, discard pattern
- `BrokerageBoardCredential` — copy `encrypts :credentials` pattern for `UserCalendarConnection`
- `AccountContext.tsx` — calendar state/actions can either extend this context or live in a parallel `CalendarContext.tsx` co-located in `containers/account/`
- `active_record_encryption.rb` initializer — already configured; no setup needed for new `encrypts` fields

### Established Patterns
- **Multi-tenancy:** `Current.brokerage` scopes all queries; `UserCalendarConnection` must always be scoped to `Current.user` (personal connections, not brokerage-level)
- **Soft deletes:** Add `acts_as_paranoid` to `UserCalendarConnection` (consistent with all user-facing models)
- **Job enqueuing:** Controller calls `JobClass.perform_later(named_args)` after the DB write, before rendering the response
- **Frontend data flow:** Component → Context hook → TanStack hook → API module — no direct axios in components
- **AR Encryption:** `encrypts :field` with `_ciphertext` column in the DB; `field` accessor on the model

### Integration Points
- `EstateDatesController` create/update/destroy → enqueue `CalendarSyncJob` per connected user per provider
- `UserCalendarConnection` OAuth callback endpoints needed: `GET /v1/account/calendar/google/callback` and `/microsoft/callback`
- Apple CalDAV: no OAuth callback; credentials submitted via form POST in the settings UI
- `AccountContext` or new `CalendarContext` → `useFetchCalendarConnections` hook → `GET /v1/account/calendar/connections`

</code_context>

<specifics>
## Specific Ideas

- The 3 provider cards use consistent layout: provider icon + name at top, status badge (shadcn Badge component with color variant), last synced timestamp, action buttons at bottom
- Apple card shows an input form (iCloud email + app-specific password) that submits inline — no OAuth redirect, unlike Google/Microsoft
- Re-sync button only appears when `status === 'error'`; disabled during in-flight requests
- `CalendarSyncJob` uses `with_advisory_lock` (or PostgreSQL advisory lock) on `UserCalendarConnection.id` before token refresh to prevent concurrent refresh storms (CAL-06 requirement)

</specifics>

<deferred>
## Deferred Ideas

- **Brokerage timezone editing UI** — `brokerages.timezone` column added in this phase but no settings screen for editing it; that belongs in a future admin settings phase
- **Two-way calendar sync** — v2 deferred item from REQUIREMENTS.md; read-back from calendar providers is out of scope
- **"Connect Google from profile settings" for existing email/password users** — v2 deferred item; this phase only adds calendar connections, not identity provider connections

</deferred>

---

*Phase: 05-calendar-sync*
*Context gathered: 2026-05-12*
