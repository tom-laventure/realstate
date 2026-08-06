<!-- created: 2026-08-06 -->
# Custom Domain & Cross-Domain Auth Architecture

**Context:** This system lets every brokerage serve its portal from three kinds of hostname — the shared main domain (`app.realtybase.ca`), a permanent subdomain (`<slug>.realtybase.ca`), and zero or more custom domains (`dummies.site`). Because the frontend and backend live on different registrable domains in production, almost every cross-cutting bug in this area traces back to one root fact: **a browser will never let JS on one origin read a cookie set by another origin, no matter how that cookie is scoped.** This doc exists because that fact was violated in three independent places before anyone noticed, and each violation looked like an unrelated bug (a 422 on login, a CORS error, a missing redirect) until traced back here.

## Topology

```text
app.realtybase.ca            → Vercel `frontend` project (main domain, static SPA)
<slug>.realtybase.ca         → Vercel `frontend` project (per-brokerage subdomain, attached one at a time —
                                *.realtybase.ca wildcard is gated on a Vercel Pro upgrade, not yet done)
<custom-domain>               → Vercel `frontend` project (attached via Vercel Domains API, see below)
realstate-be.onrender.com    → Rails API (all of the above call this same backend)
```

The frontend is a Vite SPA. `frontend/vercel.json` has two rewrites, evaluated in order: `/v1/:path*` proxies to the Rails API (`https://realstate-be.onrender.com/v1/:path*`), and the catch-all `"/(.*)" → "/index.html"` serves the SPA for everything else. **Rails is never in the request path for a page load on any of these domains** — Vercel's CDN serves `index.html` directly. Rails only ever sees traffic from these domains via the SPA's own `fetch`/XHR calls to `/v1/*`, proxied through Vercel, after the page has already loaded. This single fact is why a same-origin "redirect on page load" implemented in Rails middleware structurally cannot work — see [Primary-domain redirect](#primary-domain-redirect-non-primary--primary) below.

Because the `/v1/*` rewrite is a proxy (not a redirect), the browser sees every API call as same-origin to whichever frontend domain it's on. That's load-bearing for the session cookie — see the next section.

## Session cookie: same-site via proxy (not cross-site CHIPS)

**Backend:** `app/controllers/concerns/session_cookies.rb`, `app/controllers/v1/sessions_controller.rb`
**Frontend:** `frontend/vercel.json`, `src/assets/axios/axios.ts`

The session (`rb_session`, `HttpOnly`) and CSRF (`rb_csrf_token`) cookies are set by the Rails API. Before the `/v1/*` proxy existed, every frontend domain called `realstate-be.onrender.com` directly — a different registrable domain, making the session cookie third-party from the browser's perspective. The first fix attempted was `SameSite=None; Secure; Partitioned` (CHIPS), reasoning that the partition key (calling top-level site) matched the intended per-domain session model. **This did not hold up in production**: browsers that fully block third-party cookies regardless of CHIPS (Safari ITP) or that ship stricter tracking-protection defaults than assumed dropped the cookie outright, causing session auth to fail *intermittently and in bursts* — every authenticated endpoint in a given page load would fail together, while other visits (other browsers, or Vercel/Cloudflare-fronted retries) succeeded. This was diagnosed after the fact by pulling production logs directly from Render's Logs API (`GET /v1/logs?resource=...&text=...`, credentials in `backend/config/credentials.yml.enc` under `render:`) and correlating a spike in `authenticate_cognito_user!`'s `Filter chain halted` 401s to the day the cookie moved from bearer-token-in-header to `HttpOnly` cookie.

**Fix:** proxy `/v1/*` through each frontend domain's own Vercel project (see Topology above) so every API call — including the session-creating `POST /v1/sessions` — is same-origin from the browser's point of view. The cookie is now `SameSite=Lax; Secure`, no `Partitioned` needed, and isn't subject to any third-party-cookie policy at all. The OAuth handoff already did the hard part correctly before this fix landed: `auth-callback` (a separate Vercel project, `auth.realtybase.ca`) only performs the Cognito PKCE code exchange and hands the raw `id_token` to the brokerage's own origin via URL hash (`src/containers/auth/LoginSuccessful.tsx`) — the actual `POST /v1/sessions` that receives `Set-Cookie` always happens on the tenant's own domain, never on `auth.realtybase.ca`. That design decision is what made the proxy fix sufficient on its own, without also needing to touch the OAuth flow.

**Lesson:** cookie *attributes* (`SameSite`, `Partitioned`) can't fully paper over a cross-site relationship between frontend and API domains — some browsers block third-party cookies more aggressively than any attribute can opt back into. If frontend and API are on different registrable domains, proxy the API calls through the frontend's own domain so the cookie is genuinely first-party; don't rely on CHIPS as the primary mechanism.

**Corollary — Rails' `ActionDispatch::HostAuthorization` breaks the moment you do this.** `config.hosts` (populated from `ALLOWED_HOSTS=realstate-be.onrender.com`) is a static allowlist, and Vercel's external rewrite forwards the browser's original `Host` header unchanged rather than rewriting it to the destination — so every proxied `/v1/*` request arrived at Rails with `Host: app.realtybase.ca` (or a subdomain, or a custom domain), none of which matched the allowlist, and got a blank 403 from the host-authorization middleware before routing even ran. Custom domains are DB-backed and unbounded, so no static list can cover them; `/v1/*` is now excluded from host authorization entirely (`config/environments/production.rb`) and relies on `BrokerageAuth`/`MainDomainOnly` + CORS for the equivalent dynamic check instead. `/ops` and `/jobs` keep the static check since they're only ever addressed directly at the Render domain.

## Cross-domain CSRF (double-submit cookie over separate origins)

**Backend:** `app/controllers/concerns/session_cookies.rb`, `app/controllers/v1/sessions_controller.rb`
**Frontend:** `src/assets/axios/axios.ts`, `src/store/reducers/csrfToken.ts`

The backend implements CSRF as a double-submit cookie: it sets a non-`HttpOnly` `rb_csrf_token` cookie and expects the caller to echo its value back as an `X-CSRF-Token` header on every mutating request.

This pattern **requires the cookie and the header-reading JS to be on the same origin**. In dev, Vite's proxy makes `/v1/*` same-origin, so it works by accident. In production, the `/v1/*` Vercel rewrite (see above) makes it same-origin by design for anything going through the frontend SPA — but a couple of call sites (`auth-callback`'s `/v1/domains/lookup`) still call `realstate-be.onrender.com` directly and are cross-origin to it, so `document.cookie` on those pages still can't read a cookie set by the backend's own origin.

**Fix:** the backend hands the CSRF token back in the **JSON response body** on login (`POST /v1/sessions`) and session-check (`GET /v1/sessions`), instead of relying on the frontend reading the cookie. The frontend stashes it in an in-memory Redux slice (`csrfToken.ts` — deliberately not persisted; it's re-issued on every `GET /v1/sessions`, which fires on every page load) and the Axios request interceptor attaches it as `X-CSRF-Token`. Cleared on logout. This body-relay is kept even now that most calls are same-origin, since it works unconditionally regardless of which path (proxied or direct) a given request took.

**Lesson:** any "read this cookie via JS and echo it as a header" pattern is a same-origin-only pattern. It cannot be made to work cross-origin by adjusting cookie attributes — the token has to travel through a channel the calling origin actually has access to (the response body, here).

## Domain-to-brokerage resolution

**Backend:** `app/controllers/concerns/brokerage_auth.rb`, `app/controllers/concerns/main_domain_only.rb`

Every non-main-domain request resolves `Current.brokerage` by looking up `BrokerageDomain.routable.find_by(domain: host)`, where `routable` = `status IN (active, phasing_out)`. `extract_domain_from_request` tries, in order: `Origin` header, then `X-Forwarded-Host`, then `Host` — **this order is correct and intentional** for tenant resolution: the frontend's origin is what identifies the brokerage, not whatever hostname happens to be on the TCP connection to Rails.

The `X-Forwarded-Host`/`Host` tiers matter because of the `/v1/*` proxy (see above): a same-origin `GET`/`HEAD` fetch never carries an `Origin` header (only "unsafe" methods do, per the fetch spec, even when same-origin), so for proxied reads `Origin` is absent. **Empirically, Vercel's external-URL rewrite forwards the browser's original `Host` unchanged** — it does not rewrite `Host` to the destination hostname the way a more conventional reverse proxy might — so for `/v1/*` traffic `Host` itself already carries the real tenant domain, and `X-Forwarded-Host` carries the identical value. This was confirmed the hard way: see the Host Authorization entry in Debugging notes below. The `X-Forwarded-Host` tier is kept ahead of `Host` anyway as the more semantically explicit signal and as a hedge against that proxy behavior changing. `MainDomainOnly#require_main_domain!` follows the identical fallback order for the same reason.

Main-domain requests (`app.realtybase.ca`) instead require an `X-Brokerage-Id` header, since the main domain isn't tied to one brokerage.

**Do not confuse this with `DomainRedirectMiddleware` below** — they look similar (both parse `Origin`/`Host`/`X-Forwarded-Host`-adjacent headers) but serve opposite purposes. `DomainRedirectMiddleware` deliberately does **not** add an `X-Forwarded-Host` fallback — see its section for why.

## Primary-domain redirect (non-primary → primary)

**Backend:** `app/middleware/domain_redirect_middleware.rb`
**Frontend:** `src/components/common/guards/PrimaryDomainRedirect.tsx`, `src/router/main.tsx`

A brokerage can have multiple `routable` domains simultaneously (e.g. its permanent subdomain plus a custom domain mid-migration), but exactly one `is_primary?`. Visiting a non-primary domain should redirect to the primary one.

This is split across two layers **on purpose**, and the split is the whole point:

- **`DomainRedirectMiddleware`** (Rails) exists for the case where Rails itself is addressed directly with a non-primary `Host` header, for any non-`/v1` path. It deliberately keys off `request.host` **only** — never `Origin`. Origin is present on proxied XHR/fetch calls; if the middleware redirected those, an in-flight API call's response would get redirected to the *frontend* domain (not an API host), which the browser reports as a CORS failure. (This was a real bug: the middleware used to prefer `Origin`, and a login POST from a non-primary domain got 301'd to `https://<primary-domain>/v1/sessions` — the frontend's index.html, not JSON.)

  **`/v1/*` is explicitly excluded from this middleware regardless of Host**, and that exclusion is load-bearing, not cosmetic. Before the `/v1/*` proxy existed, this was implicitly safe without an exclusion — every `/v1` request reached Rails with `Host: realstate-be.onrender.com` (never a match in `BrokerageDomain`, so always a no-op). That assumption broke the moment `frontend/vercel.json` started proxying `/v1/*` through each tenant's own domain: Vercel forwards the *original* Host to the destination, not the destination's own hostname (confirmed empirically — see Domain-to-brokerage resolution below), so a non-primary tenant domain became a completely normal Host to see on a live `/v1` request. Without the exclusion, an API call from a non-primary domain (e.g. a custom domain mid-migration to its permanent subdomain) got 301'd into an HTML redirect response instead of JSON — reproducing the exact CORS-breaking failure mode the `Origin`-vs-`Host` fix above was written to prevent, just reached through a different path. Since every route in this app lives under `/v1`, `/ops`, or `/jobs`, and the latter two are only ever addressed directly at `realstate-be.onrender.com` (never a tenant `Host`), this middleware is — after the exclusion — a no-op in every currently-reachable scenario. It's kept as defense-in-depth for any future non-`/v1` route, not because it does anything today.
- **`PrimaryDomainRedirect`** (React, a layout route) is what actually handles the common case, because — per the Topology section — Rails never sees a real page navigation for these domains; only the SPA can. On mount it calls `GET /v1/domains/lookup?domain=<hostname>` (public, unauthenticated — DMOD-13) and does `window.location.replace()` if the returned primary differs from the current hostname. It fails open on any error and renders nothing (no spinner/flash) while resolving.

Two things had to both be true for this to work everywhere it needs to:
1. The lookup must **not** be skipped for unauthenticated visitors. It used to bail out early on `sessionError`, assuming `ProtectedRoute` would catch unauthenticated users and redirect them to `/auth/login` anyway — but that assumption breaks for routes `ProtectedRoute` never wraps in the first place, like the login page itself.
2. `/auth/*` routes must actually be wrapped by `PrimaryDomainRedirect`. They were previously kept entirely outside its route tree so `/auth/login` would still work on the main domain — but `PrimaryDomainRedirect` already no-ops on the main domain via its own `isMainDomain()` check, so nesting it under `PrimaryDomainRedirect` (not `SubdomainOnly`, which would 404 the main domain) satisfies both constraints at once.

Without both fixes, a user landing on a non-primary domain would see that domain's own login portal directly (no redirect), and if they tried to log in from there, the middleware bug above would turn it into a CORS error.

## Custom domain lifecycle & Vercel integration

**Backend:** `app/models/brokerage_domain.rb`, `app/services/vercel_domain_service.rb`, `app/jobs/vercel_domain_attach_job.rb`, `app/jobs/domain_verification_job.rb`, `app/controllers/v1/admin/domains_controller.rb`

`BrokerageDomain.status` moves `pending → active → phasing_out → decommissioned` (or `→ frozen` on a plan downgrade). Creating a `domain_type: custom` record fires `after_create_commit :enqueue_vercel_attach`, which calls `VercelDomainService#add_domain` (`POST /v10/projects/:id/domains`) to attach the domain to the `frontend` Vercel project. `DomainVerificationJob` sweeps `pending` domains every cycle, calling `sync_and_verify` (attach-then-check) and promoting to `active` (+ `is_primary` if `set_primary_on_verify` or no primary exists yet) once Vercel reports `verified: true`.

**Critical: `domain_type` must be set explicitly on every `BrokerageDomain.create!`.** The DB column defaults to `"subdomain"`, and `after_create_commit :enqueue_vercel_attach` is gated `if: :domain_type_custom?`. A create call that omits `domain_type` for a custom domain silently becomes a `subdomain`-typed record that never reaches Vercel at all — no error, no job enqueued, the domain just sits in the DB doing nothing. This exact bug shipped once in `V1::Onboarding::BrokeragesController#create`, which built both the subdomain and custom-domain records without ever passing `domain_type`.

**Vercel's idempotent-reattach response shape must be read correctly.** When `add_domain` is called on a domain already attached to the same project, Vercel returns `409` with:
```json
{"error": {"code": "domain_already_in_use", "projectId": "prj_...", "domain": {..., "verified": true}, "message": "..."}}
```
The project id is under `error.projectId` (not `error.project`), and the verified flag is under `error.domain.verified` (not `error.verified`). Reading the wrong keys means `already_attached_to_project?` never matches, so `add_domain` reports failure on every re-attach — and since `DomainVerificationJob`'s sweep calls `add_domain` first and short-circuits to `false` on any failure, **no custom domain could ever be promoted past its first attach attempt**, regardless of real DNS state. This is silent: nothing raises, the domain just accumulates `consecutive_failures` forever.

### What a custom domain actually needs in DNS

There is no single "add this CNAME" answer — it depends on whether the domain is apex/root or a subdomain, and there is a second, separate ownership-verification step:

- **Apex/root domain** (`example.com`) needs an **A record** at `@` → `76.76.21.21` (Vercel's shared anycast IP). A CNAME at the zone apex is invalid per DNS spec (a name with a CNAME cannot coexist with the zone's mandatory `NS`/`SOA` records) — every registrar, GoDaddy included, rejects `CNAME @` outright with an error to that effect.
- **Subdomain** (`app.example.com`) needs a **CNAME** pointing at the brokerage's own active subdomain (or `cname.vercel-dns.com`).
- **Either case may additionally need a TXT ownership-verification record**, independent of the A/CNAME record above: `GET /v9/projects/:id/domains/:domain` returns `verified: false` with a `verification` array like `{"type":"TXT","domain":"_vercel.<domain>","value":"vc-domain-verify=..."}` until that TXT record is added. `add_domain`'s `verified` field and this per-domain verification check are **two different things** — a domain can DNS-resolve correctly (`misconfigured: false` on `GET /v6/domains/:domain/config`) while still being unverified pending this TXT challenge.

None of this was surfaced anywhere in the product before this investigation — `AddDomainWizard.tsx` unconditionally showed `Type: CNAME` regardless of whether the entered domain was apex or a subdomain, and nothing ever showed the TXT challenge at all. See the corresponding fix in `AddDomainWizard.tsx` / `DomainCard.tsx` / `V1::Admin::DomainsController#dns_setup` for the corrected instructions.

**Apex detection today is a dot-count heuristic** (`domain.split(".").length <= 2` → apex). This misclassifies multi-part public suffixes (`example.co.uk` would be treated as a subdomain of `co.uk`). Good enough for the domains actually seen so far; a real fix would need a public suffix list.

## Debugging notes (things that cost real time)

- **`verified: true` on the domain object and `misconfigured: false` on the domain-config object are different checks that can disagree.** A domain can show `verified: true` (ownership proven, possibly during a brief earlier DNS window) while `GET /v6/domains/:domain/config` says `misconfigured: true` right now (current DNS doesn't actually point at Vercel). Trust the config endpoint for "is this live right now."
- **A domain's actual authoritative nameservers can differ from what a DNS control panel implies.** GoDaddy's zone editor will happily show NS/SOA/A/CNAME records for a zone even if that zone isn't the domain's real registry-level delegation — editing records there does nothing if the registrar-of-record's real nameservers point elsewhere. `GET /v6/domains/:domain/config`'s `nameservers` field is the ground truth; compare it against what the control panel claims before spending time debugging DNS propagation.
- **Near-identical domain names cause real incidents, not just typos.** `dummy.site` and `dummies.site` are different domains on different registrars/nameservers; a full debugging cycle (wrong wizard instructions → wrong DNS panel edited → Vercel reporting `misconfigured` → hours of investigation) traced back to the wrong one being configured. Always confirm the exact domain string against what's actually stored in `BrokerageDomain` before troubleshooting DNS.
- **Rails' `ActionDispatch::Static`-relative middleware ordering matters less than "does Rails see this request at all."** Before chasing a bug through Rails middleware/controller code, confirm the request actually reaches Rails — for this SPA, most page-load-shaped bugs never do.
- **Vercel's published header docs describe requests *to* a Vercel deployment — they don't fully specify behavior for external-URL rewrites (proxying to a non-Vercel destination).** Assumed Vercel would rewrite `Host` to the destination's hostname (conventional reverse-proxy behavior) and only preserve the original in `X-Forwarded-Host`. Empirically false: it forwards the original `Host` unchanged, which is exactly what fed the `ALLOWED_HOSTS`/`ActionDispatch::HostAuthorization` 403 above and would have silently broken `DomainRedirectMiddleware` in the opposite direction if that middleware hadn't already been fixed to exclude `/v1/*` for other reasons. When a fix depends on exactly what header a third-party proxy forwards and how, verify it against the real deployment (`curl -D -` through the actual domain) before trusting either vendor docs or intuition about "how reverse proxies usually work" — this one shipped, looked correct in every code review pass, and only failed once actually hit through `app.realtybase.ca` in production.
- **A cross-site session cookie failure looks intermittent, not broken, from the browser.** It doesn't fail every request — it fails per-*visit* (whichever browser/privacy-mode combination blocks third-party cookies for that user), so a handful of manual checks in one browser can easily miss it while real users see it constantly. Pulling actual production logs (Render's Logs API, `render:` credentials in `config/credentials.yml.enc`) and correlating a spike in `Filter chain halted`/`Authorization token missing` 401s against the date a cookie-handling change shipped was what actually confirmed the cause — dev-tools output from a single session wasn't enough to see the pattern.
