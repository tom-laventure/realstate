# Phase 45: Vercel Project Setup + Preview Verification - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

`landing/` deploys independently to its own new Vercel project — distinct from the existing `frontend`/`auth-callback` projects — verified to actually serve the Astro output (build log + rendered content + working cross-origin CTAs) before any domain is attached. No DNS/domain work happens here (that's Phase 46).

Maps to REQUIREMENTS.md: DEPLOY-02.

</domain>

<decisions>
## Implementation Decisions

### Execution mode
- **D-01:** Claude has no authenticated Vercel session in this environment (CLI installed via `npx vercel`, confirmed not logged in — `vercel whoami` hung on an interactive OAuth prompt) and no dashboard access. The plan must produce an exact, ordered runbook (New Project → import repo → set Root Directory to `landing/` → deploy) for the user to execute manually in the Vercel dashboard. After the user reports back the deployed `*.vercel.app` URL (and, ideally, a copy/screenshot of the build log), Claude verifies success criteria #2–4 by fetching the live preview URL directly (curl/WebFetch) — checking for Astro-rendered markup and confirming the CTA `<a href>`s resolve to `app.realtybase.ca/create` and `app.realtybase.ca/auth/login`.
- Rejected: Claude driving the Vercel CLI end-to-end — would require the user to run `npx vercel login` interactively first, which is an out-of-band action better kept manual for a one-time dashboard task like this.

### Ignored Build Step scope
- **D-02:** Ignored Build Step configuration (per `PITFALLS.md` Pitfall 1 — prevents a commit touching only `backend/`/`frontend/` from triggering a `landing/` rebuild and vice versa) is scoped to the **new `landing/` project only** in this phase. `frontend/` and `auth-callback/`'s existing working configs are left untouched — retrofitting them is out of scope, not a DEPLOY-02 requirement.

### Preview deployment protection
- **D-03:** Vercel Deployment Protection is explicitly **not** enabled on the new project's preview deployments. Phase 44 already ships environment-aware `noindex`/meta-robots (via `VERCEL_ENV`) covering the search-crawlability concern `PITFALLS.md` raised Deployment Protection as an option for. Leaving previews unprotected keeps this phase's own success criteria #3–4 (rendered content, CTA links) verifiable by Claude fetching the URL directly, rather than requiring a Protection Bypass token or manual screenshots.

### Vercel Web Analytics dashboard toggle
- **D-04:** Enabling the Web Analytics toggle in the new project's Vercel dashboard settings is **out of scope** for this phase, even though Phase 44 already shipped the `<Analytics />` component in code. This phase stays strictly scoped to DEPLOY-02's success criteria (project exists, builds correctly, renders correctly, CTAs work). The toggle is a fast one-click follow-up, but should be tracked so the shipped tracking code isn't silently a no-op indefinitely — flagged under Deferred Ideas below.

### Claude's Discretion
- Exact wording/formatting of the runbook steps handed to the user (dashboard UI navigation copy) — implementation detail for planning/execution.
- Whether build-log verification happens via the user pasting/screenshotting the Vercel dashboard build log, or (if the user later authenticates the CLI) via `vercel inspect`/`vercel ls` — decide at execution time based on what's actually available; either satisfies success criterion #2.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §Requirements — DEPLOY-02 exact requirement text
- `.planning/ROADMAP.md` Phase 45 section — goal, success criteria, depends-on Phase 44

### Milestone Research (directly covers this phase)
- `.planning/research/SUMMARY.md` "Phase 5: Vercel Project Setup + Preview Verification" — delivers list (new project, Root Directory, Ignored Build Step, verified preview) and rationale for isolating this from domain cutover
- `.planning/research/PITFALLS.md` Pitfall 1 (Root Directory misconfiguration — the core risk this phase's verification gate exists to catch) and Pitfall 5 (environment-aware `noindex`, already shipped in Phase 44 — informs D-03 above)
- `.planning/research/STACK.md` "What NOT to Use" — no `@astrojs/vercel` adapter needed; Vercel auto-detects Astro's static preset from `dist/` output with zero extra config, same as `auth-callback/`'s zero-build static deploy

### Prior Phase Decisions (carried forward)
- `.planning/phases/44-seo-basics-analytics/44-CONTEXT.md` — `<Analytics />` mounted cookielessly, environment-aware `noindex` already wired via `VERCEL_ENV !== 'production'` (drives D-03 and D-04 above)
- `.planning/phases/44-seo-basics-analytics/44-PATTERNS.md` — implementation patterns from the phase that shipped the code this phase deploys

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `landing/vercel.json` — already exists (`{"framework": "astro", "buildCommand": "astro build", "outputDirectory": "dist"}`), no changes needed for the build itself; only dashboard-side Root Directory/Ignored Build Step settings remain.
- `landing/src/consts.ts`: `CTA_URLS` — single source of truth for the `app.realtybase.ca/create` and `app.realtybase.ca/auth/login` destinations that success criterion #4 verifies.

### Established Patterns
- `frontend/vercel.json` and `auth-callback/vercel.json` are both minimal, project-agnostic configs — Root Directory and any Ignored Build Step live entirely in Vercel dashboard project settings, not in git. This is the established (if fragile) pattern for this monorepo's 3-project Vercel setup; `landing/`'s project follows the same shape.
- No `.vercel/` directory is committed or present locally for any of the three projects (gitignored) — confirms project linkage has always been dashboard-managed, not CLI-managed, for `frontend`/`auth-callback`.

### Integration Points
- None beyond the Vercel dashboard project-creation flow itself — `landing/` has zero runtime coupling to `backend/`/`frontend/` (per `.planning/research/SUMMARY.md`).

</code_context>

<specifics>
## Specific Ideas

No specific visual/copy references — this phase is pure deploy-infrastructure and verification, no new UI or content.

</specifics>

<deferred>
## Deferred Ideas

- **Enable Vercel Web Analytics dashboard toggle** for the `landing/` project — deferred per D-04. Should happen soon after this phase (a one-click follow-up) so the `<Analytics />` code shipped in Phase 44 isn't silently inert; not a blocker for DEPLOY-02.
- **Retrofit Ignored Build Step onto `frontend/`/`auth-callback/`** — deferred per D-02. Worth doing eventually for build-minute hygiene across all three projects, but not required by this phase's success criteria.

</deferred>

---

*Phase: 45-Vercel Project Setup + Preview Verification*
*Context gathered: 2026-07-31*
