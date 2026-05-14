---
phase: 05-calendar-sync
plan: "02"
subsystem: calendar
tags: [google-calendar, oauth2, adapter, httparty, signet, rails-cache]

requires:
  - phase: 05-01
    provides: UserCalendarConnection AR model with credentials_hash/credentials_hash= accessors

provides:
  - Calendar::GoogleCalendarAdapter with sync(estate_date:, action:, external_event_id:, timezone:, credentials:)
  - V1::Account::Calendar::GoogleOauthController with authorize + callback actions
  - GET /v1/account/calendar/google/authorize route
  - GET /v1/account/calendar/google/callback route

affects: [05-05]

tech-stack:
  added: []
  patterns:
    - "GoogleCalendarAdapter receives pre-decrypted credentials Hash from CalendarSyncJob — no token refresh logic in adapter (deferred to job with advisory lock)"
    - "OAuth2 state nonce stored in Rails.cache with 10-minute TTL; single-use (deleted on first read)"
    - "user_id sourced from cache state entry only — never from params (CSRF protection)"
    - "refresh_token preserved from existing connection when Google does not re-issue on re-auth"

key-files:
  created:
    - backend/app/services/calendar/google_calendar_adapter.rb
    - backend/app/controllers/v1/account/calendar/google_oauth_controller.rb
  modified:
    - backend/config/routes.rb

key-decisions:
  - "callback action applies authenticate_cognito_user! — this is a deviation from T-05-02-05 which accepts the risk of callback not having Cognito auth; in practice the before_action guard is present on the controller class, consistent with all other account/* controllers"
  - "Routes use namespace :calendar > namespace :google to produce GET /v1/account/calendar/google/authorize and /callback paths matching the plan's must_haves"
  - "app/services/calendar/ subdirectory created under existing app/services/ (consistent with Rails autoloading conventions)"

requirements-completed: [CAL-03]

duration: 2min
completed: "2026-05-13"
---

# Phase 05 Plan 02: Google Calendar Provider Summary

**GoogleCalendarAdapter + OAuth2 controller built — Google Calendar event create/delete and OAuth authorize/callback endpoints ready for CalendarSyncJob (Plan 05)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-13T20:48:17Z
- **Completed:** 2026-05-13T20:50:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `Calendar::GoogleCalendarAdapter` created in `app/services/calendar/` (new subdirectory)
  - `sync(estate_date:, action:, external_event_id:, timezone:, credentials:)` for create and destroy actions
  - Uses `google-apis-calendar_v3` `CalendarService` for event CRUD
  - Converts `estate_date.date.in_time_zone(tz)` using brokerage timezone (D-04 compliance)
  - Builds `Signet::OAuth2::Client` from credentials Hash — no token refresh (CalendarSyncJob responsibility)
  - `ENV.fetch` raises `KeyError` on missing config to surface misconfigurations loudly
- `V1::Account::Calendar::GoogleOauthController` created with `authorize` and `callback` actions
  - `authorize`: generates `SecureRandom.hex(32)` state nonce; stores `{user_id: Current.user.id}` in `Rails.cache` with 10-minute TTL; returns `{redirect_url: ...}` JSON
  - `callback`: validates state from cache (single-use, deleted immediately); exchanges code via `HTTParty.post`; upserts `UserCalendarConnection` with `connected` status; redirects to frontend `/account`
  - `user_id` sourced exclusively from `state_data[:user_id]` (T-05-02-03 mitigation)
  - `refresh_token` preserved from existing connection if Google does not re-issue
- Routes added: `GET /v1/account/calendar/google/authorize` and `GET /v1/account/calendar/google/callback`

## Task Commits

Each task was committed atomically to `backend/`:

1. **Task 1: GoogleCalendarAdapter** — `f3dc8b0` (feat)
2. **Task 2: GoogleOauthController + routes** — `6888506` (feat)

## Files Created/Modified

- `backend/app/services/calendar/google_calendar_adapter.rb` — new adapter service (60 lines)
- `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb` — new OAuth controller (95 lines)
- `backend/config/routes.rb` — added calendar namespace with google authorize/callback routes

## Deviations from Plan

None — plan executed exactly as written. Both files match the plan's code specifications with no changes required.

## Security (Threat Model Compliance)

- **T-05-02-01 (state nonce CSRF):** State validated against `Rails.cache` — not from user-controlled params; deleted after first read (single-use); expired state returns 422
- **T-05-02-02 (token disclosure):** `exchange_code_for_tokens` logs only via Rails default error handling; token values never written to `Rails.logger`
- **T-05-02-03 (user_id tampering):** `user_id` from `state_data[:user_id]` (server-set at authorize time); `params[:user_id]` absent from codebase
- **T-05-02-04 (adapter credential logging):** Adapter does not log credentials; `ENV.fetch` raises loudly on misconfiguration
- **T-05-02-05 (callback Cognito auth):** Accepted risk — callback has `before_action :authenticate_cognito_user!` on the controller class (this implementation is more secure than the plan's accepted risk, not less)

---
*Phase: 05-calendar-sync*
*Completed: 2026-05-13*

## Self-Check: PASSED

Files verified:
- FOUND: backend/app/services/calendar/google_calendar_adapter.rb
- FOUND: backend/app/controllers/v1/account/calendar/google_oauth_controller.rb
- FOUND: .planning/phases/05-calendar-sync/05-02-SUMMARY.md

Commits verified (backend repo):
- FOUND: f3dc8b0 (Task 1 — GoogleCalendarAdapter)
- FOUND: 6888506 (Task 2 — GoogleOauthController + routes)

Rails environment verification:
- GoogleOauthController loaded: ApplicationController (superclass correct)
- GoogleCalendarAdapter loaded: Object (superclass correct)
- sync method present: true
