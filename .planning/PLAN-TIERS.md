# Plan Tiers

Reference for the brokerage pricing tiers: what each is for, what's gated, and how upgrade/downgrade transitions behave. Read this before implementing any plan-gated feature (backend endpoint or frontend guard/permission) — mirrors the role-gating reference in `ROLES.md`.

**Status:** Design finalized (2026-07-14 pricing brainstorm); not yet implemented. Current code state is the pre-existing binary `basic`/`premium` enum (`backend/app/models/brokerage.rb`), gating only custom domains (`admin/domains_controller.rb`). This document describes the target v1.12 design — see `.planning/REQUIREMENTS.md` (PLAN-01–19) for the tracked requirements.

Single source of truth for the tier list and its config values, once built: a centralized plan-config constant (not yet created — see Key Decisions). Everything below describes intended behavior; treat file:line pointers as aspirational until the corresponding phase ships.

## Summary

| Tier | Price | Seats included | Seat overage | Real MLS/RETS boards | Clients | Custom domain | Calendar sync |
|---|---|---|---|---|---|---|---|
| `free` | $0 | Unlimited | — | Blocked (TEST board only) | Blocked | ✗ (subdomain only) | None |
| `independent` | $20/mo | 1 | $20/seat | Unlimited | Unlimited | ✓ | Google |
| `growth` | $79/mo | 5 | $16/seat | Unlimited | Unlimited | ✓ | Google |

Annual billing: 15% discount on `independent` and `growth` base price.

## Tiers in detail

### free

The permanent acquisition-funnel tier — not a time-boxed trial. A Free brokerage gets the full product experience (groups, comments, ratings, likes, documents, RSVP/dates, filter sets) operating entirely against the seeded `TEST` board's demo listings (`is_test_board: true`, ~100 fake NV listings, RETS-validation-bypassed per existing board-connect logic).

The wall is deliberately **not** a feature cut — automatic filters, group management, and all engagement tooling work exactly as they do on paid tiers. The wall is **commercial usability**: a Free brokerage can never connect a real board or invite a real client, so it can never run actual business on the platform, no matter how many agent seats it adds. Agent/staff seats are uncapped on Free specifically because more internal adoption before hitting the wall increases upgrade pressure, not abuse risk.

### independent

The entry paid tier, renamed from an earlier "Solo" concept. Deliberately priced with **zero volume discount** ($20 base ÷ 1 seat = $20/seat overage) — Independent's role in the ladder is to be the un-discounted anchor that makes every tier above it look like a deal. A single brokerage adding teammates under Independent always pays more per seat than jumping to Growth once headcount grows past a handful of people, which is the intended nudge (see Key Decisions on overage formula).

### growth

Named after the size class it targets, not the earlier (larger, now-deferred) tier of the same working name — this is the $79/mo, 5-seat tier previously discussed as "Starter" before the launch scope was cut down to three tiers. A higher-seat-count tier (formerly sketched at $249/20 seats and $699/60 seats) is deferred to v2 until Growth-tier brokerages are consistently outgrowing 5 seats.

## Key Decisions

| Decision | Rationale |
|---|---|
| Board wall (TEST-only), not feature cuts, defines Free | A workflow inconvenience (e.g. "no automatic filters") is something a stubborn free brokerage can just live with forever; "can't run real business" is a hard wall that doesn't degrade the demo experience |
| No client invites at all on Free | Real estate clients only make sense paired with real listings — inviting a client to browse fake TEST-board inventory is commercially meaningless and would be a confusing, unprofessional experience for the brokerage's actual customers |
| Unlimited seats on Free | The board wall already makes Free commercially unusable regardless of team size — capping seats would blunt the funnel (more internal adoption = more upgrade pressure) without closing any real abuse vector |
| Custom domain available from the first paid tier up (not gated to a higher tier) | For a solo/independent broker, the domain effectively *is* their brand — arguably more essential to them than to a team that already has a shared brokerage identity to lean on |
| Seat overage price = tier's own base ÷ included seats (no discount on marginal seats) | Guarantees overage is never cheaper than jumping to the next tier's blended rate — volume discounts only come from moving to a bigger included bucket, never from stacking one-off seats |
| No board cap on any paid tier | Simplifies the entire paid-to-paid downgrade path to a pure billing recalculation — no board ever needs to be dropped/chosen, since board access doesn't vary by paid tier |
| Calendar sync identical across all paid tiers | Only Google Calendar sync is live today (Microsoft/Apple adapters exist but are dormant — separate deferred item, unrelated to plan tiers); when those activate, they apply uniformly, not gated by tier |
| No time-boxed trial | Independent is cheap enough ($20/mo) to function as the "try it for real" step; Free already lets a prospect fully evaluate the workflow with zero time pressure and zero card required |
| Free → paid: silent auto-purge of TEST-board data | It's disposable demo data by design — a confirm prompt just adds friction to a moment that should feel like "welcome, this is now the real thing" |
| Paid → Free: freeze and restore, not purge | Unlike Free's demo data, real board credentials and real client relationships are a paying brokerage's actual business — deleting them on a temporary downgrade risks real work loss and support blowback. Mirrors the existing `freeze_custom_domains!`/`unfreeze_custom_domains!` pattern for custom domains. |
| Paid → Free board disconnect is soft (credential preserved) | Re-entering RETS credentials is real friction; preserving the (inactive) credential row means re-upgrading needs zero manual reconnection |
| Plan config as a code-level constant, not a DB-backed model | "Centrally defined" solves the actual problem (values scattered/duplicated across controllers) without the added scope of building admin CRUD for a billing system that doesn't have payment processing wired up yet. Revisit as a DB-backed model only if tweak frequency turns out to demand runtime edits without a deploy. |

## Known gaps

- **No payment processor integration exists.** This document and its requirements (PLAN-01–19) define the tier *structure and gating rules* only. Actual payment collection, checkout flow, and invoicing remain under `BILL-01`, tracked separately as a larger, not-yet-scoped effort.
- **Annual discount interaction with seat overage is unresolved.** The 15% discount is confirmed for base price; whether it also applies to overage seat billing needs to be settled during phase planning.
- **Plan enum migration path is undefined.** Existing brokerages are on `basic`/`premium` today; how those map onto `free`/`independent`/`growth` at rollout (e.g. does existing `premium` become `growth` or stay pinned above it) is not yet decided.

## Gating a new feature by plan

- **Backend:** read seat caps, board policy, and pricing from the centralized plan config (once created) — never hardcode a tier name or numeric cap inline in a controller. If a new feature needs a plan check, add it to the same config-driven pattern rather than inventing a one-off `brokerage.plan == "..."` check.
- **Frontend:** mirror the `RequireRole`/`Can` pattern from `ROLES.md` — gate UI on a plan-derived permission, not a raw string comparison against `brokerage.plan`, so the mapping stays auditable in one place.
- **Data lifecycle:** any new plan-gated resource needs an explicit answer to "what happens to this on downgrade to Free?" before it ships — freeze-and-restore is the default per Key Decisions above; deviating from that (e.g. purging real data) needs its own justification, not just convenience.
