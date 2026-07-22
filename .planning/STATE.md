---
gsd_state_version: 1.0
milestone: v1.12
milestone_name: Plan Tiers & Gating
status: Awaiting next milestone
stopped_at: Phase 39 context gathered
last_updated: "2026-07-22T19:46:37.638Z"
last_activity: 2026-07-22 — Milestone v1.12 completed and archived
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 14
  completed_plans: 14
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-22 after v1.12 milestone close)

**Core value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.
**Current focus:** Milestone complete

## Current Position

Phase: Milestone v1.12 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-07-22 — Milestone v1.12 completed and archived

## Performance Metrics

**Velocity (through v1.10):**

- Total plans completed: 26
- Average duration: ~19 min
- Total execution time: ~2.9 hours

**By Phase (v1.10):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 30 | 2 | 95min | 47.5min |
| 31 | 3 | 32min | 10.7min |
| 32 | 4 | 47min | 11.75min |
| 33 | 3 | - | - |
| 34 | 3 | - | - |
| 35 | 5 | - | - |
| 38 | 5 | - | - |
| 39 | 1 | - | - |

**Recent Trend:**

- Last 5 plans: 10min, 13min, 2min, 20min, 12min (Phase 31 P03 → Phase 32 P04)
- Trend: Stable — no v1.12 plans executed yet

*Updated after each plan completion*
| Phase 33 P01 | 15min | 3 tasks | 3 files |
| Phase 33 P02 | 15min | 3 tasks | 3 files |
| Phase 33 P03 | 2min | 1 tasks | 1 files |
| Phase 34 P01 | 5min | 3 tasks | 9 files |
| Phase 34 P02 | 10min | 3 tasks | 5 files |
| Phase 34 P03 | 5min | 1 tasks | 0 files |
| Phase 36 P01 | 16min | 2 tasks | 4 files |
| Phase 36 P02 | 15min | 3 tasks | 11 files |

## Accumulated Context

### Decisions

Full decision log lives in PROJECT.md's Key Decisions table (updated through v1.12 close). Roadmap-level phase sequencing for v1.12 (see PLAN-TIERS.md and milestones/v1.12-ROADMAP.md Phase Details):

- Phase 36 (config + enum migration) is foundational — every later phase reads from it, nothing in it depends on anything else.
- Phase 37 (Free-tier gating) bundled as one coherent chunk of backend + frontend gating work, including verifying paid tiers stay unrestricted (PLAN-12).
- Phase 38 (upgrade/downgrade lifecycle) depends on both 36 and 37 — freeze/restore must agree with what Free-tier gating treats as "real" vs. "TEST" data; downgrade's freeze and re-upgrade's restore are two halves of one round-trip, kept in a single phase.
- Phase 39 (paid-to-paid) isolated as its own small phase — pure billing recalculation, only needs the config from Phase 36.
- [Phase 36]: plan_tiers.rb must be explicitly required in config/initializers/constants.rb alongside roles.rb — AppConstants is not managed by Zeitwerk once the first file defines the module via require_relative; a second sibling file under app/constants/ would never autoload without the same explicit require
- [Phase 36]: plan_config uses bare .fetch(plan) with no fallback block — Fail loud (KeyError) on unrecognized plan values instead of silently degrading to Free's all-false capability set (D-07)
- [Phase 36]: DMOD-05 test fixture uses plan: "free" (not independent) — independent tier has custom_domain: true per 36-01 config, so free is the only tier that correctly exercises the 403 custom-domain-denial path — Plan's literal basic->independent test substitution would have shipped a test asserting incorrect access-control behavior for the independent paid tier

### Pending Todos

None yet.

### Blockers/Concerns

- Frontend environment quirks (pre-existing, unrelated to any specific milestone): `npx tsc --noEmit` fails repo-wide because `tsconfig.json`'s `moduleResolution: "bundler"` requires TypeScript 5+, but the installed `typescript` is `^4.9.4`. Also 2 pre-existing failing tests in `GoogleSignInButton.test.tsx`.
- Pre-existing: `RealEstateBoard(:test_board)` factory trait collides with a live seeded row in the shared test-environment Postgres DB (`DATABASE_URL` leaks into `RAILS_ENV=test`) — unrelated test errors remain in the full suite.

## Deferred Items

Items carried forward from v1.11 milestone close, plus v1.12 out-of-milestone-scope items:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Auth | Apple / Microsoft social login | v2 | Requirements |
| Calendar | Two-way calendar sync | v2 | Requirements |
| Security | JWT → HttpOnly cookies migration | v2 | Requirements |
| Frontend | Redux → Context/TanStack Query migration | v2 | Requirements |
| CAL-04 | Microsoft Calendar sync | Adapter built; activate by expanding PROVIDERS | v1.0 close |
| CAL-05 | Apple CalDAV sync | Adapter built; activate by expanding PROVIDERS | v1.0 close |
| Architecture | Rethink listing access model — BrokerageEstate vs board credential JOIN | Carry to v1.13; re-acknowledged at v1.12 close (pre-close audit) | v1.10 close |
| CR-02 | S3 favicon upload outside transaction | Pre-existing; carry to v1.13 | v1.10 close |
| UX | Brokerage switch preserving active tab position | Carry to v1.13 | v1.10 close |
| UX | Deep-link into admin panel with brokerage context preserved | Carry to v1.13 | v1.10 close |
| WR-01 | `useUsersAdminContext.tsx`'s `useMemo` missing `groupsQuery`/`invitationsQuery`/`inviteFilter` deps | Currently safe by accident; carry to v1.13 | v1.10 close (32-04-REVIEW.md) |
| IN-02 | Invitations-gating hook test coverage gap: only `agent`/`admin` tested; missing `owner`, `staff`/`client`, "role not loaded" state | Carry to v1.13 | v1.10 close (32-04-REVIEW.md) |
| OWN-11 | Audit log of ownership changes (who promoted/demoted whom, when) | Out of scope by design; carry to v1.13 | v1.11 close |
| OWN-12 | Email notifications on ownership role change | Out of scope by design; carry to v1.13 | v1.11 close |
| BILL-01 | Full Billing management section on `/admin/settings` | Stubbed as TODO placeholder; deferred to v2 (v1.12 REQUIREMENTS.md) | v1.11 close |
| PLAN-20 | Higher-seat tiers above Growth | v2 (v1.12 REQUIREMENTS.md) | v1.12 requirements |
| PLAN-21 | Plan config: code constant → DB-backed model | v2 (v1.12 REQUIREMENTS.md) | v1.12 requirements |

## Session Continuity

Last session: 2026-07-22T08:16:01.904Z
Stopped at: Phase 39 context gathered
Resume file: .planning/phases/39-paid-to-paid-plan-changes/39-CONTEXT.md
Next action: /gsd-discuss-phase 36 or /gsd-plan-phase 36

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
