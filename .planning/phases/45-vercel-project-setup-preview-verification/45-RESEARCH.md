# Phase 45: Vercel Project Setup + Preview Verification - Research

**Researched:** 2026-07-31
**Domain:** Vercel dashboard project configuration for a third monorepo project (manual runbook), plus static-HTML verification of a deployed Astro preview
**Confidence:** HIGH

## Summary

This phase has almost no code surface — `landing/vercel.json` already exists and needs no changes (confirmed by direct read: `{"framework": "astro", "buildCommand": "astro build", "outputDirectory": "dist"}`). The entire deliverable is (1) a precise, ordered manual runbook for a human to execute in the Vercel dashboard, and (2) a verification pass Claude performs itself, without dashboard access, by fetching the resulting `*.vercel.app` URL directly with curl/WebFetch. Both halves are now fully specified against Vercel's current (2026) dashboard flows and official docs, not assumptions.

The single most important first-party fact this research surfaced: `landing/` and `auth-callback/` are plain-tracked directories inside the **same** GitHub repo as this monorepo (`tom-laventure/realstate`, branch `master`) — but `frontend/` is a **separate** repo (`tom-laventure/realstate-fe`) and `backend/` another (`tom-laventure/realstate-be`). This means the single highest-risk step in the whole runbook is which GitHub repository the user selects during Vercel's "Import Git Repository" screen — it must be `tom-laventure/realstate` (the same repo `auth-callback`'s project already uses), never `realstate-fe`. Selecting the wrong repo, or leaving Root Directory at the repo root, are the two failure modes Pitfall 1 (PITFALLS.md) warns about, and this research pins down exact, unambiguous signals to detect both in the build log and in the rendered HTML.

The verification half is simpler than CONTEXT.md's phrasing implies: this is a fully static Astro build (confirmed by reading the actual local `dist/index.html`) with `<a href="https://app.realtybase.ca/create">`-style CTAs already baked into server-rendered markup, zero client-side rendering gap. `curl`/WebFetch against the raw HTML is sufficient — there is no need for a headless browser or JS execution to check success criteria #3–4.

**Primary recommendation:** Give the user an exact, numbered dashboard runbook (Add New Project → Import `tom-laventure/realstate` → expand "Edit" next to Root Directory → set to `landing` → Framework Preset auto-detects "Astro" → Deploy), then verify by `curl`-ing the resulting `*.vercel.app` URL and grepping for the three unambiguous markers established below (Astro `generator` meta tag, `RealtyBase` title, and the two exact CTA `href` values) rather than any visual/screenshot-based check.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vercel project creation / Git repo linkage | Dashboard (manual, human-executed) | — | No CLI session available (D-01); Root Directory/Ignored Build Step are dashboard-only settings with no `vercel.json` equivalent |
| Root Directory scoping | Dashboard project settings | — | Invisible in git; the entire mechanism this phase's verification gate exists to catch (Pitfall 1) |
| Ignored Build Step (this project only) | Dashboard project settings (Build and Deployment page) | `vercel.json` (not used — Vercel does not expose this as a `vercel.json` key) | Per-project dashboard setting, scoped to `landing/`'s own project only per D-02 |
| Build execution (`astro build`) | Vercel build container (CDN/Static tier) | — | Zero-config static detection; no adapter, no server tier involved |
| Preview/production content verification | Claude, via curl/WebFetch against the live static HTML | — | No JS-rendering gap — CTAs and meta tags are server-rendered at build time, confirmed by direct inspection of local `dist/index.html` |
| Domain attachment | Out of scope this phase (Phase 46) | — | Explicit phase boundary in CONTEXT.md |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Execution mode):** Claude has no authenticated Vercel session and no dashboard access. The plan must produce an exact, ordered runbook (New Project → import repo → set Root Directory to `landing/` → deploy) for the user to execute manually in the Vercel dashboard. After the user reports back the deployed `*.vercel.app` URL (and ideally a copy/screenshot of the build log), Claude verifies success criteria #2–4 by fetching the live preview URL directly (curl/WebFetch) — checking for Astro-rendered markup and confirming the CTA `<a href>`s resolve to `app.realtybase.ca/create` and `app.realtybase.ca/auth/login`. Rejected: Claude driving the Vercel CLI end-to-end (would require the user to run `npx vercel login` interactively first).
- **D-02 (Ignored Build Step scope):** Configuration is scoped to the **new `landing/` project only** in this phase. `frontend/` and `auth-callback/`'s existing working configs are left untouched — retrofitting them is out of scope.
- **D-03 (Preview deployment protection):** Vercel Deployment Protection is explicitly **not** enabled on the new project's preview deployments. Phase 44 already ships environment-aware `noindex`/meta-robots (via `VERCEL_ENV`) covering the search-crawlability concern. Leaving previews unprotected keeps success criteria #3–4 verifiable by Claude fetching the URL directly.
- **D-04 (Web Analytics dashboard toggle):** Enabling the Web Analytics toggle in the new project's dashboard settings is **out of scope** for this phase. Tracked under Deferred Ideas below — should happen soon after so the shipped `<Analytics />` code isn't silently a no-op indefinitely.

### Claude's Discretion

- Exact wording/formatting of the runbook steps handed to the user (dashboard UI navigation copy).
- Whether build-log verification happens via the user pasting/screenshotting the Vercel dashboard build log, or (if the user later authenticates the CLI) via `vercel inspect`/`vercel ls` — decide at execution time based on what's actually available; either satisfies success criterion #2.

### Deferred Ideas (OUT OF SCOPE)

- Enable Vercel Web Analytics dashboard toggle for the `landing/` project — deferred per D-04. Should happen soon after this phase (a one-click follow-up) so the `<Analytics />` code shipped in Phase 44 isn't silently inert; not a blocker for DEPLOY-02.
- Retrofit Ignored Build Step onto `frontend/`/`auth-callback/` — deferred per D-02. Worth doing eventually for build-minute hygiene across all three projects, but not required by this phase's success criteria.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEPLOY-02 | A new Vercel project exists with Root Directory set to `landing/`, verified via build log + rendered content to deploy Astro output (not another project's) to its own `*.vercel.app` preview URL | Exact runbook steps (repo selection, Root Directory setting, Framework Preset auto-detection) below; build-log unambiguous-success markers below; curl/WebFetch verification recipe with exact grep targets below, cross-checked against the actual local `dist/index.html` output and `frontend/index.html` (the "wrong project" negative control) |

## Standard Stack

Not applicable in the traditional sense — this phase installs **no new packages** and writes **no new application code**. `landing/vercel.json` already exists and is correct as-is (confirmed via direct read):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "astro",
  "buildCommand": "astro build",
  "outputDirectory": "dist"
}
```

No `@astrojs/vercel` adapter is needed — Vercel's own docs confirm: "You can deploy a static Astro app to Vercel with zero configuration" `[CITED: vercel.com/docs/frameworks/frontend/astro]`. The adapter is only required for SSR/Image Optimization/Web Analytics-via-adapter (all explicitly out of scope — Web Analytics here uses the `<Analytics />` component shipped in Phase 44, not the adapter's `webAnalytics` config option).

**No Package Legitimacy Audit needed** — zero packages are installed by this phase's tasks. (If the planner adds any verification tooling package, run the standard gate at that time.)

## Architecture Patterns

### The Vercel Dashboard Runbook (verified against current official docs, 2026-07-31)

**Repo topology, first-party-verified via `git remote -v` in this session:**

| Directory | GitHub repo | Branch | Vercel project relationship |
|-----------|-------------|--------|------------------------------|
| `landing/` (this phase) | `tom-laventure/realstate` (this monorepo) | `master` | **New** project to create |
| `auth-callback/` | `tom-laventure/realstate` (same monorepo) | `master` | Existing project, same repo, different Root Directory |
| `frontend/` | `tom-laventure/realstate-fe` (separate repo) | `master` | Existing project, **different** repo entirely |
| `backend/` | `tom-laventure/realstate-be` (separate repo) | `main` | Not deployed to Vercel |

This confirms the exact repo-selection risk: during Vercel's "Import Git Repository" step, the user must pick **`tom-laventure/realstate`** (same repo as `auth-callback`), not `realstate-fe`. Because Vercel already has `frontend`/`auth-callback` connected as GitHub App integrations, both repos will likely appear in the picker — picking `realstate-fe` for a `landing/` project would either fail to find a `landing/` folder or (worse) succeed against the wrong repo silently.

**Runbook steps** (official flow per `[CITED: vercel.com/docs/monorepos]`, "Add a monorepo through the Vercel Dashboard"):

1. Go to the Vercel Dashboard, select the correct team from the team switcher (same team `frontend`/`auth-callback` already live under).
2. Click **Add New…** → **Project**.
3. In **Import Git Repository**, click **Import** next to `tom-laventure/realstate` — **not** `tom-laventure/realstate-fe`. If the repo isn't listed, it needs to be granted to the Vercel GitHub App first (Adjust GitHub App Permissions link in the picker).
4. **Before clicking Deploy**, click the **Edit** button next to the **Root Directory** field and select/type `landing`. Framework Preset should auto-detect as **Astro** once Root Directory is set (Vercel reads `landing/package.json`'s `astro` dependency) — Build Command (`astro build`) and Output Directory (`dist`) auto-populate; no manual override needed since `landing/vercel.json` already pins them explicitly.
5. Leave **Environment Variables** empty (none required — `astro.config.mjs`'s `site` is hardcoded, not env-driven, per Phase 44 D-01/Pitfall 4).
6. Click **Deploy**. This triggers the project's first build, which becomes its **Production** deployment (there is no custom domain yet, so it is reachable only at the auto-assigned `https://<project-name>.vercel.app` alias — see "Production vs Preview environment" gotcha below).
7. After the build finishes, copy the deployment's `*.vercel.app` URL and the build log (copy/paste or screenshot) back to Claude for verification.
8. **Then**, configure Ignored Build Step (D-02 — this project only): Project → **Settings** → **Build and Deployment** → **Ignored Build Step** section. Select the dropdown preset **"Only build if there are changes in a folder that you specify"** and enter `landing` as the folder — this is a first-party Vercel UI preset `[CITED: vercel.com/docs/project-configuration/project-settings]`, simpler and more robust than hand-writing a `git diff --quiet` command (see Common Pitfalls below for why the hand-written form has an edge case). Do **not** touch `frontend`'s or `auth-callback`'s existing Ignored Build Step settings.
9. Do **not** add a custom domain in this phase (Phase 46 scope).

### Unambiguous Build-Log Success Signal (Pitfall 1 verification)

The build log for a correctly-scoped `landing/` deploy will show Astro's own build output, not Vite's raw dev output or CRA's `react-scripts build`. Exact strings to look for (first-party-verified: this repo's own local `astro build` output naming conventions, cross-referenced against Astro's known build log format):

- A line resembling `13:45:01.234 building client (vite) ...` followed by `✓ Completed in Xs.` and `[build] X page(s) built in Xs.` — this Astro-specific phrasing (`building client`, `page(s) built`) does not appear in a Vite-only React build.
- Output directory reported as `dist/` with entries for `index.html`, `privacy/index.html`, `terms/index.html`, `sitemap-index.xml`, `robots.txt`, `og-image.png` — confirmed by listing the actual local `landing/dist/` contents in this session (`_astro`, `favicon.ico`, `favicon_transparent.png`, `index.html`, `og-image.png`, `privacy`, `robots.txt`, `sitemap-0.xml`, `sitemap-index.xml`, `terms`).
- **Negative signal (wrong-project failure mode):** if the log instead shows `Creating an optimized production build...` (CRA/Vite React build phrasing) or references `frontend/package.json`'s dependencies (`react`, `react-dom`, `@aws-amplify/...`), Root Directory was left at repo root or picked the wrong repo — abort and fix Root Directory before proceeding.

### Unambiguous Rendered-Content Success Signal (curl/WebFetch verification, no JS gap)

Confirmed via direct inspection of this repo's own build output (`landing/dist/index.html`, first bytes) — the rendered HTML `<head>` contains:

```html
<meta name="generator" content="Astro v7.1.6">
...
<title>RealtyBase — Real Estate Brokerage Software</title>
```

This is the single cheapest, most unambiguous marker to `curl | grep` for. As a **negative control**, `frontend/index.html` (the CRA SPA shell) contains neither of these — it has `<div id="root"></div>`, `<title>Real State</title>`, and `<meta name="description" content="Web site created using create-react-app">` instead. If the fetched preview URL shows the CRA shell instead of the Astro markers, Root Directory is misconfigured and serving `frontend/`.

CTA hrefs are baked directly into the static HTML (confirmed by grepping the actual local build):

```html
<a id="nav-get-started" href="https://app.realtybase.ca/create" ...>Get Started</a>
<a id="nav-login" href="https://app.realtybase.ca/auth/login" ...>Log in</a>
<a id="hero-get-started" href="https://app.realtybase.ca/create" ...>Get Started</a>
<a id="value-prop-get-started" href="https://app.realtybase.ca/create" ...>Get Started</a>
<a id="closing-get-started" href="https://app.realtybase.ca/create" ...>Get Started</a>
<a id="closing-login" href="https://app.realtybase.ca/auth/login" ...>Already have an account? Log in</a>
```

**No headless browser, Puppeteer, or JS execution is needed** — every CTA `href` is present verbatim in the raw HTML response body. A single `curl -s <url> | grep -o 'href="https://app.realtybase.ca[^"]*"'` (or WebFetch with a prompt asking for the two CTA hrefs) fully satisfies success criterion #4.

### "Production vs Preview environment" gotcha (new finding, not in prior research docs)

`VERCEL_ENV` is available at build time `[CITED: vercel.com/docs/environment-variables/system-environment-variables]` with three possible values: `production`, `preview`, `development`. **The very first deployment created by this runbook (from the `master`/production branch, with no custom domain yet attached) will build with `VERCEL_ENV=production`** — not `preview` — even though its only reachable URL is the `*.vercel.app` alias. This matters for verification:

- Phase 44's `BaseLayout.astro` OR's `noindex` in only when `VERCEL_ENV !== 'production'`. On this initial deploy, that condition is **false**, so the fetched HTML will **not** contain a `noindex` meta tag — this is expected and correct, not a bug to flag during verification.
- If the planner or a later verification step pushes to a non-`master` branch to test the "preview environment" `noindex` behavior specifically, that deployment *would* get `VERCEL_ENV=preview` and *would* show `noindex`. Don't conflate the two — REQUIREMENTS.md's "preview URL" language refers colloquially to "the pre-domain-cutover `*.vercel.app` URL," not Vercel's internal `preview` environment classification.

### System Environment Variables — verify, don't assume

Vercel's docs state new projects receive System Environment Variables (including `VERCEL_ENV`) by default `[CITED: vercel.com/docs/environment-variables/system-environment-variables]`, but the same settings page still documents an **"Enable access to System Environment Variables"** checkbox under Project → Environment Variables. Add a runbook check: after the first deploy, confirm this checkbox is checked (it should already be, by default, for a newly-created project) — if `VERCEL_ENV` were somehow unavailable, Phase 44's environment-aware `noindex` logic would silently fail. This is a cheap one-glance dashboard check to fold into the runbook, not a blocking risk.

### Node.js Version — informational, no action needed

`landing/package.json` pins `"engines": { "node": ">=22.12.0" }`. Vercel's current default Node.js Version for new projects is 22.x or 24.x `[CITED: vercel.com/changelog/node-js-22-lts-is-now-available]` — both satisfy the `>=22.12.0` floor. No manual override is needed in Project Settings → Build and Deployment → Node.js Version, but it's a one-glance confirmation worth including in the runbook in case the account default has been pinned lower by a prior team setting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Skip rebuilding `landing/` on commits that only touch `backend/`/`frontend/` | A custom shell script parsing `git diff` output with manual exit-code logic | Vercel's built-in **Ignored Build Step** dropdown preset "Only build if there are changes in a folder that you specify" | First-party dashboard feature (`[CITED: vercel.com/docs/project-configuration/project-settings]`) that already handles the exit-code semantics (0 = skip/CANCELED, 1 = continue) correctly — a hand-written `git diff HEAD^ HEAD --quiet -- landing/` script is exposed to Vercel's shallow-clone depth-10 fetch potentially not including `HEAD^` in some multi-commit-push scenarios `[CITED: vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel]` — the dashboard preset avoids reimplementing this edge case |
| Verify deployed content renders correctly | A headless-browser screenshot/Puppeteer script | Plain `curl`/WebFetch against the raw HTML | Astro's static output has zero JS-rendering gap for this content (verified against actual local build output) — a browser-automation dependency would be pure unnecessary complexity for this phase |

**Key insight:** Both hand-rolled temptations in this phase (custom ignore-build script, headless-browser verification) have a simpler first-party or already-verified-sufficient alternative — resist adding tooling this phase doesn't need.

## Common Pitfalls

### Pitfall 1: Selecting the wrong GitHub repository during Import

**What goes wrong:** Vercel's "Import Git Repository" picker will list both `tom-laventure/realstate` and `tom-laventure/realstate-fe` (since both are already connected via the existing `frontend`/`auth-callback` projects' GitHub App grants). Picking `realstate-fe` for the new `landing/` project either fails outright (no `landing/` folder exists there) or, in a worse silent-failure scenario, succeeds against unrelated content.
**Why it happens:** Both repos belong to the same GitHub org/user and may have visually similar names in the picker; the team's mental model of "one repo, three folders" doesn't hold for `frontend`.
**How to avoid:** Runbook must explicitly instruct: import `tom-laventure/realstate` — the same repo `auth-callback`'s existing project already uses — never `realstate-fe`.
**Warning signs:** Import screen shows no `landing/` option at Root Directory selection time (folder doesn't exist in the selected repo); build fails immediately with "no framework detected" or picks up a `package.json` with `react`/`@aws-amplify` dependencies.

### Pitfall 2: Root Directory left at repo root or set to the wrong folder

Already extensively documented in `.planning/research/PITFALLS.md` Pitfall 1 — restated here with this session's concrete, testable verification signals (Astro `generator` meta tag + `dist/` build log phrasing vs. CRA's `react-scripts build` phrasing), rather than a general warning.

### Pitfall 3: Mistaking the initial (production) deploy's lack of `noindex` for a bug

See "Production vs Preview environment" gotcha above — the first deploy from `master` builds with `VERCEL_ENV=production`, so it will correctly **not** show a `noindex` meta tag even though no custom domain is attached yet. Don't fail verification on this basis.

### Pitfall 4: Hand-writing an Ignored Build Step script instead of using the dashboard preset

Vercel's Ignored Build Step accepts a raw shell command, tempting a hand-written `git diff HEAD^ HEAD --quiet -- landing/`. This is exposed to a shallow-clone edge case (`git clone --depth=10`) where `HEAD^` may not always resolve as expected across multi-commit pushes `[CITED: vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel]`. Use the dashboard's built-in dropdown preset instead (see Don't Hand-Roll above).

### Pitfall 5: Assuming System Environment Variables are unavailable without checking

Vercel's docs describe an "Enable access to System Environment Variables" checkbox that theoretically could be off, even though new projects get it by default. A quick one-glance check during the runbook avoids silently breaking Phase 44's `VERCEL_ENV`-driven `noindex` logic later.

## Code Examples

### Verification curl recipe (run by Claude after user reports the URL)

```bash
# Fetch the deployed HTML once
PREVIEW_URL="https://<project-name>.vercel.app"   # supplied by user after Deploy
curl -sL "$PREVIEW_URL" -o /tmp/landing-preview.html

# Signal 1: Astro build output (not CRA/Vite React SPA)
grep -o '<meta name="generator" content="Astro[^"]*"' /tmp/landing-preview.html

# Signal 2: correct site title (not "Real State" / CRA default)
grep -o '<title>[^<]*</title>' /tmp/landing-preview.html

# Signal 3 & 4: both CTA destinations present verbatim
grep -o 'href="https://app\.realtybase\.ca/create"' /tmp/landing-preview.html
grep -o 'href="https://app\.realtybase\.ca/auth/login"' /tmp/landing-preview.html
```

Equivalent single-shot check via WebFetch tool: fetch `$PREVIEW_URL` with a prompt asking to confirm presence of the Astro generator meta tag, the page title, and both CTA `href` values.

### robots/sitemap sanity check (optional, cheap, reuses Phase 44's existing artifacts)

```bash
curl -sL "$PREVIEW_URL/robots.txt"
curl -sL "$PREVIEW_URL/sitemap-index.xml"
```

Not a DEPLOY-02 success criterion itself, but a free additional confirmation that the correct `dist/` output (with Phase 44's SEO artifacts) is what's actually being served.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Manually written `git diff --quiet` Ignored Build Step scripts | Dashboard dropdown preset "Only build if there are changes in a folder that you specify" | Available in current (2026) Vercel dashboard per official project-settings docs | Removes the shallow-clone `HEAD^` edge case and manual exit-code bookkeeping entirely |
| `@vercel/analytics` adapter-based `webAnalytics: { enabled: true }` config | Framework-native `<Analytics />` component (`@vercel/analytics/astro`) | `@vercel/analytics >= 1.4.0` | Already adopted in Phase 44; no adapter install needed, reconfirmed here as still current |

**Deprecated/outdated:** None specific to this phase beyond what STACK.md already flagged (`@astrojs/tailwind`, adapter-based analytics) — not relevant to Phase 45's scope.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Vercel team/account the user will use for the new `landing/` project is the same team `frontend`/`auth-callback` already live under | Architecture Patterns (runbook step 1) | If a different team is selected, the existing repo GitHub App grants may not be visible, requiring the user to re-authorize repo access — cosmetic delay, not a correctness risk |
| A2 | Ignored Build Step's dashboard dropdown preset ("Only build if there are changes in a folder that you specify") is available on whatever Vercel plan tier this account is on (STATE.md confirms Hobby tier from Phase 44's analytics-limit discussion) | Don't Hand-Roll, Architecture Patterns | If the preset is Pro-plan-gated (not confirmed either way by official docs checked this session), the user would need to fall back to the manual `git diff --quiet -- landing/` shell command form instead — same outcome, one extra manual step |

**If this table is empty:** N/A — two low-risk assumptions remain above; both have cheap manual fallbacks if wrong.

## Open Questions

1. **Does the Ignored Build Step dropdown preset require a paid plan?**
   - What we know: The feature exists and is documented in general (non-plan-gated) project-settings docs.
   - What's unclear: Official docs checked this session don't explicitly state Hobby-tier availability.
   - Recommendation: Runbook should instruct the user to check the dropdown first; if unavailable, fall back to entering `git diff HEAD^ HEAD --quiet -- landing/` as a **Custom** Ignored Build Step command (accepting the shallow-clone edge case as a low-severity, rare fallback).

2. **Will the user paste a build-log screenshot or text copy?**
   - What we know: Claude's Discretion per CONTEXT.md — either satisfies success criterion #2.
   - What's unclear: Format the user will actually provide at execution time.
   - Recommendation: Ask for a text/copy-paste of the build log if possible (greppable), fall back to reading a screenshot if that's what's provided.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Authenticated Vercel dashboard session | Entire runbook (project creation, Root Directory, Ignored Build Step) | ✗ (Claude has no session; confirmed in D-01 — `vercel whoami` hung on interactive OAuth) | — | User executes all dashboard steps manually per the runbook; Claude verifies only the resulting live URL |
| Vercel CLI (`npx vercel`) | Alternative build-log inspection (`vercel inspect`/`vercel ls`) | Installed but not logged in (confirmed in D-01) | — | Not usable this phase unless user authenticates it out-of-band; build-log verification instead relies on user-supplied text/screenshot |
| Network access for curl/WebFetch against the live `*.vercel.app` URL | Verifying success criteria #2–4 | ✓ (standard tool availability in this environment) | — | — |

**Missing dependencies with no fallback:** None — the one missing dependency (authenticated Vercel session) has a full fallback already locked in via D-01 (manual runbook).

**Missing dependencies with fallback:** Vercel CLI authentication — falls back to dashboard-only manual execution, per D-01.

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled), but this phase makes no code, auth, or data-handling changes — it is pure deployment-infrastructure configuration for a static site with zero backend coupling. Most ASVS categories don't apply.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth surface in `landing/`; CTAs merely link to `app.realtybase.ca`'s own auth, which is out of this phase's scope |
| V3 Session Management | No | No sessions on the static marketing site |
| V4 Access Control | No | No access-controlled resources |
| V5 Input Validation | No | No user input processed by this phase |
| V6 Cryptography | No | No secrets/crypto introduced |
| V14 Configuration | Yes | Vercel Root Directory + Ignored Build Step are exactly the "configuration correctness" surface this phase's verification gate protects — misconfiguration is a build/deploy-scoping risk, not a data-exposure risk, since `landing/` has no secrets and no backend calls |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Wrong Root Directory silently deploys a different project's build output to a public URL | Tampering (unintended deployment) / Information Disclosure (if the wrong project exposes anything unintended) | Explicit Root Directory verification via build-log inspection + rendered-content grep, before any domain is attached (this phase's entire purpose) |
| Leaving preview deployments unprotected (D-03) | Information Disclosure (low severity here — static marketing content only) | Accepted per D-03: Phase 44's environment-aware `noindex` already covers the search-crawlability concern this would otherwise address; no sensitive data is on this static site to protect via Deployment Protection |

## Sources

### Primary (HIGH confidence)
- https://vercel.com/docs/monorepos — "Add a monorepo through the Vercel Dashboard" exact step sequence (fetched 2026-07-31)
- https://vercel.com/docs/project-configuration/project-settings — Ignored Build Step exact dropdown options and exit-code semantics (0=cancel, 1=continue), General/Build-and-Deployment settings location (fetched 2026-07-31)
- https://vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel — exact exit-code behavior and shallow-clone (`--depth=10`) `HEAD^` edge case (fetched 2026-07-31)
- https://vercel.com/docs/frameworks/frontend/astro — confirms zero-config static Astro deploy, no adapter required unless SSR/Image-Optimization/adapter-based Web Analytics is needed (fetched 2026-07-31)
- https://vercel.com/docs/environment-variables/system-environment-variables — `VERCEL_ENV` build+runtime availability, possible values, "Enable access to System Environment Variables" checkbox (fetched 2026-07-31)
- https://vercel.com/changelog/node-js-22-lts-is-now-available — current Node.js Version defaults (22.x/24.x) (fetched 2026-07-31)
- Direct repo inspection this session: `landing/vercel.json`, `landing/dist/index.html` (full head + body), `landing/dist/` directory listing, `frontend/index.html` (negative-control CRA shell), `landing/package.json`, `landing/astro.config.mjs`, `landing/src/consts.ts`, `git remote -v` for `frontend`/`backend` (separate repos), `git branch --show-current` for root/frontend/backend (branch names), `.planning/config.json` (`nyquist_validation: false`, no `security_enforcement` key)

### Secondary (MEDIUM confidence)
- WebSearch "Vercel Ignored Build Step Hobby plan available feature tier" — inconclusive on plan-gating, folded into Assumptions Log A2 rather than stated as fact

### Tertiary (LOW confidence)
- None — all findings this session were either verified against official Vercel docs or first-party repo inspection

## Metadata

**Confidence breakdown:**
- Dashboard runbook steps: HIGH — verified against current official Vercel monorepo/project-settings docs, cross-checked against this repo's actual git remote/branch topology
- Build-log / rendered-content verification signals: HIGH — derived from actually running/reading this repo's own local Astro build output, not assumed from generic Astro knowledge
- Ignored Build Step plan-tier availability: MEDIUM — one open assumption (A2) with a documented low-risk fallback

**Research date:** 2026-07-31
**Valid until:** 30 days (Vercel dashboard UI/flow is stable but does iterate; re-verify exact click-paths if this phase is delayed significantly past that window)
