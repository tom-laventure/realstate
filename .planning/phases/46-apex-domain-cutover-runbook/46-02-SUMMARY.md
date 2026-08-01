---
phase: 46-apex-domain-cutover-runbook
plan: 02
subsystem: infra
tags: [vercel, dns, runbook, verification, apex-domain, human-approved]

# Dependency graph
requires:
  - phase: 46-apex-domain-cutover-runbook
    plan: "01"
    provides: "Complete human-executable apex domain cutover runbook at .planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md"
provides:
  - "Automated proof (SWEEP_OK, zero FAIL lines) that 46-RUNBOOK.md represents all nine locked decisions D-01..D-09 and all four ROADMAP Phase 46 success criteria"
  - "Reusable completeness/scope sweep script (/tmp/46-sweep.sh, not committed) covering structural, content, ordering, negative, and git-state assertions"
  - "ROADMAP-criteria-to-runbook-section traceability table"
  - "Recorded developer sign-off that 46-RUNBOOK.md is executable end to end, closing DEPLOY-03 and Phase 46"
affects: [deploy, apex-domain-cutover-execution]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - "Task 1's sweep found zero gaps on first run against the runbook plan 46-01 already produced — no runbook edits were required, so no Task 1 code-commit exists (nothing changed to stage)."
  - "Sweep script written to /tmp/46-sweep.sh per plan instruction (outside the repo, never committed) rather than the session scratchpad, to match the plan's explicit path requirement."
  - "Task 2 (human sign-off) treated as a genuine, non-automatable checkpoint per this plan's non_autonomous_note and threat T-46-06 — execution halted and waited for the developer's explicit resume-signal rather than self-approving."
  - "Developer reviewed 46-RUNBOOK.md end to end against all eight Task 2 review points and all four ROADMAP Phase 46 criteria, and returned the plan's exact resume-signal, \"approved,\" with no issues raised and no runbook edits requested."

patterns-established: []

requirements-completed: [DEPLOY-03]

# Metrics
duration: ~10min
completed: 2026-08-01
---

# Phase 46 Plan 02: Runbook Verification Sweep + Human Sign-off Summary

**Task 1's automated sweep proved the plan 46-01 runbook satisfies every locked decision D-01 through D-09 and all four ROADMAP Phase 46 success criteria on the first run (zero FAIL lines, zero edits needed); Task 2's developer review confirmed the document is genuinely executable and returned the plan's "approved" resume-signal with no issues raised — closing DEPLOY-03 and Phase 46.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-08-01
- **Tasks:** 2 of 2 complete (Task 1 `type="auto"`; Task 2 `type="checkpoint:human-verify"`, gate `blocking`)
- **Files modified:** 0 source/runbook edits (sweep found no gaps; developer approved with no requested changes)

## Accomplishments

- Wrote `/tmp/46-sweep.sh`, implementing every Group A (structural), Group B (content + ordering + D-09 negative), and Group C (nothing-executed git-state) assertion specified in the plan.
- Ran the sweep: **30/30 assertions PASS, 0 FAIL, final line `SWEEP_OK`.**
- Verified the plan's exact verify command passes: `bash /tmp/46-sweep.sh 2>&1 | tee /dev/stderr | grep -q SWEEP_OK`.
- Confirmed the eight required headings appear in `46-RUNBOOK.md` in strictly ascending line order (1, 7, 18, 118, 146, 157, 209, 222).
- Confirmed `grep -icE 'web analytics|noindex' 46-RUNBOOK.md` returns `0` (D-09 exclusion holds).
- Confirmed Section 2's first `Remove` match (line 125) precedes its first `Add` match (line 127) — detach-then-attach ordering (D-04) holds.
- Confirmed `git status --porcelain -- landing/` and `git -C backend status --porcelain -- app/controllers/v1/account/calendar/google_oauth_controller.rb` are both empty, and the documented OAuth fallback fix was deliberately not applied (`grep -cF` on the exact original string returns `1`).
- Confirmed monorepo-root `git status --porcelain`, after filtering `.planning/` paths and the `backend`/`frontend` gitlink bump entries, is empty.
- Built the four-row ROADMAP-criteria traceability table below.
- Presented Task 2's full eight-point review script plus the four-criteria confirmation to the developer via the `## CHECKPOINT REACHED` message; halted execution rather than self-approving.
- Developer reviewed `46-RUNBOOK.md` end to end against all eight points and all four ROADMAP criteria, and returned "approved" — the plan's exact resume-signal for closing Phase 46, with no issues raised and no runbook edits requested.

## ROADMAP Criteria Traceability

| # | ROADMAP Phase 46 Success Criterion | Satisfying Runbook Section |
|---|---|---|
| 1 | A written runbook lists the DNS changes required to point `realtybase.ca` at the `landing/` Vercel project | Section 3 — DNS Verification (states the change is a Vercel dashboard reassignment, not a registrar edit) plus Section 2 — Vercel Dashboard Steps |
| 2 | The runbook documents the Vercel dashboard steps for assigning the apex domain to the `landing/` project | Section 2 — Vercel Dashboard Steps |
| 3 | The runbook includes an explicit checklist item to audit backend `BrokerageDomain` rows and the CORS allowlist for stale bare-apex references before cutover, plus lowering DNS TTL ahead of time | Section 1.3 (`BrokerageDomain` production re-check), 1.4 (`PORTAL_DOMAIN`/`APP_BASE_DOMAIN` env audit, which covers the CORS allowlist path), 1.5 (confirmed-clear CORS/middleware file list), 1.6 (TTL check) |
| 4 | The runbook is committed to the repo as documentation, with no DNS/domain changes actually executed during this milestone | Git state — Group C sweep assertions all PASS; `46-RUNBOOK.md` is committed (plan 46-01, commits `8cdf1cd`/`b896c12`), no `landing/`, `backend/`, `frontend/`, or database changes made |

## Task Commits

1. **Task 1: Run the runbook completeness and scope sweep** — no runbook-edit commit. The sweep found zero gaps in the plan 46-01 runbook; no edits were made to `46-RUNBOOK.md`, so there was nothing to stage there. `/tmp/46-sweep.sh` lives outside the repo per the plan's explicit instruction and is never committed. Progress was recorded via `2929d8e` (interim SUMMARY.md) and `f05460e` (STATE.md checkpoint-pause update).
2. **Task 2: Human review — is this runbook actually executable?** — no runbook-edit commit; the developer approved with zero requested changes. Sign-off recorded in this SUMMARY.md and STATE.md (see Task Commits at plan close below).

## Files Created/Modified

None. Task 1 required zero runbook edits (already satisfied every assertion on first run); Task 2's developer review requested zero further edits.

## Decisions Made

- No fix-up round was needed in Task 1 — the sweep's "closing gaps" procedure in the plan action was not exercised because zero FAIL lines were produced on the first run.
- Did not treat the automated `SWEEP_OK` result as sufficient to close the plan on its own; Task 2's human checkpoint was executed as a full stop-and-wait per the plan's explicit text and the threat register's T-46-06 mitigation (a second, non-automatable gate on executability).
- Accepted the developer's "approved" resume-signal as recorded confirmation that all eight review points and all four ROADMAP criteria were reviewed and passed, per the coordinator's relay of the developer's response — consistent with the plan's `<resume-signal>` definition ("Type \"approved\" to close Phase 46").

## Deviations from Plan

None — both tasks executed exactly as written. No Rule 1/2/3 auto-fixes were needed at any point; the sweep passed clean on first run and the developer approved without requesting changes.

## Issues Encountered

None.

## Auth Gates

None.

## Human Checkpoint Record

- **Checkpoint:** Task 2, `checkpoint:human-verify`, gate `blocking`.
- **What was reviewed:** `.planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md`, end to end, against the plan's eight review points (Preconditions, Section 1 executability, the OAuth finding at 1.2, Section 2 safety, Section 3 clarity, Section 4 scope, Rollback confidence, the staleness banner) and the four ROADMAP Phase 46 success criteria.
- **Outcome:** Approved. Resume-signal `"approved"` received. No issues raised, no runbook edits requested — the runbook is confirmed executable by the developer who will run the actual cutover.
- **Knowingly-accepted limitations:** None recorded — no issue was raised that required either a fix or an explicit accept-as-is decision.

## Next Phase Readiness

Phase 46 is complete. DEPLOY-03 is satisfied: the apex domain cutover is fully documented as a manual follow-up, verified complete by an automated sweep, and confirmed executable by the developer who will run it — with nothing executed against live DNS, Vercel, or the database during this milestone. This is the last plan in Phase 46 and the last phase of the v1.14 Marketing Landing Site milestone's active roadmap. No blockers remain; the runbook itself is the artifact a human will pick up independently, on their own timeline, outside this milestone's execution.

---
*Phase: 46-apex-domain-cutover-runbook*
*Completed: 2026-08-01*

## Self-Check: PASSED

- FOUND: `.planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md`
- FOUND: `.planning/phases/46-apex-domain-cutover-runbook/46-02-SUMMARY.md`
- VERIFIED: `bash /tmp/46-sweep.sh` printed `SWEEP_OK` with 0 failures (re-confirmed at self-check time)
- FOUND: commit `2929d8e` (interim Task 1 summary)
- FOUND: commit `f05460e` (interim STATE.md checkpoint-pause update)
