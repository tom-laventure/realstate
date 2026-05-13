# Phase 5: Calendar Sync - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 05-calendar-sync
**Areas discussed:** Event ID storage, Timezone handling, Settings UI placement, Sync trigger point

---

## Event ID Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Join table `estate_date_calendar_events` | Per (estate_date, user, provider) row with external_event_id, status, last_synced_at. Clean per-user lookup, no EstateDate schema change, handles multi-user naturally. | ✓ |
| Columns on EstateDate | `google_event_id`, `microsoft_event_id`, `apple_event_id` columns. Simple but doesn't handle multiple users syncing the same event. | |

**User's choice:** Join table
**Notes:** Table tracks sync state per row (status + last_synced_at), not just the ID mapping.

---

## Timezone Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Add `timezone` column to `estate_dates` | Per-event timezone, accurate, requires UI change at event creation. | |
| Derive from brokerage settings | Add `timezone` to `brokerages` table; all events in a brokerage share one timezone. | ✓ |
| Default to UTC | No migration, events land at UTC times. Confusing for non-UTC users. | |

**User's choice:** Brokerage-level timezone
**Notes:** Migration adds `timezone` string column to `brokerages` (default: 'UTC'). No settings UI in this phase — that's deferred.

---

## Settings UI Placement

| Option | Description | Selected |
|--------|-------------|----------|
| New tab in existing Account page | Calendar tab alongside profile/groups in Account.tsx. Reuses account shell. | ✓ |
| Separate route `/account/calendar` | Dedicated page, easy to deep-link. New route in account router. | |
| Inline section below groups | Collapsible section in current Account page. Simpler but may feel buried. | |

**User's choice:** New tab in Account page
**Notes:** 3 vertical cards, one per provider. Each card: provider name, status badge, last sync time, Connect/Disconnect button, Re-sync button on error.

---

## Sync Trigger Point

| Option | Description | Selected |
|--------|-------------|----------|
| Controller-level enqueue | After create/update/destroy in EstateDatesController. Matches FanoutNotificationsJob pattern. Explicit, traceable. | ✓ |
| Model `after_commit` callbacks | Decoupled but fires on seeds/console; model shouldn't depend on external calendar services. | |

**User's choice:** Controller-level enqueue
**Notes:** One job per (user, provider, estate_date, action). `CalendarSyncJob.perform_later(user_id:, provider:, estate_date_id:, action:)`. Controller fans out to all connected users before returning HTTP response.

---

## Claude's Discretion

- Advisory lock implementation for concurrent token refresh serialization
- Exact provider event ID derivation formula
- CalDAV library choice for Apple
- Google/Microsoft OAuth2 client gem choice
- Exact credential column layout in `user_calendar_connections`
- Re-sync sweep scope (decided: full future events for the user/provider)

## Deferred Ideas

- Brokerage timezone editing UI — column added but no settings screen; future admin settings phase
- Two-way calendar sync — v2 per REQUIREMENTS.md
- "Connect Google from profile settings" for existing email/password users — v2 per REQUIREMENTS.md
