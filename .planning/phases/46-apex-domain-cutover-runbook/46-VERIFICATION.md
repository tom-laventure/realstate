---
phase: 46-apex-domain-cutover-runbook
verified: 2026-07-31T00:00:00Z
status: passed
score: 13/13 must-haves verified
overrides_applied: 0
---

# Phase 46: Apex Domain Cutover Runbook Verification Report

**Phase Goal:** Produce a complete, human-executable apex domain cutover runbook for realtybase.ca (DNS changes, Vercel dashboard detach/attach steps, BrokerageDomain/CORS audit + TTL-lowering checklist item, and explicit confirmation that no live DNS/domain change is executed in this milestone) per REQ DEPLOY-03. This phase is documentation-only by design.
**Verified:** 2026-07-31 (re-run against live codebase)
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (merged from ROADMAP success criteria + both PLAN frontmatters)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A written runbook lists the DNS changes required to point `realtybase.ca` at the `landing/` Vercel project (ROADMAP SC1) | ✓ VERIFIED | `46-RUNBOOK.md` Section 3 (lines 146-155) states the "DNS change" is a Vercel dashboard reassignment (already done in Section 2), not a registrar edit, and names `ns1.vercel-dns.com`/`ns2.vercel-dns.com` — confirmed nameserver claim is consistent with `landing/astro.config.mjs:9` (`site: 'https://realtybase.ca'`, bare apex canonical) |
| 2 | The runbook documents the Vercel dashboard steps for assigning the apex domain to the `landing/` project (ROADMAP SC2) | ✓ VERIFIED | Section 2 (lines 118-144): explicit detach-from-`frontend`-then-attach-to-`realstate` numbered sequence, downtime warning, wildcard-preservation warning, report-back list, warning signs |
| 3 | The runbook includes an explicit checklist item to audit backend `BrokerageDomain` rows and the CORS allowlist for stale bare-apex references before cutover, plus lowering DNS TTL ahead of time (ROADMAP SC3) | ✓ VERIFIED | Section 1.3 (`bin/rails runner "puts BrokerageDomain.where(domain: [...]).to_a.inspect"`), 1.4 (`PORTAL_DOMAIN`/`APP_BASE_DOMAIN` env audit), 1.5 (cleared CORS/middleware files), 1.6 (TTL decision rule with 60s/300s thresholds) |
| 4 | The runbook is committed to the repo as documentation, with no DNS/domain changes actually executed during this milestone (ROADMAP SC4) | ✓ VERIFIED | `git log` shows `8cdf1cd`/`b896c12` (Task 1) and follow-on commits through `27a6c31` under `.planning/phases/46-apex-domain-cutover-runbook/`; `git status --porcelain -- landing/` empty; `git -C backend status --porcelain -- .../google_oauth_controller.rb` empty; monorepo-root `git status --porcelain` shows only untracked `.planning/` files (pre-existing, unrelated to Phase 46 content changes) |
| 5 | A human with Vercel/Rails-console/Search-Console access can execute the cutover from the runbook alone, without a follow-up question | ✓ VERIFIED | Runbook is self-contained: Preconditions section, 6-part audit, exact copy-pasteable commands (16 fenced code blocks), named dashboard labels, explicit pass/fail decision rules per subsection, warning-signs callouts throughout |
| 6 | The runbook states the DNS change is a Vercel dashboard domain reassignment, not a registrar record edit | ✓ VERIFIED | Section 3 opening paragraph, explicit "Do not go looking for a registrar login" instruction |
| 7 | Ordered detach-then-attach Vercel sequence, flagged downtime window, warning against removing the wildcard entry | ✓ VERIFIED | Section 2 steps 2-3 (Remove at line 125 precedes Add at line 127 — reconfirmed via sweep), explicit downtime paragraph, explicit wildcard-preservation warning |
| 8 | Pre-cutover audit names `google_oauth_controller.rb:77` with trigger condition/fix, `BrokerageDomain` re-check command, TTL-check step | ✓ VERIFIED | Section 1.2 states exact trigger (10-minute `cal_oauth_state` cache eviction), both fixes, deployment-before-Section-2 requirement; matches the live file exactly (`sed -n '77p'` reproduces the cited line verbatim) |
| 9 | Post-cutover section covers only cache/index/cookie concerns: `curl -I` header check, GSC re-crawl + sitemap resubmission, browser stale-cookie check | ✓ VERIFIED | Section 4.1-4.3 scoped exactly to those three concerns; `grep -icE 'web analytics|noindex'` returns `0` |
| 10 | Every embedded finding carries a visible 2026-07-31 snapshot caveat instructing re-verification | ✓ VERIFIED | Top-of-document blockquote banner (line 3) plus per-section re-verify restatements (1.1 decision rule, 1.3 dev-vs-prod caveat, Appendix "How to re-verify" column) |
| 11 | No DNS record, Vercel domain assignment, `BrokerageDomain` row, or source file under `backend/`, `frontend/`, or `landing/` is changed by this plan | ✓ VERIFIED | Independently reconfirmed: `git status --porcelain -- landing/` empty, `git -C backend status --porcelain -- .../google_oauth_controller.rb` empty, `grep -c 'ENV.fetch("FRONTEND_URL", "https://realtybase.ca")'` returns `1` (original fallback string untouched) |
| 12 | Locked decisions D-02 through D-08 (46-CONTEXT.md) implemented in the runbook exactly as specified | ✓ VERIFIED | Cross-checked runbook prose against `46-CONTEXT.md` D-01 through D-09 line by line — all represented; D-09 enforced as an absence |
| 13 | Every locked decision D-01–D-09 provably represented via automated assertion (not reading impression); D-09 exclusion holds; nothing executed | ✓ VERIFIED | Independently re-ran `/tmp/46-sweep.sh` in this verification session — **30/30 assertions PASS, 0 FAIL, `SWEEP_OK`** (fresh execution, not trusting the SUMMARY's reported result) |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md` | Complete apex cutover runbook, ≥180 lines, contains `## Section 2 — Vercel Dashboard Steps` | ✓ VERIFIED | 234 lines, 8 top-level sections in ascending order (lines 1, 7, 18, 118, 146, 157, 209, 222), 16 fenced code-block delimiters |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `46-RUNBOOK.md` | `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb:77` | named file:line finding with recommended fix | ✓ WIRED | Line quoted verbatim in runbook matches live file's line 77 exactly (byte-for-byte, reconfirmed via `sed -n '77p'`) |
| `46-RUNBOOK.md` | production `BrokerageDomain` table | `bin/rails runner` re-check command | ✓ WIRED | Command present, status-unscoped rationale matches live `cors.rb` (`BrokerageDomain.exists?(domain: host)`, no status filter) vs. `domain_redirect_middleware.rb` (`status: [:active, :phasing_out, :frozen]`) asymmetry exactly as documented |
| `46-RUNBOOK.md` | `landing/` Vercel project (`realstate`) | detach-then-attach dashboard sequence | ✓ WIRED | Section 2 names `realstate` and its Phase 45 provenance correctly |

### Behavioral Spot-Checks / Probe Execution

Documentation-only phase — no runnable application code was produced. The phase's own verification mechanism is a shell sweep script (`/tmp/46-sweep.sh`), which functions as this phase's probe. Re-executed independently in this verification session rather than trusting the SUMMARY's reported result:

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| Runbook completeness/scope sweep | `bash /tmp/46-sweep.sh` | `Total failures: 0` / `SWEEP_OK` (30 PASS lines) | PASS |

Additional independent fact-checks performed directly against the live codebase (not sourced from the runbook or SUMMARY):
- `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb:77` — line content matches runbook citation exactly.
- `backend/config/initializers/cors.rb` — confirms no status filter on `BrokerageDomain.exists?`, matching runbook's stated asymmetry.
- `backend/app/middleware/domain_redirect_middleware.rb` — confirms `status: [:active, :phasing_out, :frozen]` filter, matching runbook.
- `backend/app/controllers/concerns/main_domain_only.rb`, `backend/app/controllers/concerns/brokerage_auth.rb` — both key off `PORTAL_DOMAIN`, matching the "not-a-finding" list in Section 1.5.
- `backend/app/mailers/application_mailer.rb:2` — matches the "NOT a finding" grep-table row.
- `backend/app/models/brokerage_domain.rb` — confirmed no `acts_as_paranoid` declaration (supports the audit's status-unscoped query rationale).
- `landing/astro.config.mjs`, `landing/public/robots.txt`, `landing/vercel.json` — all match the runbook's cited values (`site: 'https://realtybase.ca'`, sitemap URL, `Root Directory`/build config).
- `git status --porcelain -- landing/` and `git -C backend status --porcelain -- .../google_oauth_controller.rb` — both empty, confirming zero source changes.
- `git log` — confirms real commits `8cdf1cd`, `b896c12`, `bb5b8cf`, `2929d8e` (checkpoint-pause commit), `27a6c31` (approval-recorded commit), showing a genuine execute→pause→resume checkpoint flow rather than a self-approved claim.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DEPLOY-03 | 46-01-PLAN.md, 46-02-PLAN.md | Apex domain cutover steps documented as manual follow-up, not executed | ✓ SATISFIED | `46-RUNBOOK.md` fully covers DNS, Vercel steps, BrokerageDomain/CORS audit, TTL checklist; zero DNS/Vercel/DB/source changes made |

No orphaned requirements: REQUIREMENTS.md traceability table maps only DEPLOY-03 to Phase 46, and both plans declare `requirements: [DEPLOY-03]`.

### Anti-Patterns Found

None. `grep -n -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` and a case-insensitive scan for "placeholder|coming soon|not yet implemented|not available" against `46-RUNBOOK.md` both return zero matches. No debt markers found.

### Human Verification Required

None outstanding. The phase's plan (`46-02-PLAN.md` Task 2) includes a `checkpoint:human-verify` gate requiring developer sign-off on runbook executability. Evidence this already occurred, not merely claimed:
- Git history shows a genuine pause/resume pattern: commit `2929d8e` ("sweep runbook complete, halt at human sign-off checkpoint") followed by `27a6c31` ("record developer approval, close plan 46-02").
- `.planning/STATE.md` records the resume-signal `"approved"` with no issues raised.
- `46-02-SUMMARY.md` documents all eight review points and four ROADMAP criteria as explicitly confirmed.

This checkpoint was executed and recorded during phase execution itself (not deferred to this verification pass), and the document's content is independently machine-verifiable (facts cross-checked against live code above), so no further human action is required from this verification.

### Gaps Summary

No gaps found. All ROADMAP Phase 46 success criteria, all PLAN-frontmatter must-haves across both plans, and the DEPLOY-03 requirement are verified against the live codebase — not merely asserted in SUMMARY.md. The runbook's cited file:line findings, code behavior descriptions, and status-asymmetry rationale were independently re-derived from the current backend/landing source and match exactly. The completeness sweep script was re-executed fresh in this verification session (not trusted from the SUMMARY) and passed 30/30. Git state confirms zero DNS, Vercel, database, or source-file changes outside `.planning/`.

---

_Verified: 2026-07-31_
_Verifier: Claude (gsd-verifier)_
