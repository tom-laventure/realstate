# Phase 46: Apex Domain Cutover Runbook - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 2 (1 new documentation artifact, 1 candidate one-line code fix)
**Analogs found:** 2 / 2

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `.planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md` (new) | documentation / runbook | request-response (human-executed dashboard steps, not code) | `checkpoint:human-action` task blocks in `.planning/phases/45-vercel-project-setup-preview-verification/45-01-PLAN.md` (Task 2) and `45-02-PLAN.md` (Task 1), plus `.planning/research/PITFALLS.md` Pitfall 2 entry | role-match (no prior standalone `*-RUNBOOK.md` exists in this repo; closest existing convention is the embedded human-action runbook sections inside Phase 45's PLAN.md files) |
| `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb` (candidate 1-line fix, line 77) | controller | request-response | Itself — no other controller in this codebase has a comparable `ENV.fetch(..., <hardcoded-domain-fallback>)` pattern to copy from; the fix is a self-contained default-value change, not a new pattern | self / no true analog (see "No Analog Found") |

## Pattern Assignments

### `.planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md` (documentation, request-response/human-executed)

**Analog:** `.planning/phases/45-vercel-project-setup-preview-verification/45-01-PLAN.md` (Task 2, lines 148–222) and `45-02-PLAN.md` (Task 1, lines 75–153), supplemented by `.planning/research/PITFALLS.md` Pitfall 2 (lines 32–57).

There is no prior standalone `*-RUNBOOK.md` file in this repo (confirmed: `find .planning -iname "*runbook*"` returns only this phase's own directory). The closest established convention for "ordered dashboard steps a human must execute manually, with a structured report-back" is the `checkpoint:human-action` task blocks embedded in Phase 45's plans. Since Phase 46's deliverable per D-06/D-07 is a **standalone** file (not a PLAN.md task), copy the *prose/structural* conventions from these blocks, not the YAML/XML plan scaffolding around them.

**Numbered, ordered dashboard-step pattern** (`45-01-PLAN.md` lines 171–207):
```markdown
**Run this runbook in the Vercel dashboard, in order.**

**1. Pick the right team.** Use the same team `frontend` and `auth-callback` already live under. ...

**3. Import the right repository — this is the step most likely to go wrong.**
In **Import Git Repository**, click **Import** next to **`tom-laventure/realstate`** — the same repo `auth-callback`'s project already uses.
**Not** `tom-laventure/realstate-fe`. That is the `frontend` SPA's separate repo; it contains no `landing/` folder at all.
...
**Then report back with all five of these:**
1. **The project name** exactly as it appears in the dashboard ...
...
**What a correct build log looks like** ... **Warning signs of a wrong-repo or wrong-Root-Directory build:** ...
```
Copy this shape for Phase 46's Vercel Dashboard Steps section: numbered steps, bold the exact dashboard label being clicked, an explicit "not X, it's Y" callout for the highest-risk step (here: detach-then-attach ordering per D-04, and the brief-downtime warning from RESEARCH.md Pitfall 2), and an explicit "report back" list of what the human must confirm.

**Settings-sweep / confirm-not-just-change pattern** (`45-02-PLAN.md` lines 98–134):
```markdown
**All steps are inside your new landing project — check the project name in the breadcrumb before changing anything on each page.** Do not open `frontend`'s or `auth-callback`'s settings at any point.

**1. Ignored Build Step** — Settings → Build and Deployment → **Ignored Build Step**.
Preferred: choose the dropdown preset ...
If that preset isn't offered on this plan tier, fall back to **Custom** and enter exactly: `git diff HEAD^ HEAD --quiet -- landing/`
**Report which of the two forms you used.** ...
```
Use this pattern for Phase 46's Pre-Cutover Audit and DNS Verification sections: state the dashboard path (`Settings → X → Y`), state the expected/required value, and require the human to report the *actual* observed value rather than just a pass/fail — mirrors D-01's "name the concrete finding" and D-02's "confirmed-empty baseline, re-verify at cutover" instructions.

**Warning-signs / negative-control callout pattern** (`45-01-PLAN.md` lines 203):
```markdown
**Warning signs of a wrong-repo or wrong-Root-Directory build:** `react-scripts`, `Creating an optimized production build...`, or `@aws-amplify` dependencies anywhere in the log. If you see any of those, the project is building `frontend`, not `landing` — say so instead of accepting the green checkmark.
```
Reuse this exact "explicit negative signal, named plainly" shape for the runbook's Post-Cutover Verification section per D-08/D-09: e.g. "Warning sign: `curl -I` returns headers matching the old portal's React SPA instead of Vercel/Astro static-site headers" and "Warning sign: DevTools shows a cookie with `Domain=.realtybase.ca` still set."

**Rollback / reversal framing pattern** (from RESEARCH.md Code Examples, "Rollback" — already drafted, use directly):
```
# Rollback is the same detach/attach mechanism, reversed:
1. landing (realstate) project → Settings → Domains → remove `realtybase.ca`
2. frontend project → Settings → Domains → add `realtybase.ca` back
```
No prior GSD-artifact in this repo has an explicit rollback section to copy structurally, but this content is already fully drafted in `46-RESEARCH.md` under "Code Examples → Rollback" — copy it verbatim into the runbook, with the caveat tag `[ASSUMED — inferred, not verified against a real Vercel session]` preserved.

**Pitfall-entry framing pattern** (`.planning/research/PITFALLS.md` lines 32–57, Pitfall 2):
```markdown
### Pitfall 2: Apex domain cutover ships DNS/cache/index debt from the previous portal

**What goes wrong:**
...
**Why it happens:**
...
**How to avoid:**
- Before cutover, grep/audit the backend for any hardcoded or `BrokerageDomain`-row reference to bare `realtybase.ca` ...
- Lower DNS TTL on the apex record hours ahead of the actual cutover ...
- After cutover, explicitly request re-crawl/verify ownership in Google Search Console ...
- Confirm via `curl -I` (bypassing local browser cache) that the apex now serves the Astro site's headers/HTML ...
**Warning signs:**
- Users report seeing an old app screen or a Vercel 404 at `realtybase.ca` after the cutover is "done."
```
The runbook's Post-Cutover Verification section is, per RESEARCH.md, a direct operationalization of this exact pitfall entry — its four "How to avoid" bullets map 1:1 onto D-08's four required checks (curl -I, Search Console re-crawl + sitemap resubmission, stale-cookie check, backend audit already covered in Pre-Cutover Audit). Copy the bullet ordering.

**Concrete findings to embed verbatim (per D-01/D-02, already-completed first-party investigation — do not re-derive):**
```ruby
# backend/app/controllers/v1/account/calendar/google_oauth_controller.rb:77
frontend_origin = state_data[:frontend_origin] || ENV.fetch("FRONTEND_URL", "https://realtybase.ca")
```
```ruby
# Dev-DB baseline (D-02) — confirmed empty, re-run against production at cutover time
bin/rails runner "puts BrokerageDomain.where(domain: ['realtybase.ca', 'www.realtybase.ca']).to_a.inspect"
```

---

### `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb` (controller, request-response) — candidate pre-cutover fix

**Analog:** none in-codebase (see "No Analog Found" below). Full current file already read; relevant excerpt:

**Current fallback (line 77), the fix target:**
```ruby
# backend/app/controllers/v1/account/calendar/google_oauth_controller.rb:44-79 (callback action)
def callback
  state_data = Rails.cache.read("cal_oauth_state:#{params[:state]}")

  if state_data.nil?
    return render json: {error: "Invalid or expired state parameter"}, status: :unprocessable_entity
  end

  Rails.cache.delete("cal_oauth_state:#{params[:state]}")
  user_id = state_data[:user_id]
  token_response = exchange_code_for_tokens(params[:code])

  unless token_response.success?
    return render json: {error: "Token exchange failed"}, status: :unprocessable_entity
  end

  # ... token persistence (lines 61-75) ...

  frontend_origin = state_data[:frontend_origin] || ENV.fetch("FRONTEND_URL", "https://realtybase.ca")
  redirect_to "#{frontend_origin}/account", allow_other_host: true
end
```

**Recommended fix (per RESEARCH.md D-01 / Pitfall 3), a one-line default-value change:**
```ruby
frontend_origin = state_data[:frontend_origin] || ENV.fetch("FRONTEND_URL", "https://app.realtybase.ca")
```
Rationale already established in RESEARCH.md Pitfall 3: today the fallback's default (`https://realtybase.ca`) accidentally-but-harmlessly resolves to the old portal itself; after this phase's cutover the same fallback would silently redirect an authenticated Google-Calendar-connect user to the marketing landing site instead of the app. This is a **candidate** fix the runbook should recommend as a separate, prior, low-risk pre-cutover step — it is not this phase's own required deliverable (this phase produces documentation only, per `no_source_changes`-equivalent framing carried from Phase 45's pattern) and must not be applied silently; the runbook should name it as an action item for whoever executes the cutover.

**No test file exists for this controller** (`find backend/spec -iname "*calendar*" -o -iname "*oauth*"` returned nothing) — there is no existing spec pattern to extend if this fix is applied in a later phase/plan. Flag this gap in the runbook rather than inventing a test convention here, since this phase does not execute the fix.

## Shared Patterns

### Human-action-only execution mode (Claude has no Vercel/production access)
**Source:** `.planning/phases/45-vercel-project-setup-preview-verification/45-CONTEXT.md` D-01; restated in `45-01-PLAN.md` line 157 (`Claude cannot execute any part of this task: there is no authenticated Vercel session ...`)
**Apply to:** The entire runbook — every Vercel dashboard step and every production Rails-console step must be phrased as an instruction to the human executor, never as something Claude will run. Mirrors D-01's own text in 46-CONTEXT.md: "established pattern of Claude producing an exact ordered runbook for the user to execute manually and report back."

### "Snapshot as of a date, re-verify at execution time" caveat
**Source:** 46-CONTEXT.md D-01/D-02; `46-RESEARCH.md` "Valid until" metadata line (bottom of file)
**Apply to:** Every finding embedded in the runbook (the OAuth fallback finding, the empty dev-DB baseline, the TTL guidance) must carry an explicit "verified 2026-07-31, re-check before executing" caveat — this is the single most-repeated instruction across both CONTEXT.md and RESEARCH.md and should appear as a visible banner near the top of the runbook, not buried per-section.

### Sectioned, independently-skippable structure
**Source:** 46-CONTEXT.md D-07 ("mirroring how ROADMAP.md Phase 46 already breaks success criteria #1–4 into distinct concerns")
**Apply to:** Top-level `##` headers for Pre-Cutover Audit / Vercel Dashboard Steps / DNS Verification / Post-Cutover Verification, each self-contained with its own preconditions stated inline (same convention `45-02-PLAN.md`'s Task 1 uses: "confirm Task 1 succeeded first" before diving into steps).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md` | documentation | n/a | No prior standalone `*-RUNBOOK.md` artifact exists anywhere in `.planning/` (confirmed via repo-wide search) — closest precedent is the embedded human-action task blocks inside Phase 45's PLAN.md files, used above as a structural (not literal) analog |
| `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb` fix | controller | request-response | No other controller in this codebase uses `ENV.fetch(key, "<hardcoded production domain>")` as a redirect-destination fallback — grepped `backend/app` for comparable `ENV.fetch.*https://` patterns, found none. The fix is a self-contained default-value edit with no reusable pattern to copy from elsewhere; treat as isolated |

## Metadata

**Analog search scope:** `.planning/phases/45-vercel-project-setup-preview-verification/`, `.planning/research/PITFALLS.md`, `.planning/ROADMAP.md` Phase 46 section, `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb`, `backend/app/models/brokerage_domain.rb`, repo-wide search for `*runbook*`/`*checklist*` and for comparable `ENV.fetch` redirect-fallback patterns, `backend/spec` search for existing OAuth/calendar controller specs (none found)
**Files scanned:** ~10 (2 target files + 5 Phase 45 planning docs + PITFALLS.md + ROADMAP.md + brokerage_domain.rb)
**Pattern extraction date:** 2026-07-31
