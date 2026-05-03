# Phase 3: Onboarding Fixes - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix three broken user activation flows that prevent new brokerage owners and new invitees from completing onboarding:

1. **ONB-01** — Domain setup wizard: error handling fails silently on HTTP errors; SuccessStep redirects to the wrong domain; Premium users need a DNS verification button in the success step.
2. **ONB-02** — Post-invite redirect: both invitation flows pass `group.id` (integer) where the frontend router expects `group.uid` (UUID); `JoinBrokerage` uses a relative navigate path that misses the dashboard root.
3. **ONB-03** — Welcome banner: net-new feature; dismissible banner on first dashboard visit showing brokerage name + assigned group names, persisted server-side on `BrokerageMembership`.

No new capabilities beyond these three fixes and the welcome banner. DNS admin page is explicitly deferred.

</domain>

<decisions>
## Implementation Decisions

### ONB-01: Domain Wizard Error Handling

- **D-01:** `DomainStep.handleContinue` wraps `await actions.submit(domain)` in a try/catch. On HTTP error (409, 422, etc.), the caught error message from the server response (e.g. "Subdomain or brokerage already taken") is set as an inline field error on the `subdomain` field — same visual pattern as client-side validation in `SubdomainInput`. The generic `onError` toast in `useCreateBrokerage` is removed or suppressed so the error appears inline, not as a duplicate toast.
- **D-02:** `submit()` in `CreateBrokerageContext` already returns early on `data.error` (2xx with error field). The new try/catch in the component handles thrown HTTP errors. The existing inline `errors` state in `DomainStep` is reused — no new state needed.

### ONB-01: SuccessStep Redirect

- **D-03:** "Go to dashboard" in `SuccessStep` uses `window.location.href` (not React Router `navigate`) to cross the domain boundary to `https://{subdomain}.realstate.ca/`. The subdomain comes from `state.result?.domains?.subdomain` (already available).
- **D-04:** For Premium users, the redirect always targets the subdomain (not the custom domain), because custom domains are marked `verified: false` at creation time. Custom domain redirect is only offered after DNS verification is confirmed.

### ONB-01: DNS Verification in SuccessStep (Premium)

- **D-05:** The backend `POST /v1/onboarding/brokerage` create response is extended to include the `BrokerageDomain` record IDs in the response: `domains: { subdomain: "...", subdomain_id: N, custom_domain: "...", custom_domain_id: N }`. This enables the DNS verify button to call `POST /v1/admin/domains/:id/verify` without an extra lookup.
- **D-06:** SuccessStep (Premium only) adds a "Check DNS status" button — manual trigger, no polling. Calls `POST /v1/admin/domains/:custom_domain_id/verify`. Shows a spinner while in-flight.
- **D-07:** On verification success: show a green "Domain verified ✓" badge next to the domain; the "Go to subdomain" button becomes two options: "Go to your custom domain" (`window.location.href` to `https://{customDomain}/`) and "Go to subdomain" (`window.location.href` to `https://{subdomain}.realstate.ca/`).
- **D-08:** On verification failure (domain not yet propagated): show a neutral "Not yet verified — DNS may still be propagating" message. The "Check DNS status" button remains clickable for another attempt. No error styling — propagation delay is expected.

### ONB-02: Backend — Return group.uid

- **D-09:** In `V1::Dashboard::InvitationsController#accept`, change `next_step = group.id.to_s` → `next_step = group.uid`. Same fix in `#accept_token`. Both methods already have `group` resolved before this line.
- **D-10:** For brokerage-level invitations (no `group_id` on the invitation), `next_step` is set to `"dashboard"` — frontend maps this to `navigate('/')`.

### ONB-02: Frontend Navigate Fix

- **D-11:** In `JoinBrokerage#handleAccept`: change `navigate(`dashboard/${nextStep}`, { replace: true })` → if `nextStep && nextStep !== 'dashboard'`, navigate to `/${nextStep}`; otherwise navigate to `/`.
- **D-12:** In `Invitation.tsx#respondMutation.onSuccess`: the existing `navigate(`/${nextStep}`)` is correct for group UIDs. Add an explicit check: if `nextStep === 'dashboard'` or `nextStep === ''`, navigate to `'/'` instead of `'/dashboard'` (which has no route). Remove the `navigate('/')` fallback that fires when `nextStep` is falsy — cover it in the `nextStep === 'dashboard'` branch explicitly.
- **D-13:** `JoinBrokerage` auth flow: the component already renders `CreateAccount` inline when the user is unauthenticated. After auth, the component re-renders with the token still in the URL param — no sessionStorage or redirect-back mechanism needed.

### ONB-03: Welcome Banner Persistence

- **D-14:** Add `welcomed_at: datetime, null: true` column to `brokerage_memberships` table via new migration. Default is NULL (no welcome seen). Set to `Time.current` when the user dismisses the banner.
- **D-15:** The dismiss action targets a new endpoint `POST /v1/account/profile/dismiss_welcome` (or extend `PATCH /v1/account/profile` with `{ welcomed: true }` param — planner picks the lower-friction option). The action sets `BrokerageMembership.welcomed_at = Time.current` for the current user + brokerage.
- **D-16:** The `welcomed_at` field (or a derived `show_welcome_banner: boolean`) is included in an existing user/profile endpoint response so the frontend can check it on load. The dashboard context reads this flag once on mount.

### ONB-03: Welcome Banner Content and Behavior

- **D-17:** Banner shows at the top of the main dashboard content area, below the nav, above the group list/activity feed. Rendered in the dashboard layout component.
- **D-18:** Banner is hidden immediately when the X button is clicked (optimistic update — set local state to hidden). The `dismiss_welcome` PATCH fires in the background. No loading state on the button.
- **D-19:** Banner content: brokerage name (from existing `GET /v1/dashboard/brokerage`) + user's group names displayed as pill chips. Groups fetched from existing `GET /v1/account/groups`. If the user has no groups yet: show "You haven't been added to any groups yet" instead of chips.
- **D-20:** Banner only shows when `welcomed_at` is null (never dismissed). It is not re-shown after dismissal even if the user joins new groups.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §Onboarding Fixes — ONB-01, ONB-02, ONB-03 with exact acceptance criteria
- `.planning/ROADMAP.md` §Phase 3 — success criteria (3 must-be-true conditions)

### Key Source Files — Domain Wizard (ONB-01)
- `frontend/src/containers/createBrokerage/steps/DomainStep.tsx` — error handling target; `handleContinue` needs try/catch
- `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx` — `submit()` function; existing `if (data.error)` branch
- `frontend/src/store/hooks/Auth/useCreateBrokerage.ts` — `onError` toast to remove/suppress
- `frontend/src/containers/createBrokerage/steps/SuccessStep.tsx` — redirect fix (`navigate` → `window.location.href`) and DNS verify button
- `frontend/src/components/createBrokerage/SubdomainInput.tsx` — existing `error` prop for inline validation display
- `frontend/src/components/createBrokerage/DnsInstructions.tsx` — existing DNS instructions component used in SuccessStep
- `backend/app/controllers/v1/onboarding/brokerages_controller.rb` — extend create response to include domain IDs (D-05)
- `backend/app/controllers/v1/admin/domains_controller.rb` — existing `verify` action called by DNS check button

### Key Source Files — Invite Redirect (ONB-02)
- `backend/app/controllers/v1/dashboard/invitations_controller.rb` — `#accept` and `#accept_token` — change `group.id.to_s` → `group.uid` (D-09)
- `frontend/src/containers/auth/joinBrokerage/JoinBrokerage.tsx` — fix `navigate` path in `handleAccept` (D-11)
- `frontend/src/containers/auth/Invitation.tsx` — fix `nextStep === 'dashboard'` navigate (D-12)
- `frontend/src/router/auth/auth.tsx` — auth router; `/auth/invitation/:invitationId` uses `Invitation` component
- `frontend/src/router/` — joinBrokerage router; `/invite/:token` uses `JoinBrokerage`

### Key Source Files — Welcome Banner (ONB-03)
- `backend/db/schema.rb` — current `brokerage_memberships` table (add `welcomed_at`)
- `frontend/src/store/hooks/queryKeys.tsx` — query key registry; add banner/membership keys here
- `frontend/src/assets/api/` — API module location for new dismiss endpoint call
- `GET /v1/account/groups` — existing endpoint for user's groups in current brokerage (banner data source)
- `GET /v1/dashboard/brokerage` — brokerage name source

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SubdomainInput` (`error` prop) — already supports inline error display; reuse for server-side uniqueness errors (D-01)
- `DnsInstructions` component — already rendered in SuccessStep for Premium; extend with verify button (D-06)
- `useCreateBrokerage` mutation — has `onError` handler; replace generic toast with inline error propagation
- `JoinBrokerage` auth inline rendering — already handles unauthenticated users in the same component; no new auth flow needed (D-13)
- `BrokerageMembership` model — target for `welcomed_at` column; existing `find_or_create_by!` pattern used in invitation accept
- `GET /v1/account/groups` — existing endpoint; groups fetched for banner content without new backend work
- shadcn/ui `Alert` or `Card` component — available for the banner UI; X dismiss button uses `lucide-react` `X` icon

### Established Patterns
- **Inline form errors:** `DomainStep` already uses `errors` state object keyed by field; extend with `errors.subdomain = serverMessage` from catch block
- **Optimistic updates:** the existing 403 handler (D-23 from Phase 1) does a `router.navigate('/')` immediately; banner dismiss follows the same "fire and forget" pattern
- **API module pattern:** `frontend/src/assets/api/` — add dismiss endpoint call here; call it from a TanStack `useMutation` hook following `useCreateBrokerage` pattern
- **Context owns local state:** dashboard context reads `show_welcome_banner` flag from profile query, owns local `bannerVisible` state with optimistic dismiss

### Integration Points
- `brokerage_memberships` table needs new `welcomed_at: datetime` column (migration required)
- Backend create brokerage response needs `subdomain_id` and `custom_domain_id` fields added to `domains` hash
- Dashboard layout component needs a banner slot at the top of content; consult the existing dashboard container to find the right place

</code_context>

<specifics>
## Specific Ideas

- For the DNS verify button: "Check DNS status" label with a refresh icon (`RefreshCw` from lucide-react). Spinner while in-flight. Neutral message on not-yet-verified — propagation delay is expected, don't show it as an error.
- Welcome banner dismiss is optimistic: hide immediately on X click, PATCH fires in background. No spinner, no "undo" — once dismissed it's gone.
- After DNS verification confirmed: show green badge and two CTA buttons side by side — "Go to custom domain" (primary) and "Go to subdomain" (secondary/outline variant).

</specifics>

<deferred>
## Deferred Ideas

- **Brokerage Admin DNS configuration page** — Brokerage Admin dashboard panel for viewing/verifying all domain records, managing custom domain DNS setup, and checking verification status. Suggested during ONB-01 discussion. Scoped out of Phase 3 — its own phase or Phase 4+ addition.

</deferred>

---

*Phase: 3-Onboarding Fixes*
*Context gathered: 2026-05-03*
