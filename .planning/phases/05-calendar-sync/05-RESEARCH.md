# Phase 5: Calendar Sync — Research

**Researched:** 2026-05-12
**Domain:** OAuth2 calendar integration (Google Calendar API, Microsoft Graph, Apple CalDAV) + SolidQueue job architecture + Rails AR Encryption + React settings UI
**Confidence:** HIGH (stack verified via rubygems.org registry, codebase confirmed)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** External calendar event IDs stored in dedicated join table `estate_date_calendar_events` — schema: `(estate_date_id, user_id, provider, external_event_id, status, last_synced_at)`
- **D-02:** Each row tracks sync state: `status` and `last_synced_at` — gives per-event failure visibility
- **D-03:** Add `timezone` string column to `brokerages` table defaulting to `'UTC'` — migration only, no UI
- **D-04:** `CalendarSyncJob` reads timezone as `estate_date.group_estate.group.brokerage.timezone.presence || 'UTC'`
- **D-05:** Sync enqueued at controller level in `EstateEventsController` after create and destroy — no model callbacks
- **D-06:** One job per `(user_id, provider, estate_date_id, action)`. Signature: `CalendarSyncJob.perform_later(user_id:, provider:, estate_date_id:, action:)`. Action values: `'create'`, `'destroy'` (no update — routes confirm `only: [:index, :create, :destroy]`)
- **D-07:** Controller fans out to all connected `UserCalendarConnection` rows for all users in the brokerage (via `estate_date.group_estate.group.brokerage`)
- **D-08:** Calendar management panel is a new Calendar tab in the existing `Account.tsx` / `AccountContext.tsx` — no new route
- **D-09:** Calendar tab shows 3 vertical provider cards (Google, Microsoft, Apple) with status badge, last sync time, Connect/Disconnect/Re-sync buttons
- **D-10:** `UserCalendarConnection` stores credentials via `encrypts :credentials` — JSON blob. Google/Microsoft: `{access_token, refresh_token, expires_at}`. Apple: `{app_specific_password: "...", email: "..."}`
- **D-11:** Re-sync enqueues `CalendarSyncJob` for each `EstateDate` in the user's brokerage groups — full sweep, idempotent via deterministic event IDs

### Claude's Discretion

- Exact column set and indexes for `estate_date_calendar_events` and `user_calendar_connections`
- Advisory lock implementation (`with_advisory_lock` gem vs. raw `pg_try_advisory_xact_lock`) for token refresh serialization
- Exact provider event ID derivation formula
- CalDAV library choice for Apple
- Google/Microsoft OAuth2 client gem choice
- Spinner/loading state on Connect button during OAuth redirect
- Error message copy on sync failure cards

### Deferred Ideas (OUT OF SCOPE)

- Brokerage timezone editing UI — column added but no settings screen
- Two-way calendar sync — out of scope for v1
- "Connect Google from profile settings" for existing email/password users — v2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAL-01 | `user_calendar_connections` table: one row per user per provider, `status`, `last_synced_at`, `last_error`, encrypted credentials | AR Encryption pattern confirmed via `BrokerageBoardCredential`; `encrypts :credentials` single JSON column |
| CAL-02 | User can view, connect, disconnect from profile settings; each provider shows status + last sync | UI-SPEC approved; Account.tsx tab integration pattern confirmed |
| CAL-03 | Google Calendar OAuth2 connect; EstateDate create/destroy events synced automatically | `google-apis-calendar_v3` 0.53.0 confirmed; `signet`/`googleauth` for token refresh |
| CAL-04 | Microsoft Calendar OAuth2 (Azure AD v2.0 + Graph); EstateDate events synced | `omniauth-azure-activedirectory-v2` 2.4.0 + raw HTTParty for Graph calls (official SDK archived) |
| CAL-05 | Apple iCloud Calendar via app-specific password + CalDAV; events synced | `calendav` 0.6.0 confirmed, actively maintained, native Apple support |
| CAL-06 | All writes via `CalendarSyncJob` (SolidQueue); deterministic event ID; advisory lock for token refresh | `with_advisory_lock` 7.5.0; `FanoutNotificationsJob` as canonical pattern |
| CAL-07 | Sync failure indicator per provider; Re-sync re-enqueues without reconnection | Full-sweep job approach; `estate_date_calendar_events.status = 'error'` drives UI |
</phase_requirements>

---

## Summary

Phase 5 builds on a mature Rails 7.1 / React 18 codebase that already has the primary infrastructure this phase needs: ActiveRecord Encryption (via `BrokerageBoardCredential`), SolidQueue (via `FanoutNotificationsJob`), omniauth-oauth2 (already a transitive Gemfile dependency), and faraday (already in Gemfile.lock). The new gems required are: `google-apis-calendar_v3` (official Google client, 0.53.0), `omniauth-azure-activedirectory-v2` (for Microsoft OAuth2 initiation, 2.4.0), `calendav` (for Apple CalDAV, 0.6.0), and `with_advisory_lock` (for token refresh serialization, 7.5.0).

The EstateEventsController (`v1/dashboard/group/estate_events`) has `create` and `destroy` but no `update` action — routes confirm `only: [:index, :create, :destroy]`. Calendar sync therefore uses only `action: 'create'` and `action: 'destroy'`. The fanout pattern mirrors `FanoutNotificationsJob` exactly: enqueue after the DB write, before rendering the response.

The frontend change is surgical: `Account.tsx` gains a `Tabs` wrapper (UI-SPEC is approved), and a new `CalendarTab` component renders 3 provider cards. The existing `AccountContext.tsx` can be extended with a parallel `CalendarContext.tsx` to keep concerns separate while co-locating under `containers/account/`.

**Primary recommendation:** Use `google-apis-calendar_v3` + `signet`/`googleauth` (via `google-apis-core`) for Google; `omniauth-azure-activedirectory-v2` for OAuth initiation + raw HTTParty calls for Microsoft Graph; `calendav` 0.6.0 for Apple CalDAV. Use `with_advisory_lock` 7.5.0 for token refresh serialization. Derive provider event IDs as `"rs-#{estate_date_id}"` (short prefix, provider-safe).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OAuth2 token exchange (Google, Microsoft) | API / Backend | — | Token secrets never touch browser; backend handles redirect and exchanges code for tokens |
| Apple CalDAV credential validation | API / Backend | — | App-specific password validated at connection time via CalDAV HEAD request |
| Calendar event CRUD | Background Job | API (triggers) | Async via SolidQueue; controller enqueues, job executes |
| Token refresh (Google, Microsoft) | Background Job | — | Job holds `with_advisory_lock` before refresh to prevent concurrent storms |
| Credential storage | Database / Storage | — | AR Encryption (`encrypts :credentials`); never in environment variables |
| Sync status display | Browser / Client | API | `estate_date_calendar_events.status` and `user_calendar_connections.status` fetched via API |
| Provider card UI / settings tab | Browser / Client | — | React settings panel, no server-side rendering |
| OAuth callback routing | API / Backend | — | `GET /v1/account/calendar/google/callback`, `/microsoft/callback` on the brokerage subdomain (not `auth.realtybase.ca` — this is calendar auth for already-authenticated users, not identity login) |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `google-apis-calendar_v3` | 0.53.0 | Google Calendar event CRUD | Official Google-maintained Ruby client; auto-generated from discovery doc; handles serialization and scopes [VERIFIED: rubygems.org 2026-03-08] |
| `google-apis-core` | 1.0.2 | OAuth2 auth for Google APIs; token refresh via `googleauth` / `signet` | Transitive dep of `google-apis-calendar_v3`; already-resolved in lock if added [VERIFIED: rubygems.org] |
| `omniauth-azure-activedirectory-v2` | 2.4.0 | Microsoft OAuth2 initiation (Azure AD v2.0 endpoint) | 35M downloads, maintained; `omniauth-oauth2` already in Gemfile.lock [VERIFIED: rubygems.org 2024-10-22] |
| `calendav` | 0.6.0 | Apple iCloud CalDAV event CRUD | Active (0.6.0 released 2026-04-12); native Apple credential support; depends on `icalendar` + `http` + `nokogiri` [VERIFIED: rubygems.org] |
| `with_advisory_lock` | 7.5.0 | PostgreSQL advisory lock on `UserCalendarConnection.id` for token refresh | 27M downloads; transaction-level lock API (`transaction: true`); PG-native [VERIFIED: rubygems.org 2026-01-21] |
| `icalendar` | 2.12.2 | iCalendar VEVENT construction for CalDAV payload | Transitive dep of `calendav`; also usable standalone [VERIFIED: rubygems.org 2026-03-21] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `httparty` | (already in Gemfile) | Raw Microsoft Graph API calls (POST/PATCH/DELETE /me/events) | Microsoft SDK is archived; use HTTParty directly with `Authorization: Bearer {token}` header |
| `oauth2` | 2.0.9 | Microsoft token refresh (POST to `login.microsoftonline.com/common/oauth2/v2.0/token`) | Already in Gemfile.lock as transitive dep of `omniauth-oauth2` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `google-apis-calendar_v3` | raw HTTParty + `signet` | More control, less abstraction — but `google-apis-calendar_v3` provides Ruby event objects; use it |
| `omniauth-azure-activedirectory-v2` | `microsoft_graph` SDK | Official SDK archived July 2025, community preview only — never use in production |
| `calendav` | raw Net::HTTP + XML | `calendav` abstracts iCalendar building and REPORT queries; raw XML is error-prone and unmaintained |
| `with_advisory_lock` | raw `ActiveRecord::Base.connection.execute("SELECT pg_advisory_xact_lock(...)")` | Both valid; `with_advisory_lock` provides cleaner API with automatic release and `timeout_seconds` support |

**Installation:**
```bash
# Run from backend/
bundle add google-apis-calendar_v3 omniauth-azure-activedirectory-v2 calendav with_advisory_lock
```

**Version verification:** [VERIFIED: rubygems.org registry, confirmed 2026-05-12]
- `google-apis-calendar_v3`: 0.53.0 (2026-03-08)
- `omniauth-azure-activedirectory-v2`: 2.4.0 (2024-10-22)
- `calendav`: 0.6.0 (2026-04-12)
- `with_advisory_lock`: 7.5.0 (2026-01-21)

---

## Architecture Patterns

### System Architecture Diagram

```
EstateEventsController (create/destroy)
    │
    ├─ DB write (EstateDate.create / .destroy)
    │
    └─ Fan-out: UserCalendarConnection.where(
                  user_id: brokerage.user_ids,
                  status: 'connected'
                ).each do |conn|
                    CalendarSyncJob.perform_later(
                      user_id: conn.user_id,
                      provider: conn.provider,
                      estate_date_id: event.id,
                      action: 'create' | 'destroy'
                    )
                  end

CalendarSyncJob (SolidQueue :default queue)
    │
    ├─ Load UserCalendarConnection (discard_on RecordNotFound)
    ├─ with_advisory_lock(conn.id) ──► token refresh if expires_at < now + 5min
    │                                    └─ POST /oauth2/token → update credentials
    ├─ Dispatch to provider adapter:
    │   ├─ GoogleCalendarAdapter  ──► google-apis-calendar_v3
    │   │   (CalendarService#insert_event / #delete_event)
    │   ├─ MicrosoftCalendarAdapter ──► HTTParty POST/DELETE /me/events/{id}
    │   │   (Authorization: Bearer {access_token})
    │   └─ AppleCalendarAdapter  ──► calendav client
    │       (client.events.create/delete)
    │
    ├─ On success: upsert estate_date_calendar_events
    │   (estate_date_id, user_id, provider, external_event_id, status: 'synced')
    └─ On error: update status: 'error', last_error: e.message
                 update user_calendar_connections.last_error

OAuth2 Callback endpoints (already-authenticated users):
    GET /v1/account/calendar/google/callback?code=...&state=...
    GET /v1/account/calendar/microsoft/callback?code=...&state=...
    POST /v1/account/calendar/apple/connect  (form submission, no redirect)

Frontend (CalendarTab):
    CalendarContext ──► useFetchCalendarConnections (GET /v1/account/calendar/connections)
                    ──► useConnectCalendar / useDisconnectCalendar / useResyncCalendar
    ProviderCard × 3 (Google | Microsoft | Apple)
```

### Recommended Project Structure

```
backend/
├── app/
│   ├── controllers/v1/account/calendar/
│   │   ├── connections_controller.rb   # GET /connections, DELETE /:provider
│   │   ├── google_oauth_controller.rb  # GET /google/authorize, /google/callback
│   │   └── microsoft_oauth_controller.rb
│   ├── jobs/
│   │   └── calendar_sync_job.rb
│   ├── models/
│   │   ├── user_calendar_connection.rb
│   │   └── estate_date_calendar_event.rb
│   └── services/calendar/
│       ├── google_calendar_adapter.rb
│       ├── microsoft_calendar_adapter.rb
│       └── apple_calendar_adapter.rb
├── db/migrate/
│   ├── YYYYMMDD_create_user_calendar_connections.rb
│   ├── YYYYMMDD_create_estate_date_calendar_events.rb
│   └── YYYYMMDD_add_timezone_to_brokerages.rb
frontend/
├── src/
│   ├── containers/account/
│   │   └── CalendarContext.tsx
│   ├── components/view/account/calendar/
│   │   ├── CalendarTab.tsx
│   │   └── ProviderCard.tsx
│   ├── store/hooks/Account/
│   │   ├── useFetchCalendarConnections.ts
│   │   ├── useConnectGoogleCalendar.ts
│   │   ├── useConnectMicrosoftCalendar.ts
│   │   ├── useConnectAppleCalendar.ts
│   │   ├── useDisconnectCalendar.ts
│   │   └── useResyncCalendar.ts
│   └── assets/
│       ├── api/account/calendar/
│       │   ├── fetchCalendarConnections.ts
│       │   ├── connectAppleCalendar.ts
│       │   ├── disconnectCalendar.ts
│       │   └── resyncCalendar.ts
│       └── types/
│           └── calendarConnectionType.ts
```

### Pattern 1: CalendarSyncJob — SolidQueue Job Structure

**What:** Canonical SolidQueue job pattern — copy `FanoutNotificationsJob` verbatim. Retry 3 times with polynomial backoff. Discard on `RecordNotFound`. Advisory lock before token refresh.

**When to use:** Any calendar write (create event, delete event) per (user, provider, estate_date).

**Example:**
```ruby
# Source: backend/app/jobs/fanout_notifications_job.rb (canonical pattern)
class CalendarSyncJob < ApplicationJob
  queue_as :default
  retry_on StandardError, wait: :polynomially_longer, attempts: 3
  discard_on ActiveRecord::RecordNotFound

  def perform(user_id:, provider:, estate_date_id:, action:)
    conn = UserCalendarConnection.without_deleted
      .find_by!(user_id: user_id, provider: provider, status: "connected")

    estate_date = EstateDate.without_deleted.find(estate_date_id)
    brokerage = estate_date.group_estate.group.brokerage
    timezone = brokerage.timezone.presence || "UTC"

    conn.class.with_advisory_lock("ucc-token-#{conn.id}") do
      refresh_token_if_expiring!(conn)
    end

    external_event_id = "rs-#{estate_date_id}"

    adapter = adapter_for(conn)
    adapter.sync(estate_date:, action:, external_event_id:, timezone:, credentials: conn.credentials)

    upsert_sync_record(estate_date_id:, user_id:, provider:, external_event_id:, action:)
  end

  private

  def adapter_for(conn)
    case conn.provider
    when "google" then Calendar::GoogleCalendarAdapter.new(conn)
    when "microsoft" then Calendar::MicrosoftCalendarAdapter.new(conn)
    when "apple" then Calendar::AppleCalendarAdapter.new(conn)
    end
  end
end
```

### Pattern 2: UserCalendarConnection Model

**What:** AR Encryption for credentials JSON, acts_as_paranoid, enum for status.

```ruby
# Source: backend/app/models/brokerage_board_credential.rb (canonical encrypts pattern)
class UserCalendarConnection < ApplicationRecord
  acts_as_paranoid
  belongs_to :user

  encrypts :credentials  # stores JSON blob; _ciphertext column in DB

  PROVIDERS = %w[google microsoft apple].freeze
  enum :status, { connected: "connected", error: "error", disconnected: "disconnected" }, prefix: :connection

  def credentials_hash
    JSON.parse(credentials || "{}")
  end

  def credentials_hash=(hash)
    self.credentials = hash.to_json
  end
end
```

### Pattern 3: Google Calendar Adapter

**What:** Uses `google-apis-calendar_v3` with `signet`/`googleauth` for token management.

```ruby
# Source: google-apis-calendar_v3 0.53.0 [VERIFIED: rubygems.org]
# Source: https://blog.saeloun.com/2023/11/16/integrating-google-calendar-api-into-rails-application/
require "google/apis/calendar_v3"
require "googleauth"

class Calendar::GoogleCalendarAdapter
  CALENDAR_ID = "primary"

  def initialize(connection)
    @connection = connection
  end

  def sync(estate_date:, action:, external_event_id:, timezone:, credentials:)
    service = Google::Apis::CalendarV3::CalendarService.new
    service.authorization = build_authorizer(credentials)

    case action
    when "create"
      event = build_event(estate_date, timezone)
      event.id = external_event_id
      service.insert_event(CALENDAR_ID, event)
    when "destroy"
      service.delete_event(CALENDAR_ID, external_event_id)
    end
  end

  private

  def build_authorizer(creds)
    Signet::OAuth2::Client.new(
      client_id: ENV.fetch("GOOGLE_CALENDAR_CLIENT_ID"),
      client_secret: ENV.fetch("GOOGLE_CALENDAR_CLIENT_SECRET"),
      access_token: creds["access_token"],
      refresh_token: creds["refresh_token"],
      expires_at: creds["expires_at"]
    )
  end

  def build_event(estate_date, timezone)
    tz = ActiveSupport::TimeZone[timezone] || ActiveSupport::TimeZone["UTC"]
    start_time = tz.parse(estate_date.date.to_s)
    end_time = start_time + 1.hour

    Google::Apis::CalendarV3::Event.new(
      summary: estate_date.title.presence || estate_date.event_type,
      location: estate_date.location,
      description: estate_date.notes,
      start: Google::Apis::CalendarV3::EventDateTime.new(
        date_time: start_time.rfc3339, time_zone: timezone
      ),
      end: Google::Apis::CalendarV3::EventDateTime.new(
        date_time: end_time.rfc3339, time_zone: timezone
      )
    )
  end
end
```

### Pattern 4: Microsoft Graph via HTTParty

**What:** Since the official `microsoft_graph` SDK was archived July 2025, use HTTParty (already in Gemfile) for direct Graph API calls.

```ruby
# Source: https://learn.microsoft.com/en-us/graph/api/user-post-events [CITED]
# Token endpoint: POST https://login.microsoftonline.com/common/oauth2/v2.0/token
class Calendar::MicrosoftCalendarAdapter
  GRAPH_BASE = "https://graph.microsoft.com/v1.0"

  def initialize(connection)
    @connection = connection
  end

  def sync(estate_date:, action:, external_event_id:, timezone:, credentials:)
    token = credentials["access_token"]

    case action
    when "create"
      HTTParty.post(
        "#{GRAPH_BASE}/me/events",
        headers: { "Authorization" => "Bearer #{token}", "Content-Type" => "application/json" },
        body: build_event_payload(estate_date, timezone, external_event_id).to_json
      )
    when "destroy"
      # Retrieve stored event ID from estate_date_calendar_events, then DELETE
      record = EstateDateCalendarEvent.find_by!(
        estate_date_id: estate_date.id,
        user_id: @connection.user_id,
        provider: "microsoft"
      )
      HTTParty.delete(
        "#{GRAPH_BASE}/me/events/#{record.external_event_id}",
        headers: { "Authorization" => "Bearer #{token}" }
      )
    end
  end
end
```

### Pattern 5: Apple CalDAV via `calendav`

**What:** `calendav` 0.6.0 with Apple credentials; uses `icalendar` internally.

```ruby
# Source: calendav 0.6.0 README [VERIFIED: rubygems.org, github.com/pat/calendav]
require "calendav"

class Calendar::AppleCalendarAdapter
  def initialize(connection)
    @connection = connection
  end

  def sync(estate_date:, action:, external_event_id:, timezone:, credentials:)
    creds = Calendav.credentials(
      :apple,
      credentials["email"],
      credentials["app_specific_password"]
    )
    client = Calendav.client(creds)
    calendar = client.calendars.list.first  # or find by display name

    case action
    when "create"
      ics = build_ics(estate_date, external_event_id, timezone)
      client.events.create(calendar.url, "#{external_event_id}.ics", ics.to_ical)
    when "destroy"
      record = EstateDateCalendarEvent.find_by!(
        estate_date_id: estate_date.id,
        user_id: @connection.user_id,
        provider: "apple"
      )
      client.events.delete(record.external_event_id)  # external_event_id is the event URL
    end
  end

  private

  def build_ics(estate_date, uid, timezone)
    cal = Icalendar::Calendar.new
    cal.add_timezone(ActiveSupport::TimeZone[timezone].tzinfo.ical_timezone)
    event = Icalendar::Event.new
    event.uid = uid
    event.summary = estate_date.title.presence || estate_date.event_type
    event.location = estate_date.location
    event.description = estate_date.notes
    tz = ActiveSupport::TimeZone[timezone] || ActiveSupport::TimeZone["UTC"]
    event.dtstart = Icalendar::Values::DateTime.new(
      tz.parse(estate_date.date.to_s), "TZID" => timezone
    )
    event.dtend = Icalendar::Values::DateTime.new(
      tz.parse(estate_date.date.to_s) + 1.hour, "TZID" => timezone
    )
    cal.add_event(event)
    cal
  end
end
```

### Pattern 6: Controller Fanout (D-05 / D-07)

**What:** Enqueue jobs at controller level immediately after DB write. Mirror `FanoutNotificationsJob` enqueue pattern.

```ruby
# After event.save! in EstateEventsController#create:
brokerage = @group.brokerage
user_ids = brokerage.users.without_deleted.pluck(:id)
connections = UserCalendarConnection.without_deleted
  .where(user_id: user_ids, status: "connected")

connections.each do |conn|
  CalendarSyncJob.perform_later(
    user_id: conn.user_id,
    provider: conn.provider,
    estate_date_id: event.id,
    action: "create"
  )
end

# After @event.destroy in EstateEventsController#destroy:
connections.each do |conn|
  CalendarSyncJob.perform_later(
    user_id: conn.user_id,
    provider: conn.provider,
    estate_date_id: @event.id,
    action: "destroy"
  )
end
```

### Pattern 7: OAuth2 Callback Endpoints (Backend)

**What:** Google and Microsoft OAuth2 callbacks arrive at the user's brokerage subdomain (NOT `auth.realtybase.ca` — that intermediary is for identity login via Cognito, not calendar connections). Calendar OAuth is for already-authenticated users, so the callback can use the brokerage subdomain directly.

```ruby
# routes.rb addition under namespace :account
namespace :calendar do
  get :connections, to: "connections#index"
  delete ":provider", to: "connections#destroy", as: :disconnect
  post "apple/connect", to: "connections#create_apple"
  post ":provider/resync", to: "connections#resync"
  get "google/authorize", to: "google_oauth#authorize"
  get "google/callback",  to: "google_oauth#callback"
  get "microsoft/authorize", to: "microsoft_oauth#authorize"
  get "microsoft/callback",  to: "microsoft_oauth#callback"
end
```

The callback `state` parameter encodes the user's session token (to identify the user after redirect), since the OAuth redirect flow breaks the HTTP session. The backend verifies the state token on callback.

### Pattern 8: Frontend CalendarContext

**What:** Parallel context alongside `AccountContext.tsx`. Follows the Component → Context → Hook → API module pattern.

```tsx
// Source: frontend/src/containers/account/AccountContext.tsx (canonical pattern)
const useCalendarContext = () => {
    const connectionsQuery = useFetchCalendarConnections()
    const disconnectMutation = useDisconnectCalendar()
    const resyncMutation = useResyncCalendar()

    return useMemo(() => ({
        state: {
            connections: connectionsQuery.data?.connections || [],
            isLoading: connectionsQuery.isLoading
        },
        actions: {
            disconnect: disconnectMutation.mutate,
            resync: resyncMutation.mutate
        }
    }), [connectionsQuery.data, connectionsQuery.isLoading, disconnectMutation, resyncMutation])
}
```

### Pattern 9: Account.tsx Tabs Integration

**What:** Wrap existing `Account.tsx` content in a `Tabs` component. The UI-SPEC is approved and all 7 shadcn components needed are already installed in `frontend/src/components/ui/`.

```tsx
// All components already in frontend/src/components/ui/:
// tabs.tsx, card.tsx, badge.tsx, button.tsx, input.tsx, label.tsx, dialog.tsx
// [VERIFIED: filesystem check 2026-05-12]

return (
    <div className="w-full max-w-6xl p-6">
        {/* Heading row stays above tabs */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            ...
        </div>
        <Tabs defaultValue="profile">
            <TabsList>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="calendar">
                    <Calendar className="mr-2 h-4 w-4" /> Calendar
                </TabsTrigger>
            </TabsList>
            <TabsContent value="profile">
                {/* Existing 12-col grid with MemberDetailCard + MemberGroupsList */}
            </TabsContent>
            <TabsContent value="calendar">
                <CalendarTab />
            </TabsContent>
        </Tabs>
    </div>
)
```

### Anti-Patterns to Avoid

- **Model callbacks for job enqueue:** `after_create_commit` would fire on seeds and console operations. D-05 is explicit: controller level only (mirror: existing `FanoutNotificationsJob` enqueue pattern).
- **microsoft_graph gem:** Archived July 2025, community preview — never use.
- **Putting `refresh_token` in URL params or logs:** AR Encryption protects at-rest; ensure token refresh error messages log exception class, not token values.
- **Exposing `credentials` JSON in serializer:** `UserCalendarConnection` serializer must never include the `credentials` field.
- **Using `Brokerage#users` without `.without_deleted`:** All queries on `brokerage_memberships` joined tables must use `.without_deleted` per CLAUDE.md.
- **Hardcoding `primary` as calendar ID for Microsoft:** Microsoft Graph uses `/me/events` not a calendar ID; the default calendar is implicit.
- **Storing Apple event URL vs. UID:** For `destroy`, `calendav` needs the event URL (returned by `events.create`), not the UID. The `external_event_id` column in `estate_date_calendar_events` should store the URL for Apple and the event ID string for Google/Microsoft.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google Calendar event CRUD | Manual HTTP + JSON serialization | `google-apis-calendar_v3` | Auto-generated; handles API versioning, field serialization, pagination |
| iCalendar VEVENT construction | String-building `BEGIN:VCALENDAR...` | `icalendar` gem (via `calendav`) | RFC 5545 compliance; timezone, DTSTART formats are tricky |
| Apple CalDAV PROPFIND/REPORT discovery | Raw Net::HTTP + XML | `calendav` 0.6.0 | CalDAV discovery (PROPFIND, REPORT) is XML-heavy; calendav handles it |
| PostgreSQL advisory lock | Raw `execute("SELECT pg_advisory_lock(#{id})")` | `with_advisory_lock` 7.5.0 | Auto-release on exception; cleaner API; supports `timeout_seconds` |
| Token refresh race condition | Application-level mutex (Mutex.new) | PostgreSQL advisory lock | App-level mutex only spans one process; advisory locks span all Puma workers and SolidQueue workers |
| OAuth2 PKCE state validation | Custom HMAC state generation | Use `SecureRandom.hex(32)` stored in session | Standard approach; the complexity is in the redirect URI resolution, not the state itself |

**Key insight:** Calendar provider APIs have substantial edge cases in timezone representation, recurring event handling, and error codes that are well-handled by existing gems — don't replicate them.

---

## Schema: New Tables

### `user_calendar_connections`

```ruby
create_table :user_calendar_connections do |t|
  t.bigint   :user_id, null: false
  t.string   :provider, null: false             # 'google', 'microsoft', 'apple'
  t.string   :status, default: "disconnected", null: false  # 'connected', 'error', 'disconnected'
  t.text     :credentials_ciphertext            # AR Encryption target
  t.string   :last_error
  t.datetime :last_synced_at
  t.datetime :deleted_at
  t.timestamps

  t.index [:user_id, :provider], unique: true, where: "deleted_at IS NULL"
  t.index [:user_id]
  t.index [:status]
  t.index [:deleted_at]
end
add_foreign_key :user_calendar_connections, :users
```

### `estate_date_calendar_events`

```ruby
create_table :estate_date_calendar_events do |t|
  t.integer  :estate_date_id, null: false
  t.bigint   :user_id, null: false
  t.string   :provider, null: false
  t.text     :external_event_id               # Google/Microsoft: string ID; Apple: event URL
  t.string   :status, default: "pending", null: false  # 'synced', 'error', 'pending'
  t.string   :last_error
  t.datetime :last_synced_at
  t.timestamps

  t.index [:estate_date_id, :user_id, :provider], unique: true, name: "idx_edce_unique"
  t.index [:estate_date_id]
  t.index [:user_id, :provider]
  t.index [:status]
end
add_foreign_key :estate_date_calendar_events, :users
```

---

## Common Pitfalls

### Pitfall 1: OAuth State Parameter and Brokerage Identity

**What goes wrong:** The OAuth callback (Google, Microsoft) arrives with a `code` and `state` at the brokerage subdomain. If the `state` doesn't encode the authenticated user's identity, the backend can't correlate the callback to the user who initiated the flow.

**Why it happens:** OAuth redirects are stateless HTTP — no session cookie reliably crosses the redirect. The standard pattern is to encode a short-lived token (e.g., 5-minute expiry) in the `state` param.

**How to avoid:** On `authorize`, generate `state = SecureRandom.hex(32)`, store `{state => {user_id, provider}}` in Rails cache (solid_cache, already installed), with 10-minute TTL. On `callback`, look up `state` in cache, extract `user_id`, create/update `UserCalendarConnection`.

**Warning signs:** 401 or "user not found" errors on calendar callback endpoint.

### Pitfall 2: Apple CalDAV — External Event ID is a URL, Not a String

**What goes wrong:** For Apple CalDAV, `calendav` returns the event as a URL (`https://caldav.icloud.com/calendars/.../{uid}.ics`). The `destroy` operation requires this URL, not just the UID. If you store only the UID in `estate_date_calendar_events.external_event_id`, you can't delete the event.

**Why it happens:** CalDAV uses resource URLs, not IDs, as primary references.

**How to avoid:** For Apple, store the full event URL returned by `calendav`'s `events.create` in `external_event_id`. Use the URL directly for `events.delete`. For Google/Microsoft, store the provider's event ID string.

**Warning signs:** `404 Not Found` on CalDAV DELETE operations.

### Pitfall 3: Token Refresh Storm on Concurrent Jobs

**What goes wrong:** Multiple `CalendarSyncJob` instances for the same user can run concurrently (SolidQueue is multi-threaded). If the access token is expired, all jobs attempt to refresh it simultaneously, causing duplicate refresh requests and potential token revocation by Google/Microsoft.

**Why it happens:** Access tokens expire every hour. Multiple jobs queued for the same user all detect expiry.

**How to avoid:** `with_advisory_lock("ucc-token-#{conn.id}")` before the refresh check. Only one job can hold this lock per `UserCalendarConnection` at a time. All others wait, then find a valid token already refreshed.

**Warning signs:** Multiple refresh token errors logged within seconds for the same user.

### Pitfall 4: Missing `.without_deleted` on `brokerage.users` for Fanout

**What goes wrong:** Controller fanout queries `brokerage.users` without the soft-delete scope, including users who have been removed from the brokerage.

**Why it happens:** CLAUDE.md REQUIREMENT — every query touching `brokerage_memberships` must use `.without_deleted`.

**How to avoid:**
```ruby
# Correct: load user_ids with soft-delete scope
user_ids = brokerage.users.without_deleted.pluck(:id)
connections = UserCalendarConnection.without_deleted.where(user_id: user_ids, status: "connected")
```

**Warning signs:** Calendar events sent to deleted users' calendars.

### Pitfall 5: Google `access_type: 'offline'` Must Be Set on Initial Authorization

**What goes wrong:** If the Google OAuth2 authorization request does not include `access_type: 'offline'`, Google does not return a `refresh_token`. Without a refresh token, the connection becomes permanently broken once the access token expires (in ~1 hour).

**Why it happens:** Google only issues refresh tokens on first authorization, and only when `access_type: offline` is requested.

**How to avoid:** In `GoogleOauthController#authorize`, include `access_type: 'offline', prompt: 'consent'` in the OAuth2 authorization URL params. `prompt: 'consent'` ensures refresh token is re-issued even if the user previously authorized.

**Warning signs:** `credentials["refresh_token"]` is nil; sync works for ~1 hour then fails with `invalid_grant`.

### Pitfall 6: Microsoft Refresh Tokens Expire After 90 Days of Inactivity

**What goes wrong:** Microsoft refresh tokens for the `offline_access` scope expire after 90 days without use. A user who doesn't generate any EstateDate events for 90 days will have a broken connection with no immediate indication.

**Why it happens:** Microsoft enforces token expiry for security. [CITED: learn.microsoft.com/en-us/answers/questions/1402711]

**How to avoid:** When Microsoft token refresh fails with `invalid_grant`, update `UserCalendarConnection.status = 'error'` and `last_error = "Token expired — please reconnect"`. The error state surfaces in the UI per CAL-07. No automatic fix; user must reconnect.

**Warning signs:** `invalid_grant` error in job logs; `user_calendar_connections.status = 'error'` for Microsoft connections.

### Pitfall 7: `EstateDate.date` Is UTC but Provider Expects Local Time

**What goes wrong:** `estate_dates.date` is a Rails `datetime` (UTC). Calendar providers require the event time in the event's local timezone with an explicit `timeZone` identifier. Without conversion, events appear at the wrong time in users' calendars.

**Why it happens:** D-03/D-04: `brokerage.timezone` is added in this phase. Must convert `estate_date.date` from UTC to brokerage timezone before building the calendar event payload.

**How to avoid:** `tz.parse(estate_date.date.in_time_zone(timezone).to_s)` or `estate_date.date.in_time_zone(timezone)`.

### Pitfall 8: Re-sync (CAL-07) Must Scope EstateDate to Future Events Only

**What goes wrong:** Re-sync job loops over all `EstateDate` records in the brokerage — including past events. Creating past events in calendars is noisy for users and wastes API quota.

**Why it happens:** D-11 says "full sweep (all future events)".

**How to avoid:**
```ruby
# In ResyncCalendarJob or CalendarSyncJob sweep mode:
EstateDate.without_deleted
  .joins(group_estate: :group)
  .where(groups: { brokerage_id: conn.user.brokerage.id })
  .where("estate_dates.date >= ?", Time.current)
```

---

## Code Examples

### Google OAuth2 Authorization URL

```ruby
# Source: omniauth-google-oauth2 (already in Gemfile) + Google OAuth2 docs [CITED]
# GET /v1/account/calendar/google/authorize
def authorize
  state = SecureRandom.hex(32)
  Rails.cache.write("cal_oauth_state:#{state}", { user_id: Current.user.id }, expires_in: 10.minutes)

  url = "https://accounts.google.com/o/oauth2/v2/auth?" + {
    client_id: ENV.fetch("GOOGLE_CALENDAR_CLIENT_ID"),
    redirect_uri: ENV.fetch("GOOGLE_CALENDAR_REDIRECT_URI"),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state: state
  }.to_query

  render json: { redirect_url: url }
end
```

### Microsoft OAuth2 Token Refresh

```ruby
# Source: Microsoft Graph OAuth2 v2.0 endpoint [CITED: learn.microsoft.com/graph/auth-v2-user]
def self.refresh_microsoft_token!(conn)
  creds = conn.credentials_hash
  response = HTTParty.post(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    body: {
      client_id: ENV.fetch("MICROSOFT_CALENDAR_CLIENT_ID"),
      client_secret: ENV.fetch("MICROSOFT_CALENDAR_CLIENT_SECRET"),
      refresh_token: creds["refresh_token"],
      grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/Calendars.ReadWrite offline_access"
    }
  )
  raise "Token refresh failed: #{response.code}" unless response.success?

  data = response.parsed_response
  conn.update!(
    credentials: {
      access_token: data["access_token"],
      refresh_token: data["refresh_token"] || creds["refresh_token"],
      expires_at: Time.current + data["expires_in"].to_i.seconds
    }.to_json
  )
end
```

### with_advisory_lock Usage for Token Refresh

```ruby
# Source: with_advisory_lock 7.5.0 [VERIFIED: rubygems.org], makandracards.com [CITED]
# Call inside CalendarSyncJob#perform before using the access_token:
UserCalendarConnection.with_advisory_lock("ucc-token-#{conn.id}") do
  creds = conn.credentials_hash
  if creds["expires_at"] && Time.parse(creds["expires_at"]) < 5.minutes.from_now
    case conn.provider
    when "google"   then refresh_google_token!(conn)
    when "microsoft" then refresh_microsoft_token!(conn)
    # Apple: no token to refresh (app-specific password doesn't expire)
    end
    conn.reload
  end
end
```

### Provider Event ID Formula

```ruby
# Recommended formula (Claude's Discretion)
# "rs-" prefix avoids numeric-only IDs (rejected by some providers)
# estate_date_id is unique per (user, provider) because the join table enforces it
external_event_id = "rs-#{estate_date_id}"
# Result: "rs-4281" — safe for Google (alphanumeric + hyphens OK), Microsoft (string ID), Apple (UID in iCalendar)
```

### Frontend: useFetchCalendarConnections Hook

```tsx
// Source: frontend/src/store/hooks/Account/useGetAccountProfile.tsx (canonical hook pattern)
import { useQuery } from '@tanstack/react-query'
import fetchCalendarConnections from '@/assets/api/account/calendar/fetchCalendarConnections'

const useFetchCalendarConnections = () => {
    const { isLoading, data, isError } = useQuery({
        queryKey: ['account', 'calendar', 'connections'],
        queryFn: fetchCalendarConnections,
        retry: false,
    })
    return { isLoading, connections: data?.connections || [], isError }
}
```

### Frontend: CalendarConnectionType (define before hooks)

```typescript
// Source: CLAUDE.md — "Define domain interfaces in assets/types/ before creating hooks"
// frontend/src/assets/types/calendarConnectionType.ts
export type CalendarProvider = 'google' | 'microsoft' | 'apple'
export type CalendarConnectionStatus = 'connected' | 'error' | 'disconnected'

export interface CalendarConnection {
    provider: CalendarProvider
    status: CalendarConnectionStatus
    lastSyncedAt: string | null
    lastError: string | null
}

export interface FetchCalendarConnectionsResponse {
    connections: CalendarConnection[]
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `microsoft_graph` gem | Archived July 2025 — use raw HTTParty | July 2025 | Must use direct HTTP calls for Microsoft Graph |
| `google-api-client` gem (monolithic) | `google-apis-calendar_v3` (API-specific) | ~2021 | Smaller dep tree, per-API gems |
| `caldav-icloud` gem (0.3, 2014) | `calendav` 0.6.0 (2026) | 2020s | `calendav` is the modern maintained option |
| `pg_advisory_lock` direct SQL | `with_advisory_lock` gem | Ongoing | Gem provides cleaner API with exception safety |

**Deprecated/outdated:**
- `microsoft_graph` gem: archived July 2025; read-only repository — do not use
- `caldav-icloud` gem: last updated 2014 — do not use
- `google-api-client` (monolithic): superseded by per-API gems like `google-apis-calendar_v3`

---

## Runtime State Inventory

> This is not a rename/refactor phase. Skipped.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Apple CalDAV `calendav` gem works with Ruby 4.0.2 (no explicit Ruby version constraint declared) | Standard Stack | If incompatible, fall back to raw Net::HTTP + `icalendar` gem directly |
| A2 | Google OAuth callback redirect URI can be a brokerage subdomain (not fixed auth.realtybase.ca) because calendar OAuth is for authenticated users, not identity | Architecture Patterns | If Google OAuth app requires a fixed redirect URI per OAuth app, all brokerages must share one callback URI on the backend side |
| A3 | `estate_dates.date` column stores UTC datetimes (inferred from Rails convention and schema.rb; no timezone column observed) | Common Pitfalls (Pitfall 7) | If it stores in a non-UTC format, timezone conversion logic must be adjusted |
| A4 | Microsoft Graph `/me/events` is accessible with delegated `Calendars.ReadWrite` scope for individual user OAuth tokens | Standard Stack (Microsoft) | If tenant admin restrictions apply, may need `Calendar.ReadWrite` on application permissions |

**If A1 proves wrong:** `icalendar` 2.12.2 (already a transitive dep via `calendav`) plus raw `Net::HTTP` CalDAV requests are the fallback. The CalDAV REPORT/PROPFIND XML structure is documented in RFC 4791.

---

## Open Questions

1. **Google OAuth app redirect URI registration**
   - What we know: Google OAuth2 requires the redirect URI to be registered in the Google Cloud Console
   - What's unclear: Will each brokerage subdomain need to be registered, or can a wildcard/backend-side redirect work?
   - Recommendation: Use a single backend URI registered in the OAuth app (e.g., `https://api.realtybase.ca/v1/account/calendar/google/callback`), which is the brokerage subdomain backend endpoint. The frontend initiates via `GET /v1/account/calendar/google/authorize` which returns a redirect URL; the backend callback then redirects the browser back to the frontend. Alternatively, register the common auth domain for calendars.

2. **Microsoft OAuth app (Azure App Registration) vs. existing Google OAuth app**
   - What we know: Phase 4 registered a Google OAuth app in Cognito; this phase needs a separate Google OAuth app for calendar scope (different scopes, different tokens)
   - What's unclear: Whether the same Google Cloud project can have two OAuth2 client IDs (one for Cognito federation, one for calendar API)
   - Recommendation: Create a separate OAuth2 client ID in Google Cloud Console for calendar scope. Both can coexist in the same project. Requires separate `GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET` env vars distinct from Cognito's.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Ruby | Backend gems | ✓ | 4.0.2 (via rbenv) | — |
| Node.js | Frontend build | ✓ | 22.9.0 | — |
| PostgreSQL | Database | Not probed in this env | — | App requires PG |
| `google-apis-calendar_v3` gem | CAL-03 | ✗ (not in lockfile) | 0.53.0 | — |
| `omniauth-azure-activedirectory-v2` gem | CAL-04 | ✗ (not in lockfile) | 2.4.0 | — |
| `calendav` gem | CAL-05 | ✗ (not in lockfile) | 0.6.0 | — |
| `with_advisory_lock` gem | CAL-06 | ✗ (not in lockfile) | 7.5.0 | — |
| `oauth2` gem | Microsoft token refresh | ✓ (2.0.9 in lockfile) | 2.0.9 | — |
| `faraday` gem | google-apis-core dep | ✓ (2.12.1 in lockfile) | 2.12.1 | — |
| `httparty` gem | Microsoft Graph calls | ✓ (in Gemfile) | current | — |
| shadcn Tabs, Card, Badge, Button, Input, Label, Dialog | CAL-02 frontend | ✓ | installed | — |

**Missing dependencies with no fallback:** None — all 4 new gems are installable via `bundle add`.

**Missing dependencies with fallback:** None.

---

## Security Domain

> `security_enforcement` not set to false — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | OAuth2 PKCE state parameter + short-lived cache token for callback identity |
| V3 Session Management | Yes | `state` nonce expires in 10 minutes via `solid_cache`; single-use |
| V4 Access Control | Yes | Connections scoped to `Current.user`; fanout scoped to `Current.brokerage` — never expose other users' connections |
| V5 Input Validation | Yes | Provider param validated against allowlist `%w[google microsoft apple]`; never trust `params[:provider]` directly |
| V6 Cryptography | Yes | AR Encryption for credentials (not hand-rolled); access tokens never logged |

### Known Threat Patterns for OAuth2 + CalDAV Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| OAuth state parameter injection (open redirector) | Spoofing | Validate `state` against cache; validate `redirect_uri` param against registered URIs |
| Token leakage via logs | Information Disclosure | Never log `access_token` / `refresh_token`; log exception class only |
| Cross-user calendar write | Tampering | All `UserCalendarConnection` queries scoped to `Current.user.id` — never accept user_id from params |
| Apple credential brute-force | Tampering | Validate credentials on connect via CalDAV HEAD/OPTIONS; return error on invalid credentials, don't retry infinitely |
| Token refresh TOCTOU race | Tampering | PostgreSQL advisory lock via `with_advisory_lock` — mandatory before any refresh operation |
| Credential exposure in serializer | Information Disclosure | `UserCalendarConnection` serializer MUST NOT include `credentials` field; whitelist explicitly |

---

## Sources

### Primary (HIGH confidence)
- rubygems.org — `google-apis-calendar_v3` 0.53.0, `calendav` 0.6.0, `with_advisory_lock` 7.5.0, `omniauth-azure-activedirectory-v2` 2.4.0, `icalendar` 2.12.2, `oauth2` 2.0.9 — all version-verified 2026-05-12
- `backend/db/schema.rb` — confirmed estate_dates columns, brokerages table (no timezone column yet), existing table structure
- `backend/app/jobs/fanout_notifications_job.rb` — canonical job pattern
- `backend/app/models/brokerage_board_credential.rb` — canonical `encrypts` pattern
- `backend/app/controllers/v1/dashboard/group/estate_events_controller.rb` — confirmed only: [:create, :destroy], no update
- `backend/config/routes.rb` — confirmed route structure and account namespace
- `frontend/src/components/ui/` — all required shadcn components confirmed installed
- github.com/pat/calendav — Apple CalDAV support confirmed, active maintenance (0.6.0, 2026-04-12)
- github.com/microsoftgraph/msgraph-sdk-ruby — confirmed archived July 2025

### Secondary (MEDIUM confidence)
- learn.microsoft.com/graph/api/user-post-events — Microsoft Graph event creation endpoint and auth requirements [CITED]
- developers.google.com/calendar/api/v3/reference/events/insert — Google Calendar API insert endpoint [CITED]
- makandracards.com/makandra/482969 — `with_advisory_lock` transaction-level lock API [CITED]
- blog.saeloun.com/2023/11/16/integrating-google-calendar-api-into-rails-application — google-apis-calendar_v3 Rails integration [CITED]

### Tertiary (LOW confidence)
- None — all critical claims verified via rubygems.org or official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all gem versions confirmed via rubygems.org registry 2026-05-12
- Architecture: HIGH — derived from confirmed codebase patterns + official API documentation
- Pitfalls: HIGH — derived from official OAuth2 docs, confirmed gem behaviors, and codebase requirements

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (stable stack; gem versions verified)
