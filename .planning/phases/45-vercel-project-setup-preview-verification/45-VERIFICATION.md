---
phase: 45-vercel-project-setup-preview-verification
verified: 2026-08-01T03:10:00Z
status: passed
score: 14/14 must-haves verified (9 directly verified by this verifier, 5 human-attested via blocking dashboard checkpoints already resolved during execution)
overrides_applied: 0
---

# Phase 45: Vercel Project Setup + Preview Verification Verification Report

**Phase Goal:** `landing/` deploys independently to its own Vercel project, verified to be serving the correct Astro output before any domain is attached.
**Verified:** 2026-08-01T03:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Verification Methodology

This verifier does **not** have Vercel dashboard/CLI access (same D-01 constraint documented in the phase itself). Where SUMMARY.md claims could be independently re-checked with tools available to this verifier (git, curl, DNS), they were re-run from scratch rather than trusted — results below are this verifier's own command output, not restated SUMMARY text. Where a claim is genuinely dashboard-only (e.g. a checkbox state no HTTP request can observe), it is explicitly labeled "human-attested" and evaluated on whether the phase's own blocking-checkpoint mechanism (`checkpoint:human-action`, resolved with specific structured values matching acceptance criteria) was actually exercised — not merely asserted in prose.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — primary contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A new Vercel project exists with Root Directory explicitly set to `landing/`, distinct from `frontend`/`auth-callback` | VERIFIED | `git ls-tree -d origin/master landing` returns a tree entry (independently re-fetched); live fetch of `https://realstate-flax-five.vercel.app` serves Astro output distinct from `frontend`'s CRA shell (see criterion 3). Project name `realstate` / Root Directory value `landing` reported via resolved blocking checkpoint (45-01 Task 2) — dashboard value itself is human-attested (inherent D-01 constraint, no Vercel session exists in this environment either) |
| 2 | The project's build log shows Astro build output, confirming it built `landing/` and not another project's code | VERIFIED | Build log text (SHA `e723e3b`, Astro markers, absent CRA/Amplify markers) reported and quoted in 45-01-SUMMARY; strongly corroborated independently by this verifier's own live fetch: `<meta name="generator" content="Astro` present, `react-scripts`/`create-react-app`/`@aws-amplify` absent in served bytes |
| 3 | The deployed `*.vercel.app` preview URL renders the actual landing page content (hero, nav, footer) when visited | VERIFIED | Independently re-fetched `https://realstate-flax-five.vercel.app` (HTTP 200). Confirmed present: `<title>RealtyBase`, `Every listing, every group` (hero), `<nav`, `<footer`, canonical tag. Confirmed absent: `<div id="root"></div>`, `create-react-app` |
| 4 | CTA links on the live preview deployment correctly navigate cross-origin to `app.realtybase.ca/create` and `app.realtybase.ca/auth/login` | VERIFIED | Independently confirmed the served HTML contains 4 real `<a href="https://app.realtybase.ca/create">` anchors and 2 real `<a href="https://app.realtybase.ca/auth/login">` anchors (plain hrefs, no JS interception, no `preventDefault`). Actual browser navigation confirmed via 45-02 Task 1's resolved blocking checkpoint (developer reported exact address-bar destinations after clicking both) |

**Score:** 4/4 roadmap truths verified

### Supporting Must-Haves (from PLAN frontmatter, 45-01 + 45-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | `landing/` published to `origin/master` (D-01 precondition) | VERIFIED | `git fetch origin master && git ls-tree -d origin/master landing` → tree entry present; `git rev-list --count origin/master..master` → `0` (local/remote identical) |
| 6 | Deployment Protection off (D-03) | VERIFIED | Direct `curl -I` returns `200` with no auth challenge/redirect and no Vercel SSO page — independently confirms no protection wall, not merely relayed |
| 7 | Phase 44 SEO artifacts served correctly on the live deploy | VERIFIED | `/robots.txt` → 200, contains `Sitemap: https://realtybase.ca/sitemap-index.xml`; `/sitemap-index.xml` → 200 (184 bytes, real XML content-type); `/privacy` and `/terms` → 200, each contains `name="robots" content="noindex"`; `/og-image.png` → 200 (13KB, `image/png`) |
| 8 | Ignored Build Step scoped to `landing/` (D-02) | PASSED (human-attested) | Dashboard-only setting; resolved via 45-02 Task 1 blocking checkpoint — developer reported the folder-scoped preset with value `landing`. No HTTP signal exists to independently corroborate this; inherent to D-01 (no Vercel session in this environment) |
| 9 | System Environment Variables enabled | PASSED (human-attested) | Dashboard-only checkbox; the plan itself explicitly states a production build with this enabled vs. disabled produces byte-identical home-page output, so no live fetch can discriminate it. Resolved via 45-02 Task 1 blocking checkpoint (developer reported checked) |
| 10 | Node.js version satisfies `>=22.12.0` floor | VERIFIED (partial) | `landing/package.json` confirms `"node": ">=22.12.0"`, `landing/.nvmrc` confirms `22.12.0`. Dashboard-reported value (`24.x`) is human-attested, but independently corroborated: an Astro 7 build with a Node version below the floor would fail outright, and the live deploy demonstrably succeeded with correct Astro markers |
| 11 | No custom domain attached to this project (D-03) | VERIFIED | Independently checked DNS/HTTP for `realtybase.ca` and `www.realtybase.ca`: both still resolve to and serve the **existing `frontend` CRA project** (`<title>Real State`, `id="root"` present), not the new `realstate` project — confirms no domain was mistakenly attached here, resolving 45-01's own flagged "Known Issue" about an earlier developer remark |
| 12 | `frontend`/`auth-callback` project settings untouched (D-02) | PASSED (human-attested) | No means to inspect another project's dashboard settings from this environment; developer confirmed no other project's settings page was modified, per 45-02 Task 1 acceptance criteria |
| 13 | Web Analytics remains disabled (D-04) | PASSED (human-attested) | Dashboard-only toggle; developer confirmed still off via 45-02 Task 1 |
| 14 | Live URL still serves the landing Astro build after every settings change | VERIFIED | Re-fetched independently at verification time (after all settings work claimed complete): HTTP 200, Astro generator present, CRA negatives absent, CTA counts still 4/2, `robots.txt` still correct |

**Score:** 14/14 (9 directly verified by independent command execution in this session, 5 human-attested via already-resolved blocking checkpoints — none failed, none newly pending)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/phases/45-vercel-project-setup-preview-verification/45-01-SUMMARY.md` | Project name, URL, SHA, build-log evidence, live-URL assertions | VERIFIED | Present, contains all required fields; cross-checked against independent re-fetch, not merely read |
| `.planning/phases/45-vercel-project-setup-preview-verification/45-02-SUMMARY.md` | Settings values, click-through result, DEPLOY-02 roll-up, deferred follow-ups | VERIFIED | Present, contains a 4-row DEPLOY-02 roll-up naming plan/task evidence per criterion, both deferrals recorded (D-04 Web Analytics, D-02 retrofit) |
| `landing/` on `origin/master` | Present as a plain-tracked directory | VERIFIED | `git ls-tree -d origin/master landing` confirms tree entry |
| `landing/vercel.json` | Unmodified, `framework: astro`/`astro build`/`dist` | VERIFIED | Read directly — matches PATTERNS.md's documented baseline, no `rootDirectory`/`ignoreCommand` key added |
| `git status --short landing/` | Empty (zero source changes, per `<no_source_changes>`) | VERIFIED | Confirmed empty at verification time |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Served `*.vercel.app` HTML | `https://app.realtybase.ca/create` / `.../auth/login` | Static anchor hrefs baked from `landing/src/consts.ts` | WIRED | Extracted `getStarted`/`login` values live from `landing/src/consts.ts`, confirmed they appear verbatim as plain `<a href>` values (4x/2x) in the served HTML — no JS indirection |
| `origin/master` | Vercel build container | GitHub App repo connection, Root Directory `landing` | WIRED | `origin/master` confirmed to carry `landing/`; live deploy confirmed serving Astro output built from that tree (SHA cross-reference documented in 45-01-SUMMARY, corroborated by live Astro/CRA marker checks) |

### Data-Flow Trace (Level 4)

Not applicable in the conventional sense (no React state/props) — but the equivalent check was performed: CTA `href` values are static build-time substitutions from `landing/src/consts.ts` into plain HTML anchors, verified present in the actually-served bytes (not merely present in source) at the correct counts.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Live homepage serves Astro build | `curl -sSL https://realstate-flax-five.vercel.app` + marker greps | 200, all Astro positives present, all CRA negatives absent | PASS |
| CTA hrefs present at correct counts | `grep -o 'href="..."' \| wc -l` against live HTML | create=4, login=2 | PASS |
| Deployment Protection off | `curl -I` (no auth challenge) | 200, no auth wall | PASS |
| Phase 44 SEO artifacts live | `curl` against `/robots.txt`, `/sitemap-index.xml`, `/privacy`, `/terms`, `/og-image.png` | all 200 with correct content | PASS |
| No custom domain conflict | DNS + curl against `realtybase.ca`/`www.realtybase.ca` | Both still serve unrelated `frontend` CRA project, not this new project | PASS |
| `origin/master` carries `landing/` | `git ls-tree -d origin/master landing` | tree entry present | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` conventions apply to this phase (infra/dashboard verification, not a code migration). Skipped — no probes declared in PLAN/SUMMARY beyond the inline `<verify><automated>` blocks, which were re-run independently above rather than trusted from SUMMARY text.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DEPLOY-02 | 45-01, 45-02 | A new Vercel project exists with Root Directory set to `landing/`, verified via build log + rendered content to deploy Astro output to its own `*.vercel.app` preview URL | SATISFIED | All 4 roadmap success criteria independently verified above; REQUIREMENTS.md line 42 and traceability table line 92 both mark DEPLOY-02 complete, consistent with codebase evidence (not merely the doc's own claim) |

No orphaned requirements: REQUIREMENTS.md's Phase 45 mapping is DEPLOY-02 only, and both plans declare `requirements: [DEPLOY-02]` in frontmatter — full match.

### Anti-Patterns Found

None. `files_modified: []` in both SUMMARYs is consistent with `git status --short landing/` returning empty and no source diff existing for this phase (confirmed independently). No TBD/FIXME/XXX/placeholder markers apply since no source files were touched by this phase.

### Human Verification Required

None pending. All items requiring human interaction (Vercel dashboard settings, live CTA click-through) were routed through this phase's own blocking `checkpoint:human-action` tasks (45-01 Task 2, 45-02 Task 1), each of which was already resolved with specific structured values matching its plan's acceptance criteria before this verification ran. This is the intended verification mechanism for the Vercel-dashboard-only settings (D-01: no Vercel session/dashboard access exists in this environment, for either the executor or this verifier) — re-running curl or grep cannot observe a dashboard checkbox, so there is nothing further for a human to newly verify here.

### Gaps Summary

No gaps found. Every ROADMAP success criterion for Phase 45 was independently re-verified against live infrastructure (not merely re-read from SUMMARY.md) using git, curl, and DNS checks run fresh in this verification session. The five items that remain dashboard-only (Ignored Build Step form, System Environment Variables checkbox, Node.js Version display, Domains list, Web Analytics toggle) are inherently unverifiable by any tool available in this environment — this is the same D-01 constraint the phase itself documents — and were resolved through the phase's designed blocking-checkpoint mechanism rather than asserted without evidence. Independent corroboration was found wherever technically possible (Deployment Protection off confirmed via direct curl; no custom domain confirmed via DNS showing the apex still serves the pre-existing `frontend` project; Node floor corroborated by the build's demonstrable success).

---

*Verified: 2026-08-01T03:10:00Z*
*Verifier: Claude (gsd-verifier)*
