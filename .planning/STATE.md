---
gsd_state_version: 1.0
milestone: v1.13
milestone_name: — Onboarding & Self-Service Plan Management
status: completed
stopped_at: Phase 41 Plan 03 complete — Plan section UI components
last_updated: "2026-07-23T07:03:08.218Z"
last_activity: 2026-07-23 -- Phase 41 marked complete
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 8
  completed_plans: 8
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-22 after v1.12 milestone close)

**Core value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.
**Current focus:** Phase 41 — self-service-plan-management

## Current Position

Phase: 41 — COMPLETE
Plan: 4 of 4
Status: Phase 41 complete
Last activity: 2026-07-23 -- Phase 41 marked complete

Progress: [█████████░] 88%

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
- Trend: Stable — no v1.13 plans executed yet

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

Full decision log lives in PROJECT.md's Key Decisions table (updated through v1.12 close). Roadmap-level phase sequencing for v1.13 (see ROADMAP.md Phase Details):

- Phase 40 (onboarding plan alignment) and Phase 41 (self-service plan management) are independent halves of the milestone — the onboarding wizard fix touches only the signup path, while the admin/settings Plan section touches only the post-signup management path. No dependency between them; either could execute first, kept in numeric order for simplicity.
- Phase 40 removes the backend's "Growth requires custom_domain" check entirely (custom domain is optional for both paid tiers per this milestone's requirements definition) rather than relaxing it — this is a deliberate reversal of the v1.12-era assumption.
- Phase 41's new plan-change endpoint is a new brokerage-scoped, owner-gated surface (not the existing internal-only `Ops::PlanController`, which is a `/ops`-namespace testing tool unusable by real brokerage owners) — it enqueues the same `ApplyPlanTransitionJob` cascade already proven in v1.12 Phases 37-39.
- Phase 41 follows the `OwnershipManagementSection`/`useSettingsAdminContext` pattern established in v1.11 for adding a new gated section to `/admin/settings`.
- [Phase 40]: PlanTiersController#index uses a plain hash builder, not ActiveModel::Serializer, since AppConstants::PlanTier is a Struct not an AR model — Matches DomainsController#check precedent for non-AR config-as-endpoint controllers
- [Phase 40]: Deleted only the 3-line growth-requires-custom_domain block in BrokeragesController#create — Kept AppConstants::PLAN_TIERS.key?(plan) validity guard intact per T-40-02 threat mitigation
- [Phase 40]: createBrokerage.ts imports/re-exports CreateBrokeragePlan from the reducer instead of independently re-declaring the union — Single source of truth avoids drift (40-RESEARCH.md Pitfall 1)
- [Phase 40]: submit() gates custom_domain on plan !== 'free' instead of the retired plan === 'premium' literal — Custom domain is now optional for both paid tiers, not required-and-gated on a single retired tier name
- [Phase 40]: PlanCard feature rows follow the plan's literal derivation formula (seat wording, realBoards, clients, customDomain, calendarSync, always-included subdomain) instead of UI-SPEC's slightly different bullet wording — Keeps every bullet traceable to a fetched boolean per D-02's anti-hardcoding intent
- [Phase 40]: Every isPremium occurrence in DomainStep.tsx re-scoped to showCustomDomain = state.plan !== 'free', including the error-attribution line — grep -c isPremium confirmed 0 remaining occurrences
- [Phase 40]: Removed all required-field validation for custom domain; only format/already-registered checks run, and only when a value is present — No tier requires a custom domain to complete signup per D-04/D-05
- [Phase 41]: New V1::Admin::Settings::PlanController mirrors Ops::PlanController's exact validate/no-op/flip/enqueue sequence, scoped to Current.brokerage (never brokerage_id param) — PLAN-24/PLAN-25 require a real, tenant-scoped, owner-gated transition endpoint distinct from the internal Ops testing tool
- [Phase 41]: isPlanError derived exclusively from useFetchBrokerage's own isError, not the pre-existing owners-fetch isError already in useSettingsAdminContext — prevents cross-contamination between unrelated data sources sharing one Brain
- [Phase 41]: PlanTier values kept byte-identical to CreateBrokeragePlan ('free'|'independent'|'growth') to avoid tier-name drift between onboarding and settings — single source of truth prevents string-literal divergence
- [Phase 41]: updatePlan.ts typed to the actual PlanUpdateResponse ({status, brokerageId, oldPlan?, newPlan?, plan?}) instead of BrokerageType — the endpoint renders a status object, not a brokerage record
- [Phase 41]: PlanManagementSection renders the identical PlanSelector for owner and non-owner views, toggling only disabled + a read-only caption (D-04) — no separate text/badge fallback

### Pending Todos

None yet.

### Blockers/Concerns

- Frontend environment quirks (pre-existing, unrelated to any specific milestone): `npx tsc --noEmit` fails repo-wide because `tsconfig.json`'s `moduleResolution: "bundler"` requires TypeScript 5+, but the installed `typescript` is `^4.9.4`. Also 2 pre-existing failing tests in `GoogleSignInButton.test.tsx`.
- Pre-existing: `RealEstateBoard(:test_board)` factory trait collides with a live seeded row in the shared test-environment Postgres DB (`DATABASE_URL` leaks into `RAILS_ENV=test`) — unrelated test errors remain in the full suite.

## Deferred Items

Items carried forward from v1.11/v1.12 milestone close, still unaddressed:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Auth | Apple / Microsoft social login | v2 | Requirements |
| Calendar | Two-way calendar sync | v2 | Requirements |
| Security | JWT → HttpOnly cookies migration | v2 | Requirements |
| Frontend | Redux → Context/TanStack Query migration | v2 | Requirements |
| CAL-04 | Microsoft Calendar sync | Adapter built; activate by expanding PROVIDERS | v1.0 close |
| CAL-05 | Apple CalDAV sync | Adapter built; activate by expanding PROVIDERS | v1.0 close |
| Architecture | Rethink listing access model — BrokerageEstate vs board credential JOIN | Carry to v1.14+; re-acknowledged at v1.12 close (pre-close audit) | v1.10 close |
| CR-02 | S3 favicon upload outside transaction | Pre-existing; carry to v1.14+ | v1.10 close |
| UX | Brokerage switch preserving active tab position | Carry to v1.14+ | v1.10 close |
| UX | Deep-link into admin panel with brokerage context preserved | Carry to v1.14+ | v1.10 close |
| WR-01 | `useUsersAdminContext.tsx`'s `useMemo` missing `groupsQuery`/`invitationsQuery`/`inviteFilter` deps | Currently safe by accident; carry to v1.14+ | v1.10 close (32-04-REVIEW.md) |
| IN-02 | Invitations-gating hook test coverage gap: only `agent`/`admin` tested; missing `owner`, `staff`/`client`, "role not loaded" state | Carry to v1.14+ | v1.10 close (32-04-REVIEW.md) |
| OWN-11 | Audit log of ownership changes (who promoted/demoted whom, when) | Out of scope by design; carry to v1.14+ | v1.11 close |
| OWN-12 | Email notifications on ownership role change | Out of scope by design; carry to v1.14+ | v1.11 close |
| BILL-01 | Full Billing management section on `/admin/settings` | Stubbed as TODO placeholder; deferred to v2 (v1.12 REQUIREMENTS.md) | v1.11 close |
| PLAN-20 | Higher-seat tiers above Growth | v2 (v1.12 REQUIREMENTS.md) | v1.12 requirements |
| PLAN-21 | Plan config: code constant → DB-backed model | v2 (v1.12 REQUIREMENTS.md) | v1.12 requirements |

## Session Continuity

Last session: 2026-07-23T06:42:22.174Z
Stopped at: Phase 41 Plan 03 complete — Plan section UI components
Resume file: .planning/phases/41-self-service-plan-management/41-04-PLAN.md
Next action: /gsd-discuss-phase 40 or /gsd-plan-phase 40

## Operator Next Steps

- Review the roadmap draft (Phases 40-41) and approve, or provide feedback for revision
- Once approved: `/gsd-plan-phase 40`
