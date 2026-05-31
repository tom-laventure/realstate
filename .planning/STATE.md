---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Board Registrations Nav Separation
status: ready_to_plan
stopped_at: Roadmap created — Phase 25 defined
last_updated: "2026-05-31T12:00:00Z"
last_activity: 2026-05-31 -- Roadmap created for v1.7
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-31)

**Core value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.
**Current focus:** v1.7 — Board Registrations Nav Separation (Phase 25)

## Current Position

Phase: 25 of 25 (Board Registrations Nav Separation)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-05-31 — Roadmap created; Phase 25 defined with 7 requirements

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (this milestone)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 18: `AdminDomainShell` delegates to `PortalAdminShell` (main domain) or `AppShellAdmin` (subdomain) — both sidebars must be updated for Phase 25
- Phase 14: `BoardRegistrations` table lives inside `BrokerageAdminBoard` container — Phase 25 extracts it into a new `BoardsAdminBoard` container

### Pending Todos

None.

### Blockers/Concerns

None.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Auth | Apple / Microsoft social login | v2 | Requirements |
| Calendar | Two-way calendar sync | v2 | Requirements |
| Security | JWT → HttpOnly cookies migration | v2 | Requirements |
| Frontend | Redux → Context/TanStack Query migration | v2 | Requirements |
| CAL-04 | Microsoft Calendar sync | Adapter built; activate by expanding PROVIDERS | v1.0 close |
| CAL-05 | Apple CalDAV sync | Adapter built; activate by expanding PROVIDERS | v1.0 close |
| CR-02 | S3 favicon upload outside transaction | Pre-existing; carry to v1.8 | v1.1 close |
| UX | Brokerage switch preserving active tab position | Carry to v1.8 | v1.4 close |
| UX | Deep-link into admin panel with brokerage context preserved | Carry to v1.8 | v1.4 close |
| Architecture | Rethink listing access model — BrokerageEstate vs board credential JOIN | Carry to v1.8 | v1.6 close |

## Session Continuity

Stopped at: Roadmap created — ready to plan Phase 25
Next action: `/gsd-plan-phase 25` — plan the implementation
Last session: 2026-05-31 — Roadmap written for v1.7 (Board Registrations Nav Separation)
