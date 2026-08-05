# JWT → HttpOnly Cookies Migration

**Status:** Shipped 2026-08-04. Closes the JWT-in-localStorage XSS token-theft exposure carried in the Deferred Items list since v1.0 requirements. Not run through the formal GSD phase workflow — scoped and executed ad hoc after a `grill-me` design session, given the size of the milestone backlog at the time.

## Problem

Auth previously stored the app-issued JWT in `localStorage` (`src/lib/auth.ts`) and attached it as `Authorization: Bearer <token>` on every request via the Axios interceptor. Any XSS on the page could read `localStorage` directly and exfiltrate a long-lived (24h) session token. Session state was also decoded client-side from the JWT payload for auth checks (`isAuthenticated()`, `getTokenEmail()`).

## Key decisions

| Decision | Rationale |
|---|---|
| Session cookie is `Secure; SameSite=None; Partitioned` (CHIPS) in production, `SameSite=Lax` in dev | Brokerages can use arbitrary custom domains, not just `*.realtybase.ca` subdomains, and the API always lives on a separate origin (`realstate-be.onrender.com`). A plain first-party cookie can't survive that cross-site relationship under third-party-cookie blocking; Partitioned cookies are exempt from that blocking since they can't be used for cross-site tracking. Partitioning is per top-level site, which matches the existing behavior — sessions were never shared across brokerage domains to begin with. |
| CSRF via a hand-rolled double-submit token, not Rails' built-in `protect_from_forgery` | `ApplicationController < ActionController::API` has no session middleware, so Rails' session-tied CSRF token isn't available without pulling in machinery this app doesn't otherwise need. A second, JS-readable cookie (`rb_csrf_token`) echoed back as `X-CSRF-Token` on every non-GET/HEAD request gets the same protection. Enforced inside `CognitoAuth#authenticate_cognito_user!` — the one choke point every protected action already goes through. |
| Session lifetime unchanged (flat 24h, no refresh token) | Kept deliberately out of scope — this migration changes *where* the token lives, not how sessions expire. Refresh/sliding sessions would be a separate follow-up if session-drop complaints come in. |
| Google OAuth handoff restructured: `auth-callback` hands off the raw Cognito `id_token`, not an app JWT | A cookie's partition key is the top-level site at the moment it's set. The shared `auth.realtybase.ca` callback app used to call `POST /v1/sessions` itself and forward the resulting JWT via URL hash — under Partitioned cookies that would set the cookie under `auth.realtybase.ca`'s partition, invisible once the browser lands on the brokerage's own domain. Now `auth-callback` only does the Cognito code exchange (needs its own stable `redirect_uri`) and hands the `id_token` to the brokerage's own origin via the same hash mechanism; the brokerage's own SPA (`LoginSuccessful.tsx`) performs the final `POST /v1/sessions` itself. |
| Hard cutover, single coordinated deploy, no dual auth-method transition window | Old `localStorage` JWTs can't be presented as a cookie regardless, and the OAuth handoff itself is a breaking change to that flow. Blast radius (forced re-login) is already capped at 24h by the pre-existing token expiry, so a transition window buys nothing but a more complex, temporarily-reintroduced header-auth path. Verified no other consumer relies on the bearer header (`ops/` admin tooling uses HTTP Basic auth; the only other `Authorization: Bearer` usage in the codebase is the unrelated Microsoft Calendar OAuth adapter). |
| `GET /v1/sessions` added as a bare "is my session valid" check | Frontend route guards (`ProtectedRoute`, `PrimaryDomainRedirect`) run before any brokerage/tenant context exists (e.g. on the main domain before a brokerage is selected), so they can't reuse `GET /v1/user` (requires `BrokerageAuth` resolution, 400s without `X-Brokerage-Id` on the main domain). This endpoint skips `resolve_brokerage` entirely and returns just `{email}`. |

## What changed

**Backend** (`backend/`):
- `app/controllers/concerns/session_cookies.rb` (new) — sets/clears the session + CSRF cookies, environment-aware attributes.
- `app/controllers/concerns/cognito_auth.rb` — reads the token from the cookie instead of the `Authorization` header; CSRF check added for unsafe methods.
- `app/controllers/v1/sessions_controller.rb` — `#create` sets cookies instead of returning `{token}`; `#destroy` clears them; new `#show` (`GET /v1/sessions`).
- `app/controllers/application_controller.rb` — `include ActionController::Cookies` (API-only mode doesn't include it by default).
- `config/initializers/cors.rb` — `credentials: true`.
- `config/routes.rb` — `get "sessions"` route.
- Test helpers (`test/test_helper.rb` and five per-file `main_domain_headers_for` duplicates) now build a session-cookie + CSRF-header pair instead of an `Authorization` header.

**Frontend** (`frontend/`):
- `src/lib/auth.ts` deleted (localStorage JWT decode helpers).
- `src/assets/axios/axios.ts` — `withCredentials`/`withXSRFToken` instead of attaching a bearer header.
- `src/store/hooks/Auth/useSessionQuery.ts` (new) + `src/assets/api/auth/checkSession.ts` (new) — async replacement for the old synchronous `isAuthenticated()`.
- `ProtectedRoute.tsx`, `PrimaryDomainRedirect.tsx`, `CreateAccount.tsx` — synchronous local JWT check → async `useSessionQuery`/`checkSession` call.
- `LoginSuccessful.tsx` — reads a raw `id_token` from the hash and performs the `POST /v1/sessions` exchange itself.
- `useLogout.ts` — now also calls the backend's `DELETE /v1/sessions` (previously only called Amplify's own `signOut`, which never touched our session cookie — a latent gap this migration made load-bearing, since JS can no longer clear an HttpOnly cookie client-side).

**`auth-callback/index.html`** — no longer calls `/v1/sessions`; hands off the Cognito `id_token` via hash instead of an app JWT.

## Dev environment gotcha

Local `.env`/`.env.example` previously defaulted `VITE_BE_ENDPOINT=http://127.0.0.1:8080`, which makes the frontend call the backend directly instead of through Vite's `/v1` proxy (`vite.config.ts`). That's harmless for header-based auth but breaks cookie auth: `localhost:3000` and `127.0.0.1:8080` are cross-origin, and the dev cookie (`SameSite=Lax`, since dev isn't HTTPS) is never attached to cross-origin `fetch`/XHR calls. Fixed by blanking the default so `resolveBaseUrl()` falls back to `window.location.origin` and traffic goes through the proxy (same-origin). `VITE_BE_ENDPOINT` itself is still required and must stay set in deployed environments (Vercel), where the frontend and backend are genuinely different origins.

## Follow-ups (non-blocking)

- Confirm the deployed frontend Vercel project actually has `VITE_BE_ENDPOINT` set to the Render backend URL — assumed but not independently verified during this migration.
- Session lifetime is still a flat 24h with no refresh token, by design (see Key Decisions) — revisit if forced re-logins become a UX complaint.
