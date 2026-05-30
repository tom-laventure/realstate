---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: Domain Management v2
status: ready
last_updated: "2026-05-30T00:00:00.000Z"
last_activity: 2026-05-30
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-30)

**Core value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.
**Current focus:** v1.6 — Domain Management v2

## Current Position

Phase: 22 — DNS Verification & Health Monitoring Backend (not started)
Plan: —
Status: Roadmap created; ready for Phase 22 planning
Last activity: 2026-05-30 — Roadmap created

```
Progress: [                              ] 0% (0/3 phases)
```

## Phase Summary

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 22 | DNS Verification & Health Monitoring Backend | 14 | Not started |
| 23 | 301 Redirect & Primary Domain Enforcement | 3 | Not started |
| 24 | Domain UI Overhaul | 17 | Not started |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Auth | Apple / Microsoft social login | v2 | Requirements |
| Calendar | Two-way calendar sync | v2 | Requirements |
| Security | JWT → HttpOnly cookies migration | v2 | Requirements |
| Frontend | Redux → Context/TanStack Query migration | v2 | Requirements |
| CAL-04 | Microsoft Calendar sync | Adapter built; activate by expanding PROVIDERS | v1.0 close |
| CAL-05 | Apple CalDAV sync | Adapter built; activate by expanding PROVIDERS | v1.0 close |
| CR-02 | S3 favicon upload outside transaction | Pre-existing; carry to v1.7 | v1.1 close |
| UX | Brokerage switch preserving active tab position | Carry to v1.7 | v1.4 close |
| UX | Deep-link into admin panel with brokerage context preserved | Carry to v1.7 | v1.4 close |

## Accumulated Context

### Key Constraints for v1.6

- DPRI-04 (301 redirect) must be implemented as Rails Rack middleware (not Caddy config) — Caddy-layer redirect is explicitly listed as out of scope in REQUIREMENTS.md
- DPRD-02 (frozen domain redirect) uses the same Rack middleware path as DPRI-04 — both belong in Phase 23 for clean isolation
- Background jobs run on SolidQueue (DB-backed, no Redis) — recurring job scheduling uses SolidQueue's built-in recurring job support
- DVER-05 (first-to-verify wins) requires a database-level lock or atomic check during the verification promotion to prevent race conditions between concurrent verification jobs
- Phase 22 adds `consecutive_failures` counter and `last_checked_at` timestamp columns to `brokerage_domains` — migration required
- Phase 22 adds `frozen` as a new domain status value (in addition to active / phasing_out / decommissioned / pending)
- DADD-04 (7-day auto-remove of unverified domains) is driven by the Phase 22 verification polling job — the job checks `created_at` age and enqueues a day-5 warning email

### Decisions Made

| Decision | Rationale |
|----------|-----------|
| Phase 23 isolated for redirect middleware | 301 redirect affects every HTTP request; isolated phase allows focused testing before UI work in Phase 24 |
| DPRI-01/02 backend constraints in Phase 22 | Pending-verification is a new status introduced in Phase 22; primary eligibility rules must be updated atomically with the status machine |
| DVER-01 (Verify now button) in Phase 24 not Phase 22 | The button enqueues an existing job; the UI trigger belongs with the UI phase; the job implementation belongs in Phase 22 |

## Session Continuity

Next action: `/gsd-plan-phase 22`
