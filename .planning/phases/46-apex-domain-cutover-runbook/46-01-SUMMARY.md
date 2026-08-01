---
phase: 46-apex-domain-cutover-runbook
plan: 01
subsystem: infra
tags: [vercel, dns, runbook, documentation, apex-domain]

# Dependency graph
requires:
  - phase: 45-vercel-project-setup-preview-verification
    provides: "realstate Vercel project (Root Directory landing/, no custom domain, no Deployment Protection) as the attach-side target for this cutover"
provides:
  - "Complete human-executable apex domain cutover runbook at .planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md"
  - "Named pre-cutover audit findings (google_oauth_controller.rb:77 OAuth fallback, BrokerageDomain status-unscoped audit query, TTL check)"
  - "Detach-from-frontend-then-attach-to-realstate Vercel dashboard sequence with downtime warning"
  - "Post-cutover cache/index/cookie verification section scoped per D-09"
  - "Rollback sequence and findings appendix for future re-verification"
affects: [deploy, apex-domain-cutover-execution]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md
  modified: []

key-decisions:
  - "Runbook split across two atomic commits mirroring the plan's two tasks (Task 1: banner/preconditions/Section 1/Section 2 through line 144; Task 2: Sections 3-4/Rollback/Appendix) even though both were authored in a single pass, so git history reflects task boundaries."
  - "google_oauth_controller.rb:77 fix named as a required pre-cutover action item for the human executor, deliberately NOT applied in this phase — Phase 46 is documentation-only."
  - "Post-cutover verification section strictly scoped to cache/index/cookie concerns (D-09) — Web Analytics toggle and preview-noindex behavior deliberately omitted, word 'noindex' avoided entirely rather than mentioned-to-exclude."

patterns-established: []

requirements-completed: [DEPLOY-03]

# Metrics
duration: ~10min
completed: 2026-08-01
---

# Phase 46 Plan 01: Apex Domain Cutover Runbook Summary

**Wrote a complete 234-line, 8-section human-executable runbook for cutting `realtybase.ca` over from the `frontend` Vercel project to `realstate`, naming the one confirmed backend finding (`google_oauth_controller.rb:77`) with its exact trigger condition and fix, a status-unscoped `BrokerageDomain` production re-check, TTL guidance, a detach-then-attach Vercel sequence, DNS/post-cutover verification, rollback, and a findings-snapshot appendix — with zero DNS, Vercel, database, or source-code changes executed.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-08-01T04:17:43Z
- **Tasks:** 2 (both `type="auto"`, no checkpoints)
- **Files modified:** 1 (new file)

## Accomplishments
- Complete apex domain cutover runbook at `.planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md` covering all eight required top-level sections in correct document order
- Every locked decision D-01 through D-09 from `46-CONTEXT.md` represented in the runbook's content (D-09 as an enforced absence, verified via negative grep)
- All ROADMAP Phase 46 success criteria satisfiable by pointing at a named runbook section
- Zero source files touched — `landing/` and `backend/` both confirmed unmodified

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the runbook with its staleness banner, preconditions, Pre-Cutover Audit, and Vercel Dashboard Steps** - `8cdf1cd` (docs)
2. **Task 2: Append DNS Verification, Post-Cutover Verification, Rollback, and the Findings Appendix** - `b896c12` (docs)

_Note: the file was authored in full during execution but committed in two stages matching the plan's task boundaries — Task 1's commit contains lines 1-144 (banner through end of Section 2), Task 2's commit appends lines 146-234 (Section 3 through the Appendix)._

## Files Created/Modified
- `.planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md` - The complete apex domain cutover runbook: staleness banner, Preconditions & Access Requirements, Section 1 Pre-Cutover Audit (six subsections: stale-apex grep, the OAuth fallback finding, production `BrokerageDomain` re-check, env var confirmation, cleared-files list, TTL check), Section 2 Vercel Dashboard Steps (detach-then-attach sequence, downtime warning, report-back list, warning signs), Section 3 DNS Verification (nameservers-not-registrar clarification, wildcard independence spot-check), Section 4 Post-Cutover Verification (cache/index/cookie checks only, per D-09), Rollback, and Appendix — Findings Snapshot (2026-07-31)

## Decisions Made
- Split the single-pass-authored file into two commits along the plan's Task 1/Task 2 boundary (rewrote the file at the Task 1 line count, committed, then wrote the full file and committed the addition) to preserve atomic per-task commit history even though the Write tool doesn't support partial-file writes natively.
- Verified `google_oauth_controller.rb:77` line number against the live file (confirmed line 77 matches exactly) rather than trusting the CONTEXT.md/RESEARCH.md citation at face value.
- Avoided the literal word "noindex" anywhere in the runbook (not just avoiding mentioning the Web Analytics toggle) to satisfy the D-09 automated negative grep with margin, per the plan's explicit instruction to "avoid the word entirely rather than mentioning it to exclude it."

## Deviations from Plan

None — plan executed exactly as written. Both tasks' automated verify commands (`TASK1_OK`, `TASK2_OK`) passed on first run with no fix-up needed.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. The runbook itself documents preconditions (Vercel dashboard access, production Rails console access, Google Search Console access) for whoever executes the cutover in the future, but that execution is explicitly out of scope for this milestone.

## Next Phase Readiness

DEPLOY-03 is satisfied — the apex domain cutover is fully documented as a manual follow-up, not executed. This is the last plan in Phase 46 and the last phase of the v1.14 Marketing Landing Site milestone's active roadmap. No blockers for milestone close; the runbook itself is the artifact a human will pick up independently, on their own timeline, outside this milestone's execution.

---
*Phase: 46-apex-domain-cutover-runbook*
*Completed: 2026-08-01*

## Self-Check: PASSED

- FOUND: `.planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md`
- FOUND: `.planning/phases/46-apex-domain-cutover-runbook/46-01-SUMMARY.md`
- FOUND: commit `8cdf1cd` (Task 1)
- FOUND: commit `b896c12` (Task 2)
