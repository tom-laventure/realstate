---
phase: 05-calendar-sync
plan: "04"
subsystem: calendar
tags: [calendav, apple-caldav, connections-api, serializer, routes, rest-api]

requires:
  - phase: 05-calendar-sync
    plan: "01"
    provides: UserCalendarConnection model, EstateDateCalendarEvent model, User has_many :user_calendar_connections

provides:
  - Calendar::AppleCalendarAdapter service (CalDAV event create/delete via calendav gem)
  - V1::Account::Calendar::ConnectionsController (index, create_apple, destroy, resync)
  - UserCalendarConnectionSerializer (safe whitelist — no credentials exposed)
  - All 8 calendar routes under /v1/account/calendar/ in routes.rb

affects: [05-05, 05-06, 05-07]

tech-stack:
  added: []
  patterns:
    - "AppleCalendarAdapter follows GoogleCalendarAdapter structural pattern: initialize(connection), sync(estate_date:, action:, external_event_id:, timezone:, credentials:)"
    - "Apple create returns CalDAV event URL (not 'rs-N' string) — CalendarSyncJob must store URL as external_event_id"
    - "ConnectionsController uses find_or_create_by! in index to ensure all 3 provider rows exist"
    - "Resync uses dual-join chain: joins(group_estate: {group: :brokerage}) + joins(group_estate: :estate) before where(estates: {...}) to avoid PG::UndefinedTable"
    - "Resync uses find_by (not find_by!) with explicit nil/disconnected guards to support CAL-07 error-state re-sync"

key-files:
  created:
    - backend/app/services/calendar/apple_calendar_adapter.rb
    - backend/app/serializers/user_calendar_connection_serializer.rb
    - backend/app/controllers/v1/account/calendar/connections_controller.rb
  modified:
    - backend/config/routes.rb

key-decisions:
  - "routes.rb flat calendar routes fix: replaced sub-namespaced google/microsoft blocks with flat routes — previous namespace :google { get :authorize } generated wrong controller path v1/account/calendar/google/google_oauth#authorize instead of v1/account/calendar/google_oauth#authorize; flat get 'google/authorize', to: 'google_oauth#authorize' resolves correctly"
  - "Apple CalDAV create returns event URL string as external_event_id (not 'rs-N') — CalendarSyncJob (Plan 05) must store return value from sync() when action='create'"
  - "Resync uses find_by (no bang, no status filter) — error-state connections can still trigger resync per CAL-07; nil returns 404, disconnected returns 422, connected/error proceeds"

requirements-completed: [CAL-02, CAL-05]

duration: 7min
completed: "2026-05-13"
---

# Phase 05 Plan 04: Apple CalDAV Adapter + ConnectionsController + Routes Summary

**AppleCalendarAdapter, ConnectionsController, UserCalendarConnectionSerializer built and all 8 calendar routes registered — complete Wave 2 backend API surface**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-13T20:55:20Z
- **Completed:** 2026-05-13T21:02:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `Calendar::AppleCalendarAdapter#sync` creates/deletes iCalendar events via calendav gem; `create` action returns the CalDAV event URL for storage by CalendarSyncJob as `external_event_id`; `destroy` looks up stored URL from `EstateDateCalendarEvent`
- `build_ics` private helper constructs iCalendar payload with VTIMEZONE component (gracefully degrades if tzinfo unavailable), `dtstart`/`dtend` with timezone ID, and estate_date fields
- `UserCalendarConnectionSerializer` attributes whitelist: `id, provider, status, last_synced_at, last_error, created_at` — `credentials` and `credentials_ciphertext` never serialized (T-05-04-02 mitigation)
- `V1::Account::Calendar::ConnectionsController` with 4 actions:
  - `index`: `find_or_create_by!` upsert pattern ensures all 3 provider rows exist before returning
  - `create_apple`: validates Apple credentials via live CalDAV `client.calendars.list` before storing
  - `destroy`: clears credentials (`credentials: nil`), sets `status: "disconnected"`
  - `resync`: dual-join chain for future estate_dates with soft-delete guards; `find_by` (no bang) enables CAL-07 error-state re-sync
- All 8 calendar routes registered under `/v1/account/calendar/` — 4 connections routes + 4 OAuth routes

## Task Commits

Each task was committed atomically to `backend/`:

1. **Task 1: AppleCalendarAdapter + Serializer** — `07f3d9f` (feat)
2. **Task 2: ConnectionsController + routes** — `5b50150` (feat)

## Files Created/Modified

- `backend/app/services/calendar/apple_calendar_adapter.rb` — new CalDAV adapter
- `backend/app/serializers/user_calendar_connection_serializer.rb` — new safe serializer
- `backend/app/controllers/v1/account/calendar/connections_controller.rb` — new REST controller
- `backend/config/routes.rb` — calendar namespace block updated with all 8 routes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong controller path for Google/Microsoft OAuth routes**
- **Found during:** Task 2 (routes verification)
- **Issue:** The existing `namespace :calendar` block used nested `namespace :google` and `namespace :microsoft` sub-namespaces. This generated controller paths like `v1/account/calendar/google/google_oauth#authorize` — but the actual controller class is `V1::Account::Calendar::GoogleOauthController` (no `Google` sub-module). The routes pointed to non-existent controllers; any call to the authorize/callback endpoints would have raised `ActionController::RoutingError: uninitialized constant V1::Account::Calendar::Google`
- **Fix:** Replaced sub-namespaced blocks with flat routes: `get "google/authorize", to: "google_oauth#authorize"` — produces the same URL path but correctly routes to `v1/account/calendar/google_oauth#authorize`
- **Files modified:** `backend/config/routes.rb`
- **Commit:** `5b50150`

## Security (Threat Model Compliance)

- **T-05-04-01 (provider param tampering):** `PROVIDERS.include?(params[:provider])` guard in `destroy` and `resync` — returns 422 on invalid provider values; provider string never used in SQL without validation
- **T-05-04-02 (credentials disclosure):** `UserCalendarConnectionSerializer` attributes whitelist omits `credentials` and `credentials_ciphertext`; verified via `_attributes.to_a`
- **T-05-04-03 (Apple brute-force):** Live CalDAV validation in `create_apple` — failed credential check returns 422 immediately with generic error message
- **T-05-04-04 (cross-user access):** All queries scoped to `Current.user.user_calendar_connections` — never `UserCalendarConnection.find(params[:id])`
- **T-05-04-05 (Apple password in logs):** `rescue => e` block does not log `e.message` — returns generic error string to client
- **T-05-04-06 (resync scope bypass):** `where("estate_dates.date >= ?", Time.current)` + `where(estates: {deleted_at: nil})` + dual-join chain enforced

## Next Phase Readiness

- Wave 3 plan (05-05: CalendarSyncJob) can now build against the complete backend API surface
- `CalendarSyncJob.perform_later(user_id:, provider:, estate_date_id:, action:)` — resync enqueues these jobs
- Apple `sync` returns CalDAV event URL for `create` action — CalendarSyncJob must persist this as `external_event_id` in `EstateDateCalendarEvent`
- Frontend (Plans 05-06, 05-07) can consume `GET /v1/account/calendar/connections`, `POST /v1/account/calendar/apple/connect`, `DELETE /v1/account/calendar/:provider`, `POST /v1/account/calendar/:provider/resync`

---
*Phase: 05-calendar-sync*
*Completed: 2026-05-13*

## Self-Check: PASSED

Files verified:
- FOUND: backend/app/services/calendar/apple_calendar_adapter.rb
- FOUND: backend/app/serializers/user_calendar_connection_serializer.rb
- FOUND: backend/app/controllers/v1/account/calendar/connections_controller.rb
- FOUND: .planning/phases/05-calendar-sync/05-04-SUMMARY.md

Commits verified: 07f3d9f, 5b50150 present in backend git log
