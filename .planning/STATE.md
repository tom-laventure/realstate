---
gsd_state_version: 1.0
milestone: v1.14
milestone_name: Marketing Landing Site
status: planning
stopped_at: Phase 42 context gathered
last_updated: "2026-07-30T18:49:00.011Z"
last_activity: 2026-07-30 — Roadmap created for v1.14 (Phases 42–46, 20/20 requirements mapped)
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-26 after v1.13 milestone close)

**Core value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.
**Current focus:** Phase 42 — Scaffold + Stack Setup (v1.14 Marketing Landing Site)

## Current Position

Phase: 42 of 46 (Scaffold + Stack Setup)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-07-30 — Roadmap created for v1.14 (Phases 42–46, 20/20 requirements mapped)

Progress: [░░░░░░░░░░] 0%

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
- Trend: Stable — no v1.14 plans executed yet

*Updated after each plan completion*
| Phase 33 P01 | 15min | 3 tasks | 3 files |
| Phase 33 P02 | 15min | 3 tasks | 3 files |
| Phase 33 P03 | 2min | 1 tasks | 1 files |
| Phase 34 P01 | 5min | 3 tasks | 9 files |
| Phase 34 P02 | 10min | 3 tasks | 5 files |
| Phase 34 P03 | 5min | 1 tasks | 0 files |
| Phase 36 P01 | 16min | 2 tasks | 4 files |
| Phase 36 P02 | 15min | 3 tasks | 11 files |
| Phase 40 P01 | 13min | 2 tasks | 5 files |
| Phase 40 P02 | 9min | 3 tasks | 7 files |
| Phase 40 P03 | 8min | 2 tasks | 3 files |
| Phase 41 P01 | 25min | 2 tasks | 3 files |
| Phase 41 P02 | 12min | 3 tasks | 5 files |
| Phase 41 P03 | 10min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Full decision log lives in PROJECT.md's Key Decisions table (updated through v1.13 close). Roadmap-level phase sequencing for v1.14 (see ROADMAP.md Phase Details):

- Phase numbering continues from v1.13's last phase (41) — v1.14 starts at Phase 42, per continuous-numbering convention.
- Phases are sequenced linearly (42 → 43 → 44 → 45 → 46) rather than the research-suggested parallel-capable content/legal split, because `config.json` sets `granularity: coarse` — content (LAND) and legal (LEGAL) requirements were combined into a single Phase 43 rather than kept as separate phases.
- LAND-07 (Slate color token copy) assigned to Phase 42 (Scaffold), not Phase 43 (Content) — it's infrastructure/styling setup that must exist before any component work, matching research's Phase 1 deliverable list.
- ANALYTICS-01 grouped with SEO (Phase 44) rather than Scaffold (Phase 42) — even though research suggested wiring `<Analytics />` during scaffold, the requirement is only observably true (tracking events, dashboard data) once real pages/CTAs exist, so it's grouped with the other "discoverability/measurability" requirements.
- Phase 45 (Vercel Project Setup) and Phase 46 (Apex Domain Cutover) kept as two fully separate phases per the strongest pitfall finding in research/PITFALLS.md — combining "does the build deploy correctly" with "is the domain live" hides failures until they're expensive to diagnose.
- Phase 46 is scoped as documentation-only per DEPLOY-03 and the milestone's explicit "Out of Scope" entry — no DNS/Vercel domain changes are executed in this milestone, only a written runbook.

### Pending Todos

None open — the one pending todo (`arch-brokerage-listing-access.md`) was acknowledged and deferred; see Deferred Items below.

### Blockers/Concerns

- Frontend environment quirks (pre-existing, unrelated to any specific milestone): `npx tsc --noEmit` fails repo-wide because `tsconfig.json`'s `moduleResolution: "bundler"` requires TypeScript 5+, but the installed `typescript` is `^4.9.4`. Also 2 pre-existing failing tests in `GoogleSignInButton.test.tsx`.
- Pre-existing: `RealEstateBoard(:test_board)` factory trait collides with a live seeded row in the shared test-environment Postgres DB (`DATABASE_URL` leaks into `RAILS_ENV=test`) — unrelated test errors remain in the full suite.
- v1.14-specific (from research/PITFALLS.md, to verify during Phase 46 planning): exact current state of backend `BrokerageDomain` rows / CORS allowlist / `MainDomainOnly` config referencing bare `realtybase.ca` is not yet enumerated — needs first-party investigation when Phase 46 is planned, not assumed from research alone.

## Deferred Items

Items carried forward from v1.11/v1.12/v1.13 milestone close, still unaddressed:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Auth | Apple / Microsoft social login | v2 | Requirements |
| Calendar | Two-way calendar sync | v2 | Requirements |
| Security | JWT → HttpOnly cookies migration | v2 | Requirements |
| Frontend | Redux → Context/TanStack Query migration | v2 | Requirements |
| CAL-04 | Microsoft Calendar sync | Adapter built; activate by expanding PROVIDERS | v1.0 close |
| CAL-05 | Apple CalDAV sync | Adapter built; activate by expanding PROVIDERS | v1.0 close |
| Architecture | Rethink listing access model — BrokerageEstate vs board credential JOIN | Carry to v1.14+; acknowledged again at v1.13 close (open todo `arch-brokerage-listing-access.md`, unrelated to v1.13 scope) | v1.10 close |
| CR-02 | S3 favicon upload outside transaction | Pre-existing; carry to v1.14+ | v1.10 close |
| UX | Brokerage switch preserving active tab position | Carry to v1.14+ | v1.10 close |
| UX | Deep-link into admin panel with brokerage context preserved | Carry to v1.14+ | v1.10 close |
| WR-01 | `useUsersAdminContext.tsx`'s `useMemo` missing `groupsQuery`/`invitationsQuery`/`inviteFilter` deps | Currently safe by accident; carry to v1.14+ | v1.10 close (32-04-REVIEW.md) |
| IN-02 | Invitations-gating hook test coverage gap: only `agent`/`admin` tested; missing `owner`, `staff`/`client`, "role not loaded" state | Carry to v1.14+ | v1.10 close (32-04-REVIEW.md) |
| OWN-11 | Audit log of ownership changes (who promoted/demoted whom, when) | Out of scope by design; carry to v1.14+ | v1.11 close |
| OWN-12 | Email notifications on ownership role change | Out of scope by design; carry to v1.14+ | v1.11 close |
| BILL-01 | Full Billing management section on `/admin/settings` | Stubbed placeholder replaced by v1.13's self-service tier-change UI; payment processor integration itself still deferred to v2 | v1.11 close |
| PLAN-20 | Higher-seat tiers above Growth | v2 (v1.12 REQUIREMENTS.md) | v1.12 requirements |
| PLAN-21 | Plan config: code constant → DB-backed model | v2 (v1.12 REQUIREMENTS.md) | v1.12 requirements |
| — | Plan-tier string union duplicated 4x across frontend (`CreateBrokeragePlan`, `PlanTierKey`, `PlanTier`, `PLAN_CAPABILITIES`) with no shared source | Non-blocking; values agree today, no compiler/test enforcement | v1.13 close (milestone integration audit) |
| LAND-09 | Real product screenshots replacing icon+text feature pairs | v2 (v1.14 REQUIREMENTS.md) | v1.14 requirements |
| LAND-10 | Customer testimonials / logos | v2 (v1.14 REQUIREMENTS.md) | v1.14 requirements |
| LAND-11 | UTM/conversion-tracking params on CTA links | v2 (v1.14 REQUIREMENTS.md) | v1.14 requirements |

## Session Continuity

Last session: 2026-07-30T18:48:59.992Z
Stopped at: Phase 42 context gathered
Resume file: .planning/phases/42-scaffold-stack-setup/42-CONTEXT.md
Next action: Review roadmap, then /gsd-discuss-phase 42 or /gsd-plan-phase 42

## Operator Next Steps

- Approve roadmap, then start Phase 42 with /gsd-discuss-phase 42 or /gsd-plan-phase 42
