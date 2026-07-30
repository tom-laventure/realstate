# Phase 42: Scaffold + Stack Setup - Pattern Map

**Mapped:** 2026-07-30
**Files analyzed:** 10
**Analogs found:** 8 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `landing/package.json` | config | batch (build-time) | `frontend/package.json` | role-match (different framework, same "independent deployable" role) |
| `landing/.nvmrc` | config | batch (build-time) | `frontend/.nvmrc` | exact |
| `landing/tsconfig.json` | config | transform (type-check) | `frontend/tsconfig.json` | role-match (Astro strict preset differs, but same strict-TS intent) |
| `landing/astro.config.mjs` | config | transform (build) | `frontend/vite.config.ts` | role-match (closest thing to a "bundler config" analog in this repo) |
| `landing/vercel.json` | config | request-response (routing/deploy) | `auth-callback/vercel.json` | exact (precedent for minimal independent Vercel project config) |
| `landing/.gitignore` | config | n/a | `frontend/` (gitlink, no nested `.gitignore` needed) / root `.gitignore` | no analog — see "No Analog Found" |
| `landing/src/styles/global.css` | utility (CSS entrypoint) | transform (static tokens) | `frontend/src/index.css` + `frontend/src/assets/config/colorSchemes.ts` (`slate` entry) | exact (explicit source-of-truth per RESEARCH.md) |
| `landing/src/layouts/BaseLayout.astro` | component (layout/shell) | request-response (page shell) | no direct analog in `frontend/` (React SPA has no `.astro` layout) — closest conceptual analog is `frontend/index.html` (static `<head>` shell) | role-match, weak |
| `landing/src/pages/index.astro` | component (page) | request-response | no direct analog (D-01 explicitly scopes this to a bare placeholder, not a real page pattern) | no analog — see "No Analog Found" |
| `landing/public/favicon_transparent.png` | static asset | file-I/O (copy as-is) | `frontend/public/favicon_transparent.png` | exact (reuse verbatim per CONTEXT.md) |

## Pattern Assignments

### `landing/vercel.json` (config, request-response/deploy routing)

**Analog:** `auth-callback/vercel.json` (full file, 5 lines)

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Key difference to apply:** `auth-callback/`'s rewrite exists because it's a zero-build static SPA-style passthrough (all routes serve one `index.html`). `landing/` is an Astro **multi-page static build** (`dist/` output with real per-route HTML files from `src/pages/*.astro`), so it does NOT need this catch-all rewrite — Vercel's zero-config Astro static preset serves each built route directly. Per ARCHITECTURE.md Pattern 3 and Integration Points table: "`landing/vercel.json` should stay minimal ... add only if a specific need arises." For this phase (scaffold only, no redirects needed yet), the correct pattern to copy is the *file's existence and minimalism*, not its rewrite content — start with `{}` or omit the file entirely until a real redirect need appears in a later phase.

---

### `landing/src/styles/global.css` (utility, static CSS tokens)

**Analog:** `frontend/src/index.css` (167 lines) merged with `frontend/src/assets/config/colorSchemes.ts` lines 12-31 (`slate` entry)

**Tailwind v4 import + `@theme inline` mapping pattern** (`frontend/src/index.css` lines 48-88, copy verbatim — token names must match so `bg-background`, `text-primary`, `border-border` etc. resolve):
```css
@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}
```
(`--radius-*`/`--color-sidebar-*` are harmless if `landing/` doesn't use a sidebar; keep the full block for consistency with the shadcn token convention rather than hand-pruning it.)

**Merged Slate `:root` block — computed by this agent by layering `colorSchemes.ts` lines 16-30 (`slate.vars`) on top of `frontend/src/index.css` lines 90-124 (base `:root`), exactly as `applyColorScheme()` (lines 153-165 of `colorSchemes.ts`) does at runtime.** This is the static, pre-merged result RESEARCH.md/STACK.md instructs to paste — light mode only, no `.dark { }` block:
```css
:root {
  --radius: 0.625rem;
  --background: oklch(0.97 0.003 256);
  --foreground: oklch(0.141 0.005 285.823);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.141 0.005 285.823);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.141 0.005 285.823);
  --primary: oklch(0.39 0.035 256);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.967 0.001 286.375);
  --secondary-foreground: oklch(0.21 0.006 285.885);
  --muted: oklch(0.967 0.001 286.375);
  --muted-foreground: oklch(0.552 0.016 285.938);
  --accent: oklch(0.967 0.001 286.375);
  --accent-foreground: oklch(0.21 0.006 285.885);
  --destructive: oklch(0.59 0.21 25);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.92 0.004 286.32);
  --input: oklch(0.92 0.004 286.32);
  --ring: oklch(0.705 0.015 286.067);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.39 0.035 256);
  --sidebar-foreground: oklch(0.97 0 0);
  --sidebar-primary: oklch(0.65 0.05 256);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.46 0.035 256);
  --sidebar-accent-foreground: oklch(0.97 0 0);
  --sidebar-border: oklch(0.32 0.03 256);
  --sidebar-ring: oklch(0.705 0.015 286.067);
}
```
Rows changed by the Slate override vs. base `:root` (for the source-drift comment required by PITFALLS.md Pitfall 7): `--background`, `--primary`, `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border` (values that differ from base); `--card`, `--card-foreground`, `--primary-foreground`, `--border` are also in `slate.vars` but happen to equal the base value already.

**Base-layer `@layer base` reset** (`frontend/src/index.css` lines 161-167, optional but recommended for token consistency):
```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Tailwind v4 import statement pattern** — `frontend/src/index.css` line 5 uses `@import "tailwindcss";` (plus `@import "tailwindcss/preflight"` and `@tailwind utilities` on lines 1 and 4, an artifact of frontend's specific setup with `tailwindcss-animate`). Per ARCHITECTURE.md Pattern 2, `landing/`'s `global.css` only needs the single-line form since there's no animate plugin dependency:
```css
@import "tailwindcss";
```

**Required top-of-file comment (Pitfall 7 mitigation, mandated by CONTEXT.md canonical_refs):** Add a comment noting the source: `/* Slate scheme tokens copied from frontend/src/index.css (base :root, lines 90-124) merged with frontend/src/assets/config/colorSchemes.ts 'slate' entry (lines 12-31), as of commit <HEAD sha at scaffold time>. Static copy — not build-time linked. Re-copy manually if the Slate palette changes. */`

---

### `landing/astro.config.mjs` (config, build transform)

**Analog:** `frontend/vite.config.ts` (full file, 26 lines) — closest existing "bundler config registers Tailwind's Vite plugin" pattern in this repo, even though Astro's config shape differs from raw Vite's.

**Plugin registration pattern to mirror** (`frontend/vite.config.ts` lines 5-9):
```typescript
export default defineConfig(async () => {
    const { default: tailwindcss } = await import('@tailwindcss/vite')

    return {
        plugins: [react(), tailwindcss()],
```

**Astro-native equivalent** (per STACK.md/ARCHITECTURE.md Pattern 2 — this is the target shape for `landing/astro.config.mjs`, not copied from an existing file since no `.astro` config exists yet in this repo):
```javascript
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  vite: { plugins: [tailwindcss()] },
})
```
No `@astrojs/vercel` adapter, no `output: 'server'` — static output is the default and correct choice (ARCHITECTURE.md Pattern 3, STACK.md "What NOT to Use").

---

### `landing/package.json` (config, independent deployable)

**Analog:** `frontend/package.json` (full file, 106 lines) — same *role* (independent Vercel-deployed project with its own lockfile) but almost entirely disjoint dependency set; do not copy dependencies, only structural conventions.

**Conventions to mirror:**
- `"private": true`, `"type": "module"` (`frontend/package.json` lines 4-5)
- `scripts` block shape — `dev`/`build`/`preview` naming (`frontend/package.json` lines 60-65 for the frontend precedent; landing's equivalent is Astro's own `astro dev`/`astro build`/`astro preview`)
- Keep `tailwindcss` and `@tailwindcss/vite` on matching major.minor (`frontend/package.json` lines 21-22, 102: both pinned to `^4.1.18`) — landing should pin both to the same `4.3.3` line per STACK.md, not mix versions.

**Do NOT copy:** Redux, TanStack Query, Amplify, Mapbox, Radix UI, react-hook-form, etc. — none apply (ARCHITECTURE.md Anti-Pattern 1, STACK.md installation list is the actual source of truth for landing's dependency list).

---

### `landing/tsconfig.json` (config, strict TypeScript)

**Analog:** `frontend/tsconfig.json` (full file, 26 lines)

**Strictness convention to mirror** (lines 2-11):
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
```

Per D-02, `landing/`'s tsconfig should achieve equivalent strictness via Astro's own preset rather than hand-copying this file verbatim — extend `astro/tsconfigs/strict` (documented in ARCHITECTURE.md's recommended structure) which sets `strict: true` and Astro-appropriate `jsx`/`module` settings out of the box:
```json
{
  "extends": "astro/tsconfigs/strict"
}
```
Note: `frontend/tsconfig.json` sets `"jsx": "react-jsx"` (line 17) and a `"@/*": ["./src/*"]` path alias (lines 19-21) — these are React-SPA-specific and should NOT be copied into `landing/`; Astro components don't use the React JSX transform or this repo's `@` alias convention unless a specific need arises later.

---

### `landing/.nvmrc` (config)

**Analog:** `frontend/.nvmrc` (1 line: `22`)

Astro 7 requires Node >=22.12.0 (STACK.md Version Compatibility table), so `landing/.nvmrc` should pin `22` to match `frontend/`'s existing convention — same major version already satisfies both projects' floors.

---

### `landing/public/favicon_transparent.png` (static asset, file-I/O)

**Analog:** `frontend/public/favicon_transparent.png` — copy byte-for-byte, no transformation. Confirmed present at `frontend/public/favicon_transparent.png` (CONTEXT.md line 55 confirms reuse "as-is per the original ticket").

---

## Shared Patterns

### Vercel Root-Directory-Scoped Project Isolation
**Source:** `auth-callback/vercel.json` + repo structure (`auth-callback/` is a plain tracked dir, `frontend`/`backend` are `160000`-mode gitlinks per `git ls-files -s`)
**Apply to:** `landing/` as a whole — plain tracked directory (not a gitlink), own `package.json`/lockfile, own `vercel.json`, zero shared build tooling with `frontend/`. Confirmed via `git ls-files -s frontend backend auth-callback`: `auth-callback/index.html` and `auth-callback/vercel.json` are mode `100644` (plain files) while `frontend`/`backend` are mode `160000` (gitlinks).

### Root `.gitignore` — do not touch
**Source:** root `.gitignore` (2 lines: `backend`, `frontend`)
**Apply to:** `landing/` must NOT be added here (ARCHITECTURE.md Anti-Pattern 2 — those two entries exist only because `backend`/`frontend` are gitlinks; adding `landing` would make git ignore the entire directory's contents). Instead, `landing/.gitignore` is a new, separate, scoped file (`node_modules/`, `dist/`, `.astro/`, `.vercel/`) — standard `npm create astro@latest` output, no existing analog needed since it's boilerplate the scaffold tool generates automatically.

### Tailwind v4 CSS-token naming convention
**Source:** `frontend/src/index.css` `@theme inline` block (lines 48-88) + `:root`/`.dark` blocks (lines 90-159)
**Apply to:** `landing/src/styles/global.css` — same `--color-*` → `var(--*)` mapping convention, same shadcn/ui-style token names (`--background`, `--primary`, `--border`, etc.), even though `landing/` has its own separate Tailwind config and no dark-mode block (marketing site, light-mode only per STACK.md).

### PostCSS is not needed for `landing/`
**Source:** `frontend/postcss.config.cjs` (`@tailwindcss/postcss` + `autoprefixer`)
**Apply to:** N/A — this is a Vite-plugin-based Tailwind integration (`@tailwindcss/vite`) for `landing/`, not the PostCSS plugin path `frontend/` happens to use. Do not create a `landing/postcss.config.cjs`; the `@tailwindcss/vite` plugin registered in `astro.config.mjs` handles this without PostCSS config.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `landing/.gitignore` | config | n/a | No existing nested `.gitignore` precedent in this repo (`frontend`/`backend` are gitlinks, ignored at the root instead; `auth-callback/` has no build artifacts so needs no `.gitignore` at all). Use the standard `npm create astro@latest` scaffold default (`node_modules/`, `dist/`, `.astro/`, `.vercel/`) per ARCHITECTURE.md Anti-Pattern 2 — this is boilerplate, not a pattern to reverse-engineer from existing code. |
| `landing/src/pages/index.astro` | component (page) | request-response | D-01 explicitly scopes this to a bare proof-of-tokens placeholder (heading + a couple Tailwind utility classes using `--primary`/`--background`), not a real page — no existing `.astro` file exists anywhere in this repo to pattern-match against, and CONTEXT.md explicitly defers real content (`SiteHeader`/`SiteFooter`/nav/sections) to Phase 43. Use RESEARCH.md's Pattern 4 example (`BaseLayout.astro` `<Analytics />` snippet, ARCHITECTURE.md lines 137-150) as the only available reference shape, scaled down to remove `<Analytics />` and OG/meta tags (out of scope this phase per domain boundary). |
| `landing/src/layouts/BaseLayout.astro` | component (layout) | request-response | No `.astro` layout precedent exists in this repo (React SPA has no equivalent shell abstraction — `frontend/index.html` is the closest static `<head>` shell but it's plain HTML, not a reusable component). Follow ARCHITECTURE.md's Recommended Project Structure description (lines 58-59): `<html>`/`<head>` shell with meta tags, favicon, global styles import — but per D-01, omit `<Analytics />`, OG tags, and sitemap link this phase (those are Phase 43+ concerns per the domain boundary in CONTEXT.md line 9). |

## Metadata

**Analog search scope:** `auth-callback/`, `frontend/` (top-level config files: `package.json`, `tsconfig.json`, `tailwind.config.js`, `vite.config.ts`, `postcss.config.cjs`, `.nvmrc`), `frontend/src/index.css`, `frontend/src/assets/config/colorSchemes.ts`, `frontend/public/`, root `.gitignore`, `git ls-files -s` (gitlink verification)
**Files scanned:** 12
**Pattern extraction date:** 2026-07-30
