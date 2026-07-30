# Phase 42: Scaffold + Stack Setup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-30
**Phase:** 42-Scaffold + Stack Setup
**Areas discussed:** Scaffold depth, TypeScript usage

---

## Scaffold Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Bare proof-of-tokens page | A single blank page inside BaseLayout showing Slate-colored text/background — proves the CSS tokens and build pipeline work. SiteHeader/SiteFooter/nav built in Phase 43 alongside real content. | ✓ |
| Full skeleton shell | Build SiteHeader and SiteFooter (empty/placeholder nav links, logo) now as part of the scaffold, so Phase 43 only fills in the middle content. | |

**User's choice:** Bare proof-of-tokens page (Recommended)
**Notes:** Keeps the infrastructure phase from front-loading UI work that belongs to Phase 43.

---

## TypeScript Usage

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, TS throughout | Astro's built-in TypeScript support (frontmatter + `<script lang="ts">`), consistent with the rest of the codebase's strict-TS convention. | ✓ |
| Plain JS, no TS | Skip TypeScript entirely given how little interactivity a static marketing site needs. | |

**User's choice:** Yes, TS throughout (Recommended)
**Notes:** Matches `frontend/`'s established strict-TS convention even though `landing/` is a separate, independent project.

---

## Wrap-up check

**Question:** Anything else about scaffold/stack-setup to clarify, or ready for context?
**User's choice:** Ready for context (Recommended)

## Claude's Discretion

- Astro scaffold starting point (`npm create astro@latest` minimal template vs. hand-built) — left to planner/executor
- `package.json` naming, Node version pinning (`.nvmrc`) — low-stakes technical detail, left to planner/executor

## Deferred Ideas

- `arch-brokerage-listing-access.md` pending todo — weak keyword match ("backend") only, reviewed and confirmed unrelated to this phase. Left untouched.
