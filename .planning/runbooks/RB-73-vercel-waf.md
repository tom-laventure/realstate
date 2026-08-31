# Runbook: Vercel WAF / Bot Protection for the app (RB-73)

**Status:** config spec — not yet applied to the dashboard
**Owner:** Tom (applies in Vercel dashboard)
**Created:** 2026-08-31
**Related:** RB-65 (robots.txt / noindex — shipped), RB-68 (origin rate limiting via rack-attack — pending), RB-67 (admin vs public/VOW route separation — pending), RB-66 (data residency — pending)

---

## 1. Purpose & scope

Put a request-level bot / abuse-mitigation layer in front of the **`frontend`** Vercel project
(the app SPA: `app.realtybase.ca` + every brokerage subdomain + brokerage custom domains) and a
minimal rate limit in front of the **`auth-callback`** project.

This is the Vercel WAF half of the VOW anti-scraping posture. RB-65 already handles the
crawl/index directives (robots.txt, `X-Robots-Tag`, meta robots). This runbook is also the
**compliance evidence artifact** — "these are our bot-mitigation measures" — for board
data-access conversations (GVR etc.).

Requires **Vercel Pro** (custom rules + rate limiting). The account was upgraded Hobby → Pro
on 2026-08-31.

### Out of scope / explicit non-goals

- **`realstate` / `landing` project (marketing site): NO firewall rules.** It must stay fully
  open and crawlable. If a rule is ever added there, it must never block search-engine or
  social-unfurl crawlers.
- **Per-endpoint API throttling** (search, listing detail, VOW endpoints) lives **only** in
  rack-attack at the origin (RB-68), not as Vercel path rules — two copies of endpoint
  knowledge would drift.
- **Geo-fencing / country blocking** — not done. VOW clients travel and use VPNs; a hard
  CA/US block risks locking out legitimate users, and VOW rules don't require it. Geo
  restriction is an *attack-time lever* only (see §5).

### Load-bearing constraint: the origin is directly reachable

The API answers on **both**:
- `https://app.realtybase.ca/v1/*` — proxied through Vercel → **WAF sees it**
- `https://realstate-be.onrender.com/v1/*` — direct to Render → **WAF is blind to it**

So **rack-attack at the origin (RB-68) is the authoritative API rate limiter.** Everything in
this runbook is a redundant *outer shell* that sheds obvious flood/scraper traffic before it
costs Render bandwidth. Vercel limits are deliberately set **looser** than rack-attack so the
origin trips first and owns the `429` semantics the SPA already handles.

---

## 2. Rules to apply

> Dashboard path: Vercel → project → **Settings → Firewall**. Exact control labels may differ
> slightly from the names below (Vercel iterates on this UI); apply the **intent**, not the
> literal string. Rules are evaluated top-to-bottom — order matters where noted.

### Project: `frontend`

| # | Type | Condition | Action | Notes |
|---|------|-----------|--------|-------|
| F1 | Managed rule | **Block AI Bots** (GPTBot, CCBot, ClaudeBot, Google-Extended, PerplexityBot, Bytespider, etc.) | **Deny** | One-click managed toggle. Enforcement teeth behind RB-65's `robots.txt`; these never have a legitimate reason to hit the app. |
| F2 | Managed ruleset | **Vercel-managed / OWASP core rules** (SQLi, XSS, path traversal, RCE patterns) — enable whatever categories the plan exposes | **Deny** | Low false-positive risk for a JSON API + static SPA. If a category looks noisy in the Firewall log, drop *that category* to Log, not the whole ruleset. |
| F3 | Managed rule | **Managed bot-protection / traffic-filtering heuristic**, *if your Pro plan exposes one* (deep bot scoring is Enterprise; Pro may only offer the AI-bots toggle) | **Challenge** | Challenge, **not Deny** — a real browser passes silently, a bot fails, so a mis-tuned heuristic degrades gracefully instead of invisibly walling out real users. If Pro has no such managed rule, F4 + F7 are the substitute. |
| F4 | Custom rule | `request path` starts with `/v1/` **AND** `user agent` is empty **OR** contains any of: `python-requests`, `curl`, `wget`, `Scrapy`, `Go-http-client`, `libwww`, `httpx`, `aiohttp`, `Java/`, `okhttp` | **Challenge** | The only legitimate consumer of `/v1/*` is the SPA (browser UA). Defense-in-depth; rack-attack/RB-68 is the authoritative version since direct-origin traffic never reaches this rule. |
| F5 | Custom rule — rate limit | `request path` starts with `/v1/` | **Rate limit: 300 requests / 60s per IP → Deny (429)** | Coarse flood breaker for the proxied API. **Must stay well above any rack-attack throttle** so RB-68's limits trip first. Re-check this number once RB-68 lands. |
| F6 | Custom rule — rate limit | *(optional)* any request path (i.e. static SPA + HTML) | **Rate limit: 600 requests / 60s per IP → Deny** | Optional. Assets are edge-cached so abuse is cheap already; add only if the Firewall log later shows asset-flood abuse. Skip at initial apply. |
| F7 | Custom rule | *(optional)* known automated **JA4/JA3 TLS fingerprints** or datacenter **AS numbers** (AWS, GCP, Azure, DigitalOcean, OVH, Hetzner) on `request path` starts with `/v1/` | **Challenge** | Optional hardening. Catches headless scrapers that spoof a browser UA. Start as **Log** and review before enforcing — datacenter ASNs can carry some legitimate traffic (corporate VPNs/proxies). |

### Project: `auth-callback`

| # | Type | Condition | Action | Notes |
|---|------|-----------|--------|-------|
| A1 | Custom rule — rate limit | any request path | **Rate limit: 12 requests / 60s per IP → Deny** | Every page load triggers a Cognito token exchange. 12/60s is generous for a human completing OAuth; anything above is abuse. |

### Global toggles (both `frontend` and `auth-callback`)

- **Attack Challenge Mode: OFF.** Break-glass only — see §5. It interstitials *every* visitor,
  including logged-in agents.
- **IP bypass list:** empty. There is no legitimate third-party automation to allowlist
  (no uptime monitoring, no external E2E, no inbound webhooks; OAuth/Cognito are
  browser-redirect / outbound only — confirmed with Tom 2026-08-31).
- **IP block list:** empty at apply time; this is where individual abusive IPs go later.

---

## 3. Rollout

**There is no live production traffic yet**, so the usual "Log-first for a week" staging is
skipped. Apply every rule at its target action in one pass, then run the verification matrix
(§4) immediately.

1. `frontend`: apply F1, F2, F3 (if available), F4, F5. Skip F6, F7 (optional).
2. `auth-callback`: apply A1.
3. Confirm **no** rules exist on `realstate` / `landing`.
4. Confirm Attack Challenge Mode is OFF on all three.
5. Run §4.

### Deferred check (cannot be validated today)

Once real traffic exists, open **Firewall → the log/analytics view** for `frontend` and review
what **F3** (and F4/F7 if enabled) actually caught over the first week **before trusting the
tuning**. Look specifically for challenged/blocked requests that were real users or the app's
own traffic. Adjust or drop to Log as needed.

---

## 4. Verification matrix

Run after applying. Replace `<brokerage-domain>` with a real brokerage subdomain/custom domain.

| # | Command / action | Expected |
|---|------------------|----------|
| V1 | `curl -s -o /dev/null -w '%{http_code}\n' -A "GPTBot/1.2 (+https://openai.com/gptbot)" https://app.realtybase.ca/` | `403` |
| V2 | `curl -s -o /dev/null -w '%{http_code}\n' -A "python-requests/2.31" https://app.realtybase.ca/v1/health` | `403` or challenge (not `200`/`404` passthrough) |
| V3 | `curl -s -o /dev/null -w '%{http_code}\n' https://app.realtybase.ca/v1/health` *(default curl UA also matches F4's `curl` token — expected)* | `403` / challenge |
| V4 | Load `https://app.realtybase.ca/` in a real browser; complete Google login end to end | Works, no challenge interstitial |
| V5 | Load `https://<brokerage-domain>/` in a browser, view a listing group | Works, listing data renders |
| V6 | `for i in $(seq 1 400); do curl -s -o /dev/null -w '%{http_code} ' "https://app.realtybase.ca/v1/health"; done` from one IP | First responses `403`/`404`, then a switch to `429` once >300/60s |
| V7 | `for i in $(seq 1 20); do curl -s -o /dev/null -w '%{http_code} ' https://auth.realtybase.ca/; done` | `429` after ~12 |
| V8 | `curl -sI https://<landing-domain-or-*.vercel.app>/` and a `curl -A GPTBot` against it | Normal `200`, **no** block — landing is unaffected |
| V9 | `curl -sI https://app.realtybase.ca/ | grep -i x-robots-tag` | still `noindex, nofollow` (RB-65 unbroken) |
| V10 | Vercel dashboard → Firewall log | V1–V3, V6, V7 requests visible as rule hits with the expected rule name |

If V4 or V5 fail (a real browser gets challenged or blocked): set **F3** to Log, re-test; if
still failing, F4. Do not disable F1/F2/F5 for this — they don't touch browser traffic.

---

## 5. Break-glass: Attack Challenge Mode

Turn on during an **active** attack (traffic spike Vercel's automatic DDoS mitigation isn't
absorbing, origin overwhelmed despite F5 + rack-attack):

1. Vercel → `frontend` → Settings → Firewall → **Attack Challenge Mode → Enable**.
2. Every visitor now gets a managed challenge page for ~30 min rolling until disabled.
3. Optionally also enable it on `auth-callback`.
4. Add specific offending IPs / ASNs / geos to the **IP block list** or a temporary custom
   Deny rule so you can turn ACM back off.
5. **Disable ACM** once the block rules are holding — it is not a steady-state setting.

Geo restriction (also attack-time only): a temporary custom rule `IP geolocation` not in
`CA, US` → Challenge (or Deny) on `/v1/*`. Remove once the attack subsides.

---

## 6. Rollback

Every rule is dashboard-toggleable with no deploy:

- **One rule misbehaving:** set its action to **Log** (keeps visibility) or **disable** it.
- **Everything wrong:** disable all custom rules F4–F7 / A1, set managed rules F1–F3 to Log.
  robots.txt / `X-Robots-Tag` (RB-65) are independent and unaffected.
- **ACM stuck on:** Settings → Firewall → Attack Challenge Mode → Disable.

No rule here can break the origin API directly — the origin is reachable independent of
Vercel.

---

## 7. Observations / follow-ups surfaced while writing this

- **No uptime / status monitoring exists** for any environment (confirmed 2026-08-31). Not
  solved here — worth its own ticket. Without it, a WAF misfire that blocks all real users
  would go unnoticed until someone complains.
- **Direct-origin bypass** (`realstate-be.onrender.com`) means this layer is genuinely
  secondary. **RB-68 (rack-attack on listing/search/VOW endpoints) is the higher-leverage
  work** and is not optional. Consider whether the origin should reject traffic that didn't
  come through Vercel (shared-secret header injected at the edge) — that's RB-67's area.
- **`frontend/vercel.json`** currently holds `rewrites` + the RB-65 `X-Robots-Tag` header.
  Vercel WAF custom rules are **not** expressible in `vercel.json`; they live in dashboard /
  REST API / Terraform only. This runbook is the version-controlled record of that config.
- The Hobby → Pro upgrade also unblocks the v1.14 Phase 44 ANALYTICS-01 limitation (custom
  `track()` events) and the Phase 45 D-04 deferred item.

---

## 8. Change log

| Date | Change | By |
|------|--------|----|
| 2026-08-31 | Runbook written (RB-73). Config not yet applied. | Claude / Tom |
