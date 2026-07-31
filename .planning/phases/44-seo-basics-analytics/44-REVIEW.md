---
phase: 44-seo-basics-analytics
reviewed: 2026-07-31T20:30:32Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - landing/astro.config.mjs
  - landing/package.json
  - landing/public/robots.txt
  - landing/scripts/generate-og-image.mjs
  - landing/src/layouts/BaseLayout.astro
  - landing/src/pages/index.astro
  - landing/src/pages/privacy.astro
  - landing/src/pages/terms.astro
  - landing/src/components/SiteHeader.astro
  - landing/src/components/Hero.astro
  - landing/src/components/ValueProp.astro
  - landing/src/components/ClosingCTA.astro
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 44: Code Review Report

**Reviewed:** 2026-07-31T20:30:32Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the SEO/OG/analytics landing-page changes: sitemap wiring, `robots.txt`, the standalone OG-image generator script, `BaseLayout`'s SEO head block (canonical, OG, Twitter, env-aware `noindex`), per-page descriptions, and the six `@vercel/analytics` `track()` call sites across the four home-page/header components.

No hardcoded secrets, dangerous functions, XSS vectors, or empty-catch patterns were found. `npm run build` was run and the output was inspected directly: `dist/sitemap-0.xml` correctly contains only the home page, `dist/privacy/index.html` and `dist/terms/index.html` both emit `<meta name="robots" content="noindex">`, and canonical/OG/Twitter tags resolve to absolute `https://realtybase.ca/...` URLs as intended. Tracked element IDs are unique across all four components (no collisions), and all `<script>` blocks use safe optional chaining (`?.addEventListener`) so missing DOM nodes fail silently rather than throwing.

Two issues were verified as reproducible defects (not stylistic nitpicks): a robots.txt/`noindex` combination that actively undermines the phase's own de-indexing goal per Google's documented crawler behavior, and a Node engine-version floor in `package.json` that does not actually cover the `generate:og` script — confirmed by running the script against the exact declared minimum Node version (`22.12.0`), which crashes, versus `22.18.0`, which succeeds.

## Warnings

### WR-01: `robots.txt` Disallow + meta `noindex` on the same pages defeats the purpose of `noindex`

**File:** `landing/public/robots.txt:3-4` (interacts with `landing/src/layouts/BaseLayout.astro:37`)
**Issue:** `robots.txt` disallows crawling of `/privacy` and `/terms`, while `BaseLayout.astro` separately emits `<meta name="robots" content="noindex">` on those same two pages (`privacy.astro`/`terms.astro` pass `noindex`). This combination is a well-documented SEO anti-pattern: if a crawler is blocked by `robots.txt` from *fetching* a page, it never sees the page's `<meta name="robots" content="noindex">` tag in the first place. Per Google's own guidance, a URL that is disallowed via `robots.txt` can still be indexed and shown in search results (typically as a bare URL with "No information is available for this page") if it is discovered via an external link — precisely the outcome this phase is trying to prevent for the legal placeholder pages. The `noindex` tag only works if the crawler is *allowed* to crawl the page to see it.
**Fix:** Pick one mechanism, not both. Since the intent is a hard de-index guarantee (per Phase 43 D-09), drop the `Disallow` lines and rely solely on `noindex`, which requires crawlability to take effect:
```
User-agent: *
Allow: /

Sitemap: https://realtybase.ca/sitemap-index.xml
```
The existing `noindex` meta tag on `privacy.astro`/`terms.astro` (BaseLayout.astro:37) already achieves the de-indexing goal without this conflict; the sitemap `filter` in `astro.config.mjs` independently keeps them out of the sitemap, which is unaffected by this issue.

### WR-02: `generate:og` script fails on the Node version declared as the package's minimum supported engine

**File:** `landing/package.json:6-8` (engines), `landing/scripts/generate-og-image.mjs:28`
**Issue:** `package.json` declares `"engines": { "node": ">=22.12.0" }`, but `scripts/generate-og-image.mjs` imports `../src/consts.ts` directly (`import { SITE_NAME } from '../src/consts.ts'`) relying on Node's native, unflagged TypeScript type-stripping. That support is not present in Node 22.12.0 — verified by running the script against Node 22.12.0 exactly:
```
node scripts/generate-og-image.mjs
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts" for .../src/consts.ts
```
The same script succeeds unmodified on Node 22.18.0 (and 22.23.2), where unflagged type-stripping became available. So anyone provisioning exactly the documented minimum Node version — which is the version `npm install`/CI would consider valid per `engines` — gets a hard crash the first time they try to regenerate the OG image (e.g. after a future design-token change, exactly the maintenance workflow the script's own header comment describes). This does not affect `astro build`/production (Astro's Vite pipeline transpiles `.ts` via esbuild independently of Node's loader), so it's scoped to this one dev-tooling script.
**Fix:** Either raise the documented floor to a version verified to support unflagged type-stripping (e.g. `>=22.18.0`), or make the script itself resilient regardless of the declared engines floor, e.g.:
```json
"generate:og": "node --experimental-strip-types scripts/generate-og-image.mjs"
```
or convert the import target to plain JS/JSON so the script has no dependency on Node's TS support at all.

## Info

### IN-01: `BaseLayout.astro` hardcodes the site name instead of reusing the existing `SITE_NAME` constant

**File:** `landing/src/layouts/BaseLayout.astro:40`
**Issue:** `<meta property="og:site_name" content="RealtyBase" />` hardcodes the brand string as a literal, even though `src/consts.ts` already exports `SITE_NAME = 'RealtyBase'` and every other component that needs the brand name (`SiteHeader.astro`, `scripts/generate-og-image.mjs`) imports it from there. `BaseLayout.astro` doesn't import `consts.ts` at all. If the brand name is ever renamed, this tag will silently go stale.
**Fix:**
```astro
---
import { SITE_NAME } from '../consts'
---
...
<meta property="og:site_name" content={SITE_NAME} />
```

### IN-02: Sitemap `filter` hardcodes full URLs that duplicate — rather than derive from — the `site` config value

**File:** `landing/astro.config.mjs:9,12-13`
**Issue:** The `sitemap()` integration's `filter` callback compares against the literal strings `'https://realtybase.ca/privacy/'` and `'https://realtybase.ca/terms/'`, which duplicate the `site: 'https://realtybase.ca'` value two lines above plus an assumed trailing-slash URL shape. If `site` is ever changed (e.g. a domain migration) without updating the filter in lockstep, the string comparison silently stops matching and `/privacy` / `/terms` would leak back into the sitemap with no build error to catch it.
**Fix:** Derive the comparison from the same `site` constant instead of re-typing it:
```js
const SITE = 'https://realtybase.ca'
// ...
sitemap({
  filter: (page) => ![`${SITE}/privacy/`, `${SITE}/terms/`].includes(page)
})
```

### IN-03: Sitemap exclusion list is a manually maintained allowlist, not derived from each page's `noindex` prop

**File:** `landing/astro.config.mjs:12-14`
**Issue:** `BaseLayout.astro` already has a per-page `noindex` prop that determines whether a page should be excluded from search indexing. The sitemap `filter`, however, is a separate, manually maintained list of exact URLs (`/privacy/`, `/terms/`) that has no structural connection to that `noindex` prop. Any future page that passes `noindex` to `BaseLayout` will not automatically be excluded from the sitemap — a developer has to remember to also add it to this list in a completely different file.
**Fix:** Not urgent to change now (the sitemap integration's `filter` API has no visibility into per-page component props, so a full fix requires either a content-collection-driven page registry or a custom sitemap implementation), but worth a comment in `astro.config.mjs` noting the coupling so a future `noindex` page doesn't get missed. If more noindex pages are added, consider maintaining a single exported array of noindex paths in `consts.ts` that both `astro.config.mjs`'s filter and individual pages import, rather than two independent sources of truth.

---

_Reviewed: 2026-07-31T20:30:32Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
