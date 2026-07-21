---
phase: 37-free-tier-gating
verified: 2026-07-21T04:58:46Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Load a Free-tier brokerage's Board Registrations page (/admin/boards) and confirm the FreeTierBanner renders cleanly in context (no clipping/overflow, spacing matches surrounding cards)"
    expected: "Blue info-notice banner appears above/around the board list exactly per UI-SPEC, TEST board still shown as connectable"
    why_human: "RTL tests assert DOM presence of FreeTierBanner + copy text, not actual browser rendering, layout fit, or responsive behavior in the real page shell"
  - test: "Open 'Invite New User' area of AddUserToGroupView on a Free-tier brokerage and confirm the banner replaces the invite form without layout jank, and that switching to a paid-tier brokerage restores the form"
    expected: "Banner-only on Free, full invite form on paid, no visual regression to the adjacent 'Add Existing User' form or Members/Invites tabs"
    why_human: "Visual/UX polish (CLAUDE.md 'Frontend Philosophy') and real conditional-render behavior when brokerage context changes are not exercised by the isolated component test"
  - test: "Visit the account Calendar tab as a fully-Free user and as a paid-membership user; confirm heading/intro text stays visible in both states and the banner-vs-grid switch feels intentional, not jarring"
    expected: "Same heading + intro copy in both states; FreeTierBanner on Free, provider-card grid on paid, per UI-SPEC"
    why_human: "Real-time state transition and visual polish across the two branches can't be confirmed from source/tests alone"
  - test: "Visit the Domains admin page as a Free-tier brokerage and confirm the banner appears without a stray/dead 'isPremium' affordance leaking into the UI"
    expected: "Only the customDomainAvailable-gated banner is visible; no visual artifact from the unused isPremium flag (WR-05, informational, not wired to render)"
    why_human: "Confirms in the running app that the known dead-code flag (WR-05) has no visible side effect, since grep alone confirms it's unread but can't confirm nothing else picks it up at runtime"
---

# Phase 37: Free Tier Gating Verification Report

**Phase Goal:** Free-tier brokerages get the full engagement feature set against TEST-board demo data only — real boards, real clients, custom domains, and calendar sync are all walled off — while Independent and Growth remain fully unrestricted.
**Verified:** 2026-07-21T04:58:46Z
**Status:** human_needed
**Re-verification:** No — initial verification (post-merge, post-code-review fixes)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, Phase 37)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On Free, board-connect flow offers only the seeded TEST board — real boards not presented/accepted | ✓ VERIFIED | `backend/app/controllers/v1/admin/boards_controller.rb#index` scopes to `RealEstateBoard.test_boards` unless `plan_config.real_boards`; `board_credentials_controller#create` rejects real-board creds with 403 `plan_required` unless `board.is_test_board?`. `free_tier_board_gate_test.rb` (5 tests) passes, covering Free-restricted and Growth-unrestricted paths. |
| 2 | On Free, client-invite/add-client endpoints reject the request regardless of caller role | ✓ VERIFIED (after CR-01 fix) | `group/invitations_controller.rb#create` gates `role == "client"` behind `plan_config.clients`. **`#update` was originally ungated** — a Free-tier caller could create an `agent` invite then `PATCH` its role to `client`, bypassing the restriction (code review CR-01). Fixed in backend commit `9b26118` (confirmed present at current HEAD, see below), which mirrors the guard into `#update` keyed off the post-update role. `free_tier_invite_gate_test.rb` now has 2 new regression tests (Free → 403, no role change; Growth → succeeds), both pass. `admin_authorization_test.rb`'s previously-misleading PATCH-to-client test was corrected to use a paid plan. |
| 3 | On Free, agent/staff seats are uncapped — no seat-limit block | ✓ VERIFIED | `grep -rn "seat_cap\|seat_limit\|seats_available\|max_seats" app/` shows `seat_cap` exists only as Phase-36 config data, never enforced in any controller. `free_tier_seats_test.rb` (3 tests: 10+ direct membership inserts, 10+ HTTP invitation-accept memberships, and a source-grep assertion for absence of seat-cap wording) all pass. |
| 4 | On Free, no calendar sync entry point in UI or API | ✓ VERIFIED | `google_oauth_controller#authorize` and `connections_controller#create_apple` both gate on `Current.user.any_paid_brokerage_membership?` → 403 `plan_required`. `GET /v1/account/calendar/connections` exposes `calendar_sync_available`. Frontend `CalendarTab.tsx` renders `FreeTierBanner` instead of the provider grid when `calendarSyncAvailable === false`, heading/intro stay visible in both branches. `free_tier_calendar_gate_test.rb` (5 tests) passes. |
| 5 | On Free, brokerages restricted to subdomain — no custom domain | ✓ VERIFIED | `domains_controller.rb#custom` (Phase 36 gate, reused) rejects unless `plan_config.custom_domain`. `free_tier_domain_gate_test.rb` (3 tests: free rejected, independent/growth not rejected) passes. Frontend `DomainCardList.tsx` renders `FreeTierBanner` gated by `customDomainAvailable` from `hasPlanCapability`. |
| 6 | On Free, groups/comments/ratings/likes/documents/RSVP/filter-sets work exactly as paid, against TEST-board listings | ✓ VERIFIED | `free_tier_engagement_test.rb` (4 tests) exercises group creation, filter-set creation/read, and rating a TEST-board estate on a Free brokerage, plus a source-grep test asserting no plan-gating code exists in dashboard/admin/group controllers (excluding `invitations_controller.rb`, the intentional gate). All pass. |
| 7 | On Independent/Growth, none of the above gates apply | ✓ VERIFIED | Every gate test file above includes an explicit paid-tier (`independent` or `growth`) counterpart asserting unrestricted access, and all pass. |

**Score:** 7/7 truths verified

### Post-Merge Code Review Fixes (37-REVIEW.md)

| Finding | Severity | Fix Commit | Verified Present at HEAD | Verified Effective |
|---------|----------|------------|---------------------------|---------------------|
| CR-01: client-invite gate bypassable via `Group::InvitationsController#update` (create an agent invite, then PATCH role to `client`) | Critical | backend `9b26118` | Yes — `backend` gitlink at monorepo HEAD (`git ls-tree HEAD backend`) resolves to `9b26118...`; `update` action in the working tree contains the `new_role`/`plan_config.clients` guard | Yes — new regression tests in `free_tier_invite_gate_test.rb` (PATCH role→client on Free returns 403 + role unchanged; PATCH role→client on Growth succeeds) pass; corrected `admin_authorization_test.rb` case (now uses `growth` plan) passes; full `admin_authorization_test.rb` (61 tests) + `free_tier_invite_gate_test.rb` (6 tests) run green (67/67) |
| WR-01: `useFetchCalendarConnections` fails open (`?? true`) on loading/error instead of fail-closed | Warning | frontend `a5a84a9` | Yes — `frontend` gitlink at monorepo HEAD resolves to `a5a84a9...`; `calendarSyncAvailable: data?.calendarSyncAvailable ?? false` confirmed in working tree | Yes — existing `CalendarTab.test.tsx` + `planPermissions`/`FreeTierBanner` suite (18 tests across 6 files) pass; behavior now fails closed (banner shown) rather than open (grid shown) when data is undefined |

Monorepo gitlink bump commits `f79787b` (backend) and `642d197` (frontend) are present in the monorepo history and correspond to the current checked-out submodule commits — not stale references.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/controllers/v1/admin/boards_controller.rb` | Plan-aware board list filtering | ✓ VERIFIED | Contains `plan_config.real_boards` scope filter, wired, tested |
| `backend/app/controllers/v1/admin/board_credentials_controller.rb` | Real-board create reject for Free | ✓ VERIFIED | Contains `plan_required` 403 guard on `#create`; `#update` correctly does not permit board reassignment (D-10), so no equivalent bypass surface exists there |
| `backend/app/controllers/v1/admin/group/invitations_controller.rb` | Client-invite reject for Free | ✓ VERIFIED | `#create` and `#update` (post-fix) both gate `role == "client"` |
| `backend/app/models/user.rb` | Cross-brokerage paid-membership predicate | ✓ VERIFIED | `any_paid_brokerage_membership?` uses single indexed `.where(plan:).exists?` query, scoped `.without_deleted` |
| `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb` | Calendar authorize gate | ✓ VERIFIED | `plan_required` guard at top of `#authorize` |
| `backend/app/controllers/v1/account/calendar/connections_controller.rb` | Apple-connect gate + `calendar_sync_available` | ✓ VERIFIED | Both present; `#index` returns `calendar_sync_available` |
| `backend/test/integration/free_tier_board_gate_test.rb` | Board gate coverage | ✓ VERIFIED | 5 tests, passing |
| `backend/test/integration/free_tier_invite_gate_test.rb` | Client-invite gate coverage | ✓ VERIFIED | 6 tests (incl. 2 post-fix regressions), passing |
| `backend/test/integration/free_tier_calendar_gate_test.rb` | Calendar gate coverage | ✓ VERIFIED | 5 tests, passing |
| `backend/test/integration/free_tier_domain_gate_test.rb` | Domain gate + paid-unrestricted | ✓ VERIFIED | 3 tests, passing |
| `backend/test/integration/free_tier_seats_test.rb` | Uncapped-seats regression | ✓ VERIFIED | 3 tests, passing |
| `backend/test/integration/free_tier_engagement_test.rb` | Engagement-unchanged regression | ✓ VERIFIED | 4 tests, passing |
| `backend/test/models/user_paid_membership_test.rb` | Model-level predicate coverage | ✓ VERIFIED | Present, part of green full-suite run |
| `frontend/src/assets/rbac/planPermissions.ts` | `hasPlanCapability` helper | ✓ VERIFIED | Pure lookup mirroring backend `PLAN_TIERS`, no inline `plan === 'free'` comparisons in gated surfaces |
| `frontend/src/components/common/FreeTierBanner.tsx` | Shared info-notice banner | ✓ VERIFIED | Matches UI-SPEC classes verbatim (colors, spacing, icon, typography), no CTA/link |
| `frontend/src/containers/adminBoard/boardsAdminBoard/useBoardsAdminContext.ts` + `BoardRegistrations.tsx` | Board banner wiring | ✓ VERIFIED | `hasPlanCapability` in container, boolean prop threaded to pure component, `FreeTierBanner` rendered when `!realBoardsAvailable` |
| `useAddUsersToGroupContext.tsx` + `AddUserToGroupView.tsx` | Client-invite form hidden on Free | ✓ VERIFIED | Invite form entirely replaced by `FreeTierBanner` (not disabled) when `!clientsAvailable`; "Add Existing User" form untouched |
| `useDomainsAdminContext.ts` + `DomainCardList.tsx` | Domains banner wiring | ✓ VERIFIED | `customDomainAvailable` correctly used by `DomainCardList`; unused `isPremium` dead-code flag noted (WR-05, not wired to any render path — informational only) |
| `CalendarContext.tsx` + `CalendarTab.tsx` | Calendar banner-vs-grid | ✓ VERIFIED | Reads `calendarSyncAvailable` from backend, heading/intro stay visible in both branches, banner replaces provider grid |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `boards_controller.rb` | `RealEstateBoard.test_boards` | scope filter when `!plan_config.real_boards` | WIRED | Confirmed in source |
| `group/invitations_controller.rb#create` | `Current.brokerage.plan_config.clients` | guard on `role == "client"` | WIRED | Confirmed |
| `group/invitations_controller.rb#update` | `Current.brokerage.plan_config.clients` | guard on post-update `role == "client"` | WIRED (post-fix) | Confirmed present, backed by 2 new regression tests |
| `google_oauth_controller.rb#authorize` | `Current.user.any_paid_brokerage_membership?` | guard clause | WIRED | Confirmed |
| `user.rb` | `brokerages.without_deleted.where(plan:)` | single indexed SQL `.exists?` | WIRED | Confirmed, matches required shape exactly |
| 3 container hooks | `hasPlanCapability(brokerage?.plan, capability)` | resolved in container, boolean state | WIRED | Confirmed in all three (`useBoardsAdminContext`, `useAddUsersToGroupContext`, `useDomainsAdminContext`) |
| 3 pure components | capability boolean prop | prop consumption only, no hook calls | WIRED | Confirmed — `BoardRegistrations`, `AddUserToGroupView`, `DomainCardList` all receive props, no `useFetchBrokerage`/`hasPlanCapability` imports in these files |
| `CalendarTab.tsx` | `state.calendarSyncAvailable` | conditional replacing provider grid | WIRED | Confirmed |
| `useFetchCalendarConnections.ts` | `GET /v1/account/calendar/connections` `calendar_sync_available` | response field threaded through hook | WIRED, fail-closed (post-fix) | Confirmed `?? false` default present |

### Behavioral Spot-Checks (Test Suite Execution)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend invite-gate + admin-authorization regression | `bundle exec rails test test/integration/free_tier_invite_gate_test.rb test/integration/admin_authorization_test.rb` | 67 runs, 104 assertions, 0 failures, 0 errors | ✓ PASS |
| Backend board/calendar/domain/engagement/seats/model regression | `bundle exec rails test test/integration/free_tier_board_gate_test.rb test/integration/free_tier_calendar_gate_test.rb test/integration/free_tier_domain_gate_test.rb test/integration/free_tier_engagement_test.rb test/integration/free_tier_seats_test.rb test/models/user_paid_membership_test.rb` | 25 runs, 82 assertions, 0 failures, 0 errors | ✓ PASS |
| Frontend plan-permissions/banner/calendar/board/domain/invite RTL suite | `npx vitest run` (6 phase-37 test files) | 6 test files, 18 tests, all passed | ✓ PASS |
| Debt-marker scan on all phase-37-modified source files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` | No matches | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention or explicit probe declarations found in this phase's PLAN/SUMMARY files. SKIPPED (no probes applicable — this is a controller/UI gating phase verified via the integration/RTL test suites above, run directly by the verifier).

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| PLAN-04 | 37-01, 37-04, 37-05 | Free-tier brokerages can only connect the seeded TEST board | ✓ SATISFIED | `boards_controller`, `board_credentials_controller`, `BoardRegistrations.tsx` |
| PLAN-05 | 37-01, 37-04, 37-05 | Free-tier brokerages cannot invite/add clients to any group | ✓ SATISFIED (post CR-01 fix) | `invitations_controller#create` + `#update`, `AddUserToGroupView.tsx` |
| PLAN-06 | 37-03 | Free-tier brokerages have unlimited agent/staff seats | ✓ SATISFIED | `free_tier_seats_test.rb`, source-grep confirms no seat-cap enforcement |
| PLAN-07 | 37-02, 37-04, 37-06 | Free-tier brokerages have no calendar sync access | ✓ SATISFIED (post WR-01 fix) | `google_oauth_controller`, `connections_controller`, `CalendarTab.tsx` |
| PLAN-08 | 37-03, 37-04, 37-05 | Free-tier brokerages restricted to subdomain, no custom domain | ✓ SATISFIED | `domains_controller#custom` (Phase 36 gate, reused), `DomainCardList.tsx` |
| PLAN-09 | 37-03 | All other engagement features fully available on Free | ✓ SATISFIED | `free_tier_engagement_test.rb` + source-grep for absence of gating |
| PLAN-12 | 37-01, 37-02, 37-03 | Independent/Growth permit unrestricted real boards, clients, custom domain, calendar sync | ✓ SATISFIED | Paid-tier counterpart assertions in every gate test file, all passing |

No orphaned requirements — REQUIREMENTS.md maps exactly these 7 IDs to Phase 37, and all 7 appear in at least one plan's `requirements` frontmatter.

**Informational note:** `.planning/REQUIREMENTS.md`'s top-of-file checkbox list still shows PLAN-04 through PLAN-12 as unchecked (`- [ ]`), and the tracking table still reads "Not started," even though `ROADMAP.md` already marks Phase 37 `[x]` complete (2026-07-21) and all 6 plans `[x]`. This is a documentation-sync gap in the close-phase bookkeeping, not a code/behavior gap — no action needed for goal achievement, but the checkboxes should be flipped as part of closing this phase.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no empty handlers, no stub returns, and no hardcoded-empty data flowing to render in any of the 16 phase-37-modified source files reviewed. The one dead-code item (`isPremium` in `useDomainsAdminContext.ts`, WR-05 from the code review) is present but confirmed unread by any consumer — informational only, does not affect the phase goal or any must-have.

### Human Verification Required

See frontmatter `human_verification` — 4 items covering in-context visual rendering of the four new `FreeTierBanner` surfaces (Board Registrations, client-invite form, Domains, Calendar tab) in the running application. Source-level and RTL-level checks are exhaustively verified above; these items confirm actual browser rendering, layout fit, and transition feel per CLAUDE.md's frontend design-quality bar, which cannot be confirmed by grep or headless component tests alone.

### Gaps Summary

No blocking gaps. All 7 ROADMAP success criteria are verified true in the codebase, all plan-level must-haves (artifacts, key links, truths) across all 6 plans check out, and both post-merge code review fixes (CR-01 critical, WR-01 warning) are confirmed present in the working tree at the current gitlinked commits and are backed by passing regression tests. Status is `human_needed` solely because this phase introduces four new user-visible UI surfaces that warrant an in-browser visual confirmation pass per this project's frontend design-quality standard — not because any must-have failed.

---

_Verified: 2026-07-21T04:58:46Z_
_Verifier: Claude (gsd-verifier)_
