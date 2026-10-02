# Board ↔ Brokerage Data-Access Model

**Status:** Design finalized via `grill-me` session (2026-09-09); **revised 2026-09-30** after GVR answers (see below); not yet implemented. This is **Phase 1 (ADR) of RB-82** — a written decision to be approved before any migration. Phases 2–3 (schema rework, good-standing gate) split into their own tickets after approval. Several points are marked **pending RB-81** — GVR answers that don't block drafting or approval of the *shape*, only final constants.

Read this before touching `brokerage_board_credentials`, `Estate.accessible_by`, the Bridge sync jobs, or `BoardCredentialRevocationPurgeService`. Mirrors the reference style of `PLAN-TIERS.md` / `JWT-HTTPONLY-COOKIES.md`.

## Revision 2026-09-30 — GVR answers (supersedes conflicting rows below)

GVR (Timothy Yee) answered the RB-81 questions on 2026-09-25 in the "Pre-launch inquiry" email thread. A follow-up `grill-me` session (2026-09-30) revised the design. **Where this section conflicts with the tables below, this section wins.** Tickets: RB-83, RB-84, RB-85, RB-77 updated; RB-92 created.

| Topic | GVR answer | Revised decision |
|---|---|---|
| Provisional vs hard gate (Q1) | "You must get authorization before providing service." GVR exposes custom IDX/VOW-approval fields on the `Member` resource | **Hard gate.** No MLS data until authorized. Path 1: roster match + GVR approval flag → `confirmed` instantly. Path 2: email the primary board ("Is <agent name> <agent id> from <brokerage name> approved for VOW?"); verification stays `pending`, ops records the reply via override. Entitlements go `active` on *authorization*, not a bare roster match |
| Click-through link (Q2) | Deferred — GVR internal process changes over the next 6 months | **No tokenized landing page.** Drop `token` / `token_expires_at` / `decision_ip`. Plain email; revisit only if GVR opts in |
| Recipients (Q2) | GVR idx@gvrealtors.ca · FVREB helpdesk@fvreb.bc.ca · CADREB cadrebmls@cadreb.com · BCNREB (VOW only) lori@bcnreb.bc.ca | New `real_estate_boards.verification_email` |
| No response (Q4) | Usually actioned the same week; otherwise send a follow-up | Auto follow-up after 5 business days; second non-response → flag to ops. Access withheld throughout |
| Per-board coverage (Q5) | Primary board's approval is sufficient via reciprocal agreements. BCNREB excepted (no IDX, no VOW reciprocity, own members/data only) | New `real_estate_boards.reciprocity_group` (GVR/FVREB/CADREB = `lower_mainland`, BCNREB = null). Primary-board verification covers its group (boards active + vendor credential). Memberships outside the primary's group verified separately. BCNREB data only syncs/unlocks via a BCNREB member — already implied by "dispatch only boards with ≥1 active entitlement" |
| Partial access (Q6) | Not answered | Not pursued further for now |
| Lapse (Q7) | No push notice; periodic checks expected with a reasonable grace period before contacting the board | Nightly roster sync sets `lapsed_at` (status off allowlist / approval flag false / roster row gone); access continues; recovers silently; **day 7** → `revoked` + recompute + board email (re-enters manual flow) |
| Retention (Q8) | Only store data available in the feed; refresh ≥ daily; short-term backups tolerated but enforceable at any time | `BoardDataRetentionPurgeJob` grace window = **7 days**. Separately, **RB-92**: replace capped full reconcile with uncapped nightly IDs-only diff; purge listings/roster rows no longer in the feed (only after a complete scan; abort > ~20%) |

**Revision 2026-10-01 (RB-83) — Bridge auth corrects the "vendor credential" design.** Bridge Data Output issues **one server token per application**, sent as `Authorization: Bearer <token>` for every MLS dataset the app has been granted; a board is addressed by its **dataset id in the URL** (`https://api.bridgedataoutput.com/api/v2/OData/{dataset_id}`). There is no OAuth client-credentials exchange. So: no `vendor_client_id/secret` or `vendor_token_cache` columns; a single `BRIDGE_SERVER_TOKEN` env var (Render) used by `BridgeClient`; boards keep only `resource_url` (dataset URL) and drop `token_url`/`scopes`; ops "Test connection" (`GET {resource_url}/Property?$top=1`) records `dataset_verified_at` (403 = board hasn't granted the dataset yet). Also from the RB-83 grill-me: `brokerage_board_credentials` renamed to **`brokerage_board_connections`**; statuses `pending`/`active`/`dormant`/`suspended` (`invalid` dropped); real-board connect creates `pending`, activated by an **ops "Activate"** action (required note) until RB-84; plan downgrade suspends pending/active/dormant real-board connections and restores each to `status_before_suspension`; nightly `BoardDataRetentionPurgeJob` maintains `access_revoked_at` itself and purges after 7 days (board data hard-deleted, empty `Estate` shell soft-deleted).

**Board memberships are user-level and multi-board.** New `user_board_memberships` (`user_id`, `real_estate_board_id`, `member_mls_id`, `primary`, paranoid). Collected by a new onboarding step in both the `CreateBrokerage` flow and invitation acceptance (owner/admin/agent/staff; never clients), with an "I'm not a board member" escape hatch and editing in Account settings. The MLS Member ID is no longer entered at board connect. Board list includes inactive registered real boards (GVR sits inactive until live); verification auto-runs when a board goes live.

**Group-based access for unverified staff / unlicensed owners.** A user without a covering verification may access MLS data only inside a group containing ≥1 member with a covering `confirmed` verification (lapsed-within-grace counts; `pending` doesn't): view/comment/rate/notes on existing group listings only — no MLS search/browse, no adding MLS listings. Evaluated per request. *Our interpretation, not GVR-confirmed* — before go-live, ask GVR whether unlicensed staff can adjust existing groups (what listings a group pulls in, listing additions).

## Problem

The current model assumes **each brokerage brings its own board credentials**:

- `brokerage_board_credentials` stores per-brokerage encrypted `client_id_ciphertext` / `client_secret_ciphertext` (Rails 7.1 `encrypts`), validated on entry against the board's OAuth endpoint via `ResoAuthService`.
- `Estate.accessible_by(brokerage)` grants a brokerage a board's listings **iff** it holds a row for that board with `status = 'active'` and `deleted_at IS NULL` (raw `EXISTS` subquery in `backend/app/models/estate.rb`).
- Sync jobs (`bridge_listing_import_job`, `bridge_member_import_job`, `sync_listing_photos_job`) read `credential.client_id` / `credential.client_secret` per brokerage; the dispatch jobs fan out over `Brokerage.joins(:brokerage_board_credentials).merge(... status: "active")`.
- `BoardCredentialRevocationPurgeService` purges a board's shared listing/member cache **synchronously** the moment the last `active` credential platform-wide is destroyed (`board_credentials_controller#destroy`).
- `apply_plan_transition_job` suspends/reactivates a brokerage's credential rows on plan down/upgrade (real-board access is plan-gated per `plan_config.real_boards`).
- Free-tier brokerages get credential-less rows for the seeded `TEST` board (validation bypassed); `TEST` board is exempt from every purge path.

The **GVR vendor agreement** (confirmed on the 2026-09-09 call — see RB-58) changes the premise:

- RealtyBase signs **one vendor agreement per board** and holds **one platform-level API credential per board**. That agreement covers data access for **every brokerage RealtyBase onboards** — there is no per-brokerage board fee and no per-brokerage credential (this corrected an earlier assumption from online research; see RB-58 "vendor vs. member contract").
- A brokerage's right to see a board's data is instead conditioned on its **members being confirmed in good standing with that board** — authenticated against the Member roster RealtyBase already syncs from the Bridge feed (`board_members`, RB-76), plus a one-time verification email to the board.

So `brokerage_board_credentials` should stop being a *credential* store and become an **entitlement**: "this brokerage may see this board's data, and here is its good-standing state."

## Target model

Three concepts, each carrying `real_estate_board` as a dimension so a member/brokerage in good standing with one board but not another is represented directly:

1. **Vendor credential** — one per board, platform-owned, stored on `real_estate_boards`. The only thing that authenticates to the Bridge feed.
2. **Brokerage board entitlement** — the repurposed `brokerage_board_credentials` row. `(brokerage, board)`, `status` driven by member good-standing, not credential validation. This is what `Estate.accessible_by` continues to check — unchanged in shape.
3. **Member good-standing verification** — new `BoardMembershipVerification`, `(user, board)`. A roster match + allowlisted `member_status` grants **provisional** access; a one-time board email is a reject/revoke backstop; the nightly roster sync is the ongoing source of truth thereafter.

Access unit stays **per-`(brokerage, board)`** for the estate scope (cheap, callers untouched); **per-`(member, board)`** verification is enforced separately in a Phase 3 request-level concern on MLS endpoints (mirrors RB-64's `GroupMembershipScoping` gate).

## Key decisions

| Decision | Rationale |
|---|---|
| Vendor credential lives in **encrypted columns on `real_estate_boards`** (`vendor_client_id_ciphertext`, `vendor_client_secret_ciphertext`, plus a cached-token column), managed through the existing `ops/real_estate_boards` ERB views | One row per board already exists, platform-managed and seeded; ~4 BC boards, one credential each, rotated rarely — a dedicated table is overkill and ENV/Rails-credentials can't be rotated without a redeploy or surfaced in the ops UI |
| `brokerage_board_credentials` is **repurposed as an entitlement**, not replaced — drop the two secret columns, keep `brokerage_id` / `real_estate_board_id` / `status` / `deleted_at`, add `activated_at` and a link to the verification that activated it | The table is already `(brokerage, board)` keyed with a `status` enum and is already what `accessible_by`, the purge service, and the dispatch filters join on — keeping the shape means those systems change meaning, not structure |
| **Rename** `brokerage_board_credentials` → `brokerage_board_connections` (table, model, serializer, routes, frontend `fetchBoardCredentials`/`createBoardCredential`/types) is **recommended but not mandated** — Phase 2 decides | The name becomes a lie once secrets are gone; the rename is wide but shallow (raw SQL in `accessible_by`, one service, one serializer, a handful of frontend files). Deferring it keeps Phase 2 smaller; doing it avoids a permanent misnomer |
| Entitlement lifecycle: admin requests a board → row created `pending` → first member passes good-standing → `active`; goes **dormant** (`status` back to `pending`, or a `dormant` state) when the last `pending`/`confirmed` member for that board leaves or lapses | Ties entitlement directly to the good-standing gate, with no separate "enter credentials" step. An explicit row (vs. a pure derived query) gives a place to hang per-brokerage board status, `activated_at`, and plan-transition suspension |
| `Estate.accessible_by` stays **brokerage-scoped and structurally identical** — same `EXISTS` JOIN, same `status='active' AND deleted_at IS NULL`. Only the *meaning* of `active` changes | Keeps the hot path cheap and every caller untouched. Per-member good-standing is a separate concern-level check on MLS endpoints, not a new join in the estate scope |
| New model **`BoardMembershipVerification`** — `user_id`, `real_estate_board_id`, `brokerage_id` (initiating context), `board_member_id` (matched roster row, FK `ON DELETE SET NULL`), `submitted_member_mls_id` + `roster_member_status` (frozen snapshot), `status`, `token` + `token_expires_at`, `email_sent_at` / `email_status`, `decided_at` / `decided_via` / `decision_ip` / `decision_note`, timestamps. **No `acts_as_paranoid`** | It is RealtyBase's permanent audit trail that member due-diligence was performed — it must survive a `board_members` purge (hence the frozen snapshot columns and `ON DELETE SET NULL`), and it should never be soft-deleted away |
| Verification `status`: `pending` (email sent, provisional access live) → `confirmed` / `rejected` / `expired`; plus `revoked` (was `confirmed`, later lost). One **live** record per `(user, board)` where live = `pending` or `confirmed` | Covers the full lifecycle including a board changing its mind and the roster later contradicting a past confirmation |
| **`rejected` is sticky** — re-triggering verification while a `rejected` record exists is blocked; only a RealtyBase ops override (→ `confirmed` with a note) clears it. Re-trigger with `confirmed` present is a no-op; `expired` allows a fresh attempt | Stops a rejected user from re-submitting and spamming the board. Ops override covers the stale-roster false-positive case |
| Match strategy: a **required "MLS Member ID" field** at the gate → exact match against `board_members` for that board (fallback `member_key`), with `user.email` vs `board_members.email` as a corroborating auto-match. Plus a per-board **`member_status` allowlist**, default `["Active"]` | License number ≠ board-assigned MLS ID in BC, so the field is labelled "MLS Member ID". Email alone is too brittle (agents register with a different address than the board holds). Exactly one roster row must match **and** its status must be allowlisted |
| Access is **provisional on a positive roster + allowlisted-status match** — the user proceeds immediately; the board email can only *reject/revoke*, it is not a blocking gate | We already have a positive check against the synced roster; putting a manual board email-click on the critical path of every signup would make onboarding unusable and assumes GVR actions every email. Matches the "just a verification check" framing from the call. **Pending RB-81 Q1** — GVR to confirm this posture is acceptable vs. requiring a hard gate |
| Staying current: **no periodic re-verification email.** Once the live roster sync runs, the nightly `bridge_member_import_job` is the ongoing check — a `confirmed` user whose `board_members.member_status` falls out of the allowlist has their verification flipped to `revoked`, triggering an entitlement recompute | The synced roster is a better, continuous source of truth than a timed re-email (cf. RB-64's 30-day VOW grant, which exists because there is no roster to lean on for consumers). The board email is a one-time initial gate only |
| Board confirm/reject link: **tokenized URL on the verification record, no login** (the token is the authorization). **GET-safe** — the link opens a server-rendered branded landing page that performs no mutation on GET, showing the applicant + brokerage details and *Confirm in good standing* / *Not in good standing* buttons that POST back with CSRF protection. Rendered by a small public controller, sibling to the `ops` views but outside ops auth | A raw state-mutating GET would be auto-triggered by email scanners/prefetchers. Board staff have no RealtyBase login, so the token must stand in for auth |
| The board decision is **reversible until `token_expires_at`** (default **30 days**) — a board can flip `confirmed` → `rejected` if it spots a mistake; each flip re-runs the entitlement recompute and is logged. After expiry the page shows "contact RealtyBase" | Boards act asynchronously and make mistakes; a short reversible window is more useful than a one-shot irreversible click |
| **Reject consequences (soft):** verification → `rejected`; the user loses good-standing for *that board* → entitlement recompute (dormant if they were the last verified member); notify RealtyBase ops **and** the brokerage owner/admin. **Do not** auto-suspend `brokerage_membership`; **do not** touch other boards. Sole-`owner` edge case → never lock out, escalate to ops | A rejection may be a stale-roster false positive; suspending a membership (or worse, locking out a brokerage's only owner) is disproportionate and hard to reverse. Losing one board's data + a notification is the proportionate response |
| Match-failure UX: three distinct messages — (a) no roster row for that Member ID, (b) matched but `member_status` not allowlisted, (c) roster not synced yet → gate is inert and the board connects normally. Persist a lightweight `status: 'unmatched'` verification row (no token, no email) for ops visibility; rate-limit attempts per `(user, board)` | Clear remediation guidance per failure mode; the `unmatched` rows give ops a signal that someone is stuck; the rate limit prevents roster enumeration through the gate |
| Sync auth: jobs read the **per-board vendor credential off `real_estate_boards`** — one OAuth per board, not per-brokerage. Dispatch iterates boards that have a vendor credential **and** ≥1 active entitlement | The platform credential is now the only thing that authenticates; per-brokerage fan-out for *auth* is obsolete (fan-out for *entitlement filtering* — which brokerages see the result — still happens downstream) |
| Retention purge: `accessible_by` still cuts access **instantly** when an entitlement goes inactive — nothing is *readable* during the grace window. Purge moves from synchronous-on-last-credential-lost to a **nightly `BoardDataRetentionPurgeJob`**: purge a board's shared cache (`Estate` / `ListingDetail` / `BoardMember`) only if it has had **zero active entitlements for ≥ a grace window**. Track `real_estate_boards.access_revoked_at` (set when the active-entitlement count hits 0, cleared when it goes back above 0) as the sweep signal and audit timestamp. Remove the synchronous call in `board_credentials_controller#destroy`. `TEST` board stays exempt | Entitlements now flip on member good-standing state, which is far more volatile than "brokerage entered credentials" — a brokerage could lose its last verified member at 2pm and verify a new one at 4pm. Purging + re-syncing the entire shared cache in that window is wasteful and risky. Grace-window length is **pending RB-81 Q8** (REB-3 / Schedule A revocation-to-destruction deadline) |
| `apply_plan_transition_job` still suspends/reactivates the brokerage's board **entitlements** on plan down/upgrade — unchanged in shape (real-board access stays plan-gated per `plan_config.real_boards`) | Plan gating is orthogonal to good-standing; both must be satisfied |
| `TEST` boards **bypass the vendor credential and the good-standing gate entirely** — entitlement rows are created `active` on attach, exactly as today, keyed off `is_test_board?` | The `TEST` board is demo data with no real feed and no roster; none of the vendor/good-standing machinery applies |
| **Rollout is a hard cut — no feature flag, no coexistence path** — there is no live production traffic and the project is still in development. Non-`TEST` real boards always run the vendor + good-standing path; `TEST` boards always bypass. "Board not ready for real use" is handled by the **existing `real_estate_boards.active` flag** (`board_credentials_controller#create` already filters `RealEstateBoard.active.find_by`) — GVR sits `active: false` until its vendor credential and roster are real, then flips on. Dev seeds provide a fake vendor credential and `board_members` rows (`db/seeds/06_board_members.rb` already exists) so the whole flow is exercisable locally | A flag-gated migration only earns its complexity when there is production data to protect; there is none. The `active` flag already gives per-board "not ready yet" control without a new column |
| Live-feed verification stays a **separate follow-up** (RB-77 precedent) — confirm real `member_status` values, `MemberMlsId` semantics, and roster completeness against the actual Bridge feed once access is granted | Same "ship ahead of live board access" posture as the RB-76 member sync; the allowlist and match fields carry code TODOs to revisit |

## Data model changes

### `real_estate_boards` (add)

| Column | Type | Notes |
|---|---|---|
| `vendor_client_id_ciphertext` | string, nullable | Rails `encrypts`. Null until the board's vendor agreement is live |
| `vendor_client_secret_ciphertext` | string, nullable | Rails `encrypts` |
| `vendor_token_cache` | jsonb / text, nullable | Cached OAuth access token + expiry, same idea as `ResoAuthService` per-request fetch but shared |
| `access_revoked_at` | datetime, nullable | Set when the active-entitlement count for this board hits 0; cleared when it goes back above 0. Drives `BoardDataRetentionPurgeJob` |

`active` (existing boolean) is the "ready for real use" switch — no new column for that.

### `brokerage_board_credentials` → entitlement (`brokerage_board_connections` if renamed)

| Change | Detail |
|---|---|
| **Drop** `client_id_ciphertext`, `client_secret_ciphertext` | No per-brokerage secrets anymore |
| **Keep** `brokerage_id`, `real_estate_board_id`, `status`, `deleted_at`, timestamps | `status` enum gains/repurposes values: `pending` (requested, no verified member yet), `active` (≥1 verified member), `dormant` (had one, lost it), `suspended` (plan transition) |
| **Add** `activated_at` (datetime, nullable) | First time it went `active` |
| **Add** `activating_verification_id` (FK → `board_membership_verifications`, nullable) | Audit: which verification first flipped it on |
| Unique index `(brokerage_id, real_estate_board_id) WHERE deleted_at IS NULL` | Unchanged |

### `board_membership_verifications` (new)

| Column | Type | Notes |
|---|---|---|
| `user_id` | FK | |
| `real_estate_board_id` | FK | |
| `brokerage_id` | FK | Context where verification was initiated |
| `board_member_id` | FK, nullable, `ON DELETE SET NULL` | Matched roster row |
| `submitted_member_mls_id` | string | What the user typed — frozen |
| `roster_member_status` | string, nullable | Snapshot of `board_members.member_status` at match time — frozen |
| `status` | string/enum | `pending` / `confirmed` / `rejected` / `expired` / `revoked` / `unmatched` |
| `token` | string, unique, nullable | Board link token; null for `unmatched` rows |
| `token_expires_at` | datetime, nullable | Default 30 days from send |
| `email_sent_at` | datetime, nullable | |
| `email_status` | string/enum | `pending` / `sent` / `failed` (mirror `Invitation`) |
| `decided_at` | datetime, nullable | |
| `decided_via` | string, nullable | e.g. `board_link`, `ops_override` |
| `decision_ip` | string, nullable | |
| `decision_note` | text, nullable | Ops override reason, etc. |

No `acts_as_paranoid`. Partial unique index enforcing one live (`pending`/`confirmed`) row per `(user_id, real_estate_board_id)`.

## Access-control flow (target)

**Brokerage connects a real board** (`board_credentials_controller#create`, non-`TEST`, board `active: true`):
1. Requesting admin/owner submits their MLS Member ID.
2. Look up `board_members` for `(board, submitted_mls_id)`. Corroborate against `user.email` if present.
3. No unique match, or `member_status` not in the board's allowlist → render the matching failure message, persist an `unmatched` verification row, stop (rate-limited).
4. Unique allowlisted match → create the entitlement row (`pending`), create a `BoardMembershipVerification` (`pending`) with a token, enqueue the board verification email, flip the entitlement to `active` (`activated_at`, `activating_verification_id`). The brokerage sees the board's listings immediately.

**Board acts on the email link** (public tokenized landing page):
- *Confirm* → verification `confirmed`. No access change (already provisional). Log.
- *Not in good standing* → verification `rejected`. Recompute the entitlement (dormant if this was the last verified member). Notify ops + brokerage owner/admin. Log.
- Reversible until `token_expires_at`.

**Nightly roster sync** (`bridge_member_import_job`, once live):
- For every `confirmed` verification whose matched `board_members.member_status` is no longer allowlisted (or whose roster row vanished) → flip to `revoked`, recompute entitlements.

**Nightly `BoardDataRetentionPurgeJob`:**
- For every board with `access_revoked_at` older than the grace window and still zero active entitlements → purge `Estate` / `ListingDetail` / `BoardMember` for that board (the existing `BoardCredentialRevocationPurgeService` logic, moved behind the schedule). `TEST` board skipped.

**Phase 3 request concern** (MLS dashboard endpoints):
- Require the current user to hold a live (`pending`/`confirmed`) verification for the board backing the resource, on top of the brokerage entitlement `accessible_by` already checks.

## Open questions (pending RB-81) — resolved 2026-09-30, see "Revision 2026-09-30" above (kept for history)

| # | Question | Effect if the answer differs from our assumption |
|---|---|---|
| RB-81 Q1 | Is provisional access on a positive roster match acceptable, or does GVR require a hard gate until a staffer confirms each signup? | A hard-gate answer turns "provisional" into "pending" — entitlement stays `pending` and MLS data is withheld until *Confirm* is clicked. Model already supports this (`pending` state); only the activation step changes |
| RB-81 Q2 | Which address do verification emails go to, and is a no-login click-through link acceptable? | Changes the recipient config and possibly the whole link mechanism (e.g. if GVR wants a portal instead) |
| RB-81 Q3 | Which `MemberStatus` / `MemberType` values count as "in good standing"? | Sets the real allowlist; default `["Active"]` is a placeholder |
| RB-81 Q4 | What to do when GVR never actions an email? | Adds a timeout transition (leave / suspend / escalate) not yet in the state machine |
| RB-81 Q5–6 | With per-board VOW approval (board coverage is per-application, confirmed by Tim): is good-standing confirmation required per board, or does one board's confirmation cover all approved boards; and is partial (one-board) access permitted when standing is split? | Blanket-standing would let one board's `confirmed` verification satisfy sibling boards — a change to the recompute logic, not the schema (board dimension stays) |
| RB-81 Q8 | Maximum retention window between access revocation and mandatory destruction (REB-3 / Schedule A) | Sets the `BoardDataRetentionPurgeJob` grace-window constant |

## Phase breakdown (split into tickets after this ADR is approved)

**Phase 2 — schema + access-control rework**
- `real_estate_boards` vendor credential columns + `access_revoked_at`; `ops/real_estate_boards` UI to manage them.
- Drop per-brokerage secret columns; repurpose `brokerage_board_credentials` as the entitlement (optional rename to `brokerage_board_connections`).
- Rework `board_credentials_controller#create`/`#update` — drop the `ResoAuthService`-on-create branch; `create` becomes "request entitlement".
- Swap sync-job auth (`bridge_listing_import_job`, `bridge_member_import_job`, `sync_listing_photos_job`, dispatch jobs) to the per-board vendor credential.
- `BoardDataRetentionPurgeJob` (nightly) + `access_revoked_at` maintenance; move `BoardCredentialRevocationPurgeService` logic behind it; delete the synchronous `#destroy` call.
- Dev seeds: fake vendor credential + `board_members` rows.
- Frontend: `board_credentials` module rename (if chosen), remove the credential-entry form fields.

**Phase 3 — member good-standing gate + board verification**
- `BoardMembershipVerification` model + migration + partial unique index.
- MLS Member ID capture at real-board connect; roster match + allowlist check; `unmatched` rows + rate limiting.
- Provisional entitlement activation wired to a positive match.
- Tokenized board confirm/reject landing page + public controller (GET-safe, CSRF POST); reversible-until-expiry.
- Verification mailer (board email) — model on `invitation_mailer` / `vow_registration_mailer`.
- Ops override (→ `confirmed` with note) + ops/owner notifications on reject.
- Entitlement recompute service, called from: verification decision, `revoked` transition, nightly roster sync, membership departure.
- Request-level per-member concern on MLS dashboard endpoints.
- Full activation gated on RB-81 answers + signed vendor agreement + issued Bridge platform credential + RB-77.

### Admin & ops surfaces

Two admin surfaces touch board access. The brokerage-admin UI changes ride along with Phases 2–3; the ops-side split is called out below.

**Brokerage-admin board UI** (`frontend/src/components/view/admin/brokerageView/`, `BrokerageAdminBoardContext`, `assets/api/admin/boards/*`, `store/hooks/Admin/Boards/*`, `assets/types/boardType.ts`)

| Change | Phase |
|---|---|
| `ConnectBoardDialog.tsx` — drop the `credentials` step (clientId/clientSecret) for real boards; the wizard becomes `select` → (`test-board-info` \| `member-verification`) → `success` \| `verification-failed`. New step captures the **MLS Member ID** and explains that a good-standing check runs and a confirmation email goes to the board. `test-board` path unchanged | 3 (2 removes the fields, 3 adds the verification step — land together) |
| `EditBoardCredentialDialog.tsx` — **delete**. No per-brokerage credential to edit. If a "re-run verification" affordance is wanted, it's a new small dialog, not this one | 2 (delete) / 3 (optional re-verify) |
| `BoardRegistrations.tsx` — `Status` column semantics change to `active` / `pending` / `dormant` / `suspended`; remove the "Edit credentials" row action; add a per-board verification summary (e.g. "3 members verified", or a "needs attention" state when an entitlement is `pending`/`dormant`) | 3 |
| `boardType.ts` + API/hooks — `BoardCredentialType` → connection/entitlement shape; drop `CreateBoardCredentialPayload` / `UpdateBoardCredentialPayload` credential fields; add verification-status types; rename the `boards`/`board_credentials` API module iff the backend table is renamed | 2 |
| `RealEstateBoardSerializer` — add `vendor_client_id_ciphertext` / `vendor_client_secret_ciphertext` / `vendor_token_cache` to the omit list (it already omits `token_url`) so `GET /v1/admin/boards` never leaks them | 2 |
| `v1/admin/boards_controller#index` — plan/pilot filtering logic unchanged; no structural change | — |

**Ops / platform board admin** (`backend/app/controllers/ops/real_estate_boards_controller.rb`, `app/views/ops/real_estate_boards/`)

| Change | Phase |
|---|---|
| `_form.html.erb` + `board_params` permit-list — add the vendor credential fields (enter / rotate the platform credential). Show "last connected OK at" from `vendor_token_cache` / a verify action | 2 |
| `show.html.erb` `set_pilot_status` — the go/no-go signal changes meaning: from "pilot brokerage's RETS creds verified" to "vendor credential connects **and** pilot brokerage has ≥1 verified member". `@pilot_credential` lookup still resolves (entitlement row) | 2 |
| **Ops board-access review view** — net-new, no home today. Per board: the list of entitled brokerages with entitlement `status`; the `pending` / `rejected` / `revoked` verification queue; the ops-override action (`rejected` → `confirmed` with a note); `access_revoked_at` / next-purge visibility | **Phase 4 (own ticket)** — see decision below |

**Decision — ops verification-review view is its own Phase 4, not folded into Phase 3.** Phase 3 ships the override *capability* (an `ops`-namespaced endpoint + a minimal action, reachable from a verification's detail or via a console/task if needed) and the notification emails, so a rejected/stuck verification is never unrecoverable. The full review dashboard (queues, per-board entitlement rosters, purge visibility) is a distinct UI effort with its own scope and isn't on the critical path for the gate working end-to-end. It also benefits from being designed once RB-81 answers settle the timeout/no-response behavior it needs to surface.

## References

- **RB-82** — this ADR's ticket
- **RB-81** — GVR follow-up questions backlog (Q1–8 feed the open questions above)
- **RB-64** — Build VOW Registrant access flow — the disjoint *consumer/Registrant* gate (`client` role); this ADR is the *member* side (`owner`/`admin`/`agent`). They compose without interaction — a `client` never hits the good-standing gate, a member never hits the VOW ToU gate
- **RB-58** — Sept 9 GVR call prep + outcomes (vendor-vs-member contract clarification; credential-topology was flagged open in its "Bridge Interactive" section)
- **RB-77** — Verify Bridge listing + Member sync against live board test credentials
- **RB-76** — listing-agent / Member roster sync (`board_members`, `bridge_member_import_job`, `ResoMemberMapper`) — the roster this gate matches against
- `PLAN-TIERS.md` — `plan_config.real_boards` gating, which stays orthogonal to good-standing
