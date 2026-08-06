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

The frontend is a Vite SPA with a catch-all rewrite (`frontend/vercel.json`: `"/(.*)" → "/index.html"`). **Rails is never in the request path for a page load on any of these domains** — Vercel's CDN serves `index.html` directly for every hostname attached to the project. Rails only ever sees traffic from these domains via the SPA's own `fetch`/XHR calls after the page has already loaded. This single fact is why a same-origin "redirect on page load" implemented in Rails middleware structurally cannot work — see [Primary-domain redirect](#primary-domain-redirect-non-primary--primary) below.

## Cross-domain CSRF (double-submit cookie over separate origins)

**Backend:** `app/controllers/concerns/session_cookies.rb`, `app/controllers/v1/sessions_controller.rb`
**Frontend:** `src/assets/axios/axios.ts`, `src/store/reducers/csrfToken.ts`

The backend implements CSRF as a double-submit cookie: it sets a non-`HttpOnly` `rb_csrf_token` cookie and expects the caller to echo its value back as an `X-CSRF-Token` header on every mutating request.

This pattern **requires the cookie and the header-reading JS to be on the same origin**. In dev, Vite's proxy makes `/v1/*` same-origin, so it works by accident. In production, `app.realtybase.ca` (or any brokerage domain) and `realstate-be.onrender.com` are different registrable domains — the browser still *sends* the cookie automatically on API requests (that's what `SameSite=None; Secure; Partitioned` is for), but `document.cookie` on the frontend origin can never *read* a cookie set by the backend origin. Partitioning only isolates storage per top-level site for privacy; it grants no cross-origin read access.

**Fix:** the backend hands the CSRF token back in the **JSON response body** on login (`POST /v1/sessions`) and session-check (`GET /v1/sessions`), instead of relying on the frontend reading the cookie. The frontend stashes it in an in-memory Redux slice (`csrfToken.ts` — deliberately not persisted; it's re-issued on every `GET /v1/sessions`, which fires on every page load) and the Axios request interceptor attaches it as `X-CSRF-Token`. Cleared on logout.

**Lesson:** any "read this cookie via JS and echo it as a header" pattern is a same-origin-only pattern. It cannot be made to work cross-origin by adjusting cookie attributes — the token has to travel through a channel the calling origin actually has access to (the response body, here).

## Domain-to-brokerage resolution

**Backend:** `app/controllers/concerns/brokerage_auth.rb`

Every non-main-domain request resolves `Current.brokerage` by looking up `BrokerageDomain.routable.find_by(domain: host)`, where `routable` = `status IN (active, phasing_out)`. `extract_domain_from_request` prefers the `Origin` header over `Host`, falling back to `Host` only when `Origin` is absent (dev proxy, direct calls) — **this is correct and intentional** for tenant resolution: the frontend's origin is what identifies the brokerage, not whatever hostname happens to be on the TCP connection to Rails.

Main-domain requests (`app.realtybase.ca`) instead require an `X-Brokerage-Id` header, since the main domain isn't tied to one brokerage.

**Do not confuse this with `DomainRedirectMiddleware` below** — they look similar (both parse `Origin`/`Host`) but serve opposite purposes, and using `Origin` is correct in one and was a bug in the other.

## Primary-domain redirect (non-primary → primary)

**Backend:** `app/middleware/domain_redirect_middleware.rb`
**Frontend:** `src/components/common/guards/PrimaryDomainRedirect.tsx`, `src/router/main.tsx`

A brokerage can have multiple `routable` domains simultaneously (e.g. its permanent subdomain plus a custom domain mid-migration), but exactly one `is_primary?`. Visiting a non-primary domain should redirect to the primary one.

This is split across two layers **on purpose**, and the split is the whole point:

- **`DomainRedirectMiddleware`** (Rails) exists for the case where Rails itself is addressed directly with a non-primary `Host` header. It deliberately keys off `request.host` **only** — never `Origin`. Origin is present on XHR/fetch calls; if the middleware redirected those, an in-flight API call's response would get redirected to the *frontend* domain (not an API host), which the browser reports as a CORS failure. (This was a real bug: the middleware used to prefer `Origin`, and a login POST from a non-primary domain got 301'd to `https://<primary-domain>/v1/sessions` — the frontend's index.html, not JSON.)
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
