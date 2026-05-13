---
phase: 05-calendar-sync
plan: "03"
subsystem: calendar
tags: [microsoft-calendar, oauth2, adapter, httparty, microsoft-graph, rails-cache]

requires:
  - phase: 05-01
    provides: UserCalendarConnection AR model with credentials_hash/credentials_hash= accessors; EstateDateCalendarEvent model
  - phase: 05-02
    provides: GoogleOauthController structure (mirrored exactly)

provides:
  - Calendar::MicrosoftCalendarAdapter with sync(estate_date:, action:, external_event_id:, timezone:, credentials:)
  - V1::Account::Calendar::MicrosoftOauthController with authorize + callback actions
  - GET /v1/account/calendar/microsoft/authorize route
  - GET /v1/account/calendar/microsoft/callback route

affects: [05-05]

tech-stack:
  added: []
  patterns:
    - "MicrosoftCalendarAdapter uses HTTParty directly against Microsoft Graph API — microsoft_graph SDK is archived, never use it"
    - "transactionId field in event payload provides Microsoft Graph idempotency for retries within 1 hour"
    - "destroy action looks up EstateDateCalendarEvent.external_event_id (the actual MS event ID) — not the external_event_id argument (which is the deterministic rs-N key)"
    - "404 on Graph DELETE treated as success (event already deleted)"
    - "OAuth2 state nonce stored in Rails.cache with 10-minute TTL; single-use (deleted on first read)"
    - "user_id sourced from cache state entry only — never from params (T-05-03-01 CSRF protection)"
    - "refresh_token preserved from existing connection when Microsoft does not re-issue on re-auth"

key-files:
  created:
    - backend/app/services/calendar/microsoft_calendar_adapter.rb
    - backend/app/controllers/v1/account/calendar/microsoft_oauth_controller.rb
  modified:
    - backend/config/routes.rb

key-decisions:
  - "MicrosoftCalendarAdapter mirrors GoogleCalendarAdapter structure but uses HTTParty directly — no google-apis-calendar_v3 equivalent for Microsoft (SDK archived)"
  - "transactionId set to external_event_id (rs-{estate_date_id}) in Graph event create payload — Microsoft deduplicates within 1 hour window"
  - "Routes use namespace :calendar > namespace :microsoft to produce /v1/account/calendar/microsoft/authorize and /callback (consistent with Google namespace pattern)"
  - "callback includes before_action :authenticate_cognito_user! — consistent with GoogleOauthController; more secure than plan's T-05-03 accepted risk"

requirements-completed: [CAL-04]

duration: 5min
completed: "2026-05-13"
---

# Phase 05 Plan 03: Microsoft Calendar Provider Summary

**MicrosoftCalendarAdapter + MicrosoftOauthController built — Microsoft Graph API event create/delete and OAuth2 authorize/callback endpoints ready for CalendarSyncJob (Plan 05)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-13T20:50:17Z
- **Completed:** 2026-05-13T20:55:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `Calendar::MicrosoftCalendarAdapter` created in `app/services/calendar/`
  - `sync(estate_date:, action:, external_event_id:, timezone:, credentials:)` for create and destroy actions
  - Uses HTTParty directly against `https://graph.microsoft.com/v1.0` — archived SDK never used
  - create: POST to `/me/events` with full event payload including `transactionId` idempotency key
  - destroy: looks up `EstateDateCalendarEvent.external_event_id` for the actual Microsoft event ID, then DELETE `/me/events/{id}`; 404 treated as success
  - `in_time_zone(tz)` for UTC-to-brokerage-timezone conversion; ISO8601 without offset in dateTime field (timeZone carries timezone per Graph API spec)
- `V1::Account::Calendar::MicrosoftOauthController` created with `authorize` and `callback` actions
  - `authorize`: generates `SecureRandom.hex(32)` state nonce; stores `{user_id: Current.user.id}` in `Rails.cache` with 10-minute TTL; returns `{redirect_url: ...}` JSON pointing to `login.microsoftonline.com/common/oauth2/v2.0/authorize`
  - `callback`: validates state from cache (single-use, deleted immediately); exchanges code via HTTParty POST to `login.microsoftonline.com/common/oauth2/v2.0/token`; upserts `UserCalendarConnection` with `connected` status; redirects to frontend `/account`
  - `user_id` sourced exclusively from `state_data[:user_id]` (T-05-03-01 mitigation)
  - `refresh_token` preserved from existing connection if Microsoft does not re-issue
- Routes added: `GET /v1/account/calendar/microsoft/authorize` and `GET /v1/account/calendar/microsoft/callback`

## Task Commits

Each task was committed atomically to `backend/`:

1. **Task 1: MicrosoftCalendarAdapter** — `a2d2c15` (feat)
2. **Task 2: MicrosoftOauthController + routes** — `62be7e7` (feat)

## Files Created/Modified

- `backend/app/services/calendar/microsoft_calendar_adapter.rb` — new adapter service (71 lines)
- `backend/app/controllers/v1/account/calendar/microsoft_oauth_controller.rb` — new OAuth controller (97 lines)
- `backend/config/routes.rb` — added microsoft namespace inside calendar namespace

## Deviations from Plan

None — plan executed exactly as written. Both files match the plan's code specifications with no changes required.

## Security (Threat Model Compliance)

- **T-05-03-01 (state nonce CSRF):** State validated against `Rails.cache` — not from user-controlled params; deleted after first read (single-use); expired state returns 422; user_id from cache only, not params
- **T-05-03-02 (token disclosure):** `exchange_code_for_tokens` errors log only `response.code` via error raise — token values never written to `Rails.logger`
- **T-05-03-03 (Microsoft refresh token expiry):** Accepted per plan — when `invalid_grant` occurs during refresh in CalendarSyncJob (Plan 05), `status = 'error'` is set and surfaced in UI per CAL-07; user must reconnect
- **T-05-03-04 (transactionId idempotency):** `transactionId: external_event_id` present in build_event_payload — Microsoft deduplicates requests with same transactionId within 1 hour

## Known Stubs

None — adapter and controller are fully implemented with no placeholder data.

---
*Phase: 05-calendar-sync*
*Completed: 2026-05-13*

## Self-Check: PASSED

Files verified:
- FOUND: backend/app/services/calendar/microsoft_calendar_adapter.rb
- FOUND: backend/app/controllers/v1/account/calendar/microsoft_oauth_controller.rb
- FOUND: backend/config/routes.rb (contains microsoft namespace)

Commits verified (backend repo):
- FOUND: a2d2c15 (Task 1 — MicrosoftCalendarAdapter)
- FOUND: 62be7e7 (Task 2 — MicrosoftOauthController + routes)

Rails environment verification:
- MicrosoftOauthController loaded: ApplicationController (superclass correct)
- MicrosoftCalendarAdapter loaded: Object (superclass correct)
- sync method present: true
