---
phase: 05-calendar-sync
plan: "05"
subsystem: calendar
tags: [calendar-sync-job, solid-queue, advisory-lock, token-refresh, fan-out, estate-events]

requires:
  - phase: 05-calendar-sync
    plan: "01"
    provides: UserCalendarConnection model, EstateDateCalendarEvent model, with_advisory_lock gem
  - phase: 05-calendar-sync
    plan: "02"
    provides: Calendar::GoogleCalendarAdapter
  - phase: 05-calendar-sync
    plan: "03"
    provides: Calendar::MicrosoftCalendarAdapter
  - phase: 05-calendar-sync
    plan: "04"
    provides: Calendar::AppleCalendarAdapter, ConnectionsController, all 8 calendar routes

provides:
  - CalendarSyncJob (SolidQueue job — token-refresh-safe calendar sync per user/provider/estate_date/action)
  - EstateEventsController fan-out on create and destroy (enqueues CalendarSyncJob per connected user)

affects: [05-06, 05-07]

tech-stack:
  added: []
  patterns:
    - "CalendarSyncJob.find_by!(user_id:, provider:) without status filter — ensures retries fire after error-state transitions (CAL-07)"
    - "ConnectionNotActiveError custom error class — discarded immediately for intentionally-disconnected connections; distinct from RecordNotFound"
    - "with_advisory_lock('ucc-token-N') serializes token refresh across all SolidQueue workers for same connection"
    - "Apple create: CalDAV event URL stored as external_event_id (not rs-N string) via is_a?(String) check"
    - "Fan-out uses Current.brokerage.users.without_deleted.pluck(:id) + UserCalendarConnection.without_deleted per CLAUDE.md"

key-files:
  created:
    - backend/app/jobs/calendar_sync_job.rb
  modified:
    - backend/app/controllers/v1/dashboard/group/estate_events_controller.rb

key-decisions:
  - "find_by!(user_id:, provider:) without status filter — BLOCKER 4 fix: error-state connections retried instead of discarded; disconnected handled via ConnectionNotActiveError + discard_on"
  - "ConnectionNotActiveError distinct from RecordNotFound — user intentional disconnect discards job; absent record discards job; error-state connection retries job"
  - "action values are 'create' and 'destroy' only — no 'update' action (EstateEventsController routes confirm only: [:index, :create, :destroy])"
  - "update_columns used for error state updates — skips AR callbacks and validations (safe for status/error fields)"

requirements-completed: [CAL-06, CAL-07]

duration: 5min
completed: "2026-05-13"
---

# Phase 05 Plan 05: CalendarSyncJob + EstateEventsController Fan-out Summary

**CalendarSyncJob fully implemented with advisory-lock token refresh and adapter dispatch; EstateEventsController fans out calendar sync jobs on create and destroy**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-13T21:04:30Z
- **Completed:** 2026-05-13T21:09:49Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `CalendarSyncJob` created with canonical SolidQueue class-level declarations (`queue_as :default`, `retry_on StandardError, wait: :polynomially_longer, attempts: 3`, `discard_on ActiveRecord::RecordNotFound`)
- `ConnectionNotActiveError` custom class added with dedicated `discard_on` — disconnected connections silently discarded, error-state connections correctly retried
- `find_by!(user_id:, provider:)` without `status:` filter — critical BLOCKER 4 fix: after `rescue` sets `conn.status = "error"`, subsequent retry finds the connection successfully and syncs (CAL-07)
- `with_advisory_lock("ucc-token-#{conn.id}")` serializes concurrent token refresh operations across SolidQueue workers (CAL-06)
- Token refresh logic for Google (HTTParty POST to googleapis.com/token) and Microsoft (HTTParty POST to microsoftonline.com) — Apple has no token to refresh
- `adapter_for(conn)` dispatches to `Calendar::GoogleCalendarAdapter`, `Calendar::MicrosoftCalendarAdapter`, or `Calendar::AppleCalendarAdapter`
- Apple create: `result.is_a?(String)` check stores CalDAV event URL as `stored_event_id` instead of `"rs-N"` (aligns with Plan 04 AppleCalendarAdapter contract)
- `upsert_sync_record` uses `EstateDateCalendarEvent.upsert` with `unique_by: :idx_edce_unique` for atomic create-or-update; `destroy` action uses `delete_all`
- `rescue => e` captures all errors, sets `conn.status = "error"` + `last_error`, updates `estate_date_calendar_events.status = "error"`, then `raise` re-triggers `retry_on StandardError`
- `EstateEventsController#create` fans out `CalendarSyncJob` per connected `UserCalendarConnection` after `FanoutNotificationsJob` (AFTER line 63, BEFORE render)
- `EstateEventsController#destroy` fans out `CalendarSyncJob` with `action: "destroy"` after `@event.destroy` (BEFORE render)
- Both fan-outs use `Current.brokerage.users.without_deleted.pluck(:id)` + `UserCalendarConnection.without_deleted` (CLAUDE.md soft-delete compliance)

## Task Commits

Each task was committed atomically to `backend/`:

1. **Task 1: CalendarSyncJob** — `3e63625` (feat)
2. **Task 2: EstateEventsController fan-out** — `19dbdb0` (feat)

## Files Created/Modified

- `backend/app/jobs/calendar_sync_job.rb` — new SolidQueue job (169 lines)
- `backend/app/controllers/v1/dashboard/group/estate_events_controller.rb` — fan-out added to create and destroy actions

## Deviations from Plan

None - plan executed exactly as written.

## Security (Threat Model Compliance)

- **T-05-05-01 (token refresh TOCTOU):** `UserCalendarConnection.with_advisory_lock("ucc-token-#{conn.id}")` serializes all refresh operations — concurrent workers cannot race to refresh the same token
- **T-05-05-02 (token values in logs):** `error_message = "#{e.class}: #{e.message.to_s.truncate(500)}"` — truncated message never includes raw token strings; `refresh_google_token!` / `refresh_microsoft_token!` log only `response.code` on failure
- **T-05-05-04 (soft-delete bypass):** `Current.brokerage.users.without_deleted.pluck(:id)` + `UserCalendarConnection.without_deleted` — deleted users' calendars never updated
- **T-05-05-05 (Apple URL stored correctly):** `conn.provider == "apple" && action == "create" && result.is_a?(String)` check before using as stored_event_id

## Next Phase Readiness

- Wave 3 plans (05-06, 05-07) are unblocked: calendar sync is now end-to-end functional
- Frontend Calendar tab (Plan 06) can render connection status from `GET /v1/account/calendar/connections`
- Re-sync button (Plan 07) enqueues via `POST /v1/account/calendar/:provider/resync` (already implemented in Plan 04's ConnectionsController)
- All CAL-06 and CAL-07 requirements are now satisfied

---
*Phase: 05-calendar-sync*
*Completed: 2026-05-13*

## Self-Check: PASSED

Files verified:
- FOUND: backend/app/jobs/calendar_sync_job.rb
- FOUND: backend/app/controllers/v1/dashboard/group/estate_events_controller.rb (contains CalendarSyncJob x2)
- FOUND: .planning/phases/05-calendar-sync/05-05-SUMMARY.md

Commits verified: 3e63625, 19dbdb0 present in backend git log
