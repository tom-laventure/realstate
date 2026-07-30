# Pitfalls Research

**Domain:** Standalone Astro/Tailwind marketing site added as a third Vercel project in an existing monorepo, taking over the apex domain of a live multi-tenant SaaS
**Researched:** 2026-07-30
**Confidence:** HIGH (Vercel monorepo/root-directory behavior, Astro env/sitemap config verified against official docs; codebase-specific claims verified by reading `frontend/vercel.json`, `auth-callback/vercel.json`, `frontend/src/assets/config/colorSchemes.ts`, `frontend/.env.example`) / MEDIUM (apex-domain-cutover cache/cookie behavior — verified against Vercel docs and general DNS guidance, not this project's specific DNS provider)

## Critical Pitfalls

### Pitfall 1: Vercel "Root Directory" misconfiguration builds/serves the wrong folder

**What goes wrong:**
The repo already runs two independent Vercel projects out of one monorepo (`frontend/` and `auth-callback/`), each configured entirely via the dashboard's per-project "Root Directory" setting — neither `vercel.json` (both are byte-identical SPA-rewrite configs) contains any hint of which folder it belongs to. Adding a third project (`landing/`) means a third dashboard-level Root Directory to set correctly. Common failure: the new project is created but Root Directory is left at the repo root (Vercel then can't detect the Astro framework, or worse, picks up `frontend/`'s `package.json`/build output and deploys the React SPA to the apex domain instead of the marketing site). The inverse failure also happens: an existing project's Root Directory gets nudged/reset during setup and starts rebuilding the wrong folder on every push to any of the three apps.

**Why it happens:**
Root Directory lives only in Vercel project settings, not in git — there's no diff, no code review, no test that catches it. It's invisible until a deploy either fails to detect a framework or silently produces the wrong output. Because this repo now has three folders that all look like plausible deploy roots (`frontend/`, `auth-callback/`, `landing/`), it's easy to click the wrong one during project creation, especially since `auth-callback/`'s `vercel.json` gives no textual clue it's scoped to itself.

**How to avoid:**
- When creating the `landing/` Vercel project, explicitly set Root Directory to `landing/` and verify the build log shows Astro's build output (`astro build`, `dist/` output), not Vite's.
- Add an "Ignored Build Step" (`git diff --quiet HEAD^ HEAD -- landing/`, or Vercel's built-in monorepo path filter) to each of the three projects so a commit touching only `backend/` or `frontend/` doesn't trigger a rebuild of `landing/` and vice versa — this also prevents accidental cross-deploys when someone's mental model of "which project builds what" is stale.
- After first deploy, sanity-check the live preview URL content (not just "build succeeded") before attaching the apex domain.

**Warning signs:**
- Build log doesn't mention Astro, or mentions `vite build`/`npm run build` from the wrong `package.json`.
- Deploy succeeds suspiciously fast/slow relative to the other two projects.
- Preview URL shows the React app's login screen instead of the marketing page (or vice versa on `frontend`/`auth-callback` after a landing-site change).

**Phase to address:**
Vercel project setup/deployment configuration phase — should be validated on a preview deployment *before* the domain cutover phase, never combined into the same step as attaching `realtybase.ca`.

---

### Pitfall 2: Apex domain cutover ships DNS/cache/index debt from the previous portal

**What goes wrong:**
`realtybase.ca` was just freed from an existing portal (the live SaaS). Simply repointing the apex to the new `landing/` Vercel project doesn't erase what the old deployment left behind:
- **Stale DNS/edge cache:** browsers and intermediate resolvers may keep serving the old portal (or a Vercel error page) for the old TTL window after cutover, producing "it works for me but not for the user" bug reports.
- **Search engine index:** Google/Bing has old portal pages (login screens, app routes) indexed under `realtybase.ca`. Those stale entries compete with the new marketing site in search results and can look broken/suspicious to prospects clicking through from search.
- **Cookies scoped to the apex:** if the old portal ever set any cookie at `Domain=realtybase.ca` (not scoped to a subdomain), that cookie is visible to every subdomain including the new landing site and `app.realtybase.ca`. It's inert for a static Astro site with no auth, but it's a lingering artifact worth confirming is gone, not assumed gone.
- **Backend config drift:** this codebase's `BrokerageAuth`/`MainDomainOnly`/`DomainRedirectMiddleware` concerns resolve tenancy and main-domain behavior off Host-header matching against `VITE_MAIN_DOMAIN` and `BrokerageDomain` rows. If any `BrokerageDomain` row, env var, or CORS allowlist entry still points at bare `realtybase.ca` (rather than `app.realtybase.ca`), the backend may now be reachable/CORS-permitted from the marketing domain in ways nobody intended, or — worse — `DomainRedirectMiddleware` could 301-redirect apex traffic back into the app if a stale row still treats apex as an active brokerage-routable domain.

**Why it happens:**
Domain cutovers are treated as a DNS-only change ("point the A/CNAME record and you're done"), when in a system this deeply domain-aware (multi-tenant resolution keyed on Host header) the apex domain is also a *logical* identity the backend reasons about, not just a network address.

**How to avoid:**
- Before cutover, grep/audit the backend for any hardcoded or `BrokerageDomain`-row reference to bare `realtybase.ca` and confirm none of them still expect it to resolve to a brokerage/main-domain portal context.
- Lower DNS TTL on the apex record hours ahead of the actual cutover so the change propagates quickly, then restore normal TTL after.
- After cutover, explicitly request re-crawl/verify ownership in Google Search Console for the apex property and submit the new sitemap — don't assume the old index entries silently disappear on their own timeline.
- Confirm via `curl -I` (bypassing local browser cache) that the apex now serves the Astro site's headers/HTML, not a cached asset from the old deploy.

**Warning signs:**
- Users report seeing an old app screen or a Vercel 404 at `realtybase.ca` after the cutover is "done."
- Search results for `realtybase.ca` still show old portal-generated page titles/descriptions weeks later.
- Any backend log entries showing brokerage resolution attempts against bare `realtybase.ca` Host headers post-cutover.

**Phase to address:**
Domain cutover phase (last phase, after the site is built and verified on a preview/staging domain) — should include an explicit backend-config audit step, not just the DNS change.

---

### Pitfall 3: Cross-origin CTA links silently break attribution, and are easy to get subtly wrong

**What goes wrong:**
All CTAs point to a different origin (`app.realtybase.ca/create`, `app.realtybase.ca/auth/login`) than the site itself. This is architecturally simple (`<a href="https://app.realtybase.ca/create">`) but has several easy-to-miss failure modes:
- **Relative-link bug:** copy-pasting an internal nav pattern (`href="/create"`) instead of an absolute cross-origin URL sends the visitor to a 404 on the *marketing* site itself, since `/create` doesn't exist there.
- **Environment leakage:** hardcoding `app.realtybase.ca` directly means every preview deployment of `landing/` also points at production `app.realtybase.ca` — acceptable for CTAs (there's no staging app to point to), but worth being deliberate about rather than accidental, especially if an env-driven pattern is later introduced and a preview build silently falls back to a `localhost` or empty default.
- **Lost attribution:** Vercel Analytics on the marketing site cannot see what happens after a visitor clicks through to `app.realtybase.ca` (separate origin, separate Vercel project, separate analytics context) — there's no way to measure landing-page-to-signup conversion out of the box unless UTM parameters are appended to the CTA hrefs and something on the app side reads/records them.
- **`target="_blank"` reflex:** if any CTA or footer link opens in a new tab, omitting `rel="noopener noreferrer"` allows the opened page limited `window.opener` access to the marketing site — low-severity here (no sensitive state on the marketing site) but still a default hygiene issue, and inconsistent open-in-new-tab behavior across CTAs vs. footer links reads as sloppy.

**Why it happens:**
The team's usual mental model (`frontend/` SPA) is single-origin — internal links are just React Router paths. This is the first surface in the monorepo where "the link target is a fundamentally different app on a different domain" is the *normal* case, not an edge case, so habits from `frontend/` don't transfer directly.

**How to avoid:**
- Centralize the two CTA destinations as named constants (e.g. in an Astro config/consts file) rather than inlining the URL string at every call site — one place to update if the app's create/login paths ever move.
- Use fully-qualified absolute URLs (`https://app.realtybase.ca/...`) everywhere, never relative paths, for any link leaving the marketing site.
- If conversion measurement matters for this milestone (confirm with stakeholders — not explicitly in scope per `.planning/PROJECT.md`'s target features), append UTM params to CTA hrefs now while the link is being built, since retrofitting tracking after launch means re-auditing every CTA later.
- Apply `rel="noopener noreferrer"` to any link using `target="_blank"`.

**Warning signs:**
- QA click-through on the preview deploy 404s because a CTA used a relative path.
- No way to answer "how many landing page visitors signed up" post-launch because nothing carries context across the origin boundary.

**Phase to address:**
Content/CTA implementation phase — should be caught by manual click-through QA on the actual preview deployment (not local dev, where relative-path bugs can accidentally "work" against a locally-served dev app).

---

### Pitfall 4: `astro.config` `site` left unset/wrong breaks sitemap, canonical tags, and robots.txt together

**What goes wrong:**
`@astrojs/sitemap` (and Astro's own canonical URL generation) derive every absolute URL in `sitemap.xml` and `<link rel="canonical">` tags from the `site` value in `astro.config.mjs`. If that's left at a placeholder, a preview/staging value, or omitted, the generated sitemap either fails to build correctly or — worse — silently ships with wrong absolute URLs (e.g. `localhost:4321`, a `*.vercel.app` preview alias, or `www.realtybase.ca` when the canonical choice is bare `realtybase.ca`) baked into every page's canonical tag and the sitemap Google actually crawls. A second, subtler version of this bug: Astro's `build.format`/trailing-slash setting can produce canonical tags with a different path shape (e.g. `/privacy.html` or `/privacy/`) than what the sitemap integration emits (`/privacy`), creating a self-contradicting canonical vs. sitemap mismatch that confuses crawlers about which URL is authoritative.

**Why it happens:**
`site` is easy to treat as a "fill in later" placeholder during scaffolding since the site builds and renders fine locally without it — the breakage is invisible until you inspect `dist/sitemap-index.xml` or view-source the deployed `<head>`.

**How to avoid:**
- Set `site: 'https://realtybase.ca'` (final production apex, decided per this milestone) explicitly in `astro.config.mjs` before adding `@astrojs/sitemap` — don't derive it from a Vercel-provided env var like `VERCEL_URL`, which would leak preview-deployment URLs into a sitemap if a preview build ever runs the same config path.
- Decide and lock the canonical host form (bare apex `realtybase.ca` vs `www.realtybase.ca`) once, and make sure DNS/Vercel domain redirect config, `site`, and any hardcoded `<link rel="canonical">` all agree — do not let this be an implicit per-page decision.
- After first deploy, actually fetch `https://realtybase.ca/sitemap-index.xml` and `robots.txt` and confirm the URLs inside point at the real production domain, not a placeholder.

**Warning signs:**
- `dist/sitemap-index.xml` (build output, inspectable pre-deploy) contains `localhost`, `example.com`, or a `.vercel.app` host.
- View-source on the deployed home page shows a canonical tag pointing somewhere other than the exact URL in the browser bar.

**Phase to address:**
SEO basics phase — verify by inspecting build output before the domain cutover phase, so the sitemap is correct from the very first apex-domain crawl rather than needing a re-crawl later.

---

### Pitfall 5: Preview deployments get indexed as duplicate/thin content

**What goes wrong:**
Vercel preview deployments (`landing-git-<branch>-<team>.vercel.app`) are reachable URLs by default. If `robots.txt`/meta robots aren't environment-aware, every preview build is just as crawlable as production, and search engines can index preview URLs as duplicate — or worse, stale/unfinished — content competing with the real `realtybase.ca` pages. This is especially relevant here because the milestone explicitly ships pages with **placeholder legal text flagged pending review** (Pitfall 6) — an indexed preview URL serving that placeholder text is effectively a public, search-discoverable draft.

**Why it happens:**
It's easy to configure `robots.txt`/canonical/sitemap once for "the site" without considering that Astro's static build runs identically for preview and production deployments unless deliberately branched by environment.

**How to avoid:**
- Add a `noindex` meta tag (or `X-Robots-Tag: noindex` response header) on any non-production environment, driven off `import.meta.env.PROD` or a Vercel-provided env var (`VERCEL_ENV !== 'production'`), rather than shipping one `robots.txt` shared across all deployments.
- Alternatively/additionally, enable Vercel's Deployment Protection on the `landing/` project for preview deployments if broader access control is acceptable for this project.

**Warning signs:**
- `site:*.vercel.app` search shows landing-site preview content indexed.
- `robots.txt` served identically regardless of which deployment URL you hit.

**Phase to address:**
SEO basics phase, alongside the sitemap/canonical work in Pitfall 4.

---

### Pitfall 6: Placeholder legal text ships as if it were final, binding copy

**What goes wrong:**
The milestone spec explicitly calls for "placeholder legal text, flagged pending review" for Privacy Policy and Terms. The risk isn't writing the placeholder — it's that once it's live at a real, indexed, linked-from-the-footer URL, it functions exactly like a real legal page to every visitor, to search engines, and to future engineers who find it months later with no memory that it was a placeholder. Nothing about a public HTML page inherently communicates "this is a draft" the way an internal ticket status does.

**Why it happens:**
"Flagged pending review" is easy to satisfy narrowly (e.g. a one-line dev comment in the `.astro` file, or a Notion ticket noting it's a placeholder) while the actual rendered page a user or crawler sees looks fully authoritative — normal body copy, normal footer link, no visible indication it's provisional. The flag lives in a place only the dev team sees, not in the artifact that's actually public.

**How to avoid:**
- Put the "pending legal review" signal *in the page itself*, visibly (e.g. a banner: "This page is a placeholder and has not yet been reviewed by legal counsel"), not just in a code comment or ticket — this protects against the page being screenshotted, linked, or relied upon before it's reviewed.
- Add `noindex` to these two specific pages via meta robots so they don't get crawled/cached as real legal text by search engines while still in placeholder state (they can still be reached via direct link/footer — this only affects search-engine indexing).
- Per this repo's Notion ticket status policy (see `CLAUDE.md`), the ticket covering this work should not be marked `Done` in a way that implies the legal text itself is finished — the ticket Description should make clear the *placeholder mechanism* shipped, not final legal copy, and a follow-up ticket should exist for the actual legal review.

**Warning signs:**
- Privacy/Terms pages read identically to finished legal copy with no visual distinction.
- The pages are included in the public sitemap/indexed by search engines before legal review happens.

**Phase to address:**
Content pages phase — the visible "pending review" treatment should ship in the same phase as the pages themselves, not deferred to a later "polish" phase that may not happen before launch.

---

### Pitfall 7: Copied (not shared) Slate CSS variables drift from `frontend/`'s source of truth over time

**What goes wrong:**
The Slate scheme is deliberately copied from `frontend/src/assets/config/colorSchemes.ts` into the new Astro project rather than imported/shared (per the milestone's locked decision — not being revisited). That's a reasonable call for a standalone Vercel project with no build-time coupling to `frontend/`, but it creates a silent drift surface: `frontend/`'s `COLOR_SCHEMES` array is a live, actively-edited config (six schemes today, `slate` is `DEFAULT_SCHEME_ID`, and brokerages can pick any of the six per-brokerage). If a future phase tweaks Slate's `oklch()` values, adds new CSS variables to the scheme (the object shape already varies between schemes today — `graphite` defines eleven extra vars like `--muted`, `--popover`, `--ring` that `slate` doesn't), or changes the app's default scheme, the landing site's copy has no mechanism to notice. Nothing fails loudly — the marketing site just slowly stops visually matching the `/create` funnel it's supposed to feel continuous with.

**Why it happens:**
There's no compiler, lint rule, or test connecting the two files — they're in genuinely separate git repos/Vercel projects by design. Visual drift is also gradual and easy to not notice internally (the team sees both regularly and the change feels incremental), while a new visitor going straight from the marketing site into `/create` would notice a jarring color mismatch immediately.

**How to avoid:**
- Copy only the specific CSS variables the landing site actually renders with (background/card/primary/border — it doesn't need sidebar-specific tokens like `--sidebar-accent` unless the landing site literally has a sidebar), and document at the copy site (a comment in the landing project's CSS/Tailwind config) exactly which file and commit it was copied from, so a future diff is at least possible to do manually.
- Add a lightweight recurring reminder (a `.planning` note or a comment referencing `frontend/src/assets/config/colorSchemes.ts`) that the two should be periodically eyeballed for drift — treat it like the plan-tier string duplication this project already tracks elsewhere in `.planning/PROJECT.md` (`PLAN_TIERS`/`PlanTier` duplication) — acceptable now, but worth a "revisit if X happens" note rather than being silently forgotten.
- Don't try to reintroduce sharing (e.g. importing across repos, npm-publishing a shared tokens package) unless drift actually becomes a real, observed problem — that's explicitly out of scope for this milestone's locked decisions.

**Warning signs:**
- A future `frontend/` PR changes `COLOR_SCHEMES` Slate values or `DEFAULT_SCHEME_ID` with no corresponding landing-site follow-up.
- Visual QA comparing the landing site's hero/CTA colors against the actual `/create` wizard shows a mismatch.

**Phase to address:**
Not a phase to "fix" (it's an accepted tradeoff of the locked decision) — but the visual-design phase should document the copy source explicitly so future drift is at least detectable, and it's worth flagging in the roadmap's technical-debt notes the same way this project already tracks the `PlanTier` duplication.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Copying Slate CSS vars instead of sharing a tokens package across repos | No cross-repo build coupling; ships fast in an isolated Vercel project | Silent visual drift from the app's palette over time (Pitfall 7) | Acceptable now (explicitly locked for this milestone) — revisit only if drift is actually observed |
| Hardcoding `app.realtybase.ca` CTA URLs instead of an env-driven config | One less env var to configure per environment | If a staging app environment is ever introduced, every CTA needs manual re-audit | Acceptable — no staging app exists to point to today |
| Shipping placeholder legal text instead of blocking launch on legal review | Unblocks the rest of the marketing site launch | Risk of the placeholder being mistaken for final (Pitfall 6) if not visibly flagged on-page | Acceptable only if the on-page "pending review" banner + `noindex` ship in the same phase, per Pitfall 6 |
| No UTM/conversion tracking passthrough on CTAs at launch | Simpler CTA implementation, faster ship | No way to measure landing-page → signup conversion; retrofitting requires re-touching every CTA | Acceptable only if conversion measurement is explicitly deferred/out of scope — confirm with stakeholders before assuming |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|--------------|-----------------|--------------------|
| Vercel monorepo (3 projects, 1 repo) | Root Directory left at repo root, or copied from the wrong existing project during setup, on the new `landing/` project | Explicitly set Root Directory to `landing/`; verify build log shows Astro output before attaching any domain (Pitfall 1) |
| Apex domain DNS cutover | Treating the DNS record change as the entire cutover, ignoring backend `BrokerageDomain`/`MainDomainOnly` config that may still reference bare `realtybase.ca` | Audit backend domain config for stale apex references before cutover; verify via `curl -I` post-cutover, not just browser refresh (Pitfall 2) |
| `@astrojs/sitemap` | Leaving `site` in `astro.config.mjs` unset or derived from a Vercel preview env var | Hardcode the final production apex URL in `site`; never derive from `VERCEL_URL` (Pitfall 4) |
| Cross-origin CTAs (`app.realtybase.ca`) | Using relative paths (`/create`) that 404 on the marketing site's own origin | Always use fully-qualified absolute URLs for any link leaving the marketing site (Pitfall 3) |
| Env vars (Astro vs. this repo's Vite habit) | Copying the `VITE_`-prefix convention from `frontend/.env.example` into the Astro project, expecting it to expose vars client-side | Astro requires the `PUBLIC_` prefix (not `VITE_`) for any env var read in client-facing code/markup — `VITE_`-prefixed vars are meaningless to Astro's own env system |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Unoptimized hero/feature images shipped as raw PNG/JPG | Slow LCP on a page whose entire job is first-impression conversion | Use Astro's built-in `<Image />`/`astro:assets` for automatic optimization/responsive sizing | Immediately noticeable on mobile/slow connections — a marketing site's performance directly affects bounce rate, unlike an internal admin tool |
| Web fonts loaded without `font-display: swap` or preload | Flash of invisible text (FOIT) delays perceived load on first paint | Preload critical fonts, use `font-display: swap` | Immediately, especially on repeat first-visit traffic from ads/search |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Leaving preview deployments publicly crawlable with no `noindex` | Placeholder legal text or unfinished copy gets indexed/screenshotted as if final (Pitfall 5/6) | Environment-aware `noindex` meta/header on non-production deployments |
| `target="_blank"` links without `rel="noopener noreferrer"` | Minor `window.opener` exposure to the linked page | Always pair `target="_blank"` with `rel="noopener noreferrer"` |
| Assuming a cookie/session artifact from the old apex-domain portal is automatically gone after cutover | Stale cookie scoped to `.realtybase.ca` remains set in returning users' browsers indefinitely | Explicitly verify (don't assume) no apex-scoped cookies exist from the prior portal before/after cutover (Pitfall 2) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| CTA click leads to a jarring visual mismatch between marketing site and `/create` funnel | Visitor loses confidence mid-conversion, feels like they left the "real" site | Keep the Slate palette copy visually locked to the app's current Slate values at launch; flag drift for periodic recheck (Pitfall 7) |
| Legal pages read as polished/final while actually being placeholders | Erodes trust if a visitor (or their own lawyer) reads them and later finds they were unreviewed drafts | Visible "pending review" banner on the page itself, not just in internal tracking (Pitfall 6) |
| No indication of what happens after clicking a CTA (new tab? same tab? different site entirely?) | Visitor unsure if they've left the marketing site, hesitates before signing up | Same-tab navigation for primary CTAs (standard SaaS marketing-to-app pattern); reserve new-tab only for genuinely secondary/external links |

## "Looks Done But Isn't" Checklist

- [ ] **Sitemap/robots.txt:** Often generated correctly locally but never verified against the actual deployed URLs — fetch `https://realtybase.ca/sitemap-index.xml` and `robots.txt` post-deploy and confirm every URL is the real production domain, not `localhost`/preview/staging.
- [ ] **CTAs:** Often work in local dev against a local backend but break on the deployed preview because a relative path was used — click-through test every CTA on the actual Vercel preview URL, not `npm run dev`.
- [ ] **Legal pages:** Often ship with placeholder copy that "looks finished" — verify the visible pending-review banner renders, and that the pages are `noindex`'d, before considering the phase complete.
- [ ] **Root Directory / monorepo config:** Often "just works" on first deploy by accident (Vercel guesses right) — explicitly confirm Root Directory in the dashboard rather than trusting that a successful build means it was scoped to the right folder.
- [ ] **Apex domain cutover:** Often considered done once DNS resolves — verify no backend `BrokerageDomain`/CORS/`MainDomainOnly` config still references bare `realtybase.ca` as an app-routable domain, and confirm old portal content is gone from search results (may take days — track it, don't forget it).
- [ ] **Color scheme copy:** Often copied once and never revisited — note the exact source commit/file it was copied from so a future manual diff against `frontend/src/assets/config/colorSchemes.ts` is actually possible.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-------------------|
| Vercel Root Directory misconfigured, wrong content deployed to apex | LOW | Fix Root Directory in dashboard, redeploy — no data involved, purely a config fix; but review how long the wrong content was live and whether search engines crawled it |
| Sitemap/canonical shipped with wrong domain baked in | LOW–MEDIUM | Fix `astro.config` `site`, redeploy, resubmit sitemap in Search Console; stale indexed URLs may take days–weeks to naturally drop from search results |
| Legal placeholder indexed/screenshotted before review | MEDIUM | Add `noindex`, request removal from Google's index via Search Console URL removal tool (temporary, ~6 months), replace with reviewed copy as soon as available |
| Apex domain cutover leaves stale backend config referencing old portal behavior | MEDIUM | Audit and clean up any stale `BrokerageDomain` rows/env vars pointing at bare apex; low risk of data loss since it's a config-only fix, but requires careful backend review given this codebase's Host-header-driven tenancy resolution |
| Color scheme visibly drifted from the app | LOW | Manual diff against current `frontend/src/assets/config/colorSchemes.ts` Slate entry, update the copied values — no architectural change needed, just a content sync |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|-----------------|
| Vercel Root Directory misconfiguration (Pitfall 1) | Vercel project setup/deployment phase | Build log shows Astro output; preview URL renders the marketing site, not `frontend/`'s SPA |
| Apex domain cutover debt (Pitfall 2) | Domain cutover phase (last, after site is verified elsewhere) | `curl -I` against apex post-cutover; backend config audited for stale bare-apex references; Search Console re-crawl requested |
| Cross-origin CTA mistakes (Pitfall 3) | Content/CTA implementation phase | Manual click-through QA on the actual Vercel preview deployment for both CTAs |
| Sitemap/canonical `site` misconfiguration (Pitfall 4) | SEO basics phase | Inspect `dist/sitemap-index.xml` and rendered canonical tags before cutover |
| Preview deployments indexed (Pitfall 5) | SEO basics phase (same phase as Pitfall 4) | `noindex` verified present on non-production `VERCEL_ENV` |
| Placeholder legal text treated as final (Pitfall 6) | Content pages phase (legal pages) | Visible pending-review banner renders on both pages; pages are `noindex`'d; Notion ticket Description reflects placeholder status, not final legal copy |
| Slate palette copy drift (Pitfall 7) | Visual design/styling phase | Copy source (file + reference point) documented in a code comment; flagged as a tracked, accepted tradeoff rather than silently forgotten |

## Sources

- [Vercel: Using Monorepos](https://vercel.com/docs/monorepos) — Root Directory configuration, per-project scoping
- [Vercel Monorepo "Root Directory" Mismatch — Fix Wrong Package](https://latchkey.dev/learn/iac-deploy/vercel-monorepo-root-directory)
- [Vercel: Monorepos FAQ](https://vercel.com/docs/monorepos/monorepo-faq)
- [Vercel: Troubleshooting domains](https://vercel.com/docs/domains/troubleshooting)
- [Vercel: Working with domains](https://vercel.com/docs/domains/working-with-domains) — apex-domain cookie/CAA scoping behavior
- [Astro Docs: Using environment variables](https://docs.astro.build/en/guides/environment-variables/) — `PUBLIC_` prefix requirement for client-exposed vars
- [Astro Docs: Configuration overview](https://docs.astro.build/en/guides/configuring-astro/) — `site` config requirement for sitemap/canonical generation
- [GitHub withastro/astro #11575: Sitemap url and Astro.url mismatch with build.format](https://github.com/withastro/astro/issues/11575) — canonical vs. sitemap URL shape mismatch
- Codebase inspection: `frontend/vercel.json`, `auth-callback/vercel.json` (identical minimal rewrite configs, confirming Root Directory is dashboard-only, not repo-visible)
- Codebase inspection: `frontend/src/assets/config/colorSchemes.ts` (Slate scheme definition, `DEFAULT_SCHEME_ID`, per-scheme variable-shape inconsistency)
- Codebase inspection: `frontend/.env.example` (`VITE_`-prefixed convention this repo's engineers are used to, contrasted with Astro's `PUBLIC_` convention)
- `.planning/PROJECT.md` — this repo's multi-domain architecture (`BrokerageAuth`, `MainDomainOnly`, `DomainRedirectMiddleware`, `BrokerageDomain` lifecycle), existing Notion ticket-status policy referenced for legal-placeholder-ticket handling

---
*Pitfalls research for: Astro/Tailwind marketing landing site — third Vercel project, apex domain cutover*
*Researched: 2026-07-30*
