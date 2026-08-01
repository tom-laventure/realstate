# Apex Domain Cutover Runbook — realtybase.ca

> **Snapshot caveat — read this first.** Every finding, file:line reference, and dashboard-state claim below was verified on **2026-07-31**. Code, DNS records, and Vercel project configuration can all drift between now and whenever this runbook is actually executed. **Re-verify every finding immediately before you act on it — do not execute a step on faith just because it's written down here.** Each finding below restates its own re-verify command; that command is not optional busywork, it is how you catch drift before it causes a mistake.

This runbook is a documentation-only deliverable of Phase 46. Writing it did **not** execute any DNS, Vercel, or database change — the only file this phase touched is this one. Everything below is written for a human executor with the access listed in the next section.

## Preconditions & Access Requirements

Before starting, confirm you have all of the following. **Claude cannot perform any step in this runbook** — there is no authenticated Vercel session, no production Rails console, and no Google Search Console access available to it. Every action below is written as an instruction to you, the human executor.

- **Vercel dashboard access** to the team that owns both the `frontend` project (the existing React portal) and the `realstate` project (the Astro `landing/` site, Root Directory `landing/`, created in Phase 45).
- **Production Rails console / `bin/rails runner` access** — needed for the Section 1 `BrokerageDomain` re-check and to deploy the Section 1.2 `FRONTEND_URL` fix.
- **Ability to set a production environment variable and deploy a backend change** — the Section 1.2 OAuth-fallback fix must land in production before Section 2 runs.
- **Google Search Console access** to the `realtybase.ca` property — needed for Section 4.2.
- **A browser that has previously visited `realtybase.ca`** — needed for the Section 4.3 stale-cookie check; a fresh incognito session cannot show you a cookie planted by a prior visit.
- **A low-traffic window** — Section 2's detach-then-attach sequence has a downtime gap; do not run it during peak traffic.

## Section 1 — Pre-Cutover Audit

### 1.1 Re-run the stale-apex grep

Run this exact command from the monorepo root:

```bash
grep -rn "realtybase\.ca" backend/app backend/config | grep -v "app\.realtybase\|PORTAL_DOMAIN\|APP_BASE_DOMAIN"
```

As of **2026-07-31**, this returns exactly three lines. Reproduce the same three-row disposition below and confirm your output still matches it:

| Hit | Disposition |
|-----|-------------|
| `backend/app/mailers/application_mailer.rb:2` — `default from: "noreply@notifications.realtybase.ca"` | NOT a finding — mail subdomain (`notifications.realtybase.ca`), unaffected by the apex reassignment |
| `backend/config/initializers/cors.rb:21` — `source == "https://auth.realtybase.ca"` | NOT a finding — hardcoded allowlist entry for the auth-callback subdomain (`auth.realtybase.ca`), not the bare apex |
| `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb:77` — `frontend_origin = state_data[:frontend_origin] \|\| ENV.fetch("FRONTEND_URL", "https://realtybase.ca")` | **THE FINDING** — see 1.2 |

**Decision rule:** any hit your grep returns that is not one of these three rows is a new finding introduced by code drift since 2026-07-31. Stop and triage it before proceeding past Section 1 — do not assume it's benign just because it wasn't flagged here.

### 1.2 The one confirmed finding — `google_oauth_controller.rb:77`

**File:** `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb:77`

```ruby
frontend_origin = state_data[:frontend_origin] || ENV.fetch("FRONTEND_URL", "https://realtybase.ca")
redirect_to "#{frontend_origin}/account", allow_other_host: true
```

This line assigns `frontend_origin` from `state_data[:frontend_origin]`, falling back to `ENV.fetch("FRONTEND_URL", "https://realtybase.ca")` when that key is absent. The very next line redirects the user's browser to `"#{frontend_origin}/account"` with `allow_other_host: true`.

**Trigger condition, precisely:** `state_data` is read from the `cal_oauth_state:<state>` Rails cache entry, which is written in the controller's `#authorize` action from the request's `Origin` header, with a 10-minute expiry (`expires_in: 10.minutes`). The fallback only fires when that cache entry is missing its `:frontend_origin` key by the time `#callback` runs — which happens if the entry is evicted (Rails cache eviction under memory pressure) or if the user sits on Google's consent screen past the 10-minute window before completing the flow.

**Why the cutover changes its severity:** Today, `https://realtybase.ca` happens to resolve to the old portal (the `frontend` Vercel project) — so a fallback-triggered redirect currently still lands somewhere plausible, on the app itself. **After the apex cutover, the same fallback will silently redirect an authenticated user, mid-Google-Calendar-connect, onto the marketing landing site instead of the app.** This is a real regression introduced specifically by this cutover, not a pre-existing bug you can leave alone.

**Recommended fixes — apply one or both, this is a required pre-cutover action item, not optional:**

1. Set the production environment variable `FRONTEND_URL` explicitly to `https://app.realtybase.ca`.
2. And/or change the code-level default at line 77 from `"https://realtybase.ca"` to `"https://app.realtybase.ca"`.

If you choose option 2, it is a one-line change in the `backend/` sub-repo and **must be deployed to production before Section 2 runs** — Section 2's precondition line below assumes this fix is already live. Note also that **no spec file exists for this controller** (`backend/spec` has no calendar/OAuth controller spec) — there is no existing test to extend, so verify the fix manually or add test coverage deliberately when you make the change.

**This fix was deliberately NOT applied during Phase 46.** Phase 46 is documentation-only per its scope boundary — this finding is named here as an action item for whoever executes the actual cutover, not work this phase performed.

### 1.3 Re-check production `BrokerageDomain` rows

Run this command against **production** — not your local dev database:

```bash
bin/rails runner "puts BrokerageDomain.where(domain: ['realtybase.ca', 'www.realtybase.ca']).to_a.inspect"
```

**2026-07-31 baseline:** the identical query run against the **local dev database** returned empty (`[]`). This proves nothing about production — it is a dev-only baseline, and production must be independently re-verified with the command above at actual cutover time.

**Expected production result:** `[]`.

**Why this query is intentionally status-unscoped:** `backend/config/initializers/cors.rb` calls `BrokerageDomain.exists?(domain: host)` with **no status filter at all** — so even a `decommissioned` row would still grant CORS to the bare apex. Meanwhile `backend/app/middleware/domain_redirect_middleware.rb` filters to `status: [:active, :phasing_out, :frozen]`. Because of this asymmetry, the audit query above must not filter by status either — a `decommissioned` row is invisible to the middleware's routing logic but still visible to CORS.

**Conclusion for the executor:** a returned row of **any** status — including `decommissioned` — is a stop-and-triage condition, not a pass. Do not proceed to Section 2 if this query returns anything other than `[]`.

### 1.4 Confirm production env var values, not code defaults

Check the actual **deployed** values of these two environment variables — not just their code-level defaults:

- `PORTAL_DOMAIN` — expected value: `app.realtybase.ca`
- `APP_BASE_DOMAIN` — expected value: `realtybase.ca`

**`APP_BASE_DOMAIN=realtybase.ca` is correct and expected — do not "fix" it during this audit.** It is used to construct per-brokerage subdomains such as `acme.realtybase.ca` in `domains_controller.rb`/`brokerages_controller.rb`. Bare apex here is by design, not a bug.

### 1.5 Confirmed not-a-finding list

The following files were scouted during planning and confirmed **not** to reference the bare apex in a way that's affected by this cutover — all four resolve main-domain behavior from `PORTAL_DOMAIN` (default `app.realtybase.ca`, a subdomain), never bare apex:

- `backend/config/initializers/cors.rb`
- `backend/app/middleware/domain_redirect_middleware.rb`
- `backend/app/controllers/concerns/main_domain_only.rb`
- `backend/app/controllers/concerns/brokerage_auth.rb`

**Purpose of this list:** a future auditor re-reading this runbook should not need to re-litigate these four files from scratch. They were already cleared; only re-check them if you have a specific reason to suspect drift (e.g. a code change touching one of them since 2026-07-31).

### 1.6 Check the current DNS TTL before deciding whether to lower it

Do not blindly apply generic "lower TTL 24–48h ahead" cutover advice on a Vercel-managed zone — check the actual current value first.

Run:

```bash
dig +noall +answer realtybase.ca A
```

Read the TTL column (the second field of the returned line). Alternatively, check the record directly in the Vercel team-level **Domains** page → `realtybase.ca` → **DNS Records**. Vercel's managed-DNS default is **60 seconds**.

**Decision rule:**
- **TTL at or below 300 seconds** — no action needed. Record the observed value and move on.
- **TTL above 300 seconds** — someone manually raised it at some point. Lower it to 60 seconds in the Vercel DNS Records page, then wait at least twice the previously-observed TTL (minimum 2 hours) before running Section 2, so caches holding the old value have time to expire.

If the higher TTL was raised deliberately for some reason, restore it after Section 4 confirms the cutover is stable.

**Record the actual observed TTL value, not just pass/fail** — a future re-check needs the real number, not a checkbox.

## Section 2 — Vercel Dashboard Steps

**Preconditions for this section:** Section 1 is complete with no unresolved findings, the OAuth fallback fix from 1.2 is already deployed to production, and you have chosen a low-traffic window.

**Downtime warning — read before starting.** Removing `realtybase.ca` from `frontend` leaves it assigned to no project until it is added to `realstate`. Anyone hitting the apex in that window gets a Vercel domain-not-found error, not either site. **Run steps 2 and 3 back-to-back in a single sitting — never "detach today, attach tomorrow."**

1. **Confirm you are in the Vercel team that owns both `frontend` and `realstate`.** Check the breadcrumb on every page before changing anything.
2. In the **`frontend`** project → **Settings** → **Domains**. Locate `realtybase.ca` and click **Remove**.
   Remove the bare apex `realtybase.ca` only — this is **not** the wildcard `*.realtybase.ca` entry, and it's **not** `www.realtybase.ca` either. Do **not** touch a wildcard `*.realtybase.ca` entry if one is listed: it serves every per-brokerage subdomain and must stay assigned to `frontend`. Also, `www.realtybase.ca` is not attached to `frontend` at all — its absence from this list is expected, not a problem.
3. Immediately, in the **`realstate`** project (the Astro `landing/` project from Phase 45 — confirm its **Root Directory** is `landing/` before touching Domains) → **Settings** → **Domains** → **Add**. Enter exactly `realtybase.ca` — bare apex, no `https://`, no `www.` — and submit.
4. Wait for the domain to show **Valid Configuration** and for its SSL certificate to be issued. Because the nameservers already delegate to Vercel, no external DNS record needs hand-editing — Vercel provisions the record and certificate itself.

**Two notes:**

(a) **Optional alternative:** Vercel's REST API "Move a Project Domain" endpoint performs this reassignment as a single atomic call and avoids the gap between steps 2 and 3, worth considering if you're comfortable with an API token. The dashboard path above is this project's established pattern, though, and is the primary path.

(b) **Not applicable — do not confuse the two:** Vercel's **Transfer Project** feature (Settings → General) moves an entire project between teams/accounts with zero downtime. That is **not** what is needed here — both projects already live in the same team, and only one domain is moving, not a whole project.

**Then report back with all five of these:**

1. The exact domain list shown on `frontend` after removal.
2. The exact domain list shown on `realstate` after adding.
3. The configuration status text Vercel displays for `realtybase.ca` on `realstate`.
4. Whether the SSL certificate issued successfully.
5. The wall-clock gap between the remove and add steps.

**Warning signs:** Vercel reports **Invalid Configuration** on the new assignment; the domain still appears under `frontend` after removal; a certificate error or "domain is already in use by another project"; or the wildcard subdomain entry vanished from `frontend`.

## Section 3 — DNS Verification

**The single most important clarification, before any command below:** `realtybase.ca`'s nameservers already delegate to Vercel (`ns1.vercel-dns.com` / `ns2.vercel-dns.com`), which is the only method Vercel supports for the wildcard subdomains this platform depends on. **The "DNS change" this cutover requires is not a registrar-panel A-record or CNAME edit — it is entirely the Vercel dashboard reassignment already performed in Section 2**, after which Vercel updates its own managed record automatically. Do not go looking for a registrar login; it is not the relevant surface for this cutover.

1. `dig +noall +answer NS realtybase.ca` — confirm the answer still lists Vercel's nameservers. If it does not, **stop**: the zone is no longer Vercel-managed and this runbook's assumptions no longer hold.
2. `dig +noall +answer realtybase.ca A` — confirm an A record resolves and record the TTL actually observed. Compare it against the value you recorded in Section 1.6.
3. In the Vercel dashboard: confirm `realtybase.ca` appears under the `realstate` project's Domains with **Valid Configuration**, and no longer appears under `frontend`'s Domains.
4. **Wildcard independence spot-check:** pick an existing per-brokerage subdomain used for manual QA, resolve it, and load it in a browser — it must still serve the portal from `frontend`, unchanged. The wildcard record and the apex record are independent entries in the same Vercel-managed zone, so reassigning the apex's project target does not move the wildcard's. This step proves that held true in practice rather than assuming it.

**Warning signs:** `dig` returns NXDOMAIN or no A record; Vercel shows **Invalid Configuration**; the brokerage subdomain now serves the marketing site or errors.

## Section 4 — Post-Cutover Verification

**Precondition:** Section 3 passed and the domain shows Valid Configuration.

### 4.1 Confirm what the apex is actually serving (cache check)

```bash
curl -sI https://realtybase.ca
```

Expect HTTP 200 and Vercel-served response headers. Then inspect the actual HTML:

```bash
curl -s https://realtybase.ca | head -40
```

**Positive signals:** the Astro-built landing markup and the page title/copy shipped in Phase 43.

**Warning signs (negative):** any React SPA shell from the old portal — `react-scripts`, an empty `<div id="root">`, `@aws-amplify` bundle references, or a login screen.

**Why `curl` and not a browser:** it bypasses local browser cache entirely, so it shows what Vercel's edge is really returning right now.

Two supporting checks:

```bash
curl -sI https://realtybase.ca/sitemap-index.xml
```

should return 200, and:

```bash
curl -s https://realtybase.ca/robots.txt
```

should contain the line `Sitemap: https://realtybase.ca/sitemap-index.xml`.

### 4.2 Search index (Google Search Console)

Open the `realtybase.ca` property in Search Console and confirm ownership verification still passes after the cutover. Submit the sitemap `https://realtybase.ca/sitemap-index.xml`, and use URL Inspection → **Request Indexing** for the apex root `https://realtybase.ca/`.

**Deliberate exception:** do not request indexing for `/privacy` or `/terms` — `landing/public/robots.txt` disallows both by design.

Old portal routes indexed under the apex will not vanish on their own timeline. If a specific stale URL is visibly embarrassing in search results, use Search Console's **Removals** tool for it rather than waiting.

### 4.3 Stale apex-scoped cookie check — this is a browser check, not a grep

Open a browser that has previously visited `realtybase.ca`, go to the site, then open DevTools → **Application** → **Cookies** → `https://realtybase.ca`, and look for any cookie whose Domain is `realtybase.ca` or `.realtybase.ca`.

**Supporting-but-insufficient evidence:** a repo grep for cookie-setting code (`document.cookie`, `js-cookie`, `Cookies.`, Rails `cookies[`) returns zero matches, and this app's Amplify/Cognito auth uses browser storage rather than cookies — so the current code cannot set such a cookie going forward. That proves nothing about a cookie a prior deployment, a third-party script, or manual testing already planted in a real user's browser — it persists independently of deployed code.

**Warning sign:** any cookie found scoped to the bare apex — it is now visible to the marketing site and to every subdomain including `app.realtybase.ca`. Note it and decide on clearing it deliberately.

## Rollback

Rollback is the same detach/attach mechanism reversed, as two numbered steps:

1. `realstate` project → **Settings** → **Domains** → remove `realtybase.ca`.
2. `frontend` project → **Settings** → **Domains** → add `realtybase.ca` back.

The same downtime window applies in reverse. No data restore is needed: the cutover itself touches no `BrokerageDomain` row and no database state (per the Section 1.3 confirmed-empty baseline), so rollback is Vercel/DNS-only.

`[ASSUMED — inferred from the documented remove/add mechanics, not verified against a real Vercel session]`

**One caveat:** if the Section 1.2 OAuth fix was deployed, leave it in place on rollback — pointing `FRONTEND_URL` at `https://app.realtybase.ca` is correct under both the pre- and post-cutover topology.

## Appendix — Findings Snapshot (2026-07-31)

| Finding | Source | State as of 2026-07-31 | How to re-verify |
|---------|--------|-------------------------|-------------------|
| OAuth fallback default | `google_oauth_controller.rb:77` | Present — falls back to `"https://realtybase.ca"` when `frontend_origin` is missing from the OAuth state cache | Re-run the Section 1.1 grep |
| `BrokerageDomain` bare-apex/`www` rows | `BrokerageDomain.where(domain: ['realtybase.ca', 'www.realtybase.ca'])` | Dev DB only — returned empty (`[]`); production not yet checked | Re-run the Section 1.3 command against production |
| `www.realtybase.ca` attachment | `frontend` Vercel project Domains list | Not attached to `frontend` | Confirm in the `frontend` Domains list |
| Apex attachment | `frontend` Vercel project Domains list | Attached to `frontend` | Confirm in the same list |
| DNS management method | `realtybase.ca` nameservers | Vercel-managed nameservers (`ns1.vercel-dns.com` / `ns2.vercel-dns.com`) | Re-run the Section 3 step 1 `dig NS` |
| Apex record TTL | `realtybase.ca` A record | Unverified — no dashboard access at authoring time | Run the Section 1.6 `dig` |
| `landing`/`realstate` project custom domains | `realstate` Vercel project Domains list | None as of Phase 45 close | Confirm in that project's Domains list |

Phase 46 executed no DNS, Vercel, database, or source-code change — this runbook is documentation only.
