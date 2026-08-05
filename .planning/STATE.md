---
gsd_state_version: 1.0
milestone: v1.15
milestone_name: Real-Board BrokerageEstate Decoupling
status: verifying
stopped_at: Completed 47-05-PLAN.md (final plan of phase 47)
last_updated: "2026-08-05T23:56:17.770Z"
last_activity: 2026-08-05
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-01 after v1.14 milestone close)

**Core value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.
**Current focus:** Phase 47 — Real-board BrokerageEstate decoupling

## Current Position

Phase: 47 (Real-board BrokerageEstate decoupling) — EXECUTING
Plan: 5 of 5
Status: Phase complete — ready for verification
Last activity: 2026-08-05

## Performance Metrics

**Velocity (through v1.10):**

- Total plans completed: 37
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
| 42 | 3 | - | - |
| 44 | 4 | - | - |
| 45 | 2 | - | - |
| 46 | 2 | - | - |

**Recent Trend:**

- Last 5 plans: 10min, 13min, 2min, 20min, 12min (Phase 31 P03 → Phase 32 P04)
- Trend: Stable — no v1.15 plans executed yet

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
| Phase 42 P01 | 6min | 3 tasks | 9 files |
| Phase 42 P02 | 5min | 3 tasks | 10 files |
| Phase 42 P03 | 18min | 2 tasks | 0 files |
| Phase 43 P01 | 2min | 3 tasks | 7 files |
| Phase 43 P02 | 3min | 3 tasks | 5 files |
| Phase 43 P03 | 4min | 2 tasks | 3 files |
| Phase 43 P04 | 12min | 2 tasks | 0 files |
| Phase 44 P01 | 4min | 2 tasks | 4 files |
| Phase 44 P02 | 6min | 2 tasks | 5 files |
| Phase 44 P3 | 8min | 3 tasks | 8 files |
| Phase 44 P04 | 7min | 3 tasks | 0 files |
| Phase 45 P01 | 8min | 3 tasks | 0 files |
| Phase 45 P02 | 7min | 2 tasks | 0 files |
| Phase 46 P01 | 10min | 2 tasks | 1 files |
| Phase 46 P02 | 10min | 2 tasks | 0 files |
| Phase 47 P01 | 2min | 2 tasks | 2 files |
| Phase 47 P02 | 4min | 2 tasks | 2 files |
| Phase 47 P03 | 4min | 2 tasks | 2 files |
| Phase 47 P04 | 6min | 2 tasks | 2 files |
| Phase 47 P05 | 25min | 3 tasks | 3 files |

## Accumulated Context

### Decisions

Full decision log lives in PROJECT.md's Key Decisions table (updated through v1.14 close) and `.planning/RETROSPECTIVE.md`'s v1.14 section. Per-phase implementation-detail decisions from v1.14 (Phases 42-46) are archived in `.planning/milestones/v1.14-ROADMAP.md` and the individual `*-SUMMARY.md` files — no longer duplicated here.

- [Phase 47]: ResyncStalePhotosJob resolves real-board estates via active BrokerageBoardCredential (D-04/D-05/D-06/D-07); DeletionCascadeService comments corrected to reflect post-ARCH-01 reality with zero behavior change (D-08)
- [Phase 47]: Cleanup migration 20260805000000 for redundant real-board BrokerageEstate rows (D-09/D-10/D-11) applied to both dev and test DBs, up-down-up round trip verified
- [Phase 47]: Phase 47 Plan 04: include ActiveJob::TestHelper explicitly in ResyncStalePhotosJobTest — assert_enqueued_with/assert_no_enqueued_jobs not resolvable from bare ActiveSupport::TestCase in this suite
- [Phase 47]: ARCH-06 regression coverage lands in 47-05: real-board connect proven to write zero BrokerageEstate rows (TEST-board unchanged), total_active_listings proven to track Estate.accessible_by exactly across five access-boundary cases, cleanup migration up/down round trip proven per-case with idempotent reversal

### Pending Todos

None open — the one pending todo (`arch-brokerage-listing-access.md`) is now being actively addressed by v1.15 Phase 47 (see Deferred Items below for its prior deferral history).

### Blockers/Concerns

- Frontend environment quirks (pre-existing, unrelated to any specific milestone): `npx tsc --noEmit` fails repo-wide because `tsconfig.json`'s `moduleResolution: "bundler"` requires TypeScript 5+, but the installed `typescript` is `^4.9.4`. Also 2 pre-existing failing tests in `GoogleSignInButton.test.tsx`.
- Pre-existing: `RealEstateBoard(:test_board)` factory trait collides with a live seeded row in the shared test-environment Postgres DB (`DATABASE_URL` leaks into `RAILS_ENV=test`) — unrelated test errors remain in the full suite.
- Deferred, non-blocking (D-04, from v1.14 Phase 45-02): enable the Vercel Web Analytics toggle on the `realstate` project — a one-click follow-up so the `<Analytics />` code shipped in Phase 44 isn't inert.
- Deferred, non-blocking (D-02, from v1.14 Phase 45-02): retrofit an Ignored Build Step onto the `frontend` and `auth-callback` Vercel projects for build-minute hygiene.
- Known-unobserved (from v1.14 Phase 45-02): live `VERCEL_ENV=preview` `noindex` behavior has not yet been observed on a real deployment — every deployment so far has been a production build from `master`. Worth a spot-check on the first genuine preview deployment.
- Apex domain cutover for `realtybase.ca` remains unexecuted by design — the full runbook is at `.planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md`, human-reviewed and ready, but requires manual DNS/Vercel dashboard execution outside agent reach. Includes one required pre-cutover code fix (`google_oauth_controller.rb:77` `FRONTEND_URL` fallback) not yet applied.

## Deferred Items

Items carried forward from v1.11/v1.12/v1.13 milestone close, still unaddressed:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Auth | Apple / Microsoft social login | v2 | Requirements |
| Calendar | Two-way calendar sync | v2 | Requirements |
| Frontend | Redux → Context/TanStack Query migration | v2 | Requirements |
| CAL-04 | Microsoft Calendar sync | Adapter built; activate by expanding PROVIDERS | v1.0 close |
| CAL-05 | Apple CalDAV sync | Adapter built; activate by expanding PROVIDERS | v1.0 close |
| Architecture | Rethink listing access model — BrokerageEstate vs board credential JOIN | In progress — being addressed by v1.15 Phase 47 (open todo `arch-brokerage-listing-access.md`, carried since v1.10, reaffirmed at v1.13/v1.14 close) | v1.10 close, reaffirmed v1.13 + v1.14 close, resolved starting v1.15 |
| CR-02 | S3 favicon upload outside transaction | Pre-existing; carry to v1.15+ | v1.10 close |
| UX | Brokerage switch preserving active tab position | Carry to v1.15+ | v1.10 close |
| UX | Deep-link into admin panel with brokerage context preserved | Carry to v1.15+ | v1.10 close |
| WR-01 | `useUsersAdminContext.tsx`'s `useMemo` missing `groupsQuery`/`invitationsQuery`/`inviteFilter` deps | Currently safe by accident; carry to v1.15+ | v1.10 close (32-04-REVIEW.md) |
| IN-02 | Invitations-gating hook test coverage gap: only `agent`/`admin` tested; missing `owner`, `staff`/`client`, "role not loaded" state | Carry to v1.15+ | v1.10 close (32-04-REVIEW.md) |
| OWN-11 | Audit log of ownership changes (who promoted/demoted whom, when) | Out of scope by design; carry to v1.15+ | v1.11 close |
| OWN-12 | Email notifications on ownership role change | Out of scope by design; carry to v1.15+ | v1.11 close |
| BILL-01 | Full Billing management section on `/admin/settings` | Stubbed placeholder replaced by v1.13's self-service tier-change UI; payment processor integration itself still deferred to v2 | v1.11 close |
| PLAN-20 | Higher-seat tiers above Growth | v2 (v1.12 REQUIREMENTS.md) | v1.12 requirements |
| PLAN-21 | Plan config: code constant → DB-backed model | v2 (v1.12 REQUIREMENTS.md) | v1.12 requirements |
| — | Plan-tier string union duplicated 4x across frontend (`CreateBrokeragePlan`, `PlanTierKey`, `PlanTier`, `PLAN_CAPABILITIES`) with no shared source | Non-blocking; values agree today, no compiler/test enforcement | v1.13 close (milestone integration audit) |
| LAND-09 | Real product screenshots replacing icon+text feature pairs | v2 (v1.14 REQUIREMENTS.md) | v1.14 requirements |
| LAND-10 | Customer testimonials / logos | v2 (v1.14 REQUIREMENTS.md) | v1.14 requirements |
| LAND-11 | UTM/conversion-tracking params on CTA links | v2 (v1.14 REQUIREMENTS.md) | v1.14 requirements |

## Session Continuity

Last session: 2026-08-05T23:56:17.758Z
Stopped at: Completed 47-05-PLAN.md (final plan of phase 47)
Resume file: None
Next action: Run `/gsd:plan-phase 47` to generate the executable plan for Phase 47 (Real-board BrokerageEstate decoupling)

## Operator Next Steps

- Run `/gsd:plan-phase 47` to begin planning Phase 47
