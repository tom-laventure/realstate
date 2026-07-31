# Phase 45: Vercel Project Setup + Preview Verification - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 0 new/modified source files (confirmed — see below)
**Analogs found:** N/A / N/A

## Scope Note: No Source File Changes This Phase

CONTEXT.md and RESEARCH.md both explicitly confirm this phase produces **zero new or modified source files**. The entire deliverable is:

1. A manual runbook (dashboard clicks) for the user to create a new Vercel project with Root Directory `landing/`.
2. A verification pass Claude performs against the resulting live `*.vercel.app` URL via `curl`/WebFetch — no code is read or written to perform this, only HTTP requests against a deployed artifact.

`landing/vercel.json` already exists and needs no changes (confirmed by direct read, reproduced below). There is no controller/component/service/model file to classify for this phase — the "file classification" and "pattern assignment" tables below are intentionally empty of code-pattern rows. What follows instead documents the **existing configuration pattern** across the monorepo's three Vercel projects, since the planner needs this to write accurate runbook instructions (e.g., confirming `landing/`'s config shape matches its siblings, and that no `vercel.json` edits are needed or expected).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| *(none — no source files created or modified in this phase)* | — | — | — | — |

## Pattern Assignments

*(No files to assign patterns to — this phase is a dashboard runbook + live-URL verification only.)*

## Reference: Existing Vercel Config Pattern (for runbook accuracy, not for editing)

These three configs are the **established, unmodified** pattern this phase's new project will sit alongside. None of them are edited by this phase — reproduced here so the planner can confirm the runbook's "no vercel.json changes needed" claim and correctly describe `landing/`'s config as consistent with its siblings.

### `landing/vercel.json` (existing, unchanged — the project this phase deploys)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "astro",
  "buildCommand": "astro build",
  "outputDirectory": "dist"
}
```

Static Astro build config — explicit framework/build/output keys, matching Vercel's own zero-config Astro detection (redundant-but-harmless pinning). No SPA rewrite rule needed since Astro emits real per-route HTML files (`dist/index.html`, `dist/privacy/index.html`, `dist/terms/index.html`), unlike the CRA/SPA projects below.

### `frontend/vercel.json` (existing, unchanged — separate repo `tom-laventure/realstate-fe`)

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

SPA catch-all rewrite — needed because CRA's client-side router requires all paths to resolve to the single `index.html` shell.

### `auth-callback/vercel.json` (existing, unchanged — same monorepo as `landing/`, different Root Directory)

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Identical SPA rewrite shape to `frontend/`. `auth-callback/` is the closest structural analog for the *dashboard project-creation flow* itself (same repo `tom-laventure/realstate`, Root-Directory-scoped project, no `.vercel/` committed) even though its `vercel.json` content differs from `landing/`'s (SPA rewrite vs. static Astro build config) — the two projects diverge only because `auth-callback` is a client-rendered SPA and `landing/` is a static-HTML-per-route Astro site.

### Common thread across all three

- **Root Directory is never expressed in `vercel.json`** — it is a dashboard-only project setting, invisible to git, for all three projects. This is *the* established (if fragile) pattern this phase's verification gate exists to catch (Pitfall 1 in RESEARCH.md).
- **No `.vercel/` directory is committed** for any of the three projects (confirmed: none found in `frontend/`, `auth-callback/`, or `landing/`; `landing/.gitignore` line 10 explicitly ignores `.vercel`). This confirms all project↔repo linkage across the monorepo has always been dashboard-managed, never CLI-managed — reinforcing D-01's decision to hand the user a manual runbook rather than attempt `vercel link`/`vercel deploy` via CLI.
- **Ignored Build Step** is configured per-project in the dashboard (Settings → Build and Deployment), not in `vercel.json` — Vercel does not expose this as a JSON key. This phase's D-02 scopes this setting to the new `landing/` project only; `frontend/` and `auth-callback/`'s existing settings (whatever they currently are) are out of scope and must not be touched.

## CTA Verification Source of Truth

`landing/src/consts.ts` (lines 3-6) — the single source of truth for the two CTA destinations success criterion #4 verifies:

```typescript
export const CTA_URLS = {
  getStarted: 'https://app.realtybase.ca/create',
  login: 'https://app.realtybase.ca/auth/login',
} as const
```

Confirmed baked into the static build output verbatim as `<a href="https://app.realtybase.ca/create">` / `<a href="https://app.realtybase.ca/auth/login">` across `nav-get-started`, `nav-login`, `hero-get-started`, `value-prop-get-started`, `closing-get-started`, `closing-login` element IDs (per RESEARCH.md's direct inspection of `landing/dist/index.html`). No component file needs to be read or modified to verify this — the curl/grep recipe in RESEARCH.md's "Code Examples" section is sufficient and should be used as-is by the planner.

## Shared Patterns

### Dashboard-managed project configuration (all three Vercel projects)
**Source:** `frontend/vercel.json`, `auth-callback/vercel.json`, `landing/vercel.json` (see excerpts above)
**Apply to:** The runbook step that creates the new `landing/` project — Root Directory and Ignored Build Step must be set in the Vercel dashboard, never added as new keys to `landing/vercel.json`. Do not suggest adding a `rootDirectory` or `ignoreCommand` key to `vercel.json` — neither is a supported/expected key for these settings in this monorepo's established pattern.

### Verification-by-HTTP-fetch (no code changes required)
**Source:** RESEARCH.md "Code Examples" section (curl recipe, lines ~183-197 of 45-RESEARCH.md)
**Apply to:** The verification half of this phase's plan — grep the fetched HTML for the Astro `generator` meta tag, page `<title>`, and the two literal `href="https://app.realtybase.ca/..."` strings. This is the entire "pattern" this phase needs; it is a shell command, not a codebase code pattern.

## No Analog Found

Not applicable in the usual sense — there is no *missing* analog because there is no new file requiring one. If a future phase needs a genuinely new Vercel project config pattern (e.g., adding a fourth project with SSR requirements), none of the three existing `vercel.json` files models that case; `landing/`'s static-Astro-build shape and `frontend/`/`auth-callback`'s SPA-rewrite shape are the only two patterns present in this codebase today.

## Metadata

**Analog search scope:** Repo root (`vercel.json` in `landing/`, `frontend/`, `auth-callback/`), `landing/src/consts.ts`, `landing/.gitignore`, git remotes for all three sub-repos, filesystem check for `.vercel/` directories.
**Files scanned:** 3 `vercel.json` files, 1 `consts.ts`, 1 `.gitignore`, 3 git remote configs — all read-only, none modified.
**Pattern extraction date:** 2026-07-31
