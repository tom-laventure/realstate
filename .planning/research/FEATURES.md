# Feature Landscape

**Domain:** Multi-tenant SaaS real estate brokerage platform — Milestone 2 feature additions
**Researched:** 2026-04-29

---

## Capability Area 1: Google Social Login

### Table Stakes

Features users expect. Missing = auth feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| "Continue with Google" button on login screen | Industry standard since 2020; users expect it alongside email/password | Low | Must appear visually equal weight to email/password, not buried below the form |
| Automatic account linking by email | Users assume "same email = same account"; a second account is always a surprise and erodes trust | High | Cognito does NOT do this by default — requires a PreSignUp Lambda trigger; see Pitfall below |
| Clear error on duplicate-account detection | If linking fails (first-time trigger exception), the user must not see a raw Cognito error string | Low | Catch the "Already found an entry" exception and surface a human-readable message |
| Post-Google-login redirects to the same destination as email login | Users expect consistent post-auth destination regardless of method | Low | Amplify social flow uses hosted UI redirect; ensure callback URL resolves correctly per tenant domain |
| Persistent "connected via Google" indicator in account settings | Users want to know which method they used; reduces "how do I log in?" support tickets | Low | Show provider badge (Google icon) next to email in profile/settings |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Connect/disconnect Google from profile settings | Lets users who initially signed up with email later add Google convenience login | High | Requires Cognito `adminLinkProviderForUser` API; cannot be done from Amplify client SDK alone |
| "Use Google" nudge on second password-fail | Surfaces social option when password auth is struggling — reduces lockout support tickets | Low | Simple conditional in the error state of the sign-in form |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Apple / Microsoft social login in this milestone | Out of scope per PROJECT.md; adds Cognito provider configuration and separate OAuth app registration overhead for zero current user demand | Defer to future auth milestone |
| Custom OAuth redirect implementation bypassing Cognito | Would create a second token issuance path outside `TokenService`, breaking multi-tenancy | Route everything through Cognito federated identity → `TokenService` |
| Showing all possible social providers on login screen | Visual clutter; three provider buttons with no clear default confuse users | One provider (Google) only; keep login form scannable |
| Allowing Google login without account linking (silent duplicate accounts) | Users end up with two profiles and fragmented data; creates unresolvable support situations | Mandatory PreSignUp linking or explicit merge prompt |

### Feature Dependencies

```
Google button on login → Cognito Google IdP configuration
Cognito Google IdP → App registered in Google Cloud Console (OAuth client ID/secret)
Account linking → PreSignUp Lambda trigger in Cognito user pool
Account settings "connected via Google" → linked provider list in Cognito (adminGetUser response)
```

---

## Capability Area 2: Personal Calendar Sync (Google / Apple / Microsoft)

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| OAuth-based connect flow per calendar provider | Users will not share calendar passwords; OAuth is the only acceptable authorization model | High | Each provider has its own OAuth app registration (Google Cloud, Microsoft Azure AD, Apple Developer) |
| Calendar management panel (connect, disconnect, sync status) | Users need a single place to see and manage their calendar connections; without it they can't diagnose sync issues | Medium | Should live in user profile/settings, not buried in a listing detail page |
| Sync `EstateDate` events on create | The primary user value: a listing appointment appears in their personal calendar automatically | High | Requires `UserCalendarConnection` model and a background job for the write |
| Sync update on `EstateDate` change | If a showing time changes, the calendar event must update; stale events cause missed appointments | Medium | Use provider-specific event update APIs; requires storing the provider's event ID alongside `EstateDate` |
| Sync delete on `EstateDate` removal | Orphaned calendar events after a cancelled showing erode trust in the feature | Medium | Soft-delete triggers must also fire the calendar delete job |
| Disconnect flow with confirmation | Users must be able to revoke calendar access; required by Google's OAuth policy (must not be impossible to revoke) | Low | Prompt: "This will remove future sync. Existing calendar events will not be deleted." |
| Sync failure indication | If a calendar write fails (token expired, quota exceeded), the user needs to know — otherwise they silently miss events | Medium | Store `last_sync_error` and `last_synced_at` on `UserCalendarConnection`; show in the management panel |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-event opt-in toggle ("sync this date to my calendar") | Lets users sync only showings they're personally attending, not all listing dates in their groups | Low | Toggle on `EstateDate` creation UI; default to on for the creating user, off for others |
| Sync status badge on individual `EstateDate` records | Shows "In your calendar / Sync failed / Not synced" per event — actionable and transparent | Low | Read from the job result stored against the event record |
| Manual "Re-sync" button on failed events | Recovers from transient failures without requiring the user to disconnect and reconnect | Low | Queues the write job again for that specific event |
| Token expiry graceful re-auth prompt | When stored OAuth token is expired, show an in-app banner: "Your Google Calendar connection needs to be renewed" | Medium | Detect 401 from calendar API in job, set `status: :expired` on connection, frontend polls connection status |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Two-way sync (reading events back from personal calendar into the platform) | Massively increases scope: requires webhooks or polling, conflict resolution, permission to read personal event titles | Out of scope; this is a write-only push sync |
| Syncing all group members' listing dates to every member's calendar by default | Flooding a calendar with all dates across every listing in every group would cause users to immediately disconnect | Default to no sync; user must connect and per-event opt-in is safer than bulk-push |
| Calendar provider selection on each event creation | Friction at point of event creation; users want their connected calendar to "just work" | Sync to all connected calendars automatically; provider selection belongs in settings, not per-event |
| Blocking the HTTP request on calendar API write | Calendar APIs can fail or be slow; blocking the user-facing request on a third-party write is a reliability risk | Always push writes through a SolidQueue job; return 200 to the user immediately |
| Apple CalDAV OAuth on day one | Apple's CalDAV implementation requires separate App-Specific Passwords or CalDAV credentials — no OAuth standard equivalent; user-hostile | Deliver Google Calendar first (highest-value, clean OAuth), then Microsoft Graph, then evaluate Apple |

### Feature Dependencies

```
Any calendar sync → UserCalendarConnection model (stores provider, access_token, refresh_token, provider_event_mapping)
Any calendar sync → SolidQueue background job
Google Calendar sync → Google Cloud OAuth app + Calendar API scope
Microsoft calendar sync → Azure AD OAuth app + Microsoft Graph API scope
Apple calendar sync → iCloud CalDAV credentials (no clean OAuth path)
Sync update/delete → Provider event ID stored at write time (mapping table or column on EstateDate)
Disconnect flow → Provider token revocation API call + destroy UserCalendarConnection record
```

---

## Capability Area 3: Onboarding Fix UX

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Domain setup step completes end-to-end without crash | A broken setup step means a brokerage owner cannot finish creating their workspace — complete blocker | Medium | Must validate domain format, persist `BrokerageDomain`, and confirm to the user before proceeding |
| Domain availability/format feedback in real time | Users enter subdomains with uncertain format rules; they need immediate inline validation, not a server error after submit | Low | Client-side regex for allowed characters + async availability check on blur |
| Progress indicator on the creation wizard | Users don't know how many steps remain; a numbered step indicator ("Step 2 of 4") reduces abandonment | Low | Already partially exists in the wizard; ensure it reflects actual step count accurately |
| Post-join redirect lands the user inside their brokerage workspace | After accepting an invitation, the user must see the brokerage dashboard — not the homepage, a blank screen, or a 404 | Medium | Store the brokerage context (via `BrokerageDomain`) in the redirect URL from the invitation link; verify it resolves on landing |
| Welcome state on first dashboard visit | New members land on the dashboard with a clear orientation message — "You've joined Acme Realty. Here's what you can do." | Low | A simple welcome banner or empty state copy; collapses on first interaction |
| Clear "you've been added to the following groups" on landing | Invited users are likely pre-assigned to groups; surfacing this immediately makes the product feel ready to use | Low | Show the groups they're a member of in the welcome state; link directly into each group |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Domain preview during setup ("Your brokerage URL will be: acme.yourproduct.com") | Concrete preview reduces domain mis-entry; users understand what they're committing to | Low | Render preview string reactively as the user types |
| Email confirmation of successful brokerage creation | Gives the owner a durable record of their workspace URL and login info | Low | Simple transactional email from existing mailer infrastructure |
| Invited user mini-profile setup on first login | Ask for display name and role description on first login for invited users; pre-fill from invitation data | Low | 1-step form, dismissible; feeds into user profile completeness |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full wizard rewrite | The wizard exists and works for most steps; only domain validation and post-join redirect are broken — surgical fixes are faster and lower risk | Fix the two broken steps in place; no rewrites |
| Collecting non-essential information in setup wizard | Every extra field increases abandonment; domain + company name is sufficient to create a functioning workspace | Move optional info (logo, billing, team size) to post-setup settings screens |
| Redirect to homepage after invitation accept | Homepage has no workspace context; new users get a blank or wrong-brokerage view | Always redirect to the brokerage-specific domain URL after accept |
| Silent failure on domain save | If the domain `BrokerageDomain` record fails to create, do not advance the wizard — show the error inline and let the user retry | Block wizard progression on any step that has unsaved state |

### Feature Dependencies

```
Domain validation step → BrokerageDomain model + uniqueness check endpoint
Post-join redirect → InvitationsController#accept_invitation must return redirect URL (must also fix current_user → Current.user bug)
Welcome banner → First-login detection (e.g. created_at == updated_at or explicit flag on BrokerageMembership)
```

---

## Capability Area 4: Admin Role Enforcement

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Server-side 403 for non-admin calling admin endpoints | Frontend guards are a UX nicety; backend enforcement is the actual security boundary — without it the platform has no real authorization | Low | `Admin::BaseController#require_admin!` before_action checking `BrokerageMembership#role` against `%w[owner admin]` |
| Consistent 403 JSON response shape | API consumers (Axios interceptor, test suites) need a predictable shape: `{ error: { code: "forbidden", message: "..." } }` | Low | Centralize in `Admin::BaseController#require_admin!` or `ApplicationController#handle_forbidden` |
| Frontend redirect to safe location on 403 | When Axios receives a 403, the user should be redirected to the dashboard (not left on a blank or errored admin page) | Low | Add 403 handling to the Axios interceptor alongside the existing 401 handler |
| Non-admin users never see admin navigation links | Showing links that lead to a wall is confusing; existing `RequireRole` / `Can` guards cover this but must match server-side role list | Low | Ensure `RequireRole` uses the same roles (`owner`, `admin`) as the backend check |
| Human-readable access-denied message | "You don't have permission to do that" is more trustworthy than a raw HTTP status or a redirect with no explanation | Low | Dedicated "Access Denied" page or toast message triggered by the 403 handler |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Request admin access" prompt on access-denied page | Gives the user a path forward instead of a dead end; reduces support load | Low | Link to contact the brokerage owner; static mailto or in-app message |
| Audit log of 403 rejections | Security visibility: owners can see who attempted to access admin functionality | High | Out of scope for this milestone; flag for future security milestone |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Returning 404 instead of 403 for unauthorized admin resources | "Security by obscurity" through 404 creates confusion when legitimate admins accidentally hit the wrong URL | Return 403 with a clear message; reserve 404 for genuinely absent resources |
| Logging out the user on 403 | 403 means the user IS authenticated but lacks permission; logging them out is incorrect and adds re-auth friction | Redirect to dashboard with an access-denied toast; only log out on 401 |
| Per-controller role lists | Duplicating `%w[owner admin]` in every controller creates drift risk (e.g. someone adds a role to one controller but not another) | Single check in `Admin::BaseController` inherited by all admin controllers |
| Client-side-only enforcement after this milestone | Current state (frontend-only guards) must be the last milestone in this state; this milestone closes the gap | Server enforcement first; frontend guards remain as UX layer only |

### Feature Dependencies

```
Server-side 403 → Admin::BaseController with require_admin! before_action
Admin::BaseController → BrokerageMembership role check (owner or admin)
Frontend 403 handling → Axios interceptor update (add 403 case alongside existing 401)
Frontend access-denied page → New route (e.g. /unauthorized) rendered by ProtectedRoute logic
Consistent 403 shape → ApplicationController rescue_from or base controller render_forbidden helper
```

---

## Cross-Cutting MVP Recommendation

Given the milestone scope, build in this priority order:

**Must ship (blocker or security):**
1. Admin role enforcement (server-side 403) — closes an active security gap where any authenticated user can call admin APIs
2. InvitationsController `current_user` bug fix — without this, the post-join experience crashes before it can be improved
3. Google "Continue with Google" button + Cognito federation — core new user-facing feature; Cognito config must come first
4. Account linking via PreSignUp Lambda — required to prevent duplicate accounts; non-negotiable for production use

**Ship together (onboarding coherence):**
5. Domain setup validation fix + domain preview
6. Post-join redirect fix (lands on brokerage dashboard)
7. Welcome banner on first dashboard visit

**Ship together (calendar — ordered by OAuth complexity):**
8. `UserCalendarConnection` model + calendar management panel (settings)
9. Google Calendar sync (create/update/delete on `EstateDate` events)
10. Sync failure indicator + manual re-sync button
11. Microsoft Graph calendar sync
12. (Evaluate Apple CalDAV separately — do not block Google/Microsoft delivery)

**Defer:**
- Connect/disconnect Google from profile settings (needs Cognito admin API; defer if Cognito federation ships first and users can link at sign-in time)
- Two-way calendar sync — never in this milestone
- Audit log of 403 rejections — future security milestone

---

## Sources

- [AWS Cognito Federated Auth — account linking](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation-consolidate-users.html)
- [Cognito PreSignUp trigger account linking (bobbyhadz)](https://bobbyhadz.com/blog/aws-cognito-link-user-accounts)
- ["Already found an entry" duplicate account error — Amplify GitHub issue](https://github.com/aws-amplify/amplify-js/issues/11565)
- [How to set up Cognito social sign-in with Google](https://oneuptime.com/blog/post/2026-02-12-cognito-social-sign-in-google/view)
- [Login & signup UX best practices 2025 — Authgear](https://www.authgear.com/post/login-signup-ux-guide)
- [Social logins Frontegg overview](https://frontegg.com/blog/social-logins)
- [Google Calendar API — create events](https://developers.google.com/workspace/calendar/api/guides/create-events)
- [Google Calendar API scopes](https://developers.google.com/workspace/calendar/api/auth)
- [OneCal — calendar sync SaaS patterns](https://www.onecal.io/)
- [Calendar Sync API for SaaS — Unipile](https://www.unipile.com/calendar-sync-api-for-saas-real-time-google-outlook-integration/)
- [How to integrate Google Calendar API into your app](https://www.onecal.io/blog/how-to-integrate-google-calendar-api-into-your-app)
- [SaaS onboarding UX best practices — Cieden](https://cieden.com/saas-onboarding-best-practices-and-common-mistakes-ux-upgrade-article-digest)
- [Onboarding invited users — Userpilot](https://userpilot.com/blog/onboard-invited-users-saas/)
- [Invitation flow handling — Auth0 community](https://community.auth0.com/t/handling-invitation-flow-for-user-signup-and-redirection/144103)
- [Implementing RBAC in React — Permit.io](https://www.permit.io/blog/implementing-react-rbac-authorization)
- [401 vs 403 best practices — CyberPanel](https://cyberpanel.net/blog/401-vs-403)
- [403 Forbidden — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/403)
