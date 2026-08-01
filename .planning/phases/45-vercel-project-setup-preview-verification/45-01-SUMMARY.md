---
phase: 45-vercel-project-setup-preview-verification
plan: 01
subsystem: infra
tags: [vercel, astro, deployment, ci-cd, dns-pending]

# Dependency graph
requires:
  - phase: 42-landing-scaffold
    provides: "landing/ Astro site scaffold, vercel.json build config"
  - phase: 43-home-page-legal-pages
    provides: "Home page, /privacy, /terms content and noindex behavior"
  - phase: 44-seo-basics-analytics
    provides: "robots.txt, sitemap-index.xml, og-image.png, VERCEL_ENV-driven noindex matrix"
provides:
  - "A live Vercel project (name: realstate) building landing/ from tom-laventure/realstate with Root Directory landing"
  - "Externally verified proof (build log + live HTTP fetch) that the *.vercel.app deployment serves this repo's Astro output, not the frontend CRA SPA or another project"
  - "origin/master now carries landing/ (previously local-only, 74 commits unpushed)"
affects: [46-apex-domain-cutover, 45-02]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - "Vercel project named 'realstate' (distinct from existing 'frontend' and 'auth-callback' projects), Root Directory set to landing, confirmed via developer-reported Settings -> General value"
  - "Deployment Protection left off per D-03 — required for Claude's direct HTTP verification and acceptable since landing/ has zero secrets or backend coupling"
  - "No custom domain attached in this plan (Phase 46 scope) — but see Known Issues: an unconfirmed developer remark about www.realtybase.ca needs explicit resolution before 45-02/Phase 46"

patterns-established: []

requirements-completed: [DEPLOY-02]

# Metrics
duration: 8min
completed: 2026-07-31
---

# Phase 45 Plan 01: Vercel Project Setup + Live Deployment Verification Summary

**New Vercel project `realstate` (Root Directory `landing`) deployed commit `e723e3b` of `tom-laventure/realstate`; build log and live HTTP fetch of `https://realstate-flax-five.vercel.app` both independently confirm Astro output with correct CTAs, robots/sitemap/OG assets, and zero CRA/Amplify markers.**

## Performance

- **Duration:** 8 min (Task 3 verification only — Tasks 1-2 completed in a prior session)
- **Started:** 2026-07-31T23:45:00Z (Task 1), resumed 2026-07-31 for Task 3
- **Completed:** 2026-07-31
- **Tasks:** 3/3 (Task 1: auto, Task 2: checkpoint:human-action, Task 3: auto)
- **Files modified:** 0 (verification-only plan; zero source files touched, per `<no_source_changes>`)

## Accomplishments
- Published `landing/` to `origin/master` (previously local-only across 74 unpushed commits), unblocking the Vercel Root Directory picker.
- Developer created a new Vercel project (`realstate`), imported the correct repo (`tom-laventure/realstate`, not `realstate-fe`), set Root Directory to `landing`, and deployed.
- Independently verified (not just relayed) that the live `*.vercel.app` URL serves this repo's Astro build: build log SHA matches the pushed SHA exactly, Astro positive markers present, CRA negative controls absent, both CTA hrefs at correct 4/2 counts sourced live from `landing/src/consts.ts`, and all Phase 44 SEO artifacts (`robots.txt`, `sitemap-index.xml`, `/privacy`, `/terms`, `og-image.png`) serve correctly with expected noindex behavior.

## Task Commits

Tasks 1 and 2 involved no repo-content changes beyond the push/checkpoint itself (Task 1's push was of pre-existing commits; STATE.md position updates were committed in a prior session as `b80368c`). Task 3 is verification-only and produces no source diff — nothing beyond this SUMMARY and STATE/ROADMAP updates is committed for Task 3.

1. **Task 1: Publish landing/ to origin/master** - pushed `ee60b78..e723e3b` (fast-forward, no source-content commit of its own; STATE.md recorded in prior session as `b80368c`)
2. **Task 2: Developer creates Vercel project + reports back** - checkpoint resolved via developer report (no commit; dashboard-only action)
3. **Task 3: Assert build log + live deployment** - verification only, no commit until plan metadata below

**Plan metadata:** (this commit, immediately following) `docs(45-01): complete Vercel project setup verification plan`

## Files Created/Modified
None. This plan modifies zero source files by design (`<no_source_changes>` in 45-01-PLAN.md). Only `.planning/` documentation (this SUMMARY, STATE.md, ROADMAP.md) changes.

## Verification Evidence

### Vercel Project
- **Project name:** `realstate` (distinct from `frontend` and `auth-callback`)
- **Deployment URL:** `https://realstate-flax-five.vercel.app`
- **Root Directory:** `landing` (developer-confirmed at Settings -> General)
- **Environment Variables:** none added (developer-confirmed empty list)
- **Custom domain:** none attached in this project as of verification — see Known Issues below for an open question raised earlier in the same conversation

### SHA cross-reference
- Task 1 pushed SHA (`git rev-parse --short origin/master` at push time): `e723e3b`
- Build log clone line: `Cloning github.com/tom-laventure/realstate (Branch: master, Commit: e723e3b)`
- Build log final commit line: `e723e3b docs(45): add pattern map, decision-coverage citations, planned status`
- **Result: exact match.** The deployment built the precise tree Task 1 published, not a stale or different commit.

### Build log verdicts (Half A)
- Positive: `tom-laventure/realstate` present in the clone line — **pass**
- Positive: Astro build markers present (`[build] output: "static"`, `[build] mode: "static"`, `[vite] built in 809ms`, `[vite] built in 80ms`) — **pass**
- Negative (must be absent): `react-scripts`, `Creating an optimized production build`, `@aws-amplify`, `realstate-fe` — **all absent, pass**
- Benign note: `Warning: Failed to fetch one or more git submodules` appears in the log. **This is expected, not a failure.** `landing/` has zero runtime coupling to `backend/` or `frontend/` (the two gitlinked submodules referenced at monorepo root); their absence during `landing`'s isolated build is irrelevant to this deployment.

### Live fetch verdicts (Half B) — independently re-run by this executor, not just relayed
`PREVIEW_URL=https://realstate-flax-five.vercel.app`

| Assertion | Result |
|---|---|
| `GET /` status | 200 |
| `<meta name="generator" content="Astro` | present |
| `<title>RealtyBase` | present |
| `Every listing, every group` (hero) | present |
| `<nav` / `<footer` | present (each) |
| `rel="canonical" href="https://realtybase.ca/"` | present |
| `<div id="root"></div>` (CRA negative control) | absent (0 occurrences) |
| `create-react-app` (CRA negative control, case-insensitive) | absent (0 occurrences) |
| `href="https://app.realtybase.ca/create"` count | **4** (matches expected: nav, hero, value-prop, closing) |
| `href="https://app.realtybase.ca/auth/login"` count | **2** (matches expected: nav, closing) |
| `/robots.txt` status | 200, contains `Sitemap: https://realtybase.ca/sitemap-index.xml` |
| `/sitemap-index.xml` status | 200 |
| `/privacy` status | 200, contains `name="robots" content="noindex"` |
| `/terms` status | 200, contains `name="robots" content="noindex"` |
| `/og-image.png` status | 200 |
| Home page `name="robots" content="noindex"` count | 0 (correctly absent — see caveat below) |

CTA URLs were extracted live from `landing/src/consts.ts` (`getStarted` and `login` fields), not hardcoded, satisfying the plan's requirement that assertions track the source of truth.

### Non-gating: CTA destination reachability
- `https://app.realtybase.ca/create` -> HTTP 200
- `https://app.realtybase.ca/auth/login` -> HTTP 200

Both are informational only — they reflect the separate `app.realtybase.ca` deployment's current state, not this plan's work, per the plan's explicit non-gating instruction.

### Production-vs-preview caveat (explicit, per plan's `<production_not_preview_gotcha>`)
The home page correctly does **not** carry `noindex` because this is the first deployment from `master`, which builds with `VERCEL_ENV=production`. **This is expected and is NOT evidence that Vercel's System Environment Variables are enabled** for this project — a build where `VERCEL_ENV` is entirely unavailable to the build process would produce byte-identical output (no `noindex` on the home page). Whether System Environment Variables are actually turned on for this project is a separate dashboard setting confirmed in plan 45-02, not something this live fetch can discriminate.

## Decisions Made
- Confirmed Root Directory `landing` and project name `realstate` satisfy DEPLOY-02 criterion 1 (partial — full project settings completion, including Ignored Build Step, deferred to plan 45-02 as originally scoped).
- Treated the developer's build-log paste as sufficient evidence (greppable text, not a screenshot) and independently re-ran the equivalent live-HTTP assertions myself rather than only trusting the orchestrator's pre-run sweep, per this plan's instruction to spot-check before writing findings into the record.

## Deviations from Plan

None - plan executed exactly as written. No source files were touched (as required), all Task 3 acceptance criteria passed on first execution, and no auto-fixes (Rules 1-3) or architectural questions (Rule 4) arose during verification.

## Issues Encountered

None blocking. One open item surfaced during the conversation that is **not** a Task 3 verification failure but needs explicit follow-up — see Known Issues below.

## Known Issues / Open Follow-Up (non-blocking)

**Unconfirmed remark about a custom domain.** Earlier in this same conversation, before providing the actual `*.vercel.app` URL, the developer stated the site "is deployed under `https://www.realtybase.ca/`." This plan's design (and Phase 46's separation from Phase 45) explicitly requires **no custom domain** be attached to this new Vercel project — domain cutover is out of scope until Phase 46. It is unconfirmed whether:
(a) the developer actually attached `www.realtybase.ca` under Settings -> Domains on this project (in which case it must be removed before Phase 46 begins its own domain-attachment work, to avoid Phase 46 encountering a domain that's "already there" in an unplanned, unverified state), or
(b) this was simply describing where the developer expects the site to eventually live, with no dashboard action taken.

**This does not block plan 45-01 completion** — all of this plan's success criteria (build log + live-fetch verification against the `*.vercel.app` URL) are independently satisfied regardless of domain state. However, it must be explicitly resolved (ask the developer to confirm and, if attached, remove it) before starting plan 45-02 or Phase 46, since both assume a clean, domain-free starting state for this project. Flagging this in STATE.md's Blockers/Concerns as well.

## User Setup Required

None - no external service configuration required beyond what the developer already completed in Task 2 (project creation, Root Directory setting, Deployment Protection).

## Next Phase Readiness

- DEPLOY-02 criteria 2, 3, and 4 (build log, live markup, CTA hrefs) are fully verified. Criterion 1 (project exists with correct Root Directory) is verified for this plan's scope; the remaining project-settings work (Ignored Build Step, any other settings) is explicitly deferred to plan 45-02 as originally scoped in the plan's success criteria.
- Ready to proceed to plan 45-02 (System Environment Variables + remaining project settings confirmation) **after** the custom-domain question above is resolved with the developer.
- Phase 46 (Apex Domain Cutover) should not assume this project is domain-free until the open item above is explicitly confirmed.

---
*Phase: 45-vercel-project-setup-preview-verification*
*Completed: 2026-07-31*

## Self-Check: PASSED

- FOUND: `.planning/phases/45-vercel-project-setup-preview-verification/45-01-SUMMARY.md`
- FOUND commit `339f8ee` (Task 3 verification commit)
- FOUND commit `e723e3b` (Task 1 pushed SHA, exact match to build log)
- FOUND commit `b80368c` (prior-session Task 1 STATE.md commit)
- Independently re-ran 12+ of the live-fetch assertions against `https://realstate-flax-five.vercel.app` myself (not just relaying the orchestrator's sweep): HTTP 200, Astro markers present, CRA negatives absent, CTA counts 4/2, robots.txt/sitemap/privacy/terms/og-image all 200, home page noindex correctly absent (0 occurrences).
