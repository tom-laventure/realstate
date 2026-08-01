---
phase: 45-vercel-project-setup-preview-verification
plan: 02
subsystem: infra
tags: [vercel, astro, deployment, ci-cd, settings-sweep]

# Dependency graph
requires:
  - phase: 45-01
    provides: "Live Vercel project 'realstate' (Root Directory landing) with build-log and live-HTTP verification already proven"
  - phase: 44-seo-basics-analytics
    provides: "VERCEL_ENV-driven noindex matrix, whose live firing depends on the System Environment Variables checkbox this plan confirms"
provides:
  - "All six in-scope project settings (Ignored Build Step, System Environment Variables, Node version, Domains, Deployment Protection, Web Analytics) recorded against their required states"
  - "Human click-through confirmation that both live CTAs navigate cross-origin to app.realtybase.ca/create and app.realtybase.ca/auth/login"
  - "Four-criteria DEPLOY-02 roll-up closing the requirement, with named plan/task evidence per criterion"
  - "Empirical answer to RESEARCH.md Open Question 1: the Ignored Build Step dropdown preset IS available on this account's plan tier"
affects: [46-apex-domain-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - "Ignored Build Step set via the preferred dropdown preset (\"Only build if there are changes in a folder that you specify\" = landing), not the Custom-command fallback — empirically answers RESEARCH.md Open Question 1: the preset is available on this account's plan tier, so the shallow-clone HEAD^ edge case does not apply here"
  - "System Environment Variables checkbox confirmed checked with an empty variables list — closes Phase 44's carry-forward with a positive dashboard confirmation, not an assumption"
  - "Node.js Version reported as 24.x, satisfying landing/package.json's >=22.12.0 floor and landing/.nvmrc's 22.12.0 pin"
  - "Domains list confirmed to contain only the auto-assigned *.vercel.app entry — closes 45-01's open Known Issue about www.realtybase.ca (developer confirmed it was removed prior to this checkpoint)"
  - "Deployment Protection off (D-03) and Web Analytics off (D-04, untouched) both confirmed as required"
  - "DEPLOY-02 criterion 4 upgraded from 'href present' (45-01, static HTML) to 'browser navigated' (45-02, human address-bar confirmation) — the only check curl could not perform"

patterns-established: []

requirements-completed: [DEPLOY-02]

# Metrics
duration: 7min
completed: 2026-07-31
---

# Phase 45 Plan 02: Vercel Project Settings Sweep + DEPLOY-02 Roll-up Summary

**All six in-scope Vercel project settings confirmed correct, both live CTAs human-verified to navigate cross-origin, and DEPLOY-02 closed with a four-criteria roll-up citing named evidence from across both plans in this phase.**

## Performance

- **Duration:** 7 min (Task 2 automated re-verification + roll-up; Task 1 was a human checkpoint resolved via developer report)
- **Started:** 2026-07-31 (Task 1 checkpoint), resumed same day for Task 2
- **Completed:** 2026-07-31
- **Tasks:** 2/2 (Task 1: checkpoint:human-action, Task 2: auto)
- **Files modified:** 0 (verification/settings-only plan; zero source files touched, per `<no_source_changes>`)

## Accomplishments
- Developer completed the full project settings sweep on the `realstate` Vercel project (Ignored Build Step, System Environment Variables, Node.js Version, Domains, Deployment Protection, Web Analytics) and reported every value back.
- Developer clicked both live CTAs in a real browser and confirmed via the address bar that "Get Started" lands on `https://app.realtybase.ca/create` and "Log in" lands on `https://app.realtybase.ca/auth/login`.
- Re-ran the live deployment re-verification after the settings changes: HTTP 200, Astro `generator` tag, `RealtyBase` title, CRA negative controls absent, CTA `href` counts still 4/2 (extracted live from `landing/src/consts.ts`), `robots.txt` still serving the correct `Sitemap:` directive.
- Closed Phase 44's "Enable access to System Environment Variables" carry-forward with a positive dashboard confirmation.
- Closed 45-01's open Known Issue: the Domains list is confirmed clean (only `*.vercel.app`), so `www.realtybase.ca` was in fact removed and Phase 46 can assume a domain-free starting state.
- Produced the four-criteria DEPLOY-02 roll-up, closing the requirement.

## Task Commits

This plan is settings/verification-only (`files_modified: []`); Tasks 1 and 2 produced no source-file changes, so no per-task commits were made.

1. **Task 1: Developer completes the project settings sweep and clicks the live CTAs** - checkpoint resolved via developer report (no commit; dashboard + browser action only)
2. **Task 2: Re-verify the live deploy after settings changes and roll up all four DEPLOY-02 criteria** - verification only, no source diff

**Plan metadata:** (this commit, immediately following) `docs(45-02): complete Vercel project settings sweep and close DEPLOY-02`

## Files Created/Modified
None. This plan modifies zero source files by design (`<no_source_changes>` in 45-02-PLAN.md). Only `.planning/` documentation (this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md) changes.

## Verification Evidence

### Live re-verification (post-settings-change)
`PREVIEW_URL=https://realstate-flax-five.vercel.app`

| Assertion | Result |
|---|---|
| `GET /` status | 200 |
| `<meta name="generator" content="Astro` | present |
| `<title>RealtyBase` | present |
| `<div id="root"></div>` (CRA negative control) | absent |
| `create-react-app` (CRA negative control) | absent |
| `href="https://app.realtybase.ca/create"` count | 4 |
| `href="https://app.realtybase.ca/auth/login"` count | 2 |
| `/robots.txt` status | 200, contains `Sitemap: https://realtybase.ca/sitemap-index.xml` |
| `git status --short landing/` | empty |

CTA URLs extracted live from `landing/src/consts.ts` (`getStarted`/`login`), not hardcoded. All settings changes made in Task 1 (which can trigger a redeploy) left the live deployment intact — no regression from the settings sweep.

### Node.js Version floor check
- `landing/package.json`: `"engines": { "node": ">=22.12.0" }`
- `landing/.nvmrc`: `22.12.0`
- Developer-reported dashboard value: **`24.x`**
- **Result:** starts with `24.`, satisfies the `>=22.12.0` floor.

### Six project settings — reported value vs. required state

| Setting | Required state | Developer-reported value | Match |
|---|---|---|---|
| Ignored Build Step | Scoped to `landing/` via folder preset or Custom fallback | Dropdown preset **"Only build if there are changes in a folder that you specify"**, value `landing` | Yes — preferred form used |
| System Environment Variables | "Enable access..." checkbox checked | Checked | Yes |
| Environment Variables list | Empty | Empty (confirmed) | Yes |
| Node.js Version | `22.x` or `24.x` | `24.x` | Yes |
| Domains | Only `*.vercel.app`, no custom domain | Only the auto-assigned `*.vercel.app` domain listed | Yes |
| Deployment Protection | Off | Off | Yes |
| Web Analytics | Off (D-04, untouched) | Off | Yes |

**Ignored Build Step form used:** the preferred dropdown preset, not the Custom-command fallback. This **empirically answers RESEARCH.md Open Question 1 / Assumption A2**: the folder-scoped preset IS available on this account's plan tier. The documented shallow-clone `HEAD^` edge case (which only applies to the Custom-command fallback) does not apply here and can be dropped from future runbooks for this project — though it should be re-checked if a different account/tier is ever used.

### Ignored Build Step behavioural evidence

The developer answered "confirmed" to the optional Deployments-list observation (step 8) without further detail. Per instruction, this is **not** treated as a positive sighting of a skipped/canceled build for a non-`landing` commit — no such specific observation was reported. Recording it honestly as: **not yet observed**. The exact signal to look for next time a non-`landing` commit is pushed: a **Deployments-list entry for that commit marked skipped/canceled** rather than triggering a fresh build. This should be checked opportunistically on the next `.planning/`-only or `backend/`/`frontend/`-only push.

### CTA click-through (human, address-bar confirmed)

| CTA | Destination (address bar) | Match expected |
|---|---|---|
| "Get Started" | `https://app.realtybase.ca/create` | Yes |
| "Log in" | `https://app.realtybase.ca/auth/login` | Yes |

This is the one check curl cannot perform — it proves the link *navigates*, not merely that the `href` attribute exists in the served HTML (which 45-01 already proved).

## DEPLOY-02 Roll-up — All Four ROADMAP Criteria

| # | Criterion | Evidence | Proven by |
|---|---|---|---|
| 1 | A new Vercel project exists with Root Directory explicitly set to `landing/`, distinct from `frontend`/`auth-callback` | Developer created project `realstate`, set Root Directory to `landing`, reported at Settings → General; breadcrumb-checked distinct from `frontend`/`auth-callback` throughout the Task 1 settings sweep | 45-01 Task 2; re-confirmed 45-02 Task 1 |
| 2 | The project's build log shows Astro build output, confirming it built `landing/` and not another project's code | Build log SHA `e723e3b` exact match to pushed commit; Astro markers present (`[build] output: "static"`, `[vite] built in ...`); CRA/Amplify negative markers all absent | 45-01 Task 3 |
| 3 | The deployed `*.vercel.app` preview URL renders the actual landing page content (hero, nav, footer) when visited | Live HTTP 200, Astro `generator` tag, `RealtyBase` title, hero copy, `<nav`/`<footer` all present; CRA negative controls absent — re-confirmed intact after every settings change in this plan | 45-01 Task 3; re-confirmed 45-02 Task 2 |
| 4 | CTA links on the live preview deployment correctly navigate cross-origin to `app.realtybase.ca/create` and `app.realtybase.ca/auth/login` | Served `href` counts (4 create / 2 login) confirmed live from HTML **plus** human browser click-through with verbatim address-bar confirmation of both destinations — upgrades "link exists" to "link navigates" | 45-01 Task 3 (href counts); 45-02 Task 1 (human click-through) |

**DEPLOY-02: Complete.** All four criteria independently proven with named evidence across both plans in this phase.

## Carry-forwards recorded

- **Closed:** Phase 44's "Enable access to System Environment Variables" carry-forward — positively confirmed checked in the dashboard (44-04-SUMMARY.md recorded this as an open Phase 45 checklist item; now closed).
- **Closed:** 45-01's open Known Issue about `www.realtybase.ca` — Domains list re-confirmed clean, only the auto-assigned `*.vercel.app` domain present.
- **Open, deferred (D-04):** Enable the Vercel Web Analytics toggle on this project — a one-click follow-up so the `<Analytics />` code shipped in Phase 44 isn't inert. Not a DEPLOY-02 blocker.
- **Open, deferred (D-02):** Retrofit an Ignored Build Step onto the `frontend` and `auth-callback` projects for build-minute hygiene. Out of scope for this phase.
- **Known-unobserved:** Live `VERCEL_ENV=preview` `noindex` behavior has not yet been observed on a real deployment — every deployment so far has been a production build from `master`. Phase 44 proved the logic locally across all four environments, and this plan confirmed the dashboard setting that lets it fire on Vercel, but the first genuine preview deployment (e.g. from a non-`master` branch or PR) will be the first live observation of this behavior.
- **For Phase 46:** this project has no custom domain and no Deployment Protection — the exact starting state the apex cutover runbook should assume.

## Decisions Made

- Recorded the Ignored Build Step preset as empirically confirmed available on this account's plan tier (closes RESEARCH.md Open Question 1), rather than leaving the fallback's shallow-clone caveat as an open risk for this project.
- Treated the "confirmed" reply to the optional Deployments-list observation as insufficiently specific to count as a positive sighting — recorded as "not yet observed" with the exact signal to look for next time, per the plan's explicit instruction not to assert (a) if the developer reported (b).

## Deviations from Plan

None - plan executed exactly as written. No source files were touched (as required), all Task 2 acceptance criteria passed on first execution, and no auto-fixes (Rules 1-3) or architectural questions (Rule 4) arose during verification.

## Issues Encountered

None. All settings matched their required states on first report; no correction loop was needed in Task 1.

## User Setup Required

None - all settings were confirmed or already correct; no further external service configuration is required to close DEPLOY-02.

## Next Phase Readiness

- DEPLOY-02 is fully closed — all four ROADMAP success criteria proven with named evidence.
- Phase 45 is complete (both plans done, zero source files changed across the phase as predicted by 45-PATTERNS.md).
- Phase 46 (Apex Domain Cutover Runbook) can proceed on the confirmed assumption that the `realstate` project has no custom domain and no Deployment Protection.
- Two deferred, non-blocking follow-ups remain open and should be picked up opportunistically: enabling Web Analytics (D-04) and retrofitting an Ignored Build Step onto `frontend`/`auth-callback` (D-02).
- Live `VERCEL_ENV=preview` `noindex` behavior remains known-unobserved until a genuine preview deployment occurs — worth a quick spot-check whenever the first non-`master` deploy happens.

---
*Phase: 45-vercel-project-setup-preview-verification*
*Completed: 2026-07-31*

## Self-Check: PASSED

- FOUND: `.planning/phases/45-vercel-project-setup-preview-verification/45-02-SUMMARY.md`
- Re-ran the full Task 2 automated verification block directly against `https://realstate-flax-five.vercel.app`: HTTP 200, Astro generator present, RealtyBase title present, CRA negatives absent, CTA counts 4/2 (extracted live from `landing/src/consts.ts`), robots.txt sitemap directive present, `git status --short landing/` empty — all assertions passed.
